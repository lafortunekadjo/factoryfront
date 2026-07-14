import { Routes } from '@angular/router';
export const RH_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./rh.component').then(m => m.RhComponent) }
];
