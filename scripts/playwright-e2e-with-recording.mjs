import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifyScript = path.join(repoRoot, 'scripts', 'verify-e2e-videos.mjs');
const attempts = Math.max(1, Number.parseInt(process.env.E2E_RECORD_ATTEMPTS ?? '3', 10));
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function quoteWindowsArg(value) {
  return /[\s"]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

function run(command, args, env, shell = process.platform === 'win32') {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
      shell,
    });
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal }));
  });
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const outputDir = path.resolve(process.cwd(), 'test-results', `e2e-recording-attempt-${attempt}`);
  const env = { ...process.env, PLAYWRIGHT_OUTPUT_DIR: outputDir };
  console.log(`\n[Playwright E2E] 시도 ${attempt}/${attempts}`);

  const playwrightArgs = ['playwright', 'test', ...process.argv.slice(2)];
  const playwrightCommand = process.platform === 'win32' ? process.env.ComSpec : npx;
  const playwrightCommandArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', [npx, ...playwrightArgs].map(quoteWindowsArg).join(' ')]
    : playwrightArgs;
  const testResult = await run(playwrightCommand, playwrightCommandArgs, env, false);
  if (testResult.code !== 0) {
    console.error(`[Playwright E2E] 테스트 실패 (exit=${testResult.code})`);
    continue;
  }

  const verification = await run(process.execPath, [verifyScript, '--dir', outputDir, '--extensions', '.webm,.mp4,.mov'], env, false);
  if (verification.code === 0) {
    console.log('[Playwright E2E] 테스트와 녹화 검증 PASS');
    process.exit(0);
  }
  console.error('[Playwright E2E] 녹화 검증 실패 — 전체 E2E를 재시도합니다.');
}

console.error(`[Playwright E2E] ${attempts}회 시도 후에도 테스트 또는 녹화가 통과하지 못했습니다.`);
process.exit(1);
