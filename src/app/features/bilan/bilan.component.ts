import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { environment } from '../../../environments/environment';

type BilanTab = 'production' | 'pannes' | 'export';

interface ProductionReport {
  from: string; to: string;
  totalBottles: number; totalPacks: number; totalPallets: number;
  totalDowntimeMinutes: number; runningMinutes: number;
  totalPreformeLost: number; efficiency: number; totalQuarts: number;
  byProduct: {productName:string; totalBottles:number; totalPacks:number; pct:number}[];
  byTeam:    {teamLeaderName:string; totalBottles:number; totalPacks:number}[];
  dailyProduction: {date:string; bottles:number; packs:number; downtimeMinutes:number}[];
  stopBreakdown:   {label:string; totalMinutes:number; count:number; pct:number}[];
  lossBreakdown:   {cause:string; totalLost:number; pct:number}[];
  quartDetails:    any[];
  availableTeamLeaders: {id:string; fullName:string}[];
}

interface MaintenanceReport {
  total:number; resolved:number; pending:number;
  critique:number; totalDurationMinutes:number;
  bySeverity: Record<string,number>;
  byType:     Record<string,number>;
  byMachine:  {machineName:string; count:number; totalDurationMinutes:number}[];
  details:    any[];
}

@Component({
  selector: 'app-bilan',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  template: `
    <div class="bilan animate-in">
      <h2 class="page-title">📊 Bilan de Production</h2>

      <!-- Filtres globaux -->
      <div class="filters-bar factory-card">
        <div class="filter-grid">
          <div>
            <label class="factory-label">Du</label>
            <input class="factory-input" type="date" [(ngModel)]="filters.from" />
          </div>
          <div>
            <label class="factory-label">Au</label>
            <input class="factory-input" type="date" [(ngModel)]="filters.to" />
          </div>
          <div>
            <label class="factory-label">Ligne</label>
            <select class="factory-input" [(ngModel)]="filters.lineId">
              <option value="">Toutes les lignes</option>
              @for (l of lines(); track l.id) {
                <option [value]="l.id">{{ l.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="factory-label">Équipe / Chef</label>
            <select class="factory-input" [(ngModel)]="filters.teamLeaderId">
              <option value="">Toutes les équipes</option>
              @for (tl of teamLeaders(); track tl.id) {
                <option [value]="tl.id">{{ tl.fullName }}</option>
              }
            </select>
          </div>
        </div>
        <button class="btn-apply" (click)="loadAll()" [disabled]="loading()">
          @if (loading()) { ⏳ } @else { 🔍 }
          Actualiser
        </button>
      </div>

      <!-- Tabs -->
      <div class="bilan-tabs">
        <button class="bilan-tab" [class.active]="tab() === 'production'" (click)="tab.set('production')">
          📦 Production
        </button>
        <button class="bilan-tab" [class.active]="tab() === 'pannes'" (click)="tab.set('pannes')">
          🛠️ Pannes & Pertes
        </button>
        <button class="bilan-tab export-tab" [class.active]="tab() === 'export'" (click)="tab.set('export')">
          📄 Export PDF
        </button>
      </div>

      <!-- ── ONGLET PRODUCTION ── -->
      @if (tab() === 'production') {

        @if (loading()) { <div class="center-msg">⏳ Chargement...</div> }

        @if (prodReport()) {
          <!-- KPIs principaux -->
          <div class="kpi-grid">
            <div class="kpi-card" style="--kc: var(--color-info)">
              <div class="kc-icon">🍾</div>
              <div class="kc-val">{{ prodReport()!.totalBottles | number }}</div>
              <div class="kc-lbl">Bouteilles produites</div>
            </div>
            <div class="kpi-card" style="--kc: var(--factory-primary)">
              <div class="kc-icon">📦</div>
              <div class="kc-val">{{ prodReport()!.totalPacks | number }}</div>
              <div class="kc-lbl">Packs conditionnés</div>
            </div>
            <div class="kpi-card" style="--kc: var(--color-success)">
              <div class="kc-icon">🏗️</div>
              <div class="kc-val">{{ prodReport()!.totalPallets | number }}</div>
              <div class="kc-lbl">Palettes</div>
            </div>
            <div class="kpi-card" style="--kc: var(--color-warning)">
              <div class="kc-icon">⚡</div>
              <div class="kc-val">{{ prodReport()!.efficiency }}%</div>
              <div class="kc-lbl">Efficacité</div>
            </div>
            <div class="kpi-card" style="--kc: var(--color-success)">
              <div class="kc-icon">⏱️</div>
              <div class="kc-val">{{ runHours() }}h</div>
              <div class="kc-lbl">Temps de marche</div>
            </div>
            <div class="kpi-card" style="--kc: var(--color-danger)">
              <div class="kc-icon">🛑</div>
              <div class="kc-val">{{ downHours() }}h{{ downMins() }}m</div>
              <div class="kc-lbl">Arrêts cumulés</div>
            </div>
            <div class="kpi-card" style="--kc: var(--color-danger)">
              <div class="kc-icon">⚠️</div>
              <div class="kc-val">{{ prodReport()!.totalPreformeLost | number }}</div>
              <div class="kc-lbl">Pertes préformes</div>
            </div>
            <div class="kpi-card" style="--kc: var(--text-muted)">
              <div class="kc-icon">📋</div>
              <div class="kc-val">{{ prodReport()!.totalQuarts }}</div>
              <div class="kc-lbl">Quarts saisis</div>
            </div>
          </div>

          <!-- Graphe production journalière -->
          @if (prodReport()!.dailyProduction.length > 0) {
            <div class="chart-card factory-card">
              <div class="chart-title">📈 Production journalière (bouteilles)</div>
              <div class="bar-chart">
                @for (d of prodReport()!.dailyProduction; track d.date; let i = $index) {
                  <div class="bc-col" [title]="d.date + ' : ' + d.bottles + ' bt'">
                    <div class="bc-bar-wrap">
                      <div class="bc-bar"
                           [style.height.%]="maxBottles() > 0 ? (d.bottles / maxBottles() * 100) : 0"
                           [style.background]="d.bottles > 0 ? 'var(--factory-primary)' : 'var(--border)'">
                      </div>
                    </div>
                    @if (shouldShowDayLabel(i, prodReport()!.dailyProduction.length)) {
                      <div class="bc-day">{{ d.date.slice(8,10) }}/{{ d.date.slice(5,7) }}</div>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Par produit + Par équipe côte à côte -->
          <div class="two-cols">
            @if (prodReport()!.byProduct.length > 0) {
              <div class="section-card factory-card">
                <div class="sc-title">📦 Par produit</div>
                @for (p of prodReport()!.byProduct; track p.productName) {
                  <div class="breakdown-row">
                    <div class="br-label">{{ p.productName }}</div>
                    <div class="br-bar-wrap">
                      <div class="br-bar" [style.width.%]="p.pct" style="background:var(--factory-primary)"></div>
                    </div>
                    <div class="br-val">{{ p.pct }}%</div>
                  </div>
                }
              </div>
            }

            @if (prodReport()!.byTeam.length > 0) {
              <div class="section-card factory-card">
                <div class="sc-title">👷 Par équipe</div>
                @for (t of prodReport()!.byTeam; track t.teamLeaderName) {
                  <div class="team-row">
                    <div class="team-avatar">{{ t.teamLeaderName[0] }}</div>
                    <div class="team-info">
                      <div class="team-name">{{ t.teamLeaderName }}</div>
                      <div class="team-sub">{{ t.totalBottles | number }} bt · {{ t.totalPacks | number }} packs</div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Tableau détail quarts -->
          @if (showQuartDetail()) {
            <div class="section-card factory-card">
              <div class="sc-title-row">
                <div class="sc-title">📋 Détail par quart</div>
                <button class="btn-toggle" (click)="showQuartDetail.set(false)">Masquer ▲</button>
              </div>
              <div class="detail-table-wrap">
                <table class="detail-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Quart</th><th>Chef</th><th>Produit</th>
                      <th>Bouteilles</th><th>Packs</th><th>Palettes</th><th>Arrêts</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (q of prodReport()!.quartDetails; track q.id) {
                      <tr>
                        <td>{{ q.date }}</td>
                        <td><span class="shift-badge" [style.background]="(q.shiftColor ?? '#555') + '33'" [style.color]="q.shiftColor ?? '#aaa'">{{ q.shiftShortName }}</span></td>
                        <td>{{ q.teamLeaderName }}</td>
                        <td [style.color]="q.productColor ?? 'var(--text-muted)'">{{ q.productLabel }}</td>
                        <td class="num">{{ q.bottles | number }}</td>
                        <td class="num">{{ q.packs | number }}</td>
                        <td class="num">{{ q.pallets | number }}</td>
                        <td class="num" [style.color]="q.downtimeMinutes > 60 ? 'var(--color-danger)' : 'var(--text-muted)'">
                          {{ q.downtimeMinutes }}min
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          } @else {
            <button class="btn-show-detail" (click)="showQuartDetail.set(true)">
              Afficher le détail par quart ▼
            </button>
          }
        }

        @if (!loading() && !prodReport()) {
          <div class="empty-state">
            <div style="font-size:40px;">📊</div>
            <p>Définissez une période et cliquez sur Actualiser</p>
          </div>
        }
      }

      <!-- ── ONGLET PANNES & PERTES ── -->
      @if (tab() === 'pannes') {

        @if (maintReport()) {
          <!-- KPIs maintenance -->
          <div class="kpi-grid" style="grid-template-columns: repeat(4,1fr);">
            <div class="kpi-card" style="--kc: var(--color-warning)">
              <div class="kc-icon">🛠️</div>
              <div class="kc-val">{{ maintReport()!.total }}</div>
              <div class="kc-lbl">Interventions</div>
            </div>
            <div class="kpi-card" style="--kc: var(--color-success)">
              <div class="kc-icon">✅</div>
              <div class="kc-val">{{ maintReport()!.resolved }}</div>
              <div class="kc-lbl">Résolues</div>
            </div>
            <div class="kpi-card" style="--kc: var(--color-danger)">
              <div class="kc-icon">🔴</div>
              <div class="kc-val">{{ maintReport()!.pending }}</div>
              <div class="kc-lbl">En cours / attente</div>
            </div>
            <div class="kpi-card" style="--kc: var(--color-info)">
              <div class="kc-icon">⏱️</div>
              <div class="kc-val">{{ maintReport()!.totalDurationMinutes | number }}min</div>
              <div class="kc-lbl">Durée totale</div>
            </div>
          </div>

          <div class="two-cols">
            <!-- Par sévérité -->
            <div class="section-card factory-card">
              <div class="sc-title">🔴 Par sévérité</div>
              @for (entry of severityEntries(); track entry.key) {
                <div class="breakdown-row">
                  <div class="br-label" [style.color]="sevColor(entry.key)">{{ entry.key }}</div>
                  <div class="br-bar-wrap">
                    <div class="br-bar" [style.width.%]="maintReport()!.total > 0 ? (entry.val / maintReport()!.total * 100) : 0"
                         [style.background]="sevColor(entry.key)"></div>
                  </div>
                  <div class="br-val">{{ entry.val }}</div>
                </div>
              }
            </div>

            <!-- Par type -->
            <div class="section-card factory-card">
              <div class="sc-title">⚙️ Par type</div>
              @for (entry of typeEntries(); track entry.key) {
                <div class="breakdown-row">
                  <div class="br-label">{{ entry.key === 'MECANIQUE' ? '🔧 Mécanique' : '⚡ Électrique' }}</div>
                  <div class="br-bar-wrap">
                    <div class="br-bar" [style.width.%]="maintReport()!.total > 0 ? (entry.val / maintReport()!.total * 100) : 0"
                         style="background: var(--factory-secondary)"></div>
                  </div>
                  <div class="br-val">{{ entry.val }}</div>
                </div>
              }
            </div>
          </div>

          <!-- Par machine -->
          @if (maintReport()!.byMachine.length > 0) {
            <div class="section-card factory-card">
              <div class="sc-title">🔩 Pannes par machine</div>
              @for (m of maintReport()!.byMachine; track m.machineName) {
                <div class="breakdown-row">
                  <div class="br-label">{{ m.machineName }}</div>
                  <div class="br-bar-wrap">
                    <div class="br-bar"
                         [style.width.%]="maintReport()!.total > 0 ? (m.count / maintReport()!.total * 100) : 0"
                         style="background: var(--color-warning)"></div>
                  </div>
                  <div class="br-val">{{ m.count }} int. · {{ m.totalDurationMinutes }}min</div>
                </div>
              }
            </div>
          }

          <!-- Arrêts production -->
          @if (prodReport()?.stopBreakdown?.length) {
            <div class="section-card factory-card">
              <div class="sc-title">🛑 Arrêts de production</div>
              @for (s of prodReport()!.stopBreakdown; track s.label) {
                <div class="breakdown-row">
                  <div class="br-label">{{ s.label }}</div>
                  <div class="br-bar-wrap">
                    <div class="br-bar" [style.width.%]="s.pct" style="background: var(--color-danger)"></div>
                  </div>
                  <div class="br-val">{{ s.totalMinutes }}min ({{ s.pct }}%)</div>
                </div>
              }
            </div>
          }

          <!-- Pertes préformes -->
          @if (prodReport()?.lossBreakdown?.length) {
            <div class="section-card factory-card">
              <div class="sc-title">⚠️ Pertes préformes par cause</div>
              @for (l of prodReport()!.lossBreakdown; track l.cause) {
                <div class="breakdown-row">
                  <div class="br-label">{{ l.cause }}</div>
                  <div class="br-bar-wrap">
                    <div class="br-bar" [style.width.%]="l.pct" style="background: var(--color-warning)"></div>
                  </div>
                  <div class="br-val">{{ l.totalLost | number }} ({{ l.pct }}%)</div>
                </div>
              }
            </div>
          }
        }

        @if (!loading() && !maintReport()) {
          <div class="empty-state"><div style="font-size:40px;">🛠️</div><p>Actualisez pour charger les données</p></div>
        }
      }

      <!-- ── ONGLET EXPORT ── -->
      @if (tab() === 'export') {
        <div class="export-section factory-card">
          <div class="export-header">
            <div class="export-icon">📄</div>
            <div>
              <div class="export-title">Rapport PDF — Top Management</div>
              <div class="export-sub">Document complet avec KPIs, tableaux de production, analyse des pannes</div>
            </div>
          </div>

          <div class="export-preview">
            <div class="preview-page">
              <div class="pp-header" [style.background]="config.primaryColor()">
                <div class="pp-factory">{{ config.appTitle() }}</div>
              </div>
              <div class="pp-title">BILAN DE PRODUCTION</div>
              <div class="pp-period">{{ filters.from }} → {{ filters.to }}</div>
              <div class="pp-sections">
                <div class="pp-section">📊 Synthèse KPIs</div>
                <div class="pp-section">📈 Production par produit</div>
                <div class="pp-section">👷 Production par équipe</div>
                <div class="pp-section">📋 Détail quarts</div>
                <div class="pp-section">🛠️ Analyse pannes</div>
                <div class="pp-section">⚠️ Pertes préformes</div>
              </div>
              <div class="pp-footer">CONFIDENTIEL — USAGE INTERNE</div>
            </div>
          </div>

          <div class="export-params">
            <div class="ep-row">
              <span class="ep-label">Période</span>
              <span class="ep-val">{{ filters.from }} → {{ filters.to }}</span>
            </div>
            <div class="ep-row">
              <span class="ep-label">Ligne</span>
              <span class="ep-val">{{ selectedLineName() }}</span>
            </div>
            <div class="ep-row">
              <span class="ep-label">Équipe</span>
              <span class="ep-val">{{ selectedTeamName() }}</span>
            </div>
          </div>

          <button class="btn-export"
                  [disabled]="exporting() || !filters.from || !filters.to"
                  (click)="exportPdf()">
            @if (exporting()) {
              <span class="spinner"></span> Génération en cours...
            } @else {
              📥 Télécharger le rapport PDF
            }
          </button>

          @if (!prodReport()) {
            <div class="export-warn">
              ⚠️ Actualisez d'abord les données avant d'exporter
            </div>
          }
        </div>
      }

    </div>
  `,
  styles: [`
    .bilan { max-width: 800px; margin: 0 auto; padding-bottom: 40px; }
    .page-title { font-size: 18px; font-weight: 700; margin-bottom: 14px; }

    /* Filtres */
    .filters-bar { margin-bottom: 14px; }
    .filter-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    @media(max-width: 600px) { .filter-grid { grid-template-columns: 1fr 1fr; } }
    .btn-apply {
      width: 100%; padding: 10px; border-radius: 8px;
      background: var(--factory-primary); color: #fff; border: none;
      cursor: pointer; font-size: 14px; font-weight: 600;
    }
    .btn-apply:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Tabs */
    .bilan-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .bilan-tab {
      flex: 1; padding: 10px; border-radius: var(--border-radius-sm);
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-muted); cursor: pointer; font-size: 13px; font-weight: 500;
    }
    .bilan-tab.active { background: var(--factory-primary); color: #fff; border-color: transparent; }
    .export-tab { max-width: 160px; }

    /* KPI Grid */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    @media(max-width: 600px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    .kpi-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-top: 3px solid var(--kc); border-radius: var(--border-radius);
      padding: 12px 10px; text-align: center;
    }
    .kc-icon { font-size: 18px; margin-bottom: 4px; }
    .kc-val  { font-size: 18px; font-weight: 800; color: var(--kc); }
    .kc-lbl  { font-size: 10px; color: var(--text-muted); margin-top: 2px; }

    /* Graphe */
    .chart-card { margin-bottom: 14px; }
    .chart-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
    .bar-chart { display: flex; align-items: flex-end; gap: 2px; height: 100px; padding-bottom: 18px; }
    .bc-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
    .bc-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
    .bc-bar { width: 100%; border-radius: 2px 2px 0 0; min-height: 2px; transition: height 0.3s; }
    .bc-day { font-size: 8px; color: var(--text-muted); margin-top: 2px; }

    /* Two cols */
    .two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    @media(max-width: 600px) { .two-cols { grid-template-columns: 1fr; } }

    /* Section cards */
    .section-card { margin-bottom: 10px; }
    .sc-title { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
    .sc-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .btn-toggle { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 12px; }

    /* Breakdown bars */
    .breakdown-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
    .br-label { font-size: 12px; width: 120px; flex-shrink: 0; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .br-bar-wrap { flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .br-bar { height: 100%; border-radius: 4px; transition: width 0.4s; }
    .br-val { font-size: 11px; font-weight: 600; white-space: nowrap; min-width: 70px; text-align: right; }

    /* Team rows */
    .team-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); }
    .team-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--factory-primary); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .team-name { font-size: 13px; font-weight: 600; }
    .team-sub  { font-size: 11px; color: var(--text-muted); }

    /* Tableau détail */
    .btn-show-detail { width: 100%; padding: 10px; background: none; border: 1px dashed var(--border); color: var(--text-muted); cursor: pointer; border-radius: 8px; font-size: 13px; margin-bottom: 10px; }
    .detail-table-wrap { overflow-x: auto; }
    .detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .detail-table th { background: var(--bg-card2); color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 7px 8px; text-align: left; white-space: nowrap; }
    .detail-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
    .detail-table tr:hover td { background: var(--bg-card2); }
    .shift-badge { padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }

    /* Export section */
    .export-section { }
    .export-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .export-icon { font-size: 40px; }
    .export-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .export-sub { font-size: 13px; color: var(--text-muted); }

    .export-preview { display: flex; justify-content: center; margin-bottom: 20px; }
    .preview-page {
      width: 180px; background: #1a1f2e;
      border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
      box-shadow: 0 8px 24px #0006;
    }
    .pp-header { padding: 10px; }
    .pp-factory { font-size: 9px; font-weight: 700; color: #fff; }
    .pp-title { font-size: 11px; font-weight: 800; color: var(--factory-primary); text-align: center; padding: 10px 8px 4px; }
    .pp-period { font-size: 8px; color: var(--text-muted); text-align: center; padding-bottom: 8px; }
    .pp-sections { padding: 0 8px 8px; display: flex; flex-direction: column; gap: 4px; }
    .pp-section { font-size: 7px; color: var(--text-muted); padding: 3px 6px; background: var(--bg-card2); border-radius: 3px; }
    .pp-footer { font-size: 7px; color: var(--color-danger); text-align: center; padding: 6px; border-top: 1px solid var(--border); }

    .export-params { background: var(--bg-card2); border-radius: 8px; padding: 12px; margin-bottom: 16px; }
    .ep-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border); }
    .ep-row:last-child { border: none; }
    .ep-label { font-size: 12px; color: var(--text-muted); }
    .ep-val   { font-size: 12px; font-weight: 600; }

    .btn-export {
      width: 100%; padding: 14px; border-radius: 10px;
      background: var(--factory-primary); color: #fff; border: none;
      cursor: pointer; font-size: 15px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; gap: 10px;
    }
    .btn-export:disabled { opacity: 0.5; cursor: not-allowed; }
    .spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #ffffff44; border-top-color: #fff; animation: spin 0.7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .export-warn { margin-top: 10px; padding: 8px 12px; background: #FFB70011; border: 1px solid #FFB70033; border-radius: 8px; font-size: 12px; color: var(--color-warning); text-align: center; }

    .center-msg { text-align: center; color: var(--text-muted); padding: 40px; }
    .empty-state { text-align: center; color: var(--text-muted); padding: 40px 0; }
  `]
})
export class BilanComponent implements OnInit {
  auth   = inject(AuthService);
  config = inject(FactoryConfigService);
  http   = inject(HttpClient);

  tab          = signal<BilanTab>('production');
  loading      = signal(false);
  exporting    = signal(false);
  prodReport   = signal<ProductionReport | null>(null);
  maintReport  = signal<MaintenanceReport | null>(null);
  teamLeaders  = signal<{id:string;fullName:string}[]>([]);
  showQuartDetail = signal(false);

  lines = this.config.lines;

  // Filtres
  filters = {
    from: this.defaultFrom(),
    to:   new Date().toISOString().split('T')[0],
    lineId: '',
    teamLeaderId: ''
  };

  maxBottles = computed(() => {
    const data = this.prodReport()?.dailyProduction ?? [];
    return Math.max(...data.map(d => d.bottles), 1);
  });

  runHours  = computed(() => Math.floor((this.prodReport()?.runningMinutes ?? 0) / 60));
  downHours = computed(() => Math.floor((this.prodReport()?.totalDowntimeMinutes ?? 0) / 60));
  downMins  = computed(() => (this.prodReport()?.totalDowntimeMinutes ?? 0) % 60);

  severityEntries = computed(() =>
    Object.entries(this.maintReport()?.bySeverity ?? {})
      .map(([key, val]) => ({ key, val }))
      .sort((a,b) => ['CRITIQUE','MAJEUR','MINEUR'].indexOf(a.key) - ['CRITIQUE','MAJEUR','MINEUR'].indexOf(b.key))
  );

  typeEntries = computed(() =>
    Object.entries(this.maintReport()?.byType ?? {}).map(([key, val]) => ({ key, val }))
  );

  selectedLineName = computed(() => {
    if (!this.filters.lineId) return 'Toutes les lignes';
    return this.lines().find(l => l.id === this.filters.lineId)?.name ?? '—';
  });

  selectedTeamName = computed(() => {
    if (!this.filters.teamLeaderId) return 'Toutes les équipes';
    return this.teamLeaders().find(t => t.id === this.filters.teamLeaderId)?.fullName ?? '—';
  });

  ngOnInit() {
    this.loadTeamLeaders();
    this.loadAll();
  }

  loadTeamLeaders() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.http.get<{id:string;fullName:string}[]>(
      `${environment.apiUrl}/reports/factory/${factoryId}/team-leaders`
    ).subscribe({ next: l => this.teamLeaders.set(l), error: () => {} });
  }

  loadAll() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId || !this.filters.from || !this.filters.to) return;
    this.loading.set(true);

    const params = new URLSearchParams({
      from: this.filters.from, to: this.filters.to,
      ...(this.filters.lineId       ? { lineId:       this.filters.lineId }       : {}),
      ...(this.filters.teamLeaderId ? { teamLeaderId: this.filters.teamLeaderId } : {})
    });

    const base = `${environment.apiUrl}/reports/factory/${factoryId}`;

    Promise.all([
      fetch(`${base}/production?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('factory_access_token')}` }
      }).then(r => r.json()),
      fetch(`${base}/maintenance?from=${this.filters.from}&to=${this.filters.to}${this.filters.lineId ? '&lineId='+this.filters.lineId : ''}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('factory_access_token')}` }
      }).then(r => r.json())
    ]).then(([prod, maint]) => {
      this.prodReport.set(prod);
      this.maintReport.set(maint);
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  exportPdf() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.exporting.set(true);

    const params = new URLSearchParams({
      from: this.filters.from, to: this.filters.to,
      ...(this.filters.lineId       ? { lineId:       this.filters.lineId }       : {}),
      ...(this.filters.teamLeaderId ? { teamLeaderId: this.filters.teamLeaderId } : {})
    });

    const token = localStorage.getItem('factory_access_token');
    fetch(`${environment.apiUrl}/reports/factory/${factoryId}/export-pdf?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => {
      if (!r.ok) throw new Error('PDF generation failed');
      return r.blob();
    })
    .then(blob => {
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.download = `bilan_${this.filters.from}_${this.filters.to}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      this.exporting.set(false);
    })
    .catch(() => this.exporting.set(false));
  }

  shouldShowDayLabel(i: number, total: number): boolean {
    if (total <= 10) return true;
    if (total <= 20) return i % 2 === 0;
    return i % 5 === 0;
  }

  sevColor(sev: string): string {
    return sev === 'CRITIQUE' ? 'var(--color-danger)'
         : sev === 'MAJEUR'   ? 'var(--color-warning)'
         : 'var(--color-success)';
  }

  private defaultFrom(): string {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }
}
