"use client";
import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCustomer, getOrders } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Sparkles, TrendingUp, TrendingDown, ShoppingBag,
  Calendar, AlertTriangle, Star, MapPin, Zap, Megaphone, Mail,
  ChevronUp, ChevronDown, CheckCircle, XCircle,
} from "lucide-react";

type Customer = {
  id: string; name: string; email: string; phone?: string;
  city?: string; gender?: string; age?: number;
  total_orders: number; total_spent: number; last_purchase_date?: string;
};

type Order = {
  id: string; customer_id: string; amount: number;
  category?: string; purchase_date: string; created_at: string;
};

type CampaignRow = {
  id: string; name: string; channel: string; date: string;
  delivered: boolean; opened: boolean; clicked: boolean;
};

function seeded(id: string, n: number): number {
  const h = (id.charCodeAt(0) || 65) + (id.charCodeAt(3) || 65) + n;
  return Math.round(Math.abs(Math.sin(h * 9.301) * 10000) % 100);
}

function genCampaigns(cid: string): CampaignRow[] {
  const templates = [
    { name: "Diwali Blast 2024",  channel: "WhatsApp" },
    { name: "Year-End Sale",      channel: "Email"    },
    { name: "Festival Offer",     channel: "SMS"      },
    { name: "Winter Collection",  channel: "WhatsApp" },
    { name: "VIP Exclusive",      channel: "Email"    },
    { name: "Flash Sale Nov",     channel: "RCS"      },
  ];
  const count = 3 + (seeded(cid, 99) % 3);
  return templates.slice(0, count).map((t, i) => {
    const del  = seeded(cid, i * 10 + 1) > 15;
    const open = del  && seeded(cid, i * 10 + 2) > 35;
    const clk  = open && seeded(cid, i * 10 + 3) > 55;
    const d = new Date(); d.setDate(d.getDate() - (10 + i * 18));
    return { id: `c${i}`, name: t.name, channel: t.channel, date: d.toISOString(), delivered: del, opened: open, clicked: clk };
  });
}

function computeProfile(c: Customer) {
  const days = c.last_purchase_date
    ? Math.floor((Date.now() - new Date(c.last_purchase_date).getTime()) / 86400000)
    : 365;
  const tier = c.total_spent >= 40000 ? "VIP" : c.total_spent >= 15000 ? "Regular" : c.total_orders > 0 ? "New" : "Lead";
  const churnRisk: "Low" | "Medium" | "High" = days > 90 ? "High" : days > 45 ? "Medium" : "Low";
  const avg = c.total_orders > 0 ? c.total_spent / c.total_orders : 0;
  const freq = Math.max(1, 365 / Math.max(days, 30));
  const predictedLTV = Math.round(avg * freq * 0.85);
  const action = churnRisk === "High"
    ? "Send win-back offer with 15% discount"
    : tier === "VIP" ? "Invite to exclusive loyalty preview"
    : tier === "Regular" ? "Upsell premium bundle via WhatsApp"
    : "Welcome sequence + first purchase incentive";
  return { tier, churnRisk, predictedLTV, action, days };
}

function computeInsights(c: Customer, p: ReturnType<typeof computeProfile>) {
  const items: { type: string; title: string; text: string }[] = [];
  if (p.churnRisk === "High")
    items.push({ type: "warning",     title: "Churn Risk Alert",        text: `${c.name} hasn't purchased in ${p.days} days. A personalised win-back offer with a 15% discount could re-engage them.` });
  if (p.tier === "VIP")
    items.push({ type: "opportunity", title: "VIP Loyalty Opportunity", text: `With ${formatCurrency(c.total_spent)} lifetime spend, invite ${c.name} to the exclusive loyalty programme.` });
  if (p.churnRisk === "Low" && c.total_orders >= 3)
    items.push({ type: "success",     title: "High Engagement",         text: `Active buyer with ${c.total_orders} orders. Ideal for cross-sell within the same category.` });
  if (p.tier === "New" || p.tier === "Lead")
    items.push({ type: "info",        title: "Early Engagement Window", text: `New customer — optimal time for habit formation. A 3-part welcome sequence can increase retention by ~40%.` });
  if (items.length === 0)
    items.push({ type: "info",        title: "Stable Account",          text: `${c.name} is a consistent buyer. Maintain touchpoints every 30 days to sustain engagement.` });
  return items.slice(0, 3);
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const palettes: [string, string][] = [
    ["#EFF6FF","#2563EB"],["#F0FDF4","#16A34A"],
    ["#FFFBEB","#D97706"],["#F5F3FF","#7C3AED"],["#FFF1F2","#E11D48"],
  ];
  const [bg, fg] = palettes[name.charCodeAt(0) % palettes.length];
  return (
    <div className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.36) }}>
      {name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
    </div>
  );
}

const DEMO_CUSTOMER: Customer = {
  id: "demo-c001", name: "Priya Sharma", email: "priya.sharma@gmail.com",
  phone: "+91 98765 43210", city: "Mumbai", gender: "female", age: 28,
  total_orders: 14, total_spent: 48200, last_purchase_date: "2024-12-10T10:24:00Z",
};

const DEMO_ORDERS: Order[] = [
  { id: "ord001", customer_id: "demo-c001", amount: 12400, category: "Electronics",   purchase_date: "2024-12-10T10:24:00Z", created_at: "2024-12-10T10:24:00Z" },
  { id: "ord002", customer_id: "demo-c001", amount: 8750,  category: "Fashion",       purchase_date: "2024-11-22T14:12:00Z", created_at: "2024-11-22T14:12:00Z" },
  { id: "ord003", customer_id: "demo-c001", amount: 3200,  category: "Home & Living", purchase_date: "2024-11-05T09:45:00Z", created_at: "2024-11-05T09:45:00Z" },
  { id: "ord004", customer_id: "demo-c001", amount: 5800,  category: "Beauty",        purchase_date: "2024-10-18T16:30:00Z", created_at: "2024-10-18T16:30:00Z" },
  { id: "ord005", customer_id: "demo-c001", amount: 18050, category: "Electronics",   purchase_date: "2024-09-28T11:20:00Z", created_at: "2024-09-28T11:20:00Z" },
];

const TIER_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  VIP:     { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  Regular: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  New:     { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  Lead:    { bg: "#F9FAFB", color: "#374151", border: "#E5E7EB" },
};

const INSIGHT_STYLE: Record<string, { bg: string; border: string; dot: string }> = {
  warning:     { bg: "#FFFBEB", border: "#FDE68A", dot: "#F59E0B" },
  opportunity: { bg: "#EFF6FF", border: "#BFDBFE", dot: "#2563EB" },
  success:     { bg: "#F0FDF4", border: "#BBF7D0", dot: "#22C55E" },
  info:        { bg: "#F5F3FF", border: "#DDD6FE", dot: "#7C3AED" },
};

export default function Customer360Page() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders,   setOrders]   = useState<Order[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sortKey,  setSortKey]  = useState("purchase_date");
  const [sortDir,  setSortDir]  = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getCustomer(id).catch(() => DEMO_CUSTOMER),
      getOrders({ customer_id: id, size: 50 })
        .then((d: any) => Array.isArray(d) ? d : d.items || d.orders || [])
        .catch(() => DEMO_ORDERS),
    ]).then(([c, o]) => {
      setCustomer(c as Customer);
      setOrders(o as Order[]);
      setCampaigns(genCampaigns(id));
    }).finally(() => setLoading(false));
  }, [id]);

  const sortedOrders = useMemo(() =>
    [...orders].sort((a, b) => {
      const av: any = (a as any)[sortKey] ?? "";
      const bv: any = (b as any)[sortKey] ?? "";
      return av < bv ? (sortDir === "asc" ? -1 : 1) : av > bv ? (sortDir === "asc" ? 1 : -1) : 0;
    }), [orders, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  if (loading) {
    return (
      <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
        <div className="flex items-center px-6 gap-3" style={{ height: 72, background: "#fff", borderBottom: "1px solid #E5E7EB" }}>
          <div className="h-5 w-20 rounded animate-pulse" style={{ background: "#F3F4F6" }} />
          <div className="h-5 w-56 rounded animate-pulse" style={{ background: "#F3F4F6" }} />
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-[12px] animate-pulse" style={{ background: "#E5E7EB" }} />
            ))}
          </div>
          <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px" }}>
            <div className="space-y-4">
              <div className="h-64 rounded-[12px] animate-pulse" style={{ background: "#E5E7EB" }} />
              <div className="h-48 rounded-[12px] animate-pulse" style={{ background: "#E5E7EB" }} />
            </div>
            <div className="space-y-4">
              <div className="h-64 rounded-[12px] animate-pulse" style={{ background: "#E5E7EB" }} />
              <div className="h-40 rounded-[12px] animate-pulse" style={{ background: "#E5E7EB" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const profile   = computeProfile(customer);
  const insights  = computeInsights(customer, profile);
  const avgOrder  = customer.total_orders > 0 ? customer.total_spent / customer.total_orders : 0;
  const tierStyle = TIER_STYLE[profile.tier] || TIER_STYLE.Lead;

  const churnStyle = {
    Low:    { bg: "#F0FDF4", color: "#15803D", icon: <TrendingUp   className="w-3 h-3" /> },
    Medium: { bg: "#FFFBEB", color: "#B45309", icon: <AlertTriangle className="w-3 h-3" /> },
    High:   { bg: "#FEF2F2", color: "#DC2626", icon: <TrendingDown  className="w-3 h-3" /> },
  }[profile.churnRisk];

  const lastPurchaseLabel = customer.last_purchase_date
    ? new Date(customer.last_purchase_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Never";

  const KPI_CARDS = [
    { label: "Total Revenue",   value: formatCurrency(customer.total_spent), sub: `from ${customer.total_orders} orders`, Icon: TrendingUp, bg: "#EFF6FF", ic: "#2563EB" },
    { label: "Order Count",     value: String(customer.total_orders),         sub: `avg ${formatCurrency(avgOrder)} each`,  Icon: ShoppingBag, bg: "#F0FDF4", ic: "#16A34A" },
    { label: "Avg Order Value", value: formatCurrency(avgOrder),             sub: "per transaction",                         Icon: Star,        bg: "#FFFBEB", ic: "#D97706" },
    { label: "Last Purchase",   value: lastPurchaseLabel,                    sub: `${profile.days} days ago`,               Icon: Calendar,    bg: "#F5F3FF", ic: "#7C3AED" },
  ];

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
      {/* Page header */}
      <div className="flex items-center gap-4 px-6 shrink-0"
        style={{ height: 72, background: "#fff", borderBottom: "1px solid #E5E7EB" }}>
        <button
          onClick={() => router.push("/customers")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors"
          style={{ border: "1px solid #E5E7EB", color: "#6B7280", background: "#fff" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}>
          <ArrowLeft className="w-3.5 h-3.5" />Customers
        </button>

        <div className="w-px h-5" style={{ background: "#E5E7EB" }} />

        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size={36} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold" style={{ color: "#111827" }}>{customer.name}</h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: tierStyle.bg, color: tierStyle.color, border: `1px solid ${tierStyle.border}` }}>
                {profile.tier}
              </span>
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>{customer.email}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => router.push(`/campaigns?customer_ids=${customer?.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium"
            style={{ border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB" }}>
            <Megaphone className="w-3.5 h-3.5" />Add to Campaign
          </button>
          <button onClick={() => { if (customer?.email) window.location.href = `mailto:${customer.email}`; }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium"
            style={{ border: "1px solid #E5E7EB", background: "#fff", color: "#374151" }}>
            <Mail className="w-3.5 h-3.5" />Contact
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {KPI_CARDS.map(kpi => {
            const KIcon = kpi.Icon;
            return (
              <div key={kpi.label} className="bg-white rounded-[12px] px-5 py-4" style={{ border: "1px solid #E5E7EB" }}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{kpi.label}</p>
                  <div className="w-7 h-7 rounded-[7px] flex items-center justify-center" style={{ background: kpi.bg }}>
                    <KIcon className="w-3.5 h-3.5" style={{ color: kpi.ic }} />
                  </div>
                </div>
                <p className="text-[22px] font-bold leading-tight" style={{ color: "#111827" }}>{kpi.value}</p>
                <p className="text-[11px] mt-1" style={{ color: "#9CA3AF" }}>{kpi.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Body: left (orders + campaigns) / right (AI cards) */}
        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px" }}>

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Order History */}
            <div className="bg-white rounded-[12px]" style={{ border: "1px solid #E5E7EB" }}>
              <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <ShoppingBag className="w-4 h-4" style={{ color: "#6B7280" }} />
                <h2 className="text-[14px] font-semibold" style={{ color: "#111827" }}>Order History</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ background: "#F3F4F6", color: "#6B7280" }}>{orders.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                      {[
                        { key: "id",            label: "ORDER ID"  },
                        { key: "category",      label: "CATEGORY"  },
                        { key: "amount",        label: "AMOUNT"    },
                        { key: "purchase_date", label: "DATE"      },
                      ].map(col => (
                        <th key={col.key}
                          className="text-left py-3 pl-5 pr-4 text-[11px] font-semibold cursor-pointer select-none"
                          style={{ color: "#9CA3AF", letterSpacing: "0.04em" }}
                          onClick={() => toggleSort(col.key)}>
                          <span className="flex items-center gap-1">
                            {col.label}
                            {sortKey === col.key
                              ? sortDir === "asc"
                                ? <ChevronUp   className="w-3 h-3" style={{ color: "#2563EB" }} />
                                : <ChevronDown className="w-3 h-3" style={{ color: "#2563EB" }} />
                              : <ChevronUp className="w-3 h-3 opacity-20" />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-[13px]" style={{ color: "#9CA3AF" }}>
                          No orders found
                        </td>
                      </tr>
                    ) : sortedOrders.map(o => (
                      <tr key={o.id} className="row-hover" style={{ borderBottom: "1px solid #F9FAFB" }}>
                        <td className="py-3 pl-5 pr-4 font-mono text-[12px] font-semibold" style={{ color: "#6B7280" }}>
                          #{o.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-[5px]"
                            style={{ background: "#F9FAFB", color: "#6B7280", border: "1px solid #F3F4F6" }}>
                            {o.category || "General"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[13px] font-semibold" style={{ color: "#111827" }}>
                          {formatCurrency(o.amount)}
                        </td>
                        <td className="py-3 pr-5 text-[12px]" style={{ color: "#6B7280" }}>
                          {new Date(o.purchase_date || o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Campaign Participation */}
            <div className="bg-white rounded-[12px]" style={{ border: "1px solid #E5E7EB" }}>
              <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <Megaphone className="w-4 h-4" style={{ color: "#6B7280" }} />
                <h2 className="text-[14px] font-semibold" style={{ color: "#111827" }}>Campaign Participation</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ background: "#F3F4F6", color: "#6B7280" }}>{campaigns.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                      {["CAMPAIGN", "CHANNEL", "DELIVERED", "OPENED", "CLICKED", "DATE"].map(h => (
                        <th key={h} className="text-left py-3 pl-5 pr-4 text-[11px] font-semibold"
                          style={{ color: "#9CA3AF", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id} className="row-hover" style={{ borderBottom: "1px solid #F9FAFB" }}>
                        <td className="py-3 pl-5 pr-4 text-[13px] font-medium" style={{ color: "#111827" }}>{c.name}</td>
                        <td className="py-3 pr-4">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-[5px]"
                            style={{ background: "#F9FAFB", color: "#6B7280", border: "1px solid #F3F4F6" }}>
                            {c.channel}
                          </span>
                        </td>
                        {([c.delivered, c.opened, c.clicked] as boolean[]).map((v, i) => (
                          <td key={i} className="py-3 pr-4">
                            {v
                              ? <CheckCircle className="w-4 h-4" style={{ color: "#22C55E" }} />
                              : <XCircle    className="w-4 h-4" style={{ color: "#D1D5DB" }} />}
                          </td>
                        ))}
                        <td className="py-3 pr-5 text-[12px]" style={{ color: "#9CA3AF" }}>
                          {new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-4">

            {/* AI Profile Card */}
            <div className="bg-white rounded-[12px]" style={{ border: "1px solid #E5E7EB" }}>
              <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <div className="w-6 h-6 rounded-[6px] flex items-center justify-center" style={{ background: "#EFF6FF" }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "#2563EB" }} />
                </div>
                <h2 className="text-[13px] font-semibold" style={{ color: "#111827" }}>AI Profile</h2>
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#F5F3FF", color: "#7C3AED" }}>Aster AI</span>
              </div>
              <div className="px-4 py-4 space-y-3">

                {/* Tier */}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>Customer Tier</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ background: tierStyle.bg, color: tierStyle.color, border: `1px solid ${tierStyle.border}` }}>
                    {profile.tier}
                  </span>
                </div>

                {/* Churn risk */}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>Churn Risk</span>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ background: churnStyle.bg, color: churnStyle.color }}>
                    {churnStyle.icon}{profile.churnRisk}
                  </span>
                </div>

                {/* Predicted LTV */}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>Predicted LTV (12M)</span>
                  <span className="text-[13px] font-bold" style={{ color: "#111827" }}>
                    {formatCurrency(profile.predictedLTV)}
                  </span>
                </div>

                {/* Location / Age */}
                {customer.city && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>Location</span>
                    <span className="flex items-center gap-1 text-[12px]" style={{ color: "#374151" }}>
                      <MapPin className="w-3 h-3" />{customer.city}
                    </span>
                  </div>
                )}
                {customer.age && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium" style={{ color: "#6B7280" }}>Age</span>
                    <span className="text-[12px]" style={{ color: "#374151" }}>{customer.age} years</span>
                  </div>
                )}

                {/* Recommended action */}
                <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 12 }}>
                  <p className="text-[10px] font-semibold mb-2 uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
                    Recommended Action
                  </p>
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-[8px]"
                    style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                    <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#2563EB" }} />
                    <p className="text-[12px] font-medium leading-relaxed" style={{ color: "#1D4ED8" }}>
                      {profile.action}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights Card */}
            <div className="bg-white rounded-[12px]" style={{ border: "1px solid #E5E7EB" }}>
              <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <div className="w-6 h-6 rounded-[6px] flex items-center justify-center" style={{ background: "#F5F3FF" }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "#7C3AED" }} />
                </div>
                <h2 className="text-[13px] font-semibold" style={{ color: "#111827" }}>AI Insights</h2>
              </div>
              <div className="px-4 py-4 space-y-3">
                {insights.map((ins, i) => {
                  const s = INSIGHT_STYLE[ins.type] || INSIGHT_STYLE.info;
                  return (
                    <div key={i} className="rounded-[8px] px-3 py-3"
                      style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
                        <p className="text-[12px] font-semibold" style={{ color: "#111827" }}>{ins.title}</p>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: "#374151" }}>{ins.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
