import { AdminNav } from '@/components/admin/AdminNav';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-[var(--bg)] lg:flex">
      <AdminNav />
      <main className="min-w-0 flex-1 px-5 py-6 lg:px-8">{children}</main>
    </div>
  );
}
