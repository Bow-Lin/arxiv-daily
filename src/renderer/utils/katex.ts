import katex from 'katex'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.use({ gfm: true })

/**
 * Extract LaTeX formulas from text and replace with placeholders.
 * Returns { text, formulas } where text has %LATEX_0%, %LATEX_1%, etc.
 */
function extractFormulas(text: string): { text: string; formulas: string[] } {
  const formulas: string[] = []

  // Extract block math ($$...$$ or \[...\])
  let processed = text.replace(/\$\$([\s\S]*?)\$\$|\\\[(.*?)\\\]/g, (_match, dollar, bracket) => {
    const tex = (dollar ?? bracket).trim()
    const idx = formulas.length
    formulas.push(tex)
    return `%LATEX_BLOCK_${idx}%`
  })

  // Extract inline math ($...$ or \(...\))
  processed = processed.replace(/\$([^\$\n]+?)\$|\\\((.+?)\\\)/g, (_match, dollar, bracket) => {
    const tex = (dollar ?? bracket).trim()
    const idx = formulas.length
    formulas.push(tex)
    return `%LATEX_INLINE_${idx}%`
  })

  return { text: processed, formulas }
}

/**
 * Render LaTeX formulas in text that has been markdown-parsed to HTML.
 * Handles text-mode commands and replaces placeholder tokens.
 */
function renderLatexTokens(text: string, formulas: string[]): string {
  if (!text) return ''

  // 1. Convert text-mode LaTeX commands to HTML (before math processing)
  let html = text
    .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
    .replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
    .replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>')
    .replace(/\\texttt\{([^}]*)\}/g, '<code>$1</code>')

  // 2. Render block math placeholders
  html = html.replace(/%LATEX_BLOCK_(\d+)%/g, (_match, idx) => {
    const tex = formulas[Number(idx)]
    if (!tex) return _match
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: false })
    } catch {
      return _match
    }
  })

  // 3. Render inline math placeholders
  html = html.replace(/%LATEX_INLINE_(\d+)%/g, (_match, idx) => {
    const tex = formulas[Number(idx)]
    if (!tex) return _match
    try {
      return katex.renderToString(tex, { displayMode: false, throwOnError: false })
    } catch {
      return _match
    }
  })

  return html
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: [
      'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'msubsup',
      'mfrac', 'msqrt', 'mover', 'munder', 'munderover', 'mtable', 'mtr', 'mtd',
      'annotation', 'annotation-xml', 'math', 'mglyph', 'mspace', 'mstyle',
      'mpadded', 'menclose', 'mscarries', 'mscarry', 'mstack', 'mlongdiv',
    ],
    ADD_ATTR: [
      'xmlns', 'columnalign', 'columnspacing', 'mathvariant', 'stretchy',
      'lspace', 'rspace', 'height', 'depth', 'width', 'src', 'alttext',
      'encoding', 'xlink:href', 'cdgroup', 'data-semantic', 'data-type',
    ],
  })
}

/**
 * Render LaTeX formulas and text-mode commands in plain text.
 * For use with non-HTML content (e.g., abstracts).
 */
export function renderLatex(text: string): string {
  if (!text) return ''
  const { text: extracted, formulas } = extractFormulas(text)
  return sanitize(renderLatexTokens(extracted, formulas))
}

/**
 * Render Markdown text with LaTeX support.
 * LaTeX formulas are extracted before markdown parsing to avoid HTML corruption.
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  const preprocessed = preprocessCJK(text)
  const { text: extracted, formulas } = extractFormulas(preprocessed)
  const html = marked.parse(extracted, { async: false }) as string
  return sanitize(renderLatexTokens(html, formulas))
}

/**
 * Render Markdown to sanitized HTML, without LaTeX rendering.
 */
export function renderMarkdownOnly(text: string): string {
  if (!text) return ''
  const preprocessed = preprocessCJK(text)
  const html = marked.parse(preprocessed, { async: false }) as string
  return sanitize(html)
}

const CJK_RANGE = '\\u2e80-\\u9fff\\uf900-\\ufaff\\u3400-\\u4dbf\\u3000-\\u303f\\uff00-\\uffef'

function preprocessCJK(text: string): string {
  // Insert ZWSP between CJK char and ** to help marked recognize emphasis
  return text
    .replace(new RegExp(`([${CJK_RANGE}])(\\*\\*)`, 'g'), '$1\u200b$2')
    .replace(new RegExp(`(\\*\\*)([${CJK_RANGE}])`, 'g'), '$1\u200b$2')
}
