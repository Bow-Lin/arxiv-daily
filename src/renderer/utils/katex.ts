import katex from 'katex'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.use({ gfm: true })

/**
 * Render LaTeX formulas and text-mode commands in text.
 * Supports:
 *   Inline math: $...$ or \(...\)
 *   Block math:  $$...$$ or \[...\]
 *   Text mode:   \textbf{...}, \textit{...}, \emph{...}, \underline{...}
 */
export function renderLatex(text: string): string {
  if (!text) return ''

  // 1. Convert text-mode LaTeX commands to HTML (before math processing to avoid conflicts)
  let html = text
    .replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>')
    .replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>')
    .replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>')
    .replace(/\\texttt\{([^}]*)\}/g, '<code>$1</code>')

  // 2. Render block math ($$...$$ or \[...\])
  html = html.replace(/\$\$([\s\S]*?)\$\$|\\\[[\s\S]*?\\\]/g, (match, formula) => {
    const tex = extractTex(formula || match)
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: false })
    } catch {
      return match
    }
  })

  // 3. Render inline math ($...$ or \(...\))
  html = html.replace(/\$([^\$\n]+?)\$|\\\((.+?)\\\)/g, (match, inline1, inline2) => {
    const tex = extractTex(inline1 || inline2 || match)
    try {
      return katex.renderToString(tex, { displayMode: false, throwOnError: false })
    } catch {
      return match
    }
  })

  return sanitize(html)
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

function extractTex(s: string): string {
  return s.replace(/^\\\(|\\\)$/, '').trim()
}

/**
 * Render Markdown text, then apply LaTeX rendering.
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  // Pre-process: insert zero-width spaces around ** when adjacent to CJK chars
  const preprocessed = preprocessCJK(text)
  const html = marked.parse(preprocessed, { async: false }) as string
  return sanitize(renderLatex(html))
}

const CJK_RANGE = '\\u2e80-\\u9fff\\uf900-\\ufaff\\u3400-\\u4dbf\\u3000-\\u303f\\uff00-\\uffef'

function preprocessCJK(text: string): string {
  // Insert ZWSP between CJK char and ** to help marked recognize emphasis
  return text
    .replace(new RegExp(`([${CJK_RANGE}])(\\*\\*)`, 'g'), '$1\u200b$2')
    .replace(new RegExp(`(\\*\\*)([${CJK_RANGE}])`, 'g'), '$1\u200b$2')
}
