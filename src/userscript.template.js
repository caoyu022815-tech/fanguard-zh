// ==UserScript==
// @name         FANGUARD 简体中文汉化（卡牌 + 界面）
// @name:zh-CN   FANGUARD 简体中文汉化（卡牌 + 界面）
// @namespace    fanguard-zh
// @version      __VERSION__
// @description  用 THE一灭寂 的官方中文卡名/卡文替换 FANGUARD 的韩文卡牌数据，并把游戏界面汉化
// @author       fanguard-zh
// @match        https://fanguard-d.pages.dev/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  const PAYLOAD_GZIP = '__PAYLOAD_GZIP__';
  const BUILD = /*__BUILD__*/;

  const looksLikeGame =
    /fanguard/i.test(location.href) ||
    /fanguard/i.test(document.title || '') ||
    !!document.querySelector('script[src*="fanguard"]');
  if (!looksLikeGame && !document.getElementById('__fanguard_zh_host')) return;

  const KEYS = {
    cards: 'fanguard-zh:cards',
    ui: 'fanguard-zh:ui',
  };
  const readFlag = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw !== '0';
    } catch {
      return fallback;
    }
  };
  const writeFlag = (key, on) => {
    try {
      localStorage.setItem(key, on ? '1' : '0');
    } catch {}
  };

  const cardsOn = readFlag(KEYS.cards, true);
  const uiOn = readFlag(KEYS.ui, true);
  const anyOn = cardsOn || uiOn;

  // The page reads vg-language before the first render; Korean is the only language
  // whose card fields we replace, and the UI layer translates the Korean DOM.
  // Keep the page untouched when both switches are off, but still show the widget so
  // the switches can be turned back on.
  if (anyOn) {
    try {
      localStorage.setItem('vg-language', 'ko');
    } catch {}
  }

  const HANGUL = /[\uac00-\ud7a3]/;
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'label', 'data-tip', 'data-energy-tip', 'data-pin-tip', 'data-arcana-tip'];
  const stats = { cards: 0, total: 0, ui: 0, uiTotal: 0, applied: false, fallback: false, ready: false };

  let payload = null;
  let payloadPromise = null;

  function decodePayload() {
    if (payloadPromise) return payloadPromise;
    payloadPromise = (async () => {
      const binary = atob(PAYLOAD_GZIP);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      if (typeof DecompressionStream !== 'function') {
        throw new Error('当前浏览器不支持 DecompressionStream，请使用较新的 Chrome / Edge / Firefox');
      }
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const text = await new Response(stream).text();
      const data = JSON.parse(text);
      stats.total = Object.keys(data.cards || {}).length;
      stats.uiTotal = (data.ui || []).length;
      stats.ui = (data.ui || []).filter(([ko, zh]) => ko && zh && ko !== zh).length;
      return data;
    })();
    return payloadPromise;
  }

  // ---------------------------------------------------------------- card data

  // Races missing from the Korean→Chinese table are matched through the Japanese race name,
  // pairing the lists from the end (the page drops leading entries such as token races).
  function translateRaces(racesKo, md, meta) {
    const jaList = String(md?.races?.ja || '')
      .split('/')
      .map((x) => x.trim())
      .filter((x) => x && x !== '-');
    return racesKo.map((race, index) => {
      const direct = meta.races?.[race];
      if (direct) return direct;
      const ja = jaList[jaList.length - (racesKo.length - index)];
      return (ja && meta.jpRaces?.[ja]) || race;
    });
  }

  function translateCardMeta(card, meta) {
    if (!card || !meta) return;
    const md = card.cardMetadata;
    const racesKo = card.racesKo;
    if (Array.isArray(racesKo)) card.racesKo = translateRaces(racesKo, md, meta);
    if (!md) return;
    if (md.races?.ko) {
      const parts = String(md.races.ko).split('/');
      md.races.ko = parts.length > 1 ? translateRaces(parts, md, meta).join('/') : meta.races?.[md.races.ko] || md.races.ko;
    }
    if (md.cardType?.ko) md.cardType.ko = meta.types?.[md.cardType.ko] || md.cardType.ko;
    if (md.clanNames?.ko) md.clanNames.ko = meta.clans?.[md.clanNames.ko] || md.clanNames.ko;
    if (Array.isArray(md.orderKindNames?.ko)) {
      md.orderKindNames.ko = md.orderKindNames.ko.map((kind) => meta.types?.[kind] || kind);
    }
    if (md.clan && meta.clans?.[md.clan]) md.clan = meta.clans[md.clan];
  }

  function buildSearchIndex(cards) {
    return new Map(
      cards.map((card) => {
        const labels = [
          ...(card.racesKo || []),
          ...(card.races || []),
          ...(card.racesJa || []),
          ...(card.cardMetadata?.orderKinds || []),
          ...Object.values(card.cardMetadata?.orderKindNames || {}).flat(),
          card.group,
          card.cardMetadata?.clan,
          ...Object.values(card.cardMetadata?.clanNames || {}),
        ].filter(Boolean);
        const text = [
          card.id,
          ...Object.values(card.name || {}),
          ...Object.values(card.text || {}),
          ...labels,
          ...labels.map((label) => String(label).replace(/\s+/g, '')),
        ]
          .join(' ')
          .toLowerCase();
        return [card.id, text];
      }),
    );
  }

  function applyService(service, data) {
    if (!service || !data) return 0;
    const list = Array.isArray(service.cards) ? service.cards : service.info ? Object.values(service.info) : [];
    let matched = 0;
    for (const card of list) {
      if (!card || typeof card !== 'object') continue;
      const entry = data.cards[card.id];
      if (entry) {
        if (entry[0]) {
          if (!card.name) card.name = {};
          card.name.ko = entry[0];
        }
        if (entry.length > 1 && entry[1] !== null) {
          if (!card.text) card.text = {};
          card.text.ko = entry[1];
        }
        matched++;
      }
      translateCardMeta(card, data.meta);
    }
    if (matched && Array.isArray(service.cards)) {
      try {
        service.searchIndex = buildSearchIndex(service.cards);
      } catch (error) {
        console.warn('[FANGUARD 汉化] 重建卡片索引失败', error);
      }
    }
    if (matched) {
      stats.cards = matched;
      stats.applied = true;
      console.info(`[FANGUARD 汉化] 已替换 ${matched} 张卡名/卡文（词典 ${stats.total} 条）`);
      markUi();
    }
    return matched;
  }

  async function applyCardData(network) {
    if (!cardsOn || !network?.service) return;
    const data = await decodePayload();
    applyService(network.service, data);
  }

  function wrap(api) {
    if (!api || typeof api.connect !== 'function' || api.__fanguardZh) return api;
    const connect = api.connect;
    api.connect = async function (...args) {
      const network = await connect.apply(this, args);
      try {
        await applyCardData(network);
      } catch (error) {
        console.warn('[FANGUARD 汉化] 应用卡牌译文失败', error);
      }
      return network;
    };
    try {
      Object.defineProperty(api, '__fanguardZh', { value: true });
    } catch {
      api.__fanguardZh = true;
    }
    return api;
  }

  function installHook() {
    if (!cardsOn) return;
    if (Object.prototype.hasOwnProperty.call(globalThis, 'VanguardBrowser')) {
      wrap(globalThis.VanguardBrowser);
      return;
    }
    let value;
    Object.defineProperty(globalThis, 'VanguardBrowser', {
      configurable: true,
      enumerable: true,
      get: () => value,
      set(next) {
        value = wrap(next) || next;
      },
    });
  }

  // ---------------------------------------------------------------- UI layer

  const uiExact = new Map();
  const uiPatterns = [];
  const uiCache = new Map();
  const textRecords = new WeakMap();
  const attrRecords = new WeakMap();
  let names = {};
  let english = {};
  let englishPatterns = [];
  let japanese = {};
  let terms = {};
  let fallbackTerms = [];
  let observer = null;
  let uiInstalled = false;

  const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function compileEnglishPatterns(map) {
    const patterns = [];
    for (const [source, target] of Object.entries(map || {})) {
      if (!/\{\d*\}|\{n\}/.test(source)) continue;
      const parts = source.split(/(\{\d*\}|\{n\})/);
      const re = new RegExp(
        '^' +
          parts.map((part) => (/^\{\d*\}$|^\{n\}$/.test(part) ? '(\\d+)' : escapeRe(part))).join('') +
          '$',
      );
      patterns.push({ re, zh: target, weight: source.length });
    }
    return patterns.sort((a, b) => b.weight - a.weight);
  }

  function compileUi(entries) {
    for (const [ko, zh] of entries || []) {
      if (!ko || !zh || ko === zh || !HANGUL.test(ko)) continue;
      if (!/\{\d*\}|\{n\}/.test(ko)) {
        uiExact.set(ko, zh);
        continue;
      }
      const source =
        '^' +
        ko
          .split(/(\{\d*\}|\{n\})/)
          .map((part) => (/^\{\d*\}$|^\{n\}$/.test(part) ? '([\\s\\S]+?)' : escapeRe(part)))
          .join('') +
        '$';
      try {
        uiPatterns.push({ re: new RegExp(source), zh, weight: ko.replace(/\{\d*\}|\{n\}/g, '').length });
      } catch (error) {
        console.warn('[FANGUARD 汉化] 界面词条编译失败', ko, error);
      }
    }
    uiPatterns.sort((a, b) => b.weight - a.weight);
  }

  function fill(target, match, depth) {
    return target.replace(/\{(\d+)\}/g, (_, index) => translateText(match[Number(index) + 1] ?? '', depth + 1));
  }

  function lookup(text, depth, rough) {
    const hit = uiExact.get(text);
    if (hit !== undefined) return hit;
    const term = terms[text];
    if (term) return term;
    for (const pattern of uiPatterns) {
      const match = pattern.re.exec(text);
      if (!match) continue;
      const out = fill(pattern.zh, match, depth);
      if (!HANGUL.test(out)) return out;
      rough.push(out);
    }
    return null;
  }

  function translateNames(text) {
    const whole = names[text.trim()];
    if (whole) return text.replace(text.trim(), whole);
    return text.replace(/([「“])([^」”]+)([」”])/g, (all, open, name, close) => {
      const shown = names[name];
      return shown ? open + shown + close : all;
    });
  }

  function cardLabel(text) {
    const whole = names[text.trim()];
    if (whole) return text.replace(text.trim(), whole);
    for (let i = text.lastIndexOf(' · '); i > 0; i = text.lastIndexOf(' · ', i - 1)) {
      const head = names[text.slice(0, i).trim()];
      if (head) return head + translateText(text.slice(i), 1);
    }
    return null;
  }

  const EDGE = /^([\s·:,/|()\[\]•●✓▾▴▸←→]*)([\s\S]*?)([\s·:,/|()\[\]•●✓▾▴▸←→]*)$/;
  const SPLITS = [/(\n)/, /( · )/, /( \\ )/, /( \/ )/, /(: )/, /(, )/];

  function replaceTerms(text) {
    let out = text;
    for (const [ko, zh] of fallbackTerms) {
      if (out.includes(ko)) out = out.split(ko).join(zh);
    }
    out = out
      .replace(/(\d+)\s*장/g, '$1 张')
      .replace(/(\d+)\s*개/g, '$1 个')
      .replace(/(\d+)\s*종/g, '$1 种');
    return out;
  }

  function translateText(value, depth = 0) {
    const text = String(value ?? '');
    if (!text) return text;
    const known = uiCache.get(text);
    if (known !== undefined) return known;

    if (!HANGUL.test(text)) {
      const trimmed = text.trim();
      const en = english[trimmed];
      if (en) {
        const out = text.replace(trimmed, en);
        uiCache.set(text, out);
        return out;
      }
      const jp = japanese[trimmed];
      if (jp) {
        const out = text.replace(trimmed, jp);
        uiCache.set(text, out);
        return out;
      }
      for (const pattern of englishPatterns) {
        const match = pattern.re.exec(trimmed);
        if (!match) continue;
        const out = text.replace(trimmed, fill(pattern.zh, match, 0));
        uiCache.set(text, out);
        return out;
      }
      // Mixed labels such as "CRITICAL · <card name>" or "POWER / CRITICAL".
      if (depth < 3) {
        for (const sep of SPLITS) {
          const parts = text.split(sep);
          if (parts.length < 3) continue;
          const joined = parts.map((part, index) => (index % 2 ? part : translateText(part, depth + 1))).join('');
          if (joined !== text) {
            uiCache.set(text, joined);
            return joined;
          }
        }
      }
      return text;
    }

    const rough = [];
    const trimmed = text.trim();
    const whole = uiExact.get(trimmed) ?? terms[trimmed];
    if (whole !== undefined) {
      const out = text.replace(trimmed, whole);
      uiCache.set(text, out);
      return out;
    }
    let out = lookup(text, depth, rough);
    if (out === null) {
      const [, lead, core, tail] = EDGE.exec(text) || [];
      if (core && core !== text) {
        const inner = lookup(core, depth, rough);
        if (inner !== null) out = lead + inner + tail;
      }
    }
    if (out === null) out = cardLabel(text);
    if (out === null && depth < 6) {
      for (const sep of SPLITS) {
        const parts = text.split(sep);
        if (parts.length < 3) continue;
        const joined = parts.map((part, index) => (index % 2 ? part : translateText(part, depth + 1))).join('');
        if (HANGUL.test(joined)) rough.push(joined);
        else {
          out = joined;
          break;
        }
      }
    }
    if (out === null) {
      const replaced = replaceTerms(text);
      out = replaced !== text ? replaced : rough.length
        ? rough.reduce((a, b) =>
            (b.match(/[\uac00-\ud7a3]/g) || []).length < (a.match(/[\uac00-\ud7a3]/g) || []).length ? b : a,
          )
        : translateNames(text);
    }
    if (HANGUL.test(out)) {
      const replaced = replaceTerms(out);
      const before = (out.match(/[\uac00-\ud7a3]/g) || []).length;
      const after = (replaced.match(/[\uac00-\ud7a3]/g) || []).length;
      if (after < before) out = replaced;
    }
    uiCache.set(text, out);
    return out;
  }

  const skipped = (el) =>
    !el ||
    !!el.closest('[data-fanguard-zh],script,style') ||
    (!!el.closest('[translate="no"]') && !el.closest('#patchNotesList'));

  // The phase bar and the centre banner keep the game's own English wording in
  // every language (MULLIGAN / RIDE / MAIN / BATTLE / GUARD / END / PHASE …),
  // and the RIDE buttons are sized for the four-letter label.
  // Only their Korean labels (턴 시작, 스탠드) go through the dictionary.
  const KEEP_EN = '#phase, #battleFx, .ride-go';

  // Playmat captions are hardcoded in the game: <small> holds the Japanese zone
  // name (same in every language, kept as-is) and the remaining text the English
  // acronym, which we render as「XX区」.
  const ZONE_CAPTIONS = {
    CREST: '纹章区',
    ORDER: '指令区',
    DAMAGE: '伤害区',
    TRIGGER: '触发区',
    DECK: '牌堆区',
    RIDE: '骑升区',
    DROP: '弃牌区',
    BIND: '封存区',
    MEMORY: '回忆区',
  };

  function syncText(node) {
    if (node.parentElement?.tagName === 'TEXTAREA') return;
    const value = node.nodeValue;
    const record = textRecords.get(node);
    const source = record && value === record[1] ? record[0] : value;
    if (skipped(node.parentElement)) return;
    const label = node.parentElement?.closest('.zlabel');
    if (label) {
      if (node.parentElement.tagName === 'SMALL') return;
      const caption = ZONE_CAPTIONS[source.trim()];
      if (caption) {
        textRecords.set(node, [source, caption]);
        if (value !== caption) node.nodeValue = caption;
        return;
      }
    }
    if (!HANGUL.test(source) && node.parentElement?.closest(KEEP_EN)) return;
    const shown = translateText(source);
    textRecords.set(node, [source, shown]);
    if (value !== shown) node.nodeValue = shown;
  }

  function syncAttribute(el, name) {
    const value = el.getAttribute(name);
    if (value === null) return;
    const records = attrRecords.get(el);
    const record = records?.[name];
    const source = record && value === record[1] ? record[0] : value;
    if (skipped(el)) return;
    const shown = translateText(source);
    const store = records || attrRecords.set(el, {}).get(el);
    if (store) store[name] = [source, shown];
    if (value !== shown) el.setAttribute(name, shown);
  }

  function walk(root) {
    if (root.nodeType === 3) {
      syncText(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) for (const name of ATTRS) if (root.hasAttribute(name)) syncAttribute(root, name);
    const walker = document.createTreeWalker(root, 5);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 3) syncText(node);
      else for (const name of ATTRS) if (node.hasAttribute(name)) syncAttribute(node, name);
    }
  }

  function observe() {
    if (observer) return;
    observer = new MutationObserver((list) => {
      for (const mutation of list) {
        if (mutation.type === 'characterData') syncText(mutation.target);
        else if (mutation.type === 'attributes') syncAttribute(mutation.target, mutation.attributeName);
        else for (const node of mutation.addedNodes) walk(node);
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  }

  // A few labels live in CSS `content` (chat placeholder, picked-card badge), so they are
  // not text nodes; rewrite those rules in place instead of injecting a new <style>.
  function translateStyleSheets() {
    let count = 0;
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules) {
          try {
            visit(rule.cssRules);
          } catch {}
        }
        const content = rule.style?.content;
        if (!content) continue;
        const source = content.replace(/^["']|["']$/g, '');
        const shown = translateText(source);
        if (shown === source || HANGUL.test(shown)) continue;
        rule.style.content = JSON.stringify(shown);
        count++;
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        visit(sheet.cssRules);
      } catch {}
    }
    if (count) console.info(`[FANGUARD 汉化] 已替换 ${count} 条 CSS 文案`);
    return count;
  }

  function installUi(data) {
    if (!uiOn || uiInstalled || !data) return;
    names = data.names || {};
    english = data.meta?.english || {};
    japanese = data.meta?.japanese || {};
    englishPatterns = compileEnglishPatterns(english);
    fallbackTerms = Object.entries(data.meta?.fallback || {}).sort((a, b) => b[0].length - a[0].length);
    terms = {
      ...(data.meta?.nations || {}),
      ...(data.meta?.races || {}),
      ...(data.meta?.types || {}),
      ...(data.meta?.clans || {}),
    };
    compileUi(data.ui);
    uiInstalled = true;
    const start = () => {
      if (document.body) walk(document.body);
      observe();
      translateTitle();
      relabelLanguage();
      translateStyleSheets();
      window.addEventListener('load', translateStyleSheets, { once: true });
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }

  function translateTitle() {
    if (!document.title || !HANGUL.test(document.title)) {
      const en = english[document.title];
      if (en) document.title = en;
      return;
    }
    document.title = translateText(document.title);
  }

  function relabelLanguage() {
    const select = document.getElementById('language');
    const option = select?.querySelector('option[value="ko"]');
    if (option) option.textContent = '中文';
    if (select) {
      for (const item of select.options) {
        if (item.value !== 'ko') item.disabled = true;
      }
      select.title = '汉化插件已固定为中文；关闭“界面汉化/卡牌汉化”并刷新可恢复原文';
    }
  }

  // ---------------------------------------------------------------- page widget

  let uiNode = null;
  function markUi() {
    if (!uiNode) return;
    const detail = stats.total ? `（${stats.cards}/${stats.total}）` : '';
    uiNode.textContent = `卡牌汉化：${cardsOn ? '开' : '关'}${detail}`;
  }

  function installWidget() {
    const menu = document.querySelector('.settings-menu');
    if (!menu || menu.querySelector('[data-fanguard-zh]')) return !!menu;

    uiNode = document.createElement('button');
    uiNode.type = 'button';
    uiNode.id = 'fanguardZhCards';
    uiNode.title = `THE一灭寂 卡牌数据 · ${BUILD.builtAt}\n点击切换并刷新页面`;
    uiNode.addEventListener('click', () => {
      writeFlag(KEYS.cards, !cardsOn);
      location.reload();
    });

    const uiButton = document.createElement('button');
    uiButton.type = 'button';
    uiButton.id = 'fanguardZhUi';
    uiButton.textContent = `界面汉化：${uiOn ? '开' : '关'}`;
    uiButton.title = '把游戏界面、提示与日志中的韩文替换成中文\n点击切换并刷新页面';
    uiButton.addEventListener('click', () => {
      writeFlag(KEYS.ui, !uiOn);
      location.reload();
    });

    const row = document.createElement('label');
    row.className = 'sfx-row';
    row.dataset.fanguardZh = '1';
    row.style.gap = '6px';
    row.append(uiNode, uiButton);
    menu.append(row);
    markUi();
    return true;
  }

  function installWidgetWhenReady() {
    if (!installWidget()) {
      let tries = 0;
      const timer = setInterval(() => {
        if (installWidget() || ++tries > 40) clearInterval(timer);
      }, 250);
    }
  }

  // ---------------------------------------------------------------- boot

  const nativeAlert = window.alert;
  const nativeConfirm = window.confirm;
  const nativePrompt = window.prompt;
  const translateDialog = (text) => {
    try {
      return translateText(String(text ?? ''));
    } catch {
      return text;
    }
  };
  if (uiOn) {
    window.alert = (message, ...rest) => nativeAlert.call(window, translateDialog(message), ...rest);
    window.confirm = (message, ...rest) => nativeConfirm.call(window, translateDialog(message), ...rest);
    window.prompt = (message, defaultValue, ...rest) =>
      nativePrompt.call(window, translateDialog(message), defaultValue, ...rest);
  }

  if (cardsOn) installHook();

  if (anyOn) {
    decodePayload()
      .then((data) => {
        payload = data;
        stats.ready = true;
        if (uiOn) installUi(data);
      })
      .catch((error) => {
        console.error('[FANGUARD 汉化] 译文数据加载失败', error);
      });
  }

  if (cardsOn) {
    let tries = 0;
    const tick = () => {
      if (stats.applied) return;
      const network = globalThis.__vgBrowser;
      if (network?.service && payload) {
        stats.fallback = true;
        if (applyService(network.service, payload)) return;
      }
      if (document.readyState !== 'loading' && !document.getElementById('browserBootError') && !network && ++tries > 200) return;
      if (++tries < 200) setTimeout(tick, 100);
    };
    setTimeout(tick, 100);
  }

  if (uiOn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (payload) installUi(payload);
        installWidgetWhenReady();
      }, { once: true });
    } else {
      if (payload) installUi(payload);
      installWidgetWhenReady();
    }
  } else {
    installWidgetWhenReady();
  }
})();
