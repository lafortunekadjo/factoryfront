import { Component, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-page animate-in">
      <h2 class="page-title">👤 Mon profil</h2>

      <!-- ── PHOTO DE PROFIL ── -->
      <div class="profile-card factory-card">
        <div class="avatar-section">
          <div class="avatar-wrap" (click)="fileInput.click()">
            @if (avatarPreview() || user()?.avatarUrl) {
              <img [src]="avatarPreview() ?? fullAvatarUrl()" class="avatar-img" alt="Photo de profil" />
            } @else {
              <div class="avatar-placeholder">{{ initials() }}</div>
            }
            <div class="avatar-overlay">
              <span>📷</span>
            </div>
          </div>
          <input #fileInput type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                 style="display:none;" (change)="onFileSelected($event)" />

          <div class="avatar-actions">
            <button class="btn-avatar-action" (click)="fileInput.click()">
              {{ user()?.avatarUrl || avatarPreview() ? '✏️ Changer la photo' : '+ Ajouter une photo' }}
            </button>
            @if (avatarPreview()) {
              <button class="btn-avatar-cancel" (click)="cancelAvatarChange()">Annuler</button>
            }
          </div>

          @if (uploadingAvatar()) {
            <div class="upload-progress">⏳ Envoi en cours...</div>
          }
          @if (avatarPreview() && !uploadingAvatar()) {
            <button class="btn-factory-primary avatar-save-btn" (click)="saveAvatar()">
              💾 Enregistrer la photo
            </button>
          }
        </div>
      </div>

      <!-- ── INFOS PERSONNELLES ── -->
      <div class="profile-card factory-card">
        <div class="section-title">📝 Informations personnelles</div>

        <div class="row-2">
          <div>
            <label class="factory-label">Prénom</label>
            <input class="factory-input" [(ngModel)]="form.firstName" />
          </div>
          <div>
            <label class="factory-label">Nom</label>
            <input class="factory-input" [(ngModel)]="form.lastName" />
          </div>
        </div>

        <label class="factory-label" style="margin-top:11px;">Email</label>
        <input class="factory-input" [value]="user()?.email" disabled />
        <div class="field-hint">L'email ne peut pas être modifié directement. Contactez votre administrateur.</div>

        <div class="row-2" style="margin-top:11px;">
          <div>
            <label class="factory-label">Poste / Fonction</label>
            <input class="factory-input" [(ngModel)]="form.jobTitle" placeholder="ex: Superviseur Ligne 1" />
          </div>
          <div>
            <label class="factory-label">Téléphone</label>
            <input class="factory-input" [(ngModel)]="form.phone" placeholder="+237 6xx xxx xxx" />
          </div>
        </div>

        <button class="btn-factory-primary" style="margin-top:16px;"
                [disabled]="savingProfile() || !form.firstName || !form.lastName"
                (click)="saveProfile()">
          {{ savingProfile() ? '⏳ Enregistrement...' : '💾 Enregistrer les modifications' }}
        </button>
      </div>

      <!-- ── PRÉFÉRENCES ── -->
      <div class="profile-card factory-card">
        <div class="section-title">⚙️ Préférences</div>

        <div class="row-2">
          <div>
            <label class="factory-label">Langue</label>
            <select class="factory-input" [(ngModel)]="form.preferredLanguage" (ngModelChange)="savePreferences()">
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label class="factory-label">Thème</label>
            <select class="factory-input" [(ngModel)]="form.preferredTheme" (ngModelChange)="savePreferences()">
              <option value="dark">Sombre</option>
              <option value="light">Clair</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ── MOT DE PASSE ── -->
      <div class="profile-card factory-card">
        <div class="section-title">🔒 Mot de passe</div>

        <label class="factory-label">Mot de passe actuel</label>
        <input class="factory-input" type="password" [(ngModel)]="pwdForm.currentPassword"
               placeholder="••••••••" autocomplete="current-password" />

        <div class="row-2" style="margin-top:11px;">
          <div>
            <label class="factory-label">Nouveau mot de passe</label>
            <input class="factory-input" type="password" [(ngModel)]="pwdForm.newPassword"
                   placeholder="Min. 8 caractères" autocomplete="new-password" />
          </div>
          <div>
            <label class="factory-label">Confirmer le nouveau mot de passe</label>
            <input class="factory-input" type="password" [(ngModel)]="pwdForm.confirmPassword"
                   placeholder="Répéter le mot de passe" autocomplete="new-password" />
          </div>
        </div>

        @if (pwdForm.newPassword && pwdForm.confirmPassword && pwdForm.newPassword !== pwdForm.confirmPassword) {
          <div class="pwd-mismatch">⚠️ Les mots de passe ne correspondent pas</div>
        }
        @if (pwdForm.newPassword && pwdForm.newPassword.length < 8) {
          <div class="pwd-mismatch">⚠️ Le mot de passe doit contenir au moins 8 caractères</div>
        }

        <button class="btn-factory-primary" style="margin-top:16px;"
                [disabled]="!canSubmitPassword() || changingPassword()"
                (click)="changePassword()">
          {{ changingPassword() ? '⏳ Modification...' : '🔑 Modifier le mot de passe' }}
        </button>
      </div>

      @if (toast()) {
        <div class="toast" [class.error]="toastError()">{{ toast() }}</div>
      }
    </div>
  `,
  styles: [`
    .profile-page { max-width: 640px; margin: 0 auto; padding-bottom: 40px; }
    .page-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; }

    .profile-card { margin-bottom: 14px; }
    .section-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; color: var(--text); }

    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media(max-width: 480px) { .row-2 { grid-template-columns: 1fr; } }

    .field-hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

    /* Avatar */
    .avatar-section { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .avatar-wrap {
      position: relative; width: 100px; height: 100px;
      border-radius: 50%; cursor: pointer; overflow: hidden;
      border: 3px solid var(--factory-primary);
      margin-bottom: 14px;
    }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .avatar-placeholder {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: var(--factory-primary); color: #fff;
      font-size: 32px; font-weight: 800;
    }
    .avatar-overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.2s;
      font-size: 22px;
    }
    .avatar-wrap:hover .avatar-overlay { opacity: 1; }

    .avatar-actions { display: flex; gap: 8px; align-items: center; }
    .btn-avatar-action {
      padding: 8px 16px; border-radius: 8px;
      background: var(--bg-card2); border: 1px solid var(--border);
      color: var(--text); cursor: pointer; font-size: 13px; font-weight: 600;
    }
    .btn-avatar-cancel {
      padding: 8px 14px; border-radius: 8px;
      background: none; border: 1px solid var(--border);
      color: var(--text-muted); cursor: pointer; font-size: 13px;
    }
    .upload-progress { margin-top: 10px; font-size: 13px; color: var(--text-muted); }
    .avatar-save-btn { margin-top: 14px; width: 100%; max-width: 240px; }

    /* Password */
    .pwd-mismatch {
      margin-top: 8px; padding: 8px 12px;
      background: #FF4D6D11; border: 1px solid #FF4D6D33;
      border-radius: 8px; font-size: 12px; color: var(--color-danger);
    }

    /* Toast */
    .toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: var(--color-success); color: #000; padding: 10px 22px;
      border-radius: 20px; font-weight: 700; font-size: 14px; z-index: 999;
    }
    .toast.error { background: var(--color-danger); color: #fff; }
  `]
})
export class ProfileComponent {
  auth = inject(AuthService);
  http = inject(HttpClient);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  user = this.auth.user;

  savingProfile     = signal(false);
  changingPassword  = signal(false);
  uploadingAvatar   = signal(false);
  toast             = signal('');
  toastError        = signal(false);

  avatarPreview = signal<string | null>(null);
  private selectedFile: File | null = null;

  form = {
    firstName: this.user()?.firstName ?? '',
    lastName: this.user()?.lastName ?? '',
    jobTitle: this.user()?.jobTitle ?? '',
    phone: this.user()?.phone ?? '',
    preferredLanguage: this.user()?.preferredLanguage ?? 'fr',
    preferredTheme: this.user()?.preferredTheme ?? 'dark',
  };

  pwdForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  initials(): string {
    const u = this.user();
    if (!u) return '?';
    return ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  fullAvatarUrl(): string {
    const url = this.user()?.avatarUrl ?? '';
    if (!url) return '';
    // Si l'URL est déjà absolue (http...), on l'utilise telle quelle.
    if (url.startsWith('http')) return url;
    // Sinon on préfixe avec l'origine de l'API (sans le suffixe /api déjà inclus dans l'URL retournée par le backend).
    const apiRoot = environment.apiUrl.replace(/\/api$/, '');
    return apiRoot + url;
  }

  // ── Avatar ─────────────────────────────────────────────
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.showToast('Fichier trop volumineux (max 5 Mo)', true);
      return;
    }

    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => this.avatarPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  cancelAvatarChange() {
    this.avatarPreview.set(null);
    this.selectedFile = null;
  }

  saveAvatar() {
    if (!this.selectedFile) return;
    this.uploadingAvatar.set(true);

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<{ url: string }>(`${environment.apiUrl}/uploads/avatar`, formData).subscribe({
      next: (res) => {
        // Persister l'URL sur le profil utilisateur
        this.http.put<any>(`${environment.apiUrl}/auth/me`, { avatarUrl: res.url }).subscribe({
          next: (updatedUser) => {
            this.auth.updateLocalUser(updatedUser);
            this.avatarPreview.set(null);
            this.selectedFile = null;
            this.uploadingAvatar.set(false);
            this.showToast('✅ Photo de profil mise à jour');
          },
          error: () => { this.uploadingAvatar.set(false); this.showToast('Erreur lors de l\'enregistrement', true); }
        });
      },
      error: () => { this.uploadingAvatar.set(false); this.showToast('Erreur lors de l\'envoi de l\'image', true); }
    });
  }

  // ── Infos personnelles ──────────────────────────────────
  saveProfile() {
    if (!this.form.firstName || !this.form.lastName) return;
    this.savingProfile.set(true);

    this.http.put<any>(`${environment.apiUrl}/auth/me`, {
      firstName: this.form.firstName,
      lastName: this.form.lastName,
      jobTitle: this.form.jobTitle || undefined,
      phone: this.form.phone || undefined,
    }).subscribe({
      next: (updatedUser) => {
        this.auth.updateLocalUser(updatedUser);
        this.savingProfile.set(false);
        this.showToast('✅ Profil mis à jour');
      },
      error: () => { this.savingProfile.set(false); this.showToast('Erreur lors de la mise à jour', true); }
    });
  }

  // ── Préférences ──────────────────────────────────────────
  savePreferences() {
    this.http.put<any>(`${environment.apiUrl}/auth/me/preferences`, {
      preferredLanguage: this.form.preferredLanguage,
      preferredTheme: this.form.preferredTheme,
    }).subscribe({
      next: (updatedUser) => {
        this.auth.updateLocalUser(updatedUser);
        this.showToast('✅ Préférences enregistrées');
        // Appliquer le thème immédiatement
        document.documentElement.setAttribute('data-theme', this.form.preferredTheme);
      },
      error: () => this.showToast('Erreur lors de la mise à jour', true)
    });
  }

  // ── Mot de passe ─────────────────────────────────────────
  canSubmitPassword(): boolean {
    return !!this.pwdForm.currentPassword
      && this.pwdForm.newPassword.length >= 8
      && this.pwdForm.newPassword === this.pwdForm.confirmPassword;
  }

  changePassword() {
    if (!this.canSubmitPassword()) return;
    this.changingPassword.set(true);

    this.http.put(`${environment.apiUrl}/auth/me/password`, {
      currentPassword: this.pwdForm.currentPassword,
      newPassword: this.pwdForm.newPassword,
    }).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.pwdForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
        this.showToast('✅ Mot de passe modifié avec succès');
      },
      error: (e) => {
        this.changingPassword.set(false);
        const msg = e?.error?.message?.includes('WRONG_PASSWORD') || e?.status === 400
          ? 'Mot de passe actuel incorrect'
          : 'Erreur lors de la modification';
        this.showToast(msg, true);
      }
    });
  }

  private showToast(msg: string, error = false) {
    this.toast.set(msg);
    this.toastError.set(error);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
