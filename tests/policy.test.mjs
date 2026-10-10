import test from 'node:test';
import assert from 'node:assert/strict';
import {policySchema,defaultPolicy,riskFor} from '../lib/demo-policy.ts';
test('budget and ordered thresholds are validated before changing policy',()=>{
  assert.equal(policySchema.safeParse({...defaultPolicy,budget:0}).success,false);
  assert.equal(policySchema.safeParse({...defaultPolicy,preventive:80,high:75}).success,false);
  assert.equal(policySchema.safeParse({...defaultPolicy,critical:101}).success,false);
});
test('prediction can warn before actual spend reaches its first threshold',()=>{
  assert.equal(riskFor(28,124,defaultPolicy),'Forecast risk');
  assert.equal(riskFor(91,120,defaultPolicy),'Critical');
  assert.equal(riskFor(76,null,defaultPolicy),'High risk');
  assert.equal(riskFor(51,80,defaultPolicy),'Preventive');
});
