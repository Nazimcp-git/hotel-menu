/* ============================================
   MenuForge — Internationalization (i18n)
   Translation system with RTL support
   6 languages: EN, AR, FR, ES, DE, ZH
   ============================================ */

const translations = {
  en: {
    // App
    'app.name': 'MenuForge',
    'app.tagline': 'Hotel Menu Studio',
    'app.description': 'Create stunning digital and print-ready menus in minutes',

    // Auth
    'auth.signIn': 'Sign In',
    'auth.signUp': 'Sign Up',
    'auth.email': 'Email address',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm password',
    'auth.name': 'Full name',
    'auth.forgotPassword': 'Forgot password?',
    'auth.resetPassword': 'Reset Password',
    'auth.sendResetLink': 'Send Reset Link',
    'auth.backToSignIn': 'Back to Sign In',
    'auth.googleSignIn': 'Continue with Google',
    'auth.magicLink': 'Send Magic Link',
    'auth.magicLinkSent': 'Check your email for the sign-in link',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.signOut': 'Sign Out',
    'auth.orContinueWith': 'or continue with',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.totalMenus': 'Total Menus',
    'dashboard.activeMenus': 'Active Menus',
    'dashboard.totalScans': 'Total QR Scans',
    'dashboard.topMenu': 'Most Scanned',
    'dashboard.createMenu': 'Create Menu',
    'dashboard.noMenus': 'No menus yet',
    'dashboard.noMenusDesc': 'Create your first menu to get started',
    'dashboard.search': 'Search menus...',
    'dashboard.filterBy': 'Filter by',
    'dashboard.sortBy': 'Sort by',
    'dashboard.allCategories': 'All Categories',
    'dashboard.allStatuses': 'All Statuses',
    'dashboard.lastEdited': 'Last edited',
    'dashboard.created': 'Created',
    'dashboard.scanCount': 'Scan count',
    'dashboard.bulkActions': 'Bulk Actions',
    'dashboard.selectAll': 'Select All',
    'dashboard.delete': 'Delete',
    'dashboard.archive': 'Archive',
    'dashboard.export': 'Export',
    'dashboard.folders': 'Collections',
    'dashboard.newFolder': 'New Collection',
    'dashboard.allMenus': 'All Menus',

    // Menu Creation Wizard
    'wizard.title': 'Create New Menu',
    'wizard.step1': 'Choose Template',
    'wizard.step2': 'Menu Details',
    'wizard.step3': 'Language & Currency',
    'wizard.menuName': 'Menu Name',
    'wizard.menuNamePlaceholder': 'e.g., Dinner Menu — Summer 2025',
    'wizard.category': 'Category',
    'wizard.language': 'Primary Language',
    'wizard.currency': 'Currency',
    'wizard.blankTemplate': 'Blank Menu',
    'wizard.next': 'Next',
    'wizard.back': 'Back',
    'wizard.create': 'Create Menu',

    // Categories
    'category.breakfast': 'Breakfast',
    'category.brunch': 'Brunch',
    'category.lunch': 'Lunch',
    'category.dinner': 'Dinner',
    'category.drinks': 'Drinks',
    'category.cocktails': 'Cocktails',
    'category.wine': 'Wine List',
    'category.desserts': 'Desserts',
    'category.kids': 'Kids Menu',
    'category.roomService': 'Room Service',
    'category.poolBar': 'Pool Bar',
    'category.allDay': 'All Day Dining',
    'category.special': 'Special Events',

    // Editor
    'editor.untitled': 'Untitled Menu',
    'editor.save': 'Save',
    'editor.saving': 'Saving...',
    'editor.saved': 'Saved',
    'editor.unsaved': 'Unsaved changes',
    'editor.saveFailed': 'Save failed',
    'editor.preview': 'Preview',
    'editor.publish': 'Publish',
    'editor.unpublish': 'Unpublish',
    'editor.duplicate': 'Duplicate',
    'editor.exportPdf': 'Export PDF',
    'editor.exportPng': 'Export PNG',
    'editor.exportJson': 'Export JSON',
    'editor.shareLink': 'Share Link',
    'editor.print': 'Print',
    'editor.delete': 'Delete Menu',
    'editor.undo': 'Undo',
    'editor.redo': 'Redo',
    'editor.more': 'More',

    // Editor Tabs
    'editor.tabSections': 'Sections',
    'editor.tabElements': 'Elements',
    'editor.tabMedia': 'Media',
    'editor.tabDesign': 'Design',

    // Section Types
    'section.header': 'Header / Cover',
    'section.categoryDivider': 'Category Section',
    'section.menuItem': 'Menu Item',
    'section.itemGrid': 'Item Grid',
    'section.chefSpecial': "Chef's Special",
    'section.comboSet': 'Combo / Set Menu',
    'section.beverageList': 'Beverage List',
    'section.wineList': 'Wine List',
    'section.dessertMenu': 'Dessert Menu',
    'section.kidsMenu': 'Kids Menu',
    'section.allergyInfo': 'Allergy Information',
    'section.spacer': 'Spacer / Divider',
    'section.customHtml': 'Custom Block',
    'section.photoGallery': 'Photo Gallery',
    'section.textBlock': 'Text Block',
    'section.pageBreak': 'Page Break',

    // Item Editor
    'item.name': 'Item Name',
    'item.description': 'Description',
    'item.price': 'Price',
    'item.singlePrice': 'Single Price',
    'item.sizeVariants': 'Size Variants',
    'item.customVariants': 'Custom Variants',
    'item.byWeight': 'By Weight',
    'item.marketPrice': 'Market Price',
    'item.itemNumber': 'Item Number',
    'item.category': 'Category',
    'item.status': 'Status',
    'item.available': 'Available',
    'item.soldOut': 'Sold Out',
    'item.comingSoon': 'Coming Soon',
    'item.seasonal': 'Seasonal',
    'item.addItem': 'Add Item',
    'item.deleteItem': 'Delete Item',
    'item.duplicateItem': 'Duplicate Item',

    // Item Tabs
    'item.tabBasic': 'Basic Info',
    'item.tabMedia': 'Media',
    'item.tabDietary': 'Dietary & Allergens',
    'item.tabAdvanced': 'Advanced',

    // Dietary
    'dietary.vegetarian': 'Vegetarian',
    'dietary.vegan': 'Vegan',
    'dietary.glutenFree': 'Gluten-Free',
    'dietary.halal': 'Halal',
    'dietary.kosher': 'Kosher',
    'dietary.dairyFree': 'Dairy-Free',
    'dietary.nutFree': 'Nut-Free',
    'dietary.organic': 'Organic',
    'dietary.raw': 'Raw',
    'dietary.keto': 'Keto',
    'dietary.lowCal': 'Low-Cal',
    'dietary.signature': 'Signature',
    'dietary.chefsPick': "Chef's Pick",
    'dietary.new': 'New',
    'dietary.spicy': 'Spicy',
    'dietary.alcohol': 'Contains Alcohol',

    // Allergens
    'allergen.celery': 'Celery',
    'allergen.cereals': 'Cereals',
    'allergen.crustaceans': 'Crustaceans',
    'allergen.eggs': 'Eggs',
    'allergen.fish': 'Fish',
    'allergen.lupin': 'Lupin',
    'allergen.milk': 'Milk',
    'allergen.molluscs': 'Molluscs',
    'allergen.mustard': 'Mustard',
    'allergen.nuts': 'Tree Nuts',
    'allergen.peanuts': 'Peanuts',
    'allergen.sesame': 'Sesame',
    'allergen.soya': 'Soya',
    'allergen.sulphites': 'Sulphites',

    // Design
    'design.theme': 'Theme',
    'design.customTheme': 'Custom Theme',
    'design.colors': 'Colors',
    'design.typography': 'Typography',
    'design.layout': 'Layout',
    'design.borders': 'Borders & Decorations',
    'design.backgrounds': 'Backgrounds',
    'design.primary': 'Primary',
    'design.secondary': 'Secondary',
    'design.accent': 'Accent',
    'design.background': 'Background',
    'design.text': 'Text Color',
    'design.headingFont': 'Heading Font',
    'design.bodyFont': 'Body Font',
    'design.fontSize': 'Font Size',
    'design.lineHeight': 'Line Height',
    'design.letterSpacing': 'Letter Spacing',
    'design.pageMargins': 'Page Margins',
    'design.sectionSpacing': 'Section Spacing',
    'design.itemSpacing': 'Item Spacing',

    // Preview & Export
    'preview.title': 'Preview',
    'preview.digital': 'Digital View',
    'preview.print': 'Print View',
    'preview.mobile': 'Mobile View',
    'preview.qrScan': 'QR Scan View',
    'preview.export': 'Export',
    'preview.download': 'Download',
    'preview.qrCode': 'QR Code',
    'preview.shareLink': 'Share Link',
    'preview.copyLink': 'Copy Link',
    'preview.linkCopied': 'Link copied!',

    // Settings
    'settings.title': 'Settings',
    'settings.brand': 'Brand Settings',
    'settings.team': 'Team Management',
    'settings.account': 'Account',
    'settings.hotelName': 'Hotel Name',
    'settings.location': 'Location',
    'settings.logo': 'Logo',
    'settings.primaryColor': 'Brand Color',
    'settings.defaultLanguage': 'Default Language',
    'settings.inviteMember': 'Invite Team Member',
    'settings.role': 'Role',
    'settings.owner': 'Owner',
    'settings.manager': 'Manager',
    'settings.staff': 'Staff',

    // Status
    'status.active': 'Active',
    'status.draft': 'Draft',
    'status.archived': 'Archived',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.duplicate': 'Duplicate',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'common.retry': 'Try again',
    'common.upload': 'Upload',
    'common.dragDrop': 'Drag & drop or click to upload',
    'common.search': 'Search...',
    'common.noResults': 'No results found',
    'common.add': 'Add',
    'common.remove': 'Remove',
    'common.moveUp': 'Move Up',
    'common.moveDown': 'Move Down',
    'common.required': 'This field is required',

    // Confirmations
    'confirm.deleteMenu': 'Are you sure you want to delete this menu? This action cannot be undone.',
    'confirm.deleteItem': 'Delete this menu item?',
    'confirm.deleteSection': 'Delete this section and all its items?',
    'confirm.unsavedChanges': 'You have unsaved changes. Are you sure you want to leave?',

    // Toasts
    'toast.menuCreated': 'Menu created successfully',
    'toast.menuDeleted': 'Menu deleted',
    'toast.menuDuplicated': 'Menu duplicated',
    'toast.menuPublished': 'Menu published! QR code is now active.',
    'toast.menuUnpublished': 'Menu unpublished',
    'toast.itemAdded': 'Item added',
    'toast.itemDeleted': 'Item deleted',
    'toast.sectionAdded': 'Section added',
    'toast.sectionDeleted': 'Section deleted',
    'toast.imageuploaded': 'Image uploaded',
    'toast.exportStarted': 'Generating export...',
    'toast.exportComplete': 'Export complete',
    'toast.linkCopied': 'Link copied to clipboard',
    'toast.passwordReset': 'Password reset email sent',
    'toast.inviteSent': 'Invitation sent',
  },

  ar: {
    'app.name': 'MenuForge',
    'app.tagline': 'استوديو قائمة الفندق',
    'app.description': 'أنشئ قوائم طعام رقمية ومطبوعة مذهلة في دقائق',
    'auth.signIn': 'تسجيل الدخول',
    'auth.signUp': 'إنشاء حساب',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.confirmPassword': 'تأكيد كلمة المرور',
    'auth.name': 'الاسم الكامل',
    'auth.forgotPassword': 'نسيت كلمة المرور؟',
    'auth.resetPassword': 'إعادة تعيين كلمة المرور',
    'auth.googleSignIn': 'المتابعة مع جوجل',
    'auth.magicLink': 'إرسال رابط سحري',
    'auth.noAccount': 'ليس لديك حساب؟',
    'auth.hasAccount': 'لديك حساب بالفعل؟',
    'auth.signOut': 'تسجيل الخروج',
    'dashboard.title': 'لوحة التحكم',
    'dashboard.welcome': 'مرحبًا بعودتك',
    'dashboard.createMenu': 'إنشاء قائمة',
    'dashboard.noMenus': 'لا توجد قوائم بعد',
    'dashboard.search': 'البحث في القوائم...',
    'editor.save': 'حفظ',
    'editor.preview': 'معاينة',
    'editor.publish': 'نشر',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.close': 'إغلاق',
    'common.loading': 'جاري التحميل...',
    'status.active': 'نشط',
    'status.draft': 'مسودة',
    'status.archived': 'مؤرشف',
  },

  fr: {
    'app.name': 'MenuForge',
    'app.tagline': 'Studio de Menu Hôtelier',
    'auth.signIn': 'Se connecter',
    'auth.signUp': "S'inscrire",
    'auth.email': 'Adresse email',
    'auth.password': 'Mot de passe',
    'auth.name': 'Nom complet',
    'auth.googleSignIn': 'Continuer avec Google',
    'auth.signOut': 'Se déconnecter',
    'dashboard.title': 'Tableau de bord',
    'dashboard.createMenu': 'Créer un menu',
    'editor.save': 'Enregistrer',
    'editor.preview': 'Aperçu',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.delete': 'Supprimer',
    'status.active': 'Actif',
    'status.draft': 'Brouillon',
    'status.archived': 'Archivé',
  },

  es: {
    'app.name': 'MenuForge',
    'app.tagline': 'Estudio de Menú para Hoteles',
    'auth.signIn': 'Iniciar sesión',
    'auth.signUp': 'Registrarse',
    'auth.email': 'Correo electrónico',
    'auth.password': 'Contraseña',
    'auth.googleSignIn': 'Continuar con Google',
    'auth.signOut': 'Cerrar sesión',
    'dashboard.title': 'Panel de control',
    'dashboard.createMenu': 'Crear menú',
    'editor.save': 'Guardar',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'status.active': 'Activo',
    'status.draft': 'Borrador',
    'status.archived': 'Archivado',
  },

  de: {
    'app.name': 'MenuForge',
    'app.tagline': 'Hotel-Menü Studio',
    'auth.signIn': 'Anmelden',
    'auth.signUp': 'Registrieren',
    'auth.email': 'E-Mail-Adresse',
    'auth.password': 'Passwort',
    'auth.googleSignIn': 'Mit Google fortfahren',
    'auth.signOut': 'Abmelden',
    'dashboard.title': 'Dashboard',
    'dashboard.createMenu': 'Menü erstellen',
    'editor.save': 'Speichern',
    'common.save': 'Speichern',
    'common.cancel': 'Abbrechen',
    'common.delete': 'Löschen',
    'status.active': 'Aktiv',
    'status.draft': 'Entwurf',
    'status.archived': 'Archiviert',
  },

  zh: {
    'app.name': 'MenuForge',
    'app.tagline': '酒店菜單工作室',
    'auth.signIn': '登入',
    'auth.signUp': '註冊',
    'auth.email': '電子郵件',
    'auth.password': '密碼',
    'auth.googleSignIn': '使用 Google 繼續',
    'auth.signOut': '登出',
    'dashboard.title': '控制面板',
    'dashboard.createMenu': '建立菜單',
    'editor.save': '儲存',
    'common.save': '儲存',
    'common.cancel': '取消',
    'common.delete': '刪除',
    'status.active': '啟用',
    'status.draft': '草稿',
    'status.archived': '已封存',
  }
};

// RTL languages
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

// Language metadata
const LANGUAGE_META = {
  en: { name: 'English', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  zh: { name: 'Chinese', nativeName: '繁體中文', flag: '🇹🇼', dir: 'ltr' }
};

let currentLang = 'en';

/**
 * Get a translated string by key
 * Falls back to English, then to the key itself
 */
export function t(key, replacements = {}) {
  let text = translations[currentLang]?.[key]
    || translations['en']?.[key]
    || key;

  // Replace {{placeholders}}
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`{{${k}}}`, 'g'), v);
  }

  return text;
}

/**
 * Set the current language
 */
export function setLanguage(lang) {
  if (!translations[lang]) {
    console.warn(`Language "${lang}" not supported, falling back to English`);
    lang = 'en';
  }
  currentLang = lang;
  applyDirection(lang);
  document.documentElement.lang = lang;

  // Dispatch event so UI components can re-render
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
}

/**
 * Get current language
 */
export function getLanguage() {
  return currentLang;
}

/**
 * Apply text direction based on language
 */
export function applyDirection(lang) {
  const dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.setAttribute('data-dir', dir);
}

/**
 * Check if current language is RTL
 */
export function isRTL() {
  return RTL_LANGUAGES.includes(currentLang);
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages() {
  return Object.entries(LANGUAGE_META).map(([code, meta]) => ({
    code,
    ...meta
  }));
}

/**
 * Get language metadata
 */
export function getLanguageMeta(code) {
  return LANGUAGE_META[code] || LANGUAGE_META['en'];
}

/**
 * Detect browser language and set it
 */
export function detectLanguage() {
  const browserLang = navigator.language?.split('-')[0] || 'en';
  if (translations[browserLang]) {
    return browserLang;
  }
  return 'en';
}

/**
 * Initialize i18n — call once on app start
 */
export function initI18n(preferredLang) {
  const lang = preferredLang || detectLanguage();
  setLanguage(lang);
  return lang;
}

/**
 * Translate all elements with data-i18n attribute
 */
export function translatePage() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    if (attr) {
      el.setAttribute(attr, t(key));
    } else {
      el.textContent = t(key);
    }
  });

  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });

  // Translate aria-labels
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
}

export { translations, LANGUAGE_META, RTL_LANGUAGES };
