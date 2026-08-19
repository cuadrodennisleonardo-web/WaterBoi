import { db } from '../firebase.js';
import { collection, addDoc, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

const PENDING_DELIVERIES_KEY = 'waterboi_pending_deliveries';
const OUT_JUGS_KEY = 'waterboi_out_jugs';

export function getPendingDeliveries() {
  try {
    const raw = localStorage.getItem(PENDING_DELIVERIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function savePendingDelivery(deliveryData) {
  try {
    const list = getPendingDeliveries();
    const localId = `offline-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newEntry = {
      ...deliveryData,
      id: localId,
      createdOffline: true,
      createdAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString()
    };
    list.unshift(newEntry);
    localStorage.setItem(PENDING_DELIVERIES_KEY, JSON.stringify(list));

    if (deliveryData.jugNumbers && deliveryData.jugNumbers.length > 0) {
      markJugsDelivered(deliveryData.jugNumbers);
    }
    return newEntry;
  } catch (e) {
    console.error('Failed to save pending delivery:', e);
    return { ...deliveryData, id: `offline-${Date.now()}` };
  }
}

export function removePendingDelivery(id) {
  try {
    const list = getPendingDeliveries().filter(item => item.id !== id);
    localStorage.setItem(PENDING_DELIVERIES_KEY, JSON.stringify(list));
  } catch (e) {}
}

export function getOfflineOutJugs() {
  try {
    const raw = localStorage.getItem(OUT_JUGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function markJugsDelivered(jugNumbers) {
  try {
    const current = new Set(getOfflineOutJugs());
    jugNumbers.forEach(n => current.add(n));
    localStorage.setItem(OUT_JUGS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {}
}

export function markJugsReturned(jugNumbers) {
  try {
    const current = new Set(getOfflineOutJugs());
    jugNumbers.forEach(n => current.delete(n));
    localStorage.setItem(OUT_JUGS_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {}
}

let isSyncing = false;

export async function syncPendingDeliveries() {
  if (!navigator.onLine || isSyncing) return;
  const pending = getPendingDeliveries();
  if (pending.length === 0) return;

  isSyncing = true;
  console.log(`[OfflineSync] Syncing ${pending.length} pending deliveries to Firestore...`);

  for (const item of pending) {
    try {
      const { id, ...cleanData } = item;
      await addDoc(collection(db, 'deliveries'), {
        ...cleanData,
        createdOffline: false,
        createdAt: serverTimestamp(),
        deliveredAt: serverTimestamp()
      });

      // Update jug statuses in Firestore
      if (item.jugNumbers && item.jugNumbers.length > 0) {
        const batch = writeBatch(db);
        item.jugNumbers.forEach(fmt => {
          const numStr = fmt.replace('#', '');
          const docRef = doc(db, 'jugs', `jug-${numStr}`);
          batch.set(docRef, {
            number: parseInt(numStr, 10),
            formattedNumber: fmt,
            status: 'out_for_delivery',
            updatedAt: serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
      }

      removePendingDelivery(item.id);
      console.log(`[OfflineSync] Synced delivery for ${item.customerName}`);
    } catch (err) {
      console.error('[OfflineSync] Error syncing delivery item:', err);
    }
  }

  isSyncing = false;
}

// Auto-sync listener on reconnection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingDeliveries();
  });
}
