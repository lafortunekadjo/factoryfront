// ─── Core Models ─────────────────────────────────────────────────────────────

export interface Factory {
  id: string;
  code: string;
  name: string;
  description?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  logoUrl?: string;
  appTitle: string;
  appSubtitle?: string;
  country?: string;
  city?: string;
  timezone: string;
  defaultLanguage: string;
  currency: string;
  modules: ModulesConfig;
  isActive: boolean;
}

export interface ModulesConfig {
  machines: boolean;
  soufflage: boolean;
  quart: boolean;
  pertes: boolean;
  maintenance: boolean;
  siroperie: boolean;
  bilan: boolean;
  rh: boolean;
}

export interface ProductionLine {
  id: string;
  factoryId: string;
  code: string;
  name: string;
  nominalSpeed?: number;
  minSpeed?: number;
  maxSpeed?: number;
  color: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface ShiftConfig {
  id: string;
  factoryId: string;
  shiftOrder: number;
  name: string;
  shortName?: string;
  startTime: string;  // "HH:mm"
  endTime: string;
  crossesMidnight: boolean;
  color?: string;
}

export interface Product {
  id: string;
  productionLineId: string;
  name: string;
  volume?: string;
  nominalSpeed?: number;
  brandColor?: string;
  iconUrl?: string;
  displayOrder: number;
  productCode?: string;
  unitCapacityCl?: number;
  bottlesPerPack?: number;
  packsPerPallet?: number;
  tareWeightG?: number;
}

export interface MachineType {
  id: string;
  factoryId: string;
  code: string;
  label: string;
  description?: string;
  color: string;
  icon?: string;
  displayOrder: number;
}

export interface StopType {
  id: string;
  factoryId: string;
  label: string;
  color?: string;
  isPlanned: boolean;
  displayOrder: number;
}

export interface LossCause {
  id: string;
  factoryId: string;
  label: string;
  color?: string;
  displayOrder: number;
}

// ─── Auth Models ──────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  lat?: number;
  lng?: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  phone?: string;
  avatarUrl?: string;
  preferredLanguage: string;
  preferredTheme: 'dark' | 'light';
  mustChangePassword: boolean;
  factory?: FactorySummary;
  roles: string[];
  permissions: string[];
}

export interface FactorySummary {
  id: string;
  code: string;
  name: string;
  appTitle: string;
  appSubtitle?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  logoUrl?: string;
  timezone: string;
  defaultLanguage: string;
  modules: ModulesConfig;
}

// ─── Operational Models ───────────────────────────────────────────────────────

export interface QuartRecord {
  id: string;
  productionLineId: string;
  shiftConfigId: string;
  productId?: string;
  operatorId: string;
  teamLeaderId?: string;
  teamLeaderName?: string;
  productionDate: string;
  recordedAt: string;
  bottlesProduced?: number;
  packsProduced?: number;
  palletsProduced?: number;
  bottlesPerPack?: number;
  packsPerPallet?: number;
  totalDowntimeMinutes: number;
  notes?: string;
  stopEvents?: StopEvent[];
  // Enrichi
  shiftName?: string;
  shiftShortName?: string;
  shiftColor?: string;
  productName?: string;
  productLabel?: string;
  productColor?: string;
  operatorName?: string;
  // Édition
  updatedAt?: string;
  updatedByName?: string;
  canEdit?: boolean;
}

export interface StopEvent {
  id?: string;
  stopTypeId?: string;
  stopTypeLabel?: string;
  durationMinutes?: number;
  description?: string;
  isPlanned?:boolean;
}

export interface QuartRecordRequest {
  productionLineId: string;
  shiftConfigId: string;
  productId?: string;
  productionDate: string;
  bottlesProduced?: number;
  packsProduced?: number;
  stopEventIds?: string[];
  stopEvents?: StopEvent[];
  notes?: string;
}

export interface PertePreformeRecord {
  id: string;
  productionLineId: string;
  shiftConfigId: string;
  productId?: string;
  productionDate: string;
  recordedAt: string;
  quantityLost: number;
  lossCauseId?: string;
  lossCauseLabel?: string;
  lossCauseColor?: string;
  notes?: string;
  shiftName?: string;
  productName?: string;
  operatorName?: string;
}

export interface PertePreformeRequest {
  productionLineId: string;
  shiftConfigId: string;
  productId?: string;
  productionDate: string;
  quantityLost: number;
  lossCauseId?: string;
  notes?: string;
}

export interface MaintenanceRecord {
  id: string;
  lineMachineId: string;
  machineLabel?: string;
  machineColor?: string;
  shiftConfigId: string;
  shiftName?: string;
  technicianId: string;
  technicianName?: string;
  productionDate: string;
  recordedAt: string;
  maintenanceType: 'MECANIQUE' | 'ELECTRIQUE';
  severity: 'MINEUR' | 'MAJEUR' | 'CRITIQUE';
  status: 'EN_COURS' | 'RESOLU' | 'EN_ATTENTE_PIECE' | 'ESCALADE';
  defectDescription: string;
  rootCause?: string;
  actionTaken?: string;
  durationMinutes?: number;
  resolvedAt?: string;
}

export interface SiropRecord {
  id: string;
  productionLineId: string;
  shiftConfigId: string;
  shiftName?: string;
  productId?: string;
  productName?: string;
  productionDate: string;
  recordedAt: string;
  initialVolumeLiters?: number;
  currentVolumeLiters: number;
  bottlesAtReading?: number;
  notes?: string;
  operatorName?: string;
  // Calculés
  consumedLiters?: number;
  remainingPct?: number;
}

// ─── Diagnostic Models ────────────────────────────────────────────────────────

export interface Symptom {
  id: string;
  machineTypeId: string;
  label: string;
  description?: string;
  causes: DiagnosticCause[];
}

export interface DiagnosticCause {
  id: string;
  label: string;
  actions: DiagnosticAction[];
}

export interface DiagnosticAction {
  id: string;
  label: string;
}

export interface BlowingParam {
  id?: string;
  productionLineId: string;
  productId: string;
  productName?: string;
  productVolume?: string;
  brandColor?: string;
  heatLevels: number[];
  heatingCapacityPct?: number;
  stretchingSpeed?: number;
  pressureP1Bar?: number;
  pressureP2Bar?: number;
  p1StartPct?: number;
  releaseTempCelsius?: number;
  nominalSpeed?: number;
  notes?: string;
  updatedAt?: string;
  typePreformeId?: string;
  typePreformeNom?: string;
}

// ─── Analytics Models ─────────────────────────────────────────────────────────

export interface MonthlyReport {
  period: string;           // "YYYY-MM"
  factoryId: string;
  lineId?: string;
  totalBottles: number;
  totalPacks: number;
  totalDowntimeMinutes: number;
  totalPreformeLost: number;
  maintenanceCount: number;
  criticalMaintenanceCount: number;
  byProduct: ProductStats[];
  stopTypeBreakdown: StopTypeStats[];
  lossCauseBreakdown: LossCauseStats[];
  dailyProduction: DailyStats[];
}

export interface ProductStats {
  productName: string;
  productVolume?: string;
  totalBottles: number;
  totalPacks: number;
  pct: number;
}

export interface StopTypeStats {
  label: string;
  totalMinutes: number;
  count: number;
  pct: number;
}

export interface LossCauseStats {
  label: string;
  totalLost: number;
  count: number;
  pct: number;
}

export interface DailyStats {
  date: string;
  bottles: number;
  downtime: number;
  losses: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface PageRequest {
  page?: number;
  size?: number;
  sort?: string;
}

// ═══════════════════════════════════════════════════════════════════
// Module RH
// ═══════════════════════════════════════════════════════════════════

export interface Poste {
  id: string; nom: string; machineTypeId?: string; machineTypeLabel?: string;
  isMachineOp: boolean; displayOrder: number;
}

export interface Equipe {
  id: string; nom: string; couleur: string; ordre: number;
  lineId: string; lineName: string; membres: EquipeMembre[];
}

export interface EquipeMembre {
  id: string; userId: string; userFullName: string;
  posteId: string; posteNom: string; isMachineOp: boolean;
}

export interface PatternBlock {
  id?: string; ordre: number; shiftConfigId?: string; shiftName?: string;
  isRepos: boolean; nbJours: number;
}

export interface RotationConfig {
  id: string; nbEquipes: number; startDate: string;
  autoGenerate: boolean; blocks: PatternBlock[];
}

export interface PlanningEntry {
  id: string; equipeId: string; equipeNom: string; equipeCouleur: string;
  date: string; shiftConfigId?: string; shiftName?: string; shiftShortName?: string;
  isRepos: boolean; locked: boolean;
}

export interface ShiftExchange {
  id: string; requesterName: string; accepterName: string;
  dateRequester: string; dateAccepter: string;
  status: 'PENDING_ACCEPT' | 'ACCEPTED' | 'PENDING_CHEF' | 'VALIDATED' | 'REJECTED';
  note?: string; rejectReason?: string; createdAt: string;
}

export interface PresenceLigne {
  membreId: string; membreNom: string; posteNom: string;
  present: boolean | null; addedByChef: boolean; note?: string;
}

export interface PresenceSheet {
  planningEntryId: string; equipeNom: string; date: string;
  shiftName: string; locked: boolean; lignes: PresenceLigne[];
}

export interface PresenceBilanLigne {
  membreId: string; membreNom: string; posteNom: string; equipeNom: string;
  presents: number; absents: number; tauxPresence: number;
}

export interface PresenceBilan {
  from: string; to: string; totalPresents: number;
  totalAbsents: number; tauxPresence: number;
  lignes: PresenceBilanLigne[];
}

export interface TypePreforme {
  id: string; nom: string; poidsG?: number;
  fournisseur?: string; notes?: string; displayOrder: number;
}

// ── Pertes multi-types ────────────────────────────────────────────────────────
export interface LossType {
  id: string; nom: string; unite: string; color: string; displayOrder: number;
}

export interface PerteLigne {
  id?: string; lossTypeId: string; lossTypeNom: string;
  lossTypeUnite: string; lossTypeColor: string;
  lossCauseId?: string; lossCauseLabel?: string;
  quantity: number; notes?: string;
}

export interface PerteFiche {
  id: string; productionLineId: string; shiftConfigId: string; shiftName: string;
  productId?: string; productName?: string;
  productionDate: string; recordedAt: string;
  notes?: string; lignes: PerteLigne[];
}

// ── Rotation flexible ─────────────────────────────────────────────────────────
export type ReposMode = 'CYCLIQUE' | 'FIXE';