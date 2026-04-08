import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewSummary } from './ReviewSummary';
import type { InlineComment } from '../lib/types';

const defaultProps = {
  inlineComments: [] as InlineComment[],
  overallComment: '',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  onCopyToClipboard: vi.fn(),
};

function makeComment(body: string, selectedText?: string): InlineComment {
  return { sectionId: 's1', lineRange: [0, 0], body, createdAt: '2026-01-01', selectedText };
}

describe('ReviewSummary', () => {
  it('renders Review Summary title', () => {
    render(<ReviewSummary {...defaultProps} />);
    expect(screen.getByText('Review Summary')).toBeInTheDocument();
  });

  it('shows inline comments count', () => {
    const comments = [makeComment('A'), makeComment('B')];
    render(<ReviewSummary {...defaultProps} inlineComments={comments} />);
    expect(screen.getByText('Inline comments (2)')).toBeInTheDocument();
  });

  it('shows comment body text', () => {
    const comments = [makeComment('My feedback')];
    render(<ReviewSummary {...defaultProps} inlineComments={comments} />);
    expect(screen.getByText('My feedback')).toBeInTheDocument();
  });

  it('truncates selected text at 100 chars', () => {
    const longText = 'z'.repeat(120);
    const comments = [makeComment('body', longText)];
    render(<ReviewSummary {...defaultProps} inlineComments={comments} />);
    expect(screen.getByText(new RegExp(`"z{100}\\.\\.\\."`))   ).toBeInTheDocument();
  });

  it('shows overall comment when present', () => {
    render(<ReviewSummary {...defaultProps} overallComment="Great plan" />);
    expect(screen.getByText('Great plan')).toBeInTheDocument();
    expect(screen.getByText('General comment')).toBeInTheDocument();
  });

  it('hides sections when empty', () => {
    render(<ReviewSummary {...defaultProps} />);
    expect(screen.queryByText(/Inline comments/)).not.toBeInTheDocument();
    expect(screen.queryByText('General comment')).not.toBeInTheDocument();
  });

  it('Send feedback button calls onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<ReviewSummary {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByText('Send feedback'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Cancel button calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ReviewSummary {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Copy to clipboard button calls onCopyToClipboard', async () => {
    const onCopy = vi.fn();
    render(<ReviewSummary {...defaultProps} onCopyToClipboard={onCopy} />);
    await userEvent.click(screen.getByText('Copy to clipboard'));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });
});
