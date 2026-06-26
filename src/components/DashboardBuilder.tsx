import React, { useState, useRef } from 'react';
import { useDashboardStore, DashboardItemType, DashboardItem, DashboardPage } from '../dashboardStore';
import { useWorkspaceStore } from '../store';
import { getApi } from '../pywebview';
// @ts-ignore
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Plus, Type, Image as ImageIcon, LayoutDashboard, X, Edit2, Check, Lock, Save, FileText, ChevronDown, Sparkles, GripVertical, ChevronRight, BarChart2, ChevronLeft, Trash2, FilePlus, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import Plot from 'react-plotly.js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'framer-motion';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function DashboardBuilder() {
  const { 
    pages, currentPageId, addPage, removePage, renamePage, setCurrentPage,
    addItem, updateItem, removeItem, updateLayout,
    dashboardTitle, setDashboardTitle, customTheme, setCustomTheme
  } = useDashboardStore();
  const history = useWorkspaceStore(state => state.history);

  const handleExportHtml = async () => {
    try {
      const api = getApi();
      const decimals = useWorkspaceStore.getState().decimals;
      
      const chartsToInitialize: any[] = [];
      
      const pagesHtml = pages.map((p, pIdx) => {
        const pageItems = p.items;
        
        const itemsListHtml = pageItems.map(item => {
          let itemInnerHtml = '';
          
          if (item.type === 'text') {
            itemInnerHtml = `
              <div class="markdown-container flex-1 flex flex-col min-h-[120px]" style="text-align: ${item.style?.textAlign || 'left'}; font-size: ${item.style?.fontSize || '1rem'}">
                <div class="markdown-raw hidden">${encodeURIComponent(item.content || '')}</div>
                <div class="parsed-markdown prose max-w-none flex-1 overflow-y-auto" style="color: inherit;"></div>
              </div>
            `;
          } else if (item.type === 'image') {
            const imgContent = item.content ? `<img src="${item.content}" class="max-w-full max-h-[350px] object-contain rounded-lg" />` : `<span class="opacity-50">Aucune image</span>`;
            itemInnerHtml = `
              <div class="flex-1 flex items-center justify-center overflow-hidden min-h-[150px]">
                ${imgContent}
              </div>
            `;
          } else if (item.type === 'analysis_metric_card') {
            const valFormatted = typeof item.metricData === 'number' ? item.metricData.toFixed(decimals) : (item.metricData || '');
            const cardFontSize = item.style?.fontSize || '2.25rem';
            itemInnerHtml = `
              <div class="flex flex-col items-center justify-center text-center py-6 flex-1 min-h-[120px]">
                <span class="text-xs font-bold uppercase tracking-wider mb-2 opacity-70" style="color: ${customTheme.textColor}">${item.metricLabel}</span>
                <span class="metric-value font-black" style="font-size: ${cardFontSize}; color: ${customTheme.metricColor}">
                  ${valFormatted}
                </span>
              </div>
            `;
          } else if (item.type === 'analysis_decision') {
            const isSignificant = item.metricData?.p_value !== undefined && item.metricData.p_value < useWorkspaceStore.getState().alpha;
            itemInnerHtml = `
              <div class="flex flex-col p-4 flex-1">
                <div class="flex items-center justify-between mb-4">
                  <span class="text-[11px] font-bold uppercase tracking-wider opacity-70">Décision Statistique</span>
                  <div class="px-3 py-1 rounded-full text-xs font-bold ${isSignificant ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                    ${isSignificant ? 'P < 0.05 (Significatif)' : 'P ≥ 0.05 (Non significatif)'}
                  </div>
                </div>
                <div class="text-base font-black flex items-center gap-2 ${isSignificant ? 'text-emerald-600' : 'text-rose-600'}">
                  <div class="w-2.5 h-2.5 rounded-full ${isSignificant ? 'bg-emerald-500' : 'bg-rose-500'}"></div>
                  ${isSignificant ? 'H₀ Rejetée (Relation/Différence significative)' : 'H₀ Conservée'}
                </div>
                <p class="mt-4 text-xs opacity-95 leading-relaxed overflow-y-auto max-h-[150px] p-3 rounded-lg bg-black/5" style="color: ${customTheme.textColor}">${item.content || ''}</p>
              </div>
            `;
          } else if (item.type === 'analysis_table') {
            const dataMatrix = item.metricData || [];
            const rowsHtml = dataMatrix.map((row: any[], i: number) => {
              const cellsHtml = row.map((cell: any, j: number) => {
                const cellVal = cell !== null && cell !== undefined ? cell : '';
                return `<td class="px-3 py-2 ${j === 0 ? 'font-semibold' : ''}">${cellVal}</td>`;
              }).join('');
              return `<tr class="${i === 0 ? 'bg-black/10 font-bold uppercase tracking-wider text-[11px]' : ''} border-b border-black/10">${cellsHtml}</tr>`;
            }).join('');

            itemInnerHtml = `
              <div class="overflow-x-auto m-2 flex-1 max-h-[220px]">
                <table class="w-full text-xs text-left border-collapse min-w-max">
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>
              </div>
            `;
          } else if (item.type === 'analysis_associations_list') {
            const listData = item.metricData || [];
            const listItemsHtml = listData.map((assoc: any) => {
              const percentage = assoc.total_percentage?.toFixed(decimals) || '0.0';
              return `
                <div class="flex justify-between items-center border border-black/10 rounded-lg p-3 bg-black/5">
                  <div class="flex gap-2">
                    <span class="font-semibold text-xs">${assoc.x_val}</span>
                    <span class="opacity-50">×</span>
                    <span class="font-semibold text-xs">${assoc.y_val}</span>
                  </div>
                  <div class="flex items-center gap-4 text-xs">
                    <span class="opacity-75">${assoc.count} cas</span>
                    <span class="font-bold px-2 py-1 rounded bg-indigo-500/10" style="color: ${customTheme.metricColor}">${percentage}%</span>
                  </div>
                </div>
              `;
            }).join('');

            itemInnerHtml = `
              <div class="overflow-y-auto mt-2 flex-1 space-y-2 max-h-[200px] p-1">
                ${listItemsHtml}
              </div>
            `;
          } else if (item.type === 'analysis_chart') {
            const analysis = history.find(h => h.id === item.analysisId);
            const chartData = (analysis && item.chartKey && item.chartKey !== 'chart') ? analysis.metrics?.[item.chartKey] : (analysis ? analysis.chart : null);
            if (chartData) {
              chartsToInitialize.push({
                elementId: `plotly-chart-${item.id}`,
                data: chartData.data,
                layout: {
                  ...chartData.layout,
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: customTheme.textColor },
                  xaxis: { ...chartData.layout.xaxis, gridcolor: customTheme.borderColor },
                  yaxis: { ...chartData.layout.yaxis, gridcolor: customTheme.borderColor }
                }
              });
              itemInnerHtml = `
                <div id="plotly-chart-${item.id}" class="w-full h-full flex-1 min-h-[300px]"></div>
              `;
            } else {
              itemInnerHtml = `<div class="p-4 text-xs opacity-50 italic">Graphique indisponible</div>`;
            }
          }
          
          return `
            <div class="col-span-12 md:col-span-${item.layout.w} rounded-2xl shadow-sm border p-5 flex flex-col dashboard-card" style="min-height: ${item.layout.h * 65}px;">
              <div class="text-[10px] uppercase font-black tracking-wider border-b border-black/5 pb-2 mb-3 flex items-center justify-between opacity-80" style="color: ${customTheme.textColor}">
                <span>${item.title}</span>
              </div>
              <div class="flex-1 flex flex-col justify-center min-h-0">
                ${itemInnerHtml}
              </div>
            </div>
          `;
        }).join('');
        
        return `
          <div id="page-content-${p.id}" class="page-content ${pIdx === 0 ? '' : 'hidden'}">
            <div class="grid grid-cols-12 gap-6">
              ${itemsListHtml || `
                <div class="col-span-12 py-16 text-center text-sm opacity-50 italic">
                  Cette page du tableau de bord ne contient actuellement aucun élément.
                </div>
              `}
            </div>
          </div>
        `;
      }).join('');
      
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${dashboardTitle || 'Tableau de Bord Nuru'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.plot.ly/plotly-2.24.1.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800;900&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background-color: ${customTheme.bgColor};
      color: ${customTheme.textColor};
    }
    .dashboard-card {
      background-color: ${customTheme.cardBgColor};
      border-color: ${customTheme.borderColor};
      color: ${customTheme.textColor};
    }
    .metric-value {
      color: ${customTheme.metricColor};
    }
    .prose h1, .prose h2, .prose h3 {
      color: inherit;
      font-weight: 800;
      margin-top: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .prose h1 { font-size: 1.5rem; }
    .prose h2 { font-size: 1.25rem; }
    .prose h3 { font-size: 1.1rem; }
    .prose p { margin-bottom: 0.25rem; }
  </style>
</head>
<body class="p-6 md:p-12 min-h-screen flex flex-col">
  
  <!-- Interactive Header -->
  <header class="mb-8 pb-6 border-b border-black/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-black tracking-tight" style="color: ${customTheme.textColor}">
        ${dashboardTitle || 'Tableau de Bord Nuru'}
      </h1>
      <p class="text-xs font-bold mt-1 opacity-60" style="color: ${customTheme.textColor}">
        Tableau de Bord Interactif • Exporté depuis Nuru le ${new Date().toLocaleDateString('fr-FR')}
      </p>
    </div>
    <div class="flex items-center gap-2 bg-indigo-500/10 px-4 py-2 rounded-xl border border-indigo-500/20 text-xs font-bold" style="color: ${customTheme.metricColor}">
      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
      Espace Interactif Connecté
    </div>
  </header>

  <!-- Interactive Pages Navigation -->
  ${pages.length > 1 ? `
  <nav class="flex flex-wrap gap-2 mb-8 border-b border-black/5 pb-4">
    ${pages.map((p, pIdx) => `
      <button 
        class="tab-button px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all duration-300"
        onclick="switchPage('${p.id}')" 
        id="tab-${p.id}"
        style="
          color: ${pIdx === 0 ? '#ffffff' : customTheme.textColor};
          background-color: ${pIdx === 0 ? customTheme.metricColor : 'transparent'};
          border-color: ${pIdx === 0 ? customTheme.metricColor : customTheme.borderColor};
        "
      >
        ${p.title}
      </button>
    `).join('')}
  </nav>
  ` : ''}

  <!-- Pages Content Area -->
  <main class="flex-1">
    ${pagesHtml}
  </main>

  <!-- Footer -->
  <footer class="mt-16 pt-6 border-t border-black/5 text-center text-[10px] font-bold opacity-40 uppercase tracking-widest" style="color: ${customTheme.textColor}">
    Développé avec Nuru • Outils Statistiques Autonomes
  </footer>

  <script>
    // Tab controller
    function switchPage(pageId) {
      document.querySelectorAll('.page-content').forEach(el => {
        el.classList.add('hidden');
      });
      document.querySelectorAll('.tab-button').forEach(btn => {
        btn.style.backgroundColor = 'transparent';
        btn.style.color = '${customTheme.textColor}';
        btn.style.borderColor = '${customTheme.borderColor}';
      });
      
      const pageEl = document.getElementById('page-content-' + pageId);
      if (pageEl) pageEl.classList.remove('hidden');
      
      const activeBtn = document.getElementById('tab-' + pageId);
      if (activeBtn) {
        activeBtn.style.backgroundColor = '${customTheme.metricColor}';
        activeBtn.style.color = '#ffffff';
        activeBtn.style.borderColor = '${customTheme.metricColor}';
      }
      
      window.dispatchEvent(new Event('resize'));
    }

    // Parse Markdown content cleanly
    document.querySelectorAll('.markdown-container').forEach(container => {
      const rawEl = container.querySelector('.markdown-raw');
      const targetEl = container.querySelector('.parsed-markdown');
      if (rawEl && targetEl) {
        const decoded = decodeURIComponent(rawEl.textContent);
        targetEl.innerHTML = marked.parse(decoded);
      }
    });

    // Initialize Plotly Charts
    const chartsToInit = ${JSON.stringify(chartsToInitialize)};
    chartsToInit.forEach(chart => {
      Plotly.newPlot(chart.elementId, chart.data, chart.layout, { 
        responsive: true, 
        displayModeBar: false 
      });
    });
  </script>
</body>
</html>`;

      const safeFileName = `dashboard_${(dashboardTitle || 'nuru').toLowerCase().replace(/[^a-z0-9]/g, '_')}.html`;
      const base64Content = btoa(unescape(encodeURIComponent(htmlContent)));
      
      if (api.save_base64_file) {
        const response = await api.save_base64_file(base64Content, safeFileName);
        if (response.success) {
          toast.success(`Succès : ${response.message || 'Tableau de bord enregistré sur PC.'}`);
        } else {
          toast.error(`Erreur : ${response.error || 'Sauvegarde échouée'}`);
        }
      } else {
        toast.error("Fonctionnalité d'exportation non disponible dans cet environnement.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur d'exportation : ${err.message}`);
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<'light'|'dark'>('light');
  const [presentationMode, setPresentationMode] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [draggedItemDims, setDraggedItemDims] = useState({ w: 6, h: 4 });
  const draggedItemRef = useRef<any>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

  const currentPage = pages.find(p => p.id === currentPageId) || pages[0];
  const items = currentPage ? currentPage.items : [];

  const handleLayoutChange = (layout: any[], layouts: any) => {
    updateLayout(layout);
  };

  const onDrop = (layout: any, layoutItem: any, _event: Event) => {
    let data;
    try {
      const e = _event as unknown as DragEvent;
      const dataString = e.dataTransfer?.getData('application/json') || e.dataTransfer?.getData('text/plain');
      if (dataString) {
        data = JSON.parse(dataString);
      }
    } catch (err) {
      console.error('Failed to parse dropped item', err);
    }
    
    if (!data && draggedItemRef.current) {
        data = draggedItemRef.current;
    }

    if (!data) return;

    let defaultW = 6, defaultH = 4;
    if (data.type === 'text') { defaultW = 6; defaultH = 4; }
    if (data.type === 'analysis_metric_card') { defaultW = 2; defaultH = 2; }
    if (data.type === 'analysis_decision') { defaultW = 5; defaultH = 3; }
    if (data.type === 'analysis_chart') { defaultW = 6; defaultH = 8; }
    if (data.type === 'analysis_table') { defaultW = 6; defaultH = 6; }
    if (data.type === 'analysis_associations_list') { defaultW = 6; defaultH = 6; }
    
    const parsedData = { ...data };
    delete parsedData.defaultW;
    delete parsedData.defaultH;

    if (parsedData.type === 'text' && !parsedData.style) {
      parsedData.style = { textAlign: 'center', fontSize: '1rem', color: '' };
    }

    addItem({
      ...parsedData,
      layout: { x: layoutItem.x, y: layoutItem.y, w: defaultW, h: defaultH }
    });

    draggedItemRef.current = null;
  };

  const handleDragStart = (e: React.DragEvent, itemData: any) => {
    let defaultW = 6, defaultH = 4;
    if (itemData.type === 'text') { defaultW = 6; defaultH = 4; }
    if (itemData.type === 'analysis_metric_card') { defaultW = 2; defaultH = 2; }
    if (itemData.type === 'analysis_decision') { defaultW = 5; defaultH = 3; }
    if (itemData.type === 'analysis_chart') { defaultW = 6; defaultH = 8; }
    if (itemData.type === 'analysis_table') { defaultW = 6; defaultH = 6; }
    if (itemData.type === 'analysis_associations_list') { defaultW = 6; defaultH = 6; }
    setDraggedItemDims({ w: defaultW, h: defaultH });

    const dataStr = JSON.stringify(itemData);
    e.dataTransfer.setData('application/json', dataStr);
    e.dataTransfer.setData('text/plain', dataStr);
    e.dataTransfer.effectAllowed = 'copy';
    draggedItemRef.current = itemData;
  };

  const handleItemClick = (itemData: any) => {
    let finalData = { ...itemData };
    if (finalData.type === 'text' && !finalData.style) {
      finalData.style = { textAlign: 'center', fontSize: '1rem', color: '' };
    }
    addItem({ ...finalData });
  };

  const renderMetricCardValue = (val: any) => {
    if (typeof val === 'number') return val.toFixed(useWorkspaceStore.getState().decimals);
    return val;
  };

  const renderItemContent = (item: DashboardItem) => {
    if (item.type === 'text') {
      const alignClass = item.style?.textAlign === 'center' ? 'text-center items-center' : item.style?.textAlign === 'right' ? 'text-right items-end' : 'text-left items-start';
      const textColor = item.style?.color || customTheme.textColor;
      const fontSize = item.style?.fontSize || '1rem';

      if (editingId === item.id) {
        return (
          <div className="w-full h-full flex flex-col bg-slate-50 relative p-2">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-slate-200 rounded-lg p-1.5 flex items-center gap-1 z-50">
               <button onMouseDown={(e) => { e.preventDefault(); updateItem(item.id, { content: (item.content || '') + '# ' })}} className="px-2 py-1 text-xs font-bold hover:bg-slate-100 rounded cursor-pointer">H1</button>
               <button onMouseDown={(e) => { e.preventDefault(); updateItem(item.id, { content: (item.content || '') + '## ' })}} className="px-2 py-1 text-xs font-bold hover:bg-slate-100 rounded cursor-pointer">H2</button>
               <button onMouseDown={(e) => { e.preventDefault(); updateItem(item.id, { content: (item.content || '') + '**gras**' })}} className="px-2 py-1 text-xs font-bold hover:bg-slate-100 rounded cursor-pointer">B</button>
               <div className="w-px h-4 bg-slate-300 mx-1"></div>
               <button onMouseDown={(e) => { e.preventDefault(); updateItem(item.id, { style: { ...item.style, textAlign: 'left' }})}} className={`px-2 py-1 text-xs font-bold hover:bg-slate-100 rounded cursor-pointer ${item.style?.textAlign === 'left' ? 'bg-slate-200' : ''}`}>Gauche</button>
               <button onMouseDown={(e) => { e.preventDefault(); updateItem(item.id, { style: { ...item.style, textAlign: 'center' }})}} className={`px-2 py-1 text-xs font-bold hover:bg-slate-100 rounded cursor-pointer ${item.style?.textAlign === 'center' ? 'bg-slate-200' : ''}`}>Centre</button>
               <div className="w-px h-4 bg-slate-300 mx-1"></div>
               <input type="color" className="w-6 h-6 p-0 border-0 cursor-pointer" value={item.style?.color || customTheme.textColor} onChange={(e) => updateItem(item.id, { style: { ...item.style, color: e.target.value }})} />
            </div>
            <textarea 
              className={`flex-1 w-full h-full p-4 pt-12 border-2 border-indigo-400 bg-white rounded outline-none resize-none ${alignClass}`}
              style={{ color: textColor, fontSize }}
              value={item.content || ''}
              onChange={(e) => updateItem(item.id, { content: e.target.value })}
              autoFocus
              onBlur={() => setEditingId(null)}
              placeholder="Écrivez votre texte..."
            />
          </div>
        );
      }
      return (
        <div 
          className={`w-full h-full p-6 overflow-y-auto cursor-pointer markdown-body flex flex-col justify-center bg-transparent ${alignClass}`}
          style={{ color: textColor, fontSize }}
          onDoubleClick={() => setEditingId(item.id)}
          title="Double-cliquez pour éditer"
        >
          <div className="prose max-w-none w-full" style={{ color: 'inherit', fontSize: 'inherit', textAlign: item.style?.textAlign || 'center' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {item.content || '*Texte vide...*'}
            </ReactMarkdown>
          </div>
        </div>
      );
    }
    
    if (item.type === 'image') {
      return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden bg-transparent">
          {item.content ? (
            <img src={item.content} alt={item.title} className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center opacity-65" style={{ color: customTheme.textColor }}>
              <ImageIcon className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Aucune image</span>
            </div>
          )}
        </div>
      );
    }

    if (item.type === 'analysis_chart') {
      const analysis = history.find(h => h.id === item.analysisId);
      if (!analysis) return <div className="p-4 text-xs opacity-50 italic">Analyse introuvable</div>;
      const chartData = (item.chartKey && item.chartKey !== 'chart') ? analysis.metrics?.[item.chartKey] : analysis.chart;
      if (!chartData) return <div className="p-4 text-xs opacity-50 italic">Graphique introuvable</div>;

      return (
        <div className="w-full h-full p-2 relative">
           <Plot
            data={chartData.data}
            layout={{
              ...chartData.layout,
              autosize: true,
              margin: { t: 30, r: 10, l: 30, b: 30 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: { color: customTheme.textColor },
              xaxis: { ...chartData.layout.xaxis, gridcolor: customTheme.borderColor, tickcolor: customTheme.textColor },
              yaxis: { ...chartData.layout.yaxis, gridcolor: customTheme.borderColor, tickcolor: customTheme.textColor }
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      );
    }

    if (item.type === 'analysis_metric_card') {
      const textColor = item.style?.color || customTheme.metricColor;
      const fontSize = item.style?.fontSize || '1.875rem';

      if (editingId === item.id) {
        return (
          <div className="w-full h-full flex flex-col justify-center items-center relative p-2 bg-slate-50">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-slate-200 rounded-lg p-1.5 flex items-center gap-2 z-50">
               <button onMouseDown={(e) => { e.preventDefault(); updateItem(item.id, { style: { ...item.style, fontSize: '1.25rem' }})}} className="px-2 py-1 text-xs font-bold hover:bg-slate-100 rounded cursor-pointer">S</button>
               <button onMouseDown={(e) => { e.preventDefault(); updateItem(item.id, { style: { ...item.style, fontSize: '1.875rem' }})}} className="px-2 py-1 text-xs font-bold hover:bg-slate-100 rounded cursor-pointer">M</button>
               <button onMouseDown={(e) => { e.preventDefault(); updateItem(item.id, { style: { ...item.style, fontSize: '2.5rem' }})}} className="px-2 py-1 text-xs font-bold hover:bg-slate-100 rounded cursor-pointer">L</button>
               <div className="w-px h-4 bg-slate-300 mx-1"></div>
               <input type="color" className="w-6 h-6 p-0 border-0 cursor-pointer" value={item.style?.color || customTheme.metricColor} onChange={(e) => updateItem(item.id, { style: { ...item.style, color: e.target.value }})} />
               <button onMouseDown={(e) => { e.preventDefault(); setEditingId(null) }} className="px-2 py-1 text-xs font-bold bg-indigo-600 text-white rounded cursor-pointer">OK</button>
            </div>
            
            <div className="flex-1 w-full flex flex-col items-center justify-center border-2 border-indigo-40 border-dashed rounded-lg" tabIndex={0} autoFocus>
               <span className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70" style={{ color: customTheme.textColor }}>{item.metricLabel}</span>
               <span style={{ color: textColor, fontSize }} className="font-black">{renderMetricCardValue(item.metricData)}</span>
            </div>
          </div>
        );
      }
      return (
        <div 
          className="w-full h-full flex flex-col justify-center items-center text-center p-4 cursor-pointer hover:ring-2 ring-indigo-400/30 transition-all bg-transparent"
          onDoubleClick={() => setEditingId(item.id)}
          title="Double-cliquez pour styliser"
        >
           <span className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70" style={{ color: customTheme.textColor }}>{item.metricLabel}</span>
           <span style={{ color: textColor, fontSize }} className="font-black">{renderMetricCardValue(item.metricData)}</span>
        </div>
      );
    }

    if (item.type === 'analysis_decision') {
      const isSignificant = item.metricData?.p_value !== undefined && item.metricData.p_value < useWorkspaceStore.getState().alpha;
      return (
        <div className="w-full h-full flex flex-col p-6 bg-transparent" style={{ color: customTheme.textColor }}>
           <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">Décision Statistique (Seuil α = 5%)</span>
              {item.metricData?.p_value !== undefined && (
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${isSignificant ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {isSignificant ? 'P < 0.05 (Significatif)' : 'P ≥ 0.05 (Non significatif)'}
                </div>
              )}
           </div>
           
           <div className={`text-lg font-black flex items-center gap-2 ${isSignificant ? 'text-emerald-600' : 'text-rose-600'}`}>
              <div className={`w-2 h-2 rounded-full ${isSignificant ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
              {isSignificant ? 'H₀ Rejetée' : 'H₀ Conservée'}
           </div>
           
           {item.content && (
              <p className="mt-2 text-sm opacity-90 leading-relaxed overflow-y-auto max-h-[140px] bg-black/5 p-3 rounded-xl">{item.content}</p>
           )}
        </div>
      );
    }

    if (item.type === 'analysis_table') {
      const dataMatrix = item.metricData || [];
      return (
        <div className="w-full h-full overflow-auto p-4 bg-transparent" style={{ color: customTheme.textColor }}>
          <table className="w-full text-sm text-left border-collapse min-w-max">
             <tbody>
                {dataMatrix.map((row: any[], i: number) => (
                  <tr key={i} className={`${i === 0 ? 'bg-black/10' : ''} border-b`} style={{ borderColor: customTheme.borderColor }}>
                    {row.map((cell: any, j: number) => (
                       <td key={j} className={`px-4 py-2 ${i === 0 ? 'font-bold uppercase tracking-wider text-[11px]' : ''} ${j === 0 ? 'font-semibold' : ''}`}>
                          {cell}
                       </td>
                    ))}
                  </tr>
                ))}
             </tbody>
          </table>
        </div>
      );
    }

    if (item.type === 'analysis_associations_list') {
        const top = item.metricData || [];
        return (
          <div className="w-full h-full overflow-auto p-4 bg-transparent" style={{ color: customTheme.textColor }}>
             <h4 className="text-xs font-semibold uppercase tracking-wider mb-3 opacity-85">Principales Associations</h4>
             <div className="grid gap-2">
                {top.map((assoc: any, i: number) => (
                  <div key={i} className="flex justify-between items-center border rounded-lg p-3 bg-black/5" style={{ borderColor: customTheme.borderColor }}>
                    <div className="flex gap-2">
                      <span className="font-semibold text-sm">{assoc.x_val}</span>
                      <span className="opacity-50">×</span>
                      <span className="font-semibold text-sm">{assoc.y_val}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="opacity-75">{assoc.count} cas</span>
                      <span className="font-bold px-2 py-1 rounded" style={{ backgroundColor: `${customTheme.metricColor}15`, color: customTheme.metricColor }}>
                        {(assoc.total_percentage?.toFixed(useWorkspaceStore.getState().decimals)) ?? '0.0'}%
                      </span>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        );
    }

    return null;
  };

  const handleAddImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        addItem({ type: 'image', title: 'Image', content: re.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to extract granular metrics from an analysis history item
  const getExtractableBlocks = (analysis: any) => {
    const blocks: any[] = [];
    
    // 1. Core plot / chart
    if (analysis.chart) {
      blocks.push({
        type: 'analysis_chart',
        title: `Graphique: ${analysis.title}`,
        analysisId: analysis.id,
        chartKey: 'chart'
      });
    }

    // Extra diagnostics/optional plots inside metrics
    if (analysis.metrics) {
      const extraCharts = [
        { key: 'roc_chart', label: 'Courbe ROC' },
        { key: 'actual_vs_predicted', label: 'Réel vs Prédit' },
        { key: 'qq_plot', label: 'Graphique Q-Q' },
        { key: 'pp_plot', label: 'Graphique P-P' },
        { key: 'residuals_distribution', label: 'Dist. des Résidus' },
        { key: 'residuals_vs_fitted', label: 'Résidus vs Ajustements' }
      ];
      extraCharts.forEach(c => {
        if (analysis.metrics[c.key]) {
          blocks.push({
            type: 'analysis_chart',
            title: `${c.label}: ${analysis.title}`,
            analysisId: analysis.id,
            chartKey: c.key
          });
        }
      });
    }

    // 2. Automated hypothesis test result card & values
    if (analysis.metrics?.test_result) {
      blocks.push({
        type: 'analysis_decision',
        title: 'Décision du test: ' + analysis.title,
        analysisId: analysis.id,
        content: analysis.interpretation,
        metricData: analysis.metrics.test_result
      });
      
      if (analysis.metrics.test_result.p_value !== undefined) {
        blocks.push({ type: 'analysis_metric_card', title: 'P-Value', metricLabel: 'P-Value', metricData: analysis.metrics.test_result.p_value, analysisId: analysis.id });
      }
      if (analysis.metrics.test_result.statistic !== undefined) {
        blocks.push({ type: 'analysis_metric_card', title: 'Statistique', metricLabel: 'Stat. du Test', metricData: analysis.metrics.test_result.statistic, analysisId: analysis.id });
      }
      if (analysis.metrics.test_result.df !== undefined) {
        blocks.push({ type: 'analysis_metric_card', title: 'Degrés de liberté', metricLabel: 'ddl (df)', metricData: analysis.metrics.test_result.df, analysisId: analysis.id });
      }
    }

    // 3. Central & Dispersion metrics
    if (analysis.metrics?.mean !== undefined) {
      blocks.push({ type: 'analysis_metric_card', title: 'Moyenne', metricLabel: 'Moyenne', metricData: analysis.metrics.mean, analysisId: analysis.id });
    }
    if (analysis.metrics?.median !== undefined) {
      blocks.push({ type: 'analysis_metric_card', title: 'Médiane', metricLabel: 'Médiane', metricData: analysis.metrics.median, analysisId: analysis.id });
    }
    if (analysis.metrics?.std_dev !== undefined || analysis.metrics?.std !== undefined) {
      blocks.push({ type: 'analysis_metric_card', title: 'Écart-Type', metricLabel: 'Écart-Type', metricData: analysis.metrics.std_dev ?? analysis.metrics.std, analysisId: analysis.id });
    }
    if (analysis.metrics?.min !== undefined) {
      blocks.push({ type: 'analysis_metric_card', title: 'Minimum', metricLabel: 'Min', metricData: analysis.metrics.min, analysisId: analysis.id });
    }
    if (analysis.metrics?.max !== undefined) {
      blocks.push({ type: 'analysis_metric_card', title: 'Maximum', metricLabel: 'Max', metricData: analysis.metrics.max, analysisId: analysis.id });
    }

    // 4. Bivariate links
    if (analysis.metrics?.pearson_r !== undefined) {
      blocks.push({ type: 'analysis_metric_card', title: 'Corrélation (r)', metricLabel: 'Pearson (r)', metricData: analysis.metrics.pearson_r, analysisId: analysis.id });
    }
    if (analysis.metrics?.spearman_rho !== undefined) {
      blocks.push({ type: 'analysis_metric_card', title: 'Corrélation (Rho)', metricLabel: 'Spearman (ρ)', metricData: analysis.metrics.spearman_rho, analysisId: analysis.id });
    }

    // Contingency tables and other matrices
    if (analysis.metrics?.contingency_table !== undefined) {
      blocks.push({ type: 'analysis_table', title: 'Tableau Croisé', metricLabel: 'Tableau de contingence', metricData: analysis.metrics.contingency_table, analysisId: analysis.id });
    }
    if (analysis.metrics?.top_associations_percentages !== undefined) {
      blocks.push({ type: 'analysis_associations_list', title: 'Pourcentages (Top)', metricLabel: 'Top associations', metricData: analysis.metrics.top_associations_percentages, analysisId: analysis.id });
    }

    // Frequency tables transformed into matrix tables
    if (analysis.metrics?.frequency_table !== undefined) {
      const matrix = [
        ['Catégorie', 'Effectif', '%', '% Cumulé'],
        ...analysis.metrics.frequency_table.map((row: any) => [
          row.category,
          row.count,
          typeof row.percentage === 'number' ? `${row.percentage.toFixed(2)}%` : row.percentage,
          typeof row.cumulative_percentage === 'number' ? `${row.cumulative_percentage.toFixed(2)}%` : row.cumulative_percentage
        ])
      ];
      blocks.push({ type: 'analysis_table', title: 'Fréquences: ' + analysis.title, metricLabel: 'Tableau des Fréquences', metricData: matrix, analysisId: analysis.id });
    }

    // Group statistical groupings (Quant x Qual)
    if (analysis.metrics?.group_stats !== undefined) {
      const matrix = [
        ['Groupe', 'Moyenne', 'Médiane', 'Écart-type', 'Eff.'],
        ...analysis.metrics.group_stats.map((row: any) => [
          row.category,
          row.mean !== null && row.mean !== undefined ? row.mean.toFixed(2) : '-',
          row.median !== null && row.median !== undefined ? row.median.toFixed(2) : '-',
          row.std !== null && row.std !== undefined ? row.std.toFixed(2) : '-',
          row.count
        ])
      ];
      blocks.push({ type: 'analysis_table', title: 'Stats de Groupe: ' + analysis.title, metricLabel: 'Statistiques par groupe', metricData: matrix, analysisId: analysis.id });
    }

    // 5. Linear / Logistic Regression specific metrics
    if (analysis.metrics?.isRegression || analysis.metrics?.r_squared !== undefined) {
       if (analysis.metrics?.r_squared !== undefined) {
         blocks.push({ type: 'analysis_metric_card', title: 'R² (R-Deux)', metricLabel: 'R-Deux (R²)', metricData: analysis.metrics.r_squared, analysisId: analysis.id });
       }
       if (analysis.metrics?.r_squared_adj !== undefined) {
         blocks.push({ type: 'analysis_metric_card', title: 'R² Ajusté', metricLabel: 'R² Ajusté', metricData: analysis.metrics.r_squared_adj, analysisId: analysis.id });
       }
       if (analysis.metrics?.f_statistic !== undefined) {
         blocks.push({ type: 'analysis_metric_card', title: 'Fisher (F)', metricLabel: 'F-Statistic', metricData: analysis.metrics.f_statistic, analysisId: analysis.id });
       }
       if (analysis.metrics?.residual_std_error !== undefined) {
         blocks.push({ type: 'analysis_metric_card', title: 'Erreur RSE', metricLabel: 'Erreur (RSE)', metricData: analysis.metrics.residual_std_error, analysisId: analysis.id });
       }
       
       if (analysis.metrics?.coefficients !== undefined) {
         const hasClass = analysis.metrics.coefficients.some((c: any) => c.class !== undefined);
         const headers = hasClass 
           ? ['Variable', 'Classe cible', 'Coefficient (β)', 'z/t-stat', 'p-value']
           : ['Variable', 'Coefficient (β)', 'z/t-stat', 'p-value'];
         
         const matrix = [
           headers,
           ...analysis.metrics.coefficients.map((c: any) => [
             c.variable || c.factor || '',
             ...(hasClass ? [c.class ? `${c.class} (vs ${c.reference})` : ''] : []),
             c.coefficient !== undefined && c.coefficient !== null ? c.coefficient.toFixed(3) : '-',
             c.statistic !== undefined && c.statistic !== null ? c.statistic.toFixed(3) : '-',
             c.p_value !== undefined && c.p_value !== null ? (c.p_value < 0.001 ? '<0.001' : c.p_value.toFixed(4)) : '-'
           ])
         ];
         blocks.push({ type: 'analysis_table', title: 'Coefficients: ' + analysis.title, metricLabel: 'Coefficients du modèle', metricData: matrix, analysisId: analysis.id });
       }
    }

    // 6. Automated explanation/interpretation block prefilled as dynamic text Markdown
    if (analysis.interpretation) {
      blocks.push({
        type: 'text',
        title: `Interprétation: ${analysis.title}`,
        content: analysis.interpretation,
        style: { textAlign: 'left', fontSize: '0.9rem', color: '' }
      });
    }

    return blocks;
  };

  if (presentationMode) {
    const slide = pages[currentSlideIndex];
    if (!slide) return null;

    return (
      <div className={`fixed inset-0 z-[100] flex flex-col ${themeMode === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-[#f8fafc] text-slate-900'}`}>
        <div className="fixed top-6 right-6 z-[110] flex items-center gap-4">
           {pages.length > 1 && (
             <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 backdrop-blur-md rounded-full shadow-lg border border-slate-700/50">
               <button 
                 disabled={currentSlideIndex === 0}
                 onClick={() => setCurrentSlideIndex(c => Math.max(0, c - 1))}
                 className="p-1 rounded-full hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:hover:bg-transparent"
               >
                 <ChevronLeft className="w-5 h-5" />
               </button>
               <span className="text-sm font-bold w-12 text-center text-slate-200">{currentSlideIndex + 1} / {pages.length}</span>
               <button 
                 disabled={currentSlideIndex === pages.length - 1}
                 onClick={() => setCurrentSlideIndex(c => Math.min(pages.length - 1, c + 1))}
                 className="p-1 rounded-full hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:hover:bg-transparent"
               >
                 <ChevronRight className="w-5 h-5" />
               </button>
             </div>
           )}
          <button 
            onClick={() => handleItemClick({ type: 'text', title: 'Texte / Markdown', content: 'Éditez ce texte...', style: { textAlign: 'center', fontSize: '1rem', color: '' } })}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl transition"
          >
            <Type className="w-4 h-4" /> Ajouter Texte
          </button>
          <button 
            onClick={() => setPresentationMode(false)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl transition opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" /> Mode Édition
          </button>
        </div>

        <div className="flex-1 overflow-auto p-12 relative flex items-center justify-center">
            <div className="w-full max-w-7xl relative min-h-[600px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                 <motion.div 
                    key={slide.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.4 }}
                    className="w-full h-full"
                 >
                    <ResponsiveGridLayout
                        className="layout h-full"
                        layouts={{ lg: slide.items.map(i => ({ i: i.id, ...i.layout })) }}
                        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                        rowHeight={30}
                        onLayoutChange={handleLayoutChange}
                        isDroppable={false}
                        isDraggable={true}
                        isResizable={true}
                        margin={[24, 24]}
                        useCSSTransforms={true}
                      >
                        {slide.items.map(item => (
                          <div key={item.id} className={`rounded-3xl shadow-xl border overflow-hidden flex flex-col group ${
                            themeMode === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'
                          } transition-colors duration-200`}>
                            <div className="flex-1 relative min-h-0 bg-transparent w-full h-full">
                              {renderItemContent(item)}
                            </div>
                          </div>
                        ))}
                      </ResponsiveGridLayout>
                 </motion.div>
              </AnimatePresence>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full flex overflow-hidden ${themeMode === 'dark' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Sidebar Palette left */}
      <aside className={`w-80 h-full flex flex-col shrink-0 border-r z-10 shadow-lg ${themeMode === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="h-16 shrink-0 border-b flex items-center px-6 gap-3 border-inherit">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold">Palette d'Outils</h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Glissez ou cliquez pour ajouter</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
           {/* Configuration & Style Box */}
           <div className={`p-4 rounded-xl border ${themeMode === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50/80 border-slate-200'} space-y-4`}>
             <h3 className="text-xs font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
               🎨 Configuration & Style
             </h3>
             
             {/* Title Input */}
             <div className="space-y-1">
               <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                 Titre du Tableau de Bord
               </label>
               <input
                 type="text"
                 value={dashboardTitle}
                 onChange={(e) => setDashboardTitle(e.target.value)}
                 className={`w-full px-3 py-1.5 text-xs font-semibold rounded-lg border focus:ring-1 focus:ring-indigo-500 transition outline-none ${
                   themeMode === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                 }`}
                 placeholder="ex: Rapport d'Analyses Nuru"
               />
             </div>

             {/* Presets Grid */}
             <div className="space-y-1">
               <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                 Thèmes de Couleurs
               </label>
               <div className="grid grid-cols-2 gap-1.5">
                 {[
                   {
                     name: "Standard S.",
                     colors: { bgColor: "#f8fafc", textColor: "#1f2937", metricColor: "#4f46e5", cardBgColor: "#ffffff", borderColor: "#e5e7eb" }
                   },
                   {
                     name: "Papier Chaud",
                     colors: { bgColor: "#FAF9F5", textColor: "#2D261F", metricColor: "#B84A39", cardBgColor: "#FDFDFB", borderColor: "#ECE9DF" }
                   },
                   {
                     name: "Nuit Nordique",
                     colors: { bgColor: "#0F172A", textColor: "#F1F5F9", metricColor: "#6366F1", cardBgColor: "#1E293B", borderColor: "#334155" }
                   },
                   {
                     name: "Émeraude Zen",
                     colors: { bgColor: "#F0FDF4", textColor: "#14532D", metricColor: "#059669", cardBgColor: "#FFFFFF", borderColor: "#DCFCE7" }
                   }
                 ].map((preset, i) => (
                   <button
                     key={i}
                     onClick={() => setCustomTheme(preset.colors)}
                     className={`px-1.5 py-1 rounded-lg border text-[10px] font-bold text-left transition-all ${
                       customTheme.bgColor === preset.colors.bgColor
                         ? 'border-indigo-500 bg-indigo-55/10 text-indigo-600 dark:text-indigo-400'
                         : 'border-slate-205 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                     }`}
                   >
                     <div className="flex items-center gap-1.5">
                       <span className="w-2 h-2 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: preset.colors.bgColor }} />
                       <span className="truncate">{preset.name}</span>
                     </div>
                   </button>
                 ))}
               </div>
             </div>

             {/* Advanced Custom Color Pickers */}
             <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
               <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Ajustements Fins</span>
               <div className="grid grid-cols-2 gap-1.5">
                 {[
                   { label: "Fond", key: "bgColor" },
                   { label: "Texte", key: "textColor" },
                   { label: "Métriques", key: "metricColor" },
                   { label: "Bordures", key: "borderColor" }
                 ].map((col) => (
                   <div key={col.key} className="flex items-center justify-between gap-1 bg-slate-100/30 dark:bg-black/10 px-1.5 py-0.5 rounded-md">
                     <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400">{col.label}</span>
                     <input
                       type="color"
                       value={customTheme[col.key as keyof typeof customTheme]}
                       onChange={(e) => setCustomTheme({ [col.key]: e.target.value })}
                       className="w-4 h-4 rounded cursor-pointer p-0 border-0 bg-transparent"
                     />
                   </div>
                 ))}
               </div>
             </div>
           </div>

           {/* Basic Elements */}
           <div>
             <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${themeMode === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Éléments Libres</h3>
             <div className="grid grid-cols-2 gap-2">
                <div 
                  className={`border rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-grab active:cursor-grabbing hover:border-indigo-400 transition-colors ${themeMode === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, { type: 'text', title: 'Texte / Markdown', content: 'Éditez ce texte...' })}
                  onClick={() => handleItemClick({ type: 'text', title: 'Texte / Markdown', content: 'Éditez ce texte...' })}
                >
                  <Type className="w-6 h-6 text-emerald-500" />
                  <span className="text-xs font-semibold">Texte</span>
                </div>
                
                <div 
                   className="relative"
                >
                  <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleAddImageUpload} title="Cliquer pour importer une image" />
                  <div className={`border rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:border-indigo-400 transition-colors ${themeMode === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <ImageIcon className="w-6 h-6 text-sky-500" />
                    <span className="text-xs font-semibold text-center">Importer Image</span>
                  </div>
                </div>
             </div>
           </div>

           {/* Analyses and Metrics */}
           <div>
             <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${themeMode === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
               <BarChart2 className="w-4 h-4" /> Résultats d'Analyses
             </h3>
             {history.length === 0 ? (
               <div className="text-xs text-slate-500 italic p-4 text-center border border-dashed rounded-lg">Aucun résultat trouvé. Effectuez des analyses stat. pour peupler la palette.</div>
             ) : (
               <div className="space-y-2">
                 {history.slice().reverse().map(analysis => {
                   const blocks = getExtractableBlocks(analysis);
                   const isExpanded = expandedAnalysis === analysis.id;
                   
                   return (
                     <div key={analysis.id} className={`border rounded-xl overflow-hidden transition-colors ${themeMode === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
                        <button 
                          className={`w-full flex items-center justify-between p-3 text-left transition-colors hover:bg-slate-200/50 dark:hover:bg-slate-800`}
                          onClick={() => setExpandedAnalysis(isExpanded ? null : analysis.id)}
                        >
                           <div className="flex-1 min-w-0 pr-2">
                             <div className="text-sm font-semibold truncate">{analysis.title}</div>
                             <div className="text-[10px] text-slate-500 truncate">{analysis.variables.join(', ')}</div>
                           </div>
                           <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        
                        {isExpanded && (
                          <div className={`p-2 border-t grid grid-cols-2 gap-2 bg-slate-100/50 dark:bg-black/20 ${themeMode === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
                             {blocks.map((block, idx) => (
                               <div 
                                 key={idx}
                                 className={`p-2 rounded-lg border flex flex-col gap-1 items-center justify-center text-center cursor-grab active:cursor-grabbing hover:border-indigo-400 transition-all ${
                                   block.type === 'analysis_decision' || block.type === 'analysis_chart' ? 'col-span-2' : ''
                                 } ${themeMode === 'dark' ? 'bg-slate-800 border-slate-700 shadow-sm' : 'bg-white border-slate-200 shadow-sm'}`}
                                 draggable
                                 onDragStart={(e) => handleDragStart(e, block)}
                                 onClick={() => handleItemClick(block)}
                               >
                                 <GripVertical className="w-3 h-3 text-slate-400 opacity-50 mb-1" />
                                 <span className="text-xs font-bold leading-tight">{block.title}</span>
                                 <span className="text-[9px] uppercase tracking-wide text-slate-500">{
                                   block.type === 'analysis_chart' ? 'Graphique' : 
                                   block.type === 'analysis_decision' ? 'Bloc Décision' : 'Métrique'
                                 }</span>
                               </div>
                             ))}
                          </div>
                        )}
                     </div>
                   );
                 })}
               </div>
             )}
           </div>
        </div>
      </aside>

      {/* Main Grid Area */}
      <div className="flex-1 flex flex-col relative w-0">
         {/* Top toolbar */}
        <div className={`h-16 shrink-0 border-b flex items-center justify-between px-6 z-20 ${themeMode === 'dark' ? 'bg-slate-950/80 backdrop-blur border-slate-800' : 'bg-white/80 backdrop-blur border-slate-200'}`}>
          <div className="flex items-center gap-3">
             <h1 className="text-xl font-black tracking-tight">{dashboardTitle || "Tableau de Bord"}</h1>
             <div className="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 text-[10px] font-bold uppercase rounded tracking-wider">Mode Édition</div>
          </div>

          <div className="flex items-center gap-4">
            <button
               onClick={handleExportHtml}
               className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold transition ${
                 themeMode === 'dark' 
                   ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-white' 
                   : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-sm'
               }`}
               title="Exporter ce tableau de bord interactif sur votre PC au format HTML autonome"
            >
               <Download className="w-4 h-4 text-indigo-640 dark:text-indigo-400" />
               Exporter sur PC
            </button>
            <button
               onClick={() => {
                 setCurrentSlideIndex(pages.findIndex(p => p.id === currentPageId) || 0);
                 setPresentationMode(true);
               }}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${themeMode === 'dark' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'}`}
            >
               Présentation
            </button>
            <div className={`h-6 w-px ${themeMode === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
            <button 
               onClick={() => setThemeMode(mode => mode === 'light' ? 'dark' : 'light')}
               className={`p-2 rounded-lg transition ${themeMode === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-500'}`}
               title="Changer de thème"
            >
               <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pages Tabs */}
        <div className={`h-10 shrink-0 border-b flex items-center px-4 gap-1 z-10 overflow-x-auto ${themeMode === 'dark' ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
           {pages.map(p => (
             <div 
               key={p.id}
               onClick={() => setCurrentPage(p.id)}
               className={`group flex items-center h-full px-3 border-b-2 cursor-pointer transition-colors ${
                 currentPageId === p.id 
                   ? (themeMode === 'dark' ? 'border-indigo-500 text-indigo-400 bg-slate-800' : 'border-indigo-600 text-indigo-700 bg-white') 
                   : 'border-transparent text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
               }`}
             >
               {editingPageId === p.id ? (
                 <input 
                   autoFocus
                   defaultValue={p.title}
                   onBlur={(e) => {
                     renamePage(p.id, e.target.value || 'Page sans titre');
                     setEditingPageId(null);
                   }}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') e.currentTarget.blur();
                   }}
                   className={`w-32 outline-none bg-transparent text-sm font-semibold`}
                 />
               ) : (
                 <span 
                   className="text-sm font-semibold truncate max-w-[150px]"
                   onDoubleClick={(e) => { e.stopPropagation(); setEditingPageId(p.id); }}
                 >
                   {p.title}
                 </span>
               )}
               {pages.length > 1 && (
                 <button 
                   onClick={(e) => { e.stopPropagation(); removePage(p.id); }}
                   className={`ml-2 p-1 rounded hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/40 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity ${currentPageId === p.id ? 'opacity-100' : ''}`}
                 >
                   <X className="w-3 h-3" />
                 </button>
               )}
             </div>
           ))}
           <button 
             onClick={() => addPage(`Page ${pages.length + 1}`)}
             className={`ml-1 p-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold ${themeMode === 'dark' ? 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-200'}`}
           >
             <Plus className="w-4 h-4" />
           </button>
        </div>

        {/* Grid Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 relative"
          style={{
             backgroundColor: customTheme.bgColor,
             backgroundImage: `radial-gradient(${themeMode === 'dark' ? '#334155' : '#cbd5e1'} 1px, transparent 1px)`,
             backgroundSize: '20px 20px',
             backgroundPosition: '16px 16px'
          }}
        >
          
          {items.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none opacity-50">
               <div className="w-24 h-24 mb-4 border-4 border-dashed border-slate-300 dark:border-slate-700 rounded-full flex items-center justify-center">
                 <LayoutDashboard className="w-10 h-10 text-slate-400" />
               </div>
               <h2 className="text-2xl font-bold text-slate-500 mb-2">Glissez des éléments ici</h2>
               <p className="text-sm font-medium text-slate-400 max-w-sm">
                  Utilisez la palette sur la gauche pour insérer des blocs de texte, des graphiques ou des métriques statistiques individuelles dans votre rapport.
               </p>
            </div>
          )}

          <ResponsiveGridLayout
            className="layout h-full"
            layouts={{ lg: items.map(i => ({ i: i.id, ...i.layout })) }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={50}
            onLayoutChange={handleLayoutChange}
            isDroppable={true}
            onDrop={onDrop}
            droppingItem={{ i: '__dropping-elem__', w: draggedItemDims.w, h: draggedItemDims.h, x: 0, y: 0 }}
            draggableHandle=".drag-handle"
            isResizable={true}
            margin={[16, 16]}
            useCSSTransforms={true}
          >
            {items.map(item => (
              <div 
                key={item.id} 
                className="rounded-2xl shadow-sm border overflow-hidden flex flex-col group transition-colors duration-200"
                style={{
                  backgroundColor: customTheme.cardBgColor,
                  borderColor: customTheme.borderColor
                }}
              >
                
                {/* Widget Header - Show on hover */}
                <div className={`absolute top-0 left-0 right-0 h-8 flex items-center justify-between px-3 cursor-move drag-handle opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-md ${themeMode === 'dark' ? 'bg-slate-900/60 border-b border-slate-700' : 'bg-white/80 border-b border-slate-200'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider truncate mr-2 ${themeMode === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.title}
                  </span>
                  <div className="flex items-center gap-1">
                    {(item.type === 'text') && (
                      <button onClick={() => setEditingId(editingId === item.id ? null : item.id)} className="p-1 text-slate-500 hover:text-indigo-500 rounded bg-slate-200/50 dark:bg-slate-800/50">
                        {editingId === item.id ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button onClick={() => removeItem(item.id)} className="p-1 text-slate-500 hover:text-rose-500 rounded bg-slate-200/50 dark:bg-slate-800/50">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                {/* Widget Body */}
                <div className="flex-1 relative min-h-0 bg-transparent w-full h-full">
                  {renderItemContent(item)}
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      </div>
    </div>
  );
}
