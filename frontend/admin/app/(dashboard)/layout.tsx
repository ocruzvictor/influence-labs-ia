import { redirect } from "next/navigation";
import { TopNav } from "@/components/dashboard/top-nav";
import { getCurrentUser } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  // Belt-and-suspenders: proxy already enforces auth, but defend in depth
  // so renders never leak data if proxy is misconfigured.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#F5F3EE]">
      <TopNav user={{ name: user.name, email: user.email, role: user.role }} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
