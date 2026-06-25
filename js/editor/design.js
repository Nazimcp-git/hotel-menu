/* ============================================
   MenuForge — Design Controls
   Theme switching, color, typography, spacing
   ============================================ */

import db from '../db.js';
import { state, toast } from '../app.js';
import { debounce } from '../utils/helpers.js';
import { contrastRatio, wcagLevel, contrastColor } from '../utils/helpers.js';

// Theme definitions
const THEMES = {
  'luxe-noir': {
    name: 'Luxe Noir',
    description: 'Fine dining elegance',
    colors: { primary: '#1A1A1A', secondary: '#C9A96E', accent: '#C9A96E', background: '#FFFFFF', text: '#2C2C2C' },
    fonts: { heading: 'Playfair Display', body: 'Lato', accent: 'Cormorant Garamond' },
    cssClass: 'theme-luxe-noir',
    tags: ['luxury', 'dark']
  },
  'minimalist-tokyo': {
    name: 'Minimalist Tokyo',
    description: 'Clean Japanese aesthetic',
    colors: { primary: '#1A1A1A', secondary: '#888888', accent: '#D4453A', background: '#FFFFFF', text: '#333333' },
    fonts: { heading: 'Noto Sans JP', body: 'Noto Sans JP', accent: 'Noto Sans JP' },
    cssClass: 'theme-minimalist-tokyo',
    tags: ['minimal', 'light']
  },
  'mediterranean': {
    name: 'Mediterranean Fresh',
    description: 'Warm terracotta vibes',
    colors: { primary: '#5B3A29', secondary: '#7B8F55', accent: '#C4704D', background: '#FDF8F3', text: '#4A3728' },
    fonts: { heading: 'Libre Baskerville', body: 'Source Sans 3', accent: 'Libre Baskerville' },
    cssClass: 'theme-mediterranean',
    tags: ['organic', 'light']
  },
  'obsidian': {
    name: 'Obsidian Feast',
    description: 'Dark luxury, gold accents',
    colors: { primary: '#F0EDE6', secondary: '#C9A96E', accent: '#C9A96E', background: '#0A0A0B', text: '#F0EDE6' },
    fonts: { heading: 'Cormorant Garamond', body: 'Jost', accent: 'Cormorant Garamond' },
    cssClass: 'theme-obsidian',
    tags: ['luxury', 'dark', 'bold']
  },
  'sakura': {
    name: 'Sakura Editorial',
    description: 'Calm minimalist magazine',
    colors: { primary: '#1A1916', secondary: '#E8C4C0', accent: '#B8827C', background: '#FAFAF8', text: '#1A1916' },
    fonts: { heading: 'Italiana', body: 'DM Sans', accent: 'Shippori Mincho B1' },
    cssClass: 'theme-sakura',
    tags: ['minimal', 'light', 'organic']
  },
  'neon': {
    name: 'Neon Izakaya',
    description: 'Urban neon nightlife',
    colors: { primary: '#F0EEFF', secondary: '#7C3AED', accent: '#E8FF3B', background: '#0E0B18', text: '#F0EEFF' },
    fonts: { heading: 'Bebas Neue', body: 'Space Grotesk', accent: 'Bebas Neue' },
    cssClass: 'theme-neon',
    tags: ['bold', 'dark']
  },
  'verdant': {
    name: 'Verdant Table',
    description: 'Organic farm-to-table',
    colors: { primary: '#2D4A2D', secondary: '#7A9E7A', accent: '#8B6F47', background: '#F3F0E8', text: '#2A2318' },
    fonts: { heading: 'Playfair Display', body: 'Lora', accent: 'Caveat' },
    cssClass: 'theme-verdant',
    tags: ['organic', 'light']
  },
  'copper': {
    name: 'Copper & Concrete',
    description: 'Industrial urban brasserie',
    colors: { primary: '#E8E4DC', secondary: '#B87333', accent: '#7A9E8E', background: '#2E2C2A', text: '#E8E4DC' },
    fonts: { heading: 'Oswald', body: 'Barlow', accent: 'Barlow Condensed' },
    cssClass: 'theme-copper',
    tags: ['bold', 'dark']
  },
  'riviera': {
    name: 'Riviera Afternoon',
    description: 'Mediterranean summer joy',
    colors: { primary: '#2C2218', secondary: '#D4724A', accent: '#4A8FA8', background: '#F8F4EE', text: '#2C2218' },
    fonts: { heading: 'Bodoni Moda', body: 'Source Serif 4', accent: 'Bodoni Moda' },
    cssClass: 'theme-riviera',
    tags: ['light', 'organic']
  },
  'blueprint': {
    name: 'Blueprint',
    description: 'Technical precision grid',
    colors: { primary: '#8CB4F0', secondary: '#8CB4F0', accent: '#FFFFFF', background: '#0F2040', text: '#8CB4F0' },
    fonts: { heading: 'Share Tech Mono', body: 'Share Tech Mono', accent: 'Share Tech Mono' },
    cssClass: 'theme-blueprint',
    tags: ['minimal', 'dark', 'bold']
  },
  'saffron': {
    name: 'Saffron Souk',
    description: 'Moroccan ornamental warmth',
    colors: { primary: '#2A1C0E', secondary: '#E8A020', accent: '#C0392B', background: '#FAF3E8', text: '#2A1C0E' },
    fonts: { heading: 'Amiri', body: 'Lora', accent: 'Cinzel' },
    cssClass: 'theme-saffron',
    tags: ['bold', 'light', 'organic']
  },
  'aurora': {
    name: 'Aurora Borealis',
    description: 'Ethereal gradients, glass',
    colors: { primary: '#E8EDF5', secondary: '#7B68EE', accent: '#00D4AA', background: '#0C0E1A', text: '#E8EDF5' },
    fonts: { heading: 'Outfit', body: 'Inter', accent: 'Outfit' },
    cssClass: 'theme-aurora',
    tags: ['luxury', 'dark', 'bold']
  },
  'typewriter': {
    name: 'Typewriter',
    description: 'Nostalgic literary charm',
    colors: { primary: '#1C1810', secondary: '#8B4513', accent: '#C0392B', background: '#F5F0E6', text: '#1C1810' },
    fonts: { heading: 'Special Elite', body: 'Courier Prime', accent: 'Special Elite' },
    cssClass: 'theme-typewriter',
    tags: ['minimal', 'light', 'classic']
  },
  'blossom': {
    name: 'Blossom Garden',
    description: 'Elevated botanical elegance',
    colors: { primary: '#D4748A', secondary: '#7A9E6A', accent: '#B8902A', background: '#FEF9F5', text: '#2A1E1A' },
    fonts: { heading: 'Great Vibes', body: 'Cormorant Garamond', accent: 'Pinyon Script' },
    cssClass: 'theme-blossom',
    tags: ['classic', 'light', 'organic', 'luxury']
  },
  'noir': {
    name: 'Royal Noir',
    description: 'Dark gold & black classic',
    colors: { primary: '#C9A020', secondary: '#7A6014', accent: '#8B1A1A', background: '#111010', text: '#F0EAD8' },
    fonts: { heading: 'Cinzel Decorative', body: 'EB Garamond', accent: 'IM Fell English' },
    cssClass: 'theme-noir',
    tags: ['classic', 'dark', 'luxury']
  },
  'paris': {
    name: 'Café de Paris',
    description: 'French Brasserie Art Nouveau',
    colors: { primary: '#2A4A30', secondary: '#C05A38', accent: '#A87820', background: '#F5EFE0', text: '#1E1810' },
    fonts: { heading: 'Petit Formal Script', body: 'Libre Baskerville', accent: 'Libre Baskerville' },
    cssClass: 'theme-paris',
    tags: ['classic', 'light', 'organic', 'luxury']
  },
  'japanese-ink': {
    name: 'Japanese Ink',
    description: 'Wabi-sabi brush & sumi ink',
    colors: { primary: '#111008', secondary: '#C42028', accent: '#7A7468', background: '#F8F5EE', text: '#111008' },
    fonts: { heading: 'Noto Serif JP', body: 'Cormorant Garamond', accent: 'Shippori Mincho' },
    cssClass: 'theme-ink',
    tags: ['classic', 'light', 'minimal']
  },
  'deco': {
    name: 'Golden Age Deco',
    description: 'Art Deco 1920s geometric glamour',
    colors: { primary: '#D4AA50', secondary: '#B85A30', accent: '#D4AA50', background: '#0E1A30', text: '#F8F2DC' },
    fonts: { heading: 'Poiret One', body: 'Josefin Sans', accent: 'Josefin Sans' },
    cssClass: 'theme-deco',
    tags: ['classic', 'dark', 'luxury', 'bold']
  }
};

class DesignManager {
  constructor(editorState) {
    this.editorState = editorState;
  }

  /**
   * Get all available themes
   */
  getThemes() {
    return THEMES;
  }

  /**
   * Get current theme config
   */
  getCurrentTheme() {
    const themeId = this.editorState.design?.theme || 'luxe-noir';
    return THEMES[themeId] || THEMES['luxe-noir'];
  }

  /**
   * Switch theme
   */
  async setTheme(themeId) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    if (!THEMES[themeId]) return;

    const theme = THEMES[themeId];
    try {
      await db.update(`hotels/${hotelId}/menus/${menuId}/design`, {
        theme: themeId,
        'custom/colors': theme.colors,
        'custom/fonts': theme.fonts
      });
      toast.success(`Theme changed to ${theme.name}`);
    } catch (error) {
      toast.error('Failed to change theme');
    }
  }

  /**
   * Update custom design property
   */
  async updateDesign(path, value) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;

    try {
      await db.update(`hotels/${hotelId}/menus/${menuId}/design/custom`, {
        [path]: value
      });
    } catch (error) {
      toast.error('Failed to update design');
    }
  }

  /**
   * Render design panel (left panel Design tab or right panel when nothing selected)
   */
  renderDesignPanel(container) {
    const design = this.editorState.design || {};
    const custom = design.custom || {};
    const colors = custom.colors || {};
    const fonts = custom.fonts || {};
    const spacing = custom.spacing || {};

    container.innerHTML = `
      <!-- Theme Selector -->
      <div class="prop-section">
        <div class="prop-section__title">Theme</div>
        
        <!-- Theme Category Filter Tabs -->
        <div class="theme-filters" style="display:flex;gap:4px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;scrollbar-width:none;-ms-overflow-style:none;">
          <button class="btn btn--xs btn--active theme-filter-btn" data-filter="all" style="padding:2px 8px;font-size:10px;white-space:nowrap;">All</button>
          <button class="btn btn--xs btn--ghost theme-filter-btn" data-filter="dark" style="padding:2px 8px;font-size:10px;white-space:nowrap;">Dark</button>
          <button class="btn btn--xs btn--ghost theme-filter-btn" data-filter="light" style="padding:2px 8px;font-size:10px;white-space:nowrap;">Light</button>
          <button class="btn btn--xs btn--ghost theme-filter-btn" data-filter="minimal" style="padding:2px 8px;font-size:10px;white-space:nowrap;">Minimal</button>
          <button class="btn btn--xs btn--ghost theme-filter-btn" data-filter="bold" style="padding:2px 8px;font-size:10px;white-space:nowrap;">Bold</button>
          <button class="btn btn--xs btn--ghost theme-filter-btn" data-filter="organic" style="padding:2px 8px;font-size:10px;white-space:nowrap;">Organic</button>
          <button class="btn btn--xs btn--ghost theme-filter-btn" data-filter="luxury" style="padding:2px 8px;font-size:10px;white-space:nowrap;">Luxury</button>
          <button class="btn btn--xs btn--ghost theme-filter-btn" data-filter="classic" style="padding:2px 8px;font-size:10px;white-space:nowrap;">📜 Classic</button>
        </div>

        <!-- Classic Info Box -->
        <div class="classic-info-box" style="margin-bottom:8px;padding:8px;background:rgba(201,169,110,0.1);border:1px solid rgba(201,169,110,0.3);border-radius:4px;font-size:11px;display:none;line-height:1.4;">
          <strong style="color:#C9A96E;">Classic Price-List Style</strong><br>
          Beautiful text-only menus. No food photos needed. Print-perfect. Timeless. Fast to build.
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;max-height:300px;overflow-y:auto;padding:2px;">
          ${Object.entries(THEMES).map(([id, theme]) => `
            <div class="theme-preview-card ${design.theme === id ? 'theme-preview-card--active' : ''}" data-theme="${id}" data-tags="${(theme.tags || []).join(',')}">
              <div class="theme-preview-card__swatch">
                <div class="theme-preview-card__swatch-color" style="background:${theme.colors.primary};"></div>
                <div class="theme-preview-card__swatch-color" style="background:${theme.colors.secondary};"></div>
                <div class="theme-preview-card__swatch-color" style="background:${theme.colors.background};"></div>
              </div>
              <div class="theme-preview-card__name">${theme.name}</div>
              <div class="theme-preview-card__check">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Colors -->
      <div class="prop-section">
        <div class="prop-section__title">Colors</div>
        ${['primary', 'secondary', 'accent', 'background', 'text'].map(colorKey => `
          <div class="prop-row prop-row--inline">
            <label class="prop-label" style="text-transform:capitalize;">${colorKey}</label>
            <div class="input-color">
              <input type="color" value="${colors[colorKey] || '#000000'}" data-color="${colorKey}">
              <input type="text" class="input" value="${colors[colorKey] || '#000000'}" data-color-text="${colorKey}" style="width:80px;font-size:11px;">
            </div>
          </div>
        `).join('')}
        ${colors.text && colors.background ? `
          <div style="margin-top:8px;padding:8px;background:var(--app-bg-subtle);border-radius:var(--radius-md);font-size:11px;">
            <span>Contrast: ${contrastRatio(colors.text, colors.background).toFixed(1)}:1</span>
            <span class="badge ${wcagLevel(contrastRatio(colors.text, colors.background)) === 'Fail' ? 'badge--danger' : 'badge--active'}" style="margin-left:8px;">
              WCAG ${wcagLevel(contrastRatio(colors.text, colors.background))}
            </span>
          </div>
        ` : ''}
      </div>

      <!-- Typography -->
      <div class="prop-section">
        <div class="prop-section__title">Typography</div>
        <div class="prop-row">
          <label class="prop-label">Heading Font</label>
          <select class="input" id="design-heading-font">
            ${this._fontOptions(fonts.heading || 'Playfair Display')}
          </select>
        </div>
        <div class="prop-row">
          <label class="prop-label">Body Font</label>
          <select class="input" id="design-body-font">
            ${this._fontOptions(fonts.body || 'Lato')}
          </select>
        </div>
      </div>

      <!-- Spacing -->
      <div class="prop-section">
        <div class="prop-section__title">Spacing</div>
        <div class="prop-row">
          <label class="prop-label">Section Gap</label>
          <div class="input-range">
            <input type="range" id="design-section-gap" min="8" max="64" value="${spacing.sectionGap || 24}">
            <span class="range-value">${spacing.sectionGap || 24}px</span>
          </div>
        </div>
        <div class="prop-row">
          <label class="prop-label">Item Gap</label>
          <div class="input-range">
            <input type="range" id="design-item-gap" min="4" max="32" value="${spacing.itemGap || 12}">
            <span class="range-value">${spacing.itemGap || 12}px</span>
          </div>
        </div>
        <div class="prop-row">
          <label class="prop-label">Page Margins (mm)</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <input type="number" class="input" id="margin-top" value="${spacing.pageMarginTop || 20}" placeholder="Top" style="font-size:12px;">
            <input type="number" class="input" id="margin-right" value="${spacing.pageMarginRight || 15}" placeholder="Right" style="font-size:12px;">
            <input type="number" class="input" id="margin-bottom" value="${spacing.pageMarginBottom || 20}" placeholder="Bottom" style="font-size:12px;">
            <input type="number" class="input" id="margin-left" value="${spacing.pageMarginLeft || 15}" placeholder="Left" style="font-size:12px;">
          </div>
        </div>
      </div>
    `;

    this._bindDesignEvents(container);
  }

  _fontOptions(selected) {
    const fonts = [
      'Playfair Display', 'Lato', 'Cormorant Garamond', 'Noto Sans JP',
      'Libre Baskerville', 'Source Sans 3', 'Merriweather', 'Inter',
      'Outfit', 'DM Serif Display', 'Crimson Pro'
    ];
    return fonts.map(f => `<option value="${f}" ${f === selected ? 'selected' : ''} style="font-family:'${f}'">${f}</option>`).join('');
  }

  _bindDesignEvents(container) {
    const debouncedUpdate = debounce((path, value) => this.updateDesign(path, value), 300);

    // Theme cards
    // Theme filters
    const filterBtns = container.querySelectorAll('.theme-filter-btn');
    const themeCards = container.querySelectorAll('.theme-preview-card');
    const classicInfoBox = container.querySelector('.classic-info-box');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.classList.remove('btn--active');
          b.classList.add('btn--ghost');
        });
        btn.classList.add('btn--active');
        btn.classList.remove('btn--ghost');

        const filter = btn.dataset.filter;
        
        if (classicInfoBox) {
          classicInfoBox.style.display = filter === 'classic' ? 'block' : 'none';
        }

        themeCards.forEach(card => {
          const tags = card.dataset.tags ? card.dataset.tags.split(',') : [];
          if (filter === 'all' || tags.includes(filter)) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // Theme cards
    themeCards.forEach(card => {
      card.addEventListener('click', () => {
        this.setTheme(card.dataset.theme);
      });
    });

    // Color pickers
    container.querySelectorAll('input[type="color"][data-color]').forEach(picker => {
      picker.addEventListener('input', (e) => {
        const key = e.target.dataset.color;
        const textInput = container.querySelector(`input[data-color-text="${key}"]`);
        if (textInput) textInput.value = e.target.value;
        debouncedUpdate(`colors/${key}`, e.target.value);
      });
    });

    // Color text inputs
    container.querySelectorAll('input[data-color-text]').forEach(input => {
      input.addEventListener('change', (e) => {
        const key = e.target.dataset.colorText;
        const colorPicker = container.querySelector(`input[type="color"][data-color="${key}"]`);
        if (colorPicker && /^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
          colorPicker.value = e.target.value;
          debouncedUpdate(`colors/${key}`, e.target.value);
        }
      });
    });

    // Font selects
    container.querySelector('#design-heading-font')?.addEventListener('change', (e) => {
      this.updateDesign('fonts/heading', e.target.value);
    });
    container.querySelector('#design-body-font')?.addEventListener('change', (e) => {
      this.updateDesign('fonts/body', e.target.value);
    });

    // Spacing sliders
    const sectionGap = container.querySelector('#design-section-gap');
    sectionGap?.addEventListener('input', (e) => {
      e.target.nextElementSibling.textContent = e.target.value + 'px';
      debouncedUpdate('spacing/sectionGap', parseInt(e.target.value));
    });

    const itemGap = container.querySelector('#design-item-gap');
    itemGap?.addEventListener('input', (e) => {
      e.target.nextElementSibling.textContent = e.target.value + 'px';
      debouncedUpdate('spacing/itemGap', parseInt(e.target.value));
    });

    // Margins
    ['top', 'right', 'bottom', 'left'].forEach(side => {
      const input = container.querySelector(`#margin-${side}`);
      input?.addEventListener('change', () => {
        debouncedUpdate(`spacing/pageMargin${side.charAt(0).toUpperCase() + side.slice(1)}`, parseInt(input.value) || 0);
      });
    });
  }
}

export default DesignManager;
export { DesignManager, THEMES };
