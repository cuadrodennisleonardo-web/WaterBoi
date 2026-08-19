import { formatCurrency, formatDate } from '../utils/formatters.js';
import { printElement } from '../utils/export.js';

export function renderReceiptModal(delivery) {
  const receiptId = `receipt-${delivery.id || Date.now()}`;
  const total = formatCurrency(delivery.totalPrice);
  const pricePer = formatCurrency(delivery.pricePerJug);

  const html = `
    <div id="${receiptId}" class="receipt-box" style="background: rgba(13, 27, 42, 0.95); border: 1px solid var(--color-border-glow); padding: 1.5rem; border-radius: var(--radius-md); font-family: var(--font-family-body);">
      <div style="text-align: center; border-bottom: 1px solid var(--color-border-glass); padding-bottom: 1rem; margin-bottom: 1rem;">
        <div style="font-size: 1.4rem; font-weight: 800;" class="text-gradient"><i data-lucide="droplet"></i> WATERBOI</div>
        <div style="font-size: 0.8rem; color: var(--color-text-secondary);">Water Refilling Station Official Receipt</div>
        <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem;">Ref #: ${delivery.id ? delivery.id.substring(0, 8).toUpperCase() : 'N/A'}</div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--color-text-secondary);">Date:</span>
          <span>${formatDate(delivery.createdAt || new Date(), true)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--color-text-secondary);">Customer:</span>
          <span style="font-weight: 600; color: var(--color-accent);">${delivery.customerName || 'Walk-in Customer'}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--color-text-secondary);">Delivered By:</span>
          <span>${delivery.employeeName || 'Staff'}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--color-text-secondary);">Service:</span>
          <span>${delivery.serviceName || 'Refill & Deliver'}</span>
        </div>
      </div>

      <div style="margin: 1.25rem 0; border-top: 1px dashed var(--color-border-glass); border-bottom: 1px dashed var(--color-border-glass); padding: 0.85rem 0;">
        <div style="display: flex; justify-content: space-between; font-weight: 600;">
          <span>${delivery.jugCount} × Water Jugs (${pricePer})</span>
          <span>${total}</span>
        </div>
        ${delivery.jugNumbers && delivery.jugNumbers.length > 0 ? `
          <div style="font-size: 0.78rem; color: var(--color-accent); margin-top: 0.35rem; font-weight: 500;">
            Assigned Jug Numbers: ${delivery.jugNumbers.join(', ')}
          </div>
        ` : ''}
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 700; color: var(--color-success); margin-bottom: 1.25rem;">
        <span>Total Amount Due:</span>
        <span>${total}</span>
      </div>

      <div style="text-align: center; font-size: 0.75rem; color: var(--color-text-muted);">
        Thank you for your business! Clean, safe & fresh water always.
      </div>
    </div>
  `;

  return html;
}
