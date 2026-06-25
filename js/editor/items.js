/* ============================================
   MenuForge — Menu Item CRUD
   Full item editing with all field types
   ============================================ */

import db from '../db.js';
import { state, toast } from '../app.js';
import { shortId, deepClone } from '../utils/helpers.js';
import { t } from '../utils/i18n.js';
import imageKit from '../imagekit.js';


// Dietary badges definitions
const DIETARY_BADGES = [
  { id: 'vegetarian', label: 'Vegetarian', icon: '🌿', color: '#16A34A' },
  { id: 'vegan', label: 'Vegan', icon: '🌱', color: '#22C55E' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: '🌾', color: '#CA8A04' },
  { id: 'halal', label: 'Halal', icon: '☪', color: '#2563EB' },
  { id: 'kosher', label: 'Kosher', icon: '✡', color: '#7C3AED' },
  { id: 'dairy-free', label: 'Dairy-Free', icon: '🥛', color: '#0891B2' },
  { id: 'nut-free', label: 'Nut-Free', icon: '🥜', color: '#DC2626' },
  { id: 'organic', label: 'Organic', icon: '🌎', color: '#16A34A' },
  { id: 'raw', label: 'Raw', icon: '🥬', color: '#65A30D' },
  { id: 'keto', label: 'Keto', icon: '🥑', color: '#059669' },
  { id: 'low-cal', label: 'Low-Cal', icon: '🔥', color: '#EA580C' },
  { id: 'signature', label: 'Signature', icon: '⭐', color: '#D97706' },
  { id: 'chefs-pick', label: "Chef's Pick", icon: '👨‍🍳', color: '#7C3AED' },
  { id: 'new', label: 'New', icon: '🆕', color: '#2563EB' },
  { id: 'spicy', label: 'Spicy', icon: '🌶', color: '#DC2626' },
  { id: 'alcohol', label: 'Contains Alcohol', icon: '🍷', color: '#9333EA' }
];

// EU Allergens
const EU_ALLERGENS = [
  { id: 'celery', label: 'Celery' },
  { id: 'cereals', label: 'Cereals (Gluten)' },
  { id: 'crustaceans', label: 'Crustaceans' },
  { id: 'eggs', label: 'Eggs' },
  { id: 'fish', label: 'Fish' },
  { id: 'lupin', label: 'Lupin' },
  { id: 'milk', label: 'Milk' },
  { id: 'molluscs', label: 'Molluscs' },
  { id: 'mustard', label: 'Mustard' },
  { id: 'nuts', label: 'Tree Nuts' },
  { id: 'peanuts', label: 'Peanuts' },
  { id: 'sesame', label: 'Sesame' },
  { id: 'soya', label: 'Soya' },
  { id: 'sulphites', label: 'Sulphites' }
];

class ItemsManager {
  constructor(editorState) {
    this.editorState = editorState;
  }

  /**
   * Add a new item to a section
   */
  async addItem(sectionId, itemData = {}) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    if (!hotelId || !menuId) return null;

    const section = this.editorState.sections?.[sectionId];
    const items = section?.items || {};
    const maxOrder = Object.values(items).reduce((max, item) => Math.max(max, item.order || 0), -1);

    const lang = this.editorState.primaryLanguage || 'en';

    const newItem = {
      order: maxOrder + 1,
      name: { [lang]: itemData.name || 'New Item' },
      description: { [lang]: itemData.description || '' },
      price: {
        type: itemData.priceType || 'single',
        value: itemData.price || 0,
        currency: this.editorState.currency || 'USD'
      },
      image: null,
      dietary: [],
      allergens: [],
      calories: null,
      servingSize: '',
      spiceLevel: 0,
      status: 'available',
      badges: [],
      pairingNote: {},
      itemNumber: '',
      visibilityHours: null,
      internalNote: '',
      sortWeight: 0,
      ...itemData
    };

    try {
      const itemId = await db.push(
        `hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items`,
        newItem
      );
      toast.success(t('toast.itemAdded'));
      return itemId;
    } catch (error) {
      toast.error('Failed to add item');
      return null;
    }
  }

  /**
   * Update an item
   */
  async updateItem(sectionId, itemId, data) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;

    try {
      await db.update(
        `hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items/${itemId}`,
        data
      );
    } catch (error) {
      toast.error('Failed to update item');
    }
  }

  /**
   * Delete an item
   */
  async deleteItem(sectionId, itemId) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;

    try {
      await db.delete(
        `hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items/${itemId}`
      );
      toast.success(t('toast.itemDeleted'));
    } catch (error) {
      toast.error('Failed to delete item');
    }
  }

  /**
   * Duplicate an item
   */
  async duplicateItem(sectionId, itemId) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;

    try {
      const itemData = await db.get(
        `hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items/${itemId}`
      );
      if (!itemData) return;

      const clone = deepClone(itemData);
      const lang = this.editorState.primaryLanguage || 'en';
      if (clone.name?.[lang]) {
        clone.name[lang] += ' (Copy)';
      }
      clone.order = (clone.order || 0) + 0.5;

      return await db.push(
        `hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items`,
        clone
      );
    } catch (error) {
      toast.error('Failed to duplicate item');
    }
  }

  /**
   * Reorder items within a section
   */
  async reorderItem(sectionId, itemId, newIndex) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    const section = this.editorState.sections?.[sectionId];
    if (!section?.items) return;

    const sorted = Object.entries(section.items)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0))
      .map(([id]) => id);

    const currentIdx = sorted.indexOf(itemId);
    if (currentIdx === -1 || currentIdx === newIndex) return;

    sorted.splice(currentIdx, 1);
    sorted.splice(newIndex, 0, itemId);

    const updates = {};
    sorted.forEach((id, i) => {
      updates[`${id}/order`] = i;
    });

    try {
      await db.update(
        `hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items`,
        updates
      );
    } catch (error) {
      toast.error('Failed to reorder items');
    }
  }

  /**
   * Render item editor panel (right panel)
   */
  renderItemEditor(container, sectionId, itemId) {
    const section = this.editorState.sections?.[sectionId];
    const item = section?.items?.[itemId];
    if (!item) {
      container.innerHTML = '<p class="text-muted text-center p-4">Select an item to edit</p>';
      return;
    }

    const lang = this.editorState.primaryLanguage || 'en';

    container.innerHTML = `
      <div class="editor-right__header">
        <h3 class="editor-right__title">Edit Item</h3>
        <button class="btn btn--icon" id="close-item-editor" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="tabs" role="tablist">
        <button class="tab tab--active" data-tab="basic" role="tab">${t('item.tabBasic')}</button>
        <button class="tab" data-tab="media" role="tab">${t('item.tabMedia')}</button>
        <button class="tab" data-tab="dietary" role="tab">${t('item.tabDietary')}</button>
        <button class="tab" data-tab="advanced" role="tab">${t('item.tabAdvanced')}</button>
      </div>

      <div class="editor-right__content">
        <!-- Basic Info Tab -->
        <div class="tab-panel tab-panel--active" id="tab-basic">
          <div class="prop-section">
            <div class="prop-row">
              <label class="prop-label">${t('item.name')}</label>
              <input type="text" class="input" id="item-name" value="${item.name?.[lang] || ''}" placeholder="Item name">
            </div>
            <div class="prop-row">
              <label class="prop-label">${t('item.description')}</label>
              <textarea class="input" id="item-description" rows="3" placeholder="Item description">${item.description?.[lang] || ''}</textarea>
            </div>
          </div>

          <div class="prop-section">
            <div class="prop-section__title">Price</div>
            <div class="prop-row">
              <label class="prop-label">Price Type</label>
              <select class="input" id="item-price-type">
                <option value="single" ${item.price?.type === 'single' ? 'selected' : ''}>Single Price</option>
                <option value="variants" ${item.price?.type === 'variants' ? 'selected' : ''}>Size Variants</option>
                <option value="custom" ${item.price?.type === 'custom' ? 'selected' : ''}>Custom Variants</option>
                <option value="weight" ${item.price?.type === 'weight' ? 'selected' : ''}>By Weight</option>
                <option value="market" ${item.price?.type === 'market' ? 'selected' : ''}>Market Price</option>
              </select>
            </div>
            <div class="prop-row" id="price-single-row">
              <label class="prop-label">Price</label>
              <input type="number" class="input" id="item-price" value="${item.price?.value || ''}" step="0.01" min="0" placeholder="0.00">
            </div>
          </div>

          <div class="prop-section">
            <div class="prop-row">
              <label class="prop-label">${t('item.itemNumber')}</label>
              <input type="text" class="input" id="item-number" value="${item.itemNumber || ''}" placeholder="e.g., S-01">
            </div>
            <div class="prop-row">
              <label class="prop-label">${t('item.status')}</label>
              <select class="input" id="item-status">
                <option value="available" ${item.status === 'available' ? 'selected' : ''}>Available</option>
                <option value="sold-out" ${item.status === 'sold-out' ? 'selected' : ''}>Sold Out</option>
                <option value="coming-soon" ${item.status === 'coming-soon' ? 'selected' : ''}>Coming Soon</option>
                <option value="seasonal" ${item.status === 'seasonal' ? 'selected' : ''}>Seasonal</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Dietary Tab -->
        <div class="tab-panel" id="tab-dietary">
          <div class="prop-section">
            <div class="prop-section__title">Dietary Badges</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${DIETARY_BADGES.map(badge => `
                <label class="toggle" style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-md);font-size:12px;cursor:pointer;${(item.dietary || []).includes(badge.id) ? 'background:var(--accent-subtle);border-color:var(--accent);' : ''}">
                  <input type="checkbox" class="toggle__input dietary-checkbox" value="${badge.id}" ${(item.dietary || []).includes(badge.id) ? 'checked' : ''}>
                  <span>${badge.icon} ${badge.label}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="prop-section">
            <div class="prop-section__title">EU Allergens (14)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              ${EU_ALLERGENS.map(allergen => `
                <label class="toggle" style="font-size:12px;">
                  <input type="checkbox" class="toggle__input allergen-checkbox" value="${allergen.id}" ${(item.allergens || []).includes(allergen.id) ? 'checked' : ''}>
                  <span class="toggle__slider" style="width:32px;height:18px;"></span>
                  <span class="toggle__label">${allergen.label}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="prop-section">
            <div class="prop-row">
              <label class="prop-label">Calories (kcal)</label>
              <input type="number" class="input" id="item-calories" value="${item.calories || ''}" placeholder="e.g., 320" min="0">
            </div>
            <div class="prop-row">
              <label class="prop-label">Serving Size</label>
              <input type="text" class="input" id="item-serving" value="${item.servingSize || ''}" placeholder="e.g., 180g">
            </div>
            <div class="prop-row">
              <label class="prop-label">Spice Level (0-5)</label>
              <div class="input-range">
                <input type="range" id="item-spice" min="0" max="5" value="${item.spiceLevel || 0}">
                <span class="range-value" id="spice-display">${'🌶'.repeat(item.spiceLevel || 0) || 'None'}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Media Tab -->
        <div class="tab-panel" id="tab-media">
          <div class="prop-section">
            <div class="prop-section__title">Item Image</div>
            <div style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:24px;text-align:center;cursor:pointer;" id="item-image-upload">
              ${item.image?.fileId
                ? `<img src="${item.image.fileId}" alt="${item.image.alt?.[lang] || ''}" style="max-width:100%;border-radius:var(--radius-md);">`
                : `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" style="margin:0 auto;color:var(--text-muted);"><path d="M4 24l7-9 5 6 3-4 9 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22" cy="10" r="3" stroke="currentColor" stroke-width="2"/><rect x="2" y="4" width="28" height="24" rx="3" stroke="currentColor" stroke-width="2"/></svg>
                  <p style="font-size:13px;color:var(--text-muted);margin-top:8px;">Click or drag to upload</p>`
              }
            </div>
            ${item.image?.fileId ? `
              <button class="btn btn--ghost btn--sm mt-2" id="btn-remove-item-image" style="color:var(--danger); width: 100%; border-color: var(--border);">
                Remove Image
              </button>
            ` : ''}

            <div class="prop-row mt-4">
              <label class="prop-label">Image Position</label>
              <select class="input" id="item-image-position">
                <option value="right" ${item.image?.position === 'right' ? 'selected' : ''}>Right</option>
                <option value="left" ${item.image?.position === 'left' ? 'selected' : ''}>Left</option>
                <option value="top" ${item.image?.position === 'top' ? 'selected' : ''}>Top</option>
                <option value="none" ${!item.image?.position || item.image?.position === 'none' ? 'selected' : ''}>No Image</option>
              </select>
            </div>

            <div class="prop-row mt-3">
              <label class="prop-label">Alt Text (Accessibility)</label>
              <input type="text" class="input" id="item-image-alt" value="${item.image?.alt?.[lang] || ''}" placeholder="Image description">
            </div>

            <div class="prop-row mt-3">
              <label class="prop-label">Aspect Ratio</label>
              <select class="input" id="item-image-ratio">
                <option value="free" ${!item.image?.ratio || item.image?.ratio === 'free' ? 'selected' : ''}>Free (Auto)</option>
                <option value="1:1" ${item.image?.ratio === '1:1' ? 'selected' : ''}>1:1 Square</option>
                <option value="4:3" ${item.image?.ratio === '4:3' ? 'selected' : ''}>4:3 Standard</option>
                <option value="16:9" ${item.image?.ratio === '16:9' ? 'selected' : ''}>16:9 Widescreen</option>
              </select>
            </div>

            <div class="prop-row mt-3">
              <label class="prop-label">Image Fit</label>
              <select class="input" id="item-image-fit">
                <option value="cover" ${!item.image?.fit || item.image?.fit === 'cover' ? 'selected' : ''}>Cover (Crop to fill)</option>
                <option value="contain" ${item.image?.fit === 'contain' ? 'selected' : ''}>Contain (Fit inside)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Advanced Tab -->
        <div class="tab-panel" id="tab-advanced">
          <div class="prop-section">
            <div class="prop-row">
              <label class="prop-label">Pairing Suggestion</label>
              <input type="text" class="input" id="item-pairing" value="${item.pairingNote?.[lang] || ''}" placeholder="Pairs well with...">
            </div>
            <div class="prop-row">
              <label class="prop-label">Internal Note (hidden from guests)</label>
              <textarea class="input" id="item-internal-note" rows="2" placeholder="Kitchen notes...">${item.internalNote || ''}</textarea>
            </div>
          </div>
        </div>
      </div>

      <div style="padding:var(--space-4);border-top:1px solid var(--border);display:flex;gap:var(--space-2);">
        <button class="btn btn--ghost btn--sm flex-1" id="btn-duplicate-item">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M10 4V2.5A1.5 1.5 0 008.5 1h-6A1.5 1.5 0 001 2.5v6A1.5 1.5 0 002.5 10H4" stroke="currentColor" stroke-width="1.2"/></svg>
          Duplicate
        </button>
        <button class="btn btn--ghost btn--sm" id="btn-delete-item" style="color:var(--danger);">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          Delete
        </button>
      </div>
    `;

    // Bind tab switching
    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
        container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));
        tab.classList.add('tab--active');
        const panel = container.querySelector(`#tab-${tab.dataset.tab}`);
        if (panel) panel.classList.add('tab-panel--active');
      });
    });

    // Bind input changes (auto-save)
    const saveField = (field, value) => {
      this.updateItem(sectionId, itemId, { [field]: value });
    };

    const nameInput = container.querySelector('#item-name');
    nameInput?.addEventListener('input', () => {
      this._debounceUpdate(sectionId, itemId, { [`name/${lang}`]: nameInput.value });
    });

    const descInput = container.querySelector('#item-description');
    descInput?.addEventListener('input', () => {
      this._debounceUpdate(sectionId, itemId, { [`description/${lang}`]: descInput.value });
    });

    const priceInput = container.querySelector('#item-price');
    priceInput?.addEventListener('input', () => {
      this._debounceUpdate(sectionId, itemId, { 'price/value': parseFloat(priceInput.value) || 0 });
    });

    const priceTypeSelect = container.querySelector('#item-price-type');
    priceTypeSelect?.addEventListener('change', () => {
      saveField('price/type', priceTypeSelect.value);
    });

    const statusSelect = container.querySelector('#item-status');
    statusSelect?.addEventListener('change', () => {
      saveField('status', statusSelect.value);
    });

    const numberInput = container.querySelector('#item-number');
    numberInput?.addEventListener('input', () => {
      this._debounceUpdate(sectionId, itemId, { itemNumber: numberInput.value });
    });

    // Dietary checkboxes
    container.querySelectorAll('.dietary-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const dietary = [...container.querySelectorAll('.dietary-checkbox:checked')].map(c => c.value);
        saveField('dietary', dietary);
      });
    });

    // Allergen checkboxes
    container.querySelectorAll('.allergen-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const allergens = [...container.querySelectorAll('.allergen-checkbox:checked')].map(c => c.value);
        saveField('allergens', allergens);
      });
    });

    // Spice level
    const spiceSlider = container.querySelector('#item-spice');
    const spiceDisplay = container.querySelector('#spice-display');
    spiceSlider?.addEventListener('input', () => {
      const val = parseInt(spiceSlider.value);
      spiceDisplay.textContent = val > 0 ? '🌶'.repeat(val) : 'None';
      saveField('spiceLevel', val);
    });

    // Calories
    const calInput = container.querySelector('#item-calories');
    calInput?.addEventListener('input', () => {
      this._debounceUpdate(sectionId, itemId, { calories: parseInt(calInput.value) || null });
    });

    // Image Upload / Drag-drop / Position
    const imageUploadZone = container.querySelector('#item-image-upload');
    const imagePositionSelect = container.querySelector('#item-image-position');
    const imageAltInput = container.querySelector('#item-image-alt');
    const imageRatioSelect = container.querySelector('#item-image-ratio');
    const imageFitSelect = container.querySelector('#item-image-fit');
    const removeImageBtn = container.querySelector('#btn-remove-item-image');

    imagePositionSelect?.addEventListener('change', () => {
      saveField('image/position', imagePositionSelect.value);
    });

    imageAltInput?.addEventListener('input', () => {
      this._debounceUpdate(sectionId, itemId, { [`image/alt/${lang}`]: imageAltInput.value });
    });

    imageRatioSelect?.addEventListener('change', () => {
      saveField('image/ratio', imageRatioSelect.value);
    });

    imageFitSelect?.addEventListener('change', () => {
      saveField('image/fit', imageFitSelect.value);
    });

    removeImageBtn?.addEventListener('click', async () => {
      const hotelId = state.get('currentHotelId');
      const menuId = this.editorState.menuId;
      await db.update(`hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items/${itemId}/image`, null);
      toast.success('Image removed');
      this.renderItemEditor(container, sectionId, itemId);
    });

    if (imageUploadZone) {
      // Direct click upload
      imageUploadZone.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (file) {
            await handleUpload(file);
          }
        });
        fileInput.click();
      });

      // Drag and drop onto upload zone
      imageUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadZone.style.borderColor = 'var(--accent)';
        imageUploadZone.style.background = 'var(--accent-subtle)';
      });

      imageUploadZone.addEventListener('dragleave', () => {
        imageUploadZone.style.borderColor = '';
        imageUploadZone.style.background = '';
      });

      imageUploadZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        imageUploadZone.style.borderColor = '';
        imageUploadZone.style.background = '';

        const type = e.dataTransfer.getData('type');
        const url = e.dataTransfer.getData('text/plain');

        if (type === 'media-image' && url) {
          // Drop from gallery
          saveField('image', {
            fileId: url,
            position: 'right'
          });
          toast.success('Image applied from media library');
          this.renderItemEditor(container, sectionId, itemId);
        } else if (e.dataTransfer.files.length) {
          // Drop local file
          await handleUpload(e.dataTransfer.files[0]);
        }
      });
    }

    const handleUpload = async (file) => {
      if (!imageKit.isSupported(file)) {
        toast.error('Unsupported file format. Please upload JPG, PNG, or WebP.');
        return;
      }

      const hotelId = state.get('currentHotelId');
      const menuId = this.editorState.menuId;
      const loadingId = toast.loading(`Uploading image...`);

      try {
        const result = await imageKit.upload(file, {
          hotelId,
          menuId,
          folder: `/hotels/${hotelId}/menus/${menuId}/items/`
        });

        // 1. Save to item
        await db.update(`hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items/${itemId}/image`, {
          fileId: result.url,
          position: 'right'
        });

        // 2. Save to global hotel media library
        const mediaId = db.newKey(`hotels/${hotelId}/media`);
        await db.set(`hotels/${hotelId}/media/${mediaId}`, {
          url: result.url,
          name: file.name,
          size: result.size,
          uploadedAt: Date.now()
        });

        toast.dismiss(loadingId);
        toast.success('Image uploaded successfully');
        
        // Re-render item editor to show the new image
        this.renderItemEditor(container, sectionId, itemId);
      } catch (err) {
        toast.dismiss(loadingId);
        toast.error(`Upload failed: ${err.message}`);
      }
    };

    // Duplicate / Delete buttons
    container.querySelector('#btn-duplicate-item')?.addEventListener('click', () => {
      this.duplicateItem(sectionId, itemId);
    });

    container.querySelector('#btn-delete-item')?.addEventListener('click', async () => {
      const confirmed = await import('../app.js').then(m => m.confirm(t('confirm.deleteItem')));
      if (confirmed) this.deleteItem(sectionId, itemId);
    });
  }

  // Debounced update to avoid too-frequent Firebase writes
  _debounceUpdate(sectionId, itemId, data) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      const hotelId = state.get('currentHotelId');
      const menuId = this.editorState.menuId;
      db.update(`hotels/${hotelId}/menus/${menuId}/sections/${sectionId}/items/${itemId}`, data);
    }, 500);
  }
}

export default ItemsManager;
export { ItemsManager, DIETARY_BADGES, EU_ALLERGENS };
