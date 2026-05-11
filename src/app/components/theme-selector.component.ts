import { Component, EventEmitter, Input, OnInit, Output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FundMeta, ThemeSpec } from '../models/types';
import { I18nService } from '../services/i18n.service';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="section-card">
      <h2 class="section-title">{{ i18n.t('strategy.section') }}</h2>
      <p class="section-desc">{{ i18n.t('strategy.desc') }}</p>

      <div class="strategy-form">
        <!-- Selected funds -->
        <div class="pool-section">
          <div class="pool-header">
            <span class="form-label">{{ i18n.t('strategy.yourFunds') }}</span>
            <span class="pool-count" *ngIf="selectedFunds.size">{{ selectedFunds.size }} {{ i18n.t('strategy.selected') }}</span>
          </div>
          <div class="pool-toolbar">
            <div class="pool-search">
              <svg class="pool-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7"/>
                <line x1="21" y1="21" x2="16.5" y2="16.5"/>
              </svg>
              <input
                type="text"
                [(ngModel)]="fundFilter"
                [placeholder]="i18n.t('strategy.filter')"
                [attr.aria-label]="i18n.t('strategy.filter')" />
              <button
                *ngIf="fundFilter"
                type="button"
                class="pool-search-clear"
                [attr.aria-label]="i18n.t('strategy.clearFilter')"
                (click)="fundFilter = ''">×</button>
            </div>
            <button
              *ngIf="selectedFunds.size"
              type="button"
              class="pool-clear-btn"
              (click)="clearSelection()">{{ i18n.t('strategy.clear') }} ({{ selectedFunds.size }})</button>
          </div>
          <div class="fund-pool">
            <button
              *ngFor="let f of filteredFunds(); trackBy: trackByCode"
              type="button"
              class="fund-chip"
              [class.selected]="selectedFunds.has(f.policy_code)"
              [attr.aria-pressed]="selectedFunds.has(f.policy_code)"
              [title]="f.policy_code + ' — ' + f.fund_name"
              (click)="toggleFund(f.policy_code)">
              <span class="chip-code">{{ f.policy_code }}</span>
              <span class="chip-name">{{ i18n.fundName(f.policy_code, f.fund_name) }}</span>
              <svg *ngIf="selectedFunds.has(f.policy_code)" class="chip-state-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <div *ngIf="filteredFunds().length === 0" class="pool-empty">
              {{ i18n.t('strategy.noMatches') }} "{{ fundFilter }}".
            </div>
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div *ngIf="active" class="active-summary">
        <span class="active-dot"></span>
        <span>
          <strong>{{ i18n.t('strategy.active') }}</strong>
          {{ active.name }}
          · {{ selectedFunds.size }} {{ selectedFunds.size === 1 ? i18n.t('strategy.fund') : i18n.t('strategy.funds') }}
        </span>
      </div>
      <div *ngIf="!active" class="empty-state">
        {{ i18n.t('strategy.empty') }}
      </div>
    </div>
  `,
  styles: [`
    .strategy-form {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .form-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    /* Pool section */
    .pool-section {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .pool-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
    .pool-count {
      font-size: 11px;
      font-weight: 500;
      color: var(--accent-text);
      letter-spacing: -0.005em;
    }

    /* Toolbar */
    .pool-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .pool-search {
      position: relative;
      flex: 1;
      min-width: 200px;
    }
    .pool-search input {
      width: 100%;
      padding: 7px 32px 7px 32px;
      font-size: 13px;
      letter-spacing: -0.008em;
    }
    .pool-search-icon {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--text-dim);
    }
    .pool-search-clear {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      width: 22px;
      height: 22px;
      border: none;
      background: var(--surface-sunken);
      color: var(--text-muted);
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background-color 150ms var(--ease), color 150ms var(--ease);
    }
    .pool-search-clear:hover {
      background: var(--border-strong);
      color: var(--text);
    }
    .pool-clear-btn {
      padding: 6px 12px;
      background: transparent;
      color: var(--text-muted);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-pill);
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: -0.005em;
      cursor: pointer;
      transition: background-color 150ms var(--ease), border-color 150ms var(--ease), color 150ms var(--ease);
    }
    .pool-clear-btn:hover {
      background: var(--surface);
      border-color: var(--text-dim);
      color: var(--text);
    }
    .pool-empty {
      grid-column: 1 / -1;
      padding: 20px;
      text-align: center;
      font-size: 13px;
      letter-spacing: -0.008em;
      color: var(--text-dim);
      background: var(--surface);
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-sm);
    }

    /* Fund chips */
    .fund-pool {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 8px;
    }
    .fund-chip {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      grid-template-areas:
        "code icon"
        "name name";
      gap: 2px 8px;
      padding: 9px 12px;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease),
        color 150ms var(--ease),
        transform 150ms var(--ease),
        box-shadow 150ms var(--ease);
    }
    .fund-chip:hover {
      border-color: var(--text-dim);
      background: var(--surface-2);
    }
    .fund-chip:active { transform: scale(0.98); }
    .fund-chip:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .chip-code {
      grid-area: code;
      font-family: 'SF Mono', 'JetBrains Mono', 'Consolas', monospace;
      font-size: 12.5px;
      font-weight: 600;
      letter-spacing: 0;
      color: var(--text);
    }
    .chip-name {
      grid-area: name;
      font-size: 11px;
      letter-spacing: -0.005em;
      color: var(--text-muted);
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .chip-state-icon {
      grid-area: icon;
      flex-shrink: 0;
      align-self: start;
      color: var(--accent);
    }
    .fund-chip.selected {
      background: var(--accent-soft);
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-ring);
    }
    .fund-chip.selected .chip-code { color: var(--accent-text); }
    .fund-chip.selected .chip-name { color: var(--accent-text); opacity: 0.8; }

    /* Footer */
    .active-summary {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 18px;
      padding: 12px 16px;
      background: var(--accent-soft);
      color: var(--accent-text);
      border: 1px solid var(--accent-border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      letter-spacing: -0.008em;
    }
    .active-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
      flex-shrink: 0;
      box-shadow: 0 0 0 4px var(--accent-ring);
    }
    .empty-state {
      margin-top: 18px;
      padding: 14px 16px;
      color: var(--text-dim);
      font-size: 13px;
      letter-spacing: -0.008em;
      text-align: center;
      background: var(--surface-2);
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-sm);
    }
  `],
})
export class ThemeSelectorComponent implements OnInit {
  @Input() availableFunds: FundMeta[] = [];
  @Output() themeChange = new EventEmitter<ThemeSpec | null>();

  constructor(public i18n: I18nService) {
    // Re-emit on language change so the run-row's "Strategy:" label flips too.
    effect(() => {
      this.i18n.lang();
      if (this.active) this.recompute();
    });
  }

  selectedFunds = new Set<string>();
  fundFilter = '';

  active: ThemeSpec | null = null;

  trackByCode(_i: number, f: FundMeta): string { return f.policy_code; }

  ngOnInit() {
    this.recompute();
  }

  toggleFund(code: string) {
    if (this.selectedFunds.has(code)) this.selectedFunds.delete(code);
    else this.selectedFunds.add(code);
    this.recompute();
  }

  clearSelection() {
    this.selectedFunds.clear();
    this.recompute();
  }

  filteredFunds(): FundMeta[] {
    const q = this.fundFilter.trim().toLowerCase();
    if (!q) return this.availableFunds;
    return this.availableFunds.filter(f =>
      f.policy_code.toLowerCase().includes(q) ||
      f.fund_name.toLowerCase().includes(q),
    );
  }

  recompute() {
    if (this.selectedFunds.size === 0) {
      this.active = null;
      this.themeChange.emit(null);
      return;
    }

    const fund_weights: Record<string, number> = {};
    this.selectedFunds.forEach(c => fund_weights[c] = 3);

    const picks = Array.from(this.selectedFunds);

    const t: ThemeSpec = {
      id: 'custom',
      name: this.i18n.t('strategy.customName'),
      summary: `Picks: ${picks.join(', ')}`,
      tag_weights: {},
      fund_weights,
      // No user-facing caps any more — DIY broker constraints from constraints.json
      // (R1-R12) still apply in tryAllocate. Setting these to extremes disables the
      // optional theme-level cap so bias picks aren't clipped by an invisible rule.
      max_equity_pct: 100,
      min_hedge_pct:  0,
      icon: 'custom',
      is_custom: true,
    };
    this.active = t;
    this.themeChange.emit(t);
  }
}
