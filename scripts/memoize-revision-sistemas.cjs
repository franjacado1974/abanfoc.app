const fs = require('fs');
const path = require('path');

const sistemasDir = path.join(__dirname, '..', 'src', 'mantenimientos', 'components', 'RevisionSistemas');
const files = fs.readdirSync(sistemasDir);

let count = 0;

files.forEach(file => {
  if (!file.endsWith('.tsx')) return;
  const filePath = path.join(sistemasDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if component uses export default function SistemaName
  const match = content.match(/export default function (Sistema\w+)/);
  if (match) {
    const compName = match[1];
    // Replace export default function Component(...) with function Component(...) and export default React.memo(Component);
    content = content.replace(
      new RegExp(`export default function ${compName}`),
      `function ${compName}`
    );
    content += `\nexport default React.memo(${compName});\n`;
    fs.writeFileSync(filePath, content, 'utf8');
    count++;
    console.log(`Protected ${file} with React.memo`);
  }
});

console.log(`Successfully memoized ${count} PCI system components.`);
