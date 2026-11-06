// gen-core.test.mjs:核心层断言(调色板精确 12 色 / 文字转路径确定性 / 关键符号字形齐备 / 非法字号拒绝)。
// 输入: scripts/gen-assets.mjs 与子集字体;输出: 断言结果;副作用: 无。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, loadFont, textToPath } from '../gen-assets.mjs';

test('PALETTE 恰好 12 键且色值精确', () => {
  assert.deepEqual(PALETTE, {
    bg: '#12122a', panel: '#1a1a3a', border: '#e8e8f0',
    purple: '#7b2ff7', cyan: '#00d9c0', yellow: '#ffd23e',
    dim: '#8f8fa8', green: '#4ade80', cell: '#161b22',
    cellLit: '#0e4429', slot: '#262c36', boot: '#05060f',
  });
  assert.equal(Object.keys(PALETTE).length, 12);
});

test("textToPath('PRESS',12,0,12) 输出确定性、以 M 开头且长度 > 20", async () => {
  const font = await loadFont();
  const a = textToPath(font, 'PRESS', 12, 0, 12);
  const b = textToPath(font, 'PRESS', 12, 0, 12);
  assert.equal(a, b, '同参数两次输出应逐字符相同');
  assert.ok(a.startsWith('M'));
  assert.ok(a.length > 20);
});

test('▸★→· 在子集字体中都有字形(缺字形时资产文案须改用 ASCII 回退,不扩字库)', async () => {
  const font = await loadFont();
  for (const ch of '▸★→·') {
    assert.notEqual(font.charToGlyph(ch).index, 0, `缺字形: ${ch}`);
  }
});

test('size 非 12 的倍数时 textToPath 抛错(对抗性:防止像素网格错位)', async () => {
  const font = await loadFont();
  assert.throws(() => textToPath(font, 'PRESS', 13, 0, 12), /12 的倍数/);
});
