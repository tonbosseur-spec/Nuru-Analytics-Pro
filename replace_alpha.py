import re

def modify_main():
    with open('main.py', 'r', encoding='utf-8') as f:
        code = f.read()

    # Insert alpha extraction at the beginning of the 3 functions
    code = code.replace(
        "def run_statistical_test(self, test_id, params):",
        "def run_statistical_test(self, test_id, params):\n        alpha = float(params.get('alpha', 0.05))"
    )
    code = code.replace(
        "def run_regression_analysis(self, params):",
        "def run_regression_analysis(self, params):\n        alpha = float(params.get('alpha', 0.05))"
    )
    code = code.replace(
        "def run_multivariate_analysis(self, method, params):",
        "def run_multivariate_analysis(self, method, params):\n        alpha = float(params.get('alpha', 0.05))"
    )

    # Now we need to replace specific conditions where 0.05 is hardcoded
    # Be careful not to replace it in unrelated places (e.g., plot configurations).
    # Typical patterns:
    # 1. p < 0.05
    # 2. p_val < 0.05
    # 3. p_value < 0.05
    # 4. lev_p >= 0.05
    # 5. sh1_p >= 0.05
    # 6. strings like '(p < 0.05)' -> '(p < {alpha})' if inside f-strings
    
    # Let's use regex to replace `< 0.05` with `< alpha` in code contexts (not strings)
    # Actually, simpler: just regex replace all `0.05` with `alpha` if preceded by operator like < > <= >= ==
    code = re.sub(r'([<>=!]+)\s*0\.05', r'\1 alpha', code)
    
    # For strings like 'p < 0.05', 'p ≥ 0.05', 'p >= 0.05'
    # we need to be careful. Since everything is in f-string context, let's replace `0.05` with `{alpha}`
    code = re.sub(r'\(p < 0\.05\)', r'(p < {alpha})', code)
    code = re.sub(r'\(p( \w+)? < 0\.05\)', r'(p < {alpha})', code)
    code = re.sub(r'\(p >= 0\.05\)', r'(p >= {alpha})', code)
    code = re.sub(r'\(p ≥ 0\.05\)', r'(p ≥ {alpha})', code)
    code = re.sub(r'\(p\s*≥\s*0\.05\)', r'(p ≥ {alpha})', code)
    code = re.sub(r'\(p\s*<\s*0\.05\)', r'(p < {alpha})', code)
    code = re.sub(r'\(p\s*>=\s*0\.05\)', r'(p >= {alpha})', code)

    # Re-apply any messed up f-strings if needed, or better, we can replace "0.05" inside strings too
    # Let's run it and let the tests confirm if it builds ok.

    with open('main.py', 'w', encoding='utf-8') as f:
        f.write(code)

if __name__ == '__main__':
    modify_main()

