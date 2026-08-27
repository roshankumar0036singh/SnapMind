'use client';

/**
 * Answer renderer: GFM markdown + syntax highlighting + Mermaid + inline citations.
 *
 * Citations are injected at the React level rather than through a remark plugin.
 * The model writes bare ids into ordinary prose (`... funding round [db-block-2].`),
 * so every text-bearing element override runs its string children through
 * `CITATION_RE` and swaps matches for a `<CitationChip>`. Doing it here — instead
 * of rewriting the mdast — means code blocks, inline code, and link text are
 * untouched for free, because those elements simply don't opt in.
 */

import { CITATION_RE } from '@/lib/format';
import type { RetrievedBlock } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactNode,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import CitationChip from './citation';

/* -------------------------- citation-aware children ------------------------- */

const BlocksContext = createContext<RetrievedBlock[] | undefined>(undefined);

/** Split one string into text runs and citation chips. */
function linkify(text: string, blocks: RetrievedBlock[] | undefined, keyBase: string): ReactNode[] {
  CITATION_RE.lastIndex = 0;
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = CITATION_RE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    n += 1;
    out.push(
      <CitationChip key={`${keyBase}-c${n}`} id={match[1].toLowerCase()} blocks={blocks} index={n} />,
    );
    last = match.index + match[0].length;
  }

  if (!n) return [text];
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Recursively rewrite string children; element children keep their own overrides. */
function withCitations(children: ReactNode, blocks: RetrievedBlock[] | undefined, keyBase: string): ReactNode {
  let hit = false;
  const mapped = Children.map(children, (child, i) => {
    if (typeof child !== 'string') return child;
    CITATION_RE.lastIndex = 0;
    if (!CITATION_RE.test(child)) return child;
    hit = true;
    return linkify(child, blocks, `${keyBase}-${i}`);
  });
  return hit ? mapped : children;
}

/**
 * Build a react-markdown component override for `tag` that injects citations.
 * Written as a factory so the eight text-bearing tags stay one line each.
 */
function citing<T extends ElementType>(tag: T, className?: string) {
  const Cited = ({ children, ...props }: any) => {
    const blocks = useContext(BlocksContext);
    const id = useId();
    const Tag = tag as ElementType;
    return (
      <Tag {...props} className={cn(className, (props as { className?: string }).className)}>
        {withCitations(children, blocks, id)}
      </Tag>
    );
  };
  Cited.displayName = `Cited(${String(tag)})`;
  return Cited;
}

/* --------------------------------- mermaid -------------------------------- */

/**
 * Mermaid is ~800 kB and only needed when a diagram actually appears, so the
 * module is imported on first render of a mermaid fence, not at module scope.
 */
function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setFailed(false);

    void (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const dark =
          typeof document !== 'undefined' &&
          document.documentElement.getAttribute('data-theme') === 'dark';

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: dark ? 'dark' : 'default',
          fontFamily: 'inherit',
          themeVariables: {
            primaryColor: dark ? '#312e81' : '#eef2ff',
            primaryTextColor: dark ? '#e0e7ff' : '#1f2937',
            primaryBorderColor: '#6366f1',
            lineColor: dark ? '#4b5563' : '#9ca3af',
          },
        });

        const { svg: rendered } = await mermaid.render(`mmd-${id}`, code);
        if (!cancelled) setSvg(rendered);
      } catch {
        // A half-typed diagram arriving mid-stream is the common case here.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (failed) {
    return (
      <div className="my-4 overflow-x-auto rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          Diagram source
        </p>
        <pre className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{code}</pre>
      </div>
    );
  }

  return (
    <div
      ref={holder}
      className="my-4 flex justify-center overflow-x-auto rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/10 dark:bg-dark-primary [&_svg]:h-auto [&_svg]:max-w-full"
      // Mermaid returns a serialized SVG; it is generated from the fence content
      // and rendered with securityLevel 'strict', which strips scripts and links.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    >
      {svg ? undefined : (
        <span className="py-6 text-xs text-gray-400 dark:text-gray-500">Rendering diagram…</span>
      )}
    </div>
  );
}

/* ------------------------------- code blocks ------------------------------ */

/** Flatten a highlighted <code> subtree back to plain text for the clipboard. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const [copied, setCopied] = useState(false);

  const { language, source, isMermaid } = useMemo(() => {
    const child = Children.toArray(children).find(
      (c): c is React.ReactElement<{ className?: string; children?: ReactNode }> => isValidElement(c),
    );
    const cls = child?.props?.className ?? '';
    const lang = /language-([\w+-]+)/.exec(cls)?.[1] ?? '';
    return {
      language: lang,
      source: textOf(child?.props?.children ?? children),
      isMermaid: lang === 'mermaid',
    };
  }, [children]);

  if (isMermaid) return <MermaidBlock code={source.trim()} />;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard denied — the code is still selectable */
    }
  };

  return (
    <div className="group relative my-4 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-[#111827]">
      <div className="flex items-center justify-between border-b border-gray-100 px-3.5 py-1.5 dark:border-white/10">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {language || 'text'}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-gray-400 transition hover:bg-gray-200/70 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
        >
          {copied ? <Check className="h-3 w-3 text-success-600" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        {...props}
        className="custom-scrollbar overflow-x-auto px-3.5 py-3 text-[12.5px] leading-relaxed [&_code]:bg-transparent [&_code]:p-0"
      >
        {children}
      </pre>
    </div>
  );
}

/* ------------------------------- components ------------------------------- */

const COMPONENTS: Components = {
  p: citing('p', 'my-2.5 leading-[1.75] first:mt-0 last:mb-0'),
  li: citing('li', 'my-1 leading-[1.7] marker:text-primary-500'),
  td: citing('td', 'border border-gray-100 px-3 py-2 align-top dark:border-white/10'),
  strong: citing('strong', 'font-semibold text-gray-900 dark:text-white'),
  em: citing('em'),
  h1: citing('h1', 'mb-2 mt-5 text-lg font-bold text-gray-900 first:mt-0 dark:text-white'),
  h2: citing('h2', 'mb-2 mt-5 text-base font-bold text-gray-900 first:mt-0 dark:text-white'),
  h3: citing('h3', 'mb-1.5 mt-4 text-[15px] font-semibold text-gray-900 first:mt-0 dark:text-white'),
  h4: citing('h4', 'mb-1.5 mt-3.5 text-sm font-semibold text-gray-900 first:mt-0 dark:text-white'),

  ul: (props) => <ul {...props} className="my-2.5 list-disc space-y-0.5 pl-5" />,
  ol: (props) => <ol {...props} className="my-2.5 list-decimal space-y-0.5 pl-5" />,

  blockquote: (props) => (
    <blockquote
      {...props}
      className="my-3 rounded-r-xl border-l-2 border-primary-400 bg-primary-50/50 py-1.5 pl-3.5 pr-3 text-gray-600 italic dark:bg-primary-500/10 dark:text-gray-300"
    />
  ),

  a: ({ href, children, ...props }) => (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-primary-600 underline decoration-primary-300 underline-offset-2 transition hover:text-primary-700 dark:text-primary-400"
    >
      {children}
    </a>
  ),

  hr: () => <hr className="my-5 border-gray-100 dark:border-white/10" />,

  table: (props) => (
    <div className="custom-scrollbar my-4 overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/10">
      <table {...props} className="table-zebra w-full border-collapse text-[13px]" />
    </div>
  ),
  thead: (props) => <thead {...props} className="bg-gray-50 dark:bg-white/5" />,
  th: (props) => (
    <th
      {...props}
      className="border border-gray-100 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400"
    />
  ),

  pre: CodeBlock,
  code: ({ className, children, ...props }) => {
    // Fenced code arrives already wrapped in <pre>, which CodeBlock styles.
    if (className?.includes('language-')) {
      return (
        <code {...props} className={className}>
          {children}
        </code>
      );
    }
    return (
      <code
        {...props}
        className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-primary-700 dark:bg-white/10 dark:text-primary-300"
      >
        {children}
      </code>
    );
  },

  img: ({ alt, ...props }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={alt ?? ''} className="my-3 max-w-full rounded-2xl border border-gray-100 dark:border-white/10" />
  ),
};

/* ---------------------------------- entry --------------------------------- */

export default function Markdown({
  content,
  blocks,
  className,
}: {
  content: string;
  blocks?: RetrievedBlock[];
  className?: string;
}) {
  return (
    <BlocksContext.Provider value={blocks}>
      <div className={cn('text-[14.5px] text-gray-700 dark:text-gray-200', className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
          components={COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      </div>
    </BlocksContext.Provider>
  );
}
