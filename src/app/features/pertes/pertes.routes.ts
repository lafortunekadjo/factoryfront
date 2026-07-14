import { Routes } from '@angular/router';
export const PERTES_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pertes.component').then(m => m.PerteComponent) }
];
