import * as fs from 'fs';

// Read the WelcomeScreen.tsx and rewrite the DECISION_TREE.
// The new decision tree will correctly map out paths to ALL stat tests, regressions, and multivariates.

// I'll provide a huge string for the new DECISION_TREE and then replace it.

const newTreeStr = `const DECISION_TREE: Record<string, DecisionStep> = {
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
};`;

let code = fs.readFileSync('src/components/WelcomeScreen.tsx', 'utf8');
const regex = /const DECISION_TREE: Record<string, DecisionStep> = \{[\s\S]*?\n\};\n/m;
code = code.replace(regex, newTreeStr + '\n');
fs.writeFileSync('src/components/WelcomeScreen.tsx', code, 'utf8');
console.log('Replaced tree');
