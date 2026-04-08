import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { type Server } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import request from 'supertest';
import { createApp } from './app.js';

// Suppress lifecycle idle timer output
vi.mock('./lifecycle.js', () => ({
  resetIdleTimer: vi.fn(),
}));

describe('server app', () => {
  let testDir: string;
  let app: ReturnType<typeof createApp>['app'];
  let server: Server;
  let wss: ReturnType<typeof createApp>['wss'];

  beforeEach(() => {
    // Create a temp directory for plan files
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-plan-viewer-test-'));

    const result = createApp([testDir]);
    app = result.app;
    server = result.server;
    wss = result.wss;
  });

  afterEach(() => {
    // Close server and clean up
    server.close();
    wss.close();
    // Clean up temp directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('GET /health', () => {
    it('returns status ok with plan dirs', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.plansDirs).toContain(testDir);
    });
  });

  describe('GET /api/plans', () => {
    it('returns empty array when no plans exist', async () => {
      const res = await request(app).get('/api/plans');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns list of plan files', async () => {
      fs.writeFileSync(path.join(testDir, 'plan-a.md'), '# Plan A');
      fs.writeFileSync(path.join(testDir, 'plan-b.md'), '# Plan B');

      const res = await request(app).get('/api/plans');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((p: any) => p.filename).sort()).toEqual(['plan-a.md', 'plan-b.md']);
    });

    it('sorts by modification time descending', async () => {
      fs.writeFileSync(path.join(testDir, 'old.md'), '# Old');
      // Touch the file with a future time to ensure ordering
      const futureTime = new Date(Date.now() + 10000);
      fs.writeFileSync(path.join(testDir, 'new.md'), '# New');
      fs.utimesSync(path.join(testDir, 'new.md'), futureTime, futureTime);

      const res = await request(app).get('/api/plans');
      expect(res.body[0].filename).toBe('new.md');
    });

    it('excludes .review.json files', async () => {
      fs.writeFileSync(path.join(testDir, 'plan.md'), '# Plan');
      fs.writeFileSync(path.join(testDir, 'plan.review.json'), '{}');

      const res = await request(app).get('/api/plans');
      expect(res.body).toHaveLength(1);
      expect(res.body[0].filename).toBe('plan.md');
    });
  });

  describe('GET /api/plans/:filename', () => {
    it('returns parsed plan data', async () => {
      fs.writeFileSync(path.join(testDir, 'test.md'), '# My Plan\n\nSome content');

      const res = await request(app).get('/api/plans/test.md');
      expect(res.status).toBe(200);
      expect(res.body.filename).toBe('test.md');
      expect(res.body.parsed.title).toBe('My Plan');
      expect(res.body.parsed.rawMarkdown).toContain('Some content');
    });

    it('returns 404 for missing plan', async () => {
      const res = await request(app).get('/api/plans/missing.md');
      expect(res.status).toBe(404);
    });

    it('returns 400 for non-.md filename', async () => {
      const res = await request(app).get('/api/plans/bad.txt');
      expect(res.status).toBe(400);
    });

    it('returns 400 for path traversal', async () => {
      const res = await request(app).get('/api/plans/..%2Fetc%2Fpasswd.md');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/plan-updated', () => {
    it('returns ok', async () => {
      const res = await request(app)
        .post('/api/plan-updated')
        .send({ filePath: '/some/path/plan.md' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('POST /api/reviews/:filename', () => {
    it('saves review and returns it', async () => {
      fs.writeFileSync(path.join(testDir, 'plan.md'), '# Plan');

      const res = await request(app)
        .post('/api/reviews/plan.md')
        .send({
          action: 'approve',
          overallComment: 'LGTM',
          inlineComments: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.review.action).toBe('approve');
      expect(res.body.review.overallComment).toBe('LGTM');

      // Verify file was written
      const reviewPath = path.join(testDir, 'plan.review.json');
      expect(fs.existsSync(reviewPath)).toBe(true);
    });

    it('returns 404 for missing plan', async () => {
      const res = await request(app)
        .post('/api/reviews/missing.md')
        .send({ action: 'approve' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for path traversal', async () => {
      const res = await request(app)
        .post('/api/reviews/..%2Fhack.md')
        .send({ action: 'approve' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/reviews/:filename', () => {
    it('returns saved review', async () => {
      fs.writeFileSync(path.join(testDir, 'plan.md'), '# Plan');

      // First save a review
      await request(app)
        .post('/api/reviews/plan.md')
        .send({ action: 'feedback', overallComment: 'Nice' });

      const res = await request(app).get('/api/reviews/plan.md');
      expect(res.status).toBe(200);
      expect(res.body.action).toBe('feedback');
      expect(res.body.overallComment).toBe('Nice');
    });

    it('returns 404 when no review exists', async () => {
      fs.writeFileSync(path.join(testDir, 'plan.md'), '# Plan');
      const res = await request(app).get('/api/reviews/plan.md');
      expect(res.status).toBe(404);
    });

    it('returns 404 for missing plan file', async () => {
      const res = await request(app).get('/api/reviews/missing.md');
      expect(res.status).toBe(404);
    });
  });
});
