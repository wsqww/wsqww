// check-site.test.mjs:落地页静态验收(色板/外链白名单/关键特性/基线结构)+ 复用 README 断言。
// 输入: index.html 与 README.md;输出: 断言结果;副作用: 无。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertReadme } from './lib/readme-checks.mjs';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

// 街机风 12 色调色板:与 index.html :root CSS 变量一一对应,页面不得出现色板外的十六进制颜色。
const PALETTE_OK = new Set([
  '#12122a', '#1a1a3a', '#e8e8f0', '#7b2ff7', '#00d9c0', '#ffd23e',
  '#8f8fa8', '#4ade80', '#161b22', '#0e4429', '#262c36', '#05060f',
]);

test('index.html 十六进制颜色全部落在 12 色板', () => {
  for (const hex of html.match(/#[0-9a-fA-F]{6}\b/g) || []) {
    assert.ok(PALETTE_OK.has(hex.toLowerCase()), `色板外颜色: ${hex}`);
  }
});

test('index.html rgba 仅允许既定的白/暗淡 alpha 变体(对抗性:防配色漂移)', () => {
  const ALLOWED = [
    /^rgba\(255,255,255,0\.04\)$/,     // 扫描线
    /^rgba\(232,232,240,0\.0[456]\)$/, // 白描边 alpha 变体
    /^rgba\(143,143,168,0\.35\)$/,     // CREDITS 虚线分隔(暗淡 alpha)
  ];
  for (const rgba of html.match(/rgba\([^)]*\)/g) || []) {
    const norm = rgba.replace(/\s+/g, '');
    assert.ok(ALLOWED.some((re) => re.test(norm)), `非法 rgba: ${rgba}`);
  }
});

test('index.html 页面加载自动发起的外部请求 host 全部在白名单内', () => {
  // 只抓"加载即自动发起"的请求:img 的 src/srcset、CSS url()、JS fetch();用户点击的 <a href> 导航不算自动请求,单独由导航白名单用例约束
  const autoUrls = [
    ...[...html.matchAll(/\b(?:src|srcset)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/url\((['"]?)(https?:\/\/[^)'"]+)\1\)/g)].map((m) => m[2]),
    ...[...html.matchAll(/fetch\((['"])(https?:\/\/[^'"]+)\1/g)].map((m) => m[2]),
  ];
  const ALLOWED_HOSTS = new Set(['api.github.com', 'raw.githubusercontent.com']);
  assert.ok(autoUrls.length >= 2, '自动外部请求过少(应含 snake-dark.svg 图片与 api.github.com 拉取)');
  const hosts = new Set(autoUrls.map((u) => new URL(u).host));
  for (const u of autoUrls) {
    assert.ok(ALLOWED_HOSTS.has(new URL(u).host), `白名单外外部请求地址: ${u}`);
  }
  for (const host of ALLOWED_HOSTS) {
    assert.ok(hosts.has(host), `白名单 host 未被页面使用: ${host}`);
  }
});

test('index.html 导航链接(<a href>)与白名单精确一致(对抗性:防混入未评审地址)', () => {
  const navLinks = [...html.matchAll(/<a\b[^>]*href="((?:https?:\/\/|mailto:)[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(navLinks)].sort(), [
    'https://github.com/wsqww',
    'https://github.com/wsqww/blindshake',
    'https://panoscape.shuaiqiang.wang',
    'mailto:wangsq0926@163.com',
  ]);
});

test('index.html 贪吃蛇图为 dark 版(终审 Fix-1:固定深色主题,light 近白格子刺眼)', () => {
  assert.ok(html.includes('output/snake-dark.svg'), '缺少 snake-dark.svg 引用');
  // "snake.svg" 不是 "snake-dark.svg" 的子串(后者为 snake- 前缀),子串匹配可安全区分明暗两版
  assert.ok(!html.includes('output/snake.svg'), '仍存在 light 版 snake.svg 引用(README 双版本不受此约束)');
});

test('关键特性标记齐全', () => {
  for (const marker of [
    'woof-boot',
    '<noscript',
    'prefers-reduced-motion',
    'name="viewport"',
    '@font-face',
    'assets/site/fonts/press-start-2p.subset.woff2',
    'class="dino"',
  ]) {
    assert.ok(html.includes(marker), `缺少关键标记: ${marker}`);
  }
});

test('基线六大区块结构齐全(#boot + 五个内容区)', () => {
  for (const marker of [
    'id="boot"',
    'class="hero"',
    'class="select"',
    'class="sec-equip"',
    'class="sec-snake"',
    'class="credits"',
  ]) {
    assert.ok(html.includes(marker), `缺少区块: ${marker}`);
  }
});

test('README 断言复用(check-site 内再跑一遍,防两文件漂移)', async () => {
  const md = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
  await assertReadme(md, new URL('../../', import.meta.url));
});
