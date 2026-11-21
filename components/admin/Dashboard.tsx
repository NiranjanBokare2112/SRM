"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Minus, PackageX, RotateCcw, ShoppingCart, Table2, Truck, Users } from "lucide-react";
import { billNumber, dateLabel, firstOfMonth, istToday, money, qtyLabel, timeLabel } from "@/lib/billing/format";
import { db } from "@/lib/billing/queries";
import { errorMessage, modeLabel, type ProductStock, type Sale } from "@/lib/billing/types";
import { Alert, Loading } from "@/components/admin/ui";
import { BarList, ColumnChart, SegmentBar, type Column } from "@/components/admin/charts";

type Totals = { net: number; bills: number; profit: number; returns?: number };
type Stats = {
  from: string; to: string; previous_from: string; previous_to: string;
  totals: Totals; previous: Totals;
  by_mode: Record<"cash" | "upi" | "card" | "credit", number>;
  daily: { day: string; net: number; bills: number; profit: number }[];
  hourly: { hour: number; net: number; bills: number }[];
  top_products: { name: string; packing: string; pack_size: number; units: number; amount: number }[];
};

const ranges = [
  { key: "today", label: "Today", range: () => [istToday(), istToday()] },
  { key: "7d", label: "Last 7 days", range: () => [istToday(-6), istToday()] },
  { key: "30d", label: "Last 30 days", range: () => [istToday(-29), istToday()] },
  { key: "month", label: "This month", range: () => [firstOfMonth(), istToday()] },
] as const;
type RangeKey = (typeof ranges)[number]["key"];

const weekday = (iso: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(new Date(iso));
const dayLabel = (iso: string, days: number) => (days <= 7 ? weekday(iso) : String(Number(iso.slice(8))));
const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
const hourRange = (h: number) => `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`;

export function Dashboard() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("7d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<"net" | "profit">("net");
  const [showTable, setShowTable] = useState(false);
  const [recent, setRecent] = useState<Sale[]>([]);
  const [alerts, setAlerts] = useState({ low: 0, expiring: 0, expired: 0, udhaar: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [from, to] = ranges.find((r) => r.key === rangeKey)!.range();
      const { data, error: e } = await db().rpc("dashboard_stats", { p_from: from, p_to: to });
      if (cancelled) return;
      if (e) setError(errorMessage(e, "Could not load the dashboard figures.")); else { setError(""); setStats(data as Stats); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [rangeKey]);

  useEffect(() => {
    (async () => {
      const today = istToday();
      const [sales, stock, expiring, udhaar] = await Promise.all([
        db().from("sales").select("*").order("created_at", { ascending: false }).limit(6),
        db().from("product_stock").select("stock_units, expired_units, reorder_level, pack_size, active").eq("active", true),
        db().from("batches").select("id", { count: "exact", head: true }).gt("stock_units", 0).gte("expiry", today).lte("expiry", istToday(60)),
        db().from("customer_balances").select("balance").gt("balance", 0),
      ]);
      setRecent((sales.data ?? []) as Sale[]);
      const rows = (stock.data ?? []) as ProductStock[];
      setAlerts({
        low: rows.filter((r) => r.reorder_level > 0 && r.stock_units < r.reorder_level * r.pack_size).length,
        expired: rows.filter((r) => r.expired_units > 0).length,
        expiring: expiring.count ?? 0,
        udhaar: ((udhaar.data ?? []) as { balance: number }[]).reduce((s, r) => s + Number(r.balance), 0),
      });
    })();
  }, []);

  const isToday = rangeKey === "today";
  const days = stats?.daily.length ?? 0;
  const prevLabel = isToday ? "yesterday" : `previous ${days} days`;

  const columns: Column[] = !stats ? [] : isToday
    ? stats.hourly.filter((h) => (h.hour >= 7 && h.hour <= 22) || h.bills > 0).map((h) => ({
        key: String(h.hour), label: hourLabel(h.hour), value: Number(h.net),
        aria: `${hourRange(h.hour)}: ${money(h.net)}, ${h.bills} bills`,
        tip: <><p className="font-semibold tabular-nums">{money(h.net)}</p><p className="text-[var(--ink-muted)]">{hourRange(h.hour)} · {h.bills} bills</p></>,
      }))
    : stats.daily.map((d) => ({
        key: d.day, label: dayLabel(d.day, days), value: Number(metric === "net" ? d.net : d.profit),
        aria: `${dateLabel(d.day)}: sales ${money(d.net)}, profit ${money(d.profit)}, ${d.bills} bills`,
        tip: <><p className="font-semibold tabular-nums">{money(metric === "net" ? d.net : d.profit)}</p><p className="text-[var(--ink-muted)]">{weekday(d.day)} {dateLabel(d.day)} · {d.bills} bills{metric === "net" ? ` · profit ${money(d.profit)}` : ` · sales ${money(d.net)}`}</p></>,
      }));

  const busyHours: Column[] = !stats ? [] : stats.hourly.filter((h) => (h.hour >= 7 && h.hour <= 22) || h.bills > 0).map((h) => ({
    key: String(h.hour), label: hourLabel(h.hour), value: h.bills,
    aria: `${hourRange(h.hour)}: ${h.bills} bills`,
    tip: <><p className="font-semibold tabular-nums">{h.bills} bills</p><p className="text-[var(--ink-muted)]">{hourRange(h.hour)} · {money(h.net)}</p></>,
  }));

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-[1.7rem]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">{new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" }).format(new Date())}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          <Link href="/admin/billing" className="button button-dark"><ShoppingCart size={18} /> New Bill <span className="adm-kbd hidden border-white/40 text-white/80 sm:inline">F2</span></Link>
          <Link href="/admin/purchases/new" className="button button-light"><Truck size={18} /> Purchase</Link>
          <Link href="/admin/returns" className="button button-light"><RotateCcw size={18} /> Return</Link>
        </div>
      </div>

      {/* One filter row scopes every figure below it. */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Date range">
        {ranges.map((r) => <button key={r.key} className="adm-mode-btn px-4 sm:flex-none" aria-pressed={rangeKey === r.key} onClick={() => setRangeKey(r.key)}>{r.label}</button>)}
      </div>
      <Alert error={error} />

      {!stats ? (!error && <Loading />) : (
        <div className={loading ? "adm-refetch" : ""}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Sales" value={money(stats.totals.net)} now={stats.totals.net} before={stats.previous.net} prev={prevLabel} />
            <Kpi label="Bills" value={String(stats.totals.bills)} now={stats.totals.bills} before={stats.previous.bills} prev={prevLabel} />
            <Kpi label="Average bill" value={money(stats.totals.bills ? stats.totals.net / stats.totals.bills : 0)}
              now={stats.totals.bills ? stats.totals.net / stats.totals.bills : 0} before={stats.previous.bills ? stats.previous.net / stats.previous.bills : 0} prev={prevLabel} />
            <Kpi label="Estimated profit" value={money(stats.totals.profit)} now={stats.totals.profit} before={stats.previous.profit} prev={prevLabel}
              note={stats.totals.net > 0 ? `${Math.round((stats.totals.profit / stats.totals.net) * 100)}% margin` : undefined} />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <section className="adm-card adm-card-pad">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{isToday ? "Sales by hour today" : metric === "net" ? "Sales by day" : "Estimated profit by day"}</h2>
                  <p className="text-xs text-[var(--ink-muted)]">{isToday ? "Bill totals, India time" : `${dateLabel(stats.from)} – ${dateLabel(stats.to)} · after refunds`}</p>
                </div>
                <div className="flex gap-2">
                  {!isToday && (
                    <div className="flex rounded-lg border border-[var(--line)] p-0.5 text-xs font-semibold" role="group" aria-label="Measure">
                      {(["net", "profit"] as const).map((m) => (
                        <button key={m} className={`rounded-md px-3 py-1.5 ${metric === m ? "bg-[var(--brand-light-blue)] text-[var(--brand-blue-deeper)]" : "text-[var(--ink-muted)]"}`} aria-pressed={metric === m} onClick={() => setMetric(m)}>{m === "net" ? "Sales" : "Profit"}</button>
                      ))}
                    </div>
                  )}
                  <button className="icon-button h-8 w-8" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable} title={showTable ? "Show chart" : "Show as table"} aria-label={showTable ? "Show chart" : "Show as table"}><Table2 size={15} /></button>
                </div>
              </div>
              {showTable ? (
                <div className="adm-table-wrap max-h-[260px] overflow-y-auto">
                  <table className="adm-table">
                    <thead><tr><th>{isToday ? "Hour" : "Day"}</th><th className="num">Bills</th><th className="num">Sales</th>{!isToday && <th className="num">Profit</th>}</tr></thead>
                    <tbody>
                      {isToday
                        ? stats.hourly.filter((h) => h.bills > 0).map((h) => <tr key={h.hour}><td>{hourRange(h.hour)}</td><td className="num">{h.bills}</td><td className="num">{money(h.net)}</td></tr>)
                        : stats.daily.map((d) => <tr key={d.day}><td>{weekday(d.day)} {dateLabel(d.day)}</td><td className="num">{d.bills}</td><td className="num">{money(d.net)}</td><td className="num">{money(d.profit)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              ) : <ColumnChart data={columns} format={(v) => money(v).replace(".00", "")} />}
            </section>

            <section className="adm-card adm-card-pad">
              <h2 className="font-semibold">How customers paid</h2>
              <p className="mb-4 text-xs text-[var(--ink-muted)]">Bill totals by payment mode, before refunds</p>
              <SegmentBar format={money} segments={(["cash", "upi", "card", "credit"] as const).map((k) => ({ key: k, label: k === "credit" ? "Credit (udhaar)" : modeLabel(k), value: Number(stats.by_mode[k] ?? 0), color: `var(--mode-${k})` }))} />
              {alerts.udhaar > 0 && (
                <Link href="/admin/customers" className="mt-5 flex items-center gap-3 rounded-lg border border-[var(--line)] p-3 text-sm hover:border-[var(--brand-blue)]">
                  <Users size={18} className="adm-text-amber" />
                  <span>Customers owe you <b className="tabular-nums">{money(alerts.udhaar)}</b> in udhaar</span>
                </Link>
              )}
            </section>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="adm-card adm-card-pad">
              <h2 className="font-semibold">Top medicines</h2>
              <p className="mb-4 text-xs text-[var(--ink-muted)]">By sales value in this period</p>
              {stats.top_products.length === 0 ? <p className="py-8 text-center text-sm text-[var(--ink-muted)]">No medicines sold in this period.</p> : (
                <BarList rows={stats.top_products.map((p) => ({
                  key: p.name + p.packing, label: p.name, sub: p.packing, value: Number(p.amount), valueLabel: money(p.amount),
                  tip: `${p.name}: ${money(p.amount)} · ${qtyLabel(p.units, p.pack_size)} ${p.pack_size > 1 ? "packs" : "sold"}`,
                }))} />
              )}
            </section>
            <section className="adm-card adm-card-pad">
              <h2 className="font-semibold">Busiest hours</h2>
              <p className="mb-3 text-xs text-[var(--ink-muted)]">Number of bills by hour of day, {isToday ? "today" : `last ${days} days`}</p>
              <ColumnChart data={busyHours} format={(v) => `${v} bills`} height={210} />
            </section>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <AlertCard href="/admin/products?filter=low" icon={<AlertTriangle size={20} />} count={alerts.low} label="medicines running low" tone="amber" />
        <AlertCard href="/admin/products?filter=expiring" icon={<CalendarClock size={20} />} count={alerts.expiring} label="batches expiring in 60 days" tone="amber" />
        <AlertCard href="/admin/products?filter=expired" icon={<PackageX size={20} />} count={alerts.expired} label="medicines with expired stock" tone="red" />
      </div>

      <div className="adm-card mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
          <h2 className="font-semibold">Recent bills</h2>
          <Link className="text-link" href="/admin/sales">All bills</Link>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Bill</th><th>When</th><th>Customer</th><th>Payment</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[var(--ink-muted)]">No bills yet. Press F2 to make the first one.</td></tr>}
              {recent.map((s) => (
                <tr key={s.id}>
                  <td><Link className="font-semibold text-[var(--brand-blue-strong)]" href={`/admin/sales/${s.id}`}>{billNumber(s.fy, s.bill_no)}</Link></td>
                  <td>{s.bill_date === istToday() ? timeLabel(s.created_at) : dateLabel(s.bill_date)}</td>
                  <td>{s.patient_name || "—"}</td>
                  <td>{modeLabel(s.payment_mode)}</td>
                  <td className="num font-semibold">{money(s.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Stat tile with a signed change against the previous period of the same length. Up is good for every tile here. */
function Kpi({ label, value, now, before, prev, note }: { label: string; value: string; now: number; before: number; prev: string; note?: string }) {
  const change = before === 0 ? (now === 0 ? 0 : null) : ((now - before) / Math.abs(before)) * 100;
  const Icon = change === null || change > 0.5 ? ArrowUpRight : change < -0.5 ? ArrowDownRight : Minus;
  const tone = change === null || change > 0.5 ? "adm-text-green" : change < -0.5 ? "adm-text-red" : "text-[var(--ink-muted)]";
  return (
    <div className="adm-card adm-card-pad">
      <p className="text-xs font-semibold text-[var(--ink-muted)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs">
        <span className={`inline-flex items-center gap-0.5 font-semibold ${tone}`}><Icon size={14} aria-hidden="true" />{change === null ? "New" : `${change > 0 ? "+" : ""}${Math.round(change)}%`}</span>
        <span className="text-[var(--ink-muted)]">vs {prev}</span>
        {note && <span className="text-[var(--ink-muted)]">· {note}</span>}
      </p>
    </div>
  );
}

function AlertCard({ href, icon, count, label, tone }: { href: string; icon: React.ReactNode; count: number; label: string; tone: "amber" | "red" }) {
  const color = count === 0 ? "text-[var(--ink-muted)]" : tone === "red" ? "adm-text-red" : "adm-text-amber";
  return (
    <Link href={href} className="adm-card adm-card-pad flex items-center gap-3 transition hover:border-[var(--brand-blue)]">
      <span className={color}>{icon}</span>
      <span><span className={`text-xl font-semibold ${color}`}>{count}</span> <span className="text-sm text-[var(--ink-muted)]">{label}</span></span>
    </Link>
  );
}
