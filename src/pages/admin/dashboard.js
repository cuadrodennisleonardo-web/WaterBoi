import { db } from '../../firebase.js';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters.js';
import { navigateTo } from '../../router.js';

import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderAdminDashboardPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  // Fetch Summary Data from Firestore
  let totalJugsToday = 0;
  let revenueToday = 0;
  let commissionsToday = 0;
  let inStockJugs = 0;
  let recentDeliveries = [];
  let employeesList = [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [delSnap, jugSnap, empSnap] = await Promise.all([
      fastGetDocs(query(collection(db, 'deliveries'), orderBy('createdAt', 'desc'), limit(50))),
      fastGetDocs(collection(db, 'jugs')),
      fastGetDocs(query(collection(db, 'users'), where('role', '==', 'employee')))
    ]);

    const deliveries = (delSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    deliveries.forEach(d => {
      const dDate = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
      if (dDate >= today) {
        totalJugsToday += Number(d.jugCount) || 0;
        revenueToday += Number(d.totalPrice) || 0;
        commissionsToday += Number(d.commissionAmount) || 0;
      }
    });

    recentDeliveries = deliveries.slice(0, 8);
    inStockJugs = (jugSnap.docs || []).filter(d => d.data().status === 'in_stock').length;
    employeesList = (empSnap.docs || []).map(e => ({ id: e.id, ...e.data() }));
  } catch (err) {
    console.error('Dashboard data fetch error:', err);
  }

  container.innerHTML = `
    <!-- Top Metrics Grid -->
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
          <span class="stat-label">Today's Revenue</span>
          <span class="stat-value" style="color: var(--color-success);">${formatCurrency(revenueToday)}</span>
        </div>
        <div class="stat-icon-wrapper" style="color: var(--color-success); background: var(--color-success-bg);"><i data-lucide="circle-dollar-sign"></i></div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">Employee Commissions</span>
          <span class="stat-value" style="color: var(--color-warning);">${formatCurrency(commissionsToday)}</span>
        </div>
        <div class="stat-icon-wrapper" style="color: var(--color-warning); background: var(--color-warning-bg);"><i data-lucide="banknote"></i></div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">Jugs In Stock</span>
          <span class="stat-value">${formatNumber(inStockJugs)}</span>
        </div>
        <div class="stat-icon-wrapper"><i data-lucide="package"></i></div>
      </div>
    </div>

    <!-- Quick Action Bar -->
    <div class="glass-card flex-between" style="padding: 1rem 1.5rem; border-color: rgba(0, 180, 216, 0.25);">
      <div>
        <h4 style="font-weight: 700;">Quick Station Actions</h4>
        <p style="font-size: 0.8rem; color: var(--color-text-secondary);">Manage services, add employees, or review inventory stock.</p>
      </div>
      <div style="display: flex; gap: 0.75rem;">
        <button class="btn btn-secondary btn-sm" id="btn-quick-service"><i data-lucide="plus"></i> Add Service</button>
        <button class="btn btn-secondary btn-sm" id="btn-quick-emp"><i data-lucide="hard-hat"></i> Add Employee</button>
        <button class="btn btn-primary btn-sm" id="btn-quick-delivery"><i data-lucide="truck"></i> View All Deliveries</button>
      </div>
    </div>

    <!-- Two Column Grid: Recent Deliveries + Leaderboard -->
    <div class="grid-two-col">
      <!-- Recent Deliveries Table -->
      <div class="glass-card">
        <div class="flex-between" style="margin-bottom: 1rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700;">Recent Deliveries</h3>
          <button class="btn btn-secondary btn-sm" id="btn-view-all-del">View All</button>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Employee</th>
                <th>Jugs</th>
                <th>Total</th>
                <th>Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${recentDeliveries.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No deliveries recorded yet today.</td></tr>
              ` : recentDeliveries.map(d => `
                <tr>
                  <td style="font-weight: 600;">${d.customerName || 'Walk-in'}</td>
                  <td>${d.employeeName || 'Staff'}</td>
                  <td class="mono">${d.jugCount}</td>
                  <td class="mono" style="color: var(--color-success);">${formatCurrency(d.totalPrice)}</td>
                  <td class="mono" style="color: var(--color-warning);">${formatCurrency(d.commissionAmount)}</td>
                  <td>
                    <span class="badge badge-${d.status === 'delivered' ? 'success' : 'info'}">${d.status || 'delivered'}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Employee Quick Leaderboard -->
      <div class="glass-card">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Employees Overview</h3>
        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${employeesList.length === 0 ? `
            <div style="text-align: center; color: var(--color-text-muted); padding: 1.5rem;">No employees added yet. Click "Add Employee" above.</div>
          ` : employeesList.map(emp => `
            <div class="flex-between" style="padding: 0.75rem 1rem; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); border: 1px solid var(--color-border-glass);">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.8rem;">${(emp.name || 'E').charAt(0).toUpperCase()}</div>
                <div>
                  <div style="font-weight: 600; font-size: 0.88rem;">${emp.name}</div>
                  <div style="font-size: 0.75rem; color: var(--color-text-muted);">${emp.phone || emp.email}</div>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm btn-emp-view" data-id="${emp.id}">View Page</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Attach Action Button Listeners
  container.querySelector('#btn-quick-service')?.addEventListener('click', () => navigateTo('/admin/services'));
  container.querySelector('#btn-quick-emp')?.addEventListener('click', () => navigateTo('/admin/employees'));
  container.querySelector('#btn-quick-delivery')?.addEventListener('click', () => navigateTo('/admin/deliveries'));
  container.querySelector('#btn-view-all-del')?.addEventListener('click', () => navigateTo('/admin/deliveries'));

  container.querySelectorAll('.btn-emp-view').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(`/admin/employee-detail?id=${btn.dataset.id}`);
    });
  });

  return {
    title: 'Admin Dashboard',
    subtitle: 'Station Overview & Daily Metrics',
    element: container
  };
}
