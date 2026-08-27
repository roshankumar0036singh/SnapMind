export const navItems = [
  {
    type: 'link',
    href: '/',
    label: 'FEATURES',
  },
  {
    type: 'dropdown',
    label: 'PRODUCT',
    items: [
      { href: '/package', label: 'Package' },
      { href: '/mcp', label: 'MCP' },
      { href: '/extension', label: 'Extension' },
    ],
  },
  {
    type: 'link',
    label: 'BLOG',
    href: '/blog',
  },
  {
    type: 'link',
    label: 'TEAM',
    href: '/team',
  },
] satisfies NavItem[];

type NavItem = Record<string, string | unknown> &
  (
    | {
        type: 'link';
        href: string;
      }
    | {
        type: 'dropdown';
      }
  );
