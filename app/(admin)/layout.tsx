import AdminSidebar from '@/components/admin/Sidebar';
import AdminHeader from '@/components/admin/Header';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AdminSidebar />
      <div className="admin-main flex-1 flex flex-col" style={{ marginLeft: 240 }}>
        <AdminHeader />
        <main className="flex-1 p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
