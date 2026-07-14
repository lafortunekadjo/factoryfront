import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { FactoryConfigService } from '../../../core/services/factory-config.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">

        <!-- Branding dynamique -->
        <div class="login-header">
          @if (config.logoUrl()) {
            <img [src]="config.logoUrl()!" class="login-logo" alt="Logo" />
          } @else {
            <div class="login-icon">⚙️</div>
          }
          <div class="login-subtitle">{{ config.appSubtitle() || 'Factory Operations' }}</div>
          <h1 class="login-title">{{ config.appTitle() || 'Factory Diagnostic' }}</h1>
        </div>

        <form (ngSubmit)="onSubmit()" #f="ngForm">
          <div class="field-group">
            <label class="factory-label">Email</label>
            <input
              class="factory-input"
              type="email"
              name="email"
              [(ngModel)]="email"
              placeholder="votre@email.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="field-group" style="margin-top: 14px;">
            <label class="factory-label">Mot de passe</label>
            <div class="input-with-icon">
              <input
                class="factory-input"
                [type]="showPassword() ? 'text' : 'password'"
                name="password"
                [(ngModel)]="password"
                placeholder="••••••••"
                required
                autocomplete="current-password"
              />
              <button type="button" class="toggle-pwd" (click)="showPassword.set(!showPassword())">
                {{ showPassword() ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>

          @if (errorMsg()) {
            <div class="error-banner">{{ errorMsg() }}</div>
          }
          @if (geoBlocked()) {
            <div class="geo-banner">📍 Vous devez être sur site pour vous connecter</div>
          }

          <button
            type="submit"
            class="btn-factory-primary login-btn"
            [disabled]="loading()"
            style="margin-top: 20px;">
            @if (loading()) {
              <span class="spinner"></span> Connexion...
            } @else {
              🔐 Se connecter
            }
          </button>
        </form>

        <div class="login-footer">
          Application de diagnostic industrielle
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      background: var(--bg-app);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .login-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px 24px;
      width: 100%; max-width: 380px;
    }
    .login-header { text-align: center; margin-bottom: 28px; }
    .login-logo { height: 56px; border-radius: 12px; margin-bottom: 12px; }
    .login-icon { font-size: 48px; margin-bottom: 12px; }
    .login-subtitle { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .login-title { font-size: 22px; font-weight: 700; margin: 0; color: var(--factory-secondary); }
    .field-group { display: flex; flex-direction: column; }
    .input-with-icon { position: relative; }
    .input-with-icon .factory-input { padding-right: 44px; }
    .toggle-pwd {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px;
    }
    .error-banner {
      background: #FF4D6D22; border: 1px solid #FF4D6D44;
      color: var(--color-danger); border-radius: 8px;
      padding: 10px 12px; font-size: 13px; margin-top: 12px;
    }
    .geo-banner {
      background: #FFB70022; border: 1px solid #FFB70044;
      color: var(--color-warning); border-radius: 8px;
      padding: 10px 12px; font-size: 13px; margin-top: 6px;
      text-align: center; font-weight: 600;
    }
    .login-btn { margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid #ffffff44; border-top-color: #fff;
      animation: spin 0.7s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .login-footer { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 20px; }
  `]
})
export class LoginComponent {
  auth = inject(AuthService);
  config = inject(FactoryConfigService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  http = inject(HttpClient);

  email = '';
  password = '';
  loading = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);
  geoBlocked = signal(false);

  onSubmit() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.errorMsg.set('');
    this.geoBlocked.set(false);

    // Tenter d'obtenir la position GPS, puis envoyer avec les credentials
    // Si le navigateur refuse ou si la géo n'est pas supportée, on envoie sans coordonnées
    // (le backend rejettera si la restriction est activée sur l'usine)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => this.doLogin(pos.coords.latitude, pos.coords.longitude),
        ()    => this.doLogin(), // refusé ou timeout → login sans coords
        { timeout: 5000, maximumAge: 60000 }
      );
    } else {
      this.doLogin();
    }
  }

  private doLogin(lat?: number, lng?: number) {
    this.auth.login({ email: this.email, password: this.password, lat, lng }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.message ?? 'Email ou mot de passe incorrect';
        if (msg.includes('GEO_TOO_FAR') || msg.includes('trop loin')) {
          this.geoBlocked.set(true);
          this.errorMsg.set('📍 Vous êtes trop loin du site. Connexion impossible hors périmètre.');
        } else if (msg.includes('GEO_REQUIRED')) {
          this.geoBlocked.set(true);
          this.errorMsg.set('📍 La géolocalisation est requise pour vous connecter.');
        } else {
          this.errorMsg.set(msg);
        }
      }
    });
  }
}
