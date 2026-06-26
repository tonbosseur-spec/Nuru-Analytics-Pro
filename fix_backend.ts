import * as fs from 'fs';

let pyCode = fs.readFileSync('main.py', 'utf8');

// I can just replace `{alpha}` with `alpha` EXCEPT when it is inside an f-string
// To do this, I can simply revert all of them, and carefully re-apply!
// But `{alpha}` might be hard to distinguish because it's inside strings or not.

// Reverting `{alpha}` that is NOT inside a string.
// Let's replace `{alpha}` by `alpha` everywhere.
pyCode = pyCode.replace(/\{alpha\}/g, 'alpha');

// Then, only for strings that HAVE `alpha` and we want f"{alpha}", we can be explicit.
// e.g. f"Rejet de H0 (p < alpha)" -> f"Rejet de H0 (p < {alpha})"
// "validatedf" -> "validated"
pyCode = pyCode.replace(/"validatedf"/g, '"validated"');
pyCode = pyCode.replace(/"info"/g, '"info"'); // unrelated, just checking
pyCode = pyCode.replace(/f"Rejet de H0 \(p < alpha\)"/g, 'f"Rejet de H0 (p < {alpha})"');
pyCode = pyCode.replace(/f"Rejet de H0 \(p < alpha\)/g, 'f"Rejet de H0 (p < {alpha})');
pyCode = pyCode.replace(/f"Rejet de H0 \(p > alpha\)/g, 'f"Rejet de H0 (p > {alpha})');
pyCode = pyCode.replace(/f"Non-rejet de H0 \(Variances comparables\) \(p > alpha\)"/g, 'f"Non-rejet de H0 (Variances comparables) (p > {alpha})"');
pyCode = pyCode.replace(/f"Non-rejet de H0 \(p >= alpha\)"/g, 'f"Non-rejet de H0 (p >= {alpha})"');
pyCode = pyCode.replace(/f"Non-rejet de H0 \(p ≥ alpha\)"/g, 'f"Non-rejet de H0 (p ≥ {alpha})"');

// I also have f strings like f"significant (p < alpha)" where we want {alpha}.
// Basically, `/ \(p < alpha\)/g` -> ` (p < {alpha})`
pyCode = pyCode.replace(/ \(p < alpha\)/g, ' (p < {alpha})');
pyCode = pyCode.replace(/ \(p > alpha\)/g, ' (p > {alpha})');
pyCode = pyCode.replace(/ \(p <= alpha\)/g, ' (p <= {alpha})');
pyCode = pyCode.replace(/ \(p >= alpha\)/g, ' (p >= {alpha})');
pyCode = pyCode.replace(/ \(p >= alpha/g, ' (p >= {alpha}'); // for strings that don't close paren
pyCode = pyCode.replace(/ \(p ≥ alpha\)/g, ' (p ≥ {alpha})');
pyCode = pyCode.replace(/ \(p ≥ alpha/g, ' (p ≥ {alpha}');
pyCode = pyCode.replace(/p=alpha/g, 'p={alpha}');

// Wait, what about `p < alpha` in code? `p_val < alpha` -> ok. `sh1_p >= alpha` -> ok.
// We must ensure the strings are actually f-strings!
pyCode = pyCode.replace(/(?<!f)"([^"]*\{alpha\}[^"]*)"/g, 'f"$1"');
pyCode = pyCode.replace(/(?<!f)'([^']*\{alpha\}[^']*)'/g, "f'$1'");

// And fix "validatedf" again just in case
pyCode = pyCode.replace(/"validatedf"/g, '"validated"');
pyCode = pyCode.replace(/"violatedf"/g, '"violated"');
pyCode = pyCode.replace(/"warningf"/g, '"warning"');

fs.writeFileSync('main.py', pyCode, 'utf8');
console.log("Fixed main.py syntax");
