// Match the FANGUARD card list (build/cards.json) against the vgcard.yimieji.com dump
// (build/yimieji-cards.json) and write data/translations.json ({ id: [zh_name, zh_text] }).
// Usage: node tools/build-card-translations.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cards = JSON.parse(fs.readFileSync(path.join(root, 'build/cards.json'), 'utf8'));
const dump = JSON.parse(fs.readFileSync(path.join(root, 'build/yimieji-cards.json'), 'utf8'));
const api = dump.cards;

const normalize = (value) => {
  let s = String(value ?? '').normalize('NFKC').toLowerCase();
  s = s.replace(/[“”「」『』]/g, '"');
  return s.replace(/[\s\u00a0]+/g, '');
};
const stripVariant = (value) => {
  let s = normalize(value);
  s = s.replace(/(cn|kr|en)$/, '');
  s = s.replace(/[a-z]$/, '');
  return s;
};

const bySerial = new Map();
for (const card of api) {
  for (const key of [normalize(card.serial), stripVariant(card.serial)]) {
    if (!bySerial.has(key)) bySerial.set(key, card);
  }
}
const byName = new Map();
for (const card of api) {
  const key = normalize(card.japName);
  if (!key) continue;
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(card);
}

const cleanText = (value) =>
  String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^-\s*$/, '')
    .trim();

// The card dump writes Bind as 封锁; this project uses 封存.
const applyTerms = (value) => value.replace(/封锁/g, '封存');

const textOverrides = JSON.parse(fs.readFileSync(path.join(root, 'data/card-text-overrides.json'), 'utf8'));
const aliases = { 'D-BT10/EX27': 'DZ-BT10/EX27' };

const translations = {};
const unmatched = [];
let matchedById = 0;
let matchedByName = 0;
let emptyText = 0;
let blankText = 0;

for (const card of cards) {
  const hit =
    bySerial.get(normalize(card.id)) ||
    bySerial.get(stripVariant(card.id)) ||
    byName.get(normalize(card.ja))?.[0] ||
    (aliases[card.id] ? bySerial.get(normalize(aliases[card.id])) : null) ||
    null;
  if (!hit) {
    unmatched.push(card);
    continue;
  }
  if (bySerial.has(normalize(card.id)) || bySerial.has(stripVariant(card.id))) matchedById++;
  else matchedByName++;

  const name = String(hit.scName ?? '').trim();
  let text = cleanText(hit.effect);
  if (!text) {
    const korean = String(card.textKo ?? '').trim();
    if (Object.prototype.hasOwnProperty.call(textOverrides, korean)) {
      text = textOverrides[korean];
      if (!text) blankText++;
    } else {
      // No Chinese text available: null keeps the page's original text.
      text = null;
      emptyText++;
    }
  }
  if (!name) {
    unmatched.push(card);
    continue;
  }
  translations[card.id] = [applyTerms(name), text === null ? null : applyTerms(text)];
}

// Keep exact-ID translations for cards the game may add between releases.
// A missing source effect must preserve the game's original text.
const gameIds = new Set(cards.map(card => normalize(card.id)));
let extra = 0;
for (const card of api) {
  const id = String(card.serial ?? '').trim().toUpperCase();
  const name = String(card.scName ?? '').trim();
  if (!/^D(?:Z)?-[A-Z0-9]+\/[A-Z0-9]+$/.test(id) || !name || gameIds.has(normalize(id)) || Object.hasOwn(translations, id)) continue;
  const text = cleanText(card.effect);
  translations[id] = [applyTerms(name), text ? applyTerms(text) : null];
  extra++;
}

const sorted = {};
for (const id of Object.keys(translations).sort()) sorted[id] = translations[id];

fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data/translations.json'), JSON.stringify(sorted, null, 1), 'utf8');
fs.writeFileSync(path.join(root, 'build/unmatched-cards.json'), JSON.stringify(unmatched, null, 1), 'utf8');

const total = cards.length;
const coverage = (((total - unmatched.length) / total) * 100).toFixed(1);
console.log(`卡片 ${total} 张：卡号匹配 ${matchedById}，日文名匹配 ${matchedByName}，未匹配 ${unmatched.length}（覆盖 ${coverage}%）`);
console.log(`游戏卡表卡文：中文 ${cards.filter(card => sorted[card.id]?.[1]).length} 张，明确无效果 ${blankText} 张，保留原文 ${emptyText} 张`);
console.log(`另收录 ${extra} 条可按卡号匹配的 D 标准卡译文`);
if (unmatched.length) console.log(`未匹配示例: ${unmatched.slice(0, 8).map((c) => c.id).join(' / ')}`);
