import numpy as np
import scipy.stats as stats
import pandas as pd
import json

class InteractiveLabEngine:
    def __init__(self):
        pass

    def simulate_descriptive(self, mean, std_dev, n_samples=1000):
        """
        Génère une distribution normale et calcule l'histogramme
        et la courbe densité (PDF) théorique.
        """
        try:
            # Génération des données
            data = np.random.normal(loc=mean, scale=std_dev, size=int(n_samples))
            
            # Calculs
            actual_mean = np.mean(data)
            actual_std = np.std(data)
            
            # Histogramme
            hist, bin_edges = np.histogram(data, bins=30, density=True)
            
            # Courbe de densité théorique (PDF)
            x_pdf = np.linspace(mean - 4*std_dev, mean + 4*std_dev, 100)
            y_pdf = stats.norm.pdf(x_pdf, mean, std_dev)
            
            return {
                "success": True,
                "metrics": {
                    "mean_theorical": float(mean),
                    "mean_actual": float(actual_mean),
                    "std_theorical": float(std_dev),
                    "std_actual": float(actual_std)
                },
                "plots": {
                    "hist_x": ((bin_edges[:-1] + bin_edges[1:]) / 2).tolist(),
                    "hist_y": hist.tolist(),
                    "pdf_x": x_pdf.tolist(),
                    "pdf_y": y_pdf.tolist()
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def simulate_hypothesis(self, sample_mean, sample_size, pop_mean=0, pop_std=1):
        """
        Test Z ou Test T à un échantillon.
        On simule l'ajustement de la moyenne de l'échantillon ou de la taille.
        """
        try:
            n = int(sample_size)
            
            # Standard error
            se = pop_std / np.sqrt(n)
            
            # t-statistic (ici on suppose Z ou t pour la simplicité, utilisons Z)
            z_stat = (sample_mean - pop_mean) / se
            
            # p-value bilatérale
            p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))
            
            # Intervalle de confiance à 95%
            margin = 1.96 * se
            ci_lower = sample_mean - margin
            ci_upper = sample_mean + margin
            
            # Courbe de la distribution nulle
            x_pdf = np.linspace(pop_mean - 4*se, pop_mean + 4*se, 100)
            y_pdf = stats.norm.pdf(x_pdf, pop_mean, se)
            
            return {
                "success": True,
                "metrics": {
                    "z_stat": float(z_stat),
                    "p_value": float(p_value),
                    "ci_lower": float(ci_lower),
                    "ci_upper": float(ci_upper)
                },
                "plots": {
                    "pdf_x": x_pdf.tolist(),
                    "pdf_y": y_pdf.tolist(),
                    "obs_mean": float(sample_mean),
                    "critical_lower": float(pop_mean - 1.96*se),
                    "critical_upper": float(pop_mean + 1.96*se)
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def simulate_regression(self, slope, noise, outlier_x, outlier_y, has_outlier=True):
        """
        Génère des données linéaires avec un bruit, et optionnellement un point aberrant.
        Utilise OLS de statsmodels/scipy pour calculer la régression.
        """
        try:
            np.random.seed(42) # Seed fixe pour que le nuage de points reste stable quand on bouge le point
            n = 50
            x = np.random.uniform(0, 10, n)
            # Y = ax + b + bruit
            y = slope * x + 5 + np.random.normal(0, noise, n)
            
            x_all = x.copy()
            y_all = y.copy()
            
            if has_outlier:
                x_all = np.append(x_all, outlier_x)
                y_all = np.append(y_all, outlier_y)
                
            # Calcul Régression sans outlier
            res_clean = stats.linregress(x, y)
            
            # Calcul Régression avec outlier (ou finale)
            res_all = stats.linregress(x_all, y_all)
            
            # Droites
            x_line = np.array([0, 10])
            y_clean = res_clean.intercept + res_clean.slope * x_line
            y_all_line = res_all.intercept + res_all.slope * x_line
            
            return {
                "success": True,
                "metrics": {
                    "r_squared_clean": float(res_clean.rvalue**2),
                    "r_squared_all": float(res_all.rvalue**2),
                    "slope_all": float(res_all.slope),
                    "intercept_all": float(res_all.intercept),
                    "slope_clean": float(res_clean.slope),
                    "intercept_clean": float(res_clean.intercept),
                    "p_value_all": float(res_all.pvalue)
                },
                "plots": {
                    "scatter_x": x.tolist(),
                    "scatter_y": y.tolist(),
                    "line_x": x_line.tolist(),
                    "line_y_clean": y_clean.tolist(),
                    "line_y_all": y_all_line.tolist()
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
