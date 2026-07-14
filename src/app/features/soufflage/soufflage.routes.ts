// soufflage.routes.ts
import { Routes } from '@angular/router';
export const SOUFFLAGE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./soufflage.component').then(m => m.SoufflageComponent) }
];
