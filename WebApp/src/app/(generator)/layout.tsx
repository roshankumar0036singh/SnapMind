import GeneratorWrapper from '@/components/generator/generator-wrapper';
import { CaptureProvider } from '@/context/CaptureContext';
import { SettingsProvider } from '@/context/SettingsContext';

export default async function GeneratorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SettingsProvider>
      {/* CaptureProvider depends on the active workspace, which the root layout provides. */}
      <CaptureProvider>
        <GeneratorWrapper>{children}</GeneratorWrapper>
      </CaptureProvider>
    </SettingsProvider>
  );
}
