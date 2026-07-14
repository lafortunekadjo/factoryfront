import { Routes } from '@angular/router';
import { authGuard, permissionGuard, moduleGuard, superAdminGuard, roleManagementGuard } from './core/guards/guards';

export const routes: Routes = [
  // Super Admin / Gestion rôles — layout séparé
  {
    path: 'super-admin',
    loadChildren: () => import('./features/super-admin/super-admin.routes').then(m => m.SUPER_ADMIN_ROUTES)
  },

  // Auth
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },

  // App principale
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/components/shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // Dashboard home
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },

      // Profil utilisateur — accessible à tout utilisateur connecté
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },

      // Module RH
      {
        path: 'rh',
        canActivate: [authGuard],
        loadComponent: () => import('./features/rh/rh.component').then(m => m.RhComponent)
      },

      // Présences (chef d'équipe)
      {
        path: 'presence',
        canActivate: [authGuard],
        loadChildren: () => import('./features/presence/presence.routes').then(m => m.PRESENCE_ROUTES)
      },

      // Machines / Diagnostic
      {
        path: 'machines',
        canActivate: [moduleGuard, permissionGuard],
        data: { module: 'machines', permission: 'MACHINES_READ' },
        loadChildren: () => import('./features/machines/machines.routes').then(m => m.MACHINES_ROUTES)
      },

      // Soufflage
      {
        path: 'soufflage',
        canActivate: [moduleGuard, permissionGuard],
        data: { module: 'soufflage', permission: 'SOUFFLAGE_READ' },
        loadChildren: () => import('./features/soufflage/soufflage.routes').then(m => m.SOUFFLAGE_ROUTES)
      },

      // Suivi Quart
      {
        path: 'quart',
        canActivate: [moduleGuard, permissionGuard],
        data: { module: 'quart', permission: 'QUART_READ' },
        loadChildren: () => import('./features/quart/quart.routes').then(m => m.QUART_ROUTES)
      },

      // Pertes Préformes
      {
        path: 'pertes',
        canActivate: [moduleGuard, permissionGuard],
        data: { module: 'pertes', permission: 'PERTES_READ' },
        loadChildren: () => import('./features/pertes/pertes.routes').then(m => m.PERTES_ROUTES)
      },

      // Maintenance
      {
        path: 'maintenance',
        canActivate: [moduleGuard, permissionGuard],
        data: { module: 'maintenance', permission: 'MAINTENANCE_READ' },
        loadChildren: () => import('./features/maintenance/maintenance.routes').then(m => m.MAINTENANCE_ROUTES)
      },

      // Siroperie
      {
        path: 'siroperie',
        canActivate: [moduleGuard, permissionGuard],
        data: { module: 'siroperie', permission: 'SIROPERIE_READ' },
        loadChildren: () => import('./features/siroperie/siroperie.routes').then(m => m.SIROPERIE_ROUTES)
      },

      // Bilan Mensuel
      {
        path: 'bilan',
        canActivate: [moduleGuard, permissionGuard],
        data: { module: 'bilan', permission: 'BILAN_READ' },
        loadChildren: () => import('./features/bilan/bilan.routes').then(m => m.BILAN_ROUTES)
      },

      // Administration
      {
        path: 'config',
        canActivate: [permissionGuard],
        data: { permissions: ['CONFIG_WRITE', 'PLATFORM_ADMIN'] },
        loadChildren: () => import('./features/config/config.routes').then(m => m.CONFIG_ROUTES)
      },

      { path: 'unauthorized', loadComponent: () => import('./shared/components/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent) },
      { path: '**', redirectTo: 'dashboard' }
    ]
  }
];
