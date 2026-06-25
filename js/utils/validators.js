/* ============================================
   MenuForge — Input Validators
   Validation rules for all form inputs
   ============================================ */

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

/**
 * Validate password strength
 * Returns { valid, score, feedback }
 */
export function validatePassword(password) {
  const feedback = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('At least 8 characters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('One uppercase letter');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('One lowercase letter');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('One number');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('One special character');

  return {
    valid: score >= 3 && password.length >= 8,
    score,
    strength: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][Math.min(score, 4)],
    feedback
  };
}

/**
 * Check if a field is not empty
 */
export function isRequired(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

/**
 * Validate price (positive number)
 */
export function isValidPrice(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0 && isFinite(num);
}

/**
 * Validate URL format
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate hex color
 */
export function isValidHex(hex) {
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(hex);
}

/**
 * Validate min/max length
 */
export function isLength(value, min = 0, max = Infinity) {
  const len = String(value).trim().length;
  return len >= min && len <= max;
}

/**
 * Validate a whole form — returns { valid, errors }
 * rules: { fieldName: [{ test: fn, message: string }] }
 */
export function validateForm(data, rules) {
  const errors = {};
  let valid = true;

  for (const [field, validators] of Object.entries(rules)) {
    for (const { test, message } of validators) {
      if (!test(data[field])) {
        if (!errors[field]) errors[field] = [];
        errors[field].push(message);
        valid = false;
      }
    }
  }

  return { valid, errors };
}

/**
 * Show inline error on a form field
 */
export function showFieldError(inputEl, message) {
  clearFieldError(inputEl);
  inputEl.classList.add('input--error');
  const errorEl = document.createElement('span');
  errorEl.className = 'field-error';
  errorEl.textContent = message;
  errorEl.setAttribute('role', 'alert');
  inputEl.parentNode.appendChild(errorEl);
}

/**
 * Clear inline error from a form field
 */
export function clearFieldError(inputEl) {
  inputEl.classList.remove('input--error');
  const existing = inputEl.parentNode.querySelector('.field-error');
  if (existing) existing.remove();
}

/**
 * Clear all errors in a form
 */
export function clearAllErrors(formEl) {
  formEl.querySelectorAll('.input--error').forEach(el => el.classList.remove('input--error'));
  formEl.querySelectorAll('.field-error').forEach(el => el.remove());
}
