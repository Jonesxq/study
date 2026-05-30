import Link from 'next/link';

const navItems = [
  { href: '/admin', label: '总览' },
  { href: '/admin/notes', label: '全部笔记' },
  { href: '/admin/notes/new', label: '新建笔记' },
  { href: '/admin/sync', label: '飞书同步' },
  { href: '/admin/settings', label: '站点设置' },
];

export function AdminNav() {
  return (
    <aside className="border-b border-[var(--line)] bg-[var(--surface)] lg:min-h-screen lg:w-56 lg:border-b-0 lg:border-r">
      <div className="px-5 py-4">
        <Link href="/admin" className="block text-base font-semibold">
          未闲漫步后台
        </Link>
        <p className="mt-1 text-xs text-[var(--muted)]">笔记管理</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
          >
            {item.label}
          </Link>
        ))}
        <form action="/api/admin/logout" method="post" className="lg:pt-3">
          <button
            type="submit"
            className="whitespace-nowrap px-3 py-2 text-left text-sm text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
          >
            退出登录
          </button>
        </form>
      </nav>
    </aside>
  );
}
