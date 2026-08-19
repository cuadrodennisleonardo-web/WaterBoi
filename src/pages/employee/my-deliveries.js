import { db } from '../../firebase.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getCurrentUser } from '../../auth.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { renderReceiptModal } from '../../components/receipt.js';
import { createModal } from '../../components/modal.js';
import { printElement } from '../../utils/export.js';
import { getPendingDeliveries } from '../../utils/offlineQueue.js';

import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderMyDeliveriesPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.25rem;';

  const { profile, firebaseUser } = getCurrentUser();
  const empId = profile?.id || firebaseUser?.uid;

  let deliveries = [];

  try {
    if (empId) {
      // 1. Fetch cloud records instantly from cache/server
      try {
        const snap = await fastGetDocs(query(collection(db, 'deliveries'), where('employeeId', '==', empId)));
        deliveries = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
      } catch (cloudErr) {
        console.warn('Could not fetch cloud deliveries, reading local queue:', cloudErr);
      }

      // 2. Merge local pending offline deliveries
      const localPending = getPendingDeliveries().filter(d => d.employeeId === empId);
      const existingIds = new Set(deliveries.map(d => d.id));

      localPending.forEach(lp => {
        if (!existingIds.has(lp.id)) {
          deliveries.push(lp);
        }
      });

      // 3. Sort chronologically descending
      deliveries.sort((a, b) => {
        const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dB - dA;
      });
    }
  } catch (err) {
    console.error('Error fetching employee deliveries:', err);
  }

  container.innerHTML = `
    <div class="glass-card">
      <div class="flex-between" style="margin-bottom: 1rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700;">My Delivery History</h3>
        <span class="badge badge-info">${deliveries.length} Total Deliveries</span>
      </div>

      <!-- Desktop Table View -->
      <div class="table-container desktop-table-view">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Jugs</th>
              <th>Total Price</th>
              <th>My Commission</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            ${deliveries.length === 0 ? `
              <tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">No delivery history logged yet.</td></tr>
            ` : deliveries.map(d => `
              <tr>
                <td>${formatDate(d.createdAt, true)}</td>
                <td style="font-weight: 700; color: var(--color-accent);">${d.customerName || 'Walk-in'}</td>
                <td>${d.serviceName || 'Refill & Deliver'}</td>
                <td class="mono" style="font-weight: 700;">
                  ${d.jugCount}
                  ${d.jugNumbers && d.jugNumbers.length > 0 ? `
                    <div style="font-size: 0.72rem; color: var(--color-accent); margin-top: 0.15rem; font-weight: normal;">
                      ${d.jugNumbers.join(', ')}
                    </div>
                  ` : ''}
                </td>
                <td class="mono" style="color: var(--color-success);">${formatCurrency(d.totalPrice)}</td>
                <td class="mono" style="color: var(--color-warning); font-weight: 700;">${formatCurrency(d.commissionAmount)}</td>
                <td>
                  <button class="btn btn-secondary btn-sm btn-my-receipt" data-id="${d.id}"><i data-lucide="receipt"></i> Receipt</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile Card List View -->
      <div class="mobile-card-list">
        ${deliveries.length === 0 ? `
          <div style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No delivery history logged yet.</div>
        ` : deliveries.map(d => `
          <div class="glass-card-sm" style="background: rgba(0, 0, 0, 0.25); border: 1px solid var(--color-border-glass); display: flex; flex-direction: column; gap: 0.65rem;">
            <div class="flex-between">
              <div>
                <span style="font-weight: 700; color: var(--color-accent); font-size: 0.95rem; display: block;">${d.customerName || 'Walk-in Customer'}</span>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">${formatDate(d.createdAt, true)}</span>
              </div>
              <button class="btn btn-secondary btn-sm btn-my-receipt" data-id="${d.id}" style="padding: 0.35rem 0.6rem; font-size: 0.78rem;">
                <i data-lucide="receipt"></i> Receipt
              </button>
            </div>

            <div style="font-size: 0.8rem; color: var(--color-text-secondary); background: rgba(0, 180, 216, 0.06); padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 0.25rem;">
              <div><strong>Service:</strong> ${d.serviceName || 'Refill & Deliver'}</div>
              <div><strong>Jugs:</strong> ${d.jugCount} ${d.jugNumbers && d.jugNumbers.length > 0 ? `(${d.jugNumbers.join(', ')})` : ''}</div>
            </div>

            <div class="flex-between" style="border-top: 1px dashed var(--color-border-glass); padding-top: 0.5rem; font-size: 0.88rem;">
              <div>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">Total Price:</span>
                <strong class="mono" style="color: var(--color-success); margin-left: 0.25rem;">${formatCurrency(d.totalPrice)}</strong>
              </div>
              <div>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">My Comm:</span>
                <strong class="mono" style="color: var(--color-warning); margin-left: 0.25rem;">${formatCurrency(d.commissionAmount)}</strong>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Receipt Modal Event Handlers
  container.querySelectorAll('.btn-my-receipt').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = deliveries.find(item => item.id === btn.dataset.id);
      if (d) {
        const receiptHtml = renderReceiptModal(d);
        createModal({
          title: 'Official Delivery Receipt',
          bodyContent: receiptHtml,
          primaryActionText: '<i data-lucide="printer"></i> Print Receipt',
          onSave: () => {
            printElement(`receipt-${d.id}`);
            return false;
          }
        });
        if (window.lucide) window.lucide.createIcons();
      }
    });
  });

  return {
    title: 'My Deliveries',
    subtitle: 'History of all your water jug delivery entries and receipts',
    element: container
  };
}
