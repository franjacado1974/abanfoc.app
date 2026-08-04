import fs from 'fs';
import path from 'path';

const DIR = 'src/components/RevisionSistemas';
const TARGET = 'className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"';
const REPLACEMENT = `className={\`px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm \${
                                                                                      (eq.revisado && stats.fail === 0 && (!eq.anomalias || eq.anomalias.trim() === ''))
                                                                                          ? 'bg-green-600 hover:bg-green-700 text-white'
                                                                                          : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200/50'
                                                                                  }\`}`;

function main() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.tsx'));
  console.log(`Found ${files.length} files in ${DIR}`);
  
  for (const file of files) {
    const filePath = path.join(DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes(TARGET)) {
      content = content.replace(TARGET, REPLACEMENT);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Patched: ${file}`);
    } else {
      console.log(`⚠️ Target not found in: ${file}`);
    }
  }
}

main();
