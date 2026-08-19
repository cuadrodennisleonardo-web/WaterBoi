import { renderSyncIndicator } from './sync-indicator.js';

export function renderNavbar(title, subtitle = '') {
  const header = document.createElement('header');
  header.className = 'top-navbar';

  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.85rem; flex: 1; min-width: 0; margin-right: 0.75rem;">
      <button class="btn btn-secondary btn-sm" id="sidebar-toggle" style="flex-shrink: 0;">
        <i data-lucide="menu"></i>
      </button>
      <div style="min-width: 0; flex: 1; overflow: hidden;">
        <h2 style="font-size: 1.15rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;">${title}</h2>
        ${subtitle ? `<div class="navbar-subtitle" style="font-size: 0.75rem; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.1rem;">${subtitle}</div>` : ''}
      </div>
    </div>

    <div class="navbar-right" style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
      <div id="sync-indicator-slot"></div>
    </div>
  `;

  // Append Sync Indicator
  const slot = header.querySelector('#sync-indicator-slot');
  slot.appendChild(renderSyncIndicator());

  // Sidebar toggle listener (handles both mobile and desktop)
  const toggleBtn = header.querySelector('#sidebar-toggle');
  toggleBtn.addEventListener('click', () => {
    const layout = document.querySelector('.app-layout');
    const sidebar = document.querySelector('.sidebar');
    
    if (window.innerWidth <= 992) {
      if (sidebar) sidebar.classList.toggle('mobile-open');
    } else {
      if (layout) layout.classList.toggle('sidebar-collapsed');
    }
  });

  return header;
}
