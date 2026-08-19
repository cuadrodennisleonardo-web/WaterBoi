import { db } from '../../firebase.js';
import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters.js';
import { getCurrentUser } from '../../auth.js';
import { logAuditAction } from '../../utils/audit.js';
import { createModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderCommissionsPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  let employees = [];
  let deliveries = [];
  let payouts = [];

  async function loadData() {
    try {
      const [empSnap, delSnap, paySnap] = await Promise.all([
        fastGetDocs(query(collection(db, 'users'), where('role', '==', 'employee'))),
        fastGetDocs(collection(db, 'deliveries')),
        fastGetDocs(collection(db, 'commissionPayouts'))
      ]);

      employees = (empSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
      deliveries = (delSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
      payouts = (paySnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching commission data:', err);
    }
  }

  await loadData();

  function calculateEmployeeSummaries() {
    return employees.map(emp => {
      const empDeliveries = deliveries.filter(d => d.employeeId === emp.id);
      const empPayouts = payouts.filter(p => p.employeeId === emp.id && p.status === 'paid');

      let totalJugs = 0;
      let totalRevenue = 0;
      let totalEarnedCommission = 0;

      empDeliveries.forEach(d => {
        totalJugs += Number(d.jugCount) || 0;
        totalRevenue += Number(d.totalPrice) || 0;
        totalEarnedCommission += Number(d.commissionAmount) || 0;
      });

      const totalPaidOut = empPayouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const unpaidBalance = Math.max(0, totalEarnedCommission - totalPaidOut);

      return {
        ...emp,
        totalJugs,
        totalRevenue,
        totalEarnedCommission,
        totalPaidOut,
        unpaidBalance
      };
    });
  }

  function renderUI() {
    const empSummaries = calculateEmployeeSummaries();
    const grandUnpaid = empSummaries.reduce((sum, e) => sum + e.unpaidBalance, 0);
    const grandTotalCommission = empSummaries.reduce((sum, e) => sum + e.totalEarnedCommission, 0);

    container.innerHTML = `
      <div class="grid-stats">
        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">Total Commissions Earned (27%)</span>
            <span class="stat-value text-gradient">${formatCurrency(grandTotalCommission)}</span>
          </div>
          <div class="stat-icon-wrapper"><i data-lucide="banknote"></i></div>
        </div>

        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">Current Unpaid Payout Balance</span>
            <span class="stat-value" style="color: var(--color-warning);">${formatCurrency(grandUnpaid)}</span>
          </div>
          <div class="stat-icon-wrapper" style="color: var(--color-warning); background: var(--color-warning-bg);">⏳</div>
        </div>
      </div>

      <div class="glass-card">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Employee Commission Balances & Payouts</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Total Jugs Delivered</th>
                <th>Total Revenue Generated</th>
                <th>Total Earned</th>
                <th>Total Paid Out</th>
                <th>Unpaid Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${empSummaries.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">No employee accounts registered yet.</td></tr>
              ` : empSummaries.map(emp => `
                <tr>
                  <td style="font-weight: 700; color: var(--color-accent);">${emp.name}</td>
                  <td class="mono">${formatNumber(emp.totalJugs)}</td>
                  <td class="mono" style="color: var(--color-success);">${formatCurrency(emp.totalRevenue)}</td>
                  <td class="mono" style="color: var(--color-warning); font-weight: 600;">${formatCurrency(emp.totalEarnedCommission)}</td>
                  <td class="mono">${formatCurrency(emp.totalPaidOut)}</td>
                  <td class="mono" style="font-weight: 700; color: ${emp.unpaidBalance > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)'};">
                    ${formatCurrency(emp.unpaidBalance)}
                  </td>
                  <td>
                    ${emp.unpaidBalance > 0 ? `
                      <button class="btn btn-success btn-sm btn-pay-commission" data-id="${emp.id}" data-name="${emp.name}" data-amount="${emp.unpaidBalance}">
                        <i data-lucide="send"></i> Pay Out ${formatCurrency(emp.unpaidBalance)}
                      </button>
                    ` : `
                      <span class="badge badge-success">All Paid</span>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Attach Pay Out Event Handlers
    container.querySelectorAll('.btn-pay-commission').forEach(btn => {
      btn.addEventListener('click', () => {
        const empId = btn.dataset.id;
        const empName = btn.dataset.name;
        const amount = parseFloat(btn.dataset.amount) || 0;
        openPayoutModal(empId, empName, amount);
      });
    });
  }

  function openPayoutModal(empId, empName, amount) {
    const html = `
      <p style="font-size: 0.95rem; margin-bottom: 1rem; color: var(--color-text-primary);">
        Are you sure you want to mark <strong>${formatCurrency(amount)}</strong> as paid to <strong>${empName}</strong>?
      </p>
      <div class="form-group">
        <label class="form-label">Payment Notes / Ref Number</label>
        <input class="form-input" type="text" id="pay-notes" placeholder="e.g. Cash payout for July 20-23" required />
      </div>
    `;

    createModal({
      title: `<i data-lucide="send"></i> Confirm Commission Payout for ${empName}`,
      bodyContent: html,
      primaryActionText: 'Confirm & Mark Paid',
      onSave: async (modalEl) => {
        const notes = modalEl.querySelector('#pay-notes').value.trim();

        try {
          const { profile } = getCurrentUser();

          const payoutDoc = await addDoc(collection(db, 'commissionPayouts'), {
            employeeId: empId,
            employeeName: empName,
            amount,
            notes,
            status: 'paid',
            paidAt: serverTimestamp(),
            createdAt: serverTimestamp()
          });

          await logAuditAction({
            user: profile,
            action: 'commission.payout',
            entity: 'commissionPayouts',
            entityId: payoutDoc.id,
            description: `Paid out ${formatCurrency(amount)} commission to ${empName}. Notes: ${notes}`
          });

          showToast(`Payout of ${formatCurrency(amount)} recorded for ${empName}!`, 'success');
          await loadData();
          renderUI();
          return true;
        } catch (err) {
          console.error('Payout error:', err);
          showToast('Failed to record payout', 'danger');
          return false;
        }
      }
    });
  }

  renderUI();

  return {
    title: 'Employee Commissions & Payouts',
    subtitle: 'Track calculated payouts, unpaid balances, and mark cash payouts',
    element: container
  };
}
