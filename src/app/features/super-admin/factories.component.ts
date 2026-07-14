import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface FactorySummary {
  id: string; code: string; name: string;
  city: string; country: string;
  primaryColor: string; logoUrl?: string; appTitle: string;
  userCount: number; isActive: boolean;
}

@Component({
  selector: 'app-factories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="factories-page">

      <!-- Titre + bouton -->
      <div class="page-header">
        <div>
          <h1 class="page-title">🏭 Gestion des Usines</h1>
          <p class="page-sub">{{ factories().length }} usine(s) active(s) sur la plateforme</p>
        </div>
        <button class="btn-create" (click)="showCreateFactory.set(true)">
          + Nouvelle usine
        </button>
      </div>

      <!-- Grille usines -->
      @if (loading()) {
        <div class="center-msg">Chargement...</div>
      }

      <div class="factories-grid">
        @for (f of factories(); track f.id) {
          <div class="factory-card" [style.--fc]="f.primaryColor">
            <div class="fc-header" [style.background]="f.primaryColor + '22'">
              <div class="fc-color-dot" [style.background]="f.primaryColor"></div>
              <div class="fc-code">{{ f.code }}</div>
              <div class="fc-badge" [class.active]="f.isActive">
                {{ f.isActive ? 'Active' : 'Inactive' }}
              </div>
            </div>
            <div class="fc-body">
              <div class="fc-name">{{ f.name }}</div>
              <div class="fc-location">
                📍 {{ f.city }}@if (f.country) {, {{ f.country }} }
              </div>
              <div class="fc-users">👥 {{ f.userCount }} utilisateur(s)</div>
            </div>
            <div class="fc-actions">
              <button class="fc-btn roles"
                      (click)="goToRoles(f.id)"
                      title="Gérer les rôles">
                🔑 Rôles
              </button>
              <button class="fc-btn admin"
                      (click)="openCreateAdmin(f)"
                      title="Créer un admin">
                👤 Admin
              </button>
            </div>
          </div>
        }
      </div>

      @if (!loading() && factories().length === 0) {
        <div class="empty-state">
          <div style="font-size:48px; margin-bottom:12px;">🏭</div>
          <p>Aucune usine configurée</p>
          <button class="btn-create" (click)="showCreateFactory.set(true)">
            Créer la première usine
          </button>
        </div>
      }

      <!-- MODAL : Créer usine -->
      @if (showCreateFactory()) {
        <div class="modal-overlay" (click)="showCreateFactory.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-title">🏭 Nouvelle usine</div>
            <div class="modal-sub">Informations de base — l'admin configurera le reste</div>

            <div class="form-row-2">
              <div>
                <label class="field-label">Code usine *</label>
                <input class="field-input" [(ngModel)]="newFactory.code"
                       placeholder="ex: KHS_DOUALA" style="text-transform:uppercase;" />
                <div class="field-hint">Identifiant unique, sans espaces</div>
              </div>
              <div>
                <label class="field-label">Nom *</label>
                <input class="field-input" [(ngModel)]="newFactory.name"
                       placeholder="ex: Coca-Cola Douala" />
              </div>
            </div>

            <div>
              <label class="field-label">Description</label>
              <input class="field-input" [(ngModel)]="newFactory.description"
                     placeholder="Description courte..." />
            </div>

            <div class="form-row-2" style="margin-top:10px;">
              <div>
                <label class="field-label">Pays</label>
                <input class="field-input" [(ngModel)]="newFactory.country"
                       placeholder="ex: Cameroun" />
              </div>
              <div>
                <label class="field-label">Ville</label>
                <input class="field-input" [(ngModel)]="newFactory.city"
                       placeholder="ex: Douala" />
              </div>
            </div>

            <div class="form-row-3" style="margin-top:10px;">
              <div>
                <label class="field-label">Timezone</label>
                <select class="field-input" [(ngModel)]="newFactory.timezone">
                  <option value="Africa/Douala">Africa/Douala</option>
                  <option value="Africa/Abidjan">Africa/Abidjan</option>
                  <option value="Africa/Lagos">Africa/Lagos</option>
                  <option value="Africa/Dakar">Africa/Dakar</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label class="field-label">Langue</label>
                <select class="field-input" [(ngModel)]="newFactory.defaultLanguage">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label class="field-label">Couleur primaire</label>
                <div class="color-row">
                  <input type="color" [(ngModel)]="newFactory.primaryColor" class="color-pick" />
                  <input class="field-input" [(ngModel)]="newFactory.primaryColor" style="flex:1;" />
                </div>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="showCreateFactory.set(false)">Annuler</button>
              <button class="btn-confirm"
                      [disabled]="!newFactory.code || !newFactory.name || saving()"
                      (click)="createFactory()">
                {{ saving() ? '⏳...' : '✅ Créer l\'usine' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL : Créer admin usine -->
      @if (adminTarget()) {
        <div class="modal-overlay" (click)="adminTarget.set(null)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-title">👤 Créer l'administrateur</div>
            <div class="modal-sub">
              Usine : <strong [style.color]="adminTarget()!.primaryColor">
                {{ adminTarget()!.name }}
              </strong>
            </div>

            <div class="form-row-2" style="margin-top:14px;">
              <div>
                <label class="field-label">Prénom *</label>
                <input class="field-input" [(ngModel)]="newAdmin.firstName" placeholder="Prénom" />
              </div>
              <div>
                <label class="field-label">Nom *</label>
                <input class="field-input" [(ngModel)]="newAdmin.lastName" placeholder="Nom" />
              </div>
            </div>

            <div style="margin-top:10px;">
              <label class="field-label">Email *</label>
              <input class="field-input" type="email" [(ngModel)]="newAdmin.email"
                     placeholder="admin@usine.com" />
            </div>

            <div style="margin-top:10px;">
              <label class="field-label">Mot de passe temporaire *</label>
              <input class="field-input" type="password" [(ngModel)]="newAdmin.password"
                     placeholder="Min. 8 caractères" />
              <div class="field-hint">L'utilisateur devra le changer à la première connexion</div>
            </div>

            <div class="info-box" style="margin-top:12px;">
              ℹ️ Cet utilisateur aura le rôle <strong>FACTORY_ADMIN</strong>
              et pourra configurer entièrement son usine.
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="adminTarget.set(null)">Annuler</button>
              <button class="btn-confirm"
                      [disabled]="!newAdmin.firstName || !newAdmin.lastName || !newAdmin.email || newAdmin.password.length < 8 || saving()"
                      (click)="createAdmin()">
                {{ saving() ? '⏳...' : '✅ Créer l\'administrateur' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Toast -->
      @if (toast()) {
        <div class="toast" [class.error]="toastError()">{{ toast() }}</div>
      }

    </div>
  `,
  styles: [`
    .factories-page { max-width: 1000px; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    .page-sub   { font-size: 13px; color: #6B7A9C; margin: 0; }

    .btn-create {
      padding: 10px 20px; border-radius: 8px;
      background: #FF4D6D; color: #fff; border: none;
      cursor: pointer; font-size: 14px; font-weight: 600;
      white-space: nowrap;
    }

    /* Grille usines */
    .factories-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

    .factory-card {
      background: #111827; border: 1px solid #1E2538;
      border-top: 3px solid var(--fc); border-radius: 12px;
      overflow: hidden; transition: transform 0.15s;
    }
    .factory-card:hover { transform: translateY(-2px); }

    .fc-header { display: flex; align-items: center; gap: 10px; padding: 12px 14px; }
    .fc-color-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .fc-code { font-size: 11px; font-weight: 700; color: #6B7A9C; text-transform: uppercase; letter-spacing: 0.5px; flex: 1; }
    .fc-badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .fc-badge.active { background: #00E5A022; color: #00E5A0; }
    .fc-badge:not(.active) { background: #FF4D6D22; color: #FF4D6D; }

    .fc-body { padding: 0 14px 12px; }
    .fc-name { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .fc-location { font-size: 12px; color: #6B7A9C; margin-bottom: 4px; }
    .fc-users { font-size: 12px; color: #6B7A9C; }

    .fc-actions { display: flex; gap: 6px; padding: 10px 14px; border-top: 1px solid #1E2538; }
    .fc-btn {
      flex: 1; padding: 8px; border-radius: 6px; border: none;
      cursor: pointer; font-size: 12px; font-weight: 600;
    }
    .fc-btn.roles { background: #A855F722; color: #A855F7; }
    .fc-btn.roles:hover { background: #A855F7; color: #fff; }
    .fc-btn.admin { background: #00C2FF22; color: #00C2FF; }
    .fc-btn.admin:hover { background: #00C2FF; color: #000; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: #0009; z-index: 500;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-card {
      background: #111827; border: 1px solid #1E2538; border-radius: 16px;
      padding: 24px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto;
    }
    .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .modal-sub   { font-size: 13px; color: #6B7A9C; margin-bottom: 8px; }

    .field-label { font-size: 11px; color: #6B7A9C; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .field-input {
      width: 100%; padding: 10px 12px; background: #0D1226;
      border: 1px solid #1E2538; border-radius: 8px;
      color: #E8EAF0; font-size: 14px; outline: none; box-sizing: border-box;
    }
    .field-input:focus { border-color: #FF4D6D; }
    .field-hint { font-size: 11px; color: #2E3548; margin-top: 3px; }

    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    @media(max-width: 480px) { .form-row-2, .form-row-3 { grid-template-columns: 1fr; } }

    .color-row { display: flex; gap: 8px; align-items: center; }
    .color-pick { width: 44px; height: 42px; border-radius: 8px; border: none; cursor: pointer; padding: 0; flex-shrink: 0; }

    .info-box { padding: 10px 14px; background: #00C2FF11; border: 1px solid #00C2FF33; border-radius: 8px; font-size: 13px; color: #00C2FF; }

    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
    .btn-cancel  { padding: 9px 18px; border-radius: 8px; border: 1px solid #1E2538; background: none; color: #6B7A9C; cursor: pointer; }
    .btn-confirm { padding: 9px 20px; border-radius: 8px; border: none; background: #FF4D6D; color: #fff; cursor: pointer; font-weight: 700; }
    .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Toast */
    .toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #00E5A0; color: #000; padding: 10px 22px;
      border-radius: 20px; font-weight: 700; font-size: 14px; z-index: 999;
    }
    .toast.error { background: #FF4D6D; color: #fff; }

    .center-msg, .empty-state { text-align: center; color: #6B7A9C; padding: 48px 0; }
  `]
})
export class FactoriesComponent implements OnInit {
  http   = inject(HttpClient);
  router = inject(Router);

  factories        = signal<FactorySummary[]>([]);
  loading          = signal(false);
  saving           = signal(false);
  showCreateFactory= signal(false);
  adminTarget      = signal<FactorySummary | null>(null);
  toast            = signal('');
  toastError       = signal(false);

  newFactory = this.emptyFactory();
  newAdmin   = this.emptyAdmin();

  private get api() { return environment.apiUrl; }

  ngOnInit() { this.loadFactories(); }

  loadFactories() {
    this.loading.set(true);
    this.http.get<FactorySummary[]>(`${this.api}/admin/factories`).subscribe({
      next: f => { this.factories.set(f); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  createFactory() {
    if (!this.newFactory.code || !this.newFactory.name) return;
    this.saving.set(true);
    this.http.post<FactorySummary>(`${this.api}/admin/factories`, {
      ...this.newFactory,
      code: this.newFactory.code.toUpperCase().replace(/\s+/g, '_')
    }).subscribe({
      next: f => {
        this.factories.update(list => [...list, f]);
        this.showCreateFactory.set(false);
        this.newFactory = this.emptyFactory();
        this.saving.set(false);
        this.showToast('✅ Usine créée avec succès');
      },
      error: (e) => { this.saving.set(false); this.showToast(e?.error?.message ?? 'Erreur', true); }
    });
  }

  openCreateAdmin(f: FactorySummary) {
    this.adminTarget.set(f);
    this.newAdmin = this.emptyAdmin();
  }

  createAdmin() {
    const target = this.adminTarget();
    if (!target) return;
    this.saving.set(true);
    this.http.post(`${this.api}/admin/factories/${target.id}/admin`, {
      firstName: this.newAdmin.firstName,
      lastName:  this.newAdmin.lastName,
      email:     this.newAdmin.email,
      hashedPassword: this.newAdmin.password
    }).subscribe({
      next: () => {
        this.adminTarget.set(null);
        this.saving.set(false);
        this.showToast('✅ Administrateur créé — mot de passe temporaire actif');
        this.loadFactories();
      },
      error: (e) => { this.saving.set(false); this.showToast(e?.error?.message ?? 'Erreur', true); }
    });
  }

  goToRoles(factoryId: string) {
    this.router.navigate(['/super-admin/roles', factoryId]);
  }

  private showToast(msg: string, error = false) {
    this.toast.set(msg); this.toastError.set(error);
    setTimeout(() => this.toast.set(''), 3000);
  }

  private emptyFactory() {
    return { code: '', name: '', description: '', country: 'Cameroun', city: '',
             timezone: 'Africa/Douala', defaultLanguage: 'fr',
             currency: 'XAF', primaryColor: '#1976D2' };
  }
  private emptyAdmin() {
    return { firstName: '', lastName: '', email: '', password: '' };
  }
}
