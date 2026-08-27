import { ChevronDown2Icon } from '@/icons/icons';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from './nav-items';
import { useEffect, useState } from 'react';

export default function DesktopNav() {
  const pathname = usePathname();
  const [activeDropdownKey, setActiveDropdownKey] = useState('');

  function toggleActiveDropdown(key: string) {
    setActiveDropdownKey((prevKey) => (prevKey === key ? '' : key));
  }

  useEffect(() => {
    // Hide dropdown on pathname changes
    setActiveDropdownKey('');
  }, [pathname]);

  return (
    <nav className="hidden lg:flex lg:items-center bg-white dark:bg-[#161F32] border border-gray-200 dark:border-white/20 rounded-full px-2 py-1.5 max-h-fit shadow-sm dark:shadow-none">
      {navItems.map((item) => {
        if (item.type === 'link') {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-gray-600 dark:text-gray-300 text-xs tracking-wider px-5 py-2 rounded-full hover:text-gray-900 dark:hover:text-white font-semibold transition-all duration-300 ease-in-out',
                {
                  'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm':
                    pathname === item.href,
                }
              )}
            >
              {item.label}
            </Link>
          );
        }

        if (item.type === 'dropdown') {
          const toggleThisDropdown = () => {
            toggleActiveDropdown(item.label);
          };

          const isDropdownActive = activeDropdownKey === item.label;

          return (
            <div key={item.label} className="relative">
              <button
                onClick={toggleThisDropdown}
                onMouseEnter={toggleThisDropdown}
                onMouseLeave={toggleThisDropdown}
                onKeyDown={(e) => {
                  if (isDropdownActive && e.key === 'Escape') {
                    toggleThisDropdown();
                  }
                }}
                className={cn(
                  'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white group text-xs tracking-wider inline-flex gap-1 items-center px-5 py-2 font-semibold rounded-full transition-all duration-300 ease-in-out',
                  {
                    'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white shadow-sm':
                      item.items.some(({ href }) => pathname?.includes(href)),
                  }
                )}
              >
                <span>{item.label}</span>
                <ChevronDown2Icon
                  className={cn('size-4 transition-transform duration-200', {
                    'rotate-180': isDropdownActive,
                  })}
                />
              </button>

              {isDropdownActive && (
                <div
                  onMouseEnter={toggleThisDropdown}
                  onMouseLeave={toggleThisDropdown}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      toggleThisDropdown();
                    }
                  }}
                  className="absolute right-0 w-[266px] bg-white dark:bg-dark-secondary dark:border-gray-800 rounded-2xl shadow-theme-lg border border-gray-100 p-3 z-50"
                >
                  <div className="space-y-1">
                    {item.items.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                      >
                        {subItem.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }
      })}
    </nav>
  );
}
