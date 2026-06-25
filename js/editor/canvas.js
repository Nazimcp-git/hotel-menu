/* ============================================
   MenuForge — Canvas Engine
   Live menu rendering, zoom, drag-drop, selection
   ============================================ */

import { state, toast } from '../app.js';
import db from '../db.js';
import { $, $$, throttle, escapeHtml } from '../utils/helpers.js';
import { formatPrice } from '../utils/formatters.js';
import { THEMES } from './design.js';

import { DIETARY_BADGES } from './items.js';

class CanvasEngine {
  constructor(editorState, options = {}) {
    this.editorState = editorState;
    this.container = null;
    this.pageEl = null;
    this.zoom = 100;
    this.selectedSectionId = null;
    this.selectedItemId = null;
    this.showGrid = false;
    this.showSafeArea = false;
    this.pageSize = 'a4';

    this.onSectionSelect = options.onSectionSelect || (() => {});
    this.onItemSelect = options.onItemSelect || (() => {});
    this.onSectionDrop = options.onSectionDrop || (() => {});
    this.onElementDrop = options.onElementDrop || (() => {});

    this.currentMode = 'select'; // 'select' or 'pan'
    this.isPanning = false;
  }

  /**
   * Initialize canvas
   */
  init(containerEl) {
    this.container = containerEl;
    this.render();
  }

  /**
   * Full re-render of the canvas
   */
  render() {
    if (!this.container) return;

    const design = this.editorState.design || {};
    const themeId = design.theme || 'luxe-noir';
    const themeDef = THEMES[themeId];
    const themeClass = themeDef?.cssClass || 'theme-luxe-noir';
    const custom = design.custom || {};
    const spacing = custom.spacing || {};
    const colors = custom.colors || {};
    const fonts = custom.fonts || {};
    const sections = this.editorState.sections || {};
    const lang = this.editorState.primaryLanguage || 'en';
    const currency = this.editorState.currency || 'USD';
    const pageSize = this.editorState.pageSize || 'A4';

    // Sort sections
    const sortedSections = Object.entries(sections)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    const pageSizeClass = {
      'A4': 'canvas-page--a4',
      'A4-landscape': 'canvas-page--a4-landscape',
      'A5': 'canvas-page--a5',
      'Letter': 'canvas-page--letter',
      'Digital': 'canvas-page--digital'
    }[pageSize] || 'canvas-page--a4';

    this.container.innerHTML = `
      <!-- Canvas Toolbar -->
      <div class="canvas-toolbar">
        <div class="canvas-toolbar__group">
          <button class="btn btn--icon btn--sm" id="canvas-zoom-out" aria-label="Zoom out" data-tooltip="Zoom Out">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 7h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <span class="canvas-toolbar__zoom-label" id="zoom-label">${this.zoom}%</span>
          <button class="btn btn--icon btn--sm" id="canvas-zoom-in" aria-label="Zoom in" data-tooltip="Zoom In">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 4v6M4 7h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="btn btn--icon btn--sm" id="canvas-zoom-fit" aria-label="Fit to screen" data-tooltip="Fit">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
        </div>
        <div class="canvas-toolbar__separator"></div>
        <div class="canvas-toolbar__group">
          <select class="input" id="canvas-page-size" style="padding:4px 8px;font-size:11px;width:auto;border:none;background:transparent;" aria-label="Page size">
            <option value="A4" ${pageSize === 'A4' ? 'selected' : ''}>A4 Portrait</option>
            <option value="A4-landscape" ${pageSize === 'A4-landscape' ? 'selected' : ''}>A4 Landscape</option>
            <option value="A5" ${pageSize === 'A5' ? 'selected' : ''}>A5</option>
            <option value="Letter" ${pageSize === 'Letter' ? 'selected' : ''}>Letter</option>
            <option value="Digital" ${pageSize === 'Digital' ? 'selected' : ''}>Digital</option>
          </select>
        </div>
        <div class="canvas-toolbar__separator"></div>
        <div class="canvas-toolbar__group">
          <button class="btn btn--icon btn--sm ${this.showGrid ? 'btn--active' : ''}" id="canvas-toggle-grid" aria-label="Toggle grid" data-tooltip="Grid">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5h10M2 9h10M5 2v10M9 2v10" stroke="currentColor" stroke-width="1" opacity="0.5"/></svg>
          </button>
        </div>
      </div>

      <!-- Canvas Page -->
      <div class="canvas-page ${pageSizeClass}" id="canvas-page"
           style="transform: scale(${this.zoom / 100});
                  --menu-padding-top: ${spacing.pageMarginTop || 20}mm;
                  --menu-padding-right: ${spacing.pageMarginRight || 15}mm;
                  --menu-padding-bottom: ${spacing.pageMarginBottom || 20}mm;
                  --menu-padding-left: ${spacing.pageMarginLeft || 15}mm;">

        ${this.showGrid ? '<div class="canvas-grid canvas-grid--visible"></div>' : ''}

        <div class="menu-preview ${themeClass}" id="menu-preview"
             style="font-family: ${fonts.body || 'Lato'}, sans-serif;
                    color: ${colors.text || '#1A1A1A'};
                    background: ${colors.background || '#FFFFFF'};
                    padding: ${spacing.pageMarginTop || 20}mm ${spacing.pageMarginRight || 15}mm ${spacing.pageMarginBottom || 20}mm ${spacing.pageMarginLeft || 15}mm;
                    --theme-heading-font: ${fonts.heading || 'Playfair Display'}, serif;
                    --theme-body-font: ${fonts.body || 'Lato'}, sans-serif;
                    --theme-primary: ${colors.primary || '#1A1A1A'};
                    --theme-secondary: ${colors.secondary || '#C9A96E'};
                    --theme-accent: ${colors.accent || '#C9A96E'};
                    --theme-bg: ${colors.background || '#FFFFFF'};
                    --theme-text: ${colors.text || '#1A1A1A'};
                    --theme-price-color: ${colors.accent || '#C9A96E'};
                    min-height: 100%;">

          ${sortedSections.length === 0 ? `
            <div class="canvas-empty">
              <div class="canvas-empty__icon">📋</div>
              <div class="canvas-empty__text">Your menu is empty</div>
              <div class="canvas-empty__hint">Drag sections from the left panel or click to add</div>
            </div>
          ` : ''}

          ${sortedSections.map(([sectionId, section]) =>
            this._renderSection(sectionId, section, lang, currency)
          ).join('')}
        </div>
      </div>

      <!-- Floating Toolbar (Bottom Center) -->
      <div class="canvas-modes-toolbar">
        <button class="btn btn--icon btn--sm canvas-mode-btn ${this.currentMode === 'select' ? 'canvas-mode-btn--active' : ''}" data-mode="select" title="Select Tool (V)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>
        </button>
        <button class="btn btn--icon btn--sm canvas-mode-btn ${this.currentMode === 'pan' ? 'canvas-mode-btn--active' : ''}" data-mode="pan" title="Hand Tool (H)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v5m0-5V5a2 2 0 00-2-2v0a2 2 0 00-2 2v8m0-8V7a2 2 0 00-2-2v0a2 2 0 00-2 2v6m0-4V9a2 2 0 00-2 2v8a6 6 0 006 6h2a6 6 0 006-6v-5"/></svg>
        </button>
        <div class="canvas-toolbar__separator" style="height: 18px; width: 1px; background: var(--border); margin: 0 4px;"></div>
        <button class="btn btn--icon btn--sm" id="canvas-zoom-out-floating" title="Zoom Out">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 7h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <span class="canvas-toolbar__zoom-label" id="zoom-label-floating" style="font-size:11px; font-weight:500; min-width:36px; text-align:center;">${this.zoom}%</span>
        <button class="btn btn--icon btn--sm" id="canvas-zoom-in-floating" title="Zoom In">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 4v6M4 7h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
        <button class="btn btn--icon btn--sm" id="canvas-zoom-fit-floating" title="Fit to Screen">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
    `;

    this._bindCanvasEvents();
  }

  /**
   * Render a single section
   */
  _renderSection(sectionId, section, lang, currency) {
    const isSelected = this.selectedSectionId === sectionId;
    const headerTitle = section.header?.title?.[lang] || section.header?.title?.en || '';
    const headerSubtitle = section.header?.subtitle?.[lang] || section.header?.subtitle?.en || '';

    // Render placeholders in the editor so empty titles/categories are visible and selectable
    let displayTitle = headerTitle;
    let isTitlePlaceholder = false;
    
    if (!headerTitle) {
      isTitlePlaceholder = true;
      if (section.type === 'header') {
        displayTitle = 'Menu Title (Click to edit)';
      } else if (section.type === 'category') {
        displayTitle = 'Category Name (Click to edit)';
      } else if (section.type === 'chefSpecial') {
        displayTitle = "Chef's Special (Click to edit)";
      } else if (section.type === 'beverageList') {
        displayTitle = 'Beverages (Click to edit)';
      } else if (section.type === 'wineList') {
        displayTitle = 'Wine Selection (Click to edit)';
      } else if (section.type === 'dessertMenu') {
        displayTitle = 'Desserts (Click to edit)';
      } else if (section.type === 'kidsMenu') {
        displayTitle = 'Kids Menu (Click to edit)';
      } else if (section.type === 'allergyInfo') {
        displayTitle = 'Allergy Information (Click to edit)';
      } else if (section.type === 'textBlock') {
        displayTitle = 'Text Block Title (Click to edit)';
      } else {
        displayTitle = 'Category Title (Click to edit)';
      }
    }

    const titleStyle = isTitlePlaceholder ? 'opacity: 0.45; font-style: italic; font-weight: normal; cursor: pointer;' : '';

    // Section action bar
    const actionBar = `
      <div class="section-actions">
        <button class="section-actions__btn" data-action="move-up" data-section="${sectionId}" title="Move Up">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M3 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="section-actions__btn" data-action="move-down" data-section="${sectionId}" title="Move Down">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10V2M3 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="section-actions__btn" data-action="duplicate" data-section="${sectionId}" title="Duplicate">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M8.5 3.5V2a1 1 0 00-1-1H2a1 1 0 00-1 1v5.5a1 1 0 001 1h1.5" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button class="section-actions__btn section-actions__btn--danger" data-action="delete" data-section="${sectionId}" title="Delete">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M4.5 3V2h3v1M3 3v6.5a1 1 0 001 1h4a1 1 0 001-1V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </button>
      </div>
    `;

    // Handle special section types
    if (section.type === 'spacer') {
      return `
        <div class="canvas-section ${isSelected ? 'canvas-section--selected' : ''}" data-section-id="${sectionId}">
          ${actionBar}
          <div class="section-divider" style="padding:16px 0;">
            <hr style="border:none;border-top:1px solid var(--theme-secondary, #ccc);width:100%;">
          </div>
        </div>
      `;
    }

    if (section.type === 'pageBreak') {
      return `
        <div class="canvas-section ${isSelected ? 'canvas-section--selected' : ''}" data-section-id="${sectionId}">
          ${actionBar}
          <div style="padding:8px 0;text-align:center;">
            <div style="border:1px dashed var(--text-muted);padding:4px 12px;display:inline-block;font-size:10px;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;">Page Break</div>
          </div>
        </div>
      `;
    }

    // Items
    const items = section.items || {};
    const sortedItems = Object.entries(items)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    return `
      <div class="canvas-section ${isSelected ? 'canvas-section--selected' : ''}" data-section-id="${sectionId}" draggable="true">
        ${actionBar}

        <div class="menu-section">
          ${section.type === 'header' ? `
            <div class="menu-header" style="cursor:pointer; min-height: 40px;">
              <h1 class="menu-header__title" style="font-family:var(--theme-heading-font); ${titleStyle}">${escapeHtml(displayTitle)}</h1>
              ${headerSubtitle ? `<p class="menu-header__subtitle">${escapeHtml(headerSubtitle)}</p>` : (isTitlePlaceholder ? `<p class="menu-header__subtitle" style="opacity:0.35; font-style:italic;">Subtitle</p>` : '')}
              <div class="menu-header__accent-line" style="width:40px;height:2px;background:var(--theme-secondary);margin:16px auto 0;"></div>
            </div>
          ` : `
            <div class="section-divider">
              <span class="section-divider__icon">✦</span>
            </div>
            <h2 class="section-title" style="font-family:var(--theme-heading-font); ${titleStyle}">${escapeHtml(displayTitle)}</h2>
            ${headerSubtitle ? `<p class="section-subtitle">${escapeHtml(headerSubtitle)}</p>` : ''}
          `}

          ${section.content?.[lang] ? `
            <p style="font-size:14px;line-height:1.7;color:var(--theme-text);">${escapeHtml(section.content[lang])}</p>
          ` : (section.type === 'textBlock' ? `
            <p style="font-size:14px;line-height:1.7;color:var(--theme-text); opacity:0.45; font-style:italic;">Enter text content here...</p>
          ` : '')}

          ${sortedItems.map(([itemId, item]) =>
            this._renderItem(sectionId, itemId, item, lang, currency)
          ).join('')}

          ${sortedItems.length === 0 && section.type !== 'header' && section.type !== 'textBlock' ? `
            <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;border:1px dashed var(--border);border-radius:var(--radius-md);cursor:pointer;" data-action="add-item" data-section="${sectionId}">
              + Add Item
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render a single menu item
   */
  _renderItem(sectionId, itemId, item, lang, currency) {
    const name = item.name?.[lang] || item.name?.en || 'Unnamed Item';
    const desc = item.description?.[lang] || item.description?.en || '';
    const price = item.price?.type === 'market' ? 'M.P.' : formatPrice(item.price?.value, item.price?.currency || currency);
    const isSelected = this.selectedSectionId === sectionId && this.selectedItemId === itemId;
    const isSoldOut = item.status === 'sold-out';
    const dietary = (item.dietary || []).map(d => {
      const badge = DIETARY_BADGES.find(b => b.id === d);
      return badge ? `<span class="item-badge" title="${badge.label}" style="background:${badge.color}15;color:${badge.color};">${badge.icon} ${badge.label}</span>` : '';
    }).join('');

    const spice = item.spiceLevel > 0 ? `<span class="spice-level">${'🌶'.repeat(item.spiceLevel)}</span>` : '';

    const imgPos = item.image?.position || 'right';
    const imgRatio = (item.image?.ratio || 'free').replace(':', '-');
    const imgFit = item.image?.fit || 'cover';

    return `
      <div class="menu-item ${isSoldOut ? 'item-status--sold-out' : ''} ${isSelected ? 'canvas-section--selected' : ''} item-image-pos--${imgPos}"
           data-section-id="${sectionId}" data-item-id="${itemId}" style="cursor:pointer;">
        <div class="item-content">
          <div class="item-header">
            ${item.itemNumber ? `<span class="item-number">${escapeHtml(item.itemNumber)}</span>` : ''}
            <span class="item-name" style="font-family:var(--theme-heading-font);">${escapeHtml(name)}</span>
            <span class="item-dots"></span>
            <span class="item-price">${price}</span>
          </div>
          ${desc ? `<p class="item-description">${escapeHtml(desc)}</p>` : ''}
          ${dietary || spice || (item.calories) ? `
            <div class="item-badges">
              ${dietary}
              ${spice}
              ${item.calories ? `<span class="item-badge" style="background:var(--app-bg-subtle);">${item.calories} kcal</span>` : ''}
            </div>
          ` : ''}
        </div>
        ${item.image?.fileId && imgPos !== 'none' ? `<img class="item-image item-image-ratio--${imgRatio} item-image-fit--${imgFit}" src="${item.image.fileId}" alt="${item.image?.alt?.[lang] || name}" loading="lazy">` : ''}
      </div>
    `;
  }

  _bindCanvasEvents() {
    // Zoom controls
    const zoomIn = this.container.querySelector('#canvas-zoom-in');
    const zoomOut = this.container.querySelector('#canvas-zoom-out');
    const zoomFit = this.container.querySelector('#canvas-zoom-fit');

    const zoomInF = this.container.querySelector('#canvas-zoom-in-floating');
    const zoomOutF = this.container.querySelector('#canvas-zoom-out-floating');
    const zoomFitF = this.container.querySelector('#canvas-zoom-fit-floating');

    const handleZoomIn = () => this.setZoom(Math.min(this.zoom + 10, 200));
    const handleZoomOut = () => this.setZoom(Math.max(this.zoom - 10, 30));
    const handleZoomFit = () => this.setZoom(100);

    zoomIn?.addEventListener('click', handleZoomIn);
    zoomOut?.addEventListener('click', handleZoomOut);
    zoomFit?.addEventListener('click', handleZoomFit);

    zoomInF?.addEventListener('click', handleZoomIn);
    zoomOutF?.addEventListener('click', handleZoomOut);
    zoomFitF?.addEventListener('click', handleZoomFit);

    // Page size
    const pageSize = this.container.querySelector('#canvas-page-size');
    pageSize?.addEventListener('change', (e) => {
      this.editorState.pageSize = e.target.value;
      this.render();
    });

    // Grid toggle
    const gridToggle = this.container.querySelector('#canvas-toggle-grid');
    gridToggle?.addEventListener('click', () => {
      this.showGrid = !this.showGrid;
      this.render();
    });

    // Mode switcher buttons
    const modeButtons = this.container.querySelectorAll('.canvas-mode-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.dataset.mode;
        this.setMode(mode);
      });
    });

    // Panning interaction
    let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;

    this.container.addEventListener('mousedown', (e) => {
      if (this.currentMode !== 'pan') return;
      if (e.target.closest('.canvas-modes-toolbar')) return;

      this.isPanning = true;
      this.container.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      scrollLeft = this.container.scrollLeft;
      scrollTop = this.container.scrollTop;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPanning || this.currentMode !== 'pan') return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.container.scrollLeft = scrollLeft - dx;
      this.container.scrollTop = scrollTop - dy;
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        if (this.currentMode === 'pan') {
          this.container.style.cursor = 'grab';
        }
      }
    });

    // Section mousedown → select (instant and reliable, avoids drag gesture click cancellation)
    this.container.querySelectorAll('.canvas-section').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Only left click
        if (this.currentMode === 'pan') return; // Skip select when panning
        if (e.target.closest('.section-actions') || e.target.closest('[data-action="add-item"]')) return;

        // Check if an item was clicked
        const itemEl = e.target.closest('.menu-item[data-item-id]');
        if (itemEl) {
          e.stopPropagation();
          this.selectedSectionId = itemEl.dataset.sectionId;
          this.selectedItemId = itemEl.dataset.itemId;
          this.onItemSelect(this.selectedSectionId, this.selectedItemId);
          this._highlightSelected();
          return;
        }

        // Section clicked
        const sectionId = el.dataset.sectionId;
        this.selectedSectionId = sectionId;
        this.selectedItemId = null;
        this.onSectionSelect(sectionId);
        this._highlightSelected();
      });
    });

    // Click on canvas background → deselect
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      if (this.currentMode === 'pan') return; // Skip in pan mode
      if (e.target.closest('.canvas-modes-toolbar') || e.target.closest('.canvas-toolbar')) return;
      
      // If we clicked on the canvas area outside of sections
      if (!e.target.closest('.canvas-section')) {
        this.deselect();
      }
    });

    // Section action buttons
    this.container.querySelectorAll('.section-actions__btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const sectionId = btn.dataset.section;
        if (action && sectionId) {
          this.onSectionDrop(action, sectionId);
        }
      });
    });

    // Add item buttons
    this.container.querySelectorAll('[data-action="add-item"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSectionDrop('add-item', btn.dataset.section);
      });
    });

    // Drag and drop for section reordering
    this._initDragDrop();
  }

  setZoom(level) {
    this.zoom = level;
    const page = this.container.querySelector('#canvas-page');
    const label = this.container.querySelector('#zoom-label');
    const labelFloating = this.container.querySelector('#zoom-label-floating');
    if (page) page.style.transform = `scale(${this.zoom / 100})`;
    if (label) label.textContent = `${this.zoom}%`;
    if (labelFloating) labelFloating.textContent = `${this.zoom}%`;
  }

  setMode(mode) {
    this.currentMode = mode;
    this.container.querySelectorAll('.canvas-mode-btn').forEach(btn => {
      btn.classList.toggle('canvas-mode-btn--active', btn.dataset.mode === mode);
    });

    if (mode === 'pan') {
      this.container.style.cursor = 'grab';
      this.deselect();
    } else {
      this.container.style.cursor = 'default';
    }
  }

  /**
   * Highlight selected section/item
   */
  _highlightSelected() {
    this.container.querySelectorAll('.canvas-section').forEach(el => {
      el.classList.toggle('canvas-section--selected', el.dataset.sectionId === this.selectedSectionId);
    });
    this.container.querySelectorAll('.menu-item').forEach(el => {
      el.classList.toggle('canvas-section--selected',
        el.dataset.sectionId === this.selectedSectionId && el.dataset.itemId === this.selectedItemId);
    });
  }

  /**
   * Deselect all
   */
  deselect() {
    this.selectedSectionId = null;
    this.selectedItemId = null;
    this._highlightSelected();
    this.onSectionSelect(null);
  }

  /**
   * Init drag-and-drop for sections
   */
  _initDragDrop() {
    const sections = this.container.querySelectorAll('.canvas-section[draggable]');
    let draggedId = null;

    sections.forEach(section => {
      section.addEventListener('dragstart', (e) => {
        draggedId = section.dataset.sectionId;
        section.classList.add('canvas-section--dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedId);
      });

      section.addEventListener('dragend', () => {
        section.classList.remove('canvas-section--dragging');
        draggedId = null;
        // Clear drop targets
        this.container.querySelectorAll('.canvas-section--drop-target').forEach(el =>
          el.classList.remove('canvas-section--drop-target')
        );
      });

      section.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        section.classList.add('canvas-section--drop-target');
      });

      section.addEventListener('dragleave', () => {
        section.classList.remove('canvas-section--drop-target');
      });

      section.addEventListener('drop', (e) => {
        e.preventDefault();
        section.classList.remove('canvas-section--drop-target');
        const fromType = e.dataTransfer.getData('text/plain');
        const type = e.dataTransfer.getData('type');

        // Check if dropping from palette (section type), elements, or reordering
        if (type === 'element' && fromType === 'divider') {
          this.onSectionDrop('add-at', section.dataset.sectionId, 'spacer');
        } else if (fromType && !fromType.includes('-') && Object.keys(this.editorState.sections || {}).indexOf(fromType) === -1) {
          // Palette drop — add new section
          this.onSectionDrop('add-at', section.dataset.sectionId, fromType);
        } else if (draggedId && draggedId !== section.dataset.sectionId) {
          // Reorder
          this.onSectionDrop('reorder', draggedId, section.dataset.sectionId);
        }
      });
    });

    // Also allow drop on the menu preview container for palette items
    const preview = this.container.querySelector('#menu-preview');
    if (preview) {
      preview.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });
      preview.addEventListener('drop', (e) => {
        e.preventDefault();
        const value = e.dataTransfer.getData('text/plain');
        const dataType = e.dataTransfer.getData('type');
        if (dataType === 'section' && value && !Object.keys(this.editorState.sections || {}).includes(value)) {
          this.onSectionDrop('add-new', null, value);
        } else if (dataType === 'element') {
          if (value === 'divider') {
            this.onSectionDrop('add-new', null, 'spacer');
          } else if (value === 'qr') {
            const menuId = this.editorState.menuId;
            import('../app.js').then(({ showShareModal }) => showShareModal(menuId));
          }
        }
      });
    }

    // Drag-and-drop media images & elements onto menu items
    const menuItems = this.container.querySelectorAll('.menu-item');
    menuItems.forEach(itemEl => {
      itemEl.addEventListener('dragover', (e) => {
        // Allow drop if dragging a media image or element
        const types = Array.from(e.dataTransfer.types);
        if (types.includes('type') && types.includes('text/plain')) {
          e.preventDefault();
          e.stopPropagation();
          itemEl.style.outline = '2px dashed var(--accent)';
          itemEl.style.outlineOffset = '-2px';
        }
      });

      itemEl.addEventListener('dragleave', () => {
        itemEl.style.outline = '';
      });

      itemEl.addEventListener('drop', async (e) => {
        const type = e.dataTransfer.getData('type');
        const value = e.dataTransfer.getData('text/plain');
        
        if (type === 'media-image' && value) {
          e.preventDefault();
          e.stopPropagation();
          itemEl.style.outline = '';
          
          const sectionId = itemEl.dataset.sectionId;
          const itemId = itemEl.dataset.itemId;
          
          if (sectionId && itemId) {
            const hotelId = state.get('currentHotelId');
            const menuId = this.editorState.menuId;
            
            await db.update(`hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items/${itemId}/image`, {
              fileId: value,
              position: 'right'
            });
            
            toast.success('Image applied to menu item');
            this.render();
            
            // Re-render item editor if it's currently selected
            if (this.selectedSectionId === sectionId && this.selectedItemId === itemId) {
              this.onItemSelect(sectionId, itemId);
            }
          }
        } else if (type === 'element' && value) {
          e.preventDefault();
          e.stopPropagation();
          itemEl.style.outline = '';
          
          const sectionId = itemEl.dataset.sectionId;
          const itemId = itemEl.dataset.itemId;
          
          if (sectionId && itemId && this.onElementDrop) {
            this.onElementDrop(value, sectionId, itemId);
          }
        }
      });
    });
  }
}

export default CanvasEngine;
export { CanvasEngine };
