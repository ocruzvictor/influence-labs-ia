/**
 * Auth layout — used for /login and /verify.
 * No top nav; cream background; centered card.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-[#F5F3EE] px-4 py-12">
      {children}
    </div>
  );
}
