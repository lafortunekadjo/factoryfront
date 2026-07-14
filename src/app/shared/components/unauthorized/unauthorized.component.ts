import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div style="text-align:center; padding: 60px 16px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
      <h2 style="color: var(--color-danger);">Accès non autorisé</h2>
      <p style="color: var(--text-muted);">Vous n'avez pas les permissions nécessaires pour accéder à cette section.</p>
      <a routerLink="/dashboard" style="color: var(--factory-primary);">← Retour au tableau de bord</a>
    </div>
  `
})
export class UnauthorizedComponent {}
