import { db } from '../../firebase.js';
import { collection, getDocs, addDoc, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getCurrentUser } from '../../auth.js';
import { formatCurrency } from '../../utils/formatters.js';
import { calculateCommission } from '../../utils/commission.js';
import { navigateTo } from '../../router.js';
import { showToast } from '../../components/toast.js';
import { createModal } from '../../components/modal.js';
import { logAuditAction } from '../../utils/audit.js';
import { 
  getOfflineOutJugs, 
  markJugsDelivered, 
  markJugsReturned, 
  savePendingDelivery, 
  removePendingDelivery 
} from '../../utils/offlineQueue.js';

import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderLogDeliveryPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.25rem; max-width: 650px; margin: 0 auto; width: 100%;';

  const { profile, firebaseUser } = getCurrentUser();

  let services = [];
  let customers = [];
  let inStockJugs = [];
  let allJugs = [];
  let selectedJugNumbers = new Set();
  const offlineOutJugs = new Set(getOfflineOutJugs());

  try {
    const [sSnap, cSnap, jSnap] = await Promise.all([
      fastGetDocs(collection(db, 'services')),
      fastGetDocs(collection(db, 'customers')),
      fastGetDocs(collection(db, 'jugs'))
    ]);

    services = (sSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    customers = (cSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    allJugs = (jSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
    
    // Filter out both Firestore out jugs and locally out jugs
    inStockJugs = allJugs
      .filter(j => j.status === 'in_stock' && !offlineOutJugs.has(j.formattedNumber || '#' + String(j.number).padStart(3, '0')))
      .sort((a, b) => (a.number || 0) - (b.number || 0));
  } catch (err) {
    console.error('Error fetching delivery form data:', err);
  }

  // Fallback service
  if (services.length === 0) {
    services = [
      { id: 'default-refill-deliver', name: 'Clean, Refill & Deliver Jug', price: 30, commissionRate: 0.27 }
    ];
  }

  container.innerHTML = `
    <!-- Action Banner: Return Empty Jugs to Shop -->
    <div style="display: flex; justify-content: flex-end; width: 100%;">
      <button class="btn btn-secondary btn-full" style="border-color: var(--color-warning); color: var(--color-warning); padding: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" id="btn-open-return-modal">
        <i data-lucide="package"></i> Return Empty Jugs to Shop Stock
      </button>
    </div>

    <div class="glass-card" style="padding: 2rem; border-color: var(--color-border-glow);">
      <div style="margin-bottom: 1.5rem; text-align: center;">
        <h3 class="text-gradient" style="font-size: 1.4rem; font-weight: 800;">Log Water Delivery Order</h3>
        <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 0.25rem;">
          Select jug numbers being delivered. Works seamlessly online & offline!
        </p>
      </div>

      <form id="delivery-log-form">
        <!-- Searchable Customer Combobox -->
        <div class="form-group" style="position: relative;">
          <label class="form-label">Search or Select Customer</label>
          <div style="position: relative;">
            <input class="form-input" type="text" id="del-cust-search" placeholder="Search by customer name, address, or phone..." autocomplete="off" />
            <div id="cust-suggestions-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 220px; overflow-y: auto; background: var(--color-bg-secondary); border: 1px solid var(--color-border-glow); border-radius: var(--radius-md); z-index: 100; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin-top: 0.25rem;"></div>
          </div>
          <input type="hidden" id="del-cust-id" value="" />
          <input type="hidden" id="del-cust-name" value="Walk-in Customer" />

          <!-- New Customer Details Collapsible Box -->
          <div id="new-cust-fields-container" style="display: none; margin-top: 0.75rem; padding: 1rem; background: rgba(0, 180, 216, 0.08); border: 1px solid var(--color-border-glow); border-radius: var(--radius-md); flex-direction: column; gap: 0.75rem;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--color-accent); display: flex; align-items: center; gap: 0.4rem;">
              <i data-lucide="user-plus"></i> New Customer Information
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Delivery Address / Landmark</label>
              <input class="form-input" type="text" id="del-cust-address" placeholder="e.g. Zone 5, Maangas" />
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Contact Phone Number</label>
              <input class="form-input" type="tel" id="del-cust-phone" placeholder="e.g. 09171234567" />
            </div>

            <div class="form-group" style="margin: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Delivery Notes / Instructions</label>
              <input class="form-input" type="text" id="del-cust-notes" placeholder="e.g. Deliver kada Lunes" />
            </div>
          </div>
        </div>

        <!-- Service Selection -->
        <div class="form-group">
          <label class="form-label">Water Service Type</label>
          <select class="form-select" id="del-service" required>
            ${services.map(s => `<option value="${s.id}" data-price="${s.price}" data-rate="${s.commissionRate || 0.27}">${s.name} — ₱${s.price}/jug (${((s.commissionRate || 0.27) * 100).toFixed(0)}% Comm)</option>`).join('')}
          </select>
        </div>

        <!-- Smart Jug Numbers Selector -->
        <div class="form-group">
          <div class="flex-between" style="margin-bottom: 0.4rem;">
            <label class="form-label">Assigned Jug Numbers (In-Stock Pool)</label>
            <span style="font-size: 0.78rem; color: var(--color-accent);" id="selected-jugs-count">0 Jugs Selected</span>
          </div>

          <div style="max-height: 140px; overflow-y: auto; padding: 0.75rem; background: rgba(0,0,0,0.3); border: 1px solid var(--color-border-glass); border-radius: var(--radius-md); display: flex; flex-wrap: wrap; gap: 0.4rem;" id="in-stock-jugs-box">
            ${inStockJugs.length === 0 ? `
              <div style="font-size: 0.8rem; color: var(--color-text-muted); padding: 0.5rem; text-align: center; width: 100%;">
                No refilled jugs currently in stock pool!
              </div>
            ` : inStockJugs.map(j => {
              const fmt = j.formattedNumber || '#' + String(j.number).padStart(3, '0');
              return `
                <button type="button" class="btn btn-secondary btn-sm jug-pick-btn" data-fmt="${fmt}" data-id="${j.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">
                  ${fmt}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Jug Count (Driven by selected jug numbers) -->
        <div class="form-group">
          <label class="form-label">Total Jug Count (Driven by Selected Jugs)</label>
          <input class="form-input mono" type="number" id="del-jug-count" min="1" value="0" style="font-size: 1.2rem; font-weight: 700; background: rgba(0,0,0,0.3);" readonly required />
          <span style="font-size: 0.75rem; color: var(--color-warning);">Selecting physical jug numbers above is required.</span>
        </div>

        <!-- Live Calculation Preview Card -->
        <div style="background: rgba(0, 180, 216, 0.08); border: 1px solid var(--color-border-glass); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.65rem;">
          <div class="flex-between" style="font-size: 0.9rem;">
            <span style="color: var(--color-text-secondary);">Total Delivery Price:</span>
            <span class="mono" style="font-size: 1.1rem; font-weight: 700; color: var(--color-success);" id="calc-total">₱30.00</span>
          </div>

          <div class="flex-between" style="font-size: 0.9rem;">
            <span style="color: var(--color-text-secondary);">Your Earned Commission (27%):</span>
            <span class="mono" style="font-size: 1.15rem; font-weight: 800; color: var(--color-warning);" id="calc-commission">₱8.10</span>
          </div>

          <div class="flex-between" style="font-size: 0.85rem; border-top: 1px dashed var(--color-border-glass); padding-top: 0.5rem;">
            <span style="color: var(--color-text-muted);">Station Net:</span>
            <span class="mono" style="color: var(--color-text-muted);" id="calc-station">₱21.90</span>
          </div>
        </div>

        <button class="btn btn-primary btn-full btn-lg" type="submit" id="btn-submit-delivery">
          Confirm & Submit Delivery
        </button>
      </form>
    </div>
  `;

  // Select DOM Elements
  const svcSelect = container.querySelector('#del-service');
  const jugInput = container.querySelector('#del-jug-count');
  const countLabel = container.querySelector('#selected-jugs-count');
  const jugsBox = container.querySelector('#in-stock-jugs-box');

  const calcTotalEl = container.querySelector('#calc-total');
  const calcCommEl = container.querySelector('#calc-commission');
  const calcStationEl = container.querySelector('#calc-station');

  // Customer Combobox Elements
  const custSearchInput = container.querySelector('#del-cust-search');
  const custDropdown = container.querySelector('#cust-suggestions-dropdown');
  const custIdInput = container.querySelector('#del-cust-id');
  const custNameInput = container.querySelector('#del-cust-name');
  const newCustContainer = container.querySelector('#new-cust-fields-container');
  const custAddressInput = container.querySelector('#del-cust-address');
  const custPhoneInput = container.querySelector('#del-cust-phone');
  const custNotesInput = container.querySelector('#del-cust-notes');

  function renderCustomerSuggestions(queryText = '') {
    const q = queryText.toLowerCase().trim();
    let matches = customers;
    if (q) {
      matches = customers.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }

    let html = `
      <div class="cust-suggest-item" data-id="" data-name="Walk-in Customer" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border-glass); cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <strong style="color: var(--color-accent); font-size: 0.9rem;">Walk-in Customer</strong>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">Standard direct counter or one-time customer</div>
        </div>
        <span class="badge badge-info" style="font-size: 0.65rem;">Default</span>
      </div>
    `;

    if (q && !customers.some(c => c.name && c.name.toLowerCase() === q)) {
      html += `
        <div class="cust-suggest-item" data-id="new" data-name="${queryText.trim()}" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border-glass); cursor: pointer; background: rgba(0, 180, 216, 0.12);">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="plus-circle" style="color: var(--color-accent);"></i>
            <div>
              <strong style="color: white; font-size: 0.9rem;">Add New Customer: "${queryText.trim()}"</strong>
              <div style="font-size: 0.75rem; color: var(--color-text-secondary);">Input address, contact number & notes below</div>
            </div>
          </div>
        </div>
      `;
    }

    matches.forEach(c => {
      html += `
        <div class="cust-suggest-item" data-id="${c.id}" data-name="${c.name}" data-address="${c.address || ''}" data-phone="${c.phone || ''}" data-notes="${c.notes || ''}" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border-glass); cursor: pointer;">
          <div style="font-weight: 700; color: white; font-size: 0.9rem;">${c.name}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.15rem;">
            ${c.address ? c.address : 'No Address'} ${c.phone ? '• Phone: ' + c.phone : ''}
          </div>
        </div>
      `;
    });

    custDropdown.innerHTML = html;
    custDropdown.style.display = 'block';

    custDropdown.querySelectorAll('.cust-suggest-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const name = item.dataset.name;
        const address = item.dataset.address || '';
        const phone = item.dataset.phone || '';
        const notes = item.dataset.notes || '';

        custIdInput.value = id;
        custNameInput.value = name;
        custSearchInput.value = name;

        if (id === 'new') {
          newCustContainer.style.display = 'flex';
          custAddressInput.value = '';
          custPhoneInput.value = '';
          custNotesInput.value = '';
          custAddressInput.focus();
        } else if (id) {
          newCustContainer.style.display = 'flex';
          custAddressInput.value = address;
          custPhoneInput.value = phone;
          custNotesInput.value = notes;
        } else {
          newCustContainer.style.display = 'none';
        }

        custDropdown.style.display = 'none';
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  custSearchInput.addEventListener('focus', () => renderCustomerSuggestions(custSearchInput.value));
  custSearchInput.addEventListener('input', () => renderCustomerSuggestions(custSearchInput.value));

  document.addEventListener('click', (e) => {
    if (!custSearchInput.contains(e.target) && !custDropdown.contains(e.target)) {
      custDropdown.style.display = 'none';
    }
  });

  // Jug Selection Handler
  function updateJugPickerUI() {
    jugsBox.querySelectorAll('.jug-pick-btn').forEach(btn => {
      const fmt = btn.dataset.fmt;
      if (selectedJugNumbers.has(fmt)) {
        btn.classList.replace('btn-secondary', 'btn-primary');
        btn.style.boxShadow = '0 0 10px rgba(0, 180, 216, 0.6)';
        btn.style.fontWeight = '800';
      } else {
        btn.classList.replace('btn-primary', 'btn-secondary');
        btn.style.boxShadow = 'none';
        btn.style.fontWeight = 'normal';
      }
    });

    jugInput.value = selectedJugNumbers.size;
    countLabel.textContent = `${selectedJugNumbers.size} Jugs Selected ${selectedJugNumbers.size > 0 ? '(' + Array.from(selectedJugNumbers).join(', ') + ')' : ''}`;
    updateMath();
  }

  jugsBox.querySelectorAll('.jug-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const fmt = btn.dataset.fmt;
      if (selectedJugNumbers.has(fmt)) {
        selectedJugNumbers.delete(fmt);
      } else {
        selectedJugNumbers.add(fmt);
      }
      updateJugPickerUI();
    });
  });

  function updateMath() {
    const selectedOpt = svcSelect.options[svcSelect.selectedIndex];
    if (!selectedOpt) return;

    const pricePerJug = parseFloat(selectedOpt.dataset.price) || 30;
    const commissionRate = parseFloat(selectedOpt.dataset.rate) || 0.27;
    const jugCount = parseInt(jugInput.value, 10) || 0;

    const res = calculateCommission({ jugCount, pricePerJug, commissionRate });
    calcTotalEl.textContent = formatCurrency(res.totalPrice);
    calcCommEl.textContent = formatCurrency(res.commissionAmount);
    calcStationEl.textContent = formatCurrency(res.stationAmount);
  }

  svcSelect.addEventListener('change', updateMath);
  jugInput.addEventListener('input', updateMath);
  updateMath();

  // Return Empty Jugs Modal Handler
  container.querySelector('#btn-open-return-modal')?.addEventListener('click', openReturnJugsModal);

  async function openReturnJugsModal() {
    let outJugs = [];
    try {
      const snap = await fastGetDocs(collection(db, 'jugs'));
      const freshJugs = (snap.docs || []).map(d => ({ id: d.id, ...d.data() }));
      const localOut = new Set(getOfflineOutJugs());

      outJugs = freshJugs
        .filter(j => j.status === 'out_for_delivery' || j.status === 'with_customer' || localOut.has(j.formattedNumber || '#' + String(j.number).padStart(3, '0')))
        .sort((a, b) => (a.number || 0) - (b.number || 0));
    } catch (err) {
      console.error('Fetch out jugs error:', err);
    }

    const selectedToReturn = new Set();

    const returnHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <p style="font-size: 0.88rem; color: var(--color-text-secondary);">
          Select empty jugs returned from customers to return them back to <strong>In Stock (Refilled)</strong> status.
        </p>

        <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-accent);" id="ret-count-label">
          0 Jugs Selected to Return
        </div>

        <div style="max-height: 220px; overflow-y: auto; padding: 0.75rem; background: rgba(0,0,0,0.3); border: 1px solid var(--color-border-glass); border-radius: var(--radius-md); display: flex; flex-wrap: wrap; gap: 0.4rem;" id="ret-grid">
          ${outJugs.length === 0 ? `
            <div style="font-size: 0.85rem; color: var(--color-text-muted); padding: 1.5rem; text-align: center; width: 100%;">
              No jugs currently marked as "Out for Delivery" or "With Customer".
            </div>
          ` : outJugs.map(j => {
            const fmt = j.formattedNumber || '#' + String(j.number).padStart(3, '0');
            return `
              <button type="button" class="btn btn-secondary btn-sm ret-jug-btn" data-docid="${j.id}" data-fmt="${fmt}" style="padding: 0.4rem 0.65rem; border-color: var(--color-warning);">
                ${fmt}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    createModal({
      title: 'Return Empty Jugs to Shop Stock',
      bodyContent: returnHtml,
      primaryActionText: 'Process Return to In-Stock',
      onSave: async () => {
        if (selectedToReturn.size === 0) {
          showToast('Please select at least one returned jug number', 'warning');
          return false;
        }

        const returnArr = Array.from(selectedToReturn);
        const returnFmtArr = [];

        returnArr.forEach(docId => {
          const num = docId.replace('jug-', '');
          returnFmtArr.push(`#${num}`);
        });

        // 1. Immediately update local out jugs cache
        markJugsReturned(returnFmtArr);

        // 2. Show instant feedback
        showToast(`Successfully returned ${returnArr.length} jugs to In-Stock!`, 'success');
        navigateTo('/employee/dashboard');

        // 3. Background Firestore write
        (async () => {
          try {
            const batch = writeBatch(db);
            returnArr.forEach(docId => {
              const ref = doc(db, 'jugs', docId);
              batch.set(ref, {
                status: 'in_stock',
                updatedAt: serverTimestamp()
              }, { merge: true });
            });
            await batch.commit();

            await logAuditAction({
              user: profile,
              action: 'jugs.returned',
              entity: 'jugs',
              description: `Returned ${returnArr.length} jugs back to In-Stock`
            });
          } catch (err) {
            console.warn('Background return sync will retry:', err);
          }
        })();

        return true;
      }
    });

    // Handle Return Button Selections inside Modal
    setTimeout(() => {
      const modalEl = document.querySelector('.modal-overlay.active');
      if (!modalEl) return;
      const countEl = modalEl.querySelector('#ret-count-label');

      modalEl.querySelectorAll('.ret-jug-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const docId = btn.dataset.docid;
          if (selectedToReturn.has(docId)) {
            selectedToReturn.delete(docId);
            btn.classList.replace('btn-primary', 'btn-secondary');
          } else {
            selectedToReturn.add(docId);
            btn.classList.replace('btn-secondary', 'btn-primary');
          }
          if (countEl) {
            countEl.textContent = `${selectedToReturn.size} Jugs Selected to Return`;
          }
        });
      });
    }, 100);
  }

  // Form Submission
  const form = container.querySelector('#delivery-log-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const assignedJugNumbers = Array.from(selectedJugNumbers);

    if (assignedJugNumbers.length === 0) {
      showToast('Please select at least one physical jug number to log a delivery!', 'warning');
      return;
    }

    let customerId = custIdInput.value;
    let customerName = custNameInput.value.trim() || custSearchInput.value.trim() || 'Walk-in Customer';
    let customerAddress = '';
    let customerPhone = '';
    let customerNotes = '';

    const selectedOpt = svcSelect.options[svcSelect.selectedIndex];
    const serviceId = svcSelect.value;
    const serviceName = selectedOpt.text.split('—')[0].trim();
    const pricePerJug = parseFloat(selectedOpt.dataset.price) || 30;
    const commissionRate = parseFloat(selectedOpt.dataset.rate) || 0.27;
    const jugCount = parseInt(jugInput.value, 10) || 1;
    const isOnline = navigator.onLine;

    if (customerId === 'new' || (customerId === '' && customerName !== 'Walk-in Customer')) {
      customerAddress = custAddressInput.value.trim();
      customerPhone = custPhoneInput.value.trim();
      customerNotes = custNotesInput.value.trim();
    } else if (customerId) {
      const existingCust = customers.find(c => c.id === customerId);
      if (existingCust) {
        customerAddress = existingCust.address || '';
        customerPhone = existingCust.phone || '';
      }
    }

    const calcRes = calculateCommission({ jugCount, pricePerJug, commissionRate });

    const deliveryData = {
      employeeId: profile?.id || firebaseUser?.uid || 'unknown-employee',
      employeeName: profile?.name || firebaseUser?.email || 'Staff',
      customerId,
      customerName,
      customerAddress,
      customerPhone,
      customerNotes,
      serviceId,
      serviceName,
      jugCount,
      jugNumbers: assignedJugNumbers,
      pricePerJug,
      totalPrice: calcRes.totalPrice,
      commissionRate,
      commissionAmount: calcRes.commissionAmount,
      status: 'delivered',
      createdAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString()
    };

    // 1. Immediately update offline tracking set & local queue (ZERO WAIT)
    markJugsDelivered(assignedJugNumbers);
    const savedEntry = savePendingDelivery(deliveryData);

    // 2. Show instant toast notification IMMEDIATELY
    showToast(`Delivery recorded successfully! ${assignedJugNumbers.length} jugs marked as out.`, 'success');

    // 3. Immediately navigate to My Deliveries
    navigateTo('/employee/my-deliveries');

    // 4. Background Sync to Cloud Firestore (Non-blocking)
    if (isOnline) {
      (async () => {
        try {
          if (customerId === 'new' || (customerId === '' && customerName !== 'Walk-in Customer')) {
            const newCustDoc = await addDoc(collection(db, 'customers'), {
              name: customerName,
              address: customerAddress || 'No Address Provided',
              phone: customerPhone || 'N/A',
              notes: customerNotes || '',
              totalOrders: 1,
              totalJugsDelivered: jugCount,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            deliveryData.customerId = newCustDoc.id;
          }

          await addDoc(collection(db, 'deliveries'), {
            ...deliveryData,
            createdOffline: false,
            createdAt: serverTimestamp(),
            deliveredAt: serverTimestamp()
          });

          if (assignedJugNumbers.length > 0) {
            const batch = writeBatch(db);
            assignedJugNumbers.forEach(fmt => {
              const numStr = fmt.replace('#', '');
              const docId = `jug-${numStr}`;
              const ref = doc(db, 'jugs', docId);
              batch.set(ref, {
                number: parseInt(numStr, 10),
                formattedNumber: fmt,
                status: 'out_for_delivery',
                updatedAt: serverTimestamp()
              }, { merge: true });
            });
            await batch.commit();
          }

          // Successfully pushed to Firestore, remove from local pending queue
          removePendingDelivery(savedEntry.id);
        } catch (bgErr) {
          console.warn('Background sync will retry on reconnect:', bgErr);
        }
      })();
    }
  });

  return {
    title: 'Log Water Delivery',
    subtitle: 'Assign jug numbers, commission, or return empty jugs to shop.',
    element: container
  };
}
