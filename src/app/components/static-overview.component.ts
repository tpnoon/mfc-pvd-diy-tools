import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Chart, ChartConfiguration } from 'chart.js';
import { forkJoin } from 'rxjs';
import { ThemeService } from '../services/theme.service';
import { rsiBadgeClass } from '../services/analysis-engine.service';
import { I18nService } from '../services/i18n.service';
import { cssVar, ensureChartsRegistered } from '../utils/chart.util';
import {
  CombinedDataDoc,
  ConstraintsDoc,
  PolicyMonthly,
  RankingDoc,
  RankingItem,
  TechnicalDoc,
} from '../models/types';

ensureChartsRegistered();

@Component({
  selector: 'app-static-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <ng-container *ngIf="loaded">

      <!-- ===== POLICY PERFORMANCE GRAPH ===== -->
      <div class="section-card graph-card">
        <h2 class="section-title">{{ i18n.t('static.graph.title') }}</h2>
        <p class="section-desc">{{ i18n.t('static.graph.desc') }}</p>

        <div class="controls">
          <button class="btn btn-secondary" (click)="selectAll()">{{ i18n.t('static.graph.selectAll') }}</button>
          <button class="btn btn-secondary" (click)="deselectAll()">{{ i18n.t('static.graph.deselectAll') }}</button>
        </div>

        <div class="graph-content">
          <aside class="policy-list">
            <h3>{{ i18n.t('static.graph.policies') }}</h3>
            <label *ngFor="let policy of policyList; let i = index" [class.active]="isSelected(policy)">
              <input type="checkbox" [checked]="isSelected(policy)" (change)="togglePolicy(policy)" />
              <span class="policy-name">{{ policy }}</span>
              <span class="color-indicator" [style.background-color]="colors[i % colors.length]"></span>
            </label>
          </aside>
          <div class="chart-area">
            <canvas #chartCanvas></canvas>
          </div>
        </div>
      </div>

      <!-- ===== TECHNICAL ANALYSIS RANKING ===== -->
      <div class="section-card" *ngIf="technical">
        <h2 class="section-title">{{ i18n.t('static.tech.title') }}</h2>
        <p class="section-desc">{{ i18n.t('static.tech.desc') }}</p>

        <div class="indicator-legend">
          <div class="legend-item"><span class="legend-dot" style="background:#4F46E5"></span> MA (Moving Average 6 &amp; 12)</div>
          <div class="legend-item"><span class="legend-dot" style="background:#8B5CF6"></span> MACD</div>
          <div class="legend-item"><span class="legend-dot" style="background:#F59E0B"></span> RSI-14</div>
          <div class="legend-item"><span class="legend-dot" style="background:#10B981"></span> Fibonacci Retracement</div>
        </div>

        <div class="table-scroll">
          <table class="data-table technical-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fund</th>
                <th>Last</th>
                <th>MA-6</th>
                <th>MA-12</th>
                <th>MA Signal</th>
                <th>MACD</th>
                <th>Hist</th>
                <th>RSI</th>
                <th>Fib Level</th>
                <th>Score</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of technical.policies; let i = index">
                <td>
                  <span class="rank-badge"
                        [ngClass]="i < 3 ? 'rank-top3' : p.total_score >= 3 ? 'rank-green' : p.total_score >= 0 ? 'rank-yellow' : 'rank-red'">
                    #{{ i + 1 }}
                  </span>
                </td>
                <td><strong>{{ p.policy_code }}</strong><br><small>{{ i18n.fundName(p.policy_code, p.fund_name || '') }}</small></td>
                <td><span [ngClass]="p.last_value > 0 ? 'positive' : 'negative'">{{ p.last_value?.toFixed(2) }}</span></td>
                <td>{{ p.ma6?.toFixed(2) ?? 'N/A' }}</td>
                <td>{{ p.ma12?.toFixed(2) ?? 'N/A' }}</td>
                <td>
                  <span class="tag" [ngClass]="p.ma_score > 0 ? 'tag-green' : p.ma_score < 0 ? 'tag-red' : 'tag-blue'">
                    {{ p.ma_signal }}
                  </span>
                </td>
                <td>{{ p.macd_line?.toFixed(2) ?? 'N/A' }}</td>
                <td>
                  <span [ngClass]="p.macd_histogram > 0 ? 'positive' : 'negative'">
                    {{ p.macd_histogram?.toFixed(2) ?? 'N/A' }}
                  </span>
                </td>
                <td>
                  <span class="rsi-badge" [ngClass]="getRsiClass(p.rsi)">
                    {{ p.rsi !== null ? p.rsi.toFixed(1) : 'N/A' }}
                  </span>
                </td>
                <td><small>{{ p.fib_current_level }}</small></td>
                <td>
                  <div class="score-cell">
                    <span class="score-num"
                          [ngClass]="p.total_score > 0 ? 'positive' : p.total_score < 0 ? 'negative' : ''">
                      {{ p.total_score }}/{{ p.max_score }}
                    </span>
                    <div class="score-bar-bg">
                      <div class="score-bar-fill"
                           [style.width.%]="getScoreBarWidth(p.total_score)"
                           [ngClass]="p.total_score >= 3 ? 'bar-green' : p.total_score >= 0 ? 'bar-yellow' : 'bar-red'"></div>
                    </div>
                  </div>
                </td>
                <td><div class="signal-badge" [ngClass]="getSignalClass(p.signal)">{{ p.signal }}</div></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="signal-guide">
          <h3>{{ i18n.t('static.tech.signalGuide') }}</h3>
          <div class="signal-guide-grid">
            <div><span class="signal-badge signal-strong-buy">Strong Buy</span> {{ i18n.t('static.tech.guide.strongBuy') }}</div>
            <div><span class="signal-badge signal-buy">Buy</span> {{ i18n.t('static.tech.guide.buy') }}</div>
            <div><span class="signal-badge signal-hold">Hold</span> {{ i18n.t('static.tech.guide.hold') }}</div>
            <div><span class="signal-badge signal-sell">Sell</span> {{ i18n.t('static.tech.guide.sell') }}</div>
            <div><span class="signal-badge signal-strong-sell">Strong Sell</span> {{ i18n.t('static.tech.guide.strongSell') }}</div>
          </div>
        </div>
      </div>

      <!-- ===== BROKER CONSTRAINTS ===== -->
      <div class="section-card" *ngIf="constraints">
        <h2 class="section-title">{{ i18n.t('static.constraints.title') }}</h2>
        <p class="section-desc">{{ i18n.t('static.constraints.desc') }}</p>
        <div class="constraints-grid">
          <div class="constraint-item" *ngFor="let r of constraints.rules">
            <div class="constraint-funds">
              <span class="tag tag-blue" *ngFor="let f of r.funds">{{ f }}</span>
            </div>
            <div class="constraint-bar-wrap">
              <div class="constraint-label">{{ i18n.constraintLabel(r.id, r.label) }}</div>
              <div class="constraint-bar-bg">
                <div class="constraint-bar-fill" [style.width.%]="r.max_pct"></div>
              </div>
              <div class="constraint-max">MAX {{ r.max_pct }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== POLICY RANKINGS ===== -->
      <div class="section-card" *ngIf="ranking?.length">
        <h2 class="section-title">{{ i18n.t('static.rankings.title') }}</h2>
        <p class="section-desc">{{ i18n.t('static.rankings.desc') }}</p>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Policy</th>
                <th>Fund Name</th>
                <th>Category</th>
                <th>Avg Return (4y)</th>
                <th>YTD</th>
                <th>Risk</th>
                <th>Rec</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of ranking; let i = index">
                <td>
                  <span class="rank-badge"
                        [ngClass]="i < 3 ? 'rank-top3' : item.avg_return > 5 ? 'rank-green' : item.avg_return > 0 ? 'rank-yellow' : 'rank-red'">
                    #{{ i + 1 }}
                  </span>
                </td>
                <td><strong>{{ item.policy_code }}</strong></td>
                <td><small>{{ i18n.fundName(item.policy_code, item.fund_name) }}</small></td>
                <td><small>{{ i18n.category(item.group_name) }}</small></td>
                <td><span [ngClass]="item.avg_return > 0 ? 'positive' : 'negative'">{{ item.avg_return.toFixed(2) }}%</span></td>
                <td><span [ngClass]="parseFloatSafe(item.yield_ytd) > 0 ? 'positive' : 'negative'">{{ item.yield_ytd }}%</span></td>
                <td>{{ item.risk_level }}/5</td>
                <td>
                  <div class="recommendation" [ngClass]="getRecommendationClass(item.recommendation)">
                    {{ i18n.recommendation(item.recommendation) }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </ng-container>
  `,
  styles: [`
    /* ----- graph ----- */
    .graph-card .controls { display: flex; gap: 8px; margin-bottom: 16px; }

    .graph-content {
      display: grid;
      grid-template-columns: 232px 1fr;
      gap: 20px;
      align-items: stretch;
    }
    .policy-list {
      background: var(--surface-sunken);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
      max-height: 500px;
      overflow-y: auto;
    }
    .policy-list h3 {
      color: var(--text-muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }
    .policy-list label {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      margin: 2px -6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      letter-spacing: -0.008em;
      transition: background-color 150ms var(--ease), color 150ms var(--ease);
    }
    .policy-list label:hover { background: var(--surface); color: var(--text); }
    .policy-list label.active { color: var(--text); font-weight: 500; background: var(--surface); }
    .policy-list input[type='checkbox'] {
      width: 14px; height: 14px;
      accent-color: var(--accent);
      margin: 0;
      flex-shrink: 0;
    }
    .policy-list .policy-name { flex: 1; font-variant-numeric: tabular-nums; }
    .policy-list .color-indicator {
      display: inline-block;
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .chart-area {
      position: relative;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      height: 500px;
    }

    /* ----- technical analysis ----- */
    .indicator-legend {
      display: flex;
      gap: 22px;
      flex-wrap: wrap;
      padding: 12px 16px;
      background: var(--surface-sunken);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      margin-bottom: 16px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12px;
      letter-spacing: -0.006em;
      color: var(--text-muted);
    }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

    .table-scroll { overflow-x: auto; }
    .technical-table { min-width: 1040px; }
    .technical-table td, .technical-table th {
      white-space: nowrap;
      padding: 10px 12px !important;
      font-size: 12.5px;
      letter-spacing: -0.006em;
      font-variant-numeric: tabular-nums;
    }

    /* ----- rank + recommendation badges ----- */
    .rank-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      font-weight: 600;
      font-size: 11px;
      text-align: center;
      letter-spacing: -0.005em;
      border: 1px solid transparent;
      font-variant-numeric: tabular-nums;
    }
    .rank-badge.rank-top3   { background: var(--accent-soft);  color: var(--accent-text);  border-color: var(--accent-border); }
    .rank-badge.rank-green  { background: var(--success-soft); color: var(--success-text); border-color: var(--success-border); }
    .rank-badge.rank-yellow { background: var(--warning-soft); color: var(--warning-text); border-color: var(--warning-border); }
    .rank-badge.rank-red    { background: var(--danger-soft);  color: var(--danger-text);  border-color: var(--danger-border); }

    .recommendation {
      font-weight: 500;
      padding: 4px 11px;
      border-radius: var(--radius-pill);
      text-align: center;
      font-size: 12px;
      letter-spacing: -0.006em;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .recommendation.buy   { background: var(--success-soft); color: var(--success-text); border-color: var(--success-border); }
    .recommendation.hold  { background: var(--warning-soft); color: var(--warning-text); border-color: var(--warning-border); }
    .recommendation.sell  { background: var(--danger-soft);  color: var(--danger-text);  border-color: var(--danger-border); }

    /* ----- score bar ----- */
    .score-cell { display: flex; flex-direction: column; gap: 5px; min-width: 78px; }
    .score-num { font-weight: 600; font-size: 12px; font-variant-numeric: tabular-nums; }
    .score-bar-bg {
      height: 5px;
      background: var(--surface-sunken);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }
    .score-bar-fill {
      height: 100%;
      border-radius: var(--radius-pill);
      transition: width 400ms var(--ease-out);
    }
    .bar-green  { background: var(--success); }
    .bar-yellow { background: var(--warning); }
    .bar-red    { background: var(--danger); }

    /* ----- signal guide ----- */
    .signal-guide {
      margin-top: 18px;
      padding: 16px 18px;
      background: var(--accent-soft);
      border: 1px solid var(--accent-border);
      border-radius: var(--radius);
    }
    .signal-guide h3 {
      color: var(--accent-text);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .signal-guide-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 10px;
    }
    .signal-guide-grid > div {
      display: flex;
      align-items: center;
      gap: 9px;
      font-size: 13px;
      letter-spacing: -0.008em;
      color: var(--text);
    }

    /* ----- constraints ----- */
    .constraints-grid { display: flex; flex-direction: column; gap: 10px; }
    .constraint-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: border-color 150ms var(--ease), background-color 150ms var(--ease);
    }
    .constraint-item:hover {
      border-color: var(--border-strong);
    }
    .constraint-funds {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
      min-width: 150px;
      flex-wrap: wrap;
    }
    .constraint-bar-wrap { flex: 1; }
    .constraint-label {
      font-size: 13px;
      color: var(--text);
      margin-bottom: 8px;
      font-weight: 500;
      letter-spacing: -0.008em;
    }
    .constraint-bar-bg {
      height: 6px;
      background: var(--surface-sunken);
      border-radius: var(--radius-pill);
      overflow: hidden;
    }
    .constraint-bar-fill {
      height: 100%;
      background: var(--accent);
      border-radius: var(--radius-pill);
      transition: width 400ms var(--ease-out);
    }
    .constraint-max {
      font-size: 11px;
      font-weight: 600;
      color: var(--accent);
      margin-top: 6px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /* ----- responsive ----- */
    @media (max-width: 900px) {
      .graph-content { grid-template-columns: 1fr; }
      .policy-list { max-height: 220px; }
      .chart-area { height: 340px; padding: 12px; }
    }
  `],
})
export class StaticOverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvasRef?: ElementRef<HTMLCanvasElement>;

  loaded = false;
  combined: CombinedDataDoc = {};
  ranking: RankingItem[] = [];
  technical: TechnicalDoc | null = null;
  constraints: ConstraintsDoc | null = null;

  allPolicies = new Set<string>();
  selectedPolicies = new Set<string>();
  policyList: string[] = [];

  readonly colors: readonly string[] = [
    '#4F46E5','#10B981','#F59E0B','#0EA5E9','#F43F5E','#8B5CF6',
    '#14B8A6','#F97316','#64748B','#84CC16','#06B6D4','#EAB308',
    '#22C55E','#EC4899','#A855F7','#3B82F6','#EF4444','#0284C7',
    '#7C3AED','#65A30D','#D946EF','#475569',
  ];

  private chart?: Chart;

  constructor(
    private http: HttpClient,
    private themeService: ThemeService,
    public i18n: I18nService,
  ) {
    // Subscribe to both theme + lang. Theme flips CSS variables; language flips
    // month abbreviations on the X axis. Either change triggers a chart redraw.
    effect(() => {
      this.themeService.theme();
      this.i18n.lang();
      if (this.loaded) requestAnimationFrame(() => this.updateChart());
    });
  }

  ngOnInit() {
    forkJoin({
      combined:    this.http.get<CombinedDataDoc>('assets/combined_data.json'),
      ranking:     this.http.get<RankingDoc>('assets/ranking.json'),
      technical:   this.http.get<TechnicalDoc>('assets/technical.json'),
      constraints: this.http.get<ConstraintsDoc>('assets/constraints.json'),
    }).subscribe({
      next: ({ combined, ranking, technical, constraints }) => {
        this.combined = combined;
        this.ranking = [...(ranking?.ranking ?? [])].sort((a, b) => b.avg_return - a.avg_return);
        this.technical = technical;
        this.constraints = constraints;

        // Default selection = every policy that has data; user can deselect.
        Object.keys(combined).forEach(year => {
          (combined[year] ?? []).forEach((p: PolicyMonthly) => {
            this.allPolicies.add(p.policy_name);
            this.selectedPolicies.add(p.policy_name);
          });
        });
        // Cache the sorted list once so the *ngFor doesn't run sort on every CD pass.
        this.policyList = Array.from(this.allPolicies).sort();
        this.loaded = true;
        setTimeout(() => this.updateChart(), 50);
      },
      error: (err) => {
        console.error('Failed to load reference data', err);
      },
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.updateChart(), 200);
  }

  ngOnDestroy() {
    this.chart?.destroy();
    this.chart = undefined;
  }

  isSelected(p: string): boolean { return this.selectedPolicies.has(p); }
  togglePolicy(p: string) {
    this.selectedPolicies.has(p) ? this.selectedPolicies.delete(p) : this.selectedPolicies.add(p);
    this.updateChart();
  }
  selectAll()   { this.allPolicies.forEach(p => this.selectedPolicies.add(p)); this.updateChart(); }
  deselectAll() { this.selectedPolicies.clear(); this.updateChart(); }

  parseFloatSafe(v: string): number { return parseFloat(v) || 0; }

  getRecommendationClass(r: string): string {
    if (!r) return 'hold';
    if (r.includes('ซื้อ')) return 'buy';
    if (r.includes('ถือ')) return 'hold';
    return 'sell';
  }

  getSignalClass(signal: string): string {
    if (signal === 'Strong Buy')  return 'signal-strong-buy';
    if (signal === 'Buy')         return 'signal-buy';
    if (signal === 'Hold')        return 'signal-hold';
    if (signal === 'Sell')        return 'signal-sell';
    return 'signal-strong-sell';
  }

  getRsiClass(rsi: number | null): string {
    return rsiBadgeClass(rsi);
  }

  getScoreBarWidth(score: number): number {
    return Math.max(0, Math.min(100, ((score + 8) / 16) * 100));
  }

  private static readonly MONTH_KEYS = [
    'chart.month.jan','chart.month.feb','chart.month.mar','chart.month.apr',
    'chart.month.may','chart.month.jun','chart.month.jul','chart.month.aug',
    'chart.month.sep','chart.month.oct','chart.month.nov','chart.month.dec',
  ];

  private updateChart() {
    if (!this.chartCanvasRef) return;
    const years  = ['2019','2020','2021','2022','2023','2024','2025','2026'];
    const months = StaticOverviewComponent.MONTH_KEYS.map(k => this.i18n.t(k));

    const labels: string[] = [];
    years.forEach(y => months.forEach(m => labels.push(`${m} ${y}`)));

    const t = {
      text:    cssVar('--text')         || '#0F172A',
      muted:   cssVar('--text-muted')   || '#475569',
      dim:     cssVar('--text-dim')     || '#64748B',
      border:  cssVar('--border')       || '#E5E7EB',
      surface: cssVar('--surface')      || '#FFFFFF',
      tipBg:   cssVar('--tooltip-bg')   || '#0F172A',
      tipFg:   cssVar('--tooltip-text') || '#F8FAFC',
      tipBody: cssVar('--tooltip-muted')|| '#E2E8F0',
      tipBor:  cssVar('--tooltip-border') || '#1E293B',
    };

    const sortedAll = Array.from(this.allPolicies).sort();
    type LineDataset = NonNullable<ChartConfiguration<'line'>['data']['datasets']>[number];
    const datasets: LineDataset[] = [];
    Array.from(this.selectedPolicies).sort().forEach(policy => {
      const pts: number[] = [];
      years.forEach(y => {
        const yearPolicies = this.combined[y];
        const pd = yearPolicies?.find(p => p.policy_name === policy);
        if (pd?.planresult) {
          pd.planresult.forEach(m => pts.push(m.value !== null ? m.value : NaN));
        } else {
          for (let i = 0; i < 12; i++) pts.push(NaN);
        }
      });
      const idx = sortedAll.indexOf(policy);
      const c = this.colors[idx % this.colors.length];
      datasets.push({
        label: policy,
        data: pts,
        borderColor: c,
        backgroundColor: c + '20',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 7,
        pointHitRadius: 12,
        pointBackgroundColor: c,
        pointBorderColor: t.surface,
        pointBorderWidth: 1,
        pointHoverBorderColor: t.surface,
        pointHoverBorderWidth: 2,
        tension: 0.1,
        spanGaps: true,
      });
    });

    const config: ChartConfiguration = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        hover:       { mode: 'index', intersect: false },
        plugins: {
          title: { display: false },
          legend: {
            display: true,
            position: 'top',
            labels: { color: t.muted, font: { size: 11 }, boxWidth: 12, boxHeight: 4, usePointStyle: true, pointStyle: 'circle' },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: t.tipBg,
            titleColor: t.tipFg,
            bodyColor: t.tipBody,
            borderColor: t.tipBor,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            usePointStyle: true,
            callbacks: {
              label: (ctx: any) => {
                const v = ctx.parsed.y;
                const formatted = (v === null || v === undefined || Number.isNaN(v)) ? 'N/A' : v.toFixed(2);
                return `  ${ctx.dataset.label}: ${formatted}`;
              },
            },
          },
        },
        scales: {
          x: { ticks: { color: t.dim, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 24 }, grid: { display: false } },
          y: { ticks: { color: t.dim, font: { size: 10 } }, grid: { color: t.border } },
        },
      },
    };

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(this.chartCanvasRef.nativeElement, config);
  }
}
