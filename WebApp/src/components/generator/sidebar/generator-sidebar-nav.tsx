'use client';

import { NAV_GROUPS } from '@/components/dashboard/nav-config';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function GeneratorSidebarNav({ isCollapsed }: { isCollapsed?: boolean }) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className={cn('px-2 py-4', isCollapsed ? 'space-y-3' : 'space-y-5')}>
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.title ?? `group-${gi}`} className="space-y-1">
          {group.title && !isCollapsed && (
            <h2 className="text-xs font-medium text-gray-500 dark:text-gray-500 tracking-wider px-3 mb-2">
              {group.title}
            </h2>
          )}
          {group.title && isCollapsed && gi > 0 && (
            <div className="mx-auto w-6 border-t border-gray-100 dark:border-white/10 my-2" />
          )}

          <nav className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex items-center text-sm font-medium rounded-xl transition-all',
                    'focus-visible:outline-none focus-visible:shadow-ring',
                    isCollapsed
                      ? 'justify-center w-10 h-10 mx-auto px-0'
                      : 'gap-3 px-3 py-2.5',
                    active
                      ? 'bg-primary-50 text-primary-700 dark:bg-white/10 dark:text-white shadow-theme-xs'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center shrink-0 transition-opacity',
                      active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100',
                    )}
                  >
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
