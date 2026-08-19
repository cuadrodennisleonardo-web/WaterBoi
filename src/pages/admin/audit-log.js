import { db } from '../../firebase.js';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { formatDate } from '../../utils/formatters.js';

import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderAuditLogPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  let logs = [];

  async function loadLogs() {
    try {
      const snap = await fastGetDocs(query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'), limit(100)));
      logs = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error loading audit log:', err);
    }
  }

  await loadLogs();

  container.innerHTML = `
    <div class="glass-card">
      <div class="flex-between" style="margin-bottom: 1.25rem;">
        <div>
          <h3 style="font-size: 1.1rem; font-weight: 700;">Admin Activity Audit Trail</h3>
          <p style="font-size: 0.82rem; color: var(--color-text-secondary);">Immutable log tracking admin price changes, employee account creations, inventory adjustments, and payouts.</p>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Admin User</th>
              <th>Action Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `
              <tr><td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 2.5rem;">No administrative audit entries recorded yet.</td></tr>
            ` : logs.map(l => `
              <tr>
                <td style="font-size: 0.85rem; color: var(--color-text-muted);">${formatDate(l.timestamp, true)}</td>
                <td style="font-weight: 600; color: var(--color-accent);">${l.userName || 'Admin'}</td>
                <td>
                  <span class="badge badge-info">${l.action || 'system'}</span>
                </td>
                <td style="font-size: 0.9rem;">${l.description || 'Action completed.'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return {
    title: 'Admin Audit Log',
    subtitle: 'System security & administrative change audit history',
    element: container
  };
}
