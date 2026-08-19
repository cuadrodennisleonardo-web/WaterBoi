import { db } from '../firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Logs an administrative action to the auditLog collection in Firestore
 */
export async function logAuditAction({ user, action, entity, entityId = '', description, oldValue = null, newValue = null }) {
  try {
    if (!user) return;
    const auditData = {
      userId: user.uid || 'system',
      userName: user.name || user.email || 'Admin',
      action,
      entity,
      entityId,
      description,
      oldValue,
      newValue,
      timestamp: serverTimestamp()
    };
    await addDoc(collection(db, 'auditLog'), auditData);
  } catch (error) {
    console.error('Failed to log audit entry:', error);
  }
}
