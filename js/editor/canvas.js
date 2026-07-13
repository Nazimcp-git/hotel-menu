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
    this.deviceMode = 'desktop'; // 'desktop' | 'mobile'

    this.onSectionSelect = options.onSectionSelect || (() => {});
    this.onItemSelect = options.onItemSelect || (() => {});
    this.onSectionDrop = options.onSectionDrop || (() => {});
    this.onElementDrop = options.onElementDrop || (() => {});

    this.currentMode = 'select'; // 'select' or 'pan'
    this.isPanning = false;

    // Listen for device mode changes from design panel
    document.addEventListener('designDeviceModeChange', (e) => {
      this.deviceMode = e.detail;
      this.render();
    });
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
    const layoutMode = design.layoutMode || 'structured';
    if (layoutMode === 'freeform') {
      const custom = design.custom || {};
      const border = custom.border || {};
      const borderCss = (border.width && border.style !== 'none')
        ? `border:${border.width}px ${border.style || 'solid'} ${border.color || '#C9A96E'};${border.radius ? `border-radius:${border.radius}px;` : ''}${border.padding ? `padding:${border.padding}px;` : ''}`
        : '';
      const fonts = custom.fonts || {};
      const colors = custom.colors || {};
      const themeId = design.theme || 'luxe-noir';
      const themeDef = THEMES[themeId];
      const themeClass = themeDef?.cssClass || 'theme-luxe-noir';
      const customCss = custom.css || '';
      this._renderFreeform(themeClass, this.deviceMode === 'mobile', fonts, colors, borderCss, customCss);
      return;
    }

    const themeId = design.theme || 'luxe-noir';
    const themeDef = THEMES[themeId];
    const themeClass = themeDef?.cssClass || 'theme-luxe-noir';
    const custom = design.custom || {};
    const spacing = custom.spacing || {};
    const colors = custom.colors || {};
    const fonts = custom.fonts || {};
    const border = custom.border || {};
    const typography = custom.typography || {};
    const card = custom.card || {};
    const customCss = custom.css || '';
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

    // Build card CSS
    const cardStyleMap = {
      none: '', outlined: `border:1px solid var(--theme-secondary,#ccc);`, filled: `background:rgba(0,0,0,0.03);`, glass: `background:rgba(255,255,255,0.05);backdrop-filter:blur(8px);`
    };
    const cardShadowMap = {
      none: '', subtle: 'box-shadow:0 1px 3px rgba(0,0,0,0.08);', medium: 'box-shadow:0 4px 12px rgba(0,0,0,0.12);',
      strong: 'box-shadow:0 8px 24px rgba(0,0,0,0.18);', glow: `box-shadow:0 0 20px rgba(201,169,110,0.2);`
    };
    const cardCss = `${cardStyleMap[card.style] || ''}${cardShadowMap[card.shadow] || ''}${card.padding ? `padding:${card.padding}px;` : ''}${card.radius ? `border-radius:${card.radius}px;` : ''}`;

    // Border CSS for the page frame
    const borderCss = (border.width && border.style !== 'none')
      ? `border:${border.width}px ${border.style || 'solid'} ${border.color || '#C9A96E'};${border.radius ? `border-radius:${border.radius}px;` : ''}${border.padding ? `padding:${border.padding}px;` : ''}`
      : '';

    // Mobile device frame
    const isMobileFrame = this.deviceMode === 'mobile';

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

      ${isMobileFrame ? '<div class="canvas-mobile-frame">' : ''}
      <!-- Canvas Page -->
      <div class="canvas-page ${pageSizeClass} ${isMobileFrame ? 'canvas-page--mobile' : ''}" id="canvas-page"
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
                    --theme-heading-size: ${typography.headingSize || 28}px;
                    --theme-body-size: ${typography.bodySize || 14}px;
                    --theme-heading-weight: ${typography.headingWeight || 700};
                    --theme-body-weight: ${typography.bodyWeight || 400};
                    --theme-line-height: ${typography.lineHeight || 1.6};
                    --theme-section-gap: ${spacing.sectionGap || 24}px;
                    --theme-item-gap: ${spacing.itemGap || 12}px;
                    font-size: ${typography.bodySize || 14}px;
                    font-weight: ${typography.bodyWeight || 400};
                    line-height: ${typography.lineHeight || 1.6};
                    ${borderCss}
                    min-height: 100%;">

          ${sortedSections.length === 0 ? `
            <div class="canvas-empty">
              <div class="canvas-empty__icon">📋</div>
              <div class="canvas-empty__text">Your menu is empty</div>
              <div class="canvas-empty__hint">Drag sections from the left panel or click to add</div>
            </div>
          ` : ''}

          ${sortedSections.map(([sectionId, section]) =>
            this._renderSection(sectionId, section, lang, currency, cardCss)
          ).join('')}
        </div>
        ${customCss ? `<style id="custom-css-injection">${customCss}</style>` : ''}
      </div>
      ${isMobileFrame ? '</div>' : ''}

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
  _renderSection(sectionId, section, lang, currency, cardCss = '') {
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

    // Section-level layout (grid columns)
    const layout = section.layout || {};
    const gridColumns = layout.columns || 1;
    const sectionCssClass = layout.cssClass || '';

    // Handle special section types
    if (section.type === 'spacer' || section.type === 'divider') {
      const dividerStyle = section.dividerStyle || 'solid';
      const dividerColor = section.dividerColor || 'var(--theme-secondary, #ccc)';
      return `
        <div class="canvas-section ${isSelected ? 'canvas-section--selected' : ''}" data-section-id="${sectionId}">
          ${actionBar}
          <div class="section-divider" style="padding:16px 0;">
            <hr style="border:none;border-top:1px ${dividerStyle} ${dividerColor};width:100%;">
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

    // CTA Button section
    if (section.type === 'cta-button') {
      const ctaText = section.ctaText || 'Order Now';
      const ctaUrl = section.ctaUrl || '#';
      const ctaStyle = section.ctaStyle || 'filled'; // filled | outlined | ghost
      const ctaAlign = section.ctaAlign || 'center';
      const ctaBtnCss = ctaStyle === 'outlined'
        ? `border:2px solid var(--theme-accent);color:var(--theme-accent);background:transparent;`
        : ctaStyle === 'ghost'
          ? `background:transparent;color:var(--theme-accent);`
          : `background:var(--theme-accent);color:#fff;`;
      return `
        <div class="canvas-section ${isSelected ? 'canvas-section--selected' : ''}" data-section-id="${sectionId}">
          ${actionBar}
          <div style="text-align:${ctaAlign};padding:16px 0;">
            <a class="cta-button" href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener"
               style="display:inline-block;padding:12px 32px;font-family:var(--theme-heading-font);font-size:15px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;border-radius:6px;transition:all 0.2s;cursor:pointer;${ctaBtnCss}">
              ${escapeHtml(ctaText)}
            </a>
          </div>
        </div>
      `;
    }

    // Social Links section
    if (section.type === 'social-links') {
      const socials = section.socialLinks || [];
      const socialAlign = section.socialAlign || 'center';
      const socialIcons = {
        instagram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5"/></svg>',
        facebook: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>',
        twitter: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 3a10.9 10.9 0 01-3.14 1.53A4.48 4.48 0 0012 7.5v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/></svg>',
        website: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>',
        whatsapp: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
        tiktok: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12a4 4 0 104 4V4a5 5 0 005 5"/></svg>',
        youtube: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>'
      };
      return `
        <div class="canvas-section ${isSelected ? 'canvas-section--selected' : ''}" data-section-id="${sectionId}">
          ${actionBar}
          <div class="social-links-bar" style="text-align:${socialAlign};padding:12px 0;display:flex;justify-content:${socialAlign};gap:16px;flex-wrap:wrap;">
            ${socials.length > 0 ? socials.map(s => `
              <a href="${escapeHtml(s.url || '#')}" target="_blank" rel="noopener" style="color:var(--theme-text);opacity:0.7;transition:opacity 0.2s;" title="${escapeHtml(s.platform || '')}">
                ${socialIcons[s.platform] || socialIcons.website}
              </a>
            `).join('') : `
              <div style="color:var(--text-muted);font-size:12px;padding:8px 16px;border:1px dashed var(--border);border-radius:var(--radius-md);">Click to add social links</div>
            `}
          </div>
        </div>
      `;
    }

    // Items
    const items = section.items || {};
    const sortedItems = Object.entries(items)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    // Grid style for multi-column layouts
    const gridStyle = gridColumns > 1
      ? `display:grid;grid-template-columns:repeat(${gridColumns},1fr);gap:var(--theme-item-gap,12px);`
      : '';

    return `
      <div class="canvas-section ${isSelected ? 'canvas-section--selected' : ''} ${sectionCssClass}" data-section-id="${sectionId}" draggable="true">
        ${actionBar}

        <div class="menu-section" style="${cardCss}">
          ${section.type === 'header' ? `
            <div class="menu-header" style="cursor:pointer; min-height: 40px;">
              <h1 class="menu-header__title" style="font-family:var(--theme-heading-font);font-size:var(--theme-heading-size,28px);font-weight:var(--theme-heading-weight,700); ${titleStyle}">${escapeHtml(displayTitle)}</h1>
              ${headerSubtitle ? `<p class="menu-header__subtitle">${escapeHtml(headerSubtitle)}</p>` : (isTitlePlaceholder ? `<p class="menu-header__subtitle" style="opacity:0.35; font-style:italic;">Subtitle</p>` : '')}
              <div class="menu-header__accent-line" style="width:40px;height:2px;background:var(--theme-secondary);margin:16px auto 0;"></div>
            </div>
          ` : `
            <div class="section-divider">
              <span class="section-divider__icon">✦</span>
            </div>
            <h2 class="section-title" style="font-family:var(--theme-heading-font);font-size:calc(var(--theme-heading-size,28px) * 0.75);font-weight:var(--theme-heading-weight,700); ${titleStyle}">${escapeHtml(displayTitle)}</h2>
            ${headerSubtitle ? `<p class="section-subtitle">${escapeHtml(headerSubtitle)}</p>` : ''}
          `}

          ${section.content?.[lang] ? `
            <p style="font-size:var(--theme-body-size,14px);line-height:var(--theme-line-height,1.7);color:var(--theme-text);">${escapeHtml(section.content[lang])}</p>
          ` : (section.type === 'textBlock' ? `
            <p style="font-size:var(--theme-body-size,14px);line-height:var(--theme-line-height,1.7);color:var(--theme-text); opacity:0.45; font-style:italic;">Enter text content here...</p>
          ` : '')}

          <div class="menu-items-grid" style="${gridStyle}">
            ${sortedItems.map(([itemId, item]) =>
              this._renderItem(sectionId, itemId, item, lang, currency)
            ).join('')}
          </div>

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
    this.container.querySelectorAll('.freeform-element').forEach(el => {
      const isSel = el.dataset.elementId === window.freeform?.selectedElementId;
      el.classList.toggle('freeform-element--selected', isSel);
    });
  }

  /**
   * Deselect all
   */
  deselect() {
    this.selectedSectionId = null;
    this.selectedItemId = null;
    if (window.freeform) {
      window.freeform.selectedElementId = null;
      window.freeform.renderRightPanel(null);
    }
    this._highlightSelected();
    this.onSectionSelect(null);
  }

  /**
   * Render freeform mode view on canvas
   */
  _renderFreeform(themeClass, isMobileFrame, fonts, colors, borderCss, customCss) {
    const elements = this.editorState.freeformElements || {};
    const sortedElements = Object.entries(elements)
      .sort(([, a], [, b]) => (a.zIndex || 0) - (b.zIndex || 0));

    const lang = this.editorState.primaryLanguage || 'en';
    const currency = this.editorState.currency || 'USD';

    // Build custom page background styles
    const design = this.editorState.design || {};
    const custom = design.custom || {};
    const pageBg = custom.pageBackground || { type: 'solid', color: '#FFFFFF' };
    
    let canvasBgStyle = '';
    if (pageBg.type === 'gradient') {
      const gType = pageBg.gradientType || 'linear';
      const gStart = pageBg.gradientColorStart || '#ffffff';
      const gEnd = pageBg.gradientColorEnd || '#c9a96e';
      const gAngle = pageBg.gradientAngle !== undefined ? pageBg.gradientAngle : 90;
      if (gType === 'radial') {
        canvasBgStyle = `background: radial-gradient(circle, ${gStart}, ${gEnd});`;
      } else {
        canvasBgStyle = `background: linear-gradient(${gAngle}deg, ${gStart}, ${gEnd});`;
      }
    } else if (pageBg.type === 'image' && pageBg.imageUrl) {
      canvasBgStyle = `background-image: url('${pageBg.imageUrl}'); background-size: cover; background-position: center;`;
    } else {
      canvasBgStyle = `background-color: ${pageBg.color || '#FFFFFF'};`;
    }

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
          <button class="btn btn--icon btn--sm ${this.showGrid ? 'btn--active' : ''}" id="canvas-toggle-grid" aria-label="Toggle grid" data-tooltip="Grid">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 5h10M2 9h10M5 2v10M9 2v10" stroke="currentColor" stroke-width="1" opacity="0.5"/></svg>
          </button>
        </div>
      </div>

      ${isMobileFrame ? '<div class="canvas-mobile-frame">' : ''}
      <!-- Canvas Page (Freeform Canvas) -->
      <div class="canvas-page canvas-page--freeform ${isMobileFrame ? 'canvas-page--mobile' : ''}" id="canvas-page"
           style="transform: scale(${this.zoom / 100});
                  --theme-heading-font: '${fonts.heading || 'Playfair Display'}', serif;
                  --theme-body-font: '${fonts.body || 'Lato'}', sans-serif;
                  --theme-primary: ${colors.primary || '#1A1A1A'};
                  --theme-secondary: ${colors.secondary || '#C9A96E'};
                  --theme-accent: ${colors.accent || '#C9A96E'};
                  --theme-bg: ${colors.background || '#FFFFFF'};
                  --theme-text: ${colors.text || '#1A1A1A'};
                  font-family: '${fonts.body || 'Lato'}', sans-serif;
                  color: ${colors.text || '#1A1A1A'};
                  ${canvasBgStyle}
                  ${borderCss}">

        ${this.showGrid ? '<div class="canvas-grid canvas-grid--visible" style="background-size:20px 20px;"></div>' : ''}

        <div class="menu-preview ${themeClass}" id="menu-preview" style="width:100%; height:100%; position:relative; background:transparent;">
          ${sortedElements.map(([id, el]) => this._renderFreeformElement(id, el, lang, currency)).join('')}
        </div>
        ${customCss ? `<style id="custom-css-injection">${customCss}</style>` : ''}
      </div>
      ${isMobileFrame ? '</div>' : ''}

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

    // Re-bind zoom/mode events
    this._bindCanvasEvents();

    // Bind freeform click, drag, resize, rotate handlers
    if (window.freeform) {
      const page = this.container.querySelector('#canvas-page');
      window.freeform.bindCanvasInteractions(page);
    }
  }

  _renderFreeformElement(id, el, lang, currency) {
    const isSelected = window.freeform?.selectedElementId === id;
    const style = el.style || {};

    // Standard Styles
    const opacityStyle = style.opacity !== undefined ? `opacity: ${style.opacity};` : '';
    const shadowStyle = (style.shadowBlur || style.shadowOffsetX || style.shadowOffsetY)
      ? `box-shadow: ${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 0}px ${style.shadowBlur || 0}px ${style.shadowColor || '#000000'};`
      : '';
    const nonShapeBorder = el.type !== 'shape' && el.type !== 'text'
      ? `border: ${style.borderWidth || 0}px ${style.borderStyle || 'solid'} ${style.borderColor || '#C9A96E'}; border-radius: ${style.borderRadius || 0}px;`
      : '';

    let contentHtml = '';
    if (el.type === 'text') {
      contentHtml = `
        <div class="freeform-text-body" style="width:100%; height:100%; font-size:${style.fontSize || 16}px; font-family:'${style.fontFamily || 'Lato'}', sans-serif; color:${style.color || '#1A1A1A'}; text-align:${style.textAlign || 'left'}; font-weight:${style.fontWeight || 'normal'}; line-height: 1.4; word-break: break-word;">
          ${escapeHtml(el.content || '')}
        </div>
      `;
    } else if (el.type === 'image') {
      contentHtml = `
        <img src="${el.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}" 
             style="width:100%; height:100%; object-fit:cover; border-radius:${style.borderRadius || 0}px;" alt="Canvas Image">
      `;
    } else if (el.type === 'shape') {
      const isCircle = el.shapeType === 'circle';
      const isEllipse = el.shapeType === 'ellipse';
      const isTriangle = el.shapeType === 'triangle';
      const isStar = el.shapeType === 'star';
      
      const rawStrokeWidth = style.borderWidth || 0;
      const strokeAttr = rawStrokeWidth > 0 ? (style.borderColor || '#C9A96E') : 'none';
      const strokeDash = style.borderStyle === 'dashed' ? '5,5' : (style.borderStyle === 'dotted' ? '2,2' : 'none');
      const fillAttr = el.imageUrl ? `url(#pattern-${id})` : (style.backgroundColor || '#F8F5EE');
      
      const elWidth = el.w || 100;
      const strokeWidth = elWidth > 0 ? (rawStrokeWidth / elWidth) * 100 : rawStrokeWidth;

      const patternHtml = el.imageUrl ? `
        <defs>
          <pattern id="pattern-${id}" width="100%" height="100%" patternContentUnits="objectBoundingBox">
            <image href="${el.imageUrl}" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        </defs>
      ` : '';

      if (isCircle) {
        contentHtml = `
          <svg width="100%" height="100%" style="overflow:visible;">
            ${patternHtml}
            <circle cx="50%" cy="50%" r="calc(50% - ${rawStrokeWidth/2}px)" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${rawStrokeWidth}" stroke-dasharray="${strokeDash}" />
          </svg>
        `;
      } else if (isEllipse) {
        contentHtml = `
          <svg width="100%" height="100%" style="overflow:visible;">
            ${patternHtml}
            <ellipse cx="50%" cy="50%" rx="calc(50% - ${rawStrokeWidth/2}px)" ry="calc(50% - ${rawStrokeWidth/2}px)" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${rawStrokeWidth}" stroke-dasharray="${strokeDash}" />
          </svg>
        `;
      } else if (isTriangle) {
        contentHtml = `
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:visible;">
            ${patternHtml}
            <polygon points="50,${strokeWidth/2} ${strokeWidth/2},${100 - strokeWidth/2} ${100 - strokeWidth/2},${100 - strokeWidth/2}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />
          </svg>
        `;
      } else if (isStar) {
        contentHtml = `
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="overflow:visible;">
            ${patternHtml}
            <polygon points="50,2 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" />
          </svg>
        `;
      } else { // rectangle
        const rx = style.borderRadius || 0;
        contentHtml = `
          <svg width="100%" height="100%" style="overflow:visible;">
            ${patternHtml}
            <rect x="${rawStrokeWidth/2}" y="${rawStrokeWidth/2}" width="calc(100% - ${rawStrokeWidth}px)" height="calc(100% - ${rawStrokeWidth}px)" rx="${rx}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${rawStrokeWidth}" stroke-dasharray="${strokeDash}" />
          </svg>
        `;
      }
    } else if (el.type === 'menu-item') {
      const section = this.editorState.sections?.[el.sectionId];
      const item = section?.items?.[el.itemId];
      const name = item?.name?.[lang] || item?.name?.en || 'Dynamic Item Link';
      const desc = item?.description?.[lang] || item?.description?.en || 'Associated food description will populate here dynamically.';
      const price = item?.price?.type === 'market' ? 'M.P.' : formatPrice(item?.price?.value, item?.price?.currency || currency);

      contentHtml = `
        <div class="menu-item" style="width:100%; height:100%; font-family:'${style.fontFamily || 'Lato'}', sans-serif; color:${style.color || '#1A1A1A'}; display:flex; flex-direction:column; padding:6px; box-sizing:border-box;">
          <div class="item-header" style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:2px; font-size:${style.fontSize || 14}px;">
            <span class="item-name">${escapeHtml(name)}</span>
            <span class="item-price">${price}</span>
          </div>
          <p class="item-description" style="font-size:11px; opacity:0.75; margin:0; line-height:1.3; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHtml(desc)}</p>
        </div>
      `;
    } else if (el.type === 'qr') {
      contentHtml = `
        <div style="width:100%; height:100%; background:#fff; border:1px solid #ccc; display:flex; align-items:center; justify-content:center; box-sizing:border-box;">
          <svg width="80%" height="80%" viewBox="0 0 16 16" fill="none" style="color:#000;"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2" /><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2" /><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2" /><rect x="10" y="10" width="4" height="4" stroke="currentColor" stroke-width="1" /></svg>
        </div>
      `;
    } else if (el.type === 'social') {
      contentHtml = `
        <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; gap:8px; font-size:12px; opacity:0.8;">
          🌐 Instagram · Facebook · Twitter
        </div>
      `;
    }

    return `
      <div class="freeform-element ${isSelected ? 'freeform-element--selected' : ''}" 
           data-element-id="${id}" 
           data-type="${el.type}"
           style="left:${el.x}px; top:${el.y}px; width:${el.w}px; height:${el.h}px; z-index:${el.zIndex || 10}; transform: rotate(${el.rotation || 0}deg); ${opacityStyle} ${shadowStyle} ${nonShapeBorder}">
        ${contentHtml}
        
        <!-- Resize/rotate handles -->
        <div class="freeform-element__handles">
          <div class="freeform-handle freeform-handle--tl"></div>
          <div class="freeform-handle freeform-handle--tm"></div>
          <div class="freeform-handle freeform-handle--tr"></div>
          <div class="freeform-handle freeform-handle--ml"></div>
          <div class="freeform-handle freeform-handle--mr"></div>
          <div class="freeform-handle freeform-handle--bl"></div>
          <div class="freeform-handle freeform-handle--bm"></div>
          <div class="freeform-handle freeform-handle--br"></div>
          <div class="freeform-handle freeform-handle--rotate"></div>
        </div>
      </div>
    `;
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
        if (type === 'element' && (fromType === 'divider' || fromType === 'cta-button' || fromType === 'social-links')) {
          const sectionType = fromType === 'divider' ? 'spacer' : fromType;
          this.onSectionDrop('add-at', section.dataset.sectionId, sectionType);
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

        if (value && value.startsWith('freeform-') && window.freeform) {
          const rect = preview.getBoundingClientRect();
          const scale = this.zoom / 100;
          const dropX = Math.round((e.clientX - rect.left) / scale);
          const dropY = Math.round((e.clientY - rect.top) / scale);
          const type = value.substring(9); // e.g. "text", "image", "rect", "item"
          
          if (type === 'rect') {
            window.freeform.addElement('shape', { x: dropX, y: dropY, shapeType: 'rectangle' });
          } else {
            window.freeform.addElement(type, { x: dropX, y: dropY });
          }
          return;
        }

        if (dataType === 'section' && value && !Object.keys(this.editorState.sections || {}).includes(value)) {
          this.onSectionDrop('add-new', null, value);
        } else if (dataType === 'element') {
          if (value === 'divider') {
            this.onSectionDrop('add-new', null, 'spacer');
          } else if (value === 'cta-button') {
            this.onSectionDrop('add-new', null, 'cta-button');
          } else if (value === 'social-links') {
            this.onSectionDrop('add-new', null, 'social-links');
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
