"use client";
import Link from "next/link";
import {ArrowRight,Coins,Database,TrendingUp,Wallet,CheckCircle2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useDemo} from "@/components/dashboard/provider";
import {PageHeader,Stat,Panel,RiskBadge,ForecastCallout,DemoInfo,TextLink} from "@/components/dashboard/common";
import {SpendingChart} from "@/components/dashboard/charts";
import {money,percent,number,shortDate} from "@/lib/format";

export default function OverviewPage() {
  const d=useDemo();const f=d.prediction;const month=d.usage.filter(r=>r.date.startsWith("2026-10"));
  const requests=month.reduce((sum,r)=>sum+r.requests,0);const hits=month.reduce((sum,r)=>sum+r.exactHits,0);
  return <><PageHeader title="Your AI spending, at a glance" description="A little visibility now. Better decisions before the month ends."/>
    <div className="overview-greeting"><span className="section-kicker"><span className="live-dot"/>Lumi · Employee handbook assistant</span><RiskBadge risk={d.risk}/></div>
    <div className="stats-grid"><Stat label="Spend this month" value={money(f.actual)} note={`${percent(f.actualPct)} of your monthly budget`} icon={Wallet}/><Stat label="Monthly budget" value={money(d.policy.budget)} note="Set by you · October 2026" icon={Coins}/><Stat label="Projected month-end" value={money(f.projected)} note={`${money(f.overrun)} estimated overrun`} icon={TrendingUp} highlight/><Stat label="Exact cache hit rate" value={percent(hits/requests*100)} note={`${number(hits)} of ${number(requests)} requests`} icon={Database}/></div>
    <ForecastCallout projected={f.projected} overrun={f.overrun} pct={f.projectedPct} actualPct={f.actualPct}/>
    <div className="overview-columns"><Panel title="Spending trajectory" description="Observed spend and a seven-day rolling projection." action={<TextLink href="/dashboard/forecast">Full forecast</TextLink>}><SpendingChart series={f.series} budget={d.policy.budget}/><div className="chart-caption">As of 10 Oct · Completed days through 9 Oct · Simulated history</div></Panel>
    <Panel title="Budget health" description="Actual and projected usage are evaluated separately."><div className="budget-health"><div><span>Actual utilisation</span><strong>{percent(f.actualPct)}</strong></div><div className="meter"><span style={{width:`${Math.min(f.actualPct,100)}%`}}/></div><div><span>Projected utilisation</span><strong className="warning-text">{percent(f.projectedPct)}</strong></div><div className="meter meter-blue"><span style={{width:`${Math.min(f.projectedPct??0,100)}%`}}/></div><div className="budget-divider"/><div><span>Estimated budget crossing</span><strong>{f.crossingDate?shortDate(f.crossingDate):"Not projected"}</strong></div><div><span>Current mode</span><strong className="capitalize">{d.policy.mode.replace("_"," ")}</strong></div><div className="health-note"><CheckCircle2 size={17}/><p>No live policy is running. Your choices apply only to this demo.</p></div><Button variant="outline" asChild className="full-width"><Link href="/dashboard/settings">Manage budget & policies <ArrowRight size={14}/></Link></Button></div></Panel></div>
    <DemoInfo/>
  </>;
}
