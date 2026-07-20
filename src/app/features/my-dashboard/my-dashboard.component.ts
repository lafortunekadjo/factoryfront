import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-my-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="my-dash animate-in">

      <!-- En-tête personnalisé -->
      <div class="my-header">
        <div class="my-avatar">
          @if (user()?.avatarUrl) {
            <img [src]="user()!.avatarUrl" alt="avatar" />
          } @else {
            <span>{{ initials() }}</span>
          }
        </div>
        <div>
          <div class="my-name">Bonjour, {{ user()?.firstName }} 👋</div>
          <div class="my-role">{{ user()?.jobTitle ?? user()?.roles?.[0] }}</div>
          <div class="my-date">{{ today | date:'EEEE dd MMMM yyyy':'':'fr' }}</div>
        </div>
      </div>

      <!-- ── QUART DU JOUR ── -->
      <div class="section-title">📅 Mon quart aujourd'hui</div>

      @if (loadingQuart()) {
        <div class="center-msg">Chargement...</div>
      } @else if (!quartAujourdhui()) {
        <div class="no-quart factory-card">
          <div style="font-size:32px">🏖️</div>
          <div class="nq-title">Pas de quart prévu aujourd'hui</div>
          <div class="nq-sub">Profitez de votre journée !</div>
        </div>
      } @else {
        <div class="quart-card factory-card"
             [style.border-left-color]="quartAujourdhui()!.equipeCouleur">
          <div class="qc-top">
            <div>
              <div class="qc-shift">{{ quartAujourdhui()!.shiftName }}</div>
              <div class="qc-equipe">{{ quartAujourdhui()!.equipeNom }}</div>
              <div class="qc-line">{{ quartAujourdhui()!.lineName }}</div>
            </div>
            <div class="qc-right">
              <!-- Statut présence -->
              @if (dejaPointe()) {
                <div class="checkin-done">✅ Présence pointée</div>
              } @else if (quartAujourdhui()!.isRepos) {
                <div class="repos-badge">🛌 Repos</div>
              } @else {
                <button class="btn-checkin" [disabled]="checkingIn()"
                        (click)="checkIn()">
                  @if (checkingIn()) { ⏳ Pointage... }
                  @else { 📍 Pointer ma présence }
                </button>
              }
            </div>
          </div>
          @if (checkinError()) {
            <div class="checkin-error">⚠️ {{ checkinError() }}</div>
          }
        </div>
      }

      <!-- ── KPIs PERSO ── -->
      <div class="my-kpis">
        <div class="my-kpi">
          <div class="mk-val green">{{ stats()?.joursPresents ?? '—' }}</div>
          <div class="mk-lbl">Jours présents<br>ce mois</div>
        </div>
        <div class="my-kpi">
          <div class="mk-val" [style.color]="tauxColor(stats()?.tauxPresence ?? 0)">
            {{ stats()?.tauxPresence ?? '—' }}%
          </div>
          <div class="mk-lbl">Taux de<br>présence</div>
        </div>
        <div class="my-kpi">
          <div class="mk-val blue">{{ stats()?.heuresTravaillees ?? '—' }}</div>
          <div class="mk-lbl">Heures<br>ce mois</div>
        </div>
        <div class="my-kpi">
          <div class="mk-val orange">{{ echangesEnCours() }}</div>
          <div class="mk-lbl">Échanges<br>en cours</div>
        </div>
      </div>

      <!-- ── PLANNING DE LA SEMAINE ── -->
      <div class="section-header-row">
        <div class="section-title">📋 Mon planning</div>
        <div class="week-nav">
          <button class="wn-btn" (click)="prevWeek()">‹</button>
          <span class="wn-label">{{ weekLabel() }}</span>
          <button class="wn-btn" (click)="nextWeek()">›</button>
        </div>
      </div>

      <div class="planning-week">
        @for (day of weekDays(); track day.date) {
          <div class="day-card" [class.today]="day.isToday" [class.repos]="day.isRepos">
            <div class="day-name">{{ day.date | date:'EEE':'':'fr' }}</div>
            <div class="day-num" [class.today-num]="day.isToday">
              {{ day.date | date:'dd' }}
            </div>
            @if (day.entry) {
              @if (day.isRepos) {
                <div class="day-shift repos">🛌</div>
              } @else {
                <div class="day-shift"
                     [style.background]="day.entry.equipeCouleur + '33'"
                     [style.color]="day.entry.equipeCouleur">
                  {{ day.entry.shiftShortName ?? day.entry.shiftName }}
                </div>
                <div class="day-equipe">{{ day.entry.equipeNom }}</div>
              }
            } @else {
              <div class="day-empty">—</div>
            }
          </div>
        }
      </div>

      <!-- ── MES ÉCHANGES ── -->
      @if (exchanges().length > 0 || true) {
        <div class="section-header-row">
          <div class="section-title">🔄 Mes échanges de quart</div>
          <button class="btn-new-exchange" (click)="showExchangeForm.set(!showExchangeForm())">
            {{ showExchangeForm() ? '✕ Annuler' : '+ Demander un échange' }}
          </button>
        </div>

        @if (showExchangeForm()) {
          <div class="exchange-form factory-card">
            <div class="ef-title">Nouvelle demande d'échange de quart</div>

            <!-- Mon quart à échanger -->
            <div style="margin-top:10px;">
              <label class="factory-label">Mon quart à échanger</label>
              <select class="factory-input" [(ngModel)]="newExchange.myPlanningEntryId"
                      (ngModelChange)="onMyQuartSelected($event)">
                <option value="">-- Sélectionner un de mes quarts --</option>
                @for (d of allMyPlanningDays(); track d.id) {
                  <option [value]="d.id">
                    {{ d.date | date:'EEE dd/MM':'':'fr' }} — {{ d.shiftName }}
                    ({{ d.equipeNom }})
                  </option>
                }
              </select>
            </div>

            <!-- Collègue + son quart -->
            @if (newExchange.myPlanningEntryId) {
              <div style="margin-top:10px;">
                <label class="factory-label">Collègue avec qui échanger</label>
                <select class="factory-input" [(ngModel)]="newExchange.colleagueUserId"
                        (ngModelChange)="loadColleaguePlanning($event)">
                  <option value="">-- Sélectionner un collègue --</option>
                  @for (c of colleagues(); track c.userId) {
                    <option [value]="c.userId">{{ c.fullName }} — {{ c.posteNom }}</option>
                  }
                </select>
              </div>

              @if (newExchange.colleagueUserId && colleaguePlanning().length) {
                <div style="margin-top:10px;">
                  <label class="factory-label">Son quart à récupérer</label>
                  <select class="factory-input" [(ngModel)]="newExchange.colleaguePlanningEntryId">
                    <option value="">-- Sélectionner le quart --</option>
                    @for (d of colleaguePlanning(); track d.id) {
                      <option [value]="d.id">
                        {{ d.date | date:'EEE dd/MM':'':'fr' }} — {{ d.shiftName }}
                      </option>
                    }
                  </select>
                </div>
              }
            }

            <div style="margin-top:10px;">
              <label class="factory-label">Note (optionnel)</label>
              <input class="factory-input" [(ngModel)]="newExchange.note"
                     placeholder="Raison de l'échange..." />
            </div>

            <div class="ef-hint">
              ℹ️ Le collègue devra accepter, puis le chef d'équipe validera.
            </div>

            <button class="btn-submit-exchange"
                    [disabled]="!newExchange.myPlanningEntryId || !newExchange.colleaguePlanningEntryId || submittingExchange()"
                    (click)="submitExchangeRequest()">
              {{ submittingExchange() ? '⏳...' : '📤 Soumettre la demande' }}
            </button>
          </div>
        }

        @for (ex of exchanges(); track ex.id) {
          <div class="exchange-card factory-card">
            <div class="ex-row">
              <div>
                <div class="ex-names">{{ ex.requesterName }} ⇄ {{ ex.accepterName }}</div>
                <div class="ex-dates">
                  {{ ex.dateRequester | date:'dd/MM' }} ↔ {{ ex.dateAccepter | date:'dd/MM' }}
                </div>
              </div>
              <span class="ex-status" [class]="'st-' + ex.status.toLowerCase()">
                {{ statusLabel(ex.status) }}
              </span>
            </div>
            @if (ex.status === 'PENDING_ACCEPT' && ex.accepterMembreId === myMembreId()) {
              <div class="ex-actions">
                <button class="btn-accept" (click)="acceptExchange(ex.id)">✅ Accepter</button>
                <button class="btn-reject" (click)="rejectExchange(ex.id)">❌ Refuser</button>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .my-dash { max-width: 700px; margin: 0 auto; padding-bottom: 40px; }

    /* Header */
    .my-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .my-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--factory-primary); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; }
    .my-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .my-name { font-size: 18px; font-weight: 800; }
    .my-role { font-size: 13px; color: var(--factory-secondary); font-weight: 600; margin-top: 2px; }
    .my-date { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }

    /* Quart du jour */
    .section-title { font-size: 14px; font-weight: 700; margin: 18px 0 10px; }
    .no-quart { text-align: center; padding: 24px; }
    .nq-title { font-size: 15px; font-weight: 700; margin-top: 8px; }
    .nq-sub { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .quart-card { border-left: 4px solid var(--factory-primary); }
    .qc-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .qc-shift { font-size: 16px; font-weight: 800; }
    .qc-equipe { font-size: 13px; color: var(--text-muted); margin-top: 3px; }
    .qc-line { font-size: 12px; color: var(--text-muted); }
    .qc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .btn-checkin { padding: 10px 18px; border-radius: 10px; border: none; background: var(--factory-primary); color: #fff; cursor: pointer; font-size: 13px; font-weight: 700; }
    .btn-checkin:disabled { opacity: 0.5; cursor: not-allowed; }
    .checkin-done { color: var(--color-success); font-weight: 700; font-size: 13px; }
    .repos-badge { color: var(--text-muted); font-size: 13px; }
    .checkin-error { margin-top: 8px; font-size: 12px; color: var(--color-warning); background: #FFB70011; border-radius: 6px; padding: 6px 10px; }

    /* KPIs perso */
    .my-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
    .my-kpi { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 10px; text-align: center; }
    .mk-val { font-size: 24px; font-weight: 900; }
    .mk-val.green { color: var(--color-success); }
    .mk-val.blue { color: var(--factory-primary); }
    .mk-val.orange { color: var(--color-warning); }
    .mk-lbl { font-size: 10px; color: var(--text-muted); margin-top: 4px; line-height: 1.4; }

    /* Planning semaine */
    .section-header-row { display: flex; justify-content: space-between; align-items: center; margin: 18px 0 10px; }
    .week-nav { display: flex; align-items: center; gap: 8px; }
    .wn-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
    .wn-label { font-size: 12px; font-weight: 600; min-width: 110px; text-align: center; }
    .planning-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
    .day-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 8px 4px; text-align: center; }
    .day-card.today { border-color: var(--factory-primary); background: var(--factory-primary-bg, #1565C011); }
    .day-card.repos { opacity: 0.6; }
    .day-name { font-size: 10px; color: var(--text-muted); text-transform: capitalize; }
    .day-num { font-size: 16px; font-weight: 800; margin: 2px 0 6px; }
    .today-num { color: var(--factory-primary); }
    .day-shift { font-size: 11px; font-weight: 700; padding: 3px 4px; border-radius: 5px; }
    .day-shift.repos { font-size: 16px; padding: 0; background: none !important; color: inherit !important; }
    .day-equipe { font-size: 9px; color: var(--text-muted); margin-top: 3px; }
    .day-empty { font-size: 14px; color: var(--border); }

    /* Échanges */
    .exchange-card { margin-bottom: 8px; }
    .ex-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .ex-names { font-size: 13px; font-weight: 700; }
    .ex-dates { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .ex-status { padding: 3px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; }
    .st-pending_accept { background: #FFB70022; color: var(--color-warning); }
    .st-pending_chef { background: #00C2FF22; color: var(--color-info); }
    .st-validated { background: #00E5A022; color: var(--color-success); }
    .st-rejected { background: #FF4D6D22; color: var(--color-danger); }
    .ex-actions { display: flex; gap: 8px; margin-top: 8px; }
    .btn-accept { padding: 6px 14px; border-radius: 6px; border: 1px solid #00E5A044; background: #00E5A022; color: var(--color-success); cursor: pointer; font-size: 12px; font-weight: 700; }
    .btn-new-exchange { padding: 6px 14px; border-radius: 8px; border: 1px dashed var(--factory-primary); background: none; color: var(--factory-primary); cursor: pointer; font-size: 12px; font-weight: 600; }
    .exchange-form { margin-bottom: 12px; }
    .ef-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
    .ef-desc { font-size: 12px; color: var(--text-muted); }
    .ef-hint { font-size: 11px; color: var(--text-muted); margin-top: 10px; background: var(--bg-card2); padding: 8px 10px; border-radius: 6px; }
    .btn-submit-exchange { width: 100%; margin-top: 10px; padding: 10px; border-radius: 8px; border: none; background: var(--factory-primary); color: #fff; cursor: pointer; font-size: 13px; font-weight: 700; }
    .btn-submit-exchange:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-reject { padding: 6px 14px; border-radius: 6px; border: 1px solid #FF4D6D44; background: #FF4D6D22; color: var(--color-danger); cursor: pointer; font-size: 12px; font-weight: 700; }

    .center-msg { text-align: center; color: var(--text-muted); padding: 24px; }
  `]
})
export class MyDashboardComponent implements OnInit {
  auth   = inject(AuthService);
  config = inject(FactoryConfigService);
  http   = inject(HttpClient);

  user = computed(() => this.auth.user());
  initials = computed(() => {
    const u = this.user();
    return u ? (u.firstName[0] + u.lastName[0]).toUpperCase() : '?';
  });

  today = new Date();
  weekStart = signal(this.getMonday(new Date()));

  loadingQuart = signal(false);
  checkingIn   = signal(false);
  checkinError = signal<string | null>(null);
  dejaPointe   = signal(false);

  quartAujourdhui = signal<any | null>(null);
  planningWeek    = signal<any[]>([]);
  exchanges       = signal<any[]>([]);
  stats           = signal<any | null>(null);
  myMembreId      = signal<string | null>(null);

  showExchangeForm   = signal(false);
  submittingExchange = signal(false);
  colleagues         = signal<Array<{ userId: string; fullName: string; posteNom: string }>>([]);
  colleaguePlanning  = signal<any[]>([]);
  allMyPlanningDays  = signal<any[]>([]);

  newExchange = {
    myPlanningEntryId: '',
    colleagueUserId: '',
    colleaguePlanningEntryId: '',
    note: ''
  };

  onMyQuartSelected(entryId: string) {
    if (!entryId) return;
    // Chercher les collègues de l'équipe de ce quart
    const entry = this.allMyPlanningDays().find(d => d.id === entryId);
    if (!entry) return;
    this.newExchange.colleagueUserId = '';
    this.newExchange.colleaguePlanningEntryId = '';
    this.colleagues.set([]);
    this.colleaguePlanning.set([]);

    // Charger les membres de l'équipe (hors soi-même)
    const userId = this.user()?.id;
    this.http.get<any>(`${environment.apiUrl}/rh/planning/${entryId}/presences`)
      .subscribe({
        next: sheet => {
          const cols = (sheet.lignes ?? [])
            .filter((l: any) => l.userId !== userId && l.userId)
            .map((l: any) => ({
              userId: l.userId ?? l.membreId,
              fullName: l.membreNom,
              posteNom: l.posteNom
            }));
          // Charger aussi les membres de l'équipe via users-search
          const factoryId = this.config.factory()?.id;
          if (factoryId) {
            this.http.get<any[]>(`${environment.apiUrl}/rh/factories/${factoryId}/users-search`)
              .subscribe({
                next: users => this.colleagues.set(
                  users.filter(u => u.userId !== userId)
                ),
                error: () => this.colleagues.set(cols)
              });
          } else {
            this.colleagues.set(cols);
          }
        },
        error: () => {
          const factoryId = this.config.factory()?.id;
          const userId = this.user()?.id;
          if (factoryId) {
            this.http.get<any[]>(`${environment.apiUrl}/rh/factories/${factoryId}/users-search`)
              .subscribe({ next: users => this.colleagues.set(users.filter(u => u.userId !== userId)), error: () => {} });
          }
        }
      });
  }

  loadColleaguePlanning(colleagueUserId: string) {
    if (!colleagueUserId) return;
    const factoryId = this.config.factory()?.id;
    if (!factoryId) return;
    const from = new Date().toISOString().split('T')[0];
    const to = new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0];
    this.http.get<any[]>(
      `${environment.apiUrl}/rh/factories/${factoryId}/planning-for-user`,
      { params: { userId: colleagueUserId, from, to } }
    ).subscribe({
      next: p => this.colleaguePlanning.set(p.filter((e: any) => !e.isRepos)),
      error: () => this.colleaguePlanning.set([])
    });
  }

  submitExchangeRequest() {
    const { myPlanningEntryId, colleaguePlanningEntryId, note } = this.newExchange;
    const userId = this.user()?.id;
    if (!myPlanningEntryId || !userId) return;

    this.submittingExchange.set(true);

    // Si un quart de collègue est sélectionné → échange direct
    // Sinon → demande ouverte
    const url = colleaguePlanningEntryId
      ? `${environment.apiUrl}/rh/exchanges`
      : `${environment.apiUrl}/rh/exchanges/request-open`;

    const body = colleaguePlanningEntryId
      ? {
          planningEntryRequesterId: myPlanningEntryId,
          planningEntryAccepterId: colleaguePlanningEntryId,
          note: note || undefined
        }
      : { planningEntryId: myPlanningEntryId, note: note || undefined };

    this.http.post(url, body, { params: colleaguePlanningEntryId ? {} : { userId } }).subscribe({
      next: () => {
        this.submittingExchange.set(false);
        this.showExchangeForm.set(false);
        this.newExchange = { myPlanningEntryId: '', colleagueUserId: '', colleaguePlanningEntryId: '', note: '' };
        this.loadAll();
      },
      error: () => this.submittingExchange.set(false)
    });
  }

  echangesEnCours = computed(() =>
    this.exchanges().filter(e => e.status === 'PENDING_ACCEPT' || e.status === 'PENDING_CHEF').length
  );

  weekDays = computed(() => {
    const days = [];
    const ws = this.weekStart();
    const todayStr = new Date().toISOString().split('T')[0];
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = this.planningWeek().find(p => p.date === dateStr);
      days.push({
        date: d, dateStr,
        isToday: dateStr === todayStr,
        isRepos: entry?.isRepos ?? false,
        entry
      });
    }
    return days;
  });

  weekLabel = computed(() => {
    const days = this.weekDays();
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    return `${fmt(days[0].date)} – ${fmt(days[6].date)}`;
  });

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    const factoryId = this.config.factory()?.id;
    const userId = this.user()?.id;
    if (!factoryId || !userId) return;

    // Quart du jour
    this.loadingQuart.set(true);
    const today = new Date().toISOString().split('T')[0];
    this.http.get<any[]>(`${environment.apiUrl}/rh/factories/${factoryId}/planning-for-user?userId=${userId}&date=${today}`)
      .subscribe({
        next: entries => {
          this.quartAujourdhui.set(entries[0] ?? null);
          this.loadingQuart.set(false);
          if (entries[0]) this.checkPresenceStatus(entries[0].id);
        },
        error: () => this.loadingQuart.set(false)
      });

    // Planning de la semaine
    this.loadPlanningWeek();

    // Stats présences du mois
    const fromMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split('T')[0];
    this.http.get<any>(`${environment.apiUrl}/rh/factories/${factoryId}/presences/recap?from=${fromMonth}&to=${today}`)
      .subscribe({
        next: recap => {
          const myData = recap.parMembre?.find((m: any) => m.userId === userId);
          if (myData) {
            this.stats.set({
              joursPresents: myData.presents,
              tauxPresence: myData.tauxPresence,
              heuresTravaillees: Math.round(myData.presents * 8)
            });
          } else {
            // Aucune présence ce mois — initialiser à zéro
            this.stats.set({ joursPresents: 0, tauxPresence: 0, heuresTravaillees: 0 });
          }
        },
        error: () => {}
      });

    // Planning 30 jours pour le formulaire d'échange
    const to30 = new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0];
    this.http.get<any[]>(
      `${environment.apiUrl}/rh/factories/${factoryId}/planning-for-user`,
      { params: { userId, from: today, to: to30 } }
    ).subscribe({
      next: p => this.allMyPlanningDays.set(p.filter((e: any) => !e.isRepos)),
      error: () => {}
    });

    // Échanges
    this.http.get<any[]>(`${environment.apiUrl}/rh/exchanges/my?userId=${userId}`)
      .subscribe({ next: e => this.exchanges.set(e), error: () => {} });
  }

  loadPlanningWeek() {
    const factoryId = this.config.factory()?.id;
    const userId = this.user()?.id;
    if (!factoryId || !userId) return;
    const days = this.weekDays();
    const from = days[0].dateStr;
    const to   = days[6].dateStr;
    this.http.get<any[]>(
      `${environment.apiUrl}/rh/factories/${factoryId}/planning-for-user?userId=${userId}&from=${from}&to=${to}`
    ).subscribe({ next: p => this.planningWeek.set(p), error: () => {} });
  }

  checkPresenceStatus(planningEntryId: string) {
    const userId = this.user()?.id;
    if (!userId) return;
    // Chercher dans les présences liées à ce planning entry
    this.http.get<any[]>(`${environment.apiUrl}/rh/planning/${planningEntryId}/presence-records`)
      .subscribe({
        next: records => {
          const myRecord = records?.find((r: any) => r.userId === userId || r.membreUserId === userId);
          this.dejaPointe.set(myRecord?.present === true);
        },
        error: () => {
          // Fallback — essayer via la sheet
          this.http.get<any>(`${environment.apiUrl}/rh/planning/${planningEntryId}/presences`)
            .subscribe({
              next: sheet => {
                const myLigne = sheet.lignes?.find((l: any) => l.userId === userId);
                this.dejaPointe.set(myLigne?.present === true);
              },
              error: () => {}
            });
        }
      });
  }

  checkIn() {
    const entry = this.quartAujourdhui();
    const userId = this.user()?.id;
    if (!entry || !userId) return;

    this.checkingIn.set(true);
    this.checkinError.set(null);

    if (!navigator.geolocation) {
      this.checkinError.set('Géolocalisation non supportée par ce navigateur');
      this.checkingIn.set(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        this.http.post(`${environment.apiUrl}/rh/checkin`, {
          planningEntryId: entry.id,
          userId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }).subscribe({
          next: () => {
            this.dejaPointe.set(true);
            this.checkingIn.set(false);
          },
          error: (err) => {
            const msg = err.error?.message ?? 'Erreur lors du pointage';
            this.checkinError.set(msg);
            this.checkingIn.set(false);
          }
        });
      },
      () => {
        this.checkinError.set('Impossible d\'obtenir votre position GPS. Vérifiez les permissions du navigateur.');
        this.checkingIn.set(false);
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }

  acceptExchange(id: string) {
    this.http.post(`${environment.apiUrl}/rh/exchanges/${id}/accept`, {})
      .subscribe({ next: () => this.loadAll(), error: () => {} });
  }

  rejectExchange(id: string) {
    this.http.post(`${environment.apiUrl}/rh/exchanges/${id}/reject`, { reason: 'Refusé par l\'opérateur' })
      .subscribe({ next: () => this.loadAll(), error: () => {} });
  }

  prevWeek() {
    this.weekStart.update(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    this.loadPlanningWeek();
  }
  nextWeek() {
    this.weekStart.update(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    this.loadPlanningWeek();
  }

  tauxColor(t: number): string {
    if (t >= 90) return '#00C47A';
    if (t >= 70) return '#FFB700';
    return '#FF4D6D';
  }

  statusLabel(s: string): string {
    const l: Record<string, string> = {
      PENDING_ACCEPT: '⏳ En attente',
      PENDING_CHEF: '👨‍💼 Chez le chef',
      VALIDATED: '✅ Validé',
      REJECTED: '❌ Refusé'
    };
    return l[s] ?? s;
  }

  private getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return date;
  }
}
