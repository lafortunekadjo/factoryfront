import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-presence',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="presence animate-in">
      <h2 class="page-title">✅ Récapitulatif des présences</h2>

      <div class="filters factory-card">
        <div class="filter-row">
          <div>
            <label class="factory-label">Du</label>
            <input class="factory-input" type="date" [(ngModel)]="filterFrom" (change)="load()" />
          </div>
          <div>
            <label class="factory-label">Au</label>
            <input class="factory-input" type="date" [(ngModel)]="filterTo" (change)="load()" />
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="center-msg">⏳ Chargement...</div>
      } @else if (!recap()) {
        <div class="empty-state">
          <div style="font-size:36px">📋</div>
          <p>Aucune présence enregistrée sur cette période</p>
        </div>
      } @else {
        <div class="kpis">
          <div class="kpi-card">
            <div class="kpi-val" style="color:var(--color-success)">{{ recap()!.totalPresents }}</div>
            <div class="kpi-lbl">Présences</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val" style="color:var(--color-danger)">{{ recap()!.totalAbsents }}</div>
            <div class="kpi-lbl">Absences</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-val" [style.color]="tauxColor(recap()!.tauxPresence)">
              {{ recap()!.tauxPresence }}%
            </div>
            <div class="kpi-lbl">Taux global</div>
          </div>
        </div>

        <div class="view-toggle">
          <button class="vt-btn" [class.active]="view() === 'quart'" (click)="view.set('quart')">
            📋 Par quart
          </button>
          <button class="vt-btn" [class.active]="view() === 'membre'" (click)="view.set('membre')">
            👤 Par membre
          </button>
        </div>

        @if (view() === 'quart') {
          @if (!recap()!.parQuart.length) {
            <div class="empty-state"><p>Aucun quart avec présences validées sur cette période</p></div>
          }
          @for (q of recap()!.parQuart; track q.date + q.equipeNom) {
            <div class="quart-card factory-card">
              <div class="qc-header">
                <div>
                  <div class="qc-date">
                    {{ q.date | date:'EEE dd MMM':'':'fr' }}
                    <span class="qc-shift">· {{ q.shiftName }}</span>
                  </div>
                  <div class="qc-equipe">{{ q.equipeNom }}</div>
                </div>
                <div class="qc-score" [style.color]="tauxColor(q.nbPresents / q.nbTotal * 100)">
                  <span class="score-big">{{ q.nbPresents }}</span>/{{ q.nbTotal }}
                </div>
              </div>
              <div class="membres-list">
                @for (m of q.lignes; track m.membreId) {
                  <div class="membre-row" [class.absent]="m.present === false">
                    <span class="dot" [class.green]="m.present === true"
                          [class.red]="m.present === false"
                          [class.grey]="m.present === null">
                      {{ m.present === true ? '✓' : m.present === false ? '✗' : '?' }}
                    </span>
                    <span class="mr-name">{{ m.membreNom }}</span>
                    <span class="mr-poste">{{ m.posteNom }}</span>
                    @if (m.addedByChef) {
                      <span class="badge-chef">+ chef</span>
                    }
                    @if (m.note5s !== null && m.note5s !== undefined) {
                      <span class="badge-5s" [style.color]="score5sColor(m.note5s)">
                        ⭐{{ m.note5s }}/10
                      </span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        }

        @if (view() === 'membre') {
          <div class="table-wrap factory-card">
            <table class="recap-table">
              <thead>
                <tr>
                  <th>Membre</th><th>Poste</th><th>Équipe</th>
                  <th class="center">✓</th><th class="center">✗</th><th>Taux</th>
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
    .presence { max-width: 800px; margin: 0 auto; padding-bottom: 40px; }
    .page-title { font-size: 18px; font-weight: 700; margin-bottom: 14px; }
    .filters { margin-bottom: 14px; }
    .filter-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .filter-row > div { flex: 1; min-width: 140px; }
    .kpis { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .kpi-card { flex: 1; min-width: 90px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; text-align: center; }
    .kpi-val { font-size: 26px; font-weight: 900; }
    .kpi-lbl { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
    .view-toggle { display: flex; gap: 6px; margin-bottom: 14px; }
    .vt-btn { padding: 7px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card2); color: var(--text-muted); cursor: pointer; font-size: 13px; font-weight: 500; }
    .vt-btn.active { background: var(--factory-primary); color: #fff; border-color: transparent; font-weight: 700; }
    .quart-card { margin-bottom: 10px; }
    .qc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .qc-date { font-size: 14px; font-weight: 700; text-transform: capitalize; }
    .qc-shift { font-weight: 400; color: var(--text-muted); font-size: 13px; }
    .qc-equipe { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .qc-score { font-size: 15px; font-weight: 600; text-align: right; }
    .score-big { font-size: 28px; font-weight: 900; }
    .membres-list { display: flex; flex-direction: column; gap: 4px; }
    .membre-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 7px; background: var(--bg-card2); font-size: 13px; }
    .membre-row.absent { background: #FF4D6D08; }
    .dot { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; }
    .dot.green { background: #00E5A022; color: var(--color-success); }
    .dot.red { background: #FF4D6D22; color: var(--color-danger); }
    .dot.grey { background: var(--bg-card); color: var(--text-muted); }
    .mr-name { font-weight: 600; flex: 1; }
    .mr-poste { font-size: 11px; color: var(--text-muted); }
    .badge-chef { font-size: 10px; background: #FFB70022; border: 1px solid #FFB70044; color: var(--color-warning); padding: 1px 6px; border-radius: 6px; }
    .badge-5s { font-size: 11px; font-weight: 700; }
    .table-wrap { overflow-x: auto; }
    .recap-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .recap-table th { text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    .recap-table td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
    .recap-table tbody tr:last-child td { border-bottom: none; }
    .center { text-align: center; }
    .td-name { font-weight: 600; }
    .td-muted { color: var(--text-muted); }
    .td-pres { color: var(--color-success); font-weight: 700; }
    .td-abs { color: var(--color-danger); font-weight: 700; }
    .equipe-tag { background: var(--bg-card2); border: 1px solid var(--border); border-radius: 6px; padding: 2px 7px; font-size: 11px; }
    .taux-bar { position: relative; background: var(--bg-card2); border-radius: 4px; height: 20px; min-width: 80px; overflow: hidden; }
    .taux-fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 4px; opacity: 0.4; }
    .taux-lbl { position: relative; font-size: 11px; font-weight: 700; padding: 2px 6px; }
    .center-msg, .empty-state { text-align: center; color: var(--text-muted); padding: 40px 0; }
    .empty-state p { margin-top: 8px; }
  `]
})
export class PresenceComponent implements OnInit {
  http = inject(HttpClient);
  auth = inject(AuthService);

  loading = signal(false);
  recap   = signal<any | null>(null);
  view    = signal<'quart' | 'membre'>('quart');

  filterFrom = new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString().split('T')[0];
  filterTo = new Date().toISOString().split('T')[0];

  ngOnInit() { this.load(); }

  load() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.loading.set(true);
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

  tauxColor(taux: number): string {
    if (taux >= 90) return '#00C47A';
    if (taux >= 70) return '#FFB700';
    return '#FF4D6D';
  }

  score5sColor(score: number): string {
    if (score >= 8) return '#00C47A';
    if (score >= 5) return '#FFB700';
    return '#FF4D6D';
  }
}
