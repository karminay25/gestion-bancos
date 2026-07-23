"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  X, 
  Save, 
  AlertCircle, 
  FileSpreadsheet, 
  Keyboard, 
  ArrowRight,
  Upload,
  CheckCircle2,
  FileCheck,
  Search,
  ShieldAlert,
  Loader2,
  TrendingUp,
  Building2,
  Leaf,
  Tag,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { formatCostCenter, compareCostCenters } from "@/lib/costCenter";

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

interface NewMovementFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialTab?: "manual" | "import";
  // Cuando es true, se renderiza como contenido de pagina normal (sin overlay
  // fijo ni fondo semitransparente) para usarse en una ruta propia en vez de
  // como modal flotante sobre otra pantalla.
  asPage?: boolean;
}

export function NewMovementForm({ onClose, onSuccess, initialTab = "manual", asPage = false }: NewMovementFormProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "import">(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data for selects
  const [companies, setCompanies] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [terceros, setTerceros] = useState<any[]>([]);

  // Autocomplete
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Selection state
  const [selectedEmpresaId, setSelectedEmpresaId] = useState("");
  const [selectedBanco, setSelectedBanco] = useState("");
  const [selectedCuentaId, setSelectedCuentaId] = useState("");

  // Manual Form state
  const [formData, setFormData] = useState({
    temporada_id: "",
    fecha: new Date().toISOString().split('T')[0],
    tipo: "Egreso",
    traspasoType: "out",
    monto: "",
    nombre_tercero: "",
    concepto: "",
    factura: "",
    centro_costo_id: "",
    destinationAccountId: "",
  });

  // Global selections shared by both tabs
  const [globalSeasonId, setGlobalSeasonId] = useState("");
  const [globalCCId, setGlobalCCId] = useState("");
  const [showAddCC, setShowAddCC] = useState(false);
  const [newCCName, setNewCCName] = useState("");
  const [savingCC, setSavingCC] = useState(false);

  const handleAddCC = async () => {
    const name = newCCName.trim().toUpperCase();
    if (!name) return;
    setSavingCC(true);

    const existing = costCenters.find(cc => cc.nombre.trim().toUpperCase() === name);
    if (existing) {
      alert(`El centro de costo "${newCCName.trim()}" ya existe.`);
      setGlobalCCId(existing.id);
      setNewCCName('');
      setShowAddCC(false);
      setSavingCC(false);
      return;
    }

    try {
      const { data, error } = await supabase.from('centros_costo').insert({ nombre: newCCName.trim() }).select();
      if (error) {
        alert('Error al guardar: ' + error.message);
      } else if (data && data.length > 0) {
        const newCC = data[0];
        setCostCenters(prev => [...prev, newCC].sort(compareCostCenters));
        setGlobalCCId(newCC.id);
        setNewCCName('');
        setShowAddCC(false);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSavingCC(false);
    }
  };

  // Import state
  const [file, setFile] = useState<File | null>(null);
  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedMoves, setSelectedMoves] = useState<Set<number>>(new Set());
  const [suggestedBalance, setSuggestedBalance] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect Empresa/Banco/Cuenta from filename
  useEffect(() => {
    if (file && activeTab === 'import' && importStep === 1) {
        const name = file.name.toUpperCase();

        // Auto-detect Empresa
        const foundEmpresa = companies.find(c => name.includes(c.codigo.toUpperCase()));
        if (foundEmpresa) setSelectedEmpresaId(foundEmpresa.id.toString());

        // Auto-detect Banco
        let guessedBanco = "";
        if (name.includes('BBVA')) guessedBanco = 'BBVA';
        else if (name.includes('MONEX')) guessedBanco = 'MONEX';
        else if (name.includes('BAJIO')) guessedBanco = 'BANBAJIO';
        if (guessedBanco) setSelectedBanco(guessedBanco);

        // Autoseleccionar la cuenta especifica SOLO si el nombre del archivo
        // deja una unica candidata posible (empresa + banco + moneda sugerida).
        // Si hay mas de una cuenta con la misma moneda para ese banco (p. ej.
        // las 2 cuentas BAJIO en USD), se deja sin seleccionar para que el
        // usuario elija manualmente cual es.
        if (foundEmpresa && guessedBanco) {
            let guessedMoneda = "";
            if (name.includes('USD') || name.includes('DOLARES')) guessedMoneda = 'USD';
            else if (name.includes('MXN') || name.includes('PESOS')) guessedMoneda = 'MXN';

            const empresaIdStr = foundEmpresa.id.toString();
            const selBancoUpper = guessedBanco.toUpperCase();
            const candidates = accounts.filter(a => {
                const dbBanco = a.banco.toUpperCase();
                const dbDesc = a.descripcion.toUpperCase();
                const bancoMatch = dbBanco.includes(selBancoUpper) || dbDesc.includes(selBancoUpper) ||
                                    (selBancoUpper === 'BANBAJIO' && (dbBanco.includes('BAJIO') || dbDesc.includes('BAJIO')));
                return a.empresa_id.toString() === empresaIdStr && bancoMatch && (!guessedMoneda || a.moneda === guessedMoneda);
            });
            if (candidates.length === 1) setSelectedCuentaId(candidates[0].id);
        }
    }
  }, [file, activeTab, companies, importStep, accounts]);

  useEffect(() => {
    async function fetchData() {
      const [
        { data: comp },
        { data: acc },
        { data: seas },
        { data: cc },
        { data: terc }
      ] = await Promise.all([
        supabase.from('empresas').select('*'),
        supabase.from('cuentas_bancarias').select('*'),
        supabase.from('temporadas').select('*'),
        supabase.from('centros_costo').select('*').order('numero', { ascending: true, nullsFirst: false }).order('nombre'),
        supabase.from('terceros').select('*, centros_costo(id, nombre)').order('nombre_canonico'),
      ]);

      if (comp) setCompanies(comp);
      if (acc) setAccounts(acc);
      if (seas) {
        setSeasons(seas);
        const activeSeason = seas.find((s: any) => s.fecha_inicio && !s.fecha_fin);
        if (activeSeason) {
          setGlobalSeasonId(activeSeason.id);
        }
      }
      if (cc) setCostCenters(cc);
      if (terc) setTerceros(terc);
    }
    fetchData();
  }, []);

  const currentAccount = useMemo(() => {
    if (!selectedCuentaId) return null;
    return accounts.find(a => a.id === selectedCuentaId) || null;
  }, [accounts, selectedCuentaId]);

  const availableBancos = useMemo(() => {
    if (!selectedEmpresaId) return [];
    const accs = accounts.filter(a => a.empresa_id.toString() === selectedEmpresaId);
    return Array.from(new Set(accs.map(a => {
        if (a.banco.toUpperCase().includes("BBVA")) return "BBVA";
        if (a.banco.toUpperCase().includes("MONEX")) return "MONEX";
        if (a.banco.toUpperCase().includes("BAJIO")) return "BANBAJIO";
        return a.banco;
    })));
  }, [accounts, selectedEmpresaId]);

  // Cuentas especificas disponibles para la empresa+banco elegidos. Se lista
  // por cuenta (no solo por moneda) porque puede haber mas de una cuenta con
  // la misma moneda bajo el mismo banco (p. ej. las 2 cuentas BAJIO en USD:
  // "BAJIO CAPTADORA CRÉDITO" y "BAJIO DISPONIBLE").
  const availableCuentas = useMemo(() => {
    if (!selectedEmpresaId || !selectedBanco) return [];
    const selBanco = selectedBanco.toUpperCase();
    return accounts.filter(a => {
        const dbBanco = a.banco.toUpperCase();
        const dbDesc = a.descripcion.toUpperCase();
        const bancoMatch = dbBanco.includes(selBanco) ||
                           dbDesc.includes(selBanco) ||
                           (selBanco === 'BANBAJIO' && (dbBanco.includes('BAJIO') || dbDesc.includes('BAJIO')));
        return a.empresa_id.toString() === selectedEmpresaId && bancoMatch;
    });
  }, [accounts, selectedEmpresaId, selectedBanco]);

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount) return;
    setLoading(true);
    setError(null);

    let finalMonto = parseFloat(formData.monto);
    if (formData.tipo === 'Traspaso' && formData.traspasoType === 'out') {
        finalMonto = -Math.abs(finalMonto);
    } else if (formData.tipo === 'Traspaso' && formData.traspasoType === 'in') {
        finalMonto = Math.abs(finalMonto);
    }

    try {
      const recordsToInsert = [{
          cuenta_id: currentAccount.id,
          temporada_id: globalSeasonId || null,
          fecha: formData.fecha,
          tipo: formData.tipo,
          monto: finalMonto,
          nombre_tercero: (formData.nombre_tercero || "").trim() || null,
          concepto: (formData.concepto || "").trim() || null,
          factura: (formData.factura || "").trim() || null,
          centro_costo_id: globalCCId || null,
      }];

      if (formData.tipo === 'Traspaso' && formData.destinationAccountId) {
          recordsToInsert.push({
              cuenta_id: formData.destinationAccountId,
              temporada_id: globalSeasonId || null,
              fecha: formData.fecha,
              tipo: formData.tipo,
              monto: -finalMonto, // Opposite sign for the destination account
              nombre_tercero: (formData.nombre_tercero || "").trim() || null,
              concepto: (formData.concepto || "").trim() || null,
              factura: (formData.factura || "").trim() || null,
              centro_costo_id: globalCCId || null,
          });
      }

      const { error: insError } = await supabase
        .from('movimientos')
        .insert(recordsToInsert);

      if (insError) throw insError;
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startImportPreview = async () => {
    if (!file || !currentAccount) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('cuentaId', currentAccount.id);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/import/preview', {
            method: 'POST',
            headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
            body: formData
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setPreviewData(data.movements);
        setSuggestedBalance(data.suggestedInitialBalance);
        const autoSelected = new Set<number>();
        data.movements.forEach((m: any, idx: number) => { if (!m.isDuplicate) autoSelected.add(idx); });
        setSelectedMoves(autoSelected);
        setImportStep(2);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const confirmImport = async () => {
    if (!currentAccount) return;
    setLoading(true);
    const movementsToSave = previewData.filter((_, idx) => selectedMoves.has(idx));

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/import/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
            },
            body: JSON.stringify({
                movements: movementsToSave, 
                cuentaId: currentAccount.id,
                temporadaId: globalSeasonId || null,
                centroCostoId: globalCCId || null,
                suggestedBalance: suggestedBalance
            })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        if (suggestedBalance !== null && (!currentAccount.saldo_inicial || currentAccount.saldo_inicial === 0)) {
            await supabase.from('cuentas_bancarias').update({ saldo_inicial: suggestedBalance }).eq('id', currentAccount.id);
        }

        onSuccess();
        onClose();
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className={asPage ? "w-full" : "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4"}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        className={
          asPage
            ? "w-full min-h-[80vh] flex flex-col"
            : "w-full h-full bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-[0_0_100px_-20px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden border border-zinc-200 dark:border-white/10"
        }
      >
        <div className={`p-8 flex flex-col gap-6 border-b ${asPage ? "border-zinc-200 dark:border-zinc-800" : "border-zinc-200 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl"}`}>
           <div className="flex items-center justify-between">
              <div>
                 <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight uppercase italic underline decoration-primary decoration-4 underline-offset-8">Centro de Registro</h2>
                 <p className="text-sm text-zinc-500 dark:text-zinc-300 mt-2 font-medium">Sincroniza tus finanzas con precisión.</p>
              </div>
              <button onClick={onClose} className="p-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/10 dark:hover:bg-white/20 border border-zinc-200 dark:border-white/10 transition-all group">
                 <X className="w-6 h-6 text-zinc-700 dark:text-white group-hover:scale-110 transition-transform" />
              </button>
           </div>

           <div className="flex p-1 bg-zinc-100 dark:bg-white/5 rounded-2xl">
              <button
                onClick={() => setActiveTab("manual")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'manual' ? "bg-white dark:bg-white text-zinc-950 shadow-xl" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"}`}
              >
                  <Keyboard className="w-4 h-4" /> Captura Manual
              </button>
              <button
                onClick={() => setActiveTab("import")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'import' ? "bg-white dark:bg-white text-zinc-950 shadow-xl" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"}`}
              >
                  <FileSpreadsheet className="w-4 h-4" /> Importar Excel
              </button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
            {error && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-500 text-sm font-bold flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900 dark:text-white">1. Configuración de Cuenta</h3>
                    {!currentAccount && selectedEmpresaId && selectedBanco && (
                        <span className="text-[9px] font-black uppercase text-rose-500 animate-pulse">Cuenta no encontrada</span>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-3 bg-zinc-50 dark:bg-white/5 p-6 rounded-[2rem] border border-zinc-200 dark:border-white/5 shadow-inner">
                    <FormField label="Empresa">
                        <select
                            value={selectedEmpresaId}
                            onChange={e => { setSelectedEmpresaId(e.target.value); setSelectedBanco(""); setSelectedCuentaId(""); }}
                            className="select-custom-dark"
                        >
                            <option value="">Selecciona...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.codigo}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Banco">
                        <select
                            value={selectedBanco}
                            onChange={e => { setSelectedBanco(e.target.value); setSelectedCuentaId(""); }}
                            className="select-custom-dark"
                            disabled={!selectedEmpresaId}
                        >
                            <option value="">Selecciona...</option>
                            {availableBancos.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Cuenta">
                        <select
                            value={selectedCuentaId}
                            onChange={e => setSelectedCuentaId(e.target.value)}
                            className={`select-custom-dark ${!selectedCuentaId ? "border-primary/50 bg-primary/5" : ""}`}
                            disabled={!selectedBanco}
                        >
                            <option value="">Selecciona...</option>
                            {availableCuentas.map(a => <option key={a.id} value={a.id}>{a.descripcion?.trim() || a.banco} ({a.moneda})</option>)}
                        </select>
                    </FormField>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-zinc-50 dark:bg-white/5 p-6 rounded-[2rem] border border-zinc-200 dark:border-white/5">
                    <FormField label="Temporada">
                        <select value={globalSeasonId} onChange={e => setGlobalSeasonId(e.target.value)} className="select-custom-dark">
                            <option value="">General (Sin temp.)</option>
                            {seasons.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Centro de Costo">
                        <div className="flex gap-2">
                            <select value={globalCCId} onChange={e => setGlobalCCId(e.target.value)} className="select-custom-dark flex-1">
                                <option value="">Gral / Sin Clasificar</option>
                                {costCenters.filter(cc => cc.numero != null || !ARCHIVED_COST_CENTERS.has(cc.nombre.toUpperCase().trim())).map(cc => <option key={cc.id} value={cc.id}>{formatCostCenter(cc)}</option>)}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowAddCC(v => !v)}
                                className="flex-shrink-0 w-[50px] h-[50px] flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400 hover:text-primary hover:border-primary/50 transition-all"
                                title="Agregar nuevo centro de costo"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </FormField>
                </div>

                <AnimatePresence>
                    {showAddCC && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="bg-zinc-50 dark:bg-white/5 border border-primary/20 rounded-[1.5rem] p-4 flex flex-col gap-3"
                        >
                            <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 font-bold">Crear Nuevo Centro de Costo</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Ej. FRAMBUESA NORTE"
                                    value={newCCName}
                                    onChange={(e) => setNewCCName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCC(); } if (e.key === 'Escape') setShowAddCC(false); }}
                                    className="input-custom-dark flex-1 py-2 text-xs font-bold uppercase"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddCC}
                                    disabled={savingCC || !newCCName.trim()}
                                    className="px-4 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    {savingCC ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                    Guardar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowAddCC(false); setNewCCName(''); }}
                                    className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 hover:text-rose-500 transition-colors px-2"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {currentAccount && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <p className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest">
                        Cuenta: <span className="text-zinc-900 dark:text-white underline decoration-primary decoration-2 underline-offset-4">{currentAccount.descripcion} ({currentAccount.moneda})</span>
                    </p>
                </motion.div>
            )}

            <AnimatePresence mode="wait">
                {activeTab === "manual" ? (
                    <motion.form key="manual" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleSubmitManual} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Tipo">
                                <div className="flex flex-col gap-2">
                                    <div className="flex p-1 bg-zinc-100 dark:bg-white/5 rounded-xl">
                                        <button type="button" onClick={() => setFormData({...formData, tipo: "Egreso"})} className={`flex-1 py-3 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${formData.tipo === 'Egreso' ? "bg-rose-500 text-white" : "text-zinc-500 dark:text-zinc-400"}`}>Egreso</button>
                                        <button type="button" onClick={() => setFormData({...formData, tipo: "Traspaso", traspasoType: "out"})} className={`flex-1 py-3 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${formData.tipo === 'Traspaso' ? "bg-blue-500 text-white" : "text-zinc-500 dark:text-zinc-400"}`}>Traspaso</button>
                                        <button type="button" onClick={() => setFormData({...formData, tipo: "Ingreso"})} className={`flex-1 py-3 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${formData.tipo === 'Ingreso' ? "bg-emerald-500 text-white" : "text-zinc-500 dark:text-zinc-400"}`}>Ingreso</button>
                                    </div>

                                    {formData.tipo === 'Traspaso' && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex p-1 bg-blue-50 dark:bg-blue-500/10 rounded-xl">
                                            <button type="button" onClick={() => setFormData({...formData, traspasoType: "out"})} className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${formData.traspasoType === 'out' ? "bg-blue-500 text-white" : "text-blue-600 dark:text-blue-400"}`}>Salida (-)</button>
                                            <button type="button" onClick={() => setFormData({...formData, traspasoType: "in"})} className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${formData.traspasoType === 'in' ? "bg-blue-500 text-white" : "text-blue-600 dark:text-blue-400"}`}>Entrada (+)</button>
                                        </motion.div>
                                    )}
                                </div>
                            </FormField>
                            <FormField label="Fecha">
                                <input type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} className="input-custom-dark" required />
                            </FormField>
                        </div>
                        <FormField label="Beneficiario / Tercero">
                            <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Ej. Driscoll's, OXXO Gas..."
                                  value={formData.nombre_tercero}
                                  autoComplete="off"
                                  onChange={e => {
                                    const val = e.target.value;
                                    setFormData({...formData, nombre_tercero: val});
                                    if (val.length >= 2) {
                                      const q = val.toLowerCase();
                                      const matches = terceros.filter(t =>
                                        t.nombre_canonico?.toLowerCase().includes(q) ||
                                        t.nombre_raw?.toLowerCase().includes(q)
                                      ).slice(0, 6);
                                      setSuggestions(matches);
                                      setShowSuggestions(matches.length > 0);
                                    } else {
                                      setShowSuggestions(false);
                                    }
                                  }}
                                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                  onFocus={() => {
                                    if (formData.nombre_tercero.length >= 2) setShowSuggestions(suggestions.length > 0);
                                  }}
                                  className="input-custom-dark"
                                  required
                                />
                                {showSuggestions && (
                                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden shadow-2xl">
                                    {suggestions.map(t => (
                                      <button
                                        key={t.id}
                                        type="button"
                                        onMouseDown={() => {
                                          setFormData(prev => ({
                                            ...prev,
                                            nombre_tercero: t.nombre_canonico,
                                            ...(t.centro_costo_id && !globalCCId ? {} : {})
                                          }));
                                          if (t.centro_costo_id && !globalCCId) setGlobalCCId(t.centro_costo_id.toString());
                                          setShowSuggestions(false);
                                        }}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors text-left"
                                      >
                                        <div>
                                          <p className="text-sm font-bold text-zinc-900 dark:text-white">{t.nombre_canonico}</p>
                                          {t.nombre_canonico !== t.nombre_raw && (
                                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">{t.nombre_raw}</p>
                                          )}
                                        </div>
                                        {t.centros_costo && (
                                          <span className="text-[9px] font-black uppercase bg-primary/20 text-primary px-2 py-0.5 rounded-full ml-2 whitespace-nowrap">{formatCostCenter(t.centros_costo)}</span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                            </div>
                        </FormField>

                        {formData.tipo === 'Traspaso' && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl">
                                <FormField label={`Cuenta Destino para Traspaso de ${formData.traspasoType === 'out' ? 'Salida' : 'Entrada'} (Opcional)`}>
                                    <select
                                        value={formData.destinationAccountId}
                                        onChange={e => setFormData({...formData, destinationAccountId: e.target.value})}
                                        className="input-custom-dark text-sm"
                                    >
                                        <option value="">-- No generar movimiento en otra cuenta --</option>
                                        {accounts.filter(a => a.id !== currentAccount.id).map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.banco} - {acc.descripcion} ({acc.moneda})
                                            </option>
                                        ))}
                                    </select>
                                </FormField>
                                <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 mt-2 tracking-widest">
                                    Si seleccionas una cuenta, se insertará automáticamente un movimiento de {formData.traspasoType === 'out' ? 'ENTRADA (+)' : 'SALIDA (-)'} en esa cuenta.
                                </p>
                            </motion.div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Monto">
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold pointer-events-none">$</span>
                                    <input type="number" step="0.01" value={formData.monto} onChange={e => setFormData({...formData, monto: e.target.value})} className="input-custom-dark text-lg font-black" style={{ paddingLeft: '2.25rem' }} required />
                                </div>
                            </FormField>
                            <FormField label="Factura">
                                <input type="text" value={formData.factura} onChange={e => setFormData({...formData, factura: e.target.value})} className="input-custom-dark" />
                            </FormField>
                        </div>
                        <FormField label="Concepto">
                            <textarea rows={3} value={formData.concepto} onChange={e => setFormData({...formData, concepto: e.target.value})} className="input-custom-dark" />
                        </FormField>
                    </motion.form>
                ) : (
                    <motion.div key="import" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900 dark:text-white">2. Cargar Archivo Bancario</h3>
                        </div>
                        {importStep === 1 ? (
                            <div className="space-y-6">
                                <div onClick={() => fileInputRef.current?.click()} className={`h-[250px] border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${file ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-200 dark:border-white/10 hover:border-primary/50 hover:bg-zinc-50 dark:hover:bg-white/5"}`}>
                                    <input type="file" ref={fileInputRef} className="hidden" accept=".xls,.xlsx,.csv" onChange={e => e.target.files && setFile(e.target.files[0])} />
                                    {file ? (
                                        <>
                                            <div className="w-16 h-16 bg-emerald-500 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20"><FileCheck className="w-8 h-8" /></div>
                                            <p className="font-black text-zinc-900 dark:text-white">{file.name}</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-500 rounded-3xl flex items-center justify-center"><Upload className="w-8 h-8" /></div>
                                            <div className="text-center">
                                                <p className="font-black text-zinc-900 dark:text-white">Sincronización de Archivos</p>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium italic">Soporta BBVA, Monex y Bajío</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button onClick={startImportPreview} disabled={!file || !currentAccount || loading} className="w-full py-5 bg-primary text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-primary/20 hover:scale-[1.01] transition-all disabled:opacity-20 flex items-center justify-center gap-3">
                                    {loading ? <Loader2Icon /> : <ArrowRight className="w-6 h-6" />} Continuar al Análisis
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="max-h-[350px] overflow-y-auto rounded-[2rem] border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-900/20">
                                    <table className="w-full text-left text-xs">
                                        <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest border-b border-zinc-200 dark:border-white/5 z-10">
                                            <tr><th className="p-4 w-10"></th><th className="p-4">Fecha</th><th className="p-4">Beneficiario / Concepto</th><th className="p-4">Clasificación</th><th className="p-4 text-right">Monto</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                                            {previewData.map((m, idx) => (
                                                <tr key={idx} className={`transition-colors ${m.isDuplicate ? "opacity-30 grayscale" : "hover:bg-zinc-100 dark:hover:bg-white/5"}`}>
                                                    <td className="p-4"><input type="checkbox" checked={selectedMoves.has(idx)} onChange={() => { const n = new Set(selectedMoves); if (n.has(idx)) n.delete(idx); else n.add(idx); setSelectedMoves(n); }} className="w-4 h-4 accent-primary" /></td>
                                                    <td className="p-4 font-bold text-zinc-700 dark:text-zinc-200 whitespace-nowrap">{m.fecha.split('-').reverse().join('/')}</td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-1.5 min-w-[220px]">
                                                            <input
                                                                type="text"
                                                                value={m.descripcion ?? ''}
                                                                onChange={(e) => {
                                                                    const next = [...previewData];
                                                                    next[idx] = { ...next[idx], descripcion: e.target.value, _descripcionEdited: true };
                                                                    setPreviewData(next);
                                                                }}
                                                                placeholder="Beneficiario / Tercero"
                                                                className="input-custom-dark !p-2 !text-[11px] !rounded-lg font-bold"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={m.concepto ?? ''}
                                                                onChange={(e) => {
                                                                    const next = [...previewData];
                                                                    next[idx] = { ...next[idx], concepto: e.target.value };
                                                                    setPreviewData(next);
                                                                }}
                                                                placeholder="Concepto (opcional)"
                                                                className="input-custom-dark !p-2 !text-[11px] !rounded-lg"
                                                            />
                                                            {m.isDuplicate && <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter flex items-center gap-1 mt-0.5"><ShieldAlert className="w-2.5 h-2.5" /> Duplicado</span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                            <select 
                                                                value={m.tipo} 
                                                                onChange={(e) => {
                                                                    const next = [...previewData];
                                                                    const prevTipo = next[idx].tipo;
                                                                    next[idx].tipo = e.target.value;
                                                                    if (e.target.value === 'Traspaso' && prevTipo === 'Egreso') next[idx].monto = -Math.abs(parseFloat(next[idx].monto));
                                                                    else if (e.target.value === 'Traspaso' && prevTipo === 'Ingreso') next[idx].monto = Math.abs(parseFloat(next[idx].monto));
                                                                    else next[idx].monto = Math.abs(parseFloat(next[idx].monto));
                                                                    setPreviewData(next);
                                                                }}
                                                                className="input-custom-dark !p-2 !text-[11px] !rounded-lg"
                                                            >
                                                                <option value="Ingreso">Ingreso</option>
                                                                <option value="Egreso">Egreso</option>
                                                                <option value="Traspaso">Traspaso</option>
                                                            </select>
                                                            <select
                                                                value={m.centro_costo_id || ''}
                                                                onChange={(e) => {
                                                                    const next = [...previewData];
                                                                    next[idx].centro_costo_id = e.target.value || null;
                                                                    setPreviewData(next);
                                                                }}
                                                                className="input-custom-dark !p-2 !text-[11px] !rounded-lg"
                                                            >
                                                                <option value="">-- Sin C.C. --</option>
                                                                {costCenters.map(cc => <option key={cc.id} value={cc.id}>{formatCostCenter(cc)}</option>)}
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td className={`p-4 text-right font-black ${m.tipo === 'Traspaso' ? 'text-blue-600 dark:text-blue-400' : m.tipo === 'Ingreso' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                        ${Math.abs(parseFloat(m.monto)).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => setImportStep(1)} className="flex-1 py-4 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-zinc-200 dark:hover:bg-white/10 transition-all">Atrás</button>
                                    <button onClick={confirmImport} disabled={selectedMoves.size === 0 || loading} className="flex-[2] py-4 bg-primary text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-20">{loading ? <Loader2Icon /> : `Registrar ${selectedMoves.size} Movimientos`}</button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {activeTab === "manual" && (
            <div className="p-8 border-t border-zinc-200 dark:border-white/5">
               <button onClick={handleSubmitManual} disabled={loading || !currentAccount} className="w-full flex items-center justify-center gap-3 rounded-[2rem] bg-indigo-600 py-5 text-lg font-black text-white shadow-2xl shadow-indigo-600/20 hover:scale-[1.01] transition-all active:scale-[0.98] disabled:opacity-20">
                 {loading ? <Loader2Icon /> : <><Save className="w-6 h-6" /> Guardar Registro Manual</>}
               </button>
            </div>
        )}
      </motion.div>

      <style jsx>{`
        .input-custom-dark {
            width: 100%;
            padding: 1rem 1.25rem;
            border-radius: 1rem;
            border: 1px solid rgba(0,0,0,0.08);
            background-color: #f4f4f5;
            font-size: 0.875rem;
            color: #18181b;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .input-custom-dark:focus { outline: none; border-color: #6366f1; background-color: rgba(99, 102, 241, 0.05); box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1); }
        .select-custom-dark {
            width: 100%;
            padding: 1rem 1.25rem;
            border-radius: 1rem;
            border: 1px solid rgba(0,0,0,0.08);
            background-color: #f4f4f5;
            font-size: 0.875rem;
            color: #18181b;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(0,0,0,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 1rem center;
            background-size: 1rem;
        }
        .select-custom-dark option {
            background-color: #f4f4f5;
            color: #18181b;
        }
        :global(.dark) .input-custom-dark,
        :global(.dark) .select-custom-dark {
            border: 1px solid rgba(255,255,255,0.05);
            background-color: #18181b;
            color: white;
        }
        :global(.dark) .select-custom-dark {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.3)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
        }
        :global(.dark) .select-custom-dark option {
            background-color: #18181b;
            color: white;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </motion.div>
  );
}

function FormField({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <div className="space-y-2 text-left">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white ml-1">{label}</label>
            {children}
        </div>
    );
}

function Loader2Icon() {
    return <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><Loader2 className="w-6 h-6" /></motion.div>;
}
