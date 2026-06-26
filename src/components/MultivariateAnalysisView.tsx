import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store';
import { useDashboardStore } from '../dashboardStore';
import { getApi } from '../pywebview';
import { toast } from 'sonner';
import { 
  Target, 
  Settings2, 
  HelpCircle, 
  BarChart3, 
  Sparkles, 
  Play, 
  Loader2, 
  Award, 
  Compass, 
  Users, 
  Grid3X3, 
  Network, 
  LayoutGrid, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Calendar,
  Share2,
  TableProperties
} from 'lucide-react';
import Plot from 'react-plotly.js';
import ReactMarkdown from 'react-markdown';
import FolderSelector from './FolderSelector';

type AnalysisType = 'acp' | 'afc' | 'acm' | 'cah' | 'afd';

// Interactive, beautiful Heatmap component for Factor Contributions in ACM and AFD
const FactorHeatmap = ({ activeAnalysis, result }: { activeAnalysis: string; result: any }) => {
  const [metricMode, setMetricMode] = React.useState<'ctr' | 'coords'>('ctr');
  const [hoveredCell, setHoveredCell] = React.useState<{ rowIdx: number; colIdx: number } | null>(null);

  if (!result) return null;

  // 1. Determine columns and rows
  let rows: Array<{ name: string; label: string; parentVar: string; values: { ctr: number; coords: number }[] }> = [];
  let dims: string[] = [];

  if (activeAnalysis === 'acm') {
    if (!result.categories || result.categories.length === 0) return null;
    const catSamples = result.categories;
    const numDims = catSamples[0]?.coords?.length || 2;
    dims = Array.from({ length: numDims }, (_, i) => `Dimension F${i + 1}`);
    rows = catSamples.map((cat: any) => ({
      name: `${cat.variable} : ${cat.category}`,
      label: cat.category,
      parentVar: cat.variable,
      values: dims.map((_, idx) => ({
        ctr: cat.ctr[idx] ?? 0,
        coords: cat.coords[idx] ?? 0,
      })),
    }));
  } else if (activeAnalysis === 'afd') {
    if (!result.variables || result.variables.length === 0) return null;
    const varSamples = result.variables;
    const numDims = varSamples[0]?.coords?.length || 2;
    dims = Array.from({ length: numDims }, (_, i) => `Axe LD${i + 1}`);
    rows = varSamples.map((v: any) => ({
      name: v.variable,
      label: v.variable,
      parentVar: '',
      values: dims.map((_, idx) => ({
        ctr: v.ctr[idx] ?? 0,
        coords: v.coords[idx] ?? 0,
      })),
    }));
  } else {
    return null;
  }

  // Find max value for color scaling bounds
  const allVals = rows.flatMap(r => r.values.map(v => metricMode === 'ctr' ? v.ctr : Math.abs(v.coords)));
  const maxVal = Math.max(...allVals, 1);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 select-none">
      <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-100 pb-4">
        <div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 font-sans">
            🔥 Contribution des Facteurs & Variables (Heatmap)
          </h4>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5 font-sans">
            Survolez les cellules pour découvrir les coordonnées spatiales exactes et les pourcentages de contribution relative à l'inertie.
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setMetricMode('ctr')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              metricMode === 'ctr'
                ? 'bg-white text-indigo-950 shadow-sm border border-slate-200/20'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Contribution (%)
          </button>
          <button
            onClick={() => setMetricMode('coords')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              metricMode === 'coords'
                ? 'bg-white text-indigo-950 shadow-sm border border-slate-200/20'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {activeAnalysis === 'afd' ? 'Corrélation Discriminante' : 'Coordonnée Axe'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-100 rounded-2xl">
        <div className="min-w-[600px] bg-slate-50/20 divide-y divide-slate-150">
          {/* Header */}
          <div className="grid grid-cols-12 bg-slate-50/80 p-3 text-[10px] font-black uppercase text-slate-450 tracking-wider">
            <div className="col-span-4 pl-2">Variables & Catégories</div>
            <div className="col-span-8 grid grid-cols-4 gap-2 text-center">
              {dims.map((d, colIdx) => (
                <div key={colIdx} className="font-extrabold pb-0.5">{d}</div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="divide-y divide-slate-100 bg-white">
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-12 p-2.5 items-center hover:bg-slate-50/40 transition-colors">
                <div className="col-span-4 pl-2 truncate pr-4">
                  <div className="text-xs font-bold text-slate-800 truncate" title={row.name}>
                    {row.label}
                  </div>
                  {row.parentVar && (
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight truncate">
                      Var active: {row.parentVar}
                    </div>
                  )}
                </div>
                <div className="col-span-8 grid grid-cols-4 gap-2 text-center h-11">
                  {row.values.map((val, colIdx) => {
                    const currentVal = metricMode === 'ctr' ? val.ctr : val.coords;
                    const ratio = metricMode === 'ctr' 
                      ? val.ctr / maxVal 
                      : Math.abs(val.coords) / maxVal;
                    
                    let bgColor = '';
                    let textColor = 'text-slate-800';
                    if (metricMode === 'ctr') {
                      bgColor = `rgba(16, 185, 129, ${0.05 + ratio * 0.9})`; // emerald-500
                      if (ratio > 0.45) textColor = 'text-white font-extrabold';
                    } else {
                      if (val.coords >= 0) {
                        bgColor = `rgba(59, 130, 246, ${0.05 + ratio * 0.9})`; // blue-500
                        if (ratio > 0.45) textColor = 'text-white font-extrabold';
                      } else {
                        bgColor = `rgba(239, 68, 68, ${0.05 + ratio * 0.9})`; // red-500
                        if (ratio > 0.45) textColor = 'text-white font-extrabold';
                      }
                    }

                    const isHovered = hoveredCell?.rowIdx === rowIdx && hoveredCell?.colIdx === colIdx;

                    return (
                      <div
                        key={colIdx}
                        className="relative h-full flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer border border-transparent hover:border-indigo-500/50 hover:shadow-inner"
                        style={{ backgroundColor: bgColor }}
                        onMouseEnter={() => setHoveredCell({ rowIdx, colIdx })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <span className={`text-[11px] font-mono leading-none ${textColor}`}>
                          {metricMode === 'ctr' ? `${currentVal.toFixed(useWorkspaceStore.getState().decimals)}%` : currentVal.toFixed(useWorkspaceStore.getState().decimals)}
                        </span>

                        {/* Tooltip Overlay */}
                        {isHovered && (
                          <div className="absolute z-50 bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white rounded-2xl p-4 shadow-xl text-left border border-slate-800 select-text w-64 animate-in fade-in zoom-in-95 duration-100 leading-normal">
                            <h5 className="font-extrabold text-[10px] uppercase tracking-wider text-indigo-400 mb-1">
                              {dims[colIdx]}
                            </h5>
                            <p className="text-xs font-black text-white mb-2 truncate">
                              {row.name}
                            </p>
                            
                            <div className="space-y-1.5 border-t border-slate-800 pt-2 text-[11px]">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium">Contribution :</span>
                                <span className="font-bold font-mono text-emerald-400">{val.ctr.toFixed(useWorkspaceStore.getState().decimals)} %</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium">Coordonnée :</span>
                                <span className={`font-bold font-mono ${val.coords >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                  {val.coords.toFixed(useWorkspaceStore.getState().decimals)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                                <span>Part de l'inertie:</span>
                                <span>{(val.ctr).toFixed(0)}% du total</span>
                              </div>
                            </div>
                            
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] text-slate-400 font-semibold bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-1.5">
          <span>Échelle :</span>
          {metricMode === 'ctr' ? (
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500/10 border border-emerald-500/10" />
              <span>Faible</span>
              <div className="w-12 h-2.5 rounded bg-gradient-to-r from-emerald-500/10 to-emerald-500" />
              <span>Forte</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-rose-500/20" /> Négative (-)</span>
              <span>•</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded bg-blue-500/20" /> Positive (+)</span>
            </div>
          )}
        </div>
        <span>Pointez une coordonnée pour voir la fiche d'inertie.</span>
      </div>
    </div>
  );
};

export default function MultivariateAnalysisView() {
  const columns = useWorkspaceStore((state) => state.columns);
  const isReady = useWorkspaceStore((state) => state.isReady);
  const addAnalysisResult = useWorkspaceStore((state) => state.addAnalysisResult);
  const addItem = useDashboardStore((state) => state.addItem);

  // General State
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisType>('acp');
  const [isCalculating, setIsCalculating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'charts' | 'tables' | 'interpretation' | 'assignments'>('charts');
  const [selectedFolder, setSelectedFolder] = useState<string>('');

  // Input Configuration State
  const [selectedNums, setSelectedNums] = useState<string[]>([]);
  const [scaleData, setScaleData] = useState(true);

  const [rowColumn, setRowColumn] = useState('');
  const [colColumn, setColColumn] = useState('');

  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  const [cahNums, setCahNums] = useState<string[]>([]);
  const [linkageMethod, setLinkageMethod] = useState('ward');
  const [numClusters, setNumClusters] = useState(3);

  const [afdGroupColumn, setAfdGroupColumn] = useState('');

  // Filter columns by type
  const numCols = columns.filter(c => c.type === 'continuous' || c.type === 'discrete');
  const catCols = columns.filter(c => c.type === 'nominal' || c.type === 'ordinal');

  // Check for missing values in selected columns dynamically
  const activeSelectedVars = activeAnalysis === 'acp' ? selectedNums
                             : activeAnalysis === 'afc' ? [rowColumn, colColumn].filter(Boolean)
                             : activeAnalysis === 'acm' ? selectedCats
                             : activeAnalysis === 'afd' ? [...selectedNums, afdGroupColumn].filter(Boolean)
                             : cahNums;

  const previewData = useWorkspaceStore((state) => state.previewData);
  const varsWithMissing = activeSelectedVars.filter(varName => {
    return previewData.some(row => {
      const val = row[varName];
      return val === null || val === undefined || val === "" || (typeof val === 'number' && isNaN(val));
    });
  });

  const hasMissingValues = varsWithMissing.length > 0;

  // Autofill lists on load / active analysis change
  useEffect(() => {
    if (columns.length > 0) {
      if (activeAnalysis === 'acp') {
        setSelectedNums(numCols.slice(0, 5).map(c => c.name));
      } else if (activeAnalysis === 'afc') {
        if (catCols.length >= 2) {
          setRowColumn(catCols[0].name);
          setColColumn(catCols[1].name);
        } else if (catCols.length === 1) {
          setRowColumn(catCols[0].name);
        }
      } else if (activeAnalysis === 'acm') {
        setSelectedCats(catCols.slice(0, 4).map(c => c.name));
      } else if (activeAnalysis === 'afd') {
        setSelectedNums(numCols.slice(0, 5).map(c => c.name));
        if (catCols.length > 0) setAfdGroupColumn(catCols[0].name);
      }
    }
    setResult(null);
    setErrorText(null);
  }, [activeAnalysis, columns]);

  // Handle Multi-Select Toggles
  const toggleNumSelect = (col: string) => {
    if (selectedNums.includes(col)) {
      setSelectedNums(selectedNums.filter(n => n !== col));
    } else {
      setSelectedNums([...selectedNums, col]);
    }
  };

  const toggleCatSelect = (col: string) => {
    if (selectedCats.includes(col)) {
      setSelectedCats(selectedCats.filter(n => n !== col));
    } else {
      setSelectedCats([...selectedCats, col]);
    }
  };

  const toggleCahNumSelect = (col: string) => {
    if (cahNums.includes(col)) {
      setCahNums(cahNums.filter(n => n !== col));
    } else {
      setCahNums([...cahNums, col]);
    }
  };

  // Run Calculations
  const handleCalculate = async () => {
    setIsCalculating(true);
    setErrorText(null);
    setResult(null);

    try {
      const api = getApi();
      let params: any = { analysis_type: activeAnalysis };

      if (activeAnalysis === 'acp') {
        if (selectedNums.length < 2) {
          toast.error("Veuillez sélectionner au moins 2 variables quantitatives.");
          setIsCalculating(false);
          return;
        }
        params.columns = selectedNums;
        params.scale_data = scaleData;
      } else if (activeAnalysis === 'afc') {
        if (!rowColumn || !colColumn) {
          toast.error("Veuillez sélectionner une variable en ligne et une en colonne.");
          setIsCalculating(false);
          return;
        }
        if (rowColumn === colColumn) {
          toast.error("La variable ligne et la variable colonne doivent être distinctes.");
          setIsCalculating(false);
          return;
        }
        params.row_column = rowColumn;
        params.col_column = colColumn;
      } else if (activeAnalysis === 'acm') {
        if (selectedCats.length < 2) {
          toast.error("Veuillez sélectionner au moins 2 variables qualitatives.");
          setIsCalculating(false);
          return;
        }
        params.columns = selectedCats;
      } else if (activeAnalysis === 'cah') {
        if (cahNums.length < 2) {
          toast.error("Veuillez sélectionner au moins 2 variables quantitatives.");
          setIsCalculating(false);
          return;
        }
        if (numClusters < 2 || numClusters > 10) {
          toast.error("Le nombre de clusters doit être compris entre 2 et 10.");
          setIsCalculating(false);
          return;
        }
        params.columns = cahNums;
        params.linkage_method = linkageMethod;
        params.num_clusters = numClusters;
      } else if (activeAnalysis === 'afd') {
        if (selectedNums.length < 1) {
          toast.error("Veuillez sélectionner au moins 1 variable quantitative.");
          setIsCalculating(false);
          return;
        }
        if (!afdGroupColumn) {
          toast.error("Veuillez sélectionner une variable de groupe qualitative.");
          setIsCalculating(false);
          return;
        }
        params.columns = selectedNums;
        params.group_column = afdGroupColumn;
      }
      
      params.alpha = useWorkspaceStore.getState().alpha;

      const res = await api.run_multivariate_analysis(params);

      if (res.success) {
        setResult(res);
        toast.success("Analyse multivariée calculée avec succès !");
        
        // Push result to history
        const labelMap: Record<AnalysisType, string> = {
          acp: "Analyse en Composantes Principales (ACP)",
          afc: "Analyse des Correspondances (AFC)",
          acm: "Analyse des Correspondances Multiples (ACM)",
          cah: "Classification Ascendante Hiérarchique (CAH)",
          afd: "Analyse Factorielle Discriminante (AFD)"
        };

        const activeVars = activeAnalysis === 'acp' ? selectedNums 
                            : activeAnalysis === 'afc' ? [rowColumn, colColumn]
                            : activeAnalysis === 'acm' ? selectedCats
                            : activeAnalysis === 'afd' ? [...selectedNums, afdGroupColumn]
                            : cahNums;

        addAnalysisResult({
          id: `multi_${activeAnalysis}_${Date.now()}`,
          title: labelMap[activeAnalysis],
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          type: 'bivariate', // default category mapping
          variables: activeVars,
          metrics: res.eigenvalues || res.profiles || {},
          interpretation: res.interpretation || "",
          chart: res.scree_chart || res.dendrogram_chart,
          group: selectedFolder || undefined
        });
      } else {
        setErrorText(res.error || "Une erreur statistique est survenue.");
        toast.error("Échec des calculs statistiques.");
      }
    } catch (err: any) {
      setErrorText(err.message || "Erreur de connexion avec l'interface d'analyse.");
      toast.error("Erreur critique.");
    } finally {
      setIsCalculating(false);
    }
  };

  // Add Item to Dashboard Helper
  const handleAddToDashboard = (chartType: string, chartData: any, titleSuffix: string) => {
    if (!chartData) return;
    
    // Store in global analysis list so the dashboard can fetch its reference
    const uniqueAnalysisId = `dash_chart_${activeAnalysis}_${Date.now()}`;
    addAnalysisResult({
      id: uniqueAnalysisId,
      title: `${activeAnalysis.toUpperCase()} : ${titleSuffix}`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      type: 'bivariate',
      variables: [],
      metrics: {},
      interpretation: "",
      chart: chartData
    });

    addItem({
      type: 'analysis_chart',
      title: `${activeAnalysis.toUpperCase()} - ${titleSuffix}`,
      analysisId: uniqueAnalysisId
    });

    toast.success("Graphique ajouté au tableau de bord !");
  };

  const handleAddTextToDashboard = () => {
    if (!result || !result.interpretation) return;

    addItem({
      type: 'text',
      title: `Rapport ${activeAnalysis.toUpperCase()}`,
      content: result.interpretation
    });

    toast.success("Rapport d'interprétation ajouté au tableau de bord !");
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden bg-slate-50">
      
      {/* Title Header */}
      <div className="px-8 py-5 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-600 shadow-sm">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 tracking-wider uppercase select-none">Analyses Factorielles & Typologiques</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5 uppercase">ACP • AFC • ACM • CAH • AFD SCIENTIFIQUES</p>
          </div>
        </div>

        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/60 shrink-0">
          {(['acp', 'afc', 'acm', 'cah', 'afd'] as AnalysisType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveAnalysis(type)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                activeAnalysis === type 
                  ? 'bg-slate-900 text-white shadow-sm scale-102 font-extrabold' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4 min-h-0">
        
        {/* Sidebar Parameters Selection Panel */}
        <div className="lg:col-span-1 border-r border-slate-200 bg-white overflow-y-auto p-6 flex flex-col gap-6 select-none">
          <div>
            <span className="text-[10px] font-black tracking-widest text-indigo-600 uppercase flex items-center gap-1.5 mb-2">
              <Settings2 className="w-3.5 h-3.5" /> PARAMÈTRES REQUIS
            </span>
            <p className="text-xs text-slate-450 leading-relaxed font-semibold">
              {activeAnalysis === 'acp' && "Sélectionnez au moins deux variables quantitatives (continues ou discrètes) pour observer la corrélation factorielle."}
              {activeAnalysis === 'afc' && "Choisissez exactement deux variables qualitatives (nominales ou ordinales) distinctes à croiser."}
              {activeAnalysis === 'acm' && "Choisissez deux variables qualitatives (catégorielles) ou plus pour l'analyse multidimensionnelle."}
              {activeAnalysis === 'cah' && "Choisissez au moins deux variables quantitatives pour segmenter vos observations de façon ascendante."}
              {activeAnalysis === 'afd' && "Choisissez une variable de groupe (Y) catégorielle et des variables explicatives quantitatives (X)."}
            </p>
          </div>

          {/* Form Fields according to active analysis type */}
          <div className="flex-1 space-y-5">
            {(activeAnalysis === 'acp' || activeAnalysis === 'afd') && (
              <>
                {activeAnalysis === 'afd' && (
                  <div className="space-y-2 mb-4">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Variable Groupe (Y)</label>
                    <select
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-750 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={afdGroupColumn}
                      onChange={(e) => setAfdGroupColumn(e.target.value)}
                    >
                      <option value="">Sélectionner...</option>
                      {catCols.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Variables Quantitatives (X)</label>
                  <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto p-2 bg-slate-50/50 space-y-1">
                    {numCols.map(c => {
                      const isSelected = selectedNums.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          onClick={() => toggleNumSelect(c.name)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-semibold tracking-wide transition-all ${
                            isSelected 
                              ? 'bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold' 
                              : 'hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] font-black ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white text-transparent'
                          }`}>✔</span>
                          {c.name}
                        </button>
                      );
                    })}
                    {numCols.length === 0 && <div className="text-xs text-slate-400 p-3 italic">Aucun indicateur numérique trouvé.</div>}
                  </div>
                </div>

                {activeAnalysis === 'acp' && (
                  <div className="flex items-center justify-between p-3 bg-slate-50/60 border border-slate-200 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-700">Centrer & Réduire</span>
                      <span className="text-[9px] font-semibold text-slate-400 mt-0.5 uppercase">Normalisation standard</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={scaleData}
                      onChange={(e) => setScaleData(e.target.checked)}
                      className="w-4.5 h-4.5 accent-indigo-600"
                    />
                  </div>
                )}
              </>
            )}

            {activeAnalysis === 'afc' && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Variable en Ligne (Y)</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-750 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={rowColumn}
                    onChange={(e) => setRowColumn(e.target.value)}
                  >
                    <option value="">Sélectionner...</option>
                    {catCols.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Variable en Colonne (X)</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-750 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={colColumn}
                    onChange={(e) => setColColumn(e.target.value)}
                  >
                    <option value="">Sélectionner...</option>
                    {catCols.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {activeAnalysis === 'acm' && (
              <>
                <div className="space-y-2.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Variables Qualitatives</label>
                  <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto p-2 bg-slate-50/50 space-y-1">
                    {catCols.map(c => {
                      const isSelected = selectedCats.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          onClick={() => toggleCatSelect(c.name)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-semibold tracking-wide transition-all ${
                            isSelected 
                              ? 'bg-emerald-50 border border-emerald-155 text-emerald-700 font-bold' 
                              : 'hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] font-black ${
                            isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white text-transparent'
                          }`}>✔</span>
                          {c.name}
                        </button>
                      );
                    })}
                    {catCols.length === 0 && <div className="text-xs text-slate-400 p-3 italic">Aucun indicateur catégoriel trouvé.</div>}
                  </div>
                </div>
              </>
            )}

            {activeAnalysis === 'cah' && (
              <>
                <div className="space-y-2.5">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Variables Métriques (X)</label>
                  <div className="border border-slate-200 rounded-xl max-h-52 overflow-y-auto p-2 bg-slate-50/50 space-y-1">
                    {numCols.map(c => {
                      const isSelected = cahNums.includes(c.name);
                      return (
                        <button
                          key={c.name}
                          onClick={() => toggleCahNumSelect(c.name)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-semibold tracking-wide transition-all ${
                            isSelected 
                              ? 'bg-cyan-50 border border-cyan-155 text-cyan-700 font-bold' 
                              : 'hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] font-black ${
                            isSelected ? 'bg-cyan-600 border-cyan-600 text-white' : 'border-slate-300 bg-white text-transparent'
                          }`}>✔</span>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Méthode d'Agrégation</label>
                  <select
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-750 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={linkageMethod}
                    onChange={(e) => setLinkageMethod(e.target.value)}
                  >
                    <option value="ward">Ward (Inertie Minimale)</option>
                    <option value="complete">Lien Complet</option>
                    <option value="average">Lien Moyen</option>
                    <option value="single">Lien Simple</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Nombre de Classes (k : {numClusters})</label>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={numClusters}
                    onChange={(e) => setNumClusters(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                    <span>2 CLUSTER</span>
                    <span>5</span>
                    <span>8 CLUSTERS</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mb-4">
            <FolderSelector value={selectedFolder} onChange={setSelectedFolder} />
          </div>

          {hasMissingValues && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3 shrink-0 animate-in fade-in duration-200">
              <div className="flex gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-[10px] font-black uppercase text-amber-800 tracking-wider font-sans">Données Manquantes Détectées</h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold font-sans">
                    Les variables <strong className="text-amber-900">{varsWithMissing.join(', ')}</strong> contiennent des valeurs vides. Les analyses factorielles requièrent un tableau complet.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-500/10">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const api = getApi();
                      for (const col of varsWithMissing) {
                        const result = await api.handle_missing_values(col, 'mean');
                        if (!result.success) throw new Error(result.error);
                      }
                      // Fetch full dataset to update store previewData
                      const ds = await api.get_full_dataset();
                      useWorkspaceStore.setState({ previewData: ds.data || previewData });
                      toast.success("Imputation par la moyenne effectuée !");
                    } catch (err: any) {
                      toast.error("Échec : " + err.message);
                    }
                  }}
                  className="bg-white hover:bg-amber-50 text-amber-850 font-bold text-[9px] py-1.5 px-1 rounded-xl border border-amber-200 transition-all text-center cursor-pointer uppercase tracking-tight"
                >
                  Imputer Moyenne
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const api = getApi();
                      for (const col of varsWithMissing) {
                        // checks if quantitative or categorical
                        const isNum = numCols.some(c => c.name === col);
                        const strategy = isNum ? 'median' : 'mode';
                        const result = await api.handle_missing_values(col, strategy);
                        if (!result.success) throw new Error(result.error);
                      }
                      const ds = await api.get_full_dataset();
                      useWorkspaceStore.setState({ previewData: ds.data || previewData });
                      toast.success("Imputation synthétique (médiane/mode) effectuée !");
                    } catch (err: any) {
                      toast.error("Échec : " + err.message);
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[9px] py-1.5 px-1 rounded-xl shadow-xs transition-all text-center cursor-pointer uppercase tracking-tight"
                >
                  Synthétique
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleCalculate}
            disabled={isCalculating || !isReady}
            className="w-full mt-auto bg-slate-900 border border-slate-800 text-white hover:bg-slate-850 p-4.5 rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-sm active:scale-98 transition duration-300 flex items-center justify-center gap-2"
          >
            {isCalculating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                CALCUL SCIENTIFIQUE...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                LANCER L'ANALYSE
              </>
            )}
          </button>
        </div>

        {/* Results Viewer Dashboard Area */}
        <div className="lg:col-span-3 flex flex-col overflow-hidden bg-slate-50">
          
          {/* Sub-tab navigation when result is available */}
          {result && (
            <div className="px-6 py-3 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between select-none">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'charts' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Graphiques Projections
                </button>
                <button
                  onClick={() => setActiveTab('tables')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'tables' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tableaux de Données
                </button>
                <button
                  onClick={() => setActiveTab('interpretation')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'interpretation' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Interprétations Scientifiques
                </button>
                {activeAnalysis === 'cah' && (
                  <button
                    onClick={() => setActiveTab('assignments')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      activeTab === 'assignments' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Assignations Clusters
                  </button>
                )}
              </div>

              {/* Action commands */}
              <div className="flex gap-2">
                {(activeAnalysis === 'acp' || activeAnalysis === 'afd' || activeAnalysis === 'cah' || activeAnalysis === 'acm') && (
                   <button
                     onClick={async () => {
                       try {
                         const dict: Record<string, any[]> = {};
                         if (activeAnalysis === 'acp' && result.individuals) {
                            const p = Math.min(3, result.individuals[0].coords.length); // first 3 components
                            for (let i = 0; i < p; i++) {
                              dict[`ACP_F${i+1}`] = result.individuals.map((ind: any) => ind.coords[i]);
                            }
                         } else if (activeAnalysis === 'acm' && result.individuals) {
                            const p = Math.min(3, result.individuals[0].coords.length); // first 3 components
                            for (let i = 0; i < p; i++) {
                              dict[`ACM_F${i+1}`] = result.individuals.map((ind: any) => ind.coords[i]);
                            }
                         } else if (activeAnalysis === 'afd' && result.lda_coords) {
                            const p = Math.min(2, result.lda_coords[0].coords ? result.lda_coords[0].coords.length : 2);
                            for (let i = 0; i < p; i++) {
                              dict[`AFD_LD${i+1}`] = result.lda_coords.map((row: any) => row.coords ? row.coords[i] : undefined);
                            }
                         } else if (activeAnalysis === 'cah' && result.assignments) {
                            dict['CAH_Cluster'] = result.assignments.map((a: any) => a.cluster);
                         }
                         if (Object.keys(dict).length > 0) {
                            await useWorkspaceStore.getState().appendDataframeColumns(dict);
                            toast.success("Variables ajoutées au jeu de données avec succès !");
                         }
                       } catch (err: any) {
                         toast.error(err.message || "Erreur lors de l'ajout des variables.");
                       }
                     }}
                     className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200/60 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-800 text-[10.5px] font-bold uppercase tracking-wide rounded-lg transition-colors duration-300"
                   >
                     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                     Ajouter variables au jeu
                   </button>
                )}
                <button
                  onClick={handleAddTextToDashboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200/60 hover:bg-slate-50 text-slate-600 hover:text-slate-800 text-[10.5px] font-bold uppercase tracking-wide rounded-lg transition-colors duration-300"
                >
                  <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                  Intégrer le rapport au TDB
                </button>
              </div>
            </div>
          )}

          {/* Core Content Box */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isCalculating ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-indigo-600 animate-spin"></div>
                  <Target className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-700 tracking-wider uppercase mb-1">Convergence Algorithmique</h3>
                <p className="text-xs text-slate-450 max-w-sm leading-relaxed">
                  Calcul matriciel de SVD, diagonalisation de la matrice de covariance et projections affines sur votre CPU local...
                </p>
              </div>
            ) : errorText ? (
              <div className="m-4 p-6 bg-rose-50/50 border border-rose-200 rounded-2xl flex flex-col gap-3 max-w-lg mx-auto mt-20">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span className="font-bold text-sm">Échec du Calcul Analytique</span>
                </div>
                <p className="text-xs text-rose-600 font-semibold font-mono whitespace-pre-wrap">{errorText}</p>
                <div className="text-[10px] text-slate-400 font-bold leading-normal">
                  💡 Suggestions : Vérifiez que les variables choisies ne comportent pas une variance nulle ou uniquement des valeurs manquantes, et que les données contiennent au moins 3 à 5 observations cohérentes.
                </div>
              </div>
            ) : result ? (
              <div className="space-y-6">
                
                {/* Active Tab rendering - Charts Panel */}
                {activeTab === 'charts' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Render different projections based on analysis type */}
                    {activeAnalysis === 'acp' && (
                      <>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[480px]">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Éboulis des valeurs propres</h4>
                            <button
                              onClick={() => handleAddToDashboard('acp_scree', result.scree_chart, 'Éboulis des valeurs propres')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0">
                            <Plot
                              data={result.scree_chart?.data || []}
                              layout={{
                                ...result.scree_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent'
                              }}
                              style={{ width: '100%', height: '100%' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[480px]">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1">
                              Cercle des corrélations <span title="Interprète la proximité des flèches au bord avec les liens F1, F2" className="cursor-help text-slate-450"><HelpCircle className="w-3.5 h-3.5" /></span>
                            </h4>
                            <button
                              onClick={() => handleAddToDashboard('acp_circle', result.circle_chart, 'Cercle des corrélations')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0 flex items-center justify-center">
                            <Plot
                              data={result.circle_chart?.data || []}
                              layout={{
                                ...result.circle_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent'
                              }}
                              style={{ width: '100%', height: '100%', maxWidth: '420px' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[500px]">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Cartographie des Individus (F1 & F2)</h4>
                            <button
                              onClick={() => handleAddToDashboard('acp_ind', result.ind_chart, 'Cartographie des Individus')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0">
                            <Plot
                              data={result.ind_chart?.data || []}
                              layout={{
                                ...result.ind_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent'
                              }}
                              style={{ width: '100%', height: '100%' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {activeAnalysis === 'afc' && (
                      <>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[400px]">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Inertie des axes factoriels (AFC)</h4>
                            <button
                              onClick={() => handleAddToDashboard('afc_scree', result.scree_chart, 'Inertie axes factoriels')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0">
                            <Plot
                              data={result.scree_chart?.data || []}
                              layout={{
                                ...result.scree_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent'
                              }}
                              style={{ width: '100%', height: '100%' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[450px] md:col-span-2">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Projection d'Analyse des Correspondances (Simultanée)</h4>
                            <button
                              onClick={() => handleAddToDashboard('afc_biplot', result.biplot_chart, 'Projection AFC Biplot')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0">
                            <Plot
                              data={result.biplot_chart?.data || []}
                              layout={{
                                ...result.biplot_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent'
                              }}
                              style={{ width: '100%', height: '100%' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {activeAnalysis === 'acm' && (
                      <>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[400px]">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Éboulis de Benzécri (Corrigé ACM)</h4>
                            <button
                              onClick={() => handleAddToDashboard('acm_scree', result.scree_chart, 'Benzécri Corrigé')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0">
                            <Plot
                              data={result.scree_chart?.data || []}
                              layout={{
                                ...result.scree_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent'
                              }}
                              style={{ width: '100%', height: '100%' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[450px] md:col-span-2">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Plan Factoriel des Modalités (Relations Catégorielles)</h4>
                            <button
                              onClick={() => handleAddToDashboard('acm_categories', result.categories_chart, 'Relational map categorielle')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0">
                            <Plot
                              data={result.categories_chart?.data || []}
                              layout={{
                                ...result.categories_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent'
                              }}
                              style={{ width: '100%', height: '100%' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <FactorHeatmap activeAnalysis={activeAnalysis} result={result} />
                        </div>
                      </>
                    )}

                    {activeAnalysis === 'cah' && (
                      <>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[520px] md:col-span-2">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                              Arbre de Classification (Dendrogramme)
                            </h4>
                            <button
                              onClick={() => handleAddToDashboard('cah_dendrogram', result.dendrogram_chart, 'Arbre de Classification')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0">
                            <Plot
                              data={result.dendrogram_chart?.data || []}
                              layout={{
                                ...result.dendrogram_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                xaxis: { ...result.dendrogram_chart?.layout?.xaxis, showticklabels: false }
                              }}
                              style={{ width: '100%', height: '100%' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[480px] md:col-span-2">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Profil Barycentrique des Classes de Regroupement</h4>
                            <button
                              onClick={() => handleAddToDashboard('cah_profile', result.profile_chart, 'Profil Barycentrique')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0">
                            <Plot
                              data={result.profile_chart?.data || []}
                              layout={{
                                ...result.profile_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent'
                              }}
                              style={{ width: '100%', height: '100%' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {activeAnalysis === 'afd' && (
                      <>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col h-[600px] md:col-span-2">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                              Plan Géométrique Discriminant (Espace AFD)
                            </h4>
                            <button
                              onClick={() => handleAddToDashboard('afd_discriminant', result.discriminant_chart, 'Plan Géométrique Discriminant')}
                              className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider bg-indigo-50 px-2 py-1 rounded"
                            >
                              + Ajouter au TDB
                            </button>
                          </div>
                          <div className="flex-1 min-h-0">
                            <Plot
                              data={result.discriminant_chart?.data || []}
                              layout={{
                                ...result.discriminant_chart?.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 40, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent'
                              }}
                              style={{ width: '100%', height: '100%' }}
                              useResizeHandler={true}
                              config={{ responsive: true, displayModeBar: false }}
                            />
                          </div>
                        </div>
                        <div className="md:col-span-2">
                          <FactorHeatmap activeAnalysis={activeAnalysis} result={result} />
                        </div>
                      </>
                    )}

                  </div>
                )}

                {/* Sub Tab - Tables Panel */}
                {activeTab === 'tables' && (
                  <div className="space-y-6">
                    {/* Statistiques Descriptives des variables actives (ACP/CAH) */}
                    {(activeAnalysis === 'acp' || activeAnalysis === 'cah') && result.descriptive_stats && (
                      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-text">
                        <div className="flex items-center gap-2 mb-4">
                          <LayoutGrid className="w-5 h-5 text-indigo-650" />
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Statistiques Descriptives des Variables Actives</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold tracking-wider">
                                <th className="p-3 uppercase">Variable</th>
                                <th className="p-3 text-right">N (valide)</th>
                                <th className="p-3 text-right">Moyenne</th>
                                <th className="p-3 text-right">Écart-Type (S)</th>
                                <th className="p-3 text-right">Minimum</th>
                                <th className="p-3 text-right">Médiane</th>
                                <th className="p-3 text-right">Maximum</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {result.descriptive_stats.map((row: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-semibold text-slate-800 font-sans">{row.variable}</td>
                                  <td className="p-3 text-right">{row.n}</td>
                                  <td className="p-3 text-right">{row.mean?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{row.std?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{row.min?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{row.median?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{row.max?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Statistiques Descriptives des catégories (ACM) */}
                    {activeAnalysis === 'acm' && result.descriptive_stats && (
                      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-text">
                        <div className="flex items-center gap-2 mb-4">
                          <Grid3X3 className="w-5 h-5 text-indigo-650" />
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Distribution des Fréquences des Modalités</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold tracking-wider">
                                <th className="p-3 uppercase">Variable d'Origine</th>
                                <th className="p-3 uppercase">Modalité / Catégorie</th>
                                <th className="p-3 text-right">Fréquence (N)</th>
                                <th className="p-3 text-right">Proportion (%)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {result.descriptive_stats.map((row: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-semibold text-slate-500 font-sans">{row.variable}</td>
                                  <td className="p-3 font-bold text-slate-800 font-sans">{row.category}</td>
                                  <td className="p-3 text-right">{row.count}</td>
                                  <td className="p-3 text-right">{row.percentage?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Table de Contingence (AFC) */}
                    {activeAnalysis === 'afc' && result.contingency_table && (
                      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-text font-sans">
                        <div className="flex items-center gap-2 mb-4">
                          <TableProperties className="w-5 h-5 text-indigo-650" />
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Table de Contingence Croisée (Effectifs Observés)</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse border border-slate-100">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 font-bold tracking-wider">
                                <th className="p-3 uppercase border border-slate-200 bg-slate-100">Ligne \ Colonne</th>
                                {result.contingency_table.cols.map((colName: string, idx: number) => (
                                  <th key={idx} className="p-3 text-right border border-slate-200 uppercase bg-slate-50">{colName}</th>
                                ))}
                                <th className="p-3 text-right font-black border border-slate-200 bg-indigo-50 text-indigo-800">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {result.contingency_table.rows.map((rowName: string, i: number) => (
                                <tr key={i} className="hover:bg-slate-50/30">
                                  <td className="p-3 font-bold text-slate-800 border border-slate-200 bg-slate-50 font-sans">{rowName}</td>
                                  {result.contingency_table.matrix[i].map((val: number, j: number) => (
                                    <td key={j} className="p-3 text-right border border-slate-100">{val}</td>
                                  ))}
                                  <td className="p-3 text-right font-bold text-slate-900 border border-slate-200 bg-indigo-50/50">{result.contingency_table.row_totals[i]}</td>
                                </tr>
                              ))}
                              <tr className="bg-indigo-50/30 font-bold">
                                <td className="p-3 font-black text-indigo-800 border border-slate-200 bg-indigo-50 font-sans">Total</td>
                                {result.contingency_table.col_totals.map((colTotal: number, j: number) => (
                                  <td key={j} className="p-3 text-right border border-slate-200 text-indigo-900">{colTotal}</td>
                                ))}
                                <td className="p-3 text-right font-black text-indigo-950 border border-indigo-200 bg-indigo-100">{result.contingency_table.grand_total}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Table de Confusion (AFD) */}
                    {activeAnalysis === 'afd' && result.confusion_matrix && (
                      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-text font-sans">
                        <div className="flex items-center gap-2 mb-4">
                          <TableProperties className="w-5 h-5 text-indigo-650" />
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Matrice de Confusion (Précision : {(result.accuracy * 100).toFixed(useWorkspaceStore.getState().decimals)}%)</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse border border-slate-100">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-100 text-slate-700 font-bold tracking-wider">
                                <th className="p-3 uppercase border border-slate-200 bg-slate-100">Vrai \ Prédit</th>
                                {result.classes.map((cls: string, idx: number) => (
                                  <th key={idx} className="p-3 text-right border border-slate-200 uppercase bg-slate-50">{cls}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {result.classes.map((rowName: string, i: number) => (
                                <tr key={i} className="hover:bg-slate-50/30">
                                  <td className="p-3 font-bold text-slate-800 border border-slate-200 bg-slate-50 font-sans">{rowName}</td>
                                  {result.classes.map((colName: string, j: number) => (
                                    <td key={j} className={`p-3 text-right border border-slate-100 ${i === j ? 'bg-emerald-50 text-emerald-700 font-bold' : ''}`}>
                                      {result.confusion_matrix[colName]?.[rowName] || 0}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Common Eigenvalues table */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-text">
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-indigo-650" />
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Éboulis et Part d'Inertie Répartition</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold tracking-wider">
                              <th className="p-3 uppercase">Dimensions</th>
                              {activeAnalysis === 'acm' ? (
                                <>
                                  <th className="p-3 text-right">Val. Propre brute</th>
                                  <th className="p-3 text-right">Inertie ajustée (%)</th>
                                  <th className="p-3 text-right">Inertie cumulée (%)</th>
                                </>
                              ) : (
                                <>
                                  <th className="p-3 text-right">Valeur Propre</th>
                                  <th className="p-3 text-right">Intertie (%)</th>
                                  <th className="p-3 text-right">Cumulative (%)</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {result.eigenvalues?.map((row: any, i: number) => (
                              <tr key={i} className="hover:bg-slate-50/50">
                                <td className="p-3 font-semibold text-slate-800 font-sans">{row.axis}</td>
                                {activeAnalysis === 'acm' ? (
                                  <>
                                    <td className="p-3 text-right">{row.raw_eigenvalue?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                    <td className="p-3 text-right">{row.adj_inertia?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                    <td className="p-3 text-right">{row.cum_adj_inertia?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="p-3 text-right">{row.eigenvalue?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                    <td className="p-3 text-right">{row.inertia?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                    <td className="p-3 text-right">{row.cum_inertia?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Coordinates details for structures */}
                    {activeAnalysis === 'acp' && result.variables && (
                      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-text">
                        <div className="flex items-center gap-2 mb-4">
                          <Compass className="w-5 h-5 text-indigo-605" />
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Coordonnées & Cosinus Carrés des Variables initiales</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold tracking-wider">
                                <th className="p-3 uppercase">Variable</th>
                                <th className="p-3 text-right">Coord. F1</th>
                                <th className="p-3 text-right">Cos² F1</th>
                                <th className="p-3 text-right">Contrib. F1 %</th>
                                <th className="p-3 text-right">Coord. F2</th>
                                <th className="p-3 text-right">Cos² F2</th>
                                <th className="p-3 text-right">Contrib. F2 %</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {result.variables.map((v: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-semibold text-slate-800 font-sans">{v.name}</td>
                                  <td className="p-3 text-right">{v.coords[0]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right font-bold text-slate-700">{v.cos2[0]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{v.ctr[0]?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                  <td className="p-3 text-right">{v.coords[1]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right font-bold text-slate-700">{v.cos2[1]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{v.ctr[1]?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {activeAnalysis === 'afc' && (
                      <>
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm select-text">
                          <div className="flex items-center gap-2 mb-4">
                            <TableProperties className="w-5 h-5 text-indigo-650" />
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Profils des Lignes de Facteur</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse">
                              <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold tracking-wider">
                                  <th className="p-3 uppercase">Modalité Ligne</th>
                                  <th className="p-3 text-right">Coord. F1</th>
                                  <th className="p-3 text-right">Contrib. F1 %</th>
                                  <th className="p-3 text-right">Cos² F1</th>
                                  <th className="p-3 text-right">Coord. F2</th>
                                  <th className="p-3 text-right">Contrib. F2 %</th>
                                  <th className="p-3 text-right">Cos² F2</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono">
                                {result.rows?.map((row: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50/50">
                                    <td className="p-3 font-semibold text-slate-800 font-sans">{row.label}</td>
                                    <td className="p-3 text-right">{row.coords[0]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                    <td className="p-3 text-right">{row.ctr[0]?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                    <td className="p-3 text-right font-bold">{row.cos2[0]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                    <td className="p-3 text-right">{row.coords[1]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                    <td className="p-3 text-right">{row.ctr[1]?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                    <td className="p-3 text-right font-bold">{row.cos2[1]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm select-text">
                          <div className="flex items-center gap-2 mb-4">
                            <TableProperties className="w-5 h-5 text-indigo-650" />
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Profils des Colonnes de Facteur</h4>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse">
                              <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold tracking-wider">
                                  <th className="p-3 uppercase">Modalité Colonne</th>
                                  <th className="p-3 text-right">Coord. F1</th>
                                  <th className="p-3 text-right">Contrib. F1 %</th>
                                  <th className="p-3 text-right">Cos² F1</th>
                                  <th className="p-3 text-right">Coord. F2</th>
                                  <th className="p-3 text-right">Contrib. F2 %</th>
                                  <th className="p-3 text-right">Cos² F2</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-mono">
                                {result.columns?.map((col: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50/50">
                                    <td className="p-3 font-semibold text-slate-800 font-sans">{col.label}</td>
                                    <td className="p-3 text-right">{col.coords[0]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                    <td className="p-3 text-right">{col.ctr[0]?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                    <td className="p-3 text-right font-bold">{col.cos2[0]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                    <td className="p-3 text-right">{col.coords[1]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                    <td className="p-3 text-right">{col.ctr[1]?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                    <td className="p-3 text-right font-bold">{col.cos2[1]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}

                    {activeAnalysis === 'acm' && (
                      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-text">
                        <div className="flex items-center gap-2 mb-4">
                          <Grid3X3 className="w-5 h-5 text-indigo-650" />
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Relations Spatiales des Modalités</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold tracking-wider">
                                <th className="p-3 uppercase">Variable d'Origine</th>
                                <th className="p-3 uppercase">Modalité</th>
                                <th className="p-3 text-right">Coord. F1</th>
                                <th className="p-3 text-right">Cos² F1</th>
                                <th className="p-3 text-right">Contrib. F1 %</th>
                                <th className="p-3 text-right">Coord. F2</th>
                                <th className="p-3 text-right">Cos² F2</th>
                                <th className="p-3 text-right">Contrib. F2 %</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {result.categories?.map((cat: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-semibold text-slate-450 font-sans">{cat.variable}</td>
                                  <td className="p-3 font-bold text-slate-800 font-sans">{cat.category}</td>
                                  <td className="p-3 text-right">{cat.coords[0]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{cat.cos2[0]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{cat.ctr[0]?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                  <td className="p-3 text-right">{cat.coords[1]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{cat.cos2[1]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  <td className="p-3 text-right">{cat.ctr[1]?.toFixed(useWorkspaceStore.getState().decimals)} %</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {activeAnalysis === 'cah' && (
                      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-text">
                        <div className="flex items-center gap-2 mb-4">
                          <LayoutGrid className="w-5 h-5 text-indigo-650" />
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Description Métrique Barycentrique des Classes</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold tracking-wider">
                                <th className="p-3 uppercase">Variable active</th>
                                <th className="p-3 text-right">Moyenne Globale</th>
                                {result.profiles?.map((prof: any) => (
                                  <th key={prof.cluster} className="p-3 text-right">Moyenne Classe {prof.cluster}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono">
                              {Object.keys(result.global_means || {}).map((key: string, i: number) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                  <td className="p-3 font-semibold text-slate-800 font-sans">{key}</td>
                                  <td className="p-3 text-right text-slate-500 font-bold">{result.global_means[key]?.toFixed(useWorkspaceStore.getState().decimals)}</td>
                                  {result.profiles?.map((prof: any) => (
                                    <td key={prof.cluster} className="p-3 text-right font-extrabold text-indigo-600">
                                      {prof.means[key]?.toFixed(useWorkspaceStore.getState().decimals)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Sub Tab - Interpretation (Markdown with color code styles) */}
                {activeTab === 'interpretation' && (
                  <div className="space-y-6 select-text leading-relaxed text-sm">
                    <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-md relative overflow-hidden">
                      {/* Stylized visual indicators */}
                      <div className="absolute top-0 left-0 w-2.5 h-full bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-700" />
                      
                      <div className="markdown-body select-text">
                        <ReactMarkdown>
                          {result.interpretation}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub Tab - CAH Assigned observation table */}
                {activeTab === 'assignments' && activeAnalysis === 'cah' && (
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-text">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-650" />
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Classification des observations (Assignations)</h4>
                      </div>
                      <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2 py-1 rounded">
                        Total : {result.assignments?.length} observations classées
                      </span>
                    </div>

                    <div className="max-h-96 overflow-y-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-left text-xs font-medium text-slate-600 border-collapse">
                        <thead className="sticky top-0 bg-slate-50 shadow-sm">
                          <tr className="border-b border-slate-100 text-slate-400 font-bold tracking-wider">
                            <th className="p-3 uppercase">Index Observation</th>
                            <th className="p-3 text-right uppercase">Classe / Cluster Assignée</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {result.assignments?.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="p-3 text-slate-800 font-sans font-semibold">Ligne {item.row_id}</td>
                              <td className="p-3 text-right font-black text-indigo-600">
                                <span className="inline-block px-2.5 py-1 text-[10px] rounded-full bg-indigo-50 text-indigo-700">Cluster {item.cluster}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 select-none">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center mb-6 text-indigo-500 shadow-inner">
                  <Compass className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-700 tracking-wider uppercase mb-1">En attente d'Analyse</h3>
                <p className="text-xs text-slate-450 max-w-sm leading-relaxed">
                  Sélectionnez vos indicateurs ou variables actives de calcul puis cliquez sur le bouton <strong className="text-slate-500 font-bold">LANCER L'ANALYSE</strong> pour exécuter la diagonalisation factorielle.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
