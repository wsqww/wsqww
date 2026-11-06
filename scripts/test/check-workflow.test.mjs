// check-workflow.test.mjs:静态校验贪吃蛇 workflow(触发器/权限/并发/checkout/snk 产物)。
// 输入: .github/workflows/snake.yml;输出: 断言结果;副作用: 无。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import yaml from 'js-yaml';

const doc = yaml.load(await readFile(new URL('../../.github/workflows/snake.yml', import.meta.url), 'utf8'));

test('触发器:schedule(cron 0 18 * * *)+ push(main)+ workflow_dispatch', () => {
  assert.deepEqual(Object.keys(doc.on).sort(), ['push', 'schedule', 'workflow_dispatch']);
  assert.equal(doc.on.schedule[0].cron, '0 18 * * *');
  assert.deepEqual(doc.on.push.branches, ['main']);
});

test('permissions: contents write', () => {
  assert.equal(doc.permissions.contents, 'write');
});

test('concurrency: 固定组且取消进行中的旧跑', () => {
  assert.equal(doc.concurrency.group, 'snake');
  assert.equal(doc.concurrency['cancel-in-progress'], true);
});

test('checkout 步骤 fetch-depth: 0', () => {
  const co = doc.jobs.generate.steps.find((s) => (s.uses || '').startsWith('actions/checkout@'));
  assert.ok(co, '找不到 checkout 步骤');
  assert.equal(co.with['fetch-depth'], 0);
});

// snk outputs 的逐字基准串(终审 Fix-3:原「前缀正则 + 逗号数 5」放过了路径与色值改动,改为完整字符串锁死)
const SNAKE_OUTPUT_LIGHT = 'dist/snake.svg?palette=github-light&color_snake=#7b2ff7&color_dots=#ebedf0,#ffd23e,#ffd23e,#ffd23e,#ffd23e';
const SNAKE_OUTPUT_DARK = 'dist/snake-dark.svg?palette=github-dark&color_snake=#7b2ff7&color_dots=#161b22,#ffd23e,#ffd23e,#ffd23e,#ffd23e';
// 职责:取 snk 步骤的 outputs 两个 trimmed 行;参数:无;返回:string[2];副作用:断言 snk 步骤存在
function snakeOutputLines() {
  const snk = doc.jobs.generate.steps.find((s) => (s.uses || '').startsWith('Platane/snk@'));
  assert.ok(snk, '找不到 snk 步骤');
  const lines = snk.with.outputs.trim().split('\n').map((l) => l.trim());
  assert.equal(lines.length, 2, 'outputs 必须正好两行(明/暗)');
  return lines;
}

test('snk 步骤:owner 参数 + outputs light 行与基准串逐字一致', () => {
  const snk = doc.jobs.generate.steps.find((s) => (s.uses || '').startsWith('Platane/snk@'));
  assert.ok(snk, '找不到 snk 步骤');
  assert.equal(snk.with.github_user_name, '${{ github.repository_owner }}');
  assert.equal(snakeOutputLines()[0], SNAKE_OUTPUT_LIGHT);
});

test('snk 步骤:outputs dark 行与基准串逐字一致', () => {
  assert.equal(snakeOutputLines()[1], SNAKE_OUTPUT_DARK);
});
