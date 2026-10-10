import Link from "next/link";
export default function NotFound(){return <main className="empty-state"><h1>Page not found</h1><p>This page isn’t part of your workspace.</p><Link className="text-link" href="/dashboard">Return to overview</Link></main>;}
