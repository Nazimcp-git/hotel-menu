/* ============================================
   MenuForge — History Manager (Undo/Redo)
   50-step undo/redo stack with state snapshots
   ============================================ */

import { deepClone } from '../utils/helpers.js';

class HistoryManager {
  constructor() {
    this.stack = [];
    this.pointer = -1;
    this.maxSize = 50;
    this.onChangeCallbacks = [];
  }

  /**
   * Push a new state snapshot onto the stack
   */
  push(snapshot) {
    // Remove any "future" states after current pointer
    this.stack = this.stack.slice(0, this.pointer + 1);

    // Push new snapshot
    this.stack.push(deepClone(snapshot));

    // Trim if over max size
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }

    this.pointer = this.stack.length - 1;
    this.updateUI();
    this.notifyChange();
  }

  /**
   * Undo — go back one step
   */
  undo() {
    if (!this.canUndo()) return null;
    this.pointer--;
    this.updateUI();
    this.notifyChange();
    return deepClone(this.stack[this.pointer]);
  }

  /**
   * Redo — go forward one step
   */
  redo() {
    if (!this.canRedo()) return null;
    this.pointer++;
    this.updateUI();
    this.notifyChange();
    return deepClone(this.stack[this.pointer]);
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.pointer > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.pointer < this.stack.length - 1;
  }

  /**
   * Get current state
   */
  current() {
    if (this.pointer < 0 || this.pointer >= this.stack.length) return null;
    return deepClone(this.stack[this.pointer]);
  }

  /**
   * Clear all history
   */
  clear() {
    this.stack = [];
    this.pointer = -1;
    this.updateUI();
  }

  /**
   * Update undo/redo button states
   */
  updateUI() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !this.canUndo();
    if (redoBtn) redoBtn.disabled = !this.canRedo();
  }

  /**
   * Register a change callback
   */
  onChange(callback) {
    this.onChangeCallbacks.push(callback);
    return () => {
      this.onChangeCallbacks = this.onChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  notifyChange() {
    this.onChangeCallbacks.forEach(cb => cb({
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      position: this.pointer,
      total: this.stack.length
    }));
  }
}

export default HistoryManager;
export { HistoryManager };
