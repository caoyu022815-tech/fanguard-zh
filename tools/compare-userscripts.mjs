import fs from 'node:fs';
import zlib from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';

function readScript(file) {
  const source = fs.readFileSync(file, 'utf8');
  const payload = source.match(/const PAYLOAD_GZIP = "([A-Za-z0-9+/=]+)";/);
  if (!payload) throw new Error(`无法读取脚本词典：${file}`);
  const data = JSON.parse(zlib.gunzipSync(Buffer.from(payload[1], 'base64')));
  delete data.build.builtAt;
  delete data.build.version;
  const code = source
    .replace(payload[1], '<payload>')
    .replace(/const BUILD = [^\r\n]*;/, 'const BUILD = <build>;')
    .replace(/^\/\/ @version\s+[^\r\n]+/m, '// @version <version>')
    .replace(/\r\n/g, '\n');
  return { data, code };
}

const previous = readScript(process.argv[2]);
const next = readScript(process.argv[3]);
if (Object.keys(next.data.cards).length < Object.keys(previous.data.cards).length * 0.95) {
  throw new Error('译名数量下降超过 5%，请检查数据源后再发布');
}
console.log(isDeepStrictEqual(next, previous) ? 'unchanged' : 'changed');
