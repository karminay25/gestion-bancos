"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wallet,
  Calendar,
  Tag,
  User,
  Info,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Trash2,
  Leaf,
  BookUser,
  Sparkles,
  RefreshCw,
  FileText,
  FileCheck,
  Edit2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { formatCostCenter } from "@/lib/costCenter";
import { NewMovementForm } from "@/components/NewMovementForm";
import { EditMovementModal } from "@/components/EditMovementModal";
import { ExportExcelModal } from "@/components/ExportExcelModal";
import { calculateAccountBalance, sortMovements } from "@/lib/balances";
import { useAuth } from "@/context/AuthContext";

// Helper to get Month Name in Spanish
const getMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString('es-ES', { month: 'short' }).toUpperCase() + ' ' + year.slice(2);
};

// Cost centers from the Excel that should be hidden from dropdown menus for new selection/filtering
const ARCHIVED_COST_CENTERS = new Set([
  'ACTIVO LOLA',
  'AGRICOLA OBA',
  'AOO',
  'BOSBEA',
  'BOSBSES',
  'CFRV',
  'CRFV',
  'JFV',
  'LACM',
  'LOA',
  'LOLA',
  'LOLA/BOSBES',
  'LOLA/BOSBES/OBA',
  'LOLA/OBA',
  'OBA/BOSBES',
  'OBA/LOLA',
  'PRO',
  'PROCESO',
  'SOCIIO JFV',
  'SOCIO',
  'SOCIO CARLOS',
  'SOCIO JOSE',
  'SOCIO LUIS',
  'SOCIOS CARLOS',
  'NOMINA',
  'TRASPASOS',
  'GASOLINA'
]);

// Sub-component for each account's ledger to manage local filters and pagination
function AccountLedger({ account, movements, costCenters, terceros, onRefresh, isAdmin }: { account: any, movements: any[], costCenters: any[], terceros: any[], onRefresh: () => void, isAdmin: boolean }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCC, setSelectedCC] = useState("");
    const [selectedMonth, setSelectedMonth] = useState<string>("");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isUpdating, setIsUpdating] = useState<string | null>(null); // For loading state per row
    const [showAddCC, setShowAddCC] = useState(false);
    const [newCCName, setNewCCName] = useState("");
    const [savingCC, setSavingCC] = useState(false);
    const [manuallyActivatedCCNames, setManuallyActivatedCCNames] = useState<Set<string>>(new Set());
    const [editingMovement, setEditingMovement] = useState<any | null>(null);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        try {
            const stored = localStorage.getItem('manually_activated_ccs');
            if (stored) {
                setManuallyActivatedCCNames(new Set(JSON.parse(stored)));
            }
        } catch (e) {
            console.error('Error loading activated CCs:', e);
        }
    }, []);

    const activateCCName = (name: string) => {
        setManuallyActivatedCCNames(prev => {
            const next = new Set(prev);
            next.add(name);
            try {
                localStorage.setItem('manually_activated_ccs', JSON.stringify(Array.from(next)));
            } catch (e) {
                console.error('Error saving activated CCs:', e);
            }
            return next;
        });
    };

    const handleAddCC = async () => {
        const name = newCCName.trim().toUpperCase();
        if (!name) return;
        setSavingCC(true);

        // Check if it already exists in the costCenters list from database
        const existing = costCenters.find(cc => cc.nombre.trim().toUpperCase() === name);
        if (existing) {
            const isArchived = ARCHIVED_COST_CENTERS.has(name) && !manuallyActivatedCCNames.has(name);
            if (isArchived) {
                // Un-archive it dynamically
                activateCCName(name);
                setNewCCName('');
                setShowAddCC(false);
                onRefresh();
            } else {
                alert(`El centro de costo "${newCCName.trim()}" ya existe y está activo.`);
            }
            setSavingCC(false);
            return;
        }

        const { error } = await supabase.from('centros_costo').insert({ nombre: newCCName.trim() });
        if (error) {
            alert('Error al guardar: ' + error.message);
        } else {
            setNewCCName('');
            setShowAddCC(false);
            onRefresh();
        }
        setSavingCC(false);
    };

    // 1. Calculate running balances from ALL movements for this account (ignoring filters for balance integrity)
    const movementsWithBalance = useMemo(() => {
        const sorted = sortMovements(movements);

        // --- Pass 1: find the first explicit balance anchor ---
        let anchorIdx = -1;
        let anchorBalance = 0;
        for (let i = 0; i < sorted.length; i++) {
            const m = sorted[i];
            let val = m.saldoo;
            if (val === null || val === undefined || val === '') {
                val = m.saldo_excel;
                if (!val && m.factura?.includes('[BANCO:')) {
                    const match = m.factura.match(/\[BANCO:\s*([0-9,.-]+)\]/);
                    if (match) val = match[1].replace(/,/g, '');
                }
            }
            if (val !== null && val !== undefined && val !== '') {
                const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(String(val));
                if (!isNaN(parsed)) {
                    anchorIdx = i;
                    anchorBalance = parsed;
                    break;
                }
            }
        }

        // --- Pass 2: propagate balance to every row ---
        const balances: number[] = new Array(sorted.length).fill(NaN);

        if (anchorIdx !== -1) {
            balances[anchorIdx] = anchorBalance;
            // Forward from anchor
            for (let i = anchorIdx + 1; i < sorted.length; i++) {
                const m = sorted[i];
                // If this row has its own explicit balance, use it as new anchor
                let val = m.saldoo;
                if (val === null || val === undefined || val === '') {
                    val = m.saldo_excel;
                    if (!val && m.factura?.includes('[BANCO:')) {
                        const match = m.factura.match(/\[BANCO:\s*([0-9,.-]+)\]/);
                        if (match) val = match[1].replace(/,/g, '');
                    }
                }
                if (val !== null && val !== undefined && val !== '') {
                    const parsed = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : parseFloat(String(val));
                    if (!isNaN(parsed)) { balances[i] = parsed; continue; }
                }
                let amt = parseFloat(String(sorted[i].monto || '0').replace(/,/g, ''));
                if (sorted[i].tipo === 'Egreso') amt = -Math.abs(amt);
                // Si es Ingreso, amt queda positivo.
                // Si es Traspaso, amt ya trae su signo correcto (+ o -).
                balances[i] = balances[i - 1] + amt;
            }
            // Backward from anchor
            for (let i = anchorIdx - 1; i >= 0; i--) {
                let amt = parseFloat(String(sorted[i + 1].monto || '0').replace(/,/g, ''));
                if (sorted[i + 1].tipo === 'Egreso') amt = -Math.abs(amt);
                balances[i] = balances[i + 1] - amt;
            }
        }

        return sorted.map((m, i) => ({
            ...m,
            monthKey: m.fecha.slice(0, 7),
            saldo_calculado: isNaN(balances[i]) ? null : balances[i],
        }));
    }, [movements]);

    // 2. Identify available months and default to current if possible
    const availableMonths = useMemo(() => {
        const months = Array.from(new Set(movementsWithBalance.map(m => m.monthKey))).sort();
        return months;
    }, [movementsWithBalance]);

    useEffect(() => {
        if (availableMonths.length === 0) return;
        
        // If a month is already selected and still valid, do not reset it
        if (selectedMonth && availableMonths.includes(selectedMonth)) {
            return;
        }

        const today = new Date().toISOString().slice(0, 7);
        // Prioritize 2026 if today's month isn't available
        const currentYearMonths = availableMonths.filter(m => m.startsWith('2026'));
        
        if (availableMonths.includes(today)) {
            setSelectedMonth(today);
        } else if (currentYearMonths.length > 0) {
            setSelectedMonth(currentYearMonths[currentYearMonths.length - 1]); // Latest in 2026
        } else {
            setSelectedMonth(availableMonths[availableMonths.length - 1]); // Last month with any data
        }
    }, [availableMonths, selectedMonth]);

    // Reset pagination when filter or month changes
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds([]); // Clear selection when filters change
    }, [selectedMonth, searchTerm, selectedCC, sortOrder]);

    const handleSingleCCUpdate = async (moveId: string, newCCId: string) => {
        setIsUpdating(moveId);
        const { error } = await supabase.from('movimientos').update({ centro_costo_id: newCCId || null }).eq('id', moveId);
        if (error) alert('Error al actualizar: ' + error.message);
        else onRefresh(); // Trigger parent re-fetch
        setIsUpdating(null);
    };

    const handleBulkCCUpdate = async (newCCId: string) => {
        if (selectedIds.length === 0) return;
        if (!confirm(`¿Asignar este centro de costo a ${selectedIds.length} movimientos?`)) return;
        
        const { error } = await supabase.from('movimientos').update({ centro_costo_id: newCCId || null }).in('id', selectedIds);
        if (error) alert('Error en actualización masiva: ' + error.message);
        else {
            setSelectedIds([]);
            onRefresh(); // Refresh locally without reload
        }
    };

    const handleFacturaUpdate = async (moveId: string, newValue: string) => {
        setIsUpdating(moveId);
        const { error } = await supabase.from('movimientos').update({ factura: newValue }).eq('id', moveId);
        if (error) alert('Error al actualizar factura: ' + error.message);
        else onRefresh();
        setIsUpdating(null);
    };

    const handleNombreUpdate = async (moveId: string, newValue: string) => {
        setIsUpdating(moveId);

        // Cada movimiento guarda su propio nombre_tercero de forma independiente:
        // esta acción ya NO escribe en el directorio "terceros", que antes hacía que
        // editar un movimiento cambiara visualmente el nombre de TODOS los demás
        // movimientos que compartían el mismo texto crudo del banco (p. ej. varios
        // movimientos distintos limpiados a "POR IDENTIFICAR").
        const { error } = await supabase.from('movimientos').update({ nombre_tercero: newValue }).eq('id', moveId);

        if (error) {
            alert('Error al actualizar nombre: ' + error.message);
        } else {
            onRefresh();
        }
        setIsUpdating(null);
    };

    const handleCCUpdate = async (moveId: string, newValue: string) => {
        setIsUpdating(moveId);
        const { error } = await supabase.from('movimientos').update({ centro_costo_id: newValue || null }).eq('id', moveId);
        
        if (error) {
            alert('Error al actualizar centro de costo: ' + error.message);
        } else {
            // LEARNING: Update the default CC for this provider in the directory
            const move = movementsWithBalance.find(m => m.id === moveId);
            if (move && move.nombre_tercero) {
                const terc = terceros.find(t => t.nombre_raw === move.nombre_tercero || t.nombre_canonico === move.nombre_tercero);
                if (terc) {
                    await supabase.from('terceros').update({ centro_costo_id: newValue || null }).eq('id', terc.id);
                }
            }
            onRefresh();
        }
        setIsUpdating(null);
    };

    const handleConceptoUpdate = async (moveId: string, newValue: string) => {
        setIsUpdating(moveId);
        const { error } = await supabase.from('movimientos').update({ concepto: newValue }).eq('id', moveId);
        if (error) alert('Error al actualizar concepto: ' + error.message);
        else onRefresh();
        setIsUpdating(null);
    };

    const handleBulkClean = async () => {
        // Removed redundant RawMovement interface inside bulk clean function
        const toUpdate = filteredItems.filter(m => {
            const terc = terceros.find(t => t.nombre_raw === m.nombre_tercero);
            return terc && terc.nombre_canonico !== m.nombre_tercero;
        });

        if (toUpdate.length === 0) {
            alert("No se encontraron sugerencias de limpieza para los movimientos visibles.");
            return;
        }

        if (!confirm(`¿Aplicar nombres limpios del directorio a ${toUpdate.length} movimientos visibles?`)) return;

        setIsUpdating("bulk");
        for (const m of toUpdate) {
            const terc = terceros.find(t => t.nombre_raw === m.nombre_tercero);
            if (terc) {
                await supabase.from('movimientos').update({ nombre_tercero: terc.nombre_canonico }).eq('id', m.id);
            }
        }
        alert(`✅ Se han limpiado ${toUpdate.length} nombres.`);
        onRefresh();
        setIsUpdating(null);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`⚠️ ¿Eliminar ${selectedIds.length} movimiento(s) seleccionado(s)? Esta acción no se puede deshacer.`)) return;

        setIsUpdating("bulk");
        const { error } = await supabase.from('movimientos').delete().in('id', selectedIds);
        if (error) {
            alert('Error al eliminar: ' + error.message);
        } else {
            alert(`✅ Se eliminaron ${selectedIds.length} movimiento(s) correctamente.`);
            setSelectedIds([]);
            onRefresh();
        }
        setIsUpdating(null);
    };

    // 3. Apply local filters and handle Monthly View
    const filteredItems = useMemo(() => {
        const filtered = movementsWithBalance.filter(m => {
            // Hide the system's mathematical anchor to perfectly mirror Excel's view
            if (m.concepto === 'Saldo Inicial (Auto-detectado)') return false;

            const matchesMonth = !selectedMonth || m.monthKey === selectedMonth;
            const matchesSearch = !searchTerm || 
                m.nombre_tercero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.concepto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.factura?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCC = !selectedCC || m.centro_costo_id === selectedCC;
            
            return matchesMonth && matchesSearch && matchesCC;
        });

        // "desc" = newest first (reverse chronological order)
        // "asc" = oldest first (chronological order)
        return sortOrder === "desc" ? filtered.reverse() : filtered;
    }, [movementsWithBalance, searchTerm, selectedCC, selectedMonth, sortOrder]);

    // 4. Pagination slicing
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredItems.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredItems, currentPage]);

    const currentBalance = useMemo(() => {
        return calculateAccountBalance(movementsWithBalance);
    }, [movementsWithBalance]);

    return (
        <div className="ml-4 space-y-6">
            {/* Account Header */}
            <div className="flex items-center justify-between p-6 rounded-[2.5rem] bg-white border border-zinc-100 dark:bg-zinc-900 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-primary">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-zinc-900 dark:text-zinc-50">{account.banco}</h4>
                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">{account.moneda} • {account.descripcion}</p>
                    </div>
                </div>
                <div className="text-right flex items-end gap-6">
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-black text-zinc-400 dark:text-zinc-300 tracking-widest mb-1">Saldo Final Actual</p>
                        <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50">${(currentBalance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Month Picker Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                {availableMonths.map(month => (
                    <button
                        key={month}
                        onClick={() => setSelectedMonth(month)}
                        className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                            selectedMonth === month 
                            ? "bg-primary text-zinc-50 shadow-lg shadow-primary/20 scale-105" 
                            : "bg-white text-zinc-400 border border-zinc-100 hover:border-primary/30 dark:bg-zinc-900 dark:border-zinc-800"
                        }`}
                    >
                        {getMonthName(month)}
                    </button>
                ))}
            </div>

            {/* Contextual Filter Bar */}
            <div className="bg-zinc-50/50 dark:bg-zinc-800/20 border border-zinc-100 dark:border-zinc-800 p-4 rounded-[2rem] grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative col-span-1 md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                        type="text"
                        placeholder="Buscar por nombre, factura o concepto..."
                        className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border-none bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-primary/20 transition-all dark:text-zinc-50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {/* CC filter + add button */}
                <div className="relative col-span-1 flex gap-1.5">
                    <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                        <select 
                            className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border-none bg-white dark:bg-zinc-900 appearance-none focus:ring-2 focus:ring-primary/20 text-zinc-900 dark:text-zinc-50 font-bold"
                            value={selectedCC}
                            onChange={(e) => setSelectedCC(e.target.value)}
                        >
                            <option value="" className="dark:bg-zinc-900">Todos los Centros</option>
                            {costCenters.filter(cc => cc.numero != null || !ARCHIVED_COST_CENTERS.has(cc.nombre.toUpperCase().trim()) || manuallyActivatedCCNames.has(cc.nombre.toUpperCase().trim())).map(cc => <option key={cc.id} value={cc.id} className="dark:bg-zinc-900">{formatCostCenter(cc)}</option>)}
                        </select>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => setShowAddCC(v => !v)}
                            title="Agregar nuevo centro de costo"
                            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-primary hover:border-primary/50 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="relative col-span-1">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                    <select
                        className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border-none bg-white dark:bg-zinc-900 appearance-none focus:ring-2 focus:ring-primary/20 dark:text-zinc-50 font-bold"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
                    >
                        <option value="desc">Más Recientes</option>
                        <option value="asc">Más Antiguos</option>
                    </select>
                </div>
                {isAdmin && (
                    <button
                        onClick={handleBulkClean}
                        disabled={isUpdating === "bulk"}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        Limpieza Inteligente
                    </button>
                )}
            </div>

            {/* Inline modal: add new cost center */}
            <AnimatePresence>
                {isAdmin && showAddCC && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-primary/20 rounded-[1.5rem] px-5 py-3.5 shadow-lg shadow-primary/5"
                    >
                        <Tag className="w-4 h-4 text-primary flex-shrink-0" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap">Nuevo Centro:</p>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Ej. FRAMBUESA NORTE"
                            value={newCCName}
                            onChange={(e) => setNewCCName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCC(); if (e.key === 'Escape') setShowAddCC(false); }}
                            className="flex-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-2 text-xs font-bold uppercase text-zinc-900 dark:text-zinc-50 border-none focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                        />
                        <button
                            onClick={handleAddCC}
                            disabled={savingCC || !newCCName.trim()}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1.5"
                        >
                            {savingCC ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            Guardar
                        </button>
                        <button
                            onClick={() => { setShowAddCC(false); setNewCCName(''); }}
                            className="text-[10px] font-black uppercase text-zinc-300 hover:text-rose-500 transition-colors px-2"
                        >
                            Cancelar
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bulk Actions Bar */}
            <AnimatePresence>
                {isAdmin && selectedIds.length > 0 && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-4 rounded-[2rem] flex items-center justify-between mb-4 overflow-hidden"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-primary text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                                {selectedIds.length} Seleccionados
                            </div>
                            <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Acciones Masivas:</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <select 
                                onChange={(e) => handleBulkCCUpdate(e.target.value)}
                                className="pl-4 pr-10 py-2 text-[10px] font-black uppercase rounded-xl border-none bg-white dark:bg-zinc-900 shadow-sm focus:ring-2 focus:ring-primary/20 text-zinc-900 dark:text-zinc-50 appearance-none cursor-pointer"
                            >
                                <option value="" className="dark:bg-zinc-900">Asignar Centro de Costo...</option>
                                <option value="null" className="dark:bg-zinc-900">-- Quitar Centro --</option>
                                {costCenters.filter(cc => cc.numero != null || !ARCHIVED_COST_CENTERS.has(cc.nombre.toUpperCase().trim()) || manuallyActivatedCCNames.has(cc.nombre.toUpperCase().trim())).map(cc => <option key={cc.id} value={cc.id} className="dark:bg-zinc-900">{formatCostCenter(cc)}</option>)}
                            </select>
                            <button 
                                onClick={handleBulkDelete}
                                disabled={isUpdating === "bulk"}
                                className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50 border border-rose-500/20"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Eliminar Selección
                            </button>
                            <button onClick={() => setSelectedIds([])} className="text-[10px] font-black uppercase text-zinc-400 hover:text-rose-500 transition-colors px-4">Cancelar</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Table */}
            <div className="rounded-[2.2rem] border border-zinc-100 bg-white overflow-x-auto shadow-sm dark:bg-zinc-950 dark:border-zinc-900 custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                    <thead>
                        <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                            <th className="px-5 py-5 w-10">
                                {isAdmin && (
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedIds(paginatedItems.map(m => m.id));
                                            else setSelectedIds([]);
                                        }}
                                        checked={selectedIds.length > 0 && selectedIds.length === paginatedItems.length}
                                        className="rounded border-zinc-300 text-primary focus:ring-primary"
                                    />
                                )}
                            </th>
                            <th className="px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-300">Fecha</th>
                            <th className="px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-300 min-w-[180px]">Nombre</th>
                            <th className="px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-300 text-center">Ingreso</th>
                            <th className="px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-300 text-center">Egreso</th>
                            <th className="px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-300 text-right bg-primary/[0.03]">Saldo</th>
                            <th className="px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-300">Factura</th>
                            <th className="px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-300 min-w-[320px]">Concepto</th>
                            <th className="px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-300">C. Costo</th>
                            <th className="px-5 py-5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-300 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                        {paginatedItems.map((move: any) => (
                            <tr key={move.id} className={`hover:bg-zinc-50/30 dark:hover:bg-zinc-900/30 transition-colors ${selectedIds.includes(move.id) ? "bg-primary/[0.03] dark:bg-primary/[0.05]" : ""}`}>
                                <td className="px-5 py-5">
                                    {isAdmin && (
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(move.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedIds(prev => [...prev, move.id]);
                                                else setSelectedIds(prev => prev.filter(id => id !== move.id));
                                            }}
                                            className="rounded border-zinc-300 text-primary focus:ring-primary"
                                        />
                                    )}
                                </td>
                                <td className="px-5 py-5 text-[11px] font-bold text-zinc-500 dark:text-zinc-300 whitespace-nowrap">
                                    {move.fecha.split('-').reverse().join('/')}
                                </td>
                                <td className="px-5 py-5 min-w-[220px]">
                                    <input
                                        type="text"
                                        readOnly={!isAdmin}
                                        defaultValue={move.nombre_tercero || ''}
                                        placeholder="Nombre del Tercero..."
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            if (val !== (move.nombre_tercero || '')) {
                                                handleNombreUpdate(move.id, val);
                                            }
                                        }}
                                        className={`w-full bg-transparent border-none focus:ring-1 focus:ring-primary/20 rounded-lg text-xs font-black text-zinc-900 dark:text-zinc-50 transition-all ${isUpdating === move.id ? "opacity-50" : isAdmin ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : ""}`}
                                    />
                                </td>
                                <td className="px-5 py-5 text-center">
                                    {move.tipo === 'Ingreso' ? (
                                        <span className="text-xs font-black text-emerald-600">${parseFloat(move.monto).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    ) : move.tipo === 'Traspaso' && parseFloat(move.monto) >= 0 ? (
                                        <span className="text-xs font-black text-blue-600">${parseFloat(move.monto).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    ) : '-'}
                                </td>
                                <td className="px-5 py-5 text-center">
                                    {move.tipo === 'Egreso' ? (
                                        <span className="text-xs font-black text-rose-600 dark:text-rose-500">${parseFloat(move.monto).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    ) : move.tipo === 'Traspaso' && parseFloat(move.monto) < 0 ? (
                                        <span className="text-xs font-black text-blue-600">${Math.abs(parseFloat(move.monto)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    ) : '-'}
                                </td>
                                <td className="px-5 py-5 text-right bg-primary/[0.01]">
                                    {(() => {
                                        // Prefer database saldoo, then explicit Excel balance, then fall back to dynamically calculated balance
                                        let displaySaldo: number | null = null;
                                        let isCalculated = false;

                                        if (move.saldoo !== null && move.saldoo !== undefined && move.saldoo !== '') {
                                            displaySaldo = typeof move.saldoo === 'string' ? parseFloat(move.saldoo) : move.saldoo;
                                        }

                                        if (displaySaldo === null) {
                                            let val = move.saldo_excel;
                                            if (!val && move.factura?.includes('[BANCO:')) {
                                                const match = move.factura.match(/\[BANCO:\s*([0-9,.-]+)\]/);
                                                if (match) val = match[1].replace(/,/g, '');
                                            }
                                            if (val !== null && val !== undefined && val !== '') {
                                                const parsed = parseFloat(String(val).replace(/,/g, ''));
                                                if (!isNaN(parsed)) displaySaldo = parsed;
                                            }
                                        }

                                        if (displaySaldo === null && move.saldo_calculado !== null && move.saldo_calculado !== undefined) {
                                            displaySaldo = move.saldo_calculado;
                                            isCalculated = true;
                                        }

                                        return displaySaldo !== null && !isNaN(displaySaldo) ? (
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="text-sm font-black text-zinc-900 dark:text-zinc-50">
                                                    ${displaySaldo.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                {isCalculated && (
                                                    <span className="text-[8px] text-zinc-300 uppercase tracking-widest font-bold">calc.</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs font-black text-zinc-400 italic">No disp.</span>
                                        );
                                    })()}
                                </td>
                                <td className="px-5 py-5">
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const linkedFactura = move.facturas?.[0];
                                            
                                            return linkedFactura ? (
                                                <div className="flex items-center gap-2">
                                                    <div 
                                                        title={`Factura Vinculada: ${linkedFactura.uuid_sat}`}
                                                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                    >
                                                        <FileCheck className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-[10px] font-mono font-black text-emerald-600 uppercase">
                                                        {linkedFactura.folio || linkedFactura.uuid_sat?.slice(0, 8)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    readOnly={!isAdmin}
                                                    defaultValue={move.factura?.split('[BANCO:')[0] || ''}
                                                    placeholder="-"
                                                    onBlur={(e) => {
                                                        const original = move.factura?.split('[BANCO:')[0] || '';
                                                        if (e.target.value !== original) {
                                                            const bancoTag = move.factura?.includes('[BANCO:') ? ` [BANCO:${move.factura.split('[BANCO:')[1]}` : '';
                                                            handleFacturaUpdate(move.id, e.target.value + bancoTag);
                                                        }
                                                    }}
                                                    className={`w-full bg-transparent border-none focus:ring-1 focus:ring-primary/20 rounded-lg text-[10px] font-mono font-black uppercase text-zinc-400 dark:text-zinc-300 transition-all ${isUpdating === move.id ? "opacity-50" : isAdmin ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : ""}`}
                                                />
                                            );
                                        })()}
                                    </div>
                                </td>
                                <td className="px-5 py-5 min-w-[380px]">
                                    <textarea
                                        rows={1}
                                        readOnly={!isAdmin}
                                        defaultValue={move.concepto || ''}
                                        placeholder="Escribe el concepto detallado..."
                                        onBlur={(e) => {
                                            if (e.target.value !== (move.concepto || '')) {
                                                handleConceptoUpdate(move.id, e.target.value);
                                            }
                                        }}
                                        className={`w-full bg-transparent border-none focus:ring-1 focus:ring-primary/20 rounded-lg text-xs font-black text-black dark:text-zinc-50 transition-all resize-none overflow-hidden hover:overflow-y-auto max-h-20 ${isUpdating === move.id ? "opacity-50" : isAdmin ? "hover:bg-zinc-100 dark:hover:bg-zinc-800" : ""}`}
                                        onInput={(e) => {
                                            const target = e.target as HTMLTextAreaElement;
                                            target.style.height = 'auto';
                                            target.style.height = target.scrollHeight + 'px';
                                        }}
                                    />
                                </td>
                                <td className="px-5 py-5">
                                    {(() => {
                                        const terc = terceros.find(t => t.nombre_raw === move.nombre_tercero || t.nombre_canonico === move.nombre_tercero);
                                        const hasSuggestion = !move.centro_costo_id && terc?.centro_costo_id;
                                        const suggestedCC = costCenters.find(cc => cc.id === terc?.centro_costo_id);
                                        
                                        return (
                                            <div className="relative group/cc">
                                                <select
                                                    value={move.centro_costo_id || ""}
                                                    disabled={!isAdmin || isUpdating === move.id}
                                                    onChange={(e) => handleCCUpdate(move.id, e.target.value)}
                                                    className={`text-[9px] font-black uppercase px-2 py-1 rounded-xl border-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer transition-all ${hasSuggestion ? "bg-primary/10 text-primary border border-primary/20 animate-pulse" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-700"} ${isUpdating === move.id ? "opacity-50" : ""}`}
                                                >
                                                    <option value="" className="dark:bg-zinc-900">{hasSuggestion ? `SUG: ${formatCostCenter(suggestedCC)}` : "Gral"}</option>
                                                    {costCenters.filter(cc => cc.numero != null || !ARCHIVED_COST_CENTERS.has(cc.nombre.toUpperCase().trim()) || manuallyActivatedCCNames.has(cc.nombre.toUpperCase().trim()) || cc.id === move.centro_costo_id).map(cc => <option key={cc.id} value={cc.id} className="dark:bg-zinc-900">{formatCostCenter(cc)}</option>)}
                                                </select>
                                                {hasSuggestion && (
                                                    <div className="absolute -top-3 left-1 flex items-center gap-1 opacity-0 group-hover/cc:opacity-100 transition-opacity">
                                                        <Sparkles className="w-2.5 h-2.5 text-primary" />
                                                        <span className="text-[7px] font-black text-primary uppercase tracking-tighter italic">Auto-detectado</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td className="px-5 py-5 text-right">
                                    <div className="flex justify-end gap-1">
                                        {isAdmin ? (
                                            <>
                                                <button
                                                    onClick={() => setEditingMovement(move)}
                                                    className="p-2 rounded-xl hover:bg-blue-500/10 text-zinc-300 hover:text-blue-500 transition-all"
                                                    title="Editar movimiento"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (confirm('¿Eliminar este movimiento?')) {
                                                            const { error } = await supabase.from('movimientos').delete().eq('id', move.id);
                                                            if (error) alert('Error al eliminar: ' + error.message);
                                                            else onRefresh();
                                                        }
                                                    }}
                                                    className="p-2 rounded-xl hover:bg-rose-500/10 text-zinc-300 hover:text-rose-500 transition-all"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-[9px] font-black uppercase text-zinc-300">Solo lectura</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {paginatedItems.length === 0 && (
                            <tr>
                                <td colSpan={10} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="p-4 rounded-3xl bg-zinc-50 dark:bg-zinc-900">
                                            <LayoutGrid className="w-8 h-8 text-zinc-200" />
                                        </div>
                                        <p className="text-zinc-400 dark:text-zinc-300 font-medium italic text-sm">
                                            {movements.length === 0 ? "Sin movimientos registrados" : "No hay resultados en este mes"}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-300 tracking-widest">
                            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} de {filteredItems.length}
                        </p>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 disabled:opacity-30 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 transition-all hover:border-primary/50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-1 font-black text-[11px] text-zinc-900 dark:text-zinc-50 px-3">
                                <span>{currentPage}</span>
                                <span className="text-zinc-300">/</span>
                                <span className="text-zinc-400 dark:text-zinc-300">{totalPages}</span>
                            </div>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 disabled:opacity-30 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 transition-all hover:border-primary/50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {editingMovement && (
                <EditMovementModal
                    movement={editingMovement}
                    onClose={() => setEditingMovement(null)}
                    onSuccess={() => {
                        setEditingMovement(null);
                        onRefresh();
                    }}
                />
            )}
        </div>
    );
}

export default function MovimientosPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [terceros, setTerceros] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedAccounts, setExpandedAccounts] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  async function fetchData(silent = false) {
    if (!silent) setLoading(true);
    setFetchError(null);
    try {
    // Fetch core metadata
    const [compRes, accRes, ccRes, seasRes, tercRes] = await Promise.all([
      supabase.from('empresas').select('*'),
      supabase.from('cuentas_bancarias').select('*, empresas(*)'),
      supabase.from('centros_costo').select('*').order('numero', { ascending: true, nullsFirst: false }).order('nombre'),
      supabase.from('temporadas').select('*').order('created_at', { ascending: false }),
      supabase.from('terceros').select('*')
    ]);

    if (compRes.data) setCompanies(compRes.data);
    if (accRes.data) setAccounts(accRes.data);
    if (ccRes.data) setCostCenters(ccRes.data);
    if (seasRes.data) setSeasons(seasRes.data);
    if (tercRes.data) setTerceros(tercRes.data);

    // Fetch ALL movements using a loop to bypass the 1000 limit
    let allMovs: any[] = [];
    let from = 0;
    let to = 999;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
          .from('movimientos')
          .select('*, saldoo, cuentas_bancarias(id, banco, descripcion, moneda, empresa_id, empresas(codigo)), centros_costo(id, nombre, numero), facturas(*)')
          .order('fecha', { ascending: false })
          .order('id', { ascending: true }) // Added stable sort tie-breaker
          .range(from, to);
        
        if (error) {
            console.error("Fetch error:", error);
            throw error;
        }

        if (data && data.length > 0) {
            if (from === 0) console.log("First movement fetched:", JSON.stringify(data[0]));
            allMovs = [...allMovs, ...data];
            if (data.length < 1000) {
                hasMore = false;
            } else {
                from += 1000;
                to += 1000;
            }
        } else {
            // No data returned (empty table or RLS blocking) — exit loop to avoid infinite loading
            hasMore = false;
        }
    }

    // Ensure uniqueness and sort globally to be absolutely sure of chronological order
    const uniqueMovs = sortMovements(Array.from(new Map(allMovs.map(m => [m.id, m])).values()));

    console.log(`[Movimientos] Fetched ${uniqueMovs.length} unique movements.`);
    setMovements(uniqueMovs);
    } catch (err: any) {
        console.error("Error fetching data:", err);
        setFetchError(err.message || "Error desconocido al conectar con la base de datos.");
    } finally {
        setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAccount = (id: string) => {
    setExpandedAccounts(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="mt-4 text-zinc-500 dark:text-zinc-300 font-medium italic">Sintonizando archivos maestros...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/30 text-rose-500">
            <Info className="w-10 h-10" />
        </div>
        <p className="mt-4 text-zinc-900 dark:text-zinc-50 font-black text-xl">Fallo de Conexión</p>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400 max-w-md text-center">{fetchError}</p>
        <button 
            onClick={() => fetchData()}
            className="mt-6 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-all"
        >
            Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Libro Mayor</h1>
          <p className="text-zinc-500 mt-1 dark:text-zinc-300 font-medium">Cronología completa seccionada por meses y cuentas.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
            {/* Season Filter */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 shadow-sm">
                <Leaf className="w-4 h-4 text-primary" />
                <select
                  value={selectedSeason}
                  onChange={e => setSelectedSeason(e.target.value)}
                  className="bg-transparent text-xs font-black uppercase text-zinc-600 dark:text-zinc-400 border-none focus:ring-0 cursor-pointer"
                >
                  <option value="all">Todas las Temporadas</option>
                  {seasons.map(s => {
                    const isActive = s.fecha_inicio && !s.fecha_fin;
                    return <option key={s.id} value={s.id}>{s.nombre}{isActive ? ' ★' : ''}</option>;
                  })}
                </select>
            </div>
            <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 transition-all shadow-sm"
            >
                <Download className="w-5 h-5" />
                Exportar
            </button>
            {isAdmin && (
                <>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-zinc-50 shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all hover:opacity-90 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Nueva Captura
                    </button>
                    <button
                        onClick={async () => {
                            setIsSyncing(true);
                            try {
                                const res = await fetch('/api/invoices/sync', { method: 'POST' });
                                const data = await res.json();
                                if (data.success) {
                                    alert(`Sincronización completada:\n- Sinc: ${data.sync}\n- Vínculos nuevos: ${data.matches.matched}\n- Sugerencias: ${data.matches.suggested}`);
                                    fetchData(true);
                                } else {
                                    alert('Error: ' + data.error);
                                }
                            } catch (e: any) {
                                alert('Error de red: ' + e.message);
                            } finally {
                                setIsSyncing(false);
                            }
                        }}
                        disabled={isSyncing}
                        className={`flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-bold text-zinc-50 shadow-xl shadow-emerald-500/20 hover:scale-[1.02] transition-all hover:opacity-90 active:scale-95 ${isSyncing ? "opacity-50 cursor-wait" : ""}`}
                    >
                        <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Sincronizando..." : "Sincronizar Facturas"}
                    </button>
                </>
            )}
        </div>
      </div>

      {selectedSeason !== 'all' && (() => {
        const s = seasons.find(s => s.id.toString() === selectedSeason);
        if (!s) return null;
        const isActive = s.fecha_inicio && !s.fecha_fin;
        return (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
            <Leaf className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">{isActive ? '● Temporada Activa' : 'Temporada Seleccionada'}</p>
              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{s.nombre} {s.fecha_inicio ? `· Inicio: ${new Date(s.fecha_inicio).toLocaleDateString('es-MX')}` : ''}{s.fecha_fin ? ` · Fin: ${new Date(s.fecha_fin).toLocaleDateString('es-MX')}` : ''}</p>
            </div>
            <button onClick={() => setSelectedSeason('all')} className="ml-auto text-xs font-black text-zinc-400 hover:text-rose-500 transition-colors uppercase tracking-widest">Quitar filtro ×</button>
          </div>
        );
      })()}

      {/* Companies Hierarchy */}
      <div className="space-y-10">
        {companies.map((company) => {
            const companyAccounts = accounts.filter(a => a.empresa_id === company.id);
            const isExpanded = expandedSections.includes(company.id);

            return (
                <div key={company.id} className="space-y-4">
                    {/* Company Banner */}
                    <div 
                        onClick={() => toggleSection(company.id)}
                        className="flex items-center justify-between p-3 rounded-3xl cursor-pointer group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-zinc-50 flex items-center justify-center font-black text-2xl shadow-xl dark:bg-zinc-800">
                                {company.codigo?.[0]}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 group-hover:text-primary transition-colors">{company.nombre_completo}</h2>
                                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">{companyAccounts.length} Bancos Registrados</p>
                            </div>
                        </div>
                        <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                            {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                        </div>
                    </div>

                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="space-y-6 overflow-hidden pl-4 border-l-2 border-zinc-100 dark:border-zinc-800 ml-7"
                            >
                                {companyAccounts.map((acc) => {
                                    const accIsExpanded = expandedAccounts.includes(acc.id);
                                    // Apply temporada filter if selected
                                    const accountMoves = movements.filter(m => {
                                        if (m.cuenta_id !== acc.id) return false;
                                        if (selectedSeason !== 'all' && m.temporada_id?.toString() !== selectedSeason) return false;
                                        return true;
                                    });

                                    return (
                                        <div key={acc.id} className="space-y-4">
                                            {/* Account Item */}
                                            <div 
                                                onClick={() => toggleAccount(acc.id)}
                                                className="flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 cursor-pointer hover:border-zinc-300 transition-all group"
                                            >
                                                <div className="flex items-center gap-3 font-bold text-sm text-zinc-600 dark:text-zinc-400">
                                                    <div className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400 group-hover:text-primary transition-colors">
                                                        <Wallet className="w-4 h-4" />
                                                    </div>
                                                    <span>{acc.banco} • {acc.moneda} • {acc.descripcion}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-300">
                                                    {accIsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {accIsExpanded && (
                                                    <motion.div 
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <AccountLedger
                                                            account={acc}
                                                            movements={accountMoves}
                                                            costCenters={costCenters}
                                                            terceros={terceros}
                                                            onRefresh={() => fetchData(true)}
                                                            isAdmin={isAdmin}
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        })}
      </div>

      <AnimatePresence>
        {showForm && (
            <NewMovementForm
                onClose={() => setShowForm(false)}
                onSuccess={() => fetchData(true)}
            />
        )}
      </AnimatePresence>

      {showExportModal && (
        <ExportExcelModal
            onClose={() => setShowExportModal(false)}
            movements={movements}
            accounts={accounts}
            companies={companies}
            seasons={seasons}
            costCenters={costCenters}
        />
      )}
    </div>
  );
}
