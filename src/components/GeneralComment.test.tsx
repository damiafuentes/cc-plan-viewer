import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GeneralComment } from './GeneralComment';

describe('GeneralComment', () => {
  it('renders textarea with placeholder', () => {
    render(<GeneralComment value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Leave a general comment/)).toBeInTheDocument();
  });

  it('renders with provided value', () => {
    render(<GeneralComment value="my comment" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('my comment')).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    render(<GeneralComment value="" onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText(/Leave a general comment/), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('displays General comment label', () => {
    render(<GeneralComment value="" onChange={vi.fn()} />);
    expect(screen.getByText('General comment')).toBeInTheDocument();
  });
});
