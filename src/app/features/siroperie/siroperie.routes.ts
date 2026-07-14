import { Routes } from '@angular/router';
export const SIROPERIE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./siroperie.component').then(m => m.SiroperiComponent) }
];
