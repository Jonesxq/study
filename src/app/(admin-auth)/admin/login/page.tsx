type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params?.error === '1';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm text-[var(--muted)]">未闲漫步</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-normal">登录后台</h1>
      {hasError ? (
        <p className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          用户名或密码不正确，请重新输入。
        </p>
      ) : null}
      <form action="/api/admin/login" method="post" className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm text-[var(--muted)]">用户名</span>
          <input
            className="w-full border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
            name="username"
            autoComplete="username"
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-[var(--muted)]">密码</span>
          <input
            className="w-full border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="w-full bg-[var(--accent)] px-4 py-3 font-medium text-white" type="submit">
          登录
        </button>
      </form>
    </main>
  );
}
