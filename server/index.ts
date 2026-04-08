import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WebSocket } from 'ws';
import { createApp } from './app.js';
import { writePidFile, writePortFile, cleanupFiles, resetIdleTimer } from './lifecycle.js';
import { watchPlansDir } from './planWatcher.js';

const PORT = parseInt(process.env.PORT || '3847', 10);

// Auto-detect all ~/.claude*/plans/ directories
function findAllPlansDirs(): string[] {
  const home = os.homedir();
  try {
    return fs.readdirSync(home)
      .filter(name => name.startsWith('.claude'))
      .map(name => path.join(home, name, 'plans'))
      .filter(dir => fs.existsSync(dir));
  } catch {
    return [path.join(home, '.claude', 'plans')];
  }
}

const plansDirs = findAllPlansDirs();
const { server, wss } = createApp(plansDirs);

// Start
server.listen(PORT, () => {
  writePidFile();
  writePortFile(PORT);
  resetIdleTimer();
  console.log(`[cc-plan-viewer] Server running at http://localhost:${PORT}`);
  console.log(`[cc-plan-viewer] Plans directories: ${plansDirs.join(', ')}`);
});

// Watch all plan directories for changes
const onPlanChange = (filename: string, _content: string) => {
  const message = JSON.stringify({
    type: 'plan-updated',
    filename,
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
};
for (const dir of plansDirs) {
  watchPlansDir(dir, onPlanChange);
}

// Cleanup on exit
process.on('SIGINT', () => { cleanupFiles(); process.exit(0); });
process.on('SIGTERM', () => { cleanupFiles(); process.exit(0); });
