import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { DiagnosticApiService } from '../../core/services/api.services';
import { AuthService } from '../../core/services/auth.service';
import { LineSelectorComponent } from '../../shared/components/line-selector/line-selector.component';
import { ProductionLine, Product, BlowingParam } from '../../core/models/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-soufflage',
  standalone: true,
  imports: [CommonModule, FormsModule, LineSelectorComponent],
  template: `
    <div class="soufflage animate-in">

      @if (!selectedLine()) {
        <app-line-selector (lineSelected)="onLineSelected($event)" />
      } @else {

        <button class="back-btn" (click)="selectedLine.set(null)">← Accueil</button>

        <!-- Sélection produit -->
        <div class="section-title">💨 Paramètres Soufflage — {{ selectedLine()!.name }}</div>

        <div class="product-grid">
          @for (p of products(); track p.id) {
            <button class="product-btn"
                    [class.active]="selectedProduct()?.id === p.id"
                    [style.--pc]="p.brandColor ?? '#00C2FF'"
                    (click)="selectProduct(p)">
              <div class="pb-dot" [style.background]="p.brandColor ?? '#00C2FF'"></div>
              <div>
                <div class="pb-name">{{ p.name }}</div>
                <div class="pb-vol">{{ p.volume }}</div>
              </div>
              @if (hasParam(p.id)) {
                <span class="pb-check">✓</span>
              }
            </button>
          }
        </div>

        @if (selectedProduct() && currentParam()) {
          <div class="param-card factory-card">

            <!-- Header produit -->
            <div class="pc-header" [style.border-color]="selectedProduct()!.brandColor ?? '#00C2FF'">
              <div>
                <div class="pc-product" [style.color]="selectedProduct()!.brandColor ?? '#00C2FF'">
                  {{ selectedProduct()!.name }} {{ selectedProduct()!.volume }}
                </div>
                @if (currentParam()!.updatedAt) {
                  <div class="pc-updated">Mis à jour : {{ currentParam()!.updatedAt | date:'dd/MM/yyyy HH:mm' }}</div>
                }
              </div>
              <div class="pc-speed-badge">
                {{ currentParam()!.nominalSpeed ?? selectedProduct()!.nominalSpeed ?? '—' }} bt/h
              </div>
            </div>

            @if (currentParam()!.typePreformeNom) {
              <div class="preforme-badge">
                🧴 {{ currentParam()!.typePreformeNom }}
              </div>
            }

            <!-- Niveaux de chauffe four -->
            <div class="section-label">🔥 Niveaux de chauffe four (N1–N{{ heatCount }})</div>
            <div class="heat-grid">
              @for (level of editForm.heatLevels; track $index; let i = $index) {
                <div class="heat-cell">
                  <div class="heat-label">N{{ i + 1 }}</div>
                  <input class="heat-input factory-input"
                         type="number"
                         [(ngModel)]="editForm.heatLevels[i]"
                         [style.border-color]="heatColor(editForm.heatLevels[i])" />
                  <div class="heat-bar">
                    <div class="heat-fill"
                         [style.width.%]="(editForm.heatLevels[i] ?? 0) / 100 * 100"
                         [style.background]="heatColor(editForm.heatLevels[i])">
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- Paramètres process -->
            <div class="section-label">⚙️ Paramètres process</div>
            <div class="params-grid">
              <div class="param-row">
                <label class="factory-label">Capacité chauffe (%)</label>
                <input class="factory-input" type="number" [(ngModel)]="editForm.heatingCapacityPct" />
              </div>
              <div class="param-row">
                <label class="factory-label">Vitesse étirage</label>
                <input class="factory-input" type="number" step="0.1" [(ngModel)]="editForm.stretchingSpeed" />
              </div>
              <div class="param-row">
                <label class="factory-label">Pression P1 (bar)</label>
                <input class="factory-input" type="number" step="0.1" [(ngModel)]="editForm.pressureP1Bar" />
              </div>
              <div class="param-row">
                <label class="factory-label">Pression P2 (bar)</label>
                <input class="factory-input" type="number" step="0.1" [(ngModel)]="editForm.pressureP2Bar" />
              </div>
              <div class="param-row">
                <label class="factory-label">Début P1 (%)</label>
                <input class="factory-input" type="number" [(ngModel)]="editForm.p1StartPct" />
              </div>
              <div class="param-row">
                <label class="factory-label">Temp. démoule (°C)</label>
                <input class="factory-input" type="number" [(ngModel)]="editForm.releaseTempCelsius" />
              </div>
              <div class="param-row">
                <label class="factory-label">Cadence nominale (bt/h)</label>
                <input class="factory-input" type="number" [(ngModel)]="editForm.nominalSpeed" />
              </div>
            </div>

            <div style="margin-top: 11px;">
              <label class="factory-label">Type de préforme</label>
              <select class="factory-input" [(ngModel)]="editForm.typePreformeId">
                <option value="">-- Sélectionner une préforme --</option>
                @for (tp of typePreformes(); track tp.id) {
                  <option [value]="tp.id">
                    {{ tp.nom }}
                    @if (tp.fournisseur) { ({{ tp.fournisseur }}) }
                    @if (tp.poidsG) { — {{ tp.poidsG }}g }
                  </option>
                }
              </select>
              @if (!typePreformes().length) {
                <div class="field-hint">⚙️ Configurez les types de préformes dans Config → Préformes</div>
              }
            </div>

            <div style="margin-top: 11px;">
              <label class="factory-label">Notes / observations</label>
              <textarea class="factory-input" [(ngModel)]="editForm.notes" rows="2" placeholder="Paramètres validés le..."></textarea>
            </div>

            <button class="btn-factory-primary" style="margin-top: 14px;"
                    [disabled]="saving()"
                    (click)="saveParam()">
              {{ saving() ? '⏳ Enregistrement...' : '💾 Enregistrer les paramètres' }}
            </button>
          </div>
        }

        @if (selectedProduct() && !currentParam() && !loading()) {
          <div class="empty-state">
            <div style="font-size: 36px;">💨</div>
            <p>Aucun paramètre pour ce produit</p>
            <button class="btn-factory-primary" style="max-width: 220px; margin: 0 auto;" (click)="initNewParam()">
              + Créer les paramètres
            </button>
          </div>
        }

        @if (loading()) {
          <div class="loading-msg">Chargement des paramètres...</div>
        }
      }
    </div>
  `,
  styles: [`
    .soufflage { max-width: 700px; margin: 0 auto; }
    .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0 0 12px; font-size: 14px; }
    .section-title { font-size: 16px; font-weight: 700; margin-bottom: 14px; }
    .section-label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 10px; }

    /* Product grid */
    .product-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .product-btn {
      display: flex; align-items: center; gap: 10px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--border-radius); padding: 12px 14px;
      cursor: pointer; text-align: left; transition: all 0.15s;
    }
    .product-btn.active { border-color: var(--pc); background: color-mix(in srgb, var(--pc) 8%, var(--bg-card)); }
    .pb-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .pb-name { font-weight: 700; font-size: 14px; color: var(--text); }
    .pb-vol { font-size: 12px; color: var(--text-muted); }
    .pb-check { margin-left: auto; color: var(--color-success); font-weight: 700; }

    /* Param card */
    .param-card { border-radius: var(--border-radius); }
    .pc-header { display: flex; justify-content: space-between; align-items: flex-start; border-left: 3px solid; padding-left: 10px; margin-bottom: 6px; }
    .pc-product { font-size: 16px; font-weight: 800; margin-bottom: 2px; }
    .pc-updated { font-size: 11px; color: var(--text-muted); }
    .pc-speed-badge { background: var(--factory-primary-light); color: var(--factory-primary); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }

    /* Heat grid */
    .heat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    @media(min-width: 480px) { .heat-grid { grid-template-columns: repeat(6, 1fr); } }
    .heat-cell { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .heat-label { font-size: 10px; color: var(--text-muted); font-weight: 700; }
    .heat-input { width: 100%; text-align: center; padding: 8px 4px; font-size: 14px; font-weight: 700; }
    .heat-bar { width: 100%; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
    .heat-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }

    /* Params grid */
    .params-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media(min-width: 480px) { .params-grid { grid-template-columns: repeat(3, 1fr); } }
    .param-row { display: flex; flex-direction: column; }

    .empty-state { text-align: center; padding: 40px 0; color: var(--text-muted); }
    .loading-msg { text-align: center; color: var(--text-muted); padding: 32px 0; }
    .preforme-badge { display: inline-block; margin: 8px 0; padding: 4px 12px; background: var(--bg-card2); border: 1px solid var(--border); border-radius: 20px; font-size: 12px; font-weight: 600; }
    .field-hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  `]
})
export class SoufflageComponent implements OnInit {
  config  = inject(FactoryConfigService);
  diagApi = inject(DiagnosticApiService);
  auth    = inject(AuthService);
  http    = inject(HttpClient);

  selectedLine    = signal<ProductionLine | null>(null);
  selectedProduct = signal<Product | null>(null);
  products        = signal<Product[]>([]);
  params          = signal<BlowingParam[]>([]);
  typePreformes   = signal<any[]>([]);
  loading         = signal(false);
  saving          = signal(false);

  heatCount = 12;

  currentParam = signal<BlowingParam | null>(null);
  editForm: any = this.emptyForm();

  emptyForm() {
    return {
      heatLevels: Array(this.heatCount).fill(0),
      heatingCapacityPct: null, stretchingSpeed: null,
      pressureP1Bar: null, pressureP2Bar: null,
      p1StartPct: null, releaseTempCelsius: null,
      nominalSpeed: null, notes: '', typePreformeId: ''
    };
  }

  ngOnInit() {}

  async onLineSelected(line: ProductionLine) {
    this.selectedLine.set(line);
    this.selectedProduct.set(null);
    this.currentParam.set(null);
    this.products.set(await this.config.getProductsForLine(line.id));
    this.loadParams(line.id);
    this.loadTypePreformes();
  }

  loadTypePreformes() {
    const factoryId = this.auth.currentFactory()?.id;
    if (!factoryId || this.typePreformes().length) return;
    this.http.get<any[]>(`${environment.apiUrl}/soufflage/factories/${factoryId}/type-preformes`)
      .subscribe({ next: tp => this.typePreformes.set(tp), error: () => {} });
  }

  loadParams(lineId: string) {
    this.loading.set(true);
    this.diagApi.getBlowingParams(lineId).subscribe({
      next: (p) => { this.params.set(p); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  hasParam(productId: string): boolean {
    return this.params().some(p => p.productId === productId);
  }

  selectProduct(p: Product) {
    this.selectedProduct.set(p);
    const existing = this.params().find(param => param.productId === p.id) ?? null;
    this.currentParam.set(existing);
    if (existing) {
      this.editForm = {
        heatLevels: [...(existing.heatLevels ?? Array(this.heatCount).fill(0))],
        heatingCapacityPct: existing.heatingCapacityPct,
        stretchingSpeed: existing.stretchingSpeed,
        pressureP1Bar: existing.pressureP1Bar,
        pressureP2Bar: existing.pressureP2Bar,
        p1StartPct: existing.p1StartPct,
        releaseTempCelsius: existing.releaseTempCelsius,
        nominalSpeed: existing.nominalSpeed,
        notes: existing.notes ?? '',
        typePreformeId: existing.typePreformeId ?? ''
      };
    }
  }

  initNewParam() {
    this.currentParam.set({} as any);
    this.editForm = this.emptyForm();
  }

  saveParam() {
    const line = this.selectedLine();
    const product = this.selectedProduct();
    if (!line || !product) return;
    this.saving.set(true);

    this.diagApi.saveBlowingParam(line.id, {
      productId: product.id,
      ...this.editForm
    }).subscribe({
      next: (saved) => {
        this.params.update(p => {
          const idx = p.findIndex(x => x.productId === product.id);
          return idx >= 0 ? p.map((x, i) => i === idx ? saved : x) : [...p, saved];
        });
        this.currentParam.set(saved);
        this.saving.set(false);
      },
      error: () => this.saving.set(false)
    });
  }

  heatColor(val: number): string {
    if (!val || val <= 0) return 'var(--border)';
    if (val < 30) return '#00C2FF';
    if (val < 55) return '#00E5A0';
    if (val < 75) return '#FFB700';
    return '#FF4D6D';
  }
}
