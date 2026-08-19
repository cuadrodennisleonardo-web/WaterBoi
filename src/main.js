import './styles/index.css';
import './styles/components.css';
import './styles/dashboard.css';
import { createIcons, icons } from 'lucide';

window.lucide = {
  createIcons: (options = {}) => createIcons({ icons, ...options })
};
import { registerRoute, handleRouting } from './router.js';

// Auth Page
import { renderLoginPage } from './pages/login.js';

// Admin Pages
import { renderAdminDashboardPage } from './pages/admin/dashboard.js';
import { renderServicesPage } from './pages/admin/services.js';
import { renderEmployeesPage } from './pages/admin/employees.js';
import { renderEmployeeDetailPage } from './pages/admin/employee-detail.js';
import { renderInventoryPage } from './pages/admin/inventory.js';
import { renderDeliveriesPage } from './pages/admin/deliveries.js';
import { renderCommissionsPage } from './pages/admin/commissions.js';
import { renderCustomersPage } from './pages/admin/customers.js';
import { renderReportsPage } from './pages/admin/reports.js';
import { renderAuditLogPage } from './pages/admin/audit-log.js';

// Employee Pages
import { renderEmployeeDashboardPage } from './pages/employee/dashboard.js';
import { renderLogDeliveryPage } from './pages/employee/log-delivery.js';
import { renderMyDeliveriesPage } from './pages/employee/my-deliveries.js';
import { renderMyCommissionPage } from './pages/employee/my-commission.js';
import { renderMyReceiptsPage } from './pages/employee/my-receipts.js';

// Shared Pages
import { renderProfilePage } from './pages/profile.js';

// Register Routes
registerRoute('/login', renderLoginPage);
registerRoute('/profile', renderProfilePage);

// Admin Routes
registerRoute('/admin/dashboard', renderAdminDashboardPage);
registerRoute('/admin/services', renderServicesPage);
registerRoute('/admin/employees', renderEmployeesPage);
registerRoute('/admin/employee-detail', renderEmployeeDetailPage);
registerRoute('/admin/inventory', renderInventoryPage);
registerRoute('/admin/deliveries', renderDeliveriesPage);
registerRoute('/admin/commissions', renderCommissionsPage);
registerRoute('/admin/customers', renderCustomersPage);
registerRoute('/admin/reports', renderReportsPage);
registerRoute('/admin/audit-log', renderAuditLogPage);

// Employee Routes
registerRoute('/employee/dashboard', renderEmployeeDashboardPage);
registerRoute('/employee/log-delivery', renderLogDeliveryPage);
registerRoute('/employee/my-deliveries', renderMyDeliveriesPage);
registerRoute('/employee/my-commission', renderMyCommissionPage);
registerRoute('/employee/my-receipts', renderMyReceiptsPage);

import { syncPendingDeliveries } from './utils/offlineQueue.js';

// Initialize App Routing & Auto-sync
document.addEventListener('DOMContentLoaded', () => {
  handleRouting();
  syncPendingDeliveries();
});
