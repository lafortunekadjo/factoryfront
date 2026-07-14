import { Routes } from '@angular/router';
export const MAINTENANCE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./maintenance.component').then(m => m.MaintenanceComponent) }
];
