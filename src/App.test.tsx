import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock usePlan
const mockUsePlan = vi.fn();
vi.mock('./hooks/usePlan', () => ({
  usePlan: (...args: any[]) => mockUsePlan(...args),
}));

// Mock PlanViewer to avoid rendering the full component tree
vi.mock('./components/PlanViewer', () => ({
  PlanViewer: ({ plan }: any) => <div data-testid="plan-viewer">{plan.filename}</div>,
}));

import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no plan query param
    Object.defineProperty(window, 'location', {
      value: { search: '', protocol: 'http:', host: 'localhost:3847' },
      writable: true,
    });
  });

  it('shows waiting message when no plan query param', () => {
    mockUsePlan.mockReturnValue({ plan: null, loading: false, error: null, connected: false });
    render(<App />);
    expect(screen.getByText(/Waiting for a plan/)).toBeInTheDocument();
  });

  it('shows loading state when fetching', () => {
    window.location.search = '?plan=test.md';
    mockUsePlan.mockReturnValue({ plan: null, loading: true, error: null, connected: false });
    render(<App />);
    expect(screen.getByText('Loading plan...')).toBeInTheDocument();
  });

  it('shows error message on fetch failure', () => {
    window.location.search = '?plan=test.md';
    mockUsePlan.mockReturnValue({ plan: null, loading: false, error: 'Network error', connected: false });
    render(<App />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders PlanViewer with plan data', () => {
    window.location.search = '?plan=test.md';
    const plan = { filename: 'test.md', parsed: { title: 'Test', sections: [], rawMarkdown: '' }, review: null };
    mockUsePlan.mockReturnValue({ plan, loading: false, error: null, connected: true });
    render(<App />);
    expect(screen.getByTestId('plan-viewer')).toBeInTheDocument();
    expect(screen.getByText('test.md')).toBeInTheDocument();
  });

  it('returns null when plan is null and not loading with a filename', () => {
    window.location.search = '?plan=test.md';
    mockUsePlan.mockReturnValue({ plan: null, loading: false, error: null, connected: false });
    const { container } = render(<App />);
    expect(container.firstChild).toBeNull();
  });
});
