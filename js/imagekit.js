/* ============================================
   MenuForge — ImageKit Integration
   Image upload, transform, and optimization
   ============================================ */

const IMAGEKIT_CONFIG = {
  publicKey: 'public_x8uDMJT4JvZWLZcnkjU6ZPzlGAw=',
  privateKey: 'private_IYVir0LN50XYY5aoO5omtBD/gdE=',
  urlEndpoint: 'https://ik.imagekit.io/ajtjz9iiv',
};

// Preset transformations
const PRESETS = {
  thumbnail: [{ width: 120, height: 120, crop: 'at_max', focus: 'auto', format: 'auto', quality: 80 }],
  card: [{ width: 400, height: 300, crop: 'maintain_ratio', focus: 'auto', format: 'auto', quality: 80 }],
  hero: [{ width: 800, height: 400, crop: 'force', format: 'auto', quality: 85 }],
  gallery: [{ width: 300, height: 300, crop: 'at_max', focus: 'auto', format: 'auto', quality: 75 }],
  print_hires: [{ width: 1200, quality: 95, format: 'png' }],
  logo: [{ width: 200, height: 200, crop: 'at_max', format: 'auto', quality: 90 }],
  darkened: [{ width: 800, format: 'auto', quality: 80 }],
  preview: [{ width: 600, format: 'auto', quality: 70 }]
};

class ImageKitManager {
  constructor() {
    this.urlEndpoint = IMAGEKIT_CONFIG.urlEndpoint;
    this.publicKey = IMAGEKIT_CONFIG.publicKey;
    this.privateKey = IMAGEKIT_CONFIG.privateKey;
  }

  /**
   * Upload an image file
   * Returns { fileId, url, name, width, height, size }
   */
  async upload(file, options = {}) {
    const { hotelId, menuId, onProgress, folder } = options;

    // Validate file
    if (!file) throw new Error('No file provided');
    if (!file.type.startsWith('image/')) throw new Error('File must be an image');
    if (file.size > 10 * 1024 * 1024) throw new Error('Image must be under 10MB');

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const uploadFolder = folder || (hotelId ? `/hotels/${hotelId}/menus/${menuId || 'general'}/` : '/uploads/');

    try {
      // Get authentication parameters from server or use client-side approach
      const authParams = await this._getAuthParams();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);
      formData.append('folder', uploadFolder);
      formData.append('publicKey', this.publicKey);
      formData.append('signature', authParams.signature);
      formData.append('expire', authParams.expire);
      formData.append('token', authParams.token);
      formData.append('useUniqueFileName', 'true');

      if (hotelId) {
        formData.append('tags', `${hotelId}${menuId ? `,${menuId}` : ''}`);
      }

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://upload.imagekit.io/api/v1/files/upload');

        // Progress tracking
        if (onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            resolve({
              fileId: result.fileId,
              url: result.url,
              name: result.name,
              filePath: result.filePath,
              width: result.width,
              height: result.height,
              size: result.size,
              thumbnailUrl: this.getUrl(result.filePath, 'thumbnail')
            });
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'));
        xhr.send(formData);
      });
    } catch (error) {
      console.error('ImageKit upload error:', error);
      throw error;
    }
  }

  /**
   * Generate an optimized URL with transformations
   */
  getUrl(filePath, presetOrTransform = null) {
    if (!filePath) return '';

    // If it's already a full URL, extract the path
    if (filePath.startsWith('http')) {
      try {
        const url = new URL(filePath);
        filePath = url.pathname;
      } catch {
        return filePath;
      }
    }

    let transformString = '';

    if (typeof presetOrTransform === 'string' && PRESETS[presetOrTransform]) {
      transformString = this._buildTransformString(PRESETS[presetOrTransform]);
    } else if (Array.isArray(presetOrTransform)) {
      transformString = this._buildTransformString(presetOrTransform);
    } else if (typeof presetOrTransform === 'object' && presetOrTransform) {
      transformString = this._buildTransformString([presetOrTransform]);
    }

    if (transformString) {
      return `${this.urlEndpoint}/tr:${transformString}${filePath}`;
    }

    return `${this.urlEndpoint}${filePath}`;
  }

  /**
   * Build transform string from options
   */
  _buildTransformString(transforms) {
    return transforms.map(t => {
      const parts = [];
      if (t.width) parts.push(`w-${t.width}`);
      if (t.height) parts.push(`h-${t.height}`);
      if (t.crop) parts.push(`c-${t.crop}`);
      if (t.focus) parts.push(`fo-${t.focus}`);
      if (t.quality) parts.push(`q-${t.quality}`);
      if (t.format) parts.push(`f-${t.format}`);
      if (t.blur) parts.push(`bl-${t.blur}`);
      if (t.grayscale) parts.push('e-grayscale');
      if (t.contrast) parts.push(`e-contrast`);
      if (t.brightness) parts.push(`e-brightness`);
      if (t.radius) parts.push(`r-${t.radius}`);
      if (t.rotation) parts.push(`rt-${t.rotation}`);
      if (t.progressive) parts.push('pr-true');
      return parts.join(',');
    }).join(':');
  }

  /**
   * Get authentication parameters for upload
   * In production, this should call a Firebase Cloud Function
   */
  async _getAuthParams() {
    // For development: use client-side authentication
    // In production: replace with a call to your Firebase Cloud Function
    // Example: const response = await fetch('/api/imagekit-auth');
    const token = this._generateToken();
    const expire = Math.floor(Date.now() / 1000) + 3600;

    return {
      token,
      expire: expire.toString(),
      signature: await this._generateSignature(token, expire)
    };
  }

  _generateToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async _generateSignature(token, expire) {
    const message = `${token}${expire}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.privateKey);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    const encodedMessage = encoder.encode(message);
    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encodedMessage
    );
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Delete an image by fileId
   * Note: Requires server-side (private key) — placeholder for dev
   */
  async deleteImage(fileId) {
    console.warn('ImageKit delete requires server-side private key. Implement via Firebase Cloud Function.');
    return true;
  }

  /**
   * Get estimated file size after transform
   */
  estimateSize(originalSize, transform) {
    // Rough estimation based on common compression ratios
    let ratio = 1;
    if (transform.format === 'webp' || transform.format === 'auto') ratio *= 0.7;
    if (transform.quality) ratio *= (transform.quality / 100);
    if (transform.width && transform.height) {
      // Assume proportional reduction
      ratio *= 0.8;
    }
    return Math.round(originalSize * ratio);
  }

  /**
   * Format file size for display
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Check if file type is supported
   */
  isSupported(file) {
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];
    return supported.includes(file.type);
  }
}

// Singleton
const imageKit = new ImageKitManager();
export default imageKit;
export { ImageKitManager, PRESETS };
