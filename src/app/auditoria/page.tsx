"use client";

import { History, Search, ShieldCheck, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export default function AuditoriaPage() {
  const logs = [
    { id: 1, action: 'Nuevo Movimiento', user: 'Admin', date: 'Hace 5 min', description: 'Registro de ingreso de $10,000 en BBVA Pesos', status: 'success' },
    { id: 2, action: 'Login Exitoso', user: 'Carlos M.', date: 'Hace 1 hora', description: 'Acceso al sistema desde Guadalajara, MX', status: 'info' },
    { id: 3, action: 'Cambio de Configuración', user: 'Sistema', date: 'Hace 2 horas', description: 'Actualización automática del tipo de cambio', status: 'warning' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Auditoría</h1>
          <p className="text-zinc-500 mt-1 dark:text-zinc-400">Registro histórico de acciones y cambios en el sistema.</p>
        </div>
        <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                Sistema Seguro
            </span>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="font-bold text-lg dark:text-zinc-50">Log de Actividades</h3>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                    type="text" 
                    placeholder="Filtrar logs..." 
                    className="pl-10 pr-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-xs focus:outline-none dark:bg-zinc-800 dark:border-zinc-700" 
                />
            </div>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {logs.map((log, i) => (
                <motion.div 
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-6 flex items-start gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                    <div className={`p-2 rounded-xl ${
                        log.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                        log.status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                        <History className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-zinc-900 dark:text-zinc-50">{log.action}</h4>
                            <span className="text-xs text-zinc-400 font-medium">{log.date}</span>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{log.description}</p>
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] uppercase font-black text-zinc-400 tracking-tighter">Usuario:</span>
                             <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{log.user}</span>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
      </div>
    </div>
  );
}
