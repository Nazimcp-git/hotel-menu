/* ============================================
   MenuForge — Section Management
   Add, remove, reorder, duplicate sections
   ============================================ */

import db from '../db.js';
import { state, toast } from '../app.js';
import { shortId, deepClone } from '../utils/helpers.js';
import { t } from '../utils/i18n.js';

// Section type definitions
const SECTION_TYPES = {
  header: {
    type: 'header',
    label: 'Header / Cover',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M5 7h6M6 9.5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    description: 'Title and branding section',
    defaultData: {
      header: {
        title: { en: 'Menu Title' },
        subtitle: { en: 'Subtitle or tagline' },
        icon: null,
        titleStyle: { fontSize: 'xl', weight: 700, align: 'center' }
      },
      items: {}
    }
  },
  category: {
    type: 'category',
    label: 'Category Section',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    description: 'Group of menu items with a heading',
    defaultData: {
      header: {
        title: { en: 'Category Name' },
        subtitle: { en: '' },
        icon: null,
        titleStyle: { fontSize: 'lg', weight: 600, align: 'center' }
      },
      items: {}
    }
  },
  chefSpecial: {
    type: 'chefSpecial',
    label: "Chef's Special",
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.76 5.41H15l-4.24 3.08L12.53 15 8 11.18 3.47 15l1.77-5.51L1 6.41h5.24L8 1z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    description: 'Featured hero item with large image',
    defaultData: {
      header: {
        title: { en: "Chef's Special" },
        subtitle: { en: 'Our signature creation' },
        icon: 'star',
        titleStyle: { fontSize: 'lg', weight: 700, align: 'center' }
      },
      items: {}
    }
  },
  beverageList: {
    type: 'beverageList',
    label: 'Beverage List',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 2h8l-1 12H5L4 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 5h10" stroke="currentColor" stroke-width="1.5"/></svg>',
    description: 'Compact table format for drinks',
    defaultData: {
      header: {
        title: { en: 'Beverages' },
        subtitle: { en: '' },
        icon: null,
        titleStyle: { fontSize: 'lg', weight: 600, align: 'center' }
      },
      items: {}
    }
  },
  wineList: {
    type: 'wineList',
    label: 'Wine List',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 2h6v4c0 2-1.5 3-3 3S5 8 5 6V2z" stroke="currentColor" stroke-width="1.5"/><path d="M8 9v4M5 13h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    description: 'With vintage, region, by-glass/bottle pricing',
    defaultData: {
      header: {
        title: { en: 'Wine Selection' },
        subtitle: { en: '' },
        icon: null,
        titleStyle: { fontSize: 'lg', weight: 600, align: 'center' }
      },
      items: {}
    }
  },
  dessertMenu: {
    type: 'dessertMenu',
    label: 'Dessert Menu',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 10c0-4 4-7 4-7s4 3 4 7c0 2-1 3-4 3s-4-1-4-3z" stroke="currentColor" stroke-width="1.5"/><path d="M8 13v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    description: 'Sweet endings section',
    defaultData: {
      header: {
        title: { en: 'Desserts' },
        subtitle: { en: 'Sweet endings' },
        icon: null,
        titleStyle: { fontSize: 'lg', weight: 600, align: 'center' }
      },
      items: {}
    }
  },
  kidsMenu: {
    type: 'kidsMenu',
    label: 'Kids Menu',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    description: 'Special menu for young guests',
    defaultData: {
      header: {
        title: { en: 'Kids Menu' },
        subtitle: { en: 'For our young guests' },
        icon: null,
        titleStyle: { fontSize: 'lg', weight: 600, align: 'center' }
      },
      items: {}
    }
  },
  allergyInfo: {
    type: 'allergyInfo',
    label: 'Allergy Information',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3M8 10h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    description: 'Allergen legend and dietary info',
    defaultData: {
      header: {
        title: { en: 'Allergy Information' },
        subtitle: { en: 'Please inform your server of any allergies' },
        icon: null,
        titleStyle: { fontSize: 'md', weight: 600, align: 'center' }
      },
      items: {}
    }
  },
  textBlock: {
    type: 'textBlock',
    label: 'Text Block',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3h10M3 6.5h7M3 10h10M3 13h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    description: 'Free text content block',
    defaultData: {
      header: {
        title: { en: '' },
        subtitle: { en: '' },
        icon: null,
        titleStyle: { fontSize: 'md', weight: 400, align: 'left' }
      },
      content: { en: 'Enter your text here...' },
      items: {}
    }
  },
  spacer: {
    type: 'spacer',
    label: 'Spacer / Divider',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 3"/></svg>',
    description: 'Visual separator between sections',
    defaultData: {
      header: { title: {}, subtitle: {} },
      items: {}
    }
  },
  pageBreak: {
    type: 'pageBreak',
    label: 'Page Break',
    icon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h3M11 8h3M7 8h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2 3v10M14 3v10" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/></svg>',
    description: 'Force a new page in print',
    defaultData: {
      header: { title: {}, subtitle: {} },
      items: {}
    }
  }
};

class SectionsManager {
  constructor(editorState) {
    this.editorState = editorState;
    this.draggedSection = null;
  }

  /**
   * Get section type definitions
   */
  getSectionTypes() {
    return SECTION_TYPES;
  }

  /**
   * Add a new section to the menu
   */
  async addSection(type, insertIndex = null) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    if (!hotelId || !menuId) return;

    const typeDef = SECTION_TYPES[type];
    if (!typeDef) return;

    const sections = this.editorState.sections || {};
    const maxOrder = Object.values(sections).reduce((max, s) => Math.max(max, s.order || 0), -1);
    const order = insertIndex !== null ? insertIndex : maxOrder + 1;

    // Shift existing sections if inserting
    if (insertIndex !== null) {
      const updates = {};
      for (const [id, section] of Object.entries(sections)) {
        if (section.order >= insertIndex) {
          updates[`${id}/order`] = section.order + 1;
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.update(`hotels/${hotelId}/menus/${menuId}/sections`, updates);
      }
    }

    const sectionData = {
      type: typeDef.type,
      order,
      visible: true,
      visibilityHours: null,
      background: null,
      ...deepClone(typeDef.defaultData)
    };

    try {
      const sectionId = await db.push(`hotels/${hotelId}/menus/${menuId}/sections`, sectionData);
      toast.success(t('toast.sectionAdded'));
      return sectionId;
    } catch (error) {
      toast.error('Failed to add section');
      return null;
    }
  }

  /**
   * Delete a section
   */
  async deleteSection(sectionId) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;

    try {
      await db.delete(`hotels/${hotelId}/menus/${menuId}/sections/${sectionId}`);
      toast.success(t('toast.sectionDeleted'));
    } catch (error) {
      toast.error('Failed to delete section');
    }
  }

  /**
   * Duplicate a section
   */
  async duplicateSection(sectionId) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;

    try {
      const sectionData = await db.get(`hotels/${hotelId}/menus/${menuId}/sections/${sectionId}`);
      if (!sectionData) return;

      const clone = deepClone(sectionData);
      clone.order = (clone.order || 0) + 0.5; // Will be normalized

      const newId = await db.push(`hotels/${hotelId}/menus/${menuId}/sections`, clone);
      await this.normalizeOrder();
      return newId;
    } catch (error) {
      toast.error('Failed to duplicate section');
    }
  }

  /**
   * Move section up
   */
  async moveSection(sectionId, direction) {
    const sections = this.editorState.sections || {};
    const sorted = Object.entries(sections)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    const idx = sorted.findIndex(([id]) => id === sectionId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;

    // Swap orders
    const [currentId, currentSection] = sorted[idx];
    const [targetId, targetSection] = sorted[targetIdx];

    try {
      await db.update(`hotels/${hotelId}/menus/${menuId}/sections`, {
        [`${currentId}/order`]: targetSection.order,
        [`${targetId}/order`]: currentSection.order
      });
    } catch (error) {
      toast.error('Failed to move section');
    }
  }

  /**
   * Reorder section via drag-drop (move to new index)
   */
  async reorderSection(sectionId, newIndex) {
    const sections = this.editorState.sections || {};
    const sorted = Object.entries(sections)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0))
      .map(([id]) => id);

    const currentIdx = sorted.indexOf(sectionId);
    if (currentIdx === -1 || currentIdx === newIndex) return;

    // Remove and insert
    sorted.splice(currentIdx, 1);
    sorted.splice(newIndex, 0, sectionId);

    // Update all orders
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    const updates = {};
    sorted.forEach((id, i) => {
      updates[`${id}/order`] = i;
    });

    try {
      await db.update(`hotels/${hotelId}/menus/${menuId}/sections`, updates);
    } catch (error) {
      toast.error('Failed to reorder sections');
    }
  }

  /**
   * Normalize section order (0, 1, 2, ...)
   */
  async normalizeOrder() {
    const sections = this.editorState.sections || {};
    const sorted = Object.entries(sections)
      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    const updates = {};
    sorted.forEach(([id], i) => {
      updates[`${id}/order`] = i;
    });

    await db.update(`hotels/${hotelId}/menus/${menuId}/sections`, updates);
  }

  /**
   * Update section data
   */
  async updateSection(sectionId, data) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;

    try {
      await db.update(`hotels/${hotelId}/menus/${menuId}/sections/${sectionId}`, data);
    } catch (error) {
      toast.error('Failed to update section');
    }
  }

  /**
   * Render section palette (left panel)
   */
  renderPalette(container) {
    container.innerHTML = Object.values(SECTION_TYPES).map(type => `
      <div class="section-palette__item" draggable="true" data-section-type="${type.type}">
        <div class="section-palette__item-icon">${type.icon}</div>
        <div class="section-palette__item-info">
          <div class="section-palette__item-name">${type.label}</div>
          <div class="section-palette__item-desc">${type.description}</div>
        </div>
      </div>
    `).join('');

    // Drag events for palette items
    container.querySelectorAll('.section-palette__item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.sectionType);
        e.dataTransfer.effectAllowed = 'copy';
        item.style.opacity = '0.5';
      });

      item.addEventListener('dragend', () => {
        item.style.opacity = '';
      });

      // Click to add
      item.addEventListener('click', async () => {
        const newSecId = await this.addSection(item.dataset.sectionType);
        if (newSecId && window.canvas) {
          window.canvas.selectedSectionId = newSecId;
          window.canvas.selectedItemId = null;
          window.canvas.onSectionSelect(newSecId);
          window.canvas._highlightSelected();
        }
      });
    });
  }
}

export default SectionsManager;
export { SectionsManager, SECTION_TYPES };
