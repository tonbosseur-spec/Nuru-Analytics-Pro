import * as fs from 'fs';

let pyCode = fs.readFileSync('main.py', 'utf8');

// 1. Insert `alpha = float(params.get('alpha', 0.05))`
pyCode = pyCode.replace(
  'def run_statistical_test(self, test_id, params):',
  "def run_statistical_test(self, test_id, params):\n        alpha = float(params.get('alpha', 0.05))"
);
pyCode = pyCode.replace(
  'def run_regression_analysis(self, params):',
  "def run_regression_analysis(self, params):\n        alpha = float(params.get('alpha', 0.05))"
);
pyCode = pyCode.replace(
  'def run_multivariate_analysis(self, method, params):',
  "def run_multivariate_analysis(self, method, params):\n        alpha = float(params.get('alpha', 0.05))"
);

// 2. Replace hardcoded 0.05 with alpha (Only in if/elif/conditional expressions, meaning surrounded by < > === etc or inside f-strings)
// Because I don't want to break things, let's carefully replace `0.05` with `alpha` in code and `{alpha}` in strings.
// A simpler way: we'll match `0.05` and see the context.
const lines = pyCode.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Skip if it's not inside a function or we don't know (actually safe enough if we only target statistical / regression / multivariate analysis)
    // But since `main.py` is mostly those methods...
    if (line.includes('0.05')) {
        // We know it's something like `if p_val < 0.05:` or `f"... (p < 0.05)"` or `"Rejet de H0 (p < 0.05)"`
        
        // Let's replace code operators first: ` < 0.05`, ` > 0.05`, ` <= 0.05`, ` >= 0.05`, ` == 0.05` 
        // with ` < alpha` etc.
        line = line.replace(/ < 0\.05(?![\w])/g, ' < alpha');
        line = line.replace(/ <= 0\.05(?![\w])/g, ' <= alpha');
        line = line.replace(/ > 0\.05(?![\w])/g, ' > alpha');
        line = line.replace(/ >= 0\.05(?![\w])/g, ' >= alpha');
        line = line.replace(/ == 0\.05(?![\w])/g, ' == alpha');
        
        // Now handle strings: "p < 0.05", "p >= 0.05", "(p < 0.05)"
        // Since many strings are f-strings already or normal strings, we can convert normal strings to f-strings
        // For instance `"Rejet de H0 (p < 0.05)"` -> `f"Rejet de H0 (p < {alpha})"`
        if (line.includes('"Rejet de H0 (p < 0.05)"')) {
            line = line.replace(/"Rejet de H0 \(p < 0\.05\)"/g, 'f"Rejet de H0 (p < {alpha})"');
        }
        if (line.includes('"Non-rejet de H0 (Variances comparables) (p > 0.05)"')) {
             line = line.replace(/"Non-rejet de H0 \(Variances comparables\) \(p > 0\.05\)"/g, 'f"Non-rejet de H0 (Variances comparables) (p > {alpha})"');
        }
        
        // For f-strings that contain `0.05`, eg `f"significatif (p < 0.05)"` we just replace `0.05` with `{alpha}`
        // Wait, if we already replaced `< 0.05` with `< alpha` in the line, the f-string got `< alpha`.
        // So `f"significatif (p < alpha)"` must become `f"significatif (p < {alpha})"`
        line = line.replace(/p < alpha/g, 'p < {alpha}');
        line = line.replace(/p > alpha/g, 'p > {alpha}');
        line = line.replace(/p <= alpha/g, 'p <= {alpha}');
        line = line.replace(/p >= alpha/g, 'p >= {alpha}');
        line = line.replace(/p ≥ alpha/g, 'p ≥ {alpha}');
        line = line.replace(/p=0\.05/g, 'p={alpha}');
        
        // Check for any remaining `p < 0.05` etc in f-strings that didn't have space:
        line = line.replace(/p<0\.05/g, 'p<{alpha}');
        line = line.replace(/p>0\.05/g, 'p>{alpha}');
        
        // Sometimes the text might be `" (p < 0.05)"` and not an f-string! 
        // e.g. `res_dict["decision"] = "Rejet de H0 (p < 0.05)"` -> this was replaced above with `if` but wait...
        
        // A generic fix for string literals: if it has `{alpha}` but it's not an f-string, make it an f-string.
        if (line.includes('{alpha}') && !line.match(/f".*\{alpha\}.*"/)) {
            // Find `"....{alpha}...."`
            // This regex will find double quoted strings containing {alpha} and prepend 'f' if not there
            line = line.replace(/(?<!f)"([^"]*\{alpha\}[^"]*)"/g, 'f"$1"');
            line = line.replace(/(?<!f)'([^']*\{alpha\}[^']*)'/g, "f'$1'");
        }
        
        lines[i] = line;
    }
}

fs.writeFileSync('main.py', lines.join('\n'), 'utf8');
console.log('Done!');
