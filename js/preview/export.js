/* ============================================
   MenuForge — Export Manager
   PDF, PNG, SVG, CSV export capabilities
   ============================================ */

import { toast } from '../app.js';

class ExportManager {
  /**
   * Export menu as PDF via browser print dialog
   */
  static printPDF() {
    window.print();
  }

  /**
   * Export menu elements as PNG (one per page for page-based layouts)
   */
  static async exportPNG(container, baseFilename = 'menu') {
    try {
      toast.loading('Generating PNG...');

      // Dynamically load html2canvas
      const html2canvas = await ExportManager._loadHtml2Canvas();

      const pages = container.querySelectorAll('.menu-page');
      if (pages.length === 0) {
        toast.error('No pages found to export');
        return;
      }

      const isDigital = pages[0].classList.contains('menu-page--digital');

      if (isDigital || pages.length === 1) {
        // Single page or digital flow
        const element = pages[0];
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#FFFFFF',
          logging: false,
          width: element.offsetWidth,
          height: element.offsetHeight
        });

        ExportManager._triggerDownload(canvas.toDataURL('image/png'), `${baseFilename}.png`);
        toast.success('PNG exported successfully');
      } else {
        // Multi-page layout, download page by page
        toast.loading(`Generating PNGs (0/${pages.length})...`);
        for (let i = 0; i < pages.length; i++) {
          const element = pages[i];
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#FFFFFF',
            logging: false,
            width: element.offsetWidth,
            height: element.offsetHeight
          });

          ExportManager._triggerDownload(canvas.toDataURL('image/png'), `${baseFilename}_Page_${i + 1}.png`);
          toast.loading(`Generating PNGs (${i + 1}/${pages.length})...`);
          
          // Small delay to prevent browser block on duplicate downloads
          await new Promise(r => setTimeout(r, 400));
        }
        toast.success(`Exported ${pages.length} pages as PNG`);
      }
    } catch (error) {
      console.error('PNG export failed:', error);
      toast.error('PNG export failed.');
    }
  }

  /**
   * Export menu elements as SVG files (one per page for page-based layouts)
   */
  static async exportSVG(container, baseFilename = 'menu') {
    try {
      toast.loading('Generating SVG...');

      const pages = container.querySelectorAll('.menu-page');
      if (pages.length === 0) {
        toast.error('No pages found to export');
        return;
      }

      // Collect all document stylesheets to embed in the SVG
      let styleContent = '';
      for (const sheet of document.styleSheets) {
        try {
          if (sheet.href && !sheet.href.startsWith(window.location.origin)) {
            continue;
          }
          for (const rule of sheet.cssRules) {
            styleContent += rule.cssText + '\n';
          }
        } catch (e) {
          // Ignore external stylesheet access violations
        }
      }

      // Explicitly append Google Font imports to ensure SVG renders typography
      styleContent += `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=Lato:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Noto+Sans+JP:wght@300;400;700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Source+Sans+3:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=Barlow:ital,wght@0,300;0,400;0,700;1,300;1,400;1,700&family=Bebas+Neue&family=Caveat:wght@400;700&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Italiana&family=Jost:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Oswald:wght@300;400;700&family=Shippori+Mincho+B1:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Great+Vibes&family=IM+Fell+English:ital@0;1&family=Josefin+Sans:wght@300;400;600;700&family=Noto+Serif+JP:wght@400;700&family=Petit+Formal+Script&family=Pinyon+Script&family=Poiret+One&family=Shippori+Mincho:wght@400;700&display=swap');
      `;

      const isDigital = pages[0].classList.contains('menu-page--digital');

      const exportPageAsSVG = (element, filename) => {
        const clone = element.cloneNode(true);
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';
        clone.style.borderRadius = '0';

        const width = element.offsetWidth || 794;
        const height = element.offsetHeight || 1123;

        const serializer = new XMLSerializer();
        const serializedHtml = serializer.serializeToString(clone);

        const svgString = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <style>
              ${styleContent}
              .menu-page {
                box-sizing: border-box !important;
                overflow: hidden !important;
              }
            </style>
            <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%;">
                ${serializedHtml}
              </div>
            </foreignObject>
          </svg>
        `;

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        ExportManager._triggerDownload(url, filename);
        URL.revokeObjectURL(url);
      };

      if (isDigital || pages.length === 1) {
        exportPageAsSVG(pages[0], `${baseFilename}.svg`);
        toast.success('SVG exported successfully');
      } else {
        toast.loading(`Generating SVGs (0/${pages.length})...`);
        for (let i = 0; i < pages.length; i++) {
          exportPageAsSVG(pages[i], `${baseFilename}_Page_${i + 1}.svg`);
          toast.loading(`Generating SVGs (${i + 1}/${pages.length})...`);
          await new Promise(r => setTimeout(r, 400));
        }
        toast.success(`Exported ${pages.length} pages as SVG`);
      }
    } catch (error) {
      console.error('SVG export failed:', error);
      toast.error('SVG export failed');
    }
  }

  /**
   * Export menu data as JSON
   */
  static exportJSON(menuData, filename = 'menu.json') {
    try {
      const blob = new Blob(
        [JSON.stringify(menuData, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      ExportManager._triggerDownload(url, filename);
      URL.revokeObjectURL(url);
      toast.success('JSON exported');
    } catch (error) {
      toast.error('Export failed');
    }
  }

  /**
   * Export as CSV (basic item list)
   */
  static exportCSV(menuData, filename = 'menu-items.csv') {
    try {
      const lang = menuData.meta?.primaryLanguage || 'en';
      const sections = menuData.sections || {};
      const rows = [['Section', 'Item Name', 'Description', 'Price', 'Currency', 'Status', 'Dietary', 'Allergens', 'Calories']];

      for (const [, section] of Object.entries(sections)) {
        const sectionName = section.header?.title?.[lang] || '';
        const items = section.items || {};

        for (const [, item] of Object.entries(items)) {
          rows.push([
            sectionName,
            item.name?.[lang] || '',
            (item.description?.[lang] || '').replace(/"/g, '""'),
            item.price?.value || '',
            item.price?.currency || menuData.meta?.currency || 'USD',
            item.status || 'available',
            (item.dietary || []).join('; '),
            (item.allergens || []).join('; '),
            item.calories || ''
          ]);
        }
      }

      const csv = rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      ExportManager._triggerDownload(url, filename);
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (error) {
      toast.error('Export failed');
    }
  }

  /**
   * Programmatically trigger a download
   */
  static _triggerDownload(url, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
  }

  /**
   * Lazily load html2canvas
   */
  static async _loadHtml2Canvas() {
    if (window.html2canvas) return window.html2canvas;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = () => resolve(window.html2canvas);
      script.onerror = () => reject(new Error('Failed to load html2canvas'));
      document.head.appendChild(script);
    });
  }
}

export default ExportManager;
export { ExportManager };
