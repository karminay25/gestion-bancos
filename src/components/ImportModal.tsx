"use client";

import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileCheck, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Search,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImportModalProps {
    onClose: () => void;
    accounts: any[];
    onSuccess: () => void;
}

export default function ImportModal({ onClose, accounts, onSuccess }: ImportModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [file, setFile] = useState<File | null>(null);
    const [selectedCuentaId, setSelectedCuentaId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [selectedMoves, setSelectedMoves] = useState<Set<number>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const startPreview = async () => {
        if (!file || !selectedCuentaId) return;
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('cuentaId', selectedCuentaId);

        try {
            const res = await fetch('/api/import/preview', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setPreviewData(data.movements);
            // Default select only non-duplicates
            const autoSelected = new Set<number>();
            data.movements.forEach((m: any, idx: number) => {
                if (!m.isDuplicate) autoSelected.add(idx);
            });
            setSelectedMoves(autoSelected);
            setStep(2);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmImport = async () => {
        setLoading(true);
        const movementsToSave = previewData.filter((_, idx) => selectedMoves.has(idx));

        try {
            const res = await fetch('/api/import/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movements: movementsToSave, cuentaId: selectedCuentaId })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleMove = (idx: number) => {
        const next = new Set(selectedMoves);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        setSelectedMoves(next);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">Importador Inteligente</h2>
                        <p className="text-zinc-500 text-sm font-medium">Sincroniza tus Excel bancarios sin duplicados.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3 text-sm font-bold animate-shake">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="block text-sm font-black uppercase tracking-widest text-zinc-400">1. Seleccionar Cuenta Destino</label>
                                    <div className="space-y-2">
                                        {accounts.map(acc => (
                                            <div 
                                                key={acc.id}
                                                onClick={() => setSelectedCuentaId(acc.id)}
                                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                                                    selectedCuentaId === acc.id 
                                                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" 
                                                    : "border-zinc-100 bg-white hover:border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center font-black text-zinc-400">
                                                        {acc.banco?.[0]}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm tracking-tight">{acc.banco} - {acc.descripcion}</p>
                                                        <p className="text-[10px] uppercase font-black text-zinc-400">{acc.moneda} • {acc.empresas?.codigo}</p>
                                                    </div>
                                                </div>
                                                {selectedCuentaId === acc.id && <CheckCircle2 className="w-5 h-5 text-primary" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-sm font-black uppercase tracking-widest text-zinc-400">2. Cargar Archivo Bancario</label>
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`h-[300px] border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
                                            file ? "border-emerald-400 bg-emerald-50/30" : "border-zinc-100 hover:border-primary/30 hover:bg-zinc-50"
                                        }`}
                                    >
                                        <input type="file" ref={fileInputRef} className="hidden" accept=".xls,.xlsx,.csv" onChange={handleFileChange} />
                                        {file ? (
                                            <>
                                                <div className="w-16 h-16 bg-emerald-400 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-400/20">
                                                    <FileCheck className="w-8 h-8" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="font-black text-zinc-900">{file.name}</p>
                                                    <p className="text-xs text-zinc-500 font-medium">{(file.size / 1024).toFixed(1)} KB • Preparado</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 bg-zinc-100 text-zinc-400 rounded-3xl flex items-center justify-center">
                                                    <Upload className="w-8 h-8" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="font-black text-zinc-900">Haz clic o arrastra el archivo</p>
                                                    <p className="text-xs text-zinc-500 font-medium">Soporta Excel (.xls, .xlsx) y CSV</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={startPreview}
                                disabled={!file || !selectedCuentaId || loading}
                                className="w-full py-5 bg-zinc-900 text-zinc-50 rounded-[2rem] font-bold text-lg shadow-2xl hover:scale-[1.01] transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                                Analizar Movimientos
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-black text-zinc-400 uppercase tracking-widest leading-none">
                                    Vista Previa: <span className="text-zinc-900">{previewData.length} detectados</span> • <span className="text-primary">{selectedMoves.size} por importar</span>
                                </p>
                                <button onClick={() => setStep(1)} className="text-xs font-black text-zinc-400 hover:text-zinc-900 transition-colors uppercase">Cambiar Archivo</button>
                            </div>

                            <div className="border border-zinc-100 dark:border-zinc-800 rounded-3xl overflow-hidden bg-zinc-50/30 border-collapse">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="bg-zinc-50 dark:bg-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                            <th className="p-4 w-10"></th>
                                            <th className="p-4">Fecha</th>
                                            <th className="p-4">Concepto / Referencia</th>
                                            <th className="p-4 text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {previewData.map((m, idx) => (
                                            <tr 
                                                key={idx} 
                                                className={`transition-colors ${m.isDuplicate ? "opacity-40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                                            >
                                                <td className="p-4">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedMoves.has(idx)}
                                                        onChange={() => toggleMove(idx)}
                                                        className="w-5 h-5 rounded-lg accent-primary"
                                                    />
                                                </td>
                                                <td className="p-4 font-bold">{m.fecha}</td>
                                                <td className="p-4">
                                                    <p className="font-bold text-zinc-900 dark:text-zinc-50 truncate max-w-[300px]">{m.concepto}</p>
                                                    <p className="text-[10px] font-black text-zinc-400">{m.referencia || "SIN REFERENCIA"}</p>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`font-black ${m.tipo === 'Ingreso' ? "text-emerald-600" : "text-zinc-900 dark:text-zinc-50"}`}>
                                                            {m.tipo === 'Ingreso' ? '+' : '-'}${m.monto.toLocaleString()}
                                                        </span>
                                                        {m.isDuplicate && (
                                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full mt-1">
                                                                <ShieldAlert className="w-2.5 h-2.5" /> Duplicado
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <button 
                                onClick={confirmImport}
                                disabled={selectedMoves.size === 0 || loading}
                                className="w-full py-5 bg-primary text-white rounded-[2rem] font-bold text-lg shadow-2xl shadow-primary/20 hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ChevronRight className="w-6 h-6" />}
                                Procesar {selectedMoves.size} Movimientos
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

