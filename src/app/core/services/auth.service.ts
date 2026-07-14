import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';
import { AuthResponse, LoginRequest, UserProfile } from '../models/models';
import { FactoryConfigService } from './factory-config.service';
import { environment } from '../../../environments/environment';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'factory_access_token',
  REFRESH_TOKEN: 'factory_refresh_token',
  USER: 'factory_user',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {

  private http = inject(HttpClient);
  private router = inject(Router);
  private factoryConfig = inject(FactoryConfigService);

  private _user = signal<UserProfile | null>(this.loadUserFromStorage());
  private _loading = signal(false);

  readonly user = computed(() => this._user());
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isLoading = computed(() => this._loading());
  readonly isSuperAdmin = computed(() => this._user()?.roles.includes('SUPER_ADMIN') ?? false);
  readonly isFactoryAdmin = computed(() => this._user()?.roles.includes('FACTORY_ADMIN') ?? false);
  readonly currentFactory = computed(() => this._user()?.factory ?? null);

  // ── Login ────────────────────────────────────────────────
  login(request: LoginRequest) {
    this._loading.set(true);
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, request).pipe(
      tap(async (response) => {
        this.storeTokens(response.accessToken, response.refreshToken);
        this._user.set(response.user);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));

        // Charger la config usine si l'utilisateur a une usine
        if (response.user.factory?.id) {
          await this.factoryConfig.loadFactoryConfig(response.user.factory.id);
        }

        this._loading.set(false);
      }),
      catchError(err => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  // ── Logout ───────────────────────────────────────────────
  logout(): void {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (refreshToken) {
      this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken }).subscribe();
    }
    this.clearStorage();
    this._user.set(null);
    this.router.navigate(['/auth/login']);
  }

  // ── Refresh Token ────────────────────────────────────────
  refreshToken() {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token'));
    }

    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken }).pipe(
      tap(response => {
        this.storeTokens(response.accessToken, response.refreshToken);
        this._user.set(response.user);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
      }),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  // ── Permissions ──────────────────────────────────────────
  hasPermission(permission: string): boolean {
    return this._user()?.permissions.includes(permission) ?? false;
  }

  // ── Profil ───────────────────────────────────────────────
  /** Met à jour le user en mémoire + storage après modification du profil (infos perso, préférences). */
  updateLocalUser(user: UserProfile): void {
    this._user.set(user);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  hasAnyPermission(...permissions: string[]): boolean {
    const userPerms = this._user()?.permissions ?? [];
    return permissions.some(p => userPerms.includes(p));
  }

  hasRole(role: string): boolean {
    return this._user()?.roles.includes(role) ?? false;
  }

  // ── Tokens ───────────────────────────────────────────────
  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }

  private clearStorage(): void {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }

  private loadUserFromStorage(): UserProfile | null {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    return stored ? JSON.parse(stored) : null;
  }

  // ── Initialisation app ───────────────────────────────────
  async initializeApp(): Promise<void> {
    const user = this._user();
    if (user?.factory?.id && !this.factoryConfig.loaded()) {
      await this.factoryConfig.loadFactoryConfig(user.factory.id);
    }
  }
}
