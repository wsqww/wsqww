// dino.test.mjs:校验像素恐龙数据结构(尺寸/字符集/帧差/眼睛空洞)与 mapToPath 转换规则。
// 输入: scripts/dino-paths.mjs;输出: 断言结果;副作用: 无。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DINO_FRAMES, DINO_COLS, DINO_ROWS, mapToPath } from '../dino-paths.mjs';

test('像素图尺寸 14×15 且只含 ./#/o 字符', () => {
  for (const frame of DINO_FRAMES) {
    assert.equal(frame.length, DINO_ROWS);
    for (const row of frame) {
      assert.equal(row.length, DINO_COLS);
      assert.match(row, /^[.#o]+$/);
    }
  }
});

test('两帧上半身一致、最后 3 行腿部不同', () => {
  const [f1, f2] = DINO_FRAMES;
  assert.deepEqual(f1.slice(0, DINO_ROWS - 3), f2.slice(0, DINO_ROWS - 3));
  assert.notDeepEqual(f1.slice(-3), f2.slice(-3));
});

test('头部有一个眼睛空洞(被身体包围的 .)', () => {
  const m = DINO_FRAMES[0];
  let holes = 0;
  for (let r = 0; r < DINO_ROWS; r += 1) {
    for (let c = 1; c < DINO_COLS - 1; c += 1) {
      if (m[r][c] === '.' && m[r - 1] && m[r + 1] && m[r][c - 1] === '#' && m[r][c + 1] === '#') {
        holes += 1;
      }
    }
  }
  assert.equal(holes, 1, `眼睛空洞应为 1 个,实际 ${holes}`);
});

test('mapToPath 只转换目标字符且坐标不越界', () => {
  const cell = 5;
  const d = mapToPath(DINO_FRAMES[0], cell, 0, 0, '#');
  const xs = [...d.matchAll(/M(\d+) \d+/g)].map((m) => Number(m[1]));
  const ys = [...d.matchAll(/M\d+ (\d+)/g)].map((m) => Number(m[1]));
  assert.ok(xs.length > 0);
  for (const x of xs) { assert.ok(x < DINO_COLS * cell, `x=${x} 越界`); }
  for (const y of ys) { assert.ok(y < DINO_ROWS * cell, `y=${y} 越界`); }
});

test("'#' 格子数与图中出现次数一致", () => {
  const d = mapToPath(DINO_FRAMES[0], 1, 0, 0, '#');
  const inMap = DINO_FRAMES[0].join('').split('#').length - 1;
  const inPath = (d.match(/M\d+ /g) || []).length;
  assert.equal(inPath, inMap);
  assert.ok(inMap > 0);
});

test("项圈 'o' 存在且能转出非空路径(带偏移)", () => {
  assert.ok(DINO_FRAMES[0].join('').includes('o'));
  // 首个 'o' 位于 c=8,r=5:起点 = ox 10+8*5=50,oy 20+5*5=45(简报原断言 M10 20 误设 o 在原点)
  assert.ok(mapToPath(DINO_FRAMES[1], 5, 10, 20, 'o').startsWith('M50 45'));
});
