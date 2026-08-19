import { db } from '../../firebase.js';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { formatCurrency, formatPercent } from '../../utils/formatters.js';
import { getCurrentUser } from '../../auth.js';
import { logAuditAction } from '../../utils/audit.js';
import { createModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderServicesPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  let services = [];

  async function loadServices() {
    try {
      const snap = await fastGetDocs(collection(db, 'services'));
      services = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  }

  await loadServices();

  function renderUI() {
    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 700;">Active Water Station Services</h3>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary);">Set prices and employee commission rates for refilling & delivery.</p>
        </div>
        <button class="btn btn-primary" id="btn-add-service">
          <i data-lucide="plus"></i> Add New Service
        </button>
      </div>

      <div class="glass-card">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Price (₱)</th>
                <th>Employee Commission Rate</th>
                <th>Employee Earnings / Jug</th>
                <th>Station Net / Jug</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${services.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">No services configured yet. Click "Add New Service" above.</td></tr>
              ` : services.map(s => {
                const commRate = s.commissionRate || 0.27;
                const empPay = s.price * commRate;
                const stationNet = s.price - empPay;
                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--color-accent);">${s.name}</td>
                    <td class="mono" style="font-weight: 600; font-size: 1rem; color: var(--color-success);">${formatCurrency(s.price)}</td>
                    <td class="mono" style="color: var(--color-warning); font-weight: 600;">${formatPercent(commRate)}</td>
                    <td class="mono" style="color: var(--color-warning);">${formatCurrency(empPay)}</td>
                    <td class="mono">${formatCurrency(stationNet)}</td>
                    <td>
                      <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary btn-sm btn-edit-service" data-id="${s.id}"><i data-lucide="pencil"></i> Edit</button>
                        <button class="btn btn-danger btn-sm btn-delete-service" data-id="${s.id}"><i data-lucide="x-circle"></i> Delete</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Attach Add Service Handler
    container.querySelector('#btn-add-service')?.addEventListener('click', () => {
      openServiceModal();
    });

    // Attach Edit Handlers
    container.querySelectorAll('.btn-edit-service').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = services.find(item => item.id === btn.dataset.id);
        if (s) openServiceModal(s);
      });
    });

    // Attach Delete Handlers
    container.querySelectorAll('.btn-delete-service').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = services.find(item => item.id === btn.dataset.id);
        if (s) confirmDeleteService(s);
      });
    });
  }

  function confirmDeleteService(service) {
    createModal({
      title: '<i data-lucide="alert-triangle" style="color: var(--color-danger);"></i> Confirm Delete Service',
      bodyContent: `
        <p style="font-size: 0.95rem; color: var(--color-text-primary); margin-bottom: 1rem;">
          Are you sure you want to delete service <strong style="color: var(--color-accent);">${service.name}</strong> (₱${service.price})?
        </p>
        <p style="font-size: 0.85rem; color: var(--color-danger);">
          This action cannot be undone and will remove the service from station selection.
        </p>
      `,
      primaryActionText: 'Yes, Delete Service',
      onSave: async () => {
        try {
          const { profile } = getCurrentUser();
          await deleteDoc(doc(db, 'services', service.id));

          await logAuditAction({
            user: profile,
            action: 'service.deleted',
            entity: 'services',
            entityId: service.id,
            description: `Deleted service "${service.name}"`
          });

          showToast(`Service "${service.name}" deleted.`, 'success');
          await loadServices();
          renderUI();
          return true;
        } catch (err) {
          console.error('Delete service error:', err);
          showToast('Failed to delete service', 'danger');
          return false;
        }
      }
    });
  }

  function openServiceModal(existingService = null) {
    const isEdit = !!existingService;
    const formHtml = `
      <form id="service-form">
        <div class="form-group">
          <label class="form-label">Service Name</label>
          <input class="form-input" type="text" id="svc-name" placeholder="e.g. Refill + Deliver" value="${existingService?.name || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Price per Jug (₱)</label>
          <input class="form-input" type="number" step="0.5" id="svc-price" placeholder="30.00" value="${existingService?.price || 30}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Employee Commission Rate (%)</label>
          <input class="form-input" type="number" step="1" min="0" max="100" id="svc-rate" placeholder="27" value="${(existingService?.commissionRate || 0.27) * 100}" required />
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">Default is 27%. Employee will receive 27% of the jug price upon delivery.</span>
        </div>
      </form>
    `;

    createModal({
      title: isEdit ? 'Edit Service & Pricing' : 'Create New Service',
      bodyContent: formHtml,
      primaryActionText: isEdit ? 'Update Service' : 'Save Service',
      onSave: async (modalEl) => {
        const name = modalEl.querySelector('#svc-name').value.trim();
        const price = parseFloat(modalEl.querySelector('#svc-price').value) || 0;
        const ratePercent = parseFloat(modalEl.querySelector('#svc-rate').value) || 27;
        const commissionRate = ratePercent / 100;

        if (!name || price <= 0) {
          showToast('Please enter a valid service name and price', 'warning');
          return false;
        }

        try {
          const { profile } = getCurrentUser();

          if (isEdit) {
            const docRef = doc(db, 'services', existingService.id);
            await updateDoc(docRef, {
              name,
              price,
              commissionRate,
              updatedAt: serverTimestamp()
            });

            await logAuditAction({
              user: profile,
              action: 'service.price_updated',
              entity: 'services',
              entityId: existingService.id,
              description: `Updated service "${name}" price to ₱${price} and commission to ${ratePercent}%`,
              oldValue: { price: existingService.price, commissionRate: existingService.commissionRate },
              newValue: { price, commissionRate }
            });

            showToast('Service updated successfully!', 'success');
          } else {
            const newDoc = await addDoc(collection(db, 'services'), {
              name,
              price,
              commissionRate,
              isActive: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            await logAuditAction({
              user: profile,
              action: 'service.created',
              entity: 'services',
              entityId: newDoc.id,
              description: `Created new service "${name}" with price ₱${price} and commission ${ratePercent}%`
            });

            showToast('New service added!', 'success');
          }

          await loadServices();
          renderUI();
          return true;
        } catch (err) {
          console.error('Save service error:', err);
          showToast('Failed to save service', 'danger');
          return false;
        }
      }
    });
  }

  renderUI();

  return {
    title: 'Services & Pricing Configuration',
    subtitle: 'Manage water products, pricing, and employee commission rates',
    element: container
  };
}
