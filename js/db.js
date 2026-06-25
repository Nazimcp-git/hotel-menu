/* ============================================
   MenuForge — Firebase Realtime DB Wrapper
   Reusable CRUD + listener methods
   ============================================ */

import { database } from '../firebase/firebase.js';
import {
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  off,
  onDisconnect,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
  limitToFirst,
  limitToLast
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

class Database {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Get a reference to a path
   */
  getRef(path) {
    return ref(database, path);
  }

  /**
   * Read data at a path (one-time)
   */
  async get(path) {
    try {
      const snapshot = await get(this.getRef(path));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error(`DB read error at ${path}:`, error);
      throw error;
    }
  }

  /**
   * Write data at a path (overwrite)
   */
  async set(path, data) {
    try {
      await set(this.getRef(path), data);
      return true;
    } catch (error) {
      console.error(`DB write error at ${path}:`, error);
      throw error;
    }
  }

  /**
   * Update specific fields at a path
   */
  async update(path, data) {
    try {
      await update(this.getRef(path), data);
      return true;
    } catch (error) {
      console.error(`DB update error at ${path}:`, error);
      throw error;
    }
  }

  /**
   * Push a new child with auto-generated key
   * Returns the new key
   */
  async push(path, data) {
    try {
      const newRef = push(this.getRef(path));
      await set(newRef, data);
      return newRef.key;
    } catch (error) {
      console.error(`DB push error at ${path}:`, error);
      throw error;
    }
  }

  /**
   * Delete data at a path
   */
  async delete(path) {
    try {
      await remove(this.getRef(path));
      return true;
    } catch (error) {
      console.error(`DB delete error at ${path}:`, error);
      throw error;
    }
  }

  /**
   * Listen for real-time changes at a path
   * Returns an unsubscribe function
   */
  listen(path, callback, errorCallback) {
    const dbRef = this.getRef(path);
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => {
        callback(snapshot.exists() ? snapshot.val() : null, snapshot.key);
      },
      (error) => {
        console.error(`DB listener error at ${path}:`, error);
        if (errorCallback) errorCallback(error);
      }
    );

    // Store listener for cleanup
    const key = path;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push({ ref: dbRef, unsubscribe });

    return () => {
      off(dbRef);
      const listeners = this.listeners.get(key);
      if (listeners) {
        const idx = listeners.findIndex(l => l.ref === dbRef);
        if (idx > -1) listeners.splice(idx, 1);
        if (listeners.length === 0) this.listeners.delete(key);
      }
    };
  }

  /**
   * Remove all listeners for a path
   */
  unlisten(path) {
    const listeners = this.listeners.get(path);
    if (listeners) {
      listeners.forEach(({ ref: dbRef }) => off(dbRef));
      this.listeners.delete(path);
    }
  }

  /**
   * Remove ALL listeners
   */
  unlistenAll() {
    for (const [path, listeners] of this.listeners) {
      listeners.forEach(({ ref: dbRef }) => off(dbRef));
    }
    this.listeners.clear();
  }

  /**
   * Set up onDisconnect cleanup (for presence)
   */
  onDisconnectRemove(path) {
    const dbRef = this.getRef(path);
    onDisconnect(dbRef).remove();
  }

  onDisconnectSet(path, value) {
    const dbRef = this.getRef(path);
    onDisconnect(dbRef).set(value);
  }

  /**
   * Get server timestamp value
   */
  timestamp() {
    return serverTimestamp();
  }

  /**
   * Query data with ordering and filtering
   */
  async query(path, { orderBy, equalToVal, limitFirst, limitLast } = {}) {
    try {
      let dbQuery = this.getRef(path);
      const constraints = [];

      if (orderBy) {
        dbQuery = query(dbQuery, orderByChild(orderBy));
      }
      if (equalToVal !== undefined) {
        dbQuery = query(dbQuery, equalTo(equalToVal));
      }
      if (limitFirst) {
        dbQuery = query(dbQuery, limitToFirst(limitFirst));
      }
      if (limitLast) {
        dbQuery = query(dbQuery, limitToLast(limitLast));
      }

      const snapshot = await get(dbQuery);
      if (!snapshot.exists()) return null;

      const result = [];
      snapshot.forEach(child => {
        result.push({ id: child.key, ...child.val() });
      });
      return result;
    } catch (error) {
      console.error(`DB query error at ${path}:`, error);
      throw error;
    }
  }

  /**
   * Convert Firebase object to array with IDs
   */
  static toArray(obj) {
    if (!obj) return [];
    return Object.entries(obj).map(([id, data]) => ({
      id,
      ...(typeof data === 'object' ? data : { value: data })
    }));
  }

  /**
   * Generate a new push key without writing
   */
  newKey(path) {
    return push(this.getRef(path)).key;
  }
}

// Singleton instance
const db = new Database();
export default db;
export { Database };
