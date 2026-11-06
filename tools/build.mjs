// Builds dist/fanguard-zh.user.js from the auto-generated translations plus optional
// hand-written overrides.
// Usage: node tools/build.mjs [译名表] [--out dist/fanguard-zh.user.js] [--no-ui]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readTable } from './lib/table.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataDir = path.join(root, 'data');
const buildDir = path.join(root, 'build');
const distDir = path.join(root, 'dist');

const args = process.argv.slice(2);
let input = null;
let out = path.join(distDir, 'fanguard-zh.user.js');
let withUi = true;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = path.resolve(args[++i]);
  else if (args[i] === '--no-ui') withUi = false;
  else if (!args[i].startsWith('--')) input = path.resolve(args[i]);
}

const cards = JSON.parse(fs.readFileSync(path.join(buildDir, 'cards.json'), 'utf8'));
const byId = new Set(cards.map((card) => card.id));

// Auto translations from vgcard.yimieji.com (tools/build-card-translations.mjs).
const translations = {};
const fallbackFile = path.join(dataDir, 'card-translation-fallbacks.json');
if (fs.existsSync(fallbackFile)) Object.assign(translations, JSON.parse(fs.readFileSync(fallbackFile, 'utf8')));
const autoFile = path.join(dataDir, 'translations.json');
if (fs.existsSync(autoFile)) Object.assign(translations, JSON.parse(fs.readFileSync(autoFile, 'utf8')));

// Optional hand-written table: overrides entries from the auto file and adds missing cards.
if (!input) {
  input = ['translations.csv', 'translations.xlsx', 'translations.tsv']
    .map((name) => path.join(dataDir, name))
    .find((file) => fs.existsSync(file));
}
let manual = 0;
if (input && fs.existsSync(input)) {
  const rows = readTable(input);
  for (const row of rows) {
    const id = String(row.id ?? '').trim();
    const name = String(row.name ?? '').trim();
    const text = String(row.text ?? '').trim();
    if (!id || !byId.has(id) || (!name && !text)) continue;
    const previous = translations[id] || ['', ''];
    translations[id] = [name || previous[0], text || previous[1]];
    manual++;
  }
}

const entries = {};
for (const id of Object.keys(translations).sort()) {
  const [name, text] = translations[id];
  if (!name && text == null) continue;
  entries[id] = [name || '', text === null ? null : text || ''];
}

// Korean card name → Chinese card name, used for engine messages and logs.
const names = {};
for (const card of cards) {
  const entry = entries[card.id];
  if (card.ko && entry?.[0]) names[card.ko] = entry[0];
}

// UI dictionary: machine translation base, then the Korean-based reference
// dictionary (data/ui-zh-ko.json), then the hand-written overrides.
const ui = new Map();
const uiFile = ['ui-zh-en.json', 'ui-zh.json']
  .map((name) => path.join(buildDir, name))
  .find((file) => withUi && fs.existsSync(file));
if (uiFile) {
  for (const [ko, zh] of JSON.parse(fs.readFileSync(uiFile, 'utf8'))) ui.set(ko, zh);
}
const patchFile = path.join(buildDir, 'patch-zh.json');
if (withUi && fs.existsSync(patchFile)) {
  for (const [ko, zh] of Object.entries(JSON.parse(fs.readFileSync(patchFile, 'utf8')))) {
    if (ko.length >= 6) ui.set(ko, zh);
  }
}
let koEntries = 0;
const curated = new Set();
const koFile = path.join(dataDir, 'ui-zh-ko.json');
if (withUi && fs.existsSync(koFile)) {
  const imported = JSON.parse(fs.readFileSync(koFile, 'utf8'));
  for (const [ko, zh] of Object.entries(imported)) {
    ui.set(ko, zh);
    curated.add(ko);
  }
  koEntries = Object.keys(imported).length;
}
if (withUi && fs.existsSync(path.join(dataDir, 'ui-overrides.json'))) {
  const overrides = JSON.parse(fs.readFileSync(path.join(dataDir, 'ui-overrides.json'), 'utf8'));
  for (const [ko, zh] of Object.entries(overrides)) {
    ui.set(ko, zh);
    curated.add(ko);
  }
}

const glossary = [
  ['计数冲击', '计数爆发'],
  ['计数爆炸', '计数爆发'],
  ['灵魂冲击', '灵魂爆发'],
  ['灵魂爆炸', '灵魂爆发'],
  ['后援者', '后防者'],
  ['后卫', '后防者'],
  ['先锋', '先导者'],
  ['仪表', '计量'],
  ['呼唤', 'CALL'],
  ['后援', '后防者'],
  ['守卫者', '守护者'],
  ['哨兵', '守护者'],
  ['甲板', '卡组'],
  ['牌库', '牌堆'],
  ['套牌', '卡组'],
  ['牌组', '卡组'],
  ['骑乘牌组', '骑乘卡组'],
  ['主牌组', '主卡组'],
  ['掉落区', '弃牌区'],
  ['掉落', '弃牌区'],
  ['令牌', '衍生物'],
  ['订单', '指令'],
  ['退休', '退场'],
  ['绑定', '封存'],
  ['封锁', '封存'],
  ['氏族', '集团'],
  ['代价', '费用'],
  ['卡牌名称', '卡名'],
  ['卡片名称', '卡名'],
  ['损害', '伤害'],
  ['呼叫', 'CALL'],
  ['抽奖', '抽卡'],
  ['治愈', '治疗'],
  ['年级', '等级'],
  ['乘骑', '骑乘'],
  ['超长连衣裙', '交错超限舞装'],
  ['连衣裙', '舞装'],
  ['外衣', '舞装'],
  ['圆圈', '圆阵'],
  ['换牌', '调度'],
  ['行程', '骑乘'],
  ['骑行', '骑乘'],
  ['乘坐', '骑乘'],
  ['乘车', '骑乘'],
  ['绘制', '抽卡'],
  ['损坏', '伤害'],
  ['驱动检查', '驱动判定'],
  ['锁定', '咒缚'],
  ['解除咒缚', '解咒'],
  ['大堂', '大厅'],
  ['卡组日志', 'Deck Log'],
  ['卡组生成器', '卡组编辑'],
  ['复赛', '重赛'],
  ['换牌', '调度'],
];
const applyGlossary = (text) => glossary.reduce((value, [from, to]) => value.split(from).join(to), text);
// Terms that must match the THE一灭寂 card wording even when the value comes from a
// curated/machine dictionary (the glossary above only runs on machine translations).
// 计数爆发 / 计数回充 / 灵魂填充 / 能量填充 are the card-text spellings.
const TERM_FIXES = [
  ['反击爆炸', '计数爆发'],
  ['反击爆发', '计数爆发'],
  ['反击冲锋', '计数回充'],
  ['反冲锋', '计数回充'],
  ['反击充填', '计数回充'],
  ['充填', '填充'],
  ['灵魂充能', '灵魂填充'],
  ['能量充能', '能量填充'],
  ['触发器', '触发'],
  ['触发区域', '触发区'],
  ['判定区', '触发区'],
  ['单元', '单位'],
  ['后排', '后列'],
  ['前排', '前列'],
  ['前触发', '前列触发'],
  ['战力', '力量'],
  ['电源', '力量'],
  ['配方数', '公式数'],
  ['方程式计数', '公式计数'],
  ['武将数量', '张数'],
  ['假面盾', '人格护盾'],
  ['人格面具门票', '人格护盾券'],
  ['门票', '券'],
  ['过度触发', '超触发'],
  ['卡组构建', '卡组编辑'],
  ['不画画', '不抽卡'],
  ['召唤', 'CALL'],
  ['调用', 'CALL'],
  ['成本', '费用'],
  ['撤退', '退场'],
  ['激活', '发动'],
  ['队友', '伙伴'],
  ['驱动器检查', '驱动判定'],
  ['顶峰区域', '纹章区'],
  ['顶峰状态', '纹章状态'],
  ['顺序区域', '指令区'],
  ['特殊动作', '必杀技'],
  ['房间领导者', '房主'],
  ['站指令', '竖置的指令'],
  ['守护者圈', '守护者圆阵'],
  ['后防者圈', '后防者圆阵'],
  ['守护圈', '守护者圆阵'],
  ['圈子', '圆阵'],
  ['公共卡牌区域', '公开卡牌区域'],
  ['封存区域', '封存区'],
  ['指令区域', '指令区'],
  ['72 周', '72柱'],
  ['72周', '72柱'],
];
const applyTermFixes = (text) => TERM_FIXES.reduce((value, [from, to]) => value.split(from).join(to), text);
// The THE一灭寂 card data writes Critical as ☆ (「☆+1」「☆值」), so the UI uses the same mark.
const CRITICAL_KEY = /크리티컬|クリティカル/;
const toCriticalMark = (text) =>
  text.replace(/关键|暴击|临界/g, '☆').replace(/☆\s*([+＋\d{])/g, '☆$1');
// The phase bar uses short labels (主要 / 结束); sentences keep the full phase names.
const toPhaseWords = (text) =>
  text
    .replace(/“主阶段”/g, '“主要”')
    .replace(/主阶段(?=\s*·)/g, '主要')
    .replace(/主阶段开始/g, '主要阶段开始')
    .replace(/主阶段/g, '主要阶段');
// Ride is 骑升 in the UI; card texts keep the dump's own wording (RIDE).
const toRideWords = (text) => text.replace(/骑乘/g, '骑升');
// Mulligan is 调度 in the UI (「确认调度」「P1 · 调度」…).
const toMulliganWords = (text) => text.replace(/换牌/g, '调度');
// Glossary only normalizes machine translation; curated dictionaries are already vetted.
const uiEntries = [...ui.entries()]
  .filter(([ko, zh]) => ko && zh && ko !== zh)
  .map(([ko, zh]) => {
    const value = curated.has(ko) ? zh : applyGlossary(zh);
    const marked = CRITICAL_KEY.test(ko) ? toCriticalMark(value) : value;
    return [ko, applyTermFixes(toMulliganWords(toRideWords(toPhaseWords(marked))))];
  });

const meta = JSON.parse(fs.readFileSync(path.join(buildDir, 'meta.json'), 'utf8'));
const staticFile = path.join(buildDir, 'static-zh.json');
if (withUi && fs.existsSync(staticFile)) {
  const autoStatic = JSON.parse(fs.readFileSync(staticFile, 'utf8'));
  const merged = {};
  for (const [en, zh] of Object.entries(autoStatic)) merged[en] = applyGlossary(zh);
  // Hand-written labels win over the machine translation.
  meta.english = { ...merged, ...(meta.english || {}) };
}
for (const map of [meta.english, meta.japanese, meta.fallback]) {
  for (const [key, value] of Object.entries(map || {})) {
    if (typeof value !== 'string') continue;
    const next = toMulliganWords(toRideWords(value));
    if (next !== value) map[key] = next;
  }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const build = {
  version: pkg.version || '1.0.0',
  builtAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  entries: Object.keys(entries).length,
  names: Object.values(entries).filter((entry) => entry[0]).length,
  texts: Object.values(entries).filter((entry) => entry[1]).length,
  ui: uiEntries.length,
  source: 'THE一灭寂 vgcard.yimieji.com',
};

const japaneseIdsFile = path.join(dataDir, 'japanese-card-ids.json');
const japaneseIds = fs.existsSync(japaneseIdsFile) ? JSON.parse(fs.readFileSync(japaneseIdsFile, 'utf8')) : {};
const payload = JSON.stringify({ cards: entries, japaneseIds, names, ui: uiEntries, meta, build });
const packed = zlib.gzipSync(Buffer.from(payload), { level: 9 }).toString('base64');

const updateUrl = process.env.FANGUARD_UPDATE_URL?.trim();
if (updateUrl && (!/^https:\/\/\S+$/.test(updateUrl) || !new URL(updateUrl).pathname.endsWith('.user.js'))) {
  throw new Error('FANGUARD_UPDATE_URL 必须是指向 .user.js 的 HTTPS 地址');
}
const updateMetadata = updateUrl
  ? `// @updateURL    ${updateUrl}\n// @downloadURL  ${updateUrl}\n`
  : '';

const template = fs.readFileSync(path.join(root, 'src', 'userscript.template.js'), 'utf8');
const script = template
  .replace('__VERSION__', pkg.version || '1.0.0')
  .replace('// ==/UserScript==', () => `${updateMetadata}// ==/UserScript==`)
  .replace('/*__BUILD__*/', JSON.stringify(build))
  .replace("'__PAYLOAD_GZIP__'", JSON.stringify(packed));

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, script, 'utf8');

const matched = cards.filter(card => entries[card.id]?.[0]).length;
const coverage = ((matched / cards.length) * 100).toFixed(1);
console.log(`游戏卡表 ${cards.length} 张，匹配译名 ${matched} 条（${coverage}%）；打包译名 ${build.names} 条、卡文 ${build.texts} 条`);
if (manual) console.log(`手工译名表 ${input} 覆盖 ${manual} 条`);
console.log(`界面词条 ${uiEntries.length} 条${koEntries ? `（韩文参考词典 ${koEntries} 条）` : ''}`);
console.log(`明文 ${(payload.length / 1024 / 1024).toFixed(2)} MB → 压缩后脚本 ${(script.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`已生成 ${out}`);
