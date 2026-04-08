import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentSidebar } from './CommentSidebar';
import type { InlineComment } from '../lib/types';

function makeComment(body: string, selectedText?: string): InlineComment {
  return {
    sectionId: 's1',
    lineRange: [0, 0],
    body,
    createdAt: '2026-01-01',
    selectedText,
  };
}

describe('CommentSidebar', () => {
  it('renders nothing when comments array is empty', () => {
    const { container } = render(<CommentSidebar comments={[]} onRemove={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows Comments (N) header with correct count', () => {
    const comments = [makeComment('One'), makeComment('Two')];
    render(<CommentSidebar comments={comments} onRemove={vi.fn()} />);
    expect(screen.getByText('Comments (2)')).toBeInTheDocument();
  });

  it('renders comment body text', () => {
    render(<CommentSidebar comments={[makeComment('My feedback')]} onRemove={vi.fn()} />);
    expect(screen.getByText('My feedback')).toBeInTheDocument();
  });

  it('shows truncated selected text over 120 chars', () => {
    const longText = 'x'.repeat(150);
    render(<CommentSidebar comments={[makeComment('body', longText)]} onRemove={vi.fn()} />);
    expect(screen.getByText(new RegExp(`x{120}\\.\\.\\.`))).toBeInTheDocument();
  });

  it('shows full selected text under 120 chars', () => {
    render(<CommentSidebar comments={[makeComment('body', 'short quote')]} onRemove={vi.fn()} />);
    expect(screen.getByText('short quote')).toBeInTheDocument();
  });

  it('remove button calls onRemove with correct index', async () => {
    const onRemove = vi.fn();
    const comments = [makeComment('A'), makeComment('B')];
    render(<CommentSidebar comments={comments} onRemove={onRemove} />);

    const buttons = screen.getAllByTitle('Remove');
    await userEvent.click(buttons[0]);
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});
