"use client";

import { usePathname } from "next/navigation";
import { Bell, Radar, Search } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

function currentTitle(pathname: string): string {
  const match =
    NAV_ITEMS.filter((i) =>
      i.href === "/dashboard" ? pathname === i.href : pathname.startsWith(i.href)
    ).sort((a, b) => b.href.length - a.href.length)[0] ?? NAV_ITEMS[0];
  return match.label;
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
      {/* Mobile brand */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Radar className="size-4" />
        </div>
        <span className="font-bold">Soline</span>
      </div>

      <h1 className="hidden text-lg font-semibold lg:block">
        {currentTitle(pathname)}
      </h1>

      <div className="mr-auto flex items-center gap-1.5">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="חיפוש"
            placeholder="חיפוש לקוח, מדידה..."
            className="h-9 w-56 rounded-xl border border-input bg-background pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button variant="ghost" size="icon" aria-label="התראות" className="relative">
          <Bell className="size-5" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-destructive" />
        </Button>
        <ThemeToggle />
        <div className="ms-1 flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          מ
        </div>
      </div>
    </header>
  );
}
