import * as fs from 'fs';
import * as path from 'path';

function processFile(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add `const { decimals, alpha } = useWorkspaceStore(s => ({ decimals: s.decimals, alpha: s.alpha }));`
    // inside the component if not present, and replace toFixed and p < 0.05
    
    // Actually, InteractiveLab has 5-6 different components with their own scope.
    // It's safer to just inject `import { useWorkspaceStore } from '../store';` if needed
    // and replace specifically what we need. Let's just do it dynamically via `useWorkspaceStore.getState().decimals`
    
    // Replace `.toFixed(X)` with `.toFixed(useWorkspaceStore.getState().decimals)`
    // Wait, `.toFixed(0)` should NOT be replaced! 
    content = content.replace(/\.toFixed\([12345]\)/g, '.toFixed(useWorkspaceStore.getState().decimals)');
    
    // Replace `p_val < 0.05` or `pValue < 0.05` with `pValue < useWorkspaceStore.getState().alpha`
    content = content.replace(/pValue < 0\.05/g, 'pValue < useWorkspaceStore.getState().alpha');
    content = content.replace(/p_value < 0\.05/g, 'p_value < useWorkspaceStore.getState().alpha');
    content = content.replace(/pw\.p_value < 0\.05/g, 'pw.p_value < useWorkspaceStore.getState().alpha');

    fs.writeFileSync(filePath, content, 'utf8');
}

const dir = 'src/components';
const files = fs.readdirSync(dir);

for (const file of files) {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const fullPath = path.join(dir, file);
        processFile(fullPath);
    }
}
console.log('Fixed toFixed in components');
