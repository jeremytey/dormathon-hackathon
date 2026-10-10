"use client";
import {createContext,useContext,useMemo,useState} from "react";
import {forecast,backtest} from "@/lib/demo-forecast";
import {AS_OF,demoUsage,anomalies,historicalBudget} from "@/lib/demo-data";
import {defaultPolicy,riskFor,type Policy} from "@/lib/demo-policy";

type DemoContextValue={policy:Policy;savePolicy:(policy:Policy)=>void;acknowledged:Record<string,boolean>;acknowledge:(id:string)=>void;notice:string;notify:(text:string)=>void};
const DemoContext=createContext<DemoContextValue|null>(null);
export function DemoProvider({children}:{children:React.ReactNode}) {
  const [policy,savePolicy]=useState(defaultPolicy);
  const [acknowledged,setAcknowledged]=useState<Record<string,boolean>>({});
  const [notice,notify]=useState("");
  const value=useMemo(()=>({policy,savePolicy,acknowledged,acknowledge:(id:string)=>{setAcknowledged(previous=>({...previous,[id]:true}));notify("Alert acknowledged. Your budget and policy have not changed.");},notice,notify}),[policy,acknowledged,notice]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
export function useDemo() {
  const value=useContext(DemoContext);if(!value)throw new Error("Missing demo provider");
  const prediction=useMemo(()=>forecast(demoUsage,AS_OF,value.policy.budget),[value.policy.budget]);
  const spikes=useMemo(()=>anomalies(demoUsage),[]);
  const risk=riskFor(prediction.actualPct,prediction.projectedPct,value.policy);
  const actualRisk=riskFor(prediction.actualPct,null,value.policy);
  const alerts=[
    ...(prediction.projectedPct!==null && prediction.projectedPct>=value.policy.predictive?[{id:`forecast-${value.policy.budget}-${value.policy.predictive}`,title:"Month-end spend is projected over your threshold",kind:"Forecast",severity:"warning",date:AS_OF,detail:`The seven-day spending baseline indicates a month-end budget risk${prediction.actualPct<value.policy.preventive?" before actual spending reaches its first warning":""}. Review eligible controls or explicitly revise your budget.`}]:[]),
    ...(prediction.actualPct>=value.policy.preventive?[{id:`actual-${actualRisk}`,title:`Actual spending has reached ${actualRisk.toLowerCase()} level`,kind:"Budget",severity:"warning",date:AS_OF,detail:"Review your spending and saved thresholds. Acknowledging this alert does not authorise extra spending."}]:[]),
    ...spikes.map(spike=>({id:`anomaly-${spike.date}`,title:"An unusual daily cost spike was detected",kind:"Anomaly",severity:"neutral",date:spike.date,detail:`Daily spending was ${spike.ratio.toFixed(1)}× the preceding seven-day mean. Check request volume and cache eligibility; the cause is not known.`}))
  ];
  return {...value,prediction,spikes,risk,alerts,usage:demoUsage,asOf:AS_OF,backtest:backtest(demoUsage),suggestion:historicalBudget(demoUsage,AS_OF)};
}
