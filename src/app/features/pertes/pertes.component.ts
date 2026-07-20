import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { AuthService } from '../../core/services/auth.service';
import { PrintService } from '../../core/services/print.service';
import { LineSelectorComponent } from '../../shared/components/line-selector/line-selector.component';
import { ProductionLine, Product, LossType } from '../../core/models/models';
import { environment } from '../../../environments/environment';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-pertes',
  standalone: true,
  imports: [CommonModule, FormsModule, LineSelectorComponent, DecimalPipe, DatePipe],
  template: `
    <div class="pertes animate-in">

      @if (!selectedLine()) {
        <app-line-selector (lineSelected)="onLineSelected($event)" />
      } @else {

        <div class="pertes-header">
          <button class="back-btn" (click)="selectedLine.set(null)">← Accueil</button>
          <div class="header-actions">
            <button class="btn-bilan" (click)="toggleBilan()">
              {{ showBilan() ? '✕ Fermer bilan' : '📊 Bilan période' }}
            </button>
            <button class="btn-new" (click)="toggleForm()">
              {{ showForm() ? '✕ Annuler' : '+ Déclarer des pertes' }}
            </button>
          </div>
        </div>

        <!-- ── BILAN PÉRIODE ── -->
        @if (showBilan()) {
          <div class="bilan-panel factory-card">
            <div class="bilan-header">
              <div class="bilan-title">📊 Bilan des pertes</div>
              <div class="bilan-filters">
                <input class="factory-input date-sm" type="date" [(ngModel)]="bilanFrom" (change)="loadBilan()" />
                <span>→</span>
                <input class="factory-input date-sm" type="date" [(ngModel)]="bilanTo" (change)="loadBilan()" />
                <button class="btn-print-bilan" (click)="printBilan()">🖨️</button>
                <button class="btn-excel-bilan" (click)="exportExcel()">📥 Excel</button>
              </div>
            </div>

            @if (bilanFiches().length === 0) {
              <div class="empty-bilan">Aucune perte sur cette période</div>
            } @else {
              <!-- KPIs bilan -->
              <div class="bilan-kpis">
                @for (kpi of bilanKpis(); track kpi.nom) {
                  <div class="bkpi">
                    <div class="bkpi-val" style="color:var(--color-danger);">{{ kpi.total | number:'1.0-1' }}</div>
                    <div class="bkpi-lbl">{{ kpi.nom }}<br><span class="bkpi-unite">{{ kpi.unite }}</span></div>
                  </div>
                }
              </div>

              <!-- Tableau bilan -->
              <div class="bilan-table-wrap">
                <table class="bilan-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Quart</th><th>Produit</th>
                      @for (lt of lossTypes(); track lt.id) {
                        <th>{{ lt.nom }}<br><span style="font-weight:400;opacity:.7;">{{ lt.unite }}</span></th>
                      }
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (f of bilanFiches(); track f.id) {
                      <tr>
                        <td>{{ f.productionDate | date:'dd/MM':'':'fr' }}</td>
                        <td>{{ f.shiftName }}</td>
                        <td>{{ f.productName ?? '—' }}</td>
                        @for (lt of lossTypes(); track lt.id) {
                          <td class="td-qty">
                            {{ getLigneQty(f, lt.id) | number:'1.0-1' }}
                          </td>
                        }
                        <td class="td-total">{{ ficheTotal(f) | number:'1.0-1' }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3" style="font-weight:700;">TOTAL</td>
                      @for (lt of lossTypes(); track lt.id) {
                        <td class="td-total">{{ bilanTotalByType(lt.id) | number:'1.0-1' }}</td>
                      }
                      <td class="td-total">{{ bilanTotalGlobal() | number:'1.0-1' }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            }
          </div>
        }

        <!-- ── FORMULAIRE DÉCLARATION ── -->
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
                <div class="qty-input-wrap">
                  <button class="qty-btn" (click)="adjustLigneQty(i, -100)">-100</button>
                  <button class="qty-btn" (click)="adjustLigneQty(i, -10)">-10</button>
                  <input class="factory-input qty-input" type="number"
                         [(ngModel)]="ligne.quantity" min="0" placeholder="0" />
                  <button class="qty-btn add" (click)="adjustLigneQty(i, 10)">+10</button>
                  <button class="qty-btn add" (click)="adjustLigneQty(i, 100)">+100</button>
                </div>
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
                  <div class="fiche-date">{{ fiche.productionDate | date:'EEE dd MMM':'':'fr' }} · {{ fiche.shiftName }}</div>
                  @if (fiche.productName) {
                    <div class="fiche-product">📦 {{ fiche.productName }}</div>
                  }
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="fiche-total">
                    <span class="total-num" style="color:var(--color-danger);">
                      {{ ficheTotal(fiche) | number:'1.0-1' }}
                    </span>
                  </div>
                  <button class="btn-edit-fiche" (click)="startEditFiche(fiche)">✏️</button>
                  <button class="btn-del-fiche" (click)="deleteFiche(fiche.id)">🗑️</button>
                </div>
              </div>

              <!-- Lignes éditables si en mode édition -->
              @if (editingFicheId() === fiche.id) {
                <div class="edit-lignes">
                  @for (ligne of editLignes; track ligne.id; let i = $index) {
                    <div class="edit-ligne-row" [style.border-left-color]="ligne.color">
                      <div class="el-header">
                        <span class="el-type">{{ ligne.nom }}</span>
                        <span class="el-unite">{{ ligne.unite }}</span>
                      </div>
                      <div class="qty-input-wrap" style="margin-top:6px;">
                        <button class="qty-btn" (click)="adjustEditQty(i, -100)">-100</button>
                        <button class="qty-btn" (click)="adjustEditQty(i, -10)">-10</button>
                        <input class="factory-input qty-input" type="number"
                               [(ngModel)]="ligne.quantity" min="0" />
                        <button class="qty-btn add" (click)="adjustEditQty(i, 10)">+10</button>
                        <button class="qty-btn add" (click)="adjustEditQty(i, 100)">+100</button>
                      </div>
                      <div class="cause-grid" style="margin-top:6px;">
                        <button class="cause-btn" [class.selected]="!ligne.lossCauseId"
                                (click)="ligne.lossCauseId = ''">Aucune</button>
                        @for (lc of lossCauses(); track lc.id) {
                          <button class="cause-btn"
                                  [class.selected]="ligne.lossCauseId === lc.id"
                                  [style.--cc]="lc.color ?? '#FF4D6D'"
                                  (click)="ligne.lossCauseId = lc.id">
                            {{ lc.label }}
                          </button>
                        }
                      </div>
                      <input class="factory-input" style="margin-top:5px;"
                             [(ngModel)]="ligne.notes" placeholder="Note..." />
                    </div>
                  }
                  <div class="edit-actions">
                    <button class="btn-cancel-edit" (click)="cancelEdit()">Annuler</button>
                    <button class="btn-save-edit" [disabled]="savingEdit()"
                            (click)="saveEditLignes(fiche.id)">
                      {{ savingEdit() ? '⏳...' : '💾 Enregistrer' }}
                    </button>
                  </div>
                </div>
              } @else {
                <!-- Vue normale -->
                <div class="fiche-lignes">
                  @for (ligne of fiche.lignes; track ligne.lossTypeId) {
                    @if (ligne.quantity > 0) {
                      <div class="fiche-ligne" [style.border-left-color]="ligne.lossTypeColor">
                        <span class="fl-type">{{ ligne.lossTypeNom }}</span>
                        <span class="fl-qty">{{ ligne.quantity | number:'1.0-3' }} {{ ligne.lossTypeUnite }}</span>
                        @if (ligne.lossCauseLabel) {
                          <span class="fl-cause">⚠️ {{ ligne.lossCauseLabel }}</span>
                        }
                        @if (ligne.notes) {
                          <span class="fl-note">{{ ligne.notes }}</span>
                        }
                      </div>
                    }
                  }
                </div>
              }

              @if (fiche.notes && editingFicheId() !== fiche.id) {
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
    .pertes-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
    .back-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 14px; padding: 0; }
    .header-actions { display: flex; gap: 8px; }
    .btn-new { padding: 8px 16px; border-radius: 8px; background: #FF4D6D; color: #fff; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
    .btn-bilan { padding: 8px 14px; border-radius: 8px; background: var(--bg-card2); border: 1px solid var(--border); color: var(--text-muted); cursor: pointer; font-size: 13px; font-weight: 600; }

    /* Bilan */
    .bilan-panel { margin-bottom: 14px; }
    .bilan-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
    .bilan-title { font-size: 14px; font-weight: 700; }
    .bilan-filters { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .date-sm { width: 130px !important; padding: 5px 8px !important; font-size: 12px !important; }
    .btn-print-bilan, .btn-excel-bilan { padding: 6px 12px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg-card2); cursor: pointer; font-size: 12px; font-weight: 600; }
    .btn-excel-bilan { border-color: #00875A44; color: #00875A; background: #00875A11; }
    .empty-bilan { text-align: center; color: var(--text-muted); padding: 20px; }
    .bilan-kpis { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .bkpi { flex: 1; min-width: 80px; background: var(--bg-card2); border-radius: 8px; padding: 10px; text-align: center; border: 1px solid var(--border); }
    .bkpi-val { font-size: 20px; font-weight: 900; }
    .bkpi-lbl { font-size: 10px; color: var(--text-muted); margin-top: 3px; }
    .bkpi-unite { font-size: 9px; color: var(--border); }
    .bilan-table-wrap { overflow-x: auto; }
    .bilan-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .bilan-table th { background: var(--bg-card2); padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    .bilan-table td { padding: 7px 8px; border-bottom: 1px solid var(--border); }
    .bilan-table tfoot td { font-weight: 700; background: var(--bg-card2); border-top: 2px solid var(--border); }
    .td-qty { text-align: right; }
    .td-total { text-align: right; font-weight: 700; color: var(--color-danger); }

    /* Formulaire */
    .form-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; color: #FF4D6D; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 11px; }
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
    .fiche-date { font-size: 13px; font-weight: 700; text-transform: capitalize; }
    .fiche-product { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .fiche-total { text-align: right; }
    .total-num { font-size: 20px; font-weight: 900; }
    .btn-edit-fiche, .btn-del-fiche { background: none; border: none; cursor: pointer; padding: 4px 7px; border-radius: 6px; font-size: 15px; opacity: 0.6; }
    .btn-edit-fiche:hover, .btn-del-fiche:hover { opacity: 1; background: var(--bg-card2); }
    .fiche-lignes { display: flex; flex-direction: column; gap: 5px; }
    .fiche-ligne { display: flex; align-items: center; gap: 8px; border-left: 3px solid; padding: 4px 8px; border-radius: 0 6px 6px 0; background: var(--bg-card2); flex-wrap: wrap; }
    .fl-type { font-size: 12px; font-weight: 600; flex: 1; }
    .fl-qty { font-size: 12px; font-weight: 700; color: var(--color-danger); }
    .fl-cause { font-size: 11px; color: var(--text-muted); width: 100%; padding-left: 2px; }
    .fl-note { font-size: 11px; color: var(--text-muted); font-style: italic; width: 100%; }
    .fiche-notes { font-size: 11px; color: var(--text-muted); margin-top: 8px; font-style: italic; }

    /* Édition lignes */
    .edit-lignes { border-top: 1px dashed var(--border); padding-top: 12px; margin-top: 4px; }
    .edit-ligne-row { border-left: 3px solid var(--color-danger); padding: 8px 10px; margin-bottom: 8px; background: var(--bg-card2); border-radius: 0 6px 6px 0; }
    .el-header { display: flex; align-items: center; gap: 8px; }
    .el-type { font-weight: 700; font-size: 13px; }
    .el-unite { font-size: 11px; color: var(--text-muted); background: var(--bg-card); border: 1px solid var(--border); padding: 1px 7px; border-radius: 6px; }
    .edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
    .btn-cancel-edit { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border); background: none; color: var(--text-muted); cursor: pointer; font-size: 13px; }
    .btn-save-edit { padding: 7px 16px; border-radius: 8px; border: none; background: var(--factory-primary); color: #fff; cursor: pointer; font-size: 13px; font-weight: 700; }
    .btn-save-edit:disabled { opacity: 0.4; cursor: not-allowed; }

    .empty-state { text-align: center; padding: 40px 0; }
  `]
})
export class PerteComponent implements OnInit {
  config    = inject(FactoryConfigService);
  auth      = inject(AuthService);
  http      = inject(HttpClient);
  printSvc  = inject(PrintService);

  selectedLine = signal<ProductionLine | null>(null);
  showForm     = signal(false);
  showBilan    = signal(false);
  saving       = signal(false);
  savingEdit   = signal(false);
  fiches       = signal<any[]>([]);
  bilanFiches  = signal<any[]>([]);
  products     = signal<Product[]>([]);
  lossTypes    = signal<LossType[]>([]);
  editingFicheId = signal<string | null>(null);
  editLignes: Array<{
    id: string; lossTypeId: string; nom: string; unite: string; color: string;
    quantity: number; lossCauseId: string; notes: string;
  }> = [];

  shifts     = this.config.shifts;
  lossCauses = this.config.lossCauses;

  bilanFrom = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
  bilanTo   = new Date().toISOString().split('T')[0];

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
    if (!factoryId) return;
    this.http.get<LossType[]>(`${environment.apiUrl}/pertes/factories/${factoryId}/types`)
      .subscribe({ next: types => { this.lossTypes.set(types); this.resetLignes(types); }, error: () => {} });
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

  toggleBilan() {
    this.showBilan.update(v => !v);
    if (this.showBilan()) this.loadBilan();
  }

  loadFiches(lineId: string) {
    const from = new Date(); from.setDate(from.getDate() - 30);
    const to = new Date().toISOString().split('T')[0];
    this.http.get<any[]>(`${environment.apiUrl}/pertes/lines/${lineId}/fiches`,
      { params: { from: from.toISOString().split('T')[0], to } }
    ).subscribe({ next: f => this.fiches.set(f), error: () => {} });
  }

  loadBilan() {
    const factoryId = this.config.factory()?.id;
    if (!factoryId) return;
    this.http.get<any[]>(`${environment.apiUrl}/pertes/factories/${factoryId}/bilan`,
      { params: { from: this.bilanFrom, to: this.bilanTo } }
    ).subscribe({ next: f => this.bilanFiches.set(f), error: () => {} });
  }

  adjustLigneQty(i: number, delta: number) {
    const l = this.form.lignes[i];
    l.quantity = Math.max(0, (l.quantity ?? 0) + delta);
  }

  hasAnyQty(): boolean {
    return this.form.lignes.some(l => l.quantity != null && l.quantity > 0);
  }

  ficheTotal(fiche: any): number {
    return (fiche.lignes ?? []).reduce((s: number, l: any) => s + (Number(l.quantity) ?? 0), 0);
  }

  getLigneQty(fiche: any, lossTypeId: string): number {
    const l = (fiche.lignes ?? []).find((lg: any) => lg.lossTypeId === lossTypeId);
    return l ? Number(l.quantity) : 0;
  }

  bilanKpis(): Array<{ nom: string; unite: string; total: number }> {
    return this.lossTypes().map(lt => ({
      nom: lt.nom, unite: lt.unite,
      total: this.bilanFiches().reduce((s, f) => s + this.getLigneQty(f, lt.id), 0)
    })).filter(k => k.total > 0);
  }

  bilanTotalByType(lossTypeId: string): number {
    return this.bilanFiches().reduce((s, f) => s + this.getLigneQty(f, lossTypeId), 0);
  }

  bilanTotalGlobal(): number {
    return this.bilanFiches().reduce((s, f) => s + this.ficheTotal(f), 0);
  }

  // ── Édition par ligne ──────────────────────────────────────
  startEditFiche(fiche: any) {
    this.editingFicheId.set(fiche.id);
    this.editLignes = (fiche.lignes ?? []).map((l: any) => ({
      id: l.id,
      lossTypeId: l.lossTypeId,
      nom: l.lossTypeNom,
      unite: l.lossTypeUnite,
      color: l.lossTypeColor ?? '#FF4D6D',
      quantity: Number(l.quantity),
      lossCauseId: l.lossCauseId ?? '',
      notes: l.notes ?? ''
    }));
  }

  cancelEdit() {
    this.editingFicheId.set(null);
    this.editLignes = [];
  }

  adjustEditQty(i: number, delta: number) {
    this.editLignes[i].quantity = Math.max(0, (this.editLignes[i].quantity ?? 0) + delta);
  }

  saveEditLignes(ficheId: string) {
    this.savingEdit.set(true);
    // Sauvegarder chaque ligne en parallèle
    const calls = this.editLignes.map(l =>
      this.http.patch<any>(`${environment.apiUrl}/pertes/lignes/${l.id}`, {
        quantity: l.quantity,
        lossCauseId: l.lossCauseId || null,
        notes: l.notes || null
      }).toPromise()
    );

    Promise.all(calls).then(() => {
      // Recharger les fiches
      const line = this.selectedLine();
      if (line) this.loadFiches(line.id);
      this.savingEdit.set(false);
      this.editingFicheId.set(null);
      this.editLignes = [];
    }).catch(() => this.savingEdit.set(false));
  }

  deleteFiche(id: string) {
    if (!confirm('Supprimer cette fiche de pertes ?')) return;
    this.http.delete(`${environment.apiUrl}/pertes/fiches/${id}`).subscribe({
      next: () => this.fiches.update(list => list.filter(f => f.id !== id)),
      error: () => {}
    });
  }

  save() {
    const line = this.selectedLine();
    if (!line) return;
    this.saving.set(true);
    const lignesAvecQty = this.form.lignes.filter(l => l.quantity != null && l.quantity > 0);
    this.http.post<any>(`${environment.apiUrl}/pertes/lines/${line.id}/fiches`, {
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
    }).subscribe({
      next: fiche => {
        this.fiches.update(list => [fiche, ...list]);
        this.saving.set(false);
        this.showForm.set(false);
      },
      error: () => this.saving.set(false)
    });
  }

  // ── Impression bilan ───────────────────────────────────────
  printBilan() {
    const factory = this.config.factory();
    const line = this.selectedLine();
    const from = new Date(this.bilanFrom).toLocaleDateString('fr-FR');
    const to   = new Date(this.bilanTo).toLocaleDateString('fr-FR');
    const types = this.lossTypes();

    const thead = `<tr><th>Date</th><th>Quart</th><th>Produit</th>${types.map(t => `<th>${t.nom}<br><small>${t.unite}</small></th>`).join('')}<th>Total</th></tr>`;
    const tbody = this.bilanFiches().map(f => `
      <tr>
        <td>${new Date(f.productionDate).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit'})}</td>
        <td>${f.shiftName}</td>
        <td>${f.productName ?? '—'}</td>
        ${types.map(t => `<td style="text-align:right;">${this.getLigneQty(f, t.id).toLocaleString('fr-FR', {minimumFractionDigits:0,maximumFractionDigits:1})}</td>`).join('')}
        <td style="text-align:right;font-weight:700;color:#CC0000;">${this.ficheTotal(f).toLocaleString('fr-FR', {minimumFractionDigits:0,maximumFractionDigits:1})}</td>
      </tr>`).join('');
    const tfoot = `<tr style="font-weight:700;background:#f0f0f8;"><td colspan="3">TOTAL</td>${types.map(t => `<td style="text-align:right;">${this.bilanTotalByType(t.id).toLocaleString('fr-FR', {minimumFractionDigits:0,maximumFractionDigits:1})}</td>`).join('')}<td style="text-align:right;color:#CC0000;">${this.bilanTotalGlobal().toLocaleString('fr-FR', {minimumFractionDigits:0,maximumFractionDigits:1})}</td></tr>`;

    const html = `
      <div class="print-header">
        <div>
          <div class="print-title">${factory?.appTitle ?? 'Factory Diagnostic'}</div>
          <div class="print-subtitle">Bilan des pertes — ${line?.name ?? ''}</div>
        </div>
        <div class="print-meta">
          Période : ${from} → ${to}<br>
          Imprimé le : ${new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>
      <div class="kpi-row">
        ${this.bilanKpis().map(k => `<div class="kpi-box"><div class="kpi-val" style="color:#CC0000;">${k.total.toLocaleString('fr-FR',{maximumFractionDigits:1})}</div><div class="kpi-lbl">${k.nom}<br><small>${k.unite}</small></div></div>`).join('')}
      </div>
      <div class="section">
        <div class="section-title">Détail par fiche</div>
        <table><thead>${thead}</thead><tbody>${tbody}</tbody><tfoot>${tfoot}</tfoot></table>
      </div>
      <div class="print-footer">
        <span>${factory?.appTitle ?? ''} — Confidentiel</span>
        <span>Période : ${from} → ${to}</span>
      </div>`;

    this.printSvc.print(`Bilan Pertes ${from}-${to}`, html, true);
  }

  // ── Export Excel ───────────────────────────────────────────
  exportExcel() {
    const factory = this.config.factory();
    const line = this.selectedLine();
    const types = this.lossTypes();

    // En-têtes
    const headers = ['Date', 'Quart', 'Produit', ...types.map(t => `${t.nom} (${t.unite})`), 'Total', 'Notes'];

    // Lignes
    const rows = this.bilanFiches().map(f => [
      f.productionDate,
      f.shiftName,
      f.productName ?? '',
      ...types.map(t => this.getLigneQty(f, t.id)),
      this.ficheTotal(f),
      f.notes ?? ''
    ]);

    // Ligne totaux
    const totals = ['TOTAL', '', '', ...types.map(t => this.bilanTotalByType(t.id)), this.bilanTotalGlobal(), ''];

    const wsData = [headers, ...rows, [], totals];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Largeurs colonnes
    ws['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 20 },
      ...types.map(() => ({ wch: 14 })),
      { wch: 10 }, { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bilan Pertes');
    XLSX.writeFile(wb, `bilan-pertes-${line?.name ?? 'factory'}-${this.bilanFrom}-${this.bilanTo}.xlsx`);
  }
}
