import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlanReview } from './reviewStore.js';

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({ default: mockFs, ...mockFs }));

const { saveReview, getReview, getUnconsumedReview, markConsumed } = await import('./reviewStore.js');

function makeReview(overrides: Partial<PlanReview> = {}): PlanReview {
  return {
    planFile: 'test.md',
    action: 'feedback',
    submittedAt: '2026-01-01T00:00:00.000Z',
    consumedAt: null,
    overallComment: 'Looks good',
    inlineComments: [],
    ...overrides,
  };
}

describe('reviewStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('saveReview', () => {
    it('writes JSON to the correct review path', () => {
      const review = makeReview();
      saveReview('/plans/test.md', review);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/plans/test.review.json',
        JSON.stringify(review, null, 2),
        'utf8'
      );
    });

    it('derives review path from plan path correctly', () => {
      const review = makeReview();
      saveReview('/some/dir/my-plan.md', review);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/some/dir/my-plan.review.json',
        expect.any(String),
        'utf8'
      );
    });
  });

  describe('getReview', () => {
    it('returns parsed review when file exists', () => {
      const review = makeReview();
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(review));

      const result = getReview('/plans/test.md');
      expect(result).toEqual(review);
    });

    it('returns null when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(getReview('/plans/test.md')).toBeNull();
    });

    it('returns null when file contains invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not valid json');
      expect(getReview('/plans/test.md')).toBeNull();
    });
  });

  describe('getUnconsumedReview', () => {
    it('returns review when consumedAt is null', () => {
      const review = makeReview({ consumedAt: null });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(review));
      expect(getUnconsumedReview('/plans/test.md')).toEqual(review);
    });

    it('returns null when consumedAt is set', () => {
      const review = makeReview({ consumedAt: '2026-01-02T00:00:00.000Z' });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(review));
      expect(getUnconsumedReview('/plans/test.md')).toBeNull();
    });

    it('returns null when no review exists', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(getUnconsumedReview('/plans/test.md')).toBeNull();
    });
  });

  describe('markConsumed', () => {
    it('sets consumedAt and writes back', () => {
      const review = makeReview({ consumedAt: null });
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(review));

      markConsumed('/plans/test.md');

      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
      const writtenJson = JSON.parse(mockFs.writeFileSync.mock.calls[0][1]);
      expect(writtenJson.consumedAt).toBeTruthy();
    });

    it('does nothing when no review exists', () => {
      mockFs.existsSync.mockReturnValue(false);
      markConsumed('/plans/test.md');
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});
