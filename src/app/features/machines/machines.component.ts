import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { DiagnosticApiService } from '../../core/services/api.services';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { LineSelectorComponent } from '../../shared/components/line-selector/line-selector.component';
import { ProductionLine, MachineType, Symptom } from '../../core/models/models';
import { environment } from '../../../environments/environment';

type MachineTab = 'pannes' | 'formation' | 'config';

@Component({
  selector: 'app-machines',
  standalone: true,
  imports: [CommonModule, FormsModule, LineSelectorComponent],
  template: `
    <div class="machines animate-in">

      @if (!selectedLine()) {
        <app-line-selector (lineSelected)="onLineSelected($event)" />
      } @else {

        <button class="back-btn" (click)="selectedLine.set(null)">← Accueil</button>

        <!-- Sélection machine -->
        <div class="machine-tabs">
          @for (mt of machineTypes(); track mt.id) {
            <button class="machine-tab"
                    [class.active]="selectedMachineType()?.id === mt.id"
                    [style.--mtc]="mt.color"
                    (click)="selectMachineType(mt)">
              {{ mt.icon ?? '⚙️' }} {{ mt.label }}
            </button>
          }
        </div>

        @if (selectedMachineType()) {

          <!-- Tabs -->
          <div class="action-tabs">
            <button class="action-tab" [class.active]="activeTab() === 'pannes'" (click)="activeTab.set('pannes')">
              🔧 Pannes
            </button>
            <button class="action-tab" [class.active]="activeTab() === 'formation'" (click)="activeTab.set('formation')">
              📚 Info machine
            </button>
            @if (canConfig()) {
              <button class="action-tab config-tab" [class.active]="activeTab() === 'config'" (click)="activeTab.set('config')">
                ⚙️ Configurer
              </button>
            }
          </div>

          <!-- ── ONGLET PANNES ── -->
          @if (activeTab() === 'pannes') {
            <div class="search-wrap">
              <input class="factory-input"
                     [(ngModel)]="searchQuery"
                     (ngModelChange)="filterSymptoms()"
                     placeholder="🔍 Rechercher un symptôme..." />
            </div>

            @if (loading()) { <div class="center-msg">Chargement...</div> }

            @for (symptom of filteredSymptoms(); track symptom.id) {
              <div class="symptom-block">
                <button class="symptom-header"
                        [class.open]="openSymptomId() === symptom.id"
                        [style.border-left-color]="selectedMachineType()!.color"
                        (click)="toggleSymptom(symptom.id)">
                  <div>
                    <div class="symptom-tag" [style.color]="selectedMachineType()!.color">⚠️ Symptôme</div>
                    <div class="symptom-label">{{ symptom.label }}</div>
                    @if (symptom.description) {
                      <div class="symptom-desc">{{ symptom.description }}</div>
                    }
                  </div>
                  <div class="symp-right">
                    <span class="cause-count">{{ symptom.causes?.length ?? 0 }} cause(s)</span>
                    <span class="symp-arrow" [style.transform]="openSymptomId() === symptom.id ? 'rotate(90deg)' : ''">›</span>
                  </div>
                </button>

                @if (openSymptomId() === symptom.id) {
                  <div class="symptom-detail">
                    @if (!symptom.causes?.length) {
                      <div class="empty-causes">Aucune cause renseignée</div>
                    }
                    @for (cause of symptom.causes; track cause.id; let ci = $index) {
                      <div class="cause-block" [class.last]="ci === (symptom.causes?.length ?? 0) - 1">
                        <div class="cause-header">
                          <span class="cause-badge">🔴 Cause {{ ci + 1 }}</span>
                        </div>
                        <div class="cause-label">{{ cause.label }}</div>
                        @if (cause.actions?.length) {
                          <div class="actions-wrap">
                            <div class="actions-title">✅ Actions correctives</div>
                            @for (action of cause.actions; track action.id; let ai = $index) {
                              <div class="action-item">
                                <span class="action-num">{{ ai + 1 }}</span>
                                {{ action.label }}
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

            @if (!loading() && filteredSymptoms().length === 0) {
              <div class="empty-state">
                <div style="font-size:36px;">🔍</div>
                <p>Aucun symptôme trouvé</p>
                @if (canConfig()) {
                  <button class="btn-go-config" (click)="activeTab.set('config')">+ Ajouter un symptôme</button>
                }
              </div>
            }
          }

          <!-- ── ONGLET FORMATION ── -->
          @if (activeTab() === 'formation') {
            <div class="formation-card factory-card">
              <div class="form-header">
                <div class="form-dot" [style.background]="selectedMachineType()!.color"></div>
                <div class="form-title" [style.color]="selectedMachineType()!.color">
                  {{ selectedMachineType()!.label }}
                </div>
              </div>
              @if (selectedMachineType()!.description) {
                <p class="form-desc">{{ selectedMachineType()!.description }}</p>
              } @else {
                <p class="form-desc" style="font-style:italic;">Aucune description renseignée pour ce type de machine.</p>
              }
              <div class="form-stats">
                <div class="stat-chip">
                  <span class="stat-val">{{ allSymptoms().length }}</span>
                  <span class="stat-lbl">symptôme(s)</span>
                </div>
                <div class="stat-chip">
                  <span class="stat-val">{{ totalCauses() }}</span>
                  <span class="stat-lbl">cause(s) documentée(s)</span>
                </div>
                <div class="stat-chip">
                  <span class="stat-val">{{ totalActions() }}</span>
                  <span class="stat-lbl">action(s) corrective(s)</span>
                </div>
              </div>
            </div>
          }

          <!-- ── ONGLET CONFIG ── -->
          @if (activeTab() === 'config') {
            <div class="config-section">
              <div class="config-header">
                <div class="config-title" [style.color]="selectedMachineType()!.color">
                  {{ selectedMachineType()!.icon ?? '⚙️' }} {{ selectedMachineType()!.label }}
                  — Base de diagnostic
                </div>
                <button class="btn-add-symptom" (click)="openAddSymptom()">+ Symptôme</button>
              </div>
              <p class="config-desc">
                Configurez l'arbre Symptôme → Cause → Action corrective.
                Ces données apparaissent automatiquement dans l'onglet Pannes.
              </p>

              <!-- Formulaire nouveau symptôme -->
              @if (showSymptomForm()) {
                <div class="inline-form factory-card">
                  <div class="if-title">Nouveau symptôme</div>
                  <label class="factory-label">Description du symptôme observable *</label>
                  <input class="factory-input" [(ngModel)]="symptomForm.label"
                         placeholder="ex: Bouteille déformée à la sortie du moule" />
                  <label class="factory-label" style="margin-top:10px;">Détail (optionnel)</label>
                  <textarea class="factory-input" [(ngModel)]="symptomForm.description" rows="2"
                            placeholder="Contexte d'apparition, fréquence..."></textarea>
                  <div class="if-actions">
                    <button class="btn-cancel-sm" (click)="showSymptomForm.set(false)">Annuler</button>
                    <button class="btn-save-sm" [disabled]="!symptomForm.label || saving()"
                            (click)="saveSymptom()">
                      {{ saving() ? '⏳' : '✅ Ajouter' }}
                    </button>
                  </div>
                </div>
              }

              @if (loading()) { <div class="center-msg">Chargement...</div> }

              <!-- Liste symptômes (éditables) -->
              @for (symptom of allSymptoms(); track symptom.id; let si = $index) {
                <div class="config-symptom factory-card">

                  <!-- Header symptôme -->
                  <div class="cs-header">
                    @if (editingSymptomId() !== symptom.id) {
                      <div class="cs-label">
                        <span class="symp-num">{{ si + 1 }}</span>
                        {{ symptom.label }}
                      </div>
                      <div class="cs-actions">
                        <button class="btn-icon-sm" (click)="startEditSymptom(symptom)" title="Modifier">✏️</button>
                        <button class="btn-icon-sm danger" (click)="removeSymptom(symptom.id)" title="Supprimer">🗑️</button>
                      </div>
                    } @else {
                      <input class="factory-input edit-inline" [(ngModel)]="editSymptomLabel"
                             (keydown.enter)="saveEditSymptom(symptom.id)"
                             (keydown.escape)="editingSymptomId.set(null)" />
                      <div class="cs-actions">
                        <button class="btn-icon-sm" (click)="editingSymptomId.set(null)">✕</button>
                        <button class="btn-icon-sm save" (click)="saveEditSymptom(symptom.id)">✓</button>
                      </div>
                    }
                  </div>

                  <!-- Causes -->
                  <div class="causes-list">
                    @for (cause of symptom.causes; track cause.id; let ci = $index) {
                      <div class="cause-config-row">
                        <div class="cc-cause">
                          <span class="cause-badge-sm">C{{ ci + 1 }}</span>
                          @if (editingCauseId() !== cause.id) {
                            <span class="cc-label">{{ cause.label }}</span>
                            <button class="btn-icon-sm" (click)="startEditCause(cause)" title="Modifier la cause">✏️</button>
                            <button class="btn-icon-sm danger" (click)="removeCause(cause.id)" title="Supprimer">🗑️</button>
                          } @else {
                            <input class="factory-input edit-inline" [(ngModel)]="editCauseLabel"
                                   (keydown.enter)="saveEditCause(cause.id)"
                                   (keydown.escape)="editingCauseId.set(null)" />
                            <button class="btn-icon-sm" (click)="editingCauseId.set(null)">✕</button>
                            <button class="btn-icon-sm save" (click)="saveEditCause(cause.id)">✓</button>
                          }
                        </div>

                        <!-- Actions de cette cause -->
                        <div class="actions-config">
                          @for (action of cause.actions; track action.id; let ai = $index) {
                            <div class="action-config-row">
                              <span class="action-num-sm">{{ ai + 1 }}</span>
                              @if (editingActionId() !== action.id) {
                                <span class="ac-label">{{ action.label }}</span>
                                <button class="btn-icon-sm" (click)="startEditAction(action)" title="Modifier">✏️</button>
                                <button class="btn-icon-sm danger" (click)="removeAction(action.id)" title="Supprimer">🗑️</button>
                              } @else {
                                <input class="factory-input edit-inline" [(ngModel)]="editActionLabel"
                                       (keydown.enter)="saveEditAction(action.id)"
                                       (keydown.escape)="editingActionId.set(null)" />
                                <button class="btn-icon-sm" (click)="editingActionId.set(null)">✕</button>
                                <button class="btn-icon-sm save" (click)="saveEditAction(action.id)">✓</button>
                              }
                            </div>
                          }
                          <!-- Ajouter action -->
                          @if (addingActionToCauseId() === cause.id) {
                            <div class="action-config-row adding">
                              <span class="action-num-sm">+</span>
                              <input class="factory-input edit-inline" [(ngModel)]="newActionLabel"
                                     placeholder="Action corrective..."
                                     (keydown.enter)="saveNewAction(cause.id)"
                                     (keydown.escape)="addingActionToCauseId.set(null)" />
                              <button class="btn-icon-sm" (click)="addingActionToCauseId.set(null)">✕</button>
                              <button class="btn-icon-sm save" (click)="saveNewAction(cause.id)" [disabled]="!newActionLabel">✓</button>
                            </div>
                          } @else {
                            <button class="btn-add-action" (click)="openAddAction(cause.id)">+ Action corrective</button>
                          }
                        </div>
                      </div>
                    }

                    <!-- Ajouter cause -->
                    @if (addingCauseToSymptomId() === symptom.id) {
                      <div class="add-cause-form">
                        <input class="factory-input" [(ngModel)]="newCauseLabel"
                               placeholder="Cause de ce symptôme..."
                               (keydown.escape)="addingCauseToSymptomId.set(null)" />
                        <div class="if-actions" style="margin-top:8px;">
                          <button class="btn-cancel-sm" (click)="addingCauseToSymptomId.set(null)">Annuler</button>
                          <button class="btn-save-sm" [disabled]="!newCauseLabel" (click)="saveNewCause(symptom.id)">✓ Ajouter</button>
                        </div>
                      </div>
                    } @else {
                      <button class="btn-add-cause" (click)="openAddCause(symptom.id)">+ Cause</button>
                    }
                  </div>
                </div>
              }

              @if (!loading() && allSymptoms().length === 0) {
                <div class="empty-state">
                  <div style="font-size:36px;">📋</div>
                  <p>Aucun symptôme — commencez par en ajouter un</p>
                </div>
              }
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .machines { max-width: 700px; margin: 0 auto; }
    .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 0 12px; font-size: 14px; }

    /* Machine tabs */
    .machine-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 12px; }
    .machine-tab {
      padding: 8px 16px; border-radius: 20px;
      border: 2px solid var(--border);
      background: var(--bg-card); color: var(--text-muted);
      font-size: 13px; cursor: pointer; white-space: nowrap; font-weight: 500;
    }
    .machine-tab.active {
      background: var(--mtc); color: #fff; border-color: var(--mtc); font-weight: 700;
    }

    /* Action tabs */
    .action-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .action-tab {
      flex: 1; padding: 10px 8px; border-radius: 8px;
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-muted); cursor: pointer; font-size: 13px; font-weight: 500;
    }
    .action-tab.active { background: var(--factory-primary); color: #fff; border-color: transparent; font-weight: 700; }
    .config-tab.active { background: var(--color-warning); color: #000; border-color: transparent; }

    /* Search */
    .search-wrap { margin-bottom: 12px; }

    /* ── Symptômes (lecture) ── */
    .symptom-block { margin-bottom: 8px; }
    .symptom-header {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-left: 4px solid var(--border);
      border-radius: 10px; padding: 14px 16px;
      cursor: pointer; text-align: left;
      transition: background 0.15s;
    }
    .symptom-header:hover, .symptom-header.open { background: var(--bg-card2); }
    .symptom-header.open { border-radius: 10px 10px 0 0; border-bottom-color: transparent; }
    .symptom-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .symptom-label { font-size: 15px; font-weight: 700; color: var(--text); }
    .symptom-desc  { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
    .symp-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .cause-count { font-size: 11px; color: var(--text-muted); background: var(--bg-card2); padding: 2px 8px; border-radius: 10px; border: 1px solid var(--border); }
    .symp-arrow { font-size: 22px; color: var(--text-muted); transition: transform 0.2s; }

    .symptom-detail {
      background: var(--bg-card);
      border: 1px solid var(--border); border-top: none;
      border-radius: 0 0 10px 10px;
      padding: 0 14px 8px;
    }
    .cause-block { padding: 12px 0; border-bottom: 1px solid var(--border); }
    .cause-block.last { border-bottom: none; }
    .cause-header { margin-bottom: 6px; }
    .cause-badge { display: inline-block; font-size: 10px; font-weight: 700; color: var(--color-danger); background: #FF4D6D18; border: 1px solid #FF4D6D33; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; }
    .cause-label { font-size: 14px; font-weight: 600; color: var(--text); padding: 8px 12px; background: var(--bg-card2); border-radius: 6px; margin-bottom: 8px; }
    .actions-wrap { padding-left: 10px; }
    .actions-title { font-size: 10px; color: var(--color-success); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .action-item { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text); padding: 6px 10px; background: #00E5A010; border: 1px solid #00E5A022; border-radius: 6px; margin-bottom: 4px; }
    .action-num { font-size: 11px; font-weight: 700; color: var(--color-success); background: #00E5A022; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .empty-causes { font-size: 13px; color: var(--text-muted); padding: 16px 0; text-align: center; }

    /* ── Formation ── */
    .formation-card { padding: 20px; }
    .form-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .form-dot { width: 12px; height: 12px; border-radius: 50%; }
    .form-title { font-size: 18px; font-weight: 700; }
    .form-desc { font-size: 14px; color: var(--text-muted); line-height: 1.7; margin: 0 0 16px; }
    .form-stats { display: flex; gap: 10px; flex-wrap: wrap; }
    .stat-chip { background: var(--bg-card2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; text-align: center; }
    .stat-val { display: block; font-size: 22px; font-weight: 800; color: var(--factory-primary); }
    .stat-lbl { font-size: 11px; color: var(--text-muted); }

    /* ── Config ── */
    .config-section { }
    .config-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .config-title { font-size: 14px; font-weight: 700; }
    .config-desc { font-size: 12px; color: var(--text-muted); margin: 0 0 14px; }
    .btn-add-symptom {
      padding: 8px 16px; border-radius: 8px; border: 1px solid var(--color-warning);
      color: var(--color-warning); background: #FFB70011; cursor: pointer; font-size: 13px; font-weight: 600;
    }

    /* Formulaire inline */
    .inline-form { margin-bottom: 12px; }
    .if-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; color: var(--factory-primary); }
    .if-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
    .btn-cancel-sm { padding: 7px 14px; border-radius: 6px; border: 1px solid var(--border); background: none; color: var(--text-muted); cursor: pointer; font-size: 12px; }
    .btn-save-sm   { padding: 7px 14px; border-radius: 6px; border: none; background: var(--factory-primary); color: #fff; cursor: pointer; font-size: 12px; font-weight: 600; }
    .btn-save-sm:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Symptôme config */
    .config-symptom { margin-bottom: 10px; }
    .cs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .cs-label { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: var(--text); flex: 1; }
    .symp-num { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: var(--factory-primary); color: #fff; font-size: 11px; font-weight: 800; flex-shrink: 0; }
    .cs-actions { display: flex; gap: 4px; }
    .btn-icon-sm { background: none; border: none; cursor: pointer; padding: 5px 7px; border-radius: 5px; font-size: 14px; opacity: 0.6; }
    .btn-icon-sm:hover { opacity: 1; background: var(--bg-card2); }
    .btn-icon-sm.danger:hover { background: #FF4D6D22; }
    .btn-icon-sm.save { color: var(--color-success); }
    .edit-inline { padding: 6px 10px !important; height: 36px; flex: 1; }

    /* Causes config */
    .causes-list { padding-left: 12px; border-left: 2px solid var(--border); margin-left: 12px; }
    .cause-config-row { margin-bottom: 10px; }
    .cc-cause { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .cause-badge-sm { font-size: 10px; font-weight: 700; color: var(--color-danger); background: #FF4D6D18; border: 1px solid #FF4D6D33; padding: 2px 7px; border-radius: 8px; white-space: nowrap; }
    .cc-label { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; }
    .btn-add-cause { width: 100%; margin-top: 4px; padding: 7px 0; border: 1px dashed #FF4D6D44; border-radius: 6px; background: none; color: var(--color-danger); cursor: pointer; font-size: 12px; opacity: 0.7; }
    .btn-add-cause:hover { opacity: 1; background: #FF4D6D11; }
    .add-cause-form { padding: 10px; background: var(--bg-card2); border-radius: 8px; margin-top: 6px; }

    /* Actions config */
    .actions-config { padding-left: 20px; border-left: 2px dotted var(--border); margin-left: 10px; }
    .action-config-row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
    .action-num-sm { font-size: 10px; font-weight: 700; color: var(--color-success); background: #00E5A022; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ac-label { font-size: 12px; color: var(--text); flex: 1; }
    .btn-add-action { padding: 5px 0; border: none; background: none; color: var(--color-success); cursor: pointer; font-size: 12px; opacity: 0.7; }
    .btn-add-action:hover { opacity: 1; }
    .action-config-row.adding { background: #00E5A011; border-radius: 6px; padding: 4px 6px; }

    /* Divers */
    .btn-go-config { margin-top: 10px; padding: 9px 18px; border-radius: 8px; border: 1px solid var(--color-warning); color: var(--color-warning); background: none; cursor: pointer; font-size: 13px; }
    .center-msg, .empty-state { text-align: center; color: var(--text-muted); padding: 32px 0; }
  `]
})
export class MachinesComponent {
  config  = inject(FactoryConfigService);
  auth    = inject(AuthService);
  http    = inject(HttpClient);
  diagApi = inject(DiagnosticApiService);

  selectedLine        = signal<ProductionLine | null>(null);
  selectedMachineType = signal<MachineType | null>(null);
  activeTab           = signal<MachineTab>('pannes');
  openSymptomId       = signal<string | null>(null);
  loading             = signal(false);
  saving              = signal(false);
  searchQuery         = '';

  // Config state
  showSymptomForm          = signal(false);
  editingSymptomId         = signal<string | null>(null);
  editingCauseId           = signal<string | null>(null);
  editingActionId          = signal<string | null>(null);
  addingCauseToSymptomId   = signal<string | null>(null);
  addingActionToCauseId    = signal<string | null>(null);

  symptomForm    = { label: '', description: '' };
  editSymptomLabel = '';
  editCauseLabel   = '';
  editActionLabel  = '';
  newCauseLabel    = '';
  newActionLabel   = '';

  machineTypes = this.config.machineTypes;
  private allSymptomsRaw = signal<Symptom[]>([]);
  filteredSymptoms       = signal<Symptom[]>([]);

  allSymptoms = this.allSymptomsRaw; // alias

  canConfig = () => this.auth.hasPermission('MACHINES_WRITE');

  totalCauses  = () => this.allSymptomsRaw().reduce((acc, s) => acc + (s.causes?.length ?? 0), 0);
  totalActions = () => this.allSymptomsRaw().reduce((acc, s) => acc + (s.causes ?? []).reduce((a2, c) => a2 + (c.actions?.length ?? 0), 0), 0);

  onLineSelected(line: ProductionLine) {
    this.selectedLine.set(line);
    if (this.machineTypes().length > 0) this.selectMachineType(this.machineTypes()[0]);
  }

  selectMachineType(mt: MachineType) {
    this.selectedMachineType.set(mt);
    this.activeTab.set('pannes');
    this.openSymptomId.set(null);
    this.searchQuery = '';
    this.loadSymptoms(mt.id);
  }

  filterSymptoms() {
    const q = this.searchQuery.toLowerCase();
    this.filteredSymptoms.set(q
      ? this.allSymptomsRaw().filter(s => s.label.toLowerCase().includes(q))
      : this.allSymptomsRaw()
    );
  }

  loadSymptoms(machineTypeId: string) {
    this.loading.set(true);
    this.diagApi.getSymptoms(machineTypeId).subscribe({
      next: s => { this.allSymptomsRaw.set(s); this.filteredSymptoms.set(s); this.loading.set(false); },
      error: () => { this.allSymptomsRaw.set([]); this.filteredSymptoms.set([]); this.loading.set(false); }
    });
  }

  toggleSymptom(id: string) { this.openSymptomId.set(this.openSymptomId() === id ? null : id); }

  private get api() { return environment.apiUrl; }

  // ── Symptômes ──────────────────────────────────────────
  openAddSymptom() { this.symptomForm = { label: '', description: '' }; this.showSymptomForm.set(true); }

  saveSymptom() {
    const mt = this.selectedMachineType();
    if (!mt || !this.symptomForm.label) return;
    this.saving.set(true);
    this.http.post<any>(`${this.api}/diagnostic/machine-types/${mt.id}/symptoms`, this.symptomForm)
      .subscribe({ next: () => { this.showSymptomForm.set(false); this.saving.set(false); this.loadSymptoms(mt.id); }, error: () => this.saving.set(false) });
  }

  startEditSymptom(s: any) { this.editingSymptomId.set(s.id); this.editSymptomLabel = s.label; }

  saveEditSymptom(id: string) {
    const mt = this.selectedMachineType();
    if (!this.editSymptomLabel || !mt) return;
    this.http.patch(`${this.api}/diagnostic/symptoms/${id}`, { label: this.editSymptomLabel })
      .subscribe({ next: () => { this.editingSymptomId.set(null); this.loadSymptoms(mt.id); }, error: () => {} });
  }

  removeSymptom(id: string) {
    const mt = this.selectedMachineType();
    if (!confirm('Supprimer ce symptôme et toutes ses causes ?') || !mt) return;
    this.http.delete(`${this.api}/diagnostic/symptoms/${id}`)
      .subscribe({ next: () => this.loadSymptoms(mt.id), error: () => {} });
  }

  // ── Causes ─────────────────────────────────────────────
  openAddCause(symptomId: string) { this.addingCauseToSymptomId.set(symptomId); this.newCauseLabel = ''; }

  saveNewCause(symptomId: string) {
    const mt = this.selectedMachineType();
    if (!this.newCauseLabel || !mt) return;
    this.http.post(`${this.api}/diagnostic/symptoms/${symptomId}/causes`, { label: this.newCauseLabel })
      .subscribe({ next: () => { this.addingCauseToSymptomId.set(null); this.newCauseLabel = ''; this.loadSymptoms(mt.id); }, error: () => {} });
  }

  startEditCause(c: any) { this.editingCauseId.set(c.id); this.editCauseLabel = c.label; }

  saveEditCause(id: string) {
    const mt = this.selectedMachineType();
    if (!this.editCauseLabel || !mt) return;
    this.http.patch(`${this.api}/diagnostic/causes/${id}`, { label: this.editCauseLabel })
      .subscribe({ next: () => { this.editingCauseId.set(null); this.loadSymptoms(mt.id); }, error: () => {} });
  }

  removeCause(id: string) {
    const mt = this.selectedMachineType();
    if (!confirm('Supprimer cette cause et ses actions ?') || !mt) return;
    this.http.delete(`${this.api}/diagnostic/causes/${id}`)
      .subscribe({ next: () => this.loadSymptoms(mt.id), error: () => {} });
  }

  // ── Actions ────────────────────────────────────────────
  openAddAction(causeId: string) { this.addingActionToCauseId.set(causeId); this.newActionLabel = ''; }

  saveNewAction(causeId: string) {
    const mt = this.selectedMachineType();
    if (!this.newActionLabel || !mt) return;
    this.http.post(`${this.api}/diagnostic/causes/${causeId}/actions`, { label: this.newActionLabel })
      .subscribe({ next: () => { this.addingActionToCauseId.set(null); this.newActionLabel = ''; this.loadSymptoms(mt.id); }, error: () => {} });
  }

  startEditAction(a: any) { this.editingActionId.set(a.id); this.editActionLabel = a.label; }

  saveEditAction(id: string) {
    const mt = this.selectedMachineType();
    if (!this.editActionLabel || !mt) return;
    this.http.patch(`${this.api}/diagnostic/actions/${id}`, { label: this.editActionLabel })
      .subscribe({ next: () => { this.editingActionId.set(null); this.loadSymptoms(mt.id); }, error: () => {} });
  }

  removeAction(id: string) {
    const mt = this.selectedMachineType();
    if (!confirm('Supprimer cette action corrective ?') || !mt) return;
    this.http.delete(`${this.api}/diagnostic/actions/${id}`)
      .subscribe({ next: () => this.loadSymptoms(mt.id), error: () => {} });
  }
}
