import { db } from '../../firebase.js';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { downloadCSV } from '../../utils/export.js';
import { renderReceiptModal } from '../../components/receipt.js';
import { createModal } from '../../components/modal.js';
import { printElement } from '../../utils/export.js';
import { getCurrentUser } from '../../auth.js';
import { logAuditAction } from '../../utils/audit.js';
import { showToast } from '../../components/toast.js';
import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderDeliveriesPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  let deliveries = [];

  async function loadDeliveries() {
    try {
      const snap = await fastGetDocs(query(collection(db, 'deliveries'), orderBy('createdAt', 'desc'), limit(100)));
      deliveries = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching deliveries:', err);
    }
  }

  await loadDeliveries();

  function renderUI() {
    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 700;">Water Refill & Delivery Log</h3>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary);">Comprehensive history of all water jug deliveries and calculated employee payouts.</p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-danger btn-sm" id="btn-clear-test-deliveries">
            <i data-lucide="x-circle"></i> Clear Test Logs & Reset Jugs
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-export-csv">
            <i data-lucide="bar-chart-2"></i> Export CSV Report
          </button>
        </div>
      </div>

      <div class="glass-card">
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Delivered By</th>
                <th>Service</th>
                <th>Jugs</th>
                <th>Total Revenue</th>
                <th>Commission</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              ${deliveries.length === 0 ? `
                <tr><td colspan="9" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">No delivery records found.</td></tr>
              ` : deliveries.map(d => `
                <tr>
                  <td>${formatDate(d.createdAt, true)}</td>
                  <td style="font-weight: 700; color: var(--color-accent);">${d.customerName || 'Walk-in'}</td>
                  <td>${d.employeeName || 'Staff'}</td>
                  <td>${d.serviceName || 'Refill & Deliver'}</td>
                  <td class="mono" style="font-weight: 700;">
                    ${d.jugCount}
                    ${d.jugNumbers && d.jugNumbers.length > 0 ? `
                      <div style="font-size: 0.72rem; color: var(--color-accent); margin-top: 0.15rem; font-weight: normal;">
                        ${d.jugNumbers.join(', ')}
                      </div>
                    ` : ''}
                  </td>
                  <td class="mono" style="color: var(--color-success); font-weight: 600;">${formatCurrency(d.totalPrice)}</td>
                  <td class="mono" style="color: var(--color-warning); font-weight: 600;">${formatCurrency(d.commissionAmount)}</td>
                  <td>
                    <span class="badge badge-${d.status === 'delivered' ? 'success' : 'info'}">${d.status || 'delivered'}</span>
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm btn-view-receipt" data-id="${d.id}"><i data-lucide="receipt"></i> Receipt</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Clear Test Deliveries Listener
    container.querySelector('#btn-clear-test-deliveries')?.addEventListener('click', () => {
      createModal({
        title: '<i data-lucide="alert-triangle" style="color: var(--color-danger);"></i> Clear Test Delivery Logs',
        bodyContent: `
          <p style="font-size: 0.95rem; color: var(--color-text-primary); margin-bottom: 1rem;">
            Are you sure you want to <strong>delete all test delivery log entries</strong> and <strong>reset all jug statuses back to In-Stock</strong>?
          </p>
          <p style="font-size: 0.85rem; color: var(--color-danger);">
            This action cannot be undone. It will purge all delivery logs created during testing.
          </p>
        `,
        primaryActionText: 'Yes, Purge Test Data',
        onSave: async () => {
          try {
            const { profile } = getCurrentUser();
            
            // 1. Delete all delivery documents
            const delSnap = await getDocs(collection(db, 'deliveries'));
            const delPromises = delSnap.docs.map(d => deleteDoc(doc(db, 'deliveries', d.id)));
            await Promise.all(delPromises);

            // 2. Reset all registered jugs back to 'in_stock'
            const jSnap = await getDocs(collection(db, 'jugs'));
            if (!jSnap.empty) {
              const batch = writeBatch(db);
              jSnap.docs.forEach(d => {
                batch.update(doc(db, 'jugs', d.id), {
                  status: 'in_stock',
                  updatedAt: serverTimestamp()
                });
              });
              await batch.commit();
            }

            await logAuditAction({
              user: profile,
              action: 'test_data.cleared',
              entity: 'deliveries',
              description: `Purged ${delSnap.docs.length} test delivery logs and reset jug statuses to In-Stock`
            });

            showToast('All test delivery logs purged & jugs reset to In-Stock!', 'success');
            await loadDeliveries();
            renderUI();
            return true;
          } catch (err) {
            console.error('Clear test logs error:', err);
            showToast('Failed to clear test logs', 'danger');
            return false;
          }
        }
      });
    });

    // Export CSV Listener
    container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
      if (deliveries.length === 0) return;
      const csvData = deliveries.map(d => ({
        ID: d.id,
        Date: formatDate(d.createdAt, true),
        Customer: d.customerName || 'Walk-in',
        Employee: d.employeeName || 'Staff',
        Service: d.serviceName || 'Refill & Deliver',
        JugCount: d.jugCount,
        TotalPricePHP: d.totalPrice,
        CommissionPHP: d.commissionAmount,
        Status: d.status || 'delivered'
      }));
      downloadCSV(`WaterBoi_Deliveries_${new Date().toISOString().slice(0, 10)}.csv`, csvData);
    });

    // View Receipt Listeners
    container.querySelectorAll('.btn-view-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = deliveries.find(item => item.id === btn.dataset.id);
        if (d) {
          createModal({
            title: 'Official Delivery Receipt',
            bodyContent: receiptHtml,
            primaryActionText: '<i data-lucide="printer"></i> Print Receipt',
            onSave: () => {
              printElement(`receipt-${d.id}`);
              return false;
            }
          });
        }
      });
    });
  }

  renderUI();

  return {
    title: 'Deliveries & Order Log',
    subtitle: 'Track all station deliveries, jug counts, and employee earnings',
    element: container
  };
}
