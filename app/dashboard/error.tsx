"use client";
import {Button} from "@/components/ui/button";
export default function DashboardError({reset}:{reset:()=>void}){return <div className="empty-state" role="alert"><h1>We couldn’t load this view</h1><p>Your demo settings are unaffected. Retry this page.</p><Button onClick={reset}>Try again</Button></div>;}
