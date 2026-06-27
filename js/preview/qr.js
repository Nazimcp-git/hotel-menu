/* ============================================
   MenuForge — QR Code Generator
   Generate QR codes for menu sharing
   Uses qrcode.js (loaded on demand)
   ============================================ */

import { toast } from '../app.js';

class QRGenerator {
  /**
   * Generate a QR code for a menu URL
   * @param {string} url - The URL to encode
   * @param {Object} options - Generation options
   * @returns {Promise<HTMLCanvasElement>}
   */
  static async generate(url, options = {}) {
    const {
      size = 256,
      colorDark = '#000000',
      colorLight = '#FFFFFF',
      errorCorrectionLevel = 'M',
      margin = 4,
      logoUrl = null
    } = options;

    try {
      const QRCode = await QRGenerator._loadQRCodeLib();

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      // Use the library to render
      await QRCode.toCanvas(canvas, url, {
        width: size,
        color: { dark: colorDark, light: colorLight },
        errorCorrectionLevel,
        margin
      });

      // Optionally overlay a logo
      if (logoUrl) {
        await QRGenerator._addLogo(canvas, logoUrl, size);
      }

      return canvas;
    } catch (error) {
      console.error('QR generation failed:', error);
      toast.error('Failed to generate QR code');
      return null;
    }
  }

  /**
   * Generate and render QR code into a container element
   */
  static async renderTo(container, url, options = {}) {
    const canvas = await QRGenerator.generate(url, options);
    if (canvas) {
      container.innerHTML = '';
      container.appendChild(canvas);
    }
    return canvas;
  }

  /**
   * Generate and download QR code as PNG
   */
  static async download(url, filename = 'qr-code.png', options = {}) {
    const canvas = await QRGenerator.generate(url, { ...options, size: 1024 });
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('QR code downloaded');
  }

  /**
   * Generate SVG QR code string
   */
  static async generateSVG(url, options = {}) {
    const {
      size = 256,
      colorDark = '#000000',
      colorLight = '#FFFFFF',
      errorCorrectionLevel = 'M',
      margin = 4
    } = options;

    try {
      const QRCode = await QRGenerator._loadQRCodeLib();
      const svgString = await QRCode.toString(url, {
        type: 'svg',
        width: size,
        color: { dark: colorDark, light: colorLight },
        errorCorrectionLevel,
        margin
      });
      return svgString;
    } catch (error) {
      console.error('QR SVG generation failed:', error);
      return null;
    }
  }

  /**
   * Overlay a logo in the center of the QR code
   */
  static async _addLogo(canvas, logoUrl, size) {
    return new Promise((resolve) => {
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const logoSize = size * 0.2;
        const x = (size - logoSize) / 2;
        const y = (size - logoSize) / 2;

        // White background for logo
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x - 4, y - 4, logoSize + 8, logoSize + 8);

        ctx.drawImage(img, x, y, logoSize, logoSize);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = logoUrl;
    });
  }

  /**
   * Build the shareable URL for a menu
   */
  static buildMenuUrl(menuId, hotelSlug = '') {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const dir = pathname.substring(0, pathname.lastIndexOf('/'));
    
    if (hotelSlug) {
      let baseDomain = 'menuforgee.vercel.app';
      if (origin.includes('localhost')) {
        return `http://${hotelSlug}.localhost:5500${dir}/preview.html?id=${menuId}&guest=true`;
      }
      return `https://${hotelSlug}.${baseDomain}${dir}/preview.html?id=${menuId}&guest=true`;
    }
    
    return `${origin}${dir}/preview.html?id=${menuId}&guest=true`;
  }

  /**
   * Lazily load the QR code library
   */
  static async _loadQRCodeLib() {
    if (window.QRCode) return window.QRCode;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js';
      script.onload = () => resolve(window.QRCode);
      script.onerror = () => reject(new Error('Failed to load QR code library'));
      document.head.appendChild(script);
    });
  }
}

export default QRGenerator;
export { QRGenerator };
