import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { SiropApiService } from '../../core/services/api.services';
import { LineSelectorComponent } from '../../shared/components/line-selector/line-selector.component';
import { ProductionLine, Product, SiropRecord } from '../../core/models/models';

@Component({
  selector: 'app-siroperie',
  standalone: true,
  imports: [CommonModule, FormsModule, LineSelectorComponent, DecimalPipe],
  template: `
    <div class="siroperie animate-in">

      @if (!selectedLine()) {
        <app-line-selector (lineSelected)="onLineSelected($event)" />
      } @else {

        <div class="siro-header">
          <button class="back-btn" (click)="selectedLine.set(null)">← Accueil</button>
          <button class="btn-new" (click)="showForm.set(!showForm())">
            {{ showForm() ? '✕ Annuler' : '+ Nouveau relevé' }}
          </button>
        </div>

        <!-- Gauge niveau actuel -->
        @if (latestRecord()) {
          <div class="tank-gauge factory-card">
            <div class="tg-label">🧪 Niveau actuel du tank</div>
            <div class="tg-product" [style.color]="latestProduct()?.brandColor ?? 'var(--color-info)'">
              {{ latestProduct()?.name ?? 'Produit' }}
            </div>
            <div class="gauge-wrap">
              <div class="gauge-bg">
                <div class="gauge-fill"
                     [style.height.%]="latestRecord()!.remainingPct ?? 0"
                     [style.background]="gaugeColor(latestRecord()!.remainingPct)">
                </div>
                <div class="gauge-line" [style.bottom.%]="20"></div>
                <div class="gauge-pct">{{ latestRecord()!.remainingPct ?? '—' }}%</div>
              </div>
              <div class="gauge-info">
                <div class="gi-row">
                  <span class="gi-label">Volume actuel</span>
                  <span class="gi-val" [style.color]="gaugeColor(latestRecord()!.remainingPct)">
                    {{ latestRecord()!.currentVolumeLiters | number:'1.0-0' }} L
                  </span>
                </div>
                @if (latestRecord()!.consumedLiters != null) {
                  <div class="gi-row">
                    <span class="gi-label">Consommé</span>
                    <span class="gi-val">{{ latestRecord()!.consumedLiters | number:'1.0-0' }} L</span>
                  </div>
                }
                @if (latestRecord()!.bottlesAtReading) {
                  <div class="gi-row">
                    <span class="gi-label">Bouteilles au relevé</span>
                    <span class="gi-val">{{ latestRecord()!.bottlesAtReading | number }}</span>
                  </div>
                }
                <div class="gi-row">
                  <span class="gi-label">Relevé à</span>
                  <span class="gi-val">{{ latestRecord()!.recordedAt | date:'HH:mm' }}</span>
                </div>
              </div>
            </div>

            @if ((latestRecord()!.remainingPct ?? 100) <= 20) {
              <div class="alert-low">⚠️ Niveau bas — prévoir réapprovisionnement !</div>
            }
          </div>
        }

        <!-- Formulaire -->
        @if (showForm()) {
          <div class="siro-form factory-card" style="border-color: #10B98133;">
            <div class="form-title" style="color: #10B981;">🧪 Nouveau relevé siroperie</div>

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

            <label class="factory-label">Produit en cours</label>
            <select class="factory-input" [(ngModel)]="form.productId">
              <option value="">-- Sélectionner --</option>
              @for (p of products(); track p.id) {
                <option [value]="p.id">{{ p.name }} {{ p.volume }}</option>
              }
            </select>

            <div class="row-2" style="margin-top: 11px;">
              <div>
                <label class="factory-label">Volume initial du tank (L)</label>
                <input class="factory-input" type="number" step="10" [(ngModel)]="form.initialVolume" placeholder="ex: 1000" />
              </div>
              <div>
                <label class="factory-label">Volume actuel (L) *</label>
                <input class="factory-input" type="number" step="10" [(ngModel)]="form.currentVolume" placeholder="ex: 650" />
              </div>
            </div>

            <!-- Preview consommation -->
            @if (form.initialVolume && form.currentVolume) {
              <div class="preview-conso">
                Consommé : {{ form.initialVolume - form.currentVolume | number:'1.0-0' }} L
                — {{ ((1 - form.currentVolume / form.initialVolume) * 100) | number:'1.0-0' }}%
              </div>
            }

            <div style="margin-top: 11px;">
              <label class="factory-label">Bouteilles au relevé</label>
              <input class="factory-input" type="number" [(ngModel)]="form.bottlesAtReading" placeholder="0" />
            </div>

            <div style="margin-top: 11px;">
              <label class="factory-label">Notes</label>
              <textarea class="factory-input" [(ngModel)]="form.notes" rows="2" placeholder="Observations qualité, changement de sirop..."></textarea>
            </div>

            <button class="btn-factory-primary" style="margin-top: 14px; background: #10B981;"
                    [disabled]="!form.currentVolume || saving()"
                    (click)="save()">
              {{ saving() ? '⏳...' : '💾 Enregistrer le relevé' }}
            </button>
          </div>
        }

        <!-- Graphe évolution (barres SVG inline) -->
        @if (todayRecords().length > 1) {
          <div class="evolution-card factory-card">
            <div class="ev-title">📈 Évolution du niveau — aujourd'hui</div>
            <div class="ev-chart">
              @for (r of todayRecords(); track r.id; let i = $index) {
                <div class="ev-bar-wrap">
                  <div class="ev-bar-bg">
                    <div class="ev-bar-fill"
                         [style.height.%]="r.remainingPct ?? 0"
                         [style.background]="gaugeColor(r.remainingPct)">
                    </div>
                  </div>
                  <div class="ev-time">{{ r.recordedAt | date:'HH:mm' }}</div>
                  <div class="ev-pct" [style.color]="gaugeColor(r.remainingPct)">{{ r.remainingPct ?? '—' }}%</div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Historique -->
        <div class="records-list">
          @for (r of todayRecords(); track r.id) {
            <div class="siro-record factory-card">
              <div class="sr-top">
                <div>
                  <div class="sr-time" [style.color]="'#10B981'">{{ r.recordedAt | date:'HH:mm' }} · {{ r.shiftName }}</div>
                  <div class="sr-operator">{{ r.operatorName }}</div>
                </div>
                <div class="sr-levels">
                  <div class="sr-level" [style.color]="gaugeColor(r.remainingPct)">
                    {{ r.currentVolumeLiters | number:'1.0-0' }} L
                  </div>
                  <div class="sr-pct">{{ r.remainingPct ?? '—' }}%</div>
                </div>
              </div>
              @if (r.productName) {
                <div class="sr-product">{{ r.productName }}</div>
              }
            </div>
          }
        </div>

        @if (todayRecords().length === 0 && !showForm()) {
          <div class="empty-state">
            <div style="font-size: 40px;">🧪</div>
            <p>Aucun relevé aujourd'hui</p>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .siroperie { max-width: 700px; margin: 0 auto; }
    .siro-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 0; }
    .btn-new { padding: 8px 16px; border-radius: 8px; background: #10B981; color: #fff; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
    .form-title { font-size: 14px; font-weight: 700; margin-bottom: 16px; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 11px; }
    .preview-conso { font-size: 13px; color: #10B981; font-weight: 600; padding: 6px 10px; background: #10B98111; border-radius: 6px; margin-top: 6px; }

    /* Tank gauge */
    .tank-gauge { border-left: 3px solid #10B981; margin-bottom: 14px; }
    .tg-label { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
    .tg-product { font-size: 16px; font-weight: 800; margin-bottom: 14px; }
    .gauge-wrap { display: flex; gap: 20px; align-items: flex-start; }
    .gauge-bg {
      width: 60px; height: 120px; border: 2px solid var(--border);
      border-radius: 8px; overflow: hidden; position: relative; background: var(--bg-card2); flex-shrink: 0;
    }
    .gauge-fill { position: absolute; bottom: 0; left: 0; right: 0; transition: height 0.5s; }
    .gauge-line { position: absolute; left: 0; right: 0; height: 1px; background: #FF4D6D55; border-top: 1px dashed #FF4D6D; }
    .gauge-pct { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12px; font-weight: 800; color: #fff; text-shadow: 0 1px 2px #0008; }
    .gauge-info { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .gi-row { display: flex; justify-content: space-between; }
    .gi-label { font-size: 12px; color: var(--text-muted); }
    .gi-val { font-size: 13px; font-weight: 700; }
    .alert-low { margin-top: 10px; background: #FF4D6D11; border: 1px solid #FF4D6D33; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--color-danger); font-weight: 600; }

    /* Evolution chart */
    .ev-title { font-size: 13px; font-weight: 700; margin-bottom: 12px; }
    .ev-chart { display: flex; gap: 10px; align-items: flex-end; height: 100px; }
    .ev-bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 1; }
    .ev-bar-bg { flex: 1; width: 100%; background: var(--border); border-radius: 4px; overflow: hidden; position: relative; }
    .ev-bar-fill { position: absolute; bottom: 0; left: 0; right: 0; border-radius: 4px; transition: height 0.4s; }
    .ev-time { font-size: 9px; color: var(--text-muted); }
    .ev-pct { font-size: 10px; font-weight: 700; }

    /* Records */
    .records-list { display: flex; flex-direction: column; gap: 8px; }
    .sr-top { display: flex; justify-content: space-between; }
    .sr-time { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
    .sr-operator { font-size: 11px; color: var(--text-muted); }
    .sr-levels { text-align: right; }
    .sr-level { font-size: 20px; font-weight: 800; }
    .sr-pct { font-size: 11px; color: var(--text-muted); }
    .sr-product { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .empty-state { text-align: center; padding: 40px 0; color: var(--text-muted); }
  `]
})
export class SiroperiComponent implements OnInit {
  config = inject(FactoryConfigService);
  siropApi = inject(SiropApiService);

  selectedLine = signal<ProductionLine | null>(null);
  showForm = signal(false);
  saving = signal(false);
  todayRecords = signal<SiropRecord[]>([]);
  products = signal<Product[]>([]);

  shifts = this.config.shifts;

  latestRecord = computed(() => {
    const r = this.todayRecords();
    return r.length > 0 ? r[r.length - 1] : null;
  });

  latestProduct = computed(() => {
    const lr = this.latestRecord();
    if (!lr?.productId) return null;
    return this.products().find(p => p.id === lr.productId) ?? null;
  });

  form = this.emptyForm();

  emptyForm() {
    return {
      date: new Date().toISOString().split('T')[0],
      shiftId: '', productId: '',
      initialVolume: null as number | null,
      currentVolume: null as number | null,
      bottlesAtReading: null as number | null,
      notes: ''
    };
  }

  ngOnInit() {
    const s = this.shifts();
    if (s.length) this.form.shiftId = s[0].id;
  }

  async onLineSelected(line: ProductionLine) {
    this.selectedLine.set(line);
    this.products.set(await this.config.getProductsForLine(line.id));
    const s = this.shifts();
    this.form = this.emptyForm();
    if (s.length) this.form.shiftId = s[0].id;
    this.loadTodayRecords(line.id);
  }

  loadTodayRecords(lineId: string) {
    const today = new Date().toISOString().split('T')[0];
    this.siropApi.findByLineAndDate(lineId, today).subscribe({
      next: (r) => this.todayRecords.set(r),
      error: () => {}
    });
  }

  save() {
    const line = this.selectedLine();
    if (!line || !this.form.currentVolume) return;
    this.saving.set(true);

    this.siropApi.create({
      productionLineId: line.id,
      shiftConfigId: this.form.shiftId,
      productId: this.form.productId || undefined,
      productionDate: this.form.date,
      initialVolumeLiters: this.form.initialVolume || undefined,
      currentVolumeLiters: this.form.currentVolume,
      bottlesAtReading: this.form.bottlesAtReading || undefined,
      notes: this.form.notes || undefined
    }).subscribe({
      next: (r) => {
        this.todayRecords.update(list => [...list, r]);
        this.saving.set(false);
        this.showForm.set(false);
        this.form = this.emptyForm();
        if (this.shifts().length) this.form.shiftId = this.shifts()[0].id;
      },
      error: () => this.saving.set(false)
    });
  }

  gaugeColor(pct?: number | null): string {
    if (!pct && pct !== 0) return 'var(--text-muted)';
    if (pct <= 15) return '#FF4D6D';
    if (pct <= 30) return '#FFB700';
    return '#10B981';
  }
}
