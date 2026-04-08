import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePlan } from './usePlan';

const mockFetchPlan = vi.fn();
const mockUseWebSocket = vi.fn().mockReturnValue({ connected: false });
let capturedOnMessage: ((msg: any) => void) | null = null;

vi.mock('../lib/api', () => ({
  fetchPlan: (...args: any[]) => mockFetchPlan(...args),
}));

vi.mock('./useWebSocket', () => ({
  useWebSocket: (onMessage: (msg: any) => void) => {
    capturedOnMessage = onMessage;
    return mockUseWebSocket();
  },
}));

describe('usePlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnMessage = null;
    mockUseWebSocket.mockReturnValue({ connected: true });
  });

  it('returns loading=true initially when filename is provided', () => {
    mockFetchPlan.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => usePlan('test.md'));
    expect(result.current.loading).toBe(true);
    expect(result.current.plan).toBeNull();
  });

  it('fetches plan data on mount', async () => {
    const planData = { filename: 'test.md', parsed: { title: 'Test' }, review: null };
    mockFetchPlan.mockResolvedValue(planData);

    const { result } = renderHook(() => usePlan('test.md'));

    await waitFor(() => {
      expect(result.current.plan).toEqual(planData);
    });
    expect(result.current.loading).toBe(false);
    expect(mockFetchPlan).toHaveBeenCalledWith('test.md');
  });

  it('sets error on failed fetch', async () => {
    mockFetchPlan.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePlan('test.md'));

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
    expect(result.current.loading).toBe(false);
  });

  it('does nothing when filename is null', () => {
    const { result } = renderHook(() => usePlan(null));
    expect(result.current.loading).toBe(false);
    expect(mockFetchPlan).not.toHaveBeenCalled();
  });

  it('reloads plan when WebSocket plan-updated matches filename', async () => {
    const planData = { filename: 'test.md', parsed: { title: 'Test' }, review: null };
    mockFetchPlan.mockResolvedValue(planData);

    renderHook(() => usePlan('test.md'));

    await waitFor(() => {
      expect(mockFetchPlan).toHaveBeenCalledTimes(1);
    });

    // Simulate WebSocket message
    capturedOnMessage?.({ type: 'plan-updated', filename: 'test.md' });

    await waitFor(() => {
      expect(mockFetchPlan).toHaveBeenCalledTimes(2);
    });
  });

  it('ignores WebSocket messages for other filenames', async () => {
    const planData = { filename: 'test.md', parsed: { title: 'Test' }, review: null };
    mockFetchPlan.mockResolvedValue(planData);

    renderHook(() => usePlan('test.md'));

    await waitFor(() => {
      expect(mockFetchPlan).toHaveBeenCalledTimes(1);
    });

    capturedOnMessage?.({ type: 'plan-updated', filename: 'other.md' });

    // Should still be 1 call
    expect(mockFetchPlan).toHaveBeenCalledTimes(1);
  });

  it('exposes connected from useWebSocket', async () => {
    mockFetchPlan.mockResolvedValue({});
    mockUseWebSocket.mockReturnValue({ connected: true });

    const { result } = renderHook(() => usePlan('test.md'));
    expect(result.current.connected).toBe(true);
  });
});
