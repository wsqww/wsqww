// 验证子集字体可用:opentype.js 能解析,且标题用字全部存在。
// 输入: 子集 woff2;输出: 断言结果;副作用: 无。
// 注: opentype.js v1.3.4 不解析 WOFF2 容器,先用 wawoff2 解压回 TTF 再 parse。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import opentype from 'opentype.js';
import { decompress as woff2Decompress } from 'wawoff2';

const FONT_URL = new URL('../fonts/fusion-pixel-12px.subset.woff2', import.meta.url);

// 读取子集 woff2 并解压为 TTF ArrayBuffer,供 opentype.js 解析。
// 返回: ArrayBuffer(字形数据);副作用: 无。
async function loadFontTTF() {
  const buf = await readFile(FONT_URL);
  const ttf = await woff2Decompress(buf);
  return ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength);
}

test('子集字体可被 opentype.js 解析', async () => {
  const font = opentype.parse(await loadFontTTF());
  assert.equal(font.unitsPerEm > 0, true);
});

test('标题「王汪汪的存档点」与卡带新增字符 ×▶ 每个字符都有字形', async () => {
  const font = opentype.parse(await loadFontTTF());
  for (const ch of '王汪汪的存档点×▶') {
    const g = font.charToGlyph(ch);
    assert.notEqual(g.index, 0, `缺字形: ${ch}`);
  }
});

// 终审 Fix-2:两份 OFL 许可文本须与字体产物同库存放(fusion 取自 full/ 解压产物原样复制,
// PS2P 取自 fontsource 包内 LICENSE),文本保持官方原样、不做任何改写。
const FUSION_OFL_URL = new URL('../fonts/fusion-pixel-OFL.txt', import.meta.url);
const PS2P_OFL_URL = new URL('../fonts/press-start-2p-OFL.txt', import.meta.url);

test('Fusion Pixel OFL 许可入库且为官方文本(含项目名与 SIL OFL 声明)', async () => {
  const txt = await readFile(FUSION_OFL_URL, 'utf8');
  assert.ok(txt.includes('Fusion Pixel Font'), '缺 Fusion Pixel 项目标识');
  assert.ok(txt.includes('licensed under the SIL Open Font License'), '缺 SIL OFL 许可声明');
});

test('Press Start 2P OFL 许可入库且为官方文本(含字体名与 SIL OFL 声明)', async () => {
  const txt = await readFile(PS2P_OFL_URL, 'utf8');
  assert.ok(txt.includes('Press Start 2P'), '缺 Press Start 2P 版权标识');
  assert.ok(txt.includes('SIL Open Font License'), '缺 SIL OFL 许可声明');
});
