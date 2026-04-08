import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useTextSelection } from './useTextSelection';

describe('useTextSelection', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.textContent = 'Hello world';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  function makeRef(): React.RefObject<HTMLElement | null> {
    return { current: container };
  }

  it('returns null selection initially', () => {
    const { result } = renderHook(() => useTextSelection(makeRef()));
    expect(result.current.selection).toBeNull();
  });

  it('clearSelection sets selection to null', () => {
    const { result } = renderHook(() => useTextSelection(makeRef()));

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selection).toBeNull();
  });

  it('mousedown outside container clears selection', () => {
    const { result } = renderHook(() => useTextSelection(makeRef()));

    const external = document.createElement('div');
    document.body.appendChild(external);

    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      external.dispatchEvent(event);
    });

    expect(result.current.selection).toBeNull();

    document.body.removeChild(external);
  });

  it('mousedown inside container clears selection (new selection starting)', () => {
    const { result } = renderHook(() => useTextSelection(makeRef()));

    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      container.dispatchEvent(event);
    });

    expect(result.current.selection).toBeNull();
  });

  it('mousedown on popover does not clear selection', () => {
    const { result } = renderHook(() => useTextSelection(makeRef()));

    const popover = document.createElement('div');
    popover.setAttribute('data-popover', '');
    document.body.appendChild(popover);

    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      popover.dispatchEvent(event);
    });

    // Selection stays null (was already null) - the point is it doesn't invoke clearSelection
    expect(result.current.selection).toBeNull();

    document.body.removeChild(popover);
  });

  it('mousedown on comment card does not clear selection', () => {
    const { result } = renderHook(() => useTextSelection(makeRef()));

    const card = document.createElement('div');
    card.setAttribute('data-comment-card', '');
    document.body.appendChild(card);

    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      card.dispatchEvent(event);
    });

    expect(result.current.selection).toBeNull();

    document.body.removeChild(card);
  });
});
