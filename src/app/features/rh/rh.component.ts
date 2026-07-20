import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RhApiService } from '../../core/services/api.services';
import { AuthService } from '../../core/services/auth.service';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { PrintService } from '../../core/services/print.service';
import { LineSelectorComponent } from '../../shared/components/line-selector/line-selector.component';
import { ProductionLine, PlanningEntry, PresenceSheet, PresenceBilan, ShiftExchange } from '../../core/models/models';
import { environment } from '../../../environments/environment';

type RhTab = 'planning' | 'presences' | 'echanges' | 'bilan';

@Component({
  selector: 'app-rh',
  standalone: true,
  imports: [CommonModule, FormsModule, LineSelectorComponent, DatePipe],
  template: `
    <div class="rh animate-in">
      @if (!selectedLine()) {
        <app-line-selector (lineSelected)="onLineSelected($event)" />
      } @else {
        <div class="rh-header">
          <button class="back-btn" (click)="selectedLine.set(null)">← Accueil</button>
          <div class="line-badge" [style.background]="selectedLine()!.color + '22'"
               [style.color]="selectedLine()!.color">
            {{ selectedLine()!.name }}
          </div>
        </div>

        <!-- Tabs -->
        <div class="rh-tabs">
          @for (tab of tabs; track tab.id) {
            <button class="rh-tab" [class.active]="activeTab() === tab.id"
                    (click)="switchTab(tab.id)">
              {{ tab.icon }} {{ tab.label }}
            </button>
          }
        </div>

        <!-- ── PLANNING ── -->
        @if (activeTab() === 'planning') {
          <div class="tab-section">
            <div class="section-header">
              <div>
                <div class="section-title">📅 Planning de rotation</div>
                @if (cycleInfo()) {
                  <div class="cycle-badge">
                    Cycle : {{ cycleInfo()!.cycleLength }} jours · {{ cycleInfo()!.nbEquipes }} équipes · {{ cycleInfo()!.reposMode }}
                  </div>
                }
              </div>
              <div class="header-actions">
                <!-- Nav semaine -->
                <div class="week-nav">
                  <button class="nav-btn" (click)="prevWeek()">‹</button>
                  <span class="week-label">{{ weekLabel() }}</span>
                  <button class="nav-btn" (click)="nextWeek()">›</button>
                </div>
                <!-- Actions export -->
                <button class="btn-export" (click)="showExportForm.set(!showExportForm()); showGenForm.set(false)">
                  📤 Exporter
                </button>
                <!-- Générer -->
                <button class="btn-generate" (click)="showGenForm.set(!showGenForm()); showExportForm.set(false)">
                  ⚡ {{ showGenForm() ? 'Annuler' : 'Générer' }}
                </button>
              </div>
            </div>

            <!-- ── Formulaire génération ── -->
            @if (showGenForm()) {
              <div class="gen-form factory-card">
                <div class="gen-title">Générer le planning</div>

                <div class="gen-row">
                  <div>
                    <label class="factory-label">Date de début</label>
                    <input class="factory-input" type="date" [ngModel]="genFrom()"
                           (ngModelChange)="genFrom.set($event)" />
                  </div>
                  <div>
                    <label class="factory-label">Date de fin</label>
                    <input class="factory-input" type="date" [ngModel]="genTo()"
                           (ngModelChange)="genTo.set($event)" />
                  </div>
                  <div class="gen-info">
                    @if (genNbJours() > 0 && cycleInfo()) {
                      <div class="gen-days">{{ genNbJours() }} jours</div>
                      @if (genNbJours() % cycleInfo()!.cycleLength === 0) {
                        <div class="gen-ok">✅ Multiple du cycle ({{ genNbJours() / cycleInfo()!.cycleLength }}x)</div>
                      } @else {
                        <div class="gen-err">
                          ❌ Doit être multiple de {{ cycleInfo()!.cycleLength }}<br>
                          <span class="gen-suggest">
                            Suggéré : {{ genSuggestLow() }} ou {{ genSuggestHigh() }} jours
                          </span>
                        </div>
                      }
                    }
                  </div>
                </div>

                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
                  <button class="btn-cancel" (click)="showGenForm.set(false)">Annuler</button>
                  <button class="btn-factory-primary"
                          [disabled]="generating() || !canGenerate()"
                          (click)="generatePlanning()">
                    {{ generating() ? '⏳ Génération...' : '⚡ Générer le planning' }}
                  </button>
                </div>
              </div>
            }

            <!-- ── Panneau export ── -->
            @if (showExportForm()) {
              <div class="gen-form factory-card">
                <div class="gen-title">📤 Exporter le planning</div>
                <div class="gen-row">
                  <div>
                    <label class="factory-label">Du</label>
                    <input class="factory-input" type="date" [ngModel]="exportFrom()"
                           (ngModelChange)="exportFrom.set($event)" />
                  </div>
                  <div>
                    <label class="factory-label">Au</label>
                    <input class="factory-input" type="date" [ngModel]="exportTo()"
                           (ngModelChange)="exportTo.set($event)" />
                  </div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                  <button class="btn-cancel" (click)="showExportForm.set(false)">Annuler</button>
                  <button class="btn-export" [disabled]="exportingPlanning()"
                          (click)="exportPlanningExcel()">
                    📥 Excel
                  </button>
                  <button class="btn-export" style="border-color:var(--factory-primary);color:var(--factory-primary);"
                          [disabled]="exportingPlanning()"
                          (click)="exportPlanningPdf()">
                    🖨️ PDF
                  </button>
                </div>
              </div>
            }

            @if (loadingPlanning()) { <div class="loading-msg">Chargement...</div> }

            <!-- ── Grille planning ── -->
            @if (planningGrid().length) {
              <div class="planning-wrap">
                <table class="planning-table">
                  <thead>
                    <tr>
                      <th class="th-equipe">Équipe</th>
                      @for (day of weekDays(); track day) {
                        <th class="th-day" [class.today]="isToday(day)">
                          <div class="day-name">{{ day | date:'EEE':'':'fr' }}</div>
                          <div class="day-num" [class.today-num]="isToday(day)">
                            {{ day | date:'dd/MM' }}
                          </div>
                        </th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of planningGrid(); track row.equipeId) {
                      <tr>
                        <td class="td-equipe">
                          <span class="equipe-dot" [style.background]="row.couleur"></span>
                          {{ row.equipeNom }}
                        </td>
                        @for (entry of row.entries; track entry?.date) {
                          <td class="td-cell" [class.repos]="entry?.isRepos || !entry"
                              [class.today-col]="entry && isToday(entry.date)"
                              [class.editing]="editingEntryId() === entry?.id">

                            @if (editingEntryId() === entry?.id) {
                              <!-- Mode édition inline -->
                              <div class="edit-cell">
                                <select class="edit-shift-select"
                                        [(ngModel)]="editShiftId"
                                        (change)="editIsRepos = false">
                                  <option value="">-- Repos --</option>
                                  @for (s of shifts(); track s.id) {
                                    <option [value]="s.id">{{ s.shortName || s.name }}</option>
                                  }
                                </select>
                                <div class="edit-cell-actions">
                                  <button class="ec-btn save" (click)="saveEntryEdit(entry!.id)">✓</button>
                                  <button class="ec-btn cancel" (click)="editingEntryId.set(null)">✕</button>
                                </div>
                              </div>
                            } @else {
                              @if (entry && !entry.isRepos) {
                                <div class="shift-cell" [style.background]="entry.equipeCouleur + '22'"
                                     [style.color]="entry.equipeCouleur"
                                     (click)="startEditEntry(entry)">
                                  <div class="shift-short">{{ entry.shiftShortName || entry.shiftName }}</div>
                                  @if (entry.locked) { <span class="lock-icon">🔒</span> }
                                </div>
                              } @else if (entry?.isRepos) {
                                <div class="repos-cell" (click)="startEditEntry(entry!)">R</div>
                              } @else {
                                <div class="empty-cell">—</div>
                              }
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="legend">
                <span class="legend-item"><span class="legend-dot repos"></span> Repos</span>
                <span class="legend-item"><span class="legend-dot lock">🔒</span> Validé</span>
                <span class="legend-item info">Cliquez sur une cellule pour la modifier</span>
              </div>
            } @else if (!loadingPlanning()) {
              <div class="empty-state">
                <div style="font-size:40px">📅</div>
                <p>Aucun planning pour cette semaine</p>
                <button class="btn-generate" (click)="showGenForm.set(true)">⚡ Générer maintenant</button>
              </div>
            }
          </div>
        }

        <!-- ── FEUILLE DE PRÉSENCE ── -->
        @if (activeTab() === 'presences') {
          <div class="tab-section">
            <div class="section-title">✅ Validation des présences</div>
            <div class="factory-card" style="text-align:center; padding: 32px 20px;">
              <div style="font-size:48px; margin-bottom:12px;">📋</div>
              <div style="font-size:15px; font-weight:700; margin-bottom:8px;">
                La validation des présences se fait depuis le module Quart
              </div>
              <div style="font-size:13px; color:var(--text-muted); margin-bottom:20px;">
                Ouvrez une fiche de quart, cliquez sur <strong>👥 Présences</strong>
                pour valider l'équipe de ce quart.
              </div>
              <div style="font-size:12px; color:var(--text-muted);">
                Le bilan consolidé de toutes les présences est disponible dans l'onglet 📊 Bilan.
              </div>
            </div>
          </div>
        }

        <!-- ── ÉCHANGES DE QUART ── -->
        @if (activeTab() === 'echanges') {
          <div class="tab-section">
            <div class="section-title">🔄 Échanges de quart</div>
            @if (loadingExchanges()) { <div class="loading-msg">Chargement...</div> }
            @for (ex of exchanges(); track ex.id) {
              <div class="exchange-card factory-card">
                <div class="ex-header">
                  <div>
                    <div class="ex-names">{{ ex.requesterName }} ⇄ {{ ex.accepterName }}</div>
                    <div class="ex-dates">
                      {{ ex.dateRequester | date:'dd/MM' }} ↔ {{ ex.dateAccepter | date:'dd/MM' }}
                    </div>
                  </div>
                  <span class="ex-status" [class]="'status-' + ex.status.toLowerCase()">
                    {{ statusLabel(ex.status) }}
                  </span>
                </div>
                @if (ex.note) { <div class="ex-note">📝 {{ ex.note }}</div> }
                @if (ex.rejectReason) { <div class="ex-reject">❌ {{ ex.rejectReason }}</div> }

                @if (ex.status === 'PENDING_CHEF') {
                  <div class="ex-actions">
                    <button class="btn-validate-ex" (click)="validateExchange(ex.id)">✅ Valider</button>
                    <button class="btn-reject-ex" (click)="rejectExchange(ex.id)">❌ Refuser</button>
                  </div>
                }
              </div>
            }
            @if (!loadingExchanges() && exchanges().length === 0) {
              <div class="empty-state">
                <div style="font-size:40px">🔄</div>
                <p>Aucun échange de quart en cours</p>
              </div>
            }
          </div>
        }

        <!-- ── BILAN PRÉSENCES ── -->
        @if (activeTab() === 'bilan') {
          <div class="tab-section">
            <div class="section-header">
              <div>
                <div class="section-title">📊 Bilan des présences</div>
              </div>
              <div class="bilan-filters">
                <input class="factory-input filter-date" type="date" [(ngModel)]="bilanFrom"
                       (change)="loadBilan()" />
                <span>→</span>
                <input class="factory-input filter-date" type="date" [(ngModel)]="bilanTo"
                       (change)="loadBilan()" />
              </div>
            </div>

            @if (bilanEnrichi()) {
              <!-- KPIs -->
              <div class="bilan-kpis">
                <div class="kpi-card">
                  <div class="kpi-val" style="color:var(--color-success)">{{ bilanEnrichi()!.totalPresents }}</div>
                  <div class="kpi-lbl">Présences</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-val" style="color:var(--color-danger)">{{ bilanEnrichi()!.totalAbsents }}</div>
                  <div class="kpi-lbl">Absences</div>
                </div>
                <div class="kpi-card">
                  <div class="kpi-val" style="color:var(--factory-primary)">{{ bilanEnrichi()!.tauxPresence }}%</div>
                  <div class="kpi-lbl">Taux de présence</div>
                </div>
              </div>

              <!-- Toggle vue -->
              <div class="bilan-view-toggle">
                <button class="bvt-btn" [class.active]="bilanView() === 'quart'"
                        (click)="bilanView.set('quart')">📋 Par quart</button>
                <button class="bvt-btn" [class.active]="bilanView() === 'membre'"
                        (click)="bilanView.set('membre')">👤 Par membre</button>
              </div>

              <!-- Vue par quart -->
              @if (bilanView() === 'quart') {
                @for (quart of bilanEnrichi()!.parQuart; track quart.date + quart.equipeNom) {
                  <div class="quart-recap factory-card">
                    <div class="qr-header">
                      <div>
                        <div class="qr-date">{{ quart.date | date:'EEE dd MMM':'':'fr' }} · {{ quart.shiftName }}</div>
                        <div class="qr-equipe">{{ quart.equipeNom }}</div>
                      </div>
                      <div class="qr-score" [style.color]="tauxColor(quart.nbPresents / quart.nbTotal * 100)">
                        {{ quart.nbPresents }}/{{ quart.nbTotal }}
                        <span class="qr-pct">{{ (quart.nbPresents / quart.nbTotal * 100 | number:'1.0-0') }}%</span>
                      </div>
                    </div>

                    <div class="qr-lignes">
                      @for (ligne of quart.lignes; track ligne.membreId) {
                        <div class="qr-ligne" [class.absent]="ligne.present === false">
                          <span class="qr-status">{{ ligne.present ? '✓' : '✗' }}</span>
                          <span class="qr-name">{{ ligne.membreNom }}</span>
                          <span class="qr-poste">{{ ligne.posteNom }}</span>
                          @if (ligne.addedByChef) {
                            <span class="qr-chef-badge">+ chef</span>
                          }
                          @if (ligne.note5s !== null) {
                            <span class="qr-5s" [style.color]="scoreColor5s(ligne.note5s!)">
                              ⭐ {{ ligne.note5s }}/10
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
                @if (!bilanEnrichi()!.parQuart.length) {
                  <div class="loading-msg">Aucune présence enregistrée sur cette période</div>
                }
              }

              <!-- Vue par membre -->
              @if (bilanView() === 'membre') {
                <div class="bilan-table-wrap factory-card">
                  <table class="bilan-table">
                    <thead>
                      <tr>
                        <th>Membre</th>
                        <th>Poste</th>
                        <th>Équipe</th>
                        <th class="text-right">✓</th>
                        <th class="text-right">✗</th>
                        <th class="text-right">Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (ligne of bilanEnrichi()!.parMembre; track ligne.membreId) {
                        <tr>
                          <td class="td-name">{{ ligne.membreNom }}</td>
                          <td class="td-muted">{{ ligne.posteNom }}</td>
                          <td><span class="equipe-tag">{{ ligne.equipeNom }}</span></td>
                          <td class="text-right td-present">{{ ligne.presents }}</td>
                          <td class="text-right td-absent">{{ ligne.absents }}</td>
                          <td class="text-right">
                            <div class="taux-bar">
                              <div class="taux-fill" [style.width]="ligne.tauxPresence + '%'"
                                   [style.background]="tauxColor(ligne.tauxPresence)"></div>
                              <span class="taux-label">{{ ligne.tauxPresence }}%</span>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            } @else {
              <div class="loading-msg">Sélectionnez une période pour afficher le bilan</div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .rh { max-width: 900px; margin: 0 auto; }
    .rh-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 0; }
    .line-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; }

    /* Tabs */
    .rh-tabs { display: flex; gap: 6px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; }
    .rh-tab {
      padding: 9px 16px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted); cursor: pointer;
      font-size: 13px; font-weight: 500; white-space: nowrap;
    }
    .rh-tab.active { background: var(--factory-primary); color: #fff; border-color: transparent; font-weight: 700; }

    /* Section */
    .tab-section { }
    .section-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
    .section-title { font-size: 15px; font-weight: 700; }
    .section-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

    /* Planning */
    .week-nav { display: flex; align-items: center; gap: 8px; }
    .nav-btn { width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
    .week-label { font-size: 13px; font-weight: 600; min-width: 120px; text-align: center; }
    .btn-generate { padding: 8px 16px; border-radius: 8px; background: var(--factory-secondary); color: #fff; border: none; cursor: pointer; font-size: 13px; font-weight: 700; }
    .btn-generate:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-export { padding: 7px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card2); color: var(--text-muted); cursor: pointer; font-size: 12px; font-weight: 600; }
    .cycle-badge { font-size: 11px; color: var(--factory-secondary); background: var(--bg-card2); border: 1px solid var(--border); padding: 2px 10px; border-radius: 8px; display: inline-block; margin-top: 4px; }

    /* Formulaire génération */
    .gen-form { margin-bottom: 14px; }
    .gen-title { font-size: 14px; font-weight: 700; margin-bottom: 12px; }
    .gen-row { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
    .gen-row > div { flex: 1; min-width: 140px; }
    .gen-info { display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 4px; }
    .gen-days { font-size: 13px; font-weight: 700; color: var(--factory-primary); }
    .gen-ok { font-size: 12px; color: var(--color-success); margin-top: 3px; }
    .gen-err { font-size: 12px; color: var(--color-danger); margin-top: 3px; line-height: 1.4; }
    .gen-suggest { font-size: 11px; color: var(--text-muted); }

    /* Édition cellule planning */
    .editing .shift-cell, .editing .repos-cell { display: none; }
    .edit-cell { display: flex; flex-direction: column; gap: 4px; padding: 2px; }
    .edit-shift-select { font-size: 10px; padding: 3px 4px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text); width: 100%; }
    .edit-cell-actions { display: flex; gap: 3px; }
    .ec-btn { flex: 1; padding: 3px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 700; }
    .ec-btn.save { background: #00E5A022; color: var(--color-success); }
    .ec-btn.cancel { background: #FF4D6D22; color: var(--color-danger); }

    .planning-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
    .planning-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .planning-table th { background: var(--bg-card2); padding: 8px 6px; text-align: center; color: var(--text-muted); font-size: 11px; border-bottom: 1px solid var(--border); }
    .th-equipe { text-align: left; padding-left: 12px; min-width: 110px; }
    .th-day { min-width: 70px; }
    .th-day.today { color: var(--factory-primary); }
    .day-name { text-transform: capitalize; }
    .day-num { font-size: 14px; font-weight: 700; margin-top: 2px; }
    .today-num { color: var(--factory-primary); }

    .planning-table tbody tr:hover td { background: var(--bg-card2); }
    .td-equipe { padding: 8px 12px; font-weight: 600; display: flex; align-items: center; gap: 7px; }
    .equipe-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .td-cell { padding: 4px; text-align: center; border-bottom: 1px solid var(--border); }
    .td-cell.today-col { background: var(--factory-primary-bg, #1565C011); }
    .shift-cell { padding: 6px 4px; border-radius: 6px; cursor: pointer; transition: opacity 0.15s; display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .shift-cell:hover { opacity: 0.8; }
    .shift-short { font-weight: 700; font-size: 11px; }
    .lock-icon { font-size: 9px; }
    .repos-cell { color: var(--text-muted); font-size: 11px; font-weight: 700; padding: 6px 0; }
    .empty-cell { color: var(--border); font-size: 14px; }

    .legend { display: flex; gap: 16px; margin-top: 10px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); }
    .legend-dot { width: 12px; height: 12px; border-radius: 3px; }
    .legend-dot.repos { background: var(--bg-card2); border: 1px solid var(--border); }
    .legend-item.info { color: var(--color-info); }

    /* Présences */
    .sheet-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .sheet-title { font-size: 16px; font-weight: 700; }
    .sheet-meta { font-size: 12px; color: var(--text-muted); margin-top: 3px; text-transform: capitalize; }
    .badge-locked { padding: 4px 10px; background: #00E5A022; border: 1px solid #00E5A044; border-radius: 12px; color: var(--color-success); font-size: 12px; font-weight: 700; }

    .presence-list { display: flex; flex-direction: column; gap: 8px; }
    .presence-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .presence-row.absent { border-left: 3px solid var(--color-danger); }
    .pr-info { flex: 1; }
    .pr-name { font-size: 14px; font-weight: 600; }
    .pr-poste { font-size: 12px; color: var(--text-muted); }
    .pr-actions { display: flex; align-items: center; gap: 6px; }
    .badge-chef-added { font-size: 10px; background: #FFB70022; border: 1px solid #FFB70044; color: var(--color-warning); padding: 2px 6px; border-radius: 8px; }
    .btn-present, .btn-absent {
      padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border);
      background: none; color: var(--text-muted); cursor: pointer; font-size: 12px; font-weight: 600;
    }
    .btn-present.active { background: #00E5A022; border-color: #00E5A0; color: var(--color-success); }
    .btn-absent.active  { background: #FF4D6D22; border-color: #FF4D6D; color: var(--color-danger); }
    .btn-present:disabled, .btn-absent:disabled { opacity: 0.4; cursor: not-allowed; }
    .add-absent-section { margin-top: 8px; }
    .btn-add-absent { background: none; border: 1px dashed var(--border); border-radius: 8px; padding: 8px 16px; color: var(--text-muted); cursor: pointer; font-size: 12px; width: 100%; }
    .validate-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
    .presence-summary { font-size: 13px; color: var(--text-muted); }
    .back-to-planning { background: none; border: 1px solid var(--border); border-radius: 8px; padding: 8px 16px; color: var(--text-muted); cursor: pointer; font-size: 13px; margin-top: 12px; }

    /* Notation 5S */
    .notes5s-section { margin-top: 20px; padding-top: 16px; border-top: 2px solid var(--border); }
    .notes5s-title { display: flex; flex-direction: column; margin-bottom: 14px; }
    .notes5s-title > span:first-child { font-size: 15px; font-weight: 700; }
    .notes5s-subtitle { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    .note5s-card { margin-bottom: 10px; transition: border-color 0.2s; }
    .note5s-card.noted { border-color: var(--factory-secondary); }
    .n5s-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .n5s-name { font-size: 14px; font-weight: 700; }
    .n5s-poste { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .n5s-score { font-size: 28px; font-weight: 900; line-height: 1; }
    .n5s-max { font-size: 14px; color: var(--text-muted); font-weight: 400; }

    .n5s-slider-wrap { }
    .n5s-labels { display: flex; gap: 4px; }
    .n5s-dot {
      flex: 1; padding: 7px 2px; border-radius: 6px;
      border: 1px solid var(--border); background: var(--bg-card2);
      color: var(--text-muted); cursor: pointer; font-size: 12px; font-weight: 600;
      transition: all 0.15s;
    }
    .n5s-dot:hover { border-color: var(--factory-primary); color: var(--factory-primary); }
    .n5s-dot.active { color: #fff; border-color: transparent; font-weight: 800; }
    .n5s-scale-labels { display: flex; justify-content: space-between; margin-top: 4px; padding: 0 2px; }
    .n5s-scale-labels span { font-size: 9px; color: var(--text-muted); }

    .notes5s-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border); }
    .notes5s-summary { font-size: 13px; color: var(--text-muted); }

    /* Échanges */
    .exchange-card { margin-bottom: 10px; }
    .ex-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .ex-names { font-size: 14px; font-weight: 700; }
    .ex-dates { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .ex-status { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; }
    .status-pending_accept { background: #FFB70022; color: var(--color-warning); }
    .status-pending_chef   { background: #00C2FF22; color: var(--color-info); }
    .status-validated      { background: #00E5A022; color: var(--color-success); }
    .status-rejected       { background: #FF4D6D22; color: var(--color-danger); }
    .ex-note   { font-size: 12px; color: var(--text-muted); margin-top: 8px; }
    .ex-reject { font-size: 12px; color: var(--color-danger); margin-top: 8px; }
    .ex-actions { display: flex; gap: 8px; margin-top: 10px; }
    .btn-validate-ex { padding: 6px 14px; border-radius: 6px; background: #00E5A022; border: 1px solid #00E5A044; color: var(--color-success); cursor: pointer; font-size: 12px; font-weight: 700; }
    .btn-reject-ex   { padding: 6px 14px; border-radius: 6px; background: #FF4D6D22; border: 1px solid #FF4D6D44; color: var(--color-danger); cursor: pointer; font-size: 12px; font-weight: 700; }

    /* Bilan */
    .bilan-filters { display: flex; align-items: center; gap: 8px; }
    .filter-date { padding: 7px 10px !important; font-size: 12px !important; width: auto; }
    .bilan-kpis { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .kpi-card { flex: 1; min-width: 100px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; text-align: center; }
    .kpi-val { font-size: 28px; font-weight: 800; }
    .kpi-lbl { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

    .bilan-table-wrap { overflow-x: auto; }
    .bilan-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .bilan-table th { text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    .bilan-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
    .bilan-table tbody tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .td-name { font-weight: 600; }
    .td-muted { color: var(--text-muted); }
    .td-present { color: var(--color-success); font-weight: 700; }
    .td-absent  { color: var(--color-danger); font-weight: 700; }
    .equipe-tag { background: var(--bg-card2); border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; font-size: 11px; }
    .taux-bar { position: relative; background: var(--bg-card2); border-radius: 4px; height: 20px; min-width: 80px; overflow: hidden; }
    .taux-fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 4px; transition: width 0.3s; opacity: 0.4; }
    .taux-label { position: relative; font-size: 11px; font-weight: 700; padding: 2px 6px; }

    .loading-msg { text-align: center; color: var(--text-muted); padding: 24px; }
    .empty-state { text-align: center; color: var(--text-muted); padding: 40px 0; }

    /* Bilan toggle */
    .bilan-view-toggle { display: flex; gap: 6px; margin-bottom: 14px; }
    .bvt-btn { padding: 7px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card2); color: var(--text-muted); cursor: pointer; font-size: 13px; font-weight: 500; }
    .bvt-btn.active { background: var(--factory-primary); color: #fff; border-color: transparent; font-weight: 700; }

    /* Récap par quart */
    .quart-recap { margin-bottom: 10px; }
    .qr-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .qr-date { font-size: 13px; font-weight: 700; text-transform: capitalize; }
    .qr-equipe { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .qr-score { font-size: 22px; font-weight: 900; text-align: right; line-height: 1; }
    .qr-pct { font-size: 12px; display: block; color: var(--text-muted); font-weight: 400; text-align: right; }
    .qr-lignes { display: flex; flex-direction: column; gap: 4px; }
    .qr-ligne { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; background: var(--bg-card2); font-size: 13px; }
    .qr-ligne.absent { background: #FF4D6D08; border-left: 3px solid #FF4D6D44; }
    .qr-status { font-weight: 700; width: 16px; flex-shrink: 0; }
    .qr-ligne:not(.absent) .qr-status { color: var(--color-success); }
    .qr-ligne.absent .qr-status { color: var(--color-danger); }
    .qr-name { font-weight: 600; flex: 1; }
    .qr-poste { font-size: 11px; color: var(--text-muted); }
    .qr-chef-badge { font-size: 10px; background: #FFB70022; border: 1px solid #FFB70044; color: var(--color-warning); padding: 1px 5px; border-radius: 6px; }
    .qr-5s { font-size: 11px; font-weight: 700; }
  `]
})
export class RhComponent {
  rh       = inject(RhApiService);
  auth     = inject(AuthService);
  config   = inject(FactoryConfigService);
  http     = inject(HttpClient);
  printSvc = inject(PrintService);

  selectedLine     = signal<ProductionLine | null>(null);
  activeTab        = signal<RhTab>('planning');
  loadingPlanning  = signal(false);
  loadingExchanges = signal(false);
  generating       = signal(false);
  validating       = signal(false);
  submitting5s     = signal(false);
  showAddAbsent    = signal(false);

  // Planning enrichi
  showExportForm   = signal(false);
  showGenForm      = signal(false);
  exportingPlanning = signal(false);
  exportFrom = signal(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  exportTo   = signal(new Date().toISOString().split('T')[0]);
  cycleInfo        = signal<any | null>(null);
  editingEntryId   = signal<string | null>(null);
  editShiftId      = '';
  editIsRepos      = false;
  genFrom = signal(new Date().toISOString().split('T')[0]);
  genTo   = signal(new Date(new Date().setDate(new Date().getDate() + 27)).toISOString().split('T')[0]);

  genNbJours = computed(() => {
    if (!this.genFrom() || !this.genTo()) return 0;
    const d = new Date(this.genTo()).getTime() - new Date(this.genFrom()).getTime();
    return Math.round(d / 86400000) + 1;
  });
  genSuggestLow = computed(() => {
    const c = this.cycleInfo()?.cycleLength ?? 1;
    return Math.floor(this.genNbJours() / c) * c;
  });
  genSuggestHigh = computed(() => {
    const c = this.cycleInfo()?.cycleLength ?? 1;
    return (Math.floor(this.genNbJours() / c) + 1) * c;
  });
  canGenerate = computed(() => {
    const c = this.cycleInfo()?.cycleLength;
    return c && this.genNbJours() > 0 && this.genNbJours() % c === 0;
  });

  planningEntries  = signal<PlanningEntry[]>([]);
  activeSheet      = signal<PresenceSheet | null>(null);
  exchanges        = signal<ShiftExchange[]>([]);
  bilan            = signal<PresenceBilan | null>(null);
  bilanEnrichi     = signal<any | null>(null);
  bilanView        = signal<'quart' | 'membre'>('quart');

  presenceForm: Array<{ membreId: string; membreNom: string; posteNom: string; present: boolean | null; addedByChef: boolean; note: string; isMachineOp: boolean; note5s: number | null; note5sCommentaire: string }> = [];

  notes5sForm: Array<{ membreId: string; note: number | null; commentaire: string }> = [];

  // Opérateurs machine présents — calculé depuis presenceForm
  machineOperators = computed(() =>
    this.presenceForm.filter(p => p.isMachineOp && p.present === true)
  );

  notedCount = computed(() => this.notes5sForm.filter(n => n.note !== null).length);

  avgScore = computed(() => {
    const noted = this.notes5sForm.filter(n => n.note !== null);
    if (!noted.length) return 0;
    return Math.round(noted.reduce((acc, n) => acc + n.note!, 0) / noted.length * 10) / 10;
  });

  // Semaine courante
  weekStart = signal<Date>(this.getMonday(new Date()));

  bilanFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  bilanTo   = new Date().toISOString().split('T')[0];

  tabs = [
    { id: 'planning'  as RhTab, icon: '📅', label: 'Planning' },
    { id: 'presences' as RhTab, icon: '✅', label: 'Présences' },
    { id: 'echanges'  as RhTab, icon: '🔄', label: 'Échanges' },
    { id: 'bilan'     as RhTab, icon: '📊', label: 'Bilan' },
  ];

  weekDays = computed<string[]>(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(this.weekStart());
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  });

  weekLabel = computed(() => {
    const days = this.weekDays();
    const from = new Date(days[0]);
    const to   = new Date(days[6]);
    const fmt  = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    return `${fmt(from)} – ${fmt(to)}`;
  });

  shifts = this.config.shifts;

  planningGrid = computed(() => {
    const entries = this.planningEntries();
    const days = this.weekDays();
    const byEquipe = new Map<string, {
      equipeId: string; equipeNom: string; couleur: string;
      entries: (any | null)[]; membres: any[];
    }>();
    for (const e of entries) {
      if (!byEquipe.has(e.equipeId)) {
        byEquipe.set(e.equipeId, {
          equipeId: e.equipeId, equipeNom: e.equipeNom, couleur: e.equipeCouleur,
          entries: new Array(7).fill(null),
          membres: (e as any).membres ?? []
        });
      }
      const dateStr = typeof e.date === 'string' ? e.date : String(e.date);
      const idx = days.indexOf(dateStr);
      if (idx >= 0) byEquipe.get(e.equipeId)!.entries[idx] = e;
    }
    return Array.from(byEquipe.values());
  });

  presentsCount(): number { return this.presenceForm.filter(p => p.present === true).length; }
  absentsCount():  number { return this.presenceForm.filter(p => p.present === false).length; }
  allUndecided():  boolean { return this.presenceForm.every(p => p.present === null); }

  onLineSelected(line: ProductionLine) {
    this.selectedLine.set(line);
    this.loadPlanning();
    // Charger les infos du cycle pour validation
    this.http.get<any>(`${environment.apiUrl}/rh/lines/${line.id}/cycle-info`)
      .subscribe({ next: c => this.cycleInfo.set(c), error: () => this.cycleInfo.set(null) });
  }

  switchTab(tab: RhTab) {
    this.activeTab.set(tab);
    if (tab === 'echanges') this.loadExchanges();
    if (tab === 'bilan')    this.loadBilan();
  }

  // ── Planning ─────────────────────────────────────────────
  loadPlanning() {
    const line = this.selectedLine();
    if (!line) return;
    this.loadingPlanning.set(true);

    // Calculer les jours directement depuis weekStart (évite le décalage signal)
    const ws = this.weekStart();
    const from = new Date(ws);
    const to = new Date(ws);
    to.setDate(to.getDate() + 6);
    const fromStr = from.toISOString().split('T')[0];
    const toStr   = to.toISOString().split('T')[0];

    this.http.get<any[]>(
      `${environment.apiUrl}/rh/lines/${line.id}/planning`,
      { params: { from: fromStr, to: toStr } }
    ).subscribe({
      next: e => { this.planningEntries.set(e); this.loadingPlanning.set(false); },
      error: () => this.loadingPlanning.set(false)
    });
  }

  generatePlanning() {
    const line = this.selectedLine();
    if (!line || !this.canGenerate()) return;
    this.generating.set(true);
    this.http.post<any[]>(
      `${environment.apiUrl}/rh/lines/${line.id}/planning/generate`,
      { from: this.genFrom(), to: this.genTo() }
    ).subscribe({
      next: entries => {
        // Synchroniser la vue sur le début de la période générée
        this.weekStart.set(this.getMonday(new Date(this.genFrom())));
        this.planningEntries.set(entries);
        this.generating.set(false);
        this.showGenForm.set(false);
        // Recharger la semaine visible
        this.loadPlanning();
      },
      error: (err) => {
        alert(err.error?.message ?? 'Erreur lors de la génération');
        this.generating.set(false);
      }
    });
  }

  startEditEntry(entry: any) {
    if (entry.locked) return;
    this.editingEntryId.set(entry.id);
    this.editShiftId = entry.shiftConfigId ?? '';
    this.editIsRepos = entry.isRepos ?? false;
  }

  saveEntryEdit(entryId: string) {
    const isRepos = !this.editShiftId;
    this.http.patch<any>(
      `${environment.apiUrl}/rh/planning/${entryId}`,
      { shiftConfigId: this.editShiftId || null, isRepos }
    ).subscribe({
      next: updated => {
        // Mettre à jour dans planningEntries
        this.planningEntries.update(list =>
          list.map(e => e.id === entryId ? { ...e, ...updated } : e)
        );
        this.editingEntryId.set(null);
      },
      error: () => this.editingEntryId.set(null)
    });
  }

  exportPlanningExcel() {
    const line = this.selectedLine();
    if (!line) return;
    this.exportingPlanning.set(true);

    this.http.get<any[]>(
      `${environment.apiUrl}/rh/lines/${line.id}/planning`,
      { params: { from: this.exportFrom(), to: this.exportTo() } }
    ).subscribe({
      next: entries => {
        this.exportingPlanning.set(false);
        this.showExportForm.set(false);
        this.buildExcelFromEntries(entries, line);
      },
      error: () => this.exportingPlanning.set(false)
    });
  }

  private buildExcelFromEntries(entries: any[], line: any) {
    // Calculer les jours de la période
    const from = new Date(this.exportFrom());
    const to   = new Date(this.exportTo());
    const days: string[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }

    // Grouper par équipe
    const byEquipe = new Map<string, { nom: string; couleur: string; entries: Map<string, any>; membres: any[] }>();
    for (const e of entries) {
      if (!byEquipe.has(e.equipeId)) {
        byEquipe.set(e.equipeId, { nom: e.equipeNom, couleur: e.equipeCouleur,
          entries: new Map(), membres: e.membres ?? [] });
      }
      byEquipe.get(e.equipeId)!.entries.set(e.date, e);
    }

    import('xlsx').then(XLSX => {
      const rows: any[][] = [];
      const header = ['Équipe / Membre', 'Poste',
        ...days.map(d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }))
      ];
      rows.push(header);

      byEquipe.forEach(eq => {
        // Ligne équipe
        rows.push([eq.nom, '', ...days.map(d => {
          const e = eq.entries.get(d);
          return e ? (e.isRepos ? 'Repos' : e.shiftShortName || e.shiftName || '') : '—';
        })]);
        // Membres
        (eq.membres ?? []).forEach((m: any) => {
          rows.push([`  ${m.nom}`, m.posteNom, ...days.map(() => '')]);
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 25 }, { wch: 15 }, ...days.map(() => ({ wch: 11 }))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Planning');
      XLSX.writeFile(wb, `planning-${line.name}-${this.exportFrom()}-${this.exportTo()}.xlsx`);
    });
  }

  exportPlanningPdf() {
    const line = this.selectedLine();
    if (!line) return;
    this.exportingPlanning.set(true);

    this.http.get<any[]>(
      `${environment.apiUrl}/rh/lines/${line.id}/planning`,
      { params: { from: this.exportFrom(), to: this.exportTo() } }
    ).subscribe({
      next: entries => {
        this.exportingPlanning.set(false);
        this.showExportForm.set(false);
        this.buildPdfFromEntries(entries, line);
      },
      error: () => this.exportingPlanning.set(false)
    });
  }

  private buildPdfFromEntries(entries: any[], line: any) {
    const factory = this.config.factory();
    const from = new Date(this.exportFrom());
    const to   = new Date(this.exportTo());
    const days: string[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split('T')[0]);
    }

    const byEquipe = new Map<string, { nom: string; couleur: string; entries: Map<string, any>; membres: any[] }>();
    for (const e of entries) {
      if (!byEquipe.has(e.equipeId)) {
        byEquipe.set(e.equipeId, { nom: e.equipeNom, couleur: e.equipeCouleur,
          entries: new Map(), membres: e.membres ?? [] });
      }
      byEquipe.get(e.equipeId)!.entries.set(e.date, e);
    }

    const thead = `<tr>
      <th>Équipe / Membre</th>
      ${days.map(d => `<th style="font-size:9px;">${new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</th>`).join('')}
    </tr>`;

    const tbody: string[] = [];
    byEquipe.forEach(eq => {
      tbody.push(`<tr style="background:#e8eeff;font-weight:700;">
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${eq.couleur};margin-right:6px;"></span>${eq.nom}</td>
        ${days.map(d => {
          const e = eq.entries.get(d);
          const val = e ? (e.isRepos ? '🛌' : e.shiftShortName || e.shiftName || '') : '—';
          const color = e && !e.isRepos ? eq.couleur : '#999';
          return `<td style="text-align:center;color:${color};font-size:10px;">${val}</td>`;
        }).join('')}
      </tr>`);
      (eq.membres ?? []).forEach((m: any) => {
        tbody.push(`<tr style="background:#f9f9ff;">
          <td style="padding-left:14px;font-size:9px;color:#555;">${m.nom} <em>(${m.posteNom})</em></td>
          ${days.map(() => '<td></td>').join('')}
        </tr>`);
      });
    });

    const fromLabel = new Date(this.exportFrom()).toLocaleDateString('fr-FR');
    const toLabel   = new Date(this.exportTo()).toLocaleDateString('fr-FR');

    const html = `
      <div class="print-header">
        <div>
          <div class="print-title">${factory?.appTitle ?? 'Factory Diagnostic'}</div>
          <div class="print-subtitle">Planning — ${line.name}</div>
        </div>
        <div class="print-meta">
          Période : ${fromLabel} → ${toLabel}<br>
          Imprimé le : ${new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>
      <table><thead>${thead}</thead><tbody>${tbody.join('')}</tbody></table>
      <div class="print-footer">
        <span>${factory?.appTitle ?? ''} — Confidentiel</span>
        <span>${fromLabel} → ${toLabel}</span>
      </div>`;

    this.printSvc.print(`Planning ${line.name}`, html, true);
  }

  prevWeek() { this.weekStart.update(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; }); this.loadPlanning(); }
  nextWeek() { this.weekStart.update(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; }); this.loadPlanning(); }

  isToday(dateStr: string): boolean {
    return dateStr === new Date().toISOString().split('T')[0];
  }

  // ── Présences ─────────────────────────────────────────────
  openPresenceSheet(entry: PlanningEntry) {
    this.rh.getPresenceSheet(entry.id).subscribe(sheet => {
      this.activeSheet.set(sheet);
      this.presenceForm = sheet.lignes.map((l: any) => ({
        membreId: l.membreId, membreNom: l.membreNom, posteNom: l.posteNom,
        present: l.present, addedByChef: l.addedByChef, note: l.note ?? '',
        isMachineOp: l.isMachineOp ?? false,
        note5s: l.note5s ?? null, note5sCommentaire: l.note5sCommentaire ?? ''
      }));
      // Pré-remplir le formulaire 5S avec les notes déjà enregistrées si la feuille est verrouillée
      this.notes5sForm = this.presenceForm
        .filter(p => p.isMachineOp && p.present === true)
        .map(p => ({ membreId: p.membreId, note: p.note5s, commentaire: p.note5sCommentaire }));
      this.activeTab.set('presences');
    });
  }

  setPresence(i: number, val: boolean) { this.presenceForm[i].present = val; }

  validatePresences() {
    const sheet = this.activeSheet();
    const chefId = this.auth.user()?.id;
    if (!sheet || !chefId) return;
    this.validating.set(true);
    this.rh.validatePresences(sheet.planningEntryId, chefId, this.presenceForm.map(p => ({
      membreId: p.membreId, present: p.present ?? false,
      addedByChef: p.addedByChef, note: p.note || undefined
    }))).subscribe({
      next: () => {
        this.validating.set(false);
        this.activeSheet.update(s => s ? { ...s, locked: true } : s);
        // Initialiser le formulaire 5S avec les opérateurs machine présents
        this.notes5sForm = this.presenceForm
          .filter(p => p.isMachineOp && p.present === true)
          .map(p => ({ membreId: p.membreId, note: null, commentaire: '' }));
        this.loadPlanning();
      },
      error: () => this.validating.set(false)
    });
  }

  submit5sNotes() {
    const sheet = this.activeSheet();
    if (!sheet) return;
    const noted = this.notes5sForm.filter(n => n.note !== null);
    if (!noted.length) return;
    this.submitting5s.set(true);
    this.rh.submit5sNotes(sheet.planningEntryId, noted.map(n => ({
      membreId: n.membreId, note5s: n.note!, commentaire: n.commentaire || undefined
    }))).subscribe({
      next: () => { this.submitting5s.set(false); },
      error: () => this.submitting5s.set(false)
    });
  }

  scoreColor(score: number): string {
    if (score >= 8) return '#00C47A';   // vert
    if (score >= 5) return '#FFB700';   // orange
    return '#FF4D6D';                   // rouge
  }

  // ── Échanges ─────────────────────────────────────────────
  loadExchanges() {
    // Pour l'instant on filtre les échanges PENDING_CHEF de la ligne
    this.loadingExchanges.set(true);
    // TODO: endpoint filtré par ligne
    this.loadingExchanges.set(false);
  }

  validateExchange(id: string) {
    const chefId = this.auth.user()?.id;
    if (!chefId) return;
    this.rh.validateExchange(id, chefId).subscribe({
      next: updated => this.exchanges.update(list => list.map(e => e.id === id ? updated : e)),
      error: () => {}
    });
  }

  rejectExchange(id: string) {
    const reason = prompt('Raison du refus (optionnel):') ?? '';
    this.rh.rejectExchange(id, reason).subscribe({
      next: updated => this.exchanges.update(list => list.map(e => e.id === id ? updated : e)),
      error: () => {}
    });
  }

  // ── Bilan ────────────────────────────────────────────────
  loadBilan() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.http.get<any>(
      `${environment.apiUrl}/rh/factories/${factoryId}/presences/recap`,
      { params: { from: this.bilanFrom, to: this.bilanTo } }
    ).subscribe({
      next: b => this.bilanEnrichi.set(b),
      error: () => {}
    });
  }

  scoreColor5s(score: number): string {
    if (score >= 8) return '#00C47A';
    if (score >= 5) return '#FFB700';
    return '#FF4D6D';
  }

  tauxColor(taux: number): string {
    if (taux >= 90) return '#00E5A0';
    if (taux >= 70) return '#FFB700';
    return '#FF4D6D';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING_ACCEPT: '⏳ En attente',
      PENDING_CHEF: '👨‍💼 Validation chef',
      VALIDATED: '✅ Validé',
      REJECTED: '❌ Refusé'
    };
    return labels[status] ?? status;
  }

  private getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }
}