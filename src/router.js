import { getCurrentUser, subscribeAuth, isAuthReady, waitForAuth } from './auth.js';
import { renderSidebar } from './components/sidebar.js';
import { renderNavbar } from './components/navbar.js';

// Route Handlers Lazy Map
const routes = {};

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigateTo(path, queryParams = {}) {
  const url = new URL(window.location.origin + path);
  Object.keys(queryParams).forEach(key => url.searchParams.set(key, queryParams[key]));
  window.history.pushState({}, '', url.pathname + url.search);
  handleRouting();
}

export async function handleRouting() {
  const appEl = document.getElementById('app');

  // Wait for initial Firebase Auth state to resolve before deciding redirect
  if (!isAuthReady()) {
    if (!appEl.querySelector('.app-layout') && !appEl.querySelector('.loader-container')) {
      appEl.innerHTML = `
        <div class="loader-container" style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div class="loader"></div>
          <div style="margin-top: 1rem; color: var(--color-text-secondary); font-size: 0.9rem;">Starting WaterBoi...</div>
        </div>
      `;
    }
    await waitForAuth();
  }

  const { firebaseUser, profile } = getCurrentUser();
  const currentPath = window.location.pathname;

  // Unauthenticated user fallback to /login
  if (!firebaseUser && currentPath !== '/login') {
    navigateTo('/login');
    return;
  }

  // Authenticated user on /login redirected to their dashboard
  if (firebaseUser && (currentPath === '/login' || currentPath === '/')) {
    if (profile?.role === 'admin') {
      navigateTo('/admin/dashboard');
    } else {
      navigateTo('/employee/dashboard');
    }
    return;
  }

  // Role Protection Guard
  if (profile && currentPath.startsWith('/admin') && profile.role !== 'admin') {
    navigateTo('/employee/dashboard');
    return;
  }

  if (currentPath === '/login') {
    appEl.innerHTML = '';
    if (routes['/login']) {
      appEl.appendChild(await routes['/login']());
      if (window.lucide) window.lucide.createIcons();
    }
    return;
  }

  // Preserve layout if it exists to avoid UI flashing
  let layout = document.querySelector('.app-layout');
  let mainContent = document.querySelector('.main-content');
  let pageContainer = document.querySelector('.page-container');

  if (!layout) {
    appEl.innerHTML = '';
    layout = document.createElement('div');
    layout.className = 'app-layout';

    const sidebar = renderSidebar(profile, currentPath);
    layout.appendChild(sidebar);

    mainContent = document.createElement('main');
    mainContent.className = 'main-content';

    pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    
    mainContent.appendChild(pageContainer);
    layout.appendChild(mainContent);
    appEl.appendChild(layout);
  } else {
    // Update sidebar active link
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.path === currentPath);
    });
  }

  // Show Loading Spinner while fetching page data
  pageContainer.innerHTML = '<div class="loader-container"><div class="loader"></div><div style="margin-top: 1rem; color: var(--color-text-secondary); font-size: 0.9rem;">Loading page...</div></div>';

  const routeHandler = routes[currentPath] || routes['/admin/dashboard'] || routes['/employee/dashboard'];
  
  if (routeHandler) {
    const pageData = await routeHandler();
    
    // Check if navbar exists, update or create it
    let navbar = mainContent.querySelector('.top-navbar');
    if (navbar) {
      navbar.replaceWith(renderNavbar(pageData.title || 'WaterBoi', pageData.subtitle || ''));
    } else {
      mainContent.insertBefore(renderNavbar(pageData.title || 'WaterBoi', pageData.subtitle || ''), pageContainer);
    }

    pageContainer.innerHTML = '';
    pageContainer.appendChild(pageData.element);
    
    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

// Popstate listener for browser forward/back buttons
window.addEventListener('popstate', handleRouting);

// Subscribe to auth state changes to re-trigger route guard
subscribeAuth(() => {
  handleRouting();
});
