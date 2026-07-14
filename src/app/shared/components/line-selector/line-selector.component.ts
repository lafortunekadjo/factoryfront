import { Component, inject, output, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FactoryConfigService } from '../../../core/services/factory-config.service';
import { ProductionLine } from '../../../core/models/models';

@Component({
  selector: 'app-line-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="line-selector">
      <div class="ls-title">Sélectionne ta ligne</div>
      @for (line of lines(); track line.id) {
        <button class="ls-card" [style.--lc]="line.color" (click)="lineSelected.emit(line)">
          <div class="ls-icon-wrap" [style.background]="line.color + '22'">
            <span class="ls-icon">{{ line.icon ?? '🏭' }}</span>
          </div>
          <div class="ls-info">
            <div class="ls-name" [style.color]="line.color">{{ line.name }}</div>
            @if (line.minSpeed && line.maxSpeed) {
              <div class="ls-speed">{{ line.minSpeed | number }} – {{ line.maxSpeed | number }} bt/h</div>
            }
          </div>
          <span class="ls-arrow" [style.color]="line.color">›</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .line-selector { padding-top: 8px; }
    .ls-title { font-size: 15px; font-weight: 700; margin-bottom: 14px; }
    .ls-card {
      display: flex; align-items: center; gap: 14px;
      width: 100%; background: var(--bg-card);
      border: 1px solid var(--lc, var(--border));
      border-radius: var(--border-radius); padding: 14px 16px;
      margin-bottom: 10px; cursor: pointer; text-align: left;
      transition: background 0.15s;
    }
    .ls-card:hover { background: var(--bg-card2); }
    .ls-icon-wrap { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ls-icon { font-size: 24px; }
    .ls-info { flex: 1; }
    .ls-name { font-weight: 700; font-size: 16px; margin-bottom: 2px; }
    .ls-speed { font-size: 12px; color: var(--text-muted); }
    .ls-arrow { font-size: 24px; margin-left: auto; }
  `]
})
export class LineSelectorComponent {
  config = inject(FactoryConfigService);
  lines = this.config.lines;
  lineSelected = output<ProductionLine>();
}
