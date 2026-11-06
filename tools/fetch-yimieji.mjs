// Download the whole card database from vgcard.yimieji.com (vgcard-api.moecard.cn/api/cdb).
// Usage: node tools/fetch-yimieji.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const api = 'https://vgcard-api.moecard.cn/api/cdb/cards/search';
const limit = 2000;

const payload = (page) =>
  JSON.stringify({
    keyword: '',
    card_pack: 0,
    order_type: 'default',
    tags_id__logic: 'or',
    tags_id: [],
    qField: ['serial', 'scName', 'japName', 'popular_name', 'effect'],
    page,
    limit,
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page, attempt = 1) {
  const res = await fetch(`${api}?page=${page}&limit=${limit}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) fanguard-zh',
      Origin: 'https://vgcard.yimieji.com',
      Referer: 'https://vgcard.yimieji.com/',
    },
    body: payload(page),
  });
  if (res.status === 429 && attempt <= 6) {
    const wait = 20000 * attempt;
    console.warn(`rate limited on page ${page}, waiting ${wait}ms`);
    await sleep(wait);
    return fetchPage(page, attempt + 1);
  }
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.success && !json?.data) throw new Error(`page ${page}: ${JSON.stringify(json).slice(0, 200)}`);
  return json.data;
}

const first = await fetchPage(1);
const total = first.count;
const cards = [...first.list];
console.log(`total ${total}, got ${cards.length}`);
const pages = Math.ceil(total / limit);
for (let page = 2; page <= pages; page++) {
  await sleep(2200);
  const data = await fetchPage(page);
  cards.push(...data.list);
  console.log(`page ${page}/${pages}: ${cards.length}/${total}`);
}

const out = resolve(root, 'build/yimieji-cards.json');
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ fetchedAt: new Date().toISOString(), total, cards }), 'utf8');
console.log(`saved ${cards.length} cards -> ${out}`);
