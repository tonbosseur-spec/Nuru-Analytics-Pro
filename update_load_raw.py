import re

with open('main.py', 'r', encoding='utf-8') as f:
    text = f.read()

raw_code = """
    def load_raw_data(self, file_path, sheet_name=None):
        try:
            import pandas as pd
            if file_path.lower().endswith('.csv'):
                df = pd.read_csv(file_path, header=None)
            elif file_path.lower().endswith('.sav'):
                import pyreadstat
                df, meta = pyreadstat.read_sav(file_path)
                # Usually SAV is not crosstab, but we can return it as raw if someone really wants
            else:
                df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
            
            df = df.fillna("")
            return {"success": True, "data": df.values.tolist()}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def load_dataset(self"""

text = text.replace("    def load_dataset(self", raw_code)

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(text)
