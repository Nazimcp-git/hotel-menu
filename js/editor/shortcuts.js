/* ============================================
   MenuForge — Keyboard Shortcuts
   Full keyboard shortcut registry + overlay
   ============================================ */

class ShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this.overlayVisible = false;
    this._handler = this._handleKeydown.bind(this);
  }

  /**
   * Initialize — bind global keydown listener
   */
  init() {
    document.addEventListener('keydown', this._handler);
    this._registerDefaults();
  }

  /**
   * Register a shortcut
   * @param {string} combo - e.g. 'ctrl+s', 'ctrl+shift+z', '?'
   * @param {Function} action - callback
   * @param {string} label - display label for overlay
   */
  register(combo, action, label = '') {
    this.shortcuts.set(combo.toLowerCase(), { action, label, combo });
  }

  /**
   * Unregister a shortcut
   */
  unregister(combo) {
    this.shortcuts.delete(combo.toLowerCase());
  }

  /**
   * Enable/disable shortcuts
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Handle keydown events
   */
  _handleKeydown(e) {
    if (!this.enabled) return;

    // Don't intercept when typing in inputs
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' || target.isContentEditable;

    // Allow certain shortcuts even in inputs
    const combo = this._getCombo(e);

    // ? key for shortcut overlay (only when not in input)
    if (e.key === '?' && !isInput) {
      e.preventDefault();
      this.toggleOverlay();
      return;
    }

    // Escape always works
    if (e.key === 'Escape') {
      if (this.overlayVisible) {
        this.hideOverlay();
        return;
      }
      const esc = this.shortcuts.get('escape');
      if (esc) {
        e.preventDefault();
        esc.action(e);
        return;
      }
    }

    // Skip input-interceptable shortcuts unless they're system shortcuts
    const systemCombos = ['ctrl+s', 'ctrl+z', 'ctrl+shift+z', 'ctrl+p'];
    if (isInput && !systemCombos.includes(combo)) return;

    const shortcut = this.shortcuts.get(combo);
    if (shortcut) {
      e.preventDefault();
      shortcut.action(e);
    }
  }

  /**
   * Build combo string from KeyboardEvent
   */
  _getCombo(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');

    let key = e.key.toLowerCase();
    // Normalize special keys
    if (key === 'backspace') key = 'backspace';
    else if (key === 'delete') key = 'delete';
    else if (key === 'arrowup') key = 'up';
    else if (key === 'arrowdown') key = 'down';
    else if (key === 'arrowleft') key = 'left';
    else if (key === 'arrowright') key = 'right';
    else if (key === '+' || key === '=') key = '+';
    else if (key === '-' || key === '_') key = '-';

    // Don't add modifier keys themselves
    if (!['control', 'meta', 'shift', 'alt'].includes(key)) {
      parts.push(key);
    }

    return parts.join('+');
  }

  /**
   * Register default shortcuts
   */
  _registerDefaults() {
    // These will be overridden by the editor with actual actions
  }

  /**
   * Show shortcut overlay
   */
  toggleOverlay() {
    if (this.overlayVisible) {
      this.hideOverlay();
    } else {
      this.showOverlay();
    }
  }

  showOverlay() {
    let overlay = document.getElementById('shortcuts-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'shortcuts-overlay';
      overlay.className = 'shortcuts-overlay';
      overlay.innerHTML = `
        <div class="shortcuts-panel">
          <h2 class="shortcuts-panel__title">⌨️ Keyboard Shortcuts</h2>
          <div id="shortcuts-list"></div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.hideOverlay();
      });
    }

    // Populate shortcuts
    const list = overlay.querySelector('#shortcuts-list');
    const entries = [...this.shortcuts.entries()]
      .filter(([, { label }]) => label)
      .sort((a, b) => a[1].label.localeCompare(b[1].label));

    list.innerHTML = entries.map(([combo, { label }]) => `
      <div class="shortcut-row">
        <span class="shortcut-row__action">${label}</span>
        <span class="shortcut-row__keys">
          ${this._formatCombo(combo)}
        </span>
      </div>
    `).join('');

    overlay.classList.add('shortcuts-overlay--visible');
    this.overlayVisible = true;
  }

  hideOverlay() {
    const overlay = document.getElementById('shortcuts-overlay');
    if (overlay) {
      overlay.classList.remove('shortcuts-overlay--visible');
    }
    this.overlayVisible = false;
  }

  /**
   * Format combo for display
   */
  _formatCombo(combo) {
    const isMac = navigator.platform.includes('Mac');
    return combo.split('+').map(part => {
      const labels = {
        'ctrl': isMac ? '⌘' : 'Ctrl',
        'shift': isMac ? '⇧' : 'Shift',
        'alt': isMac ? '⌥' : 'Alt',
        'up': '↑', 'down': '↓', 'left': '←', 'right': '→',
        'backspace': '⌫', 'delete': 'Del', 'escape': 'Esc',
        'enter': '↵', '+': '+', '-': '−'
      };
      return `<span class="kbd">${labels[part] || part.toUpperCase()}</span>`;
    }).join('');
  }

  /**
   * Cleanup
   */
  destroy() {
    document.removeEventListener('keydown', this._handler);
  }
}

export default ShortcutManager;
export { ShortcutManager };
