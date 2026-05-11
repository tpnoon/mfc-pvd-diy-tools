import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart } from 'chart.js';
import {
  AnalysisResult,
  ConstraintCheck,
  ConstraintRule,
  CurrentPortfolio,
  FundMeta,
  ReasonToken,
  RecommendedAllocation,
  TechnicalSnapshot,
} from '../models/types';
import { ThemeService } from '../services/theme.service';
import { AnalysisEngineService, rsiBadgeClass } from '../services/analysis-engine.service';
import { I18nService } from '../services/i18n.service';
import { cssVar, ensureChartsRegistered } from '../utils/chart.util';

ensureChartsRegistered();

@Component({
  selector: 'app-analysis-output',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <ng-container *ngIf="result">
      <!-- Customized Portfolio -->
      <div class="section-card">
        <h2 class="section-title">
          {{ i18n.t('analysis.customized') }} <span class="title-tag">{{ i18n.t('analysis.customizedTag') }}</span>
        </h2>
        <p class="section-desc">{{ i18n.t('analysis.customizedDesc') }}</p>
        <!-- Portfolio Snapshot inside Customized Portfolio -->
        <div class="snapshot-strip" *ngIf="portfolio">
          <div class="snapshot-cell">
            <span class="snapshot-label">{{ i18n.t('analysis.snapshotTotal') }}</span>
            <span class="snapshot-value">฿{{ formatTHB(portfolio.total_amount) }}</span>
          </div>
          <div class="snapshot-cell" *ngIf="portfolio.ytd_return != null">
            <span class="snapshot-label">{{ i18n.t('analysis.snapshotYTD') }}</span>
            <span class="snapshot-value" [ngClass]="portfolio.ytd_return >= 0 ? 'positive' : 'negative'">
              {{ portfolio.ytd_return >= 0 ? '+' : '' }}{{ portfolio.ytd_return }}%
            </span>
          </div>
          <div class="snapshot-cell snapshot-profit">
            <span class="snapshot-label">{{ i18n.t('analysis.snapshotProfit') }}</span>
            <span class="snapshot-value" [ngClass]="expectedReturnTHB() >= 0 ? 'positive' : 'negative'">
              {{ expectedReturnTHB() >= 0 ? '+' : '−' }}฿{{ formatTHB(absExpectedReturnTHB()) }}
            </span>
          </div>
        </div>

        <div *ngIf="totalAllocatedPct() !== 100" class="alloc-warn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span *ngIf="totalAllocatedPct() < 100">
            {{ i18n.t('analysis.allocSum') }} <strong>{{ totalAllocatedPct() }}%</strong> —
            {{ i18n.t('analysis.shortBy') }} <strong>{{ 100 - totalAllocatedPct() }}%</strong>.
            {{ i18n.t('analysis.editOrAdd') }}
          </span>
          <span *ngIf="totalAllocatedPct() > 100">
            {{ i18n.t('analysis.allocSum') }} <strong>{{ totalAllocatedPct() }}%</strong> —
            {{ i18n.t('analysis.overBy') }} <strong>{{ totalAllocatedPct() - 100 }}%</strong>.
            {{ i18n.t('analysis.trim') }}
          </span>
        </div>
        <div class="two-col">
          <div class="chart-box"><canvas #allocChart></canvas></div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>{{ i18n.t('analysis.colFund') }}</th><th class="th-pct">{{ i18n.t('analysis.colPct') }}</th><th>{{ i18n.t('analysis.colAvg4yr') }}</th><th>{{ i18n.t('analysis.colRsi') }}</th><th>{{ i18n.t('analysis.colEntry') }}</th><th>{{ i18n.t('analysis.colFib') }}</th><th>{{ i18n.t('analysis.colRole') }}</th><th>{{ i18n.t('analysis.colReason') }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let r of editedAllocations; let i = index; trackBy: trackByCode">
                  <td><strong>{{ r.code }}</strong><br><small>{{ i18n.fundName(r.code, r.name) }}</small></td>
                  <td class="center pct-cell">
                    <div class="pct-input-wrap">
                      <input
                        type="number"
                        class="pct-input"
                        [ngModel]="r.pct"
                        (ngModelChange)="updatePct(i, $event)"
                        min="0"
                        max="100"
                        step="1"
                        aria-label="Adjust percentage" />
                      <span class="pct-suffix">%</span>
                    </div>
                  </td>
                  <td>
                    <span *ngIf="r.avg_4yr !== null" [ngClass]="r.avg_4yr > 0 ? 'positive' : 'negative'">
                      {{ r.avg_4yr > 0 ? '+' : '' }}{{ r.avg_4yr }}%
                    </span>
                    <span *ngIf="r.avg_4yr === null" class="dim">N/A</span>
                  </td>
                  <td>
                    <span class="rsi-badge" [ngClass]="rsiClass(r.rsi)">
                      {{ r.rsi !== null ? r.rsi : 'N/A' }}
                    </span>
                  </td>
                  <td><span class="tag tag-blue">{{ i18n.t('entry.' + r.entry_status) }}</span></td>
                  <td><small>{{ r.fib_level }}</small></td>
                  <td><span class="tag" [ngClass]="r.role === 'hedge' ? 'tag-gold' : r.role === 'conservative' ? 'tag-blue' : 'tag-green'">{{ i18n.t('role.' + r.role) }}</span></td>
                  <td><small>{{ formatReason(r.reason) }}</small></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>{{ i18n.t('analysis.totalLabel') }}</strong></td>
                  <td class="center">
                    <strong [ngClass]="totalAllocatedPct() === 100 ? 'positive' : 'negative'">
                      {{ totalAllocatedPct() }}%
                    </strong>
                  </td>
                  <td colspan="6" class="dim">
                    <span *ngIf="totalAllocatedPct() !== 100">
                      {{ i18n.t('analysis.adjustTo100') }}
                      {{ totalAllocatedPct() > 100 ? i18n.t('analysis.overBy') + ' ' + (totalAllocatedPct() - 100) : i18n.t('analysis.shortBy') + ' ' + (100 - totalAllocatedPct()) }}%.
                    </span>
                    <span *ngIf="totalAllocatedPct() === 100" class="positive">{{ i18n.t('analysis.totalsAt100') }}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
            <div class="return-row" [ngClass]="liveExpectedReturn >= 0 ? 'positive-bg' : 'negative-bg'">
              <span class="big-number">{{ liveExpectedReturn >= 0 ? '+' : '' }}{{ liveExpectedReturn }}%</span>
              <span>{{ i18n.t('analysis.expectedPerYear') }}</span>
            </div>
          </div>
        </div>

        <h3 class="sub-title">{{ i18n.t('analysis.compliance') }}</h3>
        <div class="compliance-grid">
          <div *ngFor="let c of liveCompliance"
               class="compliance-item"
               [ngClass]="c.status === 'ok' ? 'pass' : 'fail'">
            <div class="compliance-row">
              <span class="compliance-status">{{ c.status === 'ok' ? i18n.t('analysis.pass') : i18n.t('analysis.fail') }}</span>
              <span class="compliance-label">{{ i18n.constraintLabel(c.id, c.label) }}</span>
              <span class="compliance-usage">{{ c.used }}% / {{ c.max }}%</span>
            </div>
            <div class="compliance-bar-bg" role="progressbar"
                 [attr.aria-valuenow]="c.used"
                 [attr.aria-valuemin]="0"
                 [attr.aria-valuemax]="c.max">
              <div class="compliance-bar-fill"
                   [style.width.%]="complianceFillPct(c.used, c.max)"
                   [class.fill-fail]="c.status !== 'ok'"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Comparison -->
      <div class="section-card">
        <h2 class="section-title">{{ i18n.t('analysis.compareTitle') }}</h2>
        <div class="two-col">
          <div class="chart-box"><canvas #compareChart></canvas></div>
          <table class="compare-table">
            <thead><tr><th>{{ i18n.t('analysis.metric') }}</th><th>{{ i18n.t('analysis.current') }}</th><th>{{ i18n.t('analysis.customized2') }}</th></tr></thead>
            <tbody>
              <tr>
                <td>
                  {{ i18n.t('analysis.expectedReturn') }}
                  <small *ngIf="currentReturnSource() === 'ytd'" class="metric-source">{{ i18n.t('analysis.fromYTD') }}</small>
                  <small *ngIf="currentReturnSource() === 'holdings'" class="metric-source">{{ i18n.t('analysis.fromHoldings') }}</small>
                </td>
                <td [ngClass]="currentExpectedReturn() >= 2 ? 'positive' : 'negative'">
                  {{ currentExpectedReturn() >= 0 ? '+' : '' }}{{ currentExpectedReturn() }}%
                </td>
                <td [ngClass]="liveExpectedReturn >= 2 ? 'positive' : 'negative'">
                  {{ liveExpectedReturn >= 0 ? '+' : '' }}{{ liveExpectedReturn }}%
                </td>
              </tr>
              <tr><td>{{ i18n.t('analysis.riskProfile') }}</td><td>{{ result.comparison.old_risk }}</td><td>{{ liveRisk }}</td></tr>
              <tr><td>{{ i18n.t('analysis.inflationHedge') }}</td>
                <td [ngClass]="result.comparison.old_inflation === 'Weak' ? 'negative' : 'positive'">{{ result.comparison.old_inflation }}</td>
                <td [ngClass]="liveInflation === 'Weak' ? 'negative' : 'positive'">{{ liveInflation }}</td></tr>
              <tr><td>{{ i18n.t('analysis.themeAlignment') }}</td>
                <td [ngClass]="result.comparison.old_theme_alignment <= 0 ? 'negative' : 'positive'">{{ result.comparison.old_theme_alignment }}</td>
                <td [ngClass]="liveThemeAlignment <= 0 ? 'negative' : 'positive'">{{ liveThemeAlignment }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Switch Criteria -->
      <div class="section-card">
        <h2 class="section-title">{{ i18n.t('analysis.switchTitle') }}</h2>
        <div class="criteria-grid">
          <div *ngFor="let c of result.switch_criteria" class="criteria-card">
            <div class="criteria-icon">
              <img [src]="iconUrl(c.icon)" [alt]="c.icon || c.id" />
            </div>
            <div>
              <h4>{{ i18n.t('switch.' + c.id + '.condition') }}</h4>
              <p>{{ i18n.t('switch.' + c.id + '.action') }}</p>
            </div>
          </div>
        </div>
      </div>

    </ng-container>
  `,
  styles: [`
    .th-pct { width: 96px; }
    .pct-cell { padding-top: 6px !important; padding-bottom: 6px !important; }
    .pct-input-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
    }
    .pct-input {
      width: 76px;
      padding: 6px 26px 6px 10px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.005em;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--text);
      background: var(--surface);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      appearance: textfield;
      -moz-appearance: textfield;
    }
    .pct-input::-webkit-outer-spin-button,
    .pct-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .pct-input:hover { border-color: var(--text-dim); }
    .pct-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-ring);
      outline: none;
    }
    .pct-suffix {
      position: absolute;
      right: 8px;
      pointer-events: none;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-dim);
    }
    tfoot td {
      border-bottom: none !important;
      border-top: 1px solid var(--border-strong);
      padding-top: 12px !important;
    }

    .alloc-warn {
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 12px 14px;
      margin-bottom: 14px;
      background: var(--warning-soft);
      color: var(--warning-text);
      border: 1px solid var(--warning-border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      letter-spacing: -0.008em;
      line-height: 1.45;
    }
    .alloc-warn svg { flex-shrink: 0; }
    .alloc-warn strong { font-weight: 600; }

    .return-row {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-top: 18px;
      padding: 12px 16px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
    }
    .return-row.positive-bg {
      background: var(--success-soft);
      color: var(--success-text);
      border-color: var(--success-border);
    }
    .return-row.negative-bg {
      background: var(--danger-soft);
      color: var(--danger-text);
      border-color: var(--danger-border);
    }
    .big-number {
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.022em;
      font-variant-numeric: tabular-nums;
    }

    /* Snapshot strip inside Customized Portfolio */
    .snapshot-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
      padding: 14px 16px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .snapshot-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      position: relative;
    }
    .snapshot-cell + .snapshot-cell::before {
      content: '';
      position: absolute;
      left: -6px;
      top: 4px;
      bottom: 4px;
      width: 1px;
      background: var(--border);
    }
    @media (max-width: 720px) {
      .snapshot-cell + .snapshot-cell::before { display: none; }
    }
    .snapshot-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .snapshot-value {
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.014em;
      color: var(--text);
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .snapshot-cell.snapshot-profit .snapshot-value.positive { color: var(--success); }
    .snapshot-cell.snapshot-profit .snapshot-value.negative { color: var(--danger); }
    .two-col { display: grid; grid-template-columns: 340px 1fr; gap: 28px; align-items: start; }
    @media (max-width: 800px) { .two-col { grid-template-columns: 1fr; } }
    .chart-box { height: 320px; position: relative; }
    .sub-title { margin-top: 24px; margin-bottom: 12px; color: var(--text); }
    .compliance-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
    .compliance-item {
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
      letter-spacing: -0.008em;
      border: 1px solid transparent;
    }
    .compliance-item.pass { background: var(--success-soft); color: var(--success-text); border-color: var(--success-border); }
    .compliance-item.fail { background: var(--danger-soft);  color: var(--danger-text);  border-color: var(--danger-border); }
    .compliance-row {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .compliance-status {
      font-weight: 600;
      min-width: 44px;
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .compliance-label { flex: 1; }
    .compliance-usage { font-weight: 600; font-variant-numeric: tabular-nums; flex-shrink: 0; }
    .compliance-bar-bg {
      height: 4px;
      background: rgba(0, 0, 0, 0.06);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }
    :root[data-theme="dark"] .compliance-bar-bg { background: rgba(255, 255, 255, 0.10); }
    .compliance-bar-fill {
      height: 100%;
      background: var(--success);
      border-radius: var(--radius-pill);
      transition: width 400ms var(--ease-out);
    }
    .compliance-bar-fill.fill-fail { background: var(--danger); }
    .metric-source {
      display: inline-block;
      margin-left: 8px;
      padding: 1px 8px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted);
      background: var(--surface-sunken);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      vertical-align: middle;
    }
    .compare-table { width: 100%; border-collapse: collapse; font-size: 14px; letter-spacing: -0.008em; }
    .compare-table th, .compare-table td { padding: 12px; border-bottom: 1px solid var(--border); text-align: left; }
    .compare-table th {
      background: transparent;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid var(--border-strong);
    }
    .criteria-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .criteria-card {
      display: flex;
      gap: 14px;
      padding: 16px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: border-color 150ms var(--ease);
    }
    .criteria-card:hover { border-color: var(--border-strong); }
    .criteria-icon img { width: 30px; height: 30px; }
    .criteria-card h4 { font-size: 14px; margin-bottom: 5px; color: var(--text); }
    .criteria-card p {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
      letter-spacing: -0.008em;
    }
    .table-wrap { overflow-x: auto; }
    .title-tag {
      font-size: 13px;
      font-weight: 500;
      letter-spacing: -0.006em;
      color: var(--text-muted);
      margin-left: 6px;
    }
  `],
})
export class AnalysisOutputComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() result: AnalysisResult | null = null;
  @Input() portfolio: CurrentPortfolio | null = null;
  @Input() funds: FundMeta[] = [];
  @Input() technicals: TechnicalSnapshot[] = [];
  @Input() constraints: ConstraintRule[] = [];
  @Input() avgReturnByCode = new Map<string, number>();
  @Input() currentHoldings: { code: string; pct: number }[] = [];
  @ViewChild('allocChart') allocChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('compareChart') compareChartRef?: ElementRef<HTMLCanvasElement>;

  // Editable copy of the engine-generated allocation. Reset whenever a new `result` arrives.
  editedAllocations: RecommendedAllocation[] = [];

  // Live-recomputed metrics (driven by editedAllocations).
  liveCompliance: ConstraintCheck[] = [];
  liveExpectedReturn = 0;
  liveThemeAlignment = 0;
  liveInflation: 'Weak' | 'Moderate' | 'Strong' = 'Weak';
  liveRisk = 'N/A';

  private readonly thbFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // View-init flag + render scheduling — single source of truth so theme toggles,
  // result changes, and per-row % edits all flow through one render path.
  private viewInited = false;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;

  trackByCode(_i: number, r: RecommendedAllocation): string { return r.code; }

  formatTHB(v: number | null | undefined): string {
    if (v == null || Number.isNaN(v)) return '0';
    return this.thbFormatter.format(Math.round(v));
  }

  totalAssets(): number {
    return this.portfolio?.total_amount ?? 0;
  }

  expectedReturnTHB(): number {
    return Math.round(this.totalAssets() * this.liveExpectedReturn) / 100;
  }

  absExpectedReturnTHB(): number {
    return Math.abs(this.expectedReturnTHB());
  }

  /**
   * Comparison "Current" expected return — prefers the user-supplied YTD Return
   * when present, otherwise the engine's allocation-weighted average over the
   * user's actual holdings.
   */
  currentExpectedReturn(): number {
    if (this.portfolio?.ytd_return != null) return this.portfolio.ytd_return;
    return this.result?.comparison.old_return ?? 0;
  }

  currentReturnSource(): 'ytd' | 'holdings' {
    return this.portfolio?.ytd_return != null ? 'ytd' : 'holdings';
  }

  complianceFillPct(used: number, max: number): number {
    if (!max || max <= 0) return 0;
    return Math.min(100, (used / max) * 100);
  }

  totalAllocatedPct(): number {
    return this.editedAllocations.reduce((a, r) => a + (Number(r.pct) || 0), 0);
  }

  updatePct(idx: number, newPct: number) {
    // Round to integer percent — matches the input's step="1" intent and prevents
    // fractional drift (e.g., three rows of 33.33 missing 100% by 0.01).
    const n = Number(newPct);
    const sanitized = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
    this.editedAllocations = this.editedAllocations.map((r, i) =>
      i === idx ? { ...r, pct: sanitized } : r,
    );
    // Metrics update synchronously so compliance/return reflect the change at once;
    // chart redraw is debounced so rapid typing doesn't thrash the canvas.
    this.recomputeLiveMetrics();
    this.scheduleRender(false);
  }

  private resetEditedFromResult() {
    if (!this.result) {
      this.editedAllocations = [];
      this.recomputeLiveMetrics();
      return;
    }
    // A4 — preserve user's % overrides when the engine's fund set is unchanged.
    // This keeps edits stable across cap tweaks (max equity, min hedge) and
    // re-runs that don't actually change the recommended portfolio's codes.
    const newCodes = new Set(this.result.recommended.map(r => r.code));
    const oldCodes = new Set(this.editedAllocations.map(r => r.code));
    const sameSet = oldCodes.size === newCodes.size
      && [...oldCodes].every(c => newCodes.has(c))
      && this.editedAllocations.length > 0;

    if (sameSet) {
      // Keep user pct, refresh metadata (avg_4yr, rsi, role, reason — these
      // can change as the engine re-scores even when the picks stay the same).
      const prevPctByCode = new Map(this.editedAllocations.map(r => [r.code, r.pct]));
      this.editedAllocations = this.result.recommended.map(fresh => ({
        ...fresh,
        pct: prevPctByCode.get(fresh.code) ?? fresh.pct,
      }));
    } else {
      this.editedAllocations = this.result.recommended.map(r => ({ ...r }));
    }
    this.recomputeLiveMetrics();
  }

  private recomputeLiveMetrics() {
    if (!this.result) {
      this.liveCompliance = [];
      this.liveExpectedReturn = 0;
      this.liveThemeAlignment = 0;
      this.liveInflation = 'Weak';
      this.liveRisk = 'N/A';
      return;
    }
    const allocs = this.editedAllocations.map(r => ({ code: r.code, pct: Number(r.pct) || 0 }));
    const m = this.engine.recomputeForAllocations(
      allocs,
      this.result.theme,
      this.funds,
      this.technicals,
      this.constraints,
      this.avgReturnByCode,
    );
    this.liveExpectedReturn = m.expectedReturn;
    this.liveThemeAlignment = m.themeAlignment;
    this.liveInflation = m.inflation;
    this.liveRisk = m.risk;
    this.liveCompliance = m.compliance;
  }

  private allocChart?: Chart;
  private compareChart?: Chart;

  constructor(
    private themeService: ThemeService,
    private engine: AnalysisEngineService,
    public i18n: I18nService,
  ) {
    // Subscribe to both theme + lang signals so chart canvases redraw on either change.
    effect(() => {
      this.themeService.theme();
      this.i18n.lang();
      this.scheduleRender(true);
    });
  }

  ngAfterViewInit() {
    this.viewInited = true;
    this.scheduleRender(true);
  }

  ngOnDestroy() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.allocChart?.destroy();
    this.compareChart?.destroy();
    this.allocChart = undefined;
    this.compareChart = undefined;
  }

  ngOnChanges(c: SimpleChanges) {
    if (c['result']) {
      this.resetEditedFromResult();
    } else {
      this.recomputeLiveMetrics();
    }
    this.scheduleRender(true);
  }

  /**
   * Single chart-redraw entry point.
   * `immediate=true` (theme flip / new result / view init) renders on the next
   * animation frame. `immediate=false` (rapid edits) waits 150ms so a burst of
   * keystrokes coalesces into one chart rebuild.
   */
  private scheduleRender(immediate: boolean) {
    if (!this.viewInited) return;
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (immediate) {
      requestAnimationFrame(() => this.renderCharts());
    } else {
      this.renderTimer = setTimeout(() => {
        requestAnimationFrame(() => this.renderCharts());
      }, 150);
    }
  }

  rsiClass(rsi: number | null | undefined): string {
    return rsiBadgeClass(rsi);
  }

  /** Compose a human reason string from structured tokens, translated for the current language. */
  formatReason(tokens: ReasonToken[] | undefined): string {
    if (!tokens || tokens.length === 0) return '';
    return tokens.map(tok => {
      switch (tok.kind) {
        case 'user_pick':       return this.i18n.tp('reason.user_pick',   { n: tok.n });
        case 'theme_match':     return this.i18n.tp('reason.theme_match', { n: tok.n });
        case 'rsi_base':        return this.i18n.tp('reason.rsi_base',    { rsi: tok.rsi });
        case 'technical':       return this.i18n.tp('reason.technical',   { signal: tok.signal });
        case 'inflation_hedge': return this.i18n.t('reason.inflation_hedge');
        case 'diversifier':     return this.i18n.t('reason.diversifier');
      }
    }).join(' · ');
  }

  iconUrl(icon: string | undefined): string {
    const map: Record<string, string> = {
      profit: '1f4c8',
      loss: '1f4c9',
      peace: '262e',
      rate: '1f3e6',
      bubble: '1f4a5',
      oil: '26fd',
      ai: '1f916',
      war: '2694',
      shield: '1f6e1',
    };
    const code = (icon && map[icon]) || '1f4cb';
    return `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg`;
  }

  private static readonly CHART_PALETTE: readonly string[] = [
    '#4F46E5','#10B981','#F59E0B','#0EA5E9','#F43F5E','#8B5CF6','#14B8A6','#F97316','#64748B','#84CC16',
  ];

  private renderCharts() {
    if (!this.result) return;
    const palette = AnalysisOutputComponent.CHART_PALETTE;
    const titleColor = cssVar('--text')       || '#0F172A';
    const tickColor  = cssVar('--text-muted') || '#475569';
    const gridColor  = cssVar('--border')     || '#E5E7EB';
    const surface    = cssVar('--surface')    || '#FFFFFF';
    const accent     = cssVar('--accent')     || '#4F46E5';
    const dim        = cssVar('--text-dim')   || '#94A3B8';

    if (this.allocChartRef) {
      this.allocChart?.destroy();
      const allocs = this.editedAllocations.length ? this.editedAllocations : this.result.recommended;
      this.allocChart = new Chart(this.allocChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: allocs.map(r => `${r.code} ${r.pct}%`),
          datasets: [{ data: allocs.map(r => r.pct), backgroundColor: palette, borderColor: surface, borderWidth: 2 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: this.i18n.t('chart.customizedAllocation'), color: titleColor, font: { size: 13, weight: 600 } },
            legend: { labels: { color: tickColor, font: { size: 11 } } },
          },
        },
      });
    }

    if (this.compareChartRef) {
      this.compareChart?.destroy();
      const oldMap = new Map(this.currentHoldings.map(h => [h.code, h.pct]));
      const newAllocs = this.editedAllocations.length ? this.editedAllocations : this.result.recommended;
      const newMap = new Map(newAllocs.map(r => [r.code, r.pct]));
      const codes = Array.from(new Set([...oldMap.keys(), ...newMap.keys()]));
      this.compareChart = new Chart(this.compareChartRef.nativeElement, {
        type: 'bar',
        data: {
          labels: codes,
          datasets: [
            { label: this.i18n.t('chart.currentPct'),    data: codes.map(c => oldMap.get(c) || 0), backgroundColor: dim,    borderRadius: 4 },
            { label: this.i18n.t('chart.customizedPct'), data: codes.map(c => newMap.get(c) || 0), backgroundColor: accent, borderRadius: 4 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { display: true, text: this.i18n.t('chart.allocationCompare'), color: titleColor, font: { size: 13, weight: 600 } },
            legend: { labels: { color: tickColor, font: { size: 11 } } },
          },
          scales: {
            x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { display: false } },
            y: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
          },
        },
      });
    }
  }
}
