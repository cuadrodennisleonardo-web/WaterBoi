import { db } from '../../firebase.js';
import { collection, getDocs, query, where, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { navigateTo } from '../../router.js';
import { getCurrentUser, createEmployeeAccount } from '../../auth.js';
import { logAuditAction } from '../../utils/audit.js';
import { createModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderEmployeesPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  let employees = [];

  async function loadEmployees() {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'employee'));
      const snap = await fastGetDocs(q);
      employees = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  }

  await loadEmployees();

  function renderUI() {
    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 700;">Station Staff & Delivery Employees</h3>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary);">Manage employee accounts, view individual delivery performance, and track payouts.</p>
        </div>
        <button class="btn btn-primary" id="btn-add-emp-wizard">
          <i data-lucide="wand-2"></i> Add Employee Wizard
        </button>
      </div>

      <div class="glass-card">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Contact Number</th>
                <th>Email Login</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${employees.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">No employees registered yet. Click "Add Employee Wizard" above.</td></tr>
              ` : employees.map(emp => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <div class="user-avatar" style="width: 34px; height: 34px; font-size: 0.85rem;">${(emp.name || 'E').charAt(0).toUpperCase()}</div>
                      <div style="display: flex; flex-direction: column;">
                        <span style="font-weight: 700;">${emp.name}</span>
                        ${emp.isDummy ? `<span class="badge badge-warning" style="font-size: 0.65rem; padding: 0.1rem 0.4rem; margin-top: 0.1rem;">TEST DUMMY ACCOUNT</span>` : ''}
                      </div>
                    </div>
                  </td>
                  <td>${emp.phone || 'N/A'}</td>
                  <td style="color: var(--color-accent);">${emp.email}</td>
                  <td>
                    <span class="badge badge-${emp.status === 'active' ? 'success' : 'danger'}">${emp.status || 'active'}</span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 0.5rem;">
                      <button class="btn btn-secondary btn-sm btn-view-emp-detail" data-id="${emp.id}">
                        <i data-lucide="bar-chart-2"></i> Performance
                      </button>
                      <button class="btn btn-danger btn-sm btn-delete-emp" data-id="${emp.id}">
                        <i data-lucide="x-circle"></i> Remove
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

    // Attach Wizard Event
    container.querySelector('#btn-add-emp-wizard')?.addEventListener('click', openEmployeeWizard);

    // Attach View Detail Events
    container.querySelectorAll('.btn-view-emp-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        navigateTo(`/admin/employee-detail?id=${btn.dataset.id}`);
      });
    });

    // Attach Delete Events
    container.querySelectorAll('.btn-delete-emp').forEach(btn => {
      btn.addEventListener('click', () => {
        const emp = employees.find(item => item.id === btn.dataset.id);
        if (emp) confirmDeleteEmployee(emp);
      });
    });
  }

  function confirmDeleteEmployee(emp) {
    const isDummy = !!emp.isDummy;
    createModal({
      title: '<i data-lucide="alert-triangle" style="color: var(--color-danger);"></i> Confirm Remove Employee',
      bodyContent: `
        <p style="font-size: 0.95rem; color: var(--color-text-primary); margin-bottom: 1rem;">
          Are you sure you want to remove employee <strong style="color: var(--color-accent);">${emp.name}</strong> (${emp.email}) from the station roster?
        </p>

        <div style="margin-top: 1rem; padding: 0.85rem; background: rgba(255, 209, 102, 0.08); border: 1px solid rgba(255, 209, 102, 0.25); border-radius: var(--radius-md);">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; color: var(--color-warning);">
            <input type="checkbox" id="chk-clean-test-data" ${isDummy ? 'checked' : ''} />
            Clean up & delete all delivery logs written by this employee
          </label>
        </div>
      `,
      primaryActionText: 'Yes, Remove Staff',
      onSave: async (modalEl) => {
        const cleanData = modalEl.querySelector('#chk-clean-test-data')?.checked;
        try {
          const { profile } = getCurrentUser();

          if (cleanData) {
            // Fetch and delete all deliveries written by this employee
            const delSnap = await getDocs(query(collection(db, 'deliveries'), where('employeeId', '==', emp.id)));
            const delPromises = delSnap.docs.map(d => deleteDoc(doc(db, 'deliveries', d.id)));
            await Promise.all(delPromises);
          }

          // Delete user document
          await deleteDoc(doc(db, 'users', emp.id));

          await logAuditAction({
            user: profile,
            action: 'employee.deleted',
            entity: 'users',
            entityId: emp.id,
            description: `Removed employee "${emp.name}" (${emp.email})${cleanData ? ' and purged their delivery logs' : ''}`
          });

          showToast(`Employee "${emp.name}" removed${cleanData ? ' & test data cleaned' : ''}!`, 'success');
          await loadEmployees();
          renderUI();
          return true;
        } catch (err) {
          console.error('Delete employee error:', err);
          showToast('Failed to remove employee', 'danger');
          return false;
        }
      }
    });
  }

  function openEmployeeWizard() {
    const wizardHtml = `
      <form id="emp-wizard-form">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-input" type="text" id="emp-name" placeholder="e.g. Pedro Penduko" required />
        </div>
        <div class="form-group">
          <label class="form-label">Contact Phone Number</label>
          <input class="form-input" type="tel" id="emp-phone" placeholder="09171234567" required />
        </div>
        <div class="form-group">
          <label class="form-label">Login Email Address</label>
          <input class="form-input" type="email" id="emp-email" placeholder="pedro@waterboi.com" required />
        </div>
        <div class="form-group">
          <label class="form-label">App Access Password</label>
          <input class="form-input" type="text" id="emp-pass" placeholder="e.g. WaterBoi2026!" required />
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">Share this login with the employee so they can log deliveries from their phone.</span>
        </div>
        <div class="form-group" style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed var(--color-border-glass);">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; color: var(--color-warning);">
            <input type="checkbox" id="emp-is-dummy" />
            Mark as Test / Dummy Employee Account
          </label>
          <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block; margin-top: 0.2rem;">
            When deleting a dummy account, all associated test delivery records can be automatically cleaned up too.
          </span>
        </div>
      </form>
    `;

    createModal({
      title: '<i data-lucide="wand-2"></i> Employee Registration Wizard',
      bodyContent: wizardHtml,
      primaryActionText: 'Create Account',
      onSave: async (modalEl) => {
        const name = modalEl.querySelector('#emp-name').value.trim();
        const phone = modalEl.querySelector('#emp-phone').value.trim();
        const email = modalEl.querySelector('#emp-email').value.trim();
        const pass = modalEl.querySelector('#emp-pass').value.trim();
        const isDummy = modalEl.querySelector('#emp-is-dummy').checked;

        if (!name || !email || !pass) {
          showToast('Please fill in all required fields', 'warning');
          return false;
        }

        try {
          const { profile } = getCurrentUser();
          
          const uid = await createEmployeeAccount({
            name,
            phone,
            email,
            password: pass,
            isDummy
          });

          await logAuditAction({
            user: profile,
            action: 'employee.created',
            entity: 'users',
            entityId: uid,
            description: `Registered new employee "${name}" (${email})`
          });

          showToast(`Employee "${name}" account created!`, 'success');
          await loadEmployees();
          renderUI();
          return true;
        } catch (err) {
          console.error('Create employee error:', err);
          showToast('Failed to create employee profile', 'danger');
          return false;
        }
      }
    });
  }

  renderUI();

  return {
    title: 'Employee Management',
    subtitle: 'Register new delivery staff and track individual performance',
    element: container
  };
}
