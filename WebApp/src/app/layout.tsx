import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Onest } from 'next/font/google';
import './globals.css';
import { ToasterProvider } from './providers/toaster';
import { WorkspaceProvider } from '@/context/WorkspaceContext';

const onest = Onest({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'SnapMind - AI-driven Knowledge Management',
    template: '%s | SnapMind',
  },
  description:
    'SnapMind: The most powerful AI-driven platform for knowledge management and workflow optimization.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`bg-gray-50 dark:bg-dark-secondary min-h-screen flex flex-col ${onest.className}`}
      >
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* ToasterProvider must render before the children components */}
          {/* https://github.com/emilkowalski/sonner/issues/168#issuecomment-1773734618 */}
          <ToasterProvider />

          <WorkspaceProvider>
            <div className="isolate flex flex-col flex-1">{children}</div>
          </WorkspaceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
