import {DemoProvider} from "@/components/dashboard/provider";
import {DashboardShell} from "@/components/dashboard/shell";
export default function DashboardLayout({children}:{children:React.ReactNode}) {return <DemoProvider><DashboardShell>{children}</DashboardShell></DemoProvider>;}
