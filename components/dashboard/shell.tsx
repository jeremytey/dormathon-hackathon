"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState,useRef,useEffect} from "react";
import {ArrowUpRight,BarChart3,Bell,ChevronDown,ChevronsUpDown,LayoutDashboard,Menu,Settings2,ShieldCheck,Sparkles,TrendingUp,X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useDemo} from "./provider";

const navigation=[{href:"/dashboard",label:"Overview",icon:LayoutDashboard},{href:"/dashboard/usage",label:"Usage & costs",icon:BarChart3},{href:"/dashboard/forecast",label:"Forecast",icon:TrendingUp},{href:"/dashboard/alerts",label:"Alerts",icon:Bell},{href:"/dashboard/settings",label:"Budget & policies",icon:Settings2}];
export function DashboardShell({children}:{children:React.ReactNode}) {
  const pathname=usePathname();const [open,setOpen]=useState(false);const demo=useDemo();
  const drawer=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(open)drawer.current?.showModal();else drawer.current?.close();},[open]);
  useEffect(()=>{const media=window.matchMedia("(min-width: 768px)");const close=()=>{if(media.matches)setOpen(false);};media.addEventListener("change",close);return()=>media.removeEventListener("change",close);},[]);
  const unread=demo.alerts.filter(a=>!demo.acknowledged[a.id]).length;
  const sidebarContent=<>
      <Link href="/dashboard" onClick={()=>setOpen(false)} className="brand"><span className="brand-mark"><ShieldCheck size={21}/></span>TokenGuard<span className="brand-ai">AI</span></Link>
      <div className="workspace"><span className="workspace-avatar">L</span><div><strong>Lumora Technologies</strong><span>Business workspace</span></div><ChevronsUpDown size={14} className="muted"/></div>
      <div className="nav-label">Workspace</div>
      <nav>{navigation.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)} aria-current={pathname===item.href?"page":undefined} className={`nav-item ${pathname===item.href?"active":""}`}><item.icon size={18}/><span>{item.label}</span>{item.label==="Alerts"&&unread>0&&<span className="nav-count">{unread}</span>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="demo-note"><Sparkles size={17}/><strong>Your demo workspace</strong><p>Explore predictions with simulated data. No live requests or charges.</p><Link href="/dashboard/forecast" onClick={()=>setOpen(false)}>Explore the forecast <ArrowUpRight size={14}/></Link></div><div className="profile"><span className="profile-avatar">LT</span><div><strong>Lumora team</strong><span>Demo administrator</span></div><ChevronDown size={14}/></div></div>
    </>;
  return <div className="dashboard-shell">
    <aside className="sidebar desktop-sidebar" aria-label="Dashboard navigation">{sidebarContent}</aside>
    <dialog ref={drawer} className="mobile-drawer" aria-label="Workspace navigation" onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}><aside className="sidebar drawer-sidebar"><Button variant="ghost" size="icon" className="drawer-close" aria-label="Close navigation" onClick={()=>setOpen(false)}><X/></Button>{sidebarContent}</aside></dialog>
    <div className="main-column"><header className="topbar"><div className="breadcrumb"><Button variant="ghost" size="icon" className="mobile-menu" aria-label={open?"Close navigation":"Open navigation"} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</Button><span>Lumora workspace</span><span className="breadcrumb-slash">/</span><strong>{navigation.find(item=>item.href===pathname)?.label??"Dashboard"}</strong></div><div className="topbar-right"><span className="demo-badge"><span/>Simulated demo</span><Link href="/dashboard/alerts" aria-label={`${unread} unacknowledged alerts`} className="bell-link"><Bell size={18}/>{unread>0&&<i/>}</Link><span className="top-avatar">LT</span></div></header>
      <main id="main-content" className="page-content">{children}<footer className="page-footer"><span>TokenGuard AI · Predict early, decide better.</span><span>Simulated data · MYR · Asia/Kuala_Lumpur</span></footer></main>
      {demo.notice&&<div className="toast" role="status"><ShieldCheck size={18}/><span>{demo.notice}</span><button aria-label="Dismiss notification" onClick={()=>demo.notify("")}><X size={16}/></button></div>}
    </div>
  </div>;
}
