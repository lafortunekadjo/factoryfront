// machines.routes.ts
import { Routes } from '@angular/router';
export const MACHINES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./machines.component').then(m => m.MachinesComponent) }
];
