// Cost spike detection. Plain code: a day costing far more than the 7 days before it.
import type { Anomaly } from "./schema";

const WINDOW = 7;
const THRESHOLD_RATIO = 2;
const MIN_COST_MYR = 1; // ignore spikes too small to matter

export function detectAnomalies(series: { date: string; cost: number }[]): Anomaly[] {
  const out: Anomaly[] = [];
  for (let i = WINDOW; i < series.length; i++) {
    const prior = series.slice(i - WINDOW, i).map((s) => s.cost);
    const mean = prior.reduce((s, x) => s + x, 0) / WINDOW;
    const { date, cost } = series[i];
    if (mean <= 0 || cost < MIN_COST_MYR) continue;
    const ratio = cost / mean;
    if (ratio >= THRESHOLD_RATIO) {
      out.push({
        date,
        observed_cost_myr: Math.round(cost * 100) / 100,
        trailing_mean_myr: Math.round(mean * 100) / 100,
        ratio: Math.round(ratio * 100) / 100,
        threshold_ratio: THRESHOLD_RATIO,
        explanation: `Unusual cost spike: RM${cost.toFixed(2)} is ${ratio.toFixed(1)}x the previous 7-day average of RM${mean.toFixed(2)}.`,
      });
    }
  }
  return out;
}
