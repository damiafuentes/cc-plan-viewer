import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReview } from './useReview';

vi.mock('../lib/api', () => ({
  submitReview: vi.fn().mockResolvedValue(undefined),
}));

import { submitReview } from '../lib/api';

describe('useReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty initial state', () => {
    const { result } = renderHook(() => useReview('test.md'));
    expect(result.current.comments).toEqual([]);
    expect(result.current.overallComment).toBe('');
    expect(result.current.submitted).toBe(false);
    expect(result.current.submitting).toBe(false);
    expect(result.current.hasComments).toBe(false);
  });

  it('addComment creates a comment with unique ID', () => {
    const { result } = renderHook(() => useReview('test.md'));

    let id: string;
    act(() => {
      id = result.current.addComment('selected text', 'my comment', 100);
    });

    expect(id!).toMatch(/^comment-/);
    expect(result.current.comments).toHaveLength(1);
    expect(result.current.comments[0].selectedText).toBe('selected text');
    expect(result.current.comments[0].body).toBe('my comment');
    expect(result.current.comments[0].anchorTop).toBe(100);
  });

  it('addComment generates incrementing unique IDs', () => {
    const { result } = renderHook(() => useReview('test.md'));

    let id1: string, id2: string;
    act(() => {
      id1 = result.current.addComment('a', 'b', 0);
    });
    act(() => {
      id2 = result.current.addComment('c', 'd', 0);
    });

    expect(id1!).not.toBe(id2!);
  });

  it('editComment updates the body of a specific comment', () => {
    const { result } = renderHook(() => useReview('test.md'));

    let id: string;
    act(() => {
      id = result.current.addComment('text', 'original', 0);
    });
    act(() => {
      result.current.editComment(id!, 'updated');
    });

    expect(result.current.comments[0].body).toBe('updated');
  });

  it('deleteComment removes the comment', () => {
    const { result } = renderHook(() => useReview('test.md'));

    let id: string;
    act(() => {
      id = result.current.addComment('text', 'body', 0);
    });
    act(() => {
      result.current.deleteComment(id!);
    });

    expect(result.current.comments).toHaveLength(0);
  });

  it('setOverallComment updates the overall comment', () => {
    const { result } = renderHook(() => useReview('test.md'));

    act(() => {
      result.current.setOverallComment('overall feedback');
    });

    expect(result.current.overallComment).toBe('overall feedback');
  });

  it('hasComments is true when there are inline comments', () => {
    const { result } = renderHook(() => useReview('test.md'));

    act(() => {
      result.current.addComment('text', 'body', 0);
    });

    expect(result.current.hasComments).toBe(true);
  });

  it('hasComments is true when only overallComment has content', () => {
    const { result } = renderHook(() => useReview('test.md'));

    act(() => {
      result.current.setOverallComment('something');
    });

    expect(result.current.hasComments).toBe(true);
  });

  it('hasComments is false when empty', () => {
    const { result } = renderHook(() => useReview('test.md'));
    expect(result.current.hasComments).toBe(false);
  });

  it('formatForClipboard returns formatted text with comments', () => {
    const { result } = renderHook(() => useReview('test.md'));

    act(() => {
      result.current.addComment('some code', 'fix this', 0);
      result.current.setOverallComment('General note');
    });

    const text = result.current.formatForClipboard();
    expect(text).toContain('PLAN REVIEW FEEDBACK');
    expect(text).toContain('1 inline comment(s)');
    expect(text).toContain('Selected text: "some code"');
    expect(text).toContain('Feedback: fix this');
    expect(text).toContain('General note');
  });

  it('formatForClipboard handles empty state', () => {
    const { result } = renderHook(() => useReview('test.md'));
    const text = result.current.formatForClipboard();
    expect(text).toContain('PLAN REVIEW FEEDBACK');
  });

  it('submit calls submitReview with correct data', async () => {
    const { result } = renderHook(() => useReview('test.md'));

    act(() => {
      result.current.addComment('text', 'body', 0);
      result.current.setOverallComment('overall');
    });

    await act(async () => {
      await result.current.submit('approve');
    });

    expect(submitReview).toHaveBeenCalledWith('test.md', {
      action: 'approve',
      overallComment: 'overall',
      inlineComments: expect.arrayContaining([
        expect.objectContaining({ body: 'body' }),
      ]),
    });
    expect(result.current.submitted).toBe(true);
    expect(result.current.submitting).toBe(false);
  });

  it('submit does nothing when filename is null', async () => {
    const { result } = renderHook(() => useReview(null));

    await act(async () => {
      await result.current.submit('approve');
    });

    expect(submitReview).not.toHaveBeenCalled();
  });

  it('submit handles errors gracefully', async () => {
    vi.mocked(submitReview).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useReview('test.md'));

    await act(async () => {
      await result.current.submit('approve');
    });

    expect(result.current.submitted).toBe(false);
    expect(result.current.submitting).toBe(false);
  });
});
