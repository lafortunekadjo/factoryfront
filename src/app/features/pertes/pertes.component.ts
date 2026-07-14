import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { AuthService } from '../../core/services/auth.service';
import { LineSelectorComponent } from '../../shared/components/line-selector/line-selector.component';
import { ProductionLine, Product, LossType, PerteFiche } from '../../core/models/models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pertes',
  standalone: true,
  imports: [CommonModule, FormsModule, LineSelectorComponent, DecimalPipe],
  template: `
    <div class="pertes animate-in">

      @if (!selectedLine()) {
        <app-line-selector (lineSelected)="onLineSelected($event)" />
      } @else {

        <div class="pertes-header">
          <button class="back-btn" (click)="selectedLine.set(null)">← Accueil</button>
          <button class="btn-new" (click)="toggleForm()">
            {{ showForm() ? '✕ Annuler' : '+ Déclarer des pertes' }}
          </button>
        </div>

        <!-- ── FORMULAIRE ── -->
        @if (showForm()) {
          <div class="perte-form factory-card">
            <div class="form-title">🗑️ Déclaration de pertes</div>

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

            <label class="factory-label">Produit</label>
            <select class="factory-input" [(ngModel)]="form.productId">
              <option value="">-- Sélectionner --</option>
              @for (p of products(); track p.id) {
                <option [value]="p.id">{{ p.name }} {{ p.volume }}</option>
              }
            </select>

            <!-- ── LIGNES DE PERTE PAR TYPE ── -->
            <div class="lignes-title">
              <span>Quantités par type de perte</span>
              @if (!lossTypes().length) {
                <span class="lignes-hint">⚙️ Configurez les types dans Config → Types de pertes</span>
              }
            </div>

            @for (ligne of form.lignes; track ligne.lossTypeId; let i = $index) {
              <div class="ligne-row" [style.border-left-color]="ligne.color">
                <div class="ligne-header">
                  <span class="ligne-type-name">{{ ligne.nom }}</span>
                  <span class="ligne-unite">{{ ligne.unite }}</span>
                </div>

                <!-- Quantité avec +/- rapides -->
                <div class="qty-input-wrap">
                  <button class="qty-btn" (click)="adjustLigneQty(i, -100)">-100</button>
                  <button class="qty-btn" (click)="adjustLigneQty(i, -10)">-10</button>
                  <input class="factory-input qty-input" type="number"
                         [(ngModel)]="ligne.quantity" min="0" placeholder="0" />
                  <button class="qty-btn add" (click)="adjustLigneQty(i, 10)">+10</button>
                  <button class="qty-btn add" (click)="adjustLigneQty(i, 100)">+100</button>
                </div>

                <!-- Cause -->
                <div class="cause-grid" style="margin-top:8px;">
                  @for (lc of lossCauses(); track lc.id) {
                    <button class="cause-btn"
                            [class.selected]="ligne.lossCauseId === lc.id"
                            [style.--cc]="lc.color ?? '#FF4D6D'"
                            (click)="ligne.lossCauseId = lc.id">
                      {{ lc.label }}
                    </button>
                  }
                </div>

                <!-- Notes de la ligne -->
                <input class="factory-input" style="margin-top:6px;"
                       [(ngModel)]="ligne.notes" placeholder="Note pour ce type..." />
              </div>
            }

            <label class="factory-label" style="margin-top:11px;">Notes générales</label>
            <textarea class="factory-input" [(ngModel)]="form.notes" rows="2"
                      placeholder="Contexte général, observations..."></textarea>

            <button class="btn-save-pertes" [disabled]="!hasAnyQty() || saving()"
                    (click)="save()">
              {{ saving() ? '⏳...' : '✅ Enregistrer les pertes' }}
            </button>
          </div>
        }

        <!-- ── LISTE DES FICHES ── -->
        <div class="records-list">
          @for (fiche of fiches(); track fiche.id) {
            <div class="fiche-card factory-card">
              <div class="fiche-header">
                <div>
                  <div class="fiche-date">{{ fiche.productionDate }} · {{ fiche.shiftName }}</div>
                  @if (fiche.productName) {
                    <div class="fiche-product">📦 {{ fiche.productName }}</div>
                  }
                </div>
                <div class="fiche-total">
                  <span class="total-num" style="color:var(--color-danger);">
                    {{ ficheTotal(fiche) | number:'1.0-1' }}
                  </span>
                  <span class="total-label">unités/kg</span>
                </div>
              </div>

              <!-- Détail des lignes -->
              <div class="fiche-lignes">
                @for (ligne of fiche.lignes; track ligne.lossTypeId) {
                  @if (ligne.quantity > 0) {
                    <div class="fiche-ligne" [style.border-left-color]="ligne.lossTypeColor">
                      <span class="fl-type">{{ ligne.lossTypeNom }}</span>
                      <span class="fl-qty">{{ ligne.quantity | number:'1.0-3' }} {{ ligne.lossTypeUnite }}</span>
                      @if (ligne.lossCauseLabel) {
                        <span class="fl-cause">⚠️ {{ ligne.lossCauseLabel }}</span>
                      }
                    </div>
                  }
                }
              </div>

              @if (fiche.notes) {
                <div class="fiche-notes">📝 {{ fiche.notes }}</div>
              }
            </div>
          }
        </div>

        @if (fiches().length === 0 && !showForm()) {
          <div class="empty-state">
            <div style="font-size:40px">✅</div>
            <p style="color:var(--color-success);font-weight:600;">Aucune perte déclarée — bonne journée !</p>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .pertes { max-width: 700px; margin: 0 auto; }
    .pertes-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 0; }
    .btn-new { padding: 8px 16px; border-radius: 8px; background: #FF4D6D; color: #fff; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }

    .form-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; color: #FF4D6D; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 11px; }

    /* Lignes de perte */
    .lignes-title { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 700; margin: 14px 0 10px; }
    .lignes-hint { font-size: 11px; color: var(--color-warning); font-weight: 400; }
    .ligne-row { border-left: 3px solid var(--color-danger); padding: 10px 12px; margin-bottom: 10px; background: var(--bg-card2); border-radius: 0 8px 8px 0; }
    .ligne-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .ligne-type-name { font-weight: 700; font-size: 13px; }
    .ligne-unite { font-size: 11px; color: var(--text-muted); background: var(--bg-card); border: 1px solid var(--border); padding: 1px 7px; border-radius: 6px; }

    .qty-input-wrap { display: flex; align-items: center; gap: 5px; }
    .qty-btn { padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--color-danger); cursor: pointer; font-size: 12px; font-weight: 700; }
    .qty-btn.add { color: var(--color-success); }
    .qty-input { flex: 1; text-align: center; font-size: 18px; font-weight: 800; }

    .cause-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .cause-btn { padding: 5px 11px; border-radius: 16px; border: 1px solid var(--cc, #FF4D6D); background: none; color: var(--text-muted); cursor: pointer; font-size: 12px; }
    .cause-btn.selected { background: var(--cc, #FF4D6D); color: #fff; font-weight: 600; }

    .btn-save-pertes { width: 100%; margin-top: 16px; padding: 12px; border-radius: 10px; background: #FF4D6D; color: #fff; border: none; cursor: pointer; font-size: 14px; font-weight: 700; }
    .btn-save-pertes:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Fiches */
    .records-list { display: flex; flex-direction: column; gap: 10px; }
    .fiche-card { }
    .fiche-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .fiche-date { font-size: 12px; font-weight: 600; color: var(--factory-secondary); }
    .fiche-product { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .fiche-total { text-align: right; }
    .total-num { font-size: 22px; font-weight: 900; }
    .total-label { font-size: 10px; color: var(--text-muted); display: block; }

    .fiche-lignes { display: flex; flex-direction: column; gap: 5px; }
    .fiche-ligne { display: flex; align-items: center; gap: 8px; border-left: 3px solid; padding: 4px 8px; border-radius: 0 6px 6px 0; background: var(--bg-card2); flex-wrap: wrap; }
    .fl-type { font-size: 12px; font-weight: 600; flex: 1; }
    .fl-qty { font-size: 12px; font-weight: 700; color: var(--color-danger); }
    .fl-cause { font-size: 11px; color: var(--text-muted); width: 100%; padding-left: 2px; }
    .fiche-notes { font-size: 11px; color: var(--text-muted); margin-top: 8px; font-style: italic; }

    .empty-state { text-align: center; padding: 40px 0; }
  `]
})
export class PerteComponent implements OnInit {
  config   = inject(FactoryConfigService);
  auth     = inject(AuthService);
  http     = inject(HttpClient);

  selectedLine = signal<ProductionLine | null>(null);
  showForm     = signal(false);
  saving       = signal(false);
  fiches       = signal<PerteFiche[]>([]);
  products     = signal<Product[]>([]);
  lossTypes    = signal<LossType[]>([]);

  shifts     = this.config.shifts;
  lossCauses = this.config.lossCauses;

  form = this.emptyForm();

  emptyForm() {
    return {
      date: new Date().toISOString().split('T')[0],
      shiftId: '', productId: '', notes: '',
      lignes: [] as Array<{
        lossTypeId: string; nom: string; unite: string; color: string;
        quantity: number | null; lossCauseId: string; notes: string;
      }>
    };
  }

  ngOnInit() {
    const s = this.shifts();
    if (s.length) this.form.shiftId = s[0].id;
  }

  async onLineSelected(line: ProductionLine) {
    this.selectedLine.set(line);
    this.products.set(await this.config.getProductsForLine(line.id));
    this.form = this.emptyForm();
    const s = this.shifts();
    if (s.length) this.form.shiftId = s[0].id;
    this.loadLossTypes();
    this.loadFiches(line.id);
  }

  loadLossTypes() {
    const factoryId = this.config.factory()?.id;
    if (!factoryId || this.lossTypes().length) return;
    this.http.get<LossType[]>(`${environment.apiUrl}/pertes/factories/${factoryId}/types`)
      .subscribe({
        next: types => {
          this.lossTypes.set(types);
          this.resetLignes(types);
        },
        error: () => {}
      });
  }

  resetLignes(types: LossType[]) {
    this.form.lignes = types.map(t => ({
      lossTypeId: t.id, nom: t.nom, unite: t.unite, color: t.color,
      quantity: null, lossCauseId: '', notes: ''
    }));
  }

  toggleForm() {
    this.showForm.update(v => !v);
    if (this.showForm()) {
      this.form = this.emptyForm();
      const s = this.shifts();
      if (s.length) this.form.shiftId = s[0].id;
      this.resetLignes(this.lossTypes());
    }
  }

  loadFiches(lineId: string) {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const to = new Date().toISOString().split('T')[0];
    this.http.get<PerteFiche[]>(
      `${environment.apiUrl}/pertes/lines/${lineId}/fiches`,
      { params: { from: from.toISOString().split('T')[0], to } }
    ).subscribe({ next: f => this.fiches.set(f), error: () => {} });
  }

  adjustLigneQty(i: number, delta: number) {
    const ligne = this.form.lignes[i];
    ligne.quantity = Math.max(0, (ligne.quantity ?? 0) + delta);
  }

  hasAnyQty(): boolean {
    return this.form.lignes.some(l => l.quantity != null && l.quantity > 0);
  }

  ficheTotal(fiche: PerteFiche): number {
    return fiche.lignes.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
  }

  save() {
    const line = this.selectedLine();
    if (!line) return;
    this.saving.set(true);

    const lignesAvecQty = this.form.lignes.filter(l => l.quantity != null && l.quantity > 0);

    this.http.post<PerteFiche>(
      `${environment.apiUrl}/pertes/lines/${line.id}/fiches`,
      {
        shiftConfigId: this.form.shiftId,
        productId: this.form.productId || undefined,
        productionDate: this.form.date,
        notes: this.form.notes || undefined,
        lignes: lignesAvecQty.map(l => ({
          lossTypeId: l.lossTypeId,
          lossCauseId: l.lossCauseId || undefined,
          quantity: l.quantity,
          notes: l.notes || undefined
        }))
      }
    ).subscribe({
      next: fiche => {
        this.fiches.update(list => [fiche, ...list]);
        this.saving.set(false);
        this.showForm.set(false);
      },
      error: () => this.saving.set(false)
    });
  }
}
