import os

file_path = "main.py"
with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

anova_2way_code = """
            elif test_id == 'anova_2way':
                import statsmodels.api as sm
                from statsmodels.formula.api import ols
                
                factor1 = params.get('col_x') # First qualitative factor
                dep_var = params.get('col_y') # Quantitative dependent variable
                factor2 = params.get('covariate') # Second qualitative factor (passed via covariate)
                
                if not factor1 or not factor2 or not dep_var:
                    return {"success": False, "error": "L'ANOVA à 2 facteurs nécessite une variable dépendante et deux variables explicatives (facteurs)."}
                
                clean_df = df[[dep_var, factor1, factor2]].dropna()
                if clean_df.empty:
                    return {"success": False, "error": "Aucune donnée complète disponible après suppression des valeurs manquantes."}
                    
                # Fix variable names for formula in case they contain spaces
                f_dep_var = dep_var.replace(" ", "_")
                f_factor1 = factor1.replace(" ", "_")
                f_factor2 = factor2.replace(" ", "_")
                
                clean_df_renamed = clean_df.rename(columns={dep_var: f_dep_var, factor1: f_factor1, factor2: f_factor2})
                
                # Formula with interaction
                formula = f"{f_dep_var} ~ C({f_factor1}) + C({f_factor2}) + C({f_factor1}):C({f_factor2})"
                try:
                    model = ols(formula, data=clean_df_renamed).fit()
                    anova_table = sm.stats.anova_lm(model, typ=2)
                except Exception as e:
                    return {"success": False, "error": f"Erreur lors de la modélisation ANOVA : {str(e)}"}
                
                # Fetching interaction P-value
                interaction_term = f"C({f_factor1}):C({f_factor2})"
                p_val_int = 1.0
                if interaction_term in anova_table.index:
                    p_val_int = anova_table.loc[interaction_term, 'PR(>F)']
                    stat_val = anova_table.loc[interaction_term, 'F']
                else: 
                     stat_val = 0.0
                     
                p_val = float(p_val_int)
                
                res_dict["n"] = len(clean_df)
                res_dict["df"] = anova_table.loc[interaction_term, 'df'] if interaction_term in anova_table.index else 1
                res_dict["h0"] = f"Aucune interaction entre '{factor1}' et '{factor2}'."
                res_dict["h1"] = f"Il existe une interaction significative entre les deux facteurs."
                res_dict["decision"] = "Rejet de H0" if p_val < alpha else "Non-rejet de H0"
                
                extra = {}
                for idx in anova_table.index:
                    if idx != "Residual":
                        clean_idx = idx.replace(f"C({f_factor1})", factor1).replace(f"C({f_factor2})", factor2)
                        extra[f"P-value {clean_idx}"] = f"{anova_table.loc[idx, 'PR(>F)']:.4e}"
                res_dict["extra_info"] = extra
                res_dict["assumptions"] = [{"name": "Normalité et homogénéité des variances requises", "status": "info", "details": "Vérifiez les résidus."}]
                interpretation = ""
                try:
                    fig = px.box(clean_df, x=factor1, y=dep_var, color=factor2, title=f"ANOVA 2 Facteurs: {dep_var} par {factor1} & {factor2}")
                except Exception:
                    fig = None
"""

override_interpretation_code = """
            # --- OVERRIDE INTERPRETATION WITH EXTREMELY ACCESSIBLE TEXT ---
            test_names = {
                'shapiro': 'Shapiro-Wilk (Normalité)', 'kolmogorov': 'Kolmogorov-Smirnov (Normalité)', 'dagostino': "D'Agostino-Pearson (Normalité)",
                'jarque_bera': 'Jarque-Bera (Normalité)', 'ttest_1samp': 'Test t (1 échantillon)', 'wilcoxon_1samp': 'Test de Wilcoxon (1 échantillon)',
                'binomial': 'Test Binomial', 'chi2_1samp': "Test d'adéquation du Chi-Deux", 'pearson': 'Corrélation de Pearson',
                'spearman': 'Corrélation de Spearman', 'kendall': 'Corrélation de Kendall', 'ttest_ind': 'Test t de Student',
                'welch': 'Test t de Welch', 'mannwhitney': 'Test de Mann-Whitney (U)', 'anova': 'ANOVA à 1 facteur',
                'kruskal': 'Kruskal-Wallis', 'levene': 'Test de Levene', 'ttest_paired': 'Test t Apparié',
                'wilcoxon_paired': 'Test de Wilcoxon Apparié', 'chi2': "Chi-Deux d'indépendance", 'fisher': 'Test exact de Fisher',
                'mcnemar': 'Test de McNemar', 'cramer': 'V de Cramér', 'anova_rm': 'ANOVA mesures répétées',
                'anova_mixed': 'ANOVA Mixte', 'friedman': 'Test de Friedman', 'ancova': 'ANCOVA', 'ancova_rank': 'ANCOVA sur Rangs',
                'manova': 'MANOVA', 'permanova': 'PERMANOVA', 'mancova': 'MANCOVA', 'permancova': 'PERMANCOVA', 'anova_2way': 'ANOVA à 2 facteurs'
            }
            
            t_name = test_names.get(test_id, test_id)
            is_sig = p_val < alpha
            p_str = f"p = {p_val:.4g}" if float(p_val) >= 0.0001 else "p < 0.0001"
            
            acc_interp = f"Analyse réalisée avec {t_name}. \\n"
            
            if test_id in ['shapiro', 'kolmogorov', 'dagostino', 'jarque_bera']:
                if is_sig:
                    acc_interp += f"✅ Résultat: Les données de la variable '{col_x}' NE SUIVENT PAS une distribution normale classique (courbe en cloche) ({p_str}). Elles s'écartent fortement du modèle parfait. 💡 Conseil: Il est recommandé d'utiliser des tests dits 'non-paramétriques' pour la suite."
                else:
                    acc_interp += f"✅ Résultat: Les données de la variable '{col_x}' SUIVENT une distribution normale ({p_str}). Elles épousent bien la forme classique en cloche. 💡 Conseil: Vous pouvez appliquer les tests statistiques standards ('paramétriques') sans problème."
                    
            elif test_id in ['ttest_ind', 'welch', 'mannwhitney']:
                g1_txt = f"'{g1}'" if g1 else "le 1er groupe"
                g2_txt = f"'{g2}'" if g2 else "le 2nd groupe"
                if is_sig:
                    acc_interp += f"✅ Résultat: On constate une VRAIE DIFFÉRENCE entre {g1_txt} et {g2_txt} concernant '{col_x}' ({p_str}). Cette différence est marquée et ne relève pas de la pure coïncidence ou du hasard !"
                else:
                    acc_interp += f"✅ Résultat: Il n'y a PAS de différence flagrante entre {g1_txt} et {g2_txt} pour '{col_x}' ({p_str}). Les écarts constatés sont si petits qu'ils sont probablement dus au hasard du recueil des données."
                    
            elif test_id in ['pearson', 'spearman', 'kendall']:
                if is_sig:
                    acc_interp += f"✅ Résultat: Il existe un LIEN PROUVÉ entre '{col_x}' et '{col_y}' ({p_str}). Concrètement, l'évolution de l'une de ces variables est bien associée à celle de l'autre (quand l'une monte, l'autre réagit)."
                else:
                    acc_interp += f"✅ Résultat: On ne détecte AUCUN LIEN particulier entre '{col_x}' et '{col_y}' ({p_str}). Elles évoluent indépendamment l'une de l'autre."
                    
            elif test_id in ['anova', 'kruskal']:
                if is_sig:
                    acc_interp += f"✅ Résultat: Au moins l'une de vos catégories se DÉMARQUE véritablement des autres sur '{col_x}' ({p_str}). Les moyennes ou médianes ne sont pas les mêmes partout. Pensez à regarder les détails ou un test post-hoc pour voir exactement qui diffère de qui !"
                else:
                    acc_interp += f"✅ Résultat: Les moyennes de '{col_x}' se valent GLOBABLEMENT d'une catégorie à l'autre ({p_str}). Aucune différence nette ne vient distinguer une catégorie d'une autre."
                    
            elif test_id in ['levene']:
                if is_sig:
                    acc_interp += f"✅ Résultat: Attention, l'étendue ou la variabilité des données de '{col_x}' DIFFÈRE entre les groupes ({p_str}). Les points sont beaucoup plus resserrés (ou écartés) d'un groupe à un autre. (Hypothèse d'homogénéité non respectée)."
                else:
                    acc_interp += f"✅ Résultat: Super ! L'étendue des données (la variabilité) de '{col_x}' est très SIMILAIRE pour tous les groupes ({p_str}). C'est une excellente nouvelle pour vos futures analyses mathématiques."
                    
            elif test_id in ['chi2', 'fisher', 'mcnemar']:
                if is_sig:
                    acc_interp += f"✅ Résultat: Il y a une véritable DÉPENDANCE statistique entre '{col_x}' et '{col_y}' ({p_str}). Cela veut dire que la valeur prise sur l'une influence fortement la répartition de l'autre !"
                else:
                    acc_interp += f"✅ Résultat: '{col_x}' et '{col_y}' sont totalement INDÉPENDANTES selon les données ({p_str}). Aucune association n'a pu être prouvée."
                    
            elif test_id == 'anova_2way':
                if is_sig:
                     acc_interp += f"✅ Résultat: L'INTERACTION entre les deux facteurs croisés est significative concernant '{dep_var}' ({p_str}). Traduction : l'impact d'un facteur dépend fortement de la situation du second facteur ! Ils combinent ensemble leurs effets de manière spéciale."
                else:
                     acc_interp += f"✅ Résultat: Les deux facteurs agissent selon leurs propres règles sans créer d'interaction notable combinée entre eux sur '{dep_var}' ({p_str}). Il n'y a pas d'effet boule de neige croisé significatif."
                     
            elif test_id in ['ttest_paired', 'wilcoxon_paired']:
                 if is_sig:
                      acc_interp += f"✅ Résultat: Les mesures ont SIGNIFICATIVEMENT ÉVOLUÉ / CHANGÉ entre '{col_x}' et '{col_y}' mesurées sur les mêmes individus ({p_str}). Il s'est bien passé quelque chose !"
                 else:
                      acc_interp += f"✅ Résultat: Les mesures sont restées très STABLES entre '{col_x}' et '{col_y}' ({p_str}). Aucun véritable changement flagrant n'a été remonté."
            else:
                if is_sig:
                    acc_interp += f"✅ Résultat: L'analyse révèle un effet ou une différence HORS DU COMMUN et tout à fait significative d'un point de vue statistique ({p_str})."
                else:
                    acc_interp += f"✅ Résultat: L'analyse n'a détecté aucune rupture ni différence notable. Ce qu'on observe rentre dans les marges acceptables du hasard ({p_str})."
            
            interpretation = acc_interp
"""

search_target_1 = "            else:\n                return {\"success\": False, \"error\": f\"Le test '{test_id}' n'est pas encore totalement supporté.\"}"

if search_target_1 in text:
    text = text.replace(search_target_1, anova_2way_code + "\n" + search_target_1)
else:
    print("WARNING: target 1 not found")

search_target_2 = """            # Final touch on figure
            if fig is not None:"""

if search_target_2 in text:
    text = text.replace(search_target_2, override_interpretation_code + "\n" + search_target_2)
else:
    print("WARNING: target 2 not found")
    
with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Patch applied.")
