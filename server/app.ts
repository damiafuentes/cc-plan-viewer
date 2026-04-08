import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { parsePlan } from './planParser.js';
import { saveReview, getReview, type PlanReview } from './reviewStore.js';
import { resetIdleTimer } from './lifecycle.js';

export function createApp(plansDirs: string[]) {
  const plansDir = plansDirs[0] || '';
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
    res.json({ status: 'ok', plansDirs });
  });

  // List all plans across all ~/.claude*/plans/ directories
  app.get('/api/plans', (_req, res) => {
    try {
      const allFiles: { filename: string; modified: string; size: number; hasReview: boolean; reviewAction: string | null; dir: string }[] = [];
      for (const dir of plansDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir)
          .filter(f => f.endsWith('.md') && !f.endsWith('.review.json'));
        for (const f of files) {
          const filePath = path.join(dir, f);
          const stat = fs.statSync(filePath);
          const review = getReview(filePath);
          allFiles.push({
            filename: f,
            modified: stat.mtime.toISOString(),
            size: stat.size,
            hasReview: !!review,
            reviewAction: review?.action ?? null,
            dir,
          });
        }
      }
      allFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      res.json(allFiles);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list plans' });
    }
  });

  // Find a plan file across all plan directories
  function findPlanFile(filename: string): string | null {
    for (const dir of plansDirs) {
      const filePath = path.join(dir, filename);
      if (fs.existsSync(filePath)) return filePath;
    }
    return null;
  }

  // Get a specific plan
  app.get('/api/plans/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!filename.endsWith('.md') || filename.includes('..')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }
    const filePath = findPlanFile(filename);
    if (!filePath) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
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
    const filePath = findPlanFile(filename);
    if (!filePath) {
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
    const filePath = findPlanFile(filename);
    if (!filePath) {
      res.status(404).json({ error: 'No review found' });
      return;
    }
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

  return { app, server, wss };
}
