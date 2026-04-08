import { describe, it, expect } from 'vitest';
import { parsePlan } from './planParser.js';

describe('parsePlan', () => {
  it('returns untitled plan for empty string', () => {
    const result = parsePlan('');
    expect(result.title).toBe('Untitled Plan');
    expect(result.sections).toEqual([]);
    expect(result.rawMarkdown).toBe('');
  });

  it('extracts title from first h1', () => {
    const result = parsePlan('# My Plan\n\nSome content');
    expect(result.title).toBe('My Plan');
  });

  it('uses Untitled Plan when no h1 exists', () => {
    const result = parsePlan('## Section A\n\nContent');
    expect(result.title).toBe('Untitled Plan');
  });

  it('only uses the first h1 as title', () => {
    const result = parsePlan('# First Title\n\n# Second Title');
    expect(result.title).toBe('First Title');
  });

  it('creates a single root section for one heading', () => {
    const result = parsePlan('# Title\n\nContent here');
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].heading).toBe('Title');
    expect(result.sections[0].level).toBe(1);
  });

  it('creates flat siblings for multiple h2 headings', () => {
    const md = '## Section A\n\nContent A\n\n## Section B\n\nContent B';
    const result = parsePlan(md);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toBe('Section A');
    expect(result.sections[1].heading).toBe('Section B');
  });

  it('nests h3 under preceding h2', () => {
    const md = '## Parent\n\n### Child\n\nContent';
    const result = parsePlan(md);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].heading).toBe('Parent');
    expect(result.sections[0].children).toHaveLength(1);
    expect(result.sections[0].children[0].heading).toBe('Child');
  });

  it('builds correct h2/h3/h4 hierarchy', () => {
    const md = '## A\n### B\n#### C\n### D\n## E';
    const result = parsePlan(md);
    expect(result.sections).toHaveLength(2); // A and E
    expect(result.sections[0].children).toHaveLength(2); // B and D
    expect(result.sections[0].children[0].children).toHaveLength(1); // C
  });

  it('calculates correct startLine for sections', () => {
    const md = '# Title\n\nParagraph\n\n## Section';
    const result = parsePlan(md);
    expect(result.sections[0].startLine).toBe(0); // # Title is line 0
    expect(result.sections[0].children[0].startLine).toBe(4); // ## Section is line 4
  });

  it('calculates correct endLine for sections', () => {
    const md = '## A\nContent A\n## B\nContent B';
    const result = parsePlan(md);
    // A ends at line 2 (start of B)
    expect(result.sections[0].endLine).toBe(2);
    // B ends at the total number of lines
    expect(result.sections[1].endLine).toBe(4);
  });

  it('extracts rawContent for each section', () => {
    const md = '## Section\nLine 1\nLine 2';
    const result = parsePlan(md);
    expect(result.sections[0].rawContent).toBe('## Section\nLine 1\nLine 2');
  });

  it('generates slugified section IDs', () => {
    const md = '## Hello World!';
    const result = parsePlan(md);
    expect(result.sections[0].id).toBe('hello-world');
  });

  it('generates fallback ID for empty heading text after slugify', () => {
    // Heading with only special chars that slugify removes
    const md = '## !!!';
    const result = parsePlan(md);
    expect(result.sections[0].id).toBe('section-0');
  });

  it('preserves rawMarkdown in output', () => {
    const md = '# Title\n\nSome content';
    const result = parsePlan(md);
    expect(result.rawMarkdown).toBe(md);
  });

  it('handles headings with trailing spaces', () => {
    const md = '## Trimmed   ';
    const result = parsePlan(md);
    expect(result.sections[0].heading).toBe('Trimmed');
  });

  it('handles deeply nested sections (h2 through h6)', () => {
    const md = '## L2\n### L3\n#### L4\n##### L5\n###### L6';
    const result = parsePlan(md);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].children[0].children[0].children[0].children[0].heading).toBe('L6');
  });

  it('sibling at same level after nested children pops back correctly', () => {
    const md = '## A\n### A1\n### A2\n## B';
    const result = parsePlan(md);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].children).toHaveLength(2);
    expect(result.sections[1].heading).toBe('B');
    expect(result.sections[1].children).toHaveLength(0);
  });
});
