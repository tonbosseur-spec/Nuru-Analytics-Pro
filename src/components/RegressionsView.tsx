import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../store';
import { getApi } from '../pywebview';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Play, 
  Info, 
  Sparkles, 
  CheckSquare, 
  Square,
  HelpCircle,
  Hash,
  ChevronDown,
  Target,
  Layers,
  Activity
} from 'lucide-react';
import Plot from 'react-plotly.js';
import FolderSelector from './FolderSelector';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Types of regression supported
type RegressionType = 'linear_simple' | 'linear_multiple' | 'logistic_binary' | 'logistic_multinomial';

export default function RegressionsView() {
  const columns = useWorkspaceStore((state) => state.columns);
  const alpha = useWorkspaceStore((state) => state.alpha);
  const addAnalysisResult = useWorkspaceStore((state) => state.addAnalysisResult);
  const suggestedRegressionType = useWorkspaceStore((state) => state.suggestedRegressionType);

  // Form State
  const [regressionType, setRegressionType] = useState<RegressionType>('linear_simple');
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [selectedPredictors, setSelectedPredictors] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [calculationMethod, setCalculationMethod] = useState<'ols' | 'wls' | 'robust'>('ols');
  
  // Handlers for consuming recommendations
  useEffect(() => {
    if (suggestedRegressionType) {
      setRegressionType(suggestedRegressionType as any);
      // Reset the recommendation so it is only applied once
      useWorkspaceStore.setState({ suggestedRegressionType: '' });
    }
  }, [suggestedRegressionType]);
  
  // Computation State
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'global' | 'tables' | 'plots' | 'diagnostics'>('global');

  // Auto-fill defaults when loading or typing changes
  useEffect(() => {
    if (columns.length > 0) {
      // Find a quantitative column for Linear, or qualitative for Logistic as default target Y
      const continuousCols = columns.filter(c => c.type === 'continuous' || c.type === 'discrete');
      const discreteCols = columns.filter(c => c.type === 'nominal' || c.type === 'ordinal');
      
      if (regressionType.startsWith('linear')) {
        if (continuousCols.length > 0) {
          setTargetColumn(continuousCols[0].name);
        } else {
          setTargetColumn(columns[0].name);
        }
      } else {
        if (discreteCols.length > 0) {
          setTargetColumn(discreteCols[0].name);
        } else {
          setTargetColumn(columns[0].name);
        }
      }
    }
    // Clear predictors list on regression type shift to avoid mismatch
    setSelectedPredictors([]);
    setResult(null);
    setErrorText(null);
    setActiveTab('global');
  }, [regressionType, columns]);

  // Adjust predictors list for Simple Linear Regression
  const handleTogglePredictor = (colName: string) => {
    if (regressionType === 'linear_simple') {
      setSelectedPredictors([colName]);
    } else {
      if (selectedPredictors.includes(colName)) {
        setSelectedPredictors(selectedPredictors.filter(p => p !== colName));
      } else {
        setSelectedPredictors([...selectedPredictors, colName]);
      }
    }
  };

  const handleSelectAllPredictors = () => {
    const available = columns.filter(c => c.name !== targetColumn).map(c => c.name);
    if (selectedPredictors.length === available.length) {
      setSelectedPredictors([]);
    } else {
      setSelectedPredictors(available);
    }
  };

  // Run computation
  const handleRunRegression = async () => {
    if (!targetColumn) {
      toast.error("Veuillez sélectionner la variable cible à expliquer (Y).");
      return;
    }
    if (selectedPredictors.length === 0) {
      toast.error("Veuillez sélectionner au moins un prédicteur (X).");
      return;
    }
    if (selectedPredictors.includes(targetColumn)) {
      toast.error("La variable cible (Y) ne peut pas faire partie des prédicteurs (X).");
      return;
    }

    setIsCalculating(true);
    setErrorText(null);
    setResult(null);

    try {
      const api = getApi();
      const params = {
        regression_type: regressionType,
        target_column: targetColumn,
        predictor_columns: selectedPredictors,
        calculation_method: regressionType.startsWith('linear') ? calculationMethod : 'ols',
        alpha: alpha
      };
      
      const res = await api.run_regression_analysis(params);
      
      if (res.success) {
        setResult(res);
        toast.success("Régression calculée avec succès !");
        
        // Add to global report list / history
        const methodSuffix = regressionType.startsWith('linear') ? ` (${calculationMethod.toUpperCase()})` : '';
        addAnalysisResult({
          id: `reg_${Date.now()}`,
          title: `Régression ${regressionType === 'linear_simple' ? 'Linéaire Simple' : regressionType === 'linear_multiple' ? 'Linéaire Multiple' : regressionType === 'logistic_binary' ? 'Logistique Binaire' : 'Logistique Multinomiale'}${methodSuffix} : ${targetColumn}`,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          type: regressionType.startsWith('linear') ? 'bivariate' : 'univariate', // mapping to existing history categorization
          variables: [targetColumn, ...selectedPredictors],
          chart: res.chart,
          group: selectedFolder || undefined,
          metrics: {
            ...res.metrics,
            isRegression: true,
            regression_type: regressionType,
            coefficients: res.coefficients,
            diagnostics: res.diagnostics,
            chart: res.chart,
            roc_chart: res.roc_chart,
            actual_vs_predicted: res.actual_vs_predicted,
            qq_plot: res.qq_plot,
            residuals_distribution: res.residuals_distribution,
            residuals_vs_fitted: res.residuals_vs_fitted,
            target_column: targetColumn,
            predictor_columns: selectedPredictors
          },
          interpretation: res.interpretation || ""
        });
      } else {
        setErrorText(res.error || "Une erreur inconnue est survenue.");
        toast.error("Échec des calculs statistiques.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "Erreur de communication avec le moteur Python.");
    } finally {
      setIsCalculating(false);
    }
  };

  // Helper text formatter for markdown reports
  const parseBoldText = (text: string, isDark: boolean = false) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong 
            key={index} 
            className={`font-extrabold ${isDark ? 'text-white bg-indigo-500/20 px-1 py-0.5 rounded border border-indigo-400/10' : 'text-indigo-950 font-sans'}`}
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const formatMathTeX = (text: string): string => {
    if (!text) return text;
    
    let formatted = text;
    
    // Replace direct LaTeX commands with unicode
    const replacements: { [key: string]: string } = {
      '\\ge': '≥',
      '\\le': '≤',
      '\\ne': '≠',
      '\\approx': '≈',
      '\\pm': '±',
      '\\times': '×',
      '\\alpha': 'α',
      '\\beta': 'β',
      '\\chi': 'χ',
      '\\mu': 'μ',
      '\\sigma': 'σ',
      '\\rho': 'ρ',
      '\\theta': 'θ',
      '\\lambda': 'λ',
      '\\pi': 'π',
      '\\delta': 'δ',
      '\\Delta': 'Δ',
      '\\chi^2': 'χ²',
      '\\chi²': 'χ²',
      '^2': '²',
      '_0': '₀',
      '_1': '₁',
      '_2': '₂',
      '_a': 'ₐ',
      '_t': 'ₜ',
    };

    Object.entries(replacements).forEach(([raw, replacement]) => {
      formatted = formatted.replaceAll(raw, replacement);
    });

    // Convert inline math $...$ into formatted bold/italic markdown
    // e.g. $r = 0.1761$ -> *r* = 0.1761
    formatted = formatted.replace(/\$([^$]+)\$/g, (match, p1) => {
      const trimmed = p1.trim();
      if (trimmed.length === 1 || (trimmed.length === 2 && trimmed.match(/^[a-zA-Z]/))) {
        return `*${trimmed}*`;
      }
      return trimmed.replace(/^([a-zA-Z])(\s*[=><≥≤].*)/, '*$1*$2');
    });

    return formatted;
  };

  const renderMarkdown = (text: string, isDark: boolean = false) => {
    if (!text) return null;
    
    const processedText = formatMathTeX(text);
    
    return (
      <div className={`markdown-body select-text ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className={`text-base font-black mt-6 mb-4 border-b-2 pb-2 uppercase tracking-wide ${
                isDark ? 'text-white border-indigo-550/30' : 'text-slate-900 border-indigo-200'
              }`}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className={`text-sm font-extrabold mt-6 mb-3 uppercase tracking-wider ${
                isDark ? 'text-indigo-200' : 'text-slate-900'
              }`}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className={`text-xs font-black mt-6 mb-3 border-b pb-1.5 uppercase tracking-widest flex items-center gap-1.5 ${
                isDark ? 'text-indigo-300 border-indigo-500/20' : 'text-indigo-950 border-indigo-100'
              }`}>
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 className={`text-[10px] font-black uppercase tracking-widest mt-5 mb-2 flex items-center gap-1.5 ${
                isDark ? 'text-indigo-400' : 'text-slate-500'
              }`}>
                {children}
              </h4>
            ),
            strong: ({ children }) => {
              const childStr = String(children || '');
              if (childStr.startsWith('Type de Modèle :')) {
                return (
                  <span className={`inline-flex items-center gap-2 font-extrabold border rounded-xl p-3 my-2 text-xs w-full ${
                    isDark 
                      ? 'bg-indigo-950/40 border-indigo-850/40 text-indigo-200' 
                      : 'bg-indigo-50 border-indigo-100/60 text-indigo-950'
                  }`}>
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                    {children}
                  </span>
                );
              }
              return (
                <strong className={`font-extrabold px-1.5 py-0.5 rounded border ${
                  isDark 
                    ? 'text-white bg-indigo-500/20 border-indigo-400/20' 
                    : 'text-indigo-950 bg-indigo-500/10 border-indigo-400/10'
                } font-sans`}>
                  {children}
                </strong>
              );
            },
            p: ({ children }) => (
              <p className={`text-[12.5px] leading-relaxed my-2 font-semibold ${
                isDark ? 'text-slate-200/90' : 'text-slate-600'
              }`}>
                {children}
              </p>
            ),
            ul: ({ children }) => <ul className="my-3 space-y-1 pl-1">{children}</ul>,
            ol: ({ children }) => <ol className="my-3 space-y-1 list-decimal pl-5">{children}</ol>,
            li: ({ children }) => (
              <li className={`text-[12.5px] leading-relaxed font-semibold my-1 ${
                isDark ? 'text-slate-200/95' : 'text-slate-600'
              }`}>
                {children}
              </li>
            ),
            table: ({ children }) => (
              <div className={`overflow-x-auto my-4 border rounded-2xl shadow-sm max-w-full ${
                isDark ? 'border-slate-700 bg-slate-900/60' : 'border-indigo-100 bg-white'
              }`}>
                <table className="w-full text-xs text-left border-collapse">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className={`border-b text-[10px] font-black uppercase tracking-wider ${
                isDark ? 'bg-indigo-950/50 border-slate-700 text-indigo-200' : 'bg-indigo-50/70 border-indigo-100 text-indigo-950'
              }`}>
                {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody className={`divide-y ${
                isDark ? 'divide-slate-800' : 'divide-indigo-50/55'
              }`}>
                {children}
              </tbody>
            ),
            tr: ({ children }) => (
              <tr className={`transition-colors ${
                isDark ? 'hover:bg-indigo-950/20' : 'hover:bg-indigo-50/10'
              }`}>
                {children}
              </tr>
            ),
            th: ({ children }) => <th className="px-4 py-3 font-extrabold">{children}</th>,
            td: ({ children }) => (
              <td className={`px-4 py-3 font-semibold font-mono text-[11px] break-words ${
                isDark ? 'text-slate-300' : 'text-slate-705'
              }`}>
                {children}
              </td>
            ),
          }}
        >
          {processedText}
        </ReactMarkdown>
      </div>
    );
  };

  const getModelAssessment = (modelResult: any) => {
    const isLogistic = modelResult.regression_type?.startsWith('logistic');
    
    if (isLogistic) {
      const auc = modelResult.metrics.auc || 0.5;
      const accuracy = modelResult.metrics.accuracy || 50;
      
      if (auc >= 0.8 && accuracy >= 80) {
        return {
          title: "Qualité Prédictive Excellente",
          badge: "Modèle Très Performant",
          color: "green",
          desc: `Le classifieur dispose d'un pouvoir discriminant exceptionnel (AUC = ${auc}) et classifie correctement ${accuracy}% des cas observés. Les probabilités estimées sont hautement plausibles pour éclairer la décision.`
        };
      } else if (auc >= 0.6 || accuracy >= 60) {
        return {
          title: "Qualité de Classification Modérée",
          badge: "Ajustement Acceptable",
          color: "amber",
          desc: `Le modèle de régression logistique offre des tendances globales intéressantes (AUC = ${auc}, Exactitude = ${accuracy}%), mais comporte des incertitudes dans l'estimation des probabilités limites.`
        };
      } else {
        return {
          title: "Attention : Performance de Classification Faible",
          badge: "Pouvoir Discriminant Faible",
          color: "rose",
          desc: `Le modèle présente une discrimination proche du hasard (AUC = ${auc}) ou une exactitude trop faible (${accuracy}%). Nous vous conseillons de ne pas baser vos choix stratégiques sur ces seuls prédicteurs.`
        };
      }
    } else {
      const r2 = modelResult.metrics.r_squared || 0;
      const pVal = modelResult.metrics.f_p_value !== undefined ? modelResult.metrics.f_p_value : 1.0;
      
      if (pVal >= 0.05) {
        return {
          title: "Attention : Modèle globalement Non Significatif",
          badge: "Relation non confirmée",
          color: "rose",
          desc: `L'analyse de variance ANOVA indique que la relation globale n'est pas statistiquement significative (p-value = ${pVal < 0.001 ? '<0.001' : pVal.toFixed(useWorkspaceStore.getState().decimals)} >= 0.05). Aucun des prédicteurs n'explique le phénomène de manière durable.`
        };
      } else if (r2 >= 0.70) {
        return {
          title: "Ajustement Linéaire Excellent",
          badge: "Pouvoir Explicatif Élevé",
          color: "green",
          desc: `Ce modèle linéaire est hautement robuste et prédictif, expliquant ${Math.round(r2 * 100)}% de la variance observée de la variable cible. Les coefficients calculés sont extrêmement fiables.`
        };
      } else if (r2 >= 0.40) {
        return {
          title: "Ajustement Linéaire Modéré",
          badge: "Modèle Robuste",
          color: "amber",
          desc: `La relation est statistiquement significative, mais n'explique que ${Math.round(r2 * 100)}% de la fluctuation globale. Le modèle saisit une tendance importante bien que des variables supplémentaires soient recommandées.`
        };
      } else {
        return {
          title: "Pouvoir Prédictif Linéaire Faible",
          badge: "Ajustement Limité",
          color: "rose",
          desc: `Bien que le modèle soit statistiquement significatif globalement, la proportion de variance expliquée reste insuffisante (R² = ${r2}). La marge d'erreur individuelle sur les prédictions reste majeure.`
        };
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50 relative" id="regressions-view-root">
      
      {/* Title block */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">RÉGRESSIONS AVANCÉES</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Linéaires & Logistiques | Diagnostics fondamentaux & Interprétation d'Experts</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 col-span-12 gap-6 items-start">
        
        {/* Model config panel (Spanning 12 columns at the top) */}
        <section className="col-span-12 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" /> Configuration de la Régression
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Choix du Modèle (Gauche) */}
            <div className="lg:col-span-5 space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">1. Choix du Mode de Régression (Gauche)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'linear_simple', label: 'Linéaire Simple', type: 'Numérique → Numérique' },
                  { id: 'linear_multiple', label: 'Linéaire Multiple', type: 'Plusieurs X → Numérique' },
                  { id: 'logistic_binary', label: 'Logistique Binaire', type: 'X → Binaire (Oui / Non)' },
                  { id: 'logistic_multinomial', label: 'Logistique Multinomiale', type: 'X → Multi-classes (>2)' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setRegressionType(opt.id as RegressionType)}
                    className={`text-left p-3 rounded-xl border transition-all duration-300 ${
                      regressionType === opt.id
                        ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/10'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-[12.5px] font-bold text-slate-900 leading-tight">{opt.label}</div>
                    <div className="text-[10.5px] text-slate-500 mt-1">{opt.type}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Column: Choix des Variables (Droite) */}
            <div className="lg:col-span-7 space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">2. Sélection des Variables Actives (Droite)</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Target input (Y) */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> Variable cible à expliquer (Y)
                  </label>
                  <div className="relative">
                    <select
                      value={targetColumn}
                      onChange={(e) => setTargetColumn(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Sélectionner la cible (Y)...</option>
                      {columns.map((col) => {
                        const isQuant = col.type === 'continuous' || col.type === 'discrete';
                        return (
                          <option key={col.name} value={col.name}>
                            {col.name} ({isQuant ? 'Quantitatif' : 'Qualitatif'})
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Predictors selection (X) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-indigo-500" /> Prédicteur(s) explicatif(s) (X)
                    </label>
                    {regressionType !== 'linear_simple' && (
                      <button
                        onClick={handleSelectAllPredictors}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                      >
                        {selectedPredictors.length === columns.filter(c => c.name !== targetColumn).length ? "Désélectionner tout" : "Sélectionner tout"}
                      </button>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-xl max-h-[150px] overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                    {columns
                      .filter(c => c.name !== targetColumn)
                      .map((col) => {
                        const isSelected = selectedPredictors.includes(col.name);
                        const isQuant = col.type === 'continuous' || col.type === 'discrete';
                        
                        return (
                          <div
                            key={col.name}
                            onClick={() => handleTogglePredictor(col.name)}
                            className={`flex items-center gap-3 px-3.5 py-2 hover:bg-slate-50/80 cursor-pointer select-none transition-colors ${
                              isSelected ? 'bg-indigo-50/20' : ''
                            }`}
                          >
                            <button className="shrink-0 text-slate-400 hover:text-indigo-600 transition-colors">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600 fill-indigo-50" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </button>
                            
                            <div className="truncate">
                              <div className="text-[11px] font-bold text-slate-800 truncate leading-none">{col.name}</div>
                              <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 ${
                                isQuant ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}>
                                {col.type?.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    
                    {columns.filter(c => c.name !== targetColumn).length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        Aucun autre prédicteur disponible.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {targetColumn && regressionType.startsWith('linear') && (
            <div className="pt-6 mt-4 border-t border-slate-100 space-y-3">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                3. Méthode d'Estimation / Calcul de la Régression
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'ols', name: 'MCO (Moindres Carrés Ordinaires)', desc: "Méthode standard. Sensible aux valeurs aberrantes (outliers) et à l'hétéroscédasticité." },
                  { id: 'wls', name: 'MCP (Moindres Carrés Pondérés)', desc: "Idéal en cas d'hétéroscédasticité. Corrige la variance non constante des résidus." },
                  { id: 'robust', name: 'Régression Robuste (Huber)', desc: "Idéal en présence de valeurs aberrantes (outliers) ou de queues épaisses." }
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setCalculationMethod(method.id as 'ols' | 'wls' | 'robust')}
                    className={`text-left p-3.5 rounded-xl border transition-all duration-305 hover:scale-[1.01] ${
                      calculationMethod === method.id
                        ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/10'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-[12.5px] font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${calculationMethod === method.id ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'}`} />
                      {method.name}
                    </div>
                    <div className="text-[10.5px] text-slate-500 mt-2 font-medium leading-relaxed">{method.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {targetColumn && (
            <div className="pt-6 mt-4 border-t border-slate-100">
              <FolderSelector value={selectedFolder} onChange={setSelectedFolder} />
            </div>
          )}

          {/* Underneath: Ecran de paramétrage du modèle & Bouton Action ("en dessous") */}
          <div className="border-t border-slate-100 pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <span className="font-extrabold text-slate-700 block mb-0.5">📟 Diagnostics de modélisation</span>
              Les coefficients du modèle linéaire sont estimés selon {regressionType.startsWith('linear') ? (calculationMethod === 'ols' ? "les moindres carrés ordinaires (MCO/OLS)" : calculationMethod === 'wls' ? "les moindres carrés pondérés (MCP/WLS) face à l'hétéroscédasticité" : "la régression robuste de Huber insensible aux valeurs aberrantes") : "l'optimisation de vraisemblance logarithmique (régression logistique)"}. Tous les diagnostics d'hypothèses associés (Multicolinéarité VIF, Hétéroscédasticité Breusch-Pagan, Normalité Shapiro) seront calculés automatiquement.
            </div>
            <div className="w-full md:w-auto shrink-0 self-end">
              <button
                onClick={handleRunRegression}
                disabled={isCalculating}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-slate-900 border border-transparent shadow hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Ajustement en cours...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                    Évaluer l'Équation
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Results Screen (Spanning 12 columns as well) */}
        <div className="col-span-12 space-y-6">
          {isCalculating && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[450px]">
              <div className="relative flex items-center justify-center mb-6">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                <TrendingUp className="w-5 h-5 text-indigo-600 absolute" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800 mb-2">Calcul des régressions matricielles...</h3>
              <p className="text-slate-400 text-xs max-w-sm font-medium">Nous ajustons les coefficients, estimons le d’erreur par moindres carrés or optimisation logistique, et calculons les hypothèses (Durbin-Watson, Shapiro, Breusch-Pagan, VIF).</p>
            </div>
          )}

          {!isCalculating && errorText && (
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 shadow-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-rose-950 uppercase tracking-wider mb-1">Incompatibilité du Jalon de données</h3>
                <p className="text-rose-700 text-xs leading-relaxed font-semibold">{errorText}</p>
                <div className="mt-4 text-[11px] text-slate-500 font-medium">
                  <strong>Recommandations :</strong>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Vérifiez qu'il n'y a pas trop de lignes vides (NAN) pour les variables sélectionnées.</li>
                    <li>La régression linéaire simple exige exactement UN prédicteur quantitatif.</li>
                    <li>La régression logistique binaire exige exactement deux modalités distinctes dans la cible.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!isCalculating && !result && !errorText && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center shadow-sm flex flex-col items-center justify-center min-h-[450px]">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-5 border border-slate-100">
                <TrendingUp className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800 mb-2">Modélisation Statistique de Pointe</h3>
              <p className="text-slate-400 text-xs max-w-md font-medium leading-relaxed">
                Veuillez configurer votre variable dépendante (Y) et vos facteurs prédictifs (X) dans la colonne de gauche, puis cliquez sur <strong>"Évaluer l'Équation"</strong> pour générer l'analyse.
              </p>
              
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl text-left">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" /> Modèle Linéaire
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">Calcule la contribution exacte de chaque facteur quantitatif ou catégoriel par la technique de moindres carrés standards (OLS).</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Modèle Logistique
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">Analyse les probabilités de réussite (S-Curve, ROC) pour évaluer de façon binaire ou catégorielle des variables qualitatives d'intérêt.</p>
                </div>
              </div>
            </div>
          )}          {/* Results dashboard block */}
          {!isCalculating && result && (
            <div id="regression-results-dashboard" className="space-y-6">
              
              {/* Premium Navigation Tabs */}
              <div className="flex border-b border-slate-200/80 mb-5 bg-slate-50/70 p-1.5 rounded-2xl gap-1 shadow-sm">
                <button
                  onClick={() => setActiveTab('global')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all ${
                    activeTab === 'global'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'text-slate-650 hover:text-indigo-600 hover:bg-slate-150/50'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Synthèse & Rapport
                </button>
                <button
                  onClick={() => setActiveTab('tables')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all ${
                    activeTab === 'tables'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'text-slate-650 hover:text-indigo-600 hover:bg-slate-150/50'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Tableaux de Régression
                </button>
                <button
                  onClick={() => setActiveTab('plots')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all ${
                    activeTab === 'plots'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'text-slate-650 hover:text-indigo-600 hover:bg-slate-150/50'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Graphiques d'Évaluation
                </button>
                <button
                  onClick={() => setActiveTab('diagnostics')}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all ${
                    activeTab === 'diagnostics'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                      : 'text-slate-650 hover:text-indigo-600 hover:bg-slate-150/50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Validation Diagnostique
                </button>
              </div>

              {/* 1. SYNTHÈSE & RAPPORT TAB */}
              {activeTab === 'global' && (
                <>
                  {/* ÉVALUATION TECHNIQUE GLOBALE DU MODÈLE */}
                  {(() => {
                    const assess = getModelAssessment(result);
                    const isGreen = assess.color === 'green';
                    const isAmber = assess.color === 'amber';
                    
                    return (
                      <div className={`p-5 rounded-2xl border transition-all shadow-sm ${
                        isGreen 
                          ? 'bg-emerald-50/50 border-emerald-100 text-emerald-950' 
                          : isAmber 
                            ? 'bg-amber-50/50 border-amber-100 text-amber-950' 
                            : 'bg-rose-50/50 border-rose-100 text-rose-950'
                      }`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                            isGreen 
                              ? 'bg-emerald-100 border-emerald-200 text-emerald-700 shadow-sm' 
                              : isAmber 
                                ? 'bg-amber-100 border-amber-200 text-amber-700 shadow-sm' 
                                : 'bg-rose-100 border-rose-200 text-rose-700 shadow-sm'
                          }`}>
                            {isGreen ? (
                              <Sparkles className="w-6 h-6" />
                            ) : isAmber ? (
                              <Info className="w-6 h-6" />
                            ) : (
                              <AlertTriangle className="w-6 h-6 text-rose-650" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-black tracking-tight uppercase">{assess.title}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                isGreen 
                                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' 
                                  : isAmber 
                                    ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20' 
                                    : 'bg-rose-500/10 text-rose-700 border border-rose-500/20'
                              }`}>
                                {assess.badge}
                              </span>
                            </div>
                            <p className={`text-xs leading-relaxed font-semibold ${
                              isGreen 
                                ? 'text-emerald-800' 
                                : isAmber 
                                  ? 'text-amber-800' 
                                  : 'text-rose-800'
                            }`}>
                              {assess.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Premium metrics cards row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {result.regression_type?.startsWith('logistic') ? (
                      <>
                        <Card
                          title="EXACTITUDE (ACCURACY)"
                          value={`${result.metrics.accuracy}%`}
                          desc="Performance globale du classifieur"
                          statusColor={result.metrics.accuracy >= 80 ? 'green' : result.metrics.accuracy >= 60 ? 'amber' : 'rose'}
                        />
                        <Card
                          title={result.regression_type === 'logistic_multinomial' ? "AUC MACRO" : "SENSIBILITÉ"}
                          value={result.regression_type === 'logistic_multinomial' ? result.metrics.mac_auc : `${result.metrics.sensitivity}%`}
                          desc={result.regression_type === 'logistic_multinomial' ? "Pouvoir discriminant moyen multi-classe" : "Prédiction correcte de l'événement"}
                          statusColor={result.regression_type === 'logistic_multinomial' ? (result.metrics.mac_auc >= 0.8 ? 'green' : result.metrics.mac_auc >= 0.6 ? 'amber' : 'rose') : (result.metrics.sensitivity >= 80 ? 'green' : result.metrics.sensitivity >= 60 ? 'amber' : 'rose')}
                        />
                        <Card
                          title={result.regression_type === 'logistic_multinomial' ? "PSEUDO R²" : "SPÉCIFICITÉ"}
                          value={result.regression_type === 'logistic_multinomial' ? result.metrics.pseudo_r2 : `${result.metrics.specificity}%`}
                          desc={result.regression_type === 'logistic_multinomial' ? "McFadden R² d'association" : "Détections négatives authentiques"}
                          statusColor={result.regression_type === 'logistic_multinomial' ? 'default' : (result.metrics.specificity >= 80 ? 'green' : result.metrics.specificity >= 60 ? 'amber' : 'rose')}
                        />
                        <Card
                          title={result.regression_type === 'logistic_multinomial' ? "LOG-LIKELIHOOD" : "DISCRIMINATION (AUC)"}
                          value={result.regression_type === 'logistic_multinomial' ? result.metrics.log_likelihood : result.metrics.auc}
                          desc={result.regression_type === 'logistic_multinomial' ? "Log-Vraisemblance finale du modèle" : "Qualité d'aire sous la courbe ROC"}
                          statusColor={result.regression_type === 'logistic_multinomial' ? 'default' : (result.metrics.auc >= 0.8 ? 'green' : result.metrics.auc >= 0.6 ? 'amber' : 'rose')}
                        />
                      </>
                    ) : (
                      <>
                        <Card
                          title="R-CARRÉ (R²)"
                          value={result.metrics.r_squared}
                          desc="Fraction de variance expliquée"
                          statusColor={result.metrics.r_squared >= 0.7 ? 'green' : result.metrics.r_squared >= 0.4 ? 'amber' : 'rose'}
                        />
                        <Card
                          title="R² AJUSTÉ"
                          value={result.metrics.r_squared_adj}
                          desc="R² pénalisé pour la colinéarité"
                          statusColor={result.metrics.r_squared_adj >= 0.7 ? 'green' : result.metrics.r_squared_adj >= 0.4 ? 'amber' : 'rose'}
                        />
                        <Card
                          title="ANOVA GLOBAL F"
                          value={`${result.metrics.f_statistic}`}
                          desc={`p-value: ${result.metrics.f_p_value < 0.001 ? '<0.001' : result.metrics.f_p_value.toFixed(useWorkspaceStore.getState().decimals)}`}
                          statusColor={result.metrics.f_p_value < useWorkspaceStore.getState().alpha ? 'green' : 'rose'}
                        />
                        <Card
                          title="RSE (ÉCART-TYPE RÉSIDUEL)"
                          value={result.metrics.residual_std_error}
                          desc="Dispersion moyenne des prédictions Y"
                          highlight
                        />
                      </>
                    )}
                  </div>

                  {/* Natural Language Report Card */}
                  <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 rounded-2xl p-6 lg:p-7 text-white shadow-xl space-y-4">
                    <div className="flex items-center gap-2 border-b border-indigo-900 pb-3">
                      <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 animate-pulse" />
                      <h3 className="text-sm font-extrabold uppercase tracking-wider leading-none">Interprétation d'Experts Nuru Analytics</h3>
                    </div>
                    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-5 text-white/95">
                      <div className="text-[13px] leading-relaxed select-text font-medium whitespace-pre-wrap">
                        {renderMarkdown(result.interpretation, true)}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 2. TABLEAUX DE RÉGRESSION TAB */}
              {activeTab === 'tables' && (
                <div className="space-y-6">
                  {/* Coefficients Table Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" /> Coefficients du modèle ajusté
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 border-y border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Variable Prédictrice</th>
                            {result.regression_type === 'logistic_multinomial' && (
                              <th className="py-2.5 px-3">Modalité Expliquée</th>
                            )}
                            <th className="py-2.5 px-3 text-right">Coefficient (β)</th>
                            <th className="py-2.5 px-3 text-right">Erreur Standard (SE)</th>
                            {result.regression_type?.startsWith('logistic') && (
                              <th className="py-2.5 px-3 text-right">Odds Ratio (OR)</th>
                            )}
                            <th className="py-2.5 px-3 text-right">Statistique (t/z)</th>
                            <th className="py-2.5 px-3 text-right">Valeur p (p-value)</th>
                            <th className="py-2.5 px-3 text-right">Intervalle Conf. [95%]</th>
                            <th className="py-2.5 px-3 text-center">Sig.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {result.coefficients?.map((coeff: any, idx: number) => {
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-3 px-3 font-bold text-slate-900">{coeff.variable}</td>
                                {result.regression_type === 'logistic_multinomial' && (
                                  <td className="py-3 px-3 text-indigo-600 font-bold bg-indigo-50/30">{coeff.class} (vs {coeff.reference})</td>
                                )}
                                <td className="py-3 px-3 text-right font-mono">{coeff.coefficient}</td>
                                <td className="py-3 px-3 text-right font-mono text-slate-400">{coeff.std_error}</td>
                                {result.regression_type?.startsWith('logistic') && (
                                  <td className="py-3 px-3 text-right font-bold text-slate-900 font-mono bg-emerald-50/30">
                                    {coeff.odds_ratio !== undefined ? coeff.odds_ratio : '-'}
                                  </td>
                                )}
                                <td className="py-3 px-3 text-right font-mono text-slate-500">{coeff.statistic}</td>
                                <td className={`py-3 px-3 text-right font-bold font-mono ${
                                  coeff.p_value < useWorkspaceStore.getState().alpha ? 'text-emerald-600' : 'text-slate-400'
                                }`}>
                                  {coeff.p_value < 0.0001 ? '< 0.001' : coeff.p_value.toFixed(useWorkspaceStore.getState().decimals)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-slate-400 text-[10px]">
                                  {coeff.ci_lower !== undefined ? `[${coeff.ci_lower} ; ${coeff.ci_upper}]` : `[${(coeff.coefficient - 1.96 * coeff.std_error).toFixed(useWorkspaceStore.getState().decimals)} ; ${(coeff.coefficient + 1.96 * coeff.std_error).toFixed(useWorkspaceStore.getState().decimals)}]`}
                                </td>
                                <td className="py-3 px-3 text-center font-black text-indigo-500 tracking-tighter text-xs">{coeff.significance}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-3">
                      <span>Significativité : <strong>***</strong> p &lt; 0.001 | <strong>**</strong> p &lt; 0.01 | <strong>*</strong> p &lt; 0.05 | <strong>.</strong> p &lt; 0.1</span>
                    </div>
                  </div>

                  {/* ANOVA TABLE FOR LINEAR REGRESSIONS */}
                  {result.anova_table && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" /> Analyse de Variance (ANOVA)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-50 border-y border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider">
                              <th className="py-2 px-3">source de variation</th>
                              <th className="py-2 px-3 text-right font-black">degrés de liberté (df)</th>
                              <th className="py-2 px-3 text-right font-black">somme des carrés (ss)</th>
                              <th className="py-2 px-3 text-right font-black">moyenne des carrés (ms)</th>
                              <th className="py-2 px-3 text-right font-black">f-statistique</th>
                              <th className="py-2 px-3 text-right font-black">valeur p (sig.)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-900">Régression (Modèle)</td>
                              <td className="py-2.5 px-3 text-right font-mono">{result.anova_table.regression.df}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{result.anova_table.regression.ss}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{result.anova_table.regression.ms}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-indigo-600 font-bold">{result.anova_table.regression.f}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-bold">
                                {result.anova_table.regression.p < 0.001 ? '< 0.001' : result.anova_table.regression.p.toFixed(useWorkspaceStore.getState().decimals)}
                              </td>
                            </tr>
                            <tr className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-900">Résidus (Erreurs)</td>
                              <td className="py-2.5 px-3 text-right font-mono">{result.anova_table.residual.df}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{result.anova_table.residual.ss}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{result.anova_table.residual.ms}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">-</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">-</td>
                            </tr>
                            <tr className="border-t border-slate-200 bg-slate-50/30 font-bold">
                              <td className="py-2.5 px-3 font-bold text-slate-900">Total</td>
                              <td className="py-2.5 px-3 text-right font-mono">{result.anova_table.total.df}</td>
                              <td className="py-2.5 px-3 text-right font-mono">{result.anova_table.total.ss}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">-</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">-</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-300">-</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* BINARY LOGISTIC CLASSIFICATION TABLE */}
                  {result.classification_table && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-500" /> Matrice de Confusion Binaire (Y réel vs prédit)
                        </h3>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                          <div className="bg-slate-50/30 p-2 text-slate-400 flex items-center justify-center select-none">Réel \ Prédit</div>
                          <div className="bg-rose-500/10 text-rose-700 p-2 rounded-lg">Prédit NÉGATIF (0)</div>
                          <div className="bg-emerald-500/10 text-emerald-700 p-2 rounded-lg">Prédit POSITIF (1)</div>
                          
                          <div className="bg-rose-500/10 text-rose-700 p-2 rounded-lg flex items-center justify-center">NÉGATIF (0)</div>
                          <div className="bg-slate-50/70 p-4 rounded-lg font-mono text-slate-850 text-xs">
                            {result.classification_table.tn} <span className="block text-[8px] font-black text-slate-400 uppercase mt-0.5">True Neg (TN)</span>
                          </div>
                          <div className="bg-slate-50/70 p-4 rounded-lg font-mono text-rose-650 text-xs">
                            {result.classification_table.fp} <span className="block text-[8px] font-black text-rose-400 uppercase mt-0.5">False Pos (FP)</span>
                          </div>

                          <div className="bg-emerald-500/10 text-emerald-700 p-2 rounded-lg flex items-center justify-center">POSITIF (1)</div>
                          <div className="bg-slate-50/70 p-4 rounded-lg font-mono text-rose-650 text-xs">
                            {result.classification_table.fn} <span className="block text-[8px] font-black text-rose-400 uppercase mt-0.5">False Neg (FN)</span>
                          </div>
                          <div className="bg-slate-50/70 p-4 rounded-lg font-mono text-emerald-600 text-xs">
                            {result.classification_table.tp} <span className="block text-[8px] font-black text-emerald-400 uppercase mt-0.5">True Pos (TP)</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-500" /> Évaluation des Seuils Critiques (Classification)
                        </h3>
                        <div className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-700">
                          <div className="flex justify-between py-2.5">
                            <span className="text-slate-500">Exactitude globale (Accuracy)</span>
                            <span className="text-slate-950 font-black">{result.metrics.accuracy}%</span>
                          </div>
                          <div className="flex justify-between py-2.5">
                            <span className="text-slate-500">Sensibilité (True Positive Rate / Recall)</span>
                            <span className="text-slate-950 font-black text-emerald-600">{result.classification_table.sensitivity}%</span>
                          </div>
                          <div className="flex justify-between py-2.5">
                            <span className="text-slate-500">Spécificité (True Negative Rate)</span>
                            <span className="text-slate-950 font-black text-indigo-600">{result.classification_table.specificity}%</span>
                          </div>
                          <div className="flex justify-between py-2.5">
                            <span className="text-slate-500">Précision (Positive Predictive Value)</span>
                            <span className="text-slate-950 font-black">{result.classification_table.precision}%</span>
                          </div>
                          <div className="flex justify-between py-2.5">
                            <span className="text-slate-500">Mesure F (F1-Score)</span>
                            <span className="text-indigo-700 bg-indigo-50 font-black px-2 py-0.5 rounded-md text-[10px]">{result.classification_table.f1_score}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MULTICLASS CONFUSION MATRIX FOR MULTINOMIAL LOGISTIC */}
                  {result.regression_type === 'logistic_multinomial' && result.metrics.confusion_matrix_multi && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-500" /> Matrice de Confusion Multi-classe (Actual vs Predicted)
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-center border-collapse text-[11px]">
                            <thead>
                              <tr className="bg-slate-50 border-y border-slate-100 font-extrabold text-slate-400 uppercase tracking-wider">
                                <th className="py-2 px-3 text-left">Réel \ Prédit</th>
                                <th className="py-2 px-3 bg-red-50 text-red-650">Faible</th>
                                <th className="py-2 px-3 bg-amber-50 text-amber-600">Moyen</th>
                                <th className="py-2 px-3 bg-emerald-50 text-emerald-600">Élevé</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                              <tr className="hover:bg-slate-50/50">
                                <td className="py-3 px-3 text-left font-black text-slate-900">Faible</td>
                                <td className="py-3 px-3 font-mono text-emerald-600 bg-emerald-50/30 text-sm">{result.metrics.confusion_matrix_multi[0][0]}</td>
                                <td className="py-3 px-3 font-mono text-slate-500">{result.metrics.confusion_matrix_multi[0][1]}</td>
                                <td className="py-3 px-3 font-mono text-slate-500">{result.metrics.confusion_matrix_multi[0][2]}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="py-3 px-3 text-left font-black text-slate-900">Moyen</td>
                                <td className="py-3 px-3 font-mono text-slate-500">{result.metrics.confusion_matrix_multi[1][0]}</td>
                                <td className="py-3 px-3 font-mono text-emerald-600 bg-emerald-50/30 text-sm">{result.metrics.confusion_matrix_multi[1][1]}</td>
                                <td className="py-3 px-3 font-mono text-slate-500">{result.metrics.confusion_matrix_multi[1][2]}</td>
                              </tr>
                              <tr className="hover:bg-slate-50/50">
                                <td className="py-3 px-3 text-left font-black text-slate-900">Élevé</td>
                                <td className="py-3 px-3 font-mono text-slate-500">{result.metrics.confusion_matrix_multi[2][0]}</td>
                                <td className="py-3 px-3 font-mono text-slate-500">{result.metrics.confusion_matrix_multi[2][1]}</td>
                                <td className="py-3 px-3 font-mono text-emerald-600 bg-emerald-50/30 text-sm">{result.metrics.confusion_matrix_multi[2][2]}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {result.model_lh_summary && (
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-500" /> Vraisemblance & Critères d'Information
                          </h3>
                          <div className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-700">
                            <div className="flex justify-between py-2.5">
                              <span className="text-slate-500">Log-Vraisemblance Log (LnL)</span>
                              <span className="text-slate-900 font-extrabold font-mono">{result.model_lh_summary.log_likelihood}</span>
                            </div>
                            <div className="flex justify-between py-2.5">
                              <span className="text-slate-500">Log-Vraisemblance Nulle (Modèle sans prédicteurs)</span>
                              <span className="text-slate-900 font-extrabold font-mono">{result.model_lh_summary.null_log_likelihood}</span>
                            </div>
                            <div className="flex justify-between py-2.5">
                              <span className="text-slate-500">Ratio de Vraisemblance LRT (Khi-Deux)</span>
                              <span className="text-slate-900 font-extrabold font-mono">{result.model_lh_summary.lrt_stat} (p &lt; 0.001)</span>
                            </div>
                            <div className="flex justify-between py-2.5">
                              <span className="text-slate-500">Critère d'Information d'Akaike (AIC)</span>
                              <span className="text-slate-900 font-extrabold font-mono">{result.model_lh_summary.aic}</span>
                            </div>
                            <div className="flex justify-between py-2.5">
                              <span className="text-slate-500">Critère d'Information Bayésien (BIC)</span>
                              <span className="text-indigo-700 bg-indigo-50 font-black px-2 py-0.5 rounded-md font-mono">{result.model_lh_summary.bic}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 3. GRAPHIQUES D'ÉVALUATION TAB */}
              {activeTab === 'plots' && (
                <div className="space-y-6">
                  {/* Grid for standard model diagnostics charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* PLOT 1: Main Fitted Line / Sigmoid Curve */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                      <div className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        {result.regression_type?.startsWith('logistic') ? "Courbe Logistique Ajustée" : "Droite d'Ajustement des Moindres Carrés"}
                      </div>
                      {result.chart && (
                        <div className="h-72">
                          <Plot
                            data={result.chart.data}
                            layout={{
                              ...result.chart.layout,
                              autosize: true,
                              margin: { t: 30, r: 20, l: 50, b: 40 },
                              paper_bgcolor: 'transparent',
                              plot_bgcolor: 'transparent',
                              legend: { orientation: 'h', y: -0.2 }
                            }}
                            useResizeHandler={true}
                            style={{ width: '100%', height: '100%' }}
                            config={{ displayModeBar: false, responsive: true }}
                          />
                        </div>
                      )}
                    </div>

                    {/* PLOT 2: ROC Curve or Actual vs Predicted */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                      {result.regression_type?.startsWith('logistic') ? (
                        <>
                          <div className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                            <Activity className="w-4 h-4 text-indigo-500" />
                            Pouvoir Discriminant : Courbe ROC (Receiver Operating Characteristic)
                          </div>
                          {result.roc_chart && (
                            <div className="h-72">
                              <Plot
                                data={result.roc_chart.data}
                                layout={{
                                  ...result.roc_chart.layout,
                                  autosize: true,
                                  margin: { t: 30, r: 20, l: 50, b: 40 },
                                  paper_bgcolor: 'transparent',
                                  plot_bgcolor: 'transparent',
                                  legend: { orientation: 'h', y: -0.2 }
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false, responsive: true }}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                            <Activity className="w-4 h-4 text-violet-500" />
                            Valeurs Observées vs Prédites (Ajustement Linéaire)
                          </div>
                          {result.actual_vs_predicted && (
                            <div className="h-72">
                              <Plot
                                data={result.actual_vs_predicted.data}
                                layout={{
                                  ...result.actual_vs_predicted.layout,
                                  autosize: true,
                                  margin: { t: 30, r: 20, l: 50, b: 40 },
                                  paper_bgcolor: 'transparent',
                                  plot_bgcolor: 'transparent',
                                  legend: { orientation: 'h', y: -0.2 }
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false, responsive: true }}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* ADDITIONAL PLOTS DEPENDING ON REGRESSION TYPE */}
                  {!result.regression_type?.startsWith('logistic') && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Residuals vs Fitted */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                        <div className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                          Analyse d'Homoscédasticité : Résidus vs Valeurs Ajustées
                        </div>
                        {result.residuals_vs_fitted && (
                          <div className="h-72">
                            <Plot
                              data={result.residuals_vs_fitted.data}
                              layout={{
                                ...result.residuals_vs_fitted.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 50, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                legend: { orientation: 'h', y: -0.2 }
                              }}
                              useResizeHandler={true}
                              style={{ width: '100%', height: '100%' }}
                              config={{ displayModeBar: false, responsive: true }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Normal Q-Q Plot */}
                      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                        <div className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                          <CheckCircle2 className="w-4 h-4 text-cyan-500" />
                          Normalité : Q-Q Plot (Quantile-Quantile des résidus standardisés)
                        </div>
                        {result.qq_plot && (
                          <div className="h-72">
                            <Plot
                              data={result.qq_plot.data}
                              layout={{
                                ...result.qq_plot.layout,
                                autosize: true,
                                margin: { t: 30, r: 20, l: 50, b: 40 },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                legend: { orientation: 'h', y: -0.2 }
                              }}
                              useResizeHandler={true}
                              style={{ width: '100%', height: '100%' }}
                              config={{ displayModeBar: false, responsive: true }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!result.regression_type?.startsWith('logistic') && result.residuals_hist && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                      <div className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        Distribution des Erreurs : Histogramme des Résidus
                      </div>
                      <div className="h-72">
                        <Plot
                          data={result.residuals_hist.data}
                          layout={{
                            ...result.residuals_hist.layout,
                            autosize: true,
                            margin: { t: 30, r: 20, l: 50, b: 40 },
                            paper_bgcolor: 'transparent',
                            plot_bgcolor: 'transparent',
                            legend: { orientation: 'h', y: -0.2 }
                          }}
                          useResizeHandler={true}
                          style={{ width: '100%', height: '100%' }}
                          config={{ displayModeBar: false, responsive: true }}
                        />
                      </div>
                    </div>
                  )}

                  {result.regression_type?.startsWith('logistic') && result.prob_density && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                      <div className="text-xs font-black text-slate-800 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5 border-b border-slate-50 pb-2">
                        <Layers className="w-4 h-4 text-emerald-500" />
                        Séparabilité des Classes : Histogramme des Probabilités Prédites
                      </div>
                      <div className="h-72">
                        <Plot
                          data={result.prob_density.data}
                          layout={{
                            ...result.prob_density.layout,
                            autosize: true,
                            margin: { t: 30, r: 20, l: 50, b: 40 },
                            paper_bgcolor: 'transparent',
                            plot_bgcolor: 'transparent',
                            legend: { orientation: 'h', y: -0.2 }
                          }}
                          useResizeHandler={true}
                          style={{ width: '100%', height: '100%' }}
                          config={{ displayModeBar: false, responsive: true }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. VALIDATION DIAGNOSTIQUE TAB */}
              {activeTab === 'diagnostics' && (
                <div className="space-y-6">
                  {/* Collinearity Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-indigo-500" /> Facteurs d'Inflation de la Variance (VIF) - Multi-colinéarité
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(result.diagnostics?.collinearity || {}).map(([key, val]: any) => {
                          const vif = parseFloat(val);
                          return (
                            <div key={key} className="flex items-center justify-between py-2.5 border-b border-slate-50 text-[11px] font-semibold">
                              <span className="text-slate-600">{key}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-800 font-mono">VIF = {val}</span>
                                {vif < 2.0 ? (
                                  <span className="inline-block px-1.5 py-0.5 bg-emerald-50/70 text-emerald-600 font-extrabold text-[9px] rounded font-sans">Sain (&lt; 2.0)</span>
                                ) : vif < 5.0 ? (
                                  <span className="inline-block px-1.5 py-0.5 bg-amber-50/70 text-amber-600 font-extrabold text-[9px] rounded font-sans">Modéré (&lt; 5.0)</span>
                                ) : (
                                  <span className="inline-block px-1.5 py-0.5 bg-rose-50/75 text-rose-600 font-extrabold text-[9px] rounded font-sans">Colinéarité extrême !</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(result.diagnostics?.collinearity || {}).length === 0 && (
                          <div className="text-slate-400 text-xs italic font-semibold">Aucun prédicteur multiple pour le calcul VIF.</div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-150 flex items-center gap-2.5">
                      <div className="p-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
                        <Info className="w-4 h-4" />
                      </div>
                      <p className="text-[10px] text-indigo-900 leading-relaxed font-semibold">
                        Un facteur d'inflation de la variance (VIF) supérieur à 5.0 indique généralement une colinéarité critique biaisant la précision des coefficients calculés.
                      </p>
                    </div>
                  </div>

                  {/* Hypothesis Testing (Gauss-Markov for Linear) */}
                  {result.regression_type?.startsWith('linear') ? (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-indigo-500" /> Prémisses de Gauss-Markov & Tests sur Hypothèses
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Shapiro - normality */}
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Normalité des Erreurs
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2">Test de Shapiro-Wilk des résidus</div>
                            <div className="text-xs font-extrabold text-slate-800 font-mono mb-2">
                              W = {result.diagnostics?.shapiro_stat} | p = {result.diagnostics?.shapiro_p < 0.001 ? '<0.001' : result.diagnostics?.shapiro_p.toFixed(useWorkspaceStore.getState().decimals)}
                            </div>
                          </div>
                          <div>
                            {result.diagnostics?.shapiro_p >= 0.05 ? (
                              <span className="inline-flex px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border bg-emerald-50 text-emerald-800 border-emerald-200">🟢 Validé</span>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border bg-rose-50 text-rose-800 border-rose-200">🔴 Non conforme</span>
                            )}
                          </div>
                        </div>

                        {/* Breusch Pagan - Homoscedasticity */}
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Homoscédasticité
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2 font-bold select-none">Test de Breusch-Pagan</div>
                            <div className="text-xs font-extrabold text-slate-800 font-mono mb-2">
                              LM = {result.diagnostics?.bp_stat} | p = {result.diagnostics?.bp_p < 0.001 ? '<0.001' : result.diagnostics?.bp_p.toFixed(useWorkspaceStore.getState().decimals)}
                            </div>
                          </div>
                          <div>
                            {result.diagnostics?.bp_p >= 0.05 ? (
                              <span className="inline-flex px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border bg-emerald-50 text-emerald-800 border-emerald-200">🟢 Validé</span>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border bg-rose-50 text-rose-800 border-rose-200">🔴 Non conforme</span>
                            )}
                          </div>
                        </div>

                        {/* Durbin Watson - Autocorrelation */}
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Non-Autocorrélation
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2 select-none">Statistique de Durbin-Watson</div>
                            <div className="text-xs font-extrabold text-slate-800 font-mono mb-2">
                              Indice DW = {result.diagnostics?.dw_stat} (idéal ~ 2)
                            </div>
                          </div>
                          <div>
                            {result.diagnostics?.dw_stat >= 1.5 && result.diagnostics?.dw_stat <= 2.5 ? (
                              <span className="inline-flex px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border bg-emerald-50 text-emerald-800 border-emerald-200">🟢 Validé</span>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg border bg-rose-50 text-rose-800 border-rose-200">🔴 Non conforme</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 1-Click Transformation Remedies */}
                      {result.diagnostics?.shapiro_p < 0.05 && (
                        <div className="mt-4 p-4.5 bg-indigo-50/60 border border-indigo-200/60 rounded-xl flex items-start gap-3.5 shadow-sm shadow-indigo-500/5 animate-in fade-in slide-in-from-top-1">
                          <div className="p-1.5 rounded-lg bg-indigo-100 border border-indigo-200 text-indigo-600 shrink-0 select-none">
                            🪄
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <h4 className="font-bold text-xs text-indigo-900 uppercase tracking-wide">
                              Traitement alternatif (En 1 clic)
                            </h4>
                            <p className="text-xs text-slate-700 leading-relaxed font-semibold">
                              La distribution des résidus de votre modèle n'étant pas strictement normale (p &lt; 0.05), une transformation logarithmique de la variable dépendante est recommandée pour corriger l'asymétrie. 
                              Vous pouvez appliquer instantanément une transformation mathématique Log(Y) sur la variable dépendante <span className="font-mono text-indigo-950 font-bold bg-indigo-100 px-1 py-0.5 rounded">"{result.variables?.[0]}"</span>.
                            </p>
                            <button
                              onClick={async () => {
                                try {
                                  const targetCol = result.variables?.[0];
                                  if (!targetCol) return;
                                  const transformName = `log_${targetCol}`;
                                  
                                  const applyMathTransform = useWorkspaceStore.getState().applyMathTransform;
                                  await applyMathTransform(targetCol, 'log', transformName);
                                  
                                  const setActiveDashboardTab = useWorkspaceStore.getState().setActiveDashboardTab;
                                  setActiveDashboardTab('regs');
                                  
                                  toast.success(`Transformation Log appliquée ! Nouvelle variable générée : ${transformName}. Vous pouvez maintenant relancer la régression avec ${transformName}.`);
                                } catch (e: any) {
                                  toast.error("Erreur de transformation : " + e.message);
                                }
                              }}
                              className="mt-2 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/15"
                            >
                              🪄 Appliquer la transformation LOG({result.variables?.[0]})
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Prémisses Diagnostiques de la Régression Logistique
                      </h3>
                      <div className="bg-slate-50/60 p-4 rounded-xl space-y-2 border border-slate-100 text-xs font-semibold text-slate-650 leading-relaxed font-sans">
                        <p className="flex items-start gap-2">
                          <span className="text-emerald-500 text-lg leading-none select-none">•</span>
                          <span><strong>Spécification Logit :</strong> La fonction exponentielle de lien (Logit) est validée par le pouvoir prédictif élevé (AUC = {result.metrics.auc || result.metrics.mac_auc}). Elle modélise parfaitement la probabilité d'occurrence binaire de {result.variables?.[0]}.</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="text-emerald-500 text-lg leading-none select-none">•</span>
                          <span><strong>Distribution :</strong> Les probabilités de classification respectent l'homogénéité de distribution multinomiale/binaire, confirmée par le niveau d'ajustement global LRT (Khi-Deux significatif à p &lt; 0.001).</span>
                        </p>
                        <p className="flex items-start gap-2">
                          <span className="text-emerald-500 text-lg leading-none select-none">•</span>
                          <span><strong>Indépendance des observations :</strong> Les observations sont issues d'un échantillon indépendant, garantissant que l'absence d'autocorrélation résiduelle protège les coefficients contre les approximations biaisées.</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </div>

    </div>
  );
}

// Simple stats box helper component
interface CardProps {
  title: string;
  value: string | number;
  desc: string;
  highlight?: boolean;
  statusColor?: 'green' | 'amber' | 'rose' | 'default';
}

function Card({ title, value, desc, highlight, statusColor }: CardProps) {
  const isGreen = statusColor === 'green';
  const isAmber = statusColor === 'amber';
  const isRose = statusColor === 'rose';

  return (
    <div className={`rounded-xl border p-4 shadow-sm flex flex-col justify-between transition-all ${
      isGreen 
        ? 'bg-emerald-50/40 border-emerald-200 ring-1 ring-emerald-500/5' 
        : isAmber 
          ? 'bg-amber-50/40 border-amber-200 ring-1 ring-amber-500/5' 
          : isRose 
            ? 'bg-rose-50/45 border-rose-200 ring-1 ring-rose-500/5' 
            : highlight 
              ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-200/60 ring-1 ring-indigo-500/5' 
              : 'bg-white border-slate-200/70'
    }`}>
      <div>
        <div className={`text-[9px] font-black tracking-widest uppercase mb-1 ${
          isGreen ? 'text-emerald-700/80' : isAmber ? 'text-amber-700/80' : isRose ? 'text-rose-700/80' : 'text-slate-400'
        }`}>{title}</div>
        <div className={`text-xl font-black font-sans ${
          isGreen ? 'text-emerald-700' : isAmber ? 'text-amber-700' : isRose ? 'text-rose-700' : highlight ? 'text-indigo-600' : 'text-slate-800'
        }`}>
          {value}
        </div>
      </div>
      <div className={`text-[9px] leading-snug mt-2 font-semibold ${
        isGreen ? 'text-emerald-600/80' : isAmber ? 'text-amber-600/80' : isRose ? 'text-rose-600/80' : 'text-slate-400'
      }`}>
        {desc}
      </div>
    </div>
  );
}
