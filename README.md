# FANGUARD 简体中文汉化插件

给 `FANGUARD · D Fight Simulator`（在线版 `fanguard-d.pages.dev`）用的 Tampermonkey 用户脚本。

- **卡名 / 卡文**：取自 [THE一灭寂 · 先导者卡牌资料站](https://vgcard.yimieji.com/) 的官方中文数据，按卡号匹配，日文名兜底。
- **界面**：把游戏界面、提示、日志、卡组编辑、对战板、设置、更新日志等韩文/英文/少量日文标签替换成简体中文；以 `FANGUARD中文汉化包 v3.2` 的韩→中词典为主，术语统一到资料站用词。
- **不改规则**：只写 `name.ko` / `text.ko`（显示字段），规则判定使用的 `name.ja` / `name.en` / `text.ja` 保持原样。

当前页面数据（`FANGUARD · D Fight Simulator2.html`，7592 张卡）：

| 项目                       | 数量                 |
| -------------------------- | -------------------- |
| 卡名 + 卡文                | 7449 / 7592（98.1%） |
| 中文卡文                   | 7099 张              |
| 明确无效果（清空）         | 350 张               |
| 未找到中文数据（保留原文） | 143 张               |
| 界面词条                   | 2629 条              |

未匹配的基本是资料站尚未收录的赛事 promo、最新补充包或联名卡；这些卡会保留原卡名/卡文，不影响游戏运行。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)（Chrome / Edge / Firefox）。
2. 把 [`dist/fanguard-zh.user.js`](./dist/fanguard-zh.user.js) 拖进浏览器，或新建脚本后粘贴内容。
3. 打开 [https://fanguard-d.pages.dev/](https://fanguard-d.pages.dev/)。

> 页面带有 `script-src` 哈希 CSP。Tampermonkey 通常会用扩展注入接口绕过它；如果卡名没有变化，在 Tampermonkey 设置里把注入模式改成「Content Script API / 用户脚本 API」。

首次加载会解压约 1.3 MB 的译文数据（压缩后脚本约 0.92 MB），之后走浏览器缓存。

## 页面内开关

右上角 ⚙ 设置菜单里会多出两个按钮：

- **卡牌汉化：开/关（已应用/词典条数）**
- **界面汉化：开/关**

点击会写入 `localStorage` 并刷新页面：

- `fanguard-zh:cards`：卡名/卡文汉化
- `fanguard-zh:ui`：界面汉化

游戏语言会被固定为韩语字段（`vg-language=ko`），因为只有该字段会被替换成中文；设置里的「游戏语言」会显示为「中文」，英文/日文选项被禁用。关闭两个汉化开关并刷新即可恢复原文 —— **两个开关都关掉时，设置菜单里的两个按钮仍然保留**（脚本只停止翻译，不再整体退出），随时可以再点回「开」。

如果旧版脚本已经让两个开关都关掉、按钮消失，在页面控制台执行：

```js
localStorage.setItem('fanguard-zh:cards', '1');
localStorage.setItem('fanguard-zh:ui', '1');
location.reload();
```

或直接清掉这两个键（`localStorage.removeItem('fanguard-zh:cards'); localStorage.removeItem('fanguard-zh:ui')`，缺省即为开）后刷新。

## 目录结构

```
fanguard-zh/
├─ src/userscript.template.js       用户脚本模板（构建时填入压缩译文）
├─ dist/fanguard-zh.user.js         构建产物（装进 Tampermonkey 的就是它）
├─ data/
│  ├─ translations.json             自动生成的卡名/卡文（卡号 → [中文名, 中文卡文或 null]）
│  ├─ translations.template.csv     手工校对模板（卡号 + 英/日文名 + 空的中文列）
│  ├─ card-text-overrides.json      资料站没有卡文时的韩文→中文补充（触发器、无效果等）
│  ├─ ui-zh-ko.json                 韩→中界面词典（自 FANGUARD中文汉化包 v3.2 导入，已按本项目术语归一）
│  ├─ ui-overrides.json             界面词条人工修正（优先级最高）
├─ build/
│  ├─ yimieji-cards.json            资料站全量卡表（15,723 条）
│  ├─ cards.json                    游戏卡表（含韩文原文）
│  ├─ meta.json                     国家/种族/类型/氏族、静态英文、日文区域名映射
│  ├─ ui-zh-en.json                 界面词典（英→中机器翻译基础）
│  ├─ static-zh.json                静态 HTML 英文→中文
│  ├─ patch-zh.json                 更新日志韩文→中文
│  └─ unmatched-cards.json          未匹配到中文数据的卡
├─ tools/
│  ├─ fetch-yimieji.mjs             下载资料站卡表
│  ├─ extract-cards.mjs             从页面 HTML 抽出卡表
│  ├─ build-card-translations.mjs   卡号/日文名匹配 → data/translations.json
│  ├─ build-meta.mjs                生成国家/种族/类型/氏族等映射
│  ├─ build.mjs                     打包 → dist/fanguard-zh.user.js（译文全部内联）
│  ├─ import-ui-ko.mjs              从参考汉化包导入韩→中界面词典 → data/ui-zh-ko.json
│  ├─ translate-ui-en.py            界面词典英→中
│  ├─ translate-ui.py               界面词典韩→中（备用基础）
│  ├─ translate-ui-patterns.py      修正带 {} / {n} 占位符的词条
│  ├─ translate-static.py           静态 HTML 英文→中
│  ├─ extract-static-text.py        抽取静态英文
│  ├─ extract-patch-notes.py        抽取更新日志韩文
│  ├─ translate-patch.py            更新日志韩→中
│  └─ lib/                          CSV/XLSX/JSON 读取与卡号匹配
└─ package.json
```

## 重新构建

页面更新后，按顺序执行：

```powershell
cd d:\Download\fanguard-zh

# 1. 资料站卡表（首次或需要更新中文数据时）
node tools/fetch-yimieji.mjs

# 2. 页面卡表（默认取目录里最新的 FANGUARD*.html，也可显式传路径）
node tools/extract-cards.mjs "d:\Download\FANGUARD · D Fight Simulator2.html"

# 3. 卡号匹配 → data/translations.json
node tools/build-card-translations.mjs

# 4. 界面词典（有缓存，增量翻译）
python tools/translate-ui-en.py
python tools/translate-static.py
python tools/extract-patch-notes.py
python tools/translate-patch.py

# 4.5 需要同步参考汉化包时（可选，会覆盖自动翻译里的同一词条）
node tools/import-ui-ko.mjs "…\FANGUARD中文汉化包_v3.2_2026-11-02\fanguard-zh-ui.user.js"

# 5. 生成映射并打包
node tools/build-meta.mjs "d:\Download\FANGUARD · D Fight Simulator2.html"
node tools/build.mjs
```

也可以直接用 `npm run` 快捷命令（见 `package.json`）。

### 手工修正

- **卡名/卡文**：在 `data/translations.json` 里按卡号改，或准备 `data/translations.csv`（列名 `id,zh_name,zh_text`），构建时会覆盖自动结果。
- **界面**：在 `data/ui-overrides.json` 里加 `"韩文原文": "中文"`；支持 `{}` / `{n}` 占位符（翻译里用 `{0}`、`{1}`），例如：
  ```json
  "선택 {} 라이드": "选择 {0} 骑乘",
  "P{n} {} {n}장 목록 열기": "打开 P{0} {1} 列表（{2}）"
  ```

  词条优先级（后者覆盖前者）：`build/ui-zh-en.json`（机器翻译）→ `build/patch-zh.json` → `data/ui-zh-ko.json`（参考汉化包）→ `data/ui-overrides.json`（人工修正）。同一个词条改哪一层都行，但只有 `data/` 下的两个文件不会被机器翻译流程覆盖；`tools/build.mjs` 里的术语表（glossary）只用于规整机器翻译，`data/` 下的词典被视为已校对，不会再被改写。
- **CSS 文案**：少数文字写在样式表的 `content:` 里（如聊天栏「还没有消息。」、选中标记「✓ 选择」），脚本会直接改对应 CSS 规则；这类词条同样写在 `data/ui-overrides.json` 里，键为去掉引号的原文。
- **无卡文卡片**：`data/card-text-overrides.json` 按韩文原文映射；值为空字符串表示明确无效果。

## 工作原理

1. 脚本在 `document-start` 读取 `localStorage`，把 `vg-language` 写成 `ko`（在线页启动时读取）。
2. 拦截 `globalThis.VanguardBrowser.connect()`：在 `BrowserService` 构造完成、页面首次渲染之前，把每张卡的 `name.ko` / `text.ko` 换成中文，并重建卡组编辑器的搜索索引；`racesKo`、种族/类型/氏族等仅用于显示的字段也一并翻译。
3. 界面层用 `MutationObserver` 翻译 DOM：先查精确词条，再匹配 `{}` / `{n}` 模式，最后按分隔符拆分；同时处理 `title`、`aria-label`、`placeholder` 等属性，以及样式表 `content:` 里的固定文案。英文静态标签、日文区域名和更新日志有单独的词表。
4. 卡牌名称/效果容器带 `translate="no"`，界面层不会改动它们；卡文由第 2 步的数据替换。

## 游戏更新后同步新卡

```powershell
cd d:\Download\fanguard-zh
node tools/update.mjs --fetch-cards
```

`update.mjs` 会依次：下载线上页面 → 抽出新卡表 → 刷新资料站中文卡库（`--fetch-cards`）→ 卡号/日文名匹配 → 重建映射 → 打包 `dist/fanguard-zh.user.js`，末尾打印「未匹配到中文的卡 N 张」。

- **能自动完成**：新卡的卡名/卡文（资料站已收录时，按卡号或日文名匹配）、种族/氏族/指令种类、卡组编辑器搜索索引。
- **不能自动完成**：全新界面文案（新版本新增的按钮/提示）和资料站还没收录的卡（会保留韩文），需要补 `data/ui-overrides.json` 或等资料站更新后重跑。

> 译文数据全部打进 `.user.js`；脚本**不做任何远端同步、不发起任何网络请求**。同步新卡后需要把新的 `.user.js` 重新装进 Tampermonkey。

## 启用自动更新发布

本地导入的脚本仍可照常使用。推送到 GitHub 公开仓库后，工作流会自动使用默认分支的脚本地址，例如
`https://raw.githubusercontent.com/OWNER/REPO/main/dist/fanguard-zh.user.js`。
需要确保仓库允许工作流提交到默认分支，并且该地址对脚本使用者可读。

发布后，可在 **Actions → Update FANGUARD userscript** 手动运行一次；
此后每天北京时间约 10:23 检查。译文或脚本内容变化时才升版和提交，抓取或构建失败时保留已发布版本。
第一次发布成功后，从设置的地址在篡改猴中安装一次，并确认脚本的更新检查已开启。


## 测试

只在线上验证：[https://fanguard-d.pages.dev/](https://fanguard-d.pages.dev/)

```powershell
cd d:\Download\fanguard-zh
node tools/build.mjs
```

构建后把 `dist/fanguard-zh.user.js` 装进 Tampermonkey，刷新线上页面即可；不再生成或使用离线副本。

## 已验证

- 线上页面（`https://fanguard-d.pages.dev/`）加载用户脚本；
- 单人双人同屏完整走完换牌 → 骑乘 → 主阶段 → 战斗阶段，界面无韩文残留；
- 卡组编辑、卡片详情、Deck Log 导入、设置菜单、更新日志、网络对战连接窗、各确认弹窗均为中文；
- 卡名/卡文/种族/国家/纹章/触发类型全部取自资料站中文；规则判定使用日/英字段，未受影响。

## 已知限制

- 界面词条以 `FANGUARD中文汉化包 v3.2` 的韩→中词典为主（2088 条），其余为机器翻译 + 人工术语修正，个别句子可能偏直译；重要术语（先导者、后防者、骑乘、CALL、计数爆发、灵魂爆发、超限舞装、纹章、☆、护盾、封存、横置/竖置等）已统一。
- 参考词典使用「骑升 / 封存 / 暴击 / 回复 / 呼唤」等另一套译法，导入时会自动改成「骑乘 / 封存 / ☆ / 治疗 / CALL」。
- **Critical 统一写作「☆」**，与 THE一灭寂 卡文一致（资料站用「☆+1」「☆值」「原始☆值」，从不写「关键」）。转换按韩文原文里的 `크리티컬` / `クリティカル` 判定，因此「关键词」「关键技能」这类非 Critical 的「关键」保持原样；卡名里的「关键」（如「绝不能没有的关键之物」）属于官方卡名，不改。
- **Lock 统一写作「咒缚 / 解咒」**（韩文 `록` / `주박` / `언록`），与资料站卡文一致（26 张卡用「咒缚」、22 张用「解咒」）；早期的「锁」「锁定」「解除咒缚」等写法已全部改掉。
- **Bind 统一写作「封存 / 封存区」**（韩文 `바인드`，英文 BIND）。资料站卡文原作「封锁」，构建 `data/translations.json` 时会统一替换成「封存」；两者是同一机制的两种译法。
- **阶段条与阶段切换横幅**保留游戏原文的英文（`MULLIGAN / RIDE / MAIN / BATTLE / GUARD / END`，横幅为 `阶段名 + PHASE`），因为韩文/日文界面本来也是这套英文；只有游戏里写成韩文的 `턴 시작` / `스탠드` / `가위바위보` 译成「回合开始 / 重置 / 猜拳」。`#phase`、`#battleFx`、`.ride-go`（RIDE 按钮，按钮宽度只够 4 个字母）内的英文不再走界面词典，避免 `MAIN`→「主卡组」、`BATTLE`→「战斗阶段阶段」这类错译；说明性长句仍用「主要阶段 / 结束阶段」。
- **触发 chip**（对战侧栏 `.chip.trigger`）原本是英文 `NORMAL / OVER / CRITICAL / STAND / FRONT / DRAW / HEAL`，现已按触发种类译为「普通 / 超 / ☆ / 重置 / 前列 / 抽卡 / 治疗」；「CRITICAL · 卡名」这类混合串会拆段翻译。
- **自动能力提示里的 `계기:`**（英 `Trigger:`、日 `契機:`）统一译作「触发事件」，参考汉化包原译「计数器」是误译（`계기` 不是 `계수기/카운터`）；同一提示里的「位置 / 目标卡 / 等待顺序」保持四字标签。
- **费用类关键词**按资料站卡文统一：`카운터 블래스트`→计数爆发、`카운터 차지`→计数回充、`소울 차지`→灵魂填充、`에너지 차지`→能量填充。`tools/build.mjs` 的 `TERM_FIXES` 会对所有界面词条（含参考词典与更新日志）再跑一遍归一，参考包的「反击爆发 / 反击冲锋 / 充填」等写法不会再出现。
- **触发 / 区域 / 圆阵**：「触发器」统一为「触发」（抽卡触发、治疗触发、超触发），判定区按卡文作「触发区」；圆阵位置统一「前列 / 后列」「对方前列 R 左」，不再出现「前排 / 后排 / RC」。人格护盾写作「人格护盾」（不写「假面盾」或「人格防御」）。
- **chip 的种族/种类**：`국가 \ 氏族 \ 类型 \ 种族` 里的种族与指令种类名原来大量是韩文（约 140 种种族、70 种种指令种类）。现在用「日文种族名 → 中文」映射（`meta.jpRaces`）+ 手工术语表补全，覆盖 471 个种族、108 个类型，chip 中已无韩文。
- **人格RIDE**：`페르소나 라이드` 原译「人格骑乘」（机翻痕迹），已按卡文统一为「人格RIDE」。
- **Ride 统一写作「骑升」**（`라이드` → 骑升 / 骑升卡组 / 骑升阶段 / 骑升费用）；场地上的骑升格小字保留游戏原文「ライドデッキ」，大字显示「骑升区」，RIDE 按钮保留游戏原文「RIDE」。卡文仍用资料站原文的「RIDE」（1359 张），因为那是官方卡文写法。
- **场地格上下两行**：小字是游戏硬编码的日文区域名（`クレストゾーン` / `オーダーゾーン` / `ダメージゾーン` / `トリガーゾーン` / `山札ゾーン` / `ライドデッキ` / `ドロップゾーン` / `バインドゾーン`），所有语言下都不翻译、保留日文；大字统一成「XX区」：纹章区 / 指令区 / 伤害区 / 触发区 / 牌堆区 / 骑升区 / 弃牌区 / 封存区（回忆模式为「回忆区」）。
- **回忆区（`思い出` / Memory）**不是独立区域：D-BT12/EX31『五等分的回忆』纹章让指令区同时具有「回忆区」含义（CR 17.15）。汉化沿用资料站译法「回忆区」，场地格大字「回忆区」、区域标题「回忆 / 指令区」、动作「放入回忆区」；非〈五胞胎〉的卡会被改放到弃牌区。
- **区域列表无障碍名**：`P{n} {} {n}장 목록 열기` 的通配符遇到带空格的区域名会断词，已为骑升 / 指令 / 触发 / 伤害 / 公开卡牌 / 怪物 BOX / 必杀技 / 纹章 / D 双斗伙伴 / 各计量补显式词条（`data/ui-overrides.json`）。
- **Mulligan 统一写作「调度」**（`멀리건` → 调度 / 确认调度；阶段条上的 `MULLIGAN` 按上一条保留英文）；开局确认按钮带张数时显示「确认调度 · N 张」，不再出现「替换」字样。
- 更新日志只翻译当前页面内置的版本，且仍是机器翻译；游戏更新后需要重新抽取/翻译。
- 资料站未收录的 143 张卡保留原文。
- 只匹配 `https://fanguard-d.pages.dev/*`；不再提供离线副本。

## 致谢

- 卡名/卡文数据：[THE一灭寂 · 先导者卡牌资料站](https://vgcard.yimieji.com/)
- 界面韩→中词典：[FANGUARD中文汉化包 v3.2 (2026-11-02)](https://fanguard-d.pages.dev/)（已按本项目术语归一）
- 游戏本体：FANGUARD · D Fight Simulator
