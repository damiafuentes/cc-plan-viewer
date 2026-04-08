import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewBar } from './ReviewBar';

describe('ReviewBar', () => {
  it('shows instruction text when no comments', () => {
    render(<ReviewBar hasComments={false} onCopy={vi.fn()} copied={false} />);
    expect(screen.getByText(/Looks good/)).toBeInTheDocument();
  });

  it('shows copy instruction when comments exist', () => {
    render(<ReviewBar hasComments={true} onCopy={vi.fn()} copied={false} />);
    expect(screen.getByText(/Copy your feedback/)).toBeInTheDocument();
  });

  it('copy button is disabled when no comments', () => {
    render(<ReviewBar hasComments={false} onCopy={vi.fn()} copied={false} />);
    const btn = screen.getByRole('button', { name: /Copy feedback/i });
    expect(btn).toBeDisabled();
  });

  it('copy button is enabled when comments exist', () => {
    render(<ReviewBar hasComments={true} onCopy={vi.fn()} copied={false} />);
    const btn = screen.getByRole('button', { name: /Copy feedback/i });
    expect(btn).toBeEnabled();
  });

  it('clicking copy button calls onCopy', async () => {
    const onCopy = vi.fn();
    render(<ReviewBar hasComments={true} onCopy={onCopy} copied={false} />);
    await userEvent.click(screen.getByRole('button', { name: /Copy feedback/i }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('shows Copied! text when copied is true', () => {
    render(<ReviewBar hasComments={true} onCopy={vi.fn()} copied={true} />);
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });
});
