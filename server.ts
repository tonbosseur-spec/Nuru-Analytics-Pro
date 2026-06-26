import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generateContentWithRetry(
  ai: any,
  modelsToTry: string[],
  contents: any,
  config?: any
): Promise<any> {
  let lastError: any = null;
  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Calling model "${modelName}" (attempt ${attempt}/3)`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errStr = String(err.message || err);
        console.warn(`Model "${modelName}" attempt ${attempt} failed: ${errStr}`);
        if (
          errStr.includes("503") ||
          errStr.includes("429") ||
          errStr.toLowerCase().includes("unavailable") ||
          errStr.toLowerCase().includes("demand")
        ) {
          // Wait a short time before retrying
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        } else {
          // If it's another error (e.g., config error), break immediately and try next model
          break;
        }
      }
    }
  }
  throw lastError || new Error("Indisponibilité temporaire des services d'IA.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API constraints check
  if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is not defined. Qualitative analysis will fail.");
  }

  // GEMINI endpoint
  app.post("/api/qualitative/analyze", async (req, res) => {
    try {
      const { geminiApiKey, project, questions, respondents } = req.body;
      
      const effectiveKey = geminiApiKey || process.env.GEMINI_API_KEY;

      if (!effectiveKey) {
        throw new Error("Clé API Gemini introuvable. Veuillez configurer la clé dans les paramètres.");
      }

      const ai = new GoogleGenAI({
        apiKey: effectiveKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      
      let prompt = `Tu es un expert en analyse thématique qualitative utilisant la méthode de Braun et Clarke (ou similaire).
      Je vais te fournir un corpus d'entretiens. Ta tâche est de réaliser une analyse rigoureuse et de générer un rapport JSON structuré.

      Projet : ${project.name}
      Description : ${project.description}
      Langue : ${project.language || 'Automatique'}

      Questions posées :
      ${questions.map((q: any, i: number) => `Q${i + 1}: ${q}`).join("\n")}

      Corpus de réponses (Répondants) :
      ${respondents.map((r: any) => `
      ---
      Identifiant: ${r.id}
      Variables: ${JSON.stringify(r.variables || {})}
      Réponses:
      ${r.responses.map((resp: any, i: number) => `Q${i + 1}: ${resp}`).join("\n")}
      `).join("\n")}

      Règles pour une analyse de haute qualité :
      - NE RIEN INVENTER.
      - Sois exhaustif et extrêmement détaillé dans tes résumés et analyses. Les textes générés doivent être riches, denses et très structurés.
      - Ajoute beaucoup de contexte dans les interprétations. Focus sur la méthode de Braun et Clarke (ou similaire).
      - Pour les citations, recopie le texte source exact et indique le "respondentId" ("Identifiant") de la personne qui a parlé.
      
      Tu dois renvoyer le résultat EXCLUSIVEMENT sous forme d'un objet JSON valide respectant la structure exacte ci-dessous (sans aucun texte autour) :

      {
        "overview": {
          "researchObjective": "L'objectif déduit de la recherche de façon très détaillée",
          "methodologyNote": "Note sur la méthodologie, composition du panel",
          "generalSummary": "Un résumé dense et riche de l'ensemble de l'étude (au moins 2 paragraphes)",
          "totalRespondents": ${respondents.length}
        },
        "questionAnalysis": [
          {
            "question": "Texte de la question",
            "summary": "Résumé détaillé et très profond des réponses",
            "keyPoints": ["Point 1 très détaillé", "Point 2 très détaillé"]
          }
        ],
        "themes": [
          {
            "name": "Nom du thème majeur",
            "description": "Description détaillée de ce thème",
            "importance": "Haute, Moyenne ou Faible",
            "subthemes": [
              { "name": "Nom du sous-thème avec explication" }
            ],
            "quotes": [
              { "quote": "citation littérale", "respondentId": "ID du répondant" }
            ]
          }
        ],
        "groupComparisons": [
          {
            "variable": "Nom de la variable discriminante retenue (Sexe, Age, etc.)",
            "findings": "Constat très riche sur l'impact de cette variable",
            "groupDifferences": ["Différence subtile 1", "Différence subtile 2"]
          }
        ],
        "conclusion": {
          "mainLessons": "Enseignements principaux avec une approche stratégique",
          "majorTrends": "Tendances majeures observées"
        },
        "recommendations": [
          "Recommandation très concrète 1",
          "Recommandation très concrète 2"
        ]
      }`;

      const modelsToTry = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
      const response = await generateContentWithRetry(ai, modelsToTry, prompt, {
        responseMimeType: "application/json"
      });
      
      const resultText = response.text;
      const parsed = JSON.parse(resultText!);
      res.json(parsed);

    } catch (error: any) {
      console.error("Qualitative Analysis Error:", error);
      res.status(500).json({ error: error.message || "Erreur interne" });
    }
  });

  // Mira AI Endpoint
  app.post("/api/mira/chat", async (req, res) => {
    try {
      const { 
        geminiApiKey,
        miraApiProvider = 'gemini',
        miraApiKey,
        miraApiModel,
        miraApiBaseUrl,
        context,
        chatHistory,
        message 
      } = req.body;
      
      let systemInstruction = `Tu es Mira, l'assistante IA de Nuru Lab dédiée à l'aide et à l'analyse statistique de pointe et haute précision.
      Tu es une experte de niveau international en biostatistiques, économétrie, science des données, méthodologie de recherche et rédaction scientifique.

      CAPACITÉS MULTI-ANALYSES ET INTERPRÉTATIONS TRANSVERSALES :
      1. Ton objectif suprême est d'analyser l'intégralité du projet de recherche. Tu ne dois pas te limiter à l'examen d'une seule analyse isolée.
      2. Tu dois croiser dynamiquement tous les résultats et conclusions de la liste "analysesRealisees" (fournie ci-dessous) pour en extraire des interprétations unifiées, complexes et transversales (ex: faire le pont entre un test de Student univarié, un test du Chi-deux et une régression logistique multiple pour expliquer un phénomène global).
      3. Tu es capable de guider, expliquer et simuler absolument TOUS les traitements et analyses statistiques disponibles dans le logiciel Nuru Lab, à savoir :
         - Univarié & Descriptif : Indicateurs de tendance centrale (moyenne, médiane, mode), dispersion (variance, écart-type, IC), tests de normalité (Shapiro-Wilk, Kolmogorov-Smirnov), dissymétrie, aplatissement, diagrammes boîtes, histogrammes.
         - Tests Statistiques Bivariés : Tests d'association (Chi-deux d'indépendance, Test Exact de Fisher), corrélations (Pearson, Spearman), tests paramétriques (Tests t de Student pour échantillons uniques, indépendants ou appariés; ANOVA à un ou deux facteurs) et équivalents non-paramétriques (Wilcoxon, Mann-Whitney, Kruskal-Wallis).
         - Modélisation & Régressions : Régression linéaire simple et multiple, régression logistique binaire et multinomiale (interprétation des coefficients, R², p-valeurs, Odds Ratios, IC, résidus, colinéarité/VIF).
         - Analyses Multivariées Exploratoires : ACP (Analyse en Composantes Principales), AFC (Analyse Factorielle des Correspondances), ACM (Analyse des Correspondances Multiples) pour cartographier les variables ou les individus, et CAH (Classification Ascendante Hiérarchique) pour segmenter/regrouper en clusters.
         - Préparation & Nettoyage de Données : Imputations de valeurs manquantes, traitements des aberrants (outliers par IQR ou Z-score, winsorisation), transformations de variables (log, racine carrée, standardisation), binarisation, discrétisation, regroupement de catégories et encodages (One-Hot, Label).

      UTILISATION DU CONTEXTE :
      Voici l'état complet du projet de recherche actuel de l'utilisateur (structures, variables, échantillons de données réels, et TOUS les tests et modélisations calculés jusqu'à présent) :
      ${JSON.stringify(context, null, 2)}

      Consigne d'exploitation :
      - Utilise les métadonnées de "dataset" (type de variable, pourcentage de valeurs manquantes) et l'aperçu "sampleData" (les 15 premières lignes réelles du jeu de données de l'utilisateur) pour proposer des analyses ciblées et hyper-adaptées, simuler des équations ou valider la distribution des valeurs.
      - Utilise l'historique de "analysesRealisees" pour dresser un bilan ou un rapport de recherche croisé : relie les causalités, valide les hypothèses de recherche de l'utilisateur et explique de manière limpide la portée scientifique de chaque statistique calculée.

      CONSIGNE DE VISUALISATION :
      Tu as la possibilité d'utiliser la bibliothèque de visualisation Plotly pour générer des graphiques résumés directement dans la fenêtre de discussion, mais CE N'EST PAS OBLIGATOIRE.
      Fais-le UNIQUEMENT si l'utilisateur te demande explicitement de générer un graphique, afin de garantir des réponses très rapides. Dans ce cas, inclus un bloc de code au format \`\`\`plotly ... \`\`\` contenant la configuration JSON valide requise par Plotly.

      Le format JSON à l'intérieur du bloc de code \`\`\`plotly doit être exactement :
      {
        "data": [
          {
            "x": ["Groupe A", "Groupe B"],
            "y": [12.5, 14.8],
            "type": "bar",
            "name": "Moyennes",
            "marker": { "color": "#6366f1" }
          }
        ],
        "layout": {
          "title": "Titre du Graphique",
          "xaxis": { "title": "Axe X" },
          "yaxis": { "title": "Axe Y" },
          "margin": { "t": 40, "b": 40, "l": 50, "r": 20 }
        }
      }

      Règles cruciales pour les graphiques :
      1. N'invente pas de données aléatoires si l'analyse correspondante est présente dans "analysesRealisees" dans le contexte. Utilise les vraies valeurs (coefficients, moyennes, valeurs de Chi-deux, effectifs, etc.) pour produire un graphique exact.
      2. Rends le graphique très attrayant avec des couleurs modernes et élégantes (Indigo \`#6366f1\`, Violet \`#8b5cf6\`, Émeraude \`#10b981\`, Orange \`#f97316\`, Rose \`#ec4899\`).
      3. Accompagne systématiquement le bloc de code d'une interprétation statistique claire et vulgarisée en français du graphique et de sa signification.

      FORMATAGE DU TEXTE ET MATHEMATIQUES :
      Tu dois formater tes réponses en Markdown. Utilise les puces, l'italique, le texte en gras et les blocs de citation de manière structurée.
      Pour les formules mathématiques et statistiques, utilise absolument la syntaxe LaTeX entre les symboles $ pour l'inline (ex: $\\alpha = 0.05$) et $$ pour les blocs centrés.

      Réponds toujours de manière claire, structurée (avec des puces, du gras, etc.) et en français.`;

      let responseText = "";

      if (miraApiProvider === 'gemini') {
        const effectiveKey = miraApiKey || geminiApiKey || process.env.GEMINI_API_KEY;
        if (!effectiveKey) {
          throw new Error("Clé API Gemini introuvable. Veuillez configurer la clé dans les paramètres de l'application.");
        }
        
        const ai = new GoogleGenAI({
          apiKey: effectiveKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });
        
        // Set up the chat history and query
        const contents = (chatHistory || []).map((msg: any) => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        }));
        contents.push({ role: 'user', parts: [{ text: message }] });

        const modelsToTry = [
          miraApiModel || "gemini-3.5-flash",
          "gemini-2.5-flash",
          "gemini-flash-latest",
          "gemini-3.1-flash-lite"
        ];
        
        const response = await generateContentWithRetry(ai, modelsToTry, contents, {
          systemInstruction
        });
        
        responseText = response.text || "";

      } else if (miraApiProvider === 'openai' || miraApiProvider === 'deepseek' || miraApiProvider === 'custom') {
        const key = miraApiKey || geminiApiKey;
        if (!key && miraApiProvider !== 'custom') {
          throw new Error(`La clé API pour ${miraApiProvider} est requise. Veuillez la renseigner dans les Paramètres.`);
        }

        let baseUrl = "https://api.openai.com/v1";
        if (miraApiProvider === 'deepseek') {
          baseUrl = "https://api.deepseek.com/v1";
        } else if (miraApiProvider === 'custom' && miraApiBaseUrl) {
          baseUrl = miraApiBaseUrl;
        }

        const model = miraApiModel || (miraApiProvider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
        
        const messages = [
          { role: "system", content: systemInstruction },
          ...(chatHistory || []).map((msg: any) => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.text
          })),
          { role: "user", content: message }
        ];

        const fetchUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json"
        };
        if (key) {
          headers["Authorization"] = `Bearer ${key}`;
        }

        const apiResponse = await fetch(fetchUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7
          })
        });

        if (!apiResponse.ok) {
          const errData = await apiResponse.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Erreur API ${miraApiProvider} (HTTP ${apiResponse.status})`);
        }

        const data: any = await apiResponse.json();
        responseText = data?.choices?.[0]?.message?.content || "";

      } else if (miraApiProvider === 'anthropic') {
        const key = miraApiKey || geminiApiKey;
        if (!key) {
          throw new Error("La clé API Anthropic (Claude) est requise. Veuillez la renseigner dans les Paramètres.");
        }

        const model = miraApiModel || 'claude-3-5-sonnet-latest';
        const messages = (chatHistory || []).map((msg: any) => ({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.text
        }));
        messages.push({ role: "user", content: message });

        const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            model,
            system: systemInstruction,
            messages,
            max_tokens: 4096,
            temperature: 0.7
          })
        });

        if (!apiResponse.ok) {
          const errData = await apiResponse.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Erreur API Anthropic (HTTP ${apiResponse.status})`);
        }

        const data: any = await apiResponse.json();
        responseText = data?.content?.[0]?.text || "";
      } else {
        throw new Error(`Fournisseur d'IA non supporté : ${miraApiProvider}`);
      }

      res.json({ text: responseText });

    } catch (error: any) {
      console.error("Mira Chat Error:", error);
      res.status(500).json({ error: error.message || "Erreur interne" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
