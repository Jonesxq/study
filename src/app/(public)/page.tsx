export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
        <span className="text-lg font-semibold">未闲漫步</span>
        <nav className="flex gap-5 text-sm text-[var(--muted)]">
          <a href="/notes">笔记</a>
          <a href="/tags">标签</a>
          <a href="/search">搜索</a>
          <a href="/about">关于</a>
        </nav>
      </header>
      <section className="py-16">
        <h1 className="text-4xl font-semibold tracking-normal">最近在想什么</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          一个记录阅读、技术、生活观察和长期问题的中文笔记库。
        </p>
      </section>
    </main>
  );
}
