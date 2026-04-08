import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from './useWebSocket';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.onopen?.();
  }
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
  simulateClose() {
    this.onclose?.();
  }
  simulateError() {
    this.onerror?.();
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('connects on mount using correct protocol', () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket(onMessage));

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('ws:');
  });

  it('sets connected to true on open', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket(onMessage));

    expect(result.current.connected).toBe(false);

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.connected).toBe(true);
  });

  it('calls onMessage with parsed JSON on message event', () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket(onMessage));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage({ type: 'plan-updated', filename: 'test.md' });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'plan-updated', filename: 'test.md' });
  });

  it('ignores invalid JSON messages without crashing', () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket(onMessage));

    act(() => {
      MockWebSocket.instances[0].onmessage?.({ data: 'not json' });
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('sets connected to false on close', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebSocket(onMessage));

    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });
    expect(result.current.connected).toBe(false);
  });

  it('reconnects after close with backoff', () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket(onMessage));
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });

    // Should reconnect after 1s (initial delay)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('closes WebSocket on unmount', () => {
    const onMessage = vi.fn();
    const { unmount } = renderHook(() => useWebSocket(onMessage));

    const ws = MockWebSocket.instances[0];
    unmount();

    expect(ws.close).toHaveBeenCalled();
  });

  it('closes WebSocket on error', () => {
    const onMessage = vi.fn();
    renderHook(() => useWebSocket(onMessage));

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateError();
    });

    expect(ws.close).toHaveBeenCalled();
  });
});
