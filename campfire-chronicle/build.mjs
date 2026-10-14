// Bundles the ES modules into one inline script so the game ships as a single
// HTML file (no server needed, and it fits the Artifact page contract).
//   node build.mjs  ->  dist/campfire-chronicle.html (artifact fragment)
//                       dist/play.html (standalone page, double-click to play)
//                       index.html     (dev page using the module files directly)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ORDER = ['rng', 'data', 'engine', 'sprites', 'render', 'ui', 'main'];
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

function transform(name, src) {
  const exported = [];
  src = src.replace(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\/(\w+)\.js';/g, (_, names, mod) => {
    const list = names.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/\s+as\s+/, ': '));
    return `const { ${list.join(', ')} } = __m.${mod};`;
  });
  src = src.replace(/^export\s+(const|let|function|class)\s+(\w+)/gm, (_, kw, id) => { exported.push(id); return `${kw} ${id}`; });
  src = src.replace(/^export\s*\{([^}]*)\};?/gm, (_, names) => { exported.push(...names.split(',').map(s => s.trim()).filter(Boolean)); return ''; });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`unhandled import/export in ${name}.js`);
  return `__m.${name} = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
}

const bundle = `(() => {\n'use strict';\nconst __m = {};\n${ORDER.map(n => transform(n, read(`js/${n}.js`))).join('\n')}})();`;
const css = read('css/game.css');
const markup = read('page.html');
const head = `<title>모닥불 연대기</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="한 명의 모험가를 키우는 방치형 픽셀 RPG">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Silkscreen&display=swap">`;

mkdirSync(new URL('dist/', import.meta.url), { recursive: true });
const inline = `${head}\n<style>\n${css}</style>\n${markup}<script>\n${bundle.replace(/<\/script/gi, '<\\/script')}\n</script>\n`;
writeFileSync(new URL('dist/campfire-chronicle.html', import.meta.url), inline);
const doc = body => `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${body}`;
writeFileSync(new URL('dist/play.html', import.meta.url), doc(`${head}\n<style>\n${css}</style>\n</head>\n<body>\n${markup}<script>\n${bundle}\n</script>\n</body>\n</html>\n`));
writeFileSync(new URL('index.html', import.meta.url), doc(`${head}\n<link rel="stylesheet" href="css/game.css">\n</head>\n<body>\n${markup}<script type="module" src="js/main.js"></script>\n</body>\n</html>\n`));
console.log(`built: dist/campfire-chronicle.html (${(inline.length / 1024).toFixed(0)} KB), dist/play.html, index.html`);
