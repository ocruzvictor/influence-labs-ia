"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_LINKS, type NavLink } from "@/components/dashboard/nav-links";
import { UserMenu } from "@/components/dashboard/user-menu";

interface TopNavProps {
  user: { name: string; email: string; role: string };
}

export function TopNav({ user }: TopNavProps): React.ReactElement {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#1A1A2E] text-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-base">Studio Tirra</span>
          <span className="hidden text-[10px] uppercase tracking-[0.18em] text-white/50 sm:inline">
            Admin
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavItem key={link.href} link={link} active={isActive(pathname, link.href)} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <UserMenu name={user.name} email={user.email} role={user.role} />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white hover:bg-white/15 md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-1 px-4 pb-4">
                {NAV_LINKS.map((link) => (
                  <MobileNavItem
                    key={link.href}
                    link={link}
                    active={isActive(pathname, link.href)}
                    onSelect={() => setOpen(false)}
                  />
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ link, active }: { link: NavLink; active: boolean }): React.ReactElement {
  const baseCls =
    "rounded-md px-3 py-1.5 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40";
  const activeCls = active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white";

  if (!link.enabled) {
    return (
      <button
        type="button"
        onClick={() => toast.info(`${link.label} chega em breve`)}
        className={`${baseCls} ${activeCls}`}
      >
        {link.label}
      </button>
    );
  }

  return (
    <Link href={link.href as LinkProps["href"]} className={`${baseCls} ${activeCls}`}>
      {link.label}
    </Link>
  );
}

function MobileNavItem({
  link,
  active,
  onSelect,
}: {
  link: NavLink;
  active: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const cls = `block rounded-md px-3 py-2 text-sm ${active ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50"}`;

  if (!link.enabled) {
    return (
      <button
        type="button"
        className={`${cls} text-left`}
        onClick={() => {
          toast.info(`${link.label} chega em breve`);
          onSelect();
        }}
      >
        {link.label}
      </button>
    );
  }
  return (
    <Link href={link.href as LinkProps["href"]} className={cls} onClick={onSelect}>
      {link.label}
    </Link>
  );
}
