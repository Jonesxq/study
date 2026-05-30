const navItems = [
  { href: '/notes', label: '笔记' },
  { href: '/tags', label: '标签' },
  { href: '/search', label: '搜索' },
  { href: '/about', label: '关于' },
];

export function SiteHeader() {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-center sm:justify-between">
      <a className="text-lg font-semibold text-[var(--text)]" href="/">
        未闲漫步
      </a>
      <nav className="flex flex-wrap gap-5 text-sm text-[var(--muted)]">
        {navItems.map((item) => (
          <a className="hover:text-[var(--text)]" href={item.href} key={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
