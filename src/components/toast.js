/**
 * Toast Notification Utility
 */

let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', duration = 3500) {
  const c = getContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: '<i data-lucide="check-circle"></i>',
    danger: '<i data-lucide="x-circle"></i>',
    warning: '<i data-lucide="alert-triangle"></i>',
    info: '<i data-lucide="info"></i>'
  };

  toast.innerHTML = `
    <span>${iconMap[type] || '<i data-lucide="info"></i>'}</span>
    <span>${message}</span>
  `;

  c.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}
