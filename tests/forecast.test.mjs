import test from 'node:test';
import assert from 'node:assert/strict';
import { forecast, backtest } from '../lib/demo-forecast.ts';

const row = (date, cost) => ({date, cost, requests: 10, inputTokens: 100, outputTokens: 50, exactHits: 2, source: 'simulated'});
const week = Array.from({length:7}, (_, i) => row(`2026-10-${String(i+1).padStart(2,'0')}`, 2));
test('seven-day rate projects remaining days and keeps actual and forecast risk separate', () => {
  const f = forecast(week, '2026-10-08', 50);
  assert.equal(f.actual,14); assert.equal(f.dailyRate,2); assert.equal(f.remainingDays,24);
  assert.equal(f.projected,62); assert.equal(f.actualPct,28); assert.equal(f.projectedPct,124);
  assert.equal(f.overrun,12); assert.equal(f.crossingDate,'2026-10-25');
});
test('future observations cannot leak into forecast or backtest', () => {
  assert.deepEqual(forecast([...week,row('2026-10-20',999)],'2026-10-08',50),forecast(week,'2026-10-08',50));
  const b = backtest([...week,row('2026-10-08',4)]); assert.equal(b.mae,2); assert.equal(b.samples,1);
});
test('February leap year includes current day in remaining horizon', () => {
  const rows = Array.from({length:7},(_,i)=>row(`2028-02-${21+i}`,3));
  const f=forecast(rows,'2028-02-28',100); assert.equal(f.remainingDays,2); assert.equal(f.projected,27);
});
test('previous month informs rate but not current month actual', () => {
  const rows=Array.from({length:7},(_,i)=>row(`2026-09-${24+i}`,2));
  const f=forecast(rows,'2026-10-01',100); assert.equal(f.actual,0); assert.equal(f.projected,62);
});
test('missing history yields unavailable projection, never a fabricated zero forecast', () => {
  const f=forecast([],'2026-10-08',50); assert.equal(f.projected,null); assert.equal(f.lowData,true);
});
test('sparse series is disclosed and missing calendar days do not create a seven-day sample', () => {
  const f=forecast([row('2026-10-01',5),row('2026-10-07',5)],'2026-10-08',50);
  assert.equal(f.lowData,true); assert.equal(f.dailyRate,5); assert.equal(f.historyDays,2);
});
test('invalid budgets and negative costs are rejected', () => {
  assert.throws(()=>forecast(week,'2026-10-08',0));
  assert.throws(()=>forecast([row('2026-10-07',-2)],'2026-10-08',50));
});
test('an already exceeded budget reports the first observed crossing, not today',()=>{
  assert.equal(forecast(week,'2026-10-08',5).crossingDate,'2026-10-03');
});
