// Downloads the live game page, refreshes the card list and rebuilds the userscript.
// Usage: node tools/update.mjs [--fetch-cards] [--page <file-or-url>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const pageSource = value('--page') || 'https://fanguard-d.pages.dev/';
const pageFile = path.join(root, 'build', 'live-page.html');

const run = (label, command, commandArgs) => {
  process.stdout.write(`\n== ${label} ==\n`);
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${label} 失败（exit ${result.status}）`);
};

const readPage = async () => {
  if (!/^https?:/i.test(pageSource)) {
    const html = fs.readFileSync(path.resolve(pageSource), 'utf8');
    fs.mkdirSync(path.dirname(pageFile), { recursive: true });
    fs.writeFileSync(pageFile, html, 'utf8');
    return;
  }
  process.stdout.write(`下载 ${pageSource}\n`);
  const res = await fetch(pageSource, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) fanguard-zh' },
  });
  if (!res.ok) throw new Error(`下载页面失败：HTTP ${res.status}`);
  const html = await res.text();
  if (!html.includes('const raw=[')) throw new Error('页面里没有找到 const raw=[ 卡片数据');
  fs.mkdirSync(path.dirname(pageFile), { recursive: true });
  fs.writeFileSync(pageFile, html, 'utf8');
  process.stdout.write(`已保存 ${pageFile}（${(html.length / 1024 / 1024).toFixed(1)} MB）\n`);
};

await readPage();
if (flag('--fetch-cards')) run('资料站卡表', process.execPath, ['tools/fetch-yimieji.mjs']);
run('页面卡表', process.execPath, ['tools/extract-cards.mjs', pageFile]);
run('卡号匹配', process.execPath, ['tools/build-card-translations.mjs']);
run('生成映射', process.execPath, ['tools/build-meta.mjs', pageFile]);
run('打包用户脚本', process.execPath, ['tools/build.mjs']);

const unmatched = JSON.parse(fs.readFileSync(path.join(root, 'build', 'unmatched-cards.json'), 'utf8'));
const built = fs.readFileSync(path.join(root, 'dist', 'fanguard-zh.user.js'), 'utf8');
const version = (built.match(/@version\s+([\d.]+)/) || [])[1];
process.stdout.write(`\n完成：v${version}，未匹配到中文的卡 ${unmatched.length} 张\n`);
if (unmatched.length) {
  const sample = unmatched.slice(0, 10).map((c) => c.id).join(' / ');
  process.stdout.write(`示例：${sample}\n（这些卡会保留原卡名/卡文，等资料站收录后再跑一次本脚本即可）\n`);
}
