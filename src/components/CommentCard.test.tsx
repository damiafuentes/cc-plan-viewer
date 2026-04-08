import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentCard } from './CommentCard';

const defaultProps = {
  id: 'c1',
  body: 'Nice work',
  selectedText: 'some code',
  top: 100,
  active: false,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onHover: vi.fn(),
};

describe('CommentCard', () => {
  it('renders comment body', () => {
    render(<CommentCard {...defaultProps} />);
    expect(screen.getByText('Nice work')).toBeInTheDocument();
  });

  it('renders selected text', () => {
    render(<CommentCard {...defaultProps} />);
    expect(screen.getByText(/some code/)).toBeInTheDocument();
  });

  it('truncates selected text longer than 60 chars', () => {
    const longText = 'a'.repeat(80);
    render(<CommentCard {...defaultProps} selectedText={longText} />);
    expect(screen.getByText(/"a{60}\.\.\."$/)).toBeInTheDocument();
  });

  it('shows full selected text under 60 chars', () => {
    render(<CommentCard {...defaultProps} selectedText="short text" />);
    expect(screen.getByText(/"short text"/)).toBeInTheDocument();
  });

  it('shows Edit and Delete buttons when active', () => {
    render(<CommentCard {...defaultProps} active={true} />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('clicking Delete calls onDelete with id', async () => {
    const onDelete = vi.fn();
    render(<CommentCard {...defaultProps} active={true} onDelete={onDelete} />);
    await userEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('c1');
  });

  it('clicking Edit shows textarea with current body', async () => {
    render(<CommentCard {...defaultProps} active={true} />);
    await userEvent.click(screen.getByText('Edit'));
    expect(screen.getByDisplayValue('Nice work')).toBeInTheDocument();
  });

  it('Save in edit mode calls onEdit with new body', async () => {
    const onEdit = vi.fn();
    render(<CommentCard {...defaultProps} active={true} onEdit={onEdit} />);

    await userEvent.click(screen.getByText('Edit'));
    const textarea = screen.getByDisplayValue('Nice work');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'updated');
    await userEvent.click(screen.getByText('Save'));

    expect(onEdit).toHaveBeenCalledWith('c1', 'updated');
  });

  it('Escape in edit mode cancels and restores body', async () => {
    render(<CommentCard {...defaultProps} active={true} />);
    await userEvent.click(screen.getByText('Edit'));

    const textarea = screen.getByDisplayValue('Nice work');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'temp{Escape}');

    // Should be back to view mode with original body
    expect(screen.getByText('Nice work')).toBeInTheDocument();
  });

  it('mouse enter calls onHover with id', async () => {
    const onHover = vi.fn();
    const { container } = render(<CommentCard {...defaultProps} onHover={onHover} />);

    await userEvent.hover(container.querySelector('[data-comment-card]')!);
    expect(onHover).toHaveBeenCalledWith('c1');
  });

  it('mouse leave calls onHover with null', async () => {
    const onHover = vi.fn();
    const { container } = render(<CommentCard {...defaultProps} onHover={onHover} />);

    const card = container.querySelector('[data-comment-card]')!;
    await userEvent.hover(card);
    await userEvent.unhover(card);
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it('sets data-comment-card attribute', () => {
    const { container } = render(<CommentCard {...defaultProps} />);
    expect(container.querySelector('[data-comment-card]')).toBeInTheDocument();
  });
});
