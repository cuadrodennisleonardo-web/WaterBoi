/**
 * Modal Dialog Helper
 */

export function createModal({ title, bodyContent, primaryActionText = 'Save', onSave = null, secondaryActionText = 'Cancel', showCancel = true }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 1.15rem; font-weight: 700;">${title}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body" style="margin-bottom: 1.5rem;">
        ${typeof bodyContent === 'string' ? bodyContent : ''}
      </div>
      <div class="modal-footer">
        ${showCancel ? `<button class="btn btn-secondary btn-close-modal" type="button">${secondaryActionText}</button>` : ''}
        ${onSave ? `<button class="btn btn-primary btn-save-modal" type="button">${primaryActionText}</button>` : ''}
      </div>
    </div>
  `;

  if (typeof bodyContent !== 'string' && bodyContent instanceof HTMLElement) {
    overlay.querySelector('.modal-body').appendChild(bodyContent);
  }

  function close() {
    overlay.classList.remove('active');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 250);
  }

  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('.btn-close-modal').addEventListener('click', close);

  if (onSave) {
    overlay.querySelector('.btn-save-modal').addEventListener('click', async () => {
      const success = await onSave(overlay);
      if (success !== false) {
        close();
      }
    });
  }

  document.body.appendChild(overlay);
  // Trigger transition
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  return { overlay, close };
}
