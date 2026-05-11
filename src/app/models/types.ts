export interface CurrentHolding {
  policy_code: string;
  policy_name?: string;
  current_proportion: number;
  total_amount?: number;
}

export interface CurrentPortfolio {
  total_amount: number;
  ytd_return?: number;
  holdings: CurrentHolding[];
}

export interface ThemeSpec {
  id: string;
  name: string;
  summary: string;
  tag_weights: Record<string, number>;
  fund_weights?: Record<string, number>;
  max_equity_pct: number;
  min_hedge_pct: number;
  icon?: string;
  is_custom?: boolean;
}

export interface FundMeta {
  policy_code: string;
  fund_name: string;
  group_name: string;
  risk_level: number;
  tags: string[];
}

export interface TechnicalSnapshot {
  policy_code: string;
  fund_name?: string;
  group_name?: string;
  risk_level?: number;
  data_points?: number;
  last_value: number;
  ma6?: number | null;
  ma12?: number | null;
  ma_signal: string;
  ma_score: number;
  macd_line?: number | null;
  macd_signal?: number | null;
  macd_histogram?: number | null;
  macd_trend: string;
  macd_score: number;
  rsi: number | null;
  rsi_zone: string;
  rsi_score: number;
  fib_high?: number;
  fib_low?: number;
  fib_current_level: string;
  fib_score: number;
  total_score: number;
  max_score?: number;
  signal: string;
  signal_class?: string;
}

export interface ConstraintRule {
  id: string;
  label: string;
  funds: string[];
  max_pct: number;
  is_max?: boolean;
  is_min?: boolean;
  scope?: string;
}

/** Enum-like keys emitted by the engine; translated at display time. */
export type EntryStatusKey = 'low_point' | 'base' | 'near_oversold' | 'strong' | 'overbought' | 'na';
export type RoleKey = 'hedge' | 'conservative' | 'growth' | 'balanced';

/** Structured reason atom — composed for display via i18n. */
export type ReasonToken =
  | { kind: 'user_pick';        n: number }
  | { kind: 'theme_match';      n: number }
  | { kind: 'rsi_base';         rsi: number }
  | { kind: 'technical';        signal: string }
  | { kind: 'inflation_hedge' }
  | { kind: 'diversifier' };

export interface RecommendedAllocation {
  code: string;
  name: string;
  pct: number;
  avg_4yr: number | null;
  rsi: number | null;
  entry_status: EntryStatusKey;
  fib_level: string;
  role: RoleKey;
  reason: ReasonToken[];
  signal: string;
  score: number;
}

export interface Issue {
  code: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

export interface RoadmapAction {
  type: 'buy' | 'sell' | 'reduce' | 'monitor' | 'hold';
  code: string;
  detail: string;
  from: number | null;
  to: number | null;
}

export interface RoadmapPhase {
  phase: number;
  title: string;
  period: string;
  actions: RoadmapAction[];
}

export type SwitchCriterionId =
  | 'profit20' | 'loss15' | 'theme_changed' | 'rsi75'
  | 'oil_resolved' | 'ai_top' | 'rate_cut' | 'dividend_drop' | 'global_top';

export interface SwitchCriterion {
  id: SwitchCriterionId;
  icon?: string;
}

export interface ConstraintCheck {
  /** Stable rule id (R1, R2, …) used to look up translated labels. */
  id: string;
  label: string;
  used: number;
  max: number;
  status: 'ok' | 'fail';
}

// ----- JSON asset shapes (typed HTTP responses) -----

export interface FundInfoDoc {
  results: Array<{
    group_fund_name: string;
    group_fund_risk_level: number;
    funds: Array<{
      fund_name: string;
      sub_funds: Array<{ sub_fund_id: string }>;
    }>;
  }>;
}

export interface FundTagsDoc {
  tag_legend?: Record<string, string>;
  funds: Record<string, string[]>;
}

export interface TechnicalDoc {
  generated_date?: string;
  data_range?: string;
  indicators_used?: string[];
  policies: TechnicalSnapshot[];
}

export interface ConstraintsDoc {
  plan_name?: string;
  rules: ConstraintRule[];
}

export interface RankingItem {
  rank: number;
  policy_code: string;
  fund_name: string;
  group_name: string;
  risk_level: number;
  price_per_unit: string;
  yield_ytd: string;
  avg_return: number;
  max_return: number;
  min_return: number;
  recommendation: string;
}

export interface RankingDoc {
  ranking: RankingItem[];
}

export interface ThemeDoc {
  description?: string;
  themes: ThemeSpec[];
}

/** Monthly NAV change per fund per year. Used by the Policy Performance chart. */
export interface PolicyMonthly {
  policy_name: string;
  risk_lvl?: number;
  planresult?: Array<{ label: string; value: number | null }>;
}
export type CombinedDataDoc = Record<string, PolicyMonthly[]>;

// ----- Engine result -----

export interface AnalysisResult {
  theme: ThemeSpec;
  current_avg_return: number;
  recommended_avg_return: number;
  issues: Issue[];
  recommended: RecommendedAllocation[];
  comparison: {
    old_return: number;
    new_return: number;
    old_risk: string;
    new_risk: string;
    old_inflation: string;
    new_inflation: string;
    old_theme_alignment: number;
    new_theme_alignment: number;
  };
  roadmap: RoadmapPhase[];
  switch_criteria: SwitchCriterion[];
  constraint_checks: ConstraintCheck[];
}
