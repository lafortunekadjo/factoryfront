import { Routes } from '@angular/router';
export const QUART_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./quart.component').then(m => m.QuartComponent) }
];
