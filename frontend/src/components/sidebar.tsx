"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileSearch,
  FileText,
  Globe,
  LayoutDashboard,
  Link2,
  MapPin,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNav = [
  { label: "Clients", href: "/clients", icon: Users },
];

function clientNav(id: string) {
  return [
    { label: "Dashboard", href: `/clients/${id}`, icon: LayoutDashboard },
    { label: "Plans", href: `/clients/${id}/plans`, icon: ClipboardList },
    { label: "Rank Tracker", href: `/clients/${id}/rankings`, icon: TrendingUp },
    { label: "Pages", href: `/clients/${id}/pages`, icon: FileText },
    { label: "GBP Insights", href: `/clients/${id}/gbp`, icon: MapPin },
    { label: "Analytics", href: `/clients/${id}/analytics`, icon: BarChart3 },
    { label: "Citations", href: `/clients/${id}/citations`, icon: Building2 },
    { label: "Backlinks", href: `/clients/${id}/backlinks`, icon: Link2 },
    { label: "Site Audit", href: `/clients/${id}/audit`, icon: FileSearch },
    { label: "Discovery", href: `/clients/${id}/discovery`, icon: Search },
  ];
}

export default function Sidebar() {
  const pathname = usePathname();

  const clientMatch = pathname.match(/^\/clients\/(\d+)/);
  const clientId = clientMatch?.[1];

  const links = clientId ? clientNav(clientId) : mainNav;

  return (
    <aside className="w-56 border-r border-gray-200 bg-white flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900">
          <Globe className="h-5 w-5 text-blue-600" />
          <span>SEO Tool</span>
        </Link>
      </div>

      {clientId && (
        <div className="px-4 py-2 border-b border-gray-100">
          <Link
            href="/clients"
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            &larr; All Clients
          </Link>
        </div>
      )}

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {links.map(({ label, href, icon: Icon }) => {
          const active =
            href === pathname ||
            (href !== `/clients/${clientId}` && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
