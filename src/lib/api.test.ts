import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPlans, fetchPlan, submitReview } from './api';

describe('api', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchPlans', () => {
    it('calls GET /api/plans and returns parsed JSON', async () => {
      const plans = [{ filename: 'test.md', modified: '2026-01-01' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(plans),
      });

      const result = await fetchPlans();
      expect(mockFetch).toHaveBeenCalledWith('/api/plans');
      expect(result).toEqual(plans);
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });
      await expect(fetchPlans()).rejects.toThrow('Failed to fetch plans');
    });
  });

  describe('fetchPlan', () => {
    it('calls GET /api/plans/{encoded filename}', async () => {
      const plan = { filename: 'test.md', parsed: {}, review: null };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(plan),
      });

      const result = await fetchPlan('test.md');
      expect(mockFetch).toHaveBeenCalledWith('/api/plans/test.md');
      expect(result).toEqual(plan);
    });

    it('encodes special characters in filename', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await fetchPlan('my plan (1).md');
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/plans/${encodeURIComponent('my plan (1).md')}`
      );
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });
      await expect(fetchPlan('missing.md')).rejects.toThrow('Failed to fetch plan');
    });
  });

  describe('submitReview', () => {
    it('calls POST /api/reviews/{filename} with JSON body', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const review = {
        action: 'approve',
        overallComment: 'LGTM',
        inlineComments: [{ sectionId: 's1', lineRange: [1, 5] as [number, number], body: 'Fix this' }],
      };

      await submitReview('test.md', review);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/reviews/test.md',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(review),
        }
      );
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(
        submitReview('test.md', {
          action: 'feedback',
          overallComment: '',
          inlineComments: [],
        })
      ).rejects.toThrow('Failed to submit review');
    });
  });
});
