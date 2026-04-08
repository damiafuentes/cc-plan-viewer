#!/usr/bin/env node
// cc-plan-viewer PostToolUse hook
// Detects plan file writes and opens the browser-based plan viewer.
// Also injects review feedback back into Claude Code via additionalContext.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { execSync, spawn } = require('child_process');

const SERVER_PORT = 3847;
const PORT_FILE = path.join(os.tmpdir(), 'cc-plan-viewer-port');
const DEBOUNCE_FILE = path.join(os.tmpdir(), 'cc-plan-viewer-opened.json');
const DEBOUNCE_MS = 5000; // 5 seconds (prevents rapid re-opens during multi-chunk writes)

// Plans directory candidates
const PLANS_DIRS = [
  path.join(os.homedir(), '.claude-personal', 'plans'),
  path.join(os.homedir(), '.claude', 'plans'),
];

function getAllPlansDirs() {
  return PLANS_DIRS.filter(dir => fs.existsSync(dir));
}

function getServerPort() {
  try {
    return parseInt(fs.readFileSync(PORT_FILE, 'utf8').trim(), 10) || SERVER_PORT;
  } catch {
    return SERVER_PORT;
  }
}

function isPlanFile(filePath) {
  if (!filePath || !filePath.endsWith('.md')) return false;
  const dir = path.dirname(filePath);
  return getAllPlansDirs().includes(dir);
}

function shouldOpenBrowser(filename) {
  try {
    const data = JSON.parse(fs.readFileSync(DEBOUNCE_FILE, 'utf8'));
    const lastOpened = data[filename];
    if (lastOpened && Date.now() - lastOpened < DEBOUNCE_MS) return false;
  } catch {}
  return true;
}

function markBrowserOpened(filename) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(DEBOUNCE_FILE, 'utf8')); } catch {}
  data[filename] = Date.now();
  fs.writeFileSync(DEBOUNCE_FILE, JSON.stringify(data), 'utf8');
}

function postToServer(port, filePath) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ filePath });
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/plan-updated',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: 2000,
      },
      (res) => { res.resume(); resolve(true); }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(payload);
    req.end();
  });
}

function startServer() {
  // Server entry point: <pkg>/dist/server/server/index.js
  const serverPath = path.join(__dirname, '..', 'dist', 'server', 'server', 'index.js');
  if (!fs.existsSync(serverPath)) return;
  const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(SERVER_PORT) },
  });
  child.unref();
}

async function waitForServer(port, maxWaitMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const ok = await new Promise((resolve) => {
      const req = http.request(
        { hostname: '127.0.0.1', port, path: '/health', method: 'GET', timeout: 500 },
        (res) => { res.resume(); resolve(res.statusCode === 200); }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
    if (ok) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

function checkUnconsumedReviews() {
  const plansDirs = getAllPlansDirs();
  if (plansDirs.length === 0) return null;

  for (const plansDir of plansDirs) {
  const files = fs.readdirSync(plansDir).filter(f => f.endsWith('.review.json'));
  for (const file of files) {
    try {
      const reviewPath = path.join(plansDir, file);
      const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
      if (review.consumedAt) continue;

      // Mark as consumed
      review.consumedAt = new Date().toISOString();
      fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2), 'utf8');

      // Format feedback
      if (review.action === 'feedback') {
        let msg = `PLAN REVIEW FEEDBACK for "${review.planFile}":\n`;
        if (review.inlineComments && review.inlineComments.length > 0) {
          msg += `\n${review.inlineComments.length} inline comment(s):\n\n`;
          for (let i = 0; i < review.inlineComments.length; i++) {
            const c = review.inlineComments[i];
            msg += `--- Comment ${i + 1} ---\n`;
            msg += `Selected text: "${c.sectionId}"\n`;
            msg += `Feedback: ${c.body}\n\n`;
          }
        }
        if (review.overallComment) {
          msg += `--- General comment ---\n`;
          msg += `${review.overallComment}\n`;
        }
        return msg;
      } else {
        return `PLAN REVIEW for "${review.planFile}": User selected "${review.action}"`;
      }
    } catch {}
  }
  } // end plansDirs loop
  return null;
}

// Main
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', async () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name;
    const filePath = data.tool_input?.file_path;

    // Check for unconsumed reviews on every invocation
    const reviewFeedback = checkUnconsumedReviews();

    // Check if this is a plan file write
    const isPlan = (toolName === 'Write' || toolName === 'Edit') && isPlanFile(filePath);

    if (isPlan) {
      const port = getServerPort();
      const serverReachable = await postToServer(port, filePath);

      if (!serverReachable) {
        startServer();
        await waitForServer(port);
        await postToServer(port, filePath);
      }

      const filename = path.basename(filePath);
      if (shouldOpenBrowser(filename)) {
        markBrowserOpened(filename);
        try {
          execSync(`open "http://localhost:${port}/?plan=${encodeURIComponent(filename)}"`, { stdio: 'ignore' });
        } catch {}
      }
    }

    // Output hook response
    if (reviewFeedback) {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: reviewFeedback,
        },
      };
      process.stdout.write(JSON.stringify(output));
    }
  } catch {
    // Silent fail — never block tool execution
    process.exit(0);
  }
});
