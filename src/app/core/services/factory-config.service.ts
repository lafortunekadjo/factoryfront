import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { FactorySummary, ModulesConfig, ShiftConfig, ProductionLine, Product, MachineType, StopType, LossCause } from '../models/models';
import { environment } from '../../../environments/environment';

/**
 * Service central de configuration de l'usine.
 * Chargé au démarrage de l'app, expose tout ce qui est configurable
 * via des Signals Angular 18.
 *
 * Tout composant peut injecter ce service pour accéder à :
 * - la config branding/couleurs
 * - les lignes, produits, quarts, machines
 * - les listes configurables (causes, arrêts...)
 */
@Injectable({ providedIn: 'root' })
export class FactoryConfigService {

  private http = inject(HttpClient);
  private router = inject(Router);

  // ── Signals ─────────────────────────────────────────────
  private _factory = signal<FactorySummary | null>(null);
  private _lines = signal<ProductionLine[]>([]);
  private _shifts = signal<ShiftConfig[]>([]);
  private _machineTypes = signal<MachineType[]>([]);
  private _stopTypes = signal<StopType[]>([]);
  private _lossCauses = signal<LossCause[]>([]);
  private _loaded = signal(false);

  // ── Public computed ──────────────────────────────────────
  readonly factory = computed(() => this._factory());
  readonly lines = computed(() => this._lines());
  readonly shifts = computed(() => this._shifts());
  readonly machineTypes = computed(() => this._machineTypes());
  readonly stopTypes = computed(() => this._stopTypes());
  readonly lossCauses = computed(() => this._lossCauses());
  readonly loaded = computed(() => this._loaded());

  readonly primaryColor = computed(() => this._factory()?.primaryColor ?? '#1976d2');
  readonly secondaryColor = computed(() => this._factory()?.secondaryColor ?? '#00C2FF');
  readonly accentColor = computed(() => this._factory()?.accentColor ?? '#FFB700');
  readonly appTitle = computed(() => this._factory()?.appTitle ?? 'Factory Diagnostic');
  readonly appSubtitle = computed(() => this._factory()?.appSubtitle ?? '');
  readonly logoUrl = computed(() => this._factory()?.logoUrl);
  readonly modules = computed(() => this._factory()?.modules ?? this.defaultModules());
  readonly timezone = computed(() => this._factory()?.timezone ?? 'UTC');
  readonly currency = computed(() => this._factory()?.defaultLanguage ?? 'fr');

  // ── CSS Variables dynamiques ──────────────────────────────
  applyThemeToDocument(): void {
    const factory = this._factory();
    if (!factory) return;

    const root = document.documentElement;
    root.style.setProperty('--factory-primary', factory.primaryColor);
    root.style.setProperty('--factory-secondary', factory.secondaryColor);
    root.style.setProperty('--factory-accent', factory.accentColor ?? '#FFB700');

    // Génère des variantes light/dark automatiquement
    root.style.setProperty('--factory-primary-light', this.lightenColor(factory.primaryColor, 0.8));
    root.style.setProperty('--factory-primary-dark', this.darkenColor(factory.primaryColor, 0.2));
    root.style.setProperty('--factory-secondary-light', this.lightenColor(factory.secondaryColor, 0.8));

    // Favicon dynamique (si logo SVG disponible)
    if (factory.logoUrl) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) link.href = factory.logoUrl;
    }

    // Titre de page
    document.title = factory.appTitle;
  }

  createStopType(factoryId: string, dto: Omit<StopType, 'id'>): Observable<StopType> {
  return this.http.post<StopType>(`${environment.apiUrl}/factories/${factoryId}/stop-types`, dto);
}

refreshStopTypes(factoryId: string): void {
  this.http.get<StopType[]>(`${environment.apiUrl}/factories/${factoryId}/stop-types`)
    .subscribe(data => this._stopTypes.set(data.sort((a, b) => a.displayOrder - b.displayOrder)));
}

refreshLossCauses(factoryId: string): void {
  this.http.get<LossCause[]>(`${environment.apiUrl}/factories/${factoryId}/loss-causes`)
    .subscribe(data => this._lossCauses.set(data.sort((a, b) => a.displayOrder - b.displayOrder)));
}

updateStopType(factoryId: string, dto: StopType): Observable<StopType> {
  return this.http.put<StopType>(`${environment.apiUrl}/factories/${factoryId}/stop-types/${dto.id}`, dto);
}

deleteStopType(factoryId: string, id: string): Observable<void> {
  return this.http.delete<void>(`${environment.apiUrl}/factories/${factoryId}/stop-types/${id}`);
}

// ── LossCauses CRUD ───────────────────────────────────────
createLossCause(factoryId: string, dto: Omit<LossCause, 'id'>): Observable<LossCause> {
  return this.http.post<LossCause>(`${environment.apiUrl}/factories/${factoryId}/loss-causes`, dto);
}

updateLossCause(factoryId: string, dto: LossCause): Observable<LossCause> {
  return this.http.put<LossCause>(`${environment.apiUrl}/factories/${factoryId}/loss-causes/${dto.id}`, dto);
}

deleteLossCause(factoryId: string, id: string): Observable<void> {
  return this.http.delete<void>(`${environment.apiUrl}/factories/${factoryId}/loss-causes/${id}`);
  }

  // ── Chargement ────────────────────────────────────────────
  async loadFactoryConfig(factoryId: string): Promise<void> {
    try {
      const [factory, lines, shifts, machineTypes, stopTypes, lossCauses] = await Promise.all([
        firstValueFrom(this.http.get<FactorySummary>(`${environment.apiUrl}/factories/${factoryId}/summary`)),
        firstValueFrom(this.http.get<ProductionLine[]>(`${environment.apiUrl}/factories/${factoryId}/lines`)),
        firstValueFrom(this.http.get<ShiftConfig[]>(`${environment.apiUrl}/factories/${factoryId}/shifts`)),
        firstValueFrom(this.http.get<MachineType[]>(`${environment.apiUrl}/factories/${factoryId}/machine-types`)),
        firstValueFrom(this.http.get<StopType[]>(`${environment.apiUrl}/factories/${factoryId}/stop-types`)),
        firstValueFrom(this.http.get<LossCause[]>(`${environment.apiUrl}/factories/${factoryId}/loss-causes`)),
      ]);

      this._factory.set(factory);
      this._lines.set(lines);
      this._shifts.set(shifts.sort((a, b) => a.shiftOrder - b.shiftOrder));
      this._machineTypes.set(machineTypes.sort((a, b) => a.displayOrder - b.displayOrder));
      this._stopTypes.set(stopTypes.sort((a, b) => a.displayOrder - b.displayOrder));
      this._lossCauses.set(lossCauses.sort((a, b) => a.displayOrder - b.displayOrder));
      this._loaded.set(true);

      this.applyThemeToDocument();
    } catch (error) {
      console.error('Failed to load factory config:', error);
      throw error;
    }
  }

  getLineById(id: string): ProductionLine | undefined {
    return this._lines().find(l => l.id === id);
  }

  getShiftById(id: string): ShiftConfig | undefined {
    return this._shifts().find(s => s.id === id);
  }

  getMachineTypeById(id: string): MachineType | undefined {
    return this._machineTypes().find(m => m.id === id);
  }

  getProductsForLine(lineId: string): Promise<Product[]> {
    return firstValueFrom(
      this.http.get<Product[]>(`${environment.apiUrl}/lines/${lineId}/products`)
    );
  }

  isModuleEnabled(module: keyof ModulesConfig): boolean {
    return this.modules()[module] ?? false;
  }

  private defaultModules(): ModulesConfig {
    return {
      machines: true, soufflage: true, quart: true,
      pertes: true, maintenance: true, siroperie: true, bilan: true,
      rh: false
    };
  }

  // ── Utilitaires couleur ───────────────────────────────────
  private lightenColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.min(255, Math.round(r + (255 - r) * amount));
    const lg = Math.min(255, Math.round(g + (255 - g) * amount));
    const lb = Math.min(255, Math.round(b + (255 - b) * amount));
    return `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
  }

  private darkenColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.max(0, Math.round(r * (1 - amount)));
    const dg = Math.max(0, Math.round(g * (1 - amount)));
    const db = Math.max(0, Math.round(b * (1 - amount)));
    return `#${dr.toString(16).padStart(2,'0')}${dg.toString(16).padStart(2,'0')}${db.toString(16).padStart(2,'0')}`;
  }
}
