'use client';
import { CloseIcon, MenuIcon } from '@/icons/icons';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import DesktopNav from './desktop-nav';
import MainMobileNav from './main-mobile-nav';
import ThemeToggle from './theme-toggle';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className={cn("sticky top-0 z-50 transition-all duration-500 ease-in-out", isScrolled ? "py-2" : "py-4 lg:py-6")}>
      <div className="px-4 sm:px-6 lg:px-7">
        <div className="grid grid-cols-2 items-center lg:grid-cols-[1fr_auto_1fr]">
          <div className={cn("flex items-center transition-all duration-500 ease-in-out", isScrolled ? "opacity-0 pointer-events-none -translate-x-4" : "opacity-100 translate-x-0")}>
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
              <Image
                src="/images/logo-transparent.png"
                className="object-contain h-8 sm:h-11 w-auto"
                alt="SnapMind Logo"
                width={130}
                height={80}
                priority
              />

              <span className="inline-block px-1.5 py-0.5 rounded-lg rounded-bl-none bg-primary-500/90 text-white text-[10px] sm:text-xs font-medium mb-0.5">
                Beta
              </span>
            </Link>
          </div>

          <DesktopNav />

          <div className={cn("flex items-center gap-4 justify-self-end transition-all duration-500 ease-in-out", isScrolled ? "opacity-0 pointer-events-none translate-x-4" : "opacity-100 translate-x-0")}>
            <ThemeToggle />

            <button
              onClick={(e) => {
                e.stopPropagation();
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              type="button"
              className="order-last shrink-0 inline-flex items-center justify-center p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>

            <Link
              href="/signin"
              className="hidden sm:inline-flex px-6 py-2.5 text-sm font-medium text-white transition-all bg-primary-600 rounded-full hover:bg-primary-700 active:scale-95"
            >
              Get Started
            </Link>

            <Link
              href="/signup"
              className="lg:inline-flex items-center px-6 py-2.5 bg-[#6B46FF] hover:bg-[#5835EE] hidden text-sm font-semibold text-white rounded-full transition-colors"
            >
              Start for free &rarr;
            </Link>
          </div>
        </div>
      </div>

      <MainMobileNav isOpen={mobileMenuOpen} />
    </header>
  );
}
