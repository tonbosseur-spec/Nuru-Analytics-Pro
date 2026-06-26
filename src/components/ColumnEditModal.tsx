import React, { useState, useEffect } from 'react';
import { ColumnMetadata, StatType, MathOperation, StringCleanOperation, BinningMethod, EncodingMethod } from '../types';
import { X, Settings, Calculator, FileText, Layers, Hash, Binary, Sparkles, Calendar } from 'lucide-react';
import { useWorkspaceStore } from '../store';

interface Props {
  column: ColumnMetadata | null;
  onClose: () => void;
}

export default function ColumnEditModal({ column, onClose }: Props) {
  const updateColumn = useWorkspaceStore((state) => state.updateColumn);
  const applyMathTransform = useWorkspaceStore((state) => state.applyMathTransform);
  const extractDatePart = useWorkspaceStore((state) => state.extractDatePart);
  const cleanStringColumn = useWorkspaceStore((state) => state.cleanStringColumn);
  const convertColumnToDate = useWorkspaceStore((state) => state.convertColumnToDate);
  const splitQualitativeColumn = useWorkspaceStore((state) => state.splitQualitativeColumn);
  const discretizeColumn = useWorkspaceStore((state) => state.discretizeColumn);
  const groupCategories = useWorkspaceStore((state) => state.groupCategories);
  const encodeColumn = useWorkspaceStore((state) => state.encodeColumn);
  const getUniqueValues = useWorkspaceStore((state) => state.getUniqueValues);
  const allColumns = useWorkspaceStore((state) => state.columns);
  
  const [activeTab, setActiveTab] = useState<'props' | 'math' | 'text' | 'binning' | 'standardize' | 'date' | 'split' | 'to_date'>('props');
  
  // Split state
  const [splitMethod, setSplitMethod] = useState<'separator' | 'length'>('separator');
  const [splitSepValue, setSplitSepValue] = useState<string>('space');
  const [customSep, setCustomSep] = useState<string>('');
  const [splitLength, setSplitLength] = useState<number>(3);
  const [splitTargetCol1, setSplitTargetCol1] = useState<string>('');
  const [splitTargetCol2, setSplitTargetCol2] = useState<string>('');

  // Props state
  const [name, setName] = useState('');
  const [type, setType] = useState<StatType>('nominal');
  
  // Math & binning state
  const [mathOp, setMathOp] = useState<MathOperation>('standardize');
  const [newColName, setNewColName] = useState('');
  const [operandType, setOperandType] = useState<'column' | 'constant'>('constant');
  const [targetCol, setTargetCol] = useState('');
  const [constantVal, setConstantVal] = useState<number>(0);
  
  // Text state
  const [textOp, setTextOp] = useState<StringCleanOperation>('trim');

  // Date state
  const [datePart, setDatePart] = useState<'day' | 'week' | 'month' | 'year' | 'quarter'>('month');

  // Binning & standardize state...
  const [binMethod, setBinMethod] = useState<BinningMethod>('auto');
  const [numBins, setNumBins] = useState<number>(3);
  const [thresholdsStr, setThresholdsStr] = useState<string>('');
  const [binLabelsStr, setBinLabelsStr] = useState<string>('');

  // Standardisation state
  const [groups, setGroups] = useState<{name: string, values: string[]}[]>([]);
  const [uniqueVals, setUniqueVals] = useState<string[]>([]);
  const [isStandardizeInPlace, setIsStandardizeInPlace] = useState(true);
  const [standardizeColName, setStandardizeColName] = useState('');

  // Date conversion states
  const [isDateInPlace, setIsDateInPlace] = useState(true);
  const [dateTargetColName, setDateTargetColName] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (column) {
      setName(column.name);
      setType(column.type);
      setNewColName(`${column.name}_calc`);
      setStandardizeColName(`${column.name}_std`);
      setIsStandardizeInPlace(true);
      setDateTargetColName(`${column.name}_date`);
      setIsDateInPlace(true);
      setGroups([]); // Reset groups for standardisation
      setSplitTargetCol1(`${column.name}_1`);
      setSplitTargetCol2(`${column.name}_2`);
      setSplitSepValue('space');
      setSplitMethod('separator');
      setCustomSep('');
      setActiveTab('props');
      if (column.type === 'nominal' || column.type === 'ordinal') {
         getUniqueValues(column.name).then(vals => {
             setUniqueVals(vals.map(String));
         });
      }
    }
  }, [column]);

  if (!column) return null;

  const handleSaveProps = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    await updateColumn(column.name, name.trim(), type);
    setIsSaving(false);
    onClose();
  };

  const handleSaveDateConversion = async () => {
    setIsSaving(true);
    const target = isDateInPlace ? undefined : (dateTargetColName.trim() || `${column.name}_date`);
    await convertColumnToDate(column.name, target);
    setIsSaving(false);
    onClose();
  };

  const handleSaveStandardize = async () => {
    const targetCol = isStandardizeInPlace ? undefined : (standardizeColName.trim() || `${column.name}_std`);
    const mapping: Record<string, string> = {};
    groups.forEach(g => {
        g.values.forEach(v => { mapping[v] = g.name.trim(); });
    });
    setIsSaving(true);
    await groupCategories(column.name, mapping, targetCol);
    setIsSaving(false);
    onClose();
  };

  const handleSaveMath = async () => {
    if (!newColName.trim()) return;
    setIsSaving(true);
    await applyMathTransform(
      column.name, 
      mathOp, 
      newColName.trim(), 
      operandType === 'column' ? targetCol : undefined, 
      operandType === 'constant' ? constantVal : undefined
    );
    setIsSaving(false);
    onClose();
  };

  const handleSaveText = async () => {
    setIsSaving(true);
    await cleanStringColumn(column.name, textOp);
    setIsSaving(false);
    onClose();
  };

  const handleSaveSplit = async () => {
    if (!splitTargetCol1.trim() || !splitTargetCol2.trim()) return;
    setIsSaving(true);
    const sep = splitSepValue === 'custom' ? customSep : splitSepValue;
    await splitQualitativeColumn(
      column.name,
      splitMethod,
      splitTargetCol1.trim(),
      splitTargetCol2.trim(),
      sep,
      splitLength
    );
    setIsSaving(false);
    onClose();
  };

  const handleSaveDate = async () => {
    if (!newColName.trim()) return;
    setIsSaving(true);
    await extractDatePart(column.name, datePart, newColName.trim());
    setIsSaving(false);
    onClose();
  };

  const handleSaveBinning = async () => {
    if (!newColName.trim()) return;
    setIsSaving(true);
    const thresholds = binMethod === 'custom' ? thresholdsStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)) : undefined;
    const labels = binLabelsStr.trim() ? binLabelsStr.split(',').map(s => s.trim()) : undefined;
    await discretizeColumn(column.name, binMethod, newColName.trim(), numBins, thresholds, labels);
    setIsSaving(false);
    onClose();
  };

  const needsOperand = ['add', 'subtract', 'multiply', 'divide'].includes(mathOp);
  const isTextType = type === 'nominal' || type === 'ordinal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900 truncate">Édition : {column.name}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100 transition-colors pointer-events-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex px-4 border-b border-zinc-100 pt-2 gap-4 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('props')}
            title="Propriétés"
            className={`flex items-center gap-1.5 pb-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'props' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
          {!isTextType && type !== 'datetime' && (
            <>
              <button 
                onClick={() => setActiveTab('math')}
                className={`flex items-center gap-1.5 pb-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'math' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                <Calculator className="w-4 h-4" /> Calcul
              </button>
              <button 
                onClick={() => setActiveTab('binning')}
                className={`flex items-center gap-1.5 pb-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'binning' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                <Hash className="w-4 h-4" /> Discrétisation
              </button>
            </>
          )}
          {type === 'datetime' && (
             <button 
                onClick={() => setActiveTab('date')}
                className={`flex items-center gap-1.5 pb-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'date' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                <Calculator className="w-4 h-4" /> Extraction (Date)
              </button>
          )}
          {isTextType && (
            <>
              <button 
                onClick={() => setActiveTab('text')}
                className={`flex items-center gap-1.5 pb-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'text' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                <FileText className="w-4 h-4" /> Nettoyage
              </button>
              <button 
                onClick={() => setActiveTab('standardize')}
                className={`flex items-center gap-1.5 pb-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'standardize' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                <Layers className="w-4 h-4" /> Standardisation
              </button>
              <button 
                onClick={() => setActiveTab('split')}
                className={`flex items-center gap-1.5 pb-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'split' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                <Binary className="w-4 h-4" /> Scinder
              </button>
            </>
          )}
          {type !== 'datetime' && (
            <button 
              onClick={() => setActiveTab('to_date')}
              title="Transformer en Date"
              className={`flex items-center gap-1.5 pb-2 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'to_date' ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
            >
              <Calendar className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {activeTab === 'props' && (
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Nouveau nom de variable</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Type statistique</label>
              <select 
                value={type} 
                onChange={(e) => {
                  const newType = e.target.value as StatType;
                  setType(newType);
                  setActiveTab(prev => {
                    if ((newType === 'nominal' || newType === 'ordinal') && prev === 'math') {
                      return 'text';
                    } else if ((newType !== 'nominal' && newType !== 'ordinal') && prev === 'text') {
                      return 'math';
                    }
                    return prev;
                  });
                }}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white"
              >
                <option value="nominal">Nominal (Catégories)</option>
                <option value="ordinal">Ordinal (Catégories ordonnées)</option>
                <option value="continuous">Continu (Mesures décimales)</option>
                <option value="discrete">Discret (Comptages entiers)</option>
                <option value="datetime">Date et Heure</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'date' && type === 'datetime' && (
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Créer une nouvelle variable :</label>
              <input 
                type="text" 
                value={newColName} 
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Nom de la nouvelle variable"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Composant de la date à extraire</label>
              <select 
                value={datePart} 
                onChange={(e) => setDatePart(e.target.value as any)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white"
              >
                <option value="day">Jour du mois</option>
                <option value="week">Numéro de semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
                <option value="quarter">Trimestre</option>
              </select>
            </div>
            
            <p className="text-xs text-zinc-500">
              Ceci créera une nouvelle variable discrète contenant uniquement la partie sélectionnée de la date.
            </p>
          </div>
        )}

        {activeTab === 'math' && !isTextType && type !== 'datetime' && (
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Créer une nouvelle colonne :</label>
              <input 
                type="text" 
                value={newColName} 
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Nom de la nouvelle variable"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Opération mathématique</label>
              <select 
                value={mathOp} 
                onChange={(e) => setMathOp(e.target.value as MathOperation)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white"
              >
                <option value="standardize">Standardisation (Z-Score)</option>
                <option value="log">Logarithme népérien (ln)</option>
                <option value="sqrt">Racine carrée</option>
                <option value="add">Addition (+)</option>
                <option value="subtract">Soustraction (-)</option>
                <option value="multiply">Multiplication (×)</option>
                <option value="divide">Division (÷)</option>
              </select>
            </div>

            {needsOperand && (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={operandType === 'constant'} 
                      onChange={() => setOperandType('constant')}
                      className="accent-zinc-900" 
                    />
                     Constante
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={operandType === 'column'} 
                      onChange={() => setOperandType('column')}
                      className="accent-zinc-900" 
                    />
                     Autre variable
                  </label>
                </div>

                {operandType === 'constant' ? (
                  <input 
                    type="number" 
                    value={isNaN(constantVal) ? '' : constantVal} 
                    onChange={(e) => setConstantVal(parseFloat(e.target.value))}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                ) : (
                  <select 
                    value={targetCol} 
                    onChange={(e) => setTargetCol(e.target.value)}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white"
                  >
                    <option value="">Sélectionner une variable...</option>
                    {allColumns.filter(c => c.name !== column.name).map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            
            <p className="text-xs text-zinc-500 bg-blue-50 text-blue-800 p-2 rounded-lg border border-blue-100">
               Info : Les valeurs textes seront ignorées et remplacées par des données vides (NaN) lors du calcul.
            </p>
          </div>
        )}

        {activeTab === 'text' && isTextType && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-zinc-600">
              Appliquez un nettoyage sur toutes les valeurs de cette colonne textuelle.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Traitement</label>
              <select 
                value={textOp} 
                onChange={(e) => setTextOp(e.target.value as StringCleanOperation)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white"
              >
                <option value="trim">Trim (Supprimer espaces inutiles : " texte  " {'->'} "texte")</option>
                <option value="lower">Minuscules ("Texte" {'->'} "texte")</option>
                <option value="upper">Majuscules ("texte" {'->'} "TEXTE")</option>
                <option value="title">Nom Propre ("le texte" {'->'} "Le Texte")</option>
              </select>
            </div>
            
            <p className="text-xs text-zinc-500 bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-100">
              Attention : Cette action modifie la variable actuelle en place.
            </p>
          </div>
        )}

        {activeTab === 'binning' && !isTextType && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-zinc-600">
              Découpe une variable continue en catégories ordonnées.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Créer une nouvelle colonne :</label>
              <input type="text" value={newColName} onChange={(e) => setNewColName(e.target.value)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Méthode de découpage</label>
              <select value={binMethod} onChange={(e) => setBinMethod(e.target.value as BinningMethod)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white">
                <option value="auto">Automatique (Intervalles égaux)</option>
                <option value="custom">Manuel (Seuils personnalisés)</option>
              </select>
            </div>
            {binMethod === 'auto' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Nombre de classes</label>
                <input type="number" min="2" value={numBins} onChange={(e) => setNumBins(parseInt(e.target.value) || 2)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Seuils (ex: 0, 10, 50, 100)</label>
                <input type="text" value={thresholdsStr} onChange={(e) => setThresholdsStr(e.target.value)} placeholder="0, 10, 50, 100" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Noms des classes (optionnel, séparés par virgule)</label>
              <input type="text" value={binLabelsStr} onChange={(e) => setBinLabelsStr(e.target.value)} placeholder="Faible, Moyen, Fort" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
            </div>
          </div>
        )}

        {activeTab === 'standardize' && isTextType && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 space-y-1 select-none">
              <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Standardisation des textes
              </h4>
              <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                Idéal pour corriger les variations de saisie (ex: <span className="font-semibold text-emerald-950 font-mono bg-white/70 px-1 py-0.5 rounded border border-emerald-200/50">M, Male, male, Homme</span> vers <span className="font-semibold text-emerald-950 font-mono bg-white/75 px-1.5 py-0.5 rounded border border-emerald-200">H</span>). Les valeurs non sélectionnées conserveront leur état d'origine.
              </p>
            </div>

            {/* In-place or New Column toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Type de modification</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsStandardizeInPlace(true)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${isStandardizeInPlace ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                >
                  <span className="text-[11px] font-bold">Modifier en place</span>
                  <span className={`text-[9px] mt-0.5 ${isStandardizeInPlace ? 'text-zinc-300' : 'text-slate-400'}`}>Écrase la colonne actuelle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStandardizeInPlace(false)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${!isStandardizeInPlace ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                >
                  <span className="text-[11px] font-bold">Nouvelle variable</span>
                  <span className={`text-[9px] mt-0.5 ${!isStandardizeInPlace ? 'text-zinc-300' : 'text-slate-400'}`}>Génère une nouvelle colonne</span>
                </button>
              </div>
            </div>

            {!isStandardizeInPlace && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-xs font-bold text-zinc-700">Nom de la variable cible :</label>
                <input 
                  type="text" 
                  value={standardizeColName} 
                  onChange={(e) => setStandardizeColName(e.target.value)} 
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" 
                  placeholder={`${column.name}_std`}
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                <label className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-widest">Règles de mappage</label>
                <button 
                  onClick={() => setGroups([...groups, { name: 'VALEUR_CORRIGEE', values: [] }])} 
                  className="text-xs text-zinc-900 bg-zinc-100 hover:bg-zinc-200 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-zinc-200"
                >
                  + Nouveau groupe
                </button>
              </div>

              {groups.length === 0 && (
                <div className="text-xs text-zinc-400 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-6 text-center italic">
                  Aucun groupe de standardisation défini. Cliquez sur le bouton pour commencer à harmoniser vos valeurs.
                </div>
              )}

              {groups.map((group, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-[10px] font-extrabold text-slate-550 uppercase">Valeur standard finale</label>
                      <input 
                        type="text" 
                        value={group.name} 
                        onChange={(e) => {
                          const newGroups = [...groups]; 
                          newGroups[idx].name = e.target.value; 
                          setGroups(newGroups);
                        }} 
                        className="w-full border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:border-zinc-500" 
                        placeholder="Ex: H, F, Oui..." 
                      />
                    </div>
                    <button 
                      onClick={() => setGroups(groups.filter((_, i) => i !== idx))} 
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-lg border border-transparent hover:border-red-100 transition-all self-end cursor-pointer"
                      title="Supprimer ce groupe"
                    >
                      <X className="w-4 h-4"/>
                    </button>
                  </div>

                  <div className="space-y-1.5 font-sans">
                    <label className="text-[10px] font-extrabold text-slate-550 uppercase block">Valeurs existantes à remplacer</label>
                    <div className="text-xs text-zinc-600 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white border border-zinc-150 rounded-lg [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-zinc-200">
                      {uniqueVals.length === 0 ? (
                        <span className="text-[11px] text-zinc-450 italic">Chargement des modalités...</span>
                      ) : (
                        uniqueVals.map(v => {
                          const isChecked = group.values.includes(v);
                          return (
                            <label 
                              key={v} 
                              className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-lg cursor-pointer transition-all select-none
                                ${isChecked 
                                  ? 'bg-zinc-900 border-zinc-900 text-white font-bold shadow-sm' 
                                  : 'bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100'}`}
                            >
                              <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={isChecked} 
                                onChange={(e) => {
                                  const newGroups = [...groups];
                                  if (e.target.checked) {
                                    newGroups[idx].values.push(v);
                                    // Retirer de tous les autres groupes pour éviter conflits
                                    newGroups.forEach((otherG, otherIdx) => {
                                      if (otherIdx !== idx) {
                                        otherG.values = otherG.values.filter(val => val !== v);
                                      }
                                    });
                                  } else {
                                    newGroups[idx].values = newGroups[idx].values.filter(val => val !== v);
                                  }
                                  setGroups(newGroups);
                                }} 
                              />
                              {v === '' ? <span className="italic text-slate-400 font-normal">(Vide)</span> : v}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'split' && isTextType && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 space-y-1 select-none">
              <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <Binary className="w-3.5 h-3.5 text-indigo-600" />
                Scission de la variable qualitative
              </h4>
              <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">
                Séparez les valeurs de cette colonne en deux nouvelles variables distinctes. Les nouvelles colonnes seront automatiquement ajoutées au jeu de données.
              </p>
            </div>

            {/* Méthode de scission: Séparateur ou Longueur */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-750">Critère de scission</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSplitMethod('separator')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${splitMethod === 'separator' ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-650'}`}
                >
                  <span className="text-[11px] font-bold">Séparateur (caractère)</span>
                  <span className={`text-[9px] mt-0.5 ${splitMethod === 'separator' ? 'text-zinc-350' : 'text-slate-400'}`}>Ex: espace, tiret, virgule, etc.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMethod('length')}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${splitMethod === 'length' ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-650'}`}
                >
                  <span className="text-[11px] font-bold">Longueur fixe</span>
                  <span className={`text-[9px] mt-0.5 ${splitMethod === 'length' ? 'text-zinc-350' : 'text-slate-400'}`}>Couper à une position précise (index)</span>
                </button>
              </div>
            </div>

            {/* Options selon la méthode */}
            {splitMethod === 'separator' ? (
              <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700">Sélectionner un séparateur</label>
                  <select
                    value={splitSepValue}
                    onChange={(e) => setSplitSepValue(e.target.value)}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white font-medium text-slate-700"
                  >
                    <option value="space">Espace</option>
                    <option value="-">Tiret (-)</option>
                    <option value=",">Virgule (,)</option>
                    <option value=";">Point-virgule (;)</option>
                    <option value="custom">Autre (Saisie personnalisée...)</option>
                  </select>
                </div>

                {splitSepValue === 'custom' && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                    <label className="text-xs font-bold text-zinc-700">Séparateur personnalisé</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={customSep}
                      onChange={(e) => setCustomSep(e.target.value)}
                      placeholder="Ex: _ ou / ou |"
                      className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in duration-200">
                <label className="text-xs font-bold text-zinc-700">Position de coupure (Nombre de caractères)</label>
                <input
                  type="number"
                  min="1"
                  value={splitLength}
                  onChange={(e) => setSplitLength(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 bg-white text-slate-800"
                />
                <p className="text-[10px] text-zinc-500 font-medium">Pour "abcdef" coupé à 3, les variables contiendront "abc" et "def".</p>
              </div>
            )}

            {/* Noms des nouvelles colonnes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-750">Nom de la première variable</label>
                <input
                  type="text"
                  value={splitTargetCol1}
                  onChange={(e) => setSplitTargetCol1(e.target.value)}
                  className="w-full border border-zinc-250 rounded-lg px-3 py-2 text-xs font-bold text-slate-850 focus:outline-none focus:border-zinc-455"
                  placeholder={`${column.name}_1`}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-750">Nom de la deuxième variable</label>
                <input
                  type="text"
                  value={splitTargetCol2}
                  onChange={(e) => setSplitTargetCol2(e.target.value)}
                  className="w-full border border-zinc-250 rounded-lg px-3 py-2 text-xs font-bold text-slate-850 focus:outline-none focus:border-zinc-455"
                  placeholder={`${column.name}_2`}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'to_date' && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 space-y-1 select-none">
              <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                Conversion intelligente en Date
              </h4>
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                Saisissez ou convertissez les valeurs de cette colonne en dates réelles. 
                Gère intelligemment les formats de texte standards ainsi que les numéros continus 
                générés par Excel (ex: <span className="font-semibold text-amber-950 font-mono bg-white/70 px-1.5 py-0.5 rounded border border-amber-200/50">01</span> ou <span className="font-semibold text-amber-950 font-mono bg-white/70 px-1.5 py-0.5 rounded border border-amber-200/50">1</span> converti en <span className="font-semibold text-amber-950 font-mono bg-white/75 px-1.5 py-0.5 rounded border border-amber-200">01/01/1900</span>).
              </p>
            </div>

            {/* In-place or New Column toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Type de modification</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsDateInPlace(true)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${isDateInPlace ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-605 text-slate-600'}`}
                >
                  <span className="text-[11px] font-bold">Modifier en place</span>
                  <span className={`text-[9px] mt-0.5 ${isDateInPlace ? 'text-zinc-300' : 'text-slate-400'}`}>Écrase la variable actuelle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDateInPlace(false)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${!isDateInPlace ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-605 text-slate-600'}`}
                >
                  <span className="text-[11px] font-bold">Nouvelle variable</span>
                  <span className={`text-[9px] mt-0.5 ${!isDateInPlace ? 'text-zinc-300' : 'text-slate-400'}`}>Génère une nouvelle colonne</span>
                </button>
              </div>
            </div>

            {!isDateInPlace && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="text-xs font-bold text-zinc-750">Nom de la variable cible :</label>
                <input 
                  type="text" 
                  value={dateTargetColName} 
                  onChange={(e) => setDateTargetColName(e.target.value)} 
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 text-slate-800 font-medium bg-white" 
                  placeholder={`${column.name}_date`}
                />
              </div>
            )}

            <p className="text-xs text-zinc-500 bg-zinc-100 text-zinc-700 p-3 rounded-xl border border-zinc-200 leading-relaxed">
              <strong>Note sur le typage Excel</strong> : Si vos dates ont été interprétées comme des nombres entiers par Excel ou importées comme variables quantitatives continues, cette étape rétablit le lien d'indexation temporelle correct de 1900.
            </p>
          </div>
        )}

        <div className="p-4 border-t border-zinc-100 flex justify-end gap-2 bg-zinc-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 bg-zinc-100 rounded-lg transition-colors pointer-events-auto"
          >
            Annuler
          </button>
          <button 
            onClick={() => {
              if (activeTab === 'props') handleSaveProps();
              else if (activeTab === 'math') handleSaveMath();
              else if (activeTab === 'text') handleSaveText();
              else if (activeTab === 'split') handleSaveSplit();
              else if (activeTab === 'binning') handleSaveBinning();
              else if (activeTab === 'standardize') handleSaveStandardize();
              else if (activeTab === 'date') handleSaveDate();
              else if (activeTab === 'to_date') handleSaveDateConversion();
            }}
            disabled={
              isSaving || 
              (activeTab === 'math' && needsOperand && operandType === 'column' && !targetCol) ||
              (activeTab === 'binning' && binMethod === 'custom' && !thresholdsStr.trim()) ||
              (activeTab === 'split' && (!splitTargetCol1.trim() || !splitTargetCol2.trim())) ||
              (activeTab === 'standardize' && (groups.length === 0 || (!isStandardizeInPlace && !standardizeColName.trim()))) ||
              (activeTab === 'to_date' && (!isDateInPlace && !dateTargetColName.trim()))
            }
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 bg-zinc-900 rounded-lg transition-all disabled:opacity-50 pointer-events-auto shadow-md"
          >
           {isSaving ? <span className="animate-pulse">En cours...</span> : 'Appliquer'}
          </button>
        </div>
      </div>
    </div>
  );
}
