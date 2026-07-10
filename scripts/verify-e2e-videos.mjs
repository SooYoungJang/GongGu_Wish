import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return args;
}

function findVideoFiles(root, extensions) {
  if (!fs.existsSync(root)) return [];
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
        found.push(fullPath);
      }
    }
  };
  walk(root);
  return found;
}

function findFfprobe() {
  const candidates = [
    process.env.FFPROBE_PATH,
    process.env.FFMPEG_PATH?.replace(/ffmpeg(?:\.exe)?$/i, 'ffprobe.exe'),
    'ffprobe',
  ].filter(Boolean);

  const wingetRoot = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages')
    : null;
  if (wingetRoot && fs.existsSync(wingetRoot)) {
    for (const packageName of fs.readdirSync(wingetRoot)) {
      const packageRoot = path.join(wingetRoot, packageName);
      if (!fs.statSync(packageRoot).isDirectory()) continue;
      const stack = [packageRoot];
      while (stack.length > 0) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const fullPath = path.join(current, entry.name);
          if (entry.isDirectory()) stack.push(fullPath);
          else if (entry.name.toLowerCase() === 'ffprobe.exe') candidates.push(fullPath);
        }
      }
    }
  }

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error('ffprobe를 찾지 못했습니다. FFPROBE_PATH를 설정하거나 FFmpeg를 설치하세요.');
}

function readDuration(ffprobe, filePath) {
  const output = execFileSync(
    ffprobe,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { encoding: 'utf8' },
  ).trim();
  const duration = Number.parseFloat(output);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`duration이 0초이거나 읽을 수 없습니다: ${filePath}`);
  }
  return duration;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(String(args.dir ?? 'test-results'));
const extensions = new Set(String(args.extensions ?? '.mp4,.webm,.mov').split(',').map((item) => item.trim().toLowerCase()));
const files = findVideoFiles(root, extensions);

if (files.length === 0) {
  throw new Error(`녹화 영상이 없습니다: ${root}`);
}

const ffprobe = findFfprobe();
const verified = files.map((filePath) => {
  const size = fs.statSync(filePath).size;
  if (size <= 1024) throw new Error(`영상 파일이 비어 있거나 너무 작습니다: ${filePath}`);
  const duration = readDuration(ffprobe, filePath);
  return { file: path.relative(process.cwd(), filePath), size, duration };
});

console.log(JSON.stringify({ root, count: verified.length, videos: verified }, null, 2));
