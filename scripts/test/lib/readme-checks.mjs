// readme-checks.mjs:README 校验断言的共享实现,供 check-readme 与 check-site 两个测试文件复用。
// 输入: README 文本、仓库根目录 URL;输出: 断言结果(失败抛 AssertionError);副作用: 无。
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';

// README 外链白名单:与 Task 6 check-readme 契约一致(混入未评审的第三方地址即失败)。
const README_LINK_WHITELIST = [
  'https://github.com/wsqww/blindshake',
  'https://panoscape.shuaiqiang.wang',
  'https://raw.githubusercontent.com/wsqww/wsqww/output/snake-dark.svg',
  'https://raw.githubusercontent.com/wsqww/wsqww/output/snake.svg',
  'https://shuaiqiang.wang',
  'mailto:wangsq0926@163.com',
];

// 职责:断言 README 引用的每个本地资产文件都存在且数量达标;参数:md README 文本、rootUrl 仓库根的 file:// URL;返回:Promise<void>;副作用:资产缺失或数量不足时抛 AssertionError
async function assertAssetsExist(md, rootUrl) {
  const srcs = [...md.matchAll(/src="(assets\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length >= 5, `本地资产引用仅 ${srcs.length} 个,少于预期`);
  for (const rel of srcs) {
    await access(new URL(rel, rootUrl));
  }
}

// 职责:断言 README 中所有 <img> 标签都带非空 alt(无障碍基线);参数:md README 文本;返回:void;副作用:存在缺 alt 的 img 时抛 AssertionError
function assertImgsHaveAlt(md) {
  for (const img of md.match(/<img\b[^>]*>/g) || []) {
    assert.match(img, /\balt="[^"]+"/, `img 缺 alt: ${img}`);
  }
}

// 职责:断言 README 的外链集合(href/src/srcset 的 http(s) 与 mailto)与白名单精确一致;参数:md README 文本;返回:void;副作用:白名单漂移时抛 AssertionError
function assertLinkWhitelist(md) {
  const links = new Set(
    [...md.matchAll(/(?:href|src|srcset)="(https?:\/\/[^"]+|mailto:[^"]+)"/g)].map((m) => m[1])
  );
  assert.deepEqual([...links].sort(), README_LINK_WHITELIST);
}

// 职责:执行 README 三项断言(本地资产存在 / img 全带 alt / 外链白名单精确一致);
// 参数:md README 文本、rootUrl 仓库根的 file:// URL;返回:Promise<void>;副作用:断言失败抛错
export async function assertReadme(md, rootUrl) {
  await assertAssetsExist(md, rootUrl);
  assertImgsHaveAlt(md);
  assertLinkWhitelist(md);
}
