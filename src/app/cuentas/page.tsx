"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, 
  Plus, 
  Wallet, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  MoreHorizontal
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { calculateAccountBalance, sortMovements } from "@/lib/balances";
import NewAccountModal from "@/components/NewAccountModal";
import { useAuth } from "@/context/AuthContext";

export default function CuentasPage() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCompanies, setExpandedCompanies] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [empresas, setEmpresas] = useState<any[]>([]);

  async function fetchAccounts() {
    setLoading(true);
    
    // Fetch accounts and companies
    const [accRes, compRes] = await Promise.all([
      supabase.from('cuentas_bancarias').select('*, empresas(*)'),
      supabase.from('empresas').select('*')
    ]);

    // Fetch ALL movements using a loop to bypass the 1000 limit
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
            console.error('Error fetching movements for balances:', error);
            hasMore = false;
        } else if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allMovs = [...allMovs, ...data];
            if (data.length < 1000) {
                hasMore = false;
            } else {
                from += 1000;
                to += 1000;
            }
        }
    }

    // Ensure uniqueness and sort globally to be absolutely sure of chronological order
    const uniqueMovs = sortMovements(Array.from(new Map(allMovs.map(m => [m.id, m])).values()));

    if (accRes.data && compRes.data) {
      // Calculate balances for each account using the full unique movements list
      const accountsWithBalance = accRes.data.map(acc => {
        const accMoves = uniqueMovs.filter(m => m.cuenta_id === acc.id);
        const balance = calculateAccountBalance(accMoves);
        console.log(`[AccountCard] ${acc.banco} (${acc.descripcion}): $${balance.toLocaleString()}`);

        return { ...acc, balance };
      });

      // Group by company
      const grouped = compRes.data.map(company => ({
        ...company,
        accounts: accountsWithBalance.filter(acc => acc.empresa_id === company.id)
      }));

      setData(grouped);
      setEmpresas(compRes.data);
      // Expand all by default for visibility
      setExpandedCompanies(compRes.data.map(c => c.id));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAccounts();
  }, []);

  const toggleCompany = (id: string) => {
    setExpandedCompanies(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="mt-4 text-zinc-500 font-medium italic">Sincronizando bóvedas bancarias...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Cuentas Bancarias</h1>
          <p className="text-zinc-500 mt-1 dark:text-zinc-200 font-medium">Gestión de activos líquidos por entidad legal.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-zinc-50 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nueva Cuenta
          </button>
        )}
      </div>

      <div className="space-y-12">
        {data.map((company) => (
          <div key={company.id} className="space-y-6">
            {/* Company Label */}
            <div 
              onClick={() => toggleCompany(company.id)}
              className="flex items-center justify-between cursor-pointer group px-2"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 text-zinc-50 flex items-center justify-center font-black dark:bg-zinc-800">
                  {company.codigo?.[0]}
                </div>
                <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-50 group-hover:text-primary transition-colors">
                  {company.nombre_completo}
                </h2>
              </div>
              {expandedCompanies.includes(company.id) ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
            </div>

            <AnimatePresence initial={false}>
              {expandedCompanies.includes(company.id) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 overflow-hidden ml-2"
                >
                  {company.accounts.map((acc: any, i: number) => (
                    <motion.div
                      key={acc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group relative rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm hover:border-primary/50 transition-all dark:bg-zinc-900 dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between mb-8">
                        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-primary group-hover:scale-110 transition-transform">
                          <Wallet className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black tracking-widest px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20">
                          {acc.moneda}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-50">
                          {acc.banco}
                        </h3>
                        <p className="text-xs text-zinc-400 dark:text-zinc-300 font-bold uppercase tracking-wider">{acc.descripcion || 'Sin descripción'}</p>
                      </div>

                      <div className="mt-10 pt-6 border-t border-zinc-50 dark:border-zinc-800 flex items-end justify-between">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-zinc-400 dark:text-zinc-300 font-black mb-1">Saldo Consolidado</p>
                          <p className={`text-3xl font-black ${acc.balance < 0 ? 'text-rose-600' : 'text-zinc-900 dark:text-zinc-50'}`}>
                            ${acc.balance.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <MoreHorizontal className="w-5 h-5 text-zinc-300 dark:text-zinc-700 cursor-pointer hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {company.accounts.length === 0 && (
                    <div className="col-span-full py-10 bg-zinc-50/50 rounded-[2rem] border border-dashed border-zinc-200 flex flex-col items-center justify-center dark:bg-zinc-900/50 dark:border-zinc-800">
                      <p className="text-zinc-400 font-medium italic">No hay cuentas registradas para esta empresa</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <NewAccountModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        empresas={empresas}
        onSaved={() => {
          setIsModalOpen(false);
          fetchAccounts();
        }}
      />
    </div>
  );
}
