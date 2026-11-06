// gen-assets.test.mjs:验证 SVG 资产的存在/根元素合法性/色板合规/SMIL 结构/生成确定性/网格守卫。
// 输入: assets/ 下产物与 gen-assets.mjs 导出的渲染函数;输出: 断言结果;副作用: 无
// (确定性用例按派单澄清改为内存内调用导出函数生成两次比对,不重复写盘、不起子进程)。
// 修正波:恐龙 emoji 化(banner 断言 🦖 <text>)、dino.svg 用例删除(产物已随裁决 1 移除)、
// 产物确定性改回 5 文件、新增 textToPath 按字体网格守卫与 ps2pText 替代表用例。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const FILES = {
  banner: 'assets/readme/banner.svg',
  badges: 'assets/readme/status-badges.svg',
  pano: 'assets/readme/cartridge-panoscape.svg',
  blind: 'assets/readme/cartridge-blindshake.svg',
  equip: 'assets/readme/equip-strip.svg',
};
const ALLOWED_HEX = new Set([
  '#12122a', '#1a1a3a', '#e8e8f0', '#7b2ff7', '#00d9c0', '#ffd23e',
  '#8f8fa8', '#4ade80', '#161b22', '#0e4429', '#262c36', '#05060f',
]);

// 职责:断言 SVG 文本颜色全部落在 12 色板(允许白 alpha 变体 rgba(232,232,240,.04~.06));
// 参数:svg 文件文本、label 报错用的资产名;返回:无;副作用:断言失败抛 AssertionError
function assertPalette(svg, label) {
  for (const hex of svg.match(/#[0-9a-fA-F]{6}\b/g) || []) {
    assert.ok(ALLOWED_HEX.has(hex.toLowerCase()), `${label} 色板外颜色: ${hex}`);
  }
  for (const rgba of svg.match(/rgba\([^)]*\)/g) || []) {
    assert.match(
      rgba.replace(/\s+/g, ''),
      /^rgba\(232,232,240,\.0[456]\)$/,
      `${label} 非法 rgba: ${rgba}`
    );
  }
}

for (const rel of Object.values(FILES)) {
  test(`${rel} 存在且 svg 根元素合法、色板合规`, async () => {
    const svg = await readFile(new URL(`../../${rel}`, import.meta.url), 'utf8');
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), 'svg 根元素非法');
    assert.ok(svg.endsWith('</svg>'));
    assertPalette(svg, rel);
  });
}

test('banner 含 🦖 emoji 恐龙(系统 emoji 字体栈)与 SMIL animate,图形用 path 渲染', async () => {
  const svg = await readFile(new URL(`../../${FILES.banner}`, import.meta.url), 'utf8');
  assert.ok(svg.includes('🦖'), '缺 🦖 emoji 恐龙(裁决 1:恢复 emoji 观感)');
  assert.ok(svg.includes("font-family=\"'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif\""), 'emoji 未使用指定系统 emoji 字体栈');
  assert.ok(svg.includes('font-size="52"'), 'emoji 字号应为 52px');
  assert.ok(svg.includes('<animate'), '缺 SMIL animate');
  assert.ok((svg.match(/<path\b/g) || []).length >= 3, 'path 数量不足(标题+副标题+PRESS START)');
  assert.match(svg, /d="M/, '存在不以 M 开头的 path');
});

// 职责:验证生成确定性:五个渲染函数(卡带两盘经 renderCartridges 取下标)重复调用输出逐字节相同,
// 且磁盘产物与生成结果一致;
// 参数:无;返回:无;副作用:动态 import gen-assets.mjs(其 main() 带直接运行守卫,import 不写盘)
test('gen 重复生成输出逐字节相同', async () => {
  const gen = await import('../gen-assets.mjs');
  const font = await gen.loadFont();
  const ps = await gen.loadFontPS();
  const renders = [
    [FILES.banner, (f, p) => gen.renderBanner(f, p)],
    [FILES.badges, (f, p) => gen.renderBadges(f, p)],
    [FILES.pano, (f, p) => gen.renderCartridges(f, p)[0]],
    [FILES.blind, (f, p) => gen.renderCartridges(f, p)[1]],
    [FILES.equip, (f, p) => gen.renderEquipStrip(f, p)],
  ];
  for (const [rel, render] of renders) {
    assert.ok(typeof render === 'function', `gen-assets.mjs 缺导出: ${rel} 对应渲染函数`);
    const first = render(font, ps);
    assert.equal(render(font, ps), first, `${rel} 两次生成结果不同`);
    assert.equal(
      await readFile(new URL(`../../${rel}`, import.meta.url), 'utf8'),
      first,
      `${rel} 磁盘产物与生成结果不一致(先跑 npm run gen)`
    );
  }
});

test('panoscape 卡带 HI-SCORE 星数为 0,blindshake 为 1(desc 机读行断言;★ 由 ps2pText 替代为 +)', async () => {
  const pano = await readFile(new URL(`../../${FILES.pano}`, import.meta.url), 'utf8');
  const blind = await readFile(new URL(`../../${FILES.blind}`, import.meta.url), 'utf8');
  assert.match(pano, /<desc>HI-SCORE \+ 0<\/desc>/);
  assert.match(blind, /<desc>HI-SCORE \+ 1<\/desc>/);
  assert.ok(!pano.includes('★'), 'PS2P 无 ★ 字形,不得出现未替代的 ★');
});

test('equip-strip.svg 含 6 个槽位底色矩形与「进行中」小标', async () => {
  const svg = await readFile(new URL(`../../${FILES.equip}`, import.meta.url), 'utf8');
  assert.equal((svg.match(/fill="#161b22"/g) || []).length, 7, '应为 6 个槽底 + 1 个进行中小标底');
  assert.ok(svg.includes('进行中'));
});

test('textToPath 网格守卫按字体区分(fusion 12 倍数 / PS2P 8 倍数,非法字号拒绝)', async () => {
  const gen = await import('../gen-assets.mjs');
  const font = await gen.loadFont();
  const ps = await gen.loadFontPS();
  // fusion:12 倍数放行,非 12 倍数拒绝(用子集内实际存在的「王」,避免缺字形空路径干扰断言)
  assert.match(gen.textToPath(font, '王', 24, 0, 0), /^M/);
  assert.throws(() => gen.textToPath(font, '王', 13, 0, 0), /12 的倍数/);
  // PS2P:8 倍数放行(8/24);曾用于 fusion 的 12 与任意非 8 倍数拒绝
  assert.match(gen.textToPath(ps, 'A', 8, 0, 0), /^M/);
  assert.match(gen.textToPath(ps, 'A', 24, 0, 0), /^M/);
  assert.throws(() => gen.textToPath(ps, 'A', 12, 0, 0), /8 的倍数/);
  assert.throws(() => gen.textToPath(ps, 'A', 9, 0, 0), /8 的倍数/);
  // 对抗性:0 与负字号一律拒绝
  assert.throws(() => gen.textToPath(ps, 'A', 0, 0, 0), /8 的倍数/);
  assert.throws(() => gen.textToPath(font, '王', -12, 0, 0), /12 的倍数/);
});

test('ps2pText 仅替换 PS2P 缺字形字符,未知缺字形字符抛错', async () => {
  const gen = await import('../gen-assets.mjs');
  const ps = await gen.loadFontPS();
  assert.equal(gen.ps2pText(ps, 'HI-SCORE ★ 0'), 'HI-SCORE + 0');
  assert.equal(gen.ps2pText(ps, '▶ PLAY'), '> PLAY');
  // × / · 等 PS2P 已有字形,原样保留
  assert.equal(gen.ps2pText(ps, 'MapLibre × three.js · 1'), 'MapLibre × three.js · 1');
  // 中文走 fusion <text>/路径,PS2P 通道收到中文视为错误
  assert.throws(() => gen.ps2pText(ps, '王'), /缺字形且无替代/);
});
