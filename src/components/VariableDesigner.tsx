import React, { useState } from 'react';
import { useWorkspaceStore } from '../store';
import { ManualColumnDefinition, StatType } from '../types';
import { Plus, Trash2, Tag, ArrowRight, TableProperties, X, Check, ArrowLeft, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

const sanitizeName = (val: string) => {
  return val
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
    .toLowerCase()
    .replace(/[\s\u00A0\-]+/g, "_") // Remplacer les espaces et tirets par des underscores
    .replace(/[^a-z0-9_]/g, ""); // Supprimer les caractères spéciaux
};

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

const typeLabels: Record<StatType, string> = {
  nominal: 'Nominal (Catégoriel)',
  ordinal: 'Ordinal (Ordonné)',
  discrete: 'Discret (Entiers)',
  continuous: 'Continu (Réels)',
  datetime: 'Date / Heure'
};

const typeDescriptions: Record<StatType, string> = {
  nominal: 'Variable qualitative sans ordre logique (ex: Sexe, Pays, Groupe)',
  ordinal: 'Variable qualitative avec un ordre naturel (ex: Niveau d\'études, Avis)',
  discrete: 'Variable quantitative prenant des valeurs entières isolées (ex: Nombre de lits, Âge en années)',
  continuous: 'Variable quantitative prenant n\'importe quelle valeur réelle (ex: Taille, Température, Score)',
  datetime: 'Variable temporelle / horodatage'
};

export default function VariableDesigner() {
  const setWorkspaceMode = useWorkspaceStore((state) => state.setWorkspaceMode);
  const setManualColumns = useWorkspaceStore((state) => state.setManualColumns);
  const storeManualColumns = useWorkspaceStore((state) => state.manualColumns);
  const hasLoadedDataset = useWorkspaceStore((state) => state.columns.length > 0);
  
  // Store them locally before moving to the next step
  const [columns, setColumns] = useState<ManualColumnDefinition[]>(() => {
    return storeManualColumns && storeManualColumns.length > 0 ? storeManualColumns : [];
  });
  
  // State for the "quick add" row
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<StatType>('nominal');

  // Modal state
  const [activeLabelCol, setActiveLabelCol] = useState<string | null>(null);
  const [tempLabels, setTempLabels] = useState<Record<string, string>>({});
  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');

  const addColumn = () => {
    const clean = sanitizeName(newColName);
    if (!clean) return;
    
    // Éviter les doublons
    let finalName = clean;
    let counter = 1;
    while (columns.find(c => c.name === finalName)) {
      finalName = `${clean}_${counter}`;
      counter++;
    }

    const newCol: ManualColumnDefinition = {
      id: Math.random().toString(36).substring(2, 9),
      name: finalName,
      type: newColType,
      labels: {}
    };

    setColumns([...columns, newCol]);
    setNewColName('');
    setNewColType('nominal');
  };

  const updateColumnName = (id: string, name: string) => {
    setColumns(columns.map(c => c.id === id ? { ...c, name: sanitizeName(name) } : c));
  };

  const updateColumnType = (id: string, type: StatType) => {
    setColumns(columns.map(c => c.id === id ? { ...c, type, labels: (type === 'nominal' || type === 'ordinal') ? c.labels : undefined } : c));
  };

  const removeColumn = (id: string) => {
    setColumns(columns.filter(c => c.id !== id));
  };

  const openLabelModal = (col: ManualColumnDefinition) => {
    setActiveLabelCol(col.id);
    setTempLabels({ ...(col.labels || {}) });
  };

  const addLabel = () => {
    if (!newLabelKey.trim()) return;
    setTempLabels({ ...tempLabels, [newLabelKey.trim()]: newLabelValue.trim() });
    setNewLabelKey('');
    setNewLabelValue('');
  };

  const removeLabel = (key: string) => {
    const newLabels = { ...tempLabels };
    delete newLabels[key];
    setTempLabels(newLabels);
  };

  const saveLabels = () => {
    if (activeLabelCol) {
      setColumns(columns.map(c => c.id === activeLabelCol ? { ...c, labels: tempLabels } : c));
      setActiveLabelCol(null);
    }
  };

  const handleNextSteps = () => {
    setManualColumns(columns);
    setWorkspaceMode('manual_data_entry');
  };

  const handleCancelAndHome = () => {
    if (hasLoadedDataset) {
      setWorkspaceMode('dashboard');
    } else {
      useWorkspaceStore.setState({ isReady: false, workspaceMode: 'dashboard', activeDashboardTab: 'home' });
    }
  };

  const activeColDef = columns.find(c => c.id === activeLabelCol);

  return (
    <div id="variable-designer-root" className="h-full w-full bg-slate-50/50 flex flex-col items-center py-6 px-6 relative overflow-y-auto select-none">
      
      {/* Decorative ambient subtle circle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-indigo-50/40 via-sky-50/20 to-emerald-50/30 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="max-w-4xl w-full z-10 space-y-8">
        
        {/* Navigation & Cancel Action */}
        <div className="flex items-center justify-between">
          <button
            id="btn-back-home"
            onClick={handleCancelAndHome}
            className="group inline-flex items-center gap-2 bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 px-4 py-2 rounded-full text-xs font-semibold border border-slate-200/60 hover:border-slate-300 shadow-sm transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Retourner à l'accueil
          </button>

          <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full shadow-sm">
            Variables • Étape 1 sur 2
          </span>
        </div>

        {/* Header Title Grid */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 bg-white shadow-md border border-slate-200/60 rounded-xl flex items-center justify-center">
                <TableProperties className="w-5.5 h-5.5 text-indigo-600" />
              </div>
              Dictionnaire des variables
            </h1>
            <p className="text-slate-500 text-sm mt-2 max-w-xl">
              Définissez la structure, le type et les libellés de vos colonnes avant de procéder à la saisie de vos données scientifiques.
            </p>
          </div>
          
          <button
            id="btn-goto-data-entry"
            onClick={handleNextSteps}
            disabled={columns.length === 0}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-slate-950/10 cursor-pointer
              ${columns.length > 0 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-500/10' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'}`}
          >
            Saisie de données
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Info advice tip */}
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50/50 border border-sky-100 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-slate-600">
          <HelpCircle className="w-4.5 h-4.5 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800">Conseil d'assainissement :</span> Les noms de variables sont automatiquement nettoyés pour assurer la compatibilité avec nos moteurs de calcul statistique (suppression des espaces, accents et caractères spéciaux au profit de tirets bas).
          </div>
        </div>

        {/* Beautiful card layout containing the variables definitions table */}
        <div className="bg-white/90 backdrop-blur-md border border-slate-200/60 rounded-3xl shadow-[0_4px_20px_-4px_rgba(148,163,184,0.1)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50/65 border-b border-slate-200 text-slate-500 text-[11px] font-bold tracking-wider uppercase">
                <tr>
                  <th className="px-6 py-4 w-1/2">Nom de la variable</th>
                  <th className="px-6 py-4 w-1/4">Type de variable</th>
                  <th className="px-6 py-4 w-32 text-center">Modalités</th>
                  <th className="px-6 py-4 w-16 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {columns.map((col, index) => (
                  <tr key={col.id} className="group hover:bg-slate-50/40 transition-all duration-200">
                    {/* Column Name Input */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        <input 
                          type="text" 
                          id={`col-name-input-${col.id}`}
                          value={col.name}
                          onChange={(e) => updateColumnName(col.id, e.target.value)}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 py-1 px-1 font-semibold text-slate-900 focus:outline-none transition-colors"
                          placeholder="nom_variable"
                        />
                      </div>
                    </td>

                    {/* Column Type Select */}
                    <td className="px-6 py-4">
                      <select
                        id={`col-type-select-${col.id}`}
                        value={col.type}
                        onChange={(e) => updateColumnType(col.id, e.target.value as StatType)}
                        className={`appearance-none text-xs font-semibold px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-300 cursor-pointer transition-colors ${getBadgeStyles(col.type)}`}
                        title={typeDescriptions[col.type]}
                      >
                        {Object.keys(typeLabels).map((t) => (
                          <option key={t} value={t} className="bg-white text-slate-900 font-sans">{typeLabels[t as StatType]}</option>
                        ))}
                      </select>
                    </td>

                    {/* Labels Button */}
                    <td className="px-6 py-4 text-center">
                      {(col.type === 'nominal' || col.type === 'ordinal') ? (
                        <button 
                          id={`btn-define-labels-${col.id}`}
                          onClick={() => openLabelModal(col)}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 cursor-pointer
                            ${Object.keys(col.labels || {}).length > 0 
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/50 font-bold' 
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium'}`}
                          title="Configurer les modalités qualitatives"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>{Object.keys(col.labels || {}).length > 0 ? `${Object.keys(col.labels || {}).length} définies` : 'Définir'}</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs font-mono">-</span>
                      )}
                    </td>

                    {/* Delete Column button */}
                    <td className="px-6 py-4 text-right">
                      <button 
                        id={`btn-delete-column-${col.id}`}
                        onClick={() => removeColumn(col.id)}
                        className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all duration-150 cursor-pointer"
                        title="Supprimer la variable"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Modern Dynamic Row Creator */}
                <tr className="bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                      <input 
                        type="text" 
                        id="new-col-name-input"
                        value={newColName}
                        onChange={(e) => setNewColName(e.target.value)}
                        onBlur={(e) => setNewColName(sanitizeName(e.target.value))}
                        onKeyDown={(e) => e.key === 'Enter' && addColumn()}
                        className="w-full bg-transparent border-0 py-1 text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:ring-0"
                        placeholder="Saisir un nom de variable (ex: RENDEMENT, GENRE)"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      id="new-col-type-select"
                      value={newColType}
                      onChange={(e) => setNewColType(e.target.value as StatType)}
                      className="appearance-none text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {Object.keys(typeLabels).map((t) => (
                        <option key={t} value={t}>{typeLabels[t as StatType]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      id="btn-add-variable"
                      onClick={addColumn}
                      disabled={!newColName.trim()}
                      className="inline-flex items-center justify-center p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
                      title="Ajouter à la liste"
                    >
                      <Plus className="w-4.5 h-4.5" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {columns.length === 0 && (
            <div className="py-20 text-center border-t border-slate-100 flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-300">
                <Tag className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-slate-800 font-semibold text-sm">Aucune variable configurée</p>
                <p className="text-slate-400 text-xs mt-1 max-w-sm">
                  Commencez par ajouter vos variables dans l'éditeur de la dernière ligne ci-dessus.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Label Edit Modal */}
      {activeLabelCol && activeColDef && (
        <div id="modal-label-editor" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-200/80 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-xl text-slate-905">Définition des modalités</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Définissez les codes et étiquettes pour <span className="font-mono text-indigo-600 font-bold">{activeColDef.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setActiveLabelCol(null)}
                className="text-slate-400 hover:bg-slate-100 hover:text-slate-900 p-2 rounded-xl transition-colors"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Code/Valeur</label>
                  <input 
                    type="text" 
                    id="input-label-key"
                    value={newLabelKey}
                    onChange={(e) => setNewLabelKey(e.target.value)}
                    placeholder="ex: 1"
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center h-9 text-slate-400 self-end py-2">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div className="flex-[2] space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-sans">Étiquette / Libellé</label>
                  <input 
                    type="text" 
                    id="input-label-val"
                    value={newLabelValue}
                    onChange={(e) => setNewLabelValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                    placeholder="ex: Niveau élevé"
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button 
                  id="btn-add-label"
                  onClick={addLabel}
                  disabled={!newLabelKey.trim()}
                  className="h-10 bg-indigo-600 text-white rounded-xl px-3.5 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {Object.keys(tempLabels).length > 0 && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {Object.entries(tempLabels).map(([key, val]) => (
                    <div key={key} className="flex justify-between items-center px-4 py-2.5 bg-slate-50/50">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-xs">{key}</span>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                        <span className="font-semibold text-slate-800">{val}</span>
                      </div>
                      <button 
                        onClick={() => removeLabel(key)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {Object.keys(tempLabels).length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  Aucune modalité définie (les saisies libres resteront permises).
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button 
                onClick={() => setActiveLabelCol(null)}
                className="px-4 py-2.5 font-bold text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button 
                id="btn-save-modalities"
                onClick={saveLabels}
                className="px-4 py-2.5 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
