/* ============================================
   MenuForge — Authentication Module
   Firebase Auth: Email/Password, Google, Magic Link
   ============================================ */

import { auth } from '../firebase/firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import db from './db.js';
import { slugify } from './utils/helpers.js';

const googleProvider = new GoogleAuthProvider();

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.onAuthCallbacks = [];
    this._initialized = false;
    this._initPromise = null;
  }

  /**
   * Initialize auth state listener
   * Returns a promise that resolves when the initial auth state is determined
   */
  init() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        this.currentUser = user;

        if (user) {
          // Ensure user record exists in database
          try {
            const userData = await db.get(`users/${user.uid}`);
            if (userData) {
              await db.update(`users/${user.uid}`, {
                lastLoginAt: Date.now()
              });
            }
          } catch (error) {
            console.error('Error syncing user data:', error);
          }
        }

        // Notify all listeners
        this.onAuthCallbacks.forEach(cb => cb(user));

        if (!this._initialized) {
          this._initialized = true;
          resolve(user);
        }
      });
    });

    return this._initPromise;
  }

  /**
   * Register auth state change callback
   */
  onAuthStateChange(callback) {
    this.onAuthCallbacks.push(callback);
    // If already initialized, call immediately
    if (this._initialized) {
      callback(this.currentUser);
    }
    return () => {
      this.onAuthCallbacks = this.onAuthCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Sign up with email and password
   */
  async signUp(email, password, name) {
    try {
      const { default: paymentManager } = await import('./payment.js');
      const token = await paymentManager.getVerifiedToken();
      if (!token) {
        return { success: false, error: 'Payment required to create an account. Please visit the landing page.' };
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Update profile with name
      await updateProfile(result.user, {
        displayName: name
      });

      // Consume token (writes subscription, payment record, and marks nonce used)
      await paymentManager.consumeToken(result.user.uid, token);

      // Create user record in database
      await db.update(`users/${result.user.uid}`, {
        name: name,
        email: email,
        avatar: '',
        hotelIds: {},
        preferences: {
          editorZoom: 100,
          defaultTheme: 'luxe-noir',
          showGuides: true,
          autoSave: true,
          language: 'en'
        },
        createdAt: Date.now(),
        lastLoginAt: Date.now()
      });

      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: this._parseError(error) };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: this._parseError(error) };
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userData = await db.get(`users/${user.uid}`);
      if (!userData) {
        // New user signing up via Google
        const { default: paymentManager } = await import('./payment.js');
        const token = await paymentManager.getVerifiedToken();
        if (!token) {
          await signOut(auth);
          return { success: false, error: 'Payment required to create an account. Please visit the landing page.' };
        }

        // Consume token
        await paymentManager.consumeToken(user.uid, token);

        // Create user record in database
        await db.update(`users/${user.uid}`, {
          name: user.displayName || 'User',
          email: user.email,
          avatar: user.photoURL || '',
          hotelIds: {},
          preferences: {
            editorZoom: 100,
            defaultTheme: 'luxe-noir',
            showGuides: true,
            autoSave: true,
            language: 'en'
          },
          createdAt: Date.now(),
          lastLoginAt: Date.now()
        });
      } else {
        // Existing user, update last login
        await db.update(`users/${user.uid}`, {
          lastLoginAt: Date.now()
        });
      }

      return { success: true, user: user };
    } catch (error) {
      return { success: false, error: this._parseError(error) };
    }
  }

  /**
   * Send magic link email
   */
  async sendMagicLink(email) {
    const actionCodeSettings = {
      url: window.location.origin + '/login.html',
      handleCodeInApp: true
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      // Save email for completing sign-in
      localStorage.setItem('menuforge_magicLinkEmail', email);
      return { success: true };
    } catch (error) {
      return { success: false, error: this._parseError(error) };
    }
  }

  /**
   * Complete magic link sign-in
   */
  async completeMagicLinkSignIn() {
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      return { success: false, error: 'Invalid sign-in link' };
    }

    let email = localStorage.getItem('menuforge_magicLinkEmail');
    if (!email) {
      email = prompt('Please provide your email for confirmation');
    }

    try {
      const result = await signInWithEmailLink(auth, email, window.location.href);
      const user = result.user;
      localStorage.removeItem('menuforge_magicLinkEmail');

      const userData = await db.get(`users/${user.uid}`);
      if (!userData) {
        // New user signing up via magic link
        const { default: paymentManager } = await import('./payment.js');
        const token = await paymentManager.getVerifiedToken();
        if (!token) {
          await signOut(auth);
          return { success: false, error: 'Payment required to create an account. Please visit the landing page.' };
        }

        // Consume token
        await paymentManager.consumeToken(user.uid, token);

        // Create user record in database
        await db.update(`users/${user.uid}`, {
          name: user.displayName || email.split('@')[0],
          email: email,
          avatar: '',
          hotelIds: {},
          preferences: {
            editorZoom: 100,
            defaultTheme: 'luxe-noir',
            showGuides: true,
            autoSave: true,
            language: 'en'
          },
          createdAt: Date.now(),
          lastLoginAt: Date.now()
        });
      } else {
        // Existing user, update last login
        await db.update(`users/${user.uid}`, {
          lastLoginAt: Date.now()
        });
      }

      return { success: true, user: user };
    } catch (error) {
      return { success: false, error: this._parseError(error) };
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: this._parseError(error) };
    }
  }

  /**
   * Sign out
   */
  async logout() {
    try {
      // Clear all local state
      localStorage.removeItem('menuforge_currentHotel');
      localStorage.removeItem('menuforge_currentMenu');
      localStorage.removeItem('menuforge_magicLinkEmail');

      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: this._parseError(error) };
    }
  }

  /**
   * Get current user
   */
  getUser() {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * Get user's hotel IDs
   */
  async getUserHotels() {
    if (!this.currentUser) return [];
    try {
      const userData = await db.get(`users/${this.currentUser.uid}`);
      if (!userData?.hotelIds) return [];
      return Object.keys(userData.hotelIds);
    } catch {
      return [];
    }
  }

  /**
   * Get user's role for a hotel
   */
  async getUserRole(hotelId) {
    if (!this.currentUser) return null;
    try {
      const team = await db.get(`hotels/${hotelId}/team/${this.currentUser.uid}`);
      return team?.role || null;
    } catch {
      return null;
    }
  }

  /**
   * Create a new hotel/property
   */
  async createHotel(hotelData) {
    if (!this.currentUser) throw new Error('Not authenticated');

    const hotelId = db.newKey('hotels');

    let subdomain = hotelData.subdomain;

    if (!subdomain) {
      // Auto-generate unique subdomain slug
      const baseSlug = slugify(hotelData.name || 'hotel');
      subdomain = baseSlug;
      let isTaken = true;
      let counter = 0;
      while (isTaken) {
        const existing = await db.get(`slugs/${subdomain}`);
        if (!existing) {
          isTaken = false;
        } else {
          counter++;
          subdomain = `${baseSlug}-${counter}`;
        }
      }
    }

    const hotel = {
      info: {
        name: hotelData.name,
        subdomain: subdomain,
        location: hotelData.location || '',
        timezone: hotelData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        logo: '',
        primaryColor: '#2C3E50',
        currency: hotelData.currency || 'USD',
        currencySymbol: hotelData.currencySymbol || '$',
        plan: 'free',
        ownerId: this.currentUser.uid,
        createdAt: Date.now()
      },
      team: {
        [this.currentUser.uid]: {
          role: 'owner',
          name: this.currentUser.displayName || 'Owner',
          email: this.currentUser.email,
          addedAt: Date.now()
        }
      }
    };

    await db.set(`slugs/${subdomain}`, hotelId);
    await db.set(`hotels/${hotelId}`, hotel);
    await db.update(`users/${this.currentUser.uid}/hotelIds`, {
      [hotelId]: true
    });

    return hotelId;
  }

  /**
   * Parse Firebase auth errors into friendly messages
   */
  _parseError(error) {
    const errorMap = {
      'auth/email-already-in-use': 'An account with this email already exists',
      'auth/invalid-email': 'Please enter a valid email address',
      'auth/operation-not-allowed': 'This sign-in method is not enabled',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/invalid-credential': 'Invalid email or password',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
      'auth/popup-closed-by-user': 'Sign-in popup was closed',
      'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups',
      'auth/network-request-failed': 'Network error. Please check your connection'
    };

    return errorMap[error.code] || error.message || 'An unexpected error occurred';
  }
}

// Singleton
const authManager = new AuthManager();
export default authManager;
export { AuthManager };
