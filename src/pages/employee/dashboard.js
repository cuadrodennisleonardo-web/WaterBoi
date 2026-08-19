import { db } from '../../firebase.js';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters.js';
import { getCurrentUser } from '../../auth.js';
import { navigateTo } from '../../router.js';

import { getPendingDeliveries } from '../../utils/offlineQueue.js';
import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderEmployeeDashboardPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  const { profile, firebaseUser } = getCurrentUser();
  const empId = profile?.id || firebaseUser?.uid;

  let totalJugsToday = 0;
  let commissionToday = 0;
  let commissionWeek = 0;
  let recentDeliveries = [];

  try {
    if (empId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let deliveries = [];
      try {
        const delSnap = await fastGetDocs(query(collection(db, 'deliveries'), where('employeeId', '==', empId)));
        deliveries = (delSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn('Dashboard offline fetch:', err);
      }

      // Merge local pending offline deliveries
      const localPending = getPendingDeliveries().filter(d => d.employeeId === empId);
      const existingIds = new Set(deliveries.map(d => d.id));
      localPending.forEach(lp => {
        if (!existingIds.has(lp.id)) deliveries.push(lp);
      });

      // Sort in memory
      deliveries.sort((a, b) => {
        const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return tB - tA;
      });

      deliveries.forEach(d => {
        const dDate = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
        if (dDate >= today) {
          totalJugsToday += Number(d.jugCount) || 0;
          commissionToday += Number(d.commissionAmount) || 0;
        }
        commissionWeek += Number(d.commissionAmount) || 0;
      });

      recentDeliveries = deliveries.slice(0, 5);
    }
  } catch (err) {
    console.error('Employee dashboard error:', err);
  }

  container.innerHTML = `
    <!-- Top Action Banner -->
    <div class="glass-card hero-welcome-card" style="background: linear-gradient(135deg, rgba(0, 180, 216, 0.15) 0%, rgba(13, 27, 42, 0.95) 100%); border-color: var(--color-border-glow); padding: 1.75rem 2rem;">
      <div>
        <h2 style="font-size: 1.4rem; font-weight: 800;">Welcome, ${profile?.name || 'Water Staff'}!</h2>
        <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 0.35rem; margin-bottom: 0.85rem;">
          Log your completed refilled water jug deliveries here — works online or offline!
        </p>
      </div>
      <button class="btn btn-primary btn-lg wave-animated" id="btn-log-delivery-now" style="box-shadow: 0 0 25px rgba(0, 180, 216, 0.5);">
        <i data-lucide="plus"></i> Log New Delivery Now
      </button>
    </div>

    <!-- Personal Metrics -->
    <div class="grid-stats">
      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">Jugs Delivered Today</span>
          <span class="stat-value text-gradient">${formatNumber(totalJugsToday)}</span>
        </div>
        <div class="stat-icon-wrapper"><i data-lucide="droplet"></i></div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">My Earnings Today</span>
          <span class="stat-value" style="color: var(--color-warning);">${formatCurrency(commissionToday)}</span>
        </div>
        <div class="stat-icon-wrapper" style="color: var(--color-warning); background: var(--color-warning-bg);"><i data-lucide="banknote"></i></div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">My Total Earnings (This Period)</span>
          <span class="stat-value" style="color: var(--color-success);">${formatCurrency(commissionWeek)}</span>
        </div>
        <div class="stat-icon-wrapper" style="color: var(--color-success); background: var(--color-success-bg);"><i data-lucide="circle-dollar-sign"></i></div>
      </div>
    </div>

    <!-- My Recent Deliveries Table & Mobile Card List -->
    <div class="glass-card">
      <div class="flex-between" style="margin-bottom: 1rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700;">My Recent Completed Deliveries</h3>
        <button class="btn btn-secondary btn-sm" id="btn-view-my-all">View All</button>
      </div>

      <!-- Desktop Table View -->
      <div class="table-container desktop-table-view">
        <table class="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Customer</th>
              <th>Jugs</th>
              <th>Delivery Price</th>
              <th>My Commission</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${recentDeliveries.length === 0 ? `
              <tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">No deliveries logged yet today. Click "Log New Delivery Now" above!</td></tr>
            ` : recentDeliveries.map(d => `
              <tr>
                <td>${formatDate(d.createdAt, true)}</td>
                <td style="font-weight: 700; color: var(--color-accent);">${d.customerName || 'Walk-in'}</td>
                <td class="mono" style="font-weight: 700;">${d.jugCount}</td>
                <td class="mono" style="color: var(--color-success);">${formatCurrency(d.totalPrice)}</td>
                <td class="mono" style="color: var(--color-warning); font-weight: 700;">${formatCurrency(d.commissionAmount)}</td>
                <td>
                  <span class="badge badge-success">${d.status || 'delivered'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile Card List View -->
      <div class="mobile-card-list">
        ${recentDeliveries.length === 0 ? `
          <div style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No deliveries logged yet today. Tap "Log New Delivery Now" above!</div>
        ` : recentDeliveries.map(d => `
          <div class="glass-card-sm" style="background: rgba(0, 0, 0, 0.25); border: 1px solid var(--color-border-glass); display: flex; flex-direction: column; gap: 0.6rem;">
            <div class="flex-between">
              <span style="font-weight: 700; color: var(--color-accent); font-size: 0.95rem;">${d.customerName || 'Walk-in Customer'}</span>
              <span class="badge badge-success" style="font-size: 0.7rem;">${d.status || 'delivered'}</span>
            </div>

            <div style="font-size: 0.78rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 0.35rem;">
              <i data-lucide="clock" class="icon-sm" style="color: var(--color-accent);"></i> ${formatDate(d.createdAt, true)} • <span style="color: var(--color-text-muted);">${d.serviceName || 'Refill & Deliver'}</span>
            </div>

            <div class="flex-between" style="border-top: 1px dashed var(--color-border-glass); padding-top: 0.5rem; margin-top: 0.25rem;">
              <div>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">Jugs:</span>
                <strong style="font-size: 0.9rem; color: white; margin-left: 0.25rem;">${d.jugCount}</strong>
              </div>

              <div>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">Price:</span>
                <strong style="font-size: 0.9rem; color: var(--color-success); margin-left: 0.25rem;">${formatCurrency(d.totalPrice)}</strong>
              </div>

              <div>
                <span style="font-size: 0.75rem; color: var(--color-text-muted);">Commission:</span>
                <strong style="font-size: 0.9rem; color: var(--color-warning); margin-left: 0.25rem;">${formatCurrency(d.commissionAmount)}</strong>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.querySelector('#btn-log-delivery-now')?.addEventListener('click', () => navigateTo('/employee/log-delivery'));
  container.querySelector('#btn-view-my-all')?.addEventListener('click', () => navigateTo('/employee/my-deliveries'));

  return {
    title: 'Employee Portal',
    subtitle: 'Daily delivery entry and personal commission tracking',
    element: container
  };
}
