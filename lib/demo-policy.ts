import { z } from "zod";
export const policySchema=z.object({budget:z.number().positive("Budget must be greater than RM0").max(1_000_000),mode:z.enum(["adaptive","manual","always_on"]),preventive:z.number().positive().max(100),high:z.number().positive().max(100),critical:z.number().positive().max(100),predictive:z.number().positive().max(1000),exactCache:z.boolean(),hardStop:z.boolean()}).refine(p=>p.preventive<p.high && p.high<p.critical,{message:"Thresholds must follow preventive < high < critical ≤ 100",path:["preventive"]});
export type Policy=z.infer<typeof policySchema>;
export const defaultPolicy:Policy={budget:200,mode:"adaptive",preventive:50,high:75,critical:90,predictive:100,exactCache:true,hardStop:false};
export function riskFor(actualPct:number,projectedPct:number|null,policy:Policy) {
  if(actualPct>=policy.critical) return "Critical";
  if(actualPct>=policy.high) return "High risk";
  if(projectedPct!==null && projectedPct>=policy.predictive) return "Forecast risk";
  if(actualPct>=policy.preventive) return "Preventive";
  return "Normal";
}
