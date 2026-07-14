import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Permission { id: string; code: string; description: string; module: string; action: string; }
interface PermissionGroup { module: string; permissions: Permission[]; }
interface Role { id: string; code: string; name: string; description: string; isSystemRole: boolean; factoryId?: string; permissions: Permission[]; }

// Labels lisibles pour les modules et actions
const MODULE_LABELS: Record<string,string> = {
  MACHINES:'Diagnostic Machines', SOUFFLAGE:'Soufflage', QUART:'Suivi Quart',
  PERTES:'Pertes Préformes', MAINTENANCE:'Maintenance', SIROPERIE:'Siroperie',
  BILAN:'Bilan', CONFIG:'Configuration', USERS:'Utilisateurs', PLATFORM:'Plateforme'
};
const ACTION_LABELS: Record<string,string> = {
  READ:'Lire', WRITE:'Modifier', DELETE:'Supprimer', EXPORT:'Exporter', ADMIN:'Administrer'
};
const ACTION_ORDER = ['READ','WRITE','DELETE','EXPORT','ADMIN'];

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="roles-page">

      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <button class="bc-link" (click)="router.navigate(['/super-admin/factories'])">
          ← Usines
        </button>
        <span class="bc-sep">/</span>
        <span class="bc-current">Rôles — {{ factoryName() }}</span>
      </div>

      <div class="page-header">
        <div>
          <h1 class="page-title">🔑 Gestion des Rôles</h1>
          <p class="page-sub">Rôles système + rôles personnalisés pour cette usine</p>
        </div>
        <button class="btn-create" (click)="openCreateRole()">+ Nouveau rôle</button>
      </div>

      @if (loading()) { <div class="center-msg">Chargement...</div> }

      <div class="roles-list">
        @for (role of roles(); track role.id) {
          <div class="role-card" [class.system]="role.isSystemRole" [class.editing]="editingRoleId() === role.id">

            <!-- En-tête rôle -->
            <div class="role-header">
              <div class="role-left">
                <div class="role-icon">{{ role.isSystemRole ? '🔒' : '✏️' }}</div>
                <div>
                  <div class="role-name">
                    {{ role.name }}
                    @if (role.isSystemRole) {
                      <span class="system-badge">Système</span>
                    } @else {
                      <span class="custom-badge">Personnalisé</span>
                    }
                  </div>
                  <div class="role-code">{{ role.code }}</div>
                  @if (role.description) {
                    <div class="role-desc">{{ role.description }}</div>
                  }
                </div>
              </div>
              <div class="role-actions">
                <div class="perm-count">
                  {{ role.permissions.length }} permission(s)
                </div>
                @if (!role.isSystemRole) {
                  <button class="btn-role-edit"
                          (click)="toggleEditRole(role)"
                          [class.active]="editingRoleId() === role.id">
                    {{ editingRoleId() === role.id ? '✕ Fermer' : '✏️ Modifier' }}
                  </button>
                  <button class="btn-role-del" (click)="deleteRole(role)">🗑️</button>
                } @else {
                  <button class="btn-role-view"
                          (click)="toggleEditRole(role)">
                    {{ editingRoleId() === role.id ? '✕ Fermer' : '👁 Voir' }}
                  </button>
                }
              </div>
            </div>

            <!-- Matrice de permissions (affichée si expanded) -->
            @if (editingRoleId() === role.id) {
              <div class="perm-matrix">
                <div class="matrix-header">
                  @if (!role.isSystemRole) {
                    <div class="matrix-info">Cochez les permissions à attribuer à ce rôle</div>
                  } @else {
                    <div class="matrix-info readonly">Rôle système — lecture seule</div>
                  }
                </div>

                <div class="matrix-table-wrap">
                  <table class="matrix-table">
                    <thead>
                      <tr>
                        <th class="module-col">Module</th>
                        @for (action of allActions; track action) {
                          <th class="action-col">{{ actionLabel(action) }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (group of permGroups(); track group.module) {
                        <tr class="module-row">
                          <td class="module-name">{{ moduleLabel(group.module) }}</td>
                          @for (action of allActions; track action) {
                            <td class="perm-cell">
                              @if (hasPermInGroup(group, action)) {
                                <label class="perm-checkbox"
                                       [class.checked]="isChecked(role, group, action)"
                                       [class.disabled]="role.isSystemRole">
                                  <input type="checkbox"
                                         [checked]="isChecked(role, group, action)"
                                         [disabled]="role.isSystemRole"
                                         (change)="togglePerm(role, group, action, $event)" />
                                  <span class="check-mark"></span>
                                </label>
                              } @else {
                                <span class="no-perm">—</span>
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                @if (!role.isSystemRole) {
                  <div class="matrix-footer">
                    <div class="perm-summary">
                      {{ getPermCount(role) }} permission(s) sélectionnée(s)
                    </div>
                    <button class="btn-save-role"
                            [disabled]="saving()"
                            (click)="saveRolePermissions(role)">
                      {{ saving() ? '⏳...' : '💾 Enregistrer les permissions' }}
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- MODAL : Créer rôle -->
      @if (showCreateRole()) {
        <div class="modal-overlay" (click)="showCreateRole.set(false)">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-title">✏️ Nouveau rôle personnalisé</div>

            <div class="form-row-2" style="margin-top:14px;">
              <div>
                <label class="field-label">Code *</label>
                <input class="field-input" [(ngModel)]="newRole.code"
                       placeholder="ex: CHEF_LIGNE" style="text-transform:uppercase;" />
                <div class="field-hint">Lettres et underscores uniquement</div>
              </div>
              <div>
                <label class="field-label">Nom affiché *</label>
                <input class="field-input" [(ngModel)]="newRole.name"
                       placeholder="ex: Chef de Ligne" />
              </div>
            </div>

            <div style="margin-top:10px;">
              <label class="field-label">Description</label>
              <input class="field-input" [(ngModel)]="newRole.description"
                     placeholder="Rôle pour..." />
            </div>

            <!-- Matrice permissions pour le nouveau rôle -->
            <div style="margin-top:16px;">
              <label class="field-label">Permissions initiales</label>
              <div class="matrix-table-wrap" style="margin-top:8px;">
                <table class="matrix-table">
                  <thead>
                    <tr>
                      <th class="module-col">Module</th>
                      @for (action of allActions; track action) {
                        <th class="action-col">{{ actionLabel(action) }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (group of permGroups(); track group.module) {
                      <tr class="module-row">
                        <td class="module-name">{{ moduleLabel(group.module) }}</td>
                        @for (action of allActions; track action) {
                          <td class="perm-cell">
                            @if (hasPermInGroup(group, action)) {
                              <label class="perm-checkbox"
                                     [class.checked]="newRole.permissionIds.includes(getPermId(group, action))">
                                <input type="checkbox"
                                       [checked]="newRole.permissionIds.includes(getPermId(group, action))"
                                       (change)="toggleNewPerm(group, action, $event)" />
                                <span class="check-mark"></span>
                              </label>
                            } @else {
                              <span class="no-perm">—</span>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="perm-summary" style="margin-top:6px;">
                {{ newRole.permissionIds.length }} permission(s) sélectionnée(s)
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn-cancel" (click)="showCreateRole.set(false)">Annuler</button>
              <button class="btn-confirm"
                      [disabled]="!newRole.code || !newRole.name || saving()"
                      (click)="createRole()">
                {{ saving() ? '⏳...' : '✅ Créer le rôle' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (toast()) {
        <div class="toast" [class.error]="toastError()">{{ toast() }}</div>
      }
    </div>
  `,
  styles: [`
    .roles-page { max-width: 900px; }

    .breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .bc-link { background: none; border: none; color: #6B7A9C; cursor: pointer; font-size: 13px; padding: 0; }
    .bc-link:hover { color: #E8EAF0; }
    .bc-sep { color: #2E3548; }
    .bc-current { font-size: 13px; color: #E8EAF0; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .page-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    .page-sub { font-size: 13px; color: #6B7A9C; margin: 0; }
    .btn-create { padding: 10px 18px; border-radius: 8px; background: #A855F7; color: #fff; border: none; cursor: pointer; font-size: 14px; font-weight: 600; }

    /* Role cards */
    .roles-list { display: flex; flex-direction: column; gap: 10px; }
    .role-card {
      background: #111827; border: 1px solid #1E2538; border-radius: 12px; overflow: hidden;
    }
    .role-card.system { border-left: 3px solid #6B7A9C; }
    .role-card.editing { border-color: #A855F7; }

    .role-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 16px; }
    .role-left { display: flex; gap: 12px; align-items: flex-start; flex: 1; }
    .role-icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
    .role-name { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
    .role-code { font-size: 11px; color: #6B7A9C; font-family: monospace; margin-bottom: 3px; }
    .role-desc { font-size: 12px; color: #6B7A9C; }

    .system-badge { padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; background: #6B7A9C22; color: #6B7A9C; }
    .custom-badge { padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; background: #A855F722; color: #A855F7; }

    .role-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .perm-count { font-size: 11px; color: #6B7A9C; white-space: nowrap; }
    .btn-role-edit, .btn-role-view, .btn-role-del {
      padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 600;
    }
    .btn-role-edit { background: #A855F722; color: #A855F7; }
    .btn-role-edit.active { background: #1E2538; color: #6B7A9C; }
    .btn-role-view { background: #00C2FF11; color: #00C2FF; }
    .btn-role-del  { background: #FF4D6D22; color: #FF4D6D; }

    /* Matrice permissions */
    .perm-matrix { border-top: 1px solid #1E2538; padding: 16px; }
    .matrix-header { margin-bottom: 12px; }
    .matrix-info { font-size: 12px; color: #6B7A9C; }
    .matrix-info.readonly { color: #2E3548; font-style: italic; }

    .matrix-table-wrap { overflow-x: auto; }
    .matrix-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .matrix-table th {
      background: #0D1226; color: #6B7A9C; font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.5px;
      padding: 8px; text-align: center; white-space: nowrap;
    }
    .module-col { text-align: left !important; min-width: 140px; }
    .action-col { width: 80px; }

    .module-row td { padding: 6px 8px; border-bottom: 1px solid #0D1226; }
    .module-row:hover td { background: #0D1226; }
    .module-name { font-size: 12px; font-weight: 600; color: #E8EAF0; }
    .perm-cell { text-align: center; }

    .perm-checkbox {
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; width: 22px; height: 22px;
    }
    .perm-checkbox input { display: none; }
    .check-mark {
      width: 18px; height: 18px; border-radius: 4px;
      border: 2px solid #1E2538; background: #0D1226;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .perm-checkbox.checked .check-mark {
      background: #A855F7; border-color: #A855F7;
    }
    .perm-checkbox.checked .check-mark::after {
      content: '✓'; color: #fff; font-size: 11px; font-weight: 900;
    }
    .perm-checkbox.disabled { cursor: not-allowed; opacity: 0.5; }
    .no-perm { color: #2E3548; font-size: 16px; }

    .matrix-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
    .perm-summary { font-size: 12px; color: #6B7A9C; }
    .btn-save-role {
      padding: 9px 20px; border-radius: 8px; border: none;
      background: #A855F7; color: #fff; cursor: pointer; font-weight: 700; font-size: 13px;
    }
    .btn-save-role:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: #0009; z-index: 500; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal-card { background: #111827; border: 1px solid #1E2538; border-radius: 16px; padding: 24px; width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; }
    .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .field-label { font-size: 11px; color: #6B7A9C; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .field-input { width: 100%; padding: 10px 12px; background: #0D1226; border: 1px solid #1E2538; border-radius: 8px; color: #E8EAF0; font-size: 14px; outline: none; box-sizing: border-box; }
    .field-input:focus { border-color: #A855F7; }
    .field-hint { font-size: 11px; color: #2E3548; margin-top: 3px; }
    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
    .btn-cancel  { padding: 9px 18px; border-radius: 8px; border: 1px solid #1E2538; background: none; color: #6B7A9C; cursor: pointer; }
    .btn-confirm { padding: 9px 20px; border-radius: 8px; border: none; background: #A855F7; color: #fff; cursor: pointer; font-weight: 700; }
    .btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }

    .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #00E5A0; color: #000; padding: 10px 22px; border-radius: 20px; font-weight: 700; font-size: 14px; z-index: 999; }
    .toast.error { background: #FF4D6D; color: #fff; }
    .center-msg { text-align: center; color: #6B7A9C; padding: 40px; }
  `]
})
export class RolesComponent implements OnInit {
  route  = inject(ActivatedRoute);
  router = inject(Router);
  http   = inject(HttpClient);

  factoryId   = signal('');
  factoryName = signal('');
  roles       = signal<Role[]>([]);
  permGroups  = signal<PermissionGroup[]>([]);
  loading     = signal(false);
  saving      = signal(false);
  showCreateRole = signal(false);
  editingRoleId  = signal<string | null>(null);
  toast       = signal('');
  toastError  = signal(false);

  // Permissions en cours d'édition par rôle { roleId → permIds[] }
  editingPerms: Partial<Record<string, string[]>> = {};

  allActions = ACTION_ORDER;

  newRole = this.emptyRole();

  private get api() { return environment.apiUrl; }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('factoryId') ?? '';
    this.factoryId.set(id);
    this.loadData(id);
  }

  loadData(factoryId: string) {
    this.loading.set(true);
    Promise.all([
      fetch(`${this.api}/factories/${factoryId}/roles`, { headers: this.authHeaders() }).then(r => r.json()),
      fetch(`${this.api}/permissions/grouped`, { headers: this.authHeaders() }).then(r => r.json()),
      fetch(`${this.api}/admin/factories`, { headers: this.authHeaders() }).then(r => r.json())
    ]).then(([roles, groups, factories]) => {
      this.roles.set(roles);
      this.permGroups.set(groups);
      const f = (factories as any[]).find((f: any) => f.id === factoryId);
      if (f) this.factoryName.set(f.name);
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  private authHeaders() {
    const token = localStorage.getItem('factory_access_token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  // ── Gestion édition ───────────────────────────────────
  toggleEditRole(role: Role) {
    if (this.editingRoleId() === role.id) {
      this.editingRoleId.set(null);
    } else {
      this.editingRoleId.set(role.id);
      // Initialiser les perms en édition avec les perms actuelles
      if (!this.editingPerms[role.id]) {
        this.editingPerms[role.id] = role.permissions.map(p => p.id);
      }
    }
  }

  isChecked(role: Role, group: PermissionGroup, action: string): boolean {
    const perm = this.getPermFromGroup(group, action);
    if (!perm) return false;
    const current = this.editingPerms[role.id];
    if (current) return current.includes(perm.id);
    return role.permissions.some(p => p.id === perm.id);
  }

  togglePerm(role: Role, group: PermissionGroup, action: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const perm = this.getPermFromGroup(group, action);
    if (!perm) return;

    let current = this.editingPerms[role.id];
    if (!current) {
      current = [...role.permissions.map(p => p.id)];
    }

    if (checked) {
      if (!current.includes(perm.id)) {
        current = [...current, perm.id];
      }
    } else {
      current = current.filter(id => id !== perm.id);
    }

    this.editingPerms[role.id] = current;
  }

  saveRolePermissions(role: Role) {
    const permIds = this.editingPerms[role.id] ?? role.permissions.map(p => p.id);
    this.saving.set(true);
    this.http.patch(`${this.api}/factories/${this.factoryId()}/roles/${role.id}`, {
      permissionIds: permIds
    }).subscribe({
      next: (updated: any) => {
        this.roles.update(list => list.map(r => r.id === role.id ? updated : r));
        this.saving.set(false);
        this.editingRoleId.set(null);
        this.showToast('✅ Permissions enregistrées');
      },
      error: () => { this.saving.set(false); this.showToast('Erreur', true); }
    });
  }

  // ── Créer rôle ────────────────────────────────────────
  openCreateRole() {
    this.newRole = this.emptyRole();
    this.showCreateRole.set(true);
  }

  toggleNewPerm(group: PermissionGroup, action: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const perm = this.getPermFromGroup(group, action);
    if (!perm) return;
    if (checked) {
      if (!this.newRole.permissionIds.includes(perm.id)) {
        this.newRole.permissionIds = [...this.newRole.permissionIds, perm.id];
      }
    } else {
      this.newRole.permissionIds = this.newRole.permissionIds.filter(id => id !== perm.id);
    }
  }

  createRole() {
    if (!this.newRole.code || !this.newRole.name) return;
    this.saving.set(true);
    this.http.post<Role>(`${this.api}/factories/${this.factoryId()}/roles`, {
      code: this.newRole.code.toUpperCase(),
      name: this.newRole.name,
      description: this.newRole.description,
      permissionIds: this.newRole.permissionIds
    }).subscribe({
      next: role => {
        this.roles.update(list => [...list, role]);
        this.showCreateRole.set(false);
        this.newRole = this.emptyRole();
        this.saving.set(false);
        this.showToast('✅ Rôle créé');
      },
      error: (e) => { this.saving.set(false); this.showToast(e?.error?.message ?? 'Erreur', true); }
    });
  }

  deleteRole(role: Role) {
    if (!confirm(`Supprimer le rôle "${role.name}" ?`)) return;
    this.http.delete(`${this.api}/factories/${this.factoryId()}/roles/${role.id}`)
      .subscribe({
        next: () => {
          this.roles.update(list => list.filter(r => r.id !== role.id));
          this.showToast('✅ Rôle supprimé');
        },
        error: (e) => this.showToast(e?.error?.message ?? 'Erreur', true)
      });
  }

  // ── Helpers matrice ───────────────────────────────────
  hasPermInGroup(group: PermissionGroup, action: string): boolean {
    return group.permissions.some(p => p.action === action);
  }

  getPermId(group: PermissionGroup, action: string): string {
    return group.permissions.find(p => p.action === action)?.id ?? '';
  }

  private getPermFromGroup(group: PermissionGroup, action: string): Permission | undefined {
    return group.permissions.find(p => p.action === action);
  }

  getPermCount(role: Role): number {
    return this.editingPerms[role.id]?.length ?? role.permissions.length;
  }

  moduleLabel(module: string): string { return MODULE_LABELS[module] ?? module; }
  actionLabel(action: string): string  { return ACTION_LABELS[action]  ?? action; }

  private showToast(msg: string, error = false) {
    this.toast.set(msg); this.toastError.set(error);
    setTimeout(() => this.toast.set(''), 3000);
  }

  private emptyRole() {
    return { code: '', name: '', description: '', permissionIds: [] as string[] };
  }
}
