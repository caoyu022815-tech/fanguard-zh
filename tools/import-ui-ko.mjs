// Imports the Korean→Chinese UI dictionary from a reference localization userscript
// (FANGUARD中文汉化包 v3.x, fanguard-zh-ui.user.js) into data/ui-zh-ko.json and
// rewrites its placeholders / terminology so the entries fit this project.
// Usage: node tools/import-ui-ko.mjs <path-to-fanguard-zh-ui.user.js>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'data', 'ui-zh-ko.json');

const input = process.argv[2];
if (!input) throw new Error('用法: node tools/import-ui-ko.mjs <fanguard-zh-ui.user.js>');
const source = fs.readFileSync(path.resolve(input), 'utf8');

const PLACEHOLDER = /\{\d*\}|\{n\}/g;
const hasSlot = /\{\d*\}|\{n\}/;
const HANGUL = /[\uac00-\ud7a3]/;

// The reference package uses its own glossary; keep this project's (THE一灭寂) wording.
const TERMS = [
  ['交织超限舞装', '交错超限舞装'],
  ['骑升', '骑乘'],
  ['封锁', '封存'],
  ['回复', '治疗'],
  ['呼唤', 'CALL'],
  ['换牌', '调度'],
  ['初始卡组', '预组'],
  ['组卡器', '卡组编辑'],
  ['战报', '对战日志'],
  ['治触发', '治疗触发'],
  ['(?<!护)盾', '护盾'],
  ['换牌', '调度'],
];

// Critical is written ☆ in the THE一灭寂 card data (「☆+1」「☆值」), so the UI keeps the same mark.
export const CRITICAL_KEY = /크리티컬|クリティカル/;
export const toCriticalMark = (text) =>
  text
    .replace(/关键|暴击|临界/g, '☆')
    .replace(/☆\s*([+＋\d{])/g, '☆$1');

function readLiteral(name) {
  const marker = `var ${name} = `;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`参考脚本里找不到 ${name}`);
  let i = start + marker.length;
  const open = source[i];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      i++;
      break;
    }
  }
  const literal = source.slice(start + marker.length, i);
  return new Function(`return (${literal})`)();
}

const exact = readLiteral('EXACT');
const patterns = readLiteral('PATTERNS');
const raw = new Map([...Object.entries(exact), ...patterns]);

let skippedPlaceholders = 0;
let skippedEmpty = 0;
const applied = new Map();

for (const [ko, zh] of raw) {
  if (typeof zh !== 'string' || !zh.trim() || zh === ko || !HANGUL.test(ko)) {
    skippedEmpty++;
    continue;
  }
  const slots = (ko.match(PLACEHOLDER) || []).length;
  const used = (zh.match(PLACEHOLDER) || []).length;
  if (slots !== used) {
    skippedPlaceholders++;
    continue;
  }
  let index = 0;
  let value = zh.trim().replace(PLACEHOLDER, () => `{${index++}}`);
  for (const [from, to] of TERMS) value = value.replace(new RegExp(from, 'g'), to);
  if (CRITICAL_KEY.test(ko)) value = toCriticalMark(value);
  applied.set(ko, value);
}

const sorted = Object.fromEntries([...applied].sort((a, b) => a[0].localeCompare(b[0], 'ko')));
fs.writeFileSync(out, JSON.stringify(sorted, null, 2) + '\n', 'utf8');

const withSlots = [...applied.keys()].filter((ko) => hasSlot.test(ko)).length;
console.log(`参考词条 ${raw.size} 条 → 采用 ${applied.size} 条（其中模板 ${withSlots} 条）`);
console.log(`跳过：空译文/未翻译 ${skippedEmpty} 条，占位符不匹配 ${skippedPlaceholders} 条`);
console.log(`已写入 ${out}`);
