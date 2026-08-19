import { db } from '../../firebase.js';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { formatNumber, formatDate } from '../../utils/formatters.js';
import { getCurrentUser } from '../../auth.js';
import { logAuditAction } from '../../utils/audit.js';
import { createModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { fastGetDocs } from '../../utils/fastFetch.js';

export async function renderInventoryPage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem;';

  let registeredJugsMap = {}; // Key: jug number (1..500) -> jug data
  let activeTabRange = 0; // 0: 1-100, 1: 101-200, 2: 201-300, 3: 301-400, 4: 401-500
  let searchQuery = '';
  let selectedJugs = new Set(); // Currently selected jug numbers in UI

  async function loadInventory() {
    try {
      const snap = await fastGetDocs(collection(db, 'jugs'));
      registeredJugsMap = {};
      (snap.docs || []).forEach(d => {
        const data = d.data();
        if (data.number) {
          registeredJugsMap[data.number] = { id: d.id, ...data };
        }
      });
    } catch (err) {
      console.error('Error loading jugs inventory:', err);
    }
  }

  await loadInventory();

  function getStats() {
    const all = Object.values(registeredJugsMap);
    const totalRegistered = all.length;
    const inStock = all.filter(j => j.status === 'in_stock').length;
    const outForDelivery = all.filter(j => j.status === 'out_for_delivery' || j.status === 'with_customer').length;
    const damaged = all.filter(j => j.status === 'damaged').length;

    return { totalRegistered, inStock, outForDelivery, damaged };
  }

  function renderUI() {
    const stats = getStats();
    selectedJugs.clear();

    const rangeMin = activeTabRange * 100 + 1;
    const rangeMax = (activeTabRange + 1) * 100;

    container.innerHTML = `
      <div class="flex-between">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 700;">Smart Jug Inventory & Physical Numbering System</h3>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary);">
            Track station jugs by physical numbers. Register new shop stock or mark jugs returned from customers.
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-primary" id="btn-register-jugs-wizard">
            <i data-lucide="plus"></i> Register Jug Numbers
          </button>
        </div>
      </div>

      <!-- Inventory Metrics Grid -->
      <div class="grid-stats">
        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">Total Registered Station Jugs</span>
            <span class="stat-value text-gradient">${formatNumber(stats.totalRegistered)} <span style="font-size: 0.8rem; color: var(--color-text-muted);">/ 500</span></span>
          </div>
          <div class="stat-icon-wrapper"><i data-lucide="database"></i></div>
        </div>

        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">In Stock (Refilled in Shop)</span>
            <span class="stat-value" style="color: var(--color-success);">${formatNumber(stats.inStock)}</span>
          </div>
          <div class="stat-icon-wrapper" style="color: var(--color-success); background: var(--color-success-bg);"><i data-lucide="check-circle"></i></div>
        </div>

        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">Out / With Customer</span>
            <span class="stat-value" style="color: var(--color-warning);">${formatNumber(stats.outForDelivery)}</span>
          </div>
          <div class="stat-icon-wrapper" style="color: var(--color-warning); background: var(--color-warning-bg);"><i data-lucide="truck"></i></div>
        </div>

        <div class="glass-card stat-card">
          <div class="stat-info">
            <span class="stat-label">Damaged / Write-off</span>
            <span class="stat-value" style="color: var(--color-danger);">${formatNumber(stats.damaged)}</span>
          </div>
          <div class="stat-icon-wrapper" style="color: var(--color-danger); background: var(--color-danger-bg);"><i data-lucide="alert-triangle"></i></div>
        </div>
      </div>

      <!-- Main Smart Jug Selector Grid Box -->
      <div class="glass-card flex-between" style="gap: 1rem; flex-wrap: wrap;">
        <!-- Hundreds Navigation Tabs -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="hundreds-tabs">
          ${[0, 1, 2, 3, 4].map(idx => {
            const min = idx * 100 + 1;
            const max = (idx + 1) * 100;
            const isActive = activeTabRange === idx;
            return `
              <button class="btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm tab-range-btn" data-index="${idx}">
                #${String(min).padStart(3, '0')} - #${String(max).padStart(3, '0')}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Search Bar -->
        <div style="display: flex; align-items: center; gap: 0.5rem; max-width: 280px; width: 100%;">
          <input class="form-input" type="text" id="jug-search-input" placeholder="Search Jug # (e.g. 42)" value="${searchQuery}" style="padding: 0.45rem 0.85rem;" />
        </div>
      </div>

      <!-- Jug Visual Status Legend -->
      <div style="display: flex; gap: 1.25rem; font-size: 0.82rem; color: var(--color-text-secondary); flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-success); display: inline-block;"></span> In Stock (Refilled)
        </div>
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-warning); display: inline-block;"></span> Out / With Customer
        </div>
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--color-danger); display: inline-block;"></span> Damaged / Write-off
        </div>
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <span style="width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px dashed rgba(255,255,255,0.3); display: inline-block;"></span> Unregistered (Not in Shop Yet)
        </div>
      </div>

      <!-- Jug Grid Display (10 Columns per row: 1-10, 11-20... 91-100) -->
      <div class="glass-card" style="padding: 1.5rem; overflow-x: auto;">
        <div style="display: grid; grid-template-columns: repeat(10, minmax(65px, 1fr)); gap: 0.65rem; min-width: 700px;" id="jug-grid">
          ${renderJugGridHtml(rangeMin, rangeMax)}
        </div>
      </div>
    `;

    // Attach Tab Handlers
    container.querySelectorAll('.tab-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTabRange = parseInt(btn.dataset.index, 10);
        renderUI();
      });
    });

    // Attach Search Handler
    const searchInput = container.querySelector('#jug-search-input');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      const num = parseInt(searchQuery, 10);
      if (!isNaN(num) && num >= 1 && num <= 500) {
        activeTabRange = Math.floor((num - 1) / 100);
      }
      container.querySelector('#jug-grid').innerHTML = renderJugGridHtml(rangeMin, rangeMax);
      attachGridListeners();
    });

    // Attach Register Wizard Handler
    container.querySelector('#btn-register-jugs-wizard')?.addEventListener('click', openRegisterWizard);

    attachGridListeners();
    if (window.lucide) window.lucide.createIcons();
  }

  function renderJugGridHtml(min, max) {
    let html = '';
    for (let num = min; num <= max; num++) {
      const formattedNum = `#${String(num).padStart(3, '0')}`;
      const jug = registeredJugsMap[num];
      
      let borderStyle = '1px solid rgba(255, 255, 255, 0.1)';
      let bgStyle = 'rgba(255, 255, 255, 0.02)';
      let colorStyle = 'var(--color-text-muted)';
      let statusDot = '<span style="color: rgba(255,255,255,0.2);">•</span>';

      if (jug) {
        if (jug.status === 'in_stock') {
          bgStyle = 'rgba(6, 214, 160, 0.12)';
          borderStyle = '1px solid rgba(6, 214, 160, 0.4)';
          colorStyle = 'var(--color-success)';
          statusDot = '';
        } else if (jug.status === 'out_for_delivery' || jug.status === 'with_customer') {
          bgStyle = 'rgba(255, 209, 102, 0.12)';
          borderStyle = '1px solid rgba(255, 209, 102, 0.4)';
          colorStyle = 'var(--color-warning)';
          statusDot = '';
        } else if (jug.status === 'damaged') {
          bgStyle = 'rgba(239, 71, 111, 0.12)';
          borderStyle = '1px solid rgba(239, 71, 111, 0.4)';
          colorStyle = 'var(--color-danger)';
          statusDot = '';
        }
      }

      // Filter check
      if (searchQuery) {
        const numStr = String(num);
        if (!numStr.includes(searchQuery) && !formattedNum.toLowerCase().includes(searchQuery.toLowerCase())) {
          continue;
        }
      }

      html += `
        <button class="jug-badge-btn" data-number="${num}" style="
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center; 
          padding: 0.65rem 0.35rem; 
          border-radius: var(--radius-md); 
          background: ${bgStyle}; 
          border: ${borderStyle}; 
          color: ${colorStyle}; 
          font-weight: 700; 
          font-size: 0.85rem; 
          cursor: pointer; 
          transition: transform 0.15s ease;
        ">
          <span style="font-size: 0.7rem; margin-bottom: 0.1rem;">${statusDot}</span>
          ${formattedNum}
        </button>
      `;
    }

    if (!html) {
      html = `<div style="grid-column: 1 / -1; text-align: center; color: var(--color-text-muted); padding: 2rem;">No jugs matching "${searchQuery}" found in this range.</div>`;
    }

    return html;
  }

  function attachGridListeners() {
    container.querySelectorAll('.jug-badge-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt(btn.dataset.number, 10);
        openJugDetailModal(num);
      });
    });
  }

  function openJugDetailModal(num) {
    const formattedNum = `#${String(num).padStart(3, '0')}`;
    const jug = registeredJugsMap[num];

    if (!jug) {
      // Unregistered jug prompt
      createModal({
        title: `<i data-lucide="plus"></i> Register Jug ${formattedNum}`,
        bodyContent: `
          <p style="font-size: 0.95rem; color: var(--color-text-primary); margin-bottom: 1rem;">
            Jug <strong>${formattedNum}</strong> is currently not registered in the station inventory.
          </p>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary);">
            Would you like to register this jug into the shop inventory as <strong>In Stock (Refilled)</strong>?
          </p>
        `,
        primaryActionText: 'Register Jug to Inventory',
        onSave: async () => {
          try {
            const { profile } = getCurrentUser();
            const docId = `jug-${String(num).padStart(3, '0')}`;
            await setDoc(doc(db, 'jugs', docId), {
              number: num,
              formattedNumber: formattedNum,
              status: 'in_stock',
              registeredAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            await logAuditAction({
              user: profile,
              action: 'jug.registered',
              entity: 'jugs',
              entityId: docId,
              description: `Registered Jug ${formattedNum} into shop stock`
            });

            showToast(`Jug ${formattedNum} registered as In Stock!`, 'success');
            await loadInventory();
            renderUI();
            return true;
          } catch (err) {
            console.error('Register jug error:', err);
            showToast('Failed to register jug', 'danger');
            return false;
          }
        }
      });
    } else {
      // Registered jug options
      const modalContent = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="font-size: 0.9rem; color: var(--color-text-secondary);">
            Current Status: 
            <strong style="color: ${jug.status === 'in_stock' ? 'var(--color-success)' : jug.status === 'damaged' ? 'var(--color-danger)' : 'var(--color-warning)'}; text-transform: uppercase;">
              ${jug.status.replace('_', ' ')}
            </strong>
          </div>

          <div class="form-group">
            <label class="form-label">Update Status</label>
            <select class="form-select" id="update-jug-status">
              <option value="in_stock" ${jug.status === 'in_stock' ? 'selected' : ''}>In Stock (Refilled & in Shop)</option>
              <option value="out_for_delivery" ${jug.status === 'out_for_delivery' || jug.status === 'with_customer' ? 'selected' : ''}>Out for Delivery / With Customer</option>
              <option value="damaged" ${jug.status === 'damaged' ? 'selected' : ''}>Damaged / Lost Write-off</option>
              <option value="unregister" style="color: var(--color-danger);">Unregister / Remove from System</option>
            </select>
          </div>
        </div>
      `;

      createModal({
        title: `<i data-lucide="package"></i> Manage Jug ${formattedNum}`,
        bodyContent: modalContent,
        primaryActionText: 'Save Status Update',
        onSave: async (modalEl) => {
          const newStatus = modalEl.querySelector('#update-jug-status').value;
          try {
            const { profile } = getCurrentUser();
            const docId = jug.id || `jug-${String(num).padStart(3, '0')}`;

            if (newStatus === 'unregister') {
              await deleteDoc(doc(db, 'jugs', docId));

              await logAuditAction({
                user: profile,
                action: 'jug.unregistered',
                entity: 'jugs',
                entityId: docId,
                description: `Unregistered Jug ${formattedNum} from station inventory`
              });

              showToast(`Jug ${formattedNum} unregistered from inventory!`, 'success');
            } else {
              await setDoc(doc(db, 'jugs', docId), {
                ...jug,
                status: newStatus,
                updatedAt: serverTimestamp()
              });

              await logAuditAction({
                user: profile,
                action: 'jug.status_updated',
                entity: 'jugs',
                entityId: docId,
                description: `Updated status of Jug ${formattedNum} to "${newStatus}"`
              });

              showToast(`Jug ${formattedNum} updated to ${newStatus.replace('_', ' ')}!`, 'success');
            }

            await loadInventory();
            renderUI();
            return true;
          } catch (err) {
            console.error('Update jug status error:', err);
            showToast('Failed to update jug status', 'danger');
            return false;
          }
        }
      });
    }
  }

  function openRegisterWizard() {
    let wizardRangeIndex = 0; // 0..4
    const selectedForReg = new Set();

    function getWizardGridHtml() {
      const min = wizardRangeIndex * 100 + 1;
      const max = (wizardRangeIndex + 1) * 100;
      let gridHtml = '';

      for (let n = min; n <= max; n++) {
        const isAlreadyReg = !!registeredJugsMap[n];
        const isSelected = selectedForReg.has(n);
        const fmt = `#${String(n).padStart(3, '0')}`;

        let style = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: var(--color-text-secondary);';
        
        if (isAlreadyReg) {
          style = 'background: rgba(6, 214, 160, 0.15); border: 1px solid var(--color-success); color: var(--color-success); cursor: not-allowed; opacity: 0.7;';
        } else if (isSelected) {
          style = 'background: var(--color-primary-light); border: 1px solid var(--color-accent); color: white; font-weight: 800; transform: scale(1.05);';
        }

        gridHtml += `
          <button class="wiz-num-btn" data-num="${n}" ${isAlreadyReg ? 'disabled' : ''} style="
            padding: 0.5rem 0.2rem;
            border-radius: var(--radius-sm);
            font-size: 0.8rem;
            font-weight: 600;
            transition: all 0.15s ease;
            ${style}
          ">
            ${isAlreadyReg ? '✓ ' : ''}${fmt}
          </button>
        `;
      }

      return gridHtml;
    }

    const wizardBodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <p style="font-size: 0.88rem; color: var(--color-text-secondary);">
          Select jug numbers (1 to 500) written on your physical jugs to add them to your station inventory as <strong>In Stock</strong>.
        </p>

        <!-- Quick Range Selection Helpers -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="wiz-range-tabs">
          ${[0, 1, 2, 3, 4].map(i => `
            <button class="btn ${i === 0 ? 'btn-primary' : 'btn-secondary'} btn-sm wiz-range-tab" data-idx="${i}">
              #${String(i * 100 + 1).padStart(3, '0')} - #${String((i + 1) * 100).padStart(3, '0')}
            </button>
          `).join('')}
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem;">
          <span id="selected-count-label" style="font-weight: 700; color: var(--color-accent);">0 Jugs Selected</span>
          <button class="btn btn-secondary btn-sm" id="btn-select-all-range">Select Entire Range</button>
        </div>

        <!-- 100 Grid Container -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 0.5rem; max-height: 320px; overflow-y: auto; padding: 0.5rem; border: 1px solid var(--color-border-glass); border-radius: var(--radius-md);" id="wiz-grid">
          ${getWizardGridHtml()}
        </div>
      </div>
    `;

    createModal({
      title: '<i data-lucide="plus"></i> Register New Station Jugs (1-500 Pool)',
      bodyContent: wizardBodyHtml,
      primaryActionText: 'Register Selected Jugs',
      onSave: async () => {
        if (selectedForReg.size === 0) {
          showToast('Please select at least one jug number to register', 'warning');
          return false;
        }

        try {
          const { profile } = getCurrentUser();
          const batch = writeBatch(db);
          const numbersArr = Array.from(selectedForReg);

          numbersArr.forEach(num => {
            const fmt = `#${String(num).padStart(3, '0')}`;
            const docRef = doc(db, 'jugs', `jug-${String(num).padStart(3, '0')}`);
            batch.set(docRef, {
              number: num,
              formattedNumber: fmt,
              status: 'in_stock',
              registeredAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          });

          await batch.commit();

          await logAuditAction({
            user: profile,
            action: 'jugs.batch_registered',
            entity: 'jugs',
            description: `Batch registered ${numbersArr.length} new jugs into station stock`
          });

          showToast(`Successfully registered ${numbersArr.length} new jugs!`, 'success');
          await loadInventory();
          renderUI();
          return true;
        } catch (err) {
          console.error('Batch register error:', err);
          showToast('Failed to register jugs', 'danger');
          return false;
        }
      }
    });

    // Handle Wizard Modal Dynamic Events
    setTimeout(() => {
      const modalEl = document.querySelector('.modal-overlay.active');
      if (!modalEl) return;

      const gridContainer = modalEl.querySelector('#wiz-grid');
      const countLabel = modalEl.querySelector('#selected-count-label');

      function updateWizGrid() {
        gridContainer.innerHTML = getWizardGridHtml();
        countLabel.textContent = `${selectedForReg.size} Jugs Selected`;
        attachWizButtons();
      }

      function attachWizButtons() {
        gridContainer.querySelectorAll('.wiz-num-btn').forEach(b => {
          b.addEventListener('click', (e) => {
            e.preventDefault();
            const n = parseInt(b.dataset.num, 10);
            if (selectedForReg.has(n)) {
              selectedForReg.delete(n);
            } else {
              selectedForReg.add(n);
            }
            updateWizGrid();
          });
        });
      }

      modalEl.querySelectorAll('.wiz-range-tab').forEach(t => {
        t.addEventListener('click', (e) => {
          e.preventDefault();
          wizardRangeIndex = parseInt(t.dataset.idx, 10);
          modalEl.querySelectorAll('.wiz-range-tab').forEach(tb => tb.classList.replace('btn-primary', 'btn-secondary'));
          t.classList.replace('btn-secondary', 'btn-primary');
          updateWizGrid();
        });
      });

      modalEl.querySelector('#btn-select-all-range')?.addEventListener('click', (e) => {
        e.preventDefault();
        const min = wizardRangeIndex * 100 + 1;
        const max = (wizardRangeIndex + 1) * 100;
        for (let n = min; n <= max; n++) {
          if (!registeredJugsMap[n]) {
            selectedForReg.add(n);
          }
        }
        updateWizGrid();
      });

      attachWizButtons();
    }, 50);
  }

  renderUI();

  return {
    title: 'Smart Jug Inventory Management',
    subtitle: 'Track physical jug numbers, shop stock, and write-offs',
    element: container
  };
}
