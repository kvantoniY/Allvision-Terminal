export function calcRecommendation({ bank, odds, bo, tier, risk }) {
  // базовый риск-кап (чтобы не убивать банк)
  // Это MVP-эвристика: чем выше риск / слабее турнир / меньше bo — тем меньше доля.
  // odds влияет мягко (чем выше odds, тем выше неопределенность => понижаем чуть-чуть).

  if (!(bank > 0)) throw new Error('bank must be > 0');
  if (!(odds > 1)) throw new Error('odds must be > 1');
  if (![1, 2, 3, 5].includes(bo)) throw new Error('bo invalid');
  if (![1, 2, 3].includes(tier)) throw new Error('tier invalid');
  if (![1, 2, 3, 4, 5].includes(risk)) throw new Error('risk invalid');

  // base pct: 2% (условно), дальше множители
  let pct = 0.02;

  // risk: 1 (уверен) -> 1.2, 5 -> 0.4
  const riskFactor = { 1: 5, 2: 1.0, 3: 0.8, 4: 0.6, 5: 0.4 }[risk];

  // tier: 1 -> 1.0, 3 -> 0.8
  const tierFactor = { 1: 1.0, 2: 0.9, 3: 0.8 }[tier];

  // bo: bo1 -> 0.85, bo5 -> 1.05 (на длинной дистанции “стабильнее”)
  const boFactor = { 1: 0.85, 2: 0.92, 3: 1.0, 5: 1.05 }[bo];

  // odds: чем больше, тем чуть меньше (ограничим эффект)
  // odds 1.2..3.0 -> factor ~ 1.0..0.85
  const oddsFactor = Math.max(0.85, Math.min(1.0, 1.08 - (odds - 1) * 0.12));

  pct = pct * riskFactor * tierFactor * boFactor * oddsFactor;

  // капы (очень важно)
  // min 0.25% max 5%
  pct = Math.max(0.0025, Math.min(0.05, pct));

  const recommendedStake = bank * pct;

  return {
    recommendedPct: Number(pct.toFixed(6)),
    recommendedStake: Number(recommendedStake.toFixed(6)),
    stakingModel: 'risk_adjusted_v1'
  };
}
