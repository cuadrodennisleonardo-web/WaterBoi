import { db } from '../../firebase.js';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentUser } from '../../auth.js';
import { logAuditAction } from '../../utils/audit.js';
import { createModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderCustomersPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  let customers = [];

  async function loadCustomers() {
    try {
      const snap = await fastGetDocs(collection(db, 'customers'));
      customers = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }

  await loadCustomers();

  function renderUI() {
    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 700;">Station Customer Directory</h3>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary);">Manage registered water refill delivery customers and delivery addresses.</p>
        </div>
        <button class="btn btn-primary" id="btn-add-customer">
          <i data-lucide="users"></i> Add New Customer
        </button>
      </div>

      <div class="glass-card">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Delivery Address</th>
                <th>Phone Number</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${customers.length === 0 ? `
                <tr><td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">No customers registered yet. Click "Add New Customer" above.</td></tr>
              ` : customers.map(c => `
                <tr>
                  <td style="font-weight: 700; color: var(--color-accent);">${c.name}</td>
                  <td>${c.address || 'N/A'}</td>
                  <td>${c.phone || 'N/A'}</td>
                  <td style="color: var(--color-text-muted); font-size: 0.85rem;">${c.notes || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelector('#btn-add-customer')?.addEventListener('click', openAddCustomerModal);
  }

  function openAddCustomerModal() {
    const html = `
      <form id="customer-form">
        <div class="form-group">
          <label class="form-label">Customer Name</label>
          <input class="form-input" type="text" id="cust-name" placeholder="e.g. Maria Santos" required />
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Address</label>
          <input class="form-input" type="text" id="cust-address" placeholder="e.g. Block 5 Lot 12 Sample St, Barangay Central" required />
        </div>
        <div class="form-group">
          <label class="form-label">Contact Phone Number</label>
          <input class="form-input" type="tel" id="cust-phone" placeholder="09181234567" required />
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Notes / Preferences</label>
          <input class="form-input" type="text" id="cust-notes" placeholder="e.g. Delivers every Monday morning" />
        </div>
      </form>
    `;

    createModal({
      title: '<i data-lucide="users"></i> Add New Customer',
      bodyContent: html,
      primaryActionText: 'Save Customer',
      onSave: async (modalEl) => {
        const name = modalEl.querySelector('#cust-name').value.trim();
        const address = modalEl.querySelector('#cust-address').value.trim();
        const phone = modalEl.querySelector('#cust-phone').value.trim();
        const notes = modalEl.querySelector('#cust-notes').value.trim();

        if (!name) {
          showToast('Customer name is required', 'warning');
          return false;
        }

        try {
          const { profile } = getCurrentUser();
          const newDoc = await addDoc(collection(db, 'customers'), {
            name,
            address,
            phone,
            notes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          await logAuditAction({
            user: profile,
            action: 'customer.created',
            entity: 'customers',
            entityId: newDoc.id,
            description: `Registered new customer "${name}" (${address})`
          });

          showToast(`Customer "${name}" added!`, 'success');
          await loadCustomers();
          renderUI();
          return true;
        } catch (err) {
          console.error('Save customer error:', err);
          showToast('Failed to save customer', 'danger');
          return false;
        }
      }
    });
  }

  renderUI();

  return {
    title: 'Customer Directory',
    subtitle: 'Manage water refilling station delivery customers and delivery addresses',
    element: container
  };
}
