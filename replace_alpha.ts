import * as fs from 'fs';

const file = fs.readFileSync('main.py', 'utf8');

// Insert alpha
let updated = file.replace(
  'def run_statistical_test(self, test_id, params):',
  "def run_statistical_test(self, test_id, params):\n        alpha = float(params.get('alpha', 0.05))"
);
updated = updated.replace(
  'def run_regression_analysis(self, params):',
  "def run_regression_analysis(self, params):\n        alpha = float(params.get('alpha', 0.05))"
);
updated = updated.replace(
  'def run_multivariate_analysis(self, method, params):',
  "def run_multivariate_analysis(self, method, params):\n        alpha = float(params.get('alpha', 0.05))"
);

// We need to carefully replace < 0.05, >= 0.05 etc.
// But we should also replace "0.05" when it's printed in f-strings like "p < 0.05"

const regexCode = /([<>=!]+)\s*0\.05/g;
updated = updated.replace(regexCode, '$1 alpha');

const stringFixes = [
    [/p < alpha/g, "p < {alpha}"],
    [/p >= alpha/g, "p >= {alpha}"],
    [/p ≥ alpha/g, "p ≥ {alpha}"],
    [/\(p < \{alpha\}\)/g, "(p < {alpha})"] // Dedup just in case
];

for (const [r, repl] of stringFixes) {
    // Actually, when we did `$1 alpha`, strings like `"Rejet de H0 (p < 0.05)"` became `"Rejet de H0 (p < alpha)"`.
    // Wait, python strings are f-strings. So `f"Rejet (p < alpha)"` doesn't evaluate `alpha`. It must be `f"Rejet (p < {alpha})"`!
    // But what if it's NOT an f-string? `"Rejet de H0 (p < alpha)"` 
    // In `main.py` those strings are all inside `res_dict["decision"] = "Rejet de H0 (p < 0.05)" if p_val < 0.05 else ...`
    // And also inside `interpretation = f"Le test ... (p < 0.05)" `
}

// Let's just fix the "decision" keys manually
updated = updated.replace(/"Rejet de H0 \(p < alpha\)"/g, 'f"Rejet de H0 (p < {alpha})"');
updated = updated.replace(/"Non-rejet de H0 \(p >= alpha\)"/g, 'f"Non-rejet de H0 (p >= {alpha})"');
updated = updated.replace(/'\(p < alpha\)'/g, 'f"(p < {alpha})"');
updated = updated.replace(/'\(p >= alpha\)'/g, 'f"(p >= {alpha})"');
updated = updated.replace(/'p < alpha'/g, 'f"p < {alpha}"');
updated = updated.replace(/'p >= alpha'/g, 'f"p >= {alpha}"');
updated = updated.replace(/p < alpha/g, "p < {alpha}"); 
updated = updated.replace(/p >= alpha/g, "p >= {alpha}");
updated = updated.replace(/p ≥ alpha/g, "p ≥ {alpha}");

// Wait, the previous lines would replace `if p_val < {alpha}:` which is invalid python.
// Let's be smart.

fs.writeFileSync('main_updated.py', updated, 'utf8');
