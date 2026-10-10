import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateUsageEvents,usageEventSchema} from '../lib/usage-events.ts';
const row={request_id:'req1',tenant_id:'tenant1',app_id:'app1',timestamp_utc:'2026-10-01T18:00:00Z',source:'real',provider:'openai',model_used:'example',status:'success',cache_type:'miss',input_tokens:100,output_tokens:20,actual_provider_cost_usd:2,usd_to_myr_rate:4.2,estimated_avoided_cost_usd:10,latency_ms:240};
test('request costs use recorded FX, local billing dates, and isolated tenant/app/source',()=>{
 const rows=aggregateUsageEvents([row,{...row,request_id:'other',tenant_id:'other',actual_provider_cost_usd:100}],{tenantId:'tenant1',appId:'app1',source:'real',timezone:'Asia/Kuala_Lumpur'});
 assert.equal(rows.length,1);assert.equal(rows[0].date,'2026-10-02');assert.equal(rows[0].cost,8.4);assert.equal(rows[0].requests,1);
});
test('duplicates and unavailable charges cannot silently inflate or zero spending',()=>{
 assert.throws(()=>aggregateUsageEvents([row,row],{tenantId:'tenant1',appId:'app1',source:'real',timezone:'UTC'}),/Duplicate/);
 assert.throws(()=>aggregateUsageEvents([{...row,actual_provider_cost_usd:null}],{tenantId:'tenant1',appId:'app1',source:'real',timezone:'UTC'}),/Unavailable/);
 assert.equal(usageEventSchema.safeParse({...row,usd_to_myr_rate:0}).success,false);
});
