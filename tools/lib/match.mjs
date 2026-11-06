// Shared card matching helpers for the FANGUARD ← vgcard.yimieji.com bridge.

export const normalize = (value) => {
  let s = String(value ?? '').normalize('NFKC').toLowerCase();
  s = s.replace(/[“”「」『』]/g, '"');
  return s.replace(/[\s\u00a0]+/g, '');
};

export const stripVariant = (value) => {
  let s = normalize(value);
  s = s.replace(/(cn|kr|en)$/, '');
  s = s.replace(/[a-z]$/, '');
  return s;
};

export function buildMatcher(apiCards) {
  const bySerial = new Map();
  for (const card of apiCards) {
    for (const key of [normalize(card.serial), stripVariant(card.serial)]) {
      if (!bySerial.has(key)) bySerial.set(key, card);
    }
  }
  const byName = new Map();
  for (const card of apiCards) {
    const key = normalize(card.japName);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(card);
  }
  return (card) =>
    bySerial.get(normalize(card.id)) ||
    bySerial.get(stripVariant(card.id)) ||
    byName.get(normalize(card.ja))?.[0] ||
    null;
}
