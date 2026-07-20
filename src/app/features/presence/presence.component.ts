import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { PrintService } from '../../core/services/print.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-presence',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  template: `
    <div class="presence animate-in">

      <div class="pres-header">
        <h2 class="page-title">✅ Présences</h2>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <div class="period-filters">
            <input class="factory-input date-input" type="date" [(ngModel)]="filterFrom" (change)="load()" />
            <span class="period-sep">→</span>
            <input class="factory-input date-input" type="date" [(ngModel)]="filterTo" (change)="load()" />
          </div>
          @if (recap()) {
            <button class="btn-print-pres" (click)="printRecap()">🖨️ Imprimer</button>
          }
          <button class="btn-export-pointage" [disabled]="exportingPointage()"
                  (click)="exportPointageExcel()">
            {{ exportingPointage() ? '⏳...' : '📥 Pointage Excel' }}
          </button>
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
    .btn-print-pres { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card2); color: var(--text-muted); cursor: pointer; font-size: 13px; font-weight: 600; }
    .btn-export-pointage { padding: 7px 14px; border-radius: 8px; border: 1px solid #00875A44; background: #00875A11; color: #00875A; cursor: pointer; font-size: 13px; font-weight: 600; }
    .btn-export-pointage:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class PresenceComponent implements OnInit {
  http = inject(HttpClient);
  auth = inject(AuthService);

  loading          = signal(false);
  exportingPointage = signal(false);
  recap            = signal<any | null>(null);
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

  printSvc = inject(PrintService);

  printRecap() {
    const r = this.recap();
    if (!r) return;
    const factory = this.auth.currentFactory();
    const from = new Date(this.filterFrom).toLocaleDateString('fr-FR');
    const to   = new Date(this.filterTo).toLocaleDateString('fr-FR');

    const quartsHtml = r.parQuart.map((q: any) => {
      const lignesHtml = q.lignes.map((l: any) => `
        <tr>
          <td>${l.membreNom}</td><td>${l.posteNom}</td>
          <td><span class="badge badge-${l.present ? 'present' : 'absent'}">${l.present ? '✓' : '✗'}</span></td>
          <td>${l.note5s !== null && l.note5s !== undefined ? l.note5s + '/10' : l.isMachineOp ? '—' : 'N/A'}</td>
        </tr>`).join('');
      return `
        <tr style="background:#e8eeff;">
          <td colspan="4" style="font-weight:700;padding:8px;">
            📅 ${q.date} · ${q.shiftName} · ${q.equipeNom} — ${q.nbPresents}/${q.nbTotal} présents
          </td>
        </tr>${lignesHtml}`;
    }).join('');

    const membresHtml = r.parMembre.map((m: any) => `
      <tr>
        <td>${m.membreNom}</td><td>${m.posteNom}</td><td>${m.equipeNom}</td>
        <td style="text-align:center;font-weight:700;color:green;">${m.presents}</td>
        <td style="text-align:center;font-weight:700;color:red;">${m.absents}</td>
        <td style="text-align:center;">${m.tauxPresence}%</td>
        <td style="text-align:center;">${m.moyenne5s ?? '—'}</td>
      </tr>`).join('');

    const html = `
      <div class="print-header">
        <div>
          <div class="print-title">${factory?.name ?? 'Factory Diagnostic'}</div>
          <div class="print-subtitle">Récapitulatif des Présences</div>
        </div>
        <div class="print-meta">Période : ${from} → ${to}<br>Imprimé le : ${new Date().toLocaleDateString('fr-FR')}</div>
      </div>
      <div class="kpi-row">
        <div class="kpi-box"><div class="kpi-val" style="color:green;">${r.totalPresents}</div><div class="kpi-lbl">Présences</div></div>
        <div class="kpi-box"><div class="kpi-val" style="color:red;">${r.totalAbsents}</div><div class="kpi-lbl">Absences</div></div>
        <div class="kpi-box"><div class="kpi-val" style="color:#1565C0;">${r.tauxPresence}%</div><div class="kpi-lbl">Taux</div></div>
      </div>
      <div class="section">
        <div class="section-title">Détail par quart</div>
        <table><thead><tr><th>Membre</th><th>Poste</th><th>Statut</th><th>Note 5S</th></tr></thead>
        <tbody>${quartsHtml}</tbody></table>
      </div>
      <div class="section" style="margin-top:16px;">
        <div class="section-title">Récapitulatif par membre</div>
        <table><thead><tr><th>Membre</th><th>Poste</th><th>Équipe</th><th>✓</th><th>✗</th><th>Taux</th><th>Moy.5S</th></tr></thead>
        <tbody>${membresHtml}</tbody></table>
      </div>
      <div class="print-footer">
        <span>${factory?.name ?? ''} — Document généré automatiquement</span>
        <span>Période : ${from} → ${to}</span>
      </div>`;

    this.printSvc.print(`Récap Présences ${from}-${to}`, html, true);
  }

  exportPointageExcel() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.exportingPointage.set(true);

    // Appeler l'endpoint backend qui génère le fichier via Python/openpyxl
    this.http.get(
      `${environment.apiUrl}/rh/factories/${factoryId}/presences/pointage/export`,
      {
        params: { from: this.filterFrom, to: this.filterTo },
        responseType: 'blob'
      }
    ).subscribe({
      next: (blob: Blob) => {
        this.exportingPointage.set(false);
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `pointage-${this.filterFrom}_${this.filterTo}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        // Fallback : générer côté frontend si le backend Python n'est pas dispo
        this.exportingPointage.set(false);
        this.http.get<any>(
          `${environment.apiUrl}/rh/factories/${factoryId}/presences/pointage`,
          { params: { from: this.filterFrom, to: this.filterTo } }
        ).subscribe({
          next: data => this.buildPointageExcel(data),
          error: () => {}
        });
      }
    });
  }

  private buildPointageExcel(data: any) {
    import('xlsx').then(XLSX => {
      const jours: string[] = data.jours ?? [];
      const membres: any[]  = data.membres ?? [];
      const factory = this.auth.currentFactory();
      const fromFr  = new Date(data.from).toLocaleDateString('fr-FR');
      const toFr    = new Date(data.to).toLocaleDateString('fr-FR');

      const wb = XLSX.utils.book_new();

      // ── Onglet par semaine (ou unique si < 7 jours) ──────────────────────
      // Regrouper les jours par semaine (lundi→dimanche)
      const semaines = this.groupBySemaine(jours);

      semaines.forEach((semaineJours, sIdx) => {
        const joursFr = semaineJours.map(d =>
          new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
        );
        const joursNoms = semaineJours.map(d =>
          new Date(d).toLocaleDateString('fr-FR', { weekday: 'long' })
        );

        const rows: any[][] = [];

        // ── Ligne titre usine ──────────────────────────────────────────────
        rows.push([factory?.appTitle ?? factory?.name ?? 'Factory Diagnostic']);
        rows.push([]);

        // ── Ligne mois + semaine ───────────────────────────────────────────
        const semFrom = new Date(semaineJours[0]).toLocaleDateString('fr-FR');
        const semTo   = new Date(semaineJours[semaineJours.length - 1]).toLocaleDateString('fr-FR');
        rows.push(['', '', '', '', '', '', '', '', 'Mois', '',
          new Date(semaineJours[0]).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          '', '', '', 'Semaine :', '', '', '',
          `Du ${semFrom} au ${semTo}`]);
        rows.push([]);

        // ── En-tête colonnes ───────────────────────────────────────────────
        // MAT. | NOM | POSTE | ÉQUIPE | [jour N, A] x7 | PRÉSENTS | ABSENTS | TAUX
        const headerRow1 = ['MAT.', 'NOM ET PRÉNOM', 'POSTE', 'ÉQUIPE'];
        const headerRow2 = ['', '', '', ''];
        joursNoms.forEach(j => {
          headerRow1.push(j.toUpperCase(), '');
          headerRow2.push('P', 'A');
        });
        headerRow1.push('Jours\nprésents', 'Jours\nabsents', 'Taux\nprésence', 'Observations');
        headerRow2.push('', '', '', '');
        rows.push(headerRow1);
        rows.push(joursFr.reduce((acc: string[], d) => [...acc, d, ''], ['', '', '', ''])
          .concat(['', '', '', '']));
        rows.push(headerRow2);

        // ── Lignes membres ─────────────────────────────────────────────────
        let presParJour = new Array(semaineJours.length).fill(0);

        membres.forEach((m: any, idx: number) => {
          const row: any[] = [
            String(idx + 1).padStart(3, '0'),
            m.nom,
            m.posteNom,
            m.equipeNom
          ];

          let presCount = 0;
          let absCount  = 0;

          semaineJours.forEach((d, ji) => {
            const jourData = (m.jours ?? []).find((j: any) => j.date === d);
            const present  = jourData?.present;
            if (present === true) {
              row.push('P', '');
              presCount++;
              presParJour[ji]++;
            } else if (present === false) {
              row.push('', 'A');
              absCount++;
            } else {
              row.push('', '');  // pas de données (hors période planning)
            }
          });

          row.push(presCount, absCount, `${m.tauxPresence}%`, '');
          rows.push(row);
        });

        // ── Ligne totaux ───────────────────────────────────────────────────
        const totalRow: any[] = ['', 'TOTAUX', '', ''];
        presParJour.forEach(p => totalRow.push(p, ''));
        totalRow.push(
          membres.reduce((s: number, m: any) => s + m.totalPresents, 0),
          membres.reduce((s: number, m: any) => s + m.totalAbsents, 0),
          '', ''
        );
        rows.push([]);
        rows.push(totalRow);

        // ── Ligne effectif présent ─────────────────────────────────────────
        const effRow: any[] = ['', 'Effectif présent :', '', ''];
        presParJour.forEach(p => effRow.push(p, ''));
        rows.push(effRow);

        rows.push([]);

        // ── Légende ───────────────────────────────────────────────────────
        rows.push([
          'P : Présent', '', 'A : Absent', '', 'R : Récupération', '',
          'CP : Congés payés', '', 'M : Maladie', '', 'HS : Heure Supplémentaire'
        ]);
        rows.push([]);
        rows.push(['Visa Chef d\'Atelier', '', '', '', 'Visa Chef Département',
                   '', '', '', 'Visa Directeur Technique']);

        // ── Créer le worksheet ────────────────────────────────────────────
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Largeurs colonnes
        const ncols = 4 + semaineJours.length * 2 + 4;
        const colWidths: any[] = [
          { wch: 5 },  // MAT
          { wch: 26 }, // NOM
          { wch: 16 }, // POSTE
          { wch: 14 }, // ÉQUIPE
          ...semaineJours.flatMap(() => [{ wch: 4 }, { wch: 4 }]),
          { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 18 }
        ];
        ws['!cols'] = colWidths;

        const tabLabel = semFrom.replace(/\//g, '-');
        XLSX.utils.book_append_sheet(wb, ws, tabLabel.substring(0, 31));
      });

      // ── Onglet récapitulatif ──────────────────────────────────────────────
      const recapRows: any[][] = [];
      recapRows.push([factory?.appTitle ?? 'Factory Diagnostic',
                      `Récapitulatif présences du ${fromFr} au ${toFr}`]);
      recapRows.push([]);
      recapRows.push(['N°', 'NOM ET PRÉNOM', 'POSTE', 'ÉQUIPE',
                      'Jours présents', 'Jours absents', 'Taux présence', 'Note 5S moy.']);

      membres.forEach((m: any, i: number) => {
        recapRows.push([
          i + 1, m.nom, m.posteNom, m.equipeNom,
          m.totalPresents, m.totalAbsents,
          `${m.tauxPresence}%`,
          m.moyenne5s ?? ''
        ]);
      });
      recapRows.push([]);
      recapRows.push(['', 'TOTAL', '', '',
        membres.reduce((s: number, m: any) => s + m.totalPresents, 0),
        membres.reduce((s: number, m: any) => s + m.totalAbsents, 0),
        '', '']);

      const wsRecap = XLSX.utils.aoa_to_sheet(recapRows);
      wsRecap['!cols'] = [
        { wch: 4 }, { wch: 26 }, { wch: 16 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
      ];
      XLSX.utils.book_append_sheet(wb, wsRecap, 'Récapitulatif');

      const filename = `pointage-${fromFr.replace(/\//g,'-')}_${toFr.replace(/\//g,'-')}.xlsx`;
      XLSX.writeFile(wb, filename);
    });
  }

  private groupBySemaine(jours: string[]): string[][] {
    if (!jours.length) return [];
    const semaines: string[][] = [];
    let semaine: string[] = [];
    jours.forEach(d => {
      semaine.push(d);
      const dow = new Date(d).getDay(); // 0=dim, 6=sam
      if (dow === 0 || semaine.length === 7) { // fin de semaine le dimanche
        semaines.push(semaine);
        semaine = [];
      }
    });
    if (semaine.length) semaines.push(semaine); // reste
    return semaines;
  }
}