'use client';

import type React from 'react';
import { Fragment, useState } from 'react';

import {
  CodeGeneratorIcon,
  EmailGeneratorIcon,
  ImageGeneratorIcon,
  TextGeneratorIcon,
  VideoGeneratorIcon,
} from '@/icons/icons';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Define the tab type
interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
  lightImage: string;
  darkImage: string;
  title: string;
  description: string;
}

export default function AIToolsTabs() {
  const [activeTab, setActiveTab] = useState('chat');

  // Tab data
  const tabs: Tab[] = [
    {
      id: 'chat',
      label: 'Chat Interface',
      icon: <TextGeneratorIcon className="w-8 h-8" />,
      lightImage: '/images/tab-image/tab-image-1.png',
      darkImage: '/images/tab-image/tab-image-1-dark.png',
      title: 'Real-time streaming chat with citations',
      description:
        'Engage with your indexed knowledge. Every fact is cited with inline block IDs that link directly to the source text fragments.',
    },
    {
      id: 'vision',
      label: 'Vision Engine',
      icon: <ImageGeneratorIcon className="w-8 h-8" />,
      lightImage: '/images/tab-image/tab-image-1.png',
      darkImage: '/images/tab-image/tab-image-1-dark.png',
      title: 'Multimodal Visual Q&A',
      description:
        'Upload or capture screenshots of complex diagrams and let Groq Vision analyze and extract actionable text instantly.',
    },
    {
      id: 'graph',
      label: 'Graph Map',
      icon: <CodeGeneratorIcon className="w-8 h-8" />,
      lightImage: '/images/tab-image/tab-image-1.png',
      darkImage: '/images/tab-image/tab-image-1-dark.png',
      title: 'Interactive Knowledge Graph',
      description:
        'Visualize multi-hop relationships between people, concepts, and organizations automatically extracted via GraphRAG.',
    },
    {
      id: 'report',
      label: 'Report Generator',
      icon: <VideoGeneratorIcon className="w-8 h-8" />,
      lightImage: '/images/tab-image/tab-image-1.png',
      darkImage: '/images/tab-image/tab-image-1-dark.png',
      title: 'Academic Report Generation',
      description:
        'Transform your entire research session into a fully formatted, downloadable DOCX academic paper with one click.',
    },
    {
      id: 'notebook',
      label: 'Research Notebook',
      icon: <EmailGeneratorIcon className="w-8 h-8" />,
      lightImage: '/images/tab-image/tab-image-1.png',
      darkImage: '/images/tab-image/tab-image-1-dark.png',
      title: 'Semantic Bookmarks',
      description:
        'Save important snippets. SnapMind embeds your bookmarks into a separate silo to discover non-obvious correlations.',
    },
  ];

  // Find the active tab
  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <section className="py-14 md:py-28 dark:bg-dark-primary">
      <div className="wrapper">
        <div className="max-w-2xl mx-auto mb-12 text-center">
          <h2 className="mb-3 font-bold text-center text-gray-800 dark:text-white/90 text-3xl md:text-title-lg">
            All the AI tools you need, at your Fingertips.
          </h2>
          <p className="max-w-2xl mx-auto leading-6 text-gray-500 dark:text-gray-400">
            Unlock the Potential of Innovation. Discover how SnapMind's Advanced AI Tools
            transform your ideas into reality with unmatched precision and
            intelligence.
          </p>
        </div>

        <div className="max-w-[1008px] mx-auto">
          <div>
            {/* Tab Navigation */}
            <div className="overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden mx-auto max-w-fit relative">
              <div className="flex gap-2 min-w-max rounded-full bg-gray-100 dark:bg-white/5 p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center h-12 gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 rounded-full ${activeTab === tab.id
                      ? 'bg-white dark:text-white/90 dark:bg-white/10 text-gray-800'
                      : 'text-gray-500 dark:text-gray-400 bg-transparent'
                      }`}
                  >
                    {tab.icon}
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}

            <div className="p-6 tab-img-bg overflow-hidden rounded-4xl mt-8">
              <div className="p-3 tab-img-overlay">
                {tabs.map((tab) => (
                  <Fragment key={tab.id}>
                    <Image
                      src={tab.lightImage || '/placeholder.svg'}
                      alt={tab.label}
                      width={936}
                      height={535}
                      className={cn(
                        'w-full rounded-2xl block dark:hidden',
                        currentTab.id !== tab.id && '!hidden'
                      )}
                      quality={90}
                      priority
                    />

                    <Image
                      src={tab.darkImage || '/placeholder.svg'}
                      alt={tab.label}
                      width={936}
                      height={535}
                      className={cn(
                        'w-full rounded-2xl hidden dark:block',
                        currentTab.id !== tab.id && '!hidden'
                      )}
                      quality={90}
                      priority
                    />
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="mt-6 text-center">
              <h2 className="mb-2 text-xl font-bold text-gray-800 dark:text-white/90">
                {currentTab.title}
              </h2>
              <p className="max-w-xl mx-auto mb-6 text-sm text-gray-500 dark:text-gray-400">
                {currentTab.description}
              </p>
              <button className="px-6 py-3 text-sm font-medium text-white transition-colors rounded-full bg-primary-500 hover:bg-primary-600">
                Try it now for free
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
