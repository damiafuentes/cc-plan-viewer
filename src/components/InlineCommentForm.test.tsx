import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineCommentForm } from './InlineCommentForm';

const defaultProps = {
  sectionId: 's1',
  lineRange: [0, 10] as [number, number],
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('InlineCommentForm', () => {
  it('renders textarea with placeholder', () => {
    render(<InlineCommentForm {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Add a comment/)).toBeInTheDocument();
  });

  it('Comment button is disabled when empty', () => {
    render(<InlineCommentForm {...defaultProps} />);
    expect(screen.getByText('Comment')).toBeDisabled();
  });

  it('Comment button calls onSubmit with correct args', async () => {
    const onSubmit = vi.fn();
    render(<InlineCommentForm {...defaultProps} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByPlaceholderText(/Add a comment/), '  my comment  ');
    await userEvent.click(screen.getByText('Comment'));

    expect(onSubmit).toHaveBeenCalledWith('s1', [0, 10], 'my comment');
  });

  it('Cancel button calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<InlineCommentForm {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<InlineCommentForm {...defaultProps} onCancel={onCancel} />);
    await userEvent.type(screen.getByPlaceholderText(/Add a comment/), '{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
