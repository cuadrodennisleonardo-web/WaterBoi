import { db } from '../../firebase.js';
import { collection, getDocs } from 'firebase/firestore';
import { formatCurrency, formatNumber, getDateRange } from '../../utils/formatters.js';
import { downloadCSV } from '../../utils/export.js';

import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderReportsPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  let deliveries = [];
  let currentRange = 'year'; // Default to year per user request for long run

  async function loadData() {
    try {
      const snap = await fastGetDocs(collection(db, 'deliveries'));
      deliveries = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching report data:', err);
    }
  }

  await loadData();

  function filterDeliveriesByRange(range) {
    const { start, end } = getDateRange(range);
    return deliveries.filter(d => {
      const dDate = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
      return dDate >= start && dDate <= end;
    });
  }

  function getEmployeeLeaderboard(filteredList) {
    const empMap = {};
    filteredList.forEach(d => {
      const empName = d.employeeName || 'Staff';
      if (!empMap[empName]) {
        empMap[empName] = { name: empName, jugCount: 0, revenue: 0, commission: 0, deliveryCount: 0 };
      }
      empMap[empName].jugCount += Number(d.jugCount) || 0;
      empMap[empName].revenue += Number(d.totalPrice) || 0;
      empMap[empName].commission += Number(d.commissionAmount) || 0;
      empMap[empName].deliveryCount += 1;
    });

    return Object.values(empMap).sort((a, b) => b.jugCount - a.jugCount);
  }

  function renderUI() {
    const filtered = filterDeliveriesByRange(currentRange);
    let totalJugs = 0;
    let totalRev = 0;
    let totalComm = 0;

    filtered.forEach(d => {
      totalJugs += Number(d.jugCount) || 0;
      totalRev += Number(d.totalPrice) || 0;
      totalComm += Number(d.commissionAmount) || 0;
    });

    const netProfit = totalRev - totalComm;
    const leaderboard = getEmployeeLeaderboard(filtered);
    const topEmployee = leaderboard[0];

    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 700;">Station Performance & Analytics</h3>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary);">Long-term reports, annual revenue metrics, and employee achievements.</p>
        </div>

        <div style="display: flex; gap: 0.5rem; background: var(--color-bg-secondary); padding: 0.35rem; border-radius: var(--radius-md); border: 1px solid var(--color-border-glass);">
          <button class="btn btn-sm ${currentRange === 'today' ? 'btn-primary' : 'btn-secondary'}" data-range="today">Today</button>
          <button class="btn btn-sm ${currentRange === 'week' ? 'btn-primary' : 'btn-secondary'}" data-range="week">This Week</button>
          <button class="btn btn-sm ${currentRange === 'month' ? 'btn-primary' : 'btn-secondary'}" data-range="month">This Month</button>
          <button class="btn btn-sm ${currentRange === 'year' ? 'btn-primary' : 'btn-secondary'}" data-range="year">This Year <i data-lucide="trophy"></i></button>
        </div>
      </div>

      <!-- Financial Metrics Grid -->
      <div class="grid-stats">
        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">Total Water Jugs</span>
            <span class="stat-value text-gradient">${formatNumber(totalJugs)}</span>
          </div>
          <div class="stat-icon-wrapper"><i data-lucide="droplet"></i></div>
        </div>

        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">Gross Revenue</span>
            <span class="stat-value" style="color: var(--color-success);">${formatCurrency(totalRev)}</span>
          </div>
          <div class="stat-icon-wrapper" style="color: var(--color-success); background: var(--color-success-bg);"><i data-lucide="circle-dollar-sign"></i></div>
        </div>

        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">Commissions Paid</span>
            <span class="stat-value" style="color: var(--color-warning);">${formatCurrency(totalComm)}</span>
          </div>
          <div class="stat-icon-wrapper" style="color: var(--color-warning); background: var(--color-warning-bg);"><i data-lucide="banknote"></i></div>
        </div>

        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">Net Station Earnings</span>
            <span class="stat-value" style="color: var(--color-accent);">${formatCurrency(netProfit)}</span>
          </div>
          <div class="stat-icon-wrapper" style="color: var(--color-accent); background: rgba(0, 180, 216, 0.15);"><i data-lucide="building"></i></div>
        </div>
      </div>

      <!-- <i data-lucide="trophy"></i> Employee of the Year / Performance Trophy Card -->
      ${topEmployee ? `
        <div class="glass-card flex-between" style="background: linear-gradient(135deg, rgba(255, 209, 102, 0.15) 0%, rgba(13, 27, 42, 0.9) 100%); border-color: rgba(255, 209, 102, 0.4);">
          <div style="display: flex; align-items: center; gap: 1.5rem;">
            <div style="font-size: 3.5rem;"><i data-lucide="trophy"></i></div>
            <div>
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--color-warning); text-transform: uppercase; letter-spacing: 0.05em;">
                ${currentRange === 'year' ? '<i data-lucide="trophy"></i> Employee of the Year Award' : 'Top Performer of the Period'}
              </div>
              <h2 style="font-size: 1.6rem; font-weight: 800; color: #FFFFFF; margin: 0.2rem 0;">${topEmployee.name}</h2>
              <p style="font-size: 0.88rem; color: var(--color-text-secondary);">
                Delivered <strong class="mono" style="color: var(--color-accent);">${formatNumber(topEmployee.jugCount)} jugs</strong> across ${topEmployee.deliveryCount} trips, earning <strong class="mono" style="color: var(--color-warning);">${formatCurrency(topEmployee.commission)}</strong> in commission.
              </p>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-export-report-csv"><i data-lucide="bar-chart-2"></i> Export Full CSV</button>
        </div>
      ` : ''}

      <!-- Leaderboard Table -->
      <div class="glass-card">
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Employee Delivery Leaderboard & Performance</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Employee Name</th>
                <th>Deliveries Made</th>
                <th>Total Jugs Delivered</th>
                <th>Total Revenue Generated</th>
                <th>Commission Earned</th>
              </tr>
            </thead>
            <tbody>
              ${leaderboard.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: 2rem;">No delivery data for this period.</td></tr>
              ` : leaderboard.map((emp, idx) => `
                <tr>
                  <td style="font-weight: 700; font-size: 1.1rem;">
                    ${idx === 0 ? '<i data-lucide="medal"></i> 1st' : idx === 1 ? '<i data-lucide="medal"></i> 2nd' : idx === 2 ? '<i data-lucide="medal"></i> 3rd' : `#${idx + 1}`}
                  </td>
                  <td style="font-weight: 700; color: var(--color-accent);">${emp.name}</td>
                  <td class="mono">${emp.deliveryCount}</td>
                  <td class="mono" style="font-weight: 700; color: #FFFFFF;">${formatNumber(emp.jugCount)}</td>
                  <td class="mono" style="color: var(--color-success);">${formatCurrency(emp.revenue)}</td>
                  <td class="mono" style="color: var(--color-warning); font-weight: 700;">${formatCurrency(emp.commission)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Filter Buttons Listeners
    container.querySelectorAll('[data-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentRange = btn.dataset.range;
        renderUI();
      });
    });

    // CSV Export Listener
    container.querySelector('#btn-export-report-csv')?.addEventListener('click', () => {
      if (leaderboard.length === 0) return;
      const csvData = leaderboard.map((e, idx) => ({
        Rank: idx + 1,
        Employee: e.name,
        DeliveriesCount: e.deliveryCount,
        TotalJugsDelivered: e.jugCount,
        TotalRevenuePHP: e.revenue,
        CommissionPHP: e.commission
      }));
      downloadCSV(`WaterBoi_Report_${currentRange.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`, csvData);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  renderUI();

  return {
    title: 'Reports & Business Analytics',
    subtitle: 'Annual sales, profit metrics, and Employee of the Year performance leaderboard',
    element: container
  };
}
