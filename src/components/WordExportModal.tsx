/*  WordExportModal.tsx  */
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, FileText, Download, CheckCircle2 } from 'lucide-react';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  ShadingType,
  ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { useWorkspaceStore } from '../store';
import { toast } from 'sonner';
import { getApi } from '../pywebview';
import Plotly from 'plotly.js-dist-min';
import Plot from 'react-plotly.js';

/* ------------------------------------------------------------------ */
/*  Helper: convert points → twips (1 pt = 20 twips)                  */
/* ------------------------------------------------------------------ */
const ptToTwips = (pt: number) => pt * 20;

/* ------------------------------------------------------------------ */
/*  Helper: build the XML for cell margins (top/left/bottom/right)    */
/* ------------------------------------------------------------------ */
interface CellMargins {
  top?: number;    // pt
  left?: number;   // pt
  bottom?: number; // pt
  right?: number;  // pt
}
function buildTcMar(m: CellMargins): any {
  const tcMar = { _tag: 'w:tcMar', _children: [] as any[] };
  const add = (name: string, value: number | undefined) => {
    if (value === undefined) return;
    tcMar._children.push({
      _tag: `w:${name}`,
      _attributes: {
        w: ptToTwips(value).toString(),
        type: 'dxa',
      },
    });
  };
  add('top', m.top);
  add('left', m.left);
  add('bottom', m.bottom);
  add('right', m.right);
  return tcMar;
}

/* ------------------------------------------------------------------ */
/*  Default margins (in points) – tweak if you need more/less space   */
/* ------------------------------------------------------------------ */
const defaultCellMargins: CellMargins = {
  top: 6,
  left: 8,
  bottom: 6,
  right: 8,
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
interface WordExportModalProps {
  onClose: () => void;
}

export default function WordExportModal({ onClose }: WordExportModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [institution, setInstitution] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [title, setTitle] = useState('Rapport d\'Analyse Statistique');

  const datasetName = useWorkspaceStore(s => s.datasetName);
  const pipeline = useWorkspaceStore(s => s.pipeline);
  const history = useWorkspaceStore(s => s.history);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customReportText, setCustomReportText] = useState('');
  const [isMiraGenerating, setIsMiraGenerating] = useState(false);

  const selectedHistory = history.filter(h => selectedIds.includes(h.id));

  const handleGenerateMiraReport = async () => {
    setIsMiraGenerating(true);
    try {
      const selectedAnalyses = history.filter(h => selectedIds.includes(h.id));
      const storeState = useWorkspaceStore.getState();
      
      const datasetInfo = datasetName ? `Le jeu de données analysé est "${datasetName}".` : "Le jeu de données analysé a été fourni.";
      const pipelineDesc = getPipelineDescription();
      
      const systemInstruction = `Agis en tant que "Mira", un assistant expert en Data Science.
Ton objectif est de rédiger l'intégralité d'un rapport d'analyse statistique professionnel.

Contexte :
- ${datasetInfo}
- Préparation et nettoyage des données effectués :
${pipelineDesc}

Consignes de formatage :
- Utilise la syntaxe Markdown standard (# pour Titre 1, ## pour Titre 2, ### pour Titre 3, **gras**, *italique*).
- Ne mets AUCUN bloc de code (pas de \`\`\`markdown ou autre).
- Sois clair, rigoureux et orienté prise de décision.`;

      const userMessage = `Voici les analyses statistiques qui ont été sélectionnées pour le rapport :
${selectedAnalyses.map(a => `
### Analyse : ${a.title}
- Métriques clés : ${JSON.stringify(a.metrics || {})}
- Interprétation initiale : ${a.interpretation || 'Aucune'}
`).join('\n')}

Instruction :
Rédige un rapport complet, professionnel et détaillé en français. Ce rapport doit comprendre :
1. Une **Introduction** (présentation du contexte et des objectifs).
2. Une partie **Préparation et Nettoyage des données** (basée sur le pipeline).
3. Le **Développement des analyses** (interprète véritablement les résultats et métriques dans leur contexte, ne te contente pas de lister, crée du lien logique).
4. Une **Conclusion & Synthèse Globale** (récapitulatif des enseignements majeurs).
Ne laisse aucun blanc, rédige le rapport complet de bout en bout en une seule fois.`;

      // 1. Try backend first
      let responseText = "";
      let serverOk = false;
      try {
        const API_KEY = storeState.geminiApiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;
        const res = await fetch('/api/mira/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geminiApiKey: API_KEY,
            miraApiProvider: storeState.miraApiProvider,
            claudeApiKey: (storeState as any).claudeApiKey,
            openAiApiKey: (storeState as any).openAiApiKey,
            deepSeekApiKey: (storeState as any).deepSeekApiKey,
            context: { systemInstruction },
            message: userMessage,
            chatHistory: []
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.text) {
             responseText = data.text;
             serverOk = true;
          } else if (data && data.response) {
             responseText = data.response;
             serverOk = true;
          }
        }
      } catch (err) {
        console.warn("Backend fail, falling back to direct browser call", err);
      }

      if (!serverOk) {
        // Fallback to direct client call
        const { callMiraDirect } = await import('../utils/miraApi');
        responseText = await callMiraDirect(storeState, systemInstruction, userMessage);
      }

      setCustomReportText(responseText);
      toast.success("Texte généré avec succès par Mira !");
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors de la génération avec Mira : " + e.message);
    } finally {
      setIsMiraGenerating(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Load / save user‑template (name, institution)                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    loadTemplate();
    // Preselect everything the first time the modal opens
    setSelectedIds(history.map(h => h.id));
  }, [history]);

  const saveTemplate = async () => {
    const tpl = { firstName, lastName, institution };
    localStorage.setItem('nuru_report_template', JSON.stringify(tpl));
    const api = getApi();
    if (api.set_store_item) {
       await api.set_store_item('nuru_report_template', tpl);
    }
    toast.success('Modèle d’auteur sauvegardé !');
  };

  const loadTemplate = async () => {
    let data = null;
    const api = getApi();
    if (api.get_store_item) {
      const res = await api.get_store_item('nuru_report_template');
      if (res.success && res.value) {
         data = res.value;
      }
    }
    if (!data) {
      const raw = localStorage.getItem('nuru_report_template');
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          // ignore
        }
      }
    }
    if (data) {
      if (data.firstName) setFirstName(data.firstName);
      if (data.lastName) setLastName(data.lastName);
      if (data.institution) setInstitution(data.institution);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Build a readable description of the preprocessing pipeline       */
  /* ------------------------------------------------------------------ */
  const getPipelineDescription = () => {
    if (!pipeline || pipeline.length === 0)
      return "Les données ont été inspectées et conservées dans leur format d'origine sans transformations majeures.";
    const steps = pipeline.map(step => {
      switch (step.type) {
        case 'imputation':
          return `Traitement des valeurs manquantes sur '${step.columnName}' via la stratégie '${step.strategy}'.`;
        case 'filter':
          return `Filtrage du jeu de données (${step.conditions.length} condition(s) appliquée(s)).`;
        case 'math_transform':
          return `Transformation mathématique sur '${step.columnName}' pour créer '${step.newColumnName}'.`;
        case 'remove_duplicates':
          return `Suppression des doublons (conservation: ${step.duplicateKeep}).`;
        case 'string_clean':
          return `Nettoyage textuel sur '${step.columnName}'.`;
        case 'binning':
          return `Discrétisation de la variable '${step.columnName}'.`;
        case 'grouping':
          return `Regroupement des modalités pour '${step.columnName}'.`;
        case 'encoding':
          return `Encodage de la variable '${step.columnName}'.`;
        default:
          return `Transformation spécifique appliquée.`;
      }
    });
    return `Afin de préparer ce jeu de données pour l'analyse, les étapes suivantes ont été appliquées de manière séquentielle :\n- ` + steps.join('\n- ');
  };

  /* ------------------------------------------------------------------ */
  /*  Flatten a nested metrics object into [{key, value}] arrays       */
  /* ------------------------------------------------------------------ */
  const flattenMetrics = (obj: any, prefix = ''): { key: string; value: string }[] => {
    const result: { key: string; value: string }[] = [];
    if (!obj || typeof obj !== 'object') return result;

    for (const [k, v] of Object.entries(obj)) {
      // Skip fields that are purely visual
      if (
        ['chart', 'roc_chart', 'actual_vs_predicted', 'qq_plot', 'isRegression'].includes(k)
      )
        continue;

      const friendlyKey = `${prefix}${k.replace(/_/g, ' ')}`;

      if (Array.isArray(v)) {
        const formatted = v.map(item => {
          if (typeof item === 'object' && item !== null) {
            return Object.entries(item)
              .map(([ik, iv]) => {
                let fv = iv;
                if (typeof iv === 'number')
                  fv = Number.isInteger(iv) ? iv : Number(iv).toFixed(useWorkspaceStore.getState().decimals);
                return `${ik}: ${fv}`;
              })
              .join(' | ');
          }
          let val = String(item);
          if (typeof item === 'number')
            val = Number.isInteger(item) ? String(item) : Number(item).toFixed(useWorkspaceStore.getState().decimals);
          return val;
        }).join('\n');
        result.push({ key: friendlyKey, value: formatted });
      } else if (v !== null && typeof v === 'object') {
        result.push(...flattenMetrics(v, friendlyKey + ' - '));
      } else {
        let val = String(v);
        if (typeof v === 'number')
          val = Number.isInteger(v) ? val : Number(v).toFixed(useWorkspaceStore.getState().decimals);
        result.push({ key: friendlyKey, value: val });
      }
    }
    return result;
  };

  /* ------------------------------------------------------------------ */
  /*  Main generation routine                                           */
  /* ------------------------------------------------------------------ */
  const parseMarkdownLineToDocx = (line: string) => {
    if (line.startsWith('### ')) {
      return new Paragraph({ text: line.replace(/^###\s*/, ''), heading: HeadingLevel.HEADING_3 });
    } else if (line.startsWith('## ')) {
      return new Paragraph({ text: line.replace(/^##\s*/, ''), heading: HeadingLevel.HEADING_2 });
    } else if (line.startsWith('# ')) {
      return new Paragraph({ text: line.replace(/^#\s*/, ''), heading: HeadingLevel.HEADING_1 });
    } else {
      const runs = [];
      const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          runs.push(new TextRun({ text: line.substring(lastIndex, match.index) }));
        }
        const m = match[0];
        if (m.startsWith('**')) {
          runs.push(new TextRun({ text: m.slice(2, -2), bold: true }));
        } else {
          runs.push(new TextRun({ text: m.slice(1, -1), italics: true }));
        }
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < line.length) {
        runs.push(new TextRun({ text: line.substring(lastIndex) }));
      }
      return new Paragraph({ children: runs });
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const authorName = `${firstName} ${lastName}`.trim();
      const reportTitle = title || 'Rapport d\'Analyse Statistique';
      const api = getApi();

      // If we are in the desktop/bridge context, we prefer the Python backend
      // because python-docx produces much better formatting and tables.
      if (api.export_report_docx && (window as any).pywebview && (window as any).pywebview.api) {
        const reportData: any = {
          title: reportTitle,
          author: authorName || 'Utilisateur Nuru',
          date: new Date().toLocaleDateString('fr-FR'),
          sections: []
        };

        if (customReportText.trim()) {
          const lines = customReportText.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith('### ')) {
              reportData.sections.push({ type: 'heading', level: 3, content: line.replace(/^###\s*/, '') });
            } else if (line.startsWith('## ')) {
              reportData.sections.push({ type: 'heading', level: 2, content: line.replace(/^##\s*/, '') });
            } else if (line.startsWith('# ')) {
              reportData.sections.push({ type: 'heading', level: 1, content: line.replace(/^#\s*/, '') });
            } else {
              reportData.sections.push({ type: 'text', content: line });
            }
          }
          
          reportData.sections.push({ type: 'heading', level: 1, content: 'Annexes Graphiques' });
          const selectedHistoryFromHistory = history.filter(h => selectedIds.includes(h.id));
          for (const analysis of selectedHistoryFromHistory) {
            const chartsToExport = [
              { chart: analysis.chart, name: 'Graphique d\'Analyse - ' + analysis.title },
              { chart: analysis.metrics?.chart, name: 'Visualisation Principale - ' + analysis.title },
              { chart: analysis.metrics?.roc_chart, name: 'Courbe ROC - ' + analysis.title },
              { chart: analysis.metrics?.actual_vs_predicted, name: 'Validité du Modèle - ' + analysis.title },
              { chart: analysis.metrics?.qq_plot, name: 'Graphe Q-Q - ' + analysis.title }
            ].filter(c => c.chart);

            for (const cItem of chartsToExport) {
              try {
                const dataUrl = await Plotly.toImage(
                  {
                    data: cItem.chart.data,
                    layout: { 
                      ...cItem.chart.layout, 
                      width: 800, 
                      height: 500, 
                      paper_bgcolor: '#ffffff',
                      plot_bgcolor: '#ffffff' 
                    },
                  },
                  { format: 'png', width: 800, height: 500 }
                );
                reportData.sections.push({
                  type: 'image',
                  base64: dataUrl,
                  caption: cItem.name
                });
              } catch (err) {
                console.error('Error exporting chart:', err);
              }
            }
          }
        } else {
          // 1. Introduction
          reportData.sections.push({ type: 'heading', level: 1, content: 'Introduction' });
          reportData.sections.push({ 
            type: 'text', 
            content: `Ce document compile l'ensemble des résultats concernant les données issues de la source ${datasetName ? '"' + datasetName + '"' : 'fournie'}. L'objectif est de dégager des informations pertinentes à partir d'une analyse rigoureuse.` 
          });

          // 2. Prep
          reportData.sections.push({ type: 'heading', level: 1, content: 'Préparation et Nettoyage des Données' });
          const pipelineDesc = getPipelineDescription();
          reportData.sections.push({ type: 'text', content: pipelineDesc });

          // 3. Selected Analyses
          reportData.sections.push({ type: 'heading', level: 1, content: 'Analyses Réalisées' });

          const selectedHistoryFromHistory = history.filter(h => selectedIds.includes(h.id));
          if (selectedHistoryFromHistory.length === 0) {
            reportData.sections.push({ type: 'text', content: 'Aucune analyse sélectionnée.' });
          } else {
            for (const analysis of selectedHistoryFromHistory) {
              reportData.sections.push({ type: 'heading', level: 2, content: analysis.title });
              
              // Interpretation
              if (analysis.interpretation) {
                reportData.sections.push({ type: 'heading', level: 3, content: 'Interprétation' });
                reportData.sections.push({ type: 'text', content: analysis.interpretation });
              }

              // Metrics / Structural Sentences (no tables)
              if (analysis.metrics) {
                const m = analysis.metrics;
                const res = m.test_result;

                if (res && res.h0 && res.h1) {
                    // It's a structured stat test with hypotheses
                    const pValStr = res.p_value < 0.0001 ? "inférieure à 0.0001" : `de ${Number(res.p_value).toFixed(useWorkspaceStore.getState().decimals)}`;
                    
                    reportData.sections.push({ type: 'heading', level: 3, content: 'Bilan Analytique' });
                    reportData.sections.push({
                        type: 'text',
                        content: `Pour cette analyse, l'hypothèse nulle (H0) formulée était la suivante : "${res.h0}". À l'inverse, l'hypothèse alternative (H1) postulait que : "${res.h1}".`
                    });
                    
                    const dec = res.decision ? res.decision : (Number(res.p_value) < (m.test_params?.alpha || 0.05) ? "Rejet de l'hypothèse nulle (H0)" : "Non-rejet de l'hypothèse nulle (H0)");
                    
                    reportData.sections.push({
                        type: 'text',
                        content: `Les résultats obtenus présentent une statistique d'évaluation de ${Number(res.statistic || 0).toFixed(useWorkspaceStore.getState().decimals)} avec une p-value ${pValStr}. Au seuil de risque envisagé, cela signifie que la décision statistique finale conduit au ${dec}.`
                    });
                } else if (m.isRegression) {
                    // Regression explicit text
                    const r2 = m.diagnostics?.r2;
                    const f_pvalue = m.diagnostics?.f_pvalue;
                    const r2Str = r2 !== undefined ? (Number(r2) * 100).toFixed(1) + '%' : "N/A";
                    
                    reportData.sections.push({ type: 'heading', level: 3, content: 'Récapitulatif du Modèle' });
                    reportData.sections.push({ type: 'text', content: `Le modèle de régression mis en place permet d'expliquer ${r2Str} de la variabilité totale observée dans les données. `+
                    (f_pvalue !== undefined && f_pvalue < 0.05 ? "En examinant la globalité du modèle, ce dernier s'avère statistiquement très probant pour modéliser cette distribution." : "Sa validité prédictive globale reste cependant en deçà du seuil de confiance absolu usuel.") });
                    
                    if (m.coefficients) {
                        reportData.sections.push({ type: 'text', content: `Par ailleurs, l'examen isolé des paramètres indique que certaines variables pèsent bien plus lourdement sur la conclusion et modulent la prédiction. Veuillez vous référer aux graphiques d'analyse pour observer cette dynamique plus en détail.` });
                    }
                } else {
                    // Fallback: flat text list for pure structural metrics
                    const flat = flattenMetrics(analysis.metrics);
                    if (flat.length > 0) {
                        reportData.sections.push({ type: 'heading', level: 3, content: 'Résultats Chiffrés' });
                        const combined = flat.map(f => `• Concernant l'indicateur '${f.key}', le résultat mesuré est : ${f.value}.`).join("\n");
                        reportData.sections.push({
                           type: 'text',
                           content: combined
                        });
                    }
                }
              }

              // Charts
              const chartsToExport = [
                { chart: analysis.chart, name: 'Graphique d\'Analyse' },
                { chart: analysis.metrics?.chart, name: 'Visualisation Principale' },
                { chart: analysis.metrics?.roc_chart, name: 'Courbe ROC' },
                { chart: analysis.metrics?.actual_vs_predicted, name: 'Validité du Modèle' },
                { chart: analysis.metrics?.qq_plot, name: 'Graphe Q-Q' }
              ].filter(c => c.chart);

              for (const cItem of chartsToExport) {
                try {
                  const dataUrl = await Plotly.toImage(
                    {
                      data: cItem.chart.data,
                      layout: { 
                        ...cItem.chart.layout, 
                        width: 800, 
                        height: 500, 
                        paper_bgcolor: '#ffffff',
                        plot_bgcolor: '#ffffff' 
                      },
                    },
                    { format: 'png', width: 800, height: 500 }
                  );
                  reportData.sections.push({
                    type: 'image',
                    base64: dataUrl,
                    caption: cItem.name
                  });
                } catch (err) {
                  console.error('Error exporting chart:', err);
                }
              }
            }
          }

          // 4. Global Conclusion
          reportData.sections.push({ type: 'heading', level: 1, content: 'Conclusion & Synthèse Globale' });
          reportData.sections.push({ 
            type: 'text', 
            content: "En s'appuyant sur les méthodes descriptives et inférentielles, cette analyse révèle plusieurs informations structurelles concernant l'échantillon." 
          });
        }

        const result = await api.export_report_docx(reportData);
        if (result.success) {
          toast.success(result.message || 'Rapport généré avec succès !');
          onClose();
          return;
        } else {
          toast.error(`Erreur backend : ${result.error || 'Inconnu'}`);
        }
      }

      // Legacy fallback (JS only)
      const sections = [];

      /* --------------------- Title page --------------------- */
      sections.push({
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { before: 2400, after: 1200 },
          }),
          new Paragraph({
            text: `Auteur(s) : ${authorName || 'Non spécifié'}`,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: `Institution : ${institution || 'Non spécifiée'}`,
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            text: `Année : ${year}`,
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 2000 },
          }),
          new Paragraph({
            text:
              "Ce rapport généré automatiquement présente les résultats de l'analyse.",
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
          }),
        ],
      });

      /* --------------------- Main content --------------------- */
      const mainContent: any[] = [];

      const addPlotlyToDoc = async (chart: any, titleStr: string) => {
        if (!chart) return;
        try {
          const dataUrl = await Plotly.toImage(
            {
              data: chart.data,
              layout: {
                ...chart.layout,
                width: 600,
                height: 400,
                paper_bgcolor: '#ffffff',
                plot_bgcolor: '#ffffff',
              },
            },
            { format: 'png', width: 600, height: 400 }
          );

          // Strip the "data:image/png;base64," prefix
          const base64 = dataUrl.split(',')[1];
          const binary = atob(base64);
          const imgArray = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) imgArray[i] = binary.charCodeAt(i);

          mainContent.push(
            new Paragraph({
              text: titleStr,
              heading: HeadingLevel.HEADING_3,
            })
          );
          mainContent.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgArray,
                  transformation: { width: 500, height: 333 },
                  type: 'png',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
            })
          );
        } catch (e) {
          console.error('Failed to export plot:', e);
        }
      };

      if (customReportText.trim()) {
        const lines = customReportText.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          mainContent.push(parseMarkdownLineToDocx(line));
        }

        mainContent.push(
          new Paragraph({
            text: 'Annexes Graphiques',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );
        const selectedHistoryFromHistory = history.filter(h => selectedIds.includes(h.id));
        for (const analysis of selectedHistoryFromHistory) {
          if (analysis.chart) await addPlotlyToDoc(analysis.chart, 'Visualisation - ' + analysis.title);
          if (analysis.metrics?.chart)
            await addPlotlyToDoc(analysis.metrics.chart, 'Graphique Principal - ' + analysis.title);
          if (analysis.metrics?.roc_chart)
            await addPlotlyToDoc(analysis.metrics.roc_chart, 'Courbe ROC - ' + analysis.title);
          if (analysis.metrics?.actual_vs_predicted)
            await addPlotlyToDoc(
              analysis.metrics.actual_vs_predicted,
              'Valeurs Actuelles vs Prédictions - ' + analysis.title
            );
          if (analysis.metrics?.qq_plot)
            await addPlotlyToDoc(analysis.metrics.qq_plot, 'Graphe Q-Q - ' + analysis.title);
        }
      } else {
        // Introduction
        mainContent.push(
          new Paragraph({
            text: 'Introduction',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );
        mainContent.push(
          new Paragraph({
            text: `Ce document compile l'ensemble des résultats concernant les données issues de la source ${datasetName ? '"' + datasetName + '"' : 'fournie'}. L'objectif est de dégager des informations pertinentes à partir d'une analyse rigoureuse.`,
            spacing: { before: 200, after: 400 },
          })
        );

        // Methodology
        mainContent.push(
          new Paragraph({
            text: 'Préparation et Nettoyage des Données',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );
        getPipelineDescription().split('\n').forEach(line => {
          mainContent.push(
            new Paragraph({ text: line, spacing: { before: 100, after: 100 } })
          );
        });
        mainContent.push(
          new Paragraph({ text: '', spacing: { before: 200, after: 400 } })
        );

        // Analyses sélectionnées
        mainContent.push(
          new Paragraph({
            text: 'Analyses Réalisées',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        const selectedHistoryFromHistory = history.filter(h => selectedIds.includes(h.id));
        if (selectedHistoryFromHistory.length === 0) {
          mainContent.push(
            new Paragraph({
              children: [new TextRun({ text: 'Aucune analyse sélectionnée.', italics: true })],
              spacing: { before: 200, after: 400 },
            })
          );
        } else {
          for (const analysis of selectedHistoryFromHistory) {
            // Title of the analysis
            mainContent.push(
              new Paragraph({ text: analysis.title, heading: HeadingLevel.HEADING_2 })
            );

            // ---- Intro ----
            mainContent.push(
              new Paragraph({ text: 'Introduction', heading: HeadingLevel.HEADING_3 })
            );
            let introText =
              'Cette section détaille les statistiques calculées.';
            if (analysis.type === 'univariate') {
              introText = `L'objectif est d'explorer la distribution et les caractéristiques de la variable ${analysis.variables[0]}.`;
            } else if (analysis.type === 'bivariate') {
              if (analysis.metrics?.test_result) {
                introText = `L'objectif est de vérifier l'existence d'une relation statistiquement significative ou d'une différence entre les variables ${analysis.variables.join(' et ')}.`;
              } else if (analysis.metrics?.isRegression) {
                introText = `L'objectif est de modéliser l'impact ou prédire la variable cible en fonction de ses prédicteurs.`;
              } else {
                introText = `L'objectif est d'explorer la co‑distribution et de relier la relation entre ${analysis.variables.join(' et ')}.`;
              }
            }
            mainContent.push(new Paragraph({ text: introText }));

            // ---- Hypothèses (if test) ----
            if (analysis.metrics?.test_result) {
              mainContent.push(
                new Paragraph({ text: 'Hypothèses de test', heading: HeadingLevel.HEADING_3 })
              );
              mainContent.push(
                new Paragraph({
                  text: "H0 (Hypothèse nulle) : Il n'y a pas d'effet ou de relation significative.",
                })
              );
              mainContent.push(
                new Paragraph({
                  text: "H1 (Hypothèse alternative) : Il existe un effet ou une relation au seuil de signification α = 0.05.",
                })
              );
            }

            // ---- Résultats & tableau ----
            mainContent.push(
              new Paragraph({
                text: 'Analyses & Résultats',
                heading: HeadingLevel.HEADING_3,
              })
            );

            if (analysis.metrics?.test_result) {
              const pVal = analysis.metrics.test_result.p_value;
              const stat = analysis.metrics.test_result.statistic;
              if (pVal !== undefined && stat !== undefined) {
                const isSig = Number(pVal) < 0.05;
                mainContent.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Le test révèle ' }),
                      new TextRun({
                        text: isSig ? 'un effet ' : "l'absence d'effet ",
                      }),
                      new TextRun({
                        text: "statistiquement significatif ",
                        bold: isSig,
                      }),
                      new TextRun({ text: "(statistique du test = " }),
                      new TextRun({ text: Number(stat).toFixed(useWorkspaceStore.getState().decimals), bold: true }),
                      new TextRun({ text: ", " }),
                      new TextRun({ text: "p", italics: true }),
                      new TextRun({ text: " = " + (Number(pVal) < 0.001 ? '< .001' : Number(pVal).toFixed(useWorkspaceStore.getState().decimals)) }),
                      new TextRun({ text: " )." }),
                    ],
                  })
                );
              }
            } else if (
              analysis.metrics?.isRegression &&
              analysis.metrics.diagnostics?.r2 !== undefined
            ) {
              const r2 = analysis.metrics.diagnostics.r2;
              const pModel = analysis.metrics.diagnostics.f_pvalue;
              const isSig = pModel === undefined || Number(pModel) < 0.05;

              mainContent.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: "Le modèle global est " }),
                    new TextRun({
                      text: isSig ? "statistiquement significatif " : "non significatif ",
                    }),
                    pModel !== undefined
                      ? new TextRun({
                          text: `(p = ${Number(pModel).toExponential(3)}). `,
                        })
                      : new TextRun({ text: "" }),
                    new TextRun({
                      text: `Il explique ${Number(r2 * 100).toFixed(useWorkspaceStore.getState().decimals)}% de la variance observée (R² = ${Number(r2).toFixed(useWorkspaceStore.getState().decimals)}). `,
                    }),
                  ],
                })
              );
            }

            // ---- Metrics sentences (no tables) ----
            if (analysis.metrics) {
              const m = analysis.metrics;
              const res = m.test_result;

              if (res && res.h0 && res.h1) {
                const pValStr = res.p_value < 0.0001 ? "inférieure à 0.0001" : `de ${Number(res.p_value).toFixed(useWorkspaceStore.getState().decimals)}`;
                const dec = res.decision ? res.decision : (Number(res.p_value) < (m.test_params?.alpha || 0.05) ? "Rejet de l'hypothèse nulle (H0)" : "Non-rejet de l'hypothèse nulle (H0)");

                mainContent.push(new Paragraph({ text: 'Bilan Analytique', heading: HeadingLevel.HEADING_3 }));
                mainContent.push(new Paragraph({ text: `Pour cette analyse, l'hypothèse nulle (H0) formulée était la suivante : "${res.h0}". À l'inverse, l'hypothèse alternative (H1) postulait que : "${res.h1}".` }));
                mainContent.push(new Paragraph({ text: `Les résultats obtenus présentent une statistique d'évaluation de ${Number(res.statistic || 0).toFixed(useWorkspaceStore.getState().decimals)} avec une p-value ${pValStr}. Au seuil de risque envisagé, cela signifie que la décision statistique finale conduit au ${dec}.` }));
              } else if (m.isRegression) {
                const r2 = m.diagnostics?.r2;
                const f_pvalue = m.diagnostics?.f_pvalue;
                const r2Str = r2 !== undefined ? (Number(r2) * 100).toFixed(1) + '%' : "N/A";

                mainContent.push(new Paragraph({ text: 'Récapitulatif du Modèle', heading: HeadingLevel.HEADING_3 }));
                mainContent.push(new Paragraph({ text: `Le modèle de régression mis en place permet d'expliquer ${r2Str} de la variabilité totale observée dans les données. ` + (f_pvalue !== undefined && f_pvalue < 0.05 ? "En examinant la globalité du modèle, ce dernier s'avère statistiquement très probant pour modéliser cette distribution." : "Sa validité prédictive globale reste cependant en deçà du seuil de confiance absolu usuel.") }));
                
                if (m.coefficients) {
                    mainContent.push(new Paragraph({ text: `Par ailleurs, l'examen isolé des paramètres indique que certaines variables pèsent bien plus lourdement sur la conclusion et modulent la prédiction. Veuillez vous référer aux graphiques d'analyse pour observer cette dynamique plus en détail.` }));
                }
              } else {
                const flat = flattenMetrics(analysis.metrics);
                if (flat.length > 0) {
                  mainContent.push(new Paragraph({ text: 'Résultats Chiffrés', heading: HeadingLevel.HEADING_3 }));
                  const combined = flat.map(f => `• Concernant l'indicateur '${f.key}', le résultat mesuré est : ${f.value}.`).join("\n");
                  combined.split('\n').forEach(line => {
                    mainContent.push(new Paragraph({ text: line }));
                  });
                }
              }
            }

            // ---- Interprétation ----
            mainContent.push(
              new Paragraph({
                text: 'Interprétation & Conclusions',
                heading: HeadingLevel.HEADING_3,
              })
            );
            if (analysis.interpretation) {
              mainContent.push(parseMarkdownLineToDocx(analysis.interpretation));
            } else {
              mainContent.push(
                new Paragraph({ text: "Aucune conclusion explicite formulée." })
              );
            }

            // ---- Graphs (Plotly → image) ----
            if (analysis.chart) await addPlotlyToDoc(analysis.chart, 'Visualisation');
            if (analysis.metrics?.chart)
              await addPlotlyToDoc(analysis.metrics.chart, 'Graphique Principal');
            if (analysis.metrics?.roc_chart)
              await addPlotlyToDoc(analysis.metrics.roc_chart, 'Courbe ROC');
            if (analysis.metrics?.actual_vs_predicted)
              await addPlotlyToDoc(
                analysis.metrics.actual_vs_predicted,
                'Valeurs Actuelles vs Prédictions'
              );
            if (analysis.metrics?.qq_plot)
              await addPlotlyToDoc(analysis.metrics.qq_plot, 'Graphe Q-Q');
          }
        }

        // ---- Conclusion ----
        mainContent.push(
          new Paragraph({
            text: 'Conclusion & Synthèse Globale',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 600, after: 200 },
          })
        );
        mainContent.push(
          new Paragraph({
            text:
              "En s'appuyant sur les méthodes descriptives et inférentielles, cette analyse révèle plusieurs informations structurelles concernant l'échantillon. [Veuillez ajouter ici la synthèse humaine de ces conclusions automatiques]",
            spacing: { before: 200, after: 400 },
          })
        );
      }

      sections.push({ properties: {}, children: mainContent });

      /* --------------------- Build the DOCX --------------------- */
      const doc = new Document({
        creator: 'Nuru Analytics',
        title: title,
        description: 'Rapport d\'analyse Nuru',
        styles: {
          default: {
            document: {
              run: { font: 'Arial', size: 22, color: '595959' },
              paragraph: {
                alignment: AlignmentType.JUSTIFIED,
                spacing: { before: 80, after: 80 },
              },
            },
          },
          paragraphStyles: [
            {
              id: 'Heading1',
              name: 'Heading 1',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { size: 34, bold: true, font: 'Arial', color: '1F4E79' },
              paragraph: { spacing: { before: 360, after: 180 } },
            },
            {
              id: 'Heading2',
              name: 'Heading 2',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { size: 28, bold: true, font: 'Arial', color: '2E75B6' },
              paragraph: { spacing: { before: 280, after: 140 } },
            },
            {
              id: 'Heading3',
              name: 'Heading 3',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { size: 24, bold: true, font: 'Arial', color: '4472C4' },
              paragraph: { spacing: { before: 200, after: 100 } },
            },
          ],
        },
        sections: sections,
      });

      /* --------------------- Save / Download --------------------- */
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}.docx`;

      // 1️⃣ Try the native/mock API first
      // In Desktop context, this uses the Python bridge.
      // In Web context, it uses our mock which now triggers a browser download.
      if (api.save_base64_file && (window as any).pywebview && (window as any).pywebview.api) {
        try {
          const base64 = await Packer.toBase64String(doc);
          const result = await api.save_base64_file(base64, fileName);
          if (result.success) {
            toast.success(result.message || 'Rapport Word généré avec succès !');
            onClose();
            return;
          }
        } catch (err: any) {
          console.error('API save_base64_file failed:', err);
        }
      }

      // 2️⃣ Fallback to the File System Access API (Chrome/Edge on Windows)
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'Word Document',
                accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
              },
            ],
          });
          const writable = await handle.createWritable();
          const blob = await Packer.toBlob(doc);
          await writable.write(blob);
          await writable.close();
          toast.success('Rapport Word enregistré avec succès !');
          onClose();
          return;
        } catch (err: any) {
          console.warn('File System Access API failed:', err);
          if (err.name === 'AbortError') return;
        }
      }

      // 3️⃣ Last resort – classic saveAs (forces download folder)
      try {
        const blob = await Packer.toBlob(doc);
        saveAs(blob, fileName);
        toast.success('Rapport Word généré avec succès !');
        onClose();
      } catch (e: any) {
        toast.error(`Erreur lors du téléchargement : ${e.message}`);
      }
    } catch (e: any) {
      toast.error(`Erreur lors de la génération du rapport : ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl relative overflow-hidden flex flex-col md:flex-row"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 transition text-slate-400 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* --------------------- Configuration Panel --------------------- */}
        <div className="w-full md:w-[450px] flex flex-col border-r border-slate-800 bg-slate-900">
          <div className="p-6 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Exporter au format Word
                </h2>
                <p className="text-sm text-slate-400">
                  Générer un rapport pré‑rempli.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Auteur & Informations
                </h3>
                <button
                  onClick={saveTemplate}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors"
                  title="Sauvegarder ces champs par défaut"
                >
                  Sauvegarder par défaut
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white"
                    placeholder="Dupont"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Institution / Entreprise
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={e => setInstitution(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white"
                  placeholder="Université de Paris"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Année de Rédaction
                </label>
                <input
                  type="text"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white"
                  placeholder="2026"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Titre de l'Analyse
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-white"
                  placeholder="Rapport Périodique"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  Sélections à Intégrer
                  <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                    {history.length}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(
                      selectedIds.length === history.length ? [] : history.map(h => h.id)
                    )
                  }
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {selectedIds.length === history.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>

              {history.length === 0 ? (
                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 text-center text-slate-500 text-sm">
                  Aucun résultat dans l'historique pour le moment.
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {history.map(item => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={e => {
                          if (e.target.checked)
                            setSelectedIds([...selectedIds, item.id]);
                          else
                            setSelectedIds(selectedIds.filter(id => id !== item.id));
                        }}
                        className="w-4 h-4 mt-0.5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/20"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-200 block">
                          {item.title}
                        </span>
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {item.interpretation || 'Aucune interprétation...'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Texte du Rapport (Optionnel)
                </h3>
                <button
                  type="button"
                  onClick={handleGenerateMiraReport}
                  disabled={isMiraGenerating || selectedIds.length === 0}
                  className="text-xs text-white font-medium bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 px-3 py-1.5 rounded-lg transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isMiraGenerating ? (
                    <span className="animate-spin w-3 h-3 border-2 border-white/20 border-t-white rounded-full"></span>
                  ) : (
                    <span>✨</span>
                  )}
                  {isMiraGenerating ? 'Génération...' : 'Générer avec Mira'}
                </button>
              </div>
              <textarea
                value={customReportText}
                onChange={e => setCustomReportText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white min-h-[120px] custom-scrollbar"
                placeholder="Laissez vide pour utiliser la structure automatique, ou rédigez explicitement le contenu de votre rapport."
              />
              <p className="text-xs text-slate-500">
                Si ce champ est rempli, la structure automatique sera remplacée par ce texte (les graphiques seront ajoutés en annexe). Le formatage Markdown (**gras**, *italique*) est supporté.
              </p>
            </div>
          </div>

          <div className="p-6 border-t border-slate-800 bg-slate-900/50 shrink-0 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 bg-slate-800 border border-slate-750 hover:bg-slate-700 text-slate-350 font-bold py-3 rounded-xl transition duration-200 cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !title.trim() || selectedIds.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition duration-200 disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></span>
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isGenerating ? 'Exportation en cours…' : 'Télécharger le .docx'}
            </button>
          </div>
        </div>

        {/* --------------------- Live Preview Panel --------------------- */}
        <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              Aperçu en Direct du Document
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center custom-scrollbar bg-[#0f172a]">
            {/* Mock A4 Paper – explicit min-height prevents collapse */}
            <div className="bg-white w-full max-w-[210mm] min-h-[297mm] rounded shadow-2xl p-10 md:p-14 text-black font-serif text-sm leading-relaxed mb-10 flex flex-col justify-center items-center text-center relative" style={{ boxShadow: '0 0 40px rgba(0,0,0,0.6)' }}>
              
              <div className="absolute top-10 left-10 text-xs text-gray-400 font-sans tracking-widest uppercase">
                Aperçu - Page de garde uniquement
              </div>

              <div className="w-full h-full flex flex-col justify-center items-center py-20">
                <h1 className="text-4xl font-bold mb-20 text-gray-900 px-10">
                  {title || 'Rapport d\'Analyse Statistique'}
                </h1>
                
                <div className="space-y-4 mb-20 text-gray-800">
                  <p className="text-xl">
                    <span className="font-semibold">Auteur(s) :</span> {`${firstName} ${lastName}`.trim() || 'Non spécifié'}
                  </p>
                  <p className="text-xl">
                    <span className="font-semibold">Institution :</span> {institution || 'Non spécifiée'}
                  </p>
                  <p className="text-xl">
                    <span className="font-semibold">Année :</span> {year}
                  </p>
                </div>
                
                <p className="text-gray-500 italic max-w-md mx-auto mt-20">
                  Ce rapport généré automatiquement présente les résultats de l'analyse, complétés le cas échéant par la synthèse de Mira.
                </p>
              </div>
            </div>
            
            <p className="text-slate-500 text-sm italic mb-10">Les pages suivantes incluront le développement textuel (avec formattage Markdown) et les annexes graphiques.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
