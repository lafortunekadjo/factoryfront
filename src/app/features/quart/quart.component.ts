import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { QuartApiService } from '../../core/services/api.services';
import { AuthService } from '../../core/services/auth.service';
import { LineSelectorComponent } from '../../shared/components/line-selector/line-selector.component';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { QuartRecord, ProductionLine, Product, ShiftConfig, StopType } from '../../core/models/models';

@Component({
  selector: 'app-quart',
  standalone: true,
  imports: [CommonModule, FormsModule, LineSelectorComponent, DatePipe],
  template: `
    <div class="quart animate-in">

      @if (!selectedLine()) {
        <app-line-selector (lineSelected)="onLineSelected($event)" />
      } @else {

        <div class="quart-header">
          <button class="back-btn" (click)="selectedLine.set(null)">← Accueil</button>
          <button class="btn-new" (click)="openCreateForm()">
            {{ showForm() && !editingId() ? '✕ Annuler' : '+ Nouveau quart' }}
          </button>
        </div>

        <!-- Formulaire (création OU édition) -->
        @if (showForm()) {
          <div class="quart-form factory-card" [style.border-color]="editingId() ? '#FFB70033' : '#00E5A033'">
            <div class="form-title" [style.color]="editingId() ? '#FFB700' : '#00E5A0'">
              {{ editingId() ? '✏️ Modifier le quart' : '📋 Saisie du quart' }}
            </div>

            <div class="row-2">
              <div>
                <label class="factory-label">Date</label>
                <input class="factory-input" type="date" [(ngModel)]="form.date" />
              </div>
              <div>
                <label class="factory-label">Heure</label>
                <input class="factory-input" type="time" [(ngModel)]="form.time" disabled />
              </div>
            </div>

            <!-- Quart (dynamique selon config usine) -->
            <label class="factory-label">Quart</label>
            <div class="shift-btns">
              @for (shift of shifts(); track shift.id) {
                <button class="shift-btn"
                        [class.active]="form.shiftId === shift.id"
                        [style.--sc]="shift.color"
                        (click)="form.shiftId = shift.id">
                  {{ shift.name }}
                </button>
              }
            </div>

            <div class="row-2" style="margin-top:11px;">
              <div>
                <label class="factory-label">Chef d'équipe</label>
                <select class="factory-input" [(ngModel)]="form.teamLeaderId" name="teamLeaderId">
                  <option value="">-- Sélectionner --</option>
                  @for (tl of teamLeaders(); track tl.id) {
                    <option [value]="tl.id">{{ tl.fullName }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="factory-label">Produit fabriqué</label>
                <select class="factory-input" [(ngModel)]="form.productId" name="productId"
                        (ngModelChange)="onProductChange()">
                  <option value="">-- Sélectionner --</option>
                  @for (p of products(); track p.id) {
                    <option [value]="p.id">{{ p.name }} {{ p.volume }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="row-2" style="margin-top: 11px;">
              <div>
                <label class="factory-label">
                  Bouteilles produites
                  @if (autoField() === 'bottles') { <span class="auto-badge">auto</span> }
                </label>
                <input class="factory-input" type="number" [(ngModel)]="form.bottlesProduced"
                       (ngModelChange)="onBottlesEdited()" placeholder="0" />
              </div>
              <div>
                <label class="factory-label">
                  Packs produits
                  @if (autoField() === 'packs') { <span class="auto-badge">auto</span> }
                </label>
                <input class="factory-input" type="number" [(ngModel)]="form.packsProduced"
                       (ngModelChange)="onPacksEdited()" placeholder="0" />
              </div>
            </div>

            @if (!selectedProductObj?.bottlesPerPack) {
              <div class="pallets-hint">
                ℹ️ Conditionnement non configuré pour ce produit — saisissez bouteilles et packs manuellement
              </div>
            }

            @if (selectedProductPallets() !== null) {
              <div class="pallets-hint">
                🏗️ ≈ {{ selectedProductPallets() }} palette(s) estimée(s)
              </div>
            }

            <!-- Arrêts (liste configurable par usine) -->
            <label class="factory-label" style="margin-top: 11px;">Types d'arrêts</label>
            <div class="stop-tags">
              @for (st of stopTypes(); track st.id) {
                <button class="stop-tag"
                        [class.selected]="isStopSelected(st.id)"
                        (click)="toggleStop(st)">
                  {{ st.label }}
                </button>
              }
            </div>

            <!-- Durée par arrêt sélectionné -->
            @for (se of form.stopEvents; track se.stopTypeId) {
              <div class="stop-duration-row">
                <span class="stop-label">{{ se.stopTypeLabel }}</span>
                <div class="stop-dur-input">
                  <input class="factory-input" type="number" [(ngModel)]="se.durationMinutes" placeholder="min" style="width: 80px;" />
                  <span style="font-size: 12px; color: var(--text-muted);">min</span>
                </div>
              </div>
            }

            <div style="margin-top: 11px;">
              <label class="factory-label">Notes / observations</label>
              <textarea class="factory-input" [(ngModel)]="form.notes" rows="2" placeholder="Détails supplémentaires..."></textarea>
            </div>

            <div class="form-actions">
              @if (editingId()) {
                <button class="btn-cancel-edit" (click)="cancelEdit()">Annuler</button>
              }
              <button class="btn-factory-primary" style="flex:1;"
                      [disabled]="!form.bottlesProduced || saving()"
                      (click)="save()">
                @if (saving()) {
                  ⏳ Enregistrement...
                } @else if (editingId()) {
                  💾 Enregistrer les modifications
                } @else {
                  ✅ Enregistrer le quart
                }
              </button>
            </div>
          </div>
        }

        <!-- Stats du jour -->
        @if (dayStats()) {
          <div class="day-stats factory-card">
            <div class="ds-item">
              <div class="ds-val" style="color: var(--color-info)">{{ dayStats()!.totalBottles | number }}</div>
              <div class="ds-lbl">bouteilles aujourd'hui</div>
            </div>
            <div class="ds-item">
              <div class="ds-val" style="color: var(--color-warning)">{{ dayStats()!.totalDowntime }}min</div>
              <div class="ds-lbl">arrêts cumulés</div>
            </div>
            <div class="ds-item">
              <div class="ds-val" style="color: var(--text-muted)">{{ dayStats()!.quartCount }}</div>
              <div class="ds-lbl">quarts saisis</div>
            </div>
          </div>
        }

        <!-- Filtre période pour "mes fiches" -->
        <div class="my-records-header">
          <div class="mr-title">📋 Mes fiches de quart</div>
          <div class="mr-filters">
            <input class="factory-input mr-date" type="date" [(ngModel)]="filterFrom" (change)="loadMyRecords()" />
            <span class="mr-sep">→</span>
            <input class="factory-input mr-date" type="date" [(ngModel)]="filterTo" (change)="loadMyRecords()" />
          </div>
        </div>

        @if (loadingRecords()) {
          <div class="center-msg">Chargement...</div>
        }

        <!-- Liste des saisies -->
        @for (record of records(); track record.id) {
          <div class="record-card factory-card" [class.editing-target]="editingId() === record.id">
            <div class="rc-top">
              <div>
                <div class="rc-date" [style.color]="record.shiftColor ?? '#00E5A0'">
                  {{ record.productionDate }} · {{ record.shiftName }}
                  @if (record.shiftShortName) { <span class="rc-badge" [style.background]="(record.shiftColor ?? '#00E5A0') + '22'" [style.color]="record.shiftColor ?? '#00E5A0'">{{ record.shiftShortName }}</span> }
                </div>
                <div class="rc-operator">
                  {{ record.operatorName }}
                  @if (record.teamLeaderName) { · Chef: {{ record.teamLeaderName }} }
                </div>
              </div>
              <div class="rc-right">
                <div class="rc-bottles">{{ record.bottlesProduced | number }}</div>
                <div class="rc-unit">bt</div>
              </div>
            </div>

            @if (record.productLabel) {
              <div class="rc-product" [style.color]="record.productColor">
                📦 {{ record.productLabel }}
                @if (record.palletsProduced) { · {{ record.palletsProduced }} palette(s) }
              </div>
            }

            @if (record.stopEvents?.length) {
              <div class="rc-stops">
                @for (se of record.stopEvents; track se.stopTypeId) {
                  <span class="stop-chip" [class.planned]="se.isPlanned">
                    {{ se.stopTypeLabel }} @if (se.durationMinutes) { · {{ se.durationMinutes }}min }
                  </span>
                }
              </div>
            }

            @if (record.notes) {
              <div class="rc-notes">📝 {{ record.notes }}</div>
            }

            <div class="rc-footer">
              @if (record.updatedAt) {
                <div class="rc-updated">
                  ✏️ Modifié le {{ record.updatedAt | date:'dd/MM/yyyy HH:mm' }}
                  @if (record.updatedByName) { par {{ record.updatedByName }} }
                </div>
              } @else {
                <div></div>
              }
              <div class="rc-actions">
                @if (record.canEdit) {
                  <button class="btn-edit-record" (click)="startEdit(record)">✏️ Modifier</button>
                }
                @if (isTeamLeaderOf(record)) {
                  <button class="btn-presence-record"
                          [class.validated]="presenceValidated(record.id)"
                          (click)="togglePresencePanel(record.id)">
                    {{ presenceValidated(record.id) ? '✅ Présences' : '👥 Présences' }}
                  </button>
                }
              </div>
            </div>

            <!-- ── Panneau présences inline ── -->
            @if (openPresenceRecordId() === record.id) {
              <div class="presence-panel">
                @if (loadingPresence()) {
                  <div class="center-msg" style="padding:12px 0;">Chargement...</div>
                } @else if (activePresenceSheet()) {
                  <div class="pp-title">
                    👥 Liste de présence — {{ activePresenceSheet()!.equipeNom }}
                    @if (activePresenceSheet()!.locked) {
                      <span class="pp-locked">✅ Validée</span>
                    }
                  </div>

                  @for (ligne of presenceForm; track ligne.membreId; let i = $index) {
                    <div class="pp-row" [class.pp-absent]="ligne.present === false">
                      <div class="pp-info">
                        <div class="pp-name">{{ ligne.membreNom }}</div>
                        <div class="pp-poste">{{ ligne.posteNom }}</div>
                      </div>
                      @if (!activePresenceSheet()!.locked) {
                        <div class="pp-btns">
                          <button class="btn-pp-present" [class.active]="ligne.present === true"
                                  (click)="setPresenceInQuart(i, true)">✓</button>
                          <button class="btn-pp-absent" [class.active]="ligne.present === false"
                                  (click)="setPresenceInQuart(i, false)">✗</button>
                        </div>
                      } @else {
                        <span class="pp-status" [class.present]="ligne.present" [class.absent]="!ligne.present">
                          {{ ligne.present ? '✓ Présent' : '✗ Absent' }}
                        </span>
                      }
                    </div>
                  }

                  @if (!activePresenceSheet()!.locked && presenceForm.length > 0) {
                    <!-- Ajout manuel d'un membre hors équipe planifiée -->
                    <div class="pp-add-section">
                      @if (!showUserSearch()) {
                        <button class="btn-add-absent" (click)="openUserSearch()">
                          + Ajouter un membre hors planning
                        </button>
                      } @else {
                        <div class="user-search-panel">
                          <input class="factory-input" [(ngModel)]="userSearchQuery"
                                 (ngModelChange)="onUserSearchChange()"
                                 placeholder="Nom ou poste..." autofocus />
                          <div class="user-search-results">
                            @for (u of userSearchResults(); track u.userId) {
                              <button class="user-search-item"
                                      (click)="addManualMember(record.id, u.userId)">
                                <span class="usm-name">{{ u.fullName }}</span>
                                @if (u.jobTitle) {
                                  <span class="usm-job">{{ u.jobTitle }}</span>
                                }
                              </button>
                            }
                            @if (userSearchQuery.length > 1 && !userSearchResults().length) {
                              <div class="usm-empty">Aucun utilisateur trouvé</div>
                            }
                          </div>
                          <button class="btn-cancel-search" (click)="showUserSearch.set(false); userSearchQuery = ''; userSearchResults.set([])">
                            Annuler
                          </button>
                        </div>
                      }
                    </div>

                    <div class="pp-footer">
                      <span class="pp-summary">
                        {{ presentsCountInQuart() }} présent(s) ·
                        {{ absentsCountInQuart() }} absent(s)
                      </span>
                      <button class="btn-validate-presence"
                              [disabled]="validatingPresence() || allUndecidedInQuart()"
                              (click)="validatePresenceForQuart(record.id)">
                        {{ validatingPresence() ? '⏳...' : '✅ Valider les présences' }}
                      </button>
                    </div>
                  }

                  @if (activePresenceSheet()!.locked && presenceForm.length === 0) {
                    <div class="center-msg" style="padding:8px 0;font-size:12px;">
                      Aucun membre d'équipe trouvé pour cette ligne
                    </div>
                  }
                }
              </div>
            }
          </div>
        }

        @if (!loadingRecords() && records().length === 0 && !showForm()) {
          <div class="empty-state">
            <div style="font-size: 40px;">📋</div>
            <p>Aucun quart saisi sur cette période</p>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .quart { max-width: 700px; margin: 0 auto; }
    .quart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 0; }
    .btn-new { padding: 8px 16px; border-radius: 8px; background: var(--factory-primary); color: #fff; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
    .quart-form { border-radius: var(--border-radius); }
    .form-title { font-size: 14px; font-weight: 700; margin-bottom: 16px; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 11px; }

    /* Shifts */
    .shift-btns { display: flex; gap: 6px; margin-bottom: 11px; flex-wrap: wrap; }
    .shift-btn {
      flex: 1; padding: 9px 8px; border-radius: 8px;
      border: 1px solid var(--border); background: var(--bg-card2);
      color: var(--text-muted); cursor: pointer; font-size: 13px; font-weight: 500;
      min-width: 80px;
    }
    .shift-btn.active { background: var(--sc, var(--factory-primary)); color: #fff; border-color: transparent; font-weight: 700; }

    /* Calcul auto packs/palettes */
    .auto-badge {
      font-size: 9px; font-weight: 700; color: var(--color-success);
      background: #00E5A022; border: 1px solid #00E5A044;
      padding: 1px 6px; border-radius: 8px; margin-left: 6px;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .pallets-hint {
      font-size: 12px; color: var(--text-muted);
      background: var(--bg-card2); border: 1px solid var(--border);
      border-radius: 8px; padding: 7px 12px; margin-bottom: 11px;
    }

    /* Stop types */
    .stop-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .stop-tag {
      padding: 5px 12px; border-radius: 16px;
      border: 1px solid var(--border); background: var(--bg-card2);
      color: var(--text-muted); cursor: pointer; font-size: 12px;
    }
    .stop-tag.selected { background: var(--factory-primary); color: #fff; border-color: transparent; }
    .stop-duration-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .stop-label { font-size: 13px; }
    .stop-dur-input { display: flex; align-items: center; gap: 6px; }

    /* Form actions */
    .form-actions { display: flex; gap: 8px; margin-top: 14px; }
    .btn-cancel-edit {
      padding: 0 18px; border-radius: 8px; border: 1px solid var(--border);
      background: none; color: var(--text-muted); cursor: pointer; font-size: 13px;
    }

    /* Day stats */
    .day-stats { display: flex; justify-content: space-around; margin-bottom: 14px; }
    .ds-item { text-align: center; }
    .ds-val { font-size: 20px; font-weight: 800; }
    .ds-lbl { font-size: 11px; color: var(--text-muted); }

    /* Mes fiches header */
    .my-records-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .mr-title { font-size: 14px; font-weight: 700; }
    .mr-filters { display: flex; align-items: center; gap: 6px; }
    .mr-date { padding: 7px 10px !important; font-size: 12px !important; width: auto; }
    .mr-sep { color: var(--text-muted); font-size: 12px; }

    .center-msg { text-align: center; color: var(--text-muted); padding: 20px 0; }

    /* Records */
    .record-card { border-radius: var(--border-radius); margin-bottom: 10px; transition: border-color 0.2s; }
    .record-card.editing-target { border-color: #FFB700; }
    .rc-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .rc-date { font-size: 12px; font-weight: 600; margin-bottom: 2px; display: flex; align-items: center; gap: 6px; }
    .rc-badge { padding: 1px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .rc-operator { font-size: 12px; color: var(--text-muted); }
    .rc-right { text-align: right; }
    .rc-bottles { font-size: 18px; font-weight: 800; }
    .rc-unit { font-size: 11px; color: var(--text-muted); }
    .rc-product { font-size: 12px; font-weight: 600; margin-top: 6px; }
    .rc-stops { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
    .stop-chip { padding: 2px 8px; background: #FF4D6D11; border: 1px solid #FF4D6D33; border-radius: 5px; font-size: 11px; color: var(--color-danger); }
    .stop-chip.planned { background: #00C2FF11; border-color: #00C2FF33; color: var(--color-info); }
    .rc-notes { font-size: 12px; color: var(--text-muted); margin-top: 7px; font-style: italic; }

    .rc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }
    .rc-updated { font-size: 11px; color: var(--color-warning); }
    .rc-actions { display: flex; gap: 6px; align-items: center; }
    .btn-edit-record {
      padding: 5px 12px; border-radius: 6px;
      background: #FFB70022; border: 1px solid #FFB70044;
      color: var(--color-warning); cursor: pointer; font-size: 12px; font-weight: 600;
    }
    .btn-presence-record {
      padding: 5px 12px; border-radius: 6px;
      background: var(--bg-card2); border: 1px solid var(--border);
      color: var(--text-muted); cursor: pointer; font-size: 12px; font-weight: 600;
    }
    .btn-presence-record.validated {
      background: #00E5A022; border-color: #00E5A044; color: var(--color-success);
    }

    /* Panneau présences inline */
    .presence-panel {
      margin-top: 12px; padding-top: 12px;
      border-top: 1px dashed var(--border);
    }
    .pp-title {
      font-size: 13px; font-weight: 700; margin-bottom: 10px;
      display: flex; align-items: center; gap: 8px;
    }
    .pp-locked { font-size: 11px; background: #00E5A022; border: 1px solid #00E5A044; color: var(--color-success); padding: 2px 8px; border-radius: 8px; }
    .pp-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 10px; border-radius: 8px; margin-bottom: 5px;
      background: var(--bg-card2); border: 1px solid var(--border);
    }
    .pp-row.pp-absent { border-color: #FF4D6D44; background: #FF4D6D08; }
    .pp-info { flex: 1; }
    .pp-name { font-size: 13px; font-weight: 600; }
    .pp-poste { font-size: 11px; color: var(--text-muted); }
    .pp-btns { display: flex; gap: 5px; }
    .btn-pp-present, .btn-pp-absent {
      width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border);
      background: none; cursor: pointer; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .btn-pp-present.active { background: #00E5A022; border-color: #00E5A0; color: var(--color-success); }
    .btn-pp-absent.active  { background: #FF4D6D22; border-color: #FF4D6D; color: var(--color-danger); }
    .pp-status { font-size: 12px; font-weight: 600; }
    .pp-status.present { color: var(--color-success); }
    .pp-status.absent  { color: var(--color-danger); }
    .pp-footer {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border);
    }
    .pp-summary { font-size: 12px; color: var(--text-muted); }
    .btn-validate-presence {
      padding: 7px 14px; border-radius: 8px; border: none;
      background: var(--factory-secondary); color: #fff;
      cursor: pointer; font-size: 12px; font-weight: 700;
    }
    .btn-validate-presence:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Ajout manuel membre */
    .pp-add-section { margin: 8px 0; }
    .btn-add-absent { width: 100%; padding: 7px; border: 1px dashed var(--border); border-radius: 8px; background: none; color: var(--text-muted); cursor: pointer; font-size: 12px; }
    .btn-add-absent:hover { border-color: var(--factory-primary); color: var(--factory-primary); }
    .user-search-panel { background: var(--bg-card2); border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 8px; }
    .user-search-results { max-height: 180px; overflow-y: auto; margin-top: 6px; }
    .user-search-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; background: none; border: none; border-radius: 6px; cursor: pointer; text-align: left; }
    .user-search-item:hover { background: var(--bg-card); }
    .usm-name { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; }
    .usm-job { font-size: 11px; color: var(--text-muted); }
    .usm-empty { font-size: 12px; color: var(--text-muted); padding: 8px 10px; }
    .btn-cancel-search { margin-top: 6px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; }

    .empty-state { text-align: center; color: var(--text-muted); padding: 40px 0; }
  `]
})
export class QuartComponent implements OnInit {
  config = inject(FactoryConfigService);
  auth = inject(AuthService);
  http = inject(HttpClient);
  quartApi = inject(QuartApiService);

  selectedLine = signal<ProductionLine | null>(null);
  showForm = signal(false);
  saving = signal(false);
  loadingRecords = signal(false);
  records = signal<QuartRecord[]>([]);
  products = signal<Product[]>([]);
  dayStats = signal<any>(null);
  editingId = signal<string | null>(null);

  shifts = this.config.shifts;
  stopTypes = this.config.stopTypes;
  teamLeaders = signal<{id:string; fullName:string}[]>([]);

  // 'bottles' | 'packs' | null — indique quel champ est actuellement calculé
  // automatiquement à partir de l'autre. null = aucun calcul auto en cours
  // (saisie libre des deux côtés, ou conditionnement produit non configuré).
  autoField = signal<'bottles' | 'packs' | null>(null);

  // Filtre période "mes fiches" — par défaut : mois en cours
  filterFrom = this.firstDayOfMonth();
  filterTo   = new Date().toISOString().split('T')[0];

  form = this.emptyForm();

  emptyForm() {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().slice(0, 5);
    return {
      date: today, time, shiftId: '', productId: '',
      teamLeaderId: '',
      bottlesProduced: null as number | null,
      packsProduced: null as number | null,
      notes: '',
      stopEvents: [] as { stopTypeId: string; stopTypeLabel: string; durationMinutes: number | null }[]
    };
  }

  ngOnInit() {
    const shifts = this.shifts();
    if (shifts.length > 0) this.form.shiftId = shifts[0].id;
  }

  async onLineSelected(line: ProductionLine) {
    this.selectedLine.set(line);
    this.form = this.emptyForm();
    if (this.shifts().length) this.form.shiftId = this.shifts()[0].id;

    this.products.set(await this.config.getProductsForLine(line.id));
    this.loadMyRecords();
    this.loadDayStats(line.id);
    this.loadTeamLeaders();
  }

  loadMyRecords() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.loadingRecords.set(true);
    this.quartApi.findMyRecords(factoryId, this.filterFrom, this.filterTo).subscribe({
      next: page => { this.records.set(page.content); this.loadingRecords.set(false); },
      error: () => this.loadingRecords.set(false)
    });
  }

  loadTeamLeaders() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.http.get<{id:string;fullName:string}[]>(
      environment.apiUrl + '/reports/factory/' + factoryId + '/team-leaders'
    ).subscribe({ next: l => this.teamLeaders.set(l), error: () => {} });
  }

  loadDayStats(lineId: string) {
    const today = new Date().toISOString().split('T')[0];
    this.quartApi.getDayStats(lineId, today).subscribe(s => this.dayStats.set(s));
  }

  isStopSelected(id: string): boolean {
    return this.form.stopEvents.some(se => se.stopTypeId === id);
  }

  toggleStop(st: StopType) {
    const idx = this.form.stopEvents.findIndex(se => se.stopTypeId === st.id);
    if (idx >= 0) {
      this.form.stopEvents.splice(idx, 1);
    } else {
      this.form.stopEvents.push({ stopTypeId: st.id, stopTypeLabel: st.label, durationMinutes: null });
    }
  }

  // ── Calcul automatique bidirectionnel bouteilles ⇄ packs ──
  get selectedProductObj(): Product | undefined {
    return this.products().find(p => p.id === this.form.productId);
  }

  onProductChange() {
    // Au changement de produit, on recalcule selon le dernier champ touché,
    // ou les bouteilles par défaut si rien n'a encore été saisi.
    if (!this.autoField()) this.autoField.set('packs');
    this.recompute();
  }

  onBottlesEdited() {
    // L'utilisateur vient de saisir les bouteilles → les packs deviennent le champ auto
    this.autoField.set('packs');
    this.recompute();
  }

  onPacksEdited() {
    // L'utilisateur vient de saisir les packs → les bouteilles deviennent le champ auto
    this.autoField.set('bottles');
    this.recompute();
  }

  private recompute() {
    const product = this.selectedProductObj;
    const bottlesPerPack = product?.bottlesPerPack;
    if (!bottlesPerPack) return;

    const target = this.autoField();
    if (target === 'packs') {
      if (this.form.bottlesProduced != null) {
        this.form.packsProduced = Math.round(this.form.bottlesProduced / bottlesPerPack);
      }
    } else if (target === 'bottles') {
      if (this.form.packsProduced != null) {
        this.form.bottlesProduced = this.form.packsProduced * bottlesPerPack;
      }
    }
  }

  selectedProductPallets(): number | null {
    const product = this.selectedProductObj;
    const packs = this.form.packsProduced;
    if (!product?.packsPerPallet || !packs) return null;
    return Math.floor(packs / product.packsPerPallet);
  }

  // ── Présences inline dans la fiche de quart ──────────────
  openPresenceRecordId  = signal<string | null>(null);
  loadingPresence       = signal(false);
  validatingPresence    = signal(false);
  activePresenceSheet   = signal<any | null>(null);
  showUserSearch        = signal(false);
  userSearchQuery       = '';
  userSearchResults     = signal<Array<{ userId: string; fullName: string; jobTitle?: string }>>([]);
  private searchDebounce: any;

  presenceForm: Array<{
    membreId: string; membreNom: string; posteNom: string;
    present: boolean | null; addedByChef: boolean; note: string;
  }> = [];

  // Ensemble des quart_record_id dont les présences sont déjà validées
  private validatedPresenceIds = new Set<string>();

  openUserSearch() {
    this.showUserSearch.set(true);
    this.userSearchQuery = '';
    this.userSearchResults.set([]);
  }

  onUserSearchChange() {
    clearTimeout(this.searchDebounce);
    if (this.userSearchQuery.length < 2) { this.userSearchResults.set([]); return; }
    this.searchDebounce = setTimeout(() => this.searchUsers(), 300);
  }

  searchUsers() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.http.get<any[]>(
      `${environment.apiUrl}/rh/factories/${factoryId}/users-search`,
      { params: { q: this.userSearchQuery } }
    ).subscribe({ next: r => this.userSearchResults.set(r), error: () => {} });
  }

  addManualMember(recordId: string, userId: string) {
    const chefId = this.auth.user()?.id;
    if (!chefId) return;
    this.http.post(
      `${environment.apiUrl}/rh/quart/${recordId}/presences/add-manual`,
      null,
      { params: { userId, chefId } }
    ).subscribe({
      next: () => {
        // Réinitialiser la recherche mais garder le panneau ouvert
        // pour permettre d'ajouter plusieurs membres
        this.userSearchQuery = '';
        this.userSearchResults.set([]);
        // Recharger sans fermer le sélecteur
        this.loadingPresence.set(true);
        this.http.get<any>(`${environment.apiUrl}/rh/quart/${recordId}/presences`).subscribe({
          next: sheet => {
            this.activePresenceSheet.set(sheet);
            this.presenceForm = sheet.lignes.map((l: any) => ({
              membreId: l.membreId, membreNom: l.membreNom, posteNom: l.posteNom,
              present: l.present, addedByChef: l.addedByChef ?? false, note: l.note ?? '',
              isMachineOp: l.isMachineOp ?? false, note5s: l.note5s ?? null
            }));
            this.loadingPresence.set(false);
            // Laisser showUserSearch ouvert pour permettre d'autres ajouts
          },
          error: () => this.loadingPresence.set(false)
        });
      },
      error: () => {}
    });
  }

  private loadPresenceSheet(recordId: string) {
    this.loadingPresence.set(true);
    this.http.get<any>(`${environment.apiUrl}/rh/quart/${recordId}/presences`).subscribe({
      next: sheet => {
        this.activePresenceSheet.set(sheet);
        this.presenceForm = sheet.lignes.map((l: any) => ({
          membreId: l.membreId, membreNom: l.membreNom, posteNom: l.posteNom,
          present: l.present, addedByChef: l.addedByChef ?? false, note: l.note ?? '',
          isMachineOp: l.isMachineOp ?? false, note5s: l.note5s ?? null
        }));
        if (sheet.locked) this.validatedPresenceIds.add(recordId);
        this.loadingPresence.set(false);
      },
      error: () => this.loadingPresence.set(false)
    });
  }

  isTeamLeaderOf(record: QuartRecord): boolean {
    const user = this.auth.user();
    if (!user) return false;
    // Chef assigné à cette fiche OU utilisateur is_team_leader OU admin
    return record.teamLeaderId === user.id
      || user.roles.some(r => r === 'FACTORY_ADMIN' || r.endsWith('_FACTORY_ADMIN'))
      || (user as any).isTeamLeader === true;
  }

  presenceValidated(recordId: string): boolean {
    return this.validatedPresenceIds.has(recordId);
  }

  togglePresencePanel(recordId: string) {
    if (this.openPresenceRecordId() === recordId) {
      this.openPresenceRecordId.set(null);
      this.showUserSearch.set(false);
      return;
    }
    this.openPresenceRecordId.set(recordId);
    this.activePresenceSheet.set(null);
    this.presenceForm = [];
    this.showUserSearch.set(false);
    this.loadPresenceSheet(recordId);
  }

  setPresenceInQuart(i: number, val: boolean) {
    this.presenceForm[i].present = val;
  }

  presentsCountInQuart(): number {
    return this.presenceForm.filter(p => p.present === true).length;
  }
  absentsCountInQuart(): number {
    return this.presenceForm.filter(p => p.present === false).length;
  }
  allUndecidedInQuart(): boolean {
    return this.presenceForm.every(p => p.present === null);
  }

  validatePresenceForQuart(recordId: string) {
    const chefId = this.auth.user()?.id;
    if (!chefId) return;
    this.validatingPresence.set(true);
    this.http.post(
      `${environment.apiUrl}/rh/quart/${recordId}/presences/validate?chefId=${chefId}`,
      { items: this.presenceForm.map(p => ({
        membreId: p.membreId,
        present: p.present ?? false,
        addedByChef: p.addedByChef,
        note: p.note || undefined
      })) }
    ).subscribe({
      next: () => {
        this.validatingPresence.set(false);
        this.activePresenceSheet.update(s => s ? { ...s, locked: true } : s);
        this.validatedPresenceIds.add(recordId);
      },
      error: () => this.validatingPresence.set(false)
    });
  }

  // ── Création ──────────────────────────────────────────
  openCreateForm() {
    if (this.showForm() && !this.editingId()) {
      this.showForm.set(false);
      return;
    }
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.autoField.set(null);
    if (this.shifts().length) this.form.shiftId = this.shifts()[0].id;
    this.showForm.set(true);
  }

  // ── Édition ───────────────────────────────────────────
  startEdit(record: QuartRecord) {
    this.editingId.set(record.id);
    // En édition, les valeurs existantes peuvent diverger du calcul auto
    // (conditionnement modifié depuis, correction manuelle...) : on
    // désactive le calcul auto pour ne jamais écraser une valeur déjà saisie.
    this.autoField.set(null);
    this.form = {
      date: record.productionDate,
      time: new Date().toTimeString().slice(0, 5),
      shiftId: record.shiftConfigId,
      productId: record.productId ?? '',
      teamLeaderId: record.teamLeaderId ?? '',
      bottlesProduced: record.bottlesProduced ?? null,
      packsProduced: record.packsProduced ?? null,
      notes: record.notes ?? '',
      stopEvents: (record.stopEvents ?? []).map(se => ({
        stopTypeId: se.stopTypeId ?? '',
        stopTypeLabel: se.stopTypeLabel ?? '',
        durationMinutes: se.durationMinutes ?? null
      }))
    };
    this.showForm.set(true);
    // Scroll vers le formulaire
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.showForm.set(false);
    this.form = this.emptyForm();
    this.autoField.set(null);
    if (this.shifts().length) this.form.shiftId = this.shifts()[0].id;
  }

  // ── Sauvegarde (création OU édition) ──────────────────
  save() {
    const line = this.selectedLine();
    if (!line || !this.form.bottlesProduced) return;
    this.saving.set(true);

    const req = {
      productionLineId: line.id,
      shiftConfigId: this.form.shiftId,
      teamLeaderId: this.form.teamLeaderId || undefined,
      productId: this.form.productId || undefined,
      productionDate: this.form.date,
      bottlesProduced: this.form.bottlesProduced,
      packsProduced: this.form.packsProduced || undefined,
      stopEvents: this.form.stopEvents.map(se => ({
        stopTypeId: se.stopTypeId,
        durationMinutes: se.durationMinutes || undefined
      })),
      notes: this.form.notes || undefined
    };

    const editId = this.editingId();
    const obs = editId
      ? this.quartApi.update(editId, req)
      : this.quartApi.create(req);

    obs.subscribe({
      next: (record) => {
        if (editId) {
          this.records.update(list => list.map(r => r.id === editId ? record : r));
        } else {
          this.records.update(r => [record, ...r]);
        }
        this.saving.set(false);
        this.showForm.set(false);
        this.editingId.set(null);
        this.form = this.emptyForm();
        if (this.shifts().length) this.form.shiftId = this.shifts()[0].id;
        this.loadDayStats(line.id);
      }, 
      error: () => this.saving.set(false)
    });
  }

  private firstDayOfMonth(): string {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }
}