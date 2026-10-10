import type { DailyUsage } from "./forecast";
// Fixed local billing dates make the demonstration reproducible on any device.
export const AS_OF="2026-10-10";
export const demoUsage:DailyUsage[]=Array.from({length:120},(_,i)=>{
  const date=new Date(Date.UTC(2026,5,12+i));
  const day=date.getUTCDay();
  const cost=Math.round((4.4+i*0.022+(day===0||day===6?-1.3:1.1)+(i%9)*0.18+(i===103?14:0))*100)/100;
  const requests=Math.round(cost*34); const exactHits=Math.round(requests*(0.2+(i%5)*0.015));
  return {date:date.toISOString().slice(0,10),cost,requests,inputTokens:requests*820,outputTokens:(requests-exactHits)*190,exactHits,source:"simulated",providers:["Anthropic"],models:["Demo model"]};
});
export function historicalBudget(rows:DailyUsage[],asOf:string) {
  const totals=new Map<string,{cost:number;days:number}>();
  for(const row of rows.filter(r=>r.date.slice(0,7)<asOf.slice(0,7))) {
    const key=row.date.slice(0,7);const value=totals.get(key)??{cost:0,days:0};value.cost+=row.cost;value.days++;totals.set(key,value);
  }
  const months=[...totals].filter(([month,value])=>value.days===new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate()).map(([,v])=>v.cost).sort((a,b)=>a-b);
  const mid=Math.floor(months.length/2);
  return {amount:months.length?Math.ceil((months.length%2?months[mid]:(months[mid-1]+months[mid])/2)*1.1):null,months:months.length};
}
export function anomalies(rows:DailyUsage[]) {
  return rows.flatMap((row,index)=>{
    const past=rows.slice(Math.max(0,index-7),index);if(past.length<7)return [];
    const baseline=past.reduce((sum,r)=>sum+r.cost,0)/7;
    return baseline>0 && row.cost>baseline*1.8 && row.cost-baseline>5?[{date:row.date,cost:row.cost,baseline,ratio:row.cost/baseline}]:[];
  });
}
