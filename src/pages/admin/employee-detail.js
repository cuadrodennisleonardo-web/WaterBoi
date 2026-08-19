import { db } from '../../firebase.js';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters.js';
import { navigateTo } from '../../router.js';

import { fastGetDoc, fastGetDocs } from '../../utils/fastFetch.js';

export async function renderEmployeeDetailPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  const params = new URLSearchParams(window.location.search);
  const empId = params.get('id');

  if (!empId) {
    container.innerHTML = `<div class="glass-card" style="text-align: center; padding: 3rem;">No employee selected. <button class="btn btn-primary" id="btn-back-emp">Back to Employees</button></div>`;
    container.querySelector('#btn-back-emp')?.addEventListener('click', () => navigateTo('/admin/employees'));
    return { title: 'Employee Detail', element: container };
  }

  let emp = null;
  let deliveries = [];
  let totalJugs = 0;
  let totalRevenue = 0;
  let totalCommission = 0;

  try {
    const [empSnap, delSnap] = await Promise.all([
      fastGetDoc(doc(db, 'users', empId)),
      fastGetDocs(query(collection(db, 'deliveries'), where('employeeId', '==', empId)))
    ]);

    if (empSnap.exists && empSnap.exists()) {
      emp = { id: empSnap.id, ...empSnap.data() };
    }
    deliveries = (delSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));

    deliveries.sort((a, b) => {
      const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });

    deliveries.forEach(d => {
      totalJugs += Number(d.jugCount) || 0;
      totalRevenue += Number(d.totalPrice) || 0;
      totalCommission += Number(d.commissionAmount) || 0;
    });
  } catch (err) {
    console.error('Error fetching employee detail:', err);
  }

  if (!emp) {
    container.innerHTML = `<div class="glass-card" style="text-align: center; padding: 3rem;">Employee record not found. <button class="btn btn-primary" id="btn-back-emp">Back to Employees List</button></div>`;
    container.querySelector('#btn-back-emp')?.addEventListener('click', () => navigateTo('/admin/employees'));
    return { title: 'Employee Detail', element: container };
  }

  container.innerHTML = `
    <!-- Employee Profile Header -->
    <div class="glass-card flex-between" style="padding: 1.5rem 2rem;">
      <div style="display: flex; align-items: center; gap: 1.25rem;">
        <div class="user-avatar" style="width: 56px; height: 56px; font-size: 1.5rem;">${(emp.name || 'E').charAt(0).toUpperCase()}</div>
        <div>
          <h2 style="font-size: 1.5rem; font-weight: 800;">${emp.name}</h2>
          <div style="font-size: 0.85rem; color: var(--color-text-secondary);">${emp.email} • Phone: ${emp.phone || 'N/A'}</div>
          <div style="margin-top: 0.35rem;">
            <span class="badge badge-${emp.status === 'active' ? 'success' : 'danger'}">${emp.status || 'active'}</span>
            <span class="badge badge-info" style="margin-left: 0.5rem;">All-Around Refill & Delivery Staff</span>
          </div>
        </div>
      </div>

      <button class="btn btn-secondary" id="btn-back"><i data-lucide="arrow-left"></i> Back to Employee List</button>
    </div>

    <!-- Stats Cards -->
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
          <span class="stat-label">Total Revenue Generated</span>
          <span class="stat-value" style="color: var(--color-success);">${formatCurrency(totalRevenue)}</span>
        </div>
        <div class="stat-icon-wrapper" style="color: var(--color-success); background: var(--color-success-bg);"><i data-lucide="circle-dollar-sign"></i></div>
      </div>

      <div class="glass-card stat-card">
        <div class="stat-info">
          <span class="stat-label">Total 27% Commission</span>
          <span class="stat-value" style="color: var(--color-warning);">${formatCurrency(totalCommission)}</span>
        </div>
        <div class="stat-icon-wrapper" style="color: var(--color-warning); background: var(--color-warning-bg);"><i data-lucide="banknote"></i></div>
      </div>
    </div>

    <!-- Deliveries Table for this Employee -->
    <div class="glass-card">
      <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Delivery Log History</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Jugs</th>
              <th>Total Revenue</th>
              <th>Commission (27%)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${deliveries.length === 0 ? `
              <tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No delivery records for this employee yet.</td></tr>
            ` : deliveries.map(d => `
              <tr>
                <td>${formatDate(d.createdAt, true)}</td>
                <td style="font-weight: 600; color: var(--color-accent);">${d.customerName || 'Walk-in'}</td>
                <td>${d.serviceName || 'Refill & Deliver'}</td>
                <td class="mono" style="font-weight: 600;">${d.jugCount}</td>
                <td class="mono" style="color: var(--color-success);">${formatCurrency(d.totalPrice)}</td>
                <td class="mono" style="color: var(--color-warning); font-weight: 600;">${formatCurrency(d.commissionAmount)}</td>
                <td>
                  <span class="badge badge-${d.status === 'delivered' ? 'success' : 'info'}">${d.status || 'delivered'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelector('#btn-back')?.addEventListener('click', () => navigateTo('/admin/employees'));

  return {
    title: `Employee Profile: ${emp.name}`,
    subtitle: 'Detailed performance history, deliveries, and commission metrics',
    element: container
  };
}
