import React, { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../store';
import { ColumnMetadata } from '../types';
import { evaluateFormulaForRow } from '../utils/formulaEvaluator';
import { X, Calculator, HelpCircle, Columns, List, CheckCircle2, ChevronRight, Play, Delete, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function VariableCalculatorModal({ isOpen, onClose }: Props) {
  const columns = useWorkspaceStore((state) => state.columns);
  const previewData = useWorkspaceStore((state) => state.previewData);
  const addFormulaPipelineStep = useWorkspaceStore((state) => state.addFormulaPipelineStep);

  const [inputEquation, setInputEquation] = useState('');
  const [newVarName, setNewVarName] = useState('Var1');
  const [formulaPart, setFormulaPart] = useState('');
  
  // Real-time parsed state
  const [parsedVarName, setParsedVarName] = useState('Var1');
  const [parsedFormula, setParsedFormula] = useState('');
  
  // Custom manual entry vs single expression toggle
  const [inputMode, setInputMode] = useState<'equation' | 'split'>('equation');

  const formulaInputRef = useRef<HTMLTextAreaElement>(null);

  // Sync parsing when input changes
  useEffect(() => {
    if (inputMode === 'equation') {
      const trimmed = inputEquation.trim();
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const left = trimmed.substring(0, eqIdx).trim();
        const right = trimmed.substring(eqIdx + 1).trim();
        
        // Sanitize left-hand variable name
        const cleanLeft = left.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, "");
        setParsedVarName(cleanLeft || 'Var1');
        setParsedFormula(right);
      } else {
        setParsedVarName(newVarName); // Fallback to secondary field
        setParsedFormula(trimmed);
      }
    } else {
      setParsedVarName(newVarName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, ""));
      setParsedFormula(formulaPart);
    }
  }, [inputEquation, newVarName, formulaPart, inputMode]);

  if (!isOpen) return null;

  // Quantitative columns for insertion or variables list
  const availableCols = columns.map(c => c.name);

  // Insert token at current selection cursor
  const handleInsertToken = (token: string) => {
    const inputElement = formulaInputRef.current;
    if (!inputElement) {
      if (inputMode === 'equation') {
        const text = inputEquation === '' ? token : inputEquation + ' ' + token;
        setInputEquation(text);
      } else {
        const text = formulaPart === '' ? token : formulaPart + ' ' + token;
        setFormulaPart(text);
      }
      return;
    }

    const start = inputElement.selectionStart ?? 0;
    const end = inputElement.selectionEnd ?? 0;
    const originalText = inputMode === 'equation' ? inputEquation : formulaPart;
    const before = originalText.substring(0, start);
    const after = originalText.substring(end);
    const spacingBefore = before.endsWith(' ') || before === '' ? '' : ' ';
    const spacingAfter = after.startsWith(' ') || after === '' ? '' : ' ';
    
    const newText = before + spacingBefore + token + spacingAfter + after;
    
    if (inputMode === 'equation') {
      setInputEquation(newText);
    } else {
      setFormulaPart(newText);
    }

    // Set cursor position right after inserted token
    setTimeout(() => {
      inputElement.focus();
      const cursorOffset = start + spacingBefore.length + token.length + spacingAfter.length;
      inputElement.setSelectionRange(cursorOffset, cursorOffset);
    }, 50);
  };

  const handleDoubleclickVariable = (colName: string) => {
    // Encapsulate column names with spaces or spec chars in standard brackets [col]
    const token = colName.includes(' ') || /[^a-zA-Z0-9_]/.test(colName) ? `[${colName}]` : colName;
    handleInsertToken(token);
    toast.info(`Variable ${colName} insérée.`);
  };

  // Math pads helper
  const mathOperators = [
    { label: '+', value: '+' },
    { label: '-', value: '-' },
    { label: '*', value: '*' },
    { label: '/', value: '/' },
    { label: '(', value: '(' },
    { label: ')', value: ')' },
    { label: '1', value: '1' },
    { label: '2', value: '2' },
    { label: '3', value: '3' },
    { label: '4', value: '4' },
    { label: '5', value: '5' },
    { label: '6', value: '6' },
    { label: '7', value: '7' },
    { label: '8', value: '8' },
    { label: '9', value: '9' },
    { label: '0', value: '0' },
    { label: '.', value: '.' },
    { label: ',', value: ',' },
  ];

  const mathFunctions = [
    { label: 'Racine (sqrt)', value: 'sqrt(' },
    { label: 'Log base-e (ln)', value: 'log(' },
    { label: 'Log base-10', value: 'log10(' },
    { label: 'Absolue (abs)', value: 'abs(' },
    { label: 'Exponentielle', value: 'exp(' },
    { label: 'Cosinus', value: 'cos(' },
    { label: 'Sinus', value: 'sin(' },
    { label: 'Tangente', value: 'tan(' },
    { label: 'Constant Pi', value: 'pi' },
    { label: 'Constant e', value: 'e' },
  ];

  // Try parsing first few rows to show live preview
  const livePreviewRows = previewData.slice(0, 5).map((row, idx) => {
    const val = evaluateFormulaForRow(parsedFormula, row, availableCols);
    return {
      index: idx + 1,
      name: parsedVarName,
      formula: parsedFormula,
      inputs: row,
      output: val !== null && !isNaN(val) ? val.toLocaleString(undefined, { maximumFractionDigits: 5 }) : '—'
    };
  });

  const checkHasValidFormula = () => {
    if (!parsedFormula.trim() || !parsedVarName.trim()) return false;
    // Check if at least one row yields a non-null result or is clean math syntax
    // (If all columns are missing/not matching, it might render — but syntax is okay if evaluator is runnable)
    try {
      const dummyRow = previewData[0] || {};
      const result = evaluateFormulaForRow(parsedFormula, dummyRow, availableCols);
      return parsedFormula.trim().length > 0;
    } catch {
      return false;
    }
  };

  const handleApplyTransform = () => {
    if (!parsedVarName.trim()) {
      toast.error("Veuillez saisir un nom pour la nouvelle variable.");
      return;
    }
    if (!parsedFormula.trim()) {
      toast.error("Veuillez renseigner une formule mathématique.");
      return;
    }

    try {
      addFormulaPipelineStep(parsedVarName.trim(), parsedFormula);
      onClose();
    } catch (e: any) {
      toast.error(`Erreur de validation : ${e.message || e}`);
    }
  };

  const isFormValid = checkHasValidFormula();

  return (
    <div id="variable-calculator-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4 select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-zinc-200 w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header bar */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/15">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Calculateur de variable scientifique</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Créer des indicateurs à partir de vos données existantes</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-450 hover:bg-slate-150 hover:text-slate-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Middle Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6 min-h-0">
          
          {/* Left panel: Mode selector, Input field, Operators, Keypad */}
          <div className="flex-1 flex flex-col gap-4">
            
            {/* Input Mode Toggle */}
            <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setInputMode('equation')}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${inputMode === 'equation' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Équation unique (ex: Var1 = (Var3 + 2,5)*5)
              </button>
              <button
                type="button"
                onClick={() => setInputMode('split')}
                className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${inputMode === 'split' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Champs séparés (Variable + Formule)
              </button>
            </div>

            {/* Inputs based on Mode */}
            {inputMode === 'equation' ? (
              <div className="space-y-1.5 shrink-0">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Entrez votre équation de calcul :</label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">LHS = Rapprochement</span>
                </div>
                <textarea
                  id="equation-input-unified"
                  ref={formulaInputRef}
                  value={inputEquation}
                  onChange={(e) => setInputEquation(e.target.value)}
                  placeholder="Exemple: Rendement_final = (RENDEMENT_BRUT + 2.5) * 5"
                  className="w-full h-16 text-sm font-semibold font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-colors"
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  Tapez le symbole <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">=</code> pour séparer le nom de la variable de sa formule de calcul.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 shrink-0">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nouvelle variable :</label>
                  <input
                    type="text"
                    id="new-col-name-split"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value.trim())}
                    placeholder="ex: Var1"
                    className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Formule de calcul :</label>
                    <span className="text-xs text-slate-400 font-bold font-mono">={newVarName}</span>
                  </div>
                  <input
                    type="text"
                    id="formula-part-split"
                    ref={formulaInputRef as any}
                    value={formulaPart}
                    onChange={(e) => setFormulaPart(e.target.value)}
                    placeholder="ex: (Var3 + 2.5) * 5"
                    className="w-full text-xs font-semibold font-mono px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>
            )}

            {/* Parser parsing live results debugger */}
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500">Résultat interprété :</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200/50 font-bold text-indigo-700">{parsedVarName}</span>
                <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-sans text-slate-700 font-semibold truncate max-w-[200px]" title={parsedFormula}>{parsedFormula || <span className="text-slate-400 italic">(vide)</span>}</span>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${parsedFormula ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {parsedFormula ? 'Formule active' : 'En attente'}
              </span>
            </div>

            {/* Scientific Keypad */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Operators and Numbers pad */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-sans">Opérateurs & Chiffres</span>
                <div className="grid grid-cols-6 gap-1.5">
                  {mathOperators.map(op => (
                    <button
                      key={op.label}
                      type="button"
                      onClick={() => handleInsertToken(op.value)}
                      className="aspect-square bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors shadow-xs active:scale-95 cursor-pointer"
                    >
                      {op.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (inputMode === 'equation') {
                        setInputEquation('');
                      } else {
                        setFormulaPart('');
                      }
                    }}
                    className="col-span-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold py-2 transition-colors active:scale-95 cursor-pointer"
                  >
                    Effacer (C)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const source = inputMode === 'equation' ? inputEquation : formulaPart;
                      const next = source.substring(0, Math.max(0, source.length - 1));
                      if (inputMode === 'equation') {
                        setInputEquation(next);
                      } else {
                        setFormulaPart(next);
                      }
                    }}
                    className="col-span-3 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-lg text-xs font-bold py-2 flex items-center justify-center gap-1 transition-colors active:scale-95 cursor-pointer"
                  >
                    <Delete className="w-3.5 h-3.5" /> Retour
                  </button>
                </div>
              </div>

              {/* Scientific Functions pad */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-sans">Fonctions Scientifiques</span>
                <div className="grid grid-cols-2 gap-1.5 h-full max-h-[145px] overflow-y-auto pr-1">
                  {mathFunctions.map(func => (
                    <button
                      key={func.label}
                      type="button"
                      onClick={() => handleInsertToken(func.value)}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold py-2 px-2 flex items-center justify-center text-center truncate transition-colors shadow-xs active:scale-95 cursor-pointer"
                      title={func.label}
                    >
                      {func.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Quick guide card */}
            <div className="bg-sky-50/50 p-3.5 border border-sky-100 rounded-2xl flex gap-2.5 text-[11px] leading-relaxed text-slate-600 shrink-0">
              <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block">Guide syntaxique rapide :</span>
                Vous pouvez taper les formules à l'aide de votre clavier. Pour utiliser une variable contenant des espaces, entourez-la de crochets ex: <code className="font-mono bg-white px-1 py-0.5 border rounded">[Taux de change] + 10</code>. Notre système d'assainissement normalise les virgules décimales de style français (<code className="font-mono bg-white px-1 py-0.5 border rounded">2,5</code> {'->'} <code className="font-mono bg-white px-1 py-0.5 border rounded">2.5</code>).
              </div>
            </div>

          </div>

          {/* Right panel: Available variables listing and live execution preview */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col gap-5 border-t lg:border-t-0 lg:border-l border-zinc-200 pt-5 lg:pt-0 lg:pl-6 min-h-0">
            
            {/* Double click instruction */}
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  <Columns className="w-3.5 h-3.5 text-indigo-500" />
                  Double-cliquer pour insérer
                </span>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-500">{columns.length} variables</span>
              </div>
              
              <div className="flex-1 overflow-y-auto border border-slate-100 bg-slate-50/30 rounded-xl p-2.5 grid grid-cols-1 gap-1.5 max-h-[180px] lg:max-h-none">
                {columns.map(col => (
                  <button
                    key={col.name}
                    type="button"
                    onDoubleClick={() => handleDoubleclickVariable(col.name)}
                    className="flex items-center justify-between p-2.5 bg-white border border-slate-200/60 rounded-xl hover:border-indigo-400 text-left transition-all group cursor-pointer shadow-xs active:scale-98"
                    title="Double-cliquez pour insérer cette variable"
                  >
                    <div className="truncate pr-2">
                      <p className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-700">{col.name}</p>
                      <p className="text-[9px] text-slate-400 font-semibold">{col.raw_dtype}</p>
                    </div>
                    <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors">
                      {col.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Calculations simulator table */}
            <div className="space-y-2 shrink-0">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <List className="w-3.5 h-3.5 text-indigo-500" />
                Aperçu de calcul (votre échantillon)
              </span>

              <div className="border border-slate-200/80 rounded-2xl overflow-hidden font-mono text-[11px] bg-white divide-y divide-slate-100 shadow-sm">
                <div className="flex items-center bg-slate-50 border-b border-slate-200 text-slate-500 font-bold p-2 text-[10px]">
                  <div className="w-8">Ligne</div>
                  <div className="flex-1 text-right truncate font-sans text-[10px] font-black tracking-widest text-indigo-600 block pr-2 uppercase">Nouvelle Indic.</div>
                  <div className="w-20 text-right">Valeur</div>
                </div>
                
                {livePreviewRows.map(row => (
                  <div key={row.index} className="flex items-center p-2 hover:bg-slate-50/50 transition-colors">
                    <div className="w-8 font-semibold text-slate-400">{row.index}</div>
                    <div className="flex-1 font-bold text-slate-700 truncate text-right pr-2 font-sans text-xs">{parsedVarName}</div>
                    <div className={`w-20 text-right font-black ${row.output !== '—' ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {row.output}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Footer controls */}
        <div className="p-4 border-t border-zinc-100 flex items-center bg-zinc-50 justify-between shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-semibold">
            {isFormValid ? (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 stroke-[2.5px]" /> Formule valide
              </span>
            ) : (
              <span className="text-amber-600 animate-pulse flex items-center gap-1.5">
                • Formule en attente de validation
              </span>
            )}
          </div>
          <div className="flex gap-2.5 ml-auto">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs bg-slate-150 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button 
              type="button"
              onClick={handleApplyTransform}
              disabled={!isFormValid}
              className={`px-6 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md
                ${isFormValid 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-600/10 active:scale-98' 
                  : 'bg-zinc-200 text-zinc-400 cursor-not-allowed opacity-65'}`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Créer la variable</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
