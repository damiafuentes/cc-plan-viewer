import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  it('renders markdown content', async () => {
    render(<MarkdownRenderer content="# Hello World" />);
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
  });

  it('sets data-section-id when provided', () => {
    const { container } = render(<MarkdownRenderer content="text" sectionId="my-section" />);
    const div = container.querySelector('[data-section-id="my-section"]');
    expect(div).toBeInTheDocument();
  });

  it('has prose class on container', () => {
    const { container } = render(<MarkdownRenderer content="text" />);
    expect(container.querySelector('.prose')).toBeInTheDocument();
  });

  it('renders GFM features like strikethrough', async () => {
    render(<MarkdownRenderer content="~~deleted~~" />);
    await waitFor(() => {
      const del = document.querySelector('del');
      expect(del).toBeInTheDocument();
      expect(del?.textContent).toBe('deleted');
    });
  });
});
