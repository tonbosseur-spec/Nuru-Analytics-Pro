import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Plot from 'react-plotly.js';
import { Sliders, Activity, Info, Table, Download, RefreshCw, BarChart2, CheckCircle2, Play, AlertCircle, Sparkles, HelpCircle, LineChart, BookOpen } from 'lucide-react';
import { useWorkspaceStore } from '../store';
import { getApi } from '../pywebview';
import { toast } from 'sonner';

export default function WhatIfSimulationView() {
  const { 
    history, 
    columns, 
    previewData, 
    initializeManualDataset, 
    addAnalysisResult,
    activeAnalysisId,
    setActiveAnalysisId
  } = useWorkspaceStore();
  
  // Bind to central store's activeAnalysisId with first history item fallback
  const selectedAnalysisId = activeAnalysisId || (history.length > 0 ? history[0].id : '');
  const setSelectedAnalysisId = (id: string) => {
    setActiveAnalysisId(id);
  };
  const [modifications, setModifications] = useState<Record<string, any>>({});
  const [simulatedResult, setSimulatedResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [simulationCount, setSimulationCount] = useState(0);

  // States for the Express Sandbox generator
  const [sandboxColX, setSandboxColX] = useState<string>('');
  const [sandboxColY, setSandboxColY] = useState<string>('');
  const [sandboxTest, setSandboxTest] = useState<string>('');
  const [sandboxLoading, setSandboxLoading] = useState<boolean>(false);

  // Automatically update selectedAnalysisId when history is populated
  useEffect(() => {
    if (history.length > 0 && !selectedAnalysisId) {
      setSelectedAnalysisId(history[0].id);
    }
  }, [history]);

  // Derive columns metadata for sandbox dropdowns
  const quantColumns = React.useMemo(() => columns.filter(c => c.type === 'continuous' || c.type === 'discrete'), [columns]);
  const qualColumns = React.useMemo(() => columns.filter(c => c.type === 'nominal' || c.type === 'ordinal'), [columns]);

  // Derive relevant quantitative variables from active analysis
  const activeAnalysis = history.find(h => h.id === selectedAnalysisId);
  const quantitativeVars = activeAnalysis ? activeAnalysis.variables.filter(v => {
    const col = columns.find(c => c.name === v);
    return col && (col.type === 'continuous' || col.type === 'discrete');
  }) : [];

  // Derive relevant categorical variables from active analysis
  const categoricalVars = activeAnalysis ? activeAnalysis.variables.filter(v => {
    const col = columns.find(c => c.name === v);
    return col && (col.type === 'nominal' || col.type === 'ordinal');
  }) : [];

  const getCategoriesForCol = (colName: string) => {
    if (!previewData || previewData.length === 0) return [];
    const vals = previewData.map(r => r[colName]);
    const uniq = Array.from(new Set(vals.filter(v => v !== null && v !== undefined && v !== '')));
    return uniq.map(String).sort();
  };

  // Determine if active test has categorical grouping (e.g. ANOVA, Independent t-test, Welch, Kruskal)
  const groupingCol = React.useMemo(() => {
    if (!activeAnalysis) return null;
    const testParams = activeAnalysis.metrics?.test_params;
    if (testParams) {
      const colX = testParams.col_x;
      const colY = testParams.col_y;
      
      const typeX = columns.find(c => c.name === colX)?.type;
      const typeY = colY ? columns.find(c => c.name === colY)?.type : null;
      
      const isXNum = typeX === 'continuous' || typeX === 'discrete';
      const isYCat = colY && (typeY === 'nominal' || typeY === 'ordinal');
      
      if (isXNum && isYCat) {
        return colY;
      }
    }
    
    // Fallback: one numeric, one nominal
    const numericals = activeAnalysis.variables.filter(v => {
      const col = columns.find(c => c.name === v);
      return col && (col.type === 'continuous' || col.type === 'discrete');
    });
    const categoricals = activeAnalysis.variables.filter(v => {
      const col = columns.find(c => c.name === v);
      return col && (col.type === 'nominal' || col.type === 'ordinal');
    });
    
    if (numericals.length === 1 && categoricals.length === 1) {
      return categoricals[0];
    }
    
    return null;
  }, [activeAnalysis, columns]);

  // Derive unique modalities of the grouping variable
  const categories = React.useMemo(() => {
    if (!groupingCol || !previewData || previewData.length === 0) return [];
    const vals = previewData.map(r => r[groupingCol]);
    const uniq = Array.from(new Set(vals.filter(v => v !== null && v !== undefined && v !== '')));
    return uniq.map(String).sort();
  }, [groupingCol, previewData]);

  // Reset modifications when changing analysis
  useEffect(() => {
    if (activeAnalysis) {
      const initialMods: any = {};
      quantitativeVars.forEach(v => {
        if (groupingCol && categories.length > 0) {
          const groupMods: Record<string, { offset: number, scale: number, noise: number }> = {};
          categories.forEach(cat => {
            groupMods[cat] = { offset: 0, scale: 1.0, noise: 0 };
          });
          initialMods[v] = {
            offset: 0,
            scale: 1.0,
            noise: 0,
            group_by_col: groupingCol,
            group_mods: groupMods
          };
        } else {
          initialMods[v] = { offset: 0, scale: 1.0, noise: 0 };
        }
      });
      categoricalVars.forEach(v => {
        initialMods[v] = { random_noise: 0, category_swaps: [] };
      });
      setModifications(initialMods);
      setSimulatedResult(null);
    }
  }, [selectedAnalysisId, groupingCol, categories, activeAnalysis]);

  // Handle auto-test updates in sandbox when X/Y change
  useEffect(() => {
    if (!sandboxColX) {
      setSandboxTest('');
      return;
    }
    const typeX = columns.find(c => c.name === sandboxColX)?.type;
    const isXQuant = typeX === 'continuous' || typeX === 'discrete';

    if (!sandboxColY) {
      if (isXQuant) {
        setSandboxTest('shapiro');
      } else {
        setSandboxTest('chi2_1samp');
      }
    } else {
      const typeY = columns.find(c => c.name === sandboxColY)?.type;
      const isYQuant = typeY === 'continuous' || typeY === 'discrete';

      if (isXQuant && isYQuant) {
        setSandboxTest('regression');
      } else if (isXQuant && !isYQuant) {
        setSandboxTest('ttest_ind');
      } else {
        setSandboxTest('chi2');
      }
    }
  }, [sandboxColX, sandboxColY]);

  // Debounced simulation runner
  useEffect(() => {
    if (!activeAnalysis || Object.keys(modifications).length === 0) return;
    
    let isModified = false;
    for (const v of Object.values(modifications)) {
      if (v.offset !== undefined && (v.offset !== 0 || v.scale !== 1.0 || v.noise !== 0)) isModified = true;
      if (v.group_mods) {
        for (const gm of Object.values(v.group_mods) as any[]) {
          if (gm.offset !== 0 || gm.scale !== 1.0 || gm.noise !== 0) isModified = true;
        }
      }
      if (v.random_noise !== undefined && v.random_noise > 0) isModified = true;
      if (v.category_swaps && v.category_swaps.some((s: any) => s.percentage > 0)) isModified = true;
    }

    if (!isModified) {
      setSimulatedResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const api = getApi();
        
        let analysis_type: string = activeAnalysis.type;
        if (activeAnalysis.metrics?.isRegression) analysis_type = 'regression';
        else if (activeAnalysis.metrics?.test_id) analysis_type = 'stat_test';

        const test_id = activeAnalysis.metrics?.test_id || activeAnalysis.metrics?.regression_type || '';
        
        let target_params = activeAnalysis.metrics?.test_params;
        if (!target_params) {
           if (analysis_type === 'regression') {
             target_params = { 
               regression_type: activeAnalysis.metrics.regression_type || 'mco',
               target_column: activeAnalysis.variables[1] || activeAnalysis.variables[0],
               predictor_columns: [activeAnalysis.variables[0]]
             };
           } else {
             target_params = {
               col_x: activeAnalysis.variables[0],
               col_y: activeAnalysis.variables[1] || null
             };
           }
        }

        const res = await api.run_what_if_simulation(analysis_type, test_id, target_params, modifications);
        if (res && res.success) {
          setSimulatedResult(res.simulated_result);
          setSimulationCount(prev => prev + 1);
        } else {
          console.error("Erreur de simulation What-If:", res?.error);
        }
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 400); // Debounce duration
    
    return () => clearTimeout(timer);
  }, [modifications, activeAnalysis]);

  const updateMod = (col: string, key: 'offset' | 'scale' | 'noise', val: number) => {
    setModifications(prev => ({
      ...prev,
      [col]: { ...prev[col], [key]: val }
    }));
  };

  const updateCategoryMod = (col: string, category: string, key: 'offset' | 'scale' | 'noise', val: number) => {
    setModifications(prev => {
      const current = prev[col] || { offset: 0, scale: 1.0, noise: 0 };
      const currentGroupMods = current.group_mods || {};
      const newCategoryMod = {
        ...(currentGroupMods[category] || { offset: 0, scale: 1.0, noise: 0 }),
        [key]: val
      };
      return {
        ...prev,
        [col]: {
          ...current,
          group_mods: {
            ...currentGroupMods,
            [category]: newCategoryMod
          }
        }
      };
    });
  };

  const updateCategoricalNoise = (col: string, val: number) => {
    setModifications(prev => {
      const current = prev[col] || { random_noise: 0, category_swaps: [] };
      return {
        ...prev,
        [col]: {
          ...current,
          random_noise: val
        }
      };
    });
  };

  const addCategorySwap = (col: string, colCats: string[]) => {
    if (colCats.length < 2) return;
    setModifications(prev => {
      const current = prev[col] || { random_noise: 0, category_swaps: [] };
      const currentSwaps = current.category_swaps || [];
      return {
        ...prev,
        [col]: {
          ...current,
          category_swaps: [
            ...currentSwaps,
            { from_val: colCats[0], to_val: colCats[1] || colCats[0], percentage: 10 }
          ]
        }
      };
    });
  };

  const updateCategorySwap = (col: string, index: number, field: string, val: any) => {
    setModifications(prev => {
      const current = prev[col] || { random_noise: 0, category_swaps: [] };
      const currentSwaps = [...(current.category_swaps || [])];
      if (currentSwaps[index]) {
        currentSwaps[index] = {
          ...currentSwaps[index],
          [field]: val
        };
      }
      return {
        ...prev,
        [col]: {
          ...current,
          category_swaps: currentSwaps
        }
      };
    });
  };

  const removeCategorySwap = (col: string, index: number) => {
    setModifications(prev => {
      const current = prev[col] || { random_noise: 0, category_swaps: [] };
      const currentSwaps = (current.category_swaps || []).filter((_: any, i: number) => i !== index);
      return {
        ...prev,
        [col]: {
          ...current,
          category_swaps: currentSwaps
        }
      };
    });
  };

  const resetMods = () => {
    if (activeAnalysis) {
      const initialMods: any = {};
      quantitativeVars.forEach(v => {
        if (groupingCol && categories.length > 0) {
          const groupMods: Record<string, { offset: number, scale: number, noise: number }> = {};
          categories.forEach(cat => {
            groupMods[cat] = { offset: 0, scale: 1.0, noise: 0 };
          });
          initialMods[v] = {
            offset: 0,
            scale: 1.0,
            noise: 0,
            group_by_col: groupingCol,
            group_mods: groupMods
          };
        } else {
          initialMods[v] = { offset: 0, scale: 1.0, noise: 0 };
        }
      });
      categoricalVars.forEach(v => {
        initialMods[v] = { random_noise: 0, category_swaps: [] };
      });
      setModifications(initialMods);
      setSimulatedResult(null);
    }
  };

  const exportSimulation = () => {
    if (!simulatedResult) {
      toast.warning("Aucune simulation active à exporter.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ 
      original_analysis_title: activeAnalysis?.title,
      modifications,
      simulated_metrics: simulatedResult.metrics,
      simulated_diagnostics: simulatedResult.diagnostics,
      timestamp: new Date().toISOString()
    }, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `scenario_whatif_${new Date().getTime()}.json`);
    dlAnchorElem.click();
    toast.success("Scénario exporté au format JSON !");
  };

  // Seed standard business demo dataset
  const seedDemoData = async () => {
    setLoading(true);
    try {
      const cols: any[] = [
        { id: 'Budget_Pub', name: 'Budget_Pub', type: 'continuous' },
        { id: 'Taux_Conversion', name: 'Taux_Conversion', type: 'continuous' },
        { id: 'Sante_Financiere', name: 'Sante_Financiere', type: 'continuous' },
        { id: 'Secteur', name: 'Secteur', type: 'nominal' },
      ];
      
      const rows: any[] = [];
      let seed = 42;
      const seededRng = () => {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      
      const getNormal = (m: number, s: number) => {
        const u1 = seededRng() || 0.0001;
        const u2 = seededRng();
        return m + s * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      };

      for (let i = 0; i < 100; i++) {
        const b = parseFloat(Math.max(10, getNormal(150, 45)).toFixed(useWorkspaceStore.getState().decimals));
        const c = parseFloat(Math.max(0.5, getNormal(1.8 + (b / 200), 0.4)).toFixed(useWorkspaceStore.getState().decimals));
        const s = parseFloat(Math.max(10, (b * 0.45) + (c * 20) + getNormal(0, 10)).toFixed(useWorkspaceStore.getState().decimals));
        const sectors = ["Nord", "Sud", "Est", "Ouest"];
        const sect = sectors[Math.floor(seededRng() * sectors.length)];
        
        rows.push({
          Budget_Pub: b,
          Taux_Conversion: c,
          Sante_Financiere: s,
          Secteur: sect
        });
      }

      useWorkspaceStore.setState({
        manualColumns: cols,
        manualRows: rows
      });

      await initializeManualDataset("Performance_Pub_Ventes");
      // Prevent redirecting away from lab tab
      useWorkspaceStore.setState({ activeDashboardTab: 'interactive_lab' });
      toast.success("Jeu de données de démonstration importé avec succès !");
    } catch (err) {
      toast.error("Erreur de génération : " + String(err));
    } finally {
      setLoading(false);
    }
  };

  // Launch instant sandbox analysis
  const executeSandboxAnalysis = async () => {
    if (!sandboxColX) {
      toast.warning("Sélectionnez au moins une variable de référence (X).");
      return;
    }
    setSandboxLoading(true);
    try {
      const api = getApi();
      let res: any = null;
      let title = "";
      let type: 'univariate' | 'bivariate' = sandboxColY ? 'bivariate' : 'univariate';
      let variables = sandboxColY ? [sandboxColX, sandboxColY] : [sandboxColX];
      let metrics: any = {};
      let chart: any = null;

      if (sandboxTest === 'regression') {
        const params: {
          regression_type: 'linear_simple' | 'linear_multiple' | 'logistic_binary' | 'logistic_multinomial';
          target_column: string;
          predictor_columns: string[];
          alpha?: number;
        } = {
          regression_type: 'linear_simple',
          target_column: sandboxColY,
          predictor_columns: [sandboxColX],
          alpha: useWorkspaceStore.getState().alpha
        };
        res = await api.run_regression_analysis(params);
        if (res && res.success) {
          title = `Régression : ${sandboxColY} via ${sandboxColX}`;
          metrics = {
             isRegression: true,
             regression_type: 'linear_simple',
             r_squared_all: res.metrics?.r_squared ?? res.metrics?.r_squared_all ?? 0.5,
             p_value: res.metrics?.p_value ?? 0.05,
             test_params: params,
             coefficients: res.coefficients
          };
          chart = res.chart || res.plots;
        }
      } else {
        const testId = sandboxTest || 'shapiro';
        const params = {
          col_x: sandboxColX,
          col_y: sandboxColY || null,
          mu: '0',
          alternative: 'two-sided',
          alpha: useWorkspaceStore.getState().alpha
        };
        res = await api.run_statistical_test(testId, params);
        if (res && res.success) {
          title = `Test : ${res.test_name || testId} (${sandboxColX})`;
          metrics = {
             test_id: testId,
             test_params: params,
             p_value: res.result?.p_value ?? 0.05,
             r_squared_all: res.result?.r_squared ?? null,
             diagnostics: {
               shapiro_p: res.result?.shapiro_p || 0.45
             }
          };
          chart = res.chart;
        }
      }

      if (res && res.success) {
        const newId = Math.random().toString(36).substring(2, 11);
        addAnalysisResult({
          id: newId,
          title,
          timestamp: new Date().toISOString(),
          type,
          variables,
          metrics,
          interpretation: res.interpretation || "Analyse Sandbox pour simulation What-If.",
          chart
        });
        setSelectedAnalysisId(newId);
        toast.success("Simulation initialisée ! Modifiez maintenant les curseurs.");
      } else {
        toast.error("Échec du calcul de l'analyse : " + (res?.error || "Format de données incompatible."));
      }
    } catch (err) {
      toast.error("Erreur critique : " + String(err));
    } finally {
      setSandboxLoading(false);
    }
  };

  // 1. EMPTY CONFIG WITH NO DATA AT ALL
  if (previewData.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 border border-blue-100 animate-bounce">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Aucun Jeu de Données Connecté</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm leading-relaxed">
          Pour tester le simulateur What-If, importez vos données ou créez instantanément un jeu de données de simulation en 1-clic :
        </p>

        <button 
          onClick={seedDemoData}
          disabled={loading}
          className="mt-6 flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-200 transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <BarChart2 className="w-5 h-5" />}
          Générer des Données de Ventes Fictives (100 lignes)
        </button>
      </div>
    );
  }

  // 2. DATA LOADED BUT NO HISTORY YET -> SHOW THE EXPRESS SANDBOX WIDGET!
  if (history.length === 0) {
    return (
      <div className="flex-1 flex flex-col md:flex-row gap-6 w-full min-h-0">
        
        {/* Sandbox controls sidebar */}
        <div className="w-full md:w-96 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col shrink-0">
          <span className="text-xs font-black uppercase text-blue-700 tracking-widest flex items-center gap-1.5 mb-2">
            <Sparkles className="w-4 h-4 text-blue-500" /> Sandbox Express
          </span>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight mb-4">Initialiser une analyse</h3>
          
          <div className="space-y-4 flex-1">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Variable de référence (X)</label>
              <select 
                value={sandboxColX} 
                onChange={e => setSandboxColX(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 mt-1.5"
              >
                <option value="">-- Choisir X --</option>
                {columns.map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type === 'continuous' || c.type === 'discrete' ? 'Num' : 'Cat'})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                <span>Variable Cible (Y)</span>
                <span className="text-[10px] text-slate-400 font-normal">Optionnel</span>
              </label>
              <select 
                value={sandboxColY} 
                onChange={e => setSandboxColY(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 mt-1.5"
              >
                <option value="">-- Seule (Analyse 1-Var) --</option>
                {columns.filter(c => c.name !== sandboxColX).map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.type === 'continuous' || c.type === 'discrete' ? 'Num' : 'Cat'})</option>
                ))}
              </select>
            </div>

            {sandboxColX && (
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                <label className="text-xs font-bold text-blue-800 uppercase block">Analyse & Test Suggéré</label>
                <div className="text-xs text-blue-700 font-semibold mt-1">
                  {sandboxTest === 'regression' && "📈 Régression MCO (Relation linéaire d'influence)"}
                  {sandboxTest === 'shapiro' && "📊 Test de Shapiro-Wilk (Diagnostic de normalité du groupe)"}
                  {sandboxTest === 'ttest_ind' && "🔬 Test t indépendant (Comparaison de moyenne inter-groupes)"}
                  {sandboxTest === 'chi2' && "📦 Test du Chi-Deux d'indépendance catégorielle"}
                  {sandboxTest === 'chi2_1samp' && "📦 Test du Chi-Deux d'adéquation (Proportions)"}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={executeSandboxAnalysis}
            disabled={sandboxLoading || !sandboxColX}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {sandboxLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            Créer & Simuler dans le Labo
          </button>
        </div>

        {/* Informative placeholder pane */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-center items-center text-center">
          <Activity className="w-12 h-12 text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-800">Prêt pour la simulation</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">
            Sélectionnez les variables de votre choix à gauche pour créer une analyse "instantanée" puis manipulez l'impact What-If en temps réel.
          </p>
        </div>
      </div>
    );
  }

  const getColumnRange = (colName: string) => {
    if (!previewData || previewData.length === 0) return { min: -100, max: 100, step: 1 };
    const vals = previewData.map(r => Number(r[colName])).filter(v => !isNaN(v));
    if (vals.length === 0) return { min: -100, max: 100, step: 1 };
    
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 100;
    
    // Comfortable offset range: from -50% to +50% of the variable's full range amplitude
    const maxOffset = parseFloat((range * 0.5).toFixed(useWorkspaceStore.getState().decimals)) || 50;
    const minOffset = -maxOffset;
    const step = parseFloat((range / 100).toFixed(useWorkspaceStore.getState().decimals)) || 0.1;
    
    return { min: minOffset, max: maxOffset, step };
  };

  // Format regression equation from coefficients array
  const formatRegressionEquation = (coefficients: any[], targetCol: string) => {
    if (!coefficients || coefficients.length === 0) return '';
    const constant = coefficients.find((c: any) => c.variable === 'Constante');
    const others = coefficients.filter((c: any) => c.variable !== 'Constante');
    
    let eq = `${targetCol || 'Y'} = `;
    let hasContent = false;
    
    if (constant) {
      eq += constant.coefficient.toFixed(useWorkspaceStore.getState().decimals);
      hasContent = true;
    }
    
    others.forEach((c: any) => {
      const val = c.coefficient;
      const sign = val >= 0 ? ' + ' : ' - ';
      const absVal = Math.abs(val).toFixed(useWorkspaceStore.getState().decimals);
      eq += `${hasContent ? sign : (val >= 0 ? '' : '-')}${absVal} • [${c.variable}]`;
      hasContent = true;
    });
    
    return eq;
  };

  // Visualizations Merging Logic
  const getMergedPlots = () => {
    if (!activeAnalysis?.chart?.data) return null;
    const baseData = JSON.parse(JSON.stringify(activeAnalysis.chart.data));
    
    if (!simulatedResult || !simulatedResult.chart?.data) return baseData;
    const simData = JSON.parse(JSON.stringify(simulatedResult.chart.data));

    // Desaturate and make original dashed
    baseData.forEach((trace: any) => {
      trace.name = (trace.name || 'Origine') + ' (Réel)';
      if (trace.type === 'scatter' || trace.mode === 'lines') {
        if (!trace.line) trace.line = {};
        trace.line.dash = 'dash';
        trace.opacity = 0.5;
      }
    });

    // Style simulated data
    simData.forEach((trace: any) => {
      trace.name = (trace.name || 'Simulé') + ' (What-If)';
      if (trace.type === 'scatter' || trace.mode === 'lines') {
        if (!trace.line) trace.line = {};
        trace.line.width = (trace.line.width || 2) + 2;
        trace.line.color = '#6366f1';
      }
    });

    return [...baseData, ...simData];
  };

  return (
    <div className="flex-1 flex gap-6 min-h-0 w-full">
      {/* SIDEBAR: CONTROLS */}
      <div className="w-80 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
          <label className="text-xs font-black uppercase text-slate-800 tracking-widest block mb-1">
            Analyse de référence
          </label>
          <select 
            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
            value={selectedAnalysisId}
            onChange={e => setSelectedAnalysisId(e.target.value)}
          >
            <option value="">-- Sélectionner --</option>
            {history.map(h => (
              <option key={h.id} value={h.id}>{h.title}</option>
            ))}
          </select>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {!activeAnalysis && (
            <div className="text-sm text-slate-500 italic text-center mt-10">
              Sélectionnez une analyse pour afficher les contrôles de variables.
            </div>
          )}

          {activeAnalysis && quantitativeVars.length === 0 && categoricalVars.length === 0 && (
            <div className="text-sm text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200 text-center">
              L'analyse sélectionnée ne contient pas de variables qualitatives ni quantitatives configurées.
            </div>
          )}

          {activeAnalysis && quantitativeVars.map(v => {
            const rangeInfo = getColumnRange(v);
            const isGrouped = groupingCol && categories.length > 0;
            
            return (
              <div key={v} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                 <h4 className="font-bold text-slate-800 text-sm flex flex-col mb-3 border-b border-slate-200 pb-2">
                   <span className="truncate text-indigo-700 font-black">{v}</span>
                   {isGrouped && (
                     <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                       Simulé séparément par modalité de <span className="underline font-bold text-indigo-600">{groupingCol}</span>
                     </span>
                   )}
                 </h4>
                 
                 {isGrouped ? (
                   <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                     {categories.map(cat => {
                       const catMod = modifications[v]?.group_mods?.[cat] || { scale: 1.0, offset: 0, noise: 0 };
                       return (
                         <div key={cat} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2.5">
                           <div className="flex justify-between items-center bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                             <span className="text-xs font-bold text-slate-800 truncate max-w-[150px]">
                               📌 {cat}
                             </span>
                             <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Groupe</span>
                           </div>
                           
                           {/* Scale Slider */}
                           <div>
                             <div className="flex justify-between text-[10px] font-bold text-slate-600">
                               <span>Échelle/Ratio</span>
                               <span className="text-indigo-600 font-mono font-bold">{catMod.scale.toFixed(useWorkspaceStore.getState().decimals)}x</span>
                             </div>
                             <input 
                               type="range" 
                               min="0.1" 
                               max="3" 
                               step="0.1" 
                               value={catMod.scale} 
                               onChange={e => updateCategoryMod(v, cat, 'scale', parseFloat(e.target.value))} 
                               className="w-full accent-indigo-600 mt-0.5" 
                             />
                           </div>

                           {/* Offset Slider */}
                           <div>
                             <div className="flex justify-between text-[10px] font-bold text-slate-600">
                               <span>Décalage</span>
                               <span className="text-indigo-600 font-mono font-bold">
                                 {catMod.offset > 0 ? '+' : ''}{catMod.offset.toFixed(rangeInfo.step >= 0.1 ? 1 : 3)}
                               </span>
                             </div>
                             <input 
                               type="range" 
                               min={rangeInfo.min} 
                               max={rangeInfo.max} 
                               step={rangeInfo.step} 
                               value={catMod.offset} 
                               onChange={e => updateCategoryMod(v, cat, 'offset', parseFloat(e.target.value))} 
                               className="w-full accent-indigo-600 mt-0.5" 
                             />
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 ) : (
                   <div className="space-y-4">
                     {/* Scale Slider */}
                     <div>
                       <div className="flex justify-between text-xs font-bold text-slate-600">
                         <span>Multiplier (Échelle/Ratio)</span>
                         <span className="text-indigo-600 font-mono">{(modifications[v]?.scale ?? 1.0).toFixed(useWorkspaceStore.getState().decimals)}x</span>
                       </div>
                       <input 
                         type="range" 
                         min="0.1" 
                         max="3" 
                         step="0.1" 
                         value={modifications[v]?.scale ?? 1} 
                         onChange={e => updateMod(v, 'scale', parseFloat(e.target.value))} 
                         className="w-full accent-indigo-600 mt-1" 
                       />
                     </div>
                     
                     {/* Offset Slider */}
                     <div>
                       <div className="flex justify-between text-xs font-bold text-slate-600">
                         <span>Décaler (Ajout/Soustraction)</span>
                         <span className="text-indigo-600 font-mono">
                           {(modifications[v]?.offset ?? 0) > 0 ? '+' : ''}{(modifications[v]?.offset ?? 0).toFixed(useWorkspaceStore.getState().decimals)}
                         </span>
                       </div>
                       <input 
                         type="range" 
                         min={rangeInfo.min} 
                         max={rangeInfo.max} 
                         step={rangeInfo.step} 
                         value={modifications[v]?.offset ?? 0} 
                         onChange={e => updateMod(v, 'offset', parseFloat(e.target.value))} 
                         className="w-full accent-indigo-600 mt-1" 
                       />
                     </div>
                     
                     {/* Noise Slider */}
                     <div>
                       <div className="flex justify-between text-xs font-bold text-slate-600">
                         <span>Injecter du Bruit Aléatoire</span>
                         <span className="text-indigo-600 font-mono">{(modifications[v]?.noise ?? 0).toFixed(useWorkspaceStore.getState().decimals)}</span>
                       </div>
                       <input 
                         type="range" 
                         min="0" 
                         max="50" 
                         step="0.5" 
                         value={modifications[v]?.noise ?? 0} 
                         onChange={e => updateMod(v, 'noise', parseFloat(e.target.value))} 
                         className="w-full accent-indigo-600 mt-1" 
                       />
                     </div>
                   </div>
                 )}
              </div>
            );
          })}
          {activeAnalysis && categoricalVars.map(v => {
            const colCats = getCategoriesForCol(v);
            const currentMod = modifications[v] || { random_noise: 0, category_swaps: [] };
            const swaps = currentMod.category_swaps || [];

            return (
              <div key={v} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <h4 className="font-bold text-slate-800 text-sm flex flex-col border-b border-slate-200 pb-2">
                  <span className="truncate text-teal-700 font-extrabold">{v}</span>
                  <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                    Modifications qualitatives (Chi-deux / ANOVA)
                  </span>
                </h4>

                {/* Noise Slider (Mutation / Dispersion Rate) */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-650">
                    <span>Ajouter du bruit (Contamination)</span>
                    <span className="text-teal-600 font-mono font-bold">{(currentMod.random_noise ?? 0).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={currentMod.random_noise ?? 0}
                    onChange={e => updateCategoricalNoise(v, parseInt(e.target.value))}
                    className="w-full accent-teal-600 mt-1"
                  />
                  <p className="text-[10px] text-slate-400">
                    Remplace aléatoirement des valeurs par d'autres catégories pour introduire de l'indépendance.
                  </p>
                </div>

                {/* Swapping / Transferring categories */}
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-slate-700">Transferts de catégories</span>
                    <button
                      onClick={() => addCategorySwap(v, colCats)}
                      disabled={colCats.length < 2}
                      className="text-[10px] font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded cursor-pointer transition disabled:opacity-50"
                    >
                      + Nouveau
                    </button>
                  </div>

                  {swaps.length === 0 ? (
                    <div className="text-[10px] bg-white border border-slate-100 rounded p-2.5 text-slate-400 italic text-center">
                      Aucun transfert défini (les proportions d'origine restent inchangées).
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {swaps.map((swap: any, idxSwap: number) => (
                        <div key={idxSwap} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2.5 relative">
                          <button
                            onClick={() => removeCategorySwap(v, idxSwap)}
                            className="absolute right-1.5 top-1.5 text-slate-400 hover:text-red-500 p-0.5"
                          >
                            ×
                          </button>

                          <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
                            <div>
                              <span className="block text-[9px] font-black text-slate-400 uppercase mb-0.5">De :</span>
                              <select
                                className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[11px] font-medium outline-none truncate"
                                value={swap.from_val}
                                onChange={e => updateCategorySwap(v, idxSwap, 'from_val', e.target.value)}
                              >
                                {colCats.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black text-slate-400 uppercase mb-0.5">Vers :</span>
                              <select
                                className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[11px] font-medium outline-none truncate"
                                value={swap.to_val}
                                onChange={e => updateCategorySwap(v, idxSwap, 'to_val', e.target.value)}
                              >
                                {colCats.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                              <span>Proportion à transférer</span>
                              <span className="text-teal-600 font-mono font-bold">{swap.percentage}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={swap.percentage}
                              onChange={e => updateCategorySwap(v, idxSwap, 'percentage', parseInt(e.target.value))}
                              className="w-full accent-teal-600 mt-1"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Foot Actions */}
        {activeAnalysis && (
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex items-center gap-2">
            <button onClick={resetMods} className="flex-1 flex justify-center items-center gap-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-3 py-2.5 rounded-lg text-xs font-bold transition">
              <RefreshCw className="w-3.5 h-3.5" /> Réinitialiser
            </button>
            <button onClick={exportSimulation} disabled={!simulatedResult} className="flex-1 flex justify-center items-center gap-1 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2.5 rounded-lg text-xs font-bold transition">
              <Download className="w-3.5 h-3.5" /> Exporter
            </button>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-full font-bold shadow-xl animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" /> Recalcul en cours...
            </div>
          </div>
        )}

        {!activeAnalysis ? (
           <div className="h-full flex items-center justify-center text-slate-400">
             Veuillez sélectionner une analyse à gauche.
           </div>
        ) : (
          <div className="h-full flex flex-col min-h-0">
             
             {/* Comparatif KPIs */}
             {simulatedResult && activeAnalysis.metrics && (
                <div className="grid grid-cols-2 gap-6 mb-6">
                   <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm">
                     <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                       <Table className="w-3.5 h-3.5" /> Données d'Origine (Réelles)
                     </h3>
                     <div className="space-y-2">
                       {typeof activeAnalysis.metrics.p_value === 'number' && (
                         <div className="flex justify-between text-sm">
                           <span className="font-semibold text-slate-600">P-Value globale :</span> 
                           <span className="font-mono font-bold text-slate-800">{activeAnalysis.metrics.p_value.toFixed(useWorkspaceStore.getState().decimals)}</span>
                         </div>
                       )}
                       {typeof activeAnalysis.metrics.r_squared_all === 'number' && (
                         <div className="flex justify-between text-sm">
                           <span className="font-semibold text-slate-600">R² ajustable :</span> 
                           <span className="font-mono font-bold text-slate-800">{(activeAnalysis.metrics.r_squared_all * 100).toFixed(useWorkspaceStore.getState().decimals)}%</span>
                         </div>
                       )}
                       {typeof activeAnalysis.metrics.test_result?.p_value === 'number' && (
                         <div className="flex justify-between text-sm">
                           <span className="font-semibold text-slate-600">P-Value Test d'Origine :</span> 
                           <span className="font-mono font-bold text-slate-800">{activeAnalysis.metrics.test_result.p_value.toFixed(useWorkspaceStore.getState().decimals)}</span>
                         </div>
                       )}
                     </div>
                   </div>

                   <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 shadow-sm ring-2 ring-indigo-500/10">
                     <h3 className="text-xs font-black text-indigo-700 uppercase tracking-widest mb-3 flex items-center gap-1">
                       <Sliders className="w-3.5 h-3.5" /> Scénario What-If (Simulé)
                     </h3>
                     <div className="space-y-2">
                       {(typeof simulatedResult.metrics?.p_value === 'number' || typeof simulatedResult.result?.p_value === 'number' || typeof simulatedResult.f_p_value === 'number') && (
                         <div className="flex justify-between text-sm">
                            <span className="font-semibold text-indigo-800">P-Value simulée :</span> 
                            <span className={`font-mono font-black ${(simulatedResult.metrics?.p_value ?? simulatedResult.result?.p_value ?? simulatedResult.f_p_value) < 0.05 ? 'text-emerald-700 bg-emerald-100/50' : 'text-rose-700 bg-rose-100/50'} px-1.5 rounded`}>
                              {(simulatedResult.metrics?.p_value ?? simulatedResult.result?.p_value ?? simulatedResult.f_p_value).toFixed(useWorkspaceStore.getState().decimals)}
                            </span>
                         </div>
                       )}
                       {(typeof simulatedResult.metrics?.r_squared === 'number' || typeof simulatedResult.result?.r_squared === 'number') && (
                         <div className="flex justify-between text-sm">
                            <span className="font-semibold text-indigo-800">R² ajusté simulé :</span> 
                            <span className="font-mono font-black text-indigo-900">{((simulatedResult.metrics?.r_squared_adj ?? simulatedResult.metrics?.r_squared ?? simulatedResult.result?.r_squared) * 100).toFixed(useWorkspaceStore.getState().decimals)}%</span>
                         </div>
                       )}
                       {(typeof simulatedResult.diagnostics?.shapiro_p === 'number' || typeof simulatedResult.result?.shapiro_p === 'number') && (
                         <div className="flex justify-between text-sm">
                            <span className="font-semibold text-indigo-800">Diag Normalité p :</span> 
                            <span className="font-mono font-semibold text-indigo-900">{(simulatedResult.diagnostics?.shapiro_p ?? simulatedResult.result?.shapiro_p).toFixed(useWorkspaceStore.getState().decimals)}</span>
                         </div>
                       )}
                     </div>
                   </div>
                </div>
             )}

             {!simulatedResult && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6 flex items-center gap-3 text-sm text-indigo-800 font-medium">
                  <Info className="w-5 h-5 text-indigo-500" />
                  <span>Faites glisser les réglettes à gauche pour appliquer une altération au modèle et voir ses impacts de sensibilité en temps réel.</span>
                </div>
             )}

             {/* Évolution de l'Équation de Régression */}
             {activeAnalysis.metrics?.isRegression && (
                <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                    <LineChart className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black uppercase text-slate-700 tracking-widest">Évolution de l'Équation de Régression</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Équation d'Origine (Réelle) :</div>
                      <div className="text-xs font-mono font-black text-slate-800 mt-1 break-all">
                        {formatRegressionEquation(activeAnalysis.metrics.coefficients, activeAnalysis.metrics?.test_params?.target_column || activeAnalysis.variables[1] || activeAnalysis.variables[0]) || 'Y = N/A'}
                      </div>
                    </div>
                    {simulatedResult && (
                      <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 shadow-sm">
                        <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">Équation Simulée (What-If) :</div>
                        <div className="text-xs font-mono font-black text-indigo-900 mt-1 break-all">
                          {formatRegressionEquation(simulatedResult.coefficients || activeAnalysis.metrics.coefficients, activeAnalysis.metrics?.test_params?.target_column || activeAnalysis.variables[1] || activeAnalysis.variables[0]) || 'Y = N/A'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
             )}

             {/* Chart Comparison */}
             <div className="flex-1 w-full min-h-[480px] bg-slate-50/50 rounded-xl border border-slate-200 flex items-center justify-center p-4">
                {activeAnalysis.chart ? (
                  <Plot
                     data={getMergedPlots() || []}
                     layout={{
                       ...activeAnalysis.chart.layout,
                       autosize: true,
                       title: 'Comparatif Courbe Réelle vs Simulée',
                       paper_bgcolor: 'transparent',
                       plot_bgcolor: 'transparent',
                       margin: { t: 40, b: 40, l: 40, r: 20 },
                     }}
                     useResizeHandler={true}
                     style={{ width: '100%', height: '100%' }}
                     config={{ responsive: true, displayModeBar: false }}
                  />
                ) : (
                  <div className="text-slate-400 font-medium text-sm">Aucun visuel disponible pour cette configuration d'analyse.</div>
                )}
             </div>

          </div>
        )}
      </div>
    </div>
  );
}
