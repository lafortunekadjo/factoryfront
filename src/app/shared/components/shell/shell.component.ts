import { Component, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { FactoryConfigService } from '../../../core/services/factory-config.service';
import { ModulesConfig } from '../../../core/models/models';
import { environment } from '../../../../environments/environment';

interface NavItem {
  id: string;
  icon: string;
  label: string;
  route: string;
  module?: keyof ModulesConfig;
  permission?: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  template: `
    <div class="shell" [attr.data-theme]="theme()">

      <!-- HEADER -->
      <header class="shell-header">
        <div class="header-left">
          @if (logoUrl()) {
            <img [src]="logoUrl()" class="factory-logo" [alt]="appTitle()" />
          } @else {
            <div class="factory-icon">⚙️</div>
          }
          <div class="header-titles">
            <div class="factory-subtitle">{{ appSubtitle() }}</div>
            <div class="factory-title">{{ appTitle() }}</div>
          </div>
        </div>
        <div class="header-right">
          @if (auth.isSuperAdmin()) {
            <a class="super-admin-link" routerLink="/super-admin">
              🔑 Super Admin
            </a>
          }
          <button class="icon-btn" (click)="toggleTheme()" [title]="'THEME' | translate">
            {{ theme() === 'dark' ? '☀️' : '🌙' }}
          </button>
          <div class="user-badge" (click)="userMenuOpen.set(!userMenuOpen())">
            @if (userAvatarUrl()) {
              <img [src]="userAvatarUrl()" class="user-avatar user-avatar-img" alt="Profil" />
            } @else {
              <div class="user-avatar">{{ userInitials() }}</div>
            }
          </div>
          @if (userMenuOpen()) {
            <div class="user-menu">
              <div class="user-menu-name">{{ userName() }}</div>
              <div class="user-menu-role">{{ userRole() }}</div>
              <hr/>
              <a routerLink="/profile" (click)="userMenuOpen.set(false)">👤 Mon profil</a>
              <button (click)="logout()">🚪 Déconnexion</button>
            </div>
          }
        </div>
      </header>

      <!-- SIDEBAR (desktop) -->
      <nav class="sidebar" [class.collapsed]="sidebarCollapsed()">
        <button class="sidebar-toggle" (click)="sidebarCollapsed.set(!sidebarCollapsed())">
          {{ sidebarCollapsed() ? '▶' : '◀' }}
        </button>
        @for (item of visibleNavItems(); track item.id) {
          <a class="nav-item"
             [routerLink]="item.route"
             routerLinkActive="active"
             [title]="item.label">
            <span class="nav-icon">{{ item.icon }}</span>
            @if (!sidebarCollapsed()) {
              <span class="nav-label">{{ item.label }}</span>
            }
          </a>
        }
      </nav>

      <!-- CONTENT -->
      <main class="shell-content" [class.sidebar-open]="!sidebarCollapsed()">
        <router-outlet />
      </main>

      <!-- BOTTOM NAV (mobile) -->
      <nav class="bottom-nav">
        @for (item of visibleNavItems().slice(0, 8); track item.id) {
          <a class="bottom-nav-item"
             [routerLink]="item.route"
             routerLinkActive="active">
            <span class="bnav-icon">{{ item.icon }}</span>
            <span class="bnav-label">{{ item.shortLabel || item.label }}</span>
          </a>
        }
      </nav>

    </div>
  `,
  styles: [`
    .shell { min-height: 100vh; background: var(--bg-app); }

    /* Header */
    .shell-header {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      height: var(--nav-height);
      background: #0D1226;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 16px;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .factory-logo { height: 36px; width: auto; border-radius: 8px; }
    .factory-icon { font-size: 24px; }
    .factory-subtitle { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; }
    .factory-title { font-size: 15px; font-weight: 700; color: var(--text); }
    .header-right { display: flex; align-items: center; gap: 10px; position: relative; }
    .icon-btn { background: none; border: none; cursor: pointer; font-size: 18px; padding: 6px; }
    .super-admin-link {
      padding: 5px 12px; border-radius: 6px;
      background: #FF4D6D22; border: 1px solid #FF4D6D44;
      color: #FF4D6D; font-size: 12px; font-weight: 700;
      text-decoration: none; white-space: nowrap;
    }
    .super-admin-link:hover { background: #FF4D6D; color: #fff; }
    .user-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--factory-primary);
      color: #fff; font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    }
    .user-avatar-img { object-fit: cover; background: var(--bg-card2); }
    .user-menu {
      position: absolute; top: 44px; right: 0;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 10px; padding: 12px; min-width: 180px;
      box-shadow: 0 8px 24px #0006; z-index: 200;
    }
    .user-menu-name { font-weight: 700; font-size: 14px; margin-bottom: 2px; }
    .user-menu-role { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
    .user-menu button { width: 100%; background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 8px 0; text-align: left; font-size: 14px; }
    .user-menu a { display: block; width: 100%; background: none; border: none; color: var(--text); cursor: pointer; padding: 8px 0; text-align: left; font-size: 14px; text-decoration: none; }
    .user-menu a:hover { color: var(--factory-primary); }
    .user-menu hr { border: none; border-top: 1px solid var(--border); margin: 8px 0; }

    /* Sidebar */
    .sidebar {
      position: fixed; left: 0; top: var(--nav-height); bottom: 0;
      width: var(--sidebar-width); background: #0D1226;
      border-right: 1px solid var(--border);
      display: none; flex-direction: column;
      padding: 12px 8px; gap: 4px; overflow-y: auto; z-index: 90;
      transition: width 0.2s;
    }
    .sidebar.collapsed { width: 56px; }
    .sidebar-toggle {
      align-self: flex-end; background: none; border: none;
      color: var(--text-muted); cursor: pointer; padding: 4px; font-size: 12px;
      margin-bottom: 8px;
    }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 10px;
      color: var(--text-muted); text-decoration: none;
      font-size: 14px; transition: background 0.15s, color 0.15s;
      white-space: nowrap; overflow: hidden;
    }
    .nav-item:hover { background: var(--bg-card); color: var(--text); }
    .nav-item.active { background: var(--factory-primary-light); color: var(--factory-primary); font-weight: 600; }
    .nav-icon { font-size: 18px; flex-shrink: 0; }

    /* Content */
    .shell-content {
      margin-top: var(--nav-height);
      padding: 16px 14px 80px;
      min-height: calc(100vh - var(--nav-height));
    }

    /* Bottom Nav */
    .bottom-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      height: var(--bottom-nav-h);
      background: #0D1226; border-top: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-around;
      z-index: 100; padding-bottom: env(safe-area-inset-bottom);
    }
    .bottom-nav-item {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      color: var(--text-muted); text-decoration: none; flex: 1;
      padding: 6px 2px; border-radius: 8px; transition: color 0.15s;
    }
    .bottom-nav-item.active { color: var(--factory-primary); }
    .bnav-icon { font-size: 20px; }
    .bnav-label { font-size: 10px; font-weight: 500; }

    @media (min-width: 768px) {
      .sidebar { display: flex; }
      .shell-content.sidebar-open { margin-left: var(--sidebar-width); }
      .shell-content:not(.sidebar-open) { margin-left: 56px; }
      .bottom-nav { display: none; }
    }
  `]
})
export class ShellComponent {
  auth = inject(AuthService);
  config = inject(FactoryConfigService);
  router = inject(Router);

  sidebarCollapsed = signal(false);
  userMenuOpen = signal(false);
  theme = signal<'dark' | 'light'>('dark');

  appTitle = this.config.appTitle;
  appSubtitle = this.config.appSubtitle;
  logoUrl = this.config.logoUrl;

  userInitials = computed(() => {
    const u = this.auth.user();
    if (!u) return '?';
    return (u.firstName[0] + u.lastName[0]).toUpperCase();
  });

  userAvatarUrl = computed(() => {
    const url = this.auth.user()?.avatarUrl;
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const apiRoot = environment.apiUrl.replace(/\/api$/, '');
    return apiRoot + url;
  });

  userName = computed(() => this.auth.user()?.fullName ?? '');
  userRole = computed(() => this.auth.user()?.roles[0] ?? '');

  private allNavItems: (NavItem & { shortLabel?: string })[] = [
    { id: 'home',        icon: '🏠', label: 'Accueil',     shortLabel: 'Accueil',  route: '/dashboard' },
    { id: 'machines',    icon: '🔧', label: 'Machines',    shortLabel: 'Machines', route: '/machines',     module: 'machines',     permission: 'MACHINES_READ' },
    { id: 'soufflage',   icon: '💨', label: 'Soufflage',   shortLabel: 'Soufflage',route: '/soufflage',    module: 'soufflage',    permission: 'SOUFFLAGE_READ' },
    { id: 'quart',       icon: '📋', label: 'Quart',       shortLabel: 'Quart',    route: '/quart',        module: 'quart',        permission: 'QUART_READ' },
    { id: 'pertes',      icon: '🗑️', label: 'Pertes',      shortLabel: 'Pertes',   route: '/pertes',       module: 'pertes',       permission: 'PERTES_READ' },
    { id: 'maintenance', icon: '🛠️', label: 'Maintenance', shortLabel: 'Maint.',   route: '/maintenance',  module: 'maintenance',  permission: 'MAINTENANCE_READ' },
    { id: 'siroperie',   icon: '🧪', label: 'Siroperie',   shortLabel: 'Sirop',    route: '/siroperie',    module: 'siroperie',    permission: 'SIROPERIE_READ' },
    { id: 'bilan',       icon: '📊', label: 'Bilan',       shortLabel: 'Bilan',    route: '/bilan',        module: 'bilan',        permission: 'BILAN_READ' },
    { id: 'rh',          icon: '👥', label: 'RH',          shortLabel: 'RH',       route: '/rh',           permission: 'EQUIPES_READ' },
    { id: 'presence',    icon: '✅', label: 'Présences',   shortLabel: 'Présen.',  route: '/presence' },
    { id: 'config',      icon: '⚙️', label: 'Config',      shortLabel: 'Config',   route: '/config',       permission: 'CONFIG_WRITE' },
  ];

  visibleNavItems = computed(() => {
    const modules = this.config.modules();
    return this.allNavItems.filter(item => {
      if (item.module && !modules[item.module]) return false;
      if (item.permission && !this.auth.hasPermission(item.permission)) return false;
      return true;
    });
  });

  toggleTheme() {
    const t = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(t);
    document.documentElement.setAttribute('data-theme', t);
  }

  logout() {
    this.auth.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    const target = e.target as HTMLElement;
    if (!target.closest('.user-badge') && !target.closest('.user-menu')) {
      this.userMenuOpen.set(false);
    }
  }
}
