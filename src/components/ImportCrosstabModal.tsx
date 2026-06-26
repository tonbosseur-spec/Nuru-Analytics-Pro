import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspaceStore, parseJsonToDataset } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Table2, 
  Check, 
  AlertTriangle, 
  Spline, 
  ChevronRight, 
  ChevronLeft, 
  Settings, 
  Columns, 
  Eye, 
  HelpCircle,
  Database,
  ArrowRightLeft,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export default function ImportCrosstabModal() {
  const isCrosstabModalOpen = useWorkspaceStore((state) => state.isCrosstabModalOpen);
  const rawCrosstabData = useWorkspaceStore((state) => state.rawCrosstabData);
  const setCrosstabModalOpen = useWorkspaceStore((state) => state.setCrosstabModalOpen);
  
  const [activeStep, setActiveStep] = useState<'config' | 'validation' | 'mapping' | 'preview'>('config');
  const [ignoreLastRow, setIgnoreLastRow] = useState(false);
  const [ignoreLastCol, setIgnoreLastCol] = useState(false);
  const [rowVarName, setRowVarName] = useState('Année');
  const [colVarName, setColVarName] = useState('Valeur');
  const [idVars, setIdVars] = useState<number[]>([]);
  const [valueVars, setValueVars] = useState<number[]>([]);
  const [ffillEnabled, setFfillEnabled] = useState(true);

  // Auto-detect of ID and Value variables on loading data
  useEffect(() => {
    if (rawCrosstabData && rawCrosstabData.length > 0) {
      // 1. Guess total row/col
      const lastRowStr = rawCrosstabData[rawCrosstabData.length - 1].join(' ').toLowerCase();
      if (lastRowStr.includes('total') || lastRowStr.includes('somme') || lastRowStr.includes('moyenne')) {
        setIgnoreLastRow(true);
      } else {
        setIgnoreLastRow(false);
      }
      
      const lastColStr = rawCrosstabData.map(row => row[row.length - 1]).join(' ').toLowerCase();
      if (lastColStr.includes('total') || lastColStr.includes('somme') || lastColStr.includes('moyenne')) {
        setIgnoreLastCol(true);
      } else {
        setIgnoreLastCol(false);
      }

      // 2. Guess columns mapping (ID vs Value)
      const numCols = rawCrosstabData[0].length;
      const guessedIds: number[] = [];
      const guessedValues: number[] = [];

      for (let colIndex = 0; colIndex < numCols; colIndex++) {
        let numericCount = 0;
        let totalNonEmpty = 0;
        for (let r = 1; r < Math.min(rawCrosstabData.length, 12); r++) {
          const valStr = String(rawCrosstabData[r][colIndex] || '').trim();
          if (valStr !== '') {
            totalNonEmpty++;
            const cleanNum = valStr.replace(/[^0-9.-]/g, '');
            if (cleanNum !== '' && !isNaN(Number(cleanNum))) {
              numericCount++;
            }
          }
        }
        
        const isMostlyNumeric = totalNonEmpty > 0 && (numericCount / totalNonEmpty) > 0.6;
        
        const headerStr = String(rawCrosstabData[0][colIndex] || '').trim();
        const headerIsNum = !isNaN(Number(headerStr)) && headerStr !== '';

        if (colIndex === 0) {
          guessedIds.push(colIndex);
        } else if (headerIsNum) {
          guessedValues.push(colIndex);
        } else if (!isMostlyNumeric) {
          guessedIds.push(colIndex);
        } else {
          guessedValues.push(colIndex);
        }
      }

      // Fallbacks
      if (guessedIds.length === 0 && numCols > 0) {
        guessedIds.push(0);
      }
      if (guessedValues.length === 0 && numCols > 1) {
        for (let i = 0; i < numCols; i++) {
          if (!guessedIds.includes(i)) guessedValues.push(i);
        }
      }

      setIdVars(guessedIds);
      setValueVars(guessedValues);

      // Guess target variable name
      const firstValHeader = String(rawCrosstabData[0][guessedValues[0]] || '').trim();
      if (!isNaN(Number(firstValHeader)) && firstValHeader.length === 4 && (firstValHeader.startsWith('19') || firstValHeader.startsWith('20'))) {
        setRowVarName('Année');
        setColVarName('Valeur');
      } else {
        setRowVarName('Indicateur');
        setColVarName('Valeur');
      }
      
      setActiveStep('config');
    }
  }, [rawCrosstabData]);

  // Compute initial cleaning & null statistics for validation
  const cleanStats = useMemo(() => {
    if (!rawCrosstabData || rawCrosstabData.length === 0) {
      return { 
        rows: 0, 
        cols: 0, 
        nullValues: 0, 
        totalCells: 0, 
        nullPercentage: 0, 
        nullCols: [] as { name: string; percentage: number }[], 
        hasNullInFirstCols: false,
        rawRows: 0,
        rawCols: 0
      };
    }

    let activeRows = rawCrosstabData.filter(row => row.some(cell => String(cell).trim() !== ''));
    let endRow = ignoreLastRow ? activeRows.length - 1 : activeRows.length;
    let endCol = ignoreLastCol ? activeRows[0].length - 1 : activeRows[0].length;
    
    let rowsAfterClean = Math.max(0, endRow - 1); // minus header row
    let colsAfterClean = endCol;
    
    let totalCells = rowsAfterClean * colsAfterClean;
    let nullValuesCount = 0;
    let firstColsNullCount = 0;
    let colNullCounts = Array(endCol).fill(0);
    
    for (let r = 1; r < endRow; r++) {
      const row = activeRows[r];
      for (let c = 0; c < endCol; c++) {
        const valStr = String(row[c] || '').trim();
        if (valStr === '' || valStr.toLowerCase() === 'null' || valStr.toLowerCase() === 'nd' || valStr.toLowerCase() === 'na') {
          nullValuesCount++;
          colNullCounts[c]++;
          if (c === 0 || c === 1) {
            firstColsNullCount++;
          }
        }
      }
    }
    
    const nullPercentage = totalCells > 0 ? (nullValuesCount / totalCells) * 100 : 0;
    
    const originalHeaders = activeRows[0].map(h => String(h || '').trim());
    const nullCols: { name: string; percentage: number }[] = [];
    for (let c = 0; c < endCol; c++) {
      const pct = rowsAfterClean > 0 ? (colNullCounts[c] / rowsAfterClean) * 100 : 0;
      if (pct > 20) {
        nullCols.push({
          name: originalHeaders[c] || `Colonne ${c + 1}`,
          percentage: Math.round(pct)
        });
      }
    }
    
    return {
      rows: rowsAfterClean,
      cols: colsAfterClean,
      nullValues: nullValuesCount,
      totalCells,
      nullPercentage: Math.round(nullPercentage * 10) / 10,
      nullCols,
      hasNullInFirstCols: firstColsNullCount > 0,
      rawRows: rawCrosstabData.length,
      rawCols: rawCrosstabData[0].length
    };
  }, [rawCrosstabData, ignoreLastRow, ignoreLastCol]);

  // Compute unpivoted long data
  const transformedData = useMemo(() => {
    if (!rawCrosstabData || rawCrosstabData.length === 0) return [];

    let activeRows = rawCrosstabData.filter(row => row.some(cell => String(cell).trim() !== ''));
    if (activeRows.length === 0) return [];
    
    // Normalize and clean heads
    const originalHeaders = activeRows[0].map(h => String(h || '').trim());
    
    let endRow = ignoreLastRow ? activeRows.length - 1 : activeRows.length;
    let endCol = ignoreLastCol ? originalHeaders.length - 1 : originalHeaders.length;
    
    const cleanRows: any[][] = [];
    const lastKnownIdValues: Record<number, any> = {};
    
    for (let r = 1; r < endRow; r++) {
      const rawRow = activeRows[r];
      
      // Check total line indication
      const isTotalRow = rawRow.some((field, cIdx) => {
        if (!idVars.includes(cIdx)) return false;
        const s = String(field).toLowerCase();
        return s.includes('total') || s.includes('somme') || s.includes('moyenne') || s === 'marge';
      });
      
      if (isTotalRow) continue;
      
      const processedRow = [...rawRow];
      
      // Apply forward fill
      if (ffillEnabled) {
        idVars.forEach(colIdx => {
          const valStr = String(processedRow[colIdx] || '').trim();
          if (valStr !== '') {
            lastKnownIdValues[colIdx] = processedRow[colIdx];
          } else if (lastKnownIdValues[colIdx] !== undefined) {
            processedRow[colIdx] = lastKnownIdValues[colIdx];
          }
        });
      }
      
      cleanRows.push(processedRow);
    }
    
    const longData: any[] = [];
    
    cleanRows.forEach(row => {
      valueVars.forEach(valColIdx => {
        if (valColIdx >= endCol) return;
        
        const colHeaderName = originalHeaders[valColIdx] || `Col_${valColIdx}`;
        const cellRawValue = row[valColIdx];
        
        let finalVal: any = cellRawValue;
        if (typeof cellRawValue === 'string') {
          const cleanS = cellRawValue.trim().replace(/\s/g, '').replace(/,/g, '.');
          if (cleanS === '') {
            finalVal = null;
          } else if (!isNaN(Number(cleanS))) {
            finalVal = Number(cleanS);
          }
        } else if (cellRawValue === undefined || cellRawValue === null) {
          finalVal = null;
        }
        
        if (finalVal === null || finalVal === '') return; // standard dropna behavior
        
        const item: Record<string, any> = {};
        
        // Populate ID variables
        idVars.forEach(idColIdx => {
          const idColName = originalHeaders[idColIdx] || `Variable_${idColIdx}`;
          item[idColName] = row[idColIdx];
        });
        
        item[rowVarName] = colHeaderName;
        item[colVarName] = finalVal;
        
        longData.push(item);
      });
    });
    
    // Remove duplicates
    const seen = new Set<string>();
    const uniqueList: any[] = [];
    longData.forEach(row => {
      const key = JSON.stringify(row);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueList.push(row);
      }
    });
    
    return uniqueList;
  }, [rawCrosstabData, idVars, valueVars, ignoreLastRow, ignoreLastCol, rowVarName, colVarName, ffillEnabled]);

  if (!isCrosstabModalOpen || !rawCrosstabData || rawCrosstabData.length === 0) return null;

  const handleTransform = async () => {
    try {
      if (transformedData.length === 0) {
        toast.error("Aucune donnée n'a pu être générée avec les règles définies.");
        return;
      }
      
      const store = useWorkspaceStore.getState();
      const isDesktop = typeof window !== 'undefined' && window.pywebview && window.pywebview.api;
      
      setCrosstabModalOpen(false);

      if (isDesktop) {
        // En mode Desktop, on initialise avec un DataFrame customisé
        // On génère le schéma basé sur tous les ID colonnes + la variable pivotée + la variable de mesure
        const cleanHeaders = rawCrosstabData[0].map(h => String(h || '').trim());
        const schema: any[] = [];
        
        idVars.forEach(idx => {
          schema.push({ id: `id_${idx}`, name: cleanHeaders[idx] || `Variable_${idx}`, type: 'nominal' });
        });
        
        schema.push({ id: 'pivot_var', name: rowVarName, type: 'nominal' });
        
        // Détecter le type de la colonne de valeurs (généralement quantitative / continuous)
        const isValColContinuous = transformedData.some(row => typeof row[colVarName] === 'number');
        schema.push({ id: 'pivot_val', name: colVarName, type: isValColContinuous ? 'continuous' : 'nominal' });
        
        toast.promise(
          window.pywebview.api.initialize_manual_dataframe(schema, transformedData, true),
          {
            loading: "Création du jeu de données dépivoté...",
            success: (res: any) => {
              if (res.success) {
                store.setPendingImport({
                   filePath: 'Tableau_Croisé_Transformé.csv',
                   datasetName: 'Tableau Croisé (Dépivoté)',
                   rowCount: res.row_count,
                   colCount: res.col_count,
                   columns: res.columns,
                   previewData: res.preview,
                   dataset_id: res.dataset_id || String(Date.now())
                });
                return "Données dépivotées avec succès ! Prêt à être importé.";
              } else {
                throw new Error(res.error);
              }
            },
            error: (err: any) => err.message
          }
        );
      } else {
        // Web Mode
        const parsed = parseJsonToDataset(transformedData);
        store.setPendingImport({
           filePath: 'Tableau_Croisé_Transformé.csv',
           datasetName: 'Tableau Croisé (Dépivoté)',
           rowCount: parsed.rows.length,
           colCount: parsed.columns.length,
           columns: parsed.columns,
           previewData: parsed.rows
        });
        toast.success("Données dépivotées avec succès (Web) !");
      }
    } catch(err: any) {
      toast.error(err.message || "Erreur de transformation");
    }
  };

  const originalNumCols = rawCrosstabData[0].length;
  const originalHeaders = rawCrosstabData[0].map(h => String(h || '').trim());

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 15 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: 15 }}
           className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col font-sans"
        >
          {/* Main Top Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                <Table2 className="w-5.5 h-5.5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Pipeline de Dépivotage (Crosstab to Tidy Data)</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unpivot intelligent sans perdes d'identifiants</p>
              </div>
            </div>
            
            <button
              onClick={() => setCrosstabModalOpen(false)}
              className="p-1.5 hover:bg-slate-150 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Wizard Indicator */}
          <div className="bg-slate-50/30 border-b border-slate-100 px-6 py-3 flex items-center gap-2">
            {[
              { id: 'config', name: 'Nettoyage & Configuration', step: 1, icon: Settings },
              { id: 'validation', name: 'Validation Visuelle', step: 2, icon: AlertTriangle },
              { id: 'mapping', name: 'Identification des Variables', step: 3, icon: Columns },
              { id: 'preview', name: 'Aperçu & Match', step: 4, icon: Eye }
            ].map((stepItem, sIdx) => {
              const StepIcon = stepItem.icon;
              const isActive = activeStep === stepItem.id;
              const isDone = sIdx < ['config', 'validation', 'mapping', 'preview'].indexOf(activeStep);
              return (
                <React.Fragment key={stepItem.id}>
                  {sIdx > 0 && <span className="w-6 h-px bg-slate-200" />}
                  <button
                    onClick={() => setActiveStep(stepItem.id as any)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                      isActive 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                        : isDone 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100/50' 
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                      isActive ? 'bg-white text-indigo-600' : isDone ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {stepItem.step}
                    </span>
                    <StepIcon className="w-3.5 h-3.5" />
                    {stepItem.name}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Core scrollable Wizard Area */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
            
            {activeStep === 'config' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Visual Banner */}
                <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-100/40 p-4 rounded-2xl flex gap-3.5 items-start">
                  <div className="p-2 rounded-xl bg-white shadow-sm text-indigo-600">
                    <ArrowRightLeft className="w-5 h-5 text-indigo-600 font-bold" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 leading-tight">Nettoyage TCD & Paramètres Pivot</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      Configurez l'élimination des marges de totaux, la propagation descendante des cellules fusionnées (ffill) et renommez les variables issues du dépivotage de colonnes de valeurs.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left panel: Structural operations */}
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-indigo-600 rounded-full" />
                      Nettoyage Structurel du Tableau
                    </h4>
                    
                    <div className="space-y-2.5">
                      <label className="flex items-start gap-3 p-3.5 border border-slate-200 hover:border-indigo-150 rounded-2xl hover:bg-slate-50/50 cursor-pointer transition">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5"
                          checked={ignoreLastRow}
                          onChange={(e) => setIgnoreLastRow(e.target.checked)} 
                        />
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 block">Ignorer la dernière Ligne (Totaux)</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Exclut la dernière ligne si elle contient des sommes de marge.</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3.5 border border-slate-200 hover:border-indigo-150 rounded-2xl hover:bg-slate-50/50 cursor-pointer transition">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5"
                          checked={ignoreLastCol}
                          onChange={(e) => setIgnoreLastCol(e.target.checked)} 
                        />
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 block">Ignorer la dernière Colonne (Totaux)</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Supprime la dernière colonne représentant les totaux horizontaux.</span>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3.5 border border-slate-200 hover:border-indigo-150 rounded-2xl hover:bg-slate-50/50 cursor-pointer transition">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 mt-0.5"
                          checked={ffillEnabled}
                          onChange={(e) => setFfillEnabled(e.target.checked)} 
                        />
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 block">Remplir les cellules fusionnées simulées (Forward-Fill)</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Propage la dernière valeur d'identifiant connue vers le bas pour reconstituer les blocs d'Excel.</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Right panel: Pivot variable target names */}
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <span className="w-1.5 h-3 bg-indigo-600 rounded-full" />
                      Noms des variables de destination
                    </h4>
                    
                    <div className="p-5 border border-slate-200 bg-slate-50/50 rounded-2xl space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 mb-1.5 block uppercase tracking-wider">VARIABLE DES COLONNES DE VALEURS (Ex: Année, Mois)</label>
                        <input 
                          type="text" 
                          className="w-full border border-slate-200 rounded-xl text-xs bg-white focus:ring-indigo-500 font-bold h-10 px-3 outline-none" 
                          value={rowVarName}
                          onChange={(e) => setRowVarName(e.target.value)}
                        />
                        <p className="text-[9px] text-slate-400 mt-1 font-medium">Sera l'intitulé de la colonne regroupant les différentes en-têtes dépivotées.</p>
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-500 mb-1.5 block uppercase tracking-wider">VARIABLE DE MESURE / MESURE NETTE (Ex: Valeur)</label>
                        <input 
                          type="text" 
                          className="w-full border border-slate-200 rounded-xl text-xs bg-white focus:ring-indigo-500 font-bold h-10 px-3 outline-none" 
                          value={colVarName}
                          onChange={(e) => setColVarName(e.target.value)}
                        />
                        <p className="text-[9px] text-slate-400 mt-1 font-medium">Contiendra les valeurs quantitatives extraites du croisement.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Raw preview to keep track of current states */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    Visualisation du tableau d'entrée ({rawCrosstabData.length} lignes x {originalNumCols} col.)
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <tbody className="divide-y divide-slate-100">
                        {rawCrosstabData.slice(0, 7).map((row, rID) => (
                          <tr key={rID} className={`${ignoreLastRow && rID === rawCrosstabData.length - 1 ? 'bg-red-50/50 opacity-60 line-through' : rID === 0 ? 'bg-slate-100/60 font-bold text-slate-800' : 'hover:bg-slate-50 text-slate-600'}`}>
                            {row.map((cell: any, cID: number) => (
                              <td key={cID} className={`px-4 py-2.5 border-r border-slate-100 last:border-0 ${cID === 0 ? 'bg-slate-50/30' : ''} ${ignoreLastCol && cID === row.length - 1 ? 'bg-red-50 opacity-60 line-through' : ''}`}>
                                {String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium italic">Affichage limité aux 7 premières lignes brutes.</p>
                </div>
              </motion.div>
            )}

            {activeStep === 'validation' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-emerald-550/10 via-teal-500/5 to-transparent border border-emerald-100/40 p-4 rounded-2xl flex gap-3.5 items-start">
                  <div className="p-2 rounded-xl bg-white shadow-sm text-emerald-600">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 font-bold" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 leading-tight">Étape 2 : Validation Visuelle du Nettoyage</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      Vérifiez les dimensions de votre tableau après nettoyage initial et inspectez la qualité des données (valeurs vides / manquantes) avant l'identification des dimensions de pivot.
                    </p>
                  </div>
                </div>

                {/* Primary Bento Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  
                  {/* Card 1: Dimensions */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] relative overflow-hidden">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Dimensions Réelles</span>
                    <h5 className="text-2xl font-black text-slate-900 leading-tight">
                      {cleanStats.rows} <span className="text-xs font-bold text-slate-400 font-sans">lignes</span>
                      <span className="mx-2 text-slate-350">×</span>
                      {cleanStats.cols} <span className="text-xs font-bold text-slate-400 font-sans">col.</span>
                    </h5>
                    
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <span>Données initiales :</span>
                      <span className="font-mono font-bold text-slate-800">{cleanStats.rawRows} × {cleanStats.rawCols}</span>
                    </div>
                  </div>

                  {/* Card 2: Qualité générale */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] relative overflow-hidden">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Cellules Vides / Manquantes</span>
                    <h5 className="text-2xl font-black text-slate-900 leading-tight">
                      {cleanStats.nullPercentage}% 
                      <span className="text-[10px] font-bold text-slate-400 ml-2 font-sans">
                        ({cleanStats.nullValues} / {cleanStats.totalCells} cellules)
                      </span>
                    </h5>
                    
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        cleanStats.nullPercentage < 10 ? 'bg-emerald-500' : cleanStats.nullPercentage < 25 ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                      <span className="text-[10px] text-slate-500 font-bold">
                        {cleanStats.nullPercentage < 10 ? 'Excellente complétude' : cleanStats.nullPercentage < 25 ? 'Complétude modérée' : 'Fort taux de vacuité'}
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Indicateurs & Alertes */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Qualité de Structure</span>
                      <div className="flex items-center gap-2 mt-1">
                        {cleanStats.nullPercentage > 25 ? (
                          <span className="px-2.5 py-1 bg-red-50 border border-red-100 text-red-750 text-[10px] font-extrabold rounded-lg">Insuffisant ⚠️</span>
                        ) : cleanStats.nullPercentage > 10 ? (
                          <span className="px-2.5 py-1 bg-amber-50 border border-amber-150 text-amber-700 text-[10px] font-extrabold rounded-lg">Avertisseur 💡</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-extrabold rounded-lg">Parfait ✓</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-[10px] text-slate-500 mt-3 border-t border-slate-100 pt-3 font-semibold leading-relaxed">
                      {cleanStats.nullPercentage > 20 
                        ? "La table comporte beaucoup de vides. Vérifiez si vous devez ignorer d'autres lignes de totaux." 
                        : "Aucune anomalie critique détectée dans la disposition brute."
                      }
                    </div>
                  </div>

                </div>

                {/* Highly Intelligent Alerts / Recommendations panel */}
                {cleanStats.nullPercentage > 5 && (
                  <div className={`p-4 rounded-2xl border flex gap-3.5 items-start ${
                    cleanStats.nullPercentage > 25 
                      ? 'bg-rose-50 border-rose-200/70 text-rose-800' 
                      : 'bg-amber-50 border-amber-200/70 text-amber-800'
                  }`}>
                    <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${cleanStats.nullPercentage > 25 ? 'text-rose-600' : 'text-amber-600'}`} />
                    <div>
                      <h5 className="text-xs font-black text-slate-955 leading-tight">Attention aux valeurs vides détectées</h5>
                      <p className="mt-1 text-[11px] text-slate-655 leading-relaxed font-semibold">
                        Le taux moyen de cellules vides est de <strong className="font-bold">{cleanStats.nullPercentage}%</strong>. Dans un tableau croisé, des cellules vides sont courantes lors de fusions d'en-tête Excel.
                      </p>
                      
                      {cleanStats.hasNullInFirstCols && !ffillEnabled && (
                        <div className="mt-3 p-3 bg-white border border-amber-200 rounded-xl text-slate-700 text-[10.5px] leading-relaxed">
                          <span className="font-extrabold text-amber-850">💡 Conseil clé structure :</span> Des cellules fusionnées semblent présentes dans vos premières colonnes de dimensions. Nous vous recommandons d'activer l'option <strong className="font-bold text-indigo-700">"Forward-Fill"</strong> dans l'étape précédente pour propager les catégories.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Display columns with potential high vacancy levels */}
                {cleanStats.nullCols.length > 0 && (
                  <div className="p-5 border border-slate-200 rounded-2xl bg-slate-50/45 space-y-3">
                    <h5 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <Columns className="w-4 h-4 text-slate-500" />
                      Alerte de vacuité par colonne ({cleanStats.nullCols.length} colonnes creuses détectées)
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {cleanStats.nullCols.map((col, index) => (
                        <div key={index} className="bg-white border border-slate-205 p-3 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-700 truncate max-w-[70%]">{col.name}</span>
                          <span className="text-[10px] font-black tracking-wide text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1">
                            {col.percentage}% vide
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick structured table preview of cleaned table */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">
                    Structure de validation visuelle (SANS les colonnes de totaux exclues)
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto max-h-[250px]">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <tbody className="divide-y divide-slate-100">
                        {rawCrosstabData.slice(0, 8).map((row, rID) => {
                          const isHeader = rID === 0;
                          const isExcludedRow = ignoreLastRow && rID === rawCrosstabData.length - 1;
                          if (isExcludedRow) return null;
                          
                          const sliceEnd = ignoreLastCol ? row.length - 1 : row.length;
                          const slicedRow = row.slice(0, sliceEnd);
                          
                          return (
                            <tr key={rID} className={`${isHeader ? 'bg-slate-100/60 font-bold text-slate-800' : 'hover:bg-slate-50 text-slate-655'}`}>
                              {slicedRow.map((cell: any, cID: number) => {
                                const valStr = String(cell || '').trim();
                                const isCellEmpty = valStr === '' || valStr.toLowerCase() === 'null';
                                return (
                                  <td key={cID} className={`px-4 py-2.5 border-r border-slate-100 last:border-0 ${
                                    isCellEmpty ? 'bg-amber-50/15 text-amber-600 font-bold font-mono' : ''
                                  }`}>
                                    {isCellEmpty ? '[vide]' : String(cell)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-slate-400 italic">Voici à quoi ressemble votre table une fois préparée et prête pour le mapping des pivots.</p>
                </div>

              </motion.div>
            )}

            {activeStep === 'mapping' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="bg-amber-50 border border-amber-200/80 text-amber-800 p-4 rounded-2xl flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-900 leading-tight">Règle de partitionnement (ID_VARS vs VALUE_VARS)</h5>
                    <p className="mt-1 text-amber-800/95 text-[11px] leading-relaxed">
                      Associez chaque colonne à un rôle. Les colonnes définies comme <strong className="font-bold text-slate-900">Variables d'identification (ID)</strong> seront dupliquées pour chaque valeur. Les colonnes cochées comme <strong className="font-bold text-slate-900">Valeurs (Value)</strong> seront repliées en lignes.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-900 text-sm">Cartographie des colonnes détectées</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {originalHeaders.map((headerText, index) => {
                      const isIgnored = ignoreLastCol && index === originalNumCols - 1;
                      const isId = idVars.includes(index);
                      const isValue = valueVars.includes(index);
                      const displayHeader = headerText || `Sans nom (Col ${index})`;
                      
                      return (
                        <div 
                          key={index}
                          className={`p-4 border rounded-2xl flex flex-col justify-between gap-3 transition-all ${
                            isIgnored 
                              ? 'border-slate-200 bg-slate-50 opacity-45 line-through'
                              : isId 
                                ? 'border-indigo-200/80 bg-indigo-50/15 ring-2 ring-indigo-500/5' 
                                : 'border-purple-200/85 bg-purple-50/10'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-black font-mono px-2 py-0.5 bg-slate-100 rounded-lg text-slate-500">
                                Colonne {index + 1}
                              </span>
                              {!isIgnored && (
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isId ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                                }`}>
                                  {isId ? "⚙️ ID Variable" : "📊 Valeurs"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-black text-slate-900 truncate" title={displayHeader}>
                              {displayHeader}
                            </p>
                          </div>

                          {!isIgnored ? (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIdVars(prev => [...new Set([...prev, index])]);
                                  setValueVars(prev => prev.filter(i => i !== index));
                                }}
                                className={`py-1.5 px-2 rounded-xl text-[10px] font-bold text-center border cursor-pointer transition ${
                                  isId 
                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                Identifiant (ID)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setValueVars(prev => [...new Set([...prev, index])]);
                                  setIdVars(prev => prev.filter(i => i !== index));
                                }}
                                className={`py-1.5 px-2 rounded-xl text-[10px] font-bold text-center border cursor-pointer transition ${
                                  isValue 
                                    ? 'bg-purple-600 text-white border-purple-600' 
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                Valeurs (Value)
                              </button>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-bold italic py-1 text-center">
                              Bout d'en-tête (Exclu)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeStep === 'preview' && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Transformation Summary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Structure attendue</span>
                    <h5 className="text-sm font-black text-slate-800 mt-1">Plate (Tidy Data)</h5>
                    <p className="text-[10px] text-slate-400 mt-1">Multiples variables combinées.</p>
                  </div>
                  <div className="p-4 bg-indigo-50/15 border border-indigo-100 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500">Ration Dépivotage</span>
                    <h5 className="text-sm font-black text-indigo-900 mt-1">
                      {rawCrosstabData.length - (ignoreLastRow ? 1 : 0) - 1} ➔ {transformedData.length} lignes
                    </h5>
                    <p className="text-[10px] text-indigo-400 mt-1">Lignes démultipliées par colonnes de valeurs.</p>
                  </div>
                  <div className="p-4 bg-emerald-50/15 border border-emerald-100 rounded-2xl">
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600">Statut de validation</span>
                    <h5 className="text-sm font-black text-emerald-800 mt-1 flex items-center gap-1.5">
                      ✓ CoHérent
                    </h5>
                    <p className="text-[10px] text-emerald-400 mt-1">Aucune cellule vide restante.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    Aperçu Final de la Table de Données Transformées ({transformedData.length} lignes)
                  </h4>
                  
                  {transformedData.length > 0 ? (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto max-h-[300px]">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-100/60 sticky top-0 border-b border-slate-200/80 z-10">
                          <tr>
                            {Object.keys(transformedData[0]).map((hName, idx) => (
                              <th key={idx} className="px-5 py-3 font-extrabold text-slate-700 font-sans">
                                {hName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {transformedData.slice(0, 50).map((row, rID) => (
                            <tr key={rID} className="hover:bg-slate-50 text-slate-600">
                              {Object.values(row).map((cellValue: any, cIdx) => (
                                <td key={cIdx} className="px-5 py-2.5 max-w-sm truncate border-r border-slate-100 last:border-0 font-medium text-slate-600">
                                  {typeof cellValue === 'number' ? (
                                    <span className="font-mono text-indigo-600 font-bold">{cellValue}</span>
                                  ) : (
                                    String(cellValue)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 border border-dashed border-slate-250 rounded-2xl font-bold">
                      Données pivots manquantes ou règles incorrectes.
                    </div>
                  )}
                  {transformedData.length > 50 && (
                    <p className="text-[9.5px] text-slate-400 font-medium italic text-right">Affichage restreint aux 50 premières lignes générées.</p>
                  )}
                </div>
              </motion.div>
            )}

          </div>

          {/* Footer Navigation */}
          <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
            <div>
              {activeStep !== 'config' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeStep === 'validation') setActiveStep('config');
                    if (activeStep === 'mapping') setActiveStep('validation');
                    if (activeStep === 'preview') setActiveStep('mapping');
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-700 hover:bg-slate-200/50 transition-all flex items-center gap-1.5 text-xs cursor-pointer border border-slate-250 bg-white"
                >
                  <ChevronLeft className="w-4 h-4" /> Précédent
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCrosstabModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer text-xs"
              >
                Annuler
              </button>

              {activeStep !== 'preview' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (activeStep === 'config') setActiveStep('validation');
                    else if (activeStep === 'validation') setActiveStep('mapping');
                    else if (activeStep === 'mapping') setActiveStep('preview');
                  }}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition flex items-center gap-1.5 text-xs cursor-pointer shadow-sm shadow-slate-900/10"
                >
                  Étape Suivante <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTransform}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black transition flex items-center gap-1.5 shadow-sm text-xs cursor-pointer shadow-indigo-600/20 hover:shadow-indigo-600/40"
                >
                  Confirmer et Importer <Spline className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
