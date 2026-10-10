export type DailyUsage = { date: string; cost: number; requests: number; inputTokens: number; outputTokens: number; exactHits: number; source: "simulated" | "real"; providers?:string[]; models?:string[] };
const DAY = 86_400_000;
export function dateKey(date: Date) { return date.toISOString().slice(0, 10); }
function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || dateKey(date) !== value) throw new Error("Invalid calendar date");
  return date;
}
function validated(rows: DailyUsage[]) {
  const seen = new Set<string>();
  for (const row of rows) {
    parseDate(row.date);
    if (!Number.isFinite(row.cost) || row.cost < 0 || seen.has(row.date)) throw new Error("Invalid or duplicate daily observation");
    seen.add(row.date);
  }
  return [...rows].sort((a,b)=>a.date.localeCompare(b.date));
}
export function forecast(rows: DailyUsage[], asOf: string, budget: number) {
  if (!Number.isFinite(budget) || budget <= 0) throw new Error("Budget must be positive");
  const origin = parseDate(asOf);
  const month = asOf.slice(0, 7);
  const last = new Date(Date.UTC(origin.getUTCFullYear(),origin.getUTCMonth()+1,0));
  const remainingDays = last.getUTCDate()-origin.getUTCDate()+1;
  const history = validated(rows).filter(row=>row.date<asOf);
  const start = dateKey(new Date(origin.getTime()-7*DAY));
  const recent = history.filter(row=>row.date>=start);
  const actual = history.filter(row=>row.date.startsWith(month)).reduce((sum,row)=>sum+row.cost,0);
  const dailyRate = recent.length ? recent.reduce((sum,row)=>sum+row.cost,0)/recent.length : null;
  const remaining = dailyRate===null ? null : dailyRate*remainingDays;
  const projected = remaining===null ? null : actual+remaining;
  let crossingDate: string|null = null;
  const series: {date:string; actual?:number; predicted?:number}[] = [];
  let cumulative=0;
  for(let day=1;day<origin.getUTCDate();day++) {
    const key=`${month}-${String(day).padStart(2,'0')}`;
    const observation=history.find(row=>row.date===key);
    if(observation) cumulative+=observation.cost;
    if(!crossingDate && cumulative>=budget) crossingDate=key;
    series.push({date:key,actual:cumulative});
  }
  if(dailyRate!==null) {
    if(series.length) series[series.length-1].predicted=actual;
    for(let day=origin.getUTCDate();day<=last.getUTCDate();day++) {
      const date=`${month}-${String(day).padStart(2,'0')}`;
      const predicted=actual+dailyRate*(day-origin.getUTCDate()+1);
      series.push({date,predicted});
      if(!crossingDate && predicted>=budget) crossingDate=date;
    }
  }
  return {actual, projected, remaining, dailyRate,actualPct:100*actual/budget,projectedPct:projected===null?null:100*projected/budget,overrun:projected===null?null:Math.max(0,projected-budget),crossingDate,remainingDays,historyDays:recent.length,lowData:recent.length<7,series};
}
export function backtest(rows: DailyUsage[]) {
  const sorted=validated(rows); const errors:number[]=[];
  // Each held-out day sees only the previous seven calendar days.
  for(const target of sorted) {
    const start=dateKey(new Date(parseDate(target.date).getTime()-7*DAY));
    const past=sorted.filter(row=>row.date>=start && row.date<target.date);
    if(past.length===7) errors.push(Math.abs(target.cost-past.reduce((sum,row)=>sum+row.cost,0)/7));
  }
  return {mae:errors.length?errors.reduce((sum,error)=>sum+error,0)/errors.length:null,samples:errors.length};
}
