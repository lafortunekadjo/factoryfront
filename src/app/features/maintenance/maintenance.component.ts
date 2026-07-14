import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { MaintenanceApiService } from '../../core/services/api.services';
import { AuthService } from '../../core/services/auth.service';
import { MaintenanceRecord } from '../../core/models/models';
import { environment } from '../../../environments/environment';

interface LineMachine {
  id: string;
  productionLineId: string;
  productionLineName: string;
  machineTypeId: string;
  machineTypeLabel: string;
  machineTypeColor: string;
  instanceNumber: number;
  displayName: string;
}

interface MachineGroup {
  machineTypeId: string;
  label: string;
  color: string;
  lineName: string;
  machines: LineMachine[];
}

type MaintTab = 'journal' | 'new';

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="maintenance animate-in">

      <div class="maint-header">
        <h2 class="page-title">🛠️ Maintenance</h2>
        <div class="header-stats">
          <span class="hs-badge warning">{{ openCount() }} ouvert(s)</span>
          <span class="hs-badge danger">{{ critCount() }} critique(s)</span>
        </div>
      </div>

      <div class="maint-tabs">
        <button class="maint-tab" [class.active]="tab() === 'journal'" (click)="tab.set('journal')">📋 Journal</button>
        <button class="maint-tab" [class.active]="tab() === 'new'" (click)="tab.set('new')">+ Nouvelle intervention</button>
      </div>

      @if (tab() === 'new') {
        <div class="maint-form factory-card">

          <div class="row-2">
            <div>
              <label class="factory-label">Date</label>
              <input class="factory-input" type="date" [(ngModel)]="form.date" />
            </div>
            <div>
              <label class="factory-label">Quart</label>
              <select class="factory-input" [(ngModel)]="form.shiftId">
                @for (s of shifts(); track s.id) {
                  <option [value]="s.id">{{ s.name }}</option>
                }
              </select>
            </div>
          </div>

          <label class="factory-label" style="margin-top: 14px;">Machine *</label>

          @if (loadingMachines()) {
            <div class="info-box">⏳ Chargement des machines...</div>
          } @else if (lineMachines().length === 0) {
            <div class="info-box warn">⚠️ Aucune machine trouvée pour cette usine</div>
          } @else {
            <select class="factory-input machine-select"
                    [(ngModel)]="form.lineMachineId"
                    name="lineMachineId">
              <option value="">-- Choisir une machine --</option>
              @for (group of machineGroups(); track group.machineTypeId) {
                <optgroup [label]="group.label + ' — ' + group.lineName">
                  @for (lm of group.machines; track lm.id) {
                    <option [value]="lm.id">{{ lm.displayName }}</option>
                  }
                </optgroup>
              }
            </select>
          }

          <div class="row-2" style="margin-top: 14px;">
            <div>
              <label class="factory-label">Type</label>
              <div class="type-btns">
                <button type="button" class="type-btn" [class.active-meca]="form.type === 'MECANIQUE'" (click)="form.type = 'MECANIQUE'">🔧 Méca</button>
                <button type="button" class="type-btn" [class.active-elec]="form.type === 'ELECTRIQUE'" (click)="form.type = 'ELECTRIQUE'">⚡ Élec</button>
              </div>
            </div>
            <div>
              <label class="factory-label">Sévérité</label>
              <div class="sev-btns">
                <button type="button" class="sev-btn mineur"   [class.active]="form.severity === 'MINEUR'"   (click)="form.severity = 'MINEUR'">Mineur</button>
                <button type="button" class="sev-btn majeur"   [class.active]="form.severity === 'MAJEUR'"   (click)="form.severity = 'MAJEUR'">Majeur</button>
                <button type="button" class="sev-btn critique" [class.active]="form.severity === 'CRITIQUE'" (click)="form.severity = 'CRITIQUE'">Critique</button>
              </div>
            </div>
          </div>

          <label class="factory-label" style="margin-top: 14px;">Description de la panne *</label>
          <textarea class="factory-input" [(ngModel)]="form.defectDescription" rows="3"
                    placeholder="Décrivez le symptôme observé..."></textarea>

          <label class="factory-label" style="margin-top: 11px;">Cause racine (si connue)</label>
          <textarea class="factory-input" [(ngModel)]="form.rootCause" rows="2"
                    placeholder="Usure, corrosion, mauvais réglage..."></textarea>

          <label class="factory-label" style="margin-top: 11px;">Action réalisée</label>
          <textarea class="factory-input" [(ngModel)]="form.actionTaken" rows="2"
                    placeholder="Remplacement pièce X, réglage Y..."></textarea>

          <div style="margin-top: 11px;">
            <label class="factory-label">Durée intervention (min)</label>
            <input class="factory-input" type="number" [(ngModel)]="form.durationMinutes"
                   placeholder="ex: 45" style="max-width: 120px;" />
          </div>

          <button class="btn-factory-primary" style="margin-top: 16px; background: #A855F7;"
                  [disabled]="!form.defectDescription || !form.lineMachineId || saving()"
                  (click)="save()">
            {{ saving() ? '⏳ Enregistrement...' : '💾 Enregistrer l\'intervention' }}
          </button>

          @if (form.defectDescription && !form.lineMachineId) {
            <div class="warn-hint">⚠️ Sélectionne d'abord une machine</div>
          }
        </div>
      }

      @if (tab() === 'journal') {
        <div class="filter-bar">
          <select class="factory-input" [(ngModel)]="filterStatus">
            <option value="">Tous les statuts</option>
            <option value="EN_COURS">En cours</option>
            <option value="RESOLU">Résolu</option>
            <option value="EN_ATTENTE_PIECE">En attente pièce</option>
            <option value="ESCALADE">Escaladé</option>
          </select>
          <select class="factory-input" [(ngModel)]="filterSeverity">
            <option value="">Toutes sévérités</option>
            <option value="CRITIQUE">Critique</option>
            <option value="MAJEUR">Majeur</option>
            <option value="MINEUR">Mineur</option>
          </select>
        </div>

        @if (loading()) {
          <div class="center-msg">Chargement...</div>
        }

        @for (r of filtered(); track r.id) {
          <div class="maint-card factory-card" [class]="'sev-' + r.severity.toLowerCase()">
            <div class="mc-top">
              <div>
                <div class="mc-machine" [style.color]="r.machineColor ?? 'var(--factory-secondary)'">
                  {{ r.machineLabel }}
                </div>
                <div class="mc-meta">{{ r.productionDate }} · {{ r.shiftName }} · {{ r.technicianName }}</div>
              </div>
              <div class="mc-badges">
                <span class="badge-sev"    [class]="r.severity.toLowerCase()">{{ r.severity }}</span>
                <span class="badge-status" [class]="statusClass(r.status)">{{ statusLabel(r.status) }}</span>
              </div>
            </div>

            <div class="mc-defect">{{ r.defectDescription }}</div>

            @if (r.actionTaken) {
              <div class="mc-action">✅ {{ r.actionTaken }}</div>
            }

            @if (r.status !== 'RESOLU') {
              <div class="mc-actions-row">
                <button class="status-btn resolu"  (click)="updateStatus(r, 'RESOLU')">✔ Résolu</button>
                @if (r.status !== 'EN_ATTENTE_PIECE') {
                  <button class="status-btn attente" (click)="updateStatus(r, 'EN_ATTENTE_PIECE')">⏳ Attente pièce</button>
                }
                @if (r.status !== 'ESCALADE') {
                  <button class="status-btn escalade" (click)="updateStatus(r, 'ESCALADE')">🚨 Escalader</button>
                }
              </div>
            }
          </div>
        }

        @if (!loading() && filtered().length === 0) {
          <div class="center-msg">
            <div style="font-size: 40px; margin-bottom: 8px;">✅</div>
            <p>Aucune intervention</p>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .maintenance { max-width: 700px; margin: 0 auto; }

    .maint-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .page-title { font-size: 18px; font-weight: 700; margin: 0; }
    .header-stats { display: flex; gap: 8px; }
    .hs-badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; }
    .hs-badge.warning { background: #FFB70022; color: var(--color-warning); border: 1px solid #FFB70044; }
    .hs-badge.danger  { background: #FF4D6D22; color: var(--color-danger);  border: 1px solid #FF4D6D44; }

    .maint-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .maint-tab { flex: 1; padding: 10px; border-radius: var(--border-radius-sm); background: var(--bg-card); border: 1px solid var(--border); color: var(--text-muted); cursor: pointer; font-size: 13px; font-weight: 500; }
    .maint-tab.active { background: #A855F7; color: #fff; border-color: transparent; }

    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    .info-box { padding: 10px 14px; background: var(--bg-card2); border-radius: 8px; font-size: 13px; color: var(--text-muted); }

    /* Select machine */
    .machine-select {
      width: 100%;
      appearance: auto;
      cursor: pointer;
    }
    .machine-select option, .machine-select optgroup {
      background: #111827;
      color: #E8EAF0;
    }
    .info-box.warn { color: var(--color-warning); background: #FFB70011; border: 1px solid #FFB70033; }

    /* Machine groups */
    .machine-groups { display: flex; flex-direction: column; gap: 10px; }
    .machine-group { background: var(--bg-card2); border: 1px solid var(--border); border-radius: var(--border-radius-sm); padding: 10px 12px; }
    .mg-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .mg-line { font-size: 10px; font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--text-muted); background: var(--border); padding: 2px 8px; border-radius: 10px; }
    .mg-btns { display: flex; flex-wrap: wrap; gap: 6px; }

    .machine-btn {
      padding: 8px 16px; border-radius: 8px;
      border: 1px solid var(--c, var(--border));
      background: transparent; color: var(--text-muted);
      cursor: pointer; font-size: 13px; font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }
    .machine-btn:hover { background: color-mix(in srgb, var(--c, #888) 15%, transparent); color: var(--text); }
    .machine-btn.selected { background: var(--c, var(--factory-primary)); color: #fff; border-color: transparent; font-weight: 700; }

    .selected-badge { margin-top: 8px; padding: 8px 12px; background: #A855F711; border: 1px solid #A855F733; border-radius: 8px; font-size: 13px; color: #A855F7; }
    .required-hint { margin-top: 6px; font-size: 12px; color: var(--text-muted); font-style: italic; }
    .warn-hint { margin-top: 8px; font-size: 12px; color: var(--color-warning); }

    .type-btns, .sev-btns { display: flex; gap: 6px; }
    .type-btn { flex: 1; padding: 9px 6px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card2); color: var(--text-muted); cursor: pointer; font-size: 12px; }
    .type-btn.active-meca { background: #A855F7; color: #fff; border-color: transparent; }
    .type-btn.active-elec { background: #FFB700; color: #000; border-color: transparent; }
    .sev-btn { flex: 1; padding: 8px 4px; border-radius: 8px; border: 1px solid; background: none; cursor: pointer; font-size: 12px; font-weight: 600; }
    .sev-btn.mineur   { color: var(--severity-mineur);   border-color: var(--severity-mineur);   }
    .sev-btn.majeur   { color: var(--severity-majeur);   border-color: var(--severity-majeur);   }
    .sev-btn.critique { color: var(--severity-critique); border-color: var(--severity-critique); }
    .sev-btn.mineur.active   { background: var(--severity-mineur);   color: #000; }
    .sev-btn.majeur.active   { background: var(--severity-majeur);   color: #000; }
    .sev-btn.critique.active { background: var(--severity-critique); color: #fff; }

    .filter-bar { display: flex; gap: 8px; margin-bottom: 12px; }
    .filter-bar .factory-input { flex: 1; }

    .maint-card { border-left: 4px solid var(--border); margin-bottom: 8px; }
    .maint-card.sev-mineur   { border-left-color: var(--severity-mineur);   }
    .maint-card.sev-majeur   { border-left-color: var(--severity-majeur);   }
    .maint-card.sev-critique { border-left-color: var(--severity-critique); }
    .mc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .mc-machine { font-weight: 700; font-size: 14px; margin-bottom: 2px; }
    .mc-meta { font-size: 11px; color: var(--text-muted); }
    .mc-badges { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
    .badge-sev  { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .badge-sev.mineur   { background: #00E5A022; color: var(--severity-mineur);   }
    .badge-sev.majeur   { background: #FFB70022; color: var(--severity-majeur);   }
    .badge-sev.critique { background: #FF4D6D22; color: var(--severity-critique); }
    .badge-status { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .badge-status.en-cours  { background: #FFB70022; color: #FFB700; }
    .badge-status.resolu    { background: #00E5A022; color: #00E5A0; }
    .badge-status.en-attente{ background: #00C2FF22; color: #00C2FF; }
    .badge-status.escalade  { background: #FF4D6D22; color: #FF4D6D; }
    .mc-defect { font-size: 13px; margin-bottom: 6px; }
    .mc-action { font-size: 12px; color: var(--color-success); background: #00E5A011; padding: 5px 8px; border-radius: 6px; }
    .mc-actions-row { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
    .status-btn { padding: 6px 12px; border-radius: 16px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; }
    .status-btn.resolu  { background: #00E5A022; color: var(--color-success); }
    .status-btn.attente { background: #00C2FF22; color: var(--color-info); }
    .status-btn.escalade{ background: #FF4D6D22; color: var(--color-danger); }

    .center-msg { text-align: center; color: var(--text-muted); padding: 32px 0; }
  `]
})
export class MaintenanceComponent implements OnInit {
  config           = inject(FactoryConfigService);
  maintApi         = inject(MaintenanceApiService);
  auth             = inject(AuthService);
  http             = inject(HttpClient);

  tab              = signal<MaintTab>('journal');
  saving           = signal(false);
  loading          = signal(false);
  loadingMachines  = signal(false);
  records          = signal<MaintenanceRecord[]>([]);
  lineMachines     = signal<LineMachine[]>([]);
  filterStatus     = '';
  filterSeverity   = '';

  shifts = this.config.shifts;

  openCount = computed(() =>
    this.records().filter(r => r.status === 'EN_COURS' || r.status === 'EN_ATTENTE_PIECE').length
  );
  critCount = computed(() =>
    this.records().filter(r => r.severity === 'CRITIQUE' && r.status !== 'RESOLU').length
  );
  filtered = computed(() =>
    this.records().filter(r => {
      if (this.filterStatus   && r.status   !== this.filterStatus)   return false;
      if (this.filterSeverity && r.severity !== this.filterSeverity) return false;
      return true;
    })
  );

  machineGroups = computed<MachineGroup[]>(() => {
    const map = new Map<string, MachineGroup>();
    for (const lm of this.lineMachines()) {
      const key = lm.machineTypeId + '__' + lm.productionLineId;
      if (!map.has(key)) {
        map.set(key, {
          machineTypeId: lm.machineTypeId,
          label:    lm.machineTypeLabel,
          color:    lm.machineTypeColor || 'var(--factory-primary)',
          lineName: lm.productionLineName,
          machines: []
        });
      }
      map.get(key)!.machines.push(lm);
    }
    return Array.from(map.values());
  });

  selectedMachineName = computed(() => {
    const lm = this.lineMachines().find(m => m.id === this.form.lineMachineId);
    return lm ? lm.displayName + ' — ' + lm.productionLineName : '';
  });

  form = this.emptyForm();

  emptyForm() {
    return {
      date: new Date().toISOString().split('T')[0],
      shiftId: '',
      lineMachineId: '',
      type: 'MECANIQUE',
      severity: 'MAJEUR',
      defectDescription: '',
      rootCause: '',
      actionTaken: '',
      durationMinutes: null as number | null
    };
  }

  ngOnInit() {
    const s = this.shifts();
    if (s.length) this.form.shiftId = s[0].id;
    this.loadLineMachines();
    this.loadRecords();
  }

  loadLineMachines() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.loadingMachines.set(true);
    this.http
      .get<LineMachine[]>(`${environment.apiUrl}/factories/${factoryId}/line-machines`)
      .subscribe({
        next:  machines => { this.lineMachines.set(machines); this.loadingMachines.set(false); },
        error: ()       => this.loadingMachines.set(false)
      });
  }

  // Seule méthode qui écrit dans lineMachineId — pas de [(ngModel)] sur ce champ
  selectMachine(id: string) {
    this.form.lineMachineId = id;
  }

  loadRecords() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    this.loading.set(true);
    const to   = new Date();
    const from = new Date(); from.setDate(from.getDate() - 30);
    this.maintApi.findByFactory(
      factoryId,
      from.toISOString().split('T')[0],
      to.toISOString().split('T')[0]
    ).subscribe({
      next:  p  => { this.records.set(p.content); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  save() {
    if (!this.form.lineMachineId || !this.form.defectDescription) return;
    this.saving.set(true);
    this.maintApi.create({
      lineMachineId:     this.form.lineMachineId,
      shiftConfigId:     this.form.shiftId,
      productionDate:    this.form.date,
      maintenanceType:   this.form.type,
      severity:          this.form.severity,
      defectDescription: this.form.defectDescription,
      rootCause:         this.form.rootCause    || undefined,
      actionTaken:       this.form.actionTaken  || undefined,
      durationMinutes:   this.form.durationMinutes || undefined
    }).subscribe({
      next: r => {
        this.records.update(list => [r, ...list]);
        this.saving.set(false);
        this.tab.set('journal');
        this.form = this.emptyForm();
        const s = this.shifts();
        if (s.length) this.form.shiftId = s[0].id;
      },
      error: () => this.saving.set(false)
    });
  }

  updateStatus(record: MaintenanceRecord, status: string) {
    this.maintApi.updateStatus(record.id, status).subscribe({
      next: updated =>
        this.records.update(list => list.map(r => r.id === updated.id ? updated : r))
    });
  }

  statusLabel(status: string): string {
    const m: Record<string, string> = {
      EN_COURS: 'En cours', RESOLU: 'Résolu',
      EN_ATTENTE_PIECE: 'Attente pièce', ESCALADE: 'Escaladé'
    };
    return m[status] ?? status;
  }

  statusClass(status: string): string {
    const m: Record<string, string> = {
      EN_COURS: 'en-cours', RESOLU: 'resolu',
      EN_ATTENTE_PIECE: 'en-attente', ESCALADE: 'escalade'
    };
    return m[status] ?? '';
  }
}
