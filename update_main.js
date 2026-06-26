import fs from 'fs';

let text = fs.readFileSync('main.py', 'utf8');

const switchCode = `
    def save_current_dataset(self):
        if self.current_dataset_id is not None:
            self.datasets[self.current_dataset_id] = {
                "base_df": self.base_df.copy() if self.base_df is not None else None,
                "current_df": self.current_df.copy() if self.current_df is not None else None,
                "history": list(self.history),
                "file_path": self.current_file_path
            }

    def switch_dataset(self, dataset_id):
        self.save_current_dataset()
        if dataset_id in self.datasets:
            ds = self.datasets[dataset_id]
            self.base_df = ds["base_df"].copy() if ds["base_df"] is not None else None
            self.current_df = ds["current_df"].copy() if ds["current_df"] is not None else None
            self.history = list(ds["history"])
            self.current_file_path = ds["file_path"]
            self.current_dataset_id = dataset_id
            
            preview_df = self.current_df.head(100).replace({float('nan'): None}) if self.current_df is not None else None
            preview_data = __import__("json").loads(preview_df.to_json(orient="records", date_format="iso")) if preview_df is not None else []
            return {
                "success": True,
                "dataset_id": dataset_id,
                "row_count": len(self.current_df) if self.current_df is not None else 0,
                "col_count": len(self.current_df.columns) if self.current_df is not None else 0,
                "columns": self.get_columns_metadata() if self.current_df is not None else [],
                "preview": preview_data
            }
        return {"success": False, "error": "Dataset non trouvé"}
        
    def generate_random_dataset(self, params):
        try:
            import pandas as pd
            import numpy as np
            import uuid
            
            num_rows = int(params.get("num_rows", 100))
            df_dict = {}
            
            for var in params.get("variables", []):
                v_name = var["name"]
                v_type = var["type"]
                
                if v_type == "qualitative":
                    modalities = [m.strip() for m in var.get("modalities", "").split(",") if m.strip()]
                    if not modalities: modalities = ["A", "B", "C"]
                    df_dict[v_name] = np.random.choice(modalities, size=num_rows)
                elif v_type == "quantitative_normal":
                    mean = float(var.get("mean", 0))
                    std = float(var.get("std", 1))
                    df_dict[v_name] = np.random.normal(loc=mean, scale=std, size=num_rows)
                elif v_type == "quantitative_uniform":
                    min_val = float(var.get("min", 0))
                    max_val = float(var.get("max", 100))
                    df_dict[v_name] = np.random.uniform(low=min_val, high=max_val, size=num_rows)
            
            self.save_current_dataset()
            self.current_df = pd.DataFrame(df_dict)
            self.base_df = self.current_df.copy()
            self.history = []
            self.current_file_path = "dataset_aleatoire.csv"
            
            new_id = str(uuid.uuid4())
            self.current_dataset_id = new_id
            self.save_current_dataset()
            
            preview_df = self.current_df.head(100).replace({np.nan: None})
            import json
            preview_data = json.loads(preview_df.to_json(orient="records", date_format="iso"))
            
            return {
                "success": True,
                "dataset_id": new_id,
                "name": "Jeu de données simulé",
                "row_count": len(self.current_df),
                "col_count": len(self.current_df.columns),
                "columns": self.get_columns_metadata(),
                "preview": preview_data
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

`;

text = text.replace("    def load_dataset(self, file_path, sheet_name=None):", switchCode + "\n    def load_dataset(self, file_path, sheet_name=None):");

const loadDatasetEnd = `            preview_data = json.loads(preview_df.to_json(orient="records", date_format="iso"))

            # Save the loaded dataset
            import uuid
            self.save_current_dataset() # save previous
            new_id = str(uuid.uuid4())
            self.current_dataset_id = new_id
            self.save_current_dataset()

            return {
                "success": True,
                "dataset_id": new_id,
                "row_count": len(df),`;

text = text.replace(`            preview_data = json.loads(preview_df.to_json(orient="records", date_format="iso"))

            return {
                "success": True,
                "row_count": len(df),`, loadDatasetEnd);

fs.writeFileSync('main.py', text);
console.log("Done");
