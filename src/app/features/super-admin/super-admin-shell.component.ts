import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-super-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="sa-shell">

      <!-- HEADER -->
      <header class="sa-header">
        <div class="sa-header-left">
          <div class="sa-logo">⚙️</div>
          <div>
            <div class="sa-platform">Factory Diagnostic</div>
            <div class="sa-role">
              {{ auth.isSuperAdmin() ? 'Super Administration' : 'Gestion des rôles' }}
            </div>
          </div>
        </div>
        <div class="sa-header-right">
          <span class="sa-user">{{ userName() }}</span>
          <button class="sa-logout" (click)="logout()">Déconnexion</button>
        </div>
      </header>

      <!-- BODY -->
      <div class="sa-body">

        <!-- SIDEBAR -->
        <nav class="sa-sidebar">
          @if (auth.isSuperAdmin()) {
            <a class="sa-nav-item" routerLink="/super-admin/factories"
               [class.active]="currentPath() === '/super-admin/factories'">
              <span class="sa-nav-icon">🏭</span>
              <span>Usines</span>
            </a>
          }
          @if (auth.isFactoryAdmin() && factoryId()) {
            <a class="sa-nav-item" [routerLink]="['/super-admin/roles', factoryId()]"
               [class.active]="currentPath().startsWith('/super-admin/roles')">
              <span class="sa-nav-icon">🔑</span>
              <span>Rôles</span>
            </a>
          }
          <div class="sa-nav-divider">Navigation rapide</div>
          <a class="sa-nav-item small" routerLink="/dashboard">
            <span class="sa-nav-icon">↩️</span>
            <span>Retour à l'app</span>
          </a>
        </nav>

        <!-- CONTENT -->
        <main class="sa-content">
          <router-outlet />
        </main>
      </div>

    </div>
  `,
  styles: [`
    .sa-shell { min-height: 100vh; background: #060912; color: #E8EAF0; display: flex; flex-direction: column; }

    /* Header */
    .sa-header {
      height: 60px; background: #0D1226;
      border-bottom: 1px solid #1E2538;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; flex-shrink: 0;
    }
    .sa-header-left { display: flex; align-items: center; gap: 12px; }
    .sa-logo { font-size: 28px; }
    .sa-platform { font-size: 15px; font-weight: 700; }
    .sa-role {
      font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
      color: #FF4D6D; font-weight: 700;
    }
    .sa-header-right { display: flex; align-items: center; gap: 14px; }
    .sa-user { font-size: 13px; color: #6B7A9C; }
    .sa-logout {
      padding: 6px 14px; border-radius: 6px;
      background: none; border: 1px solid #1E2538;
      color: #6B7A9C; cursor: pointer; font-size: 12px;
    }
    .sa-logout:hover { border-color: #FF4D6D; color: #FF4D6D; }

    /* Body */
    .sa-body { display: flex; flex: 1; overflow: hidden; }

    /* Sidebar */
    .sa-sidebar {
      width: 200px; background: #0D1226;
      border-right: 1px solid #1E2538;
      padding: 16px 8px; display: flex; flex-direction: column; gap: 4px;
      flex-shrink: 0;
    }
    .sa-nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 8px;
      color: #6B7A9C; text-decoration: none; font-size: 14px;
      transition: all 0.15s;
    }
    .sa-nav-item:hover { background: #111827; color: #E8EAF0; }
    .sa-nav-item.active { background: #FF4D6D22; color: #FF4D6D; font-weight: 600; }
    .sa-nav-item.small { font-size: 12px; }
    .sa-nav-icon { font-size: 16px; }
    .sa-nav-divider {
      font-size: 10px; color: #2E3548; text-transform: uppercase;
      letter-spacing: 0.8px; padding: 12px 12px 4px; margin-top: 8px;
    }

    /* Content */
    .sa-content { flex: 1; overflow-y: auto; padding: 24px; }
  `]
})
export class SuperAdminShellComponent {
  auth   = inject(AuthService);
  router = inject(Router);

  userName    = () => this.auth.user()?.fullName ?? '';
  factoryId   = () => this.auth.currentFactory()?.id ?? null;
  currentPath = signal(this.router.url);

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => this.currentPath.set(e.urlAfterRedirects));
  }

  logout() { this.auth.logout(); }
}
