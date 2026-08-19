/**
 * Online / Offline Sync Status Indicator Component
 */

export function renderSyncIndicator() {
  const container = document.createElement('div');
  container.className = 'sync-indicator';
  
  function updateStatus() {
    const isOnline = navigator.onLine;
    container.innerHTML = `
      <span class="sync-dot ${isOnline ? 'online' : 'offline'}"></span>
      <span class="sync-text">${isOnline ? 'Online' : 'Offline Mode'}</span>
    `;
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();

  return container;
}
