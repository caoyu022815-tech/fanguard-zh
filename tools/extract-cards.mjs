// Extracts the card database embedded in the saved FANGUARD page.
// Usage: node tools/extract-cards.mjs [path-to-html]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const buildDir = path.join(root, 'build');
const dataDir = path.join(root, 'data');

function findHtml() {
  const arg = process.argv[2];
  if (arg) return path.resolve(arg);
  const dir = path.resolve(root, '..');
  const names = fs
    .readdirSync(dir)
    .filter((n) => /^FANGUARD.*\.html$/i.test(n))
    .map((n) => ({ n, time: fs.statSync(path.join(dir, n)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  if (!names.length) throw new Error(`未在 ${dir} 找到 FANGUARD 页面`);
  return path.join(dir, names[0].n);
}

export function extractCards(html) {
  const anchor = html.indexOf('const raw=[');
  if (anchor < 0) throw new Error('页面中未找到 const raw=[ 卡片数据');
  const start = html.indexOf('[', anchor);
  let depth = 0;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < html.length && html[i] !== quote) {
        if (html[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error('卡片数据数组未闭合');
  return JSON.parse(html.slice(start, end + 1));
}

const csvEscape = (value) => {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const htmlPath = findHtml();
  console.log('读取页面:', htmlPath);
  const cards = extractCards(fs.readFileSync(htmlPath, 'utf8'));
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const slim = cards.map((c) => ({
    id: c.id,
    ko: c.name?.ko || '',
    en: c.name?.en || '',
    ja: c.name?.ja || '',
    textKo: c.text?.ko || '',
  }));
  fs.writeFileSync(path.join(buildDir, 'cards.json'), JSON.stringify(slim));

  const ids = new Map();
  for (const c of slim) ids.set(c.id, (ids.get(c.id) || 0) + 1);
  const duplicates = [...ids].filter(([, n]) => n > 1);

  const header = 'id,en,ja,zh_name,zh_text';
  const lines = [header];
  for (const c of slim) lines.push([c.id, c.en, c.ja, '', ''].map(csvEscape).join(','));
  fs.writeFileSync(path.join(dataDir, 'translations.template.csv'), '\uFEFF' + lines.join('\r\n'), 'utf8');

  console.log(`卡片 ${cards.length} 张，唯一卡号 ${ids.size} 个，重复卡号 ${duplicates.length} 个`);
  console.log('已写入 build/cards.json 与 data/translations.template.csv');
}
