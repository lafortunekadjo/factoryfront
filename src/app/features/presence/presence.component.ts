import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-presence',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  template: `
    <div class="presence animate-in">

      <div class="pres-header">
        <h2 class="page-title">✅ Présences</h2>
        <div class="period-filters">
          <input class="factory-input date-input" type="date" [(ngModel)]="filterFrom" (change)="load()" />
          <span class="period-sep">→</span>
          <input class="factory-input date-input" type="date" [(ngModel)]="filterTo" (change)="load()" />
        </div>
      </div>

      @if (loading()) {
        <div class="center-msg">⏳ Chargement...</div>
      } @else if (!recap()) {
        <div class="empty-state">
          <div style="font-size:40px">📋</div>
          <p>Aucune présence enregistrée sur cette période</p>
        </div>
      } @else {

        <!-- ─ KPIs ─ -->
        <div class="kpis-row">
          <div class="kpi">
            <div class="kpi-val green">{{ recap()!.totalPresents }}</div>
            <div class="kpi-lbl">Présences</div>
          </div>
          <div class="kpi">
            <div class="kpi-val red">{{ recap()!.totalAbsents }}</div>
            <div class="kpi-lbl">Absences</div>
          </div>
          <div class="kpi">
            <div class="kpi-val" [style.color]="tauxColor(recap()!.tauxPresence)">
              {{ recap()!.tauxPresence }}%
            </div>
            <div class="kpi-lbl">Taux</div>
          </div>
          @if (avg5sGlobal() !== null) {
            <div class="kpi">
              <div class="kpi-val" [style.color]="score5sColor(avg5sGlobal()!)">
                {{ avg5sGlobal() }}/10
              </div>
              <div class="kpi-lbl">Moy. 5S</div>
            </div>
          }
        </div>

        <!-- ─ Tabs ─ -->
        <div class="tabs">
          <button class="tab-btn" [class.active]="tab() === 'quarts'" (click)="tab.set('quarts')">
            📋 Par quart
          </button>
          <button class="tab-btn" [class.active]="tab() === 'membres'" (click)="tab.set('membres')">
            👤 Par membre
          </button>
        </div>

        <!-- ════ VUE PAR QUART ════ -->
        @if (tab() === 'quarts') {
          @if (!recap()!.parQuart.length) {
            <div class="empty-state"><p>Aucun quart avec présences sur cette période</p></div>
          }
          @for (q of recap()!.parQuart; track q.date + q.equipeNom) {
            <div class="quart-block factory-card"
                 [class.expanded]="expandedQuart() === q.date + q.equipeNom"
                 (click)="toggleQuart(q.date + q.equipeNom)">

              <!-- En-tête quart — toujours visible -->
              <div class="qb-header">
                <div class="qb-left">
                  <div class="qb-date">
                    {{ q.date | date:'EEE dd MMM':'':'fr' }}
                    <span class="qb-shift">· {{ q.shiftName }}</span>
                  </div>
                  <div class="qb-equipe">{{ q.equipeNom }}</div>
                </div>

                <div class="qb-right">
                  <!-- Score présences -->
                  <div class="pres-score">
                    <span class="score-n" [style.color]="tauxColor(q.nbPresents / q.nbTotal * 100)">
                      {{ q.nbPresents }}
                    </span>
                    <span class="score-d">/{{ q.nbTotal }}</span>
                  </div>

                  <!-- Moyenne 5S du quart -->
                  @if (quart5sAvg(q) !== null) {
                    <div class="avg5s-badge" [style.background]="score5sColor(quart5sAvg(q)!) + '22'"
                         [style.color]="score5sColor(quart5sAvg(q)!)">
                      ⭐ {{ quart5sAvg(q) }}/10
                    </div>
                  }

                  <span class="expand-arrow">{{ expandedQuart() === q.date + q.equipeNom ? '▲' : '▼' }}</span>
                </div>
              </div>

              <!-- Détail membres — visible quand expandé -->
              @if (expandedQuart() === q.date + q.equipeNom) {
                <div class="qb-detail" (click)="$event.stopPropagation()">
                  <table class="detail-table">
                    <thead>
                      <tr>
                        <th>Membre</th>
                        <th>Poste</th>
                        <th class="center">Statut</th>
                        <th class="center">Note 5S</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (m of q.lignes; track m.membreId) {
                        <tr [class.row-absent]="m.present === false">
                          <td class="td-name">{{ m.membreNom }}</td>
                          <td class="td-muted">{{ m.posteNom }}</td>
                          <td class="center">
                            @if (m.present === true) {
                              <span class="statut-badge present">✓ Présent</span>
                            } @else if (m.present === false) {
                              <span class="statut-badge absent">✗ Absent</span>
                            } @else {
                              <span class="statut-badge pending">? —</span>
                            }
                          </td>
                          <td class="center">
                            @if (m.present && m.isMachineOp) {
                              @if (m.note5s !== null && m.note5s !== undefined) {
                                <div class="note5s-display"
                                     [style.background]="score5sColor(m.note5s) + '22'"
                                     [style.color]="score5sColor(m.note5s)">
                                  <span class="note5s-val">{{ m.note5s }}</span>
                                  <span class="note5s-sur">/10</span>
                                  <div class="note5s-bar-wrap">
                                    <div class="note5s-bar"
                                         [style.width]="(m.note5s * 10) + '%'"
                                         [style.background]="score5sColor(m.note5s)">
                                    </div>
                                  </div>
                                </div>
                              } @else {
                                <span class="note5s-empty">—</span>
                              }
                            } @else if (!m.isMachineOp) {
                              <span class="td-muted" style="font-size:11px">N/A</span>
                            }
                          </td>
                          <td>
                            @if (m.addedByChef) {
                              <span class="badge-chef">+ chef</span>
                            }
                          </td>
                        </tr>
                        @if (m.note5sCommentaire) {
                          <tr class="row-comment">
                            <td colspan="5" class="td-comment">
                              💬 {{ m.note5sCommentaire }}
                            </td>
                          </tr>
                        }
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }
        }

        <!-- ════ VUE PAR MEMBRE ════ -->
        @if (tab() === 'membres') {
          <div class="factory-card table-card">
            <table class="membres-table">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Poste</th>
                  <th>Équipe</th>
                  <th class="center">✓</th>
                  <th class="center">✗</th>
                  <th>Taux</th>
                  <th class="center">Moy. 5S</th>
                </tr>
              </thead>
              <tbody>
                @for (m of recap()!.parMembre; track m.membreId) {
                  <tr>
                    <td class="td-name">{{ m.membreNom }}</td>
                    <td class="td-muted">{{ m.posteNom }}</td>
                    <td><span class="equipe-tag">{{ m.equipeNom }}</span></td>
                    <td class="center td-pres">{{ m.presents }}</td>
                    <td class="center td-abs">{{ m.absents }}</td>
                    <td>
                      <div class="taux-bar">
                        <div class="taux-fill" [style.width]="m.tauxPresence + '%'"
                             [style.background]="tauxColor(m.tauxPresence)"></div>
                        <span class="taux-lbl">{{ m.tauxPresence }}%</span>
                      </div>
                    </td>
                    <td class="center">
                      @if (m.moyenne5s !== null && m.moyenne5s !== undefined) {
                        <span class="note5s-membre"
                              [style.color]="score5sColor(m.moyenne5s)"
                              [style.background]="score5sColor(m.moyenne5s) + '18'">
                          ⭐ {{ m.moyenne5s }}/10
                        </span>
                      } @else {
                        <span class="td-muted">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .presence { max-width: 860px; margin: 0 auto; padding-bottom: 40px; }
    .pres-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
    .page-title { font-size: 18px; font-weight: 700; margin: 0; }
    .period-filters { display: flex; align-items: center; gap: 8px; }
    .date-input { padding: 7px 10px !important; font-size: 12px !important; width: auto; }
    .period-sep { color: var(--text-muted); font-size: 14px; }

    /* KPIs */
    .kpis-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .kpi { flex: 1; min-width: 80px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; text-align: center; }
    .kpi-val { font-size: 24px; font-weight: 900; }
    .kpi-val.green { color: var(--color-success); }
    .kpi-val.red   { color: var(--color-danger); }
    .kpi-lbl { font-size: 11px; color: var(--text-muted); margin-top: 3px; }

    /* Tabs */
    .tabs { display: flex; gap: 6px; margin-bottom: 14px; }
    .tab-btn { padding: 8px 18px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card2); color: var(--text-muted); cursor: pointer; font-size: 13px; font-weight: 500; }
    .tab-btn.active { background: var(--factory-primary); color: #fff; border-color: transparent; font-weight: 700; }

    /* Bloc quart cliquable */
    .quart-block { margin-bottom: 8px; cursor: pointer; transition: box-shadow 0.15s; }
    .quart-block:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    .quart-block.expanded { border-color: var(--factory-primary); }
    .qb-header { display: flex; justify-content: space-between; align-items: center; }
    .qb-left { flex: 1; }
    .qb-date { font-size: 14px; font-weight: 700; text-transform: capitalize; }
    .qb-shift { font-weight: 400; color: var(--text-muted); font-size: 13px; }
    .qb-equipe { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .qb-right { display: flex; align-items: center; gap: 10px; }
    .pres-score { font-size: 15px; font-weight: 600; }
    .score-n { font-size: 26px; font-weight: 900; }
    .score-d { color: var(--text-muted); }
    .avg5s-badge { padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 700; }
    .expand-arrow { color: var(--text-muted); font-size: 12px; }

    /* Tableau détail */
    .qb-detail { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px; }
    .detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .detail-table th { text-align: left; padding: 7px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    .detail-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); }
    .detail-table tbody tr:last-child td { border-bottom: none; }
    .row-absent td { opacity: 0.6; }
    .row-comment { background: var(--bg-card2); }
    .td-comment { font-size: 11px; color: var(--text-muted); padding: 5px 10px 8px 28px !important; font-style: italic; }

    .statut-badge { padding: 3px 9px; border-radius: 8px; font-size: 11px; font-weight: 700; }
    .statut-badge.present { background: #00E5A022; color: var(--color-success); }
    .statut-badge.absent  { background: #FF4D6D22; color: var(--color-danger); }
    .statut-badge.pending { background: var(--bg-card2); color: var(--text-muted); }

    .note5s-display { display: flex; align-items: center; gap: 5px; justify-content: center; padding: 4px 10px; border-radius: 8px; font-weight: 700; }
    .note5s-val { font-size: 18px; font-weight: 900; }
    .note5s-sur { font-size: 11px; opacity: 0.7; }
    .note5s-bar-wrap { width: 40px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
    .note5s-bar { height: 100%; border-radius: 2px; opacity: 0.7; }
    .note5s-empty { color: var(--text-muted); font-size: 13px; }

    .badge-chef { font-size: 10px; background: #FFB70022; border: 1px solid #FFB70044; color: var(--color-warning); padding: 1px 6px; border-radius: 6px; }

    /* Tableau par membre */
    .table-card { overflow-x: auto; }
    .membres-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .membres-table th { text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    .membres-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
    .membres-table tbody tr:last-child td { border-bottom: none; }
    .center { text-align: center; }
    .td-name { font-weight: 600; }
    .td-muted { color: var(--text-muted); font-size: 12px; }
    .td-pres { color: var(--color-success); font-weight: 700; }
    .td-abs  { color: var(--color-danger);  font-weight: 700; }
    .equipe-tag { background: var(--bg-card2); border: 1px solid var(--border); border-radius: 6px; padding: 2px 7px; font-size: 11px; }
    .taux-bar { position: relative; background: var(--bg-card2); border-radius: 4px; height: 20px; min-width: 80px; overflow: hidden; }
    .taux-fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 4px; opacity: 0.35; }
    .taux-lbl { position: relative; font-size: 11px; font-weight: 700; padding: 2px 6px; }
    .note5s-membre { padding: 3px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; }

    .center-msg, .empty-state { text-align: center; color: var(--text-muted); padding: 40px 0; }
    .empty-state p { margin-top: 8px; }
  `]
})
export class PresenceComponent implements OnInit {
  http = inject(HttpClient);
  auth = inject(AuthService);

  loading      = signal(false);
  recap        = signal<any | null>(null);
  tab          = signal<'quarts' | 'membres'>('quarts');
  expandedQuart = signal<string | null>(null);

  filterFrom = new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString().split('T')[0];
  filterTo = new Date().toISOString().split('T')[0];

  ngOnInit() { this.load(); }

  load() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.loading.set(true);
    this.expandedQuart.set(null);
    this.http.get<any>(
      `${environment.apiUrl}/rh/factories/${factoryId}/presences/recap`,
      { params: { from: this.filterFrom, to: this.filterTo } }
    ).subscribe({
      next: r => {
        this.recap.set(r.totalPresents + r.totalAbsents > 0 ? r : null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleQuart(key: string) {
    this.expandedQuart.set(this.expandedQuart() === key ? null : key);
  }

  // Moyenne 5S d'un quart (sur les lignes notées)
  quart5sAvg(q: any): number | null {
    const notes = q.lignes
      .filter((l: any) => l.isMachineOp && l.present && l.note5s !== null && l.note5s !== undefined)
      .map((l: any) => l.note5s as number);
    if (!notes.length) return null;
    return Math.round(notes.reduce((a: number, b: number) => a + b, 0) / notes.length * 10) / 10;
  }

  // Moyenne 5S globale sur tous les quarts
  avg5sGlobal(): number | null {
    const r = this.recap();
    if (!r) return null;
    const all = r.parMembre
      .filter((m: any) => m.moyenne5s !== null && m.moyenne5s !== undefined)
      .map((m: any) => m.moyenne5s as number);
    if (!all.length) return null;
    return Math.round(all.reduce((a: number, b: number) => a + b, 0) / all.length * 10) / 10;
  }

  tauxColor(t: number): string {
    if (t >= 90) return '#00C47A';
    if (t >= 70) return '#FFB700';
    return '#FF4D6D';
  }

  score5sColor(s: number): string {
    if (s >= 8) return '#00C47A';
    if (s >= 5) return '#FFB700';
    return '#FF4D6D';
  }
}
