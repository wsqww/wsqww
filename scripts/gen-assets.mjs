// gen-assets.mjs:SVG 资产生成器。分两层:核心层(Task 2:调色板/字体/文字转路径/包装器)
// 与模板层(Task 4/5 追加 + 修正波调整:banner 徽章卡带装备条 + main() 入口)。
// 修正波(用户裁决):banner 恐龙改 🦖 emoji <text>(撤像素恐龙路径),renderDinoSvg 与
// assets/site/dino.svg 产物删除;拉丁/数字文本改用 Press Start 2P 路径渲染(中文仍 Fusion)。
// 注:dino-paths.mjs 纯函数库保留(dino.test.mjs 继续覆盖),当前暂未被引用。
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import opentype from 'opentype.js';
import { decompress as woff2Decompress } from 'wawoff2';
// dino-paths.mjs 纯函数库保留:恐龙常量(DINO_COLS/ROWS/FRAMES)修正波后暂未被引用,
// mapToPath 仍用于装备条像素图标
import { mapToPath } from './dino-paths.mjs';

// 调色板:全项目 SVG 资产唯一允许的 12 色,键名与设计文档一致(禁改禁扩)
export const PALETTE = {
  bg: '#12122a',
  panel: '#1a1a3a',
  border: '#e8e8f0',
  purple: '#7b2ff7',
  cyan: '#00d9c0',
  yellow: '#ffd23e',
  dim: '#8f8fa8',
  green: '#4ade80',
  cell: '#161b22',
  cellLit: '#0e4429',
  slot: '#262c36',
  boot: '#05060f',
};

// 子集字体地址:相对本文件定位,任意 cwd 下运行结果一致
const FONT_URL = new URL('./fonts/fusion-pixel-12px.subset.woff2', import.meta.url);
const PS2P_FONT_URL = new URL('./fonts/press-start-2p.subset.ttf', import.meta.url);
// 字体惰性缓存:同一进程内多次 loadFont()/loadFontPS() 只解析一次
let fontCache = null;
let psFontCache = null;
// 字体→像素网格注册表:textToPath 守卫按字体区分(Fusion 12px 网格 → 12 倍数字号;
// Press Start 2P 8px 网格 → 8 倍数字号);未注册字体按 12 处理(兼容旧调用)。
const GRID_BY_FONT = new WeakMap();

// 职责:加载并解析 fusion 子集像素字体(WOFF2);参数:无;返回:Promise<opentype.Font>;副作用:首次调用读文件并写入 fontCache 与网格注册表
// 注:opentype.js v1.3.4 不解析 WOFF2 容器,先经 wawoff2 解压回 TTF 再 parse
// (复用 Task 1 font.test.mjs 中 loadFontTTF 已验证的解压路径)。
export async function loadFont() {
  if (fontCache) { return fontCache; }
  const buf = await readFile(FONT_URL);
  const ttf = await woff2Decompress(buf);
  fontCache = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
  GRID_BY_FONT.set(fontCache, 12);
  return fontCache;
}

// 职责:加载并解析 Press Start 2P 子集字体(直接 TTF,无需解压);参数:无;
// 返回:Promise<opentype.Font>;副作用:首次调用读文件并写入 psFontCache 与网格注册表(8px 网格)
export async function loadFontPS() {
  if (psFontCache) { return psFontCache; }
  const buf = await readFile(PS2P_FONT_URL);
  psFontCache = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  GRID_BY_FONT.set(psFontCache, 8);
  return psFontCache;
}

// PS2P 缺字形字符的 ASCII 替代(HI-SCORE ★→+ 沿用 Task 5 既定兜底;▶/▸→> 街机光标写法);
// 未知缺字形字符直接抛错,禁止 tofu 字形进入入库资产
const PS2P_SUBS = { '★': '+', '▶': '>', '▸': '>' };
// 职责:把待渲染文本中的 PS2P 缺字形字符替换为既定 ASCII 替代;参数:ps 字体实例、text 原文本;
// 返回:替换后的文本;副作用:无(遇到无替代的缺字形字符抛错)
export function ps2pText(ps, text) {
  let out = '';
  for (const ch of text) {
    if (ps.charToGlyph(ch).index !== 0) { out += ch; continue; }
    const sub = PS2P_SUBS[ch];
    if (!sub) { throw new Error(`Press Start 2P 缺字形且无替代字符: ${ch}`); }
    out += sub;
  }
  return out;
}

// 职责:把文本转成 SVG path 的 d 属性(资产文字像素级跨平台一致的关键);参数:font 字体实例、
// text 文本、size 字号(必须为字体像素网格的倍数:fusion 12、PS2P 8)、x/y 基线起点;
// 返回:d 字符串;副作用:无(size 非法直接 throw)
export function textToPath(font, text, size, x, y) {
  const grid = GRID_BY_FONT.get(font) ?? 12;
  if (size <= 0 || size % grid !== 0) { throw new Error(`size 必须是 ${grid} 的倍数,收到: ${size}`); }
  return font.getPath(text, x, y, size).toPathData(1);
}

// 职责:测量文本渲染宽度,供居中/排布计算;参数:font 字体实例、text 文本、size 字号;返回:数值宽度;副作用:无
export function measure(font, text, size) {
  return font.getAdvanceWidth(text, size);
}

// 职责:包一层合法 SVG 根元素;参数:w/h 画布尺寸、body 内容元素、defs <defs> 内部内容(可空);
// 返回:完整 SVG 文本;副作用:无
export function svgWrap(w, h, body, defs = '') {
  const defsTag = defs ? `<defs>${defs}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defsTag}${body}</svg>`;
}

// ---- README 资产模板(Task 4;Task 5 的卡带与装备条继续追加在本区之后、main() 之前) ----

// 职责:估算混合文本宽度:子集字体有字形的字符按真实步进,无字形(中文等)按全宽 size 估算;
// 参数:font 字体实例、text 文本、size 字号;返回:数值宽度;副作用:无
function measureMixed(font, text, size) {
  let w = 0;
  for (const ch of text) {
    w += font.charToGlyph(ch).index !== 0 ? font.getAdvanceWidth(ch, size) : size;
  }
  return w;
}

// 职责:渲染 README 开机横幅 830x210(深空蓝底+扫描线+🦖 emoji 恐龙 52px(系统 emoji 栈)+
// 居中标题 36px 白(中文 Fusion 路径)+副标题 8px 暗淡(PS2P 路径)+右下 PRESS START 8px 黄
// SMIL 离散闪烁);
// 参数:font fusion 字体、ps PS2P 字体;返回:完整 SVG 字符串;副作用:无
export function renderBanner(font, ps) {
  const W = 830;
  const H = 210;
  const TITLE = '王汪汪的存档点';
  const SUB = 'WOOF-WOOF ARCADE · PLAYER 1 · WSQWW';
  const titleX = Math.round((W - measure(font, TITLE, 36)) / 2);
  const subX = Math.round((W - measure(ps, SUB, 8)) / 2);
  // 恐龙区域(修正波前像素恐龙占 48,68 起 70x75),emoji 52px 在该区域内居中放置
  const dinoX = 48;
  const dinoW = 70;
  const dinoY = 68;
  const emojiSize = 52;
  const emojiX = dinoX + Math.round((dinoW - emojiSize) / 2);
  const emojiY = dinoY + emojiSize;
  const psText = 'PRESS START';
  const psX = W - 24 - measure(ps, psText, 8);
  const body =
    `<desc>王汪汪的存档点 · WOOF-WOOF ARCADE</desc>` +
    `<rect width="${W}" height="${H}" fill="${PALETTE.bg}"/>` +
    `<rect width="${W}" height="${H}" fill="url(#scan)"/>` +
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="${PALETTE.border}" stroke-width="2"/>` +
    `<text x="${emojiX}" y="${emojiY}" font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif" font-size="${emojiSize}">🦖</text>` +
    `<path d="${textToPath(font, TITLE, 36, titleX, 108)}" fill="${PALETTE.border}"/>` +
    `<path d="${textToPath(ps, ps2pText(ps, SUB), 8, subX, 150)}" fill="${PALETTE.dim}"/>` +
    `<g><path d="${textToPath(ps, ps2pText(ps, psText), 8, psX, 186)}" fill="${PALETTE.yellow}"/>` +
    `<animate attributeName="opacity" values="1;0" dur="1s" calcMode="discrete" repeatCount="indefinite"/></g>`;
  const defs =
    `<pattern id="scan" width="1" height="4" patternUnits="userSpaceOnUse">` +
    `<rect width="1" height="2" fill="rgba(232,232,240,.05)"/></pattern>`;
  return svgWrap(W, H, body, defs);
}

// 职责:渲染三枚状态铭牌徽章条(黄底标签=PS2P 8px 路径深字;深底值区=<text> 系统黑体白字);
// 宽度全部由 measure/measureMixed 计算,禁止写死;参数:font fusion 字体、ps PS2P 字体;
// 返回:完整 SVG 字符串;副作用:无
export function renderBadges(font, ps) {
  const ROWS = [
    ['LOCATION', '上海 · UTC+8'],
    ['CLASS', 'Frontend → Agent'],
    ['DOMAIN', 'shuaiqiang.wang'],
  ];
  const H = 36;
  const GAP = 16;
  const PAD = 12;
  const badges = ROWS.map(([label, value]) => {
    const labelW = Math.round(measure(ps, label, 8)) + PAD * 2;
    const valueW = Math.round(measureMixed(font, value, 12)) + PAD * 2;
    return { label, value, labelW, w: labelW + valueW };
  });
  const W = badges.reduce((s, b) => s + b.w, 0) + GAP * (badges.length - 1);
  let x = 0;
  let body = '';
  for (const b of badges) {
    body +=
      `<rect x="${x + 4}" y="4" width="${b.w}" height="${H}" fill="${PALETTE.boot}"/>` +
      `<rect x="${x}" y="0" width="${b.w}" height="${H}" fill="${PALETTE.panel}" stroke="${PALETTE.border}" stroke-width="2"/>` +
      `<rect x="${x}" y="0" width="${b.labelW}" height="${H}" fill="${PALETTE.yellow}"/>` +
      `<path d="${textToPath(ps, b.label, 8, x + PAD, 23)}" fill="${PALETTE.bg}"/>` +
      `<text x="${x + b.labelW + PAD}" y="23" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="${PALETTE.border}">${b.value}</text>`;
    x += b.w + GAP;
  }
  return svgWrap(W + 4, H + 4, body);
}

// ---- 卡带与装备条模板(Task 5;修正波:拉丁文本改 PS2P 路径,中文仍 <text> 系统黑体) ----

// 职责:渲染单盘 400x300 游戏卡带(panel 底+2px 白描边+accent 4px 硬阴影垫底+顶部三条插口纹+
// 名称 24px accent PS2P 路径+中文简介 <text> 系统黑体白字+标签行 PS2P 8px+HI-SCORE 8px 黄+
// accent 页脚链接 PS2P 8px);
// 参数:font fusion 字体、ps PS2P 字体;opts: accent 主题色 / nameLatin 拉丁名 / taglineCN 中文简介 /
// tags 标签行文本 / tagsIsChinese 标签行是否走 <text> 中文渲染 / stars 星数 / footer{prefix,target} 页脚;
// 返回:完整 SVG 字符串;副作用:无(★/▶ 缺字形时按 ps2pText 替代为 +/-;desc 保留机读 HI-SCORE 供测试与辅助技术)
function makeCartridge(font, ps, opts) {
  const W = 400;
  const H = 300;
  const PAD = 24;
  // 页脚一行放不下则拆两行(域名单独一行),保证任何字形宽度假设下都不溢出
  const footText = ps2pText(ps, `${opts.footer.prefix} ${opts.footer.target}`);
  const footPrefix = ps2pText(ps, opts.footer.prefix);
  const oneLine = measure(ps, footText, 8) <= W - PAD * 2;
  const footSvg = oneLine
    ? `<path d="${textToPath(ps, footText, 8, PAD, 224)}" fill="${opts.accent}"/>`
    : `<path d="${textToPath(ps, footPrefix, 8, PAD, 224)}" fill="${opts.accent}"/>` +
      `<path d="${textToPath(ps, ps2pText(ps, opts.footer.target), 8, PAD, 244)}" fill="${opts.accent}"/>`;
  const tagsSvg = opts.tagsIsChinese
    ? `<text x="${PAD}" y="168" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="${PALETTE.dim}">${opts.tags}</text>`
    : `<path d="${textToPath(ps, ps2pText(ps, opts.tags), 8, PAD, 168)}" fill="${PALETTE.dim}"/>`;
  const hiLine = ps2pText(ps, `HI-SCORE ★ ${opts.stars}`);
  const body =
    `<desc>${hiLine}</desc>` +
    `<rect x="4" y="4" width="${W}" height="${H}" fill="${opts.accent}"/>` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${PALETTE.panel}" stroke="${PALETTE.border}" stroke-width="2"/>` +
    `<rect x="${PAD}" y="16" width="${W - PAD * 2}" height="4" fill="${PALETTE.slot}"/>` +
    `<rect x="${PAD}" y="24" width="${W - PAD * 2}" height="4" fill="${PALETTE.slot}"/>` +
    `<rect x="${PAD}" y="32" width="${W - PAD * 2}" height="4" fill="${PALETTE.slot}"/>` +
    `<path d="${textToPath(ps, ps2pText(ps, opts.nameLatin), 24, PAD, 96)}" fill="${opts.accent}"/>` +
    `<text x="${PAD}" y="136" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="${PALETTE.border}">${opts.taglineCN}</text>` +
    tagsSvg + footSvg +
    `<path d="${textToPath(ps, hiLine, 8, PAD, 272)}" fill="${PALETTE.yellow}"/>`;
  return svgWrap(W + 4, H + 4, body);
}

// 职责:渲染两盘项目卡带(panoscape 紫/★0、blindshake 青/★1,文案与 spec §5.3 一致);
// 参数:font fusion 字体、ps PS2P 字体;返回:SVG 字符串数组 [panoscape, blindshake];副作用:无
export function renderCartridges(font, ps) {
  return [
    makeCartridge(font, ps, {
      accent: PALETTE.purple,
      nameLatin: 'PANOSCAPE',
      taglineCN: '境游 · 3D 全景景区游览',
      tags: 'MapLibre × three.js × TypeScript',
      tagsIsChinese: false,
      stars: 0,
      footer: { prefix: '▶ PLAY', target: 'panoscape.shuaiqiang.wang' },
    }),
    makeCartridge(font, ps, {
      accent: PALETTE.cyan,
      nameLatin: 'BLINDSHAKE',
      taglineCN: '摇摇瞎选 · 摇一摇随机决策小程序',
      tags: '微信小程序 · 原生 JS · 加权随机',
      tagsIsChinese: true,
      stars: 1,
      footer: { prefix: '▶ REPO', target: 'github.com/wsqww/blindshake' },
    }),
  ];
}

// 8x8 像素图标('.'=空 '#'=白 'o'=黄):地图 / 手机 / 机器人(Agent)
const ICON_MAP = [
  '########',
  '#...o..#',
  '#..o...#',
  '#.o....#',
  '#o.....#',
  '#......#',
  '#......#',
  '########',
];
const ICON_PHONE = [
  '.######.',
  '.#....#.',
  '.#.##.#.',
  '.#....#.',
  '.#.##.#.',
  '.#....#.',
  '.#..o.#.',
  '.######.',
];
const ICON_ROBOT = [
  '....#...',
  '.######.',
  '.#....#.',
  '.#o..o#.',
  '.#....#.',
  '.######.',
  '..#..#..',
  '..#..#..',
];

// 职责:渲染六槽装备条(TS/JS/3D PS2P 8px 文字图标 + 地图/手机/机器人 8x8 像素画,24x24 槽/间距 16;
// Agent 槽黄虚线描边 + 右上「进行中」黄字小标 + 黄名称;拉丁名称 PS2P 8px 路径,中文名称 <text> 12px);
// 参数:font fusion 字体、ps PS2P 字体;返回:完整 SVG 字符串;副作用:无
export function renderEquipStrip(font, ps) {
  const SLOT = 24;
  const GAP = 16;
  const PAD = 16;
  const CELL = 2;
  const ITEMS = [
    { iconText: 'TS', name: 'TypeScript' },
    { iconText: 'JS', name: 'JavaScript' },
    { iconText: '3D', name: 'three.js' },
    { iconPx: ICON_MAP, name: 'MapLibre' },
    { iconPx: ICON_PHONE, name: '小程序' },
    { iconPx: ICON_ROBOT, name: 'Agent Lv.1', lv: true },
  ];
  // 列宽取「槽位最小宽」与「名称宽」的较大者,保证名称互不挤压;
  // 中文名称走 <text> 12px(fusion 度量),拉丁名称走 PS2P 8px 路径(PS2P 度量)
  const cols = ITEMS.map((it) => {
    const isCN = /[\u4e00-\u9fff]/.test(it.name);
    const nameW = Math.round(measureMixed(isCN ? font : ps, it.name, isCN ? 12 : 8)) + 16;
    return { ...it, isCN, colW: Math.max(SLOT + 16, nameW) };
  });
  const W = PAD * 2 + cols.reduce((s, c) => s + c.colW, 0) + GAP * (cols.length - 1);
  const H = 76;
  const slotY = 22;
  let x = PAD;
  let body = '';
  for (const c of cols) {
    const slotX = x + Math.round((c.colW - SLOT) / 2);
    body +=
      `<rect x="${slotX}" y="${slotY}" width="${SLOT}" height="${SLOT}" fill="${PALETTE.cell}" stroke="${c.lv ? PALETTE.yellow : PALETTE.slot}" stroke-width="2"${c.lv ? ' stroke-dasharray="3 3"' : ''}/>`;
    // 图标:像素画按格转 path(白体+黄点),文字图标按 PS2P 8px 转 path,均在槽内居中
    if (c.iconPx) {
      body +=
        `<path d="${mapToPath(c.iconPx, CELL, slotX + 4, slotY + 4, '#')}" fill="${PALETTE.border}"/>` +
        `<path d="${mapToPath(c.iconPx, CELL, slotX + 4, slotY + 4, 'o')}" fill="${PALETTE.yellow}"/>`;
    } else {
      const tw = Math.round(measure(ps, c.iconText, 8));
      body += `<path d="${textToPath(ps, c.iconText, 8, slotX + Math.round((SLOT - tw) / 2), slotY + 16)}" fill="${PALETTE.border}"/>`;
    }
    // 名称:含中文走 <text> 系统黑体 12px,纯拉丁走 PS2P 8px 路径;Agent 槽名称黄色
    const nx = x + Math.round((c.colW - Math.round(measureMixed(c.isCN ? font : ps, c.name, c.isCN ? 12 : 8))) / 2);
    const nameFill = c.lv ? PALETTE.yellow : PALETTE.dim;
    body += c.isCN
      ? `<text x="${nx}" y="62" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="${nameFill}">${c.name}</text>`
      : `<path d="${textToPath(ps, ps2pText(ps, c.name), 8, nx, 62)}" fill="${nameFill}"/>`;
    // 「进行中」小黄标:悬浮于 Agent 槽右上角(黄描边小牌 + 黄字)
    if (c.lv) {
      const bw = Math.round(measureMixed(font, '进行中', 12)) + 10;
      body +=
        `<rect x="${slotX + SLOT - 6}" y="6" width="${bw}" height="14" fill="${PALETTE.cell}" stroke="${PALETTE.yellow}" stroke-width="1"/>` +
        `<text x="${slotX + SLOT - 1}" y="17" font-family="PingFang SC, Microsoft YaHei, sans-serif" font-size="12" fill="${PALETTE.yellow}">进行中</text>`;
    }
    x += c.colW + GAP;
  }
  return svgWrap(W, H, body);
}

// ---- 入口(修正波版:README 5 个产物;dino.svg 已随裁决 1 删除) ----

// 职责:生成并写出全部 SVG 资产;参数:无;返回:Promise<void>;
// 副作用:创建 assets/readme/ 目录,写出 5 个 SVG 文件,stdout 打印清单
async function main() {
  const font = await loadFont();
  const ps = await loadFontPS();
  const outDir = new URL('../assets/', import.meta.url);
  await mkdir(new URL('./readme/', outDir), { recursive: true });
  const cartridges = renderCartridges(font, ps);
  const files = [
    ['readme/banner.svg', renderBanner(font, ps)],
    ['readme/status-badges.svg', renderBadges(font, ps)],
    ['readme/cartridge-panoscape.svg', cartridges[0]],
    ['readme/cartridge-blindshake.svg', cartridges[1]],
    ['readme/equip-strip.svg', renderEquipStrip(font, ps)],
  ];
  for (const [rel, svg] of files) {
    await writeFile(new URL(rel, outDir), svg);
  }
  console.log(`gen ok: ${files.map((f) => `assets/${f[0]}`).join(' ')}`);
}

// 直接运行守卫:仅 `node scripts/gen-assets.mjs` 直接执行时才写盘;被测试 import 时不重写产物,
// 保证 gen-assets.test.mjs 的"磁盘产物与生成结果一致"断言真实有效(评审修复 Important-1)。
if (import.meta.url === pathToFileURL(process.argv[1]).href) { await main(); }
