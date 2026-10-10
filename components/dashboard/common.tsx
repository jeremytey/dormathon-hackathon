import Link from "next/link";
import {ArrowRight,ArrowUpRight,CalendarDays,Info,TrendingUp} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {Card,CardContent} from "@/components/ui/card";
import {money,percent} from "@/lib/format";

export function PageHeader({title,description,children}:{title:string;description:string;children?:React.ReactNode}) {return <div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="page-actions">{children??<span className="date-chip"><CalendarDays size={15}/>October 2026</span>}</div></div>;}
export function RiskBadge({risk}:{risk:string}) {return <Badge variant="outline" className={`risk-badge ${risk==="Normal"?"risk-normal":"risk-warning"}`}><span/>{risk}</Badge>;}
export function Stat({label,value,note,icon:Icon,highlight=false}:{label:string;value:string;note:string;icon:React.ComponentType<{size?:number}>;highlight?:boolean}) {return <Card className={`stat-card ${highlight?"stat-highlight":""}`}><CardContent><div className="stat-label">{label}<Icon size={17}/></div><div className="stat-value">{value}</div><p>{note}</p></CardContent></Card>;}
export function Panel({title,description,children,action}:{title:string;description?:string;children:React.ReactNode;action?:React.ReactNode}) {return <section className="panel"><div className="panel-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>{children}</section>;}
export function ForecastCallout({projected,overrun,pct,actualPct}:{projected:number|null;overrun:number|null;pct:number|null;actualPct:number}) {return <div className="forecast-callout"><span className="callout-icon"><TrendingUp size={20}/></span><div><strong>{actualPct>=100?"Your observed spending has exceeded the budget":overrun!==null&&overrun>0?"A heads-up before the budget is reached":"Your month-end projection"}</strong><p>{projected===null?"There is not enough recent history to calculate a forecast.":`${money(projected)} projected at month-end (${percent(pct)} of budget). ${overrun&&overrun>0?`${money(overrun)} above your saved budget.`:"Currently within your saved budget."}`}</p></div><Button variant="outline" asChild><Link href="/dashboard/forecast">View forecast <ArrowRight size={14}/></Link></Button></div>;}
export function DemoInfo({children}:{children?:React.ReactNode}) {return <div className="info-note"><Info size={15}/><span>{children??"All figures are simulated. Settings are saved for this session only and reset when you refresh."}</span></div>;}
export function TextLink({href,children}:{href:string;children:React.ReactNode}) {return <Link className="text-link" href={href}>{children}<ArrowUpRight size={14}/></Link>;}
