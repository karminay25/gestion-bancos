"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Building2,
  Plus,
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { NewMovementForm } from "@/components/NewMovementForm";
import { useAuth } from "@/context/AuthContext";
import { calculateAccountBalance, sortMovements } from "@/lib/balances";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [tc, setTc] = useState<number>(17.50);
  const [showCapture, setShowCapture] = useState(false);
  const [captureMode, setCaptureMode] = useState<"manual" | "import">("manual");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      const [{ data: comp }, { data: acc }] = await Promise.all([
        supabase.from('empresas').select('*'),
        supabase.from('cuentas_bancarias').select('*')
      ]);

      if (comp) setCompanies(comp);
      if (acc) setAccounts(acc);

      let allMovs: any[] = [];
      let from = 0;
      let to = 999;
      let hasMore = true;

      while (hasMore) {
          const { data, error } = await supabase
            .from('movimientos')
            .select('*, cuentas_bancarias(moneda, empresas(codigo))')
            .order('fecha', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to);
          
          if (error) {
              console.error('Error fetching movements:', error);
              hasMore = false;
          } else if (!data || data.length === 0) {
              hasMore = false;
          } else {
              allMovs = [...allMovs, ...data];
              if (data.length < 1000) hasMore = false;
              else {
                  from += 1000;
                  to += 1000;
              }
          }
      }

      // Ensure uniqueness and sort globally to be absolutely sure of chronological order
      const uniqueMovs = sortMovements(Array.from(new Map(allMovs.map(m => [m.id, m])).values()));

      console.log(`[Dashboard] Fetched ${uniqueMovs.length} unique movements across all accounts.`);
      setAllMovements(uniqueMovs);
      setLoading(false);
    }
    fetchData();
  }, [refreshKey]);

  const bankSummary = useMemo(() => {
    return companies.map(company => {
      const companyAccounts = accounts.filter(a => a.empresa_id === company.id);
      const banks = ['BBVA', 'MONEX', 'BAJIO'];
      
      let rows: any[] = [];

      const calculateBalance = (accs: any[]) => {
          return accs.reduce((sum, acc) => {
              const accMoves = allMovements.filter(m => m.cuenta_id === acc.id);
              const current = calculateAccountBalance(accMoves);

              if (acc.descripcion.includes('PESOS')) {
                  console.log(`[BalanceTrace] Account: ${acc.descripcion}, Final result: ${current}`);
              }

              return sum + current;
          }, 0);
      };
      
      banks.forEach(bank => {
        const bankAccounts = companyAccounts.filter(a => {
            const matchesBank = a.banco.toUpperCase().includes(bank) || (a.descripcion && a.descripcion.toUpperCase().includes(bank));
            if (bank === 'BAJIO') return matchesBank && !a.descripcion?.toUpperCase().includes('CREDITO');
            return matchesBank;
        });

        if (bankAccounts.length > 0) {
            const mxn = calculateBalance(bankAccounts.filter(a => a.moneda === 'MXN'));
            const usd = calculateBalance(bankAccounts.filter(a => a.moneda === 'USD'));
            rows.push({ bank, mxn, usd });
        }
      });

      const creditoAccounts = companyAccounts.filter(a => a.descripcion?.toUpperCase().includes('CREDITO BAJIO'));
      if (creditoAccounts.length > 0) {
          rows.push({ bank: 'BAJIO CREDITO', mxn: 0, usd: calculateBalance(creditoAccounts) });
      }

      return {
        ...company,
        rows,
        totalMXN: rows.reduce((s, r) => s + r.mxn, 0),
        totalUSD: rows.reduce((s, r) => s + r.usd, 0)
      };
    });
  }, [companies, accounts, allMovements]);

  const grandTotalMXN = bankSummary.reduce((s, c) => s + c.totalMXN, 0);
  const grandTotalUSD = bankSummary.reduce((s, c) => s + c.totalUSD, 0);
  const totalConsolidadoPesos = grandTotalMXN + (grandTotalUSD * tc);
  const [isCaptureMode, setIsCaptureMode] = useState(false);

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh]">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="mt-4 text-zinc-500 font-medium italic">Sincronizando estados financieros reales...</p>
        </div>
    );
  }

  return (
    <div className={cn("space-y-6 pb-10 transition-all duration-500", isCaptureMode && "fixed inset-0 z-[100] bg-white dark:bg-zinc-950 p-4 overflow-y-auto space-y-2 pb-6")}>
      {/* Header */}
      <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", isCaptureMode && "mb-2")}>
        <div>
          <h1 className={cn("text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 transition-all", isCaptureMode && "text-xl")}>Resumen Ejecutivo</h1>
          {!isCaptureMode && <p className="text-zinc-400 text-xs font-medium">Saldos reales sincronizados desde la base de datos.</p>}
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCaptureMode(!isCaptureMode)}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold transition-all active:scale-95",
              isCaptureMode ? "bg-rose-500 text-white shadow-xl shadow-rose-500/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
            )}
          >
            {isCaptureMode ? "Salir de Captura" : "Modo Captura"}
          </button>
          {!isCaptureMode && isAdmin && (
            <>
              <button
                onClick={() => { setCaptureMode("import"); setShowCapture(true); }}
                className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-zinc-50 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95"
              >
                <FileSpreadsheet className="w-5 h-5" />
                Importar Excel Bancario
              </button>
              <button
                onClick={() => { setCaptureMode("manual"); setShowCapture(true); }}
                className="flex items-center gap-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800 px-6 py-3 text-sm font-bold text-zinc-900 dark:text-zinc-50 hover:bg-zinc-200 transition-all active:scale-95">
                <Plus className="w-5 h-5" />
                Captura Manual
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-sm overflow-hidden relative">
        <div className={cn("p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50", isCaptureMode && "p-2")}>
          <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-tighter">Saldos Bancos Diarios</h3>
          <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-zinc-400">
            <span className="w-32 text-center text-emerald-600">Pesos (MXN)</span>
            <span className="w-32 text-center text-blue-600">Dólares (USD)</span>
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {bankSummary.map((company) => (
            <div key={company.id}>
              <div className={cn("bg-zinc-50 dark:bg-zinc-900 px-6 py-2 border-y border-zinc-100 dark:border-zinc-800", isCaptureMode && "px-4 py-1")}>
                <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-50 uppercase tracking-widest">{company.nombre_completo}</h4>
              </div>
              <div className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {company.rows.map((row: any) => (
                  <div key={row.bank} className={cn("px-6 py-3 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors", isCaptureMode && "px-4 py-1")}>
                    <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400 uppercase">{row.bank}</span>
                    <div className="flex items-center gap-4 font-mono text-sm">
                      <span className={cn("w-32 text-right font-black", row.mxn < 0 ? "text-red-500" : "text-zinc-900 dark:text-zinc-50")}>
                        {row.mxn !== 0 ? `$${row.mxn.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '-'}
                      </span>
                      <span className={cn("w-32 text-right font-black", row.usd < 0 ? "text-red-500" : "text-blue-600 dark:text-blue-400")}>
                        {row.usd !== 0 ? `$${row.usd.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '-'}
                      </span>
                    </div>
                  </div>
                ))}
                <div className={cn("px-6 py-3 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/10", isCaptureMode && "px-4 py-1")}>
                  <span className="text-xs font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest ml-auto mr-4">Total {company.codigo}</span>
                  <div className="flex items-center gap-4 font-mono text-sm border-t border-zinc-200 dark:border-zinc-800 pt-2">
                    <span className="w-32 text-right font-black text-zinc-900 dark:text-zinc-50">
                      ${company.totalMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="w-32 text-right font-black text-blue-600 dark:text-blue-400">
                      ${company.totalUSD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={cn("p-6 bg-zinc-900 dark:bg-zinc-900/50 text-white flex items-center justify-between", isCaptureMode && "p-3")}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-800 rounded-2xl">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <h4 className="text-lg font-black uppercase tracking-tighter">Total Bancos Consolidado</h4>
          </div>
          <div className="flex items-center gap-4 font-mono text-lg text-right">
            <span className="w-32 font-black text-emerald-400">${grandTotalMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            <span className="w-32 font-black text-blue-400">${grandTotalUSD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* TC & Final Result */}
      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 items-end", isCaptureMode && "gap-3")}>
        <div className={cn("bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm", isCaptureMode && "p-3 rounded-[1rem]")}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-1">Configuración Monetaria</p>
              <h4 className="text-xl font-black text-zinc-900 dark:text-zinc-50">Tipo de Cambio (TC)</h4>
            </div>
            <div className="bg-primary/10 p-3 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
            <input 
              type="number" 
              value={tc}
              onChange={(e) => setTc(parseFloat(e.target.value) || 0)}
              step="0.01"
              className={cn("w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl py-4 pl-10 pr-4 text-2xl font-black text-zinc-900 dark:text-zinc-50 focus:ring-2 focus:ring-primary transition-all text-right", isCaptureMode && "py-2 text-xl")}
            />
            <p className="mt-3 text-[10px] text-zinc-500 font-black uppercase tracking-widest italic text-center">
              * Ajusta este valor para ver la liquidez proyectada en pesos
            </p>
          </div>
        </div>

        <div className={cn("bg-yellow-400 p-6 rounded-[2rem] shadow-2xl shadow-yellow-400/30 flex flex-col justify-between h-full group hover:scale-[1.02] transition-all duration-500 border-4 border-yellow-500/20", isCaptureMode && "p-3 rounded-[1rem]")}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-900/60">Balance Global Consolidado</p>
            </div>
            <h4 className="text-sm font-black text-yellow-900 uppercase tracking-widest">Total Pesos (MXN + USD@TC)</h4>
          </div>
          <div className="mt-4 flex items-baseline justify-end gap-2">
            <h2 className="text-4xl font-black text-yellow-950 tracking-tighter">
              ${totalConsolidadoPesos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </h2>
            <span className="text-lg font-black text-yellow-900/40">MXN</span>
          </div>
        </div>
      </div>

      {/* Capture Modal (Unified) */}
      {showCapture && (
        <NewMovementForm 
            onClose={() => setShowCapture(false)} 
            initialTab={captureMode}
            onSuccess={() => setRefreshKey(prev => prev + 1)} 
        />
      )}
    </div>
  );
}
