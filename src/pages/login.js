import { login } from '../auth.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/toast.js';

export function renderLoginPage() {
  const container = document.createElement('div');
  container.className = 'flex-center';
  container.style.cssText = 'min-height: 100vh; width: 100vw; padding: 1.5rem; background: var(--color-bg-primary);';

  container.innerHTML = `
    <div class="glass-card" style="width: 100%; max-width: 420px; padding: 2.5rem 2rem; border-color: var(--color-border-glow);">
      <div style="text-align: center; margin-bottom: 2rem;">
        <div class="flex-center wave-animated" style="width: 56px; height: 56px; background: transparent; margin: 0 auto 0.5rem auto;">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            <path d="M12 7a4 4 0 0 1 4 4" stroke="#CAF0F8" stroke-width="1.5" opacity="0.8"/>
          </svg>
        </div>
        <h1 class="text-gradient" style="font-size: 2rem; font-weight: 800;">WaterBoi</h1>
        <p style="color: var(--color-text-secondary); font-size: 0.88rem; margin-top: 0.35rem;">Refilling Station Monitoring System</p>
      </div>

      <form id="login-form">
        <div class="form-group">
          <label class="form-label" for="login-email">Email Address</label>
          <input class="form-input" type="email" id="login-email" placeholder="owner@waterboi.com" required autocomplete="username" />
        </div>

        <div class="form-group" style="margin-bottom: 1.75rem;">
          <label class="form-label" for="login-password">Password</label>
          <input class="form-input" type="password" id="login-password" placeholder="••••••••" required autocomplete="current-password" />
        </div>

        <button class="btn btn-primary btn-full btn-lg" type="submit" id="btn-login-submit">
          Sign In to Portal
        </button>
      </form>

      <div style="margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border-glass); text-align: center; font-size: 0.8rem; color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
         Secure Firebase Authentication & Offline Firestore Sync
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const submitBtn = container.querySelector('#btn-login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#login-email').value.trim();
    const password = container.querySelector('#login-password').value;

    if (!email || !password) {
      showToast('Please enter both email and password', 'warning');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Signing in...';

    try {
      const { profile } = await login(email, password);
      showToast(`Welcome back, ${profile?.name || 'User'}!`, 'success');
      
      if (profile?.role === 'admin') {
        navigateTo('/admin/dashboard');
      } else {
        navigateTo('/employee/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      showToast(err.message || 'Failed to sign in. Check email and password.', 'danger');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign In to Portal';
    }
  });

  return container;
}
