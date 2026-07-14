import { Routes } from '@angular/router';
import { superAdminGuard, roleManagementGuard } from '../../core/guards/guards';

export const SUPER_ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./super-admin-shell.component').then(m => m.SuperAdminShellComponent),
    children: [
      { path: '', redirectTo: 'factories', pathMatch: 'full' },
      {
        path: 'factories',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./factories.component').then(m => m.FactoriesComponent)
      },
      {
        path: 'roles/:factoryId',
        canActivate: [roleManagementGuard],
        loadComponent: () => import('./roles.component').then(m => m.RolesComponent)
      },
    ]
  }
];
