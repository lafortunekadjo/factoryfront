import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { ReportApiService } from '../../core/services/api.services';
import { ModulesConfig } from '../../core/models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard animate-in">

      <!-- Sélection ligne active -->
      @if (lines().length > 1) {
        <div class="line-tabs">
          <button class="line-tab"
                  [class.active]="!selectedLineId()"
                  (click)="selectedLineId.set(null)">
            Toutes les lignes
          </button>
          @for (line of lines(); track line.id) {
            <button class="line-tab"
                    [class.active]="selectedLineId() === line.id"
                    [style.--tab-color]="line.color"
                    (click)="selectedLineId.set(line.id)">
              {{ line.icon ?? '' }} {{ line.name }}
            </button>
          }
        </div>
      }

      <!-- KPIs -->
      <div class="kpi-grid">
        @for (kpi of kpis(); track kpi.label) {
          <div class="kpi-card" [style.--kc]="kpi.color">
            <div class="kpi-icon">{{ kpi.icon }}</div>
            <div class="kpi-value">{{ kpi.value }}</div>
            <div class="kpi-label">{{ kpi.label }}</div>
            @if (kpi.sub) {
              <div class="kpi-sub">{{ kpi.sub }}</div>
            }
          </div>
        }
      </div>

      <!-- Accès rapides -->
      <div class="section-title">Modules</div>
      <div class="modules-grid">
        @for (mod of visibleModules(); track mod.id) {
          <button class="module-card" [routerLink]="mod.route" [style.--mc]="mod.color">
            <div class="module-icon">{{ mod.icon }}</div>
            <div class="module-label">{{ mod.label }}</div>
            <div class="module-desc">{{ mod.desc }}</div>
            <span class="module-arrow">›</span>
          </button>
        }
      </div>

      <!-- Résumé du jour -->
      @if (dayStats()) {
        <div class="section-title">Aujourd'hui — {{ todayStr() }}</div>
        <div class="day-summary factory-card">
          <div class="day-stat">
            <span class="ds-val" style="color: var(--color-info)">{{ dayStats()!.dayBottles | number }}</span>
            <span class="ds-lbl">bouteilles produites</span>
          </div>
          <div class="ds-divider"></div>
          <div class="day-stat">
            <span class="ds-val" style="color: var(--color-danger)">{{ dayStats()!.dayLoss }}</span>
            <span class="ds-lbl">préformes perdues</span>
          </div>
          <div class="ds-divider"></div>
          <div class="day-stat">
            <span class="ds-val" style="color: var(--color-warning)">{{ dayStats()!.openMaintenance }}</span>
            <span class="ds-lbl">pannes ouvertes</span>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .dashboard { max-width: 700px; margin: 0 auto; }

    /* Line tabs */
    .line-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .line-tab {
      padding: 7px 14px; border-radius: 20px; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted);
      font-size: 13px; cursor: pointer; transition: all 0.15s;
    }
    .line-tab.active {
      background: var(--tab-color, var(--factory-primary));
      color: #fff; border-color: transparent; font-weight: 600;
    }

    /* KPIs */
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
    @media(min-width: 480px) { .kpi-grid { grid-template-columns: repeat(4, 1fr); } }
    .kpi-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-top: 3px solid var(--kc); border-radius: var(--border-radius);
      padding: 14px 12px; text-align: center;
    }
    .kpi-icon { font-size: 22px; margin-bottom: 6px; }
    .kpi-value { font-size: 20px; font-weight: 800; color: var(--kc); margin-bottom: 4px; }
    .kpi-label { font-size: 11px; color: var(--text-muted); }
    .kpi-sub { font-size: 10px; color: var(--text-muted); margin-top: 2px; opacity: 0.7; }

    /* Modules */
    .section-title { font-size: 13px; color: var(--text-muted); margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .modules-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .module-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-left: 4px solid var(--mc);
      border-radius: var(--border-radius); padding: 14px 16px;
      cursor: pointer; text-align: left; width: 100%;
      transition: background 0.15s;
    }
    .module-card:hover { background: var(--bg-card2); }
    .module-icon { font-size: 22px; flex-shrink: 0; width: 32px; text-align: center; }
    .module-label { font-weight: 700; font-size: 14px; color: var(--text); flex: 1; }
    .module-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .module-arrow { color: var(--mc); font-size: 22px; margin-left: auto; }

    /* Day summary */
    .day-summary { display: flex; align-items: center; justify-content: space-around; padding: 16px; }
    .day-stat { text-align: center; flex: 1; }
    .ds-val { display: block; font-size: 22px; font-weight: 800; }
    .ds-lbl { font-size: 11px; color: var(--text-muted); }
    .ds-divider { width: 1px; height: 40px; background: var(--border); }
  `]
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  config = inject(FactoryConfigService);
  reportApi = inject(ReportApiService);
  router = inject(Router);

  selectedLineId = signal<string | null>(null);
  dayStats = signal<any>(null);
  lines = this.config.lines;
  modules = this.config.modules;

  todayStr = computed(() => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));

  kpis = computed(() => {
    const ds = this.dayStats();
    return [
      { icon: '🍾', label: "Bouteilles aujourd'hui", value: ds ? (ds.dayBottles as number).toLocaleString('fr') : '–', color: 'var(--color-info)', sub: null },
      { icon: '📅', label: 'Bouteilles ce mois', value: ds ? (ds.monthBottles as number).toLocaleString('fr') : '–', color: 'var(--factory-primary)', sub: null },
      { icon: '⚠️', label: 'Pertes préformes', value: ds ? ds.dayLoss.toString() : '–', color: 'var(--color-danger)', sub: 'aujourd\'hui' },
      { icon: '🛠️', label: 'Pannes ouvertes', value: ds ? ds.openMaintenance.toString() : '–', color: 'var(--color-warning)', sub: 'en cours' },
    ];
  });

  private allModules = [
    { id: 'machines',    icon: '🔧', label: 'Diagnostic Machines',  desc: 'Pannes, causes, actions correctives', route: '/machines',    module: 'machines' as keyof ModulesConfig,    permission: 'MACHINES_READ',    color: '#00C2FF' },
    { id: 'soufflage',   icon: '💨', label: 'Paramètres Soufflage', desc: 'Réglages terrain par ligne et produit', route: '/soufflage', module: 'soufflage' as keyof ModulesConfig,   permission: 'SOUFFLAGE_READ',   color: '#FF6B00' },
    { id: 'quart',       icon: '📋', label: 'Suivi de Quart',       desc: 'Saisir la production de chaque quart', route: '/quart',      module: 'quart' as keyof ModulesConfig,       permission: 'QUART_READ',       color: '#00E5A0' },
    { id: 'pertes',      icon: '🗑️', label: 'Pertes Préformes',     desc: 'Suivre et analyser les pertes',        route: '/pertes',     module: 'pertes' as keyof ModulesConfig,      permission: 'PERTES_READ',      color: '#FF4D6D' },
    { id: 'maintenance', icon: '🛠️', label: 'Maintenance Méca/Élec',desc: 'Journal des pannes par technicien',    route: '/maintenance',module: 'maintenance' as keyof ModulesConfig, permission: 'MAINTENANCE_READ', color: '#A855F7' },
    { id: 'siroperie',   icon: '🧪', label: 'Siroperie',            desc: 'Suivi du niveau de sirop dans le tank',route: '/siroperie',  module: 'siroperie' as keyof ModulesConfig,   permission: 'SIROPERIE_READ',   color: '#10B981' },
    { id: 'bilan',       icon: '📊', label: 'Bilan Mensuel',        desc: 'Rapport de production par mois',       route: '/bilan',      module: 'bilan' as keyof ModulesConfig,       permission: 'BILAN_READ',       color: '#FFB700' },
  ];

  visibleModules = computed(() => {
    const mods = this.modules();
    return this.allModules.filter(m => {
      if (!mods[m.module]) return false;
      if (!this.auth.hasPermission(m.permission)) return false;
      return true;
    });
  });

  ngOnInit() {
    this.loadKpis();
  }

  loadKpis() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId) return;
    const today = new Date().toISOString().split('T')[0];
    this.reportApi.getDashboardKpi(factoryId, today).subscribe({
      next: (data) => this.dayStats.set(data),
      error: () => {} // Silencieux — KPIs indisponibles si pas de données
    });
  }
}
