"use client";

import { Building2, Plus, Mail, MapPin, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function EmpresasPage() {
  const companies = [
    { id: 1, name: 'LOLA BERRIES', full: 'LOLA BERRIES SPR DE RL DE CV', Location: 'Sayula, Jalisco' },
    { id: 2, name: 'BOSBES BERRIES', full: 'BOSBES BERRIES SPR DE RL DE CV', Location: 'Rancho Estación' },
    { id: 3, name: 'OBA BERRIES', full: 'OBA BERRIES S.A. DE C.V.', Location: 'Ciudad Guzmán' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Empresas</h1>
          <p className="text-zinc-500 mt-1 dark:text-zinc-400">Directorio de entidades registradas en el sistema.</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-zinc-50 shadow-lg shadow-primary/20 hover:opacity-90">
          <Plus className="w-5 h-5" />
          Nueva Empresa
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((comp, i) => (
          <motion.div
            key={comp.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 rounded-[2rem] border border-zinc-200 bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800"
          >
            <div className="flex items-center gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-black text-xl text-zinc-900 dark:text-zinc-50">{comp.name}</h3>
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-tighter">{comp.full}</p>
                </div>
            </div>
            
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <MapPin className="w-4 h-4" />
                    {comp.Location}
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Mail className="w-4 h-4" />
                    contacto@{comp.name.toLowerCase().replace(' ', '')}.com
                </div>
            </div>

            <button className="w-full mt-8 py-3 rounded-2xl border border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-sm font-bold transition-all">
                Configurar Parámetros
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
