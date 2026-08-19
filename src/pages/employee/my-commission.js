import { db } from '../../firebase.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getCurrentUser } from '../../auth.js';
import { formatCurrency, formatNumber } from '../../utils/formatters.js';

import { getPendingDeliveries } from '../../utils/offlineQueue.js';

import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderMyCommissionPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  const { profile, firebaseUser } = getCurrentUser();
  const empId = profile?.id || firebaseUser?.uid;

  let totalJugs = 0;
  let totalRevenue = 0;
  let totalCommissionEarned = 0;
  let totalPaidOut = 0;

  try {
    if (empId) {
      let deliveries = [];
      try {
        const [delSnap, paySnap] = await Promise.all([
          fastGetDocs(query(collection(db, 'deliveries'), where('employeeId', '==', empId))),
          fastGetDocs(query(collection(db, 'commissionPayouts'), where('employeeId', '==', empId), where('status', '==', 'paid')))
        ]);

        deliveries = (delSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
        (paySnap.docs || []).forEach(p => {
          totalPaidOut += Number(p.data().amount) || 0;
        });
      } catch (err) {
        console.warn('Commission page offline fetch:', err);
      }

      // Merge local pending offline deliveries
      const localPending = getPendingDeliveries().filter(d => d.employeeId === empId);
      const existingIds = new Set(deliveries.map(d => d.id));
      localPending.forEach(lp => {
        if (!existingIds.has(lp.id)) deliveries.push(lp);
      });

      deliveries.forEach(d => {
        totalJugs += Number(d.jugCount) || 0;
        totalRevenue += Number(d.totalPrice) || 0;
        totalCommissionEarned += Number(d.commissionAmount) || 0;
      });
    }
  } catch (err) {
    console.error('Error fetching my commission stats:', err);
  }

  const unpaidBalance = Math.max(0, totalCommissionEarned - totalPaidOut);

  container.innerHTML = `
    <div class="grid-stats">
      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">Total Jugs Delivered</span>
          <span class="stat-value text-gradient">${formatNumber(totalJugs)}</span>
        </div>
        <div class="stat-icon-wrapper"><i data-lucide="droplet"></i></div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">Total Commission Earned</span>
          <span class="stat-value" style="color: var(--color-warning);">${formatCurrency(totalCommissionEarned)}</span>
        </div>
        <div class="stat-icon-wrapper" style="color: var(--color-warning); background: var(--color-warning-bg);"><i data-lucide="banknote"></i></div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">Paid Out by Station</span>
          <span class="stat-value" style="color: var(--color-success);">${formatCurrency(totalPaidOut)}</span>
        </div>
        <div class="stat-icon-wrapper" style="color: var(--color-success); background: var(--color-success-bg);"><i data-lucide="check-circle"></i></div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">Unpaid Commission Balance</span>
          <span class="stat-value" style="color: var(--color-accent);">${formatCurrency(unpaidBalance)}</span>
        </div>
        <div class="stat-icon-wrapper" style="color: var(--color-accent); background: rgba(0, 180, 216, 0.15);">⏳</div>
      </div>
    </div>

    <div class="glass-card" style="padding: 2rem; border-color: var(--color-border-glow);">
      <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 0.75rem;">How Your 27% Rate Works</h3>
      <p style="font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.6;">
        For every water jug you clean, refill, and deliver to a customer, you earn <strong>27% of the jug price</strong>.
        For example, for a ₱35.00 jug delivery, your payout is <strong>₱9.45 per jug</strong>.
        Your earnings accumulate in real-time as you log deliveries.
      </p>
    </div>
  `;

  return {
    title: 'My Commission Tracker',
    subtitle: 'Personal earnings summary and payout status',
    element: container
  };
}
