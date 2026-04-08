import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionPopover } from './SelectionPopover';

const mockRect = new DOMRect(100, 200, 300, 20);

describe('SelectionPopover', () => {
  it('renders textarea and buttons', () => {
    render(<SelectionPopover rect={mockRect} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Add your comment/)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Comment')).toBeInTheDocument();
  });

  it('shows Cmd+Enter hint', () => {
    render(<SelectionPopover rect={mockRect} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Cmd+Enter')).toBeInTheDocument();
  });

  it('Comment button is disabled when textarea is empty', () => {
    render(<SelectionPopover rect={mockRect} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Comment')).toBeDisabled();
  });

  it('Comment button calls onSubmit with trimmed text', async () => {
    const onSubmit = vi.fn();
    render(<SelectionPopover rect={mockRect} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Add your comment/), '  hello  ');
    await userEvent.click(screen.getByText('Comment'));

    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('Cancel button calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<SelectionPopover rect={mockRect} onSubmit={vi.fn()} onCancel={onCancel} />);

    await userEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<SelectionPopover rect={mockRect} onSubmit={vi.fn()} onCancel={onCancel} />);

    await userEvent.type(screen.getByPlaceholderText(/Add your comment/), '{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });

  it('sets data-popover attribute', () => {
    const { container } = render(
      <SelectionPopover rect={mockRect} onSubmit={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container.querySelector('[data-popover]')).toBeInTheDocument();
  });
});
