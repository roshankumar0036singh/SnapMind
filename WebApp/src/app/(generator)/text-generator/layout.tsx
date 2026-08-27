import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

export const metadata: Metadata = {
  title: 'Text Generator',
};

export default function Layout({ children }: PropsWithChildren) {
  return (
    <main className="flex flex-col flex-1 min-h-0 h-full w-full bg-gray-50 dark:bg-gray-900">
      <div className="flex-1 flex flex-col min-h-0 h-full">
        <div className="relative flex flex-col flex-1 min-h-0 h-full isolate">{children}</div>
      </div>
    </main>
  );
}
