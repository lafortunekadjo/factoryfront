import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FactoryConfigService } from '../services/factory-config.service';

// ─── AuthGuard ────────────────────────────────────────────
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

// ─── PermissionGuard ──────────────────────────────────────
export const permissionGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const requiredPermission = route.data?.['permission'] as string;
  const requiredPermissions = route.data?.['permissions'] as string[];

  if (!requiredPermission && !requiredPermissions) return true;

  const hasAccess = requiredPermission
    ? auth.hasPermission(requiredPermission)
    : auth.hasAnyPermission(...(requiredPermissions ?? []));

  if (!hasAccess) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};

// ─── ModuleGuard ──────────────────────────────────────────
import { ModulesConfig } from '../models/models';

export const moduleGuard: CanActivateFn = (route, state) => {
  const factoryConfig = inject(FactoryConfigService);
  const router = inject(Router);

  const module = route.data?.['module'] as keyof ModulesConfig;
  if (!module) return true;

  if (factoryConfig.isModuleEnabled(module)) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

// ─── SuperAdminGuard ──────────────────────────────────
export const superAdminGuard: CanActivateFn = (route, state) => {
  const auth    = inject(AuthService);
  const router  = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
  if (!auth.isSuperAdmin()) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};

// ─── RoleManagementGuard ──────────────────────────────
// Autorise SUPER_ADMIN (toute usine) ou FACTORY_ADMIN de l'usine ciblée par :factoryId
export const roleManagementGuard: CanActivateFn = (route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  if (auth.isSuperAdmin()) return true;

  const factoryId = route.paramMap.get('factoryId');
  const isFactoryAdminHere =
    auth.isFactoryAdmin() && auth.currentFactory()?.id === factoryId;

  if (!isFactoryAdminHere) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
