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
      <h2 class="page-title">✅ Feuilles de présence</h2>

      @if (loading()) { <div class="center-msg">Chargement...</div> }

      @if (!loading() && openSheets().length === 0) {
        <div class="empty-state">
          <div style="font-size:36px;">✅</div>
          <p>Aucune feuille de présence en attente</p>
        </div>
      }

      @for (sheet of openSheets(); track sheet.id) {
        <div class="sheet-card factory-card">
          <div class="sheet-header">
            <div>
              <div class="sheet-title" [style.color]="sheet.teamCouleur">
                {{ sheet.teamNom }} — {{ sheet.shiftName }}
              </div>
              <div class="sheet-date">{{ sheet.workDate | date:'EEEE dd MMMM yyyy':'':'fr' }}</div>
            </div>
            <div class="sheet-status">
              <span class="status-badge" [class.validated]="sheet.status === 'VALIDATED'">
                {{ sheet.status === 'VALIDATED' ? '✅ Validée' : '📋 En cours' }}
              </span>
            </div>
          </div>

          <!-- Liste membres -->
          <div class="members-section">
            @for (record of sheet.records; track record.id) {
              <div class="record-row" [class]="'statut-' + record.statut.toLowerCase()">
                <div class="rec-avatar" [class]="'s-' + record.statut.toLowerCase()">
                  {{ initials(record.fullName) }}
                </div>
                <div class="rec-info">
                  <div class="rec-name">{{ record.fullName }}</div>
                  <div class="rec-meta">
                    {{ record.posteNom ?? 'Poste non défini' }}
                    @if (record.signinAt) { · Signin {{ record.signinAt | date:'HH:mm' }} }
                    @if (record.addedManually) { · <span class="manual-tag">Ajout manuel</span> }
                    @if (record.signinDistanceM) { · {{ record.signinDistanceM }}m }
                  </div>
                </div>

                @if (sheet.status !== 'VALIDATED') {
                  <div class="rec-controls">
                    <select class="statut-select" [value]="record.statut"
                            (change)="updateStatut(sheet.id, record.teamMemberId, $event, sheet)">
                      <option value="PRESENT">✅ Présent</option>
                      <option value="ABSENT">❌ Absent</option>
                      <option value="LATE">⏰ Retard</option>
                      <option value="EXCUSED">📝 Excusé</option>
                    </select>
                  </div>
                } @else {
                  <div class="rec-statut-badge" [class]="'s-' + record.statut.toLowerCase()">
                    {{ statutLabel(record.statut) }}
                  </div>
                }
              </div>
            }
          </div>

          <!-- Ajout manuel -->
          @if (sheet.status !== 'VALIDATED') {
            <div class="manual-section">
              <div class="manual-title">➕ Ajouter un membre absent du signin</div>
              <div class="manual-form">
                <select class="factory-input" [(ngModel)]="manualMemberId[sheet.id]">
                  <option value="">-- Sélectionner un membre --</option>
                  @for (m of absentMembers(sheet); track m.teamMemberId) {
                    <option [value]="m.teamMemberId">{{ m.fullName }}</option>
                  }
                </select>
                <input class="factory-input" [(ngModel)]="manualNote[sheet.id]" placeholder="Note (optionnel)" />
                <button class="btn-manual" [disabled]="!manualMemberId[sheet.id]"
                        (click)="addManual(sheet)">Ajouter</button>
              </div>
            </div>

            <!-- Résumé avant validation -->
            <div class="sheet-summary">
              <span class="sum-present">✅ {{ countByStatut(sheet, 'PRESENT') }} présents</span>
              <span class="sum-absent">❌ {{ countByStatut(sheet, 'ABSENT') }} absents</span>
              <span class="sum-late">⏰ {{ countByStatut(sheet, 'LATE') }} retards</span>
              <span class="sum-excused">📝 {{ countByStatut(sheet, 'EXCUSED') }} excusés</span>
            </div>

            <button class="btn-validate" (click)="validateSheet(sheet)">
              ✅ Valider la feuille de présence
            </button>
          }

          @if (sheet.status === 'VALIDATED') {
            <div class="validated-info">
              Validée par {{ sheet.validatedByName }} le {{ sheet.validatedAt | date:'dd/MM/yyyy à HH:mm' }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .presence { max-width: 700px; margin: 0 auto; padding-bottom: 40px; }
    .page-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; }

    .sheet-card { margin-bottom: 16px; }
    .sheet-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
    .sheet-title { font-size: 16px; font-weight: 700; }
    .sheet-date { font-size: 13px; color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }
    .status-badge { padding: 4px 12px; border-radius: 10px; font-size: 12px; font-weight: 700; background: var(--color-warning); color: #000; }
    .status-badge.validated { background: var(--color-success); color: #fff; }

    /* Membres */
    .members-section { margin-bottom: 14px; }
    .record-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .record-row:last-child { border-bottom: none; }
    .rec-avatar {
      width: 38px; height: 38px; border-radius: 50%; background: var(--factory-primary);
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }
    .rec-avatar.s-present { background: var(--color-success); }
    .rec-avatar.s-absent  { background: var(--color-danger); }
    .rec-avatar.s-late    { background: var(--color-warning); color: #000; }
    .rec-avatar.s-excused { background: var(--text-muted); }
    .rec-info { flex: 1; }
    .rec-name { font-size: 14px; font-weight: 600; color: var(--text); }
    .rec-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .manual-tag { background: #FFB70022; color: var(--color-warning); border: 1px solid #FFB70044; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .statut-select { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card2); color: var(--text); font-size: 12px; }
    .rec-statut-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .rec-statut-badge.s-present { background: #00E5A022; color: var(--color-success); }
    .rec-statut-badge.s-absent  { background: #FF4D6D22; color: var(--color-danger); }
    .rec-statut-badge.s-late    { background: #FFB70022; color: var(--color-warning); }
    .rec-statut-badge.s-excused { background: var(--bg-card2); color: var(--text-muted); }

    /* Ajout manuel */
    .manual-section { background: var(--bg-card2); border: 1px dashed var(--border); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .manual-title { font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px; }
    .manual-form { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn-manual { padding: 8px 16px; border-radius: 6px; border: none; background: var(--factory-secondary); color: #fff; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .btn-manual:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Résumé & Validation */
    .sheet-summary { display: flex; gap: 14px; font-size: 13px; font-weight: 600; margin-bottom: 14px; flex-wrap: wrap; }
    .sum-present { color: var(--color-success); }
    .sum-absent  { color: var(--color-danger); }
    .sum-late    { color: var(--color-warning); }
    .sum-excused { color: var(--text-muted); }
    .btn-validate { width: 100%; padding: 12px; border-radius: 10px; border: none; background: var(--color-success); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
    .validated-info { font-size: 12px; color: var(--text-muted); font-style: italic; text-align: center; margin-top: 10px; }

    .center-msg, .empty-state { text-align: center; color: var(--text-muted); padding: 40px 0; }
  `]
})
export class PresenceComponent implements OnInit {
  http = inject(HttpClient);
  auth = inject(AuthService);
  get api() { return environment.apiUrl; }

  loading = signal(false);
  openSheets = signal<any[]>([]);
  manualMemberId: Record<string, string> = {};
  manualNote: Record<string, string> = {};

  ngOnInit() {
    this.loadOpenSheets();
  }

  loadOpenSheets() {
    this.loading.set(true);
    this.http.get<any[]>(`${this.api}/rh/presence/chef/open`)
      .subscribe({ next: s => { this.openSheets.set(s); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  updateStatut(sheetId: string, memberId: string, event: Event, sheet: any) {
    const statut = (event.target as HTMLSelectElement).value;
    this.http.patch<any>(`${this.api}/rh/presence/sheets/${sheetId}/record`, { teamMemberId: memberId, statut })
      .subscribe({ next: (updated) => this.openSheets.update(sheets => sheets.map(s => s.id === sheetId ? updated : s)) });
  }

  absentMembers(sheet: any): any[] {
    return sheet.records.filter((r: any) => r.statut === 'ABSENT');
  }

  addManual(sheet: any) {
    const memberId = this.manualMemberId[sheet.id];
    if (!memberId) return;
    const note = this.manualNote[sheet.id];
    this.http.post<any>(`${this.api}/rh/presence/sheets/${sheet.id}/manual-signin`, { teamMemberId: memberId, note: note || undefined })
      .subscribe({ next: (updated) => {
        this.openSheets.update(sheets => sheets.map(s => s.id === sheet.id ? updated : s));
        this.manualMemberId[sheet.id] = '';
        this.manualNote[sheet.id] = '';
      }});
  }

  validateSheet(sheet: any) {
    if (!confirm('Valider définitivement cette feuille de présence ? Elle ne pourra plus être modifiée.')) return;
    this.http.patch<any>(`${this.api}/rh/presence/sheets/${sheet.id}/validate`, {})
      .subscribe({ next: (updated) => this.openSheets.update(sheets => sheets.map(s => s.id === sheet.id ? updated : s)) });
  }

  countByStatut(sheet: any, statut: string): number {
    return sheet.records.filter((r: any) => r.statut === statut).length;
  }

  statutLabel(s: string): string {
    return { PRESENT: '✅ Présent', ABSENT: '❌ Absent', LATE: '⏰ Retard', EXCUSED: '📝 Excusé' }[s] ?? s;
  }

  initials(name: string): string {
    return name.split(' ').map(p => p[0]).join('').substring(0, 2).toUpperCase();
  }
}
