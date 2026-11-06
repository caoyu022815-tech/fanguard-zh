import fs from 'node:fs';
import zlib from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';

function readScript(file) {
  const source = fs.readFileSync(file, 'utf8');
  const payload = source.match(/const PAYLOAD_GZIP = "([A-Za-z0-9+/=]+)";/);
  if (!payload) throw new Error(`无法读取脚本词典：${file}`);
  const data = JSON.parse(zlib.gunzipSync(Buffer.from(payload[1], 'base64')));
  const version = data.build.version;
  delete data.build.builtAt;
  delete data.build.version;
  const code = source
    .replace(payload[1], '<payload>')
    .replace(/const BUILD = [^\r\n]*;/, 'const BUILD = <build>;')
    .replace(/^\/\/ @version\s+[^\r\n]+/m, '// @version <version>')
    .replace(/\r\n/g, '\n');
  return { data, code, version };
}

const previous = readScript(process.argv[2]);
const next = readScript(process.argv[3]);
if (Object.keys(next.data.cards).length < Object.keys(previous.data.cards).length * 0.95) {
  throw new Error('译名数量下降超过 5%，请检查数据源后再发布');
}
const changed = !isDeepStrictEqual(next.data, previous.data) || next.code !== previous.code;
const changelog = process.argv[4];
if (!changelog) {
  console.log(changed ? 'changed' : 'unchanged');
} else if (changed) {
  const oldCards = previous.data.cards;
  const newCards = next.data.cards;
  const added = Object.keys(newCards).filter(id => !Object.hasOwn(oldCards, id));
  const updated = Object.keys(newCards).filter(id => Object.hasOwn(oldCards, id) && !isDeepStrictEqual(oldCards[id], newCards[id]));
  const removed = Object.keys(oldCards).filter(id => !Object.hasOwn(newCards, id));
  const date = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const notes = [
    `## v${next.version} · ${date}`,
    '',
    `- 自动同步卡牌译文，新增 ${added.length} 条，更新 ${updated.length} 条，移除 ${removed.length} 条。`,
  ];
  if (added.length) notes.push(`- 新增卡号示例：${added.slice(0, 10).join('、')}。`);
  if (!isDeepStrictEqual(previous.data.ui, next.data.ui) || !isDeepStrictEqual(previous.data.meta, next.data.meta)) {
    notes.push('- 更新界面或卡牌显示词典。');
  }
  if (next.code !== previous.code) notes.push('- 更新用户脚本代码或安装信息。');
  const heading = '# 更新记录';
  const history = fs.readFileSync(changelog, 'utf8').trim();
  if (!history.startsWith(heading) || history.includes(`## v${next.version} ·`)) {
    throw new Error('更新记录标题无效或已包含该版本');
  }
  fs.writeFileSync(changelog, `${heading}\n\n${notes.join('\n')}\n\n${history.slice(heading.length).trimStart()}\n`);
}
