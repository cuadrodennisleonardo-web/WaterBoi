import { db } from '../../firebase.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getCurrentUser } from '../../auth.js';
import { formatDate, formatCurrency } from '../../utils/formatters.js';
import { renderReceiptModal } from '../../components/receipt.js';
import { createModal } from '../../components/modal.js';
import { printElement } from '../../utils/export.js';

import { fastGetDocs } from '../../utils/fastFetch.js';
import { getPendingDeliveries } from '../../utils/offlineQueue.js';

export async function renderMyReceiptsPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  const { profile, firebaseUser } = getCurrentUser();
  const empId = profile?.id || firebaseUser?.uid;

  let deliveries = [];

  try {
    if (empId) {
      try {
        const snap = await fastGetDocs(query(collection(db, 'deliveries'), where('employeeId', '==', empId)));
        deliveries = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn('Receipts offline fetch:', err);
      }

      // Merge local pending offline deliveries
      const localPending = getPendingDeliveries().filter(d => d.employeeId === empId);
      const existingIds = new Set(deliveries.map(d => d.id));
      localPending.forEach(lp => {
        if (!existingIds.has(lp.id)) deliveries.push(lp);
      });
    }
  } catch (err) {
    console.error('Error fetching receipts:', err);
  }

  container.innerHTML = `
    <div class="glass-card">
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Receipt Archive</h3>
      <!-- Desktop Table View -->
      <div class="table-container desktop-table-view">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt Ref #</th>
              <th>Date</th>
              <th>Customer Name</th>
              <th>Jugs</th>
              <th>Total Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${deliveries.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">No receipts available yet.</td></tr>
            ` : deliveries.map(d => `
              <tr>
                <td class="mono" style="color: var(--color-accent);">${d.id.substring(0, 8).toUpperCase()}</td>
                <td>${formatDate(d.createdAt, true)}</td>
                <td style="font-weight: 600;">${d.customerName || 'Walk-in'}</td>
                <td class="mono">${d.jugCount}</td>
                <td class="mono" style="color: var(--color-success);">${formatCurrency(d.totalPrice)}</td>
                <td>
                  <button class="btn btn-secondary btn-sm btn-print-rcpt-item" data-id="${d.id}"><i data-lucide="printer"></i> View & Print</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile Card List View -->
      <div class="mobile-card-list">
        ${deliveries.length === 0 ? `
          <div style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No receipts available yet.</div>
        ` : deliveries.map(d => `
          <div class="glass-card-sm" style="background: rgba(0, 0, 0, 0.25); border: 1px solid var(--color-border-glass); display: flex; flex-direction: column; gap: 0.65rem;">
            <div class="flex-between">
              <div>
                <span class="mono" style="color: var(--color-accent); font-weight: 700; font-size: 0.85rem;">#${d.id.substring(0, 8).toUpperCase()}</span>
                <span style="font-size: 0.75rem; color: var(--color-text-muted); display: block; margin-top: 0.1rem;">${formatDate(d.createdAt, true)}</span>
              </div>
              <button class="btn btn-secondary btn-sm btn-print-rcpt-item" data-id="${d.id}" style="padding: 0.35rem 0.65rem; font-size: 0.78rem;">
                <i data-lucide="printer"></i> View & Print
              </button>
            </div>

            <div class="flex-between" style="border-top: 1px dashed var(--color-border-glass); padding-top: 0.5rem; font-size: 0.88rem;">
              <div>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">Customer:</span>
                <strong style="color: white; margin-left: 0.25rem;">${d.customerName || 'Walk-in'}</strong>
              </div>
              <div>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">Amount:</span>
                <strong class="mono" style="color: var(--color-success); margin-left: 0.25rem;">${formatCurrency(d.totalPrice)}</strong>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.btn-print-rcpt-item').forEach(btn => {
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

  return {
    title: 'My Receipts Archive',
    subtitle: 'View and print customer receipts for all completed deliveries',
    element: container
  };
}
