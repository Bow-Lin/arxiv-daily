import { describe, it, expect, vi } from 'vitest';

// DOMPurify requires a DOM environment; mock it for Node tests
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html,
  },
}));

// Mock katex to avoid full rendering in tests
vi.mock('katex', () => ({
  default: {
    renderToString: (tex: string, opts?: { displayMode?: boolean }) =>
      opts?.displayMode ? `<div class="katex">${tex}</div>` : `<span class="katex">${tex}</span>`,
  },
}));

import { renderLatex, renderMarkdown, renderMarkdownOnly } from '../katex';

describe('renderLatex', () => {
  it('renders block math with $$...$$', () => {
    const result = renderLatex('$$E = mc^2$$');
    expect(result).toContain('<div class="katex">E = mc^2</div>');
  });

  it('renders inline math with $...$', () => {
    const result = renderLatex('The formula $x^2$ is famous');
    expect(result).toContain('<span class="katex">x^2</span>');
  });

  it('renders block math with \\[...\\]', () => {
    const result = renderLatex('\\[ \\sum_{i=1}^{n} i \\]');
    expect(result).toContain('<div class="katex">\\sum_{i=1}^{n} i</div>');
  });

  it('renders inline math with \\(...\\)', () => {
    const result = renderLatex('Use \\( \\alpha \\) here');
    expect(result).toContain('<span class="katex">\\alpha</span>');
  });

  it('handles multiple formulas', () => {
    const result = renderLatex('$a$ and $b$');
    expect(result.match(/katex/g)).toHaveLength(2);
  });

  it('returns empty string for empty input', () => {
    expect(renderLatex('')).toBe('');
  });

  it('preserves plain text around formulas', () => {
    const result = renderLatex('Hello $x$ world');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });
});

describe('renderMarkdown', () => {
  it('renders markdown bold text', () => {
    const result = renderMarkdown('**bold**');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('renders markdown italic text', () => {
    const result = renderMarkdown('*italic*');
    expect(result).toContain('<em>italic</em>');
  });

  it('renders LaTeX inside markdown', () => {
    const result = renderMarkdown('The **formula** $E=mc^2$ is cool');
    expect(result).toContain('<strong>formula</strong>');
    expect(result).toContain('<span class="katex">E=mc^2</span>');
  });

  it('renders block math inside markdown', () => {
    const result = renderMarkdown('# Title\n\n$$\\int_0^1 x dx$$\n\nParagraph');
    expect(result).toContain('<div class="katex">\\int_0^1 x dx</div>');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});

describe('renderMarkdownOnly', () => {
  it('renders markdown without LaTeX processing', () => {
    const result = renderMarkdownOnly('**bold** and $x$');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).not.toContain('class="katex"');
    expect(result).toContain('$x$');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdownOnly('')).toBe('');
  });
});
