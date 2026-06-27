/* ============================================
   MenuForge — App Core
   Initialization, routing, global state, toasts
   ============================================ */

import authManager from './auth.js';
import db from './db.js';
import { initI18n, t, translatePage } from './utils/i18n.js';
import { localStore } from './utils/helpers.js';

/* ── Global State ── */
class AppState {
  constructor() {
    this._state = {
      user: null,
      currentHotelId: null,
      currentHotel: null,
      currentMenuId: null,
      currentMenu: null,
      theme: this._detectTheme(),
      language: 'en'
    };
    this._listeners = new Map();
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    const old = this._state[key];
    this._state[key] = value;
    if (old !== value) {
      this._notify(key, value, old);
    }
  }

  subscribe(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);
    return () => this._listeners.get(key)?.delete(callback);
  }

  _notify(key, value, old) {
    this._listeners.get(key)?.forEach(cb => cb(value, old));
  }

  _detectTheme() {
    const stored = localStore('theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}

const state = new AppState();

/* ── Toast Notification System ── */
class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = [];
    this.maxVisible = 5;
    this.counter = 0;
  }

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.className = 'toast-container';
    this.container.setAttribute('role', 'status');
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);
  }

  _create(type, message, options = {}) {
    this.init();
    const id = `toast-${++this.counter}`;
    const { duration = 4000, persistent = false } = options;

    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');

    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 18a8 8 0 100-16 8 8 0 000 16z" fill="currentColor" opacity="0.15"/><path d="M7 10l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 18a8 8 0 100-16 8 8 0 000 16z" fill="currentColor" opacity="0.15"/><path d="M13 7l-6 6M7 7l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 18a8 8 0 100-16 8 8 0 000 16z" fill="currentColor" opacity="0.15"/><path d="M10 7v4M10 13h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 18a8 8 0 100-16 8 8 0 000 16z" fill="currentColor" opacity="0.15"/><path d="M10 9v4M10 7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      loading: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="toast-spinner"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" stroke-dasharray="30 15" stroke-linecap="round"/></svg>'
    };

    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || icons.info}</span>
      <span class="toast__message">${message}</span>
      ${!persistent ? '<button class="toast__close" aria-label="Dismiss">&times;</button>' : ''}
    `;

    // Close button
    const closeBtn = toast.querySelector('.toast__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.dismiss(id));
    }

    // Add to container
    this.container.appendChild(toast);
    this.toasts.push({ id, element: toast });

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    // Auto dismiss (except loading and persistent)
    if (type !== 'loading' && !persistent) {
      setTimeout(() => this.dismiss(id), duration);
    }

    // Limit visible toasts
    while (this.toasts.length > this.maxVisible) {
      const oldest = this.toasts.shift();
      oldest.element.remove();
    }

    return id;
  }

  success(message, options) { return this._create('success', message, options); }
  error(message, options) { return this._create('error', message, { duration: 6000, ...options }); }
  warning(message, options) { return this._create('warning', message, { duration: 5000, ...options }); }
  info(message, options) { return this._create('info', message, options); }
  loading(message, options) { return this._create('loading', message, { persistent: true, ...options }); }

  dismiss(id) {
    const idx = this.toasts.findIndex(t => t.id === id);
    if (idx === -1) return;

    const toast = this.toasts[idx];
    toast.element.classList.remove('toast--visible');
    toast.element.classList.add('toast--exiting');

    setTimeout(() => {
      toast.element.remove();
      this.toasts.splice(idx, 1);
    }, 300);
  }

  dismissAll() {
    [...this.toasts].forEach(t => this.dismiss(t.id));
  }
}

const toast = new ToastManager();

/* ── Theme Manager ── */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.set('theme', theme);
  localStore('theme', theme);
}

function toggleTheme() {
  const current = state.get('theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/* ── Navigation & Auth Guards ── */
function getPage() {
  const path = window.location.pathname;
  const file = path.split('/').pop() || 'index.html';
  return file.replace('.html', '');
}

function navigateTo(page) {
  window.location.href = page;
}

function requireAuth() {
  if (!authManager.isAuthenticated()) {
    navigateTo('login.html');
    return false;
  }
  return true;
}

function redirectIfAuth() {
  if (authManager.isAuthenticated()) {
    navigateTo('dashboard.html');
    return true;
  }
  return false;
}

/* ── Top Navigation ── */
function renderTopNav(options = {}) {
  const { showPropertySwitcher = false, showBackButton = false, backHref = 'dashboard.html' } = options;
  const user = authManager.getUser();
  const userData = state.get('userData');
  const hasPremium = userData?.subscription?.plan === 'premium' || (userData?.createdAt && userData.createdAt < 1782374400000);

  const nav = document.getElementById('top-nav');
  if (!nav) return;

  nav.innerHTML = `
    <div class="nav-left">
      ${showBackButton ? `
        <a href="${backHref}" class="nav-back-btn" aria-label="Back to dashboard">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
      ` : ''}
      <a href="dashboard.html" class="nav-logo" aria-label="MenuForge Home">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="7" fill="var(--accent)"/>
          <path d="M7 9h14M7 14h14M7 19h10" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="nav-logo-text">MenuForge</span>
      </a>
    </div>

    <div class="nav-center" id="nav-center"></div>

    <div class="nav-right">
      <button class="nav-icon-btn" id="theme-toggle" aria-label="Toggle theme" title="Toggle dark mode">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" class="icon-sun"><circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="2"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" class="icon-moon"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>

      ${user ? `
        <div class="nav-user-menu" id="user-menu">
          <button class="nav-user-btn" id="user-menu-btn" aria-expanded="false" aria-haspopup="true">
            ${user.photoURL
              ? `<img src="${user.photoURL}" alt="${user.displayName}" class="nav-avatar" />`
              : `<div class="nav-avatar nav-avatar--initials">${(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</div>`
            }
            <span class="nav-user-name" style="display: inline-flex; align-items: center;">
              ${user.displayName || user.email?.split('@')[0] || 'User'}
              ${hasPremium ? `
                <span class="premium-badge" style="
                  background: linear-gradient(135deg, #F59E0B, #C9A96E);
                  color: #0f172a;
                  font-size: 10px;
                  font-weight: 800;
                  padding: 2px 6px;
                  border-radius: 99px;
                  margin-left: 6px;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  box-shadow: 0 0 8px rgba(201, 169, 110, 0.3);
                  display: inline-flex;
                  align-items: center;
                ">✦ Premium</span>
              ` : ''}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="nav-dropdown" id="user-dropdown" role="menu" hidden>
            <a href="settings.html" class="nav-dropdown-item" role="menuitem">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.5"/><path d="M13.6 10a1.2 1.2 0 00.24 1.32l.04.04a1.457 1.457 0 11-2.06 2.06l-.04-.04A1.2 1.2 0 0010 13.6v.08A1.46 1.46 0 018.54 15h-.08A1.46 1.46 0 017 13.54v-.04A1.2 1.2 0 005.68 12.18l-.04.04a1.457 1.457 0 11-2.06-2.06l.04-.04A1.2 1.2 0 002.4 10h-.08A1.46 1.46 0 011 8.54v-.08A1.46 1.46 0 012.46 7h.04A1.2 1.2 0 003.82 5.68l-.04-.04a1.457 1.457 0 112.06-2.06l.04.04A1.2 1.2 0 007 2.4v-.08A1.46 1.46 0 018.46 1h.08A1.46 1.46 0 0110 2.46v.04a1.2 1.2 0 001.32 .72l.04-.04a1.457 1.457 0 112.06 2.06l-.04.04a1.2 1.2 0 00.22 1.32v.08A1.46 1.46 0 0115 8.46v.08a1.46 1.46 0 01-1.46 1.46h-.04" stroke="currentColor" stroke-width="1.2"/></svg>
              Settings
            </a>
            <div class="nav-dropdown-divider"></div>
            <button class="nav-dropdown-item nav-dropdown-item--danger" role="menuitem" id="btn-logout">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 14H3.33A1.33 1.33 0 012 12.67V3.33A1.33 1.33 0 013.33 2H6M10.67 11.33L14 8l-3.33-3.33M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Sign Out
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  // User menu dropdown
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !userDropdown.hidden;
      userDropdown.hidden = isOpen;
      userMenuBtn.setAttribute('aria-expanded', !isOpen);
    });

    document.addEventListener('click', () => {
      userDropdown.hidden = true;
      userMenuBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // Logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const result = await authManager.logout();
      if (result.success) {
        navigateTo('index.html');
      } else {
        toast.error(result.error);
      }
    });
  }
}

/* ── Confirmation Dialog ── */
function confirm(message, options = {}) {
  return new Promise((resolve) => {
    const { title = 'Confirm', confirmText = 'Delete', cancelText = 'Cancel', danger = true } = options;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--visible';
    overlay.innerHTML = `
      <div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="modal__header">
          <h3 id="confirm-title" class="modal__title">${title}</h3>
        </div>
        <div class="modal__body">
          <p class="modal__text">${message}</p>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="confirm-cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" id="confirm-ok">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.classList.remove('modal-overlay--visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    overlay.querySelector('#confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('#confirm-ok').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    // Focus the cancel button by default (safer)
    overlay.querySelector('#confirm-cancel').focus();

    // Escape key
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        cleanup(false);
        document.removeEventListener('keydown', onEsc);
      }
    };
    document.addEventListener('keydown', onEsc);
  });
}

/* ── Share & Publish Modal ── */
async function showShareModal(menuId) {
  const hotelId = state.get('currentHotelId');
  if (!hotelId) return;

  const { default: QRGenerator } = await import('./preview/qr.js');

  // Load current menu data
  const menuData = await db.get(`hotels/${hotelId}/menus/${menuId}`);
  if (!menuData) {
    toast.error('Menu data not found');
    return;
  }
  const hotelInfo = await db.get(`hotels/${hotelId}/info`) || {};
  const subdomain = hotelInfo.subdomain || '';

  const isPublished = menuData.meta?.status === 'active';
  const shareUrl = buildShareUrl(menuId, subdomain);
  const portalUrl = buildPortalUrl(hotelId, subdomain);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay modal-overlay--visible';
  overlay.style.zIndex = '9999';

  overlay.innerHTML = `
    <div class="modal modal--md" role="dialog" aria-modal="true" aria-labelledby="share-title" style="max-width: 500px;">
      <div class="modal__header">
        <h3 id="share-title" class="modal__title">Share & Publish</h3>
        <button class="modal__close" id="share-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal__body" style="display:flex; flex-direction:column; gap: var(--space-5); padding: var(--space-6);">
        
        <!-- Publish Toggle -->
        <div style="background:var(--panel-bg-hover); border:1px solid var(--border); border-radius:var(--radius-lg); padding:var(--space-4); display:flex; align-items:center; justify-content:space-between; gap:var(--space-4);">
          <div>
            <div style="font-size:var(--text-sm); font-weight:var(--weight-bold); color:var(--text-primary);" id="publish-status-label">
              ${isPublished ? '✦ Menu is Live' : 'Menu is Draft'}
            </div>
            <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:2px;" id="publish-status-desc">
              ${isPublished ? 'Anyone with the link or QR can view this menu.' : 'Only logged-in users can view this menu.'}
            </div>
          </div>
          <label class="toggle" style="flex-shrink:0;">
            <input type="checkbox" class="toggle__input" id="publish-toggle" ${isPublished ? 'checked' : ''}>
            <span class="toggle__slider"></span>
          </label>
        </div>

        <!-- Share Link Box -->
        <div style="display:flex; flex-direction:column; gap:var(--space-1-5);">
          <label class="prop-label">Guest Share Link</label>
          <div style="display:flex; gap:var(--space-2);">
            <input type="text" class="input" id="share-link-input" readonly value="${shareUrl}" style="font-size:var(--text-xs); background:var(--app-bg-subtle);">
            <button class="btn btn--secondary btn--sm" id="btn-modal-copy" style="height:38px; display:flex; align-items:center; gap:var(--space-1); min-width: 80px;">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5A1.5 1.5 0 009 2H3.5A1.5 1.5 0 002 3.5v5.5A1.5 1.5 0 003.5 10.5h2"/></svg>
              <span>Copy</span>
            </button>
            <a href="${shareUrl}" target="_blank" class="btn btn--primary btn--sm" style="height:38px; display:inline-flex; align-items:center; justify-content:center; gap:var(--space-1); text-decoration:none;">
              Open
            </a>
          </div>
        </div>

        <!-- Unified Property Portal -->
        <div style="background:rgba(201, 169, 110, 0.08); border:1px dashed var(--accent); border-radius:var(--radius-lg); padding:var(--space-3); display:flex; flex-direction:column; gap:var(--space-2);">
          <div style="font-size:var(--text-xs); font-weight:var(--weight-bold); color:var(--accent); display:flex; align-items:center; gap:4px;">
            🏠 Unified Property Portal
          </div>
          <div style="font-size:var(--text-2xs); color:var(--text-secondary);">
            A single link showing all active menus for your restaurant. Perfect for table QR codes!
          </div>
          <div style="display:flex; gap:var(--space-2); margin-top:2px;">
            <input type="text" class="input" id="portal-link-input" readonly value="${portalUrl}" style="font-size:var(--text-xs); background:var(--app-bg-subtle); flex:1;">
            <button class="btn btn--secondary btn--sm" id="btn-portal-copy" style="height:34px; padding: 0 12px; min-width: 60px;">
              Copy
            </button>
            <a href="${portalUrl}" target="_blank" class="btn btn--primary btn--sm" style="height:34px; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; padding: 0 12px;">
              Open
            </a>
          </div>
        </div>

        <!-- QR Code Section -->
        <div style="display:grid; grid-template-columns:140px 1fr; gap:var(--space-5); align-items:center; border-top:1px solid var(--border); padding-top:var(--space-4);">
          <div id="modal-qr-canvas-container" style="background:white; border:1px solid var(--border); border-radius:var(--radius-md); padding:var(--space-2); display:flex; align-items:center; justify-content:center; aspect-ratio:1;">
            <!-- QR code rendered here -->
          </div>
          <div style="display:flex; flex-direction:column; gap:var(--space-3);">
            <div style="font-size:var(--text-sm); font-weight:var(--weight-semibold); color:var(--text-primary);">QR Code Settings</div>
            
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <label style="font-size:var(--text-xs); color:var(--text-secondary); width:80px;">Color:</label>
              <input type="color" class="input" id="qr-color-dark" value="#1A1A1A" style="width:50px; padding:2px; height:28px; cursor:pointer; border:none; background:transparent;">
            </div>

            <div style="display:flex; gap:var(--space-2); margin-top:4px;">
              <button class="btn btn--secondary btn--sm flex-1" id="btn-modal-download-png" style="font-size:var(--text-2xs); padding:var(--space-1-5) var(--space-2);">
                PNG
              </button>
              <button class="btn btn--secondary btn--sm flex-1" id="btn-modal-download-svg" style="font-size:var(--text-2xs); padding:var(--space-1-5) var(--space-2);">
                SVG
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const qrContainer = overlay.querySelector('#modal-qr-canvas-container');
  const colorDarkInput = overlay.querySelector('#qr-color-dark');
  const publishToggle = overlay.querySelector('#publish-toggle');
  const statusLabel = overlay.querySelector('#publish-status-label');
  const statusDesc = overlay.querySelector('#publish-status-desc');

  const regenerateQR = async () => {
    qrContainer.innerHTML = '<div style="font-size:10px; color:var(--text-muted);">Generating...</div>';
    const colorDark = colorDarkInput.value;
    
    // Draw QR Code
    await QRGenerator.renderTo(qrContainer, shareUrl, {
      size: 120,
      colorDark,
      colorLight: '#FFFFFF',
      logoUrl: state.get('currentHotel')?.logo || null
    });
  };

  // Initial QR generation
  await regenerateQR();

  // Color change triggers reload
  colorDarkInput.addEventListener('change', regenerateQR);

  // Toggle publish state
  publishToggle.addEventListener('change', async () => {
    const active = publishToggle.checked;
    statusLabel.textContent = active ? '✦ Menu is Live' : 'Menu is Draft';
    statusDesc.textContent = active ? 'Anyone with the link or QR can view this menu.' : 'Only logged-in users can view this menu.';

    try {
      await db.update(`hotels/${hotelId}/menus/${menuId}/meta`, {
        status: active ? 'active' : 'draft',
        publishedAt: active ? Date.now() : null,
        hotelId: hotelId
      });

      if (active) {
        // Fetch fresh copy to publish to publicMenus
        const freshMenuData = await db.get(`hotels/${hotelId}/menus/${menuId}`);
        if (freshMenuData) {
          if (!freshMenuData.meta) freshMenuData.meta = {};
          freshMenuData.meta.hotelId = hotelId;
        }
        await db.set(`publicMenus/${menuId}`, freshMenuData);
        await updateHotelPublicPortal(hotelId);
        toast.success('Menu published successfully');
      } else {
        await db.delete(`publicMenus/${menuId}`);
        await updateHotelPublicPortal(hotelId);
        toast.success('Menu unpublished');
      }
    } catch (err) {
      toast.error('Failed to update publish state: ' + err.message);
      publishToggle.checked = !active; // revert
    }
  });

  // Copy button
  const copyBtn = overlay.querySelector('#btn-modal-copy');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--success)" stroke-width="1.5"><path d="M4.5 8.5l2.5 2.5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Copied</span>
      `;
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.5A1.5 1.5 0 009 2H3.5A1.5 1.5 0 002 3.5v5.5A1.5 1.5 0 003.5 10.5h2"/></svg>
          <span>Copy</span>
        `;
      }, 2000);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  });

  // Portal copy button
  const portalCopyBtn = overlay.querySelector('#btn-portal-copy');
  portalCopyBtn?.addEventListener('click', async () => {
    try {
      const portalUrl = overlay.querySelector('#portal-link-input').value;
      await navigator.clipboard.writeText(portalUrl);
      portalCopyBtn.innerHTML = `<span>Copied</span>`;
      setTimeout(() => {
        portalCopyBtn.innerHTML = `<span>Copy</span>`;
      }, 2000);
      toast.success('Portal link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  });

  // Download PNG
  overlay.querySelector('#btn-modal-download-png').addEventListener('click', () => {
    QRGenerator.download(shareUrl, `${menuData.meta?.name || 'menu'}-qr.png`, {
      colorDark: colorDarkInput.value,
      logoUrl: state.get('currentHotel')?.logo || null
    });
  });

  // Download SVG
  overlay.querySelector('#btn-modal-download-svg').addEventListener('click', async () => {
    const svgStr = await QRGenerator.generateSVG(shareUrl, {
      colorDark: colorDarkInput.value
    });
    if (svgStr) {
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${menuData.meta?.name || 'menu'}-qr.svg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('SVG QR code downloaded');
    }
  });

  // Close helper
  const close = () => {
    overlay.classList.remove('modal-overlay--visible');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('#share-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// Update public hotel menu portal compilation
async function updateHotelPublicPortal(hotelId) {
  try {
    const menus = await db.get(`hotels/${hotelId}/menus`) || {};
    const hotelInfo = await db.get(`hotels/${hotelId}/info`) || {};
    
    const activeMenus = Object.entries(menus)
      .filter(([, menu]) => menu.meta?.status === 'active')
      .map(([id, menu]) => ({
        id,
        name: menu.meta.name,
        category: menu.meta.category,
        languages: menu.meta.languages,
        primaryLanguage: menu.meta.primaryLanguage,
        currency: menu.meta.currency
      }));
      
    if (activeMenus.length > 0) {
      await db.set(`publicMenus/hotel_${hotelId}`, {
        hotelName: hotelInfo.name || 'Our Property',
        hotelLogo: hotelInfo.logo || null,
        hotelAddress: hotelInfo.address || '',
        subdomain: hotelInfo.subdomain || '',
        menus: activeMenus
      });
    } else {
      await db.delete(`publicMenus/hotel_${hotelId}`);
    }
  } catch (err) {
    console.error('Failed to update public hotel portal:', err);
  }
}

/* ── App Initialization ── */
async function initApp(options = {}) {
  const { requiresAuth = true, onReady } = options;

  // Apply saved theme
  setTheme(state.get('theme'));

  // Initialize i18n
  const savedLang = localStore('language') || 'en';
  initI18n(savedLang);

  // Initialize auth
  const user = await authManager.init();

  if (requiresAuth && !user) {
    navigateTo('login.html');
    return;
  }

  if (!requiresAuth && user) {
    const page = getPage();
    if (page === 'index') {
      navigateTo('dashboard.html');
      return;
    }
  }

  // Set user in state
  if (user) {
    state.set('user', user);

    // Load user's current hotel
    const userData = await db.get(`users/${user.uid}`);
    state.set('userData', userData);

    // Check Premium subscription gate
    const PREMIUM_LAUNCH_DATE = 1782374400000; // June 25, 2026
    const isNewUser = userData?.createdAt && userData.createdAt >= PREMIUM_LAUNCH_DATE;
    const hasSubscription = userData?.subscription && userData.subscription.plan === 'premium';
    
    if (isNewUser && !hasSubscription) {
      // Force redirect to landing page to subscribe
      navigateTo('landing.html');
      return;
    }

    const page = getPage();

    if (userData?.defaultHotelId) {
      state.set('currentHotelId', userData.defaultHotelId);
      const hotel = await db.get(`hotels/${userData.defaultHotelId}/info`);
      state.set('currentHotel', hotel);
      // Auto-compile public menus portal list on app load
      updateHotelPublicPortal(userData.defaultHotelId).catch(err => console.error(err));

      if (page === 'onboarding') {
        navigateTo('dashboard.html');
        return;
      }
    } else {
      // If user has no hotel, redirect to onboarding.html unless they are on onboarding or index
      if (page !== 'onboarding' && page !== 'index') {
        navigateTo('onboarding.html');
        return;
      }
    }
  }

  // Translate page
  translatePage();

  // Callback
  if (onReady) {
    await onReady(user);
  }

  // Hide splash screen
  hideSplashScreen();
}

function hideSplashScreen() {
  const splash = document.getElementById('app-splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';
    setTimeout(() => {
      splash.style.visibility = 'hidden';
      splash.remove();
    }, 400);
  }
}
window.hideSplashScreen = hideSplashScreen;

export function buildShareUrl(menuId, subdomain = '') {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const dir = pathname.substring(0, pathname.lastIndexOf('/'));
  
  if (subdomain) {
    let baseDomain = 'menuforgee.vercel.app';
    if (origin.includes('localhost')) {
      return `http://${subdomain}.localhost:5500${dir}/preview.html?id=${menuId}&guest=true`;
    }
    return `https://${subdomain}.${baseDomain}${dir}/preview.html?id=${menuId}&guest=true`;
  }
  
  return `${origin}${dir}/preview.html?id=${menuId}&guest=true`;
}

export function buildPortalUrl(hotelId, subdomain = '') {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const dir = pathname.substring(0, pathname.lastIndexOf('/'));
  
  if (subdomain) {
    let baseDomain = 'menuforgee.vercel.app';
    if (origin.includes('localhost')) {
      return `http://${subdomain}.localhost:5500${dir}/preview.html?guest=true`;
    }
    return `https://${subdomain}.${baseDomain}${dir}/preview.html?guest=true`;
  }
  
  return `${origin}${dir}/preview.html?hotelId=${hotelId}&guest=true`;
}

/* ── Exports ── */
export { state, toast, initApp, renderTopNav, setTheme, toggleTheme, navigateTo, requireAuth, confirm, getPage, showShareModal, updateHotelPublicPortal };
export default { state, toast, initApp, renderTopNav, setTheme, toggleTheme, navigateTo, requireAuth, confirm, getPage, showShareModal, updateHotelPublicPortal, buildShareUrl, buildPortalUrl };
