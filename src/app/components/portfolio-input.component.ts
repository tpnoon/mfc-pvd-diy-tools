import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrentHolding, CurrentPortfolio, FundMeta } from '../models/types';
import { I18nService } from '../services/i18n.service';

interface FormRow {
  policy_code: string;
  current_proportion: number;
}

@Component({
  selector: 'app-portfolio-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="section-card">
      <h2 class="section-title">{{ i18n.t('portfolio.section') }}</h2>

      <!-- Portfolio totals -->
      <div class="totals-grid">
        <label class="field">
          <span class="field-label">{{ i18n.t('portfolio.totalAssets') }} <em class="req">{{ i18n.t('portfolio.required') }}</em></span>
          <div class="input-wrapper">
            <input
              type="text"
              inputmode="numeric"
              autocomplete="off"
              [ngModel]="totalAmountText"
              (ngModelChange)="onTHBInput($event)"
              (blur)="onTHBBlur()"
              placeholder="50,000"
              required />
            <span class="input-suffix">THB</span>
          </div>
        </label>

        <label class="field">
          <span class="field-label">{{ i18n.t('portfolio.ytdReturn') }} <em class="opt">{{ i18n.t('portfolio.optional') }}</em></span>
          <div class="input-wrapper">
            <input
              type="number"
              [(ngModel)]="ytdReturn"
              (ngModelChange)="applyDebounce()"
              step="0.01"
              placeholder="0.00" />
            <span class="input-suffix">%</span>
          </div>
        </label>
      </div>

      <!-- Holdings -->
      <div class="holdings-header">
        <h3>{{ i18n.t('portfolio.holdings') }}</h3>
        <span class="dim">{{ i18n.t('portfolio.holdingsHint') }}</span>
      </div>

      <table class="data-table input-table">
        <thead>
          <tr>
            <th>{{ i18n.t('portfolio.colPolicy') }}</th>
            <th style="width:120px">{{ i18n.t('portfolio.colProportion') }}</th>
            <th style="width:60px"></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows; let i = index; trackBy: trackByIndex">
            <td>
              <select [(ngModel)]="row.policy_code" (ngModelChange)="applyDebounce()">
                <option value="">{{ i18n.t('portfolio.selectFund') }}</option>
                <option *ngFor="let f of fundOptions" [value]="f.policy_code">
                  {{ f.policy_code }} — {{ i18n.fundName(f.policy_code, f.fund_name) }}
                </option>
              </select>
            </td>
            <td>
              <input
                type="number"
                [(ngModel)]="row.current_proportion"
                (ngModelChange)="applyDebounce()"
                min="0"
                max="100"
                step="1" />
            </td>
            <td>
              <button class="btn btn-danger btn-sm" (click)="removeRow(i)" [attr.aria-label]="i18n.t('portfolio.removeFund')">×</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="form-actions">
        <button class="btn btn-secondary" (click)="addRow()">{{ i18n.t('portfolio.addFund') }}</button>
        <span class="total-pct" [class.invalid]="!isTotalValid()">
          {{ i18n.t('portfolio.total') }} {{ totalPct() }}%
        </span>
        <span *ngIf="!isTotalValid()" class="hint-inline">
          {{ i18n.t('portfolio.adjustHint') }}
        </span>
        <span *ngIf="isTotalValid() && lastEmittedCount > 0" class="ok ok-inline">
          ✓ {{ lastEmittedCount }} {{ lastEmittedCount === 1 ? i18n.t('portfolio.activeHolding') : i18n.t('portfolio.activeHoldings') }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .btn-sm { padding: 4px 12px; font-size: 12px; }

    /* ----- Portfolio totals grid ----- */
    .totals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .field-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .field-label em {
      font-style: normal;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.08em;
      padding: 2px 7px;
      border-radius: var(--radius-pill);
      border: 1px solid transparent;
    }
    .field-label em.req {
      color: var(--danger-text);
      background: var(--danger-soft);
      border-color: var(--danger-border);
    }
    .field-label em.opt {
      color: var(--text-dim);
      background: var(--surface-sunken);
      border-color: var(--border);
    }
    .input-wrapper {
      position: relative;
      display: block;
    }
    .input-wrapper input {
      width: 100%;
      padding-right: 50px;
      font-variant-numeric: tabular-nums;
    }
    .input-suffix {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.04em;
      color: var(--text-dim);
    }

    /* ----- Holdings ----- */
    .holdings-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 10px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
    }
    .holdings-header h3 { color: var(--text); }
    .input-table select { width: 100%; }
    .input-table input { width: 100%; font-variant-numeric: tabular-nums; }

    .form-actions {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 14px;
      flex-wrap: wrap;
    }
    .total-pct {
      font-weight: 600;
      color: var(--success);
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }
    .total-pct.invalid { color: var(--danger); }
    .hint-inline {
      color: var(--text-muted);
      font-size: 12.5px;
      letter-spacing: -0.008em;
    }
    .ok-inline {
      color: var(--success);
      font-size: 12.5px;
      font-weight: 500;
      letter-spacing: -0.008em;
    }
  `],
})
export class PortfolioInputComponent implements OnInit, OnDestroy {
  @Input() fundOptions: FundMeta[] = [];
  @Output() portfolioChange = new EventEmitter<CurrentPortfolio>();

  constructor(public i18n: I18nService) {}

  totalAmount: number | null = 50000;
  ytdReturn: number | null = null;

  totalAmountText = '';

  rows: FormRow[] = [
    { policy_code: 'MPF02', current_proportion: 60 },
    { policy_code: 'MPF03', current_proportion: 20 },
    { policy_code: 'MPF06', current_proportion: 20 },
  ];
  lastEmittedCount = 0;

  private applyTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly DEBOUNCE_MS = 250;

  private static readonly thbFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  ngOnInit() {
    this.totalAmountText = this.formatTHB(this.totalAmount);
    this.apply();
  }

  ngOnDestroy() {
    if (this.applyTimer) {
      clearTimeout(this.applyTimer);
      this.applyTimer = null;
    }
  }

  trackByIndex(i: number): number { return i; }

  formatTHB(v: number | null | undefined): string {
    if (v == null || Number.isNaN(v)) return '';
    return PortfolioInputComponent.thbFormatter.format(v);
  }

  parseTHB(s: string): number | null {
    if (s == null) return null;
    const cleaned = String(s).replace(/[^\d.-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  onTHBInput(text: string) {
    this.totalAmountText = text;
    this.totalAmount = this.parseTHB(text);
    this.applyDebounce();
  }

  onTHBBlur() {
    this.totalAmountText = this.formatTHB(this.totalAmount);
  }

  addRow() {
    this.rows.push({ policy_code: '', current_proportion: 0 });
    this.applyDebounce();
  }
  removeRow(i: number) {
    this.rows.splice(i, 1);
    this.applyDebounce();
  }

  totalPct(): number {
    return this.rows.reduce((a, b) => a + (Number(b.current_proportion) || 0), 0);
  }

  isTotalValid(): boolean {
    const t = this.totalPct();
    return t >= 99.5 && t <= 100.5 && this.rows.every(r => r.policy_code && r.current_proportion > 0);
  }

  applyDebounce() {
    if (this.applyTimer) clearTimeout(this.applyTimer);
    this.applyTimer = setTimeout(() => this.apply(), PortfolioInputComponent.DEBOUNCE_MS);
  }

  private apply() {
    if (!this.totalAmount || this.totalAmount <= 0) return;
    if (!this.isTotalValid()) return;

    const holdings: CurrentHolding[] = this.rows
      .filter(r => r.policy_code && r.current_proportion > 0)
      .map(r => ({
        policy_code: r.policy_code,
        policy_name: r.policy_code,
        current_proportion: Number(r.current_proportion),
        total_amount: this.totalAmount! * (Number(r.current_proportion) / 100),
      }));

    const portfolio: CurrentPortfolio = {
      total_amount: this.totalAmount,
      holdings,
    };
    if (this.ytdReturn != null) {
      portfolio.ytd_return = Number(this.ytdReturn);
    }

    this.lastEmittedCount = holdings.length;
    this.portfolioChange.emit(portfolio);
  }
}
