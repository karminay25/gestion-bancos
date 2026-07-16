"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { 
  BarChart3, 
  Wallet, 
  Leaf, 
  Building2, 
  History, 
  Settings, 
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  BookUser,
  FileText
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Análisis", href: "/analisis", icon: BarChart3 },
  { name: "Movimientos", href: "/movimientos", icon: History },
  { name: "Cuentas", href: "/cuentas", icon: Wallet },
  { name: "Temporadas", href: "/temporadas", icon: Leaf },
  { name: "Terceros", href: "/terceros", icon: BookUser },
  { name: "Facturas", href: "/facturas", icon: FileText },
  { name: "Empresas", href: "/empresas", icon: Building2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebar();
  const { user, role, signOut } = useAuth();

  return (
    <div className={cn(
        "flex h-screen flex-col bg-white border-r border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 transition-all duration-300 relative",
        isCollapsed ? "w-20" : "w-64"
    )}>
      {/* Collapse Toggle Button */}
      <button 
        onClick={toggle}
        className="absolute -right-3 top-10 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border border-primary/20 hover:scale-110 active:scale-95 transition-all z-50"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className={cn("p-6 flex items-center gap-3 overflow-hidden", isCollapsed && "justify-center px-0")}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-zinc-50" />
        </div>
        {!isCollapsed && (
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                BANCOS <span className="text-primary">LBO</span>
            </h1>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : ""}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary text-zinc-50 shadow-lg shadow-primary/20" 
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
                isCollapsed && "justify-center px-0"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-zinc-50" : "text-zinc-500")} />
              {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
        {!isCollapsed && user && (
          <div className="px-3 pb-1">
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
              {(user.user_metadata?.display_name as string) || user.email}
            </p>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              {role === "admin" ? "Administrador" : "Solo lectura"}
            </p>
          </div>
        )}
        <button
          onClick={signOut}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-colors",
            isCollapsed && "justify-center px-0"
        )}>
          <LogOut className="w-5 h-5 text-zinc-500" />
          {!isCollapsed && <span className="whitespace-nowrap">Cerrar Sesión</span>}
        </button>
      </div>
    </div>
  );
}
