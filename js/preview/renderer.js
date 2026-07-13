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
    if (design.layoutMode === 'freeform') {
      return this.renderFreeform(menuData, options);
    }
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

      // Build extended style variables
      const typography = custom.typography || {};
      const border = custom.border || {};
      const card = custom.card || {};
      const customCss = custom.css || '';

      // Border CSS
      const borderCss = (border.width && border.style !== 'none')
        ? `border:${border.width}px ${border.style || 'solid'} ${border.color || '#C9A96E'};${border.radius ? `border-radius:${border.radius}px;` : ''}${border.padding ? `padding:${border.padding}px;` : ''}`
        : '';

      // Card CSS
      const cardStyleMap = { none:'', outlined:`border:1px solid var(--theme-secondary,#ccc);`, filled:`background:rgba(0,0,0,0.03);`, glass:`background:rgba(255,255,255,0.05);backdrop-filter:blur(8px);` };
      const cardShadowMap = { none:'', subtle:'box-shadow:0 1px 3px rgba(0,0,0,0.08);', medium:'box-shadow:0 4px 12px rgba(0,0,0,0.12);', strong:'box-shadow:0 8px 24px rgba(0,0,0,0.18);', glow:`box-shadow:0 0 20px rgba(201,169,110,0.2);` };
      const cardCss = `${cardStyleMap[card.style] || ''}${cardShadowMap[card.shadow] || ''}${card.padding ? `padding:${card.padding}px;` : ''}${card.radius ? `border-radius:${card.radius}px;` : ''}`;

      // Mobile overrides media query
      const mobile = custom.mobile || {};
      const syncMobile = menuData.design?.syncMobile !== false;
      let mobileMediaCss = '';
      if (!syncMobile && Object.keys(mobile).length > 0) {
        const mColors = mobile.colors || {};
        const mTypo = mobile.typography || {};
        const mBorder = mobile.border || {};
        let rules = '';
        if (mColors.primary) rules += `--theme-primary:${mColors.primary};`;
        if (mColors.secondary) rules += `--theme-secondary:${mColors.secondary};`;
        if (mColors.accent) rules += `--theme-accent:${mColors.accent};--theme-price-color:${mColors.accent};`;
        if (mColors.background) rules += `--theme-bg:${mColors.background};background:${mColors.background};`;
        if (mColors.text) rules += `--theme-text:${mColors.text};color:${mColors.text};`;
        if (mTypo.headingSize) rules += `--theme-heading-size:${mTypo.headingSize}px;`;
        if (mTypo.bodySize) rules += `--theme-body-size:${mTypo.bodySize}px;font-size:${mTypo.bodySize}px;`;
        if (mTypo.lineHeight) rules += `--theme-line-height:${mTypo.lineHeight};line-height:${mTypo.lineHeight};`;
        if (rules) mobileMediaCss = `@media(max-width:768px){.menu-preview{${rules}}}`;
      }

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
                    --menu-padding-top: ${spacing.pageMarginTop || 20}mm;
                    --menu-padding-right: ${spacing.pageMarginRight || 15}mm;
                    --menu-padding-bottom: ${spacing.pageMarginBottom || 20}mm;
                    --menu-padding-left: ${spacing.pageMarginLeft || 15}mm;">

          ${pageSections.map(section => this._renderSection(section, lang, currency, cardCss)).join('')}

          ${isLast ? `
            <div class="menu-footer">
              ${menuData.meta?.allergyNotice
                ? `<p>${escapeHtml(menuData.meta.allergyNotice)}</p>`
                : '<p>Please inform your server of any dietary requirements or allergies.</p>'}
              <p style="margin-top:4px;">Prices include applicable taxes.</p>
            </div>
          ` : ''}
        </div>
        ${customCss ? `<style>${customCss}</style>` : ''}
        ${mobileMediaCss ? `<style>${mobileMediaCss}</style>` : ''}
      `;
    }).join('');
  }

  _renderSection(section, lang, currency, cardCss = '') {
    if (section.type === 'pageBreak') {
      return '<div class="page-break"></div>';
    }

    if (section.type === 'spacer' || section.type === 'divider') {
      const dividerStyle = section.dividerStyle || 'solid';
      const dividerColor = section.dividerColor || 'var(--theme-secondary,#ccc)';
      return `<div class="section-divider"><hr style="border:none;border-top:1px ${dividerStyle} ${dividerColor};width:100%;"></div>`;
    }

    // CTA Button
    if (section.type === 'cta-button') {
      const ctaText = section.ctaText || 'Order Now';
      const ctaUrl = section.ctaUrl || '#';
      const ctaStyle = section.ctaStyle || 'filled';
      const ctaAlign = section.ctaAlign || 'center';
      const ctaBtnCss = ctaStyle === 'outlined'
        ? `border:2px solid var(--theme-accent);color:var(--theme-accent);background:transparent;`
        : ctaStyle === 'ghost' ? `background:transparent;color:var(--theme-accent);` : `background:var(--theme-accent);color:#fff;`;
      return `
        <div style="text-align:${ctaAlign};padding:16px 0;">
          <a class="cta-button" href="${escapeHtml(ctaUrl)}" target="_blank" rel="noopener"
             style="display:inline-block;padding:12px 32px;font-family:var(--theme-heading-font);font-size:15px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;border-radius:6px;transition:all 0.2s;cursor:pointer;${ctaBtnCss}">
            ${escapeHtml(ctaText)}
          </a>
        </div>
      `;
    }

    // Social Links
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
      if (socials.length === 0) return '';
      return `
        <div class="social-links-bar" style="text-align:${socialAlign};padding:12px 0;display:flex;justify-content:${socialAlign};gap:16px;flex-wrap:wrap;">
          ${socials.map(s => `
            <a href="${escapeHtml(s.url || '#')}" target="_blank" rel="noopener" style="color:var(--theme-text);opacity:0.7;transition:opacity 0.2s;" title="${escapeHtml(s.platform || '')}">
              ${socialIcons[s.platform] || socialIcons.website}
            </a>
          `).join('')}
        </div>
      `;
    }

    const title = section.header?.title?.[lang] || section.header?.title?.en || '';
    const subtitle = section.header?.subtitle?.[lang] || section.header?.subtitle?.en || '';
    const items = section.items || {};
    const sortedItems = Object.entries(items)
      .filter(([, item]) => item.status !== 'hidden')
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    const layout = section.layout || {};
    const gridColumns = layout.columns || 1;
    const sectionCssClass = layout.cssClass || '';
    const gridStyle = gridColumns > 1 ? `display:grid;grid-template-columns:repeat(${gridColumns},1fr);gap:var(--theme-item-gap,12px);` : '';

    let sectionHtml = `<div class="menu-section ${sectionCssClass}" style="${cardCss}">`;

    // Header
    if (section.type === 'header') {
      sectionHtml += `
        <div class="menu-header">
          <h1 class="menu-header__title" style="font-size:var(--theme-heading-size,28px);font-weight:var(--theme-heading-weight,700);">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="menu-header__subtitle">${escapeHtml(subtitle)}</p>` : ''}
          <div class="menu-header__accent-line" style="width:40px;height:2px;background:var(--theme-secondary);margin:16px auto 0;"></div>
        </div>
      `;
    } else if (title) {
      sectionHtml += `
        <div class="section-divider"><span class="section-divider__icon">✦</span></div>
        <h2 class="section-title" style="font-size:calc(var(--theme-heading-size,28px) * 0.75);font-weight:var(--theme-heading-weight,700);">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="section-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      `;
    }

    // Text block
    if (section.type === 'textBlock' && section.content?.[lang]) {
      sectionHtml += `<p style="font-size:var(--theme-body-size,14px);line-height:var(--theme-line-height,1.7);">${escapeHtml(section.content[lang])}</p>`;
    }

    // Items in grid
    sectionHtml += `<div class="menu-items-grid" style="${gridStyle}">`;
    sortedItems.forEach(([itemId, item]) => {
      sectionHtml += this._renderItem(item, lang, currency);
    });
    sectionHtml += '</div>';

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

  renderFreeform(menuData, options = {}) {
    const design = menuData.design || {};
    const themeId = design.theme || 'luxe-noir';
    const themeDef = THEMES[themeId];
    const themeClass = themeDef?.cssClass || 'theme-luxe-noir';
    const custom = design.custom || {};
    const colors = custom.colors || {};
    const fonts = custom.fonts || {};
    const border = custom.border || {};
    const customCss = custom.css || '';
    const elements = menuData.freeformElements || {};
    const lang = menuData.meta?.primaryLanguage || 'en';
    const currency = menuData.meta?.currency || 'USD';

    // Page Background Style
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

    // Border CSS
    const borderCss = (border.style && border.style !== 'none')
      ? `border:calc((${border.width || 2} / 800) * 100cqw) ${border.style} ${border.color || '#C9A96E'}; border-radius:calc((${border.radius || 0} / 800) * 100cqw);`
      : '';

    const sortedElements = Object.entries(elements)
      .sort(([, a], [, b]) => (a.zIndex || 0) - (b.zIndex || 0));

    const elementsHtml = sortedElements.map(([id, el]) => {
      const style = el.style || {};
      let elContent = '';

      // Stacking, Opacity, and Shadows (responsive cqw offset/blur)
      const opacityStyle = style.opacity !== undefined ? `opacity: ${style.opacity};` : '';
      const shadowStyle = (style.shadowBlur || style.shadowOffsetX || style.shadowOffsetY)
        ? `box-shadow: calc((${style.shadowOffsetX || 0} / 800) * 100cqw) calc((${style.shadowOffsetY || 0} / 800) * 100cqw) calc((${style.shadowBlur || 0} / 800) * 100cqw) ${style.shadowColor || '#000000'};`
        : '';
      const nonShapeBorder = el.type !== 'shape' && el.type !== 'text'
        ? `border: calc((${style.borderWidth || 0} / 800) * 100cqw) ${style.borderStyle || 'solid'} ${style.borderColor || '#C9A96E'}; border-radius: calc((${style.borderRadius || 0} / 800) * 100cqw);`
        : '';

      if (el.type === 'text') {
        const fSize = style.fontSize || 16;
        const responsiveFontSize = `calc((${fSize} / 800) * 100cqw)`;
        elContent = `
          <div class="freeform-text-body" style="width:100%; height:100%; font-size:${responsiveFontSize}; font-family:'${style.fontFamily || 'Lato'}', sans-serif; color:${style.color || '#1A1A1A'}; text-align:${style.textAlign || 'left'}; font-weight:${style.fontWeight || 'normal'}; line-height: 1.4; word-break: break-word;">
            ${escapeHtml(el.content || '')}
          </div>
        `;
      } else if (el.type === 'image') {
        elContent = `
          <img src="${el.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}" 
               style="width:100%; height:100%; object-fit:cover; border-radius:calc((${style.borderRadius || 0} / 800) * 100cqw);" alt="Image">
        `;
      } else if (el.type === 'shape') {
        const isCircle = el.shapeType === 'circle';
        const isEllipse = el.shapeType === 'ellipse';
        const isTriangle = el.shapeType === 'triangle';
        const isStar = el.shapeType === 'star';
        
        const rawStrokeWidth = style.borderWidth || 0;
        // Stroke width is mapped relative to 100x100 viewbox coordinates inside SVG
        // To keep strokes visual thickness matched to dimensions: (strokeWidth / elementWidth) * 100
        const elWidth = el.w || 100;
        const strokeWidth = elWidth > 0 ? (rawStrokeWidth / elWidth) * 100 : rawStrokeWidth;
        
        const strokeAttr = rawStrokeWidth > 0 ? (style.borderColor || '#C9A96E') : 'none';
        const strokeDash = style.borderStyle === 'dashed' ? '5,5' : (style.borderStyle === 'dotted' ? '2,2' : 'none');
        const fillAttr = el.imageUrl ? `url(#pattern-${id})` : (style.backgroundColor || '#F8F5EE');
        
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
        elContent = contentHtml;
      } else if (el.type === 'menu-item') {
        const section = menuData.sections?.[el.sectionId];
        const item = section?.items?.[el.itemId];
        const name = item?.name?.[lang] || item?.name?.en || 'Dynamic Item Link';
        const desc = item?.description?.[lang] || item?.description?.en || 'Associated food description will populate here dynamically.';
        const price = item?.price?.type === 'market' ? 'M.P.' : formatPrice(item?.price?.value, item?.price?.currency || currency);
        
        const nameFSize = style.fontSize || 14;
        const nameResponsive = `calc((${nameFSize} / 800) * 100cqw)`;
        const descResponsive = `calc((${nameFSize - 3} / 800) * 100cqw)`;

        elContent = `
          <div class="menu-item" style="width:100%; height:100%; font-family:'${style.fontFamily || 'Lato'}', sans-serif; color:${style.color || '#1A1A1A'}; display:flex; flex-direction:column; padding:calc((6 / 800) * 100cqw); box-sizing:border-box;">
            <div class="item-header" style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:2px; font-size:${nameResponsive};">
              <span class="item-name">${escapeHtml(name)}</span>
              <span class="item-price">${price}</span>
            </div>
            <p class="item-description" style="font-size:${descResponsive}; opacity:0.75; margin:0; line-height:1.3; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHtml(desc)}</p>
          </div>
        `;
      } else if (el.type === 'qr') {
        elContent = `
          <div style="width:100%; height:100%; background:#fff; border:1px solid #ccc; display:flex; align-items:center; justify-content:center; box-sizing:border-box;">
            <svg width="80%" height="80%" viewBox="0 0 16 16" fill="none" style="color:#000;"><rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2" /><rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2" /><rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2" /><rect x="10" y="10" width="4" height="4" stroke="currentColor" stroke-width="1" /></svg>
          </div>
        `;
      } else if (el.type === 'social') {
        elContent = `
          <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; gap:8px; font-size:calc((12 / 800) * 100cqw); opacity:0.8; color:var(--theme-text);">
            🌐 Instagram · Facebook · Twitter
          </div>
        `;
      }

      // Responsive positioning styles using container query units (cqw) relative to 800px width
      const l = `calc((${el.x || 0} / 800) * 100cqw)`;
      const t = `calc((${el.y || 0} / 800) * 100cqw)`; 
      const w = `calc((${el.w || 100} / 800) * 100cqw)`;
      const h = `calc((${el.h || 100} / 800) * 100cqw)`;

      return `
        <div class="freeform-element" 
             style="position:absolute; left:${l}; top:${t}; width:${w}; height:${h}; z-index:${el.zIndex || 10}; transform: rotate(${el.rotation || 0}deg); ${opacityStyle} ${shadowStyle} ${nonShapeBorder}">
          ${elContent}
        </div>
      `;
    }).join('');

    return `
      <div class="menu-page menu-preview ${themeClass}" id="menu-page-freeform"
           style="width:100%; max-width:800px; aspect-ratio: 800 / 1130; position:relative; container-type: inline-size; box-sizing:border-box; overflow:hidden;
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

        <div class="menu-preview ${themeClass}" id="menu-preview" style="width:100%; height:100%; position:relative; background:transparent;">
          ${elementsHtml}
        </div>
        ${customCss ? `<style>${customCss}</style>` : ''}
      </div>
    `;
  }
}

export default MenuRenderer;
export { MenuRenderer };
