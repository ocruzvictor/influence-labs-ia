"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  name: string;
  email: string;
  role: string;
}

export function UserMenu({ name, email, role }: UserMenuProps): React.ReactElement {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

  async function handleLogout(): Promise<void> {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        redirect: "manual",
      });
      // Whether or not the redirect was followed, force navigation.
      if (res.type === "opaqueredirect" || res.ok || res.status === 0) {
        window.location.href = "/login";
        return;
      }
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-2.5 py-1.5 text-sm font-medium text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold uppercase">
          {initials}
        </span>
        <span className="hidden text-xs sm:inline">{name.split(" ")[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs font-normal text-muted-foreground">{email}</div>
          <div className="pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {role}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            toast.info("Auditoria chega na Story 1.6");
          }}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Auditoria
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void handleLogout();
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
