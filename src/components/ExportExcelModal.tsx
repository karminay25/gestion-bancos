"use client";

import { useState } from "react";
import { X, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { buildExportWorkbook, ExportFilters } from "@/lib/exportExcel";
import * as XLSX from "xlsx";

interface ExportExcelModalProps {
    onClose: () => void;
    movements: any[];
    accounts: any[];
    companies: any[];
    seasons: any[];
    costCenters: any[];
}

export function ExportExcelModal({ onClose, movements, accounts, companies, seasons, costCenters }: ExportExcelModalProps) {
    const [empresaId, setEmpresaId] = useState("all");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [temporadaId, setTemporadaId] = useState("all");
    const [centroCostoId, setCentroCostoId] = useState("all");
    const [modo, setModo] = useState<"general" | "consolidado">("general");
    const [exporting, setExporting] = useState(false);

    const handleExport = () => {
        setExporting(true);
        try {
            const filters: ExportFilters = { empresaId, fechaDesde, fechaHasta, temporadaId, centroCostoId, modo };
            const wb = buildExportWorkbook(movements, accounts, filters);

            const parts = ["Reporte_Bancos"];
            if (empresaId !== "all") {
                const emp = companies.find(c => c.id.toString() === empresaId);
                if (emp) parts.push(emp.codigo);
            }
            if (fechaDesde || fechaHasta) parts.push(`${fechaDesde || "inicio"}_a_${fechaHasta || "hoy"}`);
            parts.push(new Date().toISOString().split("T")[0]);

            XLSX.writeFile(wb, `${parts.join("_")}.xlsx`);
            onClose();
        } finally {
            setExporting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-lg bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div>
                            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-primary" /> Exportar Excel
                            </h2>
                            <p className="text-xs font-medium text-zinc-500 mt-0.5">Elige qué movimientos incluir</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Empresa</label>
                            <select
                                value={empresaId}
                                onChange={e => setEmpresaId(e.target.value)}
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium text-zinc-900 dark:text-zinc-50"
                            >
                                <option value="all">Todas las empresas</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.codigo}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Desde</label>
                                <input
                                    type="date"
                                    value={fechaDesde}
                                    onChange={e => setFechaDesde(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium text-zinc-900 dark:text-zinc-50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Hasta</label>
                                <input
                                    type="date"
                                    value={fechaHasta}
                                    onChange={e => setFechaHasta(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium text-zinc-900 dark:text-zinc-50"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Temporada</label>
                                <select
                                    value={temporadaId}
                                    onChange={e => setTemporadaId(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium text-zinc-900 dark:text-zinc-50"
                                >
                                    <option value="all">Todas</option>
                                    {seasons.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Centro de Costo</label>
                                <select
                                    value={centroCostoId}
                                    onChange={e => setCentroCostoId(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl focus:ring-2 focus:ring-primary/20 text-sm font-medium text-zinc-900 dark:text-zinc-50"
                                >
                                    <option value="all">Todos</option>
                                    {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.numero != null ? `${cc.numero} - ${cc.nombre}` : cc.nombre}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Formato</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModo("general")}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${modo === "general" ? "border-primary bg-primary/5" : "border-zinc-100 dark:border-zinc-800"}`}
                                >
                                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">General</p>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Una hoja por cuenta bancaria, como BANCOS 2026</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModo("consolidado")}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all ${modo === "consolidado" ? "border-primary bg-primary/5" : "border-zinc-100 dark:border-zinc-800"}`}
                                >
                                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Consolidado</p>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Una sola hoja con todo junto</p>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 pb-6">
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                            Descargar Excel
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
