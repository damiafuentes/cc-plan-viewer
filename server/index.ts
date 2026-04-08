import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parsePlan } from './planParser.js';
import { saveReview, getReview, type PlanReview } from './reviewStore.js';
import { writePidFile, writePortFile, cleanupFiles, resetIdleTimer } from './lifecycle.js';
import { watchPlansDir } from './planWatcher.js';

const PORT = parseInt(process.env.PORT || '3847', 10);

// Auto-detect plans directory
function findPlansDir(): string {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.claude-personal', 'plans'),
    path.join(home, '.claude', 'plans'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  // Default to first candidate even if it doesn't exist yet
  return candidates[0];
}

const plansDir = findPlansDir();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// Reset idle timer on every request
app.use((_req, _res, next) => {
  resetIdleTimer();
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', plansDir });
});

// List all plans
app.get('/api/plans', (_req, res) => {
  try {
    if (!fs.existsSync(plansDir)) {
      res.json([]);
      return;
    }
    const files = fs.readdirSync(plansDir)
      .filter(f => f.endsWith('.md') && !f.endsWith('.review.json'))
      .map(f => {
        const filePath = path.join(plansDir, f);
        const stat = fs.statSync(filePath);
        const review = getReview(filePath);
        return {
          filename: f,
          modified: stat.mtime.toISOString(),
          size: stat.size,
          hasReview: !!review,
          reviewAction: review?.action ?? null,
        };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list plans' });
  }
});

// Get a specific plan
app.get('/api/plans/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename.endsWith('.md') || filename.includes('..')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  const filePath = path.join(plansDir, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = parsePlan(content);
    const review = getReview(filePath);
    res.json({ filename, parsed, review });
  } catch {
    res.status(404).json({ error: 'Plan not found' });
  }
});

// Hook notifies of plan update
app.post('/api/plan-updated', (req, res) => {
  const { filePath, planOptions } = req.body;
  const filename = path.basename(filePath || '');

  // Broadcast to all WebSocket clients
  const message = JSON.stringify({
    type: 'plan-updated',
    filename,
    planOptions: planOptions || null,
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  res.json({ ok: true });
});

// Save a review
app.post('/api/reviews/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename.endsWith('.md') || filename.includes('..')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  const filePath = path.join(plansDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Plan not found' });
    return;
  }

  const review: PlanReview = {
    planFile: filename,
    action: req.body.action || 'feedback',
    submittedAt: new Date().toISOString(),
    consumedAt: null,
    overallComment: req.body.overallComment || '',
    inlineComments: req.body.inlineComments || [],
  };

  saveReview(filePath, review);

  // Notify clients
  const message = JSON.stringify({
    type: 'review-submitted',
    filename,
    action: review.action,
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  res.json({ ok: true, review });
});

// Get a review
app.get('/api/reviews/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(plansDir, filename);
  const review = getReview(filePath);
  if (!review) {
    res.status(404).json({ error: 'No review found' });
    return;
  }
  res.json(review);
});

// Serve SPA static files
// Try multiple paths depending on how the server is running
const clientDistCandidates = [
  path.join(import.meta.dirname, 'client'),                 // bundled: ~/.cc-plan-viewer/server-bundle.mjs → ~/.cc-plan-viewer/client/
  path.join(import.meta.dirname, '..', '..', 'client'),    // compiled: dist/server/server/ → dist/client/
  path.join(import.meta.dirname, '..', 'dist', 'client'),  // dev: server/ → dist/client/
];
const clientDist = clientDistCandidates.find((d) => fs.existsSync(d));
if (clientDist) {
  app.use(express.static(clientDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// WebSocket connection
wss.on('connection', (ws) => {
  resetIdleTimer();
  ws.on('message', () => resetIdleTimer());
});

// Start
server.listen(PORT, () => {
  writePidFile();
  writePortFile(PORT);
  resetIdleTimer();
  console.log(`[cc-plan-viewer] Server running at http://localhost:${PORT}`);
  console.log(`[cc-plan-viewer] Plans directory: ${plansDir}`);
});

// Watch for plan file changes
watchPlansDir(plansDir, (filename, content) => {
  const message = JSON.stringify({
    type: 'plan-updated',
    filename,
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
});

// Cleanup on exit
process.on('SIGINT', () => { cleanupFiles(); process.exit(0); });
process.on('SIGTERM', () => { cleanupFiles(); process.exit(0); });
