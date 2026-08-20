import { db } from '../../firebase.js';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentUser } from '../../auth.js';
import { logAuditAction } from '../../utils/audit.js';
import { createModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderCustomersPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  let customers = [];
  let searchQuery = '';

  async function loadCustomers() {
    try {
      const snap = await fastGetDocs(collection(db, 'customers'));
      customers = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
      customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  }

  await loadCustomers();

  function renderUI() {
    const filteredCustomers = customers.filter(c => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    });

    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 700;">Station Customer Directory</h3>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary);">Manage registered water refill delivery customers and delivery addresses.</p>
        </div>
        <button class="btn btn-primary" id="btn-add-customer">
          <i data-lucide="user-plus"></i> Add New Customer
        </button>
      </div>

      <div class="glass-card" style="padding: 1.5rem;">
        <!-- Clean Search & Count Toolbar -->
        <div class="flex-between" style="margin-bottom: 1.25rem; gap: 1rem; flex-wrap: wrap;">
          <div style="position: relative; max-width: 380px; width: 100%;">
            <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); width: 1rem; height: 1rem; pointer-events: none;"></i>
            <input class="form-input" type="text" id="search-customers-input" placeholder="Search customer, address, phone..." value="${searchQuery}" style="padding-left: 2.35rem; width: 100%; border-radius: var(--radius-md);" />
          </div>
          <div style="font-size: 0.85rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 0.5rem;">
            <span>Total Customers:</span>
            <span style="background: rgba(0, 180, 216, 0.15); color: var(--color-accent); font-weight: 700; padding: 0.2rem 0.65rem; border-radius: var(--radius-full); font-size: 0.82rem; border: 1px solid rgba(0, 180, 216, 0.3);">${filteredCustomers.length}</span>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Delivery Address</th>
                <th>Phone Number</th>
                <th>Notes</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCustomers.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">
                  ${searchQuery ? `No customers matching "${searchQuery}" found.` : 'No customers registered yet. Click "Add New Customer" above.'}
                </td></tr>
              ` : filteredCustomers.map(c => `
                <tr>
                  <td style="font-weight: 700; color: var(--color-accent);">${c.name}</td>
                  <td>${c.address || 'N/A'}</td>
                  <td>${c.phone || 'N/A'}</td>
                  <td style="color: var(--color-text-muted); font-size: 0.85rem;">${c.notes || '-'}</td>
                  <td style="text-align: right;">
                    <div style="display: flex; gap: 0.45rem; justify-content: flex-end;">
                      <button class="btn btn-secondary btn-sm btn-edit-customer" data-id="${c.id}" title="Edit Customer Details" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                        <i data-lucide="edit-3" style="width: 0.85rem; height: 0.85rem;"></i> Edit
                      </button>
                      <button class="btn btn-danger btn-sm btn-delete-customer" data-id="${c.id}" title="Delete Customer" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                        <i data-lucide="trash-2" style="width: 0.85rem; height: 0.85rem;"></i> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Search input listener
    const searchInput = container.querySelector('#search-customers-input');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderUI();
      const updatedInput = container.querySelector('#search-customers-input');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.setSelectionRange(updatedInput.value.length, updatedInput.value.length);
      }
    });

    // Add customer listener
    container.querySelector('#btn-add-customer')?.addEventListener('click', openAddCustomerModal);

    // Edit customer listeners
    container.querySelectorAll('.btn-edit-customer').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const customer = customers.find(item => item.id === id);
        if (customer) openEditCustomerModal(customer);
      });
    });

    // Delete customer listeners
    container.querySelectorAll('.btn-delete-customer').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const customer = customers.find(item => item.id === id);
        if (customer) openDeleteCustomerModal(customer);
      });
    });

    if (window.lucide) window.lucide.createIcons();
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
          <input class="form-input" type="text" id="cust-address" placeholder="e.g. Zone 2, Maangas" required />
        </div>
        <div class="form-group">
          <label class="form-label">Contact Phone Number</label>
          <input class="form-input" type="tel" id="cust-phone" placeholder="09171234567" required />
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Notes / Schedule</label>
          <input class="form-input" type="text" id="cust-notes" placeholder="e.g. Delivers Friday morning" />
        </div>
      </form>
    `;

    createModal({
      title: '<i data-lucide="user-plus"></i> Add New Customer',
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
    if (window.lucide) window.lucide.createIcons();
  }

  function openEditCustomerModal(customer) {
    const html = `
      <form id="edit-customer-form">
        <div class="form-group">
          <label class="form-label">Customer Name</label>
          <input class="form-input" type="text" id="edit-cust-name" value="${customer.name || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Address</label>
          <input class="form-input" type="text" id="edit-cust-address" value="${customer.address || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Contact Phone Number</label>
          <input class="form-input" type="tel" id="edit-cust-phone" value="${customer.phone || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Delivery Notes / Schedule</label>
          <input class="form-input" type="text" id="edit-cust-notes" value="${customer.notes || ''}" />
        </div>
      </form>
    `;

    createModal({
      title: `<i data-lucide="edit-3"></i> Edit Customer: ${customer.name}`,
      bodyContent: html,
      primaryActionText: 'Save Changes',
      onSave: async (modalEl) => {
        const name = modalEl.querySelector('#edit-cust-name').value.trim();
        const address = modalEl.querySelector('#edit-cust-address').value.trim();
        const phone = modalEl.querySelector('#edit-cust-phone').value.trim();
        const notes = modalEl.querySelector('#edit-cust-notes').value.trim();

        if (!name) {
          showToast('Customer name is required', 'warning');
          return false;
        }

        try {
          const { profile } = getCurrentUser();
          await updateDoc(doc(db, 'customers', customer.id), {
            name,
            address,
            phone,
            notes,
            updatedAt: serverTimestamp()
          });

          await logAuditAction({
            user: profile,
            action: 'customer.updated',
            entity: 'customers',
            entityId: customer.id,
            description: `Updated customer "${name}" details`
          });

          showToast(`Customer "${name}" updated successfully!`, 'success');
          await loadCustomers();
          renderUI();
          return true;
        } catch (err) {
          console.error('Update customer error:', err);
          showToast('Failed to update customer', 'danger');
          return false;
        }
      }
    });
    if (window.lucide) window.lucide.createIcons();
  }

  function openDeleteCustomerModal(customer) {
    const html = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <p style="font-size: 0.95rem; color: var(--color-text-primary);">
          Are you sure you want to delete customer <strong style="color: var(--color-danger);">${customer.name}</strong> from the directory?
        </p>
        <div style="background: rgba(239, 71, 111, 0.1); border: 1px solid rgba(239, 71, 111, 0.3); padding: 0.85rem; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--color-text-secondary);">
          <div><strong>Address:</strong> ${customer.address || 'N/A'}</div>
          <div><strong>Phone:</strong> ${customer.phone || 'N/A'}</div>
          <div style="margin-top: 0.4rem; color: var(--color-danger);">Past logged deliveries for this customer will remain in the delivery log archive for bookkeeping.</div>
        </div>
      </div>
    `;

    createModal({
      title: `<i data-lucide="trash-2"></i> Delete Customer`,
      bodyContent: html,
      primaryActionText: 'Confirm & Delete',
      onSave: async () => {
        try {
          const { profile } = getCurrentUser();
          await deleteDoc(doc(db, 'customers', customer.id));

          await logAuditAction({
            user: profile,
            action: 'customer.deleted',
            entity: 'customers',
            entityId: customer.id,
            description: `Deleted customer "${customer.name}" from station directory`
          });

          showToast(`Customer "${customer.name}" removed from directory!`, 'success');
          await loadCustomers();
          renderUI();
          return true;
        } catch (err) {
          console.error('Delete customer error:', err);
          showToast('Failed to delete customer', 'danger');
          return false;
        }
      }
    });
    if (window.lucide) window.lucide.createIcons();
  }

  renderUI();

  return {
    title: 'Customer Directory',
    subtitle: 'Manage water refilling station delivery customers and delivery addresses',
    element: container
  };
}
