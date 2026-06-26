import React, { useState, useMemo } from 'react';
import { useWorkspaceStore } from '../store';
import { Filter, Search, BarChart3, Binary, AlignLeft, Calculator, Table2 } from 'lucide-react';
import DataTable from './DataTable';

export default function DataDashboardView() {
  const columnsStore = useWorkspaceStore((state) => state.columns);
  const rowCount = useWorkspaceStore((state) => state.rowCount);
  const colCount = useWorkspaceStore((state) => state.colCount);
  const previewData = useWorkspaceStore((state) => state.previewData);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showTable, setShowTable] = useState(false);

  const columns = useMemo(() => {
    if (!columnsStore) return [];
    let cols = columnsStore;
    
    if (typeFilter !== 'all') {
      if (typeFilter === 'numeric') {
        cols = cols.filter(c => c.type === 'continuous' || c.type === 'discrete');
      } else if (typeFilter === 'categorical') {
        cols = cols.filter(c => c.type === 'nominal' || c.type === 'ordinal');
      } else {
        cols = cols.filter(c => c.type === typeFilter);
      }
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      cols = cols.filter(c => c.name.toLowerCase().includes(term));
    }
    return cols;
  }, [columnsStore, searchTerm, typeFilter]);

  if (!columnsStore || !previewData || previewData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-500 flex-col">
        <BarChart3 className="w-12 h-12 mb-4 text-slate-300" />
        <p>Veuillez importer des données pour voir le tableau de bord.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tableau de Bord des Données</h2>
          <p className="text-slate-500 text-sm mt-1">Aperçu rapide et filtrage de vos variables ({rowCount} lignes, {colCount} colonnes).</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowTable(!showTable)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            <Table2 className="w-4 h-4" />
            {showTable ? "Masquer les données brutes" : "Voir les données brutes"}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une variable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="relative w-full md:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
          >
            <option value="all">Tous les types</option>
            <option value="numeric">Numériques</option>
            <option value="categorical">Catégorielles</option>
            <option value="text">Texte</option>
            <option value="datetime">Dates</option>
          </select>
        </div>
      </div>

      {showTable && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-8 overflow-hidden h-96 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-700">Données Brutes (Aperçu)</h3>
          </div>
          <div className="flex-1 overflow-auto relative">
            <DataTable />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          // Calculate quick stats
          let innerContent = null;
          const isNumeric = col.type === 'continuous' || col.type === 'discrete';
          const isCategorical = col.type === 'nominal' || col.type === 'ordinal';
          
          if (isNumeric) {
            const vals = previewData.map((r: any) => r[col.name]).filter((v: any) => v != null && v !== '');
            const numVals = vals.map(Number).filter((n: number) => !isNaN(n));
            const mean = numVals.length > 0 ? (numVals.reduce((a: number, b: number) => a + b, 0) / numVals.length).toFixed(2) : '-';
            const sorted = [...numVals].sort((a,b) => a-b);
            const min = sorted.length > 0 ? sorted[0].toFixed(2) : '-';
            const max = sorted.length > 0 ? sorted[sorted.length - 1].toFixed(2) : '-';
            const stdDev = numVals.length > 1 ? Math.sqrt(numVals.reduce((sq, n) => sq + Math.pow(n - parseFloat(mean), 2), 0) / (numVals.length - 1)).toFixed(2) : '-';

            innerContent = (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-400 block mb-0.5 uppercase text-[9px] font-black tracking-wider">Moyenne</span>
                  <span className="font-semibold text-slate-700">{mean}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-400 block mb-0.5 uppercase text-[9px] font-black tracking-wider">Écart-type</span>
                  <span className="font-semibold text-slate-700">{stdDev}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-400 block mb-0.5 uppercase text-[9px] font-black tracking-wider">Min</span>
                  <span className="font-semibold text-slate-700">{min}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-400 block mb-0.5 uppercase text-[9px] font-black tracking-wider">Max</span>
                  <span className="font-semibold text-slate-700">{max}</span>
                </div>
              </div>
            );
          } else {
            // Categorical or text
            const vals = previewData.map((r: any) => String(r[col.name] ?? ''));
            const unique = new Set(vals);
            const count = unique.size;
            const nulls = vals.filter(v => !v || v === 'null').length;
            
            innerContent = (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-400 block mb-0.5 uppercase text-[9px] font-black tracking-wider">Modalités uniques</span>
                  <span className="font-semibold text-slate-700">{count}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-slate-400 block mb-0.5 uppercase text-[9px] font-black tracking-wider">Valeurs manquantes</span>
                  <span className="font-semibold text-slate-700">{nulls}</span>
                </div>
              </div>
            );
          }

          let Icon = AlignLeft;
          if (isNumeric) Icon = Calculator;
          if (isCategorical) Icon = Binary;

          return (
            <div key={col.name} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors flex flex-col">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className={`p-1.5 rounded-lg shrink-0 ${isNumeric ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-800 truncate" title={col.name}>{col.name}</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wider shrink-0">
                  {col.type}
                </span>
              </div>
              <div className="flex-1 mt-2">
                {innerContent}
              </div>
            </div>
          );
        })}
      </div>
      
      {columns.length === 0 && (
        <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
          Aucune variable ne correspond aux filtres.
        </div>
      )}
    </div>
  );
}
