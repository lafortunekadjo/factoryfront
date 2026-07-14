import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  QuartRecord, QuartRecordRequest, Page, PertePreformeRecord, PertePreformeRequest,
  MaintenanceRecord, SiropRecord, Symptom, BlowingParam, MonthlyReport
} from '../models/models';

// ─── Base API Service ─────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ApiService {
  protected http = inject(HttpClient);
  protected base = environment.apiUrl;
}

// ─── QuartApiService ─────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class QuartApiService extends ApiService {

  create(req: QuartRecordRequest): Observable<QuartRecord> {
    return this.http.post<QuartRecord>(`${this.base}/quart`, req);
  }

  update(id: string, req: QuartRecordRequest): Observable<QuartRecord> {
    return this.http.put<QuartRecord>(`${this.base}/quart/${id}`, req);
  }

  findMyRecords(factoryId: string, from: string, to: string, page = 0, size = 50): Observable<Page<QuartRecord>> {
    const params = new HttpParams().set('from', from).set('to', to).set('page', page).set('size', size);
    return this.http.get<Page<QuartRecord>>(`${this.base}/quart/factory/${factoryId}/my-records`, { params });
  }

  findByLineAndDate(lineId: string, date: string): Observable<QuartRecord[]> {
    return this.http.get<QuartRecord[]>(`${this.base}/quart/line/${lineId}/date/${date}`);
  }

  findByFactory(factoryId: string, from: string, to: string, page = 0, size = 50): Observable<Page<QuartRecord>> {
    const params = new HttpParams().set('from', from).set('to', to).set('page', page).set('size', size);
    return this.http.get<Page<QuartRecord>>(`${this.base}/quart/factory/${factoryId}`, { params });
  }

  getDayStats(lineId: string, date: string): Observable<any> {
    return this.http.get(`${this.base}/quart/line/${lineId}/stats`, { params: { date } });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/quart/${id}`);
  }
}

// ─── PerteApiService ──────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class PerteApiService extends ApiService {

  create(req: PertePreformeRequest): Observable<PertePreformeRecord> {
    return this.http.post<PertePreformeRecord>(`${this.base}/pertes`, req);
  }

  findByFactory(factoryId: string, from: string, to: string, page = 0, size = 50): Observable<Page<PertePreformeRecord>> {
    const params = new HttpParams().set('from', from).set('to', to).set('page', page).set('size', size);
    return this.http.get<Page<PertePreformeRecord>>(`${this.base}/pertes/factory/${factoryId}`, { params });
  }

  getDayStats(lineId: string, date: string): Observable<any> {
    return this.http.get(`${this.base}/pertes/line/${lineId}/stats`, { params: { date } });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/pertes/${id}`);
  }
}

// ─── MaintenanceApiService ────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class MaintenanceApiService extends ApiService {

  create(req: any): Observable<MaintenanceRecord> {
    return this.http.post<MaintenanceRecord>(`${this.base}/maintenance`, req);
  }

  findByFactory(factoryId: string, from: string, to: string, page = 0): Observable<Page<MaintenanceRecord>> {
    const params = new HttpParams().set('from', from).set('to', to).set('page', page);
    return this.http.get<Page<MaintenanceRecord>>(`${this.base}/maintenance/factory/${factoryId}`, { params });
  }

  updateStatus(id: string, status: string, actionTaken?: string, durationMinutes?: number): Observable<MaintenanceRecord> {
    return this.http.patch<MaintenanceRecord>(`${this.base}/maintenance/${id}/status`, { status, actionTaken, durationMinutes });
  }

  getStats(factoryId: string): Observable<any> {
    return this.http.get(`${this.base}/maintenance/factory/${factoryId}/stats`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/maintenance/${id}`);
  }
}

// ─── SiropApiService ──────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class SiropApiService extends ApiService {

  create(req: any): Observable<SiropRecord> {
    return this.http.post<SiropRecord>(`${this.base}/siroperie`, req);
  }

  findByLineAndDate(lineId: string, date: string): Observable<SiropRecord[]> {
    return this.http.get<SiropRecord[]>(`${this.base}/siroperie/line/${lineId}/date/${date}`);
  }

  findByFactory(factoryId: string, from: string, to: string): Observable<Page<SiropRecord>> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<Page<SiropRecord>>(`${this.base}/siroperie/factory/${factoryId}`, { params });
  }
}

// ─── DiagnosticApiService ─────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class DiagnosticApiService extends ApiService {

  getSymptoms(machineTypeId: string, search?: string): Observable<Symptom[]> {
    const params = search ? new HttpParams().set('search', search) : undefined;
    return this.http.get<Symptom[]>(`${this.base}/diagnostic/machine-types/${machineTypeId}/symptoms`, { params });
  }

  createSymptom(machineTypeId: string, req: any): Observable<Symptom> {
    return this.http.post<Symptom>(`${this.base}/diagnostic/machine-types/${machineTypeId}/symptoms`, req);
  }

  addCause(symptomId: string, req: any): Observable<Symptom> {
    return this.http.post<Symptom>(`${this.base}/diagnostic/symptoms/${symptomId}/causes`, req);
  }

  getBlowingParams(lineId: string): Observable<BlowingParam[]> {
    return this.http.get<BlowingParam[]>(`${this.base}/soufflage/lines/${lineId}/params`);
  }

  saveBlowingParam(lineId: string, req: any): Observable<BlowingParam> {
    return this.http.put<BlowingParam>(`${this.base}/soufflage/lines/${lineId}/params`, req);
  }

  getTypePreformes(factoryId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/soufflage/factories/${factoryId}/type-preformes`);
  }

  createTypePreforme(factoryId: string, body: any): Observable<any> {
    return this.http.post<any>(`${this.base}/soufflage/factories/${factoryId}/type-preformes`, body);
  }

  updateTypePreforme(id: string, body: any): Observable<any> {
    return this.http.patch<any>(`${this.base}/soufflage/type-preformes/${id}`, body);
  }

  deleteTypePreforme(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/soufflage/type-preformes/${id}`);
  }
}

// ─── ReportApiService ─────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ReportApiService extends ApiService {

  getMonthly(factoryId: string, year: number, month: number, lineId?: string): Observable<MonthlyReport> {
    let params = new HttpParams().set('year', year).set('month', month);
    if (lineId) params = params.set('lineId', lineId);
    return this.http.get<MonthlyReport>(`${this.base}/reports/factory/${factoryId}/monthly`, { params });
  }

  getDashboardKpi(factoryId: string, date?: string): Observable<any> {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get(`${this.base}/reports/factory/${factoryId}/dashboard-kpi`, { params });
  }
}

// ─── RhApiService ─────────────────────────────────────────────────────────────
import { Poste, Equipe, EquipeMembre, RotationConfig, PlanningEntry,
         ShiftExchange, PresenceSheet, PresenceBilan } from '../models/models';

@Injectable({ providedIn: 'root' })
export class RhApiService extends ApiService {

  // Postes
  getPostes(factoryId: string): Observable<Poste[]> {
    return this.http.get<Poste[]>(`${this.base}/rh/factories/${factoryId}/postes`);
  }
  createPoste(factoryId: string, body: Partial<Poste>): Observable<Poste> {
    return this.http.post<Poste>(`${this.base}/rh/factories/${factoryId}/postes`, body);
  }
  updatePoste(id: string, body: Partial<Poste>): Observable<Poste> {
    return this.http.patch<Poste>(`${this.base}/rh/postes/${id}`, body);
  }
  deletePoste(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/rh/postes/${id}`);
  }

  // Équipes
  getEquipes(lineId: string): Observable<Equipe[]> {
    return this.http.get<Equipe[]>(`${this.base}/rh/lines/${lineId}/equipes`);
  }
  createEquipe(lineId: string, body: { nom: string; couleur: string }): Observable<Equipe> {
    return this.http.post<Equipe>(`${this.base}/rh/lines/${lineId}/equipes`, body);
  }
  updateEquipe(id: string, body: { nom?: string; couleur?: string }): Observable<Equipe> {
    return this.http.patch<Equipe>(`${this.base}/rh/equipes/${id}`, body);
  }
  addMembre(equipeId: string, body: { userId: string; posteId: string }): Observable<EquipeMembre> {
    return this.http.post<EquipeMembre>(`${this.base}/rh/equipes/${equipeId}/membres`, body);
  }
  removeMembre(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/rh/membres/${id}`);
  }

  // Rotation
  getRotationConfig(lineId: string): Observable<RotationConfig> {
    return this.http.get<RotationConfig>(`${this.base}/rh/lines/${lineId}/rotation-config`);
  }
  saveRotationConfig(lineId: string, body: any): Observable<RotationConfig> {
    return this.http.put<RotationConfig>(`${this.base}/rh/lines/${lineId}/rotation-config`, body);
  }

  // Planning
  getPlanning(lineId: string, from: string, to: string): Observable<PlanningEntry[]> {
    return this.http.get<PlanningEntry[]>(
      `${this.base}/rh/lines/${lineId}/planning`, { params: { from, to } });
  }
  generatePlanning(lineId: string, from: string, to: string): Observable<PlanningEntry[]> {
    return this.http.post<PlanningEntry[]>(
      `${this.base}/rh/lines/${lineId}/planning/generate`, { from, to });
  }

  // Échanges
  requestExchange(body: any): Observable<ShiftExchange> {
    return this.http.post<ShiftExchange>(`${this.base}/rh/exchanges`, body);
  }
  acceptExchange(id: string): Observable<ShiftExchange> {
    return this.http.post<ShiftExchange>(`${this.base}/rh/exchanges/${id}/accept`, {});
  }
  validateExchange(id: string, chefId: string): Observable<ShiftExchange> {
    return this.http.post<ShiftExchange>(`${this.base}/rh/exchanges/${id}/validate`, {}, { params: { chefId } });
  }
  rejectExchange(id: string, reason: string): Observable<ShiftExchange> {
    return this.http.post<ShiftExchange>(`${this.base}/rh/exchanges/${id}/reject`, { reason });
  }

  // Présences
  getPresenceSheet(entryId: string): Observable<PresenceSheet> {
    return this.http.get<PresenceSheet>(`${this.base}/rh/planning/${entryId}/presences`);
  }
  validatePresences(entryId: string, chefId: string, items: any[]): Observable<void> {
    return this.http.post<void>(
      `${this.base}/rh/planning/${entryId}/presences/validate`, { items }, { params: { chefId } });
  }

  // Bilan
  getPresenceBilan(factoryId: string, from: string, to: string): Observable<PresenceBilan> {
    return this.http.get<PresenceBilan>(
      `${this.base}/rh/factories/${factoryId}/presences/bilan`, { params: { from, to } });
  }

  // Notes 5S
  submit5sNotes(entryId: string, notes: { membreId: string; note5s: number; commentaire?: string }[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.base}/rh/planning/${entryId}/notes-5s`, { notes });
  }
}