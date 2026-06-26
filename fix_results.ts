import * as fs from 'fs';

let content = fs.readFileSync('src/components/ResultsDashboard.tsx', 'utf8');

// Inside `ResultsDashboard`, we need to get `decimals` from the store:
// Make sure it has `const decimals = useWorkspaceStore(s => s.decimals);` or similar
if (!content.includes('const decimals = useWorkspaceStore(state => state.decimals)')) {
    content = content.replace(
      'const activeAnalysisId = useWorkspaceStore((state) => state.activeAnalysisId);',
      'const activeAnalysisId = useWorkspaceStore((state) => state.activeAnalysisId);\n  const decimals = useWorkspaceStore((state) => state.decimals);'
    );
}

// Then we replace `.toFixed(X)` with `.toFixed(decimals)` globally where it makes sense
// e.g. .toFixed(4), .toFixed(2), .toFixed(3), .toFixed(1), .toFixed(5)
// BUT we should avoid `.toFixed(0)` since that's for integers (e.g. df).
content = content.replace(/\.toFixed\([12345]\)/g, '.toFixed(decimals)');

fs.writeFileSync('src/components/ResultsDashboard.tsx', content, 'utf8');
console.log('ResultsDashboard updated');
