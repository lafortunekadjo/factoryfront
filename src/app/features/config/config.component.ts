import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { FactoryConfigService } from '../../core/services/factory-config.service';
import { environment } from '../../../environments/environment';
import { forkJoin } from 'rxjs';

type ConfigTab = 'branding' | 'shifts' | 'lines' | 'stop-types' | 'loss-causes' | 'products' | 'machines' | 'roles' | 'users' | 'postes' | 'equipes' | 'rotations' | 'preformes' | 'loss-types';

// ── Interfaces locales ────────────────────────────────────────────────────────

interface LineForm {
  id?: string; code: string; name: string;
  nominalSpeed: number | null; minSpeed: number | null; maxSpeed: number | null;
  color: string; icon: string; displayOrder: number;
  _editing: boolean; _new: boolean;
}

interface MachineTypeForm {
  id?: string; code: string; label: string;
  description: string; color: string; icon: string; displayOrder: number;
  _editing: boolean; _new: boolean;
}

interface LineMachineForm {
  id?: string; productionLineId: string; machineTypeId: string;
  displayName: string; serialNumber: string; installationYear: number | null;
  instanceNumber: number;
  _editing: boolean; _new: boolean;
}

interface ProductForm {
  id?: string;
  productionLineId: string;
  name: string; volume: string;
  nominalSpeed: number | null;
  brandColor: string; iconUrl: string;
  displayOrder: number; internalRef: string;
  productCode: string;
  unitCapacityCl: number | null;
  bottlesPerPack: number | null;
  packsPerPallet: number | null;
  tareWeightG: number | null;
  _editing: boolean; _new: boolean;
}

interface RoleItem {
  id: string; code: string; name: string; description: string;
  isSystemRole: boolean; factoryId?: string;
  permissions: PermissionItem[];
  _editing: boolean;
}

interface PermissionItem {
  id: string; code: string; description: string; module: string; action: string;
}

interface PermissionGroup { module: string; permissions: PermissionItem[]; }

interface UserForm {
  id?: string; firstName: string; lastName: string;
  email: string; jobTitle: string; phone: string;
  preferredLanguage: string; roleCodes: string[];
  temporaryPassword: string; isTeamLeader: boolean;
  _editing: boolean; _new: boolean;
}

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="config-page animate-in">
      <h2 class="page-title">⚙️ Configuration — {{ config.appTitle() }}</h2>

      <!-- Tabs -->
      <div class="config-tabs">
        @for (tab of tabs; track tab.id) {
          <button class="config-tab" [class.active]="activeTab() === tab.id" (click)="switchTab(tab.id)">
            {{ tab.icon }} {{ tab.label }}
          </button>
        }
      </div>

      <!-- ── BRANDING ── -->
      @if (activeTab() === 'branding') {
        <div class="config-section factory-card">
          <div class="cs-title">🎨 Branding & Identité</div>

          <label class="factory-label">Nom de l'application</label>
          <input class="factory-input" [(ngModel)]="brandForm.appTitle" />

          <label class="factory-label" style="margin-top: 11px;">Sous-titre</label>
          <input class="factory-input" [(ngModel)]="brandForm.appSubtitle" />

          <div class="color-grid">
            <div>
              <label class="factory-label">Couleur primaire</label>
              <div class="color-row">
                <input type="color" [(ngModel)]="brandForm.primaryColor" class="color-picker" />
                <input class="factory-input" [(ngModel)]="brandForm.primaryColor" style="flex:1;" />
              </div>
            </div>
            <div>
              <label class="factory-label">Couleur secondaire</label>
              <div class="color-row">
                <input type="color" [(ngModel)]="brandForm.secondaryColor" class="color-picker" />
                <input class="factory-input" [(ngModel)]="brandForm.secondaryColor" style="flex:1;" />
              </div>
            </div>
            <div>
              <label class="factory-label">Couleur accent</label>
              <div class="color-row">
                <input type="color" [(ngModel)]="brandForm.accentColor" class="color-picker" />
                <input class="factory-input" [(ngModel)]="brandForm.accentColor" style="flex:1;" />
              </div>
            </div>
          </div>

          <label class="factory-label" style="margin-top: 11px;">URL du logo</label>
          <input class="factory-input" [(ngModel)]="brandForm.logoUrl" placeholder="https://..." />

          <div class="module-toggles">
            <div class="mt-title">Modules activés</div>
            @for (mod of moduleList; track mod.key) {
              <div class="mt-row">
                <span>{{ mod.label }}</span>
                <label class="toggle">
                  <input type="checkbox" [(ngModel)]="brandForm.modules[mod.key]" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            }
          </div>

          <button class="btn-factory-primary" style="margin-top: 16px;" (click)="saveBranding()">
            💾 Enregistrer le branding
          </button>

          <!-- ── Signin géolocalisé ── -->
          <div class="geo-section">
            <div class="cs-title" style="margin-top:24px;">📍 Signin géolocalisé</div>
            <p class="cs-desc">Restreignez la connexion à un périmètre autour de l'usine. Seuls les utilisateurs présents sur site pourront se connecter.</p>

            <label class="mt-row" style="margin-top:10px;">
              <span>Activer la restriction de zone</span>
              <label class="toggle">
                <input type="checkbox" [(ngModel)]="brandForm.geoRestrictSignin" />
                <span class="toggle-slider"></span>
              </label>
            </label>

            @if (brandForm.geoRestrictSignin) {
              <div class="row-2" style="margin-top:12px;">
                <div>
                  <label class="factory-label">Latitude (ex: 4.0511)</label>
                  <input class="factory-input" type="number" step="0.0001"
                         [(ngModel)]="brandForm.geoLat" placeholder="ex: 4.0511" />
                </div>
                <div>
                  <label class="factory-label">Longitude (ex: 9.7679)</label>
                  <input class="factory-input" type="number" step="0.0001"
                         [(ngModel)]="brandForm.geoLng" placeholder="ex: 9.7679" />
                </div>
              </div>
              <div style="margin-top:10px;">
                <label class="factory-label">Rayon autorisé (mètres)</label>
                <input class="factory-input" type="number"
                       [(ngModel)]="brandForm.geoRadiusMeters" placeholder="500" />
                <div class="field-hint">Les utilisateurs situés à plus de {{ brandForm.geoRadiusMeters || 500 }} m du centre ne pourront pas se connecter.</div>
              </div>
              <button class="btn-geo-detect" (click)="detectGeoPosition()">
                📍 Détecter ma position actuelle
              </button>
            }

            <button class="btn-factory-primary" style="margin-top:12px;" (click)="saveGeoConfig()">
              💾 Enregistrer la config géo
            </button>
          </div>

          <div class="preview-strip" style="margin-top: 16px;">
            <div class="preview-color" [style.background]="brandForm.primaryColor">Primaire</div>
            <div class="preview-color" [style.background]="brandForm.secondaryColor">Secondaire</div>
            <div class="preview-color" [style.background]="brandForm.accentColor">Accent</div>
          </div>
        </div>
      }

      <!-- ── QUARTS ── -->
      @if (activeTab() === 'shifts') {
        <div class="config-section factory-card">
          <div class="cs-title">🕐 Tranches de Quart</div>
          <p class="cs-desc">Configurez librement vos quarts : nombre, noms, horaires.</p>

          @for (shift of shiftsForm; track $index; let i = $index) {
            <div class="shift-editor">
              <div class="shift-editor-header">
                <span class="shift-num">Quart {{ i + 1 }}</span>
                <button class="btn-remove" (click)="removeShift(i)">✕</button>
              </div>
              <div class="row-3">
                <div>
                  <label class="factory-label">Nom</label>
                  <input class="factory-input" [(ngModel)]="shift.name" placeholder="ex: Matin" />
                </div>
                <div>
                  <label class="factory-label">Abréviation</label>
                  <input class="factory-input" [(ngModel)]="shift.shortName" placeholder="M" maxlength="4" />
                </div>
                <div>
                  <label class="factory-label">Couleur</label>
                  <input type="color" [(ngModel)]="shift.color" class="color-picker" style="width:100%;height:42px;" />
                </div>
              </div>
              <div class="row-2">
                <div>
                  <label class="factory-label">Heure début</label>
                  <input class="factory-input" type="time" [(ngModel)]="shift.startTime" />
                </div>
                <div>
                  <label class="factory-label">Heure fin</label>
                  <input class="factory-input" type="time" [(ngModel)]="shift.endTime" />
                </div>
              </div>
              <label class="toggle-row">
                <input type="checkbox" [(ngModel)]="shift.crossesMidnight" />
                <span style="font-size:13px;">Passe minuit</span>
              </label>
            </div>
          }
          <button class="btn-add" (click)="addShift()">+ Ajouter un quart</button>
          <button class="btn-factory-primary" style="margin-top:14px;" (click)="saveShifts()">
            💾 Enregistrer les quarts
          </button>
        </div>
      }

      <!-- ── STOP TYPES ── -->
      @if (activeTab() === 'stop-types') {
        <div class="config-section factory-card">
          <div class="cs-title">🛑 Types d'arrêts</div>
          @for (st of stopTypesForm; track $index; let i = $index) {
            <div class="list-editor-row">
              <input class="factory-input" [(ngModel)]="st.label" placeholder="ex: Panne mécanique" style="flex:1;" />
              <input type="color" [(ngModel)]="st.color" class="color-picker" />
              <label class="toggle" title="Planifié">
                <input type="checkbox" [(ngModel)]="st.isPlanned" />
                <span class="toggle-slider"></span>
              </label>
              <button class="btn-remove" (click)="stopTypesForm.splice(i,1)">✕</button>
            </div>
          }
          <button class="btn-add" (click)="stopTypesForm.push({label:'',color:'#FF4D6D',isPlanned:false,displayOrder:stopTypesForm.length})">+ Ajouter</button>
          <button class="btn-factory-primary" style="margin-top:14px;" (click)="saveStopTypes()">💾 Enregistrer</button>
        </div>
      }

      <!-- ── LOSS CAUSES ── -->
      @if (activeTab() === 'loss-causes') {
        <div class="config-section factory-card">
          <div class="cs-title">⚠️ Causes de pertes préformes</div>
          @for (lc of lossCausesForm; track $index; let i = $index) {
            <div class="list-editor-row">
              <input class="factory-input" [(ngModel)]="lc.label" placeholder="ex: Mauvaise chauffe" style="flex:1;" />
              <input type="color" [(ngModel)]="lc.color" class="color-picker" />
              <button class="btn-remove" (click)="lossCausesForm.splice(i,1)">✕</button>
            </div>
          }
          <button class="btn-add" (click)="lossCausesForm.push({label:'',color:'#FFB700',displayOrder:lossCausesForm.length})">+ Ajouter</button>
          <button class="btn-factory-primary" style="margin-top:14px;" (click)="saveLossCauses()">💾 Enregistrer</button>
        </div>
      }

      <!-- ── LIGNES ── -->
      @if (activeTab() === 'lines') {
        <div class="config-section">
          <div class="section-header">
            <div class="cs-title">🏭 Lignes de production</div>
            <button class="btn-add-inline" (click)="addLine()">+ Nouvelle ligne</button>
          </div>

          @if (loadingLines()) {
            <div class="loading-msg">Chargement...</div>
          }

          @for (line of linesForm; track $index; let i = $index) {
            <div class="entity-card factory-card" [class.editing]="line._editing">

              <!-- Vue résumé (non édition) -->
              @if (!line._editing) {
                <div class="entity-row">
                  <div class="entity-dot" [style.background]="line.color"></div>
                  <div class="entity-info">
                    <div class="entity-name">{{ line.name }}</div>
                    <div class="entity-sub">
                      {{ line.code }}
                      @if (line.nominalSpeed) { · {{ line.nominalSpeed | number }} bt/h }
                    </div>
                  </div>
                  <div class="entity-actions">
                    <button class="btn-icon edit" (click)="line._editing = true" title="Modifier">✏️</button>
                    <button class="btn-icon del"  (click)="deleteLine(i)"        title="Supprimer">🗑️</button>
                  </div>
                </div>
              }

              <!-- Formulaire édition -->
              @if (line._editing) {
                <div class="edit-form">
                  <div class="row-2">
                    <div>
                      <label class="factory-label">Code *</label>
                      <input class="factory-input" [(ngModel)]="line.code" placeholder="ex: LIGNE_36K" />
                    </div>
                    <div>
                      <label class="factory-label">Nom *</label>
                      <input class="factory-input" [(ngModel)]="line.name" placeholder="ex: Ligne 36 000" />
                    </div>
                  </div>
                  <div class="row-3">
                    <div>
                      <label class="factory-label">Cadence nominale (bt/h)</label>
                      <input class="factory-input" type="number" [(ngModel)]="line.nominalSpeed" />
                    </div>
                    <div>
                      <label class="factory-label">Cadence min</label>
                      <input class="factory-input" type="number" [(ngModel)]="line.minSpeed" />
                    </div>
                    <div>
                      <label class="factory-label">Cadence max</label>
                      <input class="factory-input" type="number" [(ngModel)]="line.maxSpeed" />
                    </div>
                  </div>
                  <div class="row-2">
                    <div>
                      <label class="factory-label">Couleur</label>
                      <div class="color-row">
                        <input type="color" [(ngModel)]="line.color" class="color-picker" />
                        <input class="factory-input" [(ngModel)]="line.color" style="flex:1;" />
                      </div>
                    </div>
                    <div>
                      <label class="factory-label">Icône (emoji)</label>
                      <input class="factory-input" [(ngModel)]="line.icon" placeholder="🏭" maxlength="4" />
                    </div>
                  </div>
                  <div class="edit-actions">
                    <button class="btn-cancel" (click)="cancelLine(i)">Annuler</button>
                    <button class="btn-save-item" (click)="saveLine(i)" [disabled]="!line.code || !line.name">
                      💾 Enregistrer
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          @if (!loadingLines() && linesForm.length === 0) {
            <div class="empty-msg">Aucune ligne configurée — ajoutes-en une</div>
          }
        </div>
      }


      <!-- ── PRODUITS ── -->
      @if (activeTab() === 'products') {
        <div class="config-section">

          <!-- Sélecteur de ligne -->
          <div class="product-line-filter">
            <label class="factory-label">Filtrer par ligne</label>
            <div class="line-filter-btns">
              <button class="lf-btn" [class.active]="productLineFilter === ''"
                      (click)="setProductLineFilter('')">Toutes</button>
              @for (l of linesForm; track l.id) {
                <button class="lf-btn" [style.--lc]="l.color"
                        [class.active]="productLineFilter === l.id"
                        (click)="setProductLineFilter(l.id ?? '')">
                  {{ l.icon }} {{ l.name }}
                </button>
              }
            </div>
          </div>

          <div class="section-header" style="margin-top:12px;">
            <div class="cs-title">🍾 Produits</div>
            <button class="btn-add-inline" (click)="addProduct()">+ Nouveau produit</button>
          </div>

          @if (loadingProducts()) {
            <div class="loading-msg">Chargement...</div>
          }

          @for (prod of filteredProducts(); track $index; let i = $index) {
            <div class="entity-card factory-card" [class.editing]="prod._editing">

              <!-- Vue résumé -->
              @if (!prod._editing) {
                <div class="entity-row">
                  <div class="entity-dot" [style.background]="prod.brandColor || '#888'"></div>
                  <div class="entity-info">
                    <div class="entity-name" [style.color]="prod.brandColor || 'var(--text)'">
                      {{ prod.name }}
                      @if (prod.volume) { <span class="prod-volume">{{ prod.volume }}</span> }
                      @if (prod.productCode) { <span class="prod-code">{{ prod.productCode }}</span> }
                    </div>
                    <div class="entity-sub">
                      {{ lineNameById(prod.productionLineId) }}
                      @if (prod.bottlesPerPack) { · {{ prod.bottlesPerPack }} bt/pack }
                      @if (prod.packsPerPallet) { · {{ prod.packsPerPallet }} packs/pal. }
                      @if (prod.nominalSpeed) { · {{ prod.nominalSpeed | number }} bt/h }
                    </div>
                  </div>
                  <div class="entity-actions">
                    <button class="btn-icon edit" (click)="prod._editing = true">✏️</button>
                    <button class="btn-icon del"  (click)="deleteProduct(i)">🗑️</button>
                  </div>
                </div>
              }

              <!-- Formulaire édition -->
              @if (prod._editing) {
                <div class="edit-form">

                  <!-- Ligne + Identification -->
                  <div class="row-2">
                    <div>
                      <label class="factory-label">Ligne de production *</label>
                      <select class="factory-input" [(ngModel)]="prod.productionLineId" name="prodLine_{{i}}">
                        <option value="">-- Choisir --</option>
                        @for (l of linesForm; track l.id) {
                          <option [value]="l.id">{{ l.name }}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label class="factory-label">Nom du produit *</label>
                      <input class="factory-input" [(ngModel)]="prod.name" placeholder="ex: Coca-Cola" />
                    </div>
                  </div>

                  <div class="row-3">
                    <div>
                      <label class="factory-label">Volume</label>
                      <input class="factory-input" [(ngModel)]="prod.volume" placeholder="ex: 2L, 30cl" />
                    </div>
                    <div>
                      <label class="factory-label">Code produit</label>
                      <input class="factory-input" [(ngModel)]="prod.productCode" placeholder="ex: CC2L" />
                    </div>
                    <div>
                      <label class="factory-label">Réf. interne</label>
                      <input class="factory-input" [(ngModel)]="prod.internalRef" placeholder="optionnel" />
                    </div>
                  </div>

                  <!-- Conditionnement -->
                  <div class="subsection-title">📦 Conditionnement</div>
                  <div class="row-3">
                    <div>
                      <label class="factory-label">Bouteilles / pack</label>
                      <input class="factory-input" type="number" [(ngModel)]="prod.bottlesPerPack"
                             placeholder="ex: 6" min="1" />
                    </div>
                    <div>
                      <label class="factory-label">Packs / palette</label>
                      <input class="factory-input" type="number" [(ngModel)]="prod.packsPerPallet"
                             placeholder="ex: 100" min="1" />
                    </div>
                    <div>
                      <label class="factory-label">Volume unitaire (cl)</label>
                      <input class="factory-input" type="number" [(ngModel)]="prod.unitCapacityCl"
                             placeholder="ex: 200" min="1" />
                    </div>
                  </div>

                  <!-- Affichage calculé -->
                  @if (prod.bottlesPerPack && prod.packsPerPallet) {
                    <div class="calc-preview">
                      🧮 1 palette = {{ prod.bottlesPerPack * prod.packsPerPallet | number }} bouteilles
                    </div>
                  }

                  <!-- Production + Branding -->
                  <div class="subsection-title" style="margin-top:12px;">🏭 Production & Branding</div>
                  <div class="row-3">
                    <div>
                      <label class="factory-label">Cadence nominale (bt/h)</label>
                      <input class="factory-input" type="number" [(ngModel)]="prod.nominalSpeed" />
                    </div>
                    <div>
                      <label class="factory-label">Tare bouteille (g)</label>
                      <input class="factory-input" type="number" [(ngModel)]="prod.tareWeightG"
                             placeholder="ex: 38" />
                    </div>
                    <div>
                      <label class="factory-label">Ordre affichage</label>
                      <input class="factory-input" type="number" [(ngModel)]="prod.displayOrder" />
                    </div>
                  </div>

                  <div class="row-2">
                    <div>
                      <label class="factory-label">Couleur de la marque</label>
                      <div class="color-row">
                        <input type="color" [(ngModel)]="prod.brandColor" class="color-picker" />
                        <input class="factory-input" [(ngModel)]="prod.brandColor" style="flex:1;" />
                      </div>
                    </div>
                    <div>
                      <label class="factory-label">URL icône (optionnel)</label>
                      <input class="factory-input" [(ngModel)]="prod.iconUrl"
                             placeholder="https://..." />
                    </div>
                  </div>

                  <!-- Prévisualisation -->
                  <div class="prod-preview" [style.border-color]="prod.brandColor || 'var(--border)'">
                    <div class="pp-dot" [style.background]="prod.brandColor || '#888'"></div>
                    <div>
                      <div class="pp-name" [style.color]="prod.brandColor || 'var(--text)'">
                        {{ prod.name || 'Nom produit' }}
                        @if (prod.volume) { {{ prod.volume }} }
                      </div>
                      <div class="pp-sub">
                        @if (prod.bottlesPerPack && prod.packsPerPallet) {
                          {{ prod.bottlesPerPack }} bt/pack · {{ prod.packsPerPallet }} packs/palette
                        } @else {
                          Conditionnement non configuré
                        }
                      </div>
                    </div>
                  </div>

                  <div class="edit-actions">
                    <button class="btn-cancel" (click)="cancelProduct(i)">Annuler</button>
                    <button class="btn-save-item" (click)="saveProduct(i)"
                            [disabled]="!prod.name || !prod.productionLineId">
                      💾 Enregistrer
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          @if (!loadingProducts() && filteredProducts().length === 0) {
            <div class="empty-msg">
              @if (productLineFilter) {
                Aucun produit sur cette ligne — ajoutes-en un
              } @else {
                Aucun produit configuré
              }
            </div>
          }
        </div>
      }

      <!-- ── MACHINES ── -->
      @if (activeTab() === 'machines') {
        <div class="config-section">

          <!-- Types de machines -->
          <div class="section-header">
            <div class="cs-title">⚙️ Types de machines</div>
            <button class="btn-add-inline" (click)="addMachineType()">+ Nouveau type</button>
          </div>

          @for (mt of machineTypesForm; track $index; let i = $index) {
            <div class="entity-card factory-card" [class.editing]="mt._editing">
              @if (!mt._editing) {
                <div class="entity-row">
                  <div class="entity-dot" [style.background]="mt.color"></div>
                  <div class="entity-info">
                    <div class="entity-name">{{ mt.icon }} {{ mt.label }}</div>
                    <div class="entity-sub">{{ mt.code }} @if (mt.description) { · {{ mt.description }} }</div>
                  </div>
                  <div class="entity-actions">
                    <button class="btn-icon training" (click)="openTraining(mt.id!, mt.label)">📚</button>
                    <button class="btn-icon edit" (click)="mt._editing = true">✏️</button>
                    <button class="btn-icon del"  (click)="deleteMachineType(i)">🗑️</button>
                  </div>
                </div>
              }
              @if (mt._editing) {
                <div class="edit-form">
                  <div class="row-2">
                    <div>
                      <label class="factory-label">Code *</label>
                      <input class="factory-input" [(ngModel)]="mt.code" placeholder="ex: SOUFFLEUSE" />
                    </div>
                    <div>
                      <label class="factory-label">Libellé *</label>
                      <input class="factory-input" [(ngModel)]="mt.label" placeholder="ex: Souffleuse" />
                    </div>
                  </div>
                  <div>
                    <label class="factory-label">Description</label>
                    <input class="factory-input" [(ngModel)]="mt.description" placeholder="Description courte..." />
                  </div>
                  <div class="row-2" style="margin-top:8px;">
                    <div>
                      <label class="factory-label">Couleur</label>
                      <div class="color-row">
                        <input type="color" [(ngModel)]="mt.color" class="color-picker" />
                        <input class="factory-input" [(ngModel)]="mt.color" style="flex:1;" />
                      </div>
                    </div>
                    <div>
                      <label class="factory-label">Icône (emoji)</label>
                      <input class="factory-input" [(ngModel)]="mt.icon" placeholder="⚙️" maxlength="4" />
                    </div>
                  </div>
                  <div class="edit-actions">
                    <button class="btn-cancel" (click)="cancelMachineType(i)">Annuler</button>
                    <button class="btn-save-item" (click)="saveMachineType(i)" [disabled]="!mt.code || !mt.label">💾 Enregistrer</button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Instances de machines sur les lignes -->
          <!-- ── PANNEAU FORMATION ── -->
          @if (trainingMachineTypeId()) {
            <div class="training-panel factory-card" style="margin-top:16px;">
              <div class="training-header">
                <div>
                  <div class="training-title">📚 Formation — {{ trainingMachineTypeLabel() }}</div>
                  <div class="training-sub">Ces informations seront visibles par tous les utilisateurs dans le module Machine</div>
                </div>
                <button class="btn-icon" (click)="trainingMachineTypeId.set(null)">✕</button>
              </div>

              <!-- Présentation générale -->
              <div style="margin-top:14px;">
                <label class="factory-label">Présentation générale</label>
                <textarea class="factory-input" [(ngModel)]="trainingForm.presentation"
                          rows="4" placeholder="Description générale de la machine, contexte d'utilisation..."></textarea>
              </div>

              <!-- ── Sections ── -->
              <div class="training-section-title">
                📋 Sections de formation
                <button class="btn-add-training" (click)="addTrainingSection()">+ Section</button>
              </div>

              @for (s of trainingForm.sections; track $index; let i = $index) {
                <div class="training-section-card" [class.danger]="s.niveau === 'DANGER'"
                     [class.attention]="s.niveau === 'ATTENTION'">
                  <div class="ts-row">
                    <input class="factory-input" [(ngModel)]="s.titre"
                           placeholder="Titre de la section (ex: Démarrage, Arrêt d'urgence...)"
                           style="flex:1;" />
                    <select class="factory-input niveau-select" [(ngModel)]="s.niveau">
                      <option value="INFO">ℹ️ Info</option>
                      <option value="ATTENTION">⚠️ Attention</option>
                      <option value="DANGER">🚨 Danger</option>
                    </select>
                    <button class="btn-icon del" (click)="removeTrainingSection(i)">🗑️</button>
                  </div>
                  <textarea class="factory-input" [(ngModel)]="s.contenu"
                            rows="3" placeholder="Contenu de la section..."
                            style="margin-top:6px;"></textarea>
                  <div style="margin-top:6px;">
                    <label class="factory-label" style="font-size:11px;">Points clés (un par ligne)</label>
                    <textarea class="factory-input" rows="3"
                              [value]="s.pointsCles.join('\n')"
                              (input)="updatePointsCles(i, $event)"
                              placeholder="Point 1&#10;Point 2&#10;Point 3"></textarea>
                  </div>
                </div>
              }

              <!-- ── Paramètres techniques ── -->
              <div class="training-section-title">
                📐 Paramètres techniques
                <button class="btn-add-training" (click)="addTrainingParam()">+ Paramètre</button>
              </div>

              @if (trainingForm.params.length > 0) {
                <table class="params-table">
                  <thead>
                    <tr>
                      <th>Paramètre</th>
                      <th>Valeur nominale</th>
                      <th>Unité</th>
                      <th>Min</th>
                      <th>Max</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of trainingForm.params; track $index; let i = $index) {
                      <tr>
                        <td><input class="factory-input" [(ngModel)]="p.nom" placeholder="ex: Pression P1" /></td>
                        <td><input class="factory-input" [(ngModel)]="p.valeurNominale" placeholder="ex: 4.5" /></td>
                        <td><input class="factory-input" [(ngModel)]="p.unite" placeholder="ex: bar" /></td>
                        <td><input class="factory-input" [(ngModel)]="p.valeurMin" placeholder="4.0" /></td>
                        <td><input class="factory-input" [(ngModel)]="p.valeurMax" placeholder="5.0" /></td>
                        <td><button class="btn-icon del" (click)="removeTrainingParam(i)">🗑️</button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }

              <!-- ── Documents ── -->
              <div class="training-section-title">
                📎 Documents & liens
                <button class="btn-add-training" (click)="addTrainingDoc()">+ Document</button>
              </div>

              @for (d of trainingForm.docs; track $index; let i = $index) {
                <div class="doc-row">
                  <select class="factory-input doc-type" [(ngModel)]="d.typeDoc">
                    <option value="PDF">📄 PDF</option>
                    <option value="VIDEO">🎥 Vidéo</option>
                    <option value="IMAGE">🖼️ Image</option>
                    <option value="LIEN">🔗 Lien</option>
                  </select>
                  <input class="factory-input" [(ngModel)]="d.titre"
                         placeholder="Titre du document" style="flex:1;" />
                  <input class="factory-input" [(ngModel)]="d.url"
                         placeholder="URL ou chemin..." style="flex:2;" />
                  <button class="btn-icon del" (click)="removeTrainingDoc(i)">🗑️</button>
                </div>
              }

              <!-- Bouton save -->
              <div style="margin-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                <button class="btn-cancel" (click)="trainingMachineTypeId.set(null)">Fermer</button>
                <button class="btn-factory-primary" [disabled]="savingTraining()"
                        (click)="saveTraining()">
                  {{ savingTraining() ? '⏳...' : '💾 Enregistrer la formation' }}
                </button>
              </div>
            </div>
          }

          <div class="section-header" style="margin-top:20px;">
            <div class="cs-title" style="font-size:14px;">🔩 Machines sur les lignes</div>
            <button class="btn-add-inline" (click)="addLineMachine()">+ Associer</button>
          </div>
          <p class="cs-desc">Associe les types de machines à chaque ligne de production.</p>

          @for (lm of lineMachinesForm; track $index; let i = $index) {
            <div class="entity-card factory-card" [class.editing]="lm._editing">
              @if (!lm._editing) {
                <div class="entity-row">
                  <div class="entity-dot" [style.background]="machineTypeColor(lm.machineTypeId)"></div>
                  <div class="entity-info">
                    <div class="entity-name">{{ lm.displayName || machineTypeLabel(lm.machineTypeId) }}</div>
                    <div class="entity-sub">{{ lineName(lm.productionLineId) }} · {{ machineTypeLabel(lm.machineTypeId) }}
                      @if ((lm.instanceNumber ?? 1) > 1) { · #{{ lm.instanceNumber }} }
                    </div>
                  </div>
                  <div class="entity-actions">
                    <button class="btn-icon edit" (click)="lm._editing = true">✏️</button>
                    <button class="btn-icon del"  (click)="deleteLineMachine(i)">🗑️</button>
                  </div>
                </div>
              }
              @if (lm._editing) {
                <div class="edit-form">
                  <div class="row-2">
                    <div>
                      <label class="factory-label">Ligne *</label>
                      <select class="factory-input" [(ngModel)]="lm.productionLineId">
                        <option value="">-- Choisir --</option>
                        @for (l of linesForm; track l.id) {
                          <option [value]="l.id">{{ l.name }}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label class="factory-label">Type de machine *</label>
                      <select class="factory-input" [(ngModel)]="lm.machineTypeId">
                        <option value="">-- Choisir --</option>
                        @for (mt of machineTypesForm; track mt.id) {
                          <option [value]="mt.id">{{ mt.label }}</option>
                        }
                      </select>
                    </div>
                  </div>
                  <div class="row-2">
                    <div>
                      <label class="factory-label">Nom affiché</label>
                      <input class="factory-input" [(ngModel)]="lm.displayName" placeholder="ex: Souffleuse SBO-20" />
                    </div>
                    <div>
                      <label class="factory-label">N° instance</label>
                      <input class="factory-input" type="number" [(ngModel)]="lm.instanceNumber" min="1" />
                    </div>
                  </div>
                  <div class="row-2">
                    <div>
                      <label class="factory-label">N° de série</label>
                      <input class="factory-input" [(ngModel)]="lm.serialNumber" placeholder="optionnel" />
                    </div>
                    <div>
                      <label class="factory-label">Année installation</label>
                      <input class="factory-input" type="number" [(ngModel)]="lm.installationYear" placeholder="ex: 2018" />
                    </div>
                  </div>
                  <div class="edit-actions">
                    <button class="btn-cancel" (click)="cancelLineMachine(i)">Annuler</button>
                    <button class="btn-save-item" (click)="saveLineMachine(i)"
                            [disabled]="!lm.productionLineId || !lm.machineTypeId">💾 Enregistrer</button>
                  </div>
                </div>
              }
            </div>
          }

          @if (!loadingMachines() && lineMachinesForm.length === 0) {
            <div class="empty-msg">Aucune machine associée à une ligne</div>
          }
        </div>
      }


      <!-- ── RÔLES ── -->
      @if (activeTab() === 'roles') {
        <div class="config-section">
          <div class="section-header">
            <div class="cs-title">🔑 Rôles & Permissions</div>
            <button class="btn-add-inline" (click)="openCreateRole()">+ Nouveau rôle</button>
          </div>
          <p class="cs-desc">Définissez les rôles de votre usine et leurs accès module par module.</p>

          @if (loadingRoles()) {
            <div class="loading-msg">Chargement...</div>
          }

          @for (role of roles; track role.id) {
            <div class="entity-card factory-card" [class.editing]="role._editing"
                 [style.border-left-color]="role.isSystemRole ? '#6B7A9C' : 'var(--factory-secondary)'"
                 style="border-left-width: 3px; border-left-style: solid;">

              <!-- Vue résumé -->
              @if (!role._editing) {
                <div class="entity-row">
                  <div class="entity-info">
                    <div class="entity-name">
                      {{ role.isSystemRole ? '🔒' : '✏️' }} {{ role.name }}
                      @if (role.isSystemRole) {
                        <span class="role-system-badge">Système</span>
                      } @else {
                        <span class="role-custom-badge">Personnalisé</span>
                      }
                    </div>
                    <div class="entity-sub">{{ role.code }} · {{ role.permissions.length }} permission(s)</div>
                    @if (role.description) { <div class="entity-sub">{{ role.description }}</div> }
                  </div>
                  <div class="entity-actions">
                    <button class="btn-icon edit" (click)="toggleEditRole(role)">
                      {{ role.isSystemRole ? '👁' : '✏️' }}
                    </button>
                    @if (!role.isSystemRole) {
                      <button class="btn-icon del" (click)="deleteRole(role)">🗑️</button>
                    }
                  </div>
                </div>
              }

              <!-- Matrice permissions -->
              @if (role._editing) {
                <div>
                  <div class="role-edit-header">
                    <div>
                      <div class="entity-name">
                        {{ role.isSystemRole ? '🔒' : '✏️' }} {{ role.name }}
                      </div>
                      @if (!role.isSystemRole) {
                        <div class="perm-count-label">
                          {{ getPermCount(role) }} permission(s) sélectionnée(s)
                        </div>
                      } @else {
                        <div class="perm-readonly-label">Rôle système — lecture seule</div>
                      }
                    </div>
                    <button class="btn-close-role" (click)="toggleEditRole(role)">✕ Fermer</button>
                  </div>

                  <div class="matrix-wrap">
                    <table class="matrix-table">
                      <thead>
                        <tr>
                          <th class="th-module">Module</th>
                          @for (action of ALL_ACTIONS; track action) {
                            <th class="th-action">{{ actionLabel(action) }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (group of permGroups; track group.module) {
                          <tr>
                            <td class="td-module">{{ moduleLabel(group.module) }}</td>
                            @for (action of ALL_ACTIONS; track action) {
                              <td class="td-perm">
                                @if (hasPermInGroup(group, action)) {
                                  <label class="perm-check" [class.checked]="isPermChecked(role, group, action)"
                                         [class.disabled]="role.isSystemRole">
                                    <input type="checkbox"
                                           [checked]="isPermChecked(role, group, action)"
                                           [disabled]="role.isSystemRole"
                                           (change)="togglePerm(role, group, action, $event)" />
                                    <span class="check-box"></span>
                                  </label>
                                } @else {
                                  <span class="no-perm">—</span>
                                }
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  @if (!role.isSystemRole) {
                    <div class="edit-actions">
                      <button class="btn-cancel" (click)="toggleEditRole(role)">Annuler</button>
                      <button class="btn-save-item" (click)="saveRolePerms(role)"
                              [disabled]="savingRole()">
                        {{ savingRole() ? '⏳...' : '💾 Enregistrer' }}
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }

          @if (!loadingRoles() && roles.length === 0) {
            <div class="empty-msg">Aucun rôle configuré</div>
          }
        </div>

        <!-- Modal créer rôle -->
        @if (showCreateRole()) {
          <div class="modal-overlay" (click)="showCreateRole.set(false)">
            <div class="modal-card" (click)="$event.stopPropagation()">
              <div class="modal-title">✏️ Nouveau rôle</div>

              <div class="row-2" style="margin-top: 14px;">
                <div>
                  <label class="factory-label">Code *</label>
                  <input class="factory-input" [(ngModel)]="newRole.code"
                         placeholder="ex: CHEF_LIGNE" style="text-transform:uppercase;" />
                </div>
                <div>
                  <label class="factory-label">Nom affiché *</label>
                  <input class="factory-input" [(ngModel)]="newRole.name"
                         placeholder="ex: Chef de Ligne" />
                </div>
              </div>
              <div>
                <label class="factory-label">Description</label>
                <input class="factory-input" [(ngModel)]="newRole.description"
                       placeholder="Rôle pour..." />
              </div>

              <!-- Matrice initiale -->
              <label class="factory-label" style="margin-top: 14px;">Permissions initiales</label>
              <div class="matrix-wrap" style="margin-top: 8px;">
                <table class="matrix-table">
                  <thead>
                    <tr>
                      <th class="th-module">Module</th>
                      @for (action of ALL_ACTIONS; track action) {
                        <th class="th-action">{{ actionLabel(action) }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (group of permGroups; track group.module) {
                      <tr>
                        <td class="td-module">{{ moduleLabel(group.module) }}</td>
                        @for (action of ALL_ACTIONS; track action) {
                          <td class="td-perm">
                            @if (hasPermInGroup(group, action)) {
                              <label class="perm-check" [class.checked]="newRole.permissionIds.includes(getGroupPermId(group, action))">
                                <input type="checkbox"
                                       [checked]="newRole.permissionIds.includes(getGroupPermId(group, action))"
                                       (change)="toggleNewPerm(group, action, $event)" />
                                <span class="check-box"></span>
                              </label>
                            } @else {
                              <span class="no-perm">—</span>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="perm-count-label" style="margin-top: 6px;">
                {{ newRole.permissionIds.length }} permission(s) sélectionnée(s)
              </div>

              <div class="modal-actions">
                <button class="btn-cancel" (click)="showCreateRole.set(false)">Annuler</button>
                <button class="btn-save-item"
                        [disabled]="!newRole.code || !newRole.name || savingRole()"
                        (click)="createRole()">
                  {{ savingRole() ? '⏳...' : '✅ Créer' }}
                </button>
              </div>
            </div>
          </div>
        }
      }

      <!-- ── UTILISATEURS ── -->
      @if (activeTab() === 'users') {
        <div class="config-section">
          <div class="section-header">
            <div class="cs-title">👥 Utilisateurs</div>
            <button class="btn-add-inline" (click)="addUser()">+ Nouvel utilisateur</button>
          </div>

          @if (loadingUsers()) {
            <div class="loading-msg">Chargement...</div>
          }

          @for (user of usersForm; track $index; let i = $index) {
            <div class="entity-card factory-card" [class.editing]="user._editing">
              @if (!user._editing) {
                <div class="entity-row">
                  <div class="user-avatar-sm">{{ userInitials(user) }}</div>
                  <div class="entity-info">
                    <div class="entity-name">{{ user.firstName }} {{ user.lastName }}</div>
                    <div class="entity-sub">{{ user.email }}
                      @if (user.jobTitle) { · {{ user.jobTitle }} }
                    </div>
                    <div class="role-chips">
                      @for (r of user.roleCodes; track r) {
                        <span class="role-chip" [class]="roleClass(r)">{{ roleLabel(r) }}</span>
                      }
                      @if (user.isTeamLeader) {
                        <span class="role-chip team-leader-chip">👷 Chef d'équipe</span>
                      }
                    </div>
                  </div>
                  <div class="entity-actions">
                    <button class="btn-icon edit" (click)="user._editing = true">✏️</button>
                    @if (!user._new) {
                      <button class="btn-icon del" (click)="deleteUser(i)">🗑️</button>
                    }
                  </div>
                </div>
              }
              @if (user._editing) {
                <div class="edit-form">
                  <div class="row-2">
                    <div>
                      <label class="factory-label">Prénom *</label>
                      <input class="factory-input" [(ngModel)]="user.firstName" placeholder="Jean" />
                    </div>
                    <div>
                      <label class="factory-label">Nom *</label>
                      <input class="factory-input" [(ngModel)]="user.lastName" placeholder="Dupont" />
                    </div>
                  </div>
                  <div>
                    <label class="factory-label">Email *</label>
                    <input class="factory-input" type="email" [(ngModel)]="user.email"
                           placeholder="jean.dupont@factory.com"
                           [attr.readonly]="!user._new ? true : null" />
                  </div>
                  <div class="row-2" style="margin-top:8px;">
                    <div>
                      <label class="factory-label">Poste / Métier</label>
                      <input class="factory-input" [(ngModel)]="user.jobTitle" placeholder="ex: Mécanicien" />
                    </div>
                    <div>
                      <label class="factory-label">Téléphone</label>
                      <input class="factory-input" [(ngModel)]="user.phone" placeholder="+237 6xx xxx xxx" />
                    </div>
                  </div>
                  <div class="row-2" style="margin-top:8px;">
                    <div>
                      <label class="factory-label">Langue</label>
                      <select class="factory-input" [(ngModel)]="user.preferredLanguage">
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                      </select>
                    </div>
                    @if (user._new) {
                      <div>
                        <label class="factory-label">Mot de passe temporaire</label>
                        <input class="factory-input" [(ngModel)]="user.temporaryPassword"
                               placeholder="Min. 8 caractères" />
                      </div>
                    }
                  </div>

                  <!-- Rôles -->
                  <label class="factory-label" style="margin-top:11px;">Rôle(s)</label>
                  <div class="role-selector">
                    @for (role of availableRoles; track role.code) {
                      <button type="button"
                              [class]="roleButtonClass(role.code, user.roleCodes)"
                              (click)="toggleRole(user, role.code)">
                        @if (user.roleCodes.includes(role.code)) { ✓ }
                        {{ role.label }}
                      </button>
                    }
                  </div>

                  <!-- Chef d'équipe -->
                  <label class="team-leader-toggle">
                    <input type="checkbox" [(ngModel)]="user.isTeamLeader" />
                    <span class="check-box"></span>
                    <span>
                      👷 Peut être désigné chef d'équipe
                      <span class="team-leader-hint">Apparaîtra dans la liste de sélection des fiches de quart</span>
                    </span>
                  </label>

                  @if (!user._new) {
                    <button class="btn-reset-pwd" (click)="openResetPassword(user)">
                      🔑 Réinitialiser le mot de passe
                    </button>
                  }

                  <div class="edit-actions">
                    <button class="btn-cancel" (click)="cancelUser(i)">Annuler</button>
                    <button class="btn-save-item" (click)="saveUser(i)"
                            [disabled]="!user.firstName || !user.lastName || !user.email || savingUser()">
                      {{ savingUser() ? '⏳...' : '💾 Enregistrer' }}
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          @if (!loadingUsers() && usersForm.length === 0) {
            <div class="empty-msg">Aucun utilisateur — ajoutes-en un</div>
          }
        </div>

        <!-- Modal reset mot de passe -->
        @if (resetPwdUser()) {
          <div class="modal-overlay" (click)="resetPwdUser.set(null)">
            <div class="modal-card" (click)="$event.stopPropagation()">
              <div class="modal-title">🔑 Réinitialiser le mot de passe</div>
              <div class="modal-sub">{{ resetPwdUser()!.firstName }} {{ resetPwdUser()!.lastName }}</div>
              <label class="factory-label" style="margin-top:14px;">Nouveau mot de passe *</label>
              <input class="factory-input" [(ngModel)]="newPassword" type="password"
                     placeholder="Min. 8 caractères" />
              <div class="modal-actions">
                <button class="btn-cancel" (click)="resetPwdUser.set(null)">Annuler</button>
                <button class="btn-save-item" (click)="confirmResetPassword()"
                        [disabled]="newPassword.length < 8">
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        }
      }

      <!-- ── POSTES ── -->
      @if (activeTab() === 'postes') {
        <div class="config-section">
          <div class="section-header">
            <div class="cs-title">🪑 Postes de travail</div>
            <button class="btn-add-inline" (click)="openAddPoste()">+ Poste</button>
          </div>
          <p class="cs-desc">Définissez les postes de travail de votre usine. Un poste machine est lié à un type de machine existant.</p>

          @if (showPosteForm()) {
            <div class="inline-form factory-card" style="margin-bottom:12px;">
              <div class="if-title">Nouveau poste</div>
              <div class="row-2">
                <div>
                  <label class="factory-label">Nom du poste *</label>
                  <input class="factory-input" [(ngModel)]="posteForm.nom" placeholder="ex: Opérateur Souffleuse" />
                </div>
                <div>
                  <label class="factory-label">Type de machine (optionnel)</label>
                  <select class="factory-input" [(ngModel)]="posteForm.machineTypeId">
                    <option value="">-- Poste fonctionnel --</option>
                    @for (mt of config.machineTypes(); track mt.id) {
                      <option [value]="mt.id">{{ mt.label }}</option>
                    }
                  </select>
                </div>
              </div>
              <label class="poste-machine-toggle" style="margin-top:10px;">
                <input type="checkbox" [(ngModel)]="posteForm.isMachineOp" />
                <span>Poste opérateur machine</span>
              </label>
              <div class="if-actions">
                <button class="btn-cancel-sm" (click)="showPosteForm.set(false)">Annuler</button>
                <button class="btn-save-sm" [disabled]="!posteForm.nom || savingPoste()" (click)="savePoste()">
                  {{ savingPoste() ? '⏳' : '✅ Ajouter' }}
                </button>
              </div>
            </div>
          }

          @for (poste of postes; track poste.id) {
            <div class="entity-card factory-card">
              @if (editingPosteId() !== poste.id) {
                <div class="entity-row">
                  <div class="entity-info">
                    <div class="entity-name">
                      {{ poste.isMachineOp ? '⚙️' : '👤' }} {{ poste.nom }}
                      @if (poste.machineTypeLabel) {
                        <span class="machine-link-badge">→ {{ poste.machineTypeLabel }}</span>
                      }
                    </div>
                  </div>
                  <div class="entity-actions">
                    <button class="btn-icon edit" (click)="startEditPoste(poste)">✏️</button>
                    <button class="btn-icon del"  (click)="deletePoste(poste.id)">🗑️</button>
                  </div>
                </div>
              } @else {
                <div class="if-title">Modifier le poste</div>
                <div class="row-2">
                  <div>
                    <label class="factory-label">Nom *</label>
                    <input class="factory-input" [(ngModel)]="posteEditForm.nom" />
                  </div>
                  <div>
                    <label class="factory-label">Type de machine</label>
                    <select class="factory-input" [(ngModel)]="posteEditForm.machineTypeId">
                      <option value="">-- Poste fonctionnel --</option>
                      @for (mt of config.machineTypes(); track mt.id) {
                        <option [value]="mt.id">{{ mt.label }}</option>
                      }
                    </select>
                  </div>
                </div>
                <label class="poste-machine-toggle" style="margin-top:8px;">
                  <input type="checkbox" [(ngModel)]="posteEditForm.isMachineOp" />
                  <span>Poste opérateur machine</span>
                </label>
                <div class="if-actions">
                  <button class="btn-cancel-sm" (click)="editingPosteId.set(null)">Annuler</button>
                  <button class="btn-save-sm" [disabled]="!posteEditForm.nom" (click)="saveEditPoste(poste.id)">💾 Enregistrer</button>
                </div>
              }
            </div>
          }
          @if (postes.length === 0) { <div class="empty-msg">Aucun poste configuré</div> }
        </div>
      }

      <!-- ── ÉQUIPES ── -->
      @if (activeTab() === 'equipes') {
        <div class="config-section">
          <div class="section-header">
            <div class="cs-title">🏭 Équipes par ligne</div>
          </div>
          <p class="cs-desc">Créez les équipes pour chaque ligne de production et assignez leurs membres.</p>

          <label class="factory-label">Ligne de production</label>
          <select class="factory-input" [(ngModel)]="selectedLineId" (ngModelChange)="loadEquipes()">
            <option value="">-- Sélectionner une ligne --</option>
            @for (line of config.lines(); track line.id) {
              <option [value]="line.id">{{ line.name }}</option>
            }
          </select>

          @if (selectedLineId) {
            <div style="margin-top:14px;">
              <button class="btn-add-inline" (click)="openAddEquipe()">+ Équipe</button>
            </div>

            @if (showEquipeForm()) {
              <div class="inline-form factory-card" style="margin-top:10px;">
                <div class="if-title">Nouvelle équipe</div>
                <div class="row-2">
                  <div>
                    <label class="factory-label">Nom *</label>
                    <input class="factory-input" [(ngModel)]="equipeForm.nom" placeholder="ex: Équipe A" />
                  </div>
                  <div>
                    <label class="factory-label">Couleur</label>
                    <input class="factory-input" type="color" [(ngModel)]="equipeForm.couleur" />
                  </div>
                </div>
                <div class="if-actions">
                  <button class="btn-cancel-sm" (click)="showEquipeForm.set(false)">Annuler</button>
                  <button class="btn-save-sm" [disabled]="!equipeForm.nom" (click)="saveEquipe()">✅ Créer</button>
                </div>
              </div>
            }

            @for (equipe of equipes; track equipe.id) {
              <div class="equipe-config-card factory-card" style="margin-top:10px;">
                <div class="ec-header">
                  @if (editingEquipeId() !== equipe.id) {
                    <div style="display:flex;align-items:center;gap:8px;flex:1;">
                      <span class="equipe-dot-lg" [style.background]="equipe.couleur"></span>
                      <span class="entity-name">{{ equipe.nom }}</span>
                      <span class="equipe-order-badge">Ordre {{ equipe.ordre + 1 }}</span>
                    </div>
                    <div style="display:flex;gap:6px;">
                      <button class="btn-icon edit" (click)="startEditEquipe(equipe)">✏️</button>
                      <button class="btn-icon del"  (click)="deleteEquipe(equipe.id)">🗑️</button>
                      <button class="btn-add-membre-sm" (click)="openAddMembre(equipe.id)">+ Membre</button>
                    </div>
                  } @else {
                    <div class="row-2" style="flex:1;margin-right:10px;">
                      <div>
                        <label class="factory-label" style="font-size:10px;">Nom</label>
                        <input class="factory-input" [(ngModel)]="equipeEditForm.nom"
                               (keydown.enter)="saveEditEquipe(equipe.id)"
                               (keydown.escape)="editingEquipeId.set(null)" />
                      </div>
                      <div>
                        <label class="factory-label" style="font-size:10px;">Couleur</label>
                        <input class="factory-input" type="color" [(ngModel)]="equipeEditForm.couleur" />
                      </div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:flex-end;padding-bottom:2px;">
                      <button class="btn-icon" (click)="editingEquipeId.set(null)">✕</button>
                      <button class="btn-icon save" (click)="saveEditEquipe(equipe.id)">✓</button>
                    </div>
                  }
                </div>

                @if (addingMembreToEquipeId() === equipe.id) {
                  <div class="add-membre-form">
                    <div class="row-2">
                      <div>
                        <label class="factory-label">Utilisateur</label>
                        <select class="factory-input" [(ngModel)]="membreForm.userId">
                          <option value="">-- Sélectionner --</option>
                          @for (u of usersForm; track u.id) {
                            <option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</option>
                          }
                        </select>
                      </div>
                      <div>
                        <label class="factory-label">Poste</label>
                        <select class="factory-input" [(ngModel)]="membreForm.posteId">
                          <option value="">-- Sélectionner --</option>
                          @for (p of postes; track p.id) {
                            <option [value]="p.id">{{ p.nom }}</option>
                          }
                        </select>
                      </div>
                    </div>
                    <div class="if-actions">
                      <button class="btn-cancel-sm" (click)="addingMembreToEquipeId.set(null)">Annuler</button>
                      <button class="btn-save-sm" [disabled]="!membreForm.userId || !membreForm.posteId" (click)="saveMembre(equipe.id)">✅ Ajouter</button>
                    </div>
                  </div>
                }

                <div class="membres-list">
                  @for (m of equipe.membres; track m.id) {
                    <div class="membre-row">
                      <span class="membre-name">{{ m.userFullName }}</span>
                      <span class="membre-poste">{{ m.posteNom }}</span>
                      <button class="btn-icon del" (click)="removeMembre(m.id, equipe.id)">🗑️</button>
                    </div>
                  }
                  @if (!equipe.membres.length) {
                    <div class="empty-msg" style="padding:8px 0;">Aucun membre</div>
                  }
                </div>
              </div>
            }
          }
        </div>
      }

      <!-- ── TYPES DE PRÉFORMES ── -->
      @if (activeTab() === 'preformes') {
        <div class="config-section">
          <div class="section-header">
            <div class="cs-title">🧴 Types / Marques de Préformes</div>
            <button class="btn-add-inline" (click)="openAddPreforme()">+ Préforme</button>
          </div>
          <p class="cs-desc">Définissez les types de préformes utilisés sur vos lignes. Ils seront disponibles dans le module Soufflage.</p>

          @if (showPreformeForm()) {
            <div class="inline-form factory-card" style="margin-bottom:12px;">
              <div class="if-title">{{ editingPreformeId() ? 'Modifier' : 'Nouvelle' }} préforme</div>
              <div class="row-2">
                <div>
                  <label class="factory-label">Nom / Référence *</label>
                  <input class="factory-input" [(ngModel)]="preformeForm.nom"
                         placeholder="ex: Sidel 28mm 30g" />
                </div>
                <div>
                  <label class="factory-label">Fournisseur / Marque</label>
                  <input class="factory-input" [(ngModel)]="preformeForm.fournisseur"
                         placeholder="ex: Sidel, Alpla..." />
                </div>
              </div>
              <div class="row-2" style="margin-top:10px;">
                <div>
                  <label class="factory-label">Poids (g)</label>
                  <input class="factory-input" type="number" [(ngModel)]="preformeForm.poidsG"
                         placeholder="ex: 30.5" step="0.1" />
                </div>
                <div>
                  <label class="factory-label">Notes</label>
                  <input class="factory-input" [(ngModel)]="preformeForm.notes"
                         placeholder="Information complémentaire..." />
                </div>
              </div>
              <div class="if-actions">
                <button class="btn-cancel-sm" (click)="cancelPreformeForm()">Annuler</button>
                <button class="btn-save-sm" [disabled]="!preformeForm.nom || savingPreforme()"
                        (click)="savePreforme()">
                  {{ savingPreforme() ? '⏳' : (editingPreformeId() ? '💾 Modifier' : '✅ Ajouter') }}
                </button>
              </div>
            </div>
          }

          @for (pf of typePreformes; track pf.id) {
            <div class="entity-card factory-card">
              <div class="entity-row">
                <div class="entity-info">
                  <div class="entity-name">
                    🧴 {{ pf.nom }}
                    @if (pf.fournisseur) {
                      <span class="machine-link-badge">{{ pf.fournisseur }}</span>
                    }
                  </div>
                  @if (pf.poidsG) {
                    <div class="entity-sub">{{ pf.poidsG }} g</div>
                  }
                  @if (pf.notes) {
                    <div class="entity-sub" style="font-style:italic;">{{ pf.notes }}</div>
                  }
                </div>
                <div class="entity-actions">
                  <button class="btn-icon edit" (click)="startEditPreforme(pf)">✏️</button>
                  <button class="btn-icon del"  (click)="deletePreforme(pf.id)">🗑️</button>
                </div>
              </div>
            </div>
          }
          @if (typePreformes.length === 0) {
            <div class="empty-msg">Aucun type de préforme configuré</div>
          }
        </div>
      }

      <!-- ── TYPES DE PERTES ── -->
      @if (activeTab() === 'loss-types') {
        <div class="config-section">
          <div class="section-header">
            <div class="cs-title">📉 Types de pertes</div>
            <button class="btn-add-inline" (click)="openAddLossType()">+ Type</button>
          </div>
          <p class="cs-desc">Définissez les types de pertes à suivre (préformes, étiquettes, film thermo, bouchons...) avec leur unité de mesure.</p>

          @if (showLossTypeForm()) {
            <div class="inline-form factory-card" style="margin-bottom:12px;">
              <div class="if-title">{{ editingLossTypeId() ? 'Modifier' : 'Nouveau' }} type de perte</div>
              <div class="row-2">
                <div>
                  <label class="factory-label">Nom *</label>
                  <input class="factory-input" [(ngModel)]="lossTypeForm.nom"
                         placeholder="ex: Préformes, Étiquettes..." />
                </div>
                <div>
                  <label class="factory-label">Unité *</label>
                  <select class="factory-input" [(ngModel)]="lossTypeForm.unite">
                    <option value="unités">unités</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="m">m (mètres)</option>
                    <option value="L">L (litres)</option>
                    <option value="%">%</option>
                    <option value="custom">Autre...</option>
                  </select>
                  @if (lossTypeForm.unite === 'custom') {
                    <input class="factory-input" style="margin-top:6px;"
                           [(ngModel)]="lossTypeForm.uniteCustom" placeholder="Unité personnalisée..." />
                  }
                </div>
              </div>
              <div style="margin-top:10px;">
                <label class="factory-label">Couleur</label>
                <input class="factory-input" type="color" [(ngModel)]="lossTypeForm.color" style="height:38px;" />
              </div>
              <div class="if-actions">
                <button class="btn-cancel-sm" (click)="cancelLossTypeForm()">Annuler</button>
                <button class="btn-save-sm" [disabled]="!lossTypeForm.nom || savingLossType()"
                        (click)="saveLossType()">
                  {{ savingLossType() ? '⏳' : (editingLossTypeId() ? '💾 Modifier' : '✅ Ajouter') }}
                </button>
              </div>
            </div>
          }

          @for (lt of lossTypes; track lt.id) {
            <div class="entity-card factory-card">
              <div class="entity-row">
                <div class="entity-info">
                  <div class="entity-name">
                    <span class="loss-type-dot" [style.background]="lt.color"></span>
                    {{ lt.nom }}
                    <span class="unite-badge">{{ lt.unite }}</span>
                  </div>
                </div>
                <div class="entity-actions">
                  <button class="btn-icon edit" (click)="startEditLossType(lt)">✏️</button>
                  <button class="btn-icon del"  (click)="deleteLossType(lt.id)">🗑️</button>
                </div>
              </div>
            </div>
          }
          @if (lossTypes.length === 0) {
            <div class="empty-msg">Aucun type de perte configuré</div>
          }
        </div>
      }

      <!-- ── ROTATIONS ── -->
      @if (activeTab() === 'rotations') {
        <div class="config-section">
          <div class="section-header">
            <div class="cs-title">🔄 Configuration des rotations</div>
          </div>
          <p class="cs-desc">Définissez le cycle de rotation des équipes pour chaque ligne.</p>

          <label class="factory-label">Ligne de production</label>
          <select class="factory-input" [(ngModel)]="selectedLineId" (ngModelChange)="loadRotationConfig()">
            <option value="">-- Sélectionner une ligne --</option>
            @for (line of config.lines(); track line.id) {
              <option [value]="line.id">{{ line.name }}</option>
            }
          </select>

          @if (selectedLineId) {
            <div class="rotation-form factory-card" style="margin-top:14px;">
              <div class="row-2">
                <div>
                  <label class="factory-label">Nombre d'équipes</label>
                  <input class="factory-input" type="number" [(ngModel)]="rotationForm.nbEquipes" min="2" max="6" />
                </div>
                <div>
                  <label class="factory-label">Date de référence (J0 du cycle)</label>
                  <input class="factory-input" type="date" [(ngModel)]="rotationForm.startDate" />
                </div>
              </div>

              <!-- Mode de repos -->
              <div style="margin-top:14px;">
                <label class="factory-label">Mode de repos</label>
                <div class="repos-mode-selector">
                  <button class="repos-mode-btn" [class.active]="rotationForm.reposMode === 'CYCLIQUE'"
                          (click)="rotationForm.reposMode = 'CYCLIQUE'">
                    🔄 Cyclique
                    <span class="repos-mode-desc">Repos défini dans les blocs (ex: 1 jour tous les 6)</span>
                  </button>
                  <button class="repos-mode-btn" [class.active]="rotationForm.reposMode === 'FIXE'"
                          (click)="rotationForm.reposMode = 'FIXE'">
                    📅 Jours fixes
                    <span class="repos-mode-desc">Repos le(s) même(s) jour(s) chaque semaine</span>
                  </button>
                </div>
              </div>

              <!-- Jours fixes de repos -->
              @if (rotationForm.reposMode === 'FIXE') {
                <div style="margin-top:12px;">
                  <label class="factory-label">Jours de repos (toutes les équipes)</label>
                  <div class="weekday-selector">
                    @for (day of weekDaysList; track day.value) {
                      <button class="weekday-btn"
                              [class.active]="rotationForm.fixedRestDays.includes(day.value)"
                              (click)="toggleRestDay(day.value)">
                        {{ day.label }}
                      </button>
                    }
                  </div>
                  @if (rotationForm.fixedRestDays.length === 0) {
                    <div class="field-hint" style="color:var(--color-warning);">⚠️ Sélectionnez au moins un jour de repos</div>
                  }
                </div>
              }

              <label class="factory-label" style="margin-top:14px;">
                Génération automatique
                <span class="cs-desc" style="font-size:11px;"> — le planning est recalculé chaque semaine</span>
              </label>
              <label class="poste-machine-toggle">
                <input type="checkbox" [(ngModel)]="rotationForm.autoGenerate" />
                <span>Activée</span>
              </label>

              <!-- Blocs du pattern -->
              <div style="margin-top:16px;">
                <div class="factory-label">
                  Pattern du cycle
                  <span class="cycle-total-badge">Total : {{ cycleTotalDays() }} jour(s) par cycle</span>
                  @if (rotationForm.reposMode === 'FIXE') {
                    <span class="repos-mode-info">Les blocs Repos dans le pattern seront ignorés (repos = jours fixes)</span>
                  }
                </div>
                @for (block of rotationForm.blocks; track $index; let i = $index) {
                  <div class="pattern-block-row">
                    <div class="block-num">{{ i + 1 }}</div>
                    <div class="row-3">
                      <div>
                        <label class="factory-label" style="font-size:10px;">Quart</label>
                        <select class="factory-input" [(ngModel)]="block.shiftConfigId"
                                (ngModelChange)="block.isRepos = !block.shiftConfigId">
                          <option value="">🛌 Repos (mode cyclique)</option>
                          @for (shift of config.shifts(); track shift.id) {
                            <option [value]="shift.id">{{ shift.name }}</option>
                          }
                        </select>
                      </div>
                      <div>
                        <label class="factory-label" style="font-size:10px;">Nb de jours</label>
                        <input class="factory-input" type="number" [(ngModel)]="block.nbJours" min="1" />
                      </div>
                      <div style="display:flex;align-items:flex-end;padding-bottom:2px;">
                        <button class="btn-icon del" (click)="removeBlock(i)">🗑️</button>
                      </div>
                    </div>
                  </div>
                }
                <button class="btn-add-block" (click)="addBlock()">+ Ajouter un bloc</button>
              </div>

              <button class="btn-factory-primary" style="margin-top:16px;"
                      [disabled]="savingRotation() || !rotationForm.startDate || !rotationForm.nbEquipes"
                      (click)="saveRotationConfig()">
                {{ savingRotation() ? '⏳ Enregistrement...' : '💾 Enregistrer la configuration' }}
              </button>
            </div>
          }
        </div>
      }

      @if (saved()) {
        <div class="save-toast">✅ Modifications enregistrées</div>
      }
      @if (errorMsg()) {
        <div class="error-toast">❌ {{ errorMsg() }}</div>
      }
    </div>
  `,
  styles: [`
    .config-page { max-width: 700px; margin: 0 auto; padding-bottom: 40px; }
    .page-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; }
    .config-tabs { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 16px; padding-bottom: 4px; }
    .config-tab {
      padding: 8px 14px; border-radius: 20px; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--text-muted);
      font-size: 12px; cursor: pointer; white-space: nowrap;
    }
    .config-tab.active { background: var(--factory-primary); color: #fff; border-color: transparent; }

    .cs-title { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
    .cs-desc  { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; margin-top: -4px; }

    /* Section header avec bouton add */
    .section-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px;
    }
    .section-header .cs-title { margin-bottom: 0; }
    .btn-add-inline {
      padding: 7px 14px; border-radius: 8px;
      border: 1px solid var(--factory-secondary);
      color: var(--factory-secondary); background: none;
      cursor: pointer; font-size: 13px; font-weight: 600;
      white-space: nowrap;
    }

    /* Entity card */
    .entity-card { margin-bottom: 8px; transition: border-color 0.15s; }
    .entity-card.editing { border-color: var(--factory-secondary); }
    .entity-row { display: flex; align-items: center; gap: 12px; }
    .entity-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .entity-info { flex: 1; min-width: 0; }
    .entity-name { font-weight: 700; font-size: 14px; }
    .entity-sub  { font-size: 12px; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .entity-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .btn-icon { background: none; border: none; cursor: pointer; padding: 5px 7px; border-radius: 6px; font-size: 15px; opacity: 0.6; transition: opacity 0.15s; }
    .btn-icon:hover { opacity: 1; background: var(--bg-card2); }
    .btn-icon.training { color: var(--factory-secondary); opacity: 0.8; }

    /* Formation */
    .training-panel { border: 2px solid var(--factory-secondary) !important; }
    .training-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .training-title { font-size: 15px; font-weight: 700; }
    .training-sub { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
    .training-section-title { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 700; margin: 16px 0 8px; padding-top: 14px; border-top: 1px solid var(--border); }
    .btn-add-training { padding: 4px 12px; border-radius: 6px; border: 1px dashed var(--factory-secondary); background: none; color: var(--factory-secondary); cursor: pointer; font-size: 12px; font-weight: 600; }
    .training-section-card { background: var(--bg-card2); border-radius: 8px; padding: 12px; margin-bottom: 8px; border-left: 3px solid var(--color-info); }
    .training-section-card.attention { border-left-color: var(--color-warning); }
    .training-section-card.danger { border-left-color: var(--color-danger); }
    .ts-row { display: flex; gap: 8px; align-items: center; }
    .niveau-select { width: 130px !important; flex-shrink: 0; }
    .params-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
    .params-table th { background: var(--bg-card2); padding: 7px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    .params-table td { padding: 5px 4px; border-bottom: 1px solid var(--border); }
    .params-table td input { padding: 5px 8px !important; font-size: 12px !important; }
    .doc-row { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
    .doc-type { width: 110px !important; flex-shrink: 0; }

    /* Edit form inside card */
    .edit-form { padding-top: 4px; }
    .edit-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
    .btn-cancel   { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border); background: none; color: var(--text-muted); cursor: pointer; font-size: 13px; }
    .btn-save-item {
      padding: 8px 18px; border-radius: 8px; background: var(--factory-primary);
      color: #fff; border: none; cursor: pointer; font-size: 13px; font-weight: 600;
    }
    .btn-save-item:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Grid layouts */
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
    .row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    @media(max-width: 480px) { .row-3 { grid-template-columns: 1fr 1fr; } }

    /* Color picker */
    .color-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 14px; }
    @media(max-width: 480px) { .color-grid { grid-template-columns: 1fr; } }
    .color-row { display: flex; gap: 8px; align-items: center; }
    .color-picker { width: 44px; height: 44px; border-radius: 8px; border: none; cursor: pointer; padding: 0; }

    /* Toggles */
    .module-toggles { margin-top: 16px; }
    .mt-title { font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 10px; text-transform: uppercase; }
    .mt-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
    .toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: var(--border); border-radius: 24px; transition: 0.2s; }
    .toggle-slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: 0.2s; }
    .toggle input:checked + .toggle-slider { background: var(--factory-primary); }
    .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }
    .toggle-row { display: flex; align-items: center; gap: 8px; cursor: pointer; }

    /* Preview */
    .preview-strip { display: flex; gap: 8px; }
    .geo-section { margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--border); }
    .btn-geo-detect { margin-top: 8px; padding: 7px 14px; border-radius: 8px; border: 1px dashed var(--factory-primary); background: none; color: var(--factory-primary); cursor: pointer; font-size: 12px; font-weight: 600; }
    .field-hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
    .preview-color { flex: 1; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; font-weight: 600; }

    /* Shifts */
    .shift-editor { background: var(--bg-card2); border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-bottom: 10px; }
    .shift-editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .shift-num { font-size: 13px; font-weight: 700; }

    /* Stop/loss list */
    .list-editor-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }

    /* Buttons */
    .btn-add {
      padding: 9px 16px; border-radius: 8px; border: 1px dashed var(--factory-secondary);
      color: var(--factory-secondary); background: none; cursor: pointer; font-size: 13px; width: 100%;
    }
    .btn-remove { background: none; border: none; color: var(--color-danger); cursor: pointer; font-size: 16px; padding: 4px 8px; }

    /* Users */
    .user-avatar-sm {
      width: 38px; height: 38px; border-radius: 50%;
      background: var(--factory-primary); color: #fff;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .role-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
    .role-chip { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .role-selector { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }

    /* Onglets RH */
    .machine-link-badge { font-size: 10px; color: var(--factory-secondary); background: var(--factory-secondary-light); padding: 1px 7px; border-radius: 6px; margin-left: 6px; }
    .poste-machine-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
    .equipe-config-card { }
    .ec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .equipe-dot-lg { width: 14px; height: 14px; border-radius: 50%; display: inline-block; }
    .equipe-order-badge { font-size: 10px; background: var(--bg-card2); border: 1px solid var(--border); border-radius: 8px; padding: 1px 8px; color: var(--text-muted); }
    .btn-add-membre-sm { padding: 5px 12px; border-radius: 6px; border: 1px solid var(--factory-secondary); color: var(--factory-secondary); background: var(--factory-secondary-light); cursor: pointer; font-size: 12px; font-weight: 600; }
    .add-membre-form { background: var(--bg-card2); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .membres-list { display: flex; flex-direction: column; gap: 4px; padding-left: 4px; border-left: 2px solid var(--border); margin-left: 11px; }
    .membre-row { display: flex; align-items: center; gap: 10px; padding: 6px 8px; }
    .membre-name { font-weight: 600; font-size: 13px; flex: 1; }
    .membre-poste { font-size: 12px; color: var(--text-muted); }
    .row-3 { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; flex: 1; }

    /* Rotation pattern */
    .cycle-total-badge { font-size: 11px; color: var(--factory-primary); background: var(--factory-primary-light); padding: 2px 8px; border-radius: 10px; margin-left: 8px; font-weight: 700; }
    .pattern-block-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; padding: 10px; background: var(--bg-card2); border-radius: 8px; }
    .block-num { width: 24px; height: 24px; border-radius: 50%; background: var(--factory-primary); color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 18px; }
    .btn-add-block { width: 100%; padding: 8px; border: 1px dashed var(--border); border-radius: 8px; background: none; color: var(--text-muted); cursor: pointer; font-size: 13px; margin-top: 6px; }
    .btn-add-block:hover { border-color: var(--factory-primary); color: var(--factory-primary); }

    /* Mode repos */
    .repos-mode-selector { display: flex; gap: 8px; margin-top: 6px; }
    .repos-mode-btn { flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card2); cursor: pointer; text-align: left; font-size: 13px; font-weight: 600; color: var(--text-muted); display: flex; flex-direction: column; gap: 3px; }
    .repos-mode-btn.active { border-color: var(--factory-primary); background: var(--factory-primary-bg, #1565C011); color: var(--factory-primary); }
    .repos-mode-desc { font-size: 11px; font-weight: 400; opacity: 0.8; }
    .repos-mode-info { font-size: 10px; color: var(--text-muted); margin-left: 8px; font-weight: 400; font-style: italic; }
    .weekday-selector { display: flex; gap: 5px; margin-top: 6px; flex-wrap: wrap; }
    .weekday-btn { padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card2); color: var(--text-muted); cursor: pointer; font-size: 12px; font-weight: 600; min-width: 42px; text-align: center; }
    .weekday-btn.active { background: var(--factory-secondary); border-color: var(--factory-secondary); color: #fff; }

    /* Types de pertes */
    .loss-type-dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; margin-right: 6px; vertical-align: middle; }
    .unite-badge { font-size: 10px; background: var(--bg-card2); border: 1px solid var(--border); border-radius: 6px; padding: 1px 7px; margin-left: 8px; color: var(--text-muted); }

    /* Chef d'équipe */
    .team-leader-toggle {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 12px; background: var(--bg-card2);
      border: 1px solid var(--border); border-radius: 8px;
      cursor: pointer; margin: 11px 0; font-size: 13px;
    }
    .team-leader-toggle input { display: none; }
    .team-leader-toggle .check-box {
      width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0;
      border: 2px solid var(--border); background: var(--bg-card);
      margin-top: 1px; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }
    .team-leader-toggle input:checked + .check-box {
      background: var(--factory-secondary); border-color: var(--factory-secondary);
    }
    .team-leader-toggle input:checked + .check-box::after {
      content: '✓'; color: #fff; font-size: 11px; font-weight: 900;
    }
    .team-leader-hint { display: block; font-size: 11px; color: var(--text-muted); font-weight: 400; margin-top: 2px; }
    .team-leader-chip { background: var(--factory-secondary-light); color: var(--factory-secondary); }

    /* Base role button */
    .role-btn {
      padding: 8px 16px; border-radius: 20px;
      border: 2px solid var(--border);
      background: var(--bg-card2);
      color: var(--text-muted);
      cursor: pointer; font-size: 13px; font-weight: 500;
      transition: all 0.15s;
    }
    .role-btn:hover { opacity: 0.85; }

    /* Couleurs par rôle — état non sélectionné */
    .role-btn.role-factory_admin { border-color: #A855F7; color: #A855F7; }
    .role-btn.role-supervisor    { border-color: #00C2FF; color: #00C2FF; }
    .role-btn.role-technician    { border-color: #FFB700; color: #FFB700; }
    .role-btn.role-operator      { border-color: #00E5A0; color: #00E5A0; }
    .role-btn.role-super_admin   { border-color: #FF4D6D; color: #FF4D6D; }

    /* État sélectionné — fond plein */
    .role-btn.role-factory_admin.selected { background: #A855F7; color: #fff;  border-color: #A855F7; font-weight: 700; }
    .role-btn.role-supervisor.selected    { background: #00C2FF; color: #000;  border-color: #00C2FF; font-weight: 700; }
    .role-btn.role-technician.selected    { background: #FFB700; color: #000;  border-color: #FFB700; font-weight: 700; }
    .role-btn.role-operator.selected      { background: #00E5A0; color: #000;  border-color: #00E5A0; font-weight: 700; }
    .role-btn.role-super_admin.selected   { background: #FF4D6D; color: #fff;  border-color: #FF4D6D; font-weight: 700; }

    /* Chips dans la liste (vue résumé) */
    .role-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
    .role-chip { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .role-chip.factory_admin { background: #A855F722; color: #A855F7; }
    .role-chip.supervisor    { background: #00C2FF22; color: #00C2FF; }
    .role-chip.technician    { background: #FFB70022; color: #FFB700; }
    .role-chip.operator      { background: #00E5A022; color: #00E5A0; }
    .role-chip.super_admin   { background: #FF4D6D22; color: #FF4D6D; }

    .btn-reset-pwd {
      width: 100%; margin-top: 8px; padding: 9px; border-radius: 8px;
      border: 1px solid #FFB700; color: #FFB700; background: #FFB70011;
      cursor: pointer; font-size: 13px; font-weight: 600;
    }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: #0008; z-index: 500;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 16px; padding: 24px; width: 100%; max-width: 380px;
    }
    .modal-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .modal-sub   { font-size: 13px; color: var(--text-muted); margin-bottom: 8px; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }


    /* Onglet Rôles — matrice permissions */
    .role-system-badge { padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; background: #6B7A9C22; color: #6B7A9C; margin-left: 6px; }
    .role-custom-badge { padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; background: var(--factory-secondary-light); color: var(--factory-secondary); margin-left: 6px; }

    .role-edit-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .perm-count-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .perm-readonly-label { font-size: 12px; color: #2E3548; font-style: italic; margin-top: 2px; }
    .btn-close-role { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; color: var(--text-muted); cursor: pointer; font-size: 12px; white-space: nowrap; }

    .matrix-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
    .matrix-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .matrix-table thead th { background: var(--bg-card2); padding: 8px 6px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
    .th-module { text-align: left !important; min-width: 130px; padding-left: 10px !important; }
    .th-action { width: 70px; }
    .matrix-table tbody tr:hover td { background: var(--bg-card2); }
    .matrix-table tbody tr td { border-bottom: 1px solid var(--border); }
    .matrix-table tbody tr:last-child td { border-bottom: none; }
    .td-module { padding: 7px 10px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .td-perm { text-align: center; padding: 6px; }

    .perm-check { display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .perm-check input { display: none; }
    .check-box {
      width: 18px; height: 18px; border-radius: 4px;
      border: 2px solid var(--border); background: var(--bg-card);
      display: flex; align-items: center; justify-content: center; transition: all 0.15s;
    }
    .perm-check.checked .check-box { background: var(--factory-secondary); border-color: var(--factory-secondary); }
    .perm-check.checked .check-box::after { content: '✓'; color: #fff; font-size: 11px; font-weight: 900; }
    .perm-check.disabled { cursor: not-allowed; opacity: 0.45; }
    .no-perm { color: var(--border); font-size: 14px; }

    /* Onglet Produits */
    .product-line-filter { margin-bottom: 4px; }
    .line-filter-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .lf-btn {
      padding: 6px 14px; border-radius: 20px;
      border: 1px solid var(--border); background: var(--bg-card);
      color: var(--text-muted); cursor: pointer; font-size: 12px;
    }
    .lf-btn.active {
      background: var(--lc, var(--factory-primary));
      color: #fff; border-color: transparent; font-weight: 600;
    }

    .prod-volume {
      font-size: 11px; font-weight: 600;
      background: var(--bg-card2); border-radius: 4px;
      padding: 1px 6px; margin-left: 6px; color: var(--text-muted);
    }
    .prod-code {
      font-size: 10px; color: var(--text-muted);
      background: var(--border); border-radius: 4px;
      padding: 1px 5px; margin-left: 4px;
    }

    .subsection-title {
      font-size: 11px; font-weight: 700; color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px;
      margin: 10px 0 8px; padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }

    .calc-preview {
      padding: 7px 12px; background: var(--factory-primary-light);
      border: 1px solid var(--factory-primary);
      border-radius: 8px; font-size: 13px; font-weight: 600;
      color: var(--factory-primary); margin-top: 4px;
    }

    .prod-preview {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; background: var(--bg-card2);
      border: 1px solid var(--border); border-left: 3px solid;
      border-radius: 8px; margin-top: 12px;
    }
    .pp-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .pp-name { font-weight: 700; font-size: 14px; }
    .pp-sub  { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

    /* Toast */
    .save-toast, .error-toast {
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      padding: 10px 20px; border-radius: 20px; font-weight: 700; font-size: 14px;
      z-index: 999; animation: fadeInUp 0.3s ease; white-space: nowrap;
    }
    .save-toast  { background: #00E5A0; color: #000; }
    .error-toast { background: #FF4D6D; color: #fff; }

    .loading-msg, .empty-msg { text-align: center; color: var(--text-muted); padding: 24px 0; font-size: 13px; }
  `]
})
export class ConfigComponent implements OnInit {
  auth   = inject(AuthService);
  config = inject(FactoryConfigService);
  http   = inject(HttpClient);

  activeTab = signal<ConfigTab>('branding');
  saved     = signal(false);
  errorMsg  = signal('');

  // Loading states
  loadingLines    = signal(false);
  loadingProducts = signal(false);
  loadingMachines = signal(false);
  loadingUsers    = signal(false);
  savingUser      = signal(false);
  loadingRoles    = signal(false);
  savingRole      = signal(false);
  showCreateRole  = signal(false);

  // Sélection de ligne (partagée entre onglets Équipes et Rotations)
  selectedLineId  = '';

  roles            : RoleItem[]         = [];
  permGroups       : PermissionGroup[]  = [];
  editingPerms     : Partial<Record<string, string[]>> = {};
  newRole = { code: '', name: '', description: '', permissionIds: [] as string[] };

  readonly MODULE_LABELS: Record<string,string> = {
    MACHINES:'Diagnostic Machines', SOUFFLAGE:'Soufflage', QUART:'Suivi Quart',
    PERTES:'Pertes Préformes', MAINTENANCE:'Maintenance', SIROPERIE:'Siroperie',
    BILAN:'Bilan', CONFIG:'Configuration', USERS:'Utilisateurs', PLATFORM:'Plateforme'
  };
  readonly ACTION_LABELS: Record<string,string> = {
    READ:'Lire', WRITE:'Modifier', DELETE:'Supprimer', EXPORT:'Exporter', ADMIN:'Administrer'
  };
  readonly ALL_ACTIONS = ['READ','WRITE','DELETE','EXPORT','ADMIN'];

  // Forms
  brandForm:       any     = {};
  shiftsForm:      any[]   = [];
  stopTypesForm:   any[]   = [];
  lossCausesForm:  any[]   = [];
  linesForm:       LineForm[]        = [];
  machineTypesForm:MachineTypeForm[] = [];
  lineMachinesForm:LineMachineForm[] = [];
  productsForm:    ProductForm[]     = [];
  usersForm:       UserForm[]        = [];

  // Reset password modal
  resetPwdUser = signal<UserForm | null>(null);
  newPassword  = '';

  tabs = [
    { id: 'branding'    as ConfigTab, icon: '🎨', label: 'Branding' },
    { id: 'shifts'      as ConfigTab, icon: '🕐', label: 'Quarts' },
    { id: 'stop-types'  as ConfigTab, icon: '🛑', label: 'Arrêts' },
    { id: 'loss-causes' as ConfigTab, icon: '⚠️', label: 'Causes pertes' },
    { id: 'lines'       as ConfigTab, icon: '🏭', label: 'Lignes' },
    { id: 'products'    as ConfigTab, icon: '🍾', label: 'Produits' },
    { id: 'machines'    as ConfigTab, icon: '⚙️', label: 'Machines' },
    { id: 'roles'       as ConfigTab, icon: '🔑', label: 'Rôles' },
    { id: 'users'       as ConfigTab, icon: '👥', label: 'Utilisateurs' },
    { id: 'postes'      as ConfigTab, icon: '🪑', label: 'Postes' },
    { id: 'equipes'     as ConfigTab, icon: '🏭', label: 'Équipes' },
    { id: 'rotations'   as ConfigTab, icon: '🔄', label: 'Rotations' },
    { id: 'preformes'   as ConfigTab, icon: '🧴', label: 'Préformes' },
    { id: 'loss-types'  as ConfigTab, icon: '📉', label: 'Types de pertes' },
  ];

  moduleList = [
    { key: 'machines',    label: '🔧 Diagnostic Machines' },
    { key: 'soufflage',   label: '💨 Paramètres Soufflage' },
    { key: 'quart',       label: '📋 Suivi Quart' },
    { key: 'pertes',      label: '🗑️ Pertes Préformes' },
    { key: 'maintenance', label: '🛠️ Maintenance' },
    { key: 'siroperie',   label: '🧪 Siroperie' },
    { key: 'bilan',       label: '📊 Bilan Mensuel' },
    { key: 'rh',          label: '👥 Module RH (Équipes & Présences)' },
  ] as const;

  availableRoles = [
    { code: 'FACTORY_ADMIN', label: 'Admin Usine' },
    { code: 'SUPERVISOR',    label: 'Superviseur' },
    { code: 'TECHNICIAN',    label: 'Technicien' },
    { code: 'OPERATOR',      label: 'Opérateur' },
  ];

  private get factoryId() { return this.auth.currentFactory()?.id ?? ''; }
  private get api()       { return environment.apiUrl; }

  // ── Init ──────────────────────────────────────────────────
  ngOnInit() {
    const f = this.config.factory();
    if (f) {
      this.brandForm = {
        appTitle: f.appTitle, appSubtitle: f.appSubtitle,
        primaryColor: f.primaryColor, secondaryColor: f.secondaryColor,
        accentColor: f.accentColor ?? '#FFB700', logoUrl: f.logoUrl ?? '',
        modules: {  ...f.modules },
        geoLat: (f as any).geoLat ?? null,
        geoLng: (f as any).geoLng ?? null,
        geoRadiusMeters: (f as any).geoRadiusMeters ?? 500,
        geoRestrictSignin: (f as any).geoRestrictSignin ?? false
      };
    }
    this.shiftsForm     = this.config.shifts().map(s => ({ ...s }));
    this.stopTypesForm  = this.config.stopTypes().map(s => ({ ...s }));
    this.lossCausesForm = this.config.lossCauses().map(l => ({ ...l }));
  }

  switchTab(tab: ConfigTab) {
    this.activeTab.set(tab);
    if (tab === 'lines')     this.loadLines();
    if (tab === 'products')  this.loadProducts();
    if (tab === 'machines')  this.loadMachinesTab();
    if (tab === 'users')     this.loadUsers();
    if (tab === 'roles')     this.loadRoles();
    if (tab === 'postes')    this.loadPostes();
    if (tab === 'equipes')   { this.equipes = []; this.selectedLineId = ''; }
    if (tab === 'rotations') { this.selectedLineId = ''; }
    if (tab === 'preformes') this.loadTypePreformes();
    if (tab === 'loss-types') this.loadLossTypes();
  }

  // ── Branding ──────────────────────────────────────────────
  saveBranding() {
    if (!this.factoryId) return;
    const modules = Object.fromEntries(
      this.moduleList.map(m => [
        'module' + m.key[0].toUpperCase() + m.key.slice(1),
        this.brandForm.modules[m.key]
      ])
    );
    this.http.patch(`${this.api}/factories/${this.factoryId}`, { ...this.brandForm, ...modules })
      .subscribe({ next: () => { this.config.applyThemeToDocument(); this.showSaved(); }, error: () => this.showError() });
  }

  saveGeoConfig() {
    if (!this.factoryId) return;
    this.http.patch(`${this.api}/factories/${this.factoryId}`, {
      geoLat: this.brandForm.geoLat,
      geoLng: this.brandForm.geoLng,
      geoRadiusMeters: this.brandForm.geoRadiusMeters,
      geoRestrictSignin: this.brandForm.geoRestrictSignin
    }).subscribe({ next: () => this.showSaved(), error: () => this.showError() });
  }

  detectGeoPosition() {
    if (!('geolocation' in navigator)) {
      this.showError('Géolocalisation non supportée par ce navigateur');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.brandForm.geoLat = Math.round(pos.coords.latitude  * 10000) / 10000;
        this.brandForm.geoLng = Math.round(pos.coords.longitude * 10000) / 10000;
        this.showSaved();
      },
      () => this.showError('Impossible d\'obtenir la position GPS')
    );
  }

  // ── Quarts ────────────────────────────────────────────────
  addShift()       { this.shiftsForm.push({ name: '', shortName: '', startTime: '06:00', endTime: '14:00', crossesMidnight: false, color: '#00E5A0' }); }
  removeShift(i: number) { this.shiftsForm.splice(i, 1); }
  saveShifts() {
    if (!this.factoryId) return;
    this.http.put(`${this.api}/factories/${this.factoryId}/shifts`, this.shiftsForm)
      .subscribe({ next: () => this.showSaved(), error: () => this.showError() });
  }

  // ── Stop types / Loss causes ──────────────────────────────
 saveStopTypes() {
  if (!this.factoryId) return;
  const existing = this.stopTypesForm.filter(st => st.id);
  const created  = this.stopTypesForm.filter(st => !st.id);

  const calls = [
    ...existing.map(st =>
      this.config.updateStopType(this.factoryId, st)
    ),
    ...created.map(st =>
      this.config.createStopType(this.factoryId, st)
    ),
  ];

  if (!calls.length) { this.showSaved(); return; }

  forkJoin(calls).subscribe({
    next: () => {
      this.config.refreshStopTypes(this.factoryId);
      this.showSaved();
    },
    error: () => this.showError()
  });
}

saveLossCauses() {
  if (!this.factoryId) return;
  const existing = this.lossCausesForm.filter(lc => lc.id);
  const created  = this.lossCausesForm.filter(lc => !lc.id);

  const calls = [
    ...existing.map(lc =>
      this.config.updateLossCause(this.factoryId, lc)
    ),
    ...created.map(lc =>
      this.config.createLossCause(this.factoryId, lc)
    ),
  ];

  if (!calls.length) { this.showSaved(); return; }

  forkJoin(calls).subscribe({
    next: () => {
      this.config.refreshLossCauses(this.factoryId);
      this.showSaved();
    },
    error: () => this.showError()
  });
}


  // ── Lignes ────────────────────────────────────────────────
  loadLines() {
    if (!this.factoryId || this.linesForm.length) return;
    this.loadingLines.set(true);
    this.http.get<any[]>(`${this.api}/factories/${this.factoryId}/lines`).subscribe({
      next: lines => {
        this.linesForm = lines.map(l => ({ ...l, _editing: false, _new: false }));
        this.loadingLines.set(false);
      },
      error: () => this.loadingLines.set(false)
    });
  }

  addLine() {
    this.linesForm.push({ code: '', name: '', nominalSpeed: null, minSpeed: null, maxSpeed: null, color: '#00C2FF', icon: '🏭', displayOrder: this.linesForm.length, _editing: true, _new: true });
  }

  saveLine(i: number) {
    const line = this.linesForm[i];
    if (!this.factoryId) return;
    const body = { code: line.code, name: line.name, nominalSpeed: line.nominalSpeed, minSpeed: line.minSpeed, maxSpeed: line.maxSpeed, color: line.color, icon: line.icon, displayOrder: line.displayOrder };
    const req = line._new
      ? this.http.post<any>(`${this.api}/factories/${this.factoryId}/lines`, body)
      : this.http.patch<any>(`${this.api}/factories/${this.factoryId}/lines/${line.id}`, body);
    req.subscribe({ next: saved => { this.linesForm[i] = { ...saved, _editing: false, _new: false }; this.showSaved(); }, error: () => this.showError() });
  }

  cancelLine(i: number) {
    if (this.linesForm[i]._new) this.linesForm.splice(i, 1);
    else this.linesForm[i]._editing = false;
  }

  deleteLine(i: number) {
    const line = this.linesForm[i];
    if (line._new) { this.linesForm.splice(i, 1); return; }
    if (!confirm(`Supprimer la ligne "${line.name}" ?`)) return;
    this.http.delete(`${this.api}/factories/${this.factoryId}/lines/${line.id}`)
      .subscribe({ next: () => { this.linesForm.splice(i, 1); this.showSaved(); }, error: () => this.showError() });
  }

  // ── Produits ─────────────────────────────────────────────
  productLineFilter = '';

  filteredProducts = () => this.productsForm.filter(p =>
    !this.productLineFilter || p.productionLineId === this.productLineFilter
  );

  setProductLineFilter(lineId: string) {
    this.productLineFilter = lineId;
    if (!this.productsForm.length) this.loadProducts();
  }

  loadProducts() {
    if (!this.factoryId) return;
    // Charger les lignes si pas encore fait (nécessaire pour les selects)
    if (!this.linesForm.length) this.loadLines();
    this.loadingProducts.set(true);
    this.http.get<any[]>(`${this.api}/factories/${this.factoryId}/products`).subscribe({
      next: prods => {
        this.productsForm = prods.map(p => ({
          ...p,
          productionLineId: p.productionLineId ?? '',
          brandColor:    p.brandColor    ?? '#E8000D',
          iconUrl:       p.iconUrl       ?? '',
          internalRef:   p.internalRef   ?? '',
          productCode:   p.productCode   ?? '',
          unitCapacityCl:  p.unitCapacityCl  ?? null,
          bottlesPerPack:  p.bottlesPerPack  ?? null,
          packsPerPallet:  p.packsPerPallet  ?? null,
          tareWeightG:     p.tareWeightG     ?? null,
          nominalSpeed:    p.nominalSpeed    ?? null,
          displayOrder:    p.displayOrder    ?? 0,
          _editing: false, _new: false
        }));
        this.loadingProducts.set(false);
      },
      error: () => this.loadingProducts.set(false)
    });
  }

  addProduct() {
    // Pré-sélectionner la ligne filtrée si une est active
    const lineId = this.productLineFilter || (this.linesForm[0]?.id ?? '');
    this.productsForm.unshift({
      productionLineId: lineId, name: '', volume: '',
      nominalSpeed: null, brandColor: '#E8000D', iconUrl: '',
      displayOrder: 0, internalRef: '', productCode: '',
      unitCapacityCl: null, bottlesPerPack: null,
      packsPerPallet: null, tareWeightG: null,
      _editing: true, _new: true
    });
  }

  saveProduct(i: number) {
    const p = this.filteredProducts()[i];
    // Trouver l'index réel dans productsForm
    const realIdx = this.productsForm.indexOf(p);
    if (realIdx < 0 || !p.productionLineId) return;

    const body = {
      name: p.name, volume: p.volume || undefined,
      nominalSpeed:  p.nominalSpeed  || undefined,
      brandColor:    p.brandColor    || undefined,
      iconUrl:       p.iconUrl       || undefined,
      displayOrder:  p.displayOrder  ?? 0,
      internalRef:   p.internalRef   || undefined,
      productCode:   p.productCode   || undefined,
      unitCapacityCl:  p.unitCapacityCl  || undefined,
      bottlesPerPack:  p.bottlesPerPack  || undefined,
      packsPerPallet:  p.packsPerPallet  || undefined,
      tareWeightG:     p.tareWeightG     || undefined
    };

    const req = p._new
      ? this.http.post<any>(`${this.api}/lines/${p.productionLineId}/products`, body)
      : this.http.patch<any>(`${this.api}/lines/${p.productionLineId}/products/${p.id}`, body);

    req.subscribe({
      next: saved => {
        this.productsForm[realIdx] = {
          ...saved,
          productionLineId: saved.productionLineId ?? p.productionLineId,
          brandColor: saved.brandColor ?? p.brandColor,
          iconUrl: saved.iconUrl ?? '',
          internalRef: saved.internalRef ?? '',
          productCode: saved.productCode ?? '',
          unitCapacityCl: saved.unitCapacityCl ?? null,
          bottlesPerPack: saved.bottlesPerPack ?? null,
          packsPerPallet: saved.packsPerPallet ?? null,
          tareWeightG: saved.tareWeightG ?? null,
          nominalSpeed: saved.nominalSpeed ?? null,
          displayOrder: saved.displayOrder ?? 0,
          _editing: false, _new: false
        };
        this.showSaved();
      },
      error: () => this.showError()
    });
  }

  cancelProduct(i: number) {
    const p = this.filteredProducts()[i];
    const realIdx = this.productsForm.indexOf(p);
    if (p._new) this.productsForm.splice(realIdx, 1);
    else this.productsForm[realIdx]._editing = false;
  }

  deleteProduct(i: number) {
    const p = this.filteredProducts()[i];
    const realIdx = this.productsForm.indexOf(p);
    if (p._new) { this.productsForm.splice(realIdx, 1); return; }
    if (!confirm(`Supprimer le produit "${p.name}" ?`)) return;
    this.http.delete(`${this.api}/lines/${p.productionLineId}/products/${p.id}`)
      .subscribe({
        next: () => { this.productsForm.splice(realIdx, 1); this.showSaved(); },
        error: () => this.showError()
      });
  }

  lineNameById(lineId: string): string {
    return this.linesForm.find(l => l.id === lineId)?.name ?? lineId;
  }

  // ── Types de machines ────────────────────────────────────
  loadMachinesTab() {
    if (!this.factoryId) return;
    if (!this.machineTypesForm.length) {
      this.loadingMachines.set(true);
      this.http.get<any[]>(`${this.api}/factories/${this.factoryId}/machine-types`).subscribe({
        next: mts => {
          this.machineTypesForm = mts.map(mt => ({ ...mt, _editing: false, _new: false }));
          this.loadingMachines.set(false);
        },
        error: () => this.loadingMachines.set(false)
      });
    }
    if (!this.lineMachinesForm.length) {
      this.http.get<any[]>(`${this.api}/factories/${this.factoryId}/line-machines`).subscribe({
        next: lms => { this.lineMachinesForm = lms.map(lm => ({ ...lm, instanceNumber: lm.instanceNumber ?? 1, serialNumber: lm.serialNumber ?? '', installationYear: lm.installationYear ?? null, _editing: false, _new: false })); },
        error: () => {}
      });
    }
    if (!this.linesForm.length) this.loadLines();
  }

  addMachineType() {
    this.machineTypesForm.push({ code: '', label: '', description: '', color: '#00C2FF', icon: '⚙️', displayOrder: this.machineTypesForm.length, _editing: true, _new: true });
  }

  saveMachineType(i: number) {
    const mt = this.machineTypesForm[i];
    if (!this.factoryId) return;
    const body = { code: mt.code, label: mt.label, description: mt.description, color: mt.color, icon: mt.icon, displayOrder: mt.displayOrder };
    const req = mt._new
      ? this.http.post<any>(`${this.api}/factories/${this.factoryId}/machine-types`, body)
      : this.http.patch<any>(`${this.api}/factories/${this.factoryId}/machine-types/${mt.id}`, body);
    req.subscribe({ next: saved => { this.machineTypesForm[i] = { ...saved, _editing: false, _new: false }; this.showSaved(); }, error: () => this.showError() });
  }

  cancelMachineType(i: number) {
    if (this.machineTypesForm[i]._new) this.machineTypesForm.splice(i, 1);
    else this.machineTypesForm[i]._editing = false;
  }

  deleteMachineType(i: number) {
    const mt = this.machineTypesForm[i];
    if (mt._new) { this.machineTypesForm.splice(i, 1); return; }
    if (!confirm(`Supprimer le type "${mt.label}" ?`)) return;
    this.http.delete(`${this.api}/factories/${this.factoryId}/machine-types/${mt.id}`)
      .subscribe({ next: () => { this.machineTypesForm.splice(i, 1); this.showSaved(); }, error: () => this.showError() });
  }

  // ── Instances machines sur lignes ─────────────────────────
  addLineMachine() {
    this.lineMachinesForm.push({ productionLineId: '', machineTypeId: '', displayName: '', serialNumber: '', installationYear: null, instanceNumber: 1, _editing: true, _new: true });
  }

  saveLineMachine(i: number) {
    const lm = this.lineMachinesForm[i];
    if (!lm.productionLineId || !lm.machineTypeId) return;
    const body = { machineTypeId: lm.machineTypeId, instanceNumber: lm.instanceNumber, displayName: lm.displayName || undefined, serialNumber: lm.serialNumber || undefined, installationYear: lm.installationYear || undefined };
    const req = lm._new
      ? this.http.post<any>(`${this.api}/lines/${lm.productionLineId}/machines`, body)
      : this.http.patch<any>(`${this.api}/lines/${lm.productionLineId}/machines/${lm.id}`, body);
    req.subscribe({ next: saved => { this.lineMachinesForm[i] = { ...saved, _editing: false, _new: false }; this.showSaved(); }, error: () => this.showError() });
  }

  cancelLineMachine(i: number) {
    if (this.lineMachinesForm[i]._new) this.lineMachinesForm.splice(i, 1);
    else this.lineMachinesForm[i]._editing = false;
  }

  deleteLineMachine(i: number) {
    const lm = this.lineMachinesForm[i];
    if (lm._new) { this.lineMachinesForm.splice(i, 1); return; }
    if (!confirm('Supprimer cette association machine/ligne ?')) return;
    this.http.delete(`${this.api}/lines/${lm.productionLineId}/machines/${lm.id}`)
      .subscribe({ next: () => { this.lineMachinesForm.splice(i, 1); this.showSaved(); }, error: () => this.showError() });
  }

  // Helpers affichage machines tab
  machineTypeLabel(id: string) { return this.machineTypesForm.find(m => m.id === id)?.label ?? id; }
  machineTypeColor(id: string) { return this.machineTypesForm.find(m => m.id === id)?.color ?? 'var(--border)'; }
  lineName(id: string)         { return this.linesForm.find(l => l.id === id)?.name ?? id; }

  // ── Utilisateurs ──────────────────────────────────────────
  loadUsers() {
    if (!this.factoryId || this.usersForm.length) return;
    this.loadingUsers.set(true);
    this.http.get<any[]>(`${this.api}/factories/${this.factoryId}/users`).subscribe({
      next: users => {
        this.usersForm = users.map(u => ({ ...u, roleCodes: u.roles ?? [], temporaryPassword: '', phone: u.phone ?? '', isTeamLeader: u.isTeamLeader ?? false, _editing: false, _new: false }));
        this.loadingUsers.set(false);
      },
      error: () => this.loadingUsers.set(false)
    });
  }

  addUser() {
    this.usersForm.push({ firstName: '', lastName: '', email: '', jobTitle: '', phone: '', preferredLanguage: 'fr', roleCodes: ['OPERATOR'], temporaryPassword: '', isTeamLeader: false, _editing: true, _new: true });
  }

  saveUser(i: number) {
    const user = this.usersForm[i];
    if (!this.factoryId) return;
    this.savingUser.set(true);

    if (user._new) {
      this.http.post<any>(`${this.api}/factories/${this.factoryId}/users`, {
        firstName: user.firstName, lastName: user.lastName, email: user.email,
        jobTitle: user.jobTitle || undefined, phone: user.phone || undefined,
        preferredLanguage: user.preferredLanguage,
        temporaryPassword: user.temporaryPassword || undefined,
        roleCodes: user.roleCodes,
        isTeamLeader: user.isTeamLeader
      }).subscribe({
        next: saved => { this.usersForm[i] = { ...saved, roleCodes: saved.roles ?? [], temporaryPassword: '', phone: saved.phone ?? '', isTeamLeader: saved.isTeamLeader ?? false, _editing: false, _new: false }; this.savingUser.set(false); this.showSaved(); },
        error: (e) => { this.savingUser.set(false); this.showError(e?.error?.message); }
      });
    } else {
      this.http.patch<any>(`${this.api}/factories/${this.factoryId}/users/${user.id}`, {
        firstName: user.firstName, lastName: user.lastName,
        jobTitle: user.jobTitle || undefined, phone: user.phone || undefined,
        preferredLanguage: user.preferredLanguage, roleCodes: user.roleCodes,
        isTeamLeader: user.isTeamLeader
      }).subscribe({
        next: saved => { this.usersForm[i] = { ...saved, roleCodes: saved.roles ?? [], temporaryPassword: '', phone: saved.phone ?? '', isTeamLeader: saved.isTeamLeader ?? false, _editing: false, _new: false }; this.savingUser.set(false); this.showSaved(); },
        error: () => { this.savingUser.set(false); this.showError(); }
      });
    }
  }

  cancelUser(i: number) {
    if (this.usersForm[i]._new) this.usersForm.splice(i, 1);
    else this.usersForm[i]._editing = false;
  }

  deleteUser(i: number) {
    const user = this.usersForm[i];
    if (!confirm(`Désactiver l'utilisateur "${user.firstName} ${user.lastName}" ?`)) return;
    this.http.delete(`${this.api}/factories/${this.factoryId}/users/${user.id}`)
      .subscribe({ next: () => { this.usersForm.splice(i, 1); this.showSaved(); }, error: () => this.showError() });
  }

  toggleRole(user: UserForm, roleCode: string) {
    const idx = user.roleCodes.indexOf(roleCode);
    if (idx >= 0) user.roleCodes.splice(idx, 1);
    else user.roleCodes.push(roleCode);
  }

  openResetPassword(user: UserForm) {
    this.resetPwdUser.set(user);
    this.newPassword = '';
  }

  confirmResetPassword() {
    const user = this.resetPwdUser();
    if (!user || this.newPassword.length < 8) return;
    this.http.post(`${this.api}/factories/${this.factoryId}/users/${user.id}/reset-password`, { newPassword: this.newPassword })
      .subscribe({ next: () => { this.resetPwdUser.set(null); this.showSaved(); }, error: () => this.showError() });
  }

  // Helpers utilisateurs
  userInitials(user: UserForm) {
    return ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  roleLabel(code: string): string {
    const m: Record<string, string> = { FACTORY_ADMIN: 'Admin', SUPERVISOR: 'Superviseur', TECHNICIAN: 'Technicien', OPERATOR: 'Opérateur', SUPER_ADMIN: 'Super Admin' };
    return m[code] ?? code;
  }

  roleClass(code: string): string {
    return code.toLowerCase();
  }

  roleButtonClass(code: string, selectedCodes: string[]): string {
    const base = 'role-btn role-' + code.toLowerCase();
    return selectedCodes.includes(code) ? base + ' selected' : base;
  }

  // ── Rôles ────────────────────────────────────────────────────
  loadRoles() {
    if (!this.factoryId || this.roles.length) return;
    this.loadingRoles.set(true);
    Promise.all([
      this.http.get<RoleItem[]>(`${this.api}/factories/${this.factoryId}/roles`).toPromise(),
      this.http.get<PermissionGroup[]>(`${this.api}/permissions/grouped`).toPromise()
    ]).then(([roles, groups]) => {
      this.roles = (roles ?? []).map(r => ({ ...r, _editing: false }));
      this.permGroups = groups ?? [];
      this.loadingRoles.set(false);
    }).catch(() => this.loadingRoles.set(false));
  }

  toggleEditRole(role: RoleItem) {
    if (role._editing) {
      role._editing = false;
    } else {
      role._editing = true;
      if (!this.editingPerms[role.id]) {
        this.editingPerms[role.id] = role.permissions.map(p => p.id);
      }
    }
  }

  isPermChecked(role: RoleItem, group: PermissionGroup, action: string): boolean {
    const perm = group.permissions.find(p => p.action === action);
    if (!perm) return false;
    const current = this.editingPerms[role.id];
    return current ? current.includes(perm.id) : role.permissions.some(p => p.id === perm.id);
  }

  togglePerm(role: RoleItem, group: PermissionGroup, action: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const perm = group.permissions.find(p => p.action === action);
    if (!perm) return;
    let current = this.editingPerms[role.id] ?? role.permissions.map(p => p.id);
    if (checked) {
      if (!current.includes(perm.id)) current = [...current, perm.id];
    } else {
      current = current.filter(id => id !== perm.id);
    }
    this.editingPerms[role.id] = current;
  }

  saveRolePerms(role: RoleItem) {
    const permIds = this.editingPerms[role.id] ?? role.permissions.map(p => p.id);
    this.savingRole.set(true);
    this.http.patch<RoleItem>(`${this.api}/factories/${this.factoryId}/roles/${role.id}`, { permissionIds: permIds })
      .subscribe({
        next: updated => {
          const idx = this.roles.findIndex(r => r.id === role.id);
          if (idx >= 0) this.roles[idx] = { ...updated, _editing: false };
          this.savingRole.set(false);
          this.showSaved();
        },
        error: () => { this.savingRole.set(false); this.showError(); }
      });
  }

  openCreateRole() {
    this.newRole = { code: '', name: '', description: '', permissionIds: [] };
    this.showCreateRole.set(true);
  }

  toggleNewPerm(group: PermissionGroup, action: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const perm = group.permissions.find(p => p.action === action);
    if (!perm) return;
    if (checked) {
      if (!this.newRole.permissionIds.includes(perm.id))
        this.newRole.permissionIds = [...this.newRole.permissionIds, perm.id];
    } else {
      this.newRole.permissionIds = this.newRole.permissionIds.filter(id => id !== perm.id);
    }
  }

  createRole() {
    this.savingRole.set(true);
    this.http.post<RoleItem>(`${this.api}/factories/${this.factoryId}/roles`, {
      code: this.newRole.code.toUpperCase(),
      name: this.newRole.name,
      description: this.newRole.description,
      permissionIds: this.newRole.permissionIds
    }).subscribe({
      next: role => {
        this.roles.push({ ...role, _editing: false });
        this.showCreateRole.set(false);
        this.savingRole.set(false);
        this.showSaved();
      },
      error: (e) => { this.savingRole.set(false); this.showError(e?.error?.message); }
    });
  }

  deleteRole(role: RoleItem) {
    if (!confirm(`Supprimer le rôle "${role.name}" ?`)) return;
    this.http.delete(`${this.api}/factories/${this.factoryId}/roles/${role.id}`)
      .subscribe({
        next: () => { this.roles = this.roles.filter(r => r.id !== role.id); this.showSaved(); },
        error: (e) => this.showError(e?.error?.message)
      });
  }

  getPermCount(role: RoleItem): number {
    return this.editingPerms[role.id]?.length ?? role.permissions.length;
  }

  getGroupPermId(group: PermissionGroup, action: string): string {
    return group.permissions.find(p => p.action === action)?.id ?? '';
  }

  hasPermInGroup(group: PermissionGroup, action: string): boolean {
    return group.permissions.some(p => p.action === action);
  }

  moduleLabel(m: string): string { return this.MODULE_LABELS[m] ?? m; }
  actionLabel(a: string): string  { return this.ACTION_LABELS[a]  ?? a; }

  // ── Types de Préformes ───────────────────────────────────
  typePreformes: any[] = [];
  showPreformeForm  = signal(false);
  savingPreforme    = signal(false);
  editingPreformeId = signal<string | null>(null);
  preformeForm      = { nom: '', fournisseur: '', poidsG: null as number | null, notes: '' };

  loadTypePreformes() {
    if (!this.factoryId || this.typePreformes.length) return;
    this.http.get<any[]>(`${this.api}/soufflage/factories/${this.factoryId}/type-preformes`)
      .subscribe({ next: p => this.typePreformes = p, error: () => {} });
  }

  openAddPreforme() {
    this.editingPreformeId.set(null);
    this.preformeForm = { nom: '', fournisseur: '', poidsG: null, notes: '' };
    this.showPreformeForm.set(true);
  }

  startEditPreforme(pf: any) {
    this.editingPreformeId.set(pf.id);
    this.preformeForm = { nom: pf.nom, fournisseur: pf.fournisseur ?? '', poidsG: pf.poidsG ?? null, notes: pf.notes ?? '' };
    this.showPreformeForm.set(true);
  }

  cancelPreformeForm() {
    this.showPreformeForm.set(false);
    this.editingPreformeId.set(null);
  }

  savePreforme() {
    if (!this.factoryId || !this.preformeForm.nom) return;
    this.savingPreforme.set(true);
    const body = {
      nom: this.preformeForm.nom,
      fournisseur: this.preformeForm.fournisseur || undefined,
      poidsG: this.preformeForm.poidsG ?? undefined,
      notes: this.preformeForm.notes || undefined
    };
    const editId = this.editingPreformeId();
    const obs = editId
      ? this.http.patch<any>(`${this.api}/soufflage/type-preformes/${editId}`, body)
      : this.http.post<any>(`${this.api}/soufflage/factories/${this.factoryId}/type-preformes`, body);
    obs.subscribe({
      next: saved => {
        if (editId) {
          const idx = this.typePreformes.findIndex(p => p.id === editId);
          if (idx >= 0) this.typePreformes[idx] = saved;
        } else {
          this.typePreformes.push(saved);
        }
        this.showPreformeForm.set(false);
        this.editingPreformeId.set(null);
        this.savingPreforme.set(false);
        this.showSaved();
      },
      error: () => { this.savingPreforme.set(false); this.showError(); }
    });
  }

  deletePreforme(id: string) {
    if (!confirm('Supprimer ce type de préforme ?')) return;
    this.http.delete(`${this.api}/soufflage/type-preformes/${id}`)
      .subscribe({
        next: () => { this.typePreformes = this.typePreformes.filter(p => p.id !== id); this.showSaved(); },
        error: () => this.showError()
      });
  }

  // ── RH : Postes ──────────────────────────────────────────
  postes: any[] = [];
  showPosteForm  = signal(false);
  savingPoste    = signal(false);
  editingPosteId = signal<string | null>(null);
  posteForm     = { nom: '', machineTypeId: '', isMachineOp: false };
  posteEditForm = { nom: '', machineTypeId: '', isMachineOp: false };

  loadPostes() {
    if (!this.factoryId || this.postes.length) return;
    this.http.get<any[]>(`${this.api}/rh/factories/${this.factoryId}/postes`)
      .subscribe({ next: p => this.postes = p, error: () => {} });
  }

  openAddPoste() {
    this.posteForm = { nom: '', machineTypeId: '', isMachineOp: false };
    this.showPosteForm.set(true);
    this.loadPostes();
  }

  savePoste() {
    if (!this.factoryId || !this.posteForm.nom) return;
    this.savingPoste.set(true);
    this.http.post<any>(`${this.api}/rh/factories/${this.factoryId}/postes`, {
      nom: this.posteForm.nom,
      machineTypeId: this.posteForm.machineTypeId || undefined,
      isMachineOp: this.posteForm.isMachineOp
    }).subscribe({
      next: p => { this.postes.push(p); this.showPosteForm.set(false); this.savingPoste.set(false); this.showSaved(); },
      error: () => { this.savingPoste.set(false); this.showError(); }
    });
  }

  startEditPoste(poste: any) {
    this.editingPosteId.set(poste.id);
    this.posteEditForm = { nom: poste.nom, machineTypeId: poste.machineTypeId ?? '', isMachineOp: poste.isMachineOp };
  }

  saveEditPoste(id: string) {
    if (!this.posteEditForm.nom) return;
    this.http.patch<any>(`${this.api}/rh/postes/${id}`, {
      nom: this.posteEditForm.nom,
      machineTypeId: this.posteEditForm.machineTypeId || undefined,
      isMachineOp: this.posteEditForm.isMachineOp
    }).subscribe({
      next: updated => {
        const idx = this.postes.findIndex(p => p.id === id);
        if (idx >= 0) this.postes[idx] = updated;
        this.editingPosteId.set(null);
        this.showSaved();
      },
      error: () => this.showError()
    });
  }

  deletePoste(id: string) {
    if (!confirm('Supprimer ce poste ?')) return;
    this.http.delete(`${this.api}/rh/postes/${id}`)
      .subscribe({ next: () => { this.postes = this.postes.filter(p => p.id !== id); this.showSaved(); }, error: () => this.showError() });
  }

  // ── RH : Équipes ─────────────────────────────────────────
  equipes: any[] = [];
  showEquipeForm          = signal(false);
  editingEquipeId         = signal<string | null>(null);
  addingMembreToEquipeId  = signal<string | null>(null);
  equipeForm     = { nom: '', couleur: '#00E5A0' };
  equipeEditForm = { nom: '', couleur: '#00E5A0' };
  membreForm     = { userId: '', posteId: '' };

  loadEquipes() {
    if (!this.selectedLineId) return;
    this.loadPostes();
    if (!this.usersForm.length) this.loadUsers();
    this.http.get<any[]>(`${this.api}/rh/lines/${this.selectedLineId}/equipes`)
      .subscribe({ next: e => this.equipes = e, error: () => {} });
  }

  openAddEquipe() { this.equipeForm = { nom: '', couleur: '#00E5A0' }; this.showEquipeForm.set(true); }

  saveEquipe() {
    if (!this.selectedLineId || !this.equipeForm.nom) return;
    this.http.post<any>(`${this.api}/rh/lines/${this.selectedLineId}/equipes`, this.equipeForm)
      .subscribe({
        next: e => { this.equipes.push(e); this.showEquipeForm.set(false); this.showSaved(); },
        error: () => this.showError()
      });
  }

  startEditEquipe(equipe: any) {
    this.editingEquipeId.set(equipe.id);
    this.equipeEditForm = { nom: equipe.nom, couleur: equipe.couleur };
  }

  saveEditEquipe(id: string) {
    if (!this.equipeEditForm.nom) return;
    this.http.patch<any>(`${this.api}/rh/equipes/${id}`, this.equipeEditForm)
      .subscribe({
        next: updated => {
          const idx = this.equipes.findIndex(e => e.id === id);
          if (idx >= 0) this.equipes[idx] = { ...this.equipes[idx], ...updated };
          this.editingEquipeId.set(null);
          this.showSaved();
        },
        error: () => this.showError()
      });
  }

  deleteEquipe(id: string) {
    if (!confirm('Supprimer cette équipe et tous ses membres ?')) return;
    this.http.delete(`${this.api}/rh/equipes/${id}`)
      .subscribe({
        next: () => { this.equipes = this.equipes.filter(e => e.id !== id); this.showSaved(); },
        error: () => this.showError()
      });
  }

  openAddMembre(equipeId: string) {
    this.membreForm = { userId: '', posteId: '' };
    this.addingMembreToEquipeId.set(equipeId);
  }

  saveMembre(equipeId: string) {
    if (!this.membreForm.userId || !this.membreForm.posteId) return;
    this.http.post<any>(`${this.api}/rh/equipes/${equipeId}/membres`, this.membreForm)
      .subscribe({
        next: m => {
          const eq = this.equipes.find(e => e.id === equipeId);
          if (eq) eq.membres.push(m);
          this.addingMembreToEquipeId.set(null);
          this.showSaved();
        },
        error: () => this.showError()
      });
  }

  removeMembre(membreId: string, equipeId: string) {
    if (!confirm('Retirer ce membre de l\'équipe ?')) return;
    this.http.delete(`${this.api}/rh/membres/${membreId}`)
      .subscribe({
        next: () => {
          const eq = this.equipes.find(e => e.id === equipeId);
          if (eq) eq.membres = eq.membres.filter((m: any) => m.id !== membreId);
          this.showSaved();
        },
        error: () => this.showError()
      });
  }

  // ── RH : Rotations ───────────────────────────────────────
  rotationForm: { nbEquipes: number; startDate: string; autoGenerate: boolean;
                  reposMode: string; fixedRestDays: number[]; blocks: any[] } = {
    nbEquipes: 3, startDate: new Date().toISOString().split('T')[0],
    autoGenerate: true, reposMode: 'CYCLIQUE', fixedRestDays: [], blocks: []
  };
  savingRotation = signal(false);

  weekDaysList = [
    { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mer' },
    { value: 4, label: 'Jeu' }, { value: 5, label: 'Ven' }, { value: 6, label: 'Sam' },
    { value: 7, label: 'Dim' },
  ];

  toggleRestDay(day: number) {
    const idx = this.rotationForm.fixedRestDays.indexOf(day);
    if (idx >= 0) this.rotationForm.fixedRestDays.splice(idx, 1);
    else this.rotationForm.fixedRestDays.push(day);
  }

  loadRotationConfig() {
    if (!this.selectedLineId) return;
    this.http.get<any>(`${this.api}/rh/lines/${this.selectedLineId}/rotation-config`)
      .subscribe({
        next: cfg => {
          this.rotationForm = {
            nbEquipes: cfg.nbEquipes, startDate: cfg.startDate,
            autoGenerate: cfg.autoGenerate,
            reposMode: cfg.reposMode ?? 'CYCLIQUE',
            fixedRestDays: cfg.fixedRestDays ?? [],
            blocks: cfg.blocks.map((b: any) => ({ ...b }))
          };
        },
        error: () => {
          this.rotationForm = {
            nbEquipes: 3, startDate: new Date().toISOString().split('T')[0],
            autoGenerate: true, reposMode: 'CYCLIQUE', fixedRestDays: [],
            blocks: [
              { shiftConfigId: '', isRepos: false, nbJours: 2 },
              { shiftConfigId: '', isRepos: true,  nbJours: 1 },
            ]
          };
        }
      });
  }

  addBlock() { this.rotationForm.blocks.push({ shiftConfigId: '', isRepos: false, nbJours: 2 }); }
  removeBlock(i: number) { this.rotationForm.blocks.splice(i, 1); }
  cycleTotalDays(): number { return this.rotationForm.blocks.reduce((acc, b) => acc + (b.nbJours || 0), 0); }

  saveRotationConfig() {
    if (!this.selectedLineId) return;
    this.savingRotation.set(true);
    this.http.put<any>(`${this.api}/rh/lines/${this.selectedLineId}/rotation-config`, {
      nbEquipes: this.rotationForm.nbEquipes,
      startDate: this.rotationForm.startDate,
      autoGenerate: this.rotationForm.autoGenerate,
      reposMode: this.rotationForm.reposMode,
      fixedRestDays: this.rotationForm.reposMode === 'FIXE' ? this.rotationForm.fixedRestDays : [],
      blocks: this.rotationForm.blocks.map((b, i) => ({
        ordre: i, nbJours: b.nbJours,
        shiftConfigId: b.shiftConfigId || undefined,
        isRepos: !b.shiftConfigId
      }))
    }).subscribe({
      next: () => { this.savingRotation.set(false); this.showSaved(); },
      error: () => { this.savingRotation.set(false); this.showError(); }
    });
  }

  // ── Types de pertes ──────────────────────────────────────
  lossTypes: any[] = [];
  showLossTypeForm  = signal(false);
  savingLossType    = signal(false);
  editingLossTypeId = signal<string | null>(null);
  lossTypeForm      = { nom: '', unite: 'unités', uniteCustom: '', color: '#FF4D6D' };

  loadLossTypes() {
    if (!this.factoryId || this.lossTypes.length) return;
    this.http.get<any[]>(`${this.api}/pertes/factories/${this.factoryId}/types`)
      .subscribe({ next: t => this.lossTypes = t, error: () => {} });
  }

  openAddLossType() {
    this.editingLossTypeId.set(null);
    this.lossTypeForm = { nom: '', unite: 'unités', uniteCustom: '', color: '#FF4D6D' };
    this.showLossTypeForm.set(true);
  }

  startEditLossType(lt: any) {
    this.editingLossTypeId.set(lt.id);
    const knownUnits = ['unités', 'kg', 'g', 'm', 'L', '%'];
    const isCustom = !knownUnits.includes(lt.unite);
    this.lossTypeForm = { nom: lt.nom, unite: isCustom ? 'custom' : lt.unite, uniteCustom: isCustom ? lt.unite : '', color: lt.color };
    this.showLossTypeForm.set(true);
  }

  cancelLossTypeForm() { this.showLossTypeForm.set(false); this.editingLossTypeId.set(null); }

  saveLossType() {
    if (!this.factoryId || !this.lossTypeForm.nom) return;
    this.savingLossType.set(true);
    const unite  = this.lossTypeForm.unite === 'custom' ? this.lossTypeForm.uniteCustom : this.lossTypeForm.unite;
    const body   = { nom: this.lossTypeForm.nom, unite, color: this.lossTypeForm.color };
    const editId = this.editingLossTypeId();
    const obs    = editId
      ? this.http.patch<any>(`${this.api}/pertes/types/${editId}`, body)
      : this.http.post<any>(`${this.api}/pertes/factories/${this.factoryId}/types`, body);
    obs.subscribe({
      next: saved => {
        if (editId) { const idx = this.lossTypes.findIndex(t => t.id === editId); if (idx >= 0) this.lossTypes[idx] = saved; }
        else this.lossTypes.push(saved);
        this.showLossTypeForm.set(false); this.editingLossTypeId.set(null); this.savingLossType.set(false); this.showSaved();
      },
      error: () => { this.savingLossType.set(false); this.showError(); }
    });
  }

  deleteLossType(id: string) {
    if (!confirm('Supprimer ce type de perte ?')) return;
    this.http.delete(`${this.api}/pertes/types/${id}`)
      .subscribe({ next: () => { this.lossTypes = this.lossTypes.filter(t => t.id !== id); this.showSaved(); }, error: () => this.showError() });
  }

  // ── Formation machine ─────────────────────────────────────
  trainingMachineTypeId    = signal<string | null>(null);
  trainingMachineTypeLabel = signal<string>('');
  savingTraining           = signal(false);
  trainingForm: {
    presentation: string;
    sections: Array<{ titre: string; contenu: string; pointsCles: string[]; niveau: string }>;
    params: Array<{ nom: string; valeurNominale: string; unite: string; valeurMin: string; valeurMax: string }>;
    docs: Array<{ titre: string; url: string; typeDoc: string }>;
  } = { presentation: '', sections: [], params: [], docs: [] };

  openTraining(machineTypeId: string, label: string) {
    this.trainingMachineTypeId.set(machineTypeId);
    this.trainingMachineTypeLabel.set(label);
    this.trainingForm = { presentation: '', sections: [], params: [], docs: [] };
    // Charger la formation existante
    this.http.get<any>(`${this.api}/machine-types/${machineTypeId}/training`).subscribe({
      next: t => {
        this.trainingForm = {
          presentation: t.presentation ?? '',
          sections: t.sections.map((s: any) => ({
            titre: s.titre, contenu: s.contenu ?? '',
            pointsCles: s.pointsCles ?? [], niveau: s.niveau ?? 'INFO'
          })),
          params: t.params.map((p: any) => ({
            nom: p.nom, valeurNominale: p.valeurNominale ?? '',
            unite: p.unite ?? '', valeurMin: p.valeurMin ?? '', valeurMax: p.valeurMax ?? ''
          })),
          docs: t.docs.map((d: any) => ({
            titre: d.titre, url: d.url, typeDoc: d.typeDoc ?? 'LIEN'
          }))
        };
      },
      error: () => {} // 404 = pas encore de formation, formulaire vide
    });
  }

  addTrainingSection() {
    this.trainingForm.sections.push({ titre: '', contenu: '', pointsCles: [], niveau: 'INFO' });
  }
  removeTrainingSection(i: number) { this.trainingForm.sections.splice(i, 1); }

  addTrainingParam() {
    this.trainingForm.params.push({ nom: '', valeurNominale: '', unite: '', valeurMin: '', valeurMax: '' });
  }
  removeTrainingParam(i: number) { this.trainingForm.params.splice(i, 1); }

  addTrainingDoc() {
    this.trainingForm.docs.push({ titre: '', url: '', typeDoc: 'LIEN' });
  }
  removeTrainingDoc(i: number) { this.trainingForm.docs.splice(i, 1); }

  updatePointsCles(i: number, event: Event) {
    const val = (event.target as HTMLTextAreaElement).value;
    this.trainingForm.sections[i].pointsCles = val.split('\n').filter(l => l.trim());
  }

  saveTraining() {
    const id = this.trainingMachineTypeId();
    if (!id) return;
    this.savingTraining.set(true);
    this.http.put<any>(`${this.api}/machine-types/${id}/training`, {
      presentation: this.trainingForm.presentation || undefined,
      sections: this.trainingForm.sections.map((s, i) => ({ ...s, ordre: i })),
      params: this.trainingForm.params.map((p, i) => ({ ...p, ordre: i })),
      docs: this.trainingForm.docs.map((d, i) => ({ ...d, ordre: i }))
    }).subscribe({
      next: () => { this.savingTraining.set(false); this.showSaved(); },
      error: () => { this.savingTraining.set(false); this.showError(); }
    });
  }

  // ── Feedback ──────────────────────────────────────────────
  private showSaved() {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
  }

  private showError(msg?: string) {
    this.errorMsg.set(msg ?? 'Une erreur est survenue');
    setTimeout(() => this.errorMsg.set(''), 3000);
  }
}
