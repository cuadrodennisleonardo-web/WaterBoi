import { logout } from '../auth.js';
import { navigateTo } from '../router.js';

export function renderSidebar(userProfile, currentPath) {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';

  const role = userProfile?.role || 'employee';
  const userName = userProfile?.name || 'User';
  const userInitial = userName.charAt(0).toUpperCase();

  const adminNav = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '<i data-lucide="bar-chart-2"></i>' },
    { path: '/admin/inventory', label: 'Jug Inventory', icon: '<i data-lucide="package"></i>' },
    { path: '/admin/deliveries', label: 'Deliveries', icon: '<i data-lucide="truck"></i>' },
    { path: '/admin/services', label: 'Services & Pricing', icon: '<i data-lucide="circle-dollar-sign"></i>' },
    { path: '/admin/employees', label: 'Employees', icon: '<i data-lucide="hard-hat"></i>' },
    { path: '/admin/commissions', label: 'Commissions', icon: '<i data-lucide="banknote"></i>' },
    { path: '/admin/customers', label: 'Customers', icon: '<i data-lucide="users"></i>' },
    { path: '/admin/reports', label: 'Reports & Analytics', icon: '<i data-lucide="trending-up"></i>' },
    { path: '/admin/audit-log', label: 'Audit Log', icon: '<i data-lucide="receipt"></i>' },
    { path: '/profile', label: 'My Profile', icon: '<i data-lucide="user"></i>' }
  ];

  const employeeNav = [
    { path: '/employee/dashboard', label: 'My Dashboard', icon: '<i data-lucide="home"></i>' },
    { path: '/employee/log-delivery', label: 'Log Delivery', icon: '<i data-lucide="plus"></i>' },
    { path: '/employee/my-deliveries', label: 'My Deliveries', icon: '<i data-lucide="clipboard-list"></i>' },
    { path: '/employee/my-commission', label: 'My Commission', icon: '<i data-lucide="banknote"></i>' },
    { path: '/employee/my-receipts', label: 'My Receipts', icon: '<i data-lucide="receipt"></i>' },
    { path: '/profile', label: 'My Profile', icon: '<i data-lucide="user"></i>' }
  ];

  const navItems = role === 'admin' ? adminNav : employeeNav;
  const avatarIcon = userProfile?.avatarIcon || 'droplet';

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          <path d="M12 7a4 4 0 0 1 4 4" stroke="#CAF0F8" stroke-width="1.5" opacity="0.8"/>
        </svg>
      </div>
      <div>
        <div class="sidebar-title text-gradient">WaterBoi</div>
        <div style="font-size: 0.72rem; color: var(--color-text-secondary);">${role === 'admin' ? 'Station Owner Portal' : 'Employee App'}</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      ${navItems.map(item => `
        <div class="nav-item ${currentPath === item.path ? 'active' : ''}" data-path="${item.path}">
          <span>${item.icon}</span>
          <span>${item.label}</span>
        </div>
      `).join('')}
    </nav>

    <div class="sidebar-footer">
      <div class="user-profile-mini" id="btn-sidebar-profile" style="cursor: pointer;" title="View My Profile">
        <div class="user-avatar" style="background: rgba(0,180,216,0.15); border-color: var(--color-accent); display: flex; align-items: center; justify-content: center;">
          <i data-lucide="${avatarIcon}"></i>
        </div>
        <div style="overflow: hidden;">
          <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${userName}</div>
          <div style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: capitalize;">${role}</div>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" id="logout-btn" title="Sign Out">
        <i data-lucide="log-out"></i>
      </button>
    </div>
  `;

  // Attach Navigation Listeners
  sidebar.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const path = el.dataset.path;
      sidebar.classList.remove('mobile-open');
      navigateTo(path);
    });
  });

  // Attach Profile Listener
  sidebar.querySelector('#btn-sidebar-profile')?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    navigateTo('/profile');
  });

  // Attach Logout Listener
  sidebar.querySelector('#logout-btn').addEventListener('click', async () => {
    await logout();
    navigateTo('/login');
  });

  return sidebar;
}
