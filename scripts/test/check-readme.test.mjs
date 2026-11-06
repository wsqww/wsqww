// check-readme.test.mjs:调用共享断言校验 README(Task 9 抽取自 Task 6 版本,断言内容不变)。
// 输入: README.md;输出: 断言结果;副作用: 无。
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertReadme } from './lib/readme-checks.mjs';

test('README 本地资产/alt/外链白名单校验', async () => {
  const md = await readFile(new URL('../../README.md', import.meta.url), 'utf8');
  await assertReadme(md, new URL('../../', import.meta.url));
});
