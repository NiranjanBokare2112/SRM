"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  BarChart3, ChevronsLeft, ChevronsRight, Factory, LayoutDashboard, LogOut, Menu, Monitor, Moon, Package,
  ReceiptText, RotateCcw, Search, Settings, ShoppingCart, Sun, Truck, Users, X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { ToastProvider } from "@/components/admin/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: true },
  { href: "/admin/billing", label: "New Bill", icon: ShoppingCart, key: "F2" },
  { href: "/admin/sales", label: "Bills", icon: ReceiptText, ownerOnly: true },
  { href: "/admin/returns", label: "Sales Return", icon: RotateCcw, ownerOnly: true },
  { href: "/admin/customers", label: "Customers & Udhaar", icon: Users, ownerOnly: true },
  { href: "/admin/purchases", label: "Purchases", icon: Truck, ownerOnly: true },
  { href: "/admin/products", label: "Medicines & Stock", icon: Package, ownerOnly: true },
  { href: "/admin/suppliers", label: "Suppliers", icon: Factory, ownerOnly: true },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, ownerOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

/** Operators (counter staff) use the billing screen only (plus bill printing). Everything else is owner-only. */
const operatorAllowed = (path: string) => path === "/admin/billing" || path.startsWith("/admin/print/");

type State = "checking" | "ready" | "not-owner";
type Role = "owner" | "operator";
type Theme = "light" | "dark" | "system";
const THEME_KEY = "srm-admin-theme";
const COLLAPSE_KEY = "srm-admin-sidebar";

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* storage blocked */ } };

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>("checking");
  const [role, setRole] = useState<Role>("owner");
  const [email, setEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      // Restore per-browser preferences once we know we are on the client.
      const savedTheme = read(THEME_KEY);
      if (savedTheme === "dark" || savedTheme === "system" || savedTheme === "light") setTheme(savedTheme);
      setCollapsed(read(COLLAPSE_KEY) === "1");
      if (!data.user) { router.replace("/admin/login"); return; }
      setEmail(data.user.email ?? "");
      const { data: myRole } = await supabase.rpc("my_role");
      if (cancelled) return;
      if (myRole === "owner" || myRole === "operator") { setRole(myRole); setState("ready"); } else setState("not-owner");
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (state === "ready" && role === "operator" && !operatorAllowed(pathname)) router.replace("/admin/billing");
  }, [state, role, pathname, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F2") { event.preventDefault(); router.push("/admin/billing"); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((open) => !open); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const cycleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next); write(THEME_KEY, next);
  };
  const toggleCollapsed = () => { setCollapsed((c) => { write(COLLAPSE_KEY, c ? "0" : "1"); return !c; }); };
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const productHref = useCallback((name: string) => (role === "owner" ? `/admin/products?q=${encodeURIComponent(name)}` : "/admin/billing"), [role]);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  if (state !== "ready") {
    return (
      <div className="adm-body flex items-center justify-center p-5" data-theme={theme}>
        {state === "checking" ? <p className="text-sm text-[var(--ink-muted)]">Opening your store…</p> : (
          <div className="adm-card adm-card-pad max-w-md text-center">
            <h1 className="text-xl font-semibold">This account has no access</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-muted)]">{email} can sign in, but is not set up as an owner or operator. Ask the owner to add it in Settings → Operators.</p>
            <button className="button button-light mt-6" onClick={signOut}><LogOut size={16} /> Sign out</button>
          </div>
        )}
      </div>
    );
  }

  const visibleNav = role === "owner" ? nav : nav.filter((n) => !n.ownerOnly);
  const blocked = role === "operator" && !operatorAllowed(pathname);
  const links = (
    <nav className="flex flex-col gap-1" aria-label="Billing navigation">
      {visibleNav.map(({ href, label, icon: Icon, key }) => (
        <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="adm-nav-link" title={collapsed ? label : undefined}
          aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}>
          <Icon size={18} /> <span className="adm-nav-label">{label}</span> {key && <span className="adm-kbd">{key}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="adm-body adm-shell lg:grid" data-theme={theme} data-collapsed={collapsed}
      style={{ gridTemplateColumns: collapsed ? "4.5rem minmax(0,1fr)" : "15.5rem minmax(0,1fr)" }}>
      {/* Toasts render inside .adm-body so they pick up the theme tokens. */}
      <ToastProvider>
        <aside className="adm-sidebar hidden border-r border-[var(--line)] lg:block">
          <div className="sticky top-0 flex h-svh flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-4">
              <BrandLogo size="sm" />
            </div>
            <div className="p-3 pb-0">
              <button className="adm-nav-link w-full border border-[var(--line)]" onClick={() => setPaletteOpen(true)} title="Quick search (Ctrl+K)">
                <Search size={17} /> <span className="adm-nav-label">Search…</span> <span className="adm-kbd">Ctrl K</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{links}</div>
            <div className="border-t border-[var(--line)] p-3">
              <p className="adm-hide-collapsed truncate px-2 text-xs text-[var(--ink-muted)]" title={email}>
                <span className={`adm-badge mr-1.5 ${role === "owner" ? "adm-badge-blue" : "adm-badge-gray"}`}>{role === "owner" ? "Owner" : "Operator"}</span>{email}
              </p>
              <button className="adm-nav-link mt-1 w-full" onClick={cycleTheme} title={`Theme: ${themeLabel} (click to change)`}><ThemeIcon size={18} /> <span className="adm-nav-label">Theme: {themeLabel}</span></button>
              <button className="adm-nav-link w-full" onClick={toggleCollapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />} <span className="adm-nav-label">Collapse</span>
              </button>
              <button className="adm-nav-link w-full" onClick={signOut} title="Sign out"><LogOut size={18} /> <span className="adm-nav-label">Sign out</span></button>
            </div>
          </div>
        </aside>

        <header className="adm-surface sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-[var(--line)] px-4 lg:hidden">
          <BrandLogo size="sm" />
          <div className="flex gap-2">
            <button className="icon-button" onClick={() => setPaletteOpen(true)} aria-label="Quick search"><Search size={18} /></button>
            <button className="icon-button" onClick={cycleTheme} aria-label={`Theme: ${themeLabel}`}><ThemeIcon size={18} /></button>
            <button className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label={menuOpen ? "Close menu" : "Open menu"}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>
        {menuOpen && (
          <div className="adm-surface fixed inset-x-0 top-16 z-40 max-h-[calc(100svh-4rem)] overflow-y-auto border-b border-[var(--line)] p-3 shadow-lg lg:hidden">
            {links}
            <button className="adm-nav-link mt-1 w-full" onClick={signOut}><LogOut size={18} /> Sign out</button>
          </div>
        )}

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={pathname} className="adm-page">{blocked ? null : children}</div>
        </main>
        {paletteOpen && <CommandPalette links={visibleNav} onClose={closePalette} productHref={productHref} medicinesOnly={role === "operator"} />}
      </ToastProvider>
    </div>
  );
}
