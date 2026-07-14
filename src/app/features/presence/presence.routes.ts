import { Routes } from '@angular/router';
export const PRESENCE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./presence.component').then(m => m.PresenceComponent) }
];
