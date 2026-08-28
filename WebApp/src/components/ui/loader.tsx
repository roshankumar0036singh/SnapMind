import { cn } from '@/lib/utils';

interface LoaderProps {
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
}

export function Loader({ className, size = 'default' }: LoaderProps) {
  const sizeClasses = {
    sm: { container: 'w-5 h-5', border: 'border-2', inset: 'inset-0.5', dot: 'w-1 h-1' },
    default: { container: 'w-10 h-10', border: 'border-2', inset: 'inset-1', dot: 'w-1.5 h-1.5' },
    lg: { container: 'w-16 h-16', border: 'border-[3px]', inset: 'inset-1.5', dot: 'w-2 h-2' },
    xl: { container: 'w-24 h-24', border: 'border-4', inset: 'inset-2', dot: 'w-3 h-3' },
  };

  const config = sizeClasses[size];

  return (
    <div className={cn("relative flex items-center justify-center", config.container, className)}>
      {/* Outer spinning ring (neon blue) */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full border-transparent border-t-primary-500 border-r-primary-500 animate-spin", 
          config.border
        )}
        style={{ animationDuration: '1s' }}
      ></div>
      
      {/* Inner spinning ring (magenta/pink), spinning opposite direction */}
      <div 
        className={cn(
          "absolute rounded-full border-transparent border-b-[#FF58D5] border-l-[#FF58D5] animate-spin", 
          config.border,
          config.inset
        )} 
        style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
      ></div>
      
      {/* Center pulsing dot */}
      <div 
        className={cn(
          "bg-white rounded-full animate-pulse shadow-[0_0_12px_rgba(78,110,255,1)]", 
          config.dot
        )}
      ></div>
    </div>
  );
}
