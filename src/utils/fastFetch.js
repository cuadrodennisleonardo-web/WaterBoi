import { 
  getDocs, 
  getDocsFromCache, 
  getDoc, 
  getDocFromCache 
} from 'firebase/firestore';

/**
 * Fast, non-blocking Firestore document reader.
 * - When offline: Immediately reads from IndexedDB cache (0-2ms latency).
 * - When online: Fetches from server with an aggressive short timeout (1200ms)
 *   falling back immediately to local cache if network hangs.
 */
export async function fastGetDocs(queryOrRef, timeoutMs = 1200) {
  // If offline, read directly from local cache with 0 network delay
  if (!navigator.onLine) {
    try {
      const snap = await getDocsFromCache(queryOrRef);
      return snap;
    } catch (e) {
      return { docs: [], empty: true, forEach: () => {} };
    }
  }

  // When online, race network with short timeout
  try {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    });

    const snap = await Promise.race([
      getDocs(queryOrRef),
      timeoutPromise
    ]);
    clearTimeout(timer);
    return snap;
  } catch (err) {
    // Network timed out or failed, load from local cache instantly
    try {
      return await getDocsFromCache(queryOrRef);
    } catch (cacheErr) {
      return { docs: [], empty: true, forEach: () => {} };
    }
  }
}

/**
 * Fast, non-blocking single document reader.
 */
export async function fastGetDoc(docRef, timeoutMs = 1200) {
  if (!navigator.onLine) {
    try {
      const snap = await getDocFromCache(docRef);
      return snap;
    } catch (e) {
      return { exists: () => false, data: () => null, id: docRef.id };
    }
  }

  try {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    });

    const snap = await Promise.race([
      getDoc(docRef),
      timeoutPromise
    ]);
    clearTimeout(timer);
    return snap;
  } catch (err) {
    try {
      return await getDocFromCache(docRef);
    } catch (cacheErr) {
      return { exists: () => false, data: () => null, id: docRef.id };
    }
  }
}
