import React, { useState, useEffect } from 'react';
import { ColumnMetadata } from '../types';
import { X, AlertTriangle, ShieldCheck, Trash2, ArrowRightLeft, Percent, Compass, Info } from 'lucide-react';
import { useWorkspaceStore } from '../store';

interface Props {
  column: ColumnMetadata | null;
  onClose: () => void;
}

export default function OutliersModal({ column, onClose }: Props) {
  const detectOutliers = useWorkspaceStore((state) => state.detectOutliers);
  const treatOutliers = useWorkspaceStore((state) => state.treatOutliers);

  const [detectMethod, setDetectMethod] = useState<'iqr' | 'zscore'>('iqr');
  const [treatMethod, setTreatMethod] = useState<'winsorize' | 'exclude' | 'median'>('winsorize');
  
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (column) {
      loadDetectionStats();
    }
  }, [column, detectMethod]);

  const loadDetectionStats = async () => {
    if (!column) return;
    setLoading(true);
    setError(null);
    const result = await detectOutliers(column.name, detectMethod);
    if (result && result.success) {
      setStats(result);
    } else {
      setError(result?.error || "Impossible de charger les statistiques d'anomalies.");
    }
    setLoading(false);
  };

  if (!column) return null;

  const handleApply = async () => {
    setIsApplying(true);
    await treatOutliers(column.name, detectMethod, treatMethod);
    setIsApplying(false);
    onClose();
  };

  const pct = stats && stats.total_count > 0 
    ? ((stats.outlier_count / stats.total_count) * 105).toFixed(useWorkspaceStore.getState().decimals).replace('.', ',') // custom representation or rounded
    : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900">Valeurs aberrantes (Outliers)</h3>
              <p className="text-xs text-zinc-500">Variable : {column.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-md hover:bg-zinc-100 transition-colors pointer-events-auto animate-none">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Detection Options */}
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Méthode de détection</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDetectMethod('iqr')}
                className={`py-2.5 px-3 rounded-xl border text-left transition-all relative pointer-events-auto ${
                  detectMethod === 'iqr'
                    ? 'border-zinc-900 bg-zinc-50 font-medium text-zinc-900 shadow-sm'
                    : 'border-zinc-200 hover:border-zinc-400 text-zinc-600'
                }`}
              >
                <div className="text-sm">Intervalle Interquartile (IQR)</div>
                <div className="text-xs text-zinc-500 font-normal mt-0.5">Seuil 1,5x [Q1 - 1,5*IQR, Q3 + 1,5*IQR]</div>
              </button>
              <button
                type="button"
                onClick={() => setDetectMethod('zscore')}
                className={`py-2.5 px-3 rounded-xl border text-left transition-all relative pointer-events-auto ${
                  detectMethod === 'zscore'
                    ? 'border-zinc-900 bg-zinc-50 font-medium text-zinc-900 shadow-sm'
                    : 'border-zinc-200 hover:border-zinc-400 text-zinc-600'
                }`}
              >
                <div className="text-sm">Z-Score standardisé</div>
                <div className="text-xs text-zinc-500 font-normal mt-0.5">Seuil ±3,0 écart-types de la moyenne</div>
              </button>
            </div>
          </div>

          {/* Section 2: Detection Report */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-zinc-400" />
                Rapport de détection
              </span>
              {loading && <span className="text-xs text-zinc-400 animate-pulse font-medium">Analyse en cours...</span>}
            </div>

            {error ? (
              <div className="text-sm text-red-600 flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                <Info className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : stats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-xs">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Anomalies détectées</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-2xl font-bold text-rose-600">{stats.outlier_count}</span>
                      <span className="text-xs text-zinc-500">/ {stats.total_count} valeurs</span>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-xs">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Proportion</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-2xl font-bold text-zinc-800">
                        {stats.total_count > 0 ? ((stats.outlier_count / stats.total_count) * 100).toFixed(useWorkspaceStore.getState().decimals).replace('.', ',') : '0'}%
                      </span>
                      <span className="text-xs text-zinc-500">de l'échantillon</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-zinc-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center py-0.5 border-b border-zinc-50">
                    <span className="text-zinc-500">Plage de tolérance (valeurs normales)</span>
                    <span className="font-mono text-zinc-800 font-medium">
                      [{stats.lower_bound?.toFixed(useWorkspaceStore.getState().decimals)}, {stats.upper_bound?.toFixed(useWorkspaceStore.getState().decimals)}]
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-zinc-50">
                    <span className="text-zinc-500">Minimum dans la colonne</span>
                    <span className={`font-mono font-medium ${stats.min_val < stats.lower_bound ? 'text-rose-600 font-bold' : 'text-zinc-700'}`}>
                      {stats.min_val?.toFixed(useWorkspaceStore.getState().decimals)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-zinc-50">
                    <span className="text-zinc-500">Maximum dans la colonne</span>
                    <span className={`font-mono font-medium ${stats.max_val > stats.upper_bound ? 'text-rose-600 font-bold' : 'text-zinc-700'}`}>
                      {stats.max_val?.toFixed(useWorkspaceStore.getState().decimals)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-zinc-500">Médiane (valeur centrale stable)</span>
                    <span className="font-mono text-zinc-800 font-medium">{stats.median?.toFixed(useWorkspaceStore.getState().decimals)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Section 3: Treatment Selection */}
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Options de traitement</span>
            <div className="space-y-2">
              <label 
                className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all pointer-events-auto ${
                  treatMethod === 'winsorize' ? 'border-zinc-900 bg-zinc-50 shadow-sm' : 'border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <input type="radio" className="mt-1" name="treatment" checked={treatMethod === 'winsorize'} onChange={() => setTreatMethod('winsorize')} />
                <div className="ml-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                    <ArrowRightLeft className="w-4 h-4 text-zinc-700" />
                    Winsorisation (Écrêtage)
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Limite les valeurs aberrantes aux bornes minimales et maximales tolérables.</p>
                </div>
              </label>

              <label 
                className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all pointer-events-auto ${
                  treatMethod === 'exclude' ? 'border-zinc-900 bg-zinc-50 shadow-sm' : 'border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <input type="radio" className="mt-1" name="treatment" checked={treatMethod === 'exclude'} onChange={() => setTreatMethod('exclude')} />
                <div className="ml-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                    <Trash2 className="w-4 h-4 text-red-600" />
                    Exclure les observations
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Supprime toutes les lignes/observations contenant des outliers dans cette colonne.</p>
                </div>
              </label>

              <label 
                className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all pointer-events-auto ${
                  treatMethod === 'median' ? 'border-zinc-900 bg-zinc-50 shadow-sm' : 'border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <input type="radio" className="mt-1" name="treatment" checked={treatMethod === 'median'} onChange={() => setTreatMethod('median')} />
                <div className="ml-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Imputer par la Médiane
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Remplace uniquement les valeurs aberrantes par la valeur médiane de la distribution.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 flex justify-end gap-2 bg-zinc-50">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 bg-zinc-100 rounded-lg transition-colors pointer-events-auto"
          >
            Annuler
          </button>
          <button 
            type="button"
            onClick={handleApply}
            disabled={isApplying || loading || stats?.outlier_count === 0}
            className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 bg-zinc-900 rounded-lg transition-all disabled:opacity-50 pointer-events-auto"
          >
            {isApplying ? <span className="animate-pulse">Application...</span> : 'Appliquer le traitement'}
          </button>
        </div>
      </div>
    </div>
  );
}
