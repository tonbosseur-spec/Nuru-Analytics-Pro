import React, { useEffect, useState, useMemo } from 'react';
import { useWorkspaceStore } from '../store';
import { X, Search, Filter, AlertTriangle, Edit2, Trash2, Check, Loader2 } from 'lucide-react';
import { getApi } from '../pywebview';
import { toast } from 'sonner';

export default function FullDataModal() {
  const isOpen = useWorkspaceStore((state) => state.isFullDataModalOpen);
  const setFullDataModalOpen = useWorkspaceStore((state) => state.setFullDataModalOpen);
  const columns = useWorkspaceStore((state) => state.columns);
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // filters
  const [filterMode, setFilterMode] = useState<'all' | 'outliers' | 'missing' | 'duplicates'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colName: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const duplicatesSet = useMemo(() => {
    if (filterMode !== 'duplicates') return new Set();
    const counts = new Map<string, number>();
    data.forEach(row => {
      const sig = JSON.stringify(columns.map(c => row[c.name]));
      counts.set(sig, (counts.get(sig) || 0) + 1);
    });
    const dupes = new Set<string>();
    for (const [sig, count] of counts.entries()) {
      if (count > 1) {
        dupes.add(sig);
      }
    }
    return dupes;
  }, [data, columns, filterMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      const api = getApi();
      const res = await api.get_full_dataset();
      if (res && res.success) {
        setData(res.data || []);
      } else {
        toast.error("Erreur lors du chargement des données complètes.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const outlierBounds = useMemo(() => {
    const bounds: Record<string, { min: number; max: number }> = {};
    columns.forEach(col => {
      if (col.type === 'continuous' || col.type === 'discrete') {
        const values = data
          .map(row => Number(row[col.name]))
          .filter(val => !isNaN(val) && val !== null && val !== undefined)
          .sort((a, b) => a - b);
          
        if (values.length > 0) {
          const q1Idx = Math.floor(values.length * 0.25);
          const q3Idx = Math.floor(values.length * 0.75);
          const q1 = values[q1Idx];
          const q3 = values[q3Idx];
          const iqr = q3 - q1;
          bounds[col.name] = {
            min: q1 - (1.5 * iqr),
            max: q3 + (1.5 * iqr)
          };
        }
      }
    });
    return bounds;
  }, [columns, data]);

  const isOutlier = (row: any, colName: string) => {
    const val = row[colName];
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    if (isNaN(num)) return false;
    const bounds = outlierBounds[colName];
    if (!bounds) return false;
    return num < bounds.min || num > bounds.max;
  };

  const isMissing = (val: any) => val === null || val === undefined || val === '';

  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (filterMode === 'missing') {
        const hasMissing = columns.some(c => isMissing(row[c.name]));
        if (!hasMissing) return false;
      } else if (filterMode === 'outliers') {
        const hasOutlier = columns.some(c => isOutlier(row, c.name));
        if (!hasOutlier) return false;
      } else if (filterMode === 'duplicates') {
        const sig = JSON.stringify(columns.map(c => row[c.name]));
        if (!duplicatesSet.has(sig)) return false;
      }

      if (searchTerm) {
        const matches = columns.some(c => String(row[c.name] || '').toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matches) return false;
      }
      return true;
    });
  }, [data, filterMode, searchTerm, columns, outlierBounds]);

  const handleEditSubmit = async (globalIndex: number, colName: string) => {
    if (!editingCell) return;
    try {
      const api = getApi();
      const res = await api.edit_cell(globalIndex, colName, editValue);
      if (res && res.success) {
        toast.success("Cellule modifiée");
        // Recharger le jeu de données pour actualiser UI
        await loadData();
        // Update main store to reflect preview changes
        useWorkspaceStore.setState({ 
          previewData: res.preview, 
          columns: res.columns,
          rowCount: res.row_count,
          colCount: res.col_count
        });
      } else {
        toast.error(res?.error || "Erreur de modification");
      }
    } catch (e) {
      toast.error("Erreur de communication");
    } finally {
      setEditingCell(null);
    }
  };

  const handleDeleteRow = async (globalIndex: number) => {
    toast("Confirmer la suppression", {
      description: "Voulez-vous vraiment supprimer cette ligne ?",
      action: {
        label: "Supprimer",
        onClick: async () => {
          try {
            const api = getApi();
            const res = await api.delete_row(globalIndex);
            if (res && res.success) {
              toast.success("Ligne supprimée");
              await loadData();
              useWorkspaceStore.setState({ 
                previewData: res.preview, 
                columns: res.columns,
                rowCount: res.row_count,
                colCount: res.col_count
              });
            } else {
              toast.error(res?.error || "Erreur de suppression");
            }
          } catch (e) {
            toast.error("Erreur de communication");
          }
        }
      },
      cancel: {
        label: "Annuler",
        onClick: () => {}
      },
      duration: 5000
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full h-full max-w-7xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600" />
              Explorateur de données complet
            </h2>
            <p className="text-sm text-zinc-500">Visualisez et modifiez l'intégralité du jeu de données.</p>
          </div>
          
          <button 
            onClick={() => setFullDataModalOpen(false)}
            className="text-zinc-400 hover:text-zinc-600 p-2 rounded-full hover:bg-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="px-3 py-1.5 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Toutes les données</option>
              <option value="missing">Valeurs manquantes uniquement</option>
              <option value="outliers">Valeurs aberrantes uniquement</option>
              <option value="duplicates">Doublons uniquement</option>
            </select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 border border-zinc-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="text-sm text-zinc-500 font-medium">
            {filteredData.length} ligne(s) affichée(s)
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto bg-zinc-100/50 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <div className="text-sm font-medium text-zinc-600">Chargement des données...</div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm bg-white">
              <thead className="sticky top-0 z-10 bg-white shadow-sm ring-1 ring-black ring-opacity-5">
                <tr>
                  <th className="px-3 py-2 border-b border-zinc-200 font-semibold text-zinc-600 bg-zinc-50 w-16 text-center">Ligne</th>
                  {columns.map(col => (
                    <th key={col.name} className="px-4 py-2 border-b border-zinc-200 border-x font-semibold text-zinc-600 bg-zinc-50 whitespace-nowrap">
                      {col.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 border-b border-zinc-200 font-semibold text-zinc-600 bg-zinc-50 sticky right-0 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)] w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-zinc-500 italic">
                      Aucune donnée ne correspond à vos critères.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <tr key={row.__index__} className="group hover:bg-indigo-50/30 transition-colors">
                      <td className="px-3 py-1.5 border-x border-zinc-200 bg-zinc-50/50 text-center text-xs text-zinc-400 font-mono">
                        {row.__index__}
                      </td>
                      {columns.map(col => {
                        const val = row[col.name];
                        const missing = isMissing(val);
                        const outlier = isOutlier(row, col.name);
                        const isEditingThis = editingCell?.rowIdx === row.__index__ && editingCell?.colName === col.name;

                        return (
                          <td 
                            key={col.name} 
                            className={`px-4 py-1.5 border-x border-zinc-200 whitespace-nowrap ${missing ? 'bg-orange-50/50 text-orange-600 font-medium' : ''} ${outlier ? 'bg-rose-50/50 text-rose-700 font-medium' : 'text-zinc-700'}`}
                            onDoubleClick={() => {
                              setEditingCell({ rowIdx: row.__index__, colName: col.name });
                              setEditValue(val === null ? '' : String(val));
                            }}
                          >
                            {isEditingThis ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  autoFocus
                                  className="w-full px-2 py-0.5 border border-indigo-400 rounded text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditSubmit(row.__index__, col.name);
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  onBlur={() => setEditingCell(null)}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-between group/cell">
                                <span className={missing ? 'italic opacity-60' : ''}>
                                  {missing ? 'Manquant' : String(val)}
                                </span>
                                {outlier && <span title="Valeur aberrante"><AlertTriangle className="w-3.5 h-3.5 text-rose-500 ml-2" /></span>}
                                
                                <button
                                  className="opacity-0 group-hover/cell:opacity-100 p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-indigo-600 transition-all ml-2"
                                  title="Modifier"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCell({ rowIdx: row.__index__, colName: col.name });
                                    setEditValue(val === null ? '' : String(val));
                                  }}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 border-x border-zinc-200 text-center sticky right-0 bg-white shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.02)] group-hover:bg-indigo-50/30">
                        <button
                          onClick={() => handleDeleteRow(row.__index__)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-100 rounded text-zinc-400 hover:text-rose-600 transition-all"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
