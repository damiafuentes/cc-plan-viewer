import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPendingHighlight,
  removePendingHighlight,
  promotePendingHighlight,
  createHighlight,
  removeHighlights,
  setHighlightActive,
  getCommentIdFromElement,
} from './highlights';

describe('highlights', () => {
  let container: HTMLDivElement;

  function createRangeForText(text: string): Range | null {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const idx = node.textContent?.indexOf(text) ?? -1;
      if (idx >= 0) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + text.length);
        return range;
      }
      node = walker.nextNode();
    }
    return null;
  }

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = '<p>Hello world, this is a test paragraph.</p>';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('createPendingHighlight', () => {
    it('wraps text in mark elements with pending ID', () => {
      const range = createRangeForText('world');
      expect(range).not.toBeNull();
      createPendingHighlight(range!);

      const marks = container.querySelectorAll('mark[data-comment-id="__pending__"]');
      expect(marks.length).toBeGreaterThan(0);
      expect(marks[0].className).toBe('comment-highlight-pending');
      expect(marks[0].textContent).toBe('world');
    });
  });

  describe('removePendingHighlight', () => {
    it('removes pending marks and restores text', () => {
      const range = createRangeForText('world');
      createPendingHighlight(range!);

      expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);

      removePendingHighlight();

      expect(container.querySelectorAll('mark').length).toBe(0);
      expect(container.textContent).toBe('Hello world, this is a test paragraph.');
    });
  });

  describe('promotePendingHighlight', () => {
    it('changes pending ID to the given comment ID', () => {
      const range = createRangeForText('world');
      createPendingHighlight(range!);

      promotePendingHighlight('comment-1');

      const marks = container.querySelectorAll('mark[data-comment-id="comment-1"]');
      expect(marks.length).toBeGreaterThan(0);
      expect(marks[0].className).toBe('comment-highlight');

      const pending = container.querySelectorAll('mark[data-comment-id="__pending__"]');
      expect(pending.length).toBe(0);
    });
  });

  describe('createHighlight', () => {
    it('wraps range with permanent highlight mark', () => {
      const range = createRangeForText('test');
      createHighlight(range!, 'comment-2');

      const marks = container.querySelectorAll('mark[data-comment-id="comment-2"]');
      expect(marks.length).toBeGreaterThan(0);
      expect(marks[0].className).toBe('comment-highlight');
      expect(marks[0].textContent).toBe('test');
    });
  });

  describe('removeHighlights', () => {
    it('removes marks for a specific comment ID and normalizes', () => {
      const range = createRangeForText('Hello');
      createHighlight(range!, 'comment-3');

      expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);

      removeHighlights('comment-3');

      expect(container.querySelectorAll('mark').length).toBe(0);
      expect(container.textContent).toBe('Hello world, this is a test paragraph.');
    });

    it('does not remove marks for other comment IDs', () => {
      const range1 = createRangeForText('Hello');
      createHighlight(range1!, 'comment-a');

      // Need to find the text again after DOM mutation
      const range2 = createRangeForText('test');
      createHighlight(range2!, 'comment-b');

      removeHighlights('comment-a');

      expect(container.querySelectorAll('mark[data-comment-id="comment-a"]').length).toBe(0);
      expect(container.querySelectorAll('mark[data-comment-id="comment-b"]').length).toBeGreaterThan(0);
    });
  });

  describe('setHighlightActive', () => {
    it('toggles active class on matching marks', () => {
      const range = createRangeForText('world');
      createHighlight(range!, 'comment-4');

      setHighlightActive('comment-4', true);
      const mark = container.querySelector('mark[data-comment-id="comment-4"]');
      expect(mark?.classList.contains('active')).toBe(true);

      setHighlightActive('comment-4', false);
      expect(mark?.classList.contains('active')).toBe(false);
    });
  });

  describe('getCommentIdFromElement', () => {
    it('returns comment ID from element inside a highlight mark', () => {
      const range = createRangeForText('world');
      createHighlight(range!, 'comment-5');

      const mark = container.querySelector('mark.comment-highlight') as HTMLElement;
      expect(getCommentIdFromElement(mark)).toBe('comment-5');
    });

    it('returns null for element not inside a mark', () => {
      const p = container.querySelector('p') as HTMLElement;
      expect(getCommentIdFromElement(p)).toBeNull();
    });
  });
});
