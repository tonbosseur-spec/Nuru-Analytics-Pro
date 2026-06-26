import React, { useState } from 'react';
import { useWorkspaceStore } from '../store';
import { getApi } from '../pywebview';
import { toast } from 'sonner';
import { BarChart2, Hash, Type, Loader2, PieChart, Layers, Settings2, Info } from 'lucide-react';
import FolderSelector from './FolderSelector';

type AnalysisTab = 'univariate' | 'bivariate';

export default function DescriptiveStatsView() {
  const decimals = useWorkspaceStore(s => s.decimals);
  const columns = useWorkspaceStore(s => s.columns);
  const addAnalysisResult = useWorkspaceStore(s => s.addAnalysisResult);
  
  const [activeTab, setActiveTab ] = useState<AnalysisTab>('univariate');
  
  const [selectedColX, setSelectedColX] = useState<string>('');
  const [selectedColY, setSelectedColY] = useState<string>('');
  
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  
  const [includeChart, setIncludeChart] = useState(false);
  const [chartType, setChartType] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);

  // Checkbox states
  const [optCentral, setOptCentral] = useState(true);
  const [optDispersion, setOptDispersion] = useState(true);
  const [optFreq, setOptFreq] = useState(true);
  const [optCorrelation, setOptCorrelation] = useState(true);
  const [optContingency, setOptContingency] = useState(true);
  const [optGroupStats, setOptGroupStats] = useState(true);

  // Available chart types based on univariate or bivariate
  const univariateQuantiCharts = ['histogram', 'boxplot', 'violin', 'cumulative'];
  const univariateQualiCharts = ['bar', 'pie', 'pareto'];
  const bivariateQuantiQuanti = ['scatter'];
  const bivariateQualiQuali = ['bar_grouped', 'bar_stacked', 'heatmap'];
  const bivariateQuantiQuali = ['boxplot_grouped', 'violin_grouped'];

  const getType = (colName: string) => columns.find(c => c.name === colName)?.type;

  const typeX = selectedColX ? getType(selectedColX) : null;
  const isXQuant = typeX === 'continuous' || typeX === 'discrete';

  const typeY = selectedColY ? getType(selectedColY) : null;
  const isYQuant = typeY === 'continuous' || typeY === 'discrete';

  const getAvailableChartTypes = () => {
    if (activeTab === 'univariate') {
      if (!selectedColX) return [];
      return isXQuant ? univariateQuantiCharts : univariateQualiCharts;
    } else {
      if (!selectedColX || !selectedColY) return [];
      if (isXQuant && isYQuant) return bivariateQuantiQuanti;
      if (!isXQuant && !isYQuant) return bivariateQualiQuali;
      return bivariateQuantiQuali;
    }
  };

  const handleGenerate = async () => {
    if (activeTab === 'univariate' && !selectedColX) return;
    if (activeTab === 'bivariate' && (!selectedColX || !selectedColY)) return;

    const api = getApi();
    if (!api) {
      toast.error("L'API Python n'est pas disponible.");
      return;
    }

    setIsGenerating(true);
    let title = "";
    let resultType: 'univariate' | 'bivariate' = activeTab;
    let variables = activeTab === 'univariate' ? [selectedColX] : [selectedColX, selectedColY];
    let metrics: any = null;
    let interpretation = "";
    let chartObj = null;

    try {
      if (activeTab === 'univariate') {
        title = `Profil univarié: ${selectedColX}`;
        const statsRes = await api.get_comprehensive_univariate_stats(selectedColX);
        
        if (statsRes && statsRes.success) {
          metrics = { ...statsRes.metrics }; // Clone
          
          // Filter out features based on checkboxes
          if (isXQuant) {
            if (!optCentral) {
              delete metrics.mean;
              delete metrics.median;
            }
            if (!optDispersion) {
              delete metrics.std_dev;
              delete metrics.cv_percent;
              delete metrics.min;
              delete metrics.max;
              delete metrics.q1;
              delete metrics.q3;
            }
          } else {
            if (!optFreq) {
              delete metrics.frequency_table;
              delete metrics.mode;
            }
          }
          interpretation = statsRes.interpretation || "";
        } else {
          throw new Error(statsRes.error || "Erreur lors du calcul stat");
        }
      } else {
        title = `Croisement: ${selectedColX} x ${selectedColY}`;
        const statsRes = await api.get_comprehensive_bivariate_stats(selectedColX, selectedColY);
        
        if (statsRes && statsRes.success) {
          metrics = { ...statsRes.metrics };
          
          if (isXQuant && isYQuant && !optCorrelation) {
             delete metrics.pearson_r;
             delete metrics.spearman_rho;
             delete metrics.covariance;
          }
          if (!isXQuant && !isYQuant && !optContingency) {
             delete metrics.contingency_table;
          }
          if (((isXQuant && !isYQuant) || (!isXQuant && isYQuant)) && !optGroupStats) {
             delete metrics.group_stats;
          }
          interpretation = statsRes.interpretation || "";
        } else {
          throw new Error(statsRes.error || "Erreur lors du calcul stat");
        }
      }

      if (includeChart && chartType) {
        const cType = chartType;
        const cX = selectedColX;
        const cY = activeTab === 'bivariate' ? selectedColY : null;
        const chartRes = await api.generate_descriptive_chart(cType, cX, cY);
        if (chartRes && chartRes.success && chartRes.chart) {
          chartObj = chartRes.chart;
        } else {
          console.warn("Chart generation error:", chartRes.error);
          toast.warning("Graphique non généré: " + chartRes.error);
        }
      }

      addAnalysisResult({
        id: Math.random().toString(36).substr(2, 9),
        title,
        timestamp: new Date().toISOString(),
        type: resultType,
        variables,
        metrics,
        interpretation,
        chart: chartObj,
        group: selectedFolder || undefined
      });

      toast.success("Analyse terminée !");
    } catch (e: any) {
      toast.error(e.message || "Erreur de traitement");
    } finally {
      setIsGenerating(false);
    }
  };

  const availableCharts = getAvailableChartTypes();
  React.useEffect(() => {
    if (availableCharts.length > 0 && (!chartType || !availableCharts.includes(chartType))) {
      setChartType(availableCharts[0]);
    }
  }, [availableCharts, chartType, activeTab]);

  const renderUnivariateOptions = () => {
    if (!selectedColX) return null;
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
          <Settings2 className="w-4 h-4 text-indigo-500" /> Options d'analyse
        </h3>
        
        {isXQuant ? (
          <div className="space-y-3">
             <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
               <input type="checkbox" className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={optCentral} onChange={e => setOptCentral(e.target.checked)} />
               <div>
                 <span className="block text-sm font-medium text-slate-900">Tendance Centrale</span>
                 <span className="block text-xs text-slate-500 mt-0.5">Moyenne, Médiane. Mesure le centre de gravité des données.</span>
               </div>
             </label>
             <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
               <input type="checkbox" className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={optDispersion} onChange={e => setOptDispersion(e.target.checked)} />
               <div>
                 <span className="block text-sm font-medium text-slate-900">Dispersion</span>
                 <span className="block text-xs text-slate-500 mt-0.5">Écart-type, Variance, CV, Min/Max. Mesure l'étalement des données autour de la moyenne.</span>
               </div>
             </label>
          </div>
        ) : (
          <div className="space-y-3">
             <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
               <input type="checkbox" className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={optFreq} onChange={e => setOptFreq(e.target.checked)} />
               <div>
                 <span className="block text-sm font-medium text-slate-900">Fréquences & Mode</span>
                 <span className="block text-xs text-slate-500 mt-0.5">Tableau des effectifs, pourcentages et modalité la plus fréquente.</span>
               </div>
             </label>
          </div>
        )}
      </div>
    );
  };

  const renderBivariateOptions = () => {
    if (!selectedColX || !selectedColY) return null;
    
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
          <Settings2 className="w-4 h-4 text-indigo-500" /> Options d'analyse
        </h3>
        
        {isXQuant && isYQuant ? (
           <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
             <input type="checkbox" className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={optCorrelation} onChange={e => setOptCorrelation(e.target.checked)} />
             <div>
               <span className="block text-sm font-medium text-slate-900">Corrélations & Covariance</span>
               <span className="block text-xs text-slate-500 mt-0.5">Pearson (relation linéaire) et Spearman (rangs). Évalue si les deux variables varient ensemble.</span>
             </div>
           </label>
        ) : !isXQuant && !isYQuant ? (
           <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
             <input type="checkbox" className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={optContingency} onChange={e => setOptContingency(e.target.checked)} />
             <div>
               <span className="block text-sm font-medium text-slate-900">Tableau de contingence</span>
               <span className="block text-xs text-slate-500 mt-0.5">Croisement des effectifs pour comprendre l'association entre les deux variables qualitatives.</span>
             </div>
           </label>
        ) : (
           <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
             <input type="checkbox" className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={optGroupStats} onChange={e => setOptGroupStats(e.target.checked)} />
             <div>
               <span className="block text-sm font-medium text-slate-900">Statistiques par groupe</span>
               <span className="block text-xs text-slate-500 mt-0.5">Moyenne, médiane et dispersion calculées pour chaque modalité de la variable qualitative.</span>
             </div>
           </label>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Tabs */}
      <div className="flex items-center space-x-8 px-8 pt-6 border-b border-slate-200 bg-white shrink-0">
         <button
            onClick={() => { setActiveTab('univariate'); setSelectedColX(''); setSelectedColY(''); setIncludeChart(false); }}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'univariate' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <PieChart className="w-4 h-4" /> Analyse Univariée
         </button>
         <button
            onClick={() => { setActiveTab('bivariate'); setSelectedColX(''); setSelectedColY(''); setIncludeChart(false); }}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'bivariate' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           <Layers className="w-4 h-4" /> Analyse Bivariée
         </button>
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full flex-1 overflow-y-auto">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 space-y-8">
          
          {/* Variable Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700">
                {activeTab === 'univariate' ? 'Sélectionner une variable' : 'Première variable (X)'}
              </label>
              <select
                value={selectedColX}
                onChange={(e) => setSelectedColX(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              >
                <option value="">-- Choisissez --</option>
                {columns.map(col => (
                  <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                ))}
              </select>
            </div>

            {activeTab === 'bivariate' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                <label className="block text-sm font-semibold text-slate-700">Seconde variable (Y)</label>
                <select
                  value={selectedColY}
                  onChange={(e) => setSelectedColY(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                >
                  <option value="">-- Choisissez --</option>
                  {columns.filter(c => c.name !== selectedColX).map(col => (
                    <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Analysis Options */}
          {activeTab === 'univariate' ? renderUnivariateOptions() : renderBivariateOptions()}

          {/* Chart Options */}
          {((activeTab === 'univariate' && selectedColX) || (activeTab === 'bivariate' && selectedColX && selectedColY)) && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 pt-4 border-t border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer group">
                 <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={includeChart} onChange={e => setIncludeChart(e.target.checked)} />
                 <span className="text-sm font-medium text-slate-800 group-hover:text-indigo-600 transition-colors">Inclure une visualisation graphique</span>
              </label>

              {includeChart && (
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/60 animate-in fade-in zoom-in-95 duration-200">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Type de Graphique</label>
                  <div className="flex flex-wrap gap-2">
                    {availableCharts.map(chart => (
                      <button
                        key={chart}
                        onClick={() => setChartType(chart)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          chartType === chart 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {chart === 'histogram' ? 'Histogramme' :
                         chart === 'boxplot' ? 'Boîte à moustaches' :
                         chart === 'violin' ? 'Violon' :
                         chart === 'cumulative' ? 'Somme cumulée' :
                         chart === 'bar' ? 'Barres' :
                         chart === 'pie' ? 'Secteurs (Camembert)' :
                         chart === 'pareto' ? 'Pareto' :
                         chart === 'scatter' ? 'Nuage de points' :
                         chart === 'bar_grouped' ? 'Barres groupées' :
                         chart === 'bar_stacked' ? 'Barres empilées' :
                         chart === 'heatmap' ? 'Carte de chaleur' :
                         chart === 'boxplot_grouped' ? 'Boîtes à moustaches multiples' :
                         chart === 'violin_grouped' ? 'Violons multiples' : chart}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {((activeTab === 'univariate' && selectedColX) || (activeTab === 'bivariate' && selectedColX && selectedColY)) && (
            <div className="pt-4 border-t border-slate-100">
              <FolderSelector value={selectedFolder} onChange={setSelectedFolder} />
            </div>
          )}

          {/* Actions */}
          <div className="pt-6 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={
                (activeTab === 'univariate' && !selectedColX) || 
                (activeTab === 'bivariate' && (!selectedColX || !selectedColY)) || 
                isGenerating
              }
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:shadow-none"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <BarChart2 className="w-5 h-5" />}
              {isGenerating ? 'Analyse en cours...' : 'Générer l\'Analyse'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

