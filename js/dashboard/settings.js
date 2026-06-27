/* ============================================
   MenuForge — Settings Module
   Property info, Team management, Preferences
   ============================================ */

import db from '../db.js';
import authManager from '../auth.js';
import imageKit from '../imagekit.js';
import { state, toast, confirm, initApp, renderTopNav, setTheme, navigateTo, updateHotelPublicPortal } from '../app.js';
import { $, slugify } from '../utils/helpers.js';
import { t } from '../utils/i18n.js';

class SettingsManager {
  constructor() {
    this.hotelId = null;
    this.hotelInfo = null;
    this.team = {};
    this.userRole = 'viewer';
  }

  async init() {
    this.hotelId = state.get('currentHotelId');
    if (!this.hotelId) {
      toast.warning('No active property found. Redirecting to dashboard.');
      navigateTo('dashboard.html');
      return;
    }

    // Check user role
    const user = authManager.getUser();
    if (user) {
      this.userRole = await authManager.getUserRole(this.hotelId) || 'viewer';
    }

    await this.loadData();
    this.render();
    this.bindEvents();
  }

  async loadData() {
    try {
      // Fetch hotel info
      this.hotelInfo = await db.get(`hotels/${this.hotelId}/info`) || {};
      
      // Fetch team members
      this.team = await db.get(`hotels/${this.hotelId}/team`) || {};
    } catch (error) {
      console.error('Error loading settings data:', error);
      toast.error('Failed to load settings data');
    }
  }

  render() {
    // Populate form fields
    $('#prop-name').value = this.hotelInfo.name || '';
    $('#prop-subdomain').value = this.hotelInfo.subdomain || '';
    $('#prop-location').value = this.hotelInfo.location || '';
    $('#prop-address').value = this.hotelInfo.address || '';
    $('#prop-contact').value = this.hotelInfo.contact || '';
    $('#prop-currency').value = this.hotelInfo.currency || 'USD';
    $('#prop-lang').value = this.hotelInfo.primaryLanguage || 'en';
    $('#prop-allergy-notice').value = this.hotelInfo.allergyNotice || '';

    // Render Logo preview
    const logoContainer = $('#logo-preview-container');
    if (this.hotelInfo.logo) {
      logoContainer.innerHTML = `
        <div class="logo-preview-wrapper">
          <img src="${this.hotelInfo.logo}" alt="Hotel Logo" class="logo-preview-img">
          <button type="button" class="btn btn--danger btn--sm remove-logo-btn" id="btn-remove-logo">Remove</button>
        </div>
      `;
    } else {
      logoContainer.innerHTML = `
        <div class="logo-upload-placeholder">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="upload-text">Drag logo here or click to upload</span>
          <span class="upload-hint">PNG, JPG, or SVG up to 2MB</span>
        </div>
      `;
    }

    // Check permissions - disable inputs if staff/viewer
    const isEditable = this.userRole === 'owner' || this.userRole === 'admin';
    if (!isEditable) {
      document.querySelectorAll('#brand-form input, #brand-form select, #brand-form textarea').forEach(el => {
        el.disabled = true;
      });
      $('#btn-save-brand').style.display = 'none';
      $('#logo-upload-zone').style.pointerEvents = 'none';
      if ($('#btn-remove-logo')) $('#btn-remove-logo').style.display = 'none';
      $('#team-invite-card').style.display = 'none';
    }

    // Render Team list
    this.renderTeamList();
    
    // Render user preferences tab
    this.renderPreferences();
  }

  renderTeamList() {
    const listEl = $('#team-list');
    if (!listEl) return;

    const teamEntries = Object.entries(this.team);
    
    if (teamEntries.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No team members found</div>';
      return;
    }

    const currentUserId = authManager.getUser()?.uid;
    const isEditable = this.userRole === 'owner' || this.userRole === 'admin';

    listEl.innerHTML = teamEntries.map(([uid, member]) => {
      const isSelf = uid === currentUserId;
      const initials = (member.name || member.email || 'U').charAt(0).toUpperCase();
      const addedDate = member.addedAt ? new Date(member.addedAt).toLocaleDateString() : 'N/A';
      
      let roleBadgeClass = 'badge--secondary';
      if (member.role === 'owner') roleBadgeClass = 'badge--success';
      else if (member.role === 'admin') roleBadgeClass = 'badge--primary';
      else if (member.role === 'editor') roleBadgeClass = 'badge--warning';

      // Cannot remove owners or yourself, and admins can only remove editors/staff
      let showDelete = isEditable && !isSelf && member.role !== 'owner';
      if (this.userRole === 'admin' && member.role === 'admin') {
        showDelete = false; // Admin cannot delete another admin
      }

      return `
        <div class="team-member-row" data-uid="${uid}">
          <div class="member-info">
            <div class="member-avatar">${initials}</div>
            <div>
              <div class="member-name">${member.name || 'Invited User'} ${isSelf ? '<span class="self-tag">(You)</span>' : ''}</div>
              <div class="member-email">${member.email}</div>
            </div>
          </div>
          <div class="member-meta">
            <span class="badge ${roleBadgeClass}">${member.role}</span>
            <span class="member-date">Added ${addedDate}</span>
            ${showDelete ? `
              <button class="btn btn--icon btn-remove-member" data-uid="${uid}" aria-label="Remove member" title="Remove member">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" stroke-linecap="round"/></svg>
              </button>
            ` : '<div style="width: 32px;"></div>'}
          </div>
        </div>
      `;
    }).join('');
  }

  renderPreferences() {
    const user = authManager.getUser();
    if (!user) return;

    db.get(`users/${user.uid}/preferences`).then(prefs => {
      if (prefs) {
        $('#pref-theme').value = prefs.defaultTheme || 'luxe-noir';
        $('#pref-ui-theme').value = state.get('theme') || 'light';
        $('#pref-lang').value = prefs.language || 'en';
      }
    });
  }

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        $(`#panel-${tab}`).classList.add('active');
      });
    });

    // Save Brand Info
    $('#brand-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const isEditable = this.userRole === 'owner' || this.userRole === 'admin';
      if (!isEditable) {
        toast.error('You do not have permission to edit settings.');
        return;
      }

      const btn = $('#btn-save-brand');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      const newSubdomainInput = $('#prop-subdomain').value.trim().toLowerCase();
      const newSubdomain = slugify(newSubdomainInput);
      const oldSubdomain = this.hotelInfo.subdomain || '';

      const updateData = {
        name: $('#prop-name').value.trim(),
        location: $('#prop-location').value.trim(),
        address: $('#prop-address').value.trim(),
        contact: $('#prop-contact').value.trim(),
        currency: $('#prop-currency').value,
        primaryLanguage: $('#prop-lang').value,
        allergyNotice: $('#prop-allergy-notice').value.trim(),
        updatedAt: Date.now()
      };

      try {
        if (newSubdomain !== oldSubdomain) {
          const reserved = ['www', 'admin', 'api', 'menuforgee', 'login', 'dashboard', 'settings', 'preview', 'editor'];
          if (reserved.includes(newSubdomain)) {
            toast.error('This subdomain is reserved. Please choose another one.');
            btn.disabled = false;
            btn.textContent = 'Save Changes';
            return;
          }
          if (newSubdomain.length < 3) {
            toast.error('Subdomain must be at least 3 characters.');
            btn.disabled = false;
            btn.textContent = 'Save Changes';
            return;
          }

          const existingHotelId = await db.get(`slugs/${newSubdomain}`);
          if (existingHotelId && existingHotelId !== this.hotelId) {
            toast.error('This subdomain is already in use. Please choose another one.');
            btn.disabled = false;
            btn.textContent = 'Save Changes';
            return;
          }

          if (oldSubdomain) {
            await db.delete(`slugs/${oldSubdomain}`);
          }
          await db.set(`slugs/${newSubdomain}`, this.hotelId);
          updateData.subdomain = newSubdomain;
        } else {
          updateData.subdomain = oldSubdomain;
        }

        await db.update(`hotels/${this.hotelId}/info`, updateData);
        this.hotelInfo = { ...this.hotelInfo, ...updateData };
        state.set('currentHotel', { ...state.get('currentHotel'), ...updateData });
        await updateHotelPublicPortal(this.hotelId);
        toast.success('Property settings saved successfully');
      } catch (error) {
        toast.error('Failed to save settings: ' + error.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
    });

    // Logo Upload Trigger
    const uploadZone = $('#logo-upload-zone');
    const fileInput = $('#hotel-logo-file');

    uploadZone?.addEventListener('click', () => {
      if (this.userRole === 'owner' || this.userRole === 'admin') {
        fileInput.click();
      }
    });

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await this.handleLogoUpload(file);
    });

    // Logo drag and drop
    uploadZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone?.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone?.addEventListener('drop', async (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      
      const file = e.dataTransfer.files[0];
      if (!file) return;
      await this.handleLogoUpload(file);
    });

    // Remove Logo button
    $('#logo-preview-container')?.addEventListener('click', async (e) => {
      if (e.target.id === 'btn-remove-logo' || e.target.classList.contains('remove-logo-btn')) {
        const confirmed = await confirm('Are you sure you want to remove the brand logo?');
        if (!confirmed) return;

        try {
          await db.update(`hotels/${this.hotelId}/info`, { logo: '' });
          this.hotelInfo.logo = '';
          await updateHotelPublicPortal(this.hotelId);
          this.render();
          toast.success('Logo removed');
        } catch (error) {
          toast.error('Failed to remove logo');
        }
      }
    });

    // Invite Member
    $('#team-invite-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = $('#invite-name').value.trim();
      const email = $('#invite-email').value.trim().toLowerCase();
      const role = $('#invite-role').value;

      if (!name || !email) {
        toast.warning('Please fill in all fields');
        return;
      }

      const inviteBtn = $('#btn-invite-member');
      inviteBtn.disabled = true;
      inviteBtn.textContent = 'Inviting...';

      try {
        // Look up if user already exists in users DB by scanning email
        // For security rules compatibility, we'll write the member directly in hotels/team
        // Using a safe push key, or let's create a placeholder uid if not registered
        // If registered, they can join. Since we are client side, we push member to team list first
        const memberId = db.newKey(`hotels/${this.hotelId}/team`);
        
        await db.set(`hotels/${this.hotelId}/team/${memberId}`, {
          name,
          email,
          role,
          addedAt: Date.now()
        });

        // Also if we mock user registration, we can add it to the viewable list
        this.team[memberId] = { name, email, role, addedAt: Date.now() };
        this.renderTeamList();
        
        // Reset form
        $('#team-invite-form').reset();
        toast.success(`Successfully invited ${name} as ${role}`);
      } catch (error) {
        toast.error('Failed to invite member: ' + error.message);
      } finally {
        inviteBtn.disabled = false;
        inviteBtn.textContent = 'Send Invitation';
      }
    });

    // Remove Member (Event Delegation)
    $('#team-list')?.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.btn-remove-member');
      if (!removeBtn) return;

      const uid = removeBtn.dataset.uid;
      const memberName = this.team[uid]?.name || 'this member';

      const confirmed = await confirm(`Are you sure you want to remove ${memberName} from the team?`);
      if (!confirmed) return;

      try {
        await db.delete(`hotels/${this.hotelId}/team/${uid}`);
        delete this.team[uid];
        this.renderTeamList();
        toast.success(`${memberName} has been removed`);
      } catch (error) {
        toast.error('Failed to remove member');
      }
    });

    // Save Preferences
    $('#preferences-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const user = authManager.getUser();
      if (!user) return;

      const defaultTheme = $('#pref-theme').value;
      const uiTheme = $('#pref-ui-theme').value;
      const language = $('#pref-lang').value;

      try {
        // Save locally
        setTheme(uiTheme);
        localStorage.setItem('menuforge_language', language);
        
        // Save in DB
        await db.update(`users/${user.uid}/preferences`, {
          defaultTheme,
          language
        });

        toast.success('App preferences updated');
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        toast.error('Failed to save preferences');
      }
    });
  }

  async handleLogoUpload(file) {
    if (!imageKit.isSupported(file)) {
      toast.error('Unsupported file format. Please upload JPG, PNG or WebP.');
      return;
    }

    const toastId = toast.loading('Uploading logo to ImageKit...');
    
    try {
      const result = await imageKit.upload(file, {
        hotelId: this.hotelId,
        folder: `/hotels/${this.hotelId}/logo/`
      });

      // Update in DB
      await db.update(`hotels/${this.hotelId}/info`, { logo: result.url });
      this.hotelInfo.logo = result.url;
      await updateHotelPublicPortal(this.hotelId);
      
      toast.dismiss(toastId);
      toast.success('Logo uploaded successfully');
      this.render();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Upload failed: ' + error.message);
    }
  }
}

// Initialize settings
const settings = new SettingsManager();

document.addEventListener('DOMContentLoaded', async () => {
  await initApp({
    requiresAuth: true,
    onReady: async () => {
      renderTopNav({ showBackButton: true, backHref: 'dashboard.html' });
      await settings.init();
    }
  });
});
