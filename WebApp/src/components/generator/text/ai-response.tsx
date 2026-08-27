'use client';

import { CopyToClipboard } from '@/components/copy-to-clipboard';
import { CitationBubble } from '../CitationBubble';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';

type PropsType = {
  response: string;
  annotations?: any[];
};

// Transform db-block-X into markdown links so ReactMarkdown parses them.
// Handles cases like [db-block-1, db-block-2] or raw db-block-1.
function preprocessCitations(text: string) {
  // First strip brackets that purely wrap citation lists, e.g. [db-block-1, db-block-2]
  let cleaned = text.replace(/\[((?:\s*db-block-\d+\s*,?)+)\]/g, ' $1 ');
  
  // Then replace all raw db-block-X with markdown links
  return cleaned.replace(/(db-block-\d+)/g, '[$1](#citation-$1)');
}

export default function AiResponse({ response, annotations }: PropsType) {
  const processedResponse = preprocessCitations(response);

  // Extract source blocks from annotations if present
  const sourceBlocksMap = React.useMemo(() => {
    const map = new Map<string, { url?: string; content?: string; title?: string }>();
    if (!annotations || !Array.isArray(annotations)) return map;

    for (const item of annotations) {
      // Structure: { type: 'retrieved_blocks', blocks: [...] } or [{ blocks: [...] }]
      const blocks = item?.blocks || (Array.isArray(item) ? item[0]?.blocks : undefined);
      if (Array.isArray(blocks)) {
        for (const block of blocks) {
          if (block.id) {
            const extractedUrl = block.url || block.source_url || block.metadata?.url || block.metadata?.source_url || '';
            map.set(block.id, {
              url: extractedUrl,
              content: block.content || block.highlight_snippet,
              title: block.metadata?.title || block.title || extractedUrl
            });
          }
        }
      }
    }
    return map;
  }, [annotations]);

  return (
    <div className="w-full max-w-3xl mx-auto flex gap-4 group mt-6">
      <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0 mt-1">
        <div className="w-5 h-5 rounded-sm bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
          S
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-w-0">
        <div className="prose dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, href, children, ...props }) => {
                if (href?.startsWith('#citation-')) {
                  const id = href.replace('#citation-', '');
                  const source = sourceBlocksMap.get(id);
                  return (
                    <CitationBubble 
                      id={id} 
                      url={source?.url} 
                      content={source?.content} 
                    />
                  );
                }
                return <a href={href} {...props}>{children}</a>;
              }
            }}
          >
            {processedResponse}
          </ReactMarkdown>
        </div>

        <div className="mt-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyToClipboard text={response} />
        </div>
      </div>
    </div>
  );
}
