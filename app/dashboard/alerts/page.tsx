"use client";
import Link from "next/link";
import {useState} from "react";
import {Activity,AlertTriangle,Check,CheckCircle2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {useDemo} from "@/components/dashboard/provider";
import {PageHeader,DemoInfo} from "@/components/dashboard/common";
import {shortDate} from "@/lib/format";
export default function AlertsPage() {
  const d=useDemo();const [filter,setFilter]=useState<"all"|"open">("all");const alerts=d.alerts.filter(a=>filter==="all"||!d.acknowledged[a.id]);
  return <><PageHeader title="Alerts & recommendations" description="Catch the signal early. Choose your next step deliberately."/>
  <div className="alerts-toolbar"><div className="segmented-control"><Button size="sm" variant={filter==="all"?"secondary":"ghost"} aria-pressed={filter==="all"} onClick={()=>setFilter("all")}>All alerts <span className="small-count">{d.alerts.length}</span></Button><Button size="sm" variant={filter==="open"?"secondary":"ghost"} aria-pressed={filter==="open"} onClick={()=>setFilter("open")}>Needs review <span className="small-count">{d.alerts.filter(a=>!d.acknowledged[a.id]).length}</span></Button></div><span className="muted">As of 10 Oct 2026</span></div>
  <div className="alert-cards">{alerts.map(a=><article key={a.id} className={`alert-card ${d.acknowledged[a.id]?"acknowledged":""}`}><span className={`attention-icon ${a.kind==="Forecast"?"orange":""}`}>{a.kind==="Anomaly"?<Activity size={21}/>:<AlertTriangle size={21}/>}</span><div className="alert-content"><div className="alert-meta"><Badge variant="outline">{a.kind}</Badge><span>{shortDate(a.date)} · Simulated</span>{d.acknowledged[a.id]&&<span className="ack-label"><Check size={13}/>Acknowledged</span>}</div><h2>{a.title}</h2><p>{a.detail}</p><div className="recommendation"><strong>Recommended action</strong><p>{d.policy.mode==="manual"?"Manual mode: review the warning and explicitly choose a policy change.":d.policy.mode==="adaptive"?"Adaptive mode: consider only approved, eligible controls. Live activation requires the gateway.":"Always-on mode: review selected controls and keep cache safety exclusions in place."}</p></div><div className="alert-actions"><Button variant="outline" size="sm" disabled={Boolean(d.acknowledged[a.id])} onClick={()=>d.acknowledge(a.id)}>{d.acknowledged[a.id]?<><Check size={14}/>Acknowledged</>:"Acknowledge alert"}</Button><Button variant="ghost" size="sm" asChild><Link href="/dashboard/settings">Review policy settings</Link></Button></div></div></article>)}</div>
  {alerts.length===0&&<div className="empty-state"><CheckCircle2 size={36}/><h2>{filter==="open"?"You’re all caught up":"No active warnings"}</h2><p>{filter==="open"?"All current alerts have been acknowledged. Your saved policy is unchanged.":"The simulated usage is within your saved warning thresholds."}</p><Button variant="outline" onClick={()=>setFilter("all")}>View all alerts</Button></div>}
  <DemoInfo>Acknowledgement records that you have seen a warning. It does not approve optimisation, increase your budget, or override a hard stop.</DemoInfo></>;
}
