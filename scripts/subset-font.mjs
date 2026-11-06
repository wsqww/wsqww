// 子集化像素字体：只保留资产文案需要的字符，控制入库体积。
// 产物 1: scripts/fonts/fusion-pixel-12px.subset.woff2 —— Fusion Pixel(中文标题等,gen-assets 转 path 用)。
// 产物 2: scripts/fonts/press-start-2p.subset.ttf —— Press Start 2P(gen-assets 拉丁文本转 path 用,opentype 直读)。
// 产物 3: assets/site/fonts/press-start-2p.subset.woff2 —— Press Start 2P(落地页 @font-face 自托管用)。
// 输入: scripts/fonts/full/ 下的 woff2(fusion);scripts/fonts/press-start-2p-full.ttf(PS2P,fontsource latin 解压)。
// 副作用: 写出上述三个文件;stdout 打印字符数与文件大小。
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import subsetFont from 'subset-font';
import { compress as woff2Compress } from 'wawoff2';

const FULL_DIR = new URL('./fonts/full/', import.meta.url);
const OUT = new URL('./fonts/fusion-pixel-12px.subset.woff2', import.meta.url);
// 标题中文（转 path 渲染）+ ASCII 全集（路径渲染）+ 常用标点
const CHARS =
  '王汪汪的存档点' +
  'abcdefghijklmnopqrstuvwxyz' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '0123456789' +
  ' -·.:?!/&()★▸→×▶';

const files = (await readdir(FULL_DIR)).filter((f) => f.endsWith('.woff2'));
if (files.length === 0) throw new Error('scripts/fonts/full/ 下没有 woff2，先完成 Step 3');
// 新版 release 按语言拆分多个 woff2;标题为简体中文,优先选 zh_hans 变体保证确定性
const file = files.find((f) => f.includes('zh_hans')) ?? files[0];
const buf = await readFile(new URL(`./fonts/full/${file}`, import.meta.url));
const out = await subsetFont(buf, CHARS, { targetFormat: 'woff2' });
await writeFile(OUT, out);
console.log(`subset ok: fusion ${CHARS.length} chars, ${(out.length / 1024).toFixed(1)} KB`);

// ---- Press Start 2P(修正波:拉丁/数字字体换回 PS2P,自托管) ----

// PS2P 完整源字型(gitignore 不入库)与两份子集产物地址
const PS2P_FULL = new URL('./fonts/press-start-2p-full.ttf', import.meta.url);
const PS2P_TTF = new URL('./fonts/press-start-2p.subset.ttf', import.meta.url);
const PS2P_WOFF2 = new URL('../assets/site/fonts/press-start-2p.subset.woff2', import.meta.url);
// ASCII 可打印区(0x20-0x7E) + 拉丁补充符号;★▸→ 为简报指定字符,PS2P 缺字形时 subset 自动跳过,
// gen-assets 侧对缺字形字符做 ASCII 替代(见 gen-assets.mjs ps2pText),无 CJK
const PS2P_CHARS =
  Array.from({ length: 95 }, (_, i) => String.fromCharCode(0x20 + i)).join('') + '·★▸→×▶';

// 职责:子集化 PS2P 并产出 ttf(opentype 转路径)与 woff2(ttf 经 wawoff2 压缩,字形集与 ttf 完全一致);
// 参数:无;返回:无;副作用:写出 PS2P_TTF/PS2P_WOFF2 两个文件,stdout 打印大小
async function subsetPS2P() {
  let psBuf;
  try {
    psBuf = await readFile(PS2P_FULL);
  } catch (err) {
    throw new Error('scripts/fonts/press-start-2p-full.ttf 缺失:先下载 fontsource latin woff2 并用 wawoff2 解压');
  }
  await mkdir(new URL('../assets/site/fonts/', import.meta.url), { recursive: true });
  const ttf = await subsetFont(psBuf, PS2P_CHARS, { targetFormat: 'truetype' });
  await writeFile(PS2P_TTF, ttf);
  const woff2 = await woff2Compress(ttf);
  await writeFile(PS2P_WOFF2, woff2);
  console.log(`subset ok: press-start-2p ${PS2P_CHARS.length} chars, ttf ${(ttf.length / 1024).toFixed(1)} KB, woff2 ${(woff2.length / 1024).toFixed(1)} KB`);
}
await subsetPS2P();
