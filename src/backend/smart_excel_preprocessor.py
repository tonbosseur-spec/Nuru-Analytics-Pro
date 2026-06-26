import os
import pandas as pd
import numpy as np
import re

class SmartExcelPreprocessor:
    def __init__(self, file_path=None, sheet_name=0, dataframe=None):
        self.file_path = file_path
        self.sheet_name = sheet_name
        self.raw_df = dataframe
        self.titles_metadata = []
        
        if self.raw_df is None and self.file_path is not None:
            self._load_raw()

    def _load_raw(self):
        """
        1. Chargement brut (sans en-têtes pré-supposés)
        """
        try:
            # On lit tout le fichier sans header
            self.raw_df = pd.read_excel(self.file_path, sheet_name=self.sheet_name, header=None)
        except Exception as e:
            # En cas de repli si CSV ou autre format
            try:
                self.raw_df = pd.read_csv(self.file_path, header=None)
            except Exception as e2:
                raise ValueError(f"Impossible de lire le fichier: {str(e2)}")

    def analyze_rows(self):
        """
        2. Analyse structurelle du fichier - Calcule les métriques par ligne
        """
        if self.raw_df is None or len(self.raw_df) == 0:
            return []
            
        analysis = []
        num_cols = len(self.raw_df.columns)
        
        for idx, row in self.raw_df.iterrows():
            vals = row.values
            non_null_vals = [v for v in vals if pd.notna(v) and str(v).strip() != ""]
            nb_valeurs_non_nulles = len(non_null_vals)
            
            # % de cellules non vides
            fill_ratio = nb_valeurs_non_nulles / num_cols if num_cols > 0 else 0
            
            # Types des cellules
            nb_numeric = 0
            nb_date = 0
            nb_short_text = 0
            nb_long_text = 0
            cell_lengths = []
            
            for v in non_null_vals:
                v_str = str(v).strip()
                cell_lengths.append(len(v_str))
                
                # Check numeric
                # Détection simple (gérant aussi virgule européenne)
                v_clean = v_str.replace(",", ".").replace(" ", "")
                if v_clean.replace(".", "", 1).isdigit() or (v_clean.startswith("-") and v_clean[1:].replace(".", "", 1).isdigit()):
                    nb_numeric += 1
                elif isinstance(v, (int, float)) and not pd.isna(v):
                    nb_numeric += 1
                elif isinstance(v, pd.Timestamp) or (re.match(r'^\d{2,4}[-/]\d{2}[-/]\d{2,4}', v_str)):
                    nb_date += 1
                else:
                    if len(v_str) > 30:
                        nb_long_text += 1
                    else:
                        nb_short_text += 1
            
            avg_length = np.mean(cell_lengths) if cell_lengths else 0
            max_length = np.max(cell_lengths) if cell_lengths else 0
            
            # cohérence_types
            # On cherche à voir si un type domine dans les valeurs remplies
            if nb_valeurs_non_nulles > 0:
                coherence_types = max(nb_numeric, nb_date, nb_short_text, nb_long_text) / nb_valeurs_non_nulles
            else:
                coherence_types = 0.0
                
            # pénalité_text_long
            # Pénalise sévèrement les lignes contenant des phrases explicatives (titres ou notes de bas de page)
            if nb_long_text > 0:
                penalite_text_long = 0.1 if nb_long_text > 1 else 0.3
            else:
                penalite_text_long = 1.0
                
            # Score de similitude de données (data_likeness_score)
            data_likeness_score = fill_ratio * coherence_types * penalite_text_long
            
            # Calcul d'un score d'en-tête potentiel (header_score)
            # Un header idéal a beaucoup de textes courts uniques et peu d'éléments numériques purs
            unique_ratio = len(set(str(x) for x in non_null_vals)) / nb_valeurs_non_nulles if nb_valeurs_non_nulles > 0 else 0
            text_ratio = (nb_short_text) / nb_valeurs_non_nulles if nb_valeurs_non_nulles > 0 else 0
            header_score = fill_ratio * unique_ratio * text_ratio * (1.0 - (nb_numeric / nb_valeurs_non_nulles if nb_valeurs_non_nulles > 0 else 0))
            
            analysis.append({
                "index": idx,
                "nb_non_null": nb_valeurs_non_nulles,
                "fill_ratio": fill_ratio,
                "avg_length": avg_length,
                "max_length": max_length,
                "coherence_types": coherence_types,
                "long_texts_count": nb_long_text,
                "numeric_ratio": nb_numeric / nb_valeurs_non_nulles if nb_valeurs_non_nulles > 0 else 0,
                "data_likeness_score": float(data_likeness_score),
                "header_score": float(header_score)
            })
            
        return analysis

    def detect_header_row(self, row_analysis):
        """
        3. Détection de la ligne d'en-tête réelle
        """
        best_header_idx = 0
        max_header_score = -1.0
        
        # On recherche principalement dans la première moitié du fichier pour le header principal
        search_range = row_analysis[:min(30, len(row_analysis))]
        if not search_range:
            return 0
            
        for row in search_range:
            # Conditions idéales : majorité de cellules non vides, texte court, haute unicité
            if row["header_score"] > max_header_score and row["nb_non_null"] >= 2:
                max_header_score = row["header_score"]
                best_header_idx = row["index"]
                
        # S'il n'y a aucun bon candidat, on prend la première ligne avec des données
        if max_header_score <= 0.05:
            for row in row_analysis:
                if row["nb_non_null"] >= 2:
                    return row["index"]
                    
        return best_header_idx

    def detect_data_start_row(self, row_analysis, header_row_index):
        """
        4. Détection du début des données après le header
        """
        # Généralement la ligne juste après le header, mais on saute les lignes vides ou notes
        for idx in range(header_row_index + 1, len(row_analysis)):
            row = row_analysis[idx]
            
            # On ignore les lignes vides
            if row["nb_non_null"] == 0:
                continue
                
            # On ignore les lignes de notes (souvent avec un texte long unique ou fill_ratio très bas)
            vals = self.raw_df.iloc[idx].values
            vals_str = " ".join([str(v).lower() for v in vals if pd.notna(v)])
            
            is_note = False
            for note_pattern in ["source", "note", "copyright", "total général", "remarque", "téléchargé"]:
                if note_pattern in vals_str:
                    is_note = True
                    break
                    
            if is_note or (row["fill_ratio"] < 0.15 and row["long_texts_count"] > 0):
                continue
                
            return idx
            
        return header_row_index + 1 if header_row_index + 1 < len(self.raw_df) else header_row_index

    def detect_blocks(self, row_analysis, data_start_row):
        """
        8. Détection multi-blocs ( IMPORTANT )
        Isoler les sous-tableaux séparés par des interruptions structurelles (lignes vides importantes, etc.)
        """
        blocks = []
        current_block_rows = []
        
        for idx in range(data_start_row, len(row_analysis)):
            row = row_analysis[idx]
            vals = self.raw_df.iloc[idx].values
            non_null_vals = [v for v in vals if pd.notna(v) and str(v).strip() != ""]
            
            # Une ligne d'interruption est soit totalement vide, soit contient une note de bas de page isolée
            is_empty = len(non_null_vals) == 0
            is_separator = False
            
            # Si on a un texte long qui semble être un titre de nouveau bloc
            if len(non_null_vals) == 1:
                val_str = str(non_null_vals[0]).lower()
                if len(val_str) > 15 or any(p in val_str for p in ["source", "note", "tableau", "chapitre", "section", "partie"]):
                    is_separator = True
                    
            if is_empty or is_separator:
                if current_block_rows:
                    blocks.append(current_block_rows)
                    current_block_rows = []
            else:
                current_block_rows.append(idx)
                
        if current_block_rows:
            blocks.append(current_block_rows)
            
        # Garder uniquement les blocs significatifs (ayant au moins 2 lignes de données)
        significant_blocks = [b for b in blocks if len(b) >= 2]
        
        if not significant_blocks:
            # Repli sur un seul bloc contenant tout le reste
            significant_blocks = [list(range(data_start_row, len(self.raw_df)))]
            
        return significant_blocks

    def extract_metadata_titles(self, header_row_index):
        """
        6. Gestion des titres multi-lignes haut de page
        Concatène les lignes au-dessus du header pour la documentation statistique
        """
        titles = []
        for idx in range(header_row_index):
            row_vals = self.raw_df.iloc[idx].values
            non_null = [str(v).strip() for v in row_vals if pd.notna(v) and str(v).strip() != ""]
            if non_null:
                # Jointure si la ligne est segmentée
                titles.append(" | ".join(non_null))
        return titles

    def clean_and_normalize_block(self, row_indices, header_row_index, exclude_cols=None):
        """
        5. Nettoyage du dataset & 7. Normalisation du DataFrame
        """
        if exclude_cols is None:
            exclude_cols = []
            
        # Extraire le sous-tableau brut du bloc
        block_raw_df = self.raw_df.iloc[row_indices].copy()
        
        # En-têtes de colonnes
        headers = []
        header_vals = self.raw_df.iloc[header_row_index].values
        
        for col_idx, col_val in enumerate(header_vals):
            if pd.isna(col_val) or str(col_val).strip() == "":
                # Si l'en-tête est vide, on génère un nom
                headers.append(f"colonne_{col_idx + 1}")
            else:
                # Standardisation des noms de colonnes : strip(), espaces -> _
                h_name = str(col_val).strip()
                h_name = re.sub(r'\s+', '_', h_name)
                # Optionnel : lowercase
                h_name = h_name.lower()
                # On évite les doublons d'en-tête
                base_name = h_name
                counter = 1
                while h_name in headers:
                    h_name = f"{base_name}_{counter}"
                    counter += 1
                headers.append(h_name)
                
        block_raw_df.columns = headers
        
        # Supprimer les colonnes à exclure
        cols_to_keep = [c for c in headers if c not in exclude_cols]
        block_raw_df = block_raw_df[cols_to_keep]
        
        # Nettoyage automatique des lignes : supprimer entièrement vides ou notes de fin
        cleaned_rows = []
        for idx, row in block_raw_df.iterrows():
            vals = row.values
            non_null = [v for v in vals if pd.notna(v) and str(v).strip() != ""]
            
            if len(non_null) == 0:
                continue # Ligne vide
                
            # On ignore les lignes contenant uniquement "source : " ou "note : " ou "total"
            joined_str = " ".join([str(v).lower() for v in non_null])
            if any(joined_str.startswith(pat) or joined_str == pat for pat in ["source", "note", "total général", "remarque"]):
                continue
                
            cleaned_rows.append(row)
            
        if not cleaned_rows:
            return pd.DataFrame(columns=cols_to_keep)
            
        df_clean = pd.DataFrame(cleaned_rows).reset_index(drop=True)
        
        # Supprimer les colonnes entièrement vides
        df_clean = df_clean.dropna(how='all', axis=1)
        
        # Supprimer les colonnes d'index inutiles de type Unnamed:
        unnamed_cols = [c for c in df_clean.columns if "unnamed" in str(c).lower() or "colonne_" in str(c).lower()]
        # On ne les supprime que si elles ne contiennent que des valeurs d'incrément ou vides
        for col in unnamed_cols:
            series = df_clean[col]
            # Si c'est un index régulier 1, 2, 3...
            non_null_s = series.dropna()
            if len(non_null_s) > 0:
                try:
                    num_vals = pd.to_numeric(non_null_s, errors='raise')
                    # Si c'est une suite séquentielle de 1 en 1
                    if len(num_vals) > 1 and np.all(np.diff(num_vals) == 1):
                        df_clean.drop(columns=[col], inplace=True)
                except:
                    pass
                    
        # Normalisation & typage des colonnes (int, float, datetime, string)
        for col in df_clean.columns:
            series = df_clean[col].copy()
            # Supprimer les blancs de début/fin pour les chaînes
            series_str = series.astype(str).str.strip()
            
            # Essai de conversion datetime
            # Les dates Excel peuvent se présenter sous forme d'entiers ou de chaînes de date standard
            try:
                # Si c'est une colonne de type date représentée par des floats style Excel (ex: 45290.0)
                if pd.api.types.is_numeric_dtype(series):
                    pass # Sera géré dans le bloc suivant si besoin, ou reste float
                else:
                    converted_dates = pd.to_datetime(series, errors='coerce')
                    if converted_dates.notna().sum() > len(series) * 0.75:
                        df_clean[col] = converted_dates
                        continue
            except:
                pass
                
            # Essai de conversion numérique
            try:
                # Gestion des virgules européennes
                if series.dtype == object:
                    clean_nums = series_str.str.replace(r'\s+', '', regex=True).str.replace(',', '.')
                else:
                    clean_nums = series
                numeric_converted = pd.to_numeric(clean_nums, errors='coerce')
                
                # S'il y a une grande majorité de nombres convertis, on adopte ce type
                if numeric_converted.notna().sum() > len(series) * 0.75:
                    # Est-ce que ce sont tous des entiers ?
                    non_null_nums = numeric_converted.dropna()
                    if np.all(non_null_nums % 1 == 0):
                        # On caste en Int64 pour supporter les NaN éventuels de pandas
                        df_clean[col] = numeric_converted.astype('Int64')
                    else:
                        df_clean[col] = numeric_converted.astype('float64')
                    continue
            except:
                pass
                
            # Fallback en string (NaN standard)
            df_clean[col] = df_clean[col].apply(lambda x: None if pd.isna(x) or str(x).strip().lower() in ["nan", "none", "null", "nat"] else str(x).strip())
            
        return df_clean

    def process(self, selected_block_idx=0, manual_header_row=None, exclude_cols=None):
        """
        9. Pipeline Final de retour
        """
        if self.raw_df is None or len(self.raw_df) == 0:
            return {
                "success": False,
                "error": "Le fichier Excel est vide ou non chargé correctement"
            }
            
        row_analysis = self.analyze_rows()
        
        # Détermination du header
        if manual_header_row is not None:
            header_row = int(manual_header_row)
        else:
            header_row = self.detect_header_row(row_analysis)
            
        data_start_row = self.detect_data_start_row(row_analysis, header_row)
        
        # Concaténer les titres du haut en metadata (Step 6)
        titles = self.extract_metadata_titles(header_row)
        
        # Détecter les blocs
        blocks_indices = self.detect_blocks(row_analysis, data_start_row)
        nb_detected_blocks = len(blocks_indices)
        
        # Bloc d'intérêt
        target_block_idx = min(selected_block_idx, nb_detected_blocks - 1) if nb_detected_blocks > 0 else 0
        selected_rows = blocks_indices[target_block_idx] if nb_detected_blocks > 0 else list(range(data_start_row, len(self.raw_df)))
        
        # Nettoyage et typage final (Step 5, 7)
        df_clean = self.clean_and_normalize_block(selected_rows, header_row, exclude_cols=exclude_cols)
        
        # Préparation de l'aperçu JSON compatible
        preview_df = df_clean.head(15).replace({np.nan: None})
        preview_data = preview_df.to_dict(orient="records")
        
        columns_meta = []
        for col in df_clean.columns:
            series = df_clean[col]
            # Type statistique de Nuru Analytics (nominal, continuous, discrete, datetime)
            if pd.api.types.is_datetime64_any_dtype(series):
                stat_type = "datetime"
            elif pd.api.types.is_integer_dtype(series) or str(series.dtype).startswith("Int"):
                stat_type = "discrete"
            elif pd.api.types.is_numeric_dtype(series):
                stat_type = "continuous"
            else:
                stat_type = "nominal"
                
            columns_meta.append({
                "name": col,
                "type": stat_type,
                "missing_values": int(series.isna().sum()),
                "raw_dtype": str(series.dtype)
            })
            
        formatted_blocks = []
        for idx, block in enumerate(blocks_indices):
            formatted_blocks.append({
                "index": idx,
                "name": f"Tableau / Bloc {idx + 1}",
                "nb_rows": len(block),
                "start_idx": block[0],
                "end_idx": block[-1]
            })
            
        return {
            "success": True,
            "detected_header_row": int(header_row),
            "data_start_row": int(data_start_row),
            "nb_rows_detected": len(df_clean),
            "nb_columns": len(df_clean.columns),
            "columns": columns_meta,
            "sample_data": preview_data,
            "titles": titles,
            "blocks": formatted_blocks,
            "selected_block": int(target_block_idx),
            "clean_dataframe": df_clean, # Retourne l'objet DataFrame pour intégration directe
            "metadata": {
                "header_row": int(header_row),
                "data_start_row": int(data_start_row),
                "nb_rows": len(df_clean),
                "nb_columns": len(df_clean.columns),
                "detected_blocks": nb_detected_blocks,
                "titles": titles
            }
        }


# ==========================================================
# 🧪 MODULES DE TESTS OBLIGATOIRES (Cas 1 à 5)
# ==========================================================
def run_preprocessor_tests():
    print("🧪 DÉBUT DES TESTS POUR LE SMART EXCEL PREPROCESSOR\n" + "="*50)
    
    # ----------------------------------------------------
    # Cas 1 : 3 lignes de titre, 1 ligne vide, tableau normal
    # ----------------------------------------------------
    print("\n🔹 Cas 1 : 3 lignes de titre, 1 ligne vide, tableau normal")
    c1_data = [
        ["Rapport de performance 2026", "", "", ""],
        ["Zone Ouest - Analyse Trimestrielle", "", "", ""],
        ["Confidentiel - Usage Interne", "", "", ""],
        ["", "", "", ""], # Ligne vide
        ["ID", "Nom Projet", "Budget", "Statut"], # Header
        [101, "Gestion de l'Eau", 54300, "En cours"],
        [102, "Solaire Toitures", 120500, "Terminé"],
        [103, "Réseau Local", 8500, "En cours"]
    ]
    df1 = pd.DataFrame(c1_data)
    preprocessor1 = SmartExcelPreprocessor(dataframe=df1)
    res1 = preprocessor1.process()
    
    print(f"✔️ Header détecté : {res1['detected_header_row']} (Attendu: 4)")
    print(f"✔️ Début données détecté : {res1['data_start_row']} (Attendu: 5)")
    print(f"✔️ Titres haut de page : {res1['titles']}")
    print(f"✔️ Colonnes : {[c['name'] for c in res1['columns']]}")
    print(f"✔️ Données normalisées : {res1['sample_data']}")
    assert res1['detected_header_row'] == 4
    
    # ----------------------------------------------------
    # Cas 2 : colonnes fusionnées, header mal aligné
    # ----------------------------------------------------
    print("\n🔹 Cas 2 : colonnes fusionnées, en-têtes asymétriques")
    c2_data = [
        ["Statistiques Agrégées", "", "", ""],
        ["Code", "Nom", "Région", ""], # Header mal aligné ou fusionné
        [1, "Alpha", "Nord", "Valeur indicative"],
        [2, "Bêta", "Sud", "Valeur alternative"]
    ]
    df2 = pd.DataFrame(c2_data)
    preprocessor2 = SmartExcelPreprocessor(dataframe=df2)
    res2 = preprocessor2.process()
    print(f"✔️ Header détecté : {res2['detected_header_row']} (Attendu: 1)")
    print(f"✔️ Colonnes : {[c['name'] for c in res2['columns']]}")
    assert res2['detected_header_row'] == 1

    # ----------------------------------------------------
    # Cas 3 : plusieurs tableaux dans une même feuille (multi-blocs)
    # ----------------------------------------------------
    print("\n🔹 Cas 3 : plusieurs tableaux dans une feuille")
    c3_data = [
        ["Tableau A - Ventes", "", ""],
        ["Mois", "Ventes_EUR", ""],
        ["Janvier", 12000, ""],
        ["Février", 15400, ""],
        ["", "", ""], # Interruption
        ["", "", ""], # Interruption
        ["Tableau B - Dépenses", "", ""],
        ["Catégorie", "Coût_EUR", ""],
        ["Marketing", 4300, ""],
        ["R&D", 8200, ""]
    ]
    df3 = pd.DataFrame(c3_data)
    preprocessor3 = SmartExcelPreprocessor(dataframe=df3)
    res3 = preprocessor3.process(selected_block_idx=0)
    print(f"✔️ Nombre de blocs isolés : {len(res3['blocks'])} (Attendu: 2)")
    print(f"✔️ Données du premier bloc : {res3['sample_data']}")
    
    res3_b2 = preprocessor3.process(selected_block_idx=1)
    print(f"✔️ Données du second bloc : {res3_b2['sample_data']}")
    assert len(res3['blocks']) >= 2

    # ----------------------------------------------------
    # Cas 4 : notes dispersées dans les lignes
    # ----------------------------------------------------
    print("\n🔹 Cas 4 : notes et métadonnées dispersées")
    c4_data = [
        ["Identifiant", "Mesure", "Unité"], # Header
        [501, 14.5, "mg/L"],
        ["* Note : Mesure prise sous haute température", "", ""], # Note parasite
        [502, 12.8, "mg/L"],
        ["Source : Laboratoire National", "", ""], # Note parasite
        [503, 16.1, "mg/L"]
    ]
    df4 = pd.DataFrame(c4_data)
    preprocessor4 = SmartExcelPreprocessor(dataframe=df4)
    res4 = preprocessor4.process()
    print(f"✔️ Lignes détectées sans les notes : {res4['nb_rows_detected']} (Attendu: 3)")
    print(f"✔️ Données propres sans notes : {res4['sample_data']}")
    assert res4['nb_rows_detected'] == 3

    # ----------------------------------------------------
    # Cas 5 : fichier parfaitement propre (baseline)
    # ----------------------------------------------------
    print("\n🔹 Cas 5 : Fichier parfaitement propre (baseline)")
    c5_data = [
        ["Id", "Age", "Groupe"],
        [1, 23, "Control"],
        [2, 34, "Treatment"],
        [3, 29, "Control"]
    ]
    df5 = pd.DataFrame(c5_data)
    preprocessor5 = SmartExcelPreprocessor(dataframe=df5)
    res5 = preprocessor5.process()
    print(f"✔️ Header détecté : {res5['detected_header_row']} (Attendu: 0)")
    print(f"✔️ Début données détecté : {res5['data_start_row']} (Attendu: 1)")
    print(f"✔️ Colonnes : {[c['name'] for c in res5['columns']]}")
    assert res5['detected_header_row'] == 0

    print("\n" + "="*50 + "\n🎉 TOUS LES CAS DE TEST ONT RÉUSSI AVEC SUCCÈS !")


if __name__ == "__main__":
    run_preprocessor_tests()
