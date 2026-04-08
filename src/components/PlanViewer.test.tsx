import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PlanViewer } from './PlanViewer';
import type { PlanData } from '../lib/types';

// Mock hooks
vi.mock('../hooks/useReview', () => ({
  useReview: () => ({
    comments: [],
    overallComment: '',
    submitted: false,
    submitting: false,
    hasComments: false,
    addComment: vi.fn(),
    editComment: vi.fn(),
    deleteComment: vi.fn(),
    setOverallComment: vi.fn(),
    submit: vi.fn(),
    formatForClipboard: vi.fn().mockReturnValue(''),
  }),
}));

vi.mock('../hooks/useTextSelection', () => ({
  useTextSelection: () => ({
    selection: null,
    clearSelection: vi.fn(),
  }),
}));

vi.mock('../lib/highlights', () => ({
  createPendingHighlight: vi.fn(),
  removePendingHighlight: vi.fn(),
  promotePendingHighlight: vi.fn(),
  removeHighlights: vi.fn(),
  setHighlightActive: vi.fn(),
  getCommentIdFromElement: vi.fn(),
}));

const mockPlan: PlanData = {
  filename: 'test-plan.md',
  parsed: {
    title: 'Test Plan Title',
    sections: [],
    rawMarkdown: '# Test Plan Title\n\nSome content here',
  },
  review: null,
};

describe('PlanViewer', () => {
  it('renders PlanHeader with correct title', async () => {
    render(<PlanViewer plan={mockPlan} connected={true} />);
    await waitFor(() => {
      // Title appears in both PlanHeader h1 and MarkdownRenderer h1, use getAllByText
      const elements = screen.getAllByText('Test Plan Title');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Plan Review label', () => {
    render(<PlanViewer plan={mockPlan} connected={true} />);
    expect(screen.getByText('Plan Review')).toBeInTheDocument();
  });

  it('renders markdown content', async () => {
    render(<PlanViewer plan={mockPlan} connected={true} />);
    await waitFor(() => {
      expect(screen.getByText('Some content here')).toBeInTheDocument();
    });
  });

  it('renders GeneralComment area', () => {
    render(<PlanViewer plan={mockPlan} connected={true} />);
    expect(screen.getByText('General comment')).toBeInTheDocument();
  });

  it('renders ReviewBar', () => {
    render(<PlanViewer plan={mockPlan} connected={true} />);
    expect(screen.getByText(/Looks good/)).toBeInTheDocument();
  });

  it('renders copy button', () => {
    render(<PlanViewer plan={mockPlan} connected={true} />);
    expect(screen.getByRole('button', { name: /Copy feedback/i })).toBeInTheDocument();
  });
});
