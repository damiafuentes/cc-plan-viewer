import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentThread } from './CommentThread';
import type { InlineComment } from '../lib/types';

function makeComment(body: string): InlineComment {
  return { sectionId: 's1', lineRange: [0, 0], body, createdAt: '2026-01-01' };
}

describe('CommentThread', () => {
  it('renders nothing when comments array is empty', () => {
    const { container } = render(<CommentThread comments={[]} onRemove={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders each comment body', () => {
    const comments = [makeComment('First'), makeComment('Second')];
    render(<CommentThread comments={comments} onRemove={vi.fn()} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('remove button calls onRemove with correct index', async () => {
    const onRemove = vi.fn();
    const comments = [makeComment('One'), makeComment('Two')];
    render(<CommentThread comments={comments} onRemove={onRemove} />);

    const buttons = screen.getAllByTitle('Remove comment');
    await userEvent.click(buttons[1]);
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
