import React, { useState, useMemo } from 'react';
import { useWorkspaceStore } from '../store';
import { StatType } from '../types';
import { 
  BarChart2, 
  HelpCircle,
  X, 
  Sliders, 
  Type, 
  Palette, 
  ArrowRight, 
  Grid, 
  Download, 
  Sparkles, 
  Layers, 
  RefreshCw,
  Hash,
  Type as LetterIcon,
  Calendar,
  MousePointer,
  PieChart as PieIcon,
  Layers2,
  Info
} from 'lucide-react';
import Plot from 'react-plotly.js';
import { toast } from 'sonner';
import FolderSelector from './FolderSelector';
import { getApi } from '../pywebview';

// Palette definitions matching sophisticated Nuru styling
const PALETTES = {
  emeraldIndigo: {
    name: 'Émeraude & Indigo',
    colors: ['#10b981', '#6366f1', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'],
    background: 'linear-gradient(to right, #10b981, #6366f1)'
  },
  classicViolet: {
    name: 'Crépuscule Indigo',
    colors: ['#4f46e5', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#312e81', '#4338ca', '#5850ec'],
    background: 'linear-gradient(to right, #4f46e5, #818cf8)'
  },
  oceanBreeze: {
    name: 'Brise Océane',
    colors: ['#06b6d4', '#0ea5e9', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a', '#0891b2', '#0284c7'],
    background: 'linear-gradient(to right, #06b6d4, #2563eb)'
  },
  sunsetWarmth: {
    name: 'Aurore Chaude',
    colors: ['#f97316', '#ef4444', '#ec4899', '#f43f5e', '#d946ef', '#f59e0b', '#f43f5e', '#ea580c'],
    background: 'linear-gradient(to right, #f97316, #ec4899)'
  },
  monochrome: {
    name: 'Nuances d\'Acier',
    colors: ['#475569', '#64748b', '#94a3b8', '#cbd5e1', '#334155', '#1e293b', '#475569', '#0f172a'],
    background: 'linear-gradient(to right, #475569, #94a3b8)'
  }
};

type PaletteKey = keyof typeof PALETTES;

export default function ChartDesigner() {
  const columns = useWorkspaceStore((state) => state.columns);
  const previewData = useWorkspaceStore((state) => state.previewData);
  const datasetName = useWorkspaceStore((state) => state.datasetName);
  const addAnalysisResult = useWorkspaceStore((state) => state.addAnalysisResult);

  const [chartDataRows, setChartDataRows] = useState<Record<string, any>[]>([]);

  React.useEffect(() => {
    let active = true;
    const fetchFullData = async () => {
      try {
        const api = getApi();
        const res = await api.get_full_dataset();
        if (res && res.success && res.data && active) {
          setChartDataRows(res.data);
        }
      } catch (e) {
        console.error("Erreur de récupération du dataset complet pour le graphique :", e);
      }
    };
    fetchFullData();
    return () => {
      active = false;
    };
  }, [datasetName]);

  const activeRows = chartDataRows.length > 0 ? chartDataRows : previewData;

  // Axis and Group variables state
  const [selectedX, setSelectedX] = useState<string | null>(null);
  const [selectedY, setSelectedY] = useState<string | null>(null);
  const [selectedZ, setSelectedZ] = useState<string | null>(null); // Z stands for Group/Color variable

  // Graphical customization states
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customXLabel, setCustomXLabel] = useState<string>('');
  const [customYLabel, setCustomYLabel] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedPalette, setSelectedPalette] = useState<PaletteKey>('emeraldIndigo');
  const [manualChartType, setManualChartType] = useState<string>('auto');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showTrendline, setShowTrendline] = useState<boolean>(false);
  const [markerSize, setMarkerSize] = useState<number>(8);
  const [isMenuOpenX, setIsMenuOpenX] = useState<string | null>(null);
  const [isPalettePanelExpanded, setIsPalettePanelExpanded] = useState<boolean>(true);
  const [selectedSummaryStat, setSelectedSummaryStat] = useState<string>('mean');
  const [showValueLabels, setShowValueLabels] = useState<boolean>(false);

  // Local drag-and-drop tracking
  const [draggedVar, setDraggedVar] = useState<string | null>(null);
  const [activeDragTarget, setActiveDragTarget] = useState<string | null>(null);

  // Reset designer
  const handleReset = () => {
    setSelectedX(null);
    setSelectedY(null);
    setSelectedZ(null);
    setCustomTitle('');
    setCustomXLabel('');
    setCustomYLabel('');
    setManualChartType('auto');
    setShowTrendline(false);
    setMarkerSize(8);
    setSelectedSummaryStat('mean');
    setShowValueLabels(false);
  };

  // Helper utility to get column statistic type
  const getType = (colName: string | null): StatType | null => {
    if (!colName) return null;
    return columns.find((c) => c.name === colName)?.type || null;
  };

  const isQuant = (type: StatType | null): boolean => {
    return type === 'continuous' || type === 'discrete';
  };

  const isQual = (type: StatType | null): boolean => {
    return type === 'nominal' || type === 'ordinal';
  };

  // 1. Smart Chart Recommender System
  // Evaluates variables selected on axes and deduces best fit chart type
  const autoChartType = useMemo(() => {
    if (!selectedX) return 'empty';

    const typeX = getType(selectedX);
    const typeY = selectedY ? getType(selectedY) : null;

    if (!selectedY) {
      if (isQuant(typeX)) {
        return 'histogram'; // Continuous numerical -> distribution histogram
      } else {
        return 'bar_count'; // Categorical nominal/ordinal -> frequency bar count
      }
    } else {
      // Y is selected
      if (isQual(typeX) && isQuant(typeY)) {
        return 'bar_average'; // Categories vs Numeric average values
      }
      if (isQuant(typeX) && isQuant(typeY)) {
        return 'scatter'; // Numeric vs Numeric scatter relationship
      }
      if (isQual(typeX) && isQual(typeY)) {
        return 'bar_stacked'; // Crosstab categories frequency
      }
      if (isQuant(typeX) && isQual(typeY)) {
        return 'boxplot_grouped'; // Numerical values distributed per category
      }
    }

    return 'bar_count';
  }, [selectedX, selectedY]);

  // Use recommended type if "auto" is chosen, else respect manual user override
  const currentChartType = manualChartType === 'auto' ? autoChartType : manualChartType;

  // Compute available optional chart overrides based on active selection
  const availableChartOverrides = useMemo(() => {
    if (!selectedX) return [];

    const typeX = getType(selectedX);
    const typeY = selectedY ? getType(selectedY) : null;

    if (!selectedY) {
      if (isQuant(typeX)) {
        return [
          { value: 'auto', label: 'Sélection Automatique' },
          { value: 'histogram', label: 'Histogramme de distribution' },
          { value: 'box_single', label: 'Boîte à moustaches' },
          { value: 'violin_single', label: 'Diagramme en Violon' },
          { value: 'line_cumulative', label: 'Courbe cumulative de fréquence' },
          { value: 'area_cumulative', label: 'Courbe d’aire cumulative' },
          { value: 'qqplot', label: 'Q-Q Plot (Quantile-Quantile)' },
          { value: 'ppplot', label: 'P-P Plot (Probabilité-Probabilité)' }
        ];
      } else {
        return [
          { value: 'auto', label: 'Sélection Automatique' },
          { value: 'bar_count', label: 'Graphique en barres d’effectif' },
          { value: 'pie', label: 'Diagramme circulaire' },
          { value: 'donut', label: 'Diagramme en anneaux (Donut)' },
          { value: 'horizontal_bar', label: 'Barres horizontales' },
          { value: 'funnel', label: 'Entonnoir de répartition' }
        ];
      }
    } else {
      if (isQual(typeX) && isQuant(typeY)) {
        return [
          { value: 'auto', label: 'Sélection Automatique' },
          { value: 'bar_average', label: 'Barres des moyennes' },
          { value: 'boxplot_grouped', label: 'Boîte à moustaches groupée' },
          { value: 'violin_grouped', label: 'Diagramme en Violon groupé' },
          { value: 'line_average', label: 'Courbe d’évolution des moyennes' },
          { value: 'area_average', label: 'Courbe d’aire des moyennes' },
          { value: 'strip_plot', label: 'Dispersion par points (Strip plot)' }
        ];
      }
      if (isQuant(typeX) && isQuant(typeY)) {
        return [
          { value: 'auto', label: 'Sélection Automatique' },
          { value: 'scatter', label: 'Nuage de points' },
          { value: 'bubble', label: 'Graphique à bulles' },
          { value: 'line', label: 'Courbe d’évolution linéaire' },
          { value: 'area_evolution', label: 'Courbe d’aire (Évolution)' },
          { value: 'spline_interpolation', label: 'Courbe d’évolution lissée (Spline)' },
          { value: 'density_contour', label: 'Contours de densité' }
        ];
      }
      if (isQual(typeX) && isQual(typeY)) {
        return [
          { value: 'auto', label: 'Sélection Automatique' },
          { value: 'bar_stacked', label: 'Barres empilées' },
          { value: 'bar_grouped', label: 'Barres groupées' },
          { value: 'heatmap', label: 'Tableau croisé thermique (Heatmap)' },
          { value: 'sunburst', label: 'Rings hiérarchisés (Sunburst)' }
        ];
      }
      if (isQuant(typeX) && isQual(typeY)) {
        return [
          { value: 'auto', label: 'Sélection Automatique' },
          { value: 'boxplot_grouped', label: 'Boîte à moustaches groupée' },
          { value: 'violin_grouped', label: 'Diagramme en Violon groupé' },
          { value: 'strip_plot', label: 'Dispersion par points (Strip)' }
        ];
      }
    }

    return [{ value: 'auto', label: 'Sélection Automatique' }];
  }, [selectedX, selectedY]);

  // Compute Plotly structure dynamically based on chosen/inferred chart type and data
  const plotDataAndLayout = useMemo(() => {
    if (!selectedX || activeRows.length === 0) return { data: [], layout: {} };

    const palette = PALETTES[selectedPalette].colors;
    const xName = selectedX;
    const yName = selectedY || '';
    const zName = selectedZ || '';

    let traces: any[] = [];
    let computedTitle = customTitle || `Graphique de ${xName}${selectedY ? ` en fonction de ${yName}` : ''}`;
    let xtitle = customXLabel || xName;
    let ytitle = customYLabel || (selectedY ? yName : 'Effectif/Fréquence');

    const typeX = getType(selectedX);
    const typeY = getType(selectedY);
    const typeZ = getType(selectedZ);

    // Filter null rows for variables of interest
    const validRows = activeRows.filter(row => {
      if (row[xName] === null || row[xName] === undefined) return false;
      if (selectedY && (row[yName] === null || row[yName] === undefined)) return false;
      return true;
    });

    try {
      if (currentChartType === 'histogram') {
        const valuesX = validRows
          .map(r => typeof r[xName] === 'string' ? parseFloat(String(r[xName]).replace(',', '.')) : Number(r[xName]))
          .filter(v => typeof v === 'number' && !isNaN(v));
        
        if (selectedZ && isQual(typeZ)) {
          // Group histograms by Z categories
          const categoriesZ = Array.from(new Set(validRows.map(r => String(r[zName] ?? 'Inconnu').trim())));
          categoriesZ.forEach((cat, index) => {
            const filteredValues = validRows
              .filter(r => String(r[zName] ?? 'Inconnu').trim() === cat)
              .map(r => typeof r[xName] === 'string' ? parseFloat(String(r[xName]).replace(',', '.')) : Number(r[xName]))
              .filter(v => typeof v === 'number' && !isNaN(v));
            
            if (filteredValues.length > 0) {
              traces.push({
                x: filteredValues,
                type: 'histogram',
                name: cat,
                opacity: 0.65,
                marker: { color: palette[index % palette.length] }
              });
            }
          });
        } else {
          // Regular histogram
          if (valuesX.length > 0) {
            traces.push({
              x: valuesX,
              type: 'histogram',
              marker: { color: palette[0], line: { color: 'white', width: 0.5 } }
            });
          }
        }
      }

      else if (currentChartType === 'box_single') {
        const valuesX = validRows
          .map(r => typeof r[xName] === 'string' ? parseFloat(String(r[xName]).replace(',', '.')) : Number(r[xName]))
          .filter(v => typeof v === 'number' && !isNaN(v));
        
        if (valuesX.length > 0) {
          traces.push({
            y: valuesX,
            type: 'box',
            name: xName,
            marker: { color: palette[0] }
          });
        }
        ytitle = xName;
        xtitle = '';
      }

      else if (currentChartType === 'violin_single') {
        const valuesX = validRows
          .map(r => typeof r[xName] === 'string' ? parseFloat(String(r[xName]).replace(',', '.')) : Number(r[xName]))
          .filter(v => typeof v === 'number' && !isNaN(v));
        
        if (valuesX.length > 0) {
          traces.push({
            y: valuesX,
            type: 'violin',
            name: xName,
            box: { visible: true },
            meanline: { visible: true },
            line: { color: palette[0] }
          });
        }
        ytitle = xName;
        xtitle = '';
      }

      else if (currentChartType === 'line_cumulative' || currentChartType === 'area_cumulative') {
        const valuesX = validRows
          .map(r => typeof r[xName] === 'string' ? parseFloat(String(r[xName]).replace(',', '.')) : Number(r[xName]))
          .filter(v => typeof v === 'number' && !isNaN(v))
          .sort((a, b) => a - b);
        const cumulativeCounts = valuesX.map((_, idx) => idx + 1);

        const isArea = currentChartType === 'area_cumulative';
        if (valuesX.length > 0) {
          traces.push({
            x: valuesX,
            y: cumulativeCounts,
            mode: 'lines',
            fill: isArea ? 'tozeroy' : undefined,
            name: 'Effectif cumulé',
            line: { color: palette[0], width: 3 },
            fillcolor: isArea ? palette[0] + '33' : undefined
          });
        }
        ytitle = 'Effectifs cumulés';
      }

      else if (currentChartType === 'bar_count') {
        // Count frequencies of modality X
        const counts: Record<string, number> = {};
        validRows.forEach(row => {
          const valStr = String(row[xName] ?? 'Inconnu').trim();
          counts[valStr] = (counts[valStr] || 0) + 1;
        });

        const sortedLabelPairs = Object.entries(counts).sort((a,b) => b[1] - a[1]);
        const keys = sortedLabelPairs.map(p => p[0]);
        const values = sortedLabelPairs.map(p => p[1]);

        if (keys.length > 0) {
          traces.push({
            x: keys,
            y: values,
            type: 'bar',
            text: showValueLabels ? values : undefined,
            textposition: showValueLabels ? 'auto' : undefined,
            marker: {
              color: keys.map((_, i) => palette[i % palette.length])
            }
          });
        }
        ytitle = 'Frequencies';
      }

      else if (currentChartType === 'horizontal_bar') {
        const counts: Record<string, number> = {};
        validRows.forEach(row => {
          const valStr = String(row[xName] ?? 'Inconnu').trim();
          counts[valStr] = (counts[valStr] || 0) + 1;
        });

        const sortedLabelPairs = Object.entries(counts).sort((a,b) => a[1] - b[1]); // ascend for clean visual look
        const keys = sortedLabelPairs.map(p => p[0]);
        const values = sortedLabelPairs.map(p => p[1]);

        if (keys.length > 0) {
          traces.push({
            y: keys,
            x: values,
            type: 'bar',
            orientation: 'h',
            text: showValueLabels ? values : undefined,
            textposition: showValueLabels ? 'auto' : undefined,
            marker: {
              color: keys.map((_, i) => palette[i % palette.length])
            }
          });
        }
        xtitle = 'Frequencies';
        ytitle = '';
      }

      else if (currentChartType === 'funnel') {
        const counts: Record<string, number> = {};
        validRows.forEach(row => {
          const valStr = String(row[xName] ?? 'Inconnu').trim();
          counts[valStr] = (counts[valStr] || 0) + 1;
        });

        const sortedLabelPairs = Object.entries(counts).sort((a,b) => b[1] - a[1]);
        const keys = sortedLabelPairs.map(p => p[0]);
        const values = sortedLabelPairs.map(p => p[1]);

        if (keys.length > 0) {
          traces.push({
            type: 'funnel',
            y: keys,
            x: values,
            textinfo: showValueLabels ? 'value+percent initial' : 'percent initial',
            marker: {
              color: keys.map((_, i) => palette[i % palette.length])
            }
          });
        }
        ytitle = '';
      }

      else if (currentChartType === 'pie' || currentChartType === 'donut') {
        const counts: Record<string, number> = {};
        validRows.forEach(row => {
          const valStr = String(row[xName] ?? 'Inconnu').trim();
          counts[valStr] = (counts[valStr] || 0) + 1;
        });

        const sortedLabelPairs = Object.entries(counts).sort((a,b) => b[1] - a[1]);
        const keys = sortedLabelPairs.map(p => p[0]);
        const values = sortedLabelPairs.map(p => p[1]);

        if (keys.length > 0) {
          traces.push({
            labels: keys,
            values: values,
            type: 'pie',
            hole: currentChartType === 'donut' ? 0.45 : undefined,
            textinfo: showValueLabels ? 'percent+label+value' : 'percent+label',
            marker: { colors: palette.slice(0, keys.length) }
          });
        }
      }

      else if (currentChartType === 'bar_average' || currentChartType === 'line_average' || currentChartType === 'area_average') {
        // Calculate dynamic statistic (mean, median, variance, std, sum, min, max) of Y for each modality X (and optionally Z)
        
        const computeStat = (valuesArray: number[], stat: string): number => {
          const count = valuesArray.length;
          if (count === 0) return 0;
          const sum = valuesArray.reduce((a, b) => a + b, 0);
          
          if (stat === 'sum') return sum;
          if (stat === 'min') return Math.min(...valuesArray);
          if (stat === 'max') return Math.max(...valuesArray);
          
          const mean = sum / count;
          if (stat === 'mean') return mean;
          
          if (stat === 'median') {
            const sorted = [...valuesArray].sort((a, b) => a - b);
            const mid = Math.floor(count / 2);
            return count % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          }
          
          const variance = count > 1 ? valuesArray.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / (count - 1) : 0;
          if (stat === 'variance') return variance;
          if (stat === 'std') return Math.sqrt(variance);
          
          return mean;
        };

        if (selectedZ) {
          // Group by Z and X
          const categoriesZ = Array.from(new Set(validRows.map(r => String(r[zName] ?? 'Inconnu').trim())));
          const categoriesX = Array.from(new Set(validRows.map(r => String(r[xName] ?? 'Inconnu').trim())));
          categoriesX.sort(); // Sorting X conceptually

          categoriesZ.forEach((catZ, idx) => {
            const groupsZ: Record<string, number[]> = {};
            validRows.forEach(row => {
              if (String(row[zName] ?? 'Inconnu').trim() === catZ) {
                const valX = String(row[xName] ?? 'Inconnu').trim();
                const valY = typeof row[yName] === 'string' ? parseFloat(String(row[yName]).replace(',', '.')) : Number(row[yName]);
                if (!isNaN(valY)) {
                  if (!groupsZ[valX]) groupsZ[valX] = [];
                  groupsZ[valX].push(valY);
                }
              }
            });

            // Ensure we map standard keys so lines match X axis universally
            const keys = Object.keys(groupsZ).sort(); 
            const averages = keys.map(k => computeStat(groupsZ[k], selectedSummaryStat));

            if (keys.length > 0) {
              if (currentChartType === 'bar_average') {
                traces.push({
                  x: keys,
                  y: averages,
                  type: 'bar',
                  name: `${zName}: ${catZ}`,
                  text: showValueLabels ? averages.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
                  textposition: showValueLabels ? 'auto' : undefined,
                  marker: { color: palette[idx % palette.length] }
                });
              } else if (currentChartType === 'line_average') {
                traces.push({
                  x: keys,
                  y: averages,
                  mode: showValueLabels ? 'lines+markers+text' : 'lines+markers',
                  name: `${zName}: ${catZ}`,
                  text: showValueLabels ? averages.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
                  textposition: showValueLabels ? 'top center' : undefined,
                  line: { color: palette[idx % palette.length], width: 3 },
                  marker: { size: markerSize, color: palette[idx % palette.length] }
                });
              } else {
                traces.push({
                  x: keys,
                  y: averages,
                  mode: showValueLabels ? 'lines+markers+text' : 'lines+markers',
                  name: `${zName}: ${catZ}`,
                  text: showValueLabels ? averages.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
                  textposition: showValueLabels ? 'top center' : undefined,
                  fill: 'tozeroy',
                  line: { color: palette[idx % palette.length], width: 2.5 },
                  marker: { size: markerSize - 2, color: palette[idx % palette.length] },
                  fillcolor: palette[idx % palette.length] + '33'
                });
              }
            }
          });
        } else {
          // No Z grouping (original behavior)
          const groups: Record<string, number[]> = {};
          validRows.forEach(row => {
            const valX = String(row[xName] ?? 'Inconnu').trim();
            const valY = typeof row[yName] === 'string' ? parseFloat(String(row[yName]).replace(',', '.')) : Number(row[yName]);
            if (!isNaN(valY)) {
              if (!groups[valX]) groups[valX] = [];
              groups[valX].push(valY);
            }
          });

          const keys = Object.keys(groups).sort();
          const averages = keys.map(k => computeStat(groups[k], selectedSummaryStat));

          if (keys.length > 0) {
            if (currentChartType === 'bar_average') {
              traces.push({
                x: keys,
                y: averages,
                type: 'bar',
                text: showValueLabels ? averages.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
                textposition: showValueLabels ? 'auto' : undefined,
                marker: {
                  color: keys.map((_, i) => palette[i % palette.length])
                }
              });
            } else if (currentChartType === 'line_average') {
              traces.push({
                x: keys,
                y: averages,
                mode: showValueLabels ? 'lines+markers+text' : 'lines+markers',
                text: showValueLabels ? averages.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
                textposition: showValueLabels ? 'top center' : undefined,
                line: { color: palette[0], width: 3 },
                marker: { size: markerSize, color: palette[0] }
              });
            } else {
              traces.push({
                x: keys,
                y: averages,
                mode: showValueLabels ? 'lines+markers+text' : 'lines+markers',
                text: showValueLabels ? averages.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
                textposition: showValueLabels ? 'top center' : undefined,
                fill: 'tozeroy',
                line: { color: palette[0], width: 2.5 },
                marker: { size: markerSize - 2, color: palette[0] },
                fillcolor: palette[0] + '33'
              });
            }
          }
        }

        const statLabelsTranslations: Record<string, string> = {
          mean: 'Moyenne',
          median: 'Médiane',
          variance: 'Variance',
          std: 'Écart-type',
          sum: 'Somme',
          min: 'Minimum',
          max: 'Maximum'
        };
        const activeStatLabel = statLabelsTranslations[selectedSummaryStat] || 'Moyenne';
        ytitle = `${activeStatLabel} de ${yName}`;
      }

      else if (currentChartType === 'boxplot_grouped') {
        const categories = Array.from(new Set(validRows.map(r => String(r[xName] ?? 'Inconnu').trim())));
        
        categories.forEach((cat, index) => {
          const valuesY = validRows
            .filter(r => String(r[xName] ?? 'Inconnu').trim() === cat)
            .map(r => typeof r[yName] === 'string' ? parseFloat(String(r[yName]).replace(',', '.')) : Number(r[yName]))
            .filter(v => typeof v === 'number' && !isNaN(v));
          
          if (valuesY.length > 0) {
            traces.push({
              y: valuesY,
              type: 'box',
              name: cat,
              marker: { color: palette[index % palette.length] }
            });
          }
        });
        ytitle = yName;
        xtitle = xName;
      }

      else if (currentChartType === 'violin_grouped') {
        const categories = Array.from(new Set(validRows.map(r => String(r[xName] ?? 'Inconnu').trim())));
        
        categories.forEach((cat, index) => {
          const valuesY = validRows
            .filter(r => String(r[xName] ?? 'Inconnu').trim() === cat)
            .map(r => typeof r[yName] === 'string' ? parseFloat(String(r[yName]).replace(',', '.')) : Number(r[yName]))
            .filter(v => typeof v === 'number' && !isNaN(v));
          
          if (valuesY.length > 0) {
            traces.push({
              y: valuesY,
              type: 'violin',
              name: cat,
              box: { visible: true },
              meanline: { visible: true },
              line: { color: palette[index % palette.length] }
            });
          }
        });
        ytitle = yName;
        xtitle = xName;
      }

      else if (currentChartType === 'strip_plot') {
        const categories = Array.from(new Set(validRows.map(r => String(r[xName] ?? 'Inconnu').trim())));
        
        categories.forEach((cat, index) => {
          const valuesY = validRows
            .filter(r => String(r[xName] ?? 'Inconnu').trim() === cat)
            .map(r => typeof r[yName] === 'string' ? parseFloat(String(r[yName]).replace(',', '.')) : Number(r[yName]))
            .filter(v => typeof v === 'number' && !isNaN(v));
          
          if (valuesY.length > 0) {
            traces.push({
              y: valuesY,
              x: Array(valuesY.length).fill(cat),
              mode: 'markers',
              name: cat,
              type: 'scatter',
              marker: { 
                color: palette[index % palette.length],
                size: markerSize,
                opacity: 0.8
              }
            });
          }
        });
        ytitle = yName;
        xtitle = xName;
      }

      else if (currentChartType === 'scatter') {
        const cleanPairs = validRows
          .map(r => {
            const xVal = typeof r[xName] === 'string' ? parseFloat(String(r[xName]).replace(',', '.')) : Number(r[xName]);
            const yVal = typeof r[yName] === 'string' ? parseFloat(String(r[yName]).replace(',', '.')) : Number(r[yName]);
            const zVal = selectedZ ? (typeof r[zName] === 'string' ? parseFloat(String(r[zName]).replace(',', '.')) : Number(r[zName])) : null;
            return { x: xVal, y: yVal, z: zVal, original: r };
          })
          .filter(p => !isNaN(p.x) && !isNaN(p.y));

        const cleanX = cleanPairs.map(p => p.x);
        const cleanY = cleanPairs.map(p => p.y);

        if (cleanX.length > 0) {
          if (selectedZ && isQual(typeZ)) {
            const categoriesZ = Array.from(new Set(cleanPairs.map(p => String(p.original[zName] ?? 'Inconnu').trim())));
            categoriesZ.forEach((cat, idx) => {
              const groupPairs = cleanPairs.filter(p => String(p.original[zName] ?? 'Inconnu').trim() === cat);
              const groupX = groupPairs.map(p => p.x);
              const groupY = groupPairs.map(p => p.y);

              if (groupX.length > 0) {
                traces.push({
                  x: groupX,
                  y: groupY,
                  mode: showValueLabels ? 'markers+text' : 'markers',
                  text: showValueLabels ? groupY.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
                  textposition: showValueLabels ? 'top center' : undefined,
                  name: `${zName}: ${cat}`,
                  marker: {
                    color: palette[idx % palette.length],
                    size: markerSize,
                    opacity: 0.8
                  }
                });
              }
            });
          } else if (selectedZ && isQuant(typeZ)) {
            const cleanZ = cleanPairs.map(p => p.z).filter((v): v is number => v !== null && !isNaN(v));
            if (cleanZ.length > 0) {
              const minZ = Math.min(...cleanZ);
              const maxZ = Math.max(...cleanZ);
              const rangeZ = maxZ - minZ === 0 ? 1 : maxZ - minZ;

              traces.push({
                x: cleanPairs.filter(p => p.z !== null && !isNaN(p.z)).map(p => p.x),
                y: cleanPairs.filter(p => p.z !== null && !isNaN(p.z)).map(p => p.y),
                mode: showValueLabels ? 'markers+text' : 'markers',
                text: showValueLabels ? cleanPairs.filter(p => p.z !== null && !isNaN(p.z)).map(p => typeof p.y === 'number' ? p.y.toFixed(useWorkspaceStore.getState().decimals) : p.y) : undefined,
                textposition: showValueLabels ? 'top center' : undefined,
                marker: {
                  size: cleanPairs.filter(p => p.z !== null && !isNaN(p.z)).map(p => 5 + (((p.z as number) - minZ) / rangeZ) * 15),
                  color: cleanPairs.filter(p => p.z !== null && !isNaN(p.z)).map(p => p.z),
                  colorscale: 'Viridis',
                  showscale: true,
                  colorbar: { title: zName }
                }
              });
            } else {
              traces.push({
                x: cleanX,
                y: cleanY,
                mode: showValueLabels ? 'markers+text' : 'markers',
                text: showValueLabels ? cleanY.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
                textposition: showValueLabels ? 'top center' : undefined,
                marker: { color: palette[0], size: markerSize, opacity: 0.8 }
              });
            }
          } else {
            traces.push({
              x: cleanX,
              y: cleanY,
              mode: showValueLabels ? 'markers+text' : 'markers',
              text: showValueLabels ? cleanY.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
              textposition: showValueLabels ? 'top center' : undefined,
              marker: { color: palette[0], size: markerSize, opacity: 0.8 }
            });
          }

          if (showTrendline && cleanX.length > 1) {
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            const count = cleanX.length;
            for (let i = 0; i < count; i++) {
              sumX += cleanX[i];
              sumY += cleanY[i];
              sumXY += cleanX[i] * cleanY[i];
              sumXX += cleanX[i] * cleanX[i];
            }
            const denom = count * sumXX - sumX * sumX;
            if (denom !== 0) {
              const slope = (count * sumXY - sumX * sumY) / denom;
              const intercept = (sumY - slope * sumX) / count;
              const minX = Math.min(...cleanX);
              const maxX = Math.max(...cleanX);
              traces.push({
                x: [minX, maxX],
                y: [slope * minX + intercept, slope * maxX + intercept],
                mode: 'lines',
                name: 'Indicateur Tendance',
                line: { color: '#ef4444', width: 2, dash: 'dot' }
              });
            }
          }
        }
      }

      else if (currentChartType === 'bubble') {
        const cleanPairs = validRows
          .map(r => {
            const xVal = typeof r[xName] === 'string' ? parseFloat(String(r[xName]).replace(',', '.')) : Number(r[xName]);
            const yVal = typeof r[yName] === 'string' ? parseFloat(String(r[yName]).replace(',', '.')) : Number(r[yName]);
            const zVal = selectedZ ? (typeof r[zName] === 'string' ? parseFloat(String(r[zName]).replace(',', '.')) : Number(r[zName])) : null;
            return { x: xVal, y: yVal, z: zVal, original: r };
          })
          .filter(p => !isNaN(p.x) && !isNaN(p.y));

        const cleanX = cleanPairs.map(p => p.x);
        const cleanY = cleanPairs.map(p => p.y);

        if (cleanX.length > 0) {
          let bubbleSizes: number[] = [];
          let bubbleColors: any[] = [];
          let showScale = false;

          if (selectedZ && isQuant(typeZ)) {
            const cleanZ = cleanPairs.map(p => p.z).filter((v): v is number => v !== null && !isNaN(v));
            if (cleanZ.length > 0) {
              const minZ = Math.min(...cleanZ);
              const maxZ = Math.max(...cleanZ);
              const rangeZ = maxZ - minZ === 0 ? 1 : maxZ - minZ;
              bubbleSizes = cleanPairs.map(p => 8 + (((p.z as number) - minZ) / rangeZ) * 26);
              bubbleColors = cleanPairs.map(p => p.z);
              showScale = true;
            } else {
              bubbleSizes = cleanY.map(() => markerSize * 1.5);
              bubbleColors = cleanY.map(() => palette[0]);
            }
          } else if (selectedZ && isQual(typeZ)) {
            const categoriesZ = Array.from(new Set(cleanPairs.map(p => String(p.original[zName] ?? 'Inconnu').trim())));
            bubbleColors = cleanPairs.map(p => palette[categoriesZ.indexOf(String(p.original[zName] ?? 'Inconnu').trim()) % palette.length]);
            bubbleSizes = cleanY.map(() => markerSize * 1.8);
          } else {
            const minPageY = Math.min(...cleanY);
            const maxPageY = Math.max(...cleanY);
            const diffY = maxPageY - minPageY === 0 ? 1 : maxPageY - minPageY;
            bubbleSizes = cleanY.map(v => 8 + ((v - minPageY) / diffY) * 22);
            bubbleColors = cleanY.map(() => palette[0]);
          }

          traces.push({
            x: cleanX,
            y: cleanY,
            mode: 'markers',
            name: 'Bulles',
            marker: {
              size: bubbleSizes,
              color: bubbleColors,
              colorscale: showScale ? 'Viridis' : undefined,
              showscale: showScale,
              colorbar: showScale ? { title: zName } : undefined,
              opacity: 0.75,
              line: { width: 1, color: '#ffffff' }
            }
          });
        }
      }

      else if (currentChartType === 'line' || currentChartType === 'spline_interpolation' || currentChartType === 'area_evolution') {
        const cleanPairs = validRows
          .map(r => {
            const xVal = typeof r[xName] === 'string' ? parseFloat(String(r[xName]).replace(',', '.')) : Number(r[xName]);
            const yVal = typeof r[yName] === 'string' ? parseFloat(String(r[yName]).replace(',', '.')) : Number(r[yName]);
            return { x: xVal, y: yVal, original: r };
          })
          .filter(p => !isNaN(p.x) && !isNaN(p.y))
          .sort((a, b) => a.x - b.x);

        const cleanX = cleanPairs.map(p => p.x);
        const cleanY = cleanPairs.map(p => p.y);

        const shape = currentChartType === 'spline_interpolation' ? 'spline' : 'linear';
        const fill = currentChartType === 'area_evolution' ? 'tozeroy' : undefined;

        if (cleanX.length > 0) {
          if (selectedZ) {
            const categoriesZ = Array.from(new Set(cleanPairs.map(p => String(p.original[zName] ?? 'Inconnu').trim())));
            categoriesZ.forEach((cat, idx) => {
              const groupPairs = cleanPairs.filter(p => String(p.original[zName] ?? 'Inconnu').trim() === cat);
              const groupX = groupPairs.map(p => p.x);
              const groupY = groupPairs.map(p => p.y);

              if (groupX.length > 0) {
                traces.push({
                  x: groupX,
                  y: groupY,
                  mode: (fill ? 'lines' : 'lines+markers') + (showValueLabels ? '+text' : ''),
                  text: showValueLabels ? groupY.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
                  textposition: showValueLabels ? 'top center' : undefined,
                  fill: fill,
                  name: `${zName}: ${cat}`,
                  marker: fill ? undefined : { size: markerSize - 2, color: palette[idx % palette.length] },
                  line: { color: palette[idx % palette.length], shape: shape },
                  fillcolor: fill ? palette[idx % palette.length] + '22' : undefined
                });
              }
            });
          } else {
            traces.push({
              x: cleanX,
              y: cleanY,
              mode: (fill ? 'lines' : 'lines+markers') + (showValueLabels ? '+text' : ''),
              text: showValueLabels ? cleanY.map(v => typeof v === 'number' ? v.toFixed(useWorkspaceStore.getState().decimals) : v) : undefined,
              textposition: showValueLabels ? 'top center' : undefined,
              fill: fill,
              name: 'Évolution',
              marker: fill ? undefined : { size: markerSize - 2, color: palette[0] },
              line: { color: palette[0], shape: shape, width: 2.5 },
              fillcolor: fill ? palette[0] + '33' : undefined
            });
          }
        }
        ytitle = yName;
      }

      else if (currentChartType === 'density_contour') {
        const cleanX = validRows
          .map(r => typeof r[xName] === 'string' ? parseFloat(String(r[xName]).replace(',', '.')) : Number(r[xName]))
          .filter(v => typeof v === 'number' && !isNaN(v));
        const cleanY = validRows
          .map(r => typeof r[yName] === 'string' ? parseFloat(String(r[yName]).replace(',', '.')) : Number(r[yName]))
          .filter(v => typeof v === 'number' && !isNaN(v));

        if (cleanX.length > 0 && cleanY.length > 0) {
          traces.push({
            x: cleanX,
            y: cleanY,
            type: 'histogram2dcontour',
            colorscale: 'YlGnBu',
            reversescale: true,
            ncontours: 20,
            showscale: true
          });
        }
      }

      else if (currentChartType === 'heatmap') {
        const categoriesX = Array.from(new Set(validRows.map(r => String(r[xName] ?? 'Inconnu').trim())));
        const categoriesY = Array.from(new Set(validRows.map(r => String(r[yName] ?? 'Inconnu').trim())));

        if (categoriesX.length > 0 && categoriesY.length > 0) {
          const zMatrix = categoriesY.map(catY => {
            return categoriesX.map(catX => {
              return validRows.filter(r => String(r[xName] ?? 'Inconnu').trim() === catX && String(r[yName] ?? 'Inconnu').trim() === catY).length;
            });
          });

          traces.push({
            z: zMatrix,
            x: categoriesX,
            y: categoriesY,
            type: 'heatmap',
            colorscale: 'Blues',
            showscale: true,
            hoverongaps: false
          });
        }
        ytitle = yName;
        xtitle = xName;
      }

      else if (currentChartType === 'sunburst') {
        const ids: string[] = [];
        const labels: string[] = [];
        const parents: string[] = [];
        const values: number[] = [];

        const rootId = 'root';
        const rootLabel = datasetName || 'Données';
        ids.push(rootId);
        labels.push(rootLabel);
        parents.push('');
        values.push(validRows.length);

        const categoriesX = Array.from(new Set(validRows.map(r => String(r[xName] ?? '').trim()).filter(Boolean)));
        categoriesX.forEach(catX => {
          const catXId = `x_${catX}`;
          const countTotal = validRows.filter(r => String(r[xName] ?? '').trim() === catX).length;
          if (countTotal === 0) return;

          ids.push(catXId);
          labels.push(catX);
          parents.push(rootId);
          values.push(countTotal);

          // Sub categories of Y inside elements of X
          const categoriesY = Array.from(new Set(validRows.filter(r => String(r[xName] ?? '').trim() === catX).map(r => String(r[yName] ?? '').trim()).filter(Boolean)));
          categoriesY.forEach(catY => {
            const catYId = `xy_${catX}_${catY}`;
            const countSub = validRows.filter(r => String(r[xName] ?? '').trim() === catX && String(r[yName] ?? '').trim() === catY).length;
            if (countSub === 0) return;

            ids.push(catYId);
            labels.push(catY);
            parents.push(catXId);
            values.push(countSub);
          });
        });

        if (ids.length > 1) {
          traces.push({
            type: 'sunburst',
            ids: ids,
            labels: labels,
            parents: parents,
            values: values,
            outsidetextfont: { size: 10, color: '#374151' },
            leaf: { opacity: 0.8 },
            marker: { line: { width: 1.5, color: '#ffffff' } }
          });
        }
      }

      else if (currentChartType === 'bar_stacked' || currentChartType === 'bar_grouped') {
        // Frequencies of X grouped by modalities of Y
        const categoriesX = Array.from(new Set(validRows.map(r => String(r[xName] ?? 'Inconnu').trim())));
        const categoriesY = Array.from(new Set(validRows.map(r => String(r[yName] ?? 'Inconnu').trim())));

        categoriesY.forEach((catY, idxY) => {
          const values: number[] = [];
          categoriesX.forEach(catX => {
            const filteredCount = validRows.filter(r => String(r[xName] ?? 'Inconnu').trim() === catX && String(r[yName] ?? 'Inconnu').trim() === catY).length;
            values.push(filteredCount);
          });

          traces.push({
            x: categoriesX,
            y: values,
            type: 'bar',
            name: `${yName}: ${catY}`,
            marker: { color: palette[idxY % palette.length] }
          });
        });

        ytitle = 'Effectifs du croisement';
      }

    } catch (e) {
      console.error("Error creating plot traces:", e);
    }

    const isCircular = currentChartType === 'pie' || currentChartType === 'donut' || currentChartType === 'sunburst';

    const designLayout = {
      title: {
        text: computedTitle,
        font: { family: 'Inter, system-ui, sans-serif', size: 16, weight: 'bold', color: '#0f172a' }
      },
      xaxis: isCircular ? { visible: false } : {
        title: { text: xtitle, font: { family: 'Inter, system-ui, sans-serif', size: 12, color: '#475569' } },
        showgrid: showGrid,
        gridcolor: '#e2e8f0',
        zeroline: false
      },
      yaxis: isCircular ? { visible: false } : {
        title: { text: ytitle, font: { family: 'Inter, system-ui, sans-serif', size: 12, color: '#475569' } },
        showgrid: showGrid,
        gridcolor: '#e2e8f0',
        zeroline: false
      },
      legend: {
        font: { family: 'Inter, system-ui, sans-serif', size: 11, color: '#475569' },
        bgcolor: 'rgba(255,255,255,0.7)',
        bordercolor: '#f1f5f9',
        borderwidth: 1
      },
      font: { family: 'Inter, system-ui, sans-serif' },
      barmode: (currentChartType === 'bar_stacked' || currentChartType === 'bar_grouped') 
        ? (currentChartType === 'bar_stacked' ? 'stack' : 'group')
        : (currentChartType === 'histogram' ? 'overlay' : undefined),
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      hovermode: 'closest',
      margin: { t: 60, r: 20, l: 50, b: 50 }
    };

    return { data: traces, layout: designLayout };
  }, [selectedX, selectedY, selectedZ, customTitle, customXLabel, customYLabel, selectedPalette, currentChartType, showGrid, showTrendline, markerSize, activeRows, selectedSummaryStat, showValueLabels]);

  // Handle Drag assignments
  const handleDragStart = (e: React.DragEvent, colName: string) => {
    e.dataTransfer.setData('text/plain', colName);
    setDraggedVar(colName);
  };

  const assignAxis = (axis: 'X' | 'Y' | 'Z', colName: string) => {
    const colType = getType(colName);
    
    // Prevent duplicate column on axes
    if (axis === 'X') {
      if (colName === selectedY) setSelectedY(null);
      if (colName === selectedZ) setSelectedZ(null);
      setSelectedX(colName);
      setCustomXLabel(colName);
    } else if (axis === 'Y') {
      if (colName === selectedX) setSelectedX(null);
      if (colName === selectedZ) setSelectedZ(null);
      setSelectedY(colName);
      setCustomYLabel(colName);
    } else if (axis === 'Z') {
      if (colName === selectedX) setSelectedX(null);
      if (colName === selectedY) setSelectedY(null);
      setSelectedZ(colName);
    }
    toast.success(`'${colName}' assignée à l'axe ${axis}.`);
  };

  const handleDrop = (e: React.DragEvent, target: 'X' | 'Y' | 'Z') => {
    e.preventDefault();
    const varName = e.dataTransfer.getData('text/plain') || draggedVar;
    if (varName) {
      assignAxis(target, varName);
    }
    setActiveDragTarget(null);
    setDraggedVar(null);
  };

  const handleDragOver = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    setActiveDragTarget(targetName);
  };

  const handleDragLeave = () => {
    setActiveDragTarget(null);
  };

  // Click assignment menu toggling
  const switchMenu = (colName: string) => {
    setIsMenuOpenX(isMenuOpenX === colName ? null : colName);
  };

  // Add the newly generated report to the analytical reports hub
  const handleSaveToReports = () => {
    if (!selectedX) return;

    const resultId = Math.random().toString(36).substring(2, 9);
    addAnalysisResult({
      id: resultId,
      title: customTitle || `Graphique Interactif: ${selectedX}${selectedY ? ` v.s ${selectedY}` : ''}`,
      timestamp: new Date().toISOString(),
      type: selectedY ? 'bivariate' : 'univariate',
      variables: selectedY ? [selectedX, selectedY] : [selectedX],
      metrics: {
        info: "Ce graphique interactif a été conçu de manière personnalisée par l'utilisateur à l'aide de l'atelier graphique.",
        recommended_type: autoChartType,
        customized: true
      },
      interpretation: `Graphique interactif personnalisé de type '${currentChartType}' représentant ${selectedX}${selectedY ? ` croisé avec ${selectedY}` : ''}. Axe horizontal (X): ${customXLabel || selectedX}. Axe vertical (Y): ${customYLabel || (selectedY ? selectedY : 'Effectifs')}.`,
      chart: plotDataAndLayout,
      group: selectedFolder || undefined
    });

    toast.success("Graphique exporté avec succès dans 'Résultats & Rapports' !");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Top action header bar */}
      <div className="bg-white border-b border-slate-200/80 shrink-0 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-600" />
            Atelier Graphique Premium
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Glissez-déposez vos variables pour obtenir instantanément des visualisations optimales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Réinitialiser
          </button>

          <button
            onClick={handleSaveToReports}
            disabled={!selectedX}
            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-sm shadow-indigo-600/15 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Fixer le rapport
          </button>
        </div>
      </div>

      {/* Main Designer Grid Workspace */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80">
        
        {/* Left Column: Variable Bank */}
        <div className="lg:col-span-1 bg-white p-5 flex flex-col h-full overflow-hidden">
          <div className="mb-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Banque de variables</span>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {columns.length}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              Glissez une variable vers les axes à droite ou cliquez sur les boutons.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {columns.map((col) => {
              const type = col.type;
              const isX = selectedX === col.name;
              const isY = selectedY === col.name;
              const isZ = selectedZ === col.name;
              const isAssigned = isX || isY || isZ;

              return (
                <div
                  key={col.name}
                  draggable
                  onDragStart={(e) => handleDragStart(e, col.name)}
                  className={`p-3 rounded-xl border transition-all duration-300 group cursor-grab active:cursor-grabbing relative flex flex-col gap-2 
                    ${isAssigned 
                      ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' 
                      : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-white hover:shadow-md'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      {/* Icon reflecting structural data type */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border
                        ${isQuant(type) 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                          : type === 'datetime'
                            ? 'bg-pink-50 text-pink-600 border-pink-100'
                            : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }
                      `}>
                        {isQuant(type) ? (
                          <Hash className="w-3.5 h-3.5" />
                        ) : type === 'datetime' ? (
                          <Calendar className="w-3.5 h-3.5" />
                        ) : (
                          <LetterIcon className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="truncate">
                        <span className="text-[12px] font-bold text-slate-800 tracking-tight block truncate leading-tight">
                          {col.name}
                        </span>
                        <span className="text-[9px] uppercase font-black text-slate-400 block mt-0.5 tracking-wider">
                          {type === 'continuous' ? 'Continu' : type === 'discrete' ? 'Discret' : type === 'nominal' ? 'Nominal' : type === 'ordinal' ? 'Ordinal' : 'Date'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => switchMenu(col.name)}
                      className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-all shrink-0"
                      title="Assigner rapidement"
                    >
                      <MousePointer className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Immediate fast interactive assignment menus */}
                  {isMenuOpenX === col.name && (
                    <div className="flex flex-col gap-1 bg-white border border-slate-200/80 p-2 rounded-lg shadow-xl absolute right-2 top-8 z-30 min-w-32 animate-in fade-in zoom-in duration-100">
                      <p className="text-[9px] font-bold text-slate-400 px-1 py-0.5 uppercase tracking-wider">Axe Ciblé</p>
                      <button
                        onClick={() => { assignAxis('X', col.name); switchMenu(col.name); }}
                        className="w-full text-left font-medium text-xs text-slate-700 hover:bg-slate-50 py-1 px-2 rounded transition-colors"
                      >
                        Axe horizontal (X)
                      </button>
                      <button
                        onClick={() => { assignAxis('Y', col.name); switchMenu(col.name); }}
                        className="w-full text-left font-medium text-xs text-slate-700 hover:bg-slate-50 py-1 px-2 rounded transition-colors"
                      >
                        Axe vertical (Y)
                      </button>
                      <button
                        onClick={() => { assignAxis('Z', col.name); switchMenu(col.name); }}
                        className="w-full text-left font-medium text-xs text-slate-700 hover:bg-slate-50 py-1 px-2 rounded transition-colors"
                      >
                        Axe Z & Groupe (Couleur)
                      </button>
                    </div>
                  )}

                  {/* Badges showing assigned tracks */}
                  {isAssigned && (
                    <div className="flex flex-wrap gap-1 mt-1 border-t border-slate-100 pt-1.5">
                      {isX && (
                        <span className="text-[8.5px] uppercase font-bold tracking-widest bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                          Axe X
                        </span>
                      )}
                      {isY && (
                        <span className="text-[8.5px] uppercase font-bold tracking-widest bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded-full">
                          Axe Y
                        </span>
                      )}
                      {isZ && (
                        <span className="text-[8.5px] uppercase font-bold tracking-widest bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                          Axe Z (Couleur)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Center/Main Column: Canvas + Target Slots (Col-Span-2) */}
        <div className="lg:col-span-2 bg-slate-50 p-6 flex flex-col h-full overflow-y-auto">
          {/* Draggable Drop Targets Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            
            {/* Target X */}
            <div
              onDragOver={(e) => handleDragOver(e, 'X')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'X')}
              className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative min-h-24 transition-all duration-300 text-center
                ${activeDragTarget === 'X' 
                  ? 'bg-emerald-50 border-emerald-400 scale-[1.02]' 
                  : selectedX 
                    ? 'bg-white border-emerald-200 shadow-sm' 
                    : 'bg-slate-100/50 border-slate-300 hover:border-slate-400'
                }
              `}
            >
              <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1.5">Axe X (Principal)</span>
              {selectedX ? (
                <div className="flex items-center gap-2 bg-emerald-5 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-1 px-3 rounded-xl transition-all">
                  <span className="text-xs font-bold truncate max-w-32">{selectedX}</span>
                  <button 
                    onClick={() => { setSelectedX(null); setCustomXLabel(''); }}
                    className="text-emerald-500 hover:text-emerald-900 hover:bg-emerald-200/50 p-0.5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 font-semibold px-2">Placez une variable</span>
              )}
            </div>

            {/* Target Y */}
            <div
              onDragOver={(e) => handleDragOver(e, 'Y')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'Y')}
              className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative min-h-24 transition-all duration-300 text-center
                ${activeDragTarget === 'Y' 
                  ? 'bg-blue-50 border-blue-400 scale-[1.02]' 
                  : selectedY 
                    ? 'bg-white border-blue-200 shadow-sm' 
                    : 'bg-slate-100/50 border-slate-300 hover:border-slate-400'
                }
              `}
            >
              <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1.5">Axe Y (Complément)</span>
              {selectedY ? (
                <div className="flex items-center gap-2 bg-blue-5 hover:bg-blue-100 text-blue-800 border border-blue-200 py-1 px-3 rounded-xl transition-all">
                  <span className="text-xs font-bold truncate max-w-32">{selectedY}</span>
                  <button 
                    onClick={() => { setSelectedY(null); setCustomYLabel(''); }}
                    className="text-blue-500 hover:text-blue-900 hover:bg-blue-200/50 p-0.5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 font-semibold px-2">Complément (Optionnel)</span>
              )}
            </div>

            {/* Target Z */}
            <div
              onDragOver={(e) => handleDragOver(e, 'Z')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'Z')}
              className={`p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center relative min-h-24 transition-all duration-300 text-center
                ${activeDragTarget === 'Z' 
                  ? 'bg-indigo-50 border-indigo-400 scale-[1.02]' 
                  : selectedZ 
                    ? 'bg-white border-indigo-200 shadow-sm' 
                    : 'bg-slate-100/50 border-slate-300 hover:border-slate-400'
                }
              `}
            >
              <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1.5">Axe Z / Groupe (Couleur)</span>
              {selectedZ ? (
                <div className="flex items-center gap-2 bg-indigo-5 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 py-1 px-3 rounded-xl transition-all">
                  <span className="text-xs font-bold truncate max-w-32">{selectedZ}</span>
                  <button 
                    onClick={() => setSelectedZ(null)}
                    className="text-indigo-500 hover:text-indigo-900 hover:bg-indigo-200/50 p-0.5 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 font-semibold px-2">Regroupement (Optionnel)</span>
              )}
            </div>

          </div>

          {/* Interactive Plot Viewport Box */}
          <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 flex flex-col items-center justify-center relative min-h-96">

            {selectedX ? (
              <div className="w-full flex-1 flex items-center justify-center">
                <Plot
                  data={plotDataAndLayout.data}
                  layout={{
                    ...plotDataAndLayout.layout,
                    autosize: true,
                    margin: { t: 40, r: 20, l: 45, b: 45 }
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%', minHeight: '380px' }}
                  config={{ displayModeBar: true, responsive: true }}
                />
              </div>
            ) : (
              <div className="text-center p-8 max-w-sm flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center mb-5 text-slate-400 animate-bounce" style={{ animationDuration: '4s' }}>
                  <CompassIcon className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Concepteur Graphique Vide</h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  Glissez des variables dans l’Axe X et l’Axe Y ci-dessus pour lancer la détection automatique et afficher votre visualisation.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Style & Properties Dashboard Panel */}
        <div className="lg:col-span-1 bg-white p-5 flex flex-col h-full overflow-y-auto space-y-6">
          
          {/* Section: Chart Type Manual Override */}
          <div className="border border-slate-100/80 p-3 rounded-2xl bg-slate-50/40">
            <h4 
              onClick={() => setIsPalettePanelExpanded(!isPalettePanelExpanded)}
              className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-indigo-600 mb-2.5 flex items-center justify-between cursor-pointer select-none"
            >
              <span className="flex items-center gap-1.5 font-extrabold text-slate-600">
                <Layers2 className="w-3.5 h-3.5 text-slate-500" />
                Palette & Type de graphique
              </span>
              <span className="text-[9px] bg-slate-200/60 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                {isPalettePanelExpanded ? 'COMPRESSER' : 'DÉPLOYER'}
              </span>
            </h4>

            {isPalettePanelExpanded && (
              <div className="space-y-4 pt-1 transition-all">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Algorithme d'affichage</label>
                  <select
                    value={manualChartType}
                    onChange={(e) => setManualChartType(e.target.value)}
                    disabled={!selectedX}
                    className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="auto">Sélection auto selon variables</option>
                    {availableChartOverrides.map(opt => (
                      opt.value !== 'auto' && <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* dynamic summary stat selector */}
                {(currentChartType === 'bar_average' || currentChartType === 'line_average' || currentChartType === 'area_average') && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Métrique Statistique à Calculer</label>
                    <select
                      value={selectedSummaryStat}
                      onChange={(e) => setSelectedSummaryStat(e.target.value)}
                      className="w-full text-xs font-bold text-indigo-900 bg-indigo-50/50 border border-indigo-200/80 hover:border-indigo-300 rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500/30 focus:outline-none cursor-pointer"
                    >
                      <option value="mean">Moyenne</option>
                      <option value="median">Médiane</option>
                      <option value="variance">Variance</option>
                      <option value="std">Écart-type</option>
                      <option value="sum">Somme</option>
                      <option value="min">Minimum</option>
                      <option value="max">Maximum</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Thème de Couleur</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(PALETTES).map(([key, palette]) => {
                      const isSelected = selectedPalette === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedPalette(key as PaletteKey)}
                          className={`p-2.5 rounded-xl border text-[11px] font-bold text-left cursor-pointer transition-all duration-200
                            ${isSelected 
                              ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                            }
                          `}
                        >
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="w-3 h-3 rounded-full shrink-0 border border-white/20" 
                              style={{ background: palette.background }} 
                            />
                            <span className="truncate">{palette.name}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Axis and Label custom texts */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" />
              Saisie des Textes & Libellés
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Titre de graphique personnalisé</label>
                <input
                  type="text"
                  placeholder="Laisser vide pour calcul auto"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full text-xs bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Libellé Axe X</label>
                <input
                  type="text"
                  placeholder={selectedX || "Variable X"}
                  value={customXLabel}
                  onChange={(e) => setCustomXLabel(e.target.value)}
                  className="w-full text-xs bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Libellé Axe Y</label>
                <input
                  type="text"
                  placeholder={selectedY || "Fréquence"}
                  value={customYLabel}
                  onChange={(e) => setCustomYLabel(e.target.value)}
                  className="w-full text-xs bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {selectedX && (
                <div className="pt-3 mt-3 border-t border-slate-100">
                  <FolderSelector value={selectedFolder} onChange={setSelectedFolder} />
                </div>
              )}
            </div>
          </div>

          {/* Section: Render switches (Grids, Trendlines, Sizes) */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Paramètres structurels
            </h4>

            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                />
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Grid className="w-3.5 h-3.5 text-slate-400" />
                  Afficher les lignes de repère
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showValueLabels}
                  onChange={(e) => setShowValueLabels(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                />
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="font-extrabold text-indigo-650 bg-indigo-50/80 px-1 py-0.2 rounded text-[9px] border border-indigo-100">123</span>
                  Afficher les étiquettes de valeur
                </span>
              </label>

              {currentChartType === 'scatter' && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showTrendline}
                    onChange={(e) => setShowTrendline(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                    Afficher la courbe de tendance (Régression)
                  </span>
                </label>
              )}

              {(currentChartType === 'scatter' || currentChartType === 'line') && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Taille des Marqueurs : {markerSize}px</label>
                  <input
                    type="range"
                    min="4"
                    max="18"
                    value={markerSize}
                    onChange={(e) => setMarkerSize(parseInt(e.target.value))}
                    className="w-full accent-indigo-600 cursor-ew-resize py-1"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Info footer box */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3.5 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span className="text-[10px] text-slate-500 leading-relaxed font-semibold">
              Une fois le graphique finalisé, cliquez en haut à droite sur <strong>Fixer le rapport</strong> pour enregistrer cette recherche dans votre hub d’analyses décisionnel.
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

// Inline fallback for layout rendering
function CompassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
