import { Loader } from '@/components/ui/loader';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-50/80 dark:bg-[#06080C]/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader size="lg" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
          Loading SnapMind...
        </p>
      </div>
    </div>
  );
}
