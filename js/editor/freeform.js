/* ============================================
   MenuForge — Freeform Canvas Interaction Engine
   Handles absolute positioning, resizing, rotating,
   layer manager, snapping guides, and inline text editing.
   ============================================ */

import { state, toast } from '../app.js';
import db from '../db.js';
import { debounce } from '../utils/helpers.js';

class FreeformManager {
  constructor(editorState, canvasEngine) {
    this.editorState = editorState;
    this.canvas = canvasEngine;
    this.selectedElementId = null;
    this.isDragging = false;
    this.isResizing = false;
    this.isRotating = false;
    this.snapThreshold = 8; // Snap within 8px
  }

  /**
   * Add a new freeform element to the current menu
   */
  async addElement(type, options = {}) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    const elementId = db.newKey(`hotels/${hotelId}/menus/${menuId}/freeformElements`);

    // Default styles and coordinates
    const defaultElements = {
      text: {
        type: 'text',
        x: 100, y: 100, w: 200, h: 50, rotation: 0, zIndex: 10,
        content: 'Double-click to edit text',
        style: { fontSize: 20, fontFamily: 'Playfair Display', color: '#1A1A1A', textAlign: 'left', fontWeight: 'bold' }
      },
      image: {
        type: 'image',
        x: 100, y: 200, w: 250, h: 180, rotation: 0, zIndex: 10,
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
        style: { borderRadius: 8, borderWidth: 0, borderColor: '#CCCCCC', borderStyle: 'solid' }
      },
      shape: {
        type: 'shape',
        x: 150, y: 150, w: 200, h: 150, rotation: 0, zIndex: 5,
        shapeType: 'rectangle', // 'rectangle' | 'circle'
        style: { backgroundColor: '#F8F5EE', borderWidth: 1, borderColor: '#C9A96E', borderStyle: 'solid', borderRadius: 8 }
      },
      'menu-item': {
        type: 'menu-item',
        x: 100, y: 300, w: 300, h: 100, rotation: 0, zIndex: 10,
        itemId: options.itemId || '',
        sectionId: options.sectionId || '',
        style: { fontSize: 14, fontFamily: 'Lato', color: '#1A1A1A' }
      },
      qr: {
        type: 'qr',
        x: 300, y: 300, w: 120, h: 120, rotation: 0, zIndex: 10,
        style: { borderWidth: 0, borderRadius: 0 }
      },
      social: {
        type: 'social',
        x: 200, y: 400, w: 180, h: 40, rotation: 0, zIndex: 10,
        socialLinks: [
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'facebook', url: 'https://facebook.com' }
        ],
        style: { textAlign: 'center', color: '#1A1A1A' }
      }
    };

    const newElement = {
      ...defaultElements[type],
      ...options,
      updatedAt: Date.now()
    };

    try {
      await db.set(`hotels/${hotelId}/menus/${menuId}/freeformElements/${elementId}`, newElement);
      this.selectedElementId = elementId;
      this.canvas.render();
      toast.success(`Added new ${type} layer`);
    } catch (err) {
      toast.error('Failed to add canvas element');
    }
  }

  /**
   * Delete an element
   */
  async deleteElement(elementId) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    try {
      await db.delete(`hotels/${hotelId}/menus/${menuId}/freeformElements/${elementId}`);
      if (this.selectedElementId === elementId) {
        this.selectedElementId = null;
        this.renderRightPanel(null);
      }
      this.canvas.render();
      toast.success('Layer deleted');
    } catch (err) {
      toast.error('Failed to delete layer');
    }
  }

  /**
   * Layer order operations (Bring to Front, Send to Back, Move Up, Move Down)
   */
  async reorderLayer(elementId, action) {
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    const elements = this.editorState.freeformElements || {};
    const sorted = Object.entries(elements).sort(([, a], [, b]) => (a.zIndex || 0) - (b.zIndex || 0));
    const idx = sorted.findIndex(([id]) => id === elementId);
    if (idx === -1) return;

    let targetZ = elements[elementId].zIndex || 10;
    if (action === 'front') {
      targetZ = sorted.length > 0 ? (sorted[sorted.length - 1][1].zIndex || 10) + 5 : 10;
    } else if (action === 'back') {
      targetZ = sorted.length > 0 ? Math.max(0, (sorted[0][1].zIndex || 10) - 5) : 0;
    } else if (action === 'up') {
      if (idx < sorted.length - 1) {
        targetZ = (sorted[idx + 1][1].zIndex || 10) + 1;
      }
    } else if (action === 'down') {
      if (idx > 0) {
        targetZ = Math.max(0, (sorted[idx - 1][1].zIndex || 10) - 1);
      }
    }

    try {
      await db.update(`hotels/${hotelId}/menus/${menuId}/freeformElements/${elementId}`, { zIndex: targetZ });
      this.canvas.render();
    } catch (err) {
      toast.error('Failed to change layer stack order');
    }
  }

  /**
   * Bind drag, resize, rotate mouse interactions on the canvas
   */
  bindCanvasInteractions(pageEl) {
    pageEl.querySelectorAll('.freeform-element').forEach(el => {
      const elementId = el.dataset.elementId;

      // Click to select
      el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('freeform-handle')) return; // Ignore drag clicks on handles
        e.stopPropagation();
        this.selectedElementId = elementId;
        this.canvas._highlightSelected();
        this.renderRightPanel(elementId);
        
        // Start dragging
        this.startDrag(e, el, pageEl);
      });

      // Bind double click for inline text editing
      if (el.dataset.type === 'text') {
        el.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.enableInlineTextEdit(el, elementId);
        });
      }

      // Bind resizing & rotation handles
      el.querySelectorAll('.freeform-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (handle.classList.contains('freeform-handle--rotate')) {
            this.startRotate(e, el, pageEl, elementId);
          } else {
            const direction = handle.className.match(/freeform-handle--([a-z]{2})/)[1];
            this.startResize(e, el, pageEl, elementId, direction);
          }
        });
      });
    });
  }

  /**
   * Move dragging flow
   */
  startDrag(e, el, pageEl) {
    if (this.canvas.currentMode === 'pan') return;

    this.isDragging = true;
    const startX = e.clientX;
    const startY = e.clientY;
    
    const elements = this.editorState.freeformElements || {};
    const elemData = elements[el.dataset.elementId];
    if (!elemData) return;

    const initialX = elemData.x || 0;
    const initialY = elemData.y || 0;

    const scale = this.canvas.zoom / 100;

    const onMouseMove = (moveEvent) => {
      if (!this.isDragging) return;
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;

      let newX = Math.round(initialX + dx);
      let newY = Math.round(initialY + dy);

      // Snapping guide coordinates calculations
      const snapResult = this.calculateSnapping(newX, newY, elemData.w, elemData.h, el.dataset.elementId);
      newX = snapResult.x;
      newY = snapResult.y;

      // Live visual feedback
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;

      // Draw guides
      this.drawSnapGuides(pageEl, snapResult.guides);
    };

    const onMouseUp = async () => {
      this.isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.clearSnapGuides(pageEl);

      const finalX = parseInt(el.style.left);
      const finalY = parseInt(el.style.top);

      const hotelId = state.get('currentHotelId');
      const menuId = this.editorState.menuId;

      try {
        await db.update(`hotels/${hotelId}/menus/${menuId}/freeformElements/${el.dataset.elementId}`, {
          x: finalX,
          y: finalY
        });
      } catch (err) {
        console.error('Failed to update drag coordinates:', err);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Resizing flow
   */
  startResize(e, el, pageEl, elementId, direction) {
    this.isResizing = true;
    const startX = e.clientX;
    const startY = e.clientY;

    const elements = this.editorState.freeformElements || {};
    const elemData = elements[elementId];
    if (!elemData) return;

    const initialX = elemData.x || 0;
    const initialY = elemData.y || 0;
    const initialW = elemData.w || 100;
    const initialH = elemData.h || 100;

    const scale = this.canvas.zoom / 100;
    const isShiftPressed = e.shiftKey;

    const onMouseMove = (moveEvent) => {
      if (!this.isResizing) return;
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;

      let newX = initialX;
      let newY = initialY;
      let newW = initialW;
      let newH = initialH;

      // Handle vertical/horizontal sizing calculations based on handle directions
      if (direction.includes('r')) newW = Math.max(20, initialW + dx);
      if (direction.includes('b')) newH = Math.max(20, initialH + dy);
      
      if (direction.includes('l')) {
        const potentialW = initialW - dx;
        if (potentialW > 20) {
          newW = potentialW;
          newX = initialX + dx;
        }
      }
      if (direction.includes('t')) {
        const potentialH = initialH - dy;
        if (potentialH > 20) {
          newH = potentialH;
          newY = initialY + dy;
        }
      }

      // Aspect ratio lock with shift key
      if (isShiftPressed || moveEvent.shiftKey) {
        const ratio = initialW / initialH;
        if (direction === 'br' || direction === 'tl' || direction === 'tr' || direction === 'bl') {
          newH = newW / ratio;
        }
      }

      el.style.left = `${Math.round(newX)}px`;
      el.style.top = `${Math.round(newY)}px`;
      el.style.width = `${Math.round(newW)}px`;
      el.style.height = `${Math.round(newH)}px`;
    };

    const onMouseUp = async () => {
      this.isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const hotelId = state.get('currentHotelId');
      const menuId = this.editorState.menuId;

      try {
        await db.update(`hotels/${hotelId}/menus/${menuId}/freeformElements/${elementId}`, {
          x: Math.round(parseInt(el.style.left)),
          y: Math.round(parseInt(el.style.top)),
          w: Math.round(parseInt(el.style.width)),
          h: Math.round(parseInt(el.style.height))
        });
      } catch (err) {
        console.error('Failed to save resize values:', err);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Rotation flow
   */
  startRotate(e, el, pageEl, elementId) {
    this.isRotating = true;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const onMouseMove = (moveEvent) => {
      if (!this.isRotating) return;
      
      // Calculate angle from element center to cursor
      const dx = moveEvent.clientX - centerX;
      const dy = moveEvent.clientY - centerY;
      let angle = Math.round(Math.atan2(dy, dx) * (180 / Math.PI)) - 90; // Adjust for 0 starting at top

      // Snap to 15-degree increments with Shift key
      if (moveEvent.shiftKey) {
        angle = Math.round(angle / 15) * 15;
      }

      el.style.transform = `rotate(${angle}deg)`;
    };

    const onMouseUp = async () => {
      this.isRotating = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      const matches = el.style.transform.match(/rotate\(([-0-9]+)deg\)/);
      const angle = matches ? parseInt(matches[1]) : 0;

      const hotelId = state.get('currentHotelId');
      const menuId = this.editorState.menuId;

      try {
        await db.update(`hotels/${hotelId}/menus/${menuId}/freeformElements/${elementId}`, {
          rotation: angle
        });
      } catch (err) {
        console.error('Failed to save rotation values:', err);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Alignment snap guides engine
   */
  calculateSnapping(x, y, w, h, currentId) {
    const elements = this.editorState.freeformElements || {};
    const guides = [];
    
    // Default snapping lines (Page Margins: 20px, Page Centers)
    const pageMargins = [20, 780, 20, 1110]; // left, right, top, bottom
    const pageCenterX = 400;
    const pageCenterY = 565;

    // Check page horizontal center
    if (Math.abs((x + w / 2) - pageCenterX) < this.snapThreshold) {
      x = pageCenterX - w / 2;
      guides.push({ type: 'v', pos: pageCenterX });
    }
    // Check page vertical center
    if (Math.abs((y + h / 2) - pageCenterY) < this.snapThreshold) {
      y = pageCenterY - h / 2;
      guides.push({ type: 'h', pos: pageCenterY });
    }

    // Check margins
    if (Math.abs(x - pageMargins[0]) < this.snapThreshold) { x = pageMargins[0]; guides.push({ type: 'v', pos: pageMargins[0] }); }
    if (Math.abs((x + w) - pageMargins[1]) < this.snapThreshold) { x = pageMargins[1] - w; guides.push({ type: 'v', pos: pageMargins[1] }); }
    if (Math.abs(y - pageMargins[2]) < this.snapThreshold) { y = pageMargins[2]; guides.push({ type: 'h', pos: pageMargins[2] }); }
    if (Math.abs((y + h) - pageMargins[3]) < this.snapThreshold) { y = pageMargins[3] - h; guides.push({ type: 'h', pos: pageMargins[3] }); }

    // Snap to other elements coordinates
    Object.entries(elements).forEach(([id, el]) => {
      if (id === currentId) return;

      const ox = el.x || 0;
      const oy = el.y || 0;
      const ow = el.w || 100;
      const oh = el.h || 100;

      // Align Left edges
      if (Math.abs(x - ox) < this.snapThreshold) { x = ox; guides.push({ type: 'v', pos: ox }); }
      // Align Left edge to Right edge
      if (Math.abs(x - (ox + ow)) < this.snapThreshold) { x = ox + ow; guides.push({ type: 'v', pos: ox + ow }); }
      // Align Right edge to Left edge
      if (Math.abs((x + w) - ox) < this.snapThreshold) { x = ox - w; guides.push({ type: 'v', pos: ox }); }
      // Align Right edges
      if (Math.abs((x + w) - (ox + ow)) < this.snapThreshold) { x = ox + ow - w; guides.push({ type: 'v', pos: ox + ow }); }

      // Align Top edges
      if (Math.abs(y - oy) < this.snapThreshold) { y = oy; guides.push({ type: 'h', pos: oy }); }
      // Align Top edge to Bottom edge
      if (Math.abs(y - (oy + oh)) < this.snapThreshold) { y = oy + oh; guides.push({ type: 'h', pos: oy + oh }); }
      // Align Bottom edge to Top edge
      if (Math.abs((y + h) - oy) < this.snapThreshold) { y = oy - h; guides.push({ type: 'h', pos: oy }); }
      // Align Bottom edges
      if (Math.abs((y + h) - (oy + oh)) < this.snapThreshold) { y = oy + oh - h; guides.push({ type: 'h', pos: oy + oh }); }
    });

    return { x, y, guides };
  }

  drawSnapGuides(pageEl, guides) {
    this.clearSnapGuides(pageEl);
    guides.forEach(g => {
      const line = document.createElement('div');
      line.className = `canvas-snap-line canvas-snap-line--${g.type}`;
      if (g.type === 'h') {
        line.style.top = `${g.pos}px`;
      } else {
        line.style.left = `${g.pos}px`;
      }
      pageEl.appendChild(line);
    });
  }

  clearSnapGuides(pageEl) {
    pageEl.querySelectorAll('.canvas-snap-line').forEach(el => el.remove());
  }

  /**
   * Inline Contenteditable Edit for Text Boxes
   */
  enableInlineTextEdit(el, elementId) {
    const textNode = el.querySelector('.freeform-text-body') || el;
    textNode.contentEditable = 'true';
    textNode.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const onBlur = async () => {
      textNode.contentEditable = 'false';
      textNode.removeEventListener('blur', onBlur);
      textNode.removeEventListener('keydown', onKeyDown);

      const hotelId = state.get('currentHotelId');
      const menuId = this.editorState.menuId;

      try {
        await db.update(`hotels/${hotelId}/menus/${menuId}/freeformElements/${elementId}`, {
          content: textNode.innerText.trim()
        });
      } catch (err) {
        console.error('Failed to update inline text:', err);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textNode.blur();
      }
    };

    textNode.addEventListener('blur', onBlur);
    textNode.addEventListener('keydown', onKeyDown);
  }

  /**
   * Render Right Panel Properties Editor for selected Freeform element
   */
  /**
   * Render Canvas Page settings when no element is selected
   */
  renderCanvasPageSettings(container) {
    const design = this.editorState.design || {};
    const custom = design.custom || {};
    const bg = custom.pageBackground || { type: 'solid', color: '#FFFFFF' };
    const border = custom.border || {};

    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    const bgPath = `hotels/${hotelId}/menus/${menuId}/design/custom/pageBackground`;
    const borderPath = `hotels/${hotelId}/menus/${menuId}/design/custom/border`;

    container.innerHTML = `
      <div class="editor-right__header">
        <h3 class="editor-right__title">Canvas Settings</h3>
      </div>
      <div class="editor-right__content" id="right-content" style="padding:16px;">
        <!-- Background settings -->
        <div class="prop-section">
          <div class="prop-section__title">Page Background</div>
          <div class="prop-row">
            <label class="prop-label">Background Type</label>
            <select class="input" id="bg-type">
              <option value="solid" ${bg.type === 'solid' || !bg.type ? 'selected' : ''}>Solid Color</option>
              <option value="gradient" ${bg.type === 'gradient' ? 'selected' : ''}>Gradient Fill</option>
              <option value="image" ${bg.type === 'image' ? 'selected' : ''}>Background Image</option>
            </select>
          </div>

          <!-- Solid type -->
          <div class="prop-row" id="bg-solid-row" style="display:${bg.type === 'solid' || !bg.type ? '' : 'none'};">
            <label class="prop-label">Fill Color</label>
            <input type="color" id="bg-solid-color" value="${bg.color || '#FFFFFF'}" style="width:100%;height:32px;border:none;padding:0;background:none;cursor:pointer;">
          </div>

          <!-- Gradient type -->
          <div id="bg-gradient-rows" style="display:${bg.type === 'gradient' ? '' : 'none'};">
            <div class="prop-row">
              <label class="prop-label">Gradient Type</label>
              <select class="input" id="bg-grad-type">
                <option value="linear" ${bg.gradientType === 'linear' || !bg.gradientType ? 'selected' : ''}>Linear</option>
                <option value="radial" ${bg.gradientType === 'radial' ? 'selected' : ''}>Radial</option>
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div class="prop-row">
                <label class="prop-label">Color Start</label>
                <input type="color" id="bg-grad-start" value="${bg.gradientColorStart || '#ffffff'}" style="width:100%;height:32px;border:none;padding:0;background:none;cursor:pointer;">
              </div>
              <div class="prop-row">
                <label class="prop-label">Color End</label>
                <input type="color" id="bg-grad-end" value="${bg.gradientColorEnd || '#c9a96e'}" style="width:100%;height:32px;border:none;padding:0;background:none;cursor:pointer;">
              </div>
            </div>
            <div class="prop-row" id="bg-grad-angle-row" style="display:${bg.gradientType !== 'radial' ? '' : 'none'}; margin-top:8px;">
              <label class="prop-label">Gradient Angle (°)</label>
              <input type="number" class="input" id="bg-grad-angle" value="${bg.gradientAngle || 90}">
            </div>
          </div>

          <!-- Image type -->
          <div class="prop-row" id="bg-image-row" style="display:${bg.type === 'image' ? '' : 'none'};">
            <label class="prop-label">Background Image URL</label>
            <input type="text" class="input" id="bg-image-url" value="${bg.imageUrl || ''}" placeholder="https://...">
          </div>
        </div>

        <!-- Page Border settings -->
        <div class="prop-section">
          <div class="prop-section__title">Page Border</div>
          <div class="prop-row">
            <label class="prop-label">Border Style</label>
            <select class="input" id="page-border-style">
              <option value="none" ${border.style === 'none' || !border.style ? 'selected' : ''}>None</option>
              <option value="solid" ${border.style === 'solid' ? 'selected' : ''}>Solid</option>
              <option value="dashed" ${border.style === 'dashed' ? 'selected' : ''}>Dashed</option>
              <option value="dotted" ${border.style === 'dotted' ? 'selected' : ''}>Dotted</option>
              <option value="double" ${border.style === 'double' ? 'selected' : ''}>Double</option>
            </select>
          </div>
          <div id="page-border-details" style="display:${border.style && border.style !== 'none' ? '' : 'none'};">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
              <div class="prop-row">
                <label class="prop-label">Border Width (px)</label>
                <input type="number" class="input" id="page-border-width" value="${border.width || 2}">
              </div>
              <div class="prop-row">
                <label class="prop-label">Corner Radius (px)</label>
                <input type="number" class="input" id="page-border-radius" value="${border.radius || 0}">
              </div>
            </div>
            <div class="prop-row" style="margin-top:8px;">
              <label class="prop-label">Border Color</label>
              <input type="color" id="page-border-color" value="${border.color || '#C9A96E'}" style="width:100%;height:32px;border:none;padding:0;background:none;cursor:pointer;">
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind listeners
    const content = document.getElementById('right-content');
    if (!content) return;

    content.querySelector('#bg-type')?.addEventListener('change', (e) => {
      db.update(bgPath, { type: e.target.value });
      setTimeout(() => this.renderCanvasPageSettings(container), 200);
    });
    content.querySelector('#bg-solid-color')?.addEventListener('change', (e) => {
      db.update(bgPath, { color: e.target.value });
    });
    content.querySelector('#bg-grad-type')?.addEventListener('change', (e) => {
      db.update(bgPath, { gradientType: e.target.value });
      setTimeout(() => this.renderCanvasPageSettings(container), 200);
    });
    content.querySelector('#bg-grad-start')?.addEventListener('change', (e) => {
      db.update(bgPath, { gradientColorStart: e.target.value });
    });
    content.querySelector('#bg-grad-end')?.addEventListener('change', (e) => {
      db.update(bgPath, { gradientColorEnd: e.target.value });
    });
    content.querySelector('#bg-grad-angle')?.addEventListener('change', (e) => {
      db.update(bgPath, { gradientAngle: parseInt(e.target.value) || 0 });
    });
    content.querySelector('#bg-image-url')?.addEventListener('change', (e) => {
      db.update(bgPath, { imageUrl: e.target.value.trim() });
    });

    content.querySelector('#page-border-style')?.addEventListener('change', (e) => {
      db.update(borderPath, { style: e.target.value });
      setTimeout(() => this.renderCanvasPageSettings(container), 200);
    });
    content.querySelector('#page-border-width')?.addEventListener('change', (e) => {
      db.update(borderPath, { width: parseInt(e.target.value) || 0 });
    });
    content.querySelector('#page-border-radius')?.addEventListener('change', (e) => {
      db.update(borderPath, { radius: parseInt(e.target.value) || 0 });
    });
    content.querySelector('#page-border-color')?.addEventListener('change', (e) => {
      db.update(borderPath, { color: e.target.value });
    });
  }

  /**
   * Render Right Panel Properties Editor for selected Freeform element
   */
  renderRightPanel(elementId) {
    const container = document.getElementById('right-panel-content');
    if (!container) return;

    if (!elementId) {
      this.renderCanvasPageSettings(container);
      return;
    }

    const elements = this.editorState.freeformElements || {};
    const el = elements[elementId];
    if (!el) return;

    const style = el.style || {};
    const hotelId = state.get('currentHotelId');
    const menuId = this.editorState.menuId;
    const elemPath = `hotels/${hotelId}/menus/${menuId}/freeformElements/${elementId}`;

    container.innerHTML = `
      <div class="editor-right__header">
        <h3 class="editor-right__title">Layer Properties</h3>
      </div>
      <div class="editor-right__content" id="right-content" style="padding:16px;">
        <!-- Coordinates -->
        <div class="prop-section">
          <div class="prop-section__title">Geometry</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div class="prop-row">
              <label class="prop-label">X Pos (px)</label>
              <input type="number" class="input" id="prop-x" value="${el.x || 0}">
            </div>
            <div class="prop-row">
              <label class="prop-label">Y Pos (px)</label>
              <input type="number" class="input" id="prop-y" value="${el.y || 0}">
            </div>
            <div class="prop-row">
              <label class="prop-label">Width (px)</label>
              <input type="number" class="input" id="prop-w" value="${el.w || 100}">
            </div>
            <div class="prop-row">
              <label class="prop-label">Height (px)</label>
              <input type="number" class="input" id="prop-h" value="${el.h || 100}">
            </div>
          </div>
          <div class="prop-row">
            <label class="prop-label">Rotation (°)</label>
            <input type="number" class="input" id="prop-rotation" value="${el.rotation || 0}">
          </div>
        </div>

        <!-- Layer Stacking -->
        <div class="prop-section">
          <div class="prop-section__title">Layering</div>
          <div style="display:flex;gap:4px;margin-bottom:8px;">
            <button class="btn btn--xs btn--ghost" id="layer-back" style="flex:1;">To Back</button>
            <button class="btn btn--xs btn--ghost" id="layer-down" style="flex:1;">Backward</button>
            <button class="btn btn--xs btn--ghost" id="layer-up" style="flex:1;">Forward</button>
            <button class="btn btn--xs btn--ghost" id="layer-front" style="flex:1;">To Front</button>
          </div>
          <div class="prop-row">
            <label class="prop-label">Z-Index Stack</label>
            <input type="number" class="input" id="prop-zindex" value="${el.zIndex || 10}">
          </div>
        </div>

        <!-- Opacity -->
        <div class="prop-section">
          <div class="prop-section__title">Opacity</div>
          <div class="prop-row">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span class="prop-label">Opacity Level</span>
              <span class="range-value" id="val-opacity">${Math.round((style.opacity !== undefined ? style.opacity : 1) * 100)}%</span>
            </div>
            <div class="input-range">
              <input type="range" id="prop-opacity" min="0" max="100" value="${Math.round((style.opacity !== undefined ? style.opacity : 1) * 100)}">
            </div>
          </div>
        </div>

        <!-- Shadows -->
        <div class="prop-section">
          <div class="prop-section__title">Drop Shadow</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
            <div class="prop-row">
              <label class="prop-label">Offset X (px)</label>
              <input type="number" class="input" id="prop-shadow-x" value="${style.shadowOffsetX || 0}">
            </div>
            <div class="prop-row">
              <label class="prop-label">Offset Y (px)</label>
              <input type="number" class="input" id="prop-shadow-y" value="${style.shadowOffsetY || 0}">
            </div>
            <div class="prop-row">
              <label class="prop-label">Blur (px)</label>
              <input type="number" class="input" id="prop-shadow-blur" value="${style.shadowBlur || 0}">
            </div>
            <div class="prop-row">
              <label class="prop-label">Shadow Color</label>
              <input type="color" id="prop-shadow-color" value="${style.shadowColor || '#000000'}" style="width:100%;height:32px;border:none;padding:0;background:none;cursor:pointer;">
            </div>
          </div>
        </div>

        <!-- Borders (Not for text elements) -->
        ${el.type !== 'text' ? `
          <div class="prop-section">
            <div class="prop-section__title">Borders</div>
            <div class="prop-row">
              <label class="prop-label">Border Style</label>
              <select class="input" id="prop-border-style">
                <option value="solid" ${style.borderStyle === 'solid' || !style.borderStyle ? 'selected' : ''}>Solid</option>
                <option value="dashed" ${style.borderStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                <option value="dotted" ${style.borderStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                <option value="double" ${style.borderStyle === 'double' ? 'selected' : ''}>Double</option>
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
              <div class="prop-row">
                <label class="prop-label">Border Width (px)</label>
                <input type="number" class="input" id="prop-border-width" value="${style.borderWidth || 0}">
              </div>
              <div class="prop-row">
                <label class="prop-label">Corner Radius (px)</label>
                <input type="number" class="input" id="prop-radius" value="${style.borderRadius || 0}">
              </div>
            </div>
            <div class="prop-row" style="margin-top:8px;">
              <label class="prop-label">Border Color</label>
              <input type="color" id="prop-border-color" value="${style.borderColor || '#C9A96E'}" style="width:100%;height:32px;border:none;padding:0;background:none;cursor:pointer;">
            </div>
          </div>
        ` : ''}

        <!-- Styles depending on Element Type -->
        ${el.type === 'text' ? `
          <div class="prop-section">
            <div class="prop-section__title">Text Settings</div>
            <div class="prop-row">
              <label class="prop-label">Font Size (px)</label>
              <input type="number" class="input" id="prop-font-size" value="${style.fontSize || 16}">
            </div>
            <div class="prop-row">
              <label class="prop-label">Font Family</label>
              <select class="input" id="prop-font-family">
                ${this._fontOptions(style.fontFamily || 'Lato')}
              </select>
            </div>
            <div class="prop-row">
              <label class="prop-label">Text Color</label>
              <input type="color" id="prop-color" value="${style.color || '#1A1A1A'}" style="width:100%;height:32px;border:none;padding:0;background:none;cursor:pointer;">
            </div>
            <div class="prop-row">
              <label class="prop-label">Text Alignment</label>
              <select class="input" id="prop-text-align">
                <option value="left" ${style.textAlign === 'left' ? 'selected' : ''}>Left</option>
                <option value="center" ${style.textAlign === 'center' ? 'selected' : ''}>Center</option>
                <option value="right" ${style.textAlign === 'right' ? 'selected' : ''}>Right</option>
              </select>
            </div>
          </div>
        ` : ''}

        ${el.type === 'image' ? `
          <div class="prop-section">
            <div class="prop-section__title">Image Settings</div>
            <div class="prop-row">
              <label class="prop-label">Image Source URL</label>
              <input type="text" class="input" id="prop-image-url" value="${el.imageUrl || ''}" placeholder="https://...">
            </div>
          </div>
        ` : ''}

        ${el.type === 'shape' ? `
          <div class="prop-section">
            <div class="prop-section__title">Shape Settings</div>
            <div class="prop-row">
              <label class="prop-label">Shape Type</label>
              <select class="input" id="prop-shape-type">
                <option value="rectangle" ${el.shapeType === 'rectangle' ? 'selected' : ''}>Rectangle</option>
                <option value="circle" ${el.shapeType === 'circle' ? 'selected' : ''}>Circle</option>
                <option value="ellipse" ${el.shapeType === 'ellipse' ? 'selected' : ''}>Ellipse</option>
                <option value="triangle" ${el.shapeType === 'triangle' ? 'selected' : ''}>Triangle</option>
                <option value="star" ${el.shapeType === 'star' ? 'selected' : ''}>Star</option>
              </select>
            </div>
            <div class="prop-row">
              <label class="prop-label">Fill Color</label>
              <input type="color" id="prop-fill-color" value="${style.backgroundColor || '#F8F5EE'}" style="width:100%;height:32px;border:none;padding:0;background:none;cursor:pointer;">
            </div>
            <div class="prop-row">
              <label class="prop-label">Clipping Mask Image URL</label>
              <input type="text" class="input" id="prop-shape-image" value="${el.imageUrl || ''}" placeholder="Paste URL to clip inside shape...">
            </div>
          </div>
        ` : ''}

        ${el.type === 'menu-item' ? `
          <div class="prop-section">
            <div class="prop-section__title">Menu Item Link</div>
            <div class="prop-row">
              <label class="prop-label">Select Category Section</label>
              <select class="input" id="prop-menu-sec">
                <option value="">-- Choose Category --</option>
                ${Object.entries(this.editorState.sections || {}).map(([secId, sec]) => `
                  <option value="${secId}" ${el.sectionId === secId ? 'selected' : ''}>${sec.header?.title?.en || sec.type}</option>
                `).join('')}
              </select>
            </div>
            <div class="prop-row">
              <label class="prop-label">Select Food/Drink Item</label>
              <select class="input" id="prop-menu-item">
                <option value="">-- Choose Item --</option>
                ${this._itemOptions(el.sectionId, el.itemId)}
              </select>
            </div>
          </div>
        ` : ''}

        <button class="btn btn--block btn--sm btn--danger" id="delete-layer-btn" style="margin-top:16px;">
          Delete Layer
        </button>
      </div>
    `;

    this._bindRightPanelListeners(elementId, elemPath);
  }

  _fontOptions(selected) {
    const fonts = ['Playfair Display', 'Lato', 'Cormorant Garamond', 'Noto Sans JP', 'Libre Baskerville', 'Lora', 'Inter', 'Outfit', 'Amiri', 'Bodoni Moda', 'Cinzel'];
    return fonts.map(f => `<option value="${f}" ${f === selected ? 'selected' : ''}>${f}</option>`).join('');
  }

  _itemOptions(sectionId, selectedItemId) {
    if (!sectionId) return '';
    const section = this.editorState.sections?.[sectionId];
    if (!section || !section.items) return '';
    return Object.entries(section.items).map(([itemId, item]) => `
      <option value="${itemId}" ${itemId === selectedItemId ? 'selected' : ''}>${item.name?.en || 'Unnamed'}</option>
    `).join('');
  }

  _bindRightPanelListeners(elementId, elemPath) {
    const content = document.getElementById('right-content');
    if (!content) return;

    // Geometry
    const xInput = content.querySelector('#prop-x');
    xInput?.addEventListener('change', () => db.update(elemPath, { x: parseInt(xInput.value) || 0 }));

    const yInput = content.querySelector('#prop-y');
    yInput?.addEventListener('change', () => db.update(elemPath, { y: parseInt(yInput.value) || 0 }));

    const wInput = content.querySelector('#prop-w');
    wInput?.addEventListener('change', () => db.update(elemPath, { w: parseInt(wInput.value) || 50 }));

    const hInput = content.querySelector('#prop-h');
    hInput?.addEventListener('change', () => db.update(elemPath, { h: parseInt(hInput.value) || 50 }));

    const rotInput = content.querySelector('#prop-rotation');
    rotInput?.addEventListener('change', () => db.update(elemPath, { rotation: parseInt(rotInput.value) || 0 }));

    const zInput = content.querySelector('#prop-zindex');
    zInput?.addEventListener('change', () => db.update(elemPath, { zIndex: parseInt(zInput.value) || 10 }));

    // Reorder actions
    content.querySelector('#layer-back')?.addEventListener('click', () => this.reorderLayer(elementId, 'back'));
    content.querySelector('#layer-down')?.addEventListener('click', () => this.reorderLayer(elementId, 'down'));
    content.querySelector('#layer-up')?.addEventListener('click', () => this.reorderLayer(elementId, 'up'));
    content.querySelector('#layer-front')?.addEventListener('click', () => this.reorderLayer(elementId, 'front'));

    // Opacity
    const opacityInput = content.querySelector('#prop-opacity');
    opacityInput?.addEventListener('input', () => {
      const val = parseFloat(opacityInput.value) / 100;
      content.querySelector('#val-opacity').textContent = `${opacityInput.value}%`;
      db.update(`${elemPath}/style`, { opacity: val });
    });

    // Shadows
    const shX = content.querySelector('#prop-shadow-x');
    shX?.addEventListener('change', () => db.update(`${elemPath}/style`, { shadowOffsetX: parseInt(shX.value) || 0 }));

    const shY = content.querySelector('#prop-shadow-y');
    shY?.addEventListener('change', () => db.update(`${elemPath}/style`, { shadowOffsetY: parseInt(shY.value) || 0 }));

    const shBlur = content.querySelector('#prop-shadow-blur');
    shBlur?.addEventListener('change', () => db.update(`${elemPath}/style`, { shadowBlur: parseInt(shBlur.value) || 0 }));

    const shColor = content.querySelector('#prop-shadow-color');
    shColor?.addEventListener('change', () => db.update(`${elemPath}/style`, { shadowColor: shColor.value }));

    // Borders
    const bStyle = content.querySelector('#prop-border-style');
    bStyle?.addEventListener('change', () => db.update(`${elemPath}/style`, { borderStyle: bStyle.value }));

    const bWidth = content.querySelector('#prop-border-width');
    bWidth?.addEventListener('change', () => db.update(`${elemPath}/style`, { borderWidth: parseInt(bWidth.value) || 0 }));

    const bRadius = content.querySelector('#prop-radius');
    bRadius?.addEventListener('change', () => db.update(`${elemPath}/style`, { borderRadius: parseInt(bRadius.value) || 0 }));

    const bColor = content.querySelector('#prop-border-color');
    bColor?.addEventListener('change', () => db.update(`${elemPath}/style`, { borderColor: bColor.value }));

    // Text Properties
    content.querySelector('#prop-font-size')?.addEventListener('change', (e) => {
      db.update(`${elemPath}/style`, { fontSize: parseInt(e.target.value) });
    });
    content.querySelector('#prop-font-family')?.addEventListener('change', (e) => {
      db.update(`${elemPath}/style`, { fontFamily: e.target.value });
    });
    content.querySelector('#prop-color')?.addEventListener('change', (e) => {
      db.update(`${elemPath}/style`, { color: e.target.value });
    });
    content.querySelector('#prop-text-align')?.addEventListener('change', (e) => {
      db.update(`${elemPath}/style`, { textAlign: e.target.value });
    });

    // Image Properties
    const imgUrlInp = content.querySelector('#prop-image-url');
    imgUrlInp?.addEventListener('change', () => {
      db.update(elemPath, { imageUrl: imgUrlInp.value.trim() });
    });

    // Shape Properties
    content.querySelector('#prop-shape-type')?.addEventListener('change', (e) => {
      db.update(elemPath, { shapeType: e.target.value });
    });
    content.querySelector('#prop-fill-color')?.addEventListener('change', (e) => {
      db.update(`${elemPath}/style`, { backgroundColor: e.target.value });
    });
    const shapeImgInp = content.querySelector('#prop-shape-image');
    shapeImgInp?.addEventListener('change', () => {
      db.update(elemPath, { imageUrl: shapeImgInp.value.trim() });
    });

    // Menu Item Links
    const secSelect = content.querySelector('#prop-menu-sec');
    const itemSelect = content.querySelector('#prop-menu-item');

    secSelect?.addEventListener('change', () => {
      db.update(elemPath, { sectionId: secSelect.value, itemId: '' });
      setTimeout(() => this.renderRightPanel(elementId), 200);
    });

    itemSelect?.addEventListener('change', () => {
      db.update(elemPath, { itemId: itemSelect.value });
    });

    // Delete btn
    content.querySelector('#delete-layer-btn')?.addEventListener('click', () => {
      this.deleteElement(elementId);
    });
  }

  /**
   * Render Layer Stack list in Left Panel tab
   */
  renderLayersTab(container) {
    const elements = this.editorState.freeformElements || {};
    const sorted = Object.entries(elements).sort(([, a], [, b]) => (b.zIndex || 0) - (a.zIndex || 0)); // Descending z-index

    if (sorted.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px;">
          No layers added yet. Drop elements on canvas.
        </div>
      `;
      return;
    }

    container.innerHTML = sorted.map(([id, el]) => {
      const isActive = this.selectedElementId === id;
      const typeIcons = {
        text: '📝', image: '🖼️', shape: '🟩', 'menu-item': '🍔', qr: '🏁', social: '📱'
      };
      const label = el.type === 'text' ? (el.content || 'Text') : el.type;
      return `
        <div class="layer-item ${isActive ? 'layer-item--active' : ''}" data-layer-id="${id}">
          <div class="layer-item__name">
            <span>${typeIcons[el.type] || '📄'}</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;">${label}</span>
          </div>
          <div class="layer-item__actions">
            <button class="btn btn--xs btn--ghost layer-action-del" data-id="${id}" style="color:var(--danger);padding:2px 6px;">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind selection & actions
    container.querySelectorAll('.layer-item[data-layer-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('layer-action-del')) return;
        const layerId = item.dataset.layerId;
        this.selectedElementId = layerId;
        this.canvas._highlightSelected();
        this.renderRightPanel(layerId);
        this.renderLayersTab(container);
      });
    });

    container.querySelectorAll('.layer-action-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteElement(btn.dataset.id);
        setTimeout(() => this.renderLayersTab(container), 200);
      });
    });
  }
}

export default FreeformManager;
export { FreeformManager };
