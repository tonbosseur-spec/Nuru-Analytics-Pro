import React, { useState } from 'react';
import { useWorkspaceStore } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileSpreadsheet, 
  FlaskConical, 
  UploadCloud, 
  FilePlus, 
  ChevronRight, 
  ChevronDown,
  FolderOpen,
  CheckCircle2, 
  ShieldCheck, 
  Cpu, 
  ArrowLeft, 
  RotateCcw, 
  HelpCircle, 
  Beaker, 
  Sparkles,
  BarChart2,
  TrendingUp,
  Activity,
  Target,
  Trash2,
  History,
  Calendar,
  Database,
  Layers,
  ChevronLeft,
  Bot,
  MessageSquare,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import InteractiveLab from './InteractiveLab';
import BatchProcessingMode from './BatchProcessingMode';

import QualitativeAnalysisModule from './QualitativeAnalysisModule';

interface DecisionStep {
  title: string;
  question: string;
  description?: string;
  choices: {
    label: string;
    desc?: string;
    nextStepId?: string;
    recommendation?: {
      badge: string;
      name: string;
      desc: string;
      analysisType: 'stat_tests' | 'stat_tests_param' | 'stat_tests_nonparam' | 'regs' | 'multivar' | 'desc_stats' | 'results';
      testId?: string;
    };
  }[];
}

const DECISION_TREE: Record<string, DecisionStep> = {
  start: {
    title: "🎯 Objectif analytique (Diagnostic)",
    question: "Quelle est l'intention principale de votre analyse de données ?",
    description: "Choisissez le domaine qui correspond au problème que vous essayez de résoudre.",
    choices: [
      {
        label: "Comparer des échantillons, moyennes ou effets",
        desc: "Ex: Vérifier l'efficacité d'un médicament (groupe contrôle vs test), ou une mesure avant/après.",
        nextStepId: "compare"
      },
      {
        label: "Évaluer une corrélation, une association ou une conformité",
        desc: "Ex: Lien entre le temps de révision et la note (quanti), ou entre le sexe et le choix (quali).",
        nextStepId: "relation"
      },
      {
        label: "Prédire ou modéliser une variable cible (Causalité)",
        desc: "Ex: Estimer un chiffre d'affaires, ou probabiliser un risque (Régression).",
        nextStepId: "predict"
      },
      {
        label: "Explorer, réduire ou profiler de vastes données (Multivarié)",
        desc: "Ex: Création de typologies clients, réduction d'axes, analyse factorielle.",
        nextStepId: "exploratory"
      },
      {
        label: "Décrire, résumer et dresser des tableaux croisés",
        desc: "Pour générer des fiches de synthèse univariées, bivariées et des histogrammes.",
        recommendation: {
          badge: "Fiche Descriptive",
          name: "Statistiques Descriptives & Visualisation",
          desc: "Cette section produit les rapports de synthèse complets et le tableau de contingence de vos variables.",
          analysisType: "desc_stats"
        }
      },
      {
        label: "Interpréter vos résultats ou poser des questions statistiques à l'IA",
        desc: "Discutez avec l'assistant IA Mira pour décoder vos ANOVA, Chi-Deux, Régressions, et profitez de rédactions scientifiques.",
        nextStepId: "mira_ia_helper"
      }
    ]
  },

  mira_ia_helper: {
    title: "🤖 Assistant d'Interprétation IA (Mira)",
    question: "Comment souhaitez-vous utiliser Mira pour vos recherches ?",
    description: "Nuru Lab intègre Mira, un module d'intelligence artificielle de pointe expert en statistiques et d'aide à la décision.",
    choices: [
      {
        label: "Interpréter une analyse statistique existante",
        desc: "Exécutez d'abord et enregistrez l'analyse statistique dans Nuru Lab. Dans la barre latérale de Mira, cliquez sur celle-ci pour demander une interprétation automatisée instantanée.",
        nextStepId: "mira_ia_features"
      },
      {
        label: "Poser de libres questions méthodologiques ou statistiques",
        desc: "Posez-lui n'importe quelle question sur l'échantillonnage, la taille d'effet, le choix d'un test ou la formulation d'hypothèses scientifiques.",
        nextStepId: "mira_ia_features"
      }
    ]
  },

  mira_ia_features: {
    title: "✨ Fonctionnalités clés de l'IA Mira",
    question: "Comment Mira optimise-t-elle la validation de votre étude ?",
    description: "Votre assistante analyse le contexte complet, vous questionne pour clarifier les sigles flous de vos variables, et rédige pour vous des synthèses adaptées aux publications scientifiques.",
    choices: [
      {
        label: "Compris ! Ouvrir « Mira Analyste » pour essayer",
        desc: "Accédez à de véritables explications vulgarisées, à un assistant d'interprétation contextuel et à un accompagnement pas à pas.",
        recommendation: {
          badge: "Assistant IA Statistique",
          name: "Mira, l'Analyste Haute Précision",
          desc: "Clé API Gemini : Vérifiez les paramètres de l'application si l'assistant affiche une erreur de connexion (mode payant / gratuit).",
          analysisType: "results"
        }
      }
    ]
  },

  compare: {
    title: "📊 Structure de la comparaison",
    question: "Combien de groupes ou mesures comparez-vous, et de quelle nature ?",
    description: "La taille et la dépendance des échantillons déterminent les familles de tests applicables.",
    choices: [
      {
        label: "Un seul échantillon (vs Valeur théorique)",
        desc: "Comparer les mesures d'un unique groupe à une norme de référence.",
        nextStepId: "compare_1"
      },
      {
        label: "Deux échantillons indépendants",
        desc: "Les individus des deux groupes sont distincts (ex: Hommes vs Femmes).",
        nextStepId: "compare_2_ind"
      },
      {
        label: "Deux mesures appariées (répétées)",
        desc: "Mêmes individus mesurés deux fois (ex: Avant/Après).",
        nextStepId: "compare_2_pair"
      },
      {
        label: "Trois échantillons ou plus (indépendants)",
        desc: "Comparer K groupes distincts (ex: Primaire, Secondaire, Supérieur).",
        nextStepId: "compare_3_more"
      },
      {
        label: "Trois mesures ou plus (appariées / fil du temps)",
        desc: "Suivi longitudinal des mêmes individus sur 3 temps ou plus.",
        nextStepId: "compare_k_pair"
      },
      {
        label: "Comparaison avancée (Contrôle de covariables / MANOVA)",
        desc: "Comparer des groupes en neutralisant des effets (ANCOVA) ou sur plusieurs cibles (MANOVA).",
        nextStepId: "compare_advanced"
      }
    ]
  },

  compare_1: {
    title: "🧮 1 Échantillon",
    question: "Votre variable est elle quantitative ou qualitative ?",
    choices: [
      {
        label: "Quantitative (numérique)",
        desc: "Ex: Taux de sucre sanguin vs 1.1 g/L attendu.",
        recommendation: {
          badge: "Test Paramétrique",
          name: "Test t de Student (1 éch.) / Wilcoxon (1 éch.)",
          desc: "Student pour données normales, Wilcoxon signé si asymétriques.",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Qualitative Binaire (2 modalités)",
        desc: "Ex: Pile/Face pour vérifier l'équité.",
        recommendation: {
          badge: "Test Exact / Paramétrique",
          name: "Test Binomial (Binaire)",
          desc: "Compare la proportion d'une modalité binaire à une proportion théorique attendue (p=0.5).",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Qualitative (>2 modalités)",
        desc: "Ex: Répartition des couleurs de M&Ms.",
        recommendation: {
          badge: "Test d'ajustement",
          name: "Chi-Deux d'adéquation (1 échantillon)",
          desc: "Vérifie si les fréquences d'une variable nominale sont conformes à un modèle théorique (unifome ou personnalisé).",
          analysisType: "stat_tests_nonparam"
        }
      }
    ]
  },

  compare_2_ind: {
    title: "🛎️ Normalité & Variances (2 Indépendants)",
    question: "Conditions de normalité respectées (ou n > 30) ?",
    choices: [
      {
        label: "Oui, Normal et Variances égales (Homoscédasticité)",
        desc: "Vous pouvez vérifier l'égalité des variances via le Test de Levene inclus dans le logiciel.",
        recommendation: {
          badge: "Test Paramétrique",
          name: "Test t de Student / Test de Levene",
          desc: "Utilisez le test de Levene pour confirmer les variances, puis le t de Student.",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Oui normal, Mais Variances INÉGALES (Hétéroscédasticité)",
        desc: "Levene rejette l'égalité des variances.",
        recommendation: {
          badge: "Test Paramétrique Adapté",
          name: "Test t de Welch",
          desc: "Variante robuste du t-test qui accommode les différences nettes d'écart-type entre groupes.",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Non, données non normales / petits effectifs",
        desc: "Échec de Shapiro-Wilk et petit n.",
        recommendation: {
          badge: "Test Non Paramétrique",
          name: "Test de Mann-Whitney (U)",
          desc: "Compare la structure des rangs (les médianes) et offre une résilience aux valeurs aberrantes.",
          analysisType: "stat_tests_nonparam"
        }
      }
    ]
  },

  compare_2_pair: {
    title: "📦 Différence Appariée (2 mesures)",
    question: "La *différence* entre les deux mesures suit-elle une loi normale ?",
    choices: [
      {
        label: "Oui",
        desc: "Le T-test apparié classique s'applique.",
        recommendation: {
          badge: "Test Paramétrique",
          name: "Test t apparié",
          desc: "Bilan avant-après robuste sur données mesurables.",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Non / Ordinal",
        desc: "Ex : scores d'échelles de sévérité asymétriques.",
        recommendation: {
          badge: "Test Non Paramétrique",
          name: "Test de Wilcoxon apparié",
          desc: "Alternative basée sur les rangs signés.",
          analysisType: "stat_tests_nonparam"
        }
      }
    ]
  },

  compare_3_more: {
    title: "🎪 Comparaison K-Groupes Indépendants",
    question: "Les données suivent-elles la loi normale et les variances sont-elles égales ?",
    choices: [
      {
        label: "Oui (Normalité + Homoscédasticité)",
        desc: "Vérifiable via le test de Levene préalable.",
        recommendation: {
          badge: "Modèle Linéaire Global",
          name: "ANOVA à 1 Facteur (+ Post-Hoc)",
          desc: "Test robuste avec correction Tukey pour identifier précisément quels groupes diffèrent.",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Non",
        desc: "Variances hétérogènes ou très asymétrique.",
        recommendation: {
          badge: "Non Paramétrique K-group",
          name: "Kruskal-Wallis (+ Post-Hoc Dunn)",
          desc: "Équivalent de l'ANOVA par sommations de rangs.",
          analysisType: "stat_tests_nonparam"
        }
      }
    ]
  },
  
  compare_k_pair: {
    title: "📅 Suivi Longitudinal Apparié (> 2)",
    question: "S'agit-il de données continues et normales ?",
    choices: [
      {
        label: "Oui (Normal et sphéricité vérifiée)",
        desc: "Suivi métrique (poids, perf, temps)",
        recommendation: {
          badge: "Paramétrique",
          name: "ANOVA à mesures répétées",
          desc: "Évalue l'effet du temps sur les mêmes sujets (post-hoc inclus).",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Non / Données Ordinales",
        desc: "Distributions asymétriques.",
        recommendation: {
          badge: "Non Paramétrique",
          name: "Test de Friedman",
          desc: "Compare l'évolution temporelle grâce au classement des k mesures.",
          analysisType: "stat_tests_nonparam"
        }
      }
    ]
  },
  
  compare_advanced: {
    title: "🧪 Modèles Expérimentaux Avancés",
    question: "Voulez-vous neutraliser un biais ou étudier plusieurs variables dépendantes (Y) simultanément ?",
    choices: [
      {
        label: "Neutraliser une variable parasitaire (1 seule VD)",
        desc: "Contrôler l'âge avant d'évaluer le traitement.",
        recommendation: {
          badge: "Contrôle de confusion",
          name: "ANCOVA / ANCOVA sur Rangs",
          desc: "Analyse de covariance paramétrique ou robuste de Quade.",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Plusieurs VD sous un même modèle factoriel",
        desc: "Evaluer simultanément le stress ET la tension (2 VD) d'un coup.",
        recommendation: {
          badge: "Modèle Multivarié",
          name: "MANOVA / PERMANOVA",
          desc: "Permet d'évaluer un effet global sur un vecteur de multiples réponses quantitatives simultanées.",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Les deux : contrôle AND plusieurs VD",
        desc: "L'option la plus complexe.",
        recommendation: {
          badge: "Modèle Ultime",
          name: "MANCOVA / PERMANCOVA",
          desc: "Combine les covariables continues avec des réponses vectorielles multiples.",
          analysisType: "stat_tests_param"
        }
      }
    ]
  },

  relation: {
    title: "🔗 Associations et Liens",
    question: "Quelles sont les natures de vos variables croisées ?",
    choices: [
      {
        label: "Quanti ↔ Quanti (Corrélation)",
        desc: "Relation entre deux variables numériques.",
        nextStepId: "relation_quant"
      },
      {
        label: "Quali ↔ Quali (Indépendance contingente)",
        desc: "Frise croisée de fréquences.",
        nextStepId: "relation_qual"
      }
    ]
  },

  relation_quant: {
    title: "📈 Corrélation (Quanti-Quanti)",
    question: "Quelle force de robustesse désirez-vous face aux valeurs aberrantes ?",
    choices: [
      {
        label: "Linéarité stricte + Normalité",
        desc: "Sensible aux individus extrêmes.",
        recommendation: {
          badge: "Paramétrique",
          name: "Corrélation de Pearson",
          desc: "Indice r canonique d'évaluation linéaire pure.",
          analysisType: "stat_tests_param"
        }
      },
      {
        label: "Relation monotone et robustesse aux extrêmes",
        desc: "Pénalisation et ordonnancement.",
        recommendation: {
          badge: "Non Paramétrique",
          name: "Corrélation de Spearman / Kendall",
          desc: "Spearman (rho) pour une bonne robustesse de rang. Kendall (tau) particulièrement indiqué pour les petits échantillons avec beaucoup d'ex-aequos.",
          analysisType: "stat_tests_nonparam"
        }
      }
    ]
  },

  relation_qual: {
    title: "📐 Contingence Quali-Quali",
    question: "Le volume d'effectif est-il massif et vos mesures indépendantes ?",
    choices: [
      {
        label: "Oui, large effectif (indépendants)",
        desc: "Effectifs théoriques des cellules > 5.",
        recommendation: {
          badge: "Test Nominal",
          name: "Test du Chi-Deux / V de Cramer",
          desc: "Évalue l'écart entre le observé et l'attendu de complète indépendance. Le V de Cramer en quantifie l'intensité.",
          analysisType: "stat_tests_nonparam"
        }
      },
      {
        label: "Non, tableau 2x2 avec petits effectifs",
        desc: "Données lacunaires et cases rares.",
        recommendation: {
          badge: "Analyse Exacte",
          name: "Test Exact de Fisher",
          desc: "Évaluation de la dépendance nominale en résolvant la combinatoire hypergéométrique sans approximation asymptotique.",
          analysisType: "stat_tests_nonparam"
        }
      },
      {
        label: "Appariés récurrents (ex: Choix Avant ↔ Choix Après)",
        desc: "Glissement de préférence des mêmes sujets.",
        recommendation: {
          badge: "Croisé Temporel",
          name: "Test de McNemar (Matrice 2x2)",
          desc: "Evalue si l'évolution binaire croisée entre deux moments de traitement sur les mêmes sujets est significative.",
          analysisType: "stat_tests_nonparam"
        }
      }
    ]
  },

  predict: {
    title: "🔮 Estimation & Régression",
    question: "Quel type de réponse cible (Y) tentez-vous de prédire ?",
    choices: [
      {
        label: "Valeur continue (Quanti)",
        desc: "Estimer des montants, notes ou poids.",
        nextStepId: "predict_quant"
      },
      {
        label: "Classe de Classification (Quali)",
        desc: "Estimer la probabilité de survenue d'un groupe.",
        nextStepId: "predict_qual"
      }
    ]
  },

  predict_quant: {
    title: "📉 Moteurs de Régression Linéaire",
    question: "Volume de variables explicatives (X) ?",
    choices: [
      {
        label: "Une seule variable explicative",
        desc: "Ex: x -> y.",
        recommendation: {
          badge: "MCO Classique",
          name: "Régression Linéaire Simple",
          desc: "Modélise l'équation causale basique + intervalle confiance.",
          analysisType: "regs"
        }
      },
      {
        label: "Plusieurs (Facteurs multiples)",
        desc: "Ex: x1, x2, x3 -> y.",
        recommendation: {
          badge: "Modélisation Complexe",
          name: "Régression Linéaire Multiple",
          desc: "Réseau prédictif d'influence conjointe, tests de VIF, résidus et validité du modèle P-F.",
          analysisType: "regs"
        }
      }
    ]
  },

  predict_qual: {
    title: "🎯 Modélisation Probabiliste",
    question: "S'agit-il d'un choix binaire (oui/non) ou non ?",
    choices: [
      {
        label: "Modalité dichotomique (Ex: Malade ou Sain)",
        desc: "Exclusivité binaire.",
        recommendation: {
          badge: "Modèle de Bernoulli",
          name: "Régression Logistique Binaire",
          desc: "Utilise la fonction Sigmoïde / Logit pour extraire les Odds Ratio (probabilité augmentée de l'effet marginal).",
          analysisType: "regs"
        }
      },
      {
        label: "A choix multinomiaux (A vs B vs C)",
        desc: "Trois classes ou plus en sortie.",
        recommendation: {
          badge: "Softmax",
          name: "Régression Logistique Multinomiale",
          desc: "Fixe une catégorie Pivot et compare les influences marginales en réseau probabiliste.",
          analysisType: "regs"
        }
      }
    ]
  },

  exploratory: {
    title: "🧬 Découvertes Multidimensionnelles",
    question: "Quel est le but central de cet exercice ?",
    choices: [
      {
        label: "Réduction des variables sous de super-concepts orthogonaux",
        desc: "Transformer 50 variables colinéaires en 2 axes de lisibilité majeurs.",
        recommendation: {
          badge: "Factorielle",
          name: "Analyse en Composantes Principales (ACP)",
          desc: "Sert de proxy d'information et montre l'écart entre des cercles de corrélation.",
          analysisType: "multivar"
        }
      },
      {
        label: "Segmentation du jeu de données (Création de typologies / Groupes)",
        desc: "Je souhaite identifier des personas ou des familles d'observations homogènes.",
        recommendation: {
          badge: "Machine Learning (Non supervisé)",
          name: "Clustering (K-Means & CAH)",
          desc: "Utilise la somme des distances euclidiennes ou le raccord hiérarchique de Ward pour peindre et valider des classes naturelles.",
          analysisType: "multivar"
        }
      },
      {
        label: "Différence multidimensionnelle selon une variable a priori (Supervisé)",
        desc: "J'ai les statuts et je veux les séparer avec tous mes facteurs X.",
        recommendation: {
          badge: "Discriminatoire",
          name: "Analyse Factorielle Discriminante (AFD)",
          desc: "Calcule les axes qui séparent le *mieux* vos individus conditionnellement à leurs catégories connues.",
          analysisType: "multivar"
        }
      }
    ]
  }
};

const formatRecentDate = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
};

export default function WelcomeScreen() {
  const [activeFullExtension, setActiveFullExtension] = useState<'lab' | 'batch' | 'quali' | null>(null);
  const [miraSlide, setMiraSlide] = useState(0);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);

  const MIRA_SLIDES = [
    {
      title: "1. Qui est Mira ?",
      desc: "Mira est l'experte IA intégrée dans Nuru Lab. Plus qu'un simple chatbot, c'est une assistante virtuelle dédiée à la science des données et à la recherche statistique.",
      illust: (
        <div className="w-full h-32 bg-indigo-950 rounded-xl relative overflow-hidden flex flex-col justify-center items-center p-4">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Bot className="w-6 h-6 text-white shrink-0" />
          </div>
          <div className="mt-2 text-[10px] font-extrabold text-indigo-300 tracking-wider uppercase font-mono">Assistance IA Mira</div>
        </div>
      )
    },
    {
      title: "2. Où la trouver ?",
      desc: "Cliquez à tout moment sur le bouton violet « Mira Analyste » dans la barre de navigation supérieure pour ouvrir son volet de travail, ou cliquez sur l'accueil ou ailleurs pour masquer l'interface.",
      illust: (
        <div className="w-full h-32 bg-slate-900 rounded-xl relative p-3 flex flex-col justify-between font-mono text-[9px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 w-full">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </div>
            <div className="px-2 py-0.5 bg-indigo-600 rounded text-white flex items-center gap-1 font-sans font-bold text-[8px]">
              <Sparkles className="w-2.5 h-2.5" />
              Mira Analyste
            </div>
          </div>
          <div className="text-slate-500 text-center font-sans text-[10px] py-2">Barre de Navigation Supérieure</div>
        </div>
      )
    },
    {
      title: "3. Vos résultats synchronisés",
      desc: "Mira dispose d'une barre latérale regroupant toutes vos analyses statistiques exécutées. Cliquez sur l'une d'elles pour que Mira l'analyse en détail.",
      illust: (
        <div className="w-full h-32 bg-slate-900 rounded-xl p-2.5 flex gap-2 overflow-hidden text-[8px]">
          <div className="w-24 border-r border-slate-800 pr-1.5 space-y-1.5 shrink-0 flex flex-col text-left">
            <div className="font-bold text-[7px] text-slate-500 uppercase tracking-wider">Analyses</div>
            <div className="p-1 px-1.5 bg-indigo-950/40 border border-indigo-550/30 rounded text-[7px] text-indigo-300 font-sans leading-none truncate flex items-center gap-1">
              <span className="w-1 h-1 bg-indigo-400 rounded-full shrink-0"></span>
              ANOVA 1 Facteur
            </div>
            <div className="p-1 border border-slate-800 rounded text-[7px] text-slate-400 leading-none truncate">
              Chi-Deux X ↔ Y
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center text-center p-2">
            <div className="p-1.5 bg-indigo-900 border border-indigo-500/50 text-indigo-100 font-bold rounded text-[8px] flex items-center gap-1 font-sans">
              <Sparkles className="w-2.5 h-2.5" /> Interpréter
            </div>
          </div>
        </div>
      )
    },
    {
      title: "4. Questions intelligentes",
      desc: "Mira ne fait pas d'affirmations à l'aveugle. S'il lui manque des informations, comme le sens réel du nom d'une variable ou d'un sigle, elle vous posera la question.",
      illust: (
        <div className="w-full h-32 bg-slate-900 rounded-xl p-3 flex flex-col justify-center space-y-1.5 text-[8px] text-left">
          <div className="self-start max-w-[85%] bg-slate-800 p-1.5 rounded-lg border border-slate-700 text-slate-300 font-sans leading-tight">
            Bonjour ! À quoi fait référence la variable <b className="text-indigo-400">« CM_1 »</b> ? S'agit-il du coefficient multiplicateur ?
          </div>
          <div className="self-end bg-indigo-600 text-white p-1.5 rounded-lg font-sans leading-tight text-right shadow">
            C'est la concentration moyenne du produit.
          </div>
        </div>
      )
    },
    {
      title: "5. Suivi par analyse",
      desc: "Chaque résultat d'analyse dispose de sa propre conversation exclusive. Vous pouvez basculer d'une discussion à l'autre sans jamais perdre le fil de vos interprétations.",
      illust: (
        <div className="w-full h-32 bg-slate-900 rounded-xl p-2.5 flex flex-col justify-between text-[8px] font-mono text-left">
          <div className="flex items-center gap-1 bg-indigo-950/20 px-2 py-1 rounded border border-indigo-500/20 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
            <span className="text-[7.5px] text-indigo-300">ANOVA : Note d'Examen</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-800/40 px-2 py-1 rounded border border-slate-700 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span className="text-[7.5px] text-slate-400">Chi-Deux d'ajustement</span>
          </div>
          <p className="text-[9px] text-slate-500 font-sans text-right">Historique de discussion séparé 💾</p>
        </div>
      )
    }
  ];

  const isReady = useWorkspaceStore((state) => state.isReady);
  const triggerImport = useWorkspaceStore((state) => state.triggerImport);
  const setWorkspaceMode = useWorkspaceStore((state) => state.setWorkspaceMode);
  const setActiveDashboardTab = useWorkspaceStore((state) => state.setActiveDashboardTab);
  const openMira = useWorkspaceStore((state) => state.openMira);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const loadingMessage = useWorkspaceStore((state) => state.loadingMessage);
  const loadProject = useWorkspaceStore((state) => state.loadProject);
  const recentProjects = useWorkspaceStore((state) => state.recentProjects);
  const removeRecentProject = useWorkspaceStore((state) => state.removeRecentProject);
  const licenseDaysRemaining = useWorkspaceStore((state) => state.licenseDaysRemaining);
  const licenseExpiryDate = useWorkspaceStore((state) => state.licenseExpiryDate);

  // Assistant states
  const [showWizard, setShowWizard] = useState(false);
  const [currentStepId, setCurrentStepId] = useState('start');
  const [stepHistory, setStepHistory] = useState<string[]>([]);

  if (activeFullExtension === 'lab') {
    return <InteractiveLab onBack={() => setActiveFullExtension(null)} />;
  }

  if (activeFullExtension === 'batch') {
    return (
      <div className="w-full h-full bg-slate-50 flex flex-col p-6 overflow-y-auto">
        <BatchProcessingMode onBack={() => setActiveFullExtension(null)} />
      </div>
    );
  }

  if (activeFullExtension === 'quali') {
    return (
      <QualitativeAnalysisModule onBack={() => setActiveFullExtension(null)} />
    );
  }

  const handleLoadNRA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        await loadProject(parsed, file.name);
      } catch (err: any) {
        toast.error(`Impossible de lire le fichier .nra : ${err.message || err}`);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ''; // Reset file input
  };

  const currentStep = DECISION_TREE[currentStepId];

  const handleNextStep = (nextId?: string) => {
    if (nextId) {
      setStepHistory((prev) => [...prev, currentStepId]);
      setCurrentStepId(nextId);
    }
  };

  const handleBack = () => {
    if (stepHistory.length > 0) {
      const prevId = stepHistory[stepHistory.length - 1];
      setStepHistory((prev) => prev.slice(0, -1));
      setCurrentStepId(prevId);
    } else {
      setShowWizard(false);
    }
  };

  const handleResetWizard = () => {
    setCurrentStepId('start');
    setStepHistory([]);
  };

  return (
    <div className="h-full w-full flex flex-col items-center bg-transparent text-slate-900 p-4 md:p-6 lg:p-8 xl:p-10 overflow-y-auto relative select-none cursor-default">
      
      {/* Decorative ambient subtle circle glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-50/40 via-sky-50/20 to-emerald-50/30 rounded-full blur-3xl pointer-events-none z-0" />

      <AnimatePresence mode="wait">
        {!showWizard ? (
          <motion.div 
            key="dashboard-home"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="max-w-4xl w-full z-10 relative flex flex-col space-y-4 md:space-y-5 lg:space-y-6 py-4 md:py-8 my-auto min-h-fit"
          >
            {/* Header section with fine typography */}
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-white shadow-md border border-slate-200/60 rounded-xl flex items-center justify-center mb-2 hover:rotate-12 transition-transform duration-300">
                <FlaskConical className="w-5 h-5 text-indigo-600" />
              </div>
              
              <span className="text-[9px] font-bold tracking-[0.2em] text-indigo-600 uppercase bg-indigo-50 border border-indigo-100/30 px-2.5 py-1 rounded-full mb-1.5 shadow-sm">
                Espace d'Analyse Statistique
              </span>
              
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-950 mb-1 md:mb-1.5 bg-gradient-to-b from-slate-950 to-slate-800 bg-clip-text">
                Nuru Analytics Premium
              </h1>
              
              {licenseDaysRemaining !== null && (
                <div id="license-remaining-banner" className="mb-2 flex items-center justify-center">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold shadow-sm backdrop-blur-sm transition-all duration-300 ${
                    licenseDaysRemaining <= 5 
                      ? "bg-rose-50 border-rose-200/80 text-rose-800 shadow-rose-100/30" 
                      : licenseDaysRemaining <= 15
                      ? "bg-amber-50 border-amber-200/80 text-amber-800 shadow-amber-100/30"
                      : "bg-emerald-50 border-emerald-200/80 text-emerald-800 shadow-emerald-100/30"
                  }`}>
                    <span className={`relative flex h-1.5 w-1.5 shrink-0`}>
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        licenseDaysRemaining <= 5 ? "bg-rose-400" : licenseDaysRemaining <= 15 ? "bg-amber-400" : "bg-emerald-400"
                      }`} />
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        licenseDaysRemaining <= 5 ? "bg-rose-600" : licenseDaysRemaining <= 15 ? "bg-amber-600" : "bg-emerald-600"
                      }`} />
                    </span>
                    <span className="font-sans font-medium text-[11px]">
                      {licenseDaysRemaining <= 1
                        ? "Votre licence Premium expire aujourd'hui"
                        : `${licenseDaysRemaining} jours restants sur votre licence Premium`
                      }
                      {licenseExpiryDate && (
                        <span className="font-normal opacity-90">
                          {` • expire le ${new Date(licenseExpiryDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
              
              <p className="text-slate-500 text-xs max-w-md leading-relaxed font-normal">
                Préparez, filtrez et exploitez vos données de recherche locales. Une suite robuste de traitements mathématiques et statistiques avancés.
              </p>
            </div>

            {/* Action Grid Options with premium cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-5">
              
              {/* Card A: Unified Import Menu */}
              <div className="relative h-full">
                <button 
                  onClick={() => setIsImportMenuOpen(!isImportMenuOpen)}
                  disabled={isLoading}
                  className="w-full group text-left bg-white rounded-2xl p-4 md:p-5 border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(148,163,184,0.1)] hover:shadow-[0_8px_16px_-4px_rgba(99,102,241,0.08)] hover:border-indigo-200 transition-all duration-300 flex flex-col h-full overflow-hidden disabled:opacity-65 disabled:cursor-not-allowed cursor-pointer"
                >
                  {/* Top Right visual flare */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/35 rounded-full blur-xl group-hover:bg-indigo-100/50 pointer-events-none" />

                  <div className="w-9 h-9 bg-indigo-50 border border-indigo-100/40 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                     {isLoading ? (
                        <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                     ) : (
                        <Database className="w-5 h-5" />
                     )}
                  </div>
                  
                  <h2 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center justify-between w-full">
                    Ajouter des données
                    <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${isImportMenuOpen ? 'rotate-180 text-indigo-600' : 'group-hover:text-indigo-600 group-hover:translate-y-0.5'}`} />
                  </h2>
                  <p className="text-[11px] text-slate-400 leading-normal mb-4">
                    Importer un jeu, un tableau croisé ou générer.
                  </p>

                  <div className="mt-auto pt-3 flex flex-wrap gap-1.5 text-[9px] font-bold text-slate-400 font-mono">
                    <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded">NOUVEL ANCRAGE</span>
                  </div>
                </button>

                <AnimatePresence>
                  {isImportMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      className="absolute left-0 top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 flex flex-col overflow-hidden"
                    >
                       <button onClick={() => { setIsImportMenuOpen(false); triggerImport(); }} className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100/60 last:border-0">
                         <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100/50 flex items-center justify-center shrink-0">
                           <UploadCloud className="w-3.5 h-3.5 text-indigo-600" />
                         </div>
                         <div>
                           <div className="text-xs font-bold text-slate-800">Importer un jeu de données</div>
                           <div className="text-[9px] text-slate-400 mt-0.5">Fichiers plats (CSV, Excel) à analyser.</div>
                         </div>
                       </button>
                       <button onClick={() => { setIsImportMenuOpen(false); useWorkspaceStore.getState().triggerImportCrosstab(); }} className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100/60 last:border-0">
                         <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100/50 flex items-center justify-center shrink-0">
                           <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
                         </div>
                         <div>
                           <div className="text-xs font-bold text-slate-800">Importer un tableau croisé</div>
                           <div className="text-[9px] text-slate-400 mt-0.5">Extraire 2 variables d'une agrégation.</div>
                         </div>
                       </button>
                       <button onClick={() => { setIsImportMenuOpen(false); useWorkspaceStore.getState().setIsGeneratorOpen(true); }} className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100/60 last:border-0">
                         <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100/50 flex items-center justify-center shrink-0">
                           <Bot className="w-3.5 h-3.5 text-emerald-600" />
                         </div>
                         <div>
                           <div className="text-xs font-bold text-slate-800">Simuler des données</div>
                           <div className="text-[9px] text-slate-400 mt-0.5">Générateur IA de données factices.</div>
                         </div>
                       </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Card B: Load existing NRA project */}
              <button 
                onClick={() => document.getElementById('nra-project-loader')?.click()}
                disabled={isLoading}
                className="group text-left bg-white rounded-2xl p-4 md:p-5 border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(148,163,184,0.1)] hover:shadow-[0_8px_16px_-4px_rgba(79,70,229,0.08)] hover:border-indigo-300 transition-all duration-300 flex flex-col h-full relative overflow-hidden disabled:opacity-65 cursor-pointer"
              >
                {/* Hidden input */}
                <input 
                  type="file" 
                  id="nra-project-loader" 
                  accept=".nra" 
                  className="hidden" 
                  onChange={handleLoadNRA} 
                />
                {/* Top Right visual flare */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/25 rounded-full blur-xl group-hover:bg-indigo-100/40 pointer-events-none" />

                <div className="w-9 h-9 bg-indigo-50 border border-indigo-100/40 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                   <FolderOpen className="w-5 h-5 text-indigo-600" />
                </div>
                
                <h2 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center justify-between w-full">
                  Charger un projet (.nra)
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-all group-hover:translate-x-1 shrink-0" />
                </h2>
                <p className="text-[11px] text-slate-400 leading-normal mb-4">
                  Restaurer une session de travail enregistrée avec vos pipelines et graphiques.
                </p>

                <div className="mt-auto pt-3 flex text-[9px] font-bold text-indigo-600 font-mono">
                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100/40 rounded">RESTAURER SÉANCE</span>
                </div>
              </button>

              {/* Card C: Create Project from scratch */}
              <button 
                onClick={() => {
                  setWorkspaceMode('manual_setup');
                  useWorkspaceStore.setState({ isReady: true });
                }}
                disabled={isLoading}
                className="group text-left bg-white rounded-2xl p-4 md:p-5 border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(148,163,184,0.1)] hover:shadow-[0_8px_16px_-4px_rgba(16,185,129,0.08)] hover:border-emerald-200 transition-all duration-300 flex flex-col h-full relative overflow-hidden disabled:opacity-65 cursor-pointer"
              >
                {/* Top Right visual flare */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/25 rounded-full blur-xl group-hover:bg-emerald-100/40 pointer-events-none" />

                <div className="w-9 h-9 bg-emerald-50 border border-emerald-100/40 text-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                   <FilePlus className="w-5 h-5" />
                </div>
                
                <h2 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center justify-between w-full">
                  Créer un tableau de saisie
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-all group-hover:translate-x-1 shrink-0" />
                </h2>
                <p className="text-[11px] text-slate-400 leading-normal mb-4">
                  Définissez vos variables et saisissez pas-à-pas vos fiches de renseignements.
                </p>

                <div className="mt-auto pt-3 flex text-[9px] font-bold text-emerald-600 font-mono">
                  <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100/40 rounded">NOUVEL ESSAI LOCAL</span>
                </div>
              </button>

              {/* Card D: Qualitative Analysis Module */}
              <button 
                onClick={() => setActiveFullExtension('quali')}
                disabled={isLoading}
                className="group text-left bg-gradient-to-br from-fuchsia-600 to-indigo-600 rounded-2xl p-4 md:p-5 border border-transparent shadow-[0_8px_20px_-4px_rgba(192,38,211,0.25)] hover:shadow-[0_12px_24px_-4px_rgba(192,38,211,0.35)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col h-full relative overflow-hidden disabled:opacity-65 cursor-pointer"
              >
                {/* Flares decor details */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.1] rounded-full blur-2xl pointer-events-none" />

                <div className="w-9 h-9 bg-white/20 border border-white/20 text-white rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform backdrop-blur-sm">
                   <Sparkles className="w-5 h-5" />
                </div>
                
                <h2 className="text-sm font-extrabold text-white mb-1 flex items-center justify-between w-full">
                  Analyse Qualitative (IA)
                  <ChevronRight className="w-4 h-4 text-white/50 group-hover:text-white transition-all group-hover:translate-x-1 shrink-0" />
                </h2>
                <p className="text-[11px] text-fuchsia-100/80 leading-normal mb-4">
                  Obtenez une analyse thématique de vos entretiens et focus groups grâce à Gemini.
                </p>

                <div className="mt-auto pt-3 flex text-[9px] font-bold text-white font-mono">
                  <span className="px-2 py-0.5 bg-white/10 border border-white/20 rounded backdrop-blur-sm">MODULE GEMINI</span>
                </div>
              </button>

            </div>

            {/* 3-Column Premium Row combining Menu Extensions, Assistant d'Orientation and Guide Mira (Slides) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 w-full">
              
              {/* Menu Extensions Card */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-[0_4px_16px_-4px_rgba(148,163,184,0.12)] flex flex-col justify-between relative overflow-hidden h-full min-h-[220px]"
              >
                {/* Visual design flares */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-50/45 rounded-full blur-xl pointer-events-none" />
                
                <div className="relative z-10 space-y-3.5 w-full">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-violet-50 border border-violet-100/50 rounded-xl flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5 text-violet-650" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-900 leading-tight">🧩 Menu Extensions</h2>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Outils & fonctionnalités avancées</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {/* Extension Option 1: Labo interactif */}
                    <button 
                      onClick={() => {
                        setActiveFullExtension('lab');
                        toast.success("Ouverture du Labo Interactif");
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition-all duration-200 text-left group/ext cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 bg-indigo-50/60 rounded-lg flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 leading-normal group-hover/ext:text-indigo-650 transition-colors">Labo interactif</p>
                          <p className="text-[10px] text-slate-450 truncate">Simulateur de tests & probabilités en réel</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-350 group-hover/ext:text-indigo-650 group-hover/ext:translate-x-0.5 transition-all shrink-0" />
                    </button>

                    {/* Extension Option 2: Traitement par lot */}
                    <button 
                      onClick={() => {
                        setActiveFullExtension('batch');
                        toast.success("Ouverture du Traitement par Lot");
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-fuchsia-200 hover:bg-fuchsia-50/30 transition-all duration-200 text-left group/ext cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 bg-fuchsia-50/60 rounded-lg flex items-center justify-center shrink-0">
                          <Layers className="w-4 h-4 text-fuchsia-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 leading-normal group-hover/ext:text-fuchsia-650 transition-colors">Traitement par lot (Batch)</p>
                          <p className="text-[10px] text-slate-450 truncate">Appliquer un workflow sur plusieurs fichiers</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-350 group-hover/ext:text-fuchsia-650 group-hover/ext:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Assistant square-ish card representation */}
              <motion.button
                onClick={() => {
                  setShowWizard(true);
                  handleResetWizard();
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-left bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-2xl p-5 shadow-[0_6px_16px_-4px_rgba(79,70,229,0.2)] hover:shadow-[0_12px_24px_-4px_rgba(79,70,229,0.3)] hover:scale-[1.008] transition-all duration-300 flex flex-col justify-between group relative overflow-hidden cursor-pointer h-full min-h-[220px]"
              >
                {/* Flares decor details */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.06] rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-20 h-20 bg-indigo-500/25 rounded-full blur-xl pointer-events-none" />

                <div className="flex items-start gap-3 h-full relative z-10 w-full mb-4">
                  <div className="w-9 h-9 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm group-hover:scale-105 transition-transform shrink-0">
                     <Sparkles className="w-4.5 h-4.5 text-amber-300 animate-pulse" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between h-full min-w-0">
                     <div>
                       <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[8px] font-extrabold tracking-widest text-indigo-200 uppercase px-1.5 py-0.5 bg-black/20 rounded border border-white/5">Pas-à-pas</span>
                       </div>
                       <h2 className="text-[15px] font-extrabold text-white leading-tight">
                         Assistant d'Orientation
                       </h2>
                       <p className="text-[11px] text-indigo-150 font-medium mt-1.5 leading-relaxed">
                         Besoin d'aide pour choisir votre test ? Évaluez vos besoins à l’aide d'un arbre de décision intuitif et trouvez le test ou la modélisation appropriée à vos variables.
                       </p>
                     </div>
                  </div>
                </div>
                
                <div className="mt-auto pt-2 text-[10px] font-bold text-white flex items-center gap-1 group-hover:translate-x-1 transition-transform relative z-10 font-sans">
                  <span>Démarrer l'orientation</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </motion.button>

              {/* Guide de l'Assistant Mira Illustré (Slides) */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-[0_4px_16px_-4px_rgba(148,163,184,0.12)] flex flex-col justify-between relative overflow-hidden h-full min-h-[220px]"
              >
                {/* Visual design flares */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/45 rounded-full blur-xl pointer-events-none" />
                
                <div className="relative z-10 space-y-3.5 w-full flex-1 flex flex-col justify-between text-left">
                  {/* Card Header */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-50 border border-indigo-150 rounded-lg flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-indigo-650" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-extrabold text-slate-900 leading-none truncate">Guide Interactif Mira IA</h3>
                      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Aide à l'Interprétation IA</p>
                    </div>
                  </div>

                  {/* Interactive Slide Artwork Mockup */}
                  <div className="my-1">
                    {MIRA_SLIDES[miraSlide].illust}
                  </div>

                  {/* Informative text */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 leading-tight truncate mb-1">
                      {MIRA_SLIDES[miraSlide].title}
                    </h4>
                    <p className="text-[10.5px] text-slate-500 leading-normal min-h-[44px]">
                      {MIRA_SLIDES[miraSlide].desc}
                    </p>
                  </div>

                  {/* Controller dots & pagination */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-2 shrink-0 font-sans">
                    <button 
                      type="button"
                      onClick={() => setMiraSlide(prev => (prev === 0 ? MIRA_SLIDES.length - 1 : prev - 1))}
                      className="p-1 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                      title="Précédent"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      {MIRA_SLIDES.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setMiraSlide(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-250 cursor-pointer ${
                            i === miraSlide ? 'bg-indigo-600 w-3' : 'bg-slate-200 hover:bg-slate-300'
                          }`}
                        />
                      ))}
                    </div>

                    <button 
                      type="button"
                      onClick={() => setMiraSlide(prev => (prev === MIRA_SLIDES.length - 1 ? 0 : prev + 1))}
                      className="p-1 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                      title="Suivant"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>

            </div>

            {/* Recent projects list (only if any exist) */}
            {recentProjects && recentProjects.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(148,163,184,0.1)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-slate-50 border border-slate-100/80 rounded-lg flex items-center justify-center text-slate-500">
                      <History className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-900">Projets récents</h3>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">
                    {recentProjects.length} / 5
                  </span>
                </div>

                <div className="grid gap-2 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin">
                  {recentProjects.map((project, index) => (
                    <div
                      key={project.filename + index}
                      className="group flex items-center justify-between p-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-xl transition duration-200 gap-3"
                    >
                      {/* Left: Project title and details */}
                      <button
                        onClick={() => loadProject(project.data, project.filename)}
                        disabled={isLoading}
                        className="flex-1 text-left flex items-center gap-2.5 focus:outline-none cursor-pointer min-w-0"
                      >
                        <div className="w-8 h-8 bg-indigo-50 border border-indigo-150 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <FolderOpen className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate font-mono">
                            {project.filename}
                          </h4>
                          <div className="flex items-center gap-x-2 text-[10px] text-slate-400 font-medium">
                            {project.datasetName && project.datasetName !== project.filename.replace(/\.nra$/, '') && (
                              <span className="truncate max-w-[80px] bg-indigo-50/80 text-indigo-700 px-1 py-0.1 rounded text-[8px] uppercase font-bold tracking-wider font-sans shrink-0">
                                {project.datasetName}
                              </span>
                            )}
                            <span className="flex items-center gap-1 truncate">
                              <Database className="w-3 h-3 text-slate-350 shrink-0" />
                              {project.rowCount} l. × {project.colCount} c.
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => loadProject(project.data, project.filename)}
                          disabled={isLoading}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[9px] uppercase tracking-wider rounded-lg transition duration-150 flex items-center gap-1 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                        >
                          Ouvrir
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecentProject(index)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-transparent hover:border-rose-100 transition duration-150 cursor-pointer"
                          title="Retirer de l'historique"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Feature status badges at the very bottom */}
            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-4 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Analyses 100% locales et privées</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
                <span>Calculateur Python activé</span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="wizard-panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="max-w-7xl lg:max-w-7xl xl:max-w-[1400px] w-full z-10 relative bg-white border border-slate-200 rounded-[24px] shadow-2xl p-5 md:p-8 flex flex-col my-auto max-h-[92vh] overflow-hidden"
          >
            {/* Wizard Header Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2 bg-slate-50 border border-slate-100 hover:border-indigo-100 rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                {stepHistory.length > 0 ? "Étape précédente" : "Retour à l'accueil"}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/50">
                  Assistant Méthodologique
                </span>
                {stepHistory.length > 0 && (
                  <button
                    onClick={handleResetWizard}
                    className="p-2 bg-slate-50 border border-slate-100 hover:border-indigo-100 text-slate-400 hover:text-indigo-600 rounded-xl cursor-pointer"
                    title="Recommencer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Active Step Content */}
            <div className="flex-1 overflow-y-auto pr-1.5 space-y-6 max-h-[68vh] md:max-h-[72vh] scrollbar-thin">
              
              <div className="space-y-2">
                <div className="text-[10px] font-black tracking-widest text-indigo-600 uppercase">
                  {currentStep.title}
                </div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                  {currentStep.question}
                </h2>
                {currentStep.description && (
                  <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
                    {currentStep.description}
                  </p>
                )}
              </div>

              {/* Step Choices Grid */}
              <div className={`grid gap-4 mt-8 ${currentStep.choices.length > 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {currentStep.choices.map((choice, idx) => {
                  const isRecommendation = !!choice.recommendation;
                  const rec = choice.recommendation;
                  const isLastOdd = currentStep.choices.length % 2 !== 0 && idx === currentStep.choices.length - 1;

                  return (
                    <div key={idx} className={`w-full ${isLastOdd && currentStep.choices.length > 2 ? 'md:col-span-2' : ''}`}>
                      {!isRecommendation ? (
                        <button
                          onClick={() => handleNextStep(choice.nextStepId)}
                          className="w-full text-left bg-slate-50 border border-slate-100 hover:border-indigo-300 hover:bg-slate-50/50 p-5 rounded-2xl flex items-center justify-between gap-4 transition-all hover:translate-x-1 group shadow-[0_1px_3px_rgba(0,0,0,0.02)] cursor-pointer"
                        >
                          <div className="space-y-1 flex-1">
                            <p className="text-sm font-bold text-slate-800">
                              {choice.label}
                            </p>
                            {choice.desc && (
                              <p className="text-xs text-slate-500 leading-normal">
                                {choice.desc}
                              </p>
                            )}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-white border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-200 flex items-center justify-center shrink-0 transition-colors">
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                          </div>
                        </button>
                      ) : (
                        rec && (
                          <div className="bg-gradient-to-tr from-indigo-50/70 via-indigo-50/30 to-blue-50/60 border border-indigo-100 rounded-2xl p-6 md:p-8 space-y-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/40 pb-4">
                              <span className="px-3 py-1 bg-white border border-indigo-200/50 text-indigo-700 font-extrabold text-[9px] uppercase tracking-widest rounded-full shadow-sm">
                                {rec.badge}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                                <Beaker className="w-3.5 h-3.5 text-indigo-500" />
                                Recommandé pour votre étude
                              </span>
                            </div>

                            <div className="space-y-3">
                              <h3 className="text-lg md:text-xl font-black text-slate-900 leading-tight">
                                {rec.name}
                              </h3>
                              <p className="text-slate-600 text-xs md:text-sm leading-relaxed">
                                {rec.desc}
                              </p>
                            </div>

                            {/* Alert context if app needs data */}
                            {!isReady && rec.analysisType !== 'results' ? (
                              <div className="mt-6 p-4.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed space-y-3">
                                <p className="font-semibold flex items-center gap-2">
                                  <span>⚠️</span> Données locales requises
                                </p>
                                <p className="text-slate-600">
                                  Vous n'avez pas encore chargé de variables. Pour appliquer les méthodologies de l'analyse <strong>{rec.name}</strong> sur vos échantillons, veuillez importer votre classeur de relevés (.csv, .xlsx, .sav) depuis l'unité de stockage locale.
                                </p>
                                <button
                                  onClick={triggerImport}
                                  className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer text-center"
                                >
                                  Importer maintenant
                                </button>
                              </div>
                            ) : (
                              <div className="pt-4">
                                <button
                                  onClick={() => {
                                    if (rec.testId) {
                                      if (rec.analysisType === 'regs') {
                                        useWorkspaceStore.setState({ suggestedRegressionType: rec.testId });
                                      } else if (rec.analysisType === 'stat_tests' || rec.analysisType === 'stat_tests_param' || rec.analysisType === 'stat_tests_nonparam') {
                                        useWorkspaceStore.setState({ suggestedTestId: rec.testId });
                                      }
                                    }
                                    if (rec.analysisType === 'results') {
                                      openMira('');
                                    }
                                    setActiveDashboardTab(rec.analysisType as any);
                                    toast.success(`Redirection vers ${rec.name}`);
                                  }}
                                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 active:scale-98 transition duration-300 cursor-pointer"
                                >
                                  {rec.analysisType === 'results' ? "Ouvrir Mira maintenant" : "Accéder à l'interface d'analyse"}
                                  <ChevronRight className="w-4.5 h-4.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
