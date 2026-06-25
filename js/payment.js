/* ============================================
   MenuForge — Payment Security Module
   7-Layer Security: HMAC, AES-GCM, Nonce,
   TTL, Fingerprint, Write-Once DB, DOM Guard
   ============================================ */

import db from './db.js';

/* ── Crypto Helpers ── */
class PaymentSecurity {
  static STORAGE_KEY = 'mf_pt_enc';
  static TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
  static SALT = 'MenuForge-Payment-Salt-v1';

  /**
   * Generate a cryptographic nonce (32 bytes hex)
   */
  static generateNonce() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Derive a CryptoKey from a seed string using PBKDF2
   */
  static async deriveKey(seed, usage = ['sign', 'verify']) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(seed),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(PaymentSecurity.SALT),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      usage
    );
  }

  /**
   * Derive an AES-GCM key for encryption/decryption
   */
  static async deriveEncryptionKey(seed) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(seed),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(PaymentSecurity.SALT + '-enc'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * HMAC-SHA256 sign data
   */
  static async hmacSign(data, keySeed) {
    const key = await PaymentSecurity.deriveKey(keySeed);
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(JSON.stringify(data))
    );
    return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify HMAC-SHA256 signature
   */
  static async hmacVerify(data, signatureHex, keySeed) {
    const key = await PaymentSecurity.deriveKey(keySeed);
    const encoder = new TextEncoder();
    const sigBytes = new Uint8Array(signatureHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    return crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(JSON.stringify(data))
    );
  }

  /**
   * AES-GCM encrypt
   */
  static async encrypt(plaintext, keySeed) {
    const key = await PaymentSecurity.deriveEncryptionKey(keySeed);
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plaintext)
    );
    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * AES-GCM decrypt
   */
  static async decrypt(ciphertextB64, keySeed) {
    try {
      const key = await PaymentSecurity.deriveEncryptionKey(keySeed);
      const combined = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  }

  /**
   * Lightweight browser fingerprint
   */
  static getBrowserFingerprint() {
    const components = [
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      navigator.hardwareConcurrency || 'unknown',
      navigator.platform || 'unknown'
    ];
    return components.join('|');
  }

  /**
   * Hash a string to hex using SHA-256
   */
  static async hashString(str) {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(str));
    return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
  }
}


/* ── Payment Manager ── */
class PaymentManager {
  constructor() {
    this.razorpayKey = 'rzp_test_XXXXXXXXXXXXXXXX'; // Replace with your Razorpay Key ID
    this.amount = 9900; // ₹99 in paise
    this.currency = 'INR';
    this.encryptionSeed = 'MF-Enc-2024-' + window.location.origin;
  }

  /**
   * Initialize and open Razorpay checkout
   * Returns a promise that resolves with payment data on success
   */
  initCheckout(options = {}) {
    return new Promise((resolve, reject) => {
      if (typeof Razorpay === 'undefined') {
        reject(new Error('Razorpay SDK not loaded'));
        return;
      }

      const rzpOptions = {
        key: this.razorpayKey,
        amount: this.amount,
        currency: this.currency,
        name: 'MenuForge',
        description: 'Premium Account — Lifetime Access',
        image: '', // Logo URL if you have one
        handler: async (response) => {
          try {
            const tokenData = await this._createSignedToken(response);
            await this._storeEncryptedToken(tokenData);
            resolve(tokenData);
          } catch (err) {
            reject(err);
          }
        },
        prefill: {
          name: options.name || '',
          email: options.email || '',
          contact: options.contact || ''
        },
        notes: {
          product: 'MenuForge Premium',
          type: 'one-time'
        },
        theme: {
          color: '#C9A96E',
          backdrop_color: 'rgba(15, 23, 42, 0.85)'
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment cancelled'));
          },
          confirm_close: true,
          escape: false
        }
      };

      const rzp = new Razorpay(rzpOptions);
      rzp.on('payment.failed', (response) => {
        reject(new Error(response.error?.description || 'Payment failed'));
      });
      rzp.open();
    });
  }

  /**
   * Create a signed payment token from Razorpay response
   */
  async _createSignedToken(razorpayResponse) {
    const nonce = PaymentSecurity.generateNonce();
    const fingerprint = PaymentSecurity.getBrowserFingerprint();
    const fingerprintHash = await PaymentSecurity.hashString(fingerprint);

    const tokenPayload = {
      paymentId: razorpayResponse.razorpay_payment_id,
      orderId: razorpayResponse.razorpay_order_id || null,
      amount: this.amount,
      currency: this.currency,
      timestamp: Date.now(),
      nonce: nonce,
      fingerprintHash: fingerprintHash
    };

    // Sign the token with HMAC-SHA256
    const keySeed = razorpayResponse.razorpay_payment_id + '-' + nonce;
    const signature = await PaymentSecurity.hmacSign(tokenPayload, keySeed);

    return {
      ...tokenPayload,
      signature,
      keySeed // Needed for verification
    };
  }

  /**
   * Store encrypted token in sessionStorage
   */
  async _storeEncryptedToken(tokenData) {
    const plaintext = JSON.stringify(tokenData);
    const encrypted = await PaymentSecurity.encrypt(plaintext, this.encryptionSeed);
    sessionStorage.setItem(PaymentSecurity.STORAGE_KEY, encrypted);
  }

  /**
   * Retrieve and decrypt the payment token
   * Returns null if no token, expired, tampered, or wrong browser
   */
  async getVerifiedToken() {
    try {
      const encrypted = sessionStorage.getItem(PaymentSecurity.STORAGE_KEY);
      if (!encrypted) return null;

      // Decrypt
      const plaintext = await PaymentSecurity.decrypt(encrypted, this.encryptionSeed);
      if (!plaintext) return null;

      const token = JSON.parse(plaintext);

      // 1. Check TTL
      if (this._isExpired(token)) {
        this.clearToken();
        return null;
      }

      // 2. Check required fields
      if (!token.paymentId || !token.nonce || !token.signature || !token.amount) {
        this.clearToken();
        return null;
      }

      // 3. Verify amount hasn't been tampered
      if (token.amount !== this.amount || token.currency !== this.currency) {
        this.clearToken();
        return null;
      }

      // 4. Verify browser fingerprint
      const currentFingerprint = PaymentSecurity.getBrowserFingerprint();
      const currentHash = await PaymentSecurity.hashString(currentFingerprint);
      if (token.fingerprintHash !== currentHash) {
        this.clearToken();
        return null;
      }

      // 5. Verify HMAC signature
      const { signature, keySeed, ...payload } = token;
      const isValid = await PaymentSecurity.hmacVerify(payload, signature, keySeed);
      if (!isValid) {
        this.clearToken();
        return null;
      }

      return token;
    } catch {
      this.clearToken();
      return null;
    }
  }

  /**
   * Check if token has expired (30 min TTL)
   */
  _isExpired(token) {
    if (!token.timestamp) return true;
    return (Date.now() - token.timestamp) > PaymentSecurity.TOKEN_TTL_MS;
  }

  /**
   * Consume the token: write payment data to Firebase and mark nonce as used
   * This should be called AFTER Firebase Auth user creation
   */
  async consumeToken(userId, token) {
    if (!token || !userId) throw new Error('Invalid token or user');

    // Atomic multi-path update
    const updates = {};

    // Write subscription to user record
    updates[`users/${userId}/subscription`] = {
      plan: 'premium',
      paymentId: token.paymentId,
      amount: token.amount,
      currency: token.currency,
      activatedAt: Date.now(),
      nonce: token.nonce
    };

    // Write to payments ledger (immutable)
    updates[`payments/${token.paymentId}`] = {
      userId: userId,
      amount: token.amount,
      currency: token.currency,
      nonce: token.nonce,
      createdAt: Date.now(),
      fingerprintHash: token.fingerprintHash
    };

    // Write nonce to prevent replay
    updates[`usedNonces/${token.nonce}`] = {
      paymentId: token.paymentId,
      userId: userId,
      usedAt: Date.now()
    };

    // Execute atomic update
    const { database } = await import('../firebase/firebase.js');
    const { ref, update } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    await update(ref(database), updates);

    // Clear the consumed token
    this.clearToken();
  }

  /**
   * Securely clear the token (overwrite then delete)
   */
  clearToken() {
    // Overwrite with random data first
    const garbage = PaymentSecurity.generateNonce();
    sessionStorage.setItem(PaymentSecurity.STORAGE_KEY, garbage);
    sessionStorage.removeItem(PaymentSecurity.STORAGE_KEY);
  }

  /**
   * Check if a valid payment token exists (quick check)
   */
  async hasValidToken() {
    const token = await this.getVerifiedToken();
    return token !== null;
  }
}


/* ── DOM Tamper Guard ── */
class DOMGuard {
  constructor(protectedElementId, onTamper) {
    this.elementId = protectedElementId;
    this.onTamper = onTamper;
    this.observer = null;
  }

  /**
   * Start watching for tampering (element removal or hidden attribute changes)
   */
  start() {
    const target = document.getElementById(this.elementId);
    if (!target || !target.parentElement) return;

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check if the protected element was removed
        for (const removed of mutation.removedNodes) {
          if (removed.id === this.elementId || removed.contains?.(document.getElementById(this.elementId))) {
            this._handleTamper('Element removed');
            return;
          }
        }
        // Check if class/style was modified to bypass visibility
        if (mutation.type === 'attributes' && mutation.target.id === this.elementId) {
          const el = mutation.target;
          if (el.style.display === 'none' || el.classList.contains('hidden') || el.style.visibility === 'hidden') {
            // Only flag if we're the ones who set it
            if (!el.dataset.mfAuthorized) {
              this._handleTamper('Visibility tampered');
              return;
            }
          }
        }
      }
    });

    this.observer.observe(target.parentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });
  }

  _handleTamper(reason) {
    console.warn(`%c[MenuForge Security] DOM tampering detected: ${reason}`, 'color: red; font-size: 16px; font-weight: bold;');
    if (this.onTamper) this.onTamper(reason);
    this.stop();
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}


/* ── Singleton & Exports ── */
const paymentManager = new PaymentManager();

export { PaymentSecurity, PaymentManager, DOMGuard };
export default paymentManager;
