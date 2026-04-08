import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectionBlock } from './SectionBlock';
import type { PlanSection, InlineComment } from '../lib/types';

function makeSection(overrides: Partial<PlanSection> = {}): PlanSection {
  return {
    id: 'test-section',
    heading: 'Test Section',
    level: 2,
    startLine: 0,
    endLine: 5,
    rawContent: '## Test Section\n\nSome content here',
    children: [],
    ...overrides,
  };
}

function makeComment(sectionId: string, body: string): InlineComment {
  return { sectionId, lineRange: [0, 0], body, createdAt: '2026-01-01' };
}

describe('SectionBlock', () => {
  it('renders section markdown content', async () => {
    render(
      <SectionBlock
        section={makeSection()}
        comments={[]}
        allComments={[]}
        onAddComment={vi.fn()}
        onRemoveComment={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Some content here')).toBeInTheDocument();
    });
  });

  it('shows comment count badge when comments exist', () => {
    const comment = makeComment('test-section', 'A comment');
    render(
      <SectionBlock
        section={makeSection()}
        comments={[comment]}
        allComments={[comment]}
        onAddComment={vi.fn()}
        onRemoveComment={vi.fn()}
      />
    );
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('does not show badge when no comments', () => {
    const { container } = render(
      <SectionBlock
        section={makeSection()}
        comments={[]}
        allComments={[]}
        onAddComment={vi.fn()}
        onRemoveComment={vi.fn()}
      />
    );
    expect(container.querySelector('.rounded-full')).not.toBeInTheDocument();
  });

  it('plus button toggles inline comment form', async () => {
    render(
      <SectionBlock
        section={makeSection()}
        comments={[]}
        allComments={[]}
        onAddComment={vi.fn()}
        onRemoveComment={vi.fn()}
      />
    );

    await userEvent.click(screen.getByTitle('Add comment'));
    expect(screen.getByPlaceholderText(/Add a comment/)).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Add comment'));
    expect(screen.queryByPlaceholderText(/Add a comment/)).not.toBeInTheDocument();
  });

  it('renders child sections recursively', async () => {
    const child = makeSection({
      id: 'child-section',
      heading: 'Child',
      level: 3,
      rawContent: '### Child\n\nChild content',
    });
    const parent = makeSection({ children: [child] });

    render(
      <SectionBlock
        section={parent}
        comments={[]}
        allComments={[]}
        onAddComment={vi.fn()}
        onRemoveComment={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });
  });
});
