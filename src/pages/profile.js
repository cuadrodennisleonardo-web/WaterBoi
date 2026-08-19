import { db } from '../firebase.js';
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentUser } from '../auth.js';
import { formatCurrency, formatNumber, formatDate } from '../utils/formatters.js';
import { logAuditAction } from '../utils/audit.js';
import { showToast } from '../components/toast.js';

export const EMPLOYEE_AVATAR_PRESETS = [
  { id: 'droplet', name: 'Water Drop Hero', icon: 'droplet', color: '#00B4D8', bg: 'rgba(0, 180, 216, 0.2)', reqLabel: 'Unlocked by Default' },
  { id: 'truck', name: 'Delivery Captain', icon: 'truck', color: '#06D6A0', bg: 'rgba(6, 214, 160, 0.2)', reqLabel: 'Req: 10 Deliveries' },
  { id: 'shield-check', name: 'Quality Guardian', icon: 'shield-check', color: '#4EA8DE', bg: 'rgba(78, 168, 222, 0.2)', reqLabel: 'Req: 500 Jugs' },
  { id: 'zap', name: 'Speedy Refiller', icon: 'zap', color: '#B5179E', bg: 'rgba(181, 23, 158, 0.2)', reqLabel: 'Req: ₱5,000 Comm' },
  { id: 'crown', name: 'Station Legend', icon: 'crown', color: '#FFD166', bg: 'rgba(255, 209, 102, 0.2)', reqLabel: 'Req: 2,500 Jugs' },
  { id: 'flame', name: 'WaterBoi Titan', icon: 'flame', color: '#EF476F', bg: 'rgba(239, 71, 111, 0.25)', reqLabel: 'Req: 10,000 Jugs' },
  { id: 'gem', name: 'God of Hydration', icon: 'gem', color: '#F72585', bg: 'rgba(247, 37, 133, 0.3)', reqLabel: 'Req: 25,000 Jugs / ₱100K Comm' }
];

export const ADMIN_AVATAR_PRESETS = [
  { id: 'building-2', name: 'Station Founder', icon: 'building-2', color: '#00B4D8', bg: 'rgba(0, 180, 216, 0.2)', reqLabel: 'Unlocked by Default' },
  { id: 'package-check', name: 'Inventory Commander', icon: 'package-check', color: '#06D6A0', bg: 'rgba(6, 214, 160, 0.2)', reqLabel: 'Req: 100 Jugs Reg' },
  { id: 'users', name: 'Crew Director', icon: 'users', color: '#4EA8DE', bg: 'rgba(78, 168, 222, 0.2)', reqLabel: 'Req: 3 Staff' },
  { id: 'trending-up', name: 'Fleet Director', icon: 'trending-up', color: '#B5179E', bg: 'rgba(181, 23, 158, 0.2)', reqLabel: 'Req: 500 Deliveries' },
  { id: 'award', name: 'Station Revenue Tycoon', icon: 'award', color: '#FFD166', bg: 'rgba(255, 209, 102, 0.2)', reqLabel: 'Req: ₱50K Revenue' },
  { id: 'flame', name: 'Enterprise Titan', icon: 'flame', color: '#EF476F', bg: 'rgba(239, 71, 111, 0.25)', reqLabel: 'Req: 5,000 Deliveries' },
  { id: 'gem', name: 'God of Refilling', icon: 'gem', color: '#F72585', bg: 'rgba(247, 37, 133, 0.3)', reqLabel: 'Req: 25,000 Jugs / ₱500K Rev' }
];

import { fastGetDocs } from '../utils/fastFetch.js';
import { getPendingDeliveries } from '../utils/offlineQueue.js';

export async function renderProfilePage() {
  const container = document.createElement('div');
  container.style.cssText = 'display: flex; flex-direction: column; gap: 1.5rem; max-width: 850px; margin: 0 auto; width: 100%;';

  const { profile, firebaseUser } = getCurrentUser();
  const userId = profile?.id || firebaseUser?.uid;
  const role = profile?.role || 'employee';

  let totalJugs = 0;
  let totalComm = 0;
  let totalRevenue = 0;
  let totalDeliveries = 0;
  let registeredJugsCount = 0;
  let totalEmployeesCount = 0;

  try {
    if (userId) {
      if (role === 'employee') {
        let deliveries = [];
        try {
          const delSnap = await fastGetDocs(query(collection(db, 'deliveries'), where('employeeId', '==', userId)));
          deliveries = (delSnap.docs || []).map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
          console.warn('Profile offline fetch:', err);
        }

        const localPending = getPendingDeliveries().filter(d => d.employeeId === userId);
        const existingIds = new Set(deliveries.map(d => d.id));
        localPending.forEach(lp => {
          if (!existingIds.has(lp.id)) deliveries.push(lp);
        });

        totalDeliveries = deliveries.length;
        deliveries.forEach(data => {
          totalJugs += Number(data.jugCount) || 0;
          totalComm += Number(data.commissionAmount) || 0;
        });
      } else {
        // Admin Station Metrics with fast parallel fetching
        const [jSnap, eSnap, dSnap] = await Promise.all([
          fastGetDocs(collection(db, 'jugs')),
          fastGetDocs(query(collection(db, 'users'), where('role', '==', 'employee'))),
          fastGetDocs(collection(db, 'deliveries'))
        ]);

        registeredJugsCount = (jSnap.docs || []).length;
        totalEmployeesCount = (eSnap.docs || []).length;
        totalDeliveries = (dSnap.docs || []).length;
        (dSnap.docs || []).forEach(d => {
          const data = d.data();
          totalJugs += Number(data.jugCount) || 0;
          totalRevenue += Number(data.totalPrice) || 0;
        });
      }
    }
  } catch (err) {
    console.error('Error loading profile milestone data:', err);
  }

  const presets = role === 'admin' ? ADMIN_AVATAR_PRESETS : EMPLOYEE_AVATAR_PRESETS;

  // Check Unlock Status of Preset Avatars (Enforced for both Staff & Admin)
  function isAvatarUnlocked(avatarId) {
    if (role === 'admin') {
      switch (avatarId) {
        case 'building-2': return true;
        case 'package-check': return registeredJugsCount >= 100;
        case 'users': return totalEmployeesCount >= 3;
        case 'trending-up': return totalDeliveries >= 500;
        case 'award': return totalRevenue >= 50000;
        case 'flame': return totalDeliveries >= 5000;
        case 'gem': return totalJugs >= 25000 || totalRevenue >= 500000;
        default: return true;
      }
    } else {
      switch (avatarId) {
        case 'droplet': return true;
        case 'truck': return totalDeliveries >= 10;
        case 'shield-check': return totalJugs >= 500;
        case 'zap': return totalComm >= 5000;
        case 'crown': return totalJugs >= 2500;
        case 'flame': return totalJugs >= 10000;
        case 'gem': return totalJugs >= 25000 || totalComm >= 100000;
        default: return true;
      }
    }
  }

  // Calculate Unlocked Career Title & Auto-Upgrade Avatar Icon based on Milestones
  function getCareerTitleAndIcon() {
    if (role === 'employee') {
      if (totalJugs >= 25000 || totalComm >= 100000) {
        return { title: 'GOD OF HYDRATION (25K Jugs / ₱100K Comm)', defaultIcon: 'gem', tier: 'GOD TIER SUPREME' };
      }
      if (totalComm >= 50000) {
        return { title: 'Commission Overlord (₱50,000 Earned)', defaultIcon: 'zap', tier: 'OVERLORD TIER VII' };
      }
      if (totalJugs >= 10000) {
        return { title: 'WaterBoi Titan (10,000 Jugs Delivered)', defaultIcon: 'flame', tier: 'TITAN TIER VI' };
      }
      if (totalJugs >= 2500) {
        return { title: 'Station Legend (2.5K Jugs)', defaultIcon: 'crown', tier: 'EPIC TIER V' };
      }
      if (totalComm >= 5000) {
        return { title: 'Commission Master (₱5K+ Earned)', defaultIcon: 'zap', tier: 'PRO TIER IV' };
      }
      if (totalJugs >= 500) {
        return { title: 'Veteran Carrier (500 Jugs)', defaultIcon: 'shield-check', tier: 'VETERAN TIER III' };
      }
      if (totalDeliveries >= 10) {
        return { title: 'Station Runner (10+ Deliveries)', defaultIcon: 'truck', tier: 'RUNNER TIER II' };
      }
      return { title: 'Newbie Station Trainee', defaultIcon: 'droplet', tier: 'NEWBIE TIER I' };
    } else {
      // Challenging Station Owner Progression
      if (totalJugs >= 25000 || totalRevenue >= 500000) {
        return { title: 'GOD OF REFILLING ENTERPRISE (25K Jugs / ₱500K Rev)', defaultIcon: 'gem', tier: 'GOD BOSS SUPREME' };
      }
      if (totalDeliveries >= 5000) {
        return { title: 'Regional Water Enterprise Titan (5,000 Orders)', defaultIcon: 'flame', tier: 'EMPIRE BOSS VI' };
      }
      if (totalRevenue >= 50000) {
        return { title: 'Station Revenue Tycoon (₱50,000 Gross Sales)', defaultIcon: 'award', tier: 'TYCOON BOSS V' };
      }
      if (totalDeliveries >= 500) {
        return { title: 'High-Volume Station Fleet Director (500 Orders)', defaultIcon: 'trending-up', tier: 'EXECUTIVE BOSS IV' };
      }
      if (totalEmployeesCount >= 3) {
        return { title: 'Fleet & Crew Director (3 Staff)', defaultIcon: 'users', tier: 'COMMANDER BOSS III' };
      }
      if (registeredJugsCount >= 100) {
        return { title: 'Master Inventory Commander (100 Jugs)', defaultIcon: 'package-check', tier: 'OPERATOR BOSS II' };
      }
      return { title: 'Station Founder & Principal Owner', defaultIcon: 'building-2', tier: 'FOUNDER BOSS I' };
    }
  }

  function renderUI() {
    const careerInfo = getCareerTitleAndIcon();

    let activeAvatarId = profile?.avatarIcon;
    if (!activeAvatarId || !isAvatarUnlocked(activeAvatarId)) {
      activeAvatarId = careerInfo.defaultIcon;
    }

    const currentPreset = presets.find(a => a.id === activeAvatarId) || presets[0];

    const milestones = role === 'employee' ? [
      {
        id: 'm-newbie',
        title: 'Newbie Station Trainee',
        desc: 'Logged your first water jug delivery order.',
        icon: 'droplet',
        unlocked: totalDeliveries >= 1,
        progress: `${Math.min(totalDeliveries, 1)} / 1 order`,
        pct: Math.min(100, (totalDeliveries / 1) * 100)
      },
      {
        id: 'm-runner',
        title: 'Station Runner (10 Trips)',
        desc: 'Completed 10+ water delivery trips to customers.',
        icon: 'truck',
        unlocked: totalDeliveries >= 10,
        progress: `${totalDeliveries} / 10 trips`,
        pct: Math.min(100, (totalDeliveries / 10) * 100)
      },
      {
        id: 'm-veteran',
        title: 'Veteran Carrier (500 Jugs)',
        desc: 'Delivered 500+ refilled water jugs. Elite status!',
        icon: 'shield-check',
        unlocked: totalJugs >= 500,
        progress: `${totalJugs} / 500 jugs`,
        pct: Math.min(100, (totalJugs / 500) * 100)
      },
      {
        id: 'm-comm',
        title: 'Commission Master (₱5,000)',
        desc: 'Earned ₱5,000+ total in delivery commission payouts.',
        icon: 'zap',
        unlocked: totalComm >= 5000,
        progress: `₱${totalComm.toFixed(2)} / ₱5,000`,
        pct: Math.min(100, (totalComm / 5000) * 100)
      },
      {
        id: 'm-legend',
        title: 'Station Legend (2,500 Jugs)',
        desc: 'Delivered 2,500+ refilled water jugs to customers.',
        icon: 'crown',
        unlocked: totalJugs >= 2500,
        progress: `${totalJugs} / 2,500 jugs`,
        pct: Math.min(100, (totalJugs / 2500) * 100)
      },
      {
        id: 'm-titan',
        title: 'WaterBoi Titan (10,000 Jugs)',
        desc: 'Career Milestone! Delivered 10,000+ total refilled water jugs.',
        icon: 'flame',
        unlocked: totalJugs >= 10000,
        progress: `${totalJugs} / 10,000 jugs`,
        pct: Math.min(100, (totalJugs / 10000) * 100)
      },
      {
        id: 'm-overlord',
        title: 'Commission Overlord (₱50,000 Earned)',
        desc: 'Career Milestone! Earned ₱50,000+ in total 27% commission payouts.',
        icon: 'banknote',
        unlocked: totalComm >= 50000,
        progress: `₱${totalComm.toFixed(2)} / ₱50,000`,
        pct: Math.min(100, (totalComm / 50000) * 100)
      },
      {
        id: 'm-god',
        title: 'GOD OF HYDRATION (25,000 Jugs / ₱100K Comm)',
        desc: 'Supreme God-Tier Level! Delivered 25,000+ jugs or earned ₱100,000+ commission.',
        icon: 'gem',
        unlocked: totalJugs >= 25000 || totalComm >= 100000,
        progress: `${totalJugs} / 25,000 jugs`,
        pct: Math.min(100, (totalJugs / 25000) * 100)
      }
    ] : [
      {
        id: 'a-founder',
        title: 'Station Founder & Owner',
        desc: 'Established & operating registered refilling station business.',
        icon: 'building-2',
        unlocked: true,
        progress: 'Station Founder',
        pct: 100
      },
      {
        id: 'a-inventory',
        title: 'Master Inventory Commander (100 Jugs)',
        desc: 'Registered 100+ physical jug numbers in shop stock pool.',
        icon: 'package-check',
        unlocked: registeredJugsCount >= 100,
        progress: `${registeredJugsCount} / 100 jugs`,
        pct: Math.min(100, (registeredJugsCount / 100) * 100)
      },
      {
        id: 'a-crew',
        title: 'Fleet & Crew Director (3 Staff)',
        desc: 'Recruited and managing 3+ active station delivery staff.',
        icon: 'users',
        unlocked: totalEmployeesCount >= 3,
        progress: `${totalEmployeesCount} / 3 staff`,
        pct: Math.min(100, (totalEmployeesCount / 3) * 100)
      },
      {
        id: 'a-volume',
        title: 'High-Volume Station (500 Orders)',
        desc: 'Station fulfilled 500+ total completed delivery orders.',
        icon: 'trending-up',
        unlocked: totalDeliveries >= 500,
        progress: `${totalDeliveries} / 500 orders`,
        pct: Math.min(100, (totalDeliveries / 500) * 100)
      },
      {
        id: 'a-revenue',
        title: 'Station Revenue Tycoon (₱50,000 Sales)',
        desc: 'Station generated ₱50,000+ in total gross water delivery revenue.',
        icon: 'award',
        unlocked: totalRevenue >= 50000,
        progress: `₱${totalRevenue.toFixed(2)} / ₱50,000`,
        pct: Math.min(100, (totalRevenue / 50000) * 100)
      },
      {
        id: 'a-empire',
        title: 'Regional Water Empire (5,000 Orders)',
        desc: 'Station fulfilled 5,000+ total completed delivery orders.',
        icon: 'flame',
        unlocked: totalDeliveries >= 5000,
        progress: `${totalDeliveries} / 5,000 orders`,
        pct: Math.min(100, (totalDeliveries / 5000) * 100)
      },
      {
        id: 'a-god',
        title: 'GOD OF REFILLING ENTERPRISE (25,000 Jugs / ₱500K Rev)',
        desc: 'Supreme God-Tier Enterprise Status! Station processed 25,000+ jugs or ₱500,000 gross revenue.',
        icon: 'gem',
        unlocked: totalJugs >= 25000 || totalRevenue >= 500000,
        progress: `${totalJugs} / 25,000 jugs`,
        pct: Math.min(100, (totalJugs / 25000) * 100)
      }
    ];

    container.innerHTML = `
      <!-- User Profile Header Card with Career Title -->
      <div class="glass-card hero-welcome-card" style="background: linear-gradient(135deg, rgba(0, 180, 216, 0.22) 0%, rgba(13, 27, 42, 0.95) 100%); border-color: var(--color-border-glow); padding: 2rem;">
        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: ${currentPreset.bg}; border: 3px solid ${currentPreset.color}; display: flex; align-items: center; justify-content: center; color: ${currentPreset.color}; font-size: 2.5rem; box-shadow: 0 0 30px ${currentPreset.bg};">
            <i data-lucide="${currentPreset.icon}"></i>
          </div>

          <div>
            <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.7rem; font-weight: 800; color: white;">${profile?.name || 'Water Member'}</h2>
              <span class="badge badge-${role === 'admin' ? 'warning' : 'info'}" style="font-size: 0.78rem;">${role === 'admin' ? 'Station Owner' : 'Delivery Staff'}</span>
            </div>

            <!-- Unlocked Career Title Banner -->
            <div style="margin-top: 0.4rem; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
              <span class="badge" style="background: rgba(255, 209, 102, 0.18); color: var(--color-warning); border: 1px solid rgba(255, 209, 102, 0.5); font-size: 0.75rem; letter-spacing: 0.05em;">
                ${careerInfo.tier}
              </span>
              <strong style="font-size: 1rem; color: var(--color-accent); font-weight: 800;">
                ${careerInfo.title}
              </strong>
            </div>

            <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 0.35rem;">
              ${profile?.email || firebaseUser?.email} ${profile?.phone ? '• Phone: ' + profile.phone : ''}
            </p>
          </div>
        </div>
      </div>

      <!-- Preset Avatar Icons -->
      <div class="glass-card">
        <div style="margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--color-text-primary);">Choose Your Profile Avatar Icon</h3>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 0.2rem;">
            Your profile icon automatically upgrades as you achieve milestone ranks! Select any unlocked avatar below:
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr)); gap: 1rem;" id="avatar-presets-grid">
          ${presets.map(preset => {
            const isUnlocked = isAvatarUnlocked(preset.id);
            const isSelected = preset.id === activeAvatarId;
            return `
              <button class="avatar-preset-card btn-avatar-select" data-id="${preset.id}" data-unlocked="${isUnlocked}" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.5rem;
                padding: 1.15rem 0.65rem;
                border-radius: var(--radius-lg);
                background: ${isSelected ? preset.bg : isUnlocked ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.4)'};
                border: 2px solid ${isSelected ? preset.color : isUnlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'};
                cursor: ${isUnlocked ? 'pointer' : 'not-allowed'};
                opacity: ${isUnlocked ? '1' : '0.45'};
                transition: all 0.2s ease;
                box-shadow: ${isSelected ? '0 0 15px ' + preset.bg : 'none'};
                position: relative;
              ">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: ${isUnlocked ? preset.bg : 'rgba(255,255,255,0.05)'}; color: ${isUnlocked ? preset.color : 'var(--color-text-muted)'}; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
                  <i data-lucide="${isUnlocked ? preset.icon : 'lock'}"></i>
                </div>
                <span style="font-size: 0.78rem; font-weight: 700; color: ${isSelected ? 'white' : isUnlocked ? 'var(--color-text-secondary)' : 'var(--color-text-muted)'}; text-align: center;">
                  ${preset.name}
                </span>
                ${isSelected ? `<span class="badge badge-success" style="font-size: 0.62rem; padding: 0.15rem 0.35rem;">ACTIVE</span>` : isUnlocked ? `<span class="badge badge-info" style="font-size: 0.62rem; padding: 0.15rem 0.35rem;">UNLOCKED</span>` : `<span class="badge" style="background: rgba(239, 71, 111, 0.15); color: var(--color-danger); font-size: 0.62rem; padding: 0.15rem 0.35rem;">Locked: ${preset.reqLabel}</span>`}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Gamified Milestones & Career Achievements Card -->
      <div class="glass-card">
        <div style="margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--color-text-primary);"><i data-lucide="trophy"></i> Career Achievements & Milestones</h3>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 0.2rem;">
            ${role === 'admin' ? 'Track your station business expansion up to 25,000-Jug God of Refilling Enterprise!' : 'Track your delivery journey from Newbie Trainee up to Supreme 25,000-Jug God of Hydration!'}
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
          ${milestones.map(m => `
            <div class="glass-card-sm" style="
              background: ${m.unlocked ? 'rgba(6, 214, 160, 0.08)' : 'rgba(255,255,255,0.02)'};
              border: 1px solid ${m.unlocked ? 'rgba(6, 214, 160, 0.3)' : 'rgba(255,255,255,0.08)'};
              padding: 1.25rem;
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
            ">
              <div class="flex-between">
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                  <div style="width: 36px; height: 36px; border-radius: 50%; background: ${m.unlocked ? 'rgba(6, 214, 160, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${m.unlocked ? 'var(--color-success)' : 'var(--color-text-muted)'}; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                    <i data-lucide="${m.unlocked ? m.icon : 'lock'}"></i>
                  </div>
                  <strong style="font-size: 0.88rem; color: ${m.unlocked ? 'white' : 'var(--color-text-secondary)'};">${m.title}</strong>
                </div>
                ${m.unlocked ? `<span class="badge badge-success" style="font-size: 0.68rem;">UNLOCKED</span>` : `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--color-text-muted); font-size: 0.68rem;">LOCKED</span>`}
              </div>

              <p style="font-size: 0.8rem; color: var(--color-text-secondary); line-height: 1.4; margin: 0;">
                ${m.desc}
              </p>

              <!-- Progress Bar -->
              <div style="margin-top: 0.25rem;">
                <div class="flex-between" style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 0.35rem;">
                  <span>Career Progress</span>
                  <span class="mono" style="color: ${m.unlocked ? 'var(--color-success)' : 'var(--color-accent)'};">${m.progress}</span>
                </div>
                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden;">
                  <div style="width: ${m.pct}%; height: 100%; background: ${m.unlocked ? 'var(--color-success)' : 'var(--color-primary-light)'}; border-radius: 10px; transition: width 0.3s ease;"></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Attach Avatar Select Event Handlers with Lock Validation
    container.querySelectorAll('.btn-avatar-select').forEach(btn => {
      btn.addEventListener('click', async () => {
        const isUnlocked = btn.dataset.unlocked === 'true';
        const newAvatarId = btn.dataset.id;
        const preset = presets.find(p => p.id === newAvatarId);

        if (!isUnlocked) {
          showToast(`${preset?.name} is locked! ${preset?.reqLabel}`, 'warning');
          return;
        }

        try {
          if (userId) {
            await updateDoc(doc(db, 'users', userId), {
              avatarIcon: newAvatarId,
              updatedAt: serverTimestamp()
            });

            if (profile) profile.avatarIcon = newAvatarId;

            await logAuditAction({
              user: profile,
              action: 'user.avatar_updated',
              entity: 'users',
              entityId: userId,
              description: `Updated profile avatar preset to "${newAvatarId}"`
            });

            showToast(`Profile avatar updated to ${preset?.name}!`, 'success');

            renderUI();
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
              const avatarEl = sidebar.querySelector('.user-avatar');
              if (avatarEl) {
                if (preset) {
                  avatarEl.style.background = preset.bg;
                  avatarEl.style.borderColor = preset.color;
                  avatarEl.innerHTML = `<i data-lucide="${preset.icon}"></i>`;
                }
              }
            }
          }
        } catch (err) {
          console.error('Update avatar error:', err);
          showToast('Failed to update avatar', 'danger');
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  renderUI();

  return {
    title: 'My User Profile',
    subtitle: 'Manage your avatar icon, view milestone achievements and performance stats',
    element: container
  };
}
