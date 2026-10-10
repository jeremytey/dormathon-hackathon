"use client";
import {money,shortDate} from "@/lib/format";
import {useState,useRef,useLayoutEffect} from "react";
const W=850,H=240,L=48,R=20,T=18,B=35;
type Anchor={x:number;y:number;width:number;height:number};
function ChartTooltip({anchor,children}:{anchor:Anchor|null;children:React.ReactNode}){
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!anchor||!ref.current)return;
    const {width,height}=ref.current.getBoundingClientRect();
    const left=Math.max(8,Math.min(anchor.x+12+width>anchor.width?anchor.x-width-12:anchor.x+12,anchor.width-width-8));
    const top=Math.max(8,Math.min(anchor.y-height-12,anchor.height-height-8));
    ref.current.style.left=`${left}px`;
    ref.current.style.top=`${top}px`;
  },[anchor,children]);
  return <div ref={ref} className="chart-hover-detail" role="tooltip" style={{right:"auto",maxWidth:anchor?Math.max(0,anchor.width-16):undefined}}>{children}</div>;
}
function useChartAnchor(){
  const [anchor,setAnchor]=useState<Anchor|null>(null);
  const move=(event:React.PointerEvent<SVGRectElement>|React.FocusEvent<SVGRectElement>)=>{
    const container=event.currentTarget.closest('.chart-interactive');if(!container)return;
    const bounds=container.getBoundingClientRect();const mark=event.currentTarget.getBoundingClientRect();
    const x='clientX' in event?event.clientX:mark.left+mark.width/2;
    const y='clientY' in event?event.clientY:mark.top+mark.height/2;
    setAnchor({x:x-bounds.left,y:y-bounds.top,width:bounds.width,height:bounds.height});
  };
  return {anchor,move};
}
export function SpendingChart({series,budget}:{series:{date:string;actual?:number;predicted?:number}[];budget:number}) {
  const [active,setActive]=useState<number|null>(null);
  const hover=useChartAnchor();
  const selected=active===null?null:series[active];
  const max=Math.max(budget,...series.map(p=>Math.max(p.actual??0,p.predicted??0)))*1.16;
  const x=(i:number)=>L+i*(W-L-R)/Math.max(1,series.length-1);const y=(v:number)=>H-B-v/max*(H-T-B);
  const path=(key:"actual"|"predicted")=>series.map((p,i)=>p[key]===undefined?"":`${i===0||series[i-1][key]===undefined?"M":"L"}${x(i)},${y(p[key]!)}`).filter(Boolean).join(" ");
  const observed=series.filter(s=>s.actual!==undefined);const last=observed[observed.length-1];
  return <div className="chart-container chart-interactive"><svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Cumulative October spend. Observed ${money(last?.actual??0)}; projected ${money(series[series.length-1]?.predicted??null)}; budget ${money(budget)}.`} onPointerLeave={()=>setActive(null)}>
    {[0,1,2,3].map(i=><g key={i}><line x1={L} x2={W-R} y1={y(max*i/3)} y2={y(max*i/3)} stroke="#efeeec"/><text x={L-10} y={y(max*i/3)+4} textAnchor="end" className="chart-label">{Math.round(max*i/3)}</text></g>)}
    <line x1={L} x2={W-R} y1={y(budget)} y2={y(budget)} stroke="#a39e98" strokeDasharray="5 5"/><text x={W-R} y={y(budget)-8} textAnchor="end" className="chart-label">Budget {money(budget)}</text>
    <path d={path("actual")} fill="none" stroke="#31302e" strokeWidth="2.5"/><path d={path("predicted")} fill="none" stroke="#0075de" strokeWidth="2.5" strokeDasharray="6 5"/>
    {last&&<circle cx={x(series.indexOf(last))} cy={y(last.actual!)} r="4" fill="#31302e" stroke="white" strokeWidth="2"/>}
    {series.filter((_,i)=>i%5===0||i===series.length-1).map(p=><text key={p.date} x={x(series.indexOf(p))} y={H-8} textAnchor="middle" className="chart-label">{shortDate(p.date)}</text>)}
    {selected&&active!==null&&<g pointerEvents="none"><line x1={x(active)} x2={x(active)} y1={T} y2={H-B} stroke="#a39e98" strokeDasharray="3 4"/>{selected.actual!==undefined&&<circle cx={x(active)} cy={y(selected.actual)} r="5" fill="#31302e" stroke="white" strokeWidth="2"/>}{selected.predicted!==undefined&&<circle cx={x(active)} cy={y(selected.predicted)} r="5" fill="#31302e" stroke="white" strokeWidth="2"/>}</g>}
    {series.map((p,i)=><rect key={`hit-${p.date}`} x={Math.max(L,x(i)-(W-L-R)/Math.max(1,series.length-1)/2)} y={T} width={(W-L-R)/Math.max(1,series.length-1)} height={H-T-B} fill="transparent" tabIndex={0} role="button" aria-label={`${shortDate(p.date)}${p.actual!==undefined?`, observed ${money(p.actual)}`:""}${p.predicted!==undefined?`, projected ${money(p.predicted)}`:""}, budget ${money(budget)}`} onPointerEnter={event=>{setActive(i);hover.move(event);}} onPointerMove={hover.move} onPointerDown={event=>{setActive(i);hover.move(event);}} onFocus={event=>{setActive(i);hover.move(event);}} onBlur={()=>setActive(null)} onKeyDown={event=>{if(event.key==="Escape")setActive(null);}}/>)}
  </svg>{selected&&<ChartTooltip anchor={hover.anchor}><strong>{shortDate(selected.date)}</strong>{selected.actual!==undefined&&<span>Observed {money(selected.actual)}</span>}{selected.predicted!==undefined&&<span>Projected {money(selected.predicted)}</span>}<span>Budget {money(budget)}</span></ChartTooltip>}<div className="chart-legend"><span><i className="legend-actual"/>Observed spend</span><span><i className="legend-predicted"/>Projected spend</span><span><i className="legend-budget"/>Monthly budget</span></div></div>;
}
export function DailyChart({rows}:{rows:{date:string;cost:number}[]}) {
  const [active,setActive]=useState<number|null>(null);
  const hover=useChartAnchor();
  const max=Math.max(1,...rows.map(r=>r.cost))*1.2;const bar=(W-L-R)/Math.max(1,rows.length);
  return <div className="chart-container chart-interactive"><svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Daily provider spending in MYR; exact values appear in the daily usage table." onPointerLeave={()=>setActive(null)}>
  {[0,1,2,3].map(i=><g key={i}><line x1={L} x2={W-R} y1={H-B-max*i/3/max*(H-T-B)} y2={H-B-max*i/3/max*(H-T-B)} stroke="#efeeec"/><text x={L-10} y={H-B-i/3*(H-T-B)+4} textAnchor="end" className="chart-label">{(max*i/3).toFixed(0)}</text></g>)}
  {rows.map((r,i)=><g key={r.date}><rect x={L+i*bar+bar*0.17} y={H-B-r.cost/max*(H-T-B)} width={bar*0.66} height={r.cost/max*(H-T-B)} rx="3" fill={active===i?"#31302e":i===rows.length-1?"#0075de":"#c5dff5"}/><rect x={L+i*bar} y={T} width={bar} height={H-T-B} fill="transparent" tabIndex={0} role="button" aria-label={`${shortDate(r.date)}: ${money(r.cost)}`} onPointerEnter={event=>{setActive(i);hover.move(event);}} onPointerMove={hover.move} onPointerDown={event=>{setActive(i);hover.move(event);}} onFocus={event=>{setActive(i);hover.move(event);}} onBlur={()=>setActive(null)} onKeyDown={event=>{if(event.key==="Escape")setActive(null);}}/>{i%4===0&&<text x={L+i*bar+bar/2} y={H-8} textAnchor="middle" className="chart-label">{shortDate(r.date)}</text>}</g>)}
  </svg>{active!==null&&rows[active]&&<ChartTooltip anchor={hover.anchor}><strong>{shortDate(rows[active].date)}</strong><span>Provider spend {money(rows[active].cost)}</span></ChartTooltip>}</div>;
}
