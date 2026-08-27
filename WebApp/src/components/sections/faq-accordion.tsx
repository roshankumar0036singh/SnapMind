"use client";

import { MinusIcon, PlusIcon } from "@/icons/icons";
import { useState } from "react";

// Define the FAQ item type
interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

export default function FaqAccordion() {
  const [activeItem, setActiveItem] = useState<number | null>(1);

  // FAQ data
  const faqItems: FAQItem[] = [
    {
      id: 1,
      question: "What platforms can SnapMind ingest?",
      answer:
        "SnapMind supports web pages, YouTube videos, Twitter threads, PDFs, DOCX, CSV files, and entire GitHub repositories out of the box.",
    },
    {
      id: 2,
      question: "Which LLMs power the system?",
      answer:
        "SnapMind uses a multi-model ensemble. We use Gemini 2.0 and Mistral for embeddings and general generation, and Groq (Llama 4 Scout) for lightning-fast multimodal vision analysis.",
    },
    {
      id: 3,
      question: "How does the Research Notebook work?",
      answer:
        "When you highlight and save text, it is embedded as a semantic bookmark. Our AI then performs hybrid search across your main documents and personalized notebook to discover non-obvious correlations between your ideas.",
    },
    {
      id: 4,
      question: "What is GraphRAG?",
      answer:
        "Traditional vector search struggles with multi-hop reasoning. SnapMind automatically extracts entities and relationships from your documents to build a queryable knowledge graph, allowing the AI to understand complex connections.",
    },
    {
      id: 5,
      question: "How do I configure my API keys?",
      answer:
        'SnapMind operates on a Bring Your Own Key (BYOK) model. You can add your Gemini, Mistral, Firecrawl, Groq, and Lingo.dev API keys securely through the Chrome Extension settings panel. Keys are sent via request headers and never stored on our servers.',
    },
  ];

  const toggleItem = (itemId: number) => {
    setActiveItem(activeItem === itemId ? null : itemId);
  };

  return (
    <section id="faq" className="py-14 md:py-28 dark:bg-[#171f2e]">
      <div className="wrapper">
        <div className="max-w-2xl mx-auto mb-12 text-center">
          <h2 className="mb-3 font-bold text-center text-gray-800 text-3xl dark:text-white/90 md:text-title-lg">
            Frequently Asked Questions
          </h2>
          <p className="max-w-md mx-auto leading-6 text-gray-500 dark:text-gray-400">
            We've answered all frequently asked questions. Still confused? Feel free
            to contact us.
          </p>
        </div>
        <div className="max-w-[600px] mx-auto">
          <div className="space-y-4">
            {faqItems.map((item) => (
              <FAQItem
                key={item.id}
                item={item}
                isActive={activeItem === item.id}
                onToggle={() => toggleItem(item.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// FAQ Item Component
function FAQItem({
  item,
  isActive,
  onToggle,
}: {
  item: FAQItem;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="pb-5 border-b border-gray-200 dark:border-gray-800">
      <button
        type="button"
        className="flex items-center justify-between w-full text-left"
        onClick={onToggle}
        aria-expanded={isActive}
      >
        <span className="text-lg font-medium text-gray-800 dark:text-white/90">
          {item.question}
        </span>
        <span className="flex-shrink-0 ml-6">
          {isActive ? <MinusIcon /> : <PlusIcon />}
        </span>
      </button>
      {isActive && (
        <div className="mt-5">
          <p className="text-base leading-7 text-gray-500 dark:text-gray-400">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  );
}
