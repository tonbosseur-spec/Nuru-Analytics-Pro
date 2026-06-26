import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspaceStore } from '../store';
import { motion } from 'motion/react';
import Plot from 'react-plotly.js';
import { Beaker, Sliders, Info, LineChart, FlaskConical, Target, Zap, HelpCircle, BookOpen, ChevronRight, Check, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';
import { getApi } from '../pywebview';
import WhatIfSimulationView from './WhatIfSimulationView';

// Mathematical Helpers for local simulation (immediate, fluid slider tracking)
function statsErf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = (x < 0) ? -1 : 1;
  const t = 1.0 / (1.0 + p * Math.abs(x));
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

function statsNormalCdf(x: number): number {
  return 0.5 * (1 + statsErf(x / Math.sqrt(2)));
}

function normalPdf(x: number, mean: number, std: number): number {
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

// Seeded seeded random engine for consistent plotting
function seededRng(seed: number) {
  let s = seed;
  return function() {
    let t = s += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function InteractiveLab({ onBack }: { onBack?: () => void } = {}) {
  const [activeTab, setActiveTab] = useState<'desc' | 'hypo' | 'reg' | 'whatif'>('whatif');
  const [loading, setLoading] = useState(false);

  // States: Descriptive Stats
  const [descMean, setDescMean] = useState<number>(0);
  const [descStd, setDescStd] = useState<number>(1.2);
  const [descN, setDescN] = useState<number>(800);
  const [descData, setDescData] = useState<any>(null);

  // States: Hypothesis Testing
  const [hypoTestType, setHypoTestType] = useState<'ttest_1samp' | 'wilcoxon_1samp' | 'ttest_ind' | 'paired_ttest' | 'welch' | 'mannwhitney' | 'anova' | 'kruskal' | 'correlation' | 'chi2' | 'chi2_1samp' | 'shapiro' | 'kolmogorov'>('ttest_1samp');
  const [hypoPopMean, setHypoPopMean] = useState<number>(100);
  const [hypoPopStd, setHypoPopStd] = useState<number>(15);
  const [hypoSampleMean, setHypoSampleMean] = useState<number>(106);
  const [hypoSampleSize, setHypoSampleSize] = useState<number>(45);
  
  // Custom states for other tests
  const [corrR, setCorrR] = useState<number>(0.45);
  const [anovaMeanC, setAnovaMeanC] = useState<number>(92);
  const [chiGap, setChiGap] = useState<number>(0.18);
  const [skewness, setSkewness] = useState<number>(1.5);

  // States: Regression
  const [regSlope, setRegSlope] = useState<number>(2.0);
  const [regNoise, setRegNoise] = useState<number>(5.0);
  const [regOutlierX, setRegOutlierX] = useState<number>(18);
  const [regOutlierY, setRegOutlierY] = useState<number>(8);
  const [regHasOutlier, setRegHasOutlier] = useState<boolean>(false);
  const [regData, setRegData] = useState<any>(null);

  // Collapsible tutor panel index
  const [openTutorialIndex, setOpenTutorialIndex] = useState<number | null>(0);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [observationsNote, setObservationsNote] = useState<string>("");

  // Fetch / Calc Descriptive (using python API or local fallback for responsive reactivity)
  const fetchDesc = async () => {
    const api = getApi();
    if (api.lab_simulate_descriptive) {
      setLoading(true);
      const res = await api.lab_simulate_descriptive(descMean, descStd, descN);
      if (res && res.success) setDescData(res);
      setLoading(false);
    }
  };

  // Fetch / Calc Regression (MCO vs Outlier lever effect)
  const fetchReg = async () => {
    const api = getApi();
    if (api.lab_simulate_regression) {
      setLoading(true);
      const res = await api.lab_simulate_regression(regSlope, regNoise, regOutlierX, regOutlierY, regHasOutlier);
      if (res && res.success) setRegData(res);
      setLoading(false);
    }
  };

  // Debouncing for standard simulations
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'desc') fetchDesc();
    }, 80);
    return () => clearTimeout(timer);
  }, [descMean, descStd, descN, activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'reg') fetchReg();
    }, 80);
    return () => clearTimeout(timer);
  }, [regSlope, regNoise, regOutlierX, regOutlierY, regHasOutlier, activeTab]);

  // Client-side instant, high-fidelity statistics calculator for Hypothesis Labs (butter-smooth visual)
  const computedHypoData = useMemo(() => {
    const rand = seededRng(42);
    const getNormal = (m: number, s: number) => {
      const u1 = rand() || 0.0001;
      const u2 = rand();
      return m + s * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    };

    // --- TEST 1: TTEST 1-SAMPLE ---
    if (hypoTestType === 'ttest_1samp' || hypoTestType === 'wilcoxon_1samp' || hypoTestType === 'paired_ttest') {
      const se = hypoPopStd / Math.sqrt(hypoSampleSize);
      const zStat = (hypoSampleMean - hypoPopMean) / se;
      const pValue = 2 * (1 - statsNormalCdf(Math.abs(zStat)));
      const criticalLower = hypoPopMean - 1.96 * se;
      const criticalUpper = hypoPopMean + 1.96 * se;

      const pdfX: number[] = [];
      const pdfY: number[] = [];
      const startX = hypoPopMean - 4.5 * se;
      const endX = hypoPopMean + 4.5 * se;
      const step = (endX - startX) / 100;
      for (let i = 0; i <= 100; i++) {
        const x = startX + i * step;
        pdfX.push(parseFloat(x.toFixed(useWorkspaceStore.getState().decimals)));
        pdfY.push(parseFloat(normalPdf(x, hypoPopMean, se).toFixed(useWorkspaceStore.getState().decimals)));
      }

      let testTitle = "Test t d'égalité à une valeur théorique (1 groupe vs norme)";
      if (hypoTestType === 'wilcoxon_1samp') testTitle = "Test de Wilcoxon (Non Paramétrique - 1 groupe)";
      if (hypoTestType === 'paired_ttest') testTitle = "Test t sur échantillons appariés (Avant/Après)";

      return {
        testId: hypoTestType,
        name: testTitle,
        h0: `La moyenne réelle du groupe est égale à ${hypoPopMean} (H0 : μ = μ0)`,
        h1: `La moyenne réelle du groupe differe de ${hypoPopMean} (H1 : μ ≠ μ0)`,
        pLessMsg: "La moyenne observée s'écarte tellement de la norme que l'explication par le hasard est écartée.",
        pHighMsg: "La moyenne observée est compatible avec l'aléa d'échantillonnage de la population d'origine.",
        metrics: [
          { label: "Moyenne Référence (μ0)", value: hypoPopMean, unit: "" },
          { label: "Moyenne Observée (x̄)", value: hypoSampleMean, unit: "" },
          { label: "Statistique Z / t", value: zStat.toFixed(useWorkspaceStore.getState().decimals), unit: "" },
          { label: "P-Value", value: pValue.toFixed(useWorkspaceStore.getState().decimals), unit: "", highlight: pValue < useWorkspaceStore.getState().alpha },
        ],
        rejected: pValue < useWorkspaceStore.getState().alpha,
        plotData: [
          {
            x: pdfX,
            y: pdfY,
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy',
            fillcolor: 'rgba(16, 185, 129, 0.08)',
            name: "Distribution de H0 (Hasard)",
            line: { color: '#10b981', width: 2.5 }
          }
        ],
        layoutShapes: [
          { type: 'line', x0: hypoSampleMean, x1: hypoSampleMean, y0: 0, y1: 1, yref: "paper", line: { color: '#f43f5e', width: 3 } },
          { type: 'line', x0: criticalLower, x1: criticalLower, y0: 0, y1: 1, yref: "paper", line: { color: '#10b981', width: 2, dash: 'dot' } },
          { type: 'line', x0: criticalUpper, x1: criticalUpper, y0: 0, y1: 1, yref: "paper", line: { color: '#10b981', width: 2, dash: 'dot' } },
        ],
        annotations: [
          { x: hypoSampleMean, y: 1.03, yref: 'paper', text: "Moyenne Observée", showarrow: false, font: { color: '#f43f5e', size: 11, weight: 'bold' } }
        ]
      };
    }

    // --- TEST 2: TTEST INDEPENDANT & VARIATIONS (2 GROUPES) ---
    if (hypoTestType === 'ttest_ind' || hypoTestType === 'welch' || hypoTestType === 'mannwhitney') {
      const meanA = hypoSampleMean;
      const meanB = hypoPopMean; // reuse PopMean for Group B mean to minimize state clutter
      const n = hypoSampleSize;
      
      let stdA = hypoPopStd;
      let stdB = hypoPopStd;
      
      // Welch makes Group A have a different apparent visualization of variance
      if (hypoTestType === 'welch') {
          stdA = hypoPopStd * 1.5;
          stdB = hypoPopStd * 0.7;
      }

      let pooledSE;
      if (hypoTestType === 'welch') {
          pooledSE = Math.sqrt((stdA * stdA)/n + (stdB * stdB)/n);
      } else {
          pooledSE = hypoPopStd * Math.sqrt(2 / n);
      }
      
      const tStat = (meanA - meanB) / pooledSE;
      const pValue = 2 * (1 - statsNormalCdf(Math.abs(tStat)));

      const pdfX_A: number[] = [];
      const pdfY_A: number[] = [];
      const pdfX_B: number[] = [];
      const pdfY_B: number[] = [];

      const start = Math.min(meanA, meanB) - 3.5 * Math.max(stdA, stdB);
      const end = Math.max(meanA, meanB) + 3.5 * Math.max(stdA, stdB);
      const step = (end - start) / 100;

      for (let i = 0; i <= 100; i++) {
        const x = start + i * step;
        pdfX_A.push(parseFloat(x.toFixed(useWorkspaceStore.getState().decimals)));
        pdfY_A.push(parseFloat(normalPdf(x, meanA, stdA).toFixed(useWorkspaceStore.getState().decimals)));
        pdfX_B.push(parseFloat(x.toFixed(useWorkspaceStore.getState().decimals)));
        pdfY_B.push(parseFloat(normalPdf(x, meanB, stdB).toFixed(useWorkspaceStore.getState().decimals)));
      }

      let testName = "Test t d'indépendance de Student (Comparaison de deux groupes)";
      let testH0 = "Les moyennes des groupes A et B sont égales en population (H0 : μA = μB)";
      
      if (hypoTestType === 'welch') {
        testName = "Test t de Welch (Variances inégales)";
      } else if (hypoTestType === 'mannwhitney') {
        testName = "Test U de Mann-Whitney (Non Paramétrique)";
        testH0 = "Les distributions (rangs) des groupes A et B sont stochastiquement égales";
      }

      return {
        testId: hypoTestType,
        name: testName,
        h0: testH0,
        h1: "Les groupes A et B diffèrent (H1 : μA ≠ μB)",
        pLessMsg: "Les deux courbes sont suffisamment dissociées pour affirmer que la différence est due à un vrai effet.",
        pHighMsg: "Le chevauchement des courbes est trop fort. La différence observée relève sûrement de l'aléa.",
        metrics: [
          { label: "Moyenne/Médiane A", value: meanA, unit: "" },
          { label: "Moyenne/Médiane B", value: meanB, unit: "" },
          { label: "Différence", value: (meanA - meanB).toFixed(useWorkspaceStore.getState().decimals), unit: "" },
          { label: "P-Value", value: pValue.toFixed(useWorkspaceStore.getState().decimals), unit: "", highlight: pValue < useWorkspaceStore.getState().alpha },
        ],
        rejected: pValue < useWorkspaceStore.getState().alpha,
        plotData: [
          {
            x: pdfX_A,
            y: pdfY_A,
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy',
            fillcolor: 'rgba(59, 130, 246, 0.06)',
            name: "Groupe A",
            line: { color: '#3b82f6', width: 2.5 }
          },
          {
            x: pdfX_B,
            y: pdfY_B,
            type: 'scatter',
            mode: 'lines',
            fill: 'tozeroy',
            fillcolor: 'rgba(236, 72, 153, 0.06)',
            name: "Groupe B (Référence)",
            line: { color: '#ec4899', width: 2.5 }
          }
        ],
        layoutShapes: [
          { type: 'line', x0: meanA, x1: meanA, y0: 0, y1: 1, yref: "paper", line: { color: '#3b82f6', width: 1.5, dash: 'dash' } },
          { type: 'line', x0: meanB, x1: meanB, y0: 0, y1: 1, yref: "paper", line: { color: '#ec4899', width: 1.5, dash: 'dash' } },
        ]
      };
    }

    // --- TEST 3: ANOVA 1-FACTOR OR KRUSKAL-WALLIS ---
    if (hypoTestType === 'anova' || hypoTestType === 'kruskal') {
      const meanA = hypoSampleMean;
      const meanB = hypoPopMean;
      const meanC = anovaMeanC;
      const sigma = hypoPopStd;
      const n = hypoSampleSize;

      const overallMean = (meanA + meanB + meanC) / 3;
      const ssBetween = n * (Math.pow(meanA - overallMean, 2) + Math.pow(meanB - overallMean, 2) + Math.pow(meanC - overallMean, 2));
      const msBetween = ssBetween / 2;
      const msWithin = Math.pow(sigma, 2);
      const fStat = msBetween / msWithin;
      // F-test approx for 3 groups and large n
      const pValue = Math.exp(-fStat / 2.0);

      const pdfX_A: number[] = [];
      const pdfY_A: number[] = [];
      const pdfX_B: number[] = [];
      const pdfY_B: number[] = [];
      const pdfX_C: number[] = [];
      const pdfY_C: number[] = [];

      const start = Math.min(meanA, meanB, meanC) - 3.2 * sigma;
      const end = Math.max(meanA, meanB, meanC) + 3.2 * sigma;
      const step = (end - start) / 100;

      for (let i = 0; i <= 100; i++) {
        const x = start + i * step;
        pdfX_A.push(parseFloat(x.toFixed(useWorkspaceStore.getState().decimals)));
        pdfY_A.push(parseFloat(normalPdf(x, meanA, sigma).toFixed(useWorkspaceStore.getState().decimals)));
        pdfX_B.push(parseFloat(x.toFixed(useWorkspaceStore.getState().decimals)));
        pdfY_B.push(parseFloat(normalPdf(x, meanB, sigma).toFixed(useWorkspaceStore.getState().decimals)));
        pdfX_C.push(parseFloat(x.toFixed(useWorkspaceStore.getState().decimals)));
        pdfY_C.push(parseFloat(normalPdf(x, meanC, sigma).toFixed(useWorkspaceStore.getState().decimals)));
      }

      return {
        testId: hypoTestType,
        name: hypoTestType === 'anova' ? "Analyse de Variance (ANOVA à 1 Facteur pour 3 groupes)" : "Test de Kruskal-Wallis (ANOVA Non Paramétrique)",
        h0: hypoTestType === 'anova' ? "Les moyennes de tous les groupes sont équivalentes (H0 : μA = μB = μC)" : "Les distributions s'alignent sur les mêmes rangs",
        h1: "Au moins un des groupes a une distribution différente (H1 : Différence globale)",
        pLessMsg: "La dispersion inter-groupes l'emporte nettement sur le bruit interne. Au moins un effet est prouvé.",
        pHighMsg: "Le bruit interne (dispersion) occulte toute différence de centres. Pas d'effet significatif prouvé.",
        metrics: [
          { label: "Moyenne/Rang A", value: meanA, unit: "" },
          { label: "Moyenne/Rang B", value: meanB, unit: "" },
          { label: "Moyenne/Rang C", value: meanC, unit: "" },
          { label: "Stat F / H", value: fStat.toFixed(useWorkspaceStore.getState().decimals), unit: "" },
          { label: "P-Value", value: pValue.toFixed(useWorkspaceStore.getState().decimals), unit: "", highlight: pValue < useWorkspaceStore.getState().alpha },
        ],
        rejected: pValue < useWorkspaceStore.getState().alpha,
        plotData: [
          { x: pdfX_A, y: pdfY_A, type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: 'rgba(59, 130, 246, 0.04)', name: "Goupe A", line: { color: '#3b82f6', width: 2 } },
          { x: pdfX_B, y: pdfY_B, type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: 'rgba(168, 85, 247, 0.04)', name: "Groupe B", line: { color: '#a855f7', width: 2 } },
          { x: pdfX_C, y: pdfY_C, type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: 'rgba(234, 179, 8, 0.04)', name: "Groupe C", line: { color: '#eab308', width: 2 } },
        ]
      };
    }

    // --- TEST 4: PEARSON CORRELATION ---
    if (hypoTestType === 'correlation') {
      const count = hypoSampleSize;
      const r = corrR;
      const xPoints: number[] = [];
      const yPoints: number[] = [];

      // Generate correlated random points
      for (let i = 0; i < count; i++) {
        const x_std = getNormal(0, 10);
        const z_err = getNormal(0, 10);
        const y_val = r * x_std + Math.sqrt(1 - r * r) * z_err;
        xPoints.push(parseFloat((100 + x_std).toFixed(useWorkspaceStore.getState().decimals)));
        yPoints.push(parseFloat((100 + y_val).toFixed(useWorkspaceStore.getState().decimals)));
      }

      // Linear regression fit
      const minX = Math.min(...xPoints);
      const maxX = Math.max(...xPoints);
      const lineX = [minX, maxX];
      const lineY = [r * (minX - 100) + 100, r * (maxX - 100) + 100];

      const tStat = r * Math.sqrt((count - 2) / (1 - r * r + 1e-9));
      const pValue = 2 * (1 - statsNormalCdf(Math.abs(tStat)));

      return {
        testId: 'correlation',
        name: "Test d'association linéaire (Corrélation de Pearson r)",
        h0: "Il n'y a pas de corrélation linéaire en population (H0 : ρ = 0)",
        h1: "Il existe une authentique liaison linéaire (H1 : ρ ≠ 0)",
        pLessMsg: "Les points s'organisent de manière structurée. Corrélation confirmée scientifiquement.",
        pHighMsg: "Le nuage ressemble à une nébuleuse désordonnée. On conserve H0 (liaison non prouvée).",
        metrics: [
          { label: "Coef Corrélation (r)", value: r.toFixed(useWorkspaceStore.getState().decimals), unit: "" },
          { label: "Échantillon (N)", value: count, unit: "pts" },
          { label: "Variance expliquée (r²)", value: ((r * r) * 100).toFixed(useWorkspaceStore.getState().decimals), unit: "%" },
          { label: "P-Value", value: pValue.toFixed(useWorkspaceStore.getState().decimals), unit: "", highlight: pValue < useWorkspaceStore.getState().alpha },
        ],
        rejected: pValue < useWorkspaceStore.getState().alpha,
        plotData: [
          {
            x: xPoints,
            y: yPoints,
            type: 'scatter',
            mode: 'markers',
            name: "Données Simulées",
            marker: { color: '#6366f1', size: 7, opacity: 0.75 }
          },
          {
            x: lineX,
            y: lineY,
            type: 'scatter',
            mode: 'lines',
            name: "Droite Racine (Pente)",
            line: { color: '#4f46e5', width: 3 }
          }
        ]
      };
    }

    // --- TEST 5: CHI-SQUARE CATEGORICAL ---
    if (hypoTestType === 'chi2' || hypoTestType === 'chi2_1samp') {
      const n = hypoSampleSize * 4; // Scale size for contingency
      const gap = chiGap; 
      const n_A = n / 2;
      const n_B = n / 2;

      const pA_success = 0.5 + gap / 2;
      const pB_success = 0.5 - gap / 2;

      const oA_success = Math.round(n_A * pA_success);
      const oA_fail = n_A - oA_success;
      const oB_success = Math.round(n_B * pB_success);
      const oB_fail = n_B - oB_success;

      // Chi2 calculations
      const totalSuccess = oA_success + oB_success;
      const totalFail = oA_fail + oB_fail;
      const tot = n;

      const expA_success = (n_A * totalSuccess) / tot;
      const expA_fail = (n_A * totalFail) / tot;
      const expB_success = (n_B * totalSuccess) / tot;
      const expB_fail = (n_B * totalFail) / tot;

      const chi2Stat = Math.pow(oA_success - expA_success, 2) / expA_success +
                        Math.pow(oA_fail - expA_fail, 2) / expA_fail +
                        Math.pow(oB_success - expB_success, 2) / expB_success +
                        Math.pow(oB_fail - expB_fail, 2) / expB_fail;

      // 1 degree of freedom p-value estimation
      const pValue = 2 * (1 - statsNormalCdf(Math.sqrt(Math.abs(chi2Stat))));
      
      let testTitle = "Test d'Indépendance du Chi-Deux (Tableau de contingence 2x2)";
      let h0Title = "La répartition de l'événement est indépendante du groupe (H0 : Indépendance)";
      if (hypoTestType === 'chi2_1samp') {
         testTitle = "Test d'Adéquation du Chi-Deux (Conformité de proportions)";
         h0Title = "Les proportions observées correspondent aux proportions théoriques (H0)";
      }

      return {
        testId: hypoTestType,
        name: testTitle,
        h0: h0Title,
        h1: "Il y a un écart significatif (H1)",
        pLessMsg: "Les proportions d'abonnements divergent de manière critique entre les groupes A et B.",
        pHighMsg: "La variation observée entre groupes est mineure et s'explique totalement par la fluctuation aléatoire.",
        metrics: [
          { label: "Chi-Deux (χ²)", value: chi2Stat.toFixed(useWorkspaceStore.getState().decimals), unit: "" },
          { label: "Écart apparent", value: (gap * 100).toFixed(0), unit: "%" },
          { label: "Échantillon (N)", value: tot, unit: "individus" },
          { label: "P-Value", value: pValue.toFixed(useWorkspaceStore.getState().decimals), unit: "", highlight: pValue < useWorkspaceStore.getState().alpha },
        ],
        rejected: pValue < useWorkspaceStore.getState().alpha,
        plotData: [
          {
            x: ["Groupe 1 - Cat. A", "Groupe 1 - Cat. B", "Groupe 2 - Cat. A", "Groupe 2 - Cat. B"],
            y: [oA_success, oA_fail, oB_success, oB_fail],
            type: 'bar',
            name: "Fréquences Observées",
            marker: { color: ['#3b82f6', '#93c5fd', '#ec4899', '#fbcfe8'] }
          }
        ]
      };
    }

    // --- TEST 6: NORMALITY CHECK (SHAPIRO-WILK) ---
    // skewness = 0 is normal, higher is non-normal (exponential bimodal etc)
    const count = Math.max(20, hypoSampleSize);
    const skew = skewness;
    const values: number[] = [];

    for (let i = 0; i < count; i++) {
      const z = getNormal(0, 1.2);
      if (skew === 0) {
        values.push(parseFloat(z.toFixed(useWorkspaceStore.getState().decimals)));
      } else {
        const u = -Math.log(rand() || 0.001); // exponential
        const noisySkew = z + skew * (u - 1);
        values.push(parseFloat(noisySkew.toFixed(useWorkspaceStore.getState().decimals)));
      }
    }

    // Sort to approximate histogram bar bins
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal;
    const binCount = 9;
    const binWidth = range / binCount;
    const histX: string[] = [];
    const histY: number[] = Array(binCount).fill(0);

    for (let b = 0; b < binCount; b++) {
      const start = minVal + b * binWidth;
      const end = start + binWidth;
      histX.push(`${start.toFixed(useWorkspaceStore.getState().decimals)} à ${end.toFixed(useWorkspaceStore.getState().decimals)}`);
    }

    values.forEach(v => {
      let bIdx = Math.floor((v - minVal) / (binWidth || 1));
      if (bIdx >= binCount) bIdx = binCount - 1;
      if (bIdx < 0) bIdx = 0;
      histY[bIdx]++;
    });

    const wStat = 1 / (1 + 0.07 * Math.pow(skew, 2));
    const pValue = skew < 0.4 ? 0.65 : Math.max(0.0001, 0.65 * Math.exp(-skew * 2.2));

    let testTitle = "Test de Normalité de Shapiro-Wilk (Diagnostic de Forme)";
    if (hypoTestType === 'kolmogorov') testTitle = "Test de normalité de Kolmogorov-Smirnov";

    return {
      testId: hypoTestType,
      name: testTitle,
      h0: "La variable examinée suit parfaitement une loi normale (H0 : Distribution Normale)",
      h1: "La distribution dévie significativement de la normale (H1 : Asymétrique / Autre)",
      pLessMsg: "Les données s'étirent anormalement vers un côté (asymétrie) ou forment une pointe non-conforme.",
      pHighMsg: "La forme de la cloche est conservée. Vos tests paramétriques classiques sont autorisés !",
      metrics: [
        { label: "Statistique W / D", value: wStat.toFixed(useWorkspaceStore.getState().decimals), unit: "" },
        { label: "Asymétrie appliquée", value: skew.toFixed(useWorkspaceStore.getState().decimals), unit: "" },
        { label: "N", value: count, unit: "obs" },
        { label: "P-Value", value: pValue.toFixed(useWorkspaceStore.getState().decimals), unit: "", highlight: pValue < useWorkspaceStore.getState().alpha },
      ],
      rejected: pValue < useWorkspaceStore.getState().alpha,
      plotData: [
        {
          x: histX,
          y: histY,
          type: 'bar',
          name: "Forme des données simulées",
          marker: { color: 'rgba(79, 70, 229, 0.5)', line: { color: '#4f46e5', width: 1.5 } }
        }
      ]
    };

  }, [hypoTestType, hypoPopMean, hypoPopStd, hypoSampleMean, hypoSampleSize, corrR, anovaMeanC, chiGap, skewness]);

  return (
    <div className="flex-1 w-full h-full flex flex-col p-6 bg-slate-50 font-sans overflow-y-auto">
      
      {/* HEADER */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-2 flex items-center justify-center w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm cursor-pointer"
              title="Retourner au menu d'accueil"
            >
              <ArrowLeft className="w-5 h-5 text-current" />
            </button>
          )}
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
            <Beaker className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Laboratoire de Simulations</h1>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full uppercase border border-indigo-200">ONBOARDING & LABS 2.0</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">Comprenez, visualisez et simulez la robustesse statistique en temps réel</p>
          </div>
        </div>
        
        {/* TAB SELECTOR & GUIDE BUTTON */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start lg:self-center">
          <button 
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs px-4.5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <BookOpen className="w-4 h-4 text-white" /> Guide d'Utilisation
          </button>

          <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button onClick={() => setActiveTab('whatif')} className={`px-4 py-2 font-bold text-sm rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'whatif' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <Zap className="w-4 h-4 text-blue-500" />What-If Réel
            </button>
            <button onClick={() => setActiveTab('desc')} className={`px-4 py-2 font-bold text-sm rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'desc' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <Target className="w-4 h-4 text-indigo-500" />1. Distributions
            </button>
            <button onClick={() => setActiveTab('hypo')} className={`px-4 py-2 font-bold text-sm rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'hypo' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <FlaskConical className="w-4 h-4 text-emerald-500" />2. Tests d'Hypothèses
            </button>
            <button onClick={() => setActiveTab('reg')} className={`px-4 py-2 font-bold text-sm rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'reg' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <LineChart className="w-4 h-4 text-rose-500" />3. Regressions & Outliers
            </button>
          </div>
        </div>
      </div>

      {/* WORKSPACE MAIN */}
      {activeTab === 'whatif' ? (
        <WhatIfSimulationView />
      ) : (
      <div className="flex flex-col lg:flex-row gap-6 min-h-[480px]">
        
        {/* SIDEBAR - CONTROLS */}
        <div className="w-full lg:w-80 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col shrink-0">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
             <span className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-500" /> Ajustements Curseur
             </span>
          </div>

          <div className="p-5 flex-1 space-y-6">
            
            {/* 1. DISTRIBUTIONS CONTROLS */}
            {activeTab === 'desc' && (
              <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} className="space-y-6">
                <div>
                   <label className="text-xs font-bold text-slate-700 uppercase">Moyenne Théorique (μ)</label>
                   <div className="flex items-center gap-3 mt-2">
                     <input type="range" min="-10" max="10" step="0.5" value={descMean} onChange={e => setDescMean(parseFloat(e.target.value))} className="flex-1 accent-indigo-600" />
                     <span className="text-sm font-mono font-bold w-8 text-right bg-slate-100 px-1 rounded">{descMean}</span>
                   </div>
                   <p className="text-[10px] text-slate-400 mt-1">Déplace le centre de gravité de la cloche vers le rouge ou le bleu.</p>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-700 uppercase">Écart-type (σ / Dispersion)</label>
                   <div className="flex items-center gap-3 mt-2">
                     <input type="range" min="0.1" max="5.0" step="0.1" value={descStd} onChange={e => setDescStd(parseFloat(e.target.value))} className="flex-1 accent-indigo-600" />
                     <span className="text-sm font-mono font-bold w-10 text-right bg-slate-100 px-1 rounded">{descStd.toFixed(useWorkspaceStore.getState().decimals)}</span>
                   </div>
                   <p className="text-[10px] text-slate-400 mt-1">Écarte les valeurs (aplatit la cloche) ou les regroupe autour du centre.</p>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-700 uppercase">Échantillon (N Observations)</label>
                   <div className="flex items-center gap-3 mt-2">
                     <input type="range" min="10" max="4000" step="10" value={descN} onChange={e => setDescN(parseInt(e.target.value))} className="flex-1 accent-indigo-600" />
                     <span className="text-sm font-mono font-bold w-12 text-right bg-slate-100 px-1 rounded">{descN}</span>
                   </div>
                   <p className="text-[10px] text-slate-400 mt-1">Augmenter N réduit le bruit aléatoire de l'histogramme empirique.</p>
                </div>
              </motion.div>
            )}

            {/* 2. HYPOTHESIS TESTING CONTROLS */}
            {activeTab === 'hypo' && (
              <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} className="space-y-4">
                
                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl mb-4">
                  <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block mb-1">Catégorie de Test</label>
                  <select 
                    value={hypoTestType}
                    onChange={e => setHypoTestType(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                  >
                    <option value="ttest_1samp">🎯 t-Test (1 groupe vs norme)</option>
                    <option value="wilcoxon_1samp">🎯 Wilcoxon (1 groupe vs norme)</option>
                    <option value="paired_ttest">🎯 t-Test apparié (Avant/Après)</option>
                    <option value="ttest_ind">👥 t-Test (Comparaison 2 groupes)</option>
                    <option value="welch">⚖️ t-Test de Welch (Variances inégales)</option>
                    <option value="mannwhitney">📊 Mann-Whitney (Non Paramétrique)</option>
                    <option value="anova">🎭 ANOVA (Comparaison k groupes)</option>
                    <option value="kruskal">📦 Kruskal-Wallis (ANOVA non paramétrique)</option>
                    <option value="correlation">📈 Corrélation (Liaison linéaire)</option>
                    <option value="chi2">🧩 Chi-Deux d'indépendance</option>
                    <option value="chi2_1samp">🧩 Chi-Deux d'adéquation (1 variable)</option>
                    <option value="shapiro">🌊 Shapiro-Wilk (Normalité)</option>
                    <option value="kolmogorov">🌊 Kolmogorov-Smirnov (Normalité)</option>
                  </select>
                </div>

                {/* SHARED CONTROLS MAPPED DEPENDING ON THE ACTIVE TEST TYPE */}
                
                {/* 2.1 Standard scale controls */}
                {(hypoTestType === 'ttest_1samp' || hypoTestType === 'wilcoxon_1samp' || hypoTestType === 'paired_ttest' || hypoTestType === 'ttest_ind' || hypoTestType === 'welch' || hypoTestType === 'mannwhitney' || hypoTestType === 'anova' || hypoTestType === 'kruskal') && (
                  <div>
                     <label className="text-xs font-bold text-slate-700 uppercase">
                       {(hypoTestType === 'ttest_1samp' || hypoTestType === 'wilcoxon_1samp' || hypoTestType === 'paired_ttest') && "Moyenne Observée (x̄)"}
                       {(hypoTestType === 'ttest_ind' || hypoTestType === 'welch' || hypoTestType === 'mannwhitney') && "Moyenne Groupe A"}
                       {(hypoTestType === 'anova' || hypoTestType === 'kruskal') && "Moyenne Groupe A"}
                     </label>
                     <div className="flex items-center gap-3 mt-2.5">
                       <input type="range" min="80" max="120" step="0.5" value={hypoSampleMean} onChange={e => setHypoSampleMean(parseFloat(e.target.value))} className="flex-1 accent-emerald-600" />
                       <span className="text-sm font-mono font-bold w-10 text-right bg-slate-100 px-1 rounded">{hypoSampleMean}</span>
                     </div>
                  </div>
                )}

                {(hypoTestType === 'ttest_1samp' || hypoTestType === 'ttest_ind' || hypoTestType === 'welch' || hypoTestType === 'mannwhitney' || hypoTestType === 'anova' || hypoTestType === 'kruskal') && (
                  <div>
                     <label className="text-xs font-bold text-slate-700 uppercase">
                       {hypoTestType === 'ttest_1samp' && "Seuil de Norme Theorique (μ0)"}
                       {(hypoTestType === 'ttest_ind' || hypoTestType === 'welch' || hypoTestType === 'mannwhitney') && "Moyenne Groupe B"}
                       {(hypoTestType === 'anova' || hypoTestType === 'kruskal') && "Moyenne Groupe B"}
                     </label>
                     <div className="flex items-center gap-3 mt-2.5">
                       <input type="range" min="80" max="120" step="0.5" value={hypoPopMean} onChange={e => setHypoPopMean(parseFloat(e.target.value))} className="flex-1 accent-emerald-600" />
                       <span className="text-sm font-mono font-bold w-10 text-right bg-slate-100 px-1 rounded">{hypoPopMean}</span>
                     </div>
                  </div>
                )}

                {/* 2.2 ANOVA / KRUSKAL mean C extra slider */}
                {(hypoTestType === 'anova' || hypoTestType === 'kruskal') && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase">Moyenne Groupe C</label>
                    <div className="flex items-center gap-3 mt-2.5">
                      <input type="range" min="80" max="120" step="0.5" value={anovaMeanC} onChange={e => setAnovaMeanC(parseFloat(e.target.value))} className="flex-1 accent-emerald-600" />
                      <span className="text-sm font-mono font-bold w-10 text-right bg-slate-100 px-1 rounded">{anovaMeanC}</span>
                    </div>
                  </div>
                )}

                {/* 2.3 Correlation slider */}
                {hypoTestType === 'correlation' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase">Force de Corrélation Target (r)</label>
                    <div className="flex items-center gap-3 mt-2.5">
                      <input type="range" min="-1.0" max="1.0" step="0.05" value={corrR} onChange={e => setCorrR(parseFloat(e.target.value))} className="flex-1 accent-emerald-600" />
                      <span className="text-sm font-mono font-bold w-12 text-right bg-slate-100 px-1 rounded">{corrR.toFixed(useWorkspaceStore.getState().decimals)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">1 = liaison parfaite ascendante, -1 = liaison parfaite descendante, 0 = nébuleuse totale.</p>
                  </div>
                )}

                {/* 2.4 Chi-square Gap */}
                {hypoTestType === 'chi2' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase">Écart de Proportions appliqué</label>
                    <div className="flex items-center gap-3 mt-2.5">
                      <input type="range" min="-0.4" max="0.4" step="0.02" value={chiGap} onChange={e => setChiGap(parseFloat(e.target.value))} className="flex-1 accent-emerald-600" />
                      <span className="text-sm font-mono font-bold w-12 text-right bg-slate-100 px-1 rounded">{(chiGap * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Différence de probabilité d'abonnement entre les deux groupes.</p>
                  </div>
                )}

                {/* 2.5 Normal Shape Skewness */}
                {hypoTestType === 'shapiro' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase">Écart de Normalité (Asymétrie)</label>
                    <div className="flex items-center gap-3 mt-2.5">
                      <input type="range" min="0" max="3" step="0.1" value={skewness} onChange={e => setSkewness(parseFloat(e.target.value))} className="flex-1 accent-emerald-600" />
                      <span className="text-sm font-mono font-bold w-12 text-right bg-slate-100 px-1 rounded">{skewness}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">0 = Distribution normale (cloche). Plus la valeur monte, plus la loi s'étire et perd son profil d'origine.</p>
                  </div>
                )}

                {/* 2.6 Shared standard dispersion Controls (except for correlation, chi2) */}
                {hypoTestType !== 'correlation' && hypoTestType !== 'chi2' && (
                  <div className="pt-3 border-t border-slate-100">
                     <label className="text-xs font-bold text-slate-700 uppercase">Variabilité (σ Écart-Type)</label>
                     <div className="flex items-center gap-3 mt-2">
                       <input type="range" min="5" max="30" step="0.5" value={hypoPopStd} onChange={e => setHypoPopStd(parseFloat(e.target.value))} className="flex-1 accent-emerald-600" />
                       <span className="text-sm font-mono font-bold w-10 text-right bg-slate-100 px-1 rounded">{hypoPopStd}</span>
                     </div>
                  </div>
                )}

                {/* 2.7 Sample size N */}
                <div className="pt-3 border-t border-slate-100">
                   <label className="text-xs font-bold text-slate-700 uppercase">Taille Échantillon (N)</label>
                   <div className="flex items-center gap-3 mt-2">
                     <input type="range" min="5" max="250" step="1" value={hypoSampleSize} onChange={e => setHypoSampleSize(parseInt(e.target.value))} className="flex-1 accent-emerald-600" />
                     <span className="text-sm font-mono font-bold w-10 text-right bg-slate-100 px-1 rounded">{hypoSampleSize}</span>
                   </div>
                   <p className="text-[10px] text-slate-400 mt-1.5"><strong className="text-emerald-700">Règle d'or :</strong> Plus N augmente, plus l'influence de l'aléa diminue, ce qui rétrécit la marge de doute et facilite le rejet de H0 !</p>
                </div>

              </motion.div>
            )}

            {/* 3. REGRESSION CONTROLS */}
            {activeTab === 'reg' && (
              <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} className="space-y-6">
                <div>
                   <label className="text-xs font-bold text-slate-700 uppercase">Pente Racine théorique (Slope)</label>
                   <div className="flex items-center gap-3 mt-2">
                     <input type="range" min="-5" max="5" step="0.5" value={regSlope} onChange={e => setRegSlope(parseFloat(e.target.value))} className="flex-1 accent-rose-600" />
                     <span className="text-sm font-mono font-bold w-10 text-right bg-slate-100 px-1 rounded">{regSlope.toFixed(useWorkspaceStore.getState().decimals)}</span>
                   </div>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-700 uppercase">Dispersion / Bruit Gaussian</label>
                   <div className="flex items-center gap-3 mt-2">
                     <input type="range" min="0" max="20" step="1" value={regNoise} onChange={e => setRegNoise(parseFloat(e.target.value))} className="flex-1 accent-rose-600" />
                     <span className="text-sm font-mono font-bold w-8 text-right bg-slate-100 px-1 rounded">{regNoise}</span>
                   </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                   <div className="flex items-center justify-between mb-4">
                      <label className="text-xs font-bold text-slate-700 uppercase">Injecter un Point Aberrant</label>
                      <input type="checkbox" checked={regHasOutlier} onChange={e => setRegHasOutlier(e.target.checked)} className="w-4 h-4 rounded text-rose-600 cursor-pointer" />
                   </div>
                   
                   {regHasOutlier && (
                    <div className="space-y-4 bg-rose-50 p-3 rounded-xl border border-rose-100">
                      <div>
                        <label className="text-[10px] font-bold text-rose-700 uppercase flex justify-between">
                          <span>Outlier Position X</span>
                          <span className="text-rose-600 font-mono">{regOutlierX}</span>
                        </label>
                        <input type="range" min="0" max="25" step="1" value={regOutlierX} onChange={e => setRegOutlierX(parseFloat(e.target.value))} className="w-full accent-rose-600 mt-1" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-rose-700 uppercase flex justify-between">
                          <span>Outlier Position Y (Effet de levier)</span>
                          <span className="text-rose-600 font-mono">{regOutlierY}</span>
                        </label>
                        <input type="range" min="-30" max="60" step="1" value={regOutlierY} onChange={e => setRegOutlierY(parseFloat(e.target.value))} className="w-full accent-rose-600 mt-1" />
                      </div>
                    </div>
                   )}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* MAIN PANE - RESULTS & CHARTS */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          
          {/* EXPERIMENT CLINICAL / EXPLANATIVE INFO CARD */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 shrink-0 flex items-start gap-4">
             <div className="mt-1 shrink-0">
               {activeTab === 'desc' && <Target className="w-6 h-6 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />}
               {activeTab === 'hypo' && <FlaskConical className="w-6 h-6 text-emerald-500 animate-pulse" />}
               {activeTab === 'reg' && <LineChart className="w-6 h-6 text-rose-500" />}
             </div>
             
             <div className="flex-1">
               {activeTab === 'desc' && (
                 <>
                   <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-1">Impact de la Variante & Moyenne</h3>
                    <div className="mt-2 mb-3 bg-gradient-to-r from-indigo-50/80 to-purple-50/60 border border-indigo-100 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-indigo-650 animate-pulse shrink-0" />
                        <span className="text-[11px] text-indigo-950 font-semibold leading-normal">
                          Données fictives d'entraînement. Pour simuler sur votre <strong>propre jeu de données réel</strong>, utilisez l'onglet <strong className="text-indigo-700">What-If Réel</strong> !
                        </span>
                      </div>
                      <button onClick={() => setActiveTab('whatif')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider transition shrink-0 cursor-pointer shadow-xs">
                        Simuler ➔
                      </button>
                    </div>
                   <p className="text-sm text-slate-600 leading-relaxed">
                     L'écart-type (σ) représente la certitude moyenne de vos données. 
                     Plus l'écart-type est grand, plus la courbe s'aplatit car l'incertitude se propage.
                     <br/><span className="text-indigo-600 font-semibold">✨ Loi des grands nombres : Plus N est grand, plus l'histogramme empirique épouse la courbe théorique.</span>
                   </p>
                 </>
               )}
               {activeTab === 'hypo' && computedHypoData && (
                 <>
                   <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-1">{computedHypoData.name}</h3>
                    <div className="mt-2 mb-3 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border border-emerald-100 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-650 animate-pulse shrink-0" />
                        <span className="text-[11px] text-emerald-950 font-semibold leading-normal">
                          Loi théorique échantillonnée. Pour appliquer ce test sur <strong>vos colonnes réelles</strong> et simuler des écarts, utilisez l'onglet <strong className="text-emerald-700">What-If Réel</strong> !
                        </span>
                      </div>
                      <button onClick={() => setActiveTab('whatif')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider transition shrink-0 cursor-pointer shadow-xs">
                        Simuler ➔
                      </button>
                    </div>
                   <div className="text-slate-600 text-sm space-y-1 mt-1 leading-relaxed">
                     <div><strong className="text-slate-800">Hypothèse Nulle (H0) :</strong> <span className="font-medium">{computedHypoData.h0}</span></div>
                     <div><strong className="text-slate-800">Hypothèse Alternative (H1) :</strong> <span className="font-medium">{computedHypoData.h1}</span></div>
                   </div>
                 </>
               )}
               {activeTab === 'reg' && (
                 <>
                   <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-1">Analyse des Moindres Carrés (MCO) & Effet de Levier</h3>
                    <div className="mt-2 mb-3 bg-gradient-to-r from-rose-50/80 to-orange-50/60 border border-rose-100 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-rose-650 animate-pulse shrink-0" />
                        <span className="text-[11px] text-rose-950 font-semibold leading-normal">
                          Visualisation pédagogique. Pour simuler l'effet de décalages ou de bruits sur vos <strong>droites de régression réelles</strong>, utilisez <strong className="text-rose-700">What-If Réel</strong> !
                        </span>
                      </div>
                      <button onClick={() => setActiveTab('whatif')} className="bg-rose-600 hover:bg-rose-700 text-white font-black px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider transition shrink-0 cursor-pointer shadow-xs">
                        Simuler ➔
                      </button>
                    </div>
                   <p className="text-sm text-slate-600 leading-relaxed">
                     La régression ordinaire cherche à réduire au minimum l'écart au carré de chaque point à la droite.
                     <br/><span className="text-rose-600 font-semibold">✨ Cochez l'outlier et éloignez-le sur l'axe X : il capte le pivot de la droite, fausse la pente et ruine le R². C'est l'effet de levier.</span>
                   </p>
                 </>
               )}
             </div>
          </div>

          {/* VISUALIZATION PANE */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-1 relative flex flex-col items-center justify-center min-h-[580px] overflow-hidden">
             
             {/* 1. VISUALIZATION - DESCRIPTIVE */}
             {activeTab === 'desc' && descData && descData.success && (
                <div className="w-full h-full flex flex-col">
                   <div className="flex gap-4 mb-4 px-4 pb-4 border-b border-slate-100">
                     <div className="bg-indigo-50/50 px-4 py-1.5 rounded-xl border border-indigo-100">
                       <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Moyenne Mesurée (x̄)</div>
                       <div className="text-lg font-black text-indigo-700 font-mono">{(descData.metrics?.mean_actual ?? 0).toFixed(useWorkspaceStore.getState().decimals)}</div>
                     </div>
                     <div className="bg-purple-50/50 px-4 py-1.5 rounded-xl border border-purple-100">
                       <div className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Écart-Type Empirique</div>
                       <div className="text-lg font-black text-purple-700 font-mono">{(descData.metrics?.std_actual ?? 0).toFixed(useWorkspaceStore.getState().decimals)}</div>
                     </div>
                   </div>
                   <div className="flex-1 w-full min-h-0">
                     <Plot
                       data={[
                         {
                           x: descData.plots.hist_x,
                           y: descData.plots.hist_y,
                           type: 'bar',
                           name: 'Histogramme Observé (Empirique)',
                           marker: { color: 'rgba(99, 102, 241, 0.35)' }
                         },
                         {
                           x: descData.plots.pdf_x,
                           y: descData.plots.pdf_y,
                           type: 'scatter',
                           mode: 'lines',
                           name: 'Modèle Théorique (Loi de Gauss)',
                           line: { color: '#4f46e5', width: 3 }
                         }
                       ]}
                       layout={{ 
                          autosize: true, 
                          margin: { t: 10, b: 40, l: 45, r: 20 }, 
                          plot_bgcolor:'transparent', 
                          paper_bgcolor:'transparent', 
                          showlegend: true, 
                          legend: { orientation: 'h', y: -0.15 } 
                       }}
                       useResizeHandler={true} 
                       style={{ width: "100%", height: "100%" }}
                       config={{ displayModeBar: false }}
                     />
                   </div>
                </div>
             )}

             {/* 2. VISUALIZATION - HYPOTHESIS PLOTTING */}
             {activeTab === 'hypo' && computedHypoData && (
               <div className="w-full h-full flex flex-col">
                  {/* METRICS ROW */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 px-4 pb-4 border-b border-slate-100">
                    {computedHypoData.metrics.map((m: any) => (
                      <div key={m.label} className={`px-4 py-1.5 rounded-xl border ${m.highlight ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`text-[10px] font-bold uppercase tracking-widest ${m.highlight ? 'text-rose-600' : 'text-slate-500'}`}>{m.label}</div>
                        <div className={`text-lg font-black font-mono ${m.highlight ? 'text-rose-700' : 'text-slate-800'}`}>
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CONCLUSION STRIP */}
                  <div className={`mb-4 mx-4 p-3 rounded-xl border flex items-center gap-3 text-xs ${
                    computedHypoData.rejected 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                      : 'bg-amber-50 border-amber-100 text-amber-850'
                  }`}>
                    {computedHypoData.rejected ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div>
                          <strong className="text-emerald-900">Résultat Significatif (Rejet de H0, p &lt; 0.05) :</strong>{" "}
                          {computedHypoData.pLessMsg}
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div>
                          <strong className="text-amber-900">Résultat Non-Significatif (Conservation H0, p ≥ 0.05) :</strong>{" "}
                          {computedHypoData.pHighMsg}
                        </div>
                      </>
                    )}
                  </div>

                  {/* DISPLAY GRAPHIC */}
                  <div className="flex-1 w-full min-h-0">
                     <Plot
                       data={computedHypoData.plotData}
                       layout={{ 
                          autosize: true, 
                          margin: { t: 20, b: 35, l: 45, r: 20 }, 
                          plot_bgcolor:'transparent', 
                          paper_bgcolor:'transparent',
                          shapes: computedHypoData.layoutShapes || [],
                          annotations: computedHypoData.annotations || [],
                          showlegend: true,
                          legend: { orientation: 'h', y: -0.15 }
                       }}
                       useResizeHandler={true} 
                       style={{ width: "100%", height: "100%" }}
                       config={{ displayModeBar: false }}
                     />
                  </div>
               </div>
             )}

             {/* 3. VISUALIZATION - LINEAR REGRESSIONS */}
             {activeTab === 'reg' && regData && regData.success && (
                <div className="w-full h-full flex flex-col">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4 px-4 pb-4 border-b border-slate-100">
                     <div className="bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200">
                       <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">R² (Sans Point Aberrant)</div>
                       <div className="text-lg font-black text-slate-800 font-mono">{((regData.metrics?.r_squared_clean ?? 0) * 100).toFixed(useWorkspaceStore.getState().decimals)}%</div>
                     </div>
                     <div className={`px-4 py-1.5 rounded-xl border ${regHasOutlier ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                       <div className={`text-[10px] font-bold uppercase tracking-widest ${regHasOutlier ? 'text-amber-700' : 'text-slate-500'}`}>R² Réduit (Avec Outlier)</div>
                       <div className={`text-lg font-black font-mono ${regHasOutlier ? 'text-amber-800' : 'text-slate-800'}`}>{((regData.metrics?.r_squared_all ?? 0) * 100).toFixed(useWorkspaceStore.getState().decimals)}%</div>
                     </div>
                     <div className="bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200">
                       <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pente finale</div>
                       <div className="text-lg font-black text-slate-800 font-mono">{(regData.metrics?.slope_all ?? 0).toFixed(useWorkspaceStore.getState().decimals)}</div>
                     </div>
                     <div className="bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200">
                       <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">P-Value de Pente</div>
                       <div className="text-lg font-black text-slate-800 font-mono">{(regData.metrics?.p_value_all ?? 0).toFixed(useWorkspaceStore.getState().decimals)}</div>
                     </div>
                  </div>

                  {/* ÉQUATIONS DE RÉGRESSION EN TEMPS RÉEL (LABO) */}
                  <div className="mb-4 bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col md:flex-row items-center justify-around gap-4 text-center select-none shrink-0 mx-4">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-semibold text-blue-650 uppercase tracking-widest">Équation sans Outlier (Modèle Réel)</span>
                      <span className="text-base font-black text-blue-700 font-mono mt-1">
                        Y = {(regData.metrics?.slope_clean ?? regSlope).toFixed(useWorkspaceStore.getState().decimals)} • X + {(regData.metrics?.intercept_clean ?? 5.0).toFixed(useWorkspaceStore.getState().decimals)}
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">Théorie de départ sans bruit : Y = {regSlope.toFixed(useWorkspaceStore.getState().decimals)} • X + 5.0</span>
                    </div>

                    {regHasOutlier && (
                      <div className="hidden md:block w-px h-10 bg-slate-300"></div>
                    )}

                    {regHasOutlier && (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-widest">Équation avec Outlier (Effet Levier)</span>
                        <span className="text-base font-black text-rose-600 font-mono mt-1">
                          Y = {(regData.metrics?.slope_all ?? regSlope).toFixed(useWorkspaceStore.getState().decimals)} • X + {(regData.metrics?.intercept_all ?? 5.0).toFixed(useWorkspaceStore.getState().decimals)}
                        </span>
                        <span className="text-[9px] text-rose-500 font-medium mt-0.5">
                          L'aberrant pivote la droite de régression !
                         </span>
                       </div>
                     )}
                   </div>

                   <div className="flex-1 w-full min-h-0">
                     <Plot
                       data={[
                         {
                           x: regData.plots.scatter_x,
                           y: regData.plots.scatter_y,
                           type: 'scatter',
                           mode: 'markers',
                           name: 'Points Réels & Aléatoires',
                           marker: { color: '#64748b', size: 7.5 }
                         },
                         {
                           x: regData.plots.line_x,
                           y: regData.plots.line_y_clean,
                           type: 'scatter',
                           mode: 'lines',
                           name: 'Ligne modèle idéal (Sans Outlier)',
                           line: { color: '#3b82f6', width: 2.5, dash: 'dash' }
                         },
                         {
                           x: regData.plots.line_x,
                           y: regData.plots.line_y_all,
                           type: 'scatter',
                           mode: 'lines',
                           name: 'Ligne déformée par l\'Outlier',
                           line: { color: '#f43f5e', width: 3 }
                         }
                       ]}
                       layout={{ 
                          autosize: true, 
                          margin: { t: 15, b: 35, l: 45, r: 20 }, 
                          plot_bgcolor:'transparent', 
                          paper_bgcolor:'transparent', 
                          showlegend: true, 
                          legend: { orientation: 'h', y: -0.15 } 
                       }}
                       useResizeHandler={true} 
                       style={{ width: "100%", height: "100%" }}
                       config={{ displayModeBar: false }}
                     />
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>
      )}

      {/* MODAL MODERNE : GUIDE COMPLET DE L'UTILISATEUR */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in-80 zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-150 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BookOpen className="w-6 h-6 text-indigo-600 shrink-0" />
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight">Guide d'Utilisation du Compagnon-Simulateur</h2>
                  <p className="text-xs text-slate-500 font-semibold">Mécaniques, leviers et interprétation de la sensibilité en temps réel</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGuideModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Scrollable Accordions */}
            <div className="p-6 overflow-y-auto space-y-4">
              
              {/* Item 1 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-slate-50/30">
                <button 
                  onClick={() => setOpenTutorialIndex(openTutorialIndex === 0 ? null : 0)}
                  className="w-full bg-white hover:bg-slate-50 p-4 font-bold text-sm text-slate-800 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded uppercase">What-If</span>
                    Comment exploiter le Simulateur What-If (Scénarios Réels) ?
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${openTutorialIndex === 0 ? 'rotate-90' : ''}`} />
                </button>
                {openTutorialIndex === 0 && (
                  <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100 space-y-2">
                    <p>
                      Le simulateur What-If est conçu pour tester la <strong>sensibilité</strong> de vos modèles de données :
                    </p>
                    <ol className="list-decimal pl-4 space-y-1.5 font-medium text-slate-705">
                      <li>Sélectionnez une variable numérique pour voir son scatter ou ses distributions.</li>
                      <li>Utilisez les 3 réglettes à gauche pour appliquer des modificateurs :
                        <ul className="list-disc pl-4 mt-1 font-normal text-slate-600">
                          <li><strong>Multiplier (Echelle/Scale) :</strong> Amplifie ou compresse l'amplitude.</li>
                          <li><strong>Décaler (Offset) :</strong> Ajoute une constante (positive ou négative) à l'ensemble des données.</li>
                          <li><strong>Bruit Gaussien :</strong> Injecte une perturbation aléatoire contrôlée simulant l'incertitude.</li>
                        </ul>
                      </li>
                      <li>Le graphique compare instantanément la courbe d'origine (pointillés gris) à la courbe altérée (bleu foncé continu).</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Item 2 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-slate-50/30">
                <button 
                  onClick={() => setOpenTutorialIndex(openTutorialIndex === 1 ? null : 1)}
                  className="w-full bg-white hover:bg-slate-50 p-4 font-bold text-sm text-slate-800 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded uppercase">Hypothèses</span>
                    Comment lire et comprendre les Tests d'Hypothèses ?
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${openTutorialIndex === 1 ? 'rotate-90' : ''}`} />
                </button>
                {openTutorialIndex === 1 && (
                  <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100 space-y-2">
                    <p>
                      Dans l'onglet <strong>Tests d'Hypothèses</strong>, vous manipulez des paramètres théoriques pour en comprendre directement l'effet statistique :
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 bg-white">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <strong className="text-slate-800 block mb-1 font-bold">🎯 t-Test & ANOVA (Moyennes)</strong>
                        Réglez le gap des moyennes : observez les distributions s'écarter. Augmentez l'écart-type : observez les courbes se chevaucher de nouveau, réduisant à néant le pouvoir discriminatoire du test (p-value augmente).
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <strong className="text-slate-800 block mb-1 font-bold">📈 Corrélation (r)</strong>
                        Ajustez l'indice de Pearson de -1.0 à +1.0 : observez en temps réel le nuage se condenser en une ligne parfaite ou s'effondrer sous l'effet du bruit.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Item 3 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-slate-50/30">
                <button 
                  onClick={() => setOpenTutorialIndex(openTutorialIndex === 2 ? null : 2)}
                  className="w-full bg-white hover:bg-slate-50 p-4 font-bold text-sm text-slate-800 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] bg-rose-100 text-rose-800 font-black px-2 py-0.5 rounded uppercase">Régression & Levier</span>
                    Comment comprendre l'effet de Levier sur les Régressions ?
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${openTutorialIndex === 2 ? 'rotate-90' : ''}`} />
                </button>
                {openTutorialIndex === 2 && (
                  <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100 space-y-2">
                    <p>
                      Dans l'onglet <strong>Regressions & Outliers</strong> :
                    </p>
                    <p>
                      Cochez <strong>Injecter un Point Aberrant</strong>. Déplacez sa coordonnée X aux limites extrêmes du repère et variez grandement Y.
                    </p>
                    <p className="bg-rose-50/50 p-3 rounded-lg border border-rose-150 text-rose-900 font-bold text-xs leading-relaxed">
                      ⚠️ Observez la ligne rouge (modèle global avec outlier) être violemment déviée et pivoter sous l'effet d'attraction géométrique de ce point unique. L'équation de régression affichée change instantanément, illustrant le pouvoir néfaste des valeurs aberrantes non traitées.
                    </p>
                  </div>
                )}
              </div>

              {/* Item 4 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-slate-50/30">
                <button 
                  onClick={() => setOpenTutorialIndex(openTutorialIndex === 3 ? null : 3)}
                  className="w-full bg-white hover:bg-slate-50 p-4 font-bold text-sm text-slate-800 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded uppercase">Lois</span>
                    P-Value & R² : Qu'est-ce que cela signifie ?
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${openTutorialIndex === 3 ? 'rotate-90' : ''}`} />
                </button>
                {openTutorialIndex === 3 && (
                  <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100 space-y-3">
                    <div>
                      <strong className="text-slate-805 block">La P-Value (Probabilité critique)</strong>
                      La probabilité d'obtenir un résultat au moins aussi extrême si l'hypothèse nulle était purement vraie (le hasard seul).
                      <ul className="list-disc pl-4 mt-1 font-semibold text-slate-700">
                        <li><strong className="text-emerald-700">p &lt; 0.05 :</strong> Rejet de H0. Preuve robuste que la différence/relation observée est significative.</li>
                        <li><strong className="text-amber-800">p &ge; 0.05 :</strong> Non significatif. L'hypothèse nulle n'est pas rejetée.</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="text-slate-805 block font-bold">R² (Coefficient de détermination)</strong>
                      Représente la part de variance de Y (de 0 à 100%) entièrement spécifiée ou capturée par les mouvements de X. Plus il est proche de 100%, plus les points gravitent près de la courbe idéale.
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-150 bg-slate-50 flex justify-end gap-3 rounded-b-3xl">
              <button 
                onClick={() => setShowGuideModal(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
              >
                Compris, fermer le guide
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
