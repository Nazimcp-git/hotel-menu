/* ============================================
   MenuForge — Menu Renderer
   Renders menu data into themed HTML for preview
   ============================================ */

import { escapeHtml } from '../utils/helpers.js';
import { formatPrice } from '../utils/formatters.js';
import { THEMES } from '../editor/design.js';
import { DIETARY_BADGES } from '../editor/items.js';

class MenuRenderer {
  constructor() {
    this.data = null;
    this.options = {
      showPrices: true,
      showCalories: false,
      showAllergens: true,
      showItemNumbers: false,
      showImages: true,
      interactiveHover: false
    };
  }

  /**
   * Render full menu HTML
   */
  render(menuData, options = {}) {
    this.data = menuData;
    this.options = { ...this.options, ...options };

    const design = menuData.design || {};
    const themeId = design.theme || 'luxe-noir';
    const themeDef = THEMES[themeId];
    const themeClass = themeDef?.cssClass || 'theme-luxe-noir';
    const custom = design.custom || {};
    const colors = custom.colors || {};
    const fonts = custom.fonts || {};
    const spacing = custom.spacing || {};
    const lang = menuData.meta?.primaryLanguage || 'en';
    const currency = menuData.meta?.currency || 'USD';
    const sections = menuData.sections || {};

    // Sort sections
    const sorted = Object.entries(sections)
      .filter(([, s]) => s.visible !== false)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    const pageSize = menuData.meta?.pageSize || 'A4';
    const pageSizeClass = {
      'A4': 'menu-page--a4',
      'A4-landscape': 'menu-page--a4-landscape',
      'A5': 'menu-page--a5',
      'Letter': 'menu-page--letter',
      'Digital': 'menu-page--digital'
    }[pageSize] || 'menu-page--a4';

    // Group sections into pages based on pageBreak sections
    const pages = [[]];
    sorted.forEach(([id, section]) => {
      if (section.type === 'pageBreak') {
        pages.push([]);
      } else {
        pages[pages.length - 1].push(section);
      }
    });

    return pages.map((pageSections, index) => {
      const isLast = index === pages.length - 1;
      return `
        <div class="menu-page ${pageSizeClass} menu-preview ${themeClass}"
             style="font-family: '${fonts.body || 'Lato'}', sans-serif;
                    color: ${colors.text || '#1A1A1A'};
                    background: ${colors.background || '#FFFFFF'};
                    --theme-heading-font: '${fonts.heading || 'Playfair Display'}', serif;
                    --theme-body-font: '${fonts.body || 'Lato'}', sans-serif;
                    --theme-accent-font: '${fonts.accent || fonts.heading || 'Cormorant Garamond'}', serif;
                    --theme-primary: ${colors.primary || '#1A1A1A'};
                    --theme-secondary: ${colors.secondary || '#C9A96E'};
                    --theme-accent: ${colors.accent || '#C9A96E'};
                    --theme-bg: ${colors.background || '#FFFFFF'};
                    --theme-text: ${colors.text || '#1A1A1A'};
                    --theme-price-color: ${colors.accent || '#C9A96E'};
                    --menu-padding-top: ${spacing.pageMarginTop || 20}mm;
                    --menu-padding-right: ${spacing.pageMarginRight || 15}mm;
                    --menu-padding-bottom: ${spacing.pageMarginBottom || 20}mm;
                    --menu-padding-left: ${spacing.pageMarginLeft || 15}mm;">

          ${pageSections.map(section => this._renderSection(section, lang, currency)).join('')}

          ${isLast ? `
            <div class="menu-footer">
              ${menuData.meta?.allergyNotice
                ? `<p>${escapeHtml(menuData.meta.allergyNotice)}</p>`
                : '<p>Please inform your server of any dietary requirements or allergies.</p>'}
              <p style="margin-top:4px;">Prices include applicable taxes.</p>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  _renderSection(section, lang, currency) {
    if (section.type === 'pageBreak') {
      return '<div class="page-break"></div>';
    }

    if (section.type === 'spacer') {
      return '<div class="section-divider"><hr style="border:none;border-top:1px solid var(--theme-secondary,#ccc);width:100%;"></div>';
    }

    const title = section.header?.title?.[lang] || section.header?.title?.en || '';
    const subtitle = section.header?.subtitle?.[lang] || section.header?.subtitle?.en || '';
    const items = section.items || {};
    const sortedItems = Object.entries(items)
      .filter(([, item]) => item.status !== 'hidden')
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    let sectionHtml = '<div class="menu-section">';

    // Header
    if (section.type === 'header') {
      sectionHtml += `
        <div class="menu-header">
          <h1 class="menu-header__title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="menu-header__subtitle">${escapeHtml(subtitle)}</p>` : ''}
          <div class="menu-header__accent-line" style="width:40px;height:2px;background:var(--theme-secondary);margin:16px auto 0;"></div>
        </div>
      `;
    } else if (title) {
      sectionHtml += `
        <div class="section-divider"><span class="section-divider__icon">✦</span></div>
        <h2 class="section-title">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="section-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      `;
    }

    // Text block
    if (section.type === 'textBlock' && section.content?.[lang]) {
      sectionHtml += `<p style="font-size:14px;line-height:1.7;">${escapeHtml(section.content[lang])}</p>`;
    }

    // Items
    sortedItems.forEach(([itemId, item]) => {
      sectionHtml += this._renderItem(item, lang, currency);
    });

    sectionHtml += '</div>';
    return sectionHtml;
  }

  _renderItem(item, lang, currency) {
    const name = item.name?.[lang] || item.name?.en || '';
    const desc = item.description?.[lang] || item.description?.en || '';
    const isSoldOut = item.status === 'sold-out';
    const isComingSoon = item.status === 'coming-soon';

    let priceHtml = '';
    if (this.options.showPrices) {
      if (item.price?.type === 'market') {
        priceHtml = '<span class="item-price">M.P.</span>';
      } else if (item.price?.type === 'variants' && item.price?.variants) {
        priceHtml = Object.entries(item.price.variants)
          .map(([size, val]) => `<span class="item-price">${size}: ${formatPrice(val, currency)}</span>`)
          .join(' · ');
      } else {
        priceHtml = `<span class="item-price">${formatPrice(item.price?.value, currency)}</span>`;
      }
    }

    const dietaryBadges = (item.dietary || []).map(d => {
      const badge = DIETARY_BADGES.find(b => b.id === d);
      return badge ? `<span class="item-badge" style="background:${badge.color}15;color:${badge.color};">${badge.icon} ${badge.label}</span>` : '';
    }).join('');

    const spice = item.spiceLevel > 0 ? `<span class="spice-level">${'🌶'.repeat(item.spiceLevel)}</span>` : '';
    const calories = this.options.showCalories && item.calories ? `<span class="item-badge">${item.calories} kcal</span>` : '';

    const allergens = this.options.showAllergens && item.allergens?.length
      ? `<div class="allergen-icons">${item.allergens.map(a => `<span class="allergen-icon" title="${a}">${a.charAt(0).toUpperCase()}</span>`).join('')}</div>`
      : '';

    const imgPos = item.image?.position || 'right';
    const imgRatio = (item.image?.ratio || 'free').replace(':', '-');
    const imgFit = item.image?.fit || 'cover';

    const imageHtml = this.options.showImages && item.image?.fileId && imgPos !== 'none'
      ? `<img class="item-image item-image-ratio--${imgRatio} item-image-fit--${imgFit}" src="${item.image.fileId}" alt="${item.image?.alt?.[lang] || name}" loading="lazy">`
      : '';

    return `
      <div class="menu-item ${isSoldOut ? 'item-status--sold-out' : ''} ${isComingSoon ? 'item-status--coming-soon' : ''} item-image-pos--${imgPos}">
        <div class="item-content">
          <div class="item-header">
            ${this.options.showItemNumbers && item.itemNumber ? `<span class="item-number">${escapeHtml(item.itemNumber)}</span>` : ''}
            <span class="item-name">${escapeHtml(name)}</span>
            <span class="item-dots"></span>
            ${priceHtml}
          </div>
          ${desc ? `<p class="item-description">${escapeHtml(desc)}</p>` : ''}
          ${dietaryBadges || spice || calories ? `<div class="item-badges">${dietaryBadges}${spice}${calories}</div>` : ''}
          ${allergens}
          ${item.pairingNote?.[lang] ? `<p style="font-size:11px;color:var(--theme-secondary);margin-top:4px;font-style:italic;">🍷 ${escapeHtml(item.pairingNote[lang])}</p>` : ''}
        </div>
        ${imageHtml}
      </div>
    `;
  }
}

export default MenuRenderer;
export { MenuRenderer };
