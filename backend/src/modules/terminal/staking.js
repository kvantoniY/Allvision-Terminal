export const STAKING_MODEL = 'risk_adjusted_v1';

const cfg = {
  basePct: 0.01,      // 1.00%
  minPct: 0.0025,     // 0.25%
  maxPct: 0.03,       // 3.00%
  bo: { 1: 0.90, 2: 0.95, 3: 1.00, 5: 1.05 },
  tier: { 1: 1.00, 2: 0.95, 3: 0.90 },
  risk: { 1: 100, 2: 1.00, 3: 0.90, 4: 0.80, 5: 0.70 }
};

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function round2(x) { return Math.round(x * 100) / 100; }

export function calcRecommendation({ bank, odds, bo, tier, risk }) {
  const mBO = cfg.bo[bo] ?? 1.0;
  const mTier = cfg.tier[tier] ?? 1.0;
  const mRisk = cfg.risk[risk] ?? 1.0;

  const oddsNum = Number(odds);
  const mOdds = clamp((oddsNum - 1) / 1.5, 0.85, 1.10);

  const rawPct = cfg.basePct * mBO * mTier * mRisk * mOdds;
  const pct = clamp(rawPct, cfg.minPct, cfg.maxPct);

  const recommendedStake = round2(Number(bank) * pct);
  return { recommendedPct: pct, recommendedStake, stakingModel: STAKING_MODEL };
}
