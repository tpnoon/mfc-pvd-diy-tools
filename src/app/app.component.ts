import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { PortfolioInputComponent } from './components/portfolio-input.component';
import { ThemeSelectorComponent } from './components/theme-selector.component';
import { AnalysisOutputComponent } from './components/analysis-output.component';
import { StaticOverviewComponent } from './components/static-overview.component';
import { AnalysisEngineService } from './services/analysis-engine.service';
import { ThemeService } from './services/theme.service';
import { I18nService } from './services/i18n.service';
import {
  AnalysisResult,
  ConstraintRule,
  ConstraintsDoc,
  CurrentPortfolio,
  FundInfoDoc,
  FundMeta,
  FundTagsDoc,
  RankingDoc,
  TechnicalDoc,
  TechnicalSnapshot,
  ThemeSpec,
} from './models/types';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, StaticOverviewComponent, PortfolioInputComponent, ThemeSelectorComponent, AnalysisOutputComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  loaded = false;
  loadError: string | null = null;
  funds: FundMeta[] = [];
  technicals: TechnicalSnapshot[] = [];
  constraints: ConstraintRule[] = [];
  avgReturnByCode = new Map<string, number>();
  dataDate: string | null = null;
  readonly buildYear = new Date().getFullYear();

  portfolio: CurrentPortfolio | null = null;
  theme: ThemeSpec | null = null;
  result: AnalysisResult | null = null;

  currentHoldingsForChart: { code: string; pct: number }[] = [];

  constructor(
    private http: HttpClient,
    private engine: AnalysisEngineService,
    public themeService: ThemeService,
    public i18n: I18nService,
  ) {}

  ngOnInit() {
    // ranking.json drives both the static Policy Rankings table and the engine's avg_4yr.
    forkJoin({
      info:        this.http.get<FundInfoDoc>('assets/info.json'),
      tags:        this.http.get<FundTagsDoc>('assets/fund_tags.json'),
      tech:        this.http.get<TechnicalDoc>('assets/technical.json'),
      constraints: this.http.get<ConstraintsDoc>('assets/constraints.json'),
      ranking:     this.http.get<RankingDoc>('assets/ranking.json'),
    }).subscribe({
      next: ({ info, tags, tech, constraints, ranking }) => {
        this.funds = this.buildFundMeta(info, tags);
        this.technicals = tech.policies ?? [];
        this.dataDate = tech.generated_date ?? null;
        this.constraints = constraints.rules ?? [];
        this.avgReturnByCode = new Map(
          (ranking?.ranking ?? []).map(r => [r.policy_code, r.avg_return]),
        );
        this.loaded = true;
      },
      error: (err) => {
        console.error('Failed to load required asset bundles', err);
        this.loadError = 'Could not load required data. Refresh the page or check your connection.';
      },
    });
  }

  private buildFundMeta(info: FundInfoDoc, tags: FundTagsDoc): FundMeta[] {
    const out: FundMeta[] = [];
    for (const group of info.results) {
      for (const fund of group.funds) {
        for (const sub of fund.sub_funds) {
          out.push({
            policy_code: sub.sub_fund_id,
            fund_name:   fund.fund_name,
            group_name:  group.group_fund_name,
            risk_level:  group.group_fund_risk_level,
            tags:        tags.funds[sub.sub_fund_id] ?? [],
          });
        }
      }
    }
    return out.sort((a, b) => a.policy_code.localeCompare(b.policy_code));
  }

  onPortfolioChange(p: CurrentPortfolio) {
    this.portfolio = p;
    this.currentHoldingsForChart = p.holdings.map(h => ({ code: h.policy_code, pct: h.current_proportion }));
    this.maybeAnalyze();
  }

  onThemeChange(t: ThemeSpec | null) {
    this.theme = t;
    if (!t) {
      this.result = null;
      return;
    }
    this.maybeAnalyze();
  }

  private maybeAnalyze() {
    if (!this.portfolio || !this.theme) return;
    this.result = this.engine.analyze(this.portfolio, this.theme, this.funds, this.technicals, this.constraints, this.avgReturnByCode);
  }
}
