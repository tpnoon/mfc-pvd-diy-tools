import { Injectable } from '@angular/core';
import {
  AnalysisResult,
  ConstraintCheck,
  ConstraintRule,
  CurrentPortfolio,
  EntryStatusKey,
  FundMeta,
  Issue,
  ReasonToken,
  RecommendedAllocation,
  RoadmapAction,
  RoadmapPhase,
  RoleKey,
  SwitchCriterion,
  TechnicalSnapshot,
  ThemeSpec,
} from '../models/types';

const HEDGE_TAGS = new Set(['BOND_TH', 'BOND_GLOBAL', 'COMMODITY_GOLD', 'MONEY_MARKET']);
const EQUITY_TAGS = new Set([
  'EQUITY_TH', 'EQUITY_GLOBAL', 'EQUITY_US', 'EQUITY_EU', 'EQUITY_ASIA',
  'EQUITY_CHINA', 'EQUITY_INDIA', 'EQUITY_VIETNAM', 'EQUITY_EM', 'TECH', 'HEALTH', 'ENERGY',
]);

/**
 * Single source of truth for RSI bands across the app.
 *   < 30  → oversold
 *   30-70 → normal (with sub-bands for entry timing)
 *   > 70  → overbought
 */
export type RsiZone = 'oversold' | 'normal' | 'overbought' | 'unknown';
export function rsiZone(rsi: number | null | undefined): RsiZone {
  if (rsi === null || rsi === undefined || Number.isNaN(rsi)) return 'unknown';
  if (rsi < 30) return 'oversold';
  if (rsi > 70) return 'overbought';
  return 'normal';
}
export function rsiBadgeClass(rsi: number | null | undefined): string {
  const z = rsiZone(rsi);
  if (z === 'oversold')   return 'rsi-oversold';
  if (z === 'overbought') return 'rsi-overbought';
  if (z === 'normal')     return 'rsi-normal';
  return '';
}

interface ScoredFund {
  meta: FundMeta;
  tech: TechnicalSnapshot;
  themeMatch: number;
  rsiBonus: number;
  techBonus: number;
  total: number;
}

/** Mutable state passed through the allocation helpers in buildRecommended. */
interface AllocationContext {
  target: { code: string; pct: number }[];
  remaining: number;
  equityCap: number;
  equityUsed: number;
  hedgeUsed: number;
  constraints: ConstraintRule[];
}

const PCT_STEP = 5;
const MIN_SLIVER = 5;
const PER_FUND_MAX_DEFAULT = 20;
const DEFAULT_EQUITY_CAP = 80;
const DEFAULT_HEDGE_MIN = 10;

@Injectable({ providedIn: 'root' })
export class AnalysisEngineService {
  // Memoized lookup maps. Rebuilt only when the source array identity changes —
  // a typical session re-runs analyze() many times (every theme/portfolio change)
  // against the same funds/technicals, so caching avoids 2 × 32-entry Map rebuilds per call.
  private _fundsRef: FundMeta[] | null = null;
  private _fundByCode: Map<string, FundMeta> = new Map();
  private _technicalsRef: TechnicalSnapshot[] | null = null;
  private _techByCode: Map<string, TechnicalSnapshot> = new Map();

  private fundByCode(funds: FundMeta[]): Map<string, FundMeta> {
    if (funds !== this._fundsRef) {
      this._fundsRef = funds;
      this._fundByCode = new Map(funds.map(f => [f.policy_code, f]));
    }
    return this._fundByCode;
  }

  private techByCode(technicals: TechnicalSnapshot[]): Map<string, TechnicalSnapshot> {
    if (technicals !== this._technicalsRef) {
      this._technicalsRef = technicals;
      this._techByCode = new Map(technicals.map(t => [t.policy_code, t]));
    }
    return this._techByCode;
  }

  analyze(
    portfolio: CurrentPortfolio,
    theme: ThemeSpec,
    funds: FundMeta[],
    technicals: TechnicalSnapshot[],
    constraints: ConstraintRule[],
    avgReturnByCode: Map<string, number> = new Map(),
  ): AnalysisResult {
    const techByCode = this.techByCode(technicals);
    const fundByCode = this.fundByCode(funds);

    // 1. Score every fund with sufficient data
    const scored: ScoredFund[] = funds
      .map(f => this.scoreFund(f, theme, techByCode.get(f.policy_code)))
      .filter((s): s is ScoredFund => s !== null)
      .sort((a, b) => b.total - a.total);

    // 2. Build recommended allocation respecting constraints + theme caps
    const recommended = this.buildRecommended(scored, theme, constraints, avgReturnByCode);

    // 3. Generate issues by comparing current vs recommended + technical signals
    const issues = this.generateIssues(portfolio, recommended, theme, techByCode, fundByCode);
    // 3b. Surface biased funds the engine couldn't allocate (silent drops are confusing).
    this.appendDroppedBiasIssues(issues, theme, recommended, techByCode, fundByCode);

    // 4. Comparison metrics
    const oldRet = this.expectedReturn(portfolio.holdings.map(h => ({ code: h.policy_code, pct: h.current_proportion })), techByCode, avgReturnByCode);
    const newRet = this.expectedReturn(recommended.map(r => ({ code: r.code, pct: r.pct })), techByCode, avgReturnByCode);
    const oldAlign = this.themeAlignment(portfolio.holdings.map(h => ({ code: h.policy_code, pct: h.current_proportion })), theme, fundByCode);
    const newAlign = this.themeAlignment(recommended.map(r => ({ code: r.code, pct: r.pct })), theme, fundByCode);

    const comparison = {
      old_return: Math.round(oldRet * 100) / 100,
      new_return: Math.round(newRet * 100) / 100,
      old_risk: this.riskBucket(portfolio.holdings.map(h => ({ code: h.policy_code, pct: h.current_proportion })), fundByCode),
      new_risk: this.riskBucket(recommended.map(r => ({ code: r.code, pct: r.pct })), fundByCode),
      old_inflation: oldAlign < 1 ? 'Weak' : oldAlign < 2 ? 'Moderate' : 'Strong',
      new_inflation: newAlign < 1 ? 'Weak' : newAlign < 2 ? 'Moderate' : 'Strong',
      old_theme_alignment: Math.round(oldAlign * 100) / 100,
      new_theme_alignment: Math.round(newAlign * 100) / 100,
    };

    // 5. Roadmap (4 phases over 4 years)
    const roadmap = this.buildRoadmap(portfolio, recommended);

    // 6. Switch criteria
    const switch_criteria = this.buildSwitchCriteria(theme);

    // 7. Constraint checks against recommendation
    const constraint_checks = this.checkConstraints(recommended, constraints);

    return {
      theme,
      current_avg_return: comparison.old_return,
      recommended_avg_return: comparison.new_return,
      issues,
      recommended,
      comparison,
      roadmap,
      switch_criteria,
      constraint_checks,
    };
  }

  private scoreFund(meta: FundMeta, theme: ThemeSpec, tech: TechnicalSnapshot | undefined): ScoredFund | null {
    if (!tech) return null;
    const tags = meta.tags || [];
    let themeMatch = 0;
    for (const tag of tags) {
      themeMatch += theme.tag_weights[tag] || 0;
    }
    themeMatch += theme.fund_weights?.[meta.policy_code] ?? 0;

    // Buy-at-Base bonus: RSI 30-50 with positive technical
    let rsiBonus = 0;
    if (tech.rsi !== null) {
      if (tech.rsi >= 30 && tech.rsi <= 45) rsiBonus = 3;
      else if (tech.rsi > 45 && tech.rsi <= 55) rsiBonus = 1.5;
      else if (tech.rsi > 70) rsiBonus = -2;
    }

    const techBonus = tech.total_score * 0.5;
    const total = themeMatch * 3 + rsiBonus * 2 + techBonus;

    return { meta, tech, themeMatch, rsiBonus, techBonus, total };
  }

  private buildRecommended(
    scored: ScoredFund[],
    theme: ThemeSpec,
    constraints: ConstraintRule[],
    avgReturnByCode: Map<string, number> = new Map(),
  ): RecommendedAllocation[] {
    const avoidedCodes = this.collectCodes(theme.fund_weights, v => v < 0);
    if (avoidedCodes.size > 0) {
      scored = scored.filter(s => !avoidedCodes.has(s.meta.policy_code));
    }
    const biasedCodes = this.collectCodes(theme.fund_weights, v => v > 0);

    const ctx: AllocationContext = {
      target: [],
      remaining: 100,
      equityCap: theme.max_equity_pct ?? DEFAULT_EQUITY_CAP,
      equityUsed: 0,
      hedgeUsed: 0,
      constraints,
    };

    const biasedFunds = biasedCodes.size > 0
      ? scored.filter(s => biasedCodes.has(s.meta.policy_code))
      : [];

    if (biasedFunds.length > 0) {
      this.allocateBiasOnly(ctx, biasedFunds);
    } else {
      this.allocateDefault(ctx, scored, theme.min_hedge_pct ?? DEFAULT_HEDGE_MIN);
    }

    // Build full RecommendedAllocation
    const target = ctx.target;
    return target
      .filter(t => t.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .map(t => {
        const f = scored.find(s => s.meta.policy_code === t.code)!;
        const avg = avgReturnByCode.get(t.code);
        return {
          code: t.code,
          name: f.meta.fund_name,
          pct: t.pct,
          avg_4yr: avg != null ? Math.round(avg * 100) / 100 : null,
          rsi: f.tech.rsi !== null ? Math.round(f.tech.rsi * 10) / 10 : null,
          entry_status: this.entryStatus(f.tech.rsi),
          fib_level: f.tech.fib_current_level,
          role: this.roleFor(f.meta),
          reason: this.reasonFor(f, theme),
          signal: f.tech.signal,
          score: Math.round(f.total * 10) / 10,
        };
      });
  }

  /** Extract fund codes from theme.fund_weights matching a predicate on the weight. */
  private collectCodes(
    fund_weights: Record<string, number> | undefined,
    predicate: (v: number) => boolean,
  ): Set<string> {
    return new Set(
      Object.entries(fund_weights ?? {})
        .filter(([, v]) => predicate(v))
        .map(([code]) => code),
    );
  }

  /**
   * Attempt to allocate `desiredPct` to `fund`, respecting per-fund caps,
   * group caps, the theme equity cap, and remaining budget. Floors to a 5%
   * multiple so we never exceed any cap. Returns the actual % allocated.
   */
  private tryAllocate(ctx: AllocationContext, fund: ScoredFund, desiredPct: number): number {
    const tags = fund.meta.tags;
    const isEquity = tags.some(t => EQUITY_TAGS.has(t));
    const isHedge = tags.some(t => HEDGE_TAGS.has(t));

    let cap = desiredPct;

    // Per-fund single cap (R1-R4, R8 etc).
    for (const r of ctx.constraints) {
      if (r.funds.length === 1 && r.funds[0] === fund.meta.policy_code) {
        cap = Math.min(cap, r.max_pct);
      }
    }
    // Multi-fund group caps (R5, R7, R9 etc), net of already-allocated group members.
    for (const r of ctx.constraints) {
      if (r.funds.length > 1 && r.funds.includes(fund.meta.policy_code)) {
        const used = ctx.target
          .filter(t => r.funds.includes(t.code))
          .reduce((a, b) => a + b.pct, 0);
        cap = Math.min(cap, Math.max(0, r.max_pct - used));
      }
    }
    // Theme equity cap applies only to pure-equity funds.
    if (isEquity && !isHedge) {
      cap = Math.min(cap, Math.max(0, ctx.equityCap - ctx.equityUsed));
    }
    cap = Math.min(cap, ctx.remaining);
    if (cap < MIN_SLIVER) return 0;

    const allocated = Math.floor(cap / PCT_STEP) * PCT_STEP;
    if (allocated <= 0) return 0;

    ctx.target.push({ code: fund.meta.policy_code, pct: allocated });
    ctx.remaining -= allocated;
    if (isEquity && !isHedge) ctx.equityUsed += allocated;
    if (isHedge) ctx.hedgeUsed += allocated;
    return allocated;
  }

  /**
   * Re-attempt allocating `fund` up to `totalAmbition` — releases its existing
   * slot (if any) so tryAllocate can extend it. Used by the bias-only redistribution
   * pass and the default-mode hedge filler.
   */
  private extendAllocate(ctx: AllocationContext, fund: ScoredFund, totalAmbition: number): number {
    const existingIdx = ctx.target.findIndex(t => t.code === fund.meta.policy_code);
    if (existingIdx >= 0) {
      const previous = ctx.target.splice(existingIdx, 1)[0];
      ctx.remaining += previous.pct;
      const tags = fund.meta.tags;
      const wasEquity = tags.some(t => EQUITY_TAGS.has(t));
      const wasHedge  = tags.some(t => HEDGE_TAGS.has(t));
      if (wasEquity && !wasHedge) ctx.equityUsed -= previous.pct;
      if (wasHedge) ctx.hedgeUsed -= previous.pct;
    }
    return this.tryAllocate(ctx, fund, totalAmbition);
  }

  /**
   * Strict bias-only allocation. Uses ONLY the user's bias picks — no hedge minimum,
   * no top-scorer fill, no filler. If DIY caps prevent reaching 100%, the portfolio
   * ends short and the alloc-warn banner explains why.
   */
  private allocateBiasOnly(ctx: AllocationContext, biasedFunds: ScoredFund[]): void {
    // Pass 1: equal share across bias picks (rounded down to PCT_STEP, min PCT_STEP).
    const baseShare = Math.max(PCT_STEP, Math.floor(100 / biasedFunds.length / PCT_STEP) * PCT_STEP);
    for (const f of biasedFunds) {
      if (ctx.remaining <= 0) break;
      this.tryAllocate(ctx, f, baseShare);
    }
    // Pass 2..N: redistribute leftover until convergence.
    let prevRemaining = -1;
    while (ctx.remaining > 0 && ctx.remaining !== prevRemaining) {
      prevRemaining = ctx.remaining;
      for (const f of biasedFunds) {
        if (ctx.remaining <= 0) break;
        const existing = ctx.target.find(t => t.code === f.meta.policy_code)?.pct ?? 0;
        this.extendAllocate(ctx, f, existing + ctx.remaining);
      }
    }
  }

  /**
   * Default (no bias picks): reserve hedge minimum, then top scorers, then filler.
   * Used when the user hasn't expressed any explicit fund preference.
   */
  private allocateDefault(ctx: AllocationContext, scored: ScoredFund[], hedgePctMin: number): void {
    // 1. Reserve hedge minimum.
    const hedgeCandidates = scored.filter(s => s.meta.tags.some(t => HEDGE_TAGS.has(t)));
    let i = 0;
    while (ctx.hedgeUsed < hedgePctMin && i < hedgeCandidates.length) {
      const desired = Math.min(hedgePctMin - ctx.hedgeUsed + PCT_STEP, 25);
      this.tryAllocate(ctx, hedgeCandidates[i], desired);
      i++;
    }
    // 2. Top scorers.
    for (const f of scored) {
      if (ctx.remaining <= 0) break;
      if (ctx.target.find(t => t.code === f.meta.policy_code)) continue;
      const desired = f.total > 0 ? Math.min(PER_FUND_MAX_DEFAULT, ctx.remaining) : 0;
      if (desired > 0) this.tryAllocate(ctx, f, desired);
    }
    // 3. Filler: soak any leftover into bond/hedge funds.
    if (ctx.remaining > 0) {
      const hedgeWalk = [
        ...scored.filter(s => s.meta.tags.includes('BOND_TH')),
        ...scored.filter(s =>
          s.meta.tags.some(t => HEDGE_TAGS.has(t)) && !s.meta.tags.includes('BOND_TH'),
        ),
      ];
      for (const f of hedgeWalk) {
        if (ctx.remaining <= 0) break;
        const existing = ctx.target.find(t => t.code === f.meta.policy_code)?.pct ?? 0;
        this.extendAllocate(ctx, f, existing + ctx.remaining);
      }
    }
  }

  private entryStatus(rsi: number | null): EntryStatusKey {
    if (rsi === null) return 'na';
    if (rsi < 30) return 'low_point';
    if (rsi < 45) return 'base';
    if (rsi < 55) return 'near_oversold';
    if (rsi < 70) return 'strong';
    return 'overbought';
  }

  private roleFor(meta: FundMeta): RoleKey {
    if (meta.tags.includes('COMMODITY_GOLD')) return 'hedge';
    if (meta.tags.includes('BOND_TH') || meta.tags.includes('BOND_GLOBAL') || meta.tags.includes('MONEY_MARKET')) return 'conservative';
    if (meta.tags.includes('TECH')) return 'growth';
    if (meta.tags.includes('MIXED')) return 'balanced';
    return 'growth';
  }

  private reasonFor(f: ScoredFund, theme: ThemeSpec): ReasonToken[] {
    const tokens: ReasonToken[] = [];
    const fundBias = theme.fund_weights?.[f.meta.policy_code] ?? 0;
    // themeMatch already includes fundBias; the tag-only contribution is what's left.
    const tagOnlyMatch = f.themeMatch - fundBias;

    if (fundBias > 0) tokens.push({ kind: 'user_pick', n: fundBias });
    if (tagOnlyMatch > 0) tokens.push({ kind: 'theme_match', n: tagOnlyMatch });
    if (f.tech.rsi !== null && f.tech.rsi >= 30 && f.tech.rsi <= 45) {
      tokens.push({ kind: 'rsi_base', rsi: Math.round(f.tech.rsi) });
    }
    if (f.tech.total_score >= 3) tokens.push({ kind: 'technical', signal: f.tech.signal });
    if (f.meta.tags.includes('COMMODITY_GOLD')) tokens.push({ kind: 'inflation_hedge' });
    if (tokens.length === 0) tokens.push({ kind: 'diversifier' });
    return tokens;
  }

  private generateIssues(
    portfolio: CurrentPortfolio,
    recommended: RecommendedAllocation[],
    theme: ThemeSpec,
    techByCode: Map<string, TechnicalSnapshot>,
    fundByCode: Map<string, FundMeta>,
  ): Issue[] {
    const issues: Issue[] = [];
    const recSet = new Set(recommended.map(r => r.code));

    for (const h of portfolio.holdings) {
      const tech = techByCode.get(h.policy_code);
      const meta = fundByCode.get(h.policy_code);
      if (!tech || !meta) continue;

      // Overbought
      if (tech.rsi !== null && tech.rsi > 70) {
        issues.push({
          code: h.policy_code,
          issue: `RSI ${tech.rsi.toFixed(0)} = Overbought, มีโอกาสปรับฐาน — พิจารณาทยอยลดสัดส่วน`,
          severity: 'high',
        });
      }

      // Strong Sell signal
      if (tech.signal === 'Strong Sell' || tech.signal === 'Sell') {
        issues.push({
          code: h.policy_code,
          issue: `Technical signal: ${tech.signal} (score ${tech.total_score})`,
          severity: tech.signal === 'Strong Sell' ? 'high' : 'medium',
        });
      }

      // Mismatch with theme (tags + per-fund bias)
      const tagScore = (meta.tags || []).reduce((a, t) => a + (theme.tag_weights[t] || 0), 0);
      const fundScore = theme.fund_weights?.[h.policy_code] ?? 0;
      const themeScore = tagScore + fundScore;
      if (themeScore < -1) {
        issues.push({
          code: h.policy_code,
          issue: `ขัดกับ theme "${theme.name}" (score ${themeScore}) — ทบทวนสัดส่วน`,
          severity: 'medium',
        });
      }

      // Concentration > 40%
      if (h.current_proportion > 40) {
        issues.push({
          code: h.policy_code,
          issue: `กระจุกตัว ${h.current_proportion}% — ควรกระจาย`,
          severity: 'medium',
        });
      }

      // Holding not in recommended at all
      if (!recSet.has(h.policy_code) && h.current_proportion >= 10) {
        issues.push({
          code: h.policy_code,
          issue: `ไม่อยู่ใน customized portfolio — พิจารณาสับเปลี่ยน`,
          severity: 'low',
        });
      }
    }

    return issues;
  }

  private appendDroppedBiasIssues(
    issues: Issue[],
    theme: ThemeSpec,
    recommended: RecommendedAllocation[],
    techByCode: Map<string, TechnicalSnapshot>,
    fundByCode: Map<string, FundMeta>,
  ): void {
    const biasedCodes = Object.entries(theme.fund_weights ?? {})
      .filter(([, v]) => v > 0)
      .map(([code]) => code);
    if (biasedCodes.length === 0) return;
    const recCodes = new Set(recommended.map(r => r.code));
    for (const code of biasedCodes) {
      if (recCodes.has(code)) continue;
      const reason = !techByCode.has(code)
        ? 'no technical data available'
        : !fundByCode.has(code)
          ? 'fund not recognized'
          : 'constraint caps left no room';
      issues.push({
        code,
        issue: `Bias pick ${code} not in customized portfolio — ${reason}.`,
        severity: 'low',
      });
    }
  }

  expectedReturn(
    allocs: { code: string; pct: number }[],
    techByCode: Map<string, TechnicalSnapshot>,
    avgReturnByCode: Map<string, number>,
  ): number {
    // Allocation-weighted average of each fund's 4-year avg_return, normalized so a
    // portfolio that doesn't sum to exactly 100% still reports the true average return.
    // Falls back to a tech-score proxy (score in [-8..+8] → ~ret in [-7..+9]%) if avg_return is missing.
    let weighted = 0;
    let totalPct = 0;
    for (const a of allocs) {
      let ret = avgReturnByCode.get(a.code);
      if (ret == null) {
        const score = techByCode.get(a.code)?.total_score ?? 0;
        ret = score + 1;
      }
      weighted += ret * a.pct;
      totalPct += a.pct;
    }
    if (totalPct === 0) return 0;
    return weighted / totalPct;
  }

  themeAlignment(allocs: { code: string; pct: number }[], theme: ThemeSpec, fundByCode: Map<string, FundMeta>): number {
    let weighted = 0;
    let totalPct = 0;
    for (const a of allocs) {
      const meta = fundByCode.get(a.code);
      if (!meta) continue;
      const tagScore = (meta.tags || []).reduce((s, t) => s + (theme.tag_weights[t] || 0), 0);
      const fundScore = theme.fund_weights?.[a.code] ?? 0;
      weighted += (tagScore + fundScore) * a.pct;
      totalPct += a.pct;
    }
    if (totalPct === 0) return 0;
    return weighted / totalPct;
  }

  riskBucket(allocs: { code: string; pct: number }[], fundByCode: Map<string, FundMeta>): string {
    let weighted = 0;
    let total = 0;
    for (const a of allocs) {
      const meta = fundByCode.get(a.code);
      if (!meta) continue;
      weighted += meta.risk_level * a.pct;
      total += a.pct;
    }
    if (total === 0) return 'N/A';
    const avg = weighted / total;
    if (avg < 2) return `Conservative (${avg.toFixed(1)}/5)`;
    if (avg < 3) return `Balanced (${avg.toFixed(1)}/5)`;
    if (avg < 4) return `Moderate Growth (${avg.toFixed(1)}/5)`;
    return `Aggressive Growth (${avg.toFixed(1)}/5)`;
  }

  private buildRoadmap(portfolio: CurrentPortfolio, recommended: RecommendedAllocation[]): RoadmapPhase[] {
    const currentMap = new Map(portfolio.holdings.map(h => [h.policy_code, h.current_proportion]));
    const recMap = new Map(recommended.map(r => [r.code, r.pct]));
    // Stable iteration order: rec funds first by descending pct, then any extras
    // from the current portfolio that didn't make the recommendation.
    const orderedCodes: string[] = [
      ...recommended.map(r => r.code),
      ...[...currentMap.keys()].filter(c => !recMap.has(c)),
    ];

    const phase1Actions: RoadmapAction[] = [];
    const phase2Actions: RoadmapAction[] = [];
    const phase3Actions: RoadmapAction[] = [];

    for (const code of orderedCodes) {
      const cur = currentMap.get(code) || 0;
      const rec = recMap.get(code) || 0;
      const delta = rec - cur;

      // Steady-state hold belongs in phase 3 (after rebalancing settles).
      if (Math.abs(delta) < 5) {
        if (rec > 0) {
          phase3Actions.push({
            type: 'hold',
            code,
            detail: `Hold at ${rec}% — quarterly RSI / signal review`,
            from: cur,
            to: rec,
          });
        }
        continue;
      }

      if (delta > 0) {
        // Splitting buy across phases for averaging
        const half = Math.round(delta / 2);
        phase1Actions.push({ type: 'buy', code, detail: `Increase by ${half}% (DCA)`, from: cur, to: cur + half });
        phase2Actions.push({ type: 'buy', code, detail: `Increase final ${delta - half}%`, from: cur + half, to: rec });
        // Once at target, becomes a phase 3 hold.
        phase3Actions.push({
          type: 'hold',
          code,
          detail: `Hold at ${rec}% — quarterly RSI / signal review`,
          from: cur,
          to: rec,
        });
      } else {
        if (cur >= 30) {
          phase1Actions.push({ type: 'reduce', code, detail: `Trim ${Math.abs(delta)}% gradually`, from: cur, to: rec });
        } else {
          phase1Actions.push({ type: 'sell', code, detail: `Reallocate ${Math.abs(delta)}%`, from: cur, to: rec });
        }
        if (rec > 0) {
          phase3Actions.push({
            type: 'hold',
            code,
            detail: `Hold at ${rec}% — quarterly RSI / signal review`,
            from: cur,
            to: rec,
          });
        }
      }
    }

    // Universal phase 3 monitor: theme-level re-evaluation.
    phase3Actions.push({
      type: 'monitor',
      code: 'ALL',
      detail: 'Re-evaluate theme thesis + global RSI annually; rerun analysis',
      from: null,
      to: null,
    });

    return [
      { phase: 1, title: 'Phase 1 — Rebalance', period: 'Months 0-6', actions: phase1Actions },
      { phase: 2, title: 'Phase 2 — Build Position', period: 'Months 6-18', actions: phase2Actions },
      { phase: 3, title: 'Phase 3 — Hold & Review', period: 'Years 2-4', actions: phase3Actions },
    ];
  }

  private buildSwitchCriteria(theme: ThemeSpec): SwitchCriterion[] {
    const baseline: SwitchCriterion[] = [
      { id: 'profit20',      icon: 'profit' },
      { id: 'loss15',        icon: 'loss' },
      { id: 'theme_changed', icon: 'rate' },
      { id: 'rsi75',         icon: 'bubble' },
    ];

    // theme.id is either a preset id or `combo:id1+id2+...` for multi-select.
    // Parse into a Set so substring collisions can't false-trigger another theme's rule.
    const COMBO_PREFIX = 'combo:';
    const ids = theme.id.startsWith(COMBO_PREFIX)
      ? new Set(theme.id.slice(COMBO_PREFIX.length).split('+'))
      : new Set([theme.id]);

    if (ids.has('geopolitical_hedge')) baseline.push({ id: 'oil_resolved',  icon: 'peace' });
    if (ids.has('ai_tech'))            baseline.push({ id: 'ai_top',        icon: 'bubble' });
    if (ids.has('conservative'))       baseline.push({ id: 'rate_cut',      icon: 'rate' });
    if (ids.has('income_dividend'))    baseline.push({ id: 'dividend_drop', icon: 'rate' });
    if (ids.has('global_growth'))      baseline.push({ id: 'global_top',    icon: 'profit' });

    return baseline;
  }

  checkConstraints(allocations: { code: string; pct: number }[], constraints: ConstraintRule[]): ConstraintCheck[] {
    return constraints.map(r => {
      const usedRaw = allocations.filter(a => r.funds.includes(a.code)).reduce((s, a) => s + a.pct, 0);
      const used = Math.round(usedRaw * 100) / 100;
      return {
        id: r.id,
        label: r.label,
        used,
        max: r.max_pct,
        status: used <= r.max_pct ? 'ok' : 'fail',
      };
    });
  }

  /**
   * Single entry point for live recomputation against arbitrary allocations.
   * Used by the Customized Portfolio table when the user edits per-fund %s
   * — keeps the math in one place (the engine), not duplicated in components.
   */
  recomputeForAllocations(
    allocations: { code: string; pct: number }[],
    theme: ThemeSpec,
    funds: FundMeta[],
    technicals: TechnicalSnapshot[],
    constraints: ConstraintRule[],
    avgReturnByCode: Map<string, number>,
  ): {
    expectedReturn: number;
    themeAlignment: number;
    inflation: 'Weak' | 'Moderate' | 'Strong';
    risk: string;
    compliance: ConstraintCheck[];
  } {
    const techByCode = this.techByCode(technicals);
    const fundByCode = this.fundByCode(funds);
    const ret  = this.expectedReturn(allocations, techByCode, avgReturnByCode);
    const algn = this.themeAlignment(allocations, theme, fundByCode);
    return {
      expectedReturn: Math.round(ret  * 100) / 100,
      themeAlignment: Math.round(algn * 100) / 100,
      inflation: algn < 1 ? 'Weak' : algn < 2 ? 'Moderate' : 'Strong',
      risk: this.riskBucket(allocations, fundByCode),
      compliance: this.checkConstraints(allocations, constraints),
    };
  }
}
