import React, { useState } from 'react';
import { useWorkspaceStore } from '../store';
import { Plus, Trash2, ArrowLeft, Home, TableProperties, Play, AlertCircle } from 'lucide-react';
import { StatType } from '../types';
import { motion } from 'motion/react';

const getBadgeStyles = (type: StatType) => {
  switch (type) {
    case 'nominal': return 'bg-violet-50 text-violet-700 border-violet-150';
    case 'ordinal': return 'bg-amber-50 text-amber-700 border-amber-150';
    case 'discrete': return 'bg-emerald-50 text-emerald-700 border-emerald-150';
    case 'continuous': return 'bg-sky-50 text-sky-700 border-sky-150';
    case 'datetime': return 'bg-rose-50 text-rose-700 border-rose-150';
    default: return 'bg-slate-50 text-slate-700 border-slate-150';
  }
};

const getBadgeLabel = (type: StatType) => {
  switch (type) {
    case 'nominal': return 'Nominale';
    case 'ordinal': return 'Ordinale';
    case 'discrete': return 'Discrète';
    case 'continuous': return 'Continue';
    case 'datetime': return 'Temporelle';
    default: return type;
  }
};

export default function ManualDataEntry() {
  const setWorkspaceMode = useWorkspaceStore((state) => state.setWorkspaceMode);
  const manualColumns = useWorkspaceStore((state) => state.manualColumns);
  const storeManualRows = useWorkspaceStore((state) => state.manualRows);
  const setManualRows = useWorkspaceStore((state) => state.setManualRows);
  const initializeManualDataset = useWorkspaceStore((state) => state.initializeManualDataset);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const datasetName = useWorkspaceStore((state) => state.datasetName);
  const hasLoadedDataset = useWorkspaceStore((state) => state.columns.length > 0);
  
  const [rows, setRows] = useState<Record<string, any>[]>(() => {
    return storeManualRows && storeManualRows.length > 0 ? storeManualRows : [{}];
  });

  const updateCell = (rowIndex: number, colName: string, value: any) => {
    const newRows = [...rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [colName]: value };
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, {}]);
  };

  const removeRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index);
    if (newRows.length === 0) {
      newRows.push({});
    }
    setRows(newRows);
  };

  const handleLoad = async () => {
    // Filter empty rows
    const validRows = rows.filter(row => 
      manualColumns.some(c => row[c.name] !== undefined && row[c.name] !== '')
    );
    
    setManualRows(validRows);
    await initializeManualDataset(datasetName || 'Saisie Manuelle');
  };

  const handleGoBack = () => {
    setWorkspaceMode('manual_setup');
  };

  const handleGoHome = () => {
    if (hasLoadedDataset) {
      setWorkspaceMode('dashboard');
    } else {
      useWorkspaceStore.setState({ isReady: false, workspaceMode: 'dashboard', activeDashboardTab: 'home' });
    }
  };

  return (
    <div id="manual-data-entry-root" className="h-full w-full bg-slate-50/50 flex flex-col items-center py-6 px-6 relative overflow-y-auto select-none">
      
      {/* Decorative ambient subtle circle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] bg-gradient-to-tr from-indigo-50/40 via-sky-50/20 to-emerald-50/30 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="max-w-6xl w-full z-10 space-y-8">
        
        {/* Navigation back actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              id="btn-back-to-welcome"
              onClick={handleGoHome}
              className="group inline-flex items-center gap-1.5 bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-slate-200/60 hover:border-slate-300 shadow-xs transition-all duration-200 cursor-pointer"
              title="Retourner à l'accueil de l'application"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Accueil</span>
            </button>
            <span className="text-slate-300">/</span>
            <button
              id="btn-back-to-dictionary"
              onClick={handleGoBack}
              className="group inline-flex items-center gap-1.5 bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-slate-200/60 hover:border-slate-300 shadow-xs transition-all duration-200 cursor-pointer"
              title="Retourner à l'étape précédente pour modifier les variables"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Dictionnaire des variables</span>
            </button>
          </div>

          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-3.5 py-1 rounded-full shadow-sm">
            Observations • Étape 2 sur 2
          </span>
        </div>

        {/* Header with detailed action button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 bg-white shadow-md border border-slate-200/60 rounded-xl flex items-center justify-center">
                <TableProperties className="w-5.5 h-5.5 text-indigo-600" />
              </div>
              Saisie des observations
            </h1>
            <p className="text-slate-500 text-sm mt-2 max-w-xl">
              Renseignez vos observations scientifiques ligne par ligne. Chaque colonne correspond à une variable définie précédemment.
            </p>
          </div>
          
          <button
            id="btn-load-dataset-final"
            onClick={handleLoad}
            disabled={isLoading || rows.length === 0}
            className="flex items-center gap-2 bg-slate-950 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-bold tracking-wide text-sm transition-all shadow-lg hover:shadow-slate-950/20 duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            Charger le jeu de données
          </button>
        </div>

        {/* Counter and info bar */}
        <div className="bg-white/80 border border-slate-200 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            <span>Total : <span className="font-bold text-slate-950 font-mono text-sm">{rows.length}</span> lignes saisies</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Les lignes entièrement vides seront automatiquement écartées à la validation.</span>
          </div>
        </div>

        {/* Main data table card with premium glass and shadow styling */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/60 rounded-3xl shadow-[0_4px_20px_-4px_rgba(148,163,184,0.1)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
              <thead className="bg-slate-50/65 border-b border-slate-200 text-slate-500 text-[11px] font-bold tracking-wider uppercase">
                <tr>
                  <th className="px-4 py-4 w-12 text-center border-r border-slate-100/50 bg-slate-50/30">#</th>
                  {manualColumns.map((col) => (
                    <th key={col.id} className="px-5 py-4 min-w-[200px]">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-slate-900 font-extrabold tracking-tight">{col.name}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border inline-block w-fit ${getBadgeStyles(col.type)}`}>
                          {getBadgeLabel(col.type)}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-4 w-16 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="group hover:bg-slate-50/20 transition-all duration-200">
                    {/* Index column */}
                    <td className="px-4 py-3 text-center font-mono font-bold text-slate-400 text-xs border-r border-slate-100/50 bg-slate-50/25">
                      {(rowIndex + 1).toString().padStart(3, '0')}
                    </td>

                    {/* Inputs columns */}
                    {manualColumns.map((col) => {
                      const rawVal = row[col.name];
                      const value = (rawVal === undefined || rawVal === null || (typeof rawVal === 'number' && isNaN(rawVal))) ? '' : rawVal;
                      
                      let inputElement;
                      
                      if ((col.type === 'nominal' || col.type === 'ordinal') && Object.keys(col.labels || {}).length > 0) {
                        inputElement = (
                          <select
                            id={`input-cell-${rowIndex}-${col.name}`}
                            value={value}
                            onChange={(e) => updateCell(rowIndex, col.name, e.target.value)}
                            className="w-full bg-slate-50/50 border border-slate-200/70 hover:bg-white text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-150 focus:border-indigo-500 cursor-pointer transition-all"
                          >
                            <option value="" className="text-slate-400">Choisir...</option>
                            {Object.entries(col.labels || {}).map(([val, label]) => (
                              <option key={val} value={val} className="text-slate-900 bg-white font-sans">
                                {val === label ? val : `${val} (${label})`}
                              </option>
                            ))}
                          </select>
                        );
                      } else if (col.type === 'continuous' || col.type === 'discrete') {
                        inputElement = (
                          <input
                            type="number"
                            step={col.type === 'discrete' ? '1' : 'any'}
                            id={`input-cell-${rowIndex}-${col.name}`}
                            value={value}
                            onChange={(e) => updateCell(rowIndex, col.name, e.target.value)}
                            className="w-full bg-slate-50/50 border border-slate-200/70 hover:bg-white text-slate-900 rounded-xl px-3 py-2 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-150 focus:border-indigo-500 transition-all placeholder-slate-300"
                            placeholder="Saisir valeur numérique..."
                          />
                        );
                      } else {
                        inputElement = (
                          <input
                            type="text"
                            id={`input-cell-${rowIndex}-${col.name}`}
                            value={value}
                            onChange={(e) => updateCell(rowIndex, col.name, e.target.value)}
                            className="w-full bg-slate-50/50 border border-slate-200/70 hover:bg-white text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-150 focus:border-indigo-500 transition-all placeholder-slate-300"
                            placeholder="Saisir texte..."
                          />
                        );
                      }

                      return (
                        <td key={col.id} className="px-5 py-3 border-r border-slate-100 last:border-r-0">
                          {inputElement}
                        </td>
                      );
                    })}

                    {/* Trash remove row Column */}
                    <td className="px-4 py-3 text-center">
                      <button 
                        id={`btn-remove-row-${rowIndex}`}
                        onClick={() => removeRow(rowIndex)}
                        className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all duration-150 cursor-pointer"
                        title="Supprimer la ligne"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Add Row Button Row */}
                <tr>
                  <td colSpan={manualColumns.length + 2} className="p-4 bg-slate-50/20 text-center">
                    <button 
                      id="btn-add-observation-row"
                      onClick={addRow}
                      className="inline-flex items-center justify-center gap-2 w-full py-3 text-xs font-extrabold text-indigo-600 bg-white hover:bg-indigo-50 border border-dashed border-indigo-200 hover:border-indigo-300 rounded-xl transition-all shadow-xs duration-200 cursor-pointer"
                    >
                      <Plus className="w-4.5 h-4.5" />
                      Ajouter une ligne d'observation
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick action helper bottom */}
        <div className="flex justify-end gap-3">
          <button
            id="btn-bottom-cancel"
            onClick={handleGoHome}
            className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-905 rounded-xl hover:bg-slate-100/60 transition-colors cursor-pointer"
          >
            Abandonner et fermer
          </button>
          
          <button
            id="btn-bottom-save-load"
            onClick={handleLoad}
            disabled={isLoading || rows.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            Valider et Analyser
          </button>
        </div>

      </div>
    </div>
  );
}
