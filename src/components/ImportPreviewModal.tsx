import React from 'react';
import { useWorkspaceStore } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Database, 
  FileSpreadsheet, 
  Check, 
  AlertTriangle,
  Layers,
  LayoutGrid,
  CornerRightDown,
  Info
} from 'lucide-react';

export default function ImportPreviewModal() {
  const pendingImport = useWorkspaceStore((state) => state.pendingImport);
  const setPendingImport = useWorkspaceStore((state) => state.setPendingImport);
  const confirmPendingImport = useWorkspaceStore((state) => state.confirmPendingImport);

  const [selectedColumns, setSelectedColumns] = React.useState<string[]>([]);
  const [filterMode, setFilterMode] = React.useState<'all' | 'included' | 'excluded'>('all');

  React.useEffect(() => {
    if (pendingImport) {
      setSelectedColumns(pendingImport.columns.map((c: any) => c.name));
    }
  }, [pendingImport]);

  if (!pendingImport) return null;

  const { datasetName, rowCount, colCount, columns, previewData } = pendingImport;

  const handleConfirm = () => {
    confirmPendingImport(selectedColumns);
  };

  const toggleColumn = (colName: string) => {
    setSelectedColumns((prev) => 
      prev.includes(colName) 
        ? prev.filter(name => name !== colName)
        : [...prev, colName]
    );
  };

  const toggleAll = () => {
    if (selectedColumns.length === columns.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(columns.map(c => c.name));
    }
  };

  // Render first 5 rows for sample grid
  const sampleRows = previewData.slice(0, 5);

  const displayedColumns = columns.filter(col => {
    if (filterMode === 'all') return true;
    if (filterMode === 'included') return selectedColumns.includes(col.name);
    return !selectedColumns.includes(col.name);
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] md:max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                <FileSpreadsheet className="w-5.5 h-5.5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Aperçu du jeu de données</h3>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Configurez et validez l'importation statistique</p>
              </div>
            </div>
            <button
              onClick={() => setPendingImport(null)}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
            
            {/* Meta Cards Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3.5">
                <div className="w-10 h-10 bg-indigo-100/60 text-indigo-700 rounded-xl flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Fichier source</p>
                  <p className="text-sm font-bold text-slate-800 truncate font-mono">{datasetName}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3.5">
                <div className="w-10 h-10 bg-emerald-100/60 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Observations</p>
                  <p className="text-sm font-extrabold text-slate-800">{rowCount.toLocaleString('fr-FR')} lignes</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3.5">
                <div className="w-10 h-10 bg-sky-100/60 text-sky-700 rounded-xl flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Données</p>
                  <p className="text-sm font-extrabold text-slate-800">{colCount.toLocaleString('fr-FR')} colonnes</p>
                </div>
              </div>
            </div>

            {/* Schema structure column listing */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <CornerRightDown className="w-4 h-4 text-indigo-500 shrink-0" />
                  Structure des colonnes & Types détectés
                </span>
                
                {/* Tabs for filtering */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${filterMode === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Toutes ({columns.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('included')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${filterMode === 'included' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Incluses ({selectedColumns.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('excluded')}
                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${filterMode === 'excluded' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Exclues ({columns.length - selectedColumns.length})
                  </button>
                </div>
              </div>

              <div className="border border-slate-200/65 rounded-2xl overflow-hidden shadow-sm">
                <div className="max-h-[180px] overflow-y-auto divide-y divide-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-450 uppercase tracking-wider sticky top-0 border-b border-slate-150">
                        <th className="py-2.5 px-4 font-extrabold w-8 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedColumns.length === columns.length && columns.length > 0}
                            onChange={toggleAll}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                          />
                        </th>
                        <th className="py-2.5 px-2 font-extrabold">Nom de colonne</th>
                        <th className="py-2.5 px-4 font-extrabold">Type statistique</th>
                        <th className="py-2.5 px-4 font-extrabold">Valeurs manquantes</th>
                        <th className="py-2.5 px-4 font-extrabold">Type brut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {displayedColumns.map((col) => {
                        const isContinuous = col.type === 'continuous';
                        const missingPercent = rowCount > 0 ? Math.round((col.missing_values / rowCount) * 100) : 0;
                        const isSelected = selectedColumns.includes(col.name);
                        return (
                          <tr key={col.name} className={`transition ${isSelected ? 'hover:bg-slate-50/50' : 'bg-slate-50/30 opacity-60'}`}>
                            <td className="py-2 px-4 text-center">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => toggleColumn(col.name)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                              />
                            </td>
                            <td className={`py-2 px-2 font-bold font-mono text-[11px] truncate max-w-[170px] ${isSelected ? 'text-slate-800' : 'text-slate-500 line-through'}`}>
                              {col.name}
                            </td>
                            <td className="py-2 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                                isContinuous 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}>
                                {isContinuous ? 'Échelle (Continu)' : 'Nominal / Ordinal'}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-slate-500 font-medium">
                              {col.missing_values.toLocaleString('fr-FR')}{' '}
                              <span className="text-[10px] text-slate-400 font-semibold">
                                ({missingPercent}%)
                              </span>
                            </td>
                            <td className="py-2 px-4 text-slate-400 font-mono font-medium text-[10px]">
                              {col.raw_dtype || (isContinuous ? 'float64' : 'object')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Row Grid Preview */}
            <div className="space-y-3">
              <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                <Info className="w-4 h-4 text-emerald-500 shrink-0" />
                Aperçu des premières lignes
              </span>

              <div className="border border-slate-200/65 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-450 uppercase tracking-widest border-b border-slate-150">
                        <th className="py-2 px-4 border-r border-slate-100 w-12 text-center">N°</th>
                        {columns.filter(col => selectedColumns.includes(col.name)).map((col) => (
                          <th key={col.name} className="py-2 px-4 font-extrabold text-[10px] font-mono whitespace-nowrap min-w-[120px]">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {sampleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="py-2 px-4 text-center border-r border-slate-100 text-[10px] font-bold text-slate-400 bg-slate-50/50">
                            {idx + 1}
                          </td>
                          {columns.filter(col => selectedColumns.includes(col.name)).map((col) => {
                            const val = row[col.name];
                            const isNull = val === undefined || val === null || val === '';
                            return (
                              <td key={col.name} className={`py-2 px-4 font-medium whitespace-nowrap truncate max-w-[150px] ${isNull ? 'text-slate-355 italic bg-rose-50/20 text-[10px]' : 'text-slate-700'}`}>
                                {isNull ? 'manquant' : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
            <div className="text-[10px] text-slate-500 font-medium">
              {selectedColumns.length} colonnes sélectionnées sur {columns.length}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPendingImport(null)}
                className="px-5 py-2.5 hover:bg-slate-200 text-slate-650 hover:text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedColumns.length === 0}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition duration-150 flex items-center gap-1.5 active:scale-97"
              >
                <Check className="w-4 h-4" />
                Confirmer l'importation
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
