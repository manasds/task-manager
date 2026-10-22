// Runs `next dev` and opens the local URL in Chrome once the server is ready.
// Set NO_OPEN=1 to skip opening the browser.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const root = fileURLToPath(new URL('..', import.meta.url));
const next = `${root}node_modules/.bin/next`;
const args = ['dev', '--port', '3000', '--hostname', '0.0.0.0', ...process.argv.slice(2)];

const child = spawn(next, args, { cwd: root, stdio: ['inherit', 'pipe', 'pipe'] });

let opened = process.env.NO_OPEN === '1';

function run(cmd, cmdArgs) {
  return new Promise((resolve) => {
    const p = spawn(cmd, cmdArgs, { stdio: 'ignore', shell: cmd === 'start' });
    p.on('error', () => resolve(false));
    p.on('exit', (code) => resolve(code === 0));
  });
}

async function openUrl(url) {
  if (process.platform === 'darwin') {
    if (!(await run('open', ['-a', 'Google Chrome', url]))) await run('open', [url]);
  } else if (process.platform === 'win32') {
    await run('start', ['', url]);
  } else {
    await run('xdg-open', [url]);
  }
}

function onOutput(stream) {
  return (chunk) => {
    stream.write(chunk);
    if (opened) return;
    const text = stripVTControlCharacters(chunk.toString());
    if (!/Ready in|Local:/.test(text)) return;
    opened = true;
    const port = text.match(/Local:\s+https?:\/\/[^:\s]+:(\d+)/)?.[1] ?? '3000';
    openUrl(`http://localhost:${port}`).catch(() => {});
  };
}

child.stdout.on('data', onOutput(process.stdout));
child.stderr.on('data', onOutput(process.stderr));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
child.on('error', (err) => {
  console.error(err.message);
  process.exit(1);
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
