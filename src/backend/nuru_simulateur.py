import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from typing import List, Dict, Any, Union

class NuruStatsSimulator:
    """
    Simulateur Statistique Universel pour Nuru Analytics
    Cette classe gère le pipeline générique de modification des données en 'real-time' 
    pour les tests statistiques. 
    """
    
    def __init__(self, original_df: pd.DataFrame):
        self.original_df = original_df.copy()
        self.simulated_df = original_df.copy()
        
    def reset_simulation(self):
        """Réinitialise les données à leur état d'origine."""
        self.simulated_df = self.original_df.copy()
        
    def generate_sliders(self, test_type: str, variables: List[str]) -> List[Dict[str, Any]]:
        """
        Définit dynamiquement l'interface de contrôle à générer côté frontend.
        """
        sliders = []
        
        if test_type in ['pearson', 'spearman', 'regression']:
            sliders.append({
                'id': 'variance_multiplier',
                'label': 'Bruit / Dispersion',
                'min': 0.1,
                'max': 5.0,
                'default': 1.0,
                'step': 0.1
            })
            sliders.append({
                'id': 'effect_slope',
                'label': 'Pente / Effet',
                'min': -5.0,
                'max': 5.0,
                'default': 1.0,
                'step': 0.1
            })
            
        elif test_type in ['anova', 'ttest_ind']:
            # Assume variables[1] is the grouping variable
            group_col = variables[1]
            groups = self.original_df[group_col].dropna().unique()
            for g in groups:
                sliders.append({
                    'id': f'group_mean_{g}',
                    'label': f'Moyenne : Groupe {g}',
                    'min': -50.0,
                    'max': 50.0,
                    'default': 0.0,
                    'step': 0.5
                })
                
        return sliders

    def update_simulation(self, test_type: str, variables: List[str], slider_values: Dict[str, float]) -> Dict[str, Any]:
        """
        Boucle de Rafraîchissement Synchrone.
        1. Met à jour le simulated_df
        2. Ré-exécute le test
        3. Retourne les données pour les graphiques et les métriques
        """
        self.reset_simulation()
        
        # --- ETAPE 1 : Appliquer les transformations ---
        if test_type in ['pearson', 'spearman', 'regression']:
            col_x, col_y = variables[0], variables[1]
            slope = slider_values.get('effect_slope', 1.0)
            variance = slider_values.get('variance_multiplier', 1.0)
            
            # Simple simulation linéaire : on reconstruit Y 
            # Y_sim = moyenne(Y) + pente * (X - moyenne(X)) + Bruit
            x_vals = self.simulated_df[col_x]
            noise = np.random.normal(0, np.std(x_vals) * variance, len(self.simulated_df))
            
            self.simulated_df[col_y] = np.mean(self.original_df[col_y]) + slope * (x_vals - np.mean(x_vals)) + noise
            
        elif test_type in ['anova', 'ttest_ind']:
            col_val, col_group = variables[0], variables[1]
            for key, val in slider_values.items():
                if key.startswith('group_mean_'):
                    g_name = key.replace('group_mean_', '')
                    # Ajoute ou soustrait à la moyenne du groupe
                    mask = self.simulated_df[col_group] == g_name
                    self.simulated_df.loc[mask, col_val] += val

        # --- ETAPE 2 : Ré-exécuter le test ---
        results = self._run_test(test_type, variables)
        
        # --- ETAPE 3 : Renvoyer l'état graphique et stat ---
        return {
            'p_value': results['p_value'],
            'statistic': results['statistic'],
            'stat_name': results['stat_name'],
            'is_significant': results['p_value'] < 0.05,
            'simulated_data': self.simulated_df[variables].to_dict('records') # Facile à parser pour plot.ly
        }
        
    def _run_test(self, test_type: str, variables: List[str]) -> Dict[str, Any]:
        """Exécution rapide via scipy.stats pour tous les tests de Nuru Analytics"""
        p_val, stat, stat_name = 1.0, 0.0, "Stat"
        
        try:
            # Nettoyage rapide NaNs
            clean_df = self.simulated_df[variables].dropna()
            if len(clean_df) == 0:
                return {'p_value': 1.0, 'statistic': 0.0, 'stat_name': "Données vides / NaNs"}
                
            if test_type == 'pearson':
                stat, p_val = stats.pearsonr(clean_df[variables[0]], clean_df[variables[1]])
                stat_name = "Coefficient r de Pearson"
                
            elif test_type == 'spearman':
                stat, p_val = stats.spearmanr(clean_df[variables[0]], clean_df[variables[1]])
                stat_name = "Coefficient rho de Spearman"
                
            elif test_type == 'kendall':
                stat, p_val = stats.kendalltau(clean_df[variables[0]], clean_df[variables[1]])
                stat_name = "Tau-b de Kendall"
                
            elif test_type == 'ttest_ind':
                groups = clean_df[variables[1]].unique()
                if len(groups) >= 2:
                    g1 = clean_df[clean_df[variables[1]] == groups[0]][variables[0]]
                    g2 = clean_df[clean_df[variables[1]] == groups[1]][variables[0]]
                    stat, p_val = stats.ttest_ind(g1, g2)
                stat_name = "Test t indépendant"
                
            elif test_type == 'welch':
                groups = clean_df[variables[1]].unique()
                if len(groups) >= 2:
                    g1 = clean_df[clean_df[variables[1]] == groups[0]][variables[0]]
                    g2 = clean_df[clean_df[variables[1]] == groups[1]][variables[0]]
                    stat, p_val = stats.ttest_ind(g1, g2, equal_var=False)
                stat_name = "Test t de Welch"
                
            elif test_type == 'mannwhitney':
                groups = clean_df[variables[1]].unique()
                if len(groups) >= 2:
                    g1 = clean_df[clean_df[variables[1]] == groups[0]][variables[0]]
                    g2 = clean_df[clean_df[variables[1]] == groups[1]][variables[0]]
                    stat, p_val = stats.mannwhitneyu(g1, g2, alternative='two-sided')
                stat_name = "U de Mann-Whitney"
                
            elif test_type == 'anova':
                groups = [group[variables[0]].values for name, group in clean_df.groupby(variables[1])]
                if len(groups) >= 2:
                    stat, p_val = stats.f_oneway(*groups)
                stat_name = "F-value de Fisher"
                
            elif test_type == 'kruskal':
                groups = [group[variables[0]].values for name, group in clean_df.groupby(variables[1])]
                if len(groups) >= 2:
                    stat, p_val = stats.kruskal(*groups)
                stat_name = "H de Kruskal-Wallis"
                
            elif test_type == 'levene':
                groups = [group[variables[0]].values for name, group in clean_df.groupby(variables[1])]
                if len(groups) >= 2:
                    stat, p_val = stats.levene(*groups)
                stat_name = "W de Levene"
                
            elif test_type == 'shapiro':
                stat, p_val = stats.shapiro(clean_df[variables[0]])
                stat_name = "W de Shapiro-Wilk"
                
            elif test_type == 'dagostino':
                if len(clean_df) >= 8:
                    stat, p_val = stats.normaltest(clean_df[variables[0]])
                else:
                    stat, p_val = stats.shapiro(clean_df[variables[0]])
                stat_name = "Omnibus K²"
                
            elif test_type == 'jarque_bera':
                stat, p_val = stats.jarque_bera(clean_df[variables[0]])[:2]
                stat_name = "Jarque-Bera JB"
                
            elif test_type == 'kolmogorov':
                mean_val = clean_df[variables[0]].mean()
                std_val = clean_df[variables[0]].std()
                if std_val > 0:
                    stat, p_val = stats.kstest(clean_df[variables[0]], 'norm', args=(mean_val, std_val))
                stat_name = "D de Kolmogorov-Smirnov"
                
            elif test_type == 'ttest_1samp':
                stat, p_val = stats.ttest_1samp(clean_df[variables[0]], popmean=0.0)
                stat_name = "t-statistic"
                
            elif test_type == 'wilcoxon_1samp':
                stat, p_val = stats.wilcoxon(clean_df[variables[0]] - 0.0)
                stat_name = "W de Wilcoxon"
                
            elif test_type == 'ttest_paired':
                stat, p_val = stats.ttest_rel(clean_df[variables[0]], clean_df[variables[1]])
                stat_name = "Test t apparié"
                
            elif test_type == 'wilcoxon_paired':
                stat, p_val = stats.wilcoxon(clean_df[variables[0]], clean_df[variables[1]])
                stat_name = "W de Wilcoxon apparié"
                
            elif test_type == 'chi2':
                contingency = pd.crosstab(clean_df[variables[0]], clean_df[variables[1]])
                stat, p_val, _, _ = stats.chi2_contingency(contingency)
                stat_name = "Chi-Deux χ²"
                
            elif test_type == 'fisher':
                contingency = pd.crosstab(clean_df[variables[0]], clean_df[variables[1]])
                if contingency.shape == (2, 2):
                    stat, p_val = stats.fisher_exact(contingency)
                else:
                    stat, p_val, _, _ = stats.chi2_contingency(contingency)
                stat_name = "Rapport des cotes (Odds Ratio)" if contingency.shape == (2, 2) else "Chi-Deux (Fallback >2x2)"
                
            elif test_type == 'binomial':
                counts = clean_df[variables[0]].value_counts()
                if len(counts) > 0:
                    k = counts.iloc[0]
                    n = counts.sum()
                    try:
                        stat = k / n
                        p_val = stats.binom_test(k, n, p=0.5)
                    except AttributeError:
                        p_val = stats.binomtest(k, n, p=0.5).pvalue
                stat_name = "Proportion"
                
            elif test_type == 'chi2_1samp':
                counts = clean_df[variables[0]].value_counts()
                stat, p_val = stats.chisquare(counts)
                stat_name = "Chi-Deux χ² d'adéquation"
                
            elif test_type == 'cramer':
                contingency = pd.crosstab(clean_df[variables[0]], clean_df[variables[1]])
                chi2, p_val, _, _ = stats.chi2_contingency(contingency)
                n = contingency.sum().sum()
                min_dim = min(contingency.shape) - 1
                if n > 0 and min_dim > 0:
                    stat = np.sqrt(chi2 / (n * min_dim))
                else:
                    stat = 0.0
                stat_name = "V de Cramér"

        except Exception as e:
            stat, p_val, stat_name = 0.0, 1.0, f"Erreur de calcul: {str(e)[:30]}"

        return {'p_value': p_val, 'statistic': stat, 'stat_name': stat_name}

# Exemple d'usage :
# df = pd.DataFrame({'Age': [20, 25, 30, 40], 'Revenu': [2000, 2500, 3100, 4050]})
# sim = NuruStatsSimulator(df)
# sliders = sim.generate_sliders('pearson', ['Age', 'Revenu'])
# print(sim.update_simulation('pearson', ['Age', 'Revenu'], {'effect_slope': -0.5, 'variance_multiplier': 1.2}))
