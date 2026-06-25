/* ============================================
   MenuForge — Dashboard Menus Module
   Menu list, search, filter, sort, CRUD
   ============================================ */

import db from '../db.js';
import authManager from '../auth.js';
import { state, toast, confirm, navigateTo } from '../app.js';
import { shortId, slugify, debounce, $, $$ } from '../utils/helpers.js';
import { formatRelativeTime } from '../utils/formatters.js';
import { t } from '../utils/i18n.js';

class MenusManager {
  constructor() {
    this.menus = [];
    this.filteredMenus = [];
    this.folders = [];
    this.selectedMenus = new Set();
    this.currentFilter = { category: 'all', status: 'all', folder: 'all' };
    this.currentSort = 'updatedAt';
    this.searchQuery = '';
    this.unsubscribe = null;
  }

  /**
   * Initialize: load menus from Firebase
   */
  async init() {
    const hotelId = state.get('currentHotelId');
    if (!hotelId) return;

    // Listen for real-time menu changes
    this.unsubscribe = db.listen(
      `hotels/${hotelId}/menus`,
      (data) => {
        this.menus = data ? Object.entries(data).map(([id, menu]) => ({
          id,
          ...menu.meta,
          design: menu.design,
          sectionCount: menu.sections ? Object.keys(menu.sections).length : 0,
          itemCount: menu.sections ? Object.values(menu.sections).reduce((sum, s) =>
            sum + (s.items ? Object.keys(s.items).length : 0), 0) : 0
        })) : [];

        this.applyFilters();
        this.render();
      }
    );

    // Load folders
    const folders = await db.get(`hotels/${hotelId}/folders`);
    this.folders = folders ? Object.entries(folders).map(([id, f]) => ({ id, ...f })) : [];
    this.renderFolders();
  }

  /**
   * Create a new menu
   */
  async createMenu({ name, category, language, currency, theme }) {
    const hotelId = state.get('currentHotelId');
    const user = authManager.getUser();
    if (!hotelId || !user) return null;

    const menuData = {
      meta: {
        name: name || 'Untitled Menu',
        slug: slugify(name || 'untitled-menu'),
        category: category || 'dinner',
        status: 'draft',
        languages: [language || 'en'],
        primaryLanguage: language || 'en',
        currency: currency || 'USD',
        pageSize: 'A4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: user.uid,
        publishedAt: null,
        scanCount: 0,
        viewCount: 0,
        folderId: null
      },
      design: {
        theme: theme || 'luxe-noir',
        custom: {
          colors: {
            primary: '#1A1A1A',
            secondary: '#C9A96E',
            accent: '#C9A96E',
            background: '#FFFFFF',
            text: '#1A1A1A'
          },
          fonts: {
            heading: 'Playfair Display',
            body: 'Lato',
            accent: 'Cormorant Garamond'
          },
          spacing: {
            pageMarginTop: 20,
            pageMarginRight: 15,
            pageMarginBottom: 20,
            pageMarginLeft: 15,
            sectionGap: 24,
            itemGap: 12
          },
          borders: {
            style: 'thin',
            weight: 1,
            dividerStyle: 'line'
          }
        }
      },
      sections: {}
    };

    try {
      const menuId = await db.push(`hotels/${hotelId}/menus`, menuData);
      toast.success(t('toast.menuCreated'));
      return menuId;
    } catch (error) {
      toast.error('Failed to create menu: ' + error.message);
      return null;
    }
  }

  /**
   * Delete a menu
   */
  async deleteMenu(menuId) {
    const confirmed = await confirm(t('confirm.deleteMenu'), {
      title: 'Delete Menu',
      confirmText: 'Delete',
      danger: true
    });
    if (!confirmed) return;

    const hotelId = state.get('currentHotelId');
    try {
      await db.delete(`hotels/${hotelId}/menus/${menuId}`);
      toast.success(t('toast.menuDeleted'));
    } catch (error) {
      toast.error('Failed to delete menu');
    }
  }

  /**
   * Duplicate a menu
   */
  async duplicateMenu(menuId) {
    const hotelId = state.get('currentHotelId');
    try {
      const menuData = await db.get(`hotels/${hotelId}/menus/${menuId}`);
      if (!menuData) return;

      menuData.meta.name += ' (Copy)';
      menuData.meta.slug += '-copy';
      menuData.meta.status = 'draft';
      menuData.meta.createdAt = Date.now();
      menuData.meta.updatedAt = Date.now();
      menuData.meta.publishedAt = null;
      menuData.meta.scanCount = 0;
      menuData.meta.viewCount = 0;

      const newId = await db.push(`hotels/${hotelId}/menus`, menuData);
      toast.success(t('toast.menuDuplicated'));
      return newId;
    } catch (error) {
      toast.error('Failed to duplicate menu');
    }
  }

  /**
   * Update menu status
   */
  async updateStatus(menuId, status) {
    const hotelId = state.get('currentHotelId');
    const updates = { status, updatedAt: Date.now() };
    if (status === 'active') updates.publishedAt = Date.now();
    try {
      await db.update(`hotels/${hotelId}/menus/${menuId}/meta`, updates);
      toast.success(status === 'active' ? t('toast.menuPublished') : `Menu ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  }

  /**
   * Search, filter, sort
   */
  applyFilters() {
    let result = [...this.menus];

    // Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (this.currentFilter.category !== 'all') {
      result = result.filter(m => m.category === this.currentFilter.category);
    }

    // Filter by status
    if (this.currentFilter.status !== 'all') {
      result = result.filter(m => m.status === this.currentFilter.status);
    }

    // Filter by folder
    if (this.currentFilter.folder !== 'all') {
      const folder = this.folders.find(f => f.id === this.currentFilter.folder);
      if (folder?.menuIds) {
        result = result.filter(m => folder.menuIds.includes(m.id));
      }
    }

    // Sort
    result.sort((a, b) => {
      switch (this.currentSort) {
        case 'name': return (a.name || '').localeCompare(b.name || '');
        case 'createdAt': return (b.createdAt || 0) - (a.createdAt || 0);
        case 'scanCount': return (b.scanCount || 0) - (a.scanCount || 0);
        default: return (b.updatedAt || 0) - (a.updatedAt || 0);
      }
    });

    this.filteredMenus = result;
  }

  /**
   * Render menu cards grid
   */
  render() {
    const grid = document.getElementById('menus-grid');
    if (!grid) return;

    if (this.filteredMenus.length === 0) {
      grid.innerHTML = this.menus.length === 0 ? `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state__icon">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <rect x="10" y="10" width="60" height="60" rx="12" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/>
              <path d="M30 35h20M30 42h20M30 49h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <circle cx="60" cy="60" r="14" fill="var(--accent)" opacity="0.15"/>
              <path d="M56 60h8M60 56v8" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <h3 class="empty-state__title">${t('dashboard.noMenus')}</h3>
          <p class="empty-state__description">${t('dashboard.noMenusDesc')}</p>
          <button class="btn btn--primary btn--lg" id="empty-create-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            ${t('dashboard.createMenu')}
          </button>
        </div>
      ` : `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state__icon">
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
              <circle cx="26" cy="26" r="16" stroke="currentColor" stroke-width="2"/>
              <path d="M38 38l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <h3 class="empty-state__title">${t('common.noResults')}</h3>
          <p class="empty-state__description">Try adjusting your search or filters</p>
        </div>
      `;

      const emptyBtn = grid.querySelector('#empty-create-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', () => this.openCreateWizard());
      return;
    }

    const themeColors = {
      'luxe-noir': ['#1A1A1A', '#C9A96E', '#FFFFFF'],
      'minimalist-tokyo': ['#FFFFFF', '#D4453A', '#1A1A1A'],
      'mediterranean': ['#FDF8F3', '#C4704D', '#7B8F55']
    };

    grid.innerHTML = this.filteredMenus.map(menu => {
      const colors = themeColors[menu.design?.theme] || themeColors['luxe-noir'];
      const statusClass = menu.status || 'draft';

      return `
        <div class="card card--interactive menu-card" data-menu-id="${menu.id}">
          <div class="card__thumbnail" style="background: linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 60%, ${colors[1]} 100%);">
            <div style="text-align:center;padding:20px;">
              <div style="font-family:'Playfair Display',serif;font-size:14px;color:${colors[2]};letter-spacing:0.1em;text-transform:uppercase;opacity:0.8;">${menu.name || 'Untitled'}</div>
              <div style="width:30px;height:1px;background:${colors[1]};margin:8px auto;"></div>
              <div style="font-size:10px;color:${colors[1]};letter-spacing:0.15em;text-transform:uppercase;">${menu.category || 'Menu'}</div>
            </div>
          </div>
          <div class="card__body">
            <div class="flex items-center gap-2 mb-2">
              <span class="card__title flex-1">${menu.name || 'Untitled Menu'}</span>
              <span class="status-pill status-pill--${statusClass}">
                <span class="status-pill__dot"></span>
                ${t('status.' + statusClass)}
              </span>
            </div>
            <div class="card__meta">
              <span>${menu.sectionCount || 0} sections</span>
              <span>·</span>
              <span>${menu.itemCount || 0} items</span>
              <span>·</span>
              <span>${formatRelativeTime(menu.updatedAt || menu.createdAt)}</span>
            </div>
          </div>
          <div class="card__actions">
            <button class="btn btn--ghost btn--sm action-edit" data-id="${menu.id}" title="Edit">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 1.5l2 2L4 12H2v-2l8.5-8.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Edit
            </button>
            <button class="btn btn--ghost btn--sm action-preview" data-id="${menu.id}" title="Preview">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" stroke="currentColor" stroke-width="1.2"/><circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.2"/></svg>
              Preview
            </button>
            <button class="btn btn--ghost btn--sm action-duplicate" data-id="${menu.id}" title="Duplicate">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M10 4V2.5A1.5 1.5 0 008.5 1h-6A1.5 1.5 0 001 2.5v6A1.5 1.5 0 002.5 10H4" stroke="currentColor" stroke-width="1.2"/></svg>
            </button>
            <button class="btn btn--ghost btn--sm action-delete" data-id="${menu.id}" title="Delete" style="color:var(--danger);">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5A.5.5 0 015.5 2h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners
    grid.querySelectorAll('.menu-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card__actions')) return;
        const menuId = card.dataset.menuId;
        navigateTo(`editor.html?id=${menuId}`);
      });
    });

    grid.querySelectorAll('.action-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateTo(`editor.html?id=${btn.dataset.id}`);
      });
    });

    grid.querySelectorAll('.action-preview').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateTo(`preview.html?id=${btn.dataset.id}`);
      });
    });

    grid.querySelectorAll('.action-duplicate').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.duplicateMenu(btn.dataset.id);
      });
    });

    grid.querySelectorAll('.action-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteMenu(btn.dataset.id);
      });
    });
  }

  /**
   * Render quick stats
   */
  renderStats() {
    const total = this.menus.length;
    const active = this.menus.filter(m => m.status === 'active').length;
    const totalScans = this.menus.reduce((sum, m) => sum + (m.scanCount || 0), 0);
    const topMenu = [...this.menus].sort((a, b) => (b.scanCount || 0) - (a.scanCount || 0))[0];

    const stats = document.getElementById('quick-stats');
    if (!stats) return;

    stats.innerHTML = `
      <div class="stat-card">
        <div class="stat-card__icon" style="background: var(--accent-subtle); color: var(--accent);">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <div class="stat-card__info">
          <div class="stat-card__value">${total}</div>
          <div class="stat-card__label">${t('dashboard.totalMenus')}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon" style="background: var(--success-bg); color: var(--success);">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" stroke-width="1.5"/><path d="M7 10l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="stat-card__info">
          <div class="stat-card__value">${active}</div>
          <div class="stat-card__label">${t('dashboard.activeMenus')}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon" style="background: var(--warning-bg); color: var(--warning);">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 7h2v2H7zM11 7h2v2h-2zM7 11h2v2H7zM11 11h2v2h-2z" fill="currentColor"/></svg>
        </div>
        <div class="stat-card__info">
          <div class="stat-card__value">${totalScans}</div>
          <div class="stat-card__label">${t('dashboard.totalScans')}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon" style="background: var(--info-bg); color: var(--info);">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.09 6.26L18 9.27l-4.91 3.82L14.18 20 10 16.27 5.82 20l1.09-6.91L2 9.27l5.91-1.01L10 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </div>
        <div class="stat-card__info">
          <div class="stat-card__value truncate">${topMenu ? topMenu.name : '—'}</div>
          <div class="stat-card__label">${t('dashboard.topMenu')}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render folders sidebar
   */
  renderFolders() {
    const container = document.getElementById('folders-list');
    if (!container) return;

    container.innerHTML = `
      <button class="folder-item ${this.currentFilter.folder === 'all' ? 'folder-item--active' : ''}" data-folder="all">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        ${t('dashboard.allMenus')}
        <span class="folder-item__count">${this.menus.length}</span>
      </button>
      ${this.folders.map(f => `
        <button class="folder-item ${this.currentFilter.folder === f.id ? 'folder-item--active' : ''}" data-folder="${f.id}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h4l2 2h6v7H2V4z" stroke="${f.color || 'currentColor'}" stroke-width="1.5" stroke-linejoin="round"/></svg>
          ${f.name}
          <span class="folder-item__count">${f.menuIds ? f.menuIds.length : 0}</span>
        </button>
      `).join('')}
    `;

    container.querySelectorAll('.folder-item').forEach(item => {
      item.addEventListener('click', () => {
        this.currentFilter.folder = item.dataset.folder;
        this.applyFilters();
        this.render();
        this.renderFolders();
      });
    });
  }

  /**
   * Open create menu wizard
   */
  openCreateWizard() {
    const modal = document.getElementById('create-wizard');
    if (modal) modal.classList.add('modal-overlay--visible');
  }

  /**
   * Bind UI events
   */
  bindEvents() {
    // Search
    const searchInput = document.getElementById('search-menus');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        this.searchQuery = e.target.value;
        this.applyFilters();
        this.render();
      }, 200));
    }

    // Filter: category
    const categoryFilter = document.getElementById('filter-category');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.currentFilter.category = e.target.value;
        this.applyFilters();
        this.render();
      });
    }

    // Filter: status
    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentFilter.status = e.target.value;
        this.applyFilters();
        this.render();
      });
    }

    // Sort
    const sortSelect = document.getElementById('sort-menus');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.applyFilters();
        this.render();
      });
    }

    // Create button
    const createBtn = document.getElementById('create-menu-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.openCreateWizard());
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }
}

export default MenusManager;
export { MenusManager };
