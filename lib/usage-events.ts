import {z} from 'zod';
import type {DailyUsage} from './demo-forecast';

// Exact dataset headers. Already-parsed CSV rows must use numeric values.
// Avoided cost is a counterfactual estimate, never part of observed charges.
export const usageEventSchema=z.object({
 request_id:z.string().min(1),tenant_id:z.string().min(1),app_id:z.string().min(1),
 timestamp_utc:z.iso.datetime(),source:z.enum(['real','simulated']),
 provider:z.string().nullable(),model_used:z.string().nullable(),
 status:z.enum(['success','cache_hit','error','blocked']),
 cache_type:z.enum(['miss','exact_hit','semantic_hit','bypass']),
 input_tokens:z.number().int().nonnegative().nullable(),output_tokens:z.number().int().nonnegative().nullable(),
 actual_provider_cost_usd:z.number().finite().nonnegative().nullable(),
 usd_to_myr_rate:z.number().finite().positive().nullable(),
 estimated_avoided_cost_usd:z.number().finite().nonnegative().nullable(),
 latency_ms:z.number().finite().nonnegative().nullable(),
});
export type UsageEvent=z.infer<typeof usageEventSchema>;
export const datasetFields=Object.keys(usageEventSchema.shape);
export function aggregateUsageEvents(input:unknown[],scope:{tenantId:string;appId:string;source:UsageEvent['source'];timezone:string}):DailyUsage[]{
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:scope.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
 const seen=new Set<string>();const days=new Map<string,DailyUsage>();
 for(const raw of input){
  const event=usageEventSchema.parse(raw);
  if(event.tenant_id!==scope.tenantId||event.app_id!==scope.appId||event.source!==scope.source)continue;
  if(seen.has(event.request_id))throw new Error('Duplicate request_id');seen.add(event.request_id);
  if(event.actual_provider_cost_usd===null||event.usd_to_myr_rate===null)throw new Error('Unavailable provider charge or FX rate');
  if(event.input_tokens===null||event.output_tokens===null)throw new Error('Unavailable token counts; partial aggregates require availability metadata');
  const parts=formatter.formatToParts(new Date(event.timestamp_utc));
  const part=(name:string)=>parts.find(p=>p.type===name)!.value;
  const date=`${part('year')}-${part('month')}-${part('day')}`;
  const day=days.get(date)??{date,cost:0,requests:0,inputTokens:0,outputTokens:0,exactHits:0,source:event.source};
  day.cost+=event.actual_provider_cost_usd*event.usd_to_myr_rate;day.requests++;
  day.inputTokens+=event.input_tokens;day.outputTokens+=event.output_tokens;
  if(event.cache_type==='exact_hit')day.exactHits++;
  day.providers=[...new Set([...(day.providers??[]),event.provider??'Unavailable'])].sort();
  day.models=[...new Set([...(day.models??[]),event.model_used??'Unavailable'])].sort();
  days.set(date,day);
 }
 return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
