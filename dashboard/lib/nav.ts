import {
  LayoutDashboard,
  Wallet,
  Activity,
  TrendingUp,
  Target,
  User,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "סקירה", icon: LayoutDashboard },
  { href: "/dashboard/finance", label: "פיננסים", icon: Wallet },
  { href: "/dashboard/operations", label: "תפעול", icon: Activity },
  { href: "/dashboard/sales", label: "מכירות", icon: TrendingUp },
  { href: "/dashboard/strategy", label: "אסטרטגיה", icon: Target },
  { href: "/dashboard/personal", label: "אישי", icon: User },
  { href: "/dashboard/settings", label: "הגדרות", icon: Settings },
];

// items shown in the mobile bottom bar (max 5 for ergonomics)
export const BOTTOM_NAV = NAV_ITEMS.filter((i) =>
  ["/dashboard", "/dashboard/finance", "/dashboard/operations", "/dashboard/sales", "/dashboard/personal"].includes(
    i.href
  )
);
