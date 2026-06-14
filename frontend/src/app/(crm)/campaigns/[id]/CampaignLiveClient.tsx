"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCampaign } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import {
  Send, CheckCircle2, Eye, MousePointerClick, ShoppingCart,
  Wifi, RefreshCw, ArrowLeft, Sparkles, Activity,
  ChevronRight, Users, Clock, AlertTriangle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

type CampaignDetail = {
  id: string;
  name: string;
  status: string;
  channel: string;
  segment_name?: string;
  message_template: string;
  ai_generated: boolean;
  expected_engagement?: number;
  expected_conversion?: number;
  started_at?: string;
  created_at: string;
  analytics?: {
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_converted: number;
  };
};

type FunnelState = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
};

type ActivityItem = {
  id: string;
  event_type: string;
  short_id: string;
  time_str: string;
};

type WsStatus = "connecting" | "connected" | "demo";

// ── Demo fallback ──────────────────────────────────────────────────────

const DEMO_CAMPAIGN: CampaignDetail = {
  id: "demo",
  name: "Summer Win-Back Campaign",
  status: "running",
  channel: "whatsapp",
  segment_name: "Dormant 90-Day Users",
  message_template:
    "Hi {customer_name}, we miss you! 🌟 It's been a while since your last visit. Here's an exclusive 20% discount — use code WELCOME20 at checkout. Valid for 48 hours only. Shop now and save!",
  ai_generated: true,
  expected_engagement: 0.38,
  expected_conversion: 0.12,
  created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  started_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  analytics: {
    total_sent: 842,
    total_delivered: 781,
    total_opened: 420,
    total_clicked: 124,
    total_converted: 18,
  },
};

const DEMO_SEED_ACTIVITY: ActivityItem[] = [
  { id: "a1", event_type: "CONVERTED", short_id: "8f2a19c", time_str: fmt(Date.now() - 12000) },
  { id: "a2", event_type: "CLICKED",   short_id: "3d9b84f", time_str: fmt(Date.now() - 28000) },
  { id: "a3", event_type: "OPENED",    short_id: "7c1e52a", time_str: fmt(Date.now() - 45000) },
  { id: "a4", event_type: "DELIVERED", short_id: "2b4f91d", time_str: fmt(Date.now() - 62000) },
  { id: "a5", event_type: "SENT",      short_id: "9e7a03c", time_str: fmt(Date.now() - 78000) },
];

function fmt(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ── Constants ──────────────────────────────────────────────────────────

const FUNNEL_STEPS = [
  { key: "sent",      label: "Sent",      Icon: Send,              color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", flashBg: "#DBEAFE" },
  { key: "delivered", label: "Delivered", Icon: CheckCircle2,      color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", flashBg: "#DCFCE7" },
  { key: "opened",    label: "Opened",    Icon: Eye,               color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", flashBg: "#FEF3C7" },
  { key: "clicked",   label: "Clicked",   Icon: MousePointerClick, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", flashBg: "#EDE9FE" },
  { key: "converted", label: "Converted", Icon: ShoppingCart,      color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", flashBg: "#FEE2E2" },
] as const;

const EVENT_CFG: Record<string, { label: string; Icon: any; color: string; bg: string }> = {
  SENT:      { label: "Sent",      Icon: Send,              color: "#2563EB", bg: "#EFF6FF" },
  DELIVERED: { label: "Delivered", Icon: CheckCircle2,      color: "#16A34A", bg: "#F0FDF4" },
  OPENED:    { label: "Opened",    Icon: Eye,               color: "#D97706", bg: "#FFFBEB" },
  READ:      { label: "Read",      Icon: Eye,               color: "#9CA3AF", bg: "#F9FAFB" },
  CLICKED:   { label: "Clicked",   Icon: MousePointerClick, color: "#7C3AED", bg: "#F5F3FF" },
  CONVERTED: { label: "Converted", Icon: ShoppingCart,      color: "#DC2626", bg: "#FEF2F2" },
  FAILED:    { label: "Failed",    Icon: AlertTriangle,     color: "#EF4444", bg: "#FEF2F2" },
};

const CHANNEL_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  whatsapp: { label: "WhatsApp", color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0" },
  email:    { label: "Email",    color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  sms:      { label: "SMS",      color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  rcs:      { label: "RCS",      color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  running:   { label: "Running",   color: "#15803D", bg: "#F0FDF4", dot: "#22C55E" },
  completed: { label: "Completed", color: "#1D4ED8", bg: "#EFF6FF", dot: "#2563EB" },
  draft:     { label: "Draft",     color: "#6B7280", bg: "#F9FAFB", dot: "#9CA3AF" },
  scheduled: { label: "Scheduled", color: "#B45309", bg: "#FFFBEB", dot: "#F59E0B" },
  failed:    { label: "Failed",    color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
};

// Weighted demo event picker — matches WhatsApp channel profile roughly
const DEMO_EVENT_TABLE: [string, number][] = [
  ["SENT",      0.18],
  ["DELIVERED", 0.30],
  ["OPENED",    0.22],
  ["CLICKED",   0.18],
  ["CONVERTED", 0.12],
];

function pickDemoEvent(): string {
  const r = Math.random();
  let c = 0;
  for (const [type, w] of DEMO_EVENT_TABLE) {
    c += w;
    if (r < c) return type;
  }
  return "DELIVERED";
}

const FUNNEL_KEY_MAP: Record<string, keyof FunnelState> = {
  SENT: "sent", DELIVERED: "delivered", OPENED: "opened",
  CLICKED: "clicked", CONVERTED: "converted",
};

// ── Component ──────────────────────────────────────────────────────────

export default function CampaignLivePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [campaign, setCampaign]           = useState<CampaignDetail | null>(null);
  const [loading, setLoading]             = useState(true);
  const [funnel, setFunnel]               = useState<FunnelState>({ sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 });
  const [activity, setActivity]           = useState<ActivityItem[]>([]);
  const [wsStatus, setWsStatus]           = useState<WsStatus>("connecting");
  const [flashKeys, setFlashKeys]         = useState<Set<string>>(new Set());

  const wsRef         = useRef<WebSocket | null>(null);
  const demoTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimers   = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const mounted       = useRef(true);

  // ── Flash helper ────────────────────────────────────────────────

  const triggerFlash = useCallback((key: string) => {
    setFlashKeys(prev => new Set([...prev, key]));
    const existing = flashTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setFlashKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
    }, 500);
    flashTimers.current.set(key, t);
  }, []);

  // ── Event handler ─────────────────────────────────────────────

  const handleEvent = useCallback((eventType: string, commId: string, ts?: string) => {
    const shortId = commId
      ? commId.slice(0, 7)
      : Math.random().toString(36).slice(2, 9);

    const item: ActivityItem = {
      id:         `${shortId}-${Date.now()}`,
      event_type: eventType,
      short_id:   shortId,
      time_str:   ts ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : fmt(Date.now()),
    };

    setActivity(prev => [item, ...prev].slice(0, 60));

    const funnelKey = FUNNEL_KEY_MAP[eventType];
    if (funnelKey) {
      setFunnel(prev => ({ ...prev, [funnelKey]: prev[funnelKey] + 1 }));
      triggerFlash(funnelKey);
    }
  }, [triggerFlash]);

  // ── Demo simulation (recursive setTimeout for natural variance) ──

  const startDemo = useCallback(() => {
    if (!mounted.current) return;
    setWsStatus("demo");
    setActivity(DEMO_SEED_ACTIVITY);
  }, []);

  useEffect(() => {
    if (wsStatus !== "demo") return;

    function tick() {
      if (!mounted.current) return;
      handleEvent(pickDemoEvent(), Math.random().toString(36).slice(2, 9));
      demoTimerRef.current = setTimeout(tick, 800 + Math.random() * 1400);
    }

    demoTimerRef.current = setTimeout(tick, 1000);
    return () => { if (demoTimerRef.current) clearTimeout(demoTimerRef.current); };
  }, [wsStatus, handleEvent]);

  // ── WebSocket ──────────────────────────────────────────────────

  const initWs = useCallback((campaignId: string) => {
    const httpBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsBase   = httpBase.replace(/^https?/, s => s === "https" ? "wss" : "ws");
    const url      = `${wsBase}/ws/campaigns/${campaignId}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      // If not open within 3 s → fall to demo
      const openTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) { ws.close(); startDemo(); }
      }, 3000);

      ws.onopen = () => {
        clearTimeout(openTimeout);
        if (mounted.current) setWsStatus("connected");
      };

      ws.onmessage = e => {
        try {
          const d = JSON.parse(e.data);
          handleEvent(d.event_type, d.communication_id, d.event_time);
        } catch { /* malformed frame — ignore */ }
      };

      ws.onerror  = () => { /* onclose will follow */ };
      ws.onclose  = () => { clearTimeout(openTimeout); if (mounted.current) startDemo(); };
    } catch {
      startDemo();
    }
  }, [handleEvent, startDemo]);

  // ── Fetch campaign + bootstrap ─────────────────────────────────

  useEffect(() => {
    mounted.current = true;
    if (!id) return;

    getCampaign(id)
      .then((d: any) => {
        if (!mounted.current) return;
        setCampaign(d);
        const a = d.analytics;
        if (a) {
          setFunnel({
            sent:      a.total_sent      ?? 0,
            delivered: a.total_delivered ?? 0,
            opened:    a.total_opened    ?? 0,
            clicked:   a.total_clicked   ?? 0,
            converted: a.total_converted ?? 0,
          });
        }
      })
      .catch(() => {
        if (!mounted.current) return;
        setCampaign(DEMO_CAMPAIGN);
        const a = DEMO_CAMPAIGN.analytics!;
        setFunnel({ sent: a.total_sent, delivered: a.total_delivered, opened: a.total_opened, clicked: a.total_clicked, converted: a.total_converted });
      })
      .finally(() => {
        if (!mounted.current) return;
        setLoading(false);
        initWs(id);
      });

    return () => {
      mounted.current = false;
      wsRef.current?.close();
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
      flashTimers.current.forEach(clearTimeout);
    };
  }, [id, initWs]);

  // ── Loading ────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ background: "#F8FAFC", minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "#2563EB" }} />
    </div>
  );

  // ── Derived values ─────────────────────────────────────────────

  const camp   = campaign!;
  const status = STATUS_CFG[camp.status?.toLowerCase()] ?? STATUS_CFG.draft;
  const ch     = CHANNEL_CFG[camp.channel?.toLowerCase()] ?? CHANNEL_CFG.email;

  const sentBase = funnel.sent || 1;
  const pct = {
    sent:      100,
    delivered: (funnel.delivered / sentBase) * 100,
    opened:    (funnel.opened    / sentBase) * 100,
    clicked:   (funnel.clicked   / sentBase) * 100,
    converted: (funnel.converted / sentBase) * 100,
  };

  // Step-to-step conversion rates shown on connectors
  const connectorRates = [
    funnel.sent      ? ((funnel.delivered / funnel.sent)      * 100).toFixed(1) + "%" : "—",
    funnel.delivered ? ((funnel.opened    / funnel.delivered) * 100).toFixed(1) + "%" : "—",
    funnel.opened    ? ((funnel.clicked   / funnel.opened)    * 100).toFixed(1) + "%" : "—",
    funnel.clicked   ? ((funnel.converted / funnel.clicked)   * 100).toFixed(1) + "%" : "—",
  ];

  const metaItems = [
    { label: "Audience", value: camp.segment_name || "All Customers", Icon: Users },
    { label: "Created",  value: new Date(camp.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), Icon: Clock },
    ...(camp.started_at ? [{ label: "Started", value: new Date(camp.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }), Icon: Activity }] : []),
    ...(camp.expected_engagement != null ? [{ label: "Exp. Engagement", value: `${(camp.expected_engagement * 100).toFixed(0)}%`, Icon: Eye }] : []),
    ...(camp.expected_conversion  != null ? [{ label: "Exp. Conversion",  value: `${(camp.expected_conversion  * 100).toFixed(0)}%`, Icon: ShoppingCart }] : []),
  ];

  const msgPreview = camp.message_template?.replace("{customer_name}", "Priya") ?? "No message template.";

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%" }}>

      {/* ─ Header ─ */}
      <div className="flex items-center justify-between px-6 shrink-0"
        style={{ height: 72, background: "#fff", borderBottom: "1px solid #E5E7EB" }}>

        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/campaigns")}
            className="w-8 h-8 rounded-[7px] flex items-center justify-center transition-colors"
            style={{ border: "1px solid #E5E7EB", background: "#fff", color: "#6B7280" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-semibold" style={{ color: "#111827" }}>{camp.name}</h1>
              {camp.ai_generated && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-[4px]"
                  style={{ background: "#F5F3FF", color: "#7C3AED" }}>
                  <Sparkles className="w-2.5 h-2.5" />AI
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                style={{ color: status.color }}>
                <span
                  className={`w-1.5 h-1.5 rounded-full${camp.status === "running" ? " animate-pulse" : ""}`}
                  style={{ background: status.dot }}
                />
                {status.label}
              </span>

              <span style={{ color: "#E5E7EB" }}>·</span>

              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[4px]"
                style={{ background: ch.bg, color: ch.color, border: `1px solid ${ch.border}` }}>
                {ch.label}
              </span>

              {camp.segment_name && (
                <>
                  <span style={{ color: "#E5E7EB" }}>·</span>
                  <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "#6B7280" }}>
                    <Users className="w-3 h-3" />{camp.segment_name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Connection status pill */}
        {wsStatus === "connected" && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px]"
            style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <Wifi className="w-3.5 h-3.5" style={{ color: "#16A34A" }} />
            <span className="text-[11px] font-semibold" style={{ color: "#15803D" }}>Live</span>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse ml-0.5" style={{ background: "#22C55E" }} />
          </div>
        )}
        {wsStatus === "connecting" && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px]"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: "#D97706" }} />
            <span className="text-[11px] font-semibold" style={{ color: "#B45309" }}>Connecting…</span>
          </div>
        )}
        {wsStatus === "demo" && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px]"
            style={{ background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
            <Activity className="w-3.5 h-3.5" style={{ color: "#7C3AED" }} />
            <span className="text-[11px] font-semibold" style={{ color: "#7C3AED" }}>Demo Mode</span>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse ml-0.5" style={{ background: "#8B5CF6" }} />
          </div>
        )}
      </div>

      <div className="p-6 space-y-5">

        {/* ─ Campaign meta bar ─ */}
        <div className="bg-white rounded-[12px] px-5 py-3.5 flex items-center gap-0"
          style={{ border: "1px solid #E5E7EB" }}>
          {metaItems.map((item, i) => (
            <div key={item.label} className="flex items-center">
              <div className="px-5 first:pl-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: "#9CA3AF" }}>
                  {item.label}
                </p>
                <p className="text-[13px] font-semibold mt-0.5" style={{ color: "#111827" }}>
                  {item.value}
                </p>
              </div>
              {i < metaItems.length - 1 && (
                <div className="w-px h-8 shrink-0" style={{ background: "#F3F4F6" }} />
              )}
            </div>
          ))}
        </div>

        {/* ─ Live Funnel ─ */}
        <div className="bg-white rounded-[12px] p-5" style={{ border: "1px solid #E5E7EB" }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[14px] font-semibold" style={{ color: "#111827" }}>Live Funnel</h3>
            <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
              % of total sent · Updates in real time
            </span>
          </div>

          <div className="flex items-stretch">
            {FUNNEL_STEPS.map((step, i) => {
              const count   = funnel[step.key as keyof FunnelState];
              const percent = pct[step.key as keyof typeof pct];
              const flash   = flashKeys.has(step.key);

              return (
                <div key={step.key} className="flex items-center flex-1">
                  {/* Step card */}
                  <div
                    className="flex-1 rounded-[10px] p-4"
                    style={{
                      background:   flash ? step.bg    : "#FAFAFA",
                      border:       `1px solid ${flash ? step.border : "#F3F4F6"}`,
                      boxShadow:    flash ? `0 0 0 3px ${step.flashBg}` : "none",
                      transition:   "background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease",
                    }}
                  >
                    {/* Icon + label */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-7 h-7 rounded-[6px] flex items-center justify-center"
                        style={{ background: flash ? `${step.color}20` : "#F3F4F6", transition: "background 0.35s ease" }}
                      >
                        <step.Icon
                          className="w-3.5 h-3.5"
                          style={{ color: flash ? step.color : "#9CA3AF", transition: "color 0.35s ease" }}
                        />
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.07em]"
                        style={{ color: flash ? step.color : "#9CA3AF", transition: "color 0.35s ease" }}
                      >
                        {step.label}
                      </span>
                    </div>

                    {/* Count */}
                    <p
                      className="text-[26px] font-bold leading-none"
                      style={{ color: "#111827", letterSpacing: "-0.03em" }}
                    >
                      {formatNumber(count)}
                    </p>

                    {/* Percentage + bar */}
                    <div className="mt-3">
                      <span className="text-[11px] font-semibold" style={{ color: step.color }}>
                        {i === 0 ? "Baseline" : `${percent.toFixed(1)}%`}
                      </span>
                      <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(percent, 100)}%`,
                            background: step.color,
                            opacity: 0.65,
                            transition: "width 0.7s ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Connector arrow with step-to-step rate */}
                  {i < FUNNEL_STEPS.length - 1 && (
                    <div className="flex flex-col items-center justify-center shrink-0" style={{ width: 52 }}>
                      <span className="text-[10px] font-semibold mb-0.5" style={{ color: "#9CA3AF" }}>
                        {connectorRates[i]}
                      </span>
                      <ChevronRight className="w-4 h-4" style={{ color: "#D1D5DB" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─ Message Preview  +  Activity Timeline ─ */}
        <div className="grid grid-cols-2 gap-5">

          {/* Message Preview */}
          <div className="bg-white rounded-[12px] p-5" style={{ border: "1px solid #E5E7EB" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold" style={{ color: "#111827" }}>Message Preview</h3>
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-[6px]"
                style={{ background: ch.bg, color: ch.color, border: `1px solid ${ch.border}` }}
              >
                {ch.label}
              </span>
            </div>

            {/* Chat bubble */}
            <div
              className="rounded-[12px] p-4 mb-4"
              style={{
                background: camp.channel === "whatsapp" ? "#D9FDD3" : "#EFF6FF",
                border: `1px solid ${camp.channel === "whatsapp" ? "#BBF7D0" : "#BFDBFE"}`,
              }}
            >
              <p className="text-[13px] leading-relaxed" style={{ color: "#1F2937" }}>
                {msgPreview}
              </p>
              <p className="text-[10px] mt-2 text-right" style={{ color: "#9CA3AF" }}>
                {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} ✓✓
              </p>
            </div>

            {/* Expected rates */}
            {(camp.expected_engagement != null || camp.expected_conversion != null) && (
              <div className="grid grid-cols-2 gap-3">
                {camp.expected_engagement != null && (
                  <div className="rounded-[8px] px-3 py-3"
                    style={{ background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: "#9CA3AF" }}>
                      Exp. Engagement
                    </p>
                    <p className="text-[20px] font-bold mt-0.5" style={{ color: "#111827" }}>
                      {(camp.expected_engagement * 100).toFixed(0)}%
                    </p>
                  </div>
                )}
                {camp.expected_conversion != null && (
                  <div className="rounded-[8px] px-3 py-3"
                    style={{ background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: "#9CA3AF" }}>
                      Exp. Conversion
                    </p>
                    <p className="text-[20px] font-bold mt-0.5" style={{ color: "#111827" }}>
                      {(camp.expected_conversion * 100).toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-[12px] p-5 flex flex-col" style={{ border: "1px solid #E5E7EB" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold" style={{ color: "#111827" }}>Activity Timeline</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22C55E" }} />
                <span className="text-[11px] font-medium" style={{ color: "#16A34A" }}>
                  {activity.length} events
                </span>
              </div>
            </div>

            {activity.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                  <p className="text-[13px]" style={{ color: "#9CA3AF" }}>Waiting for events…</p>
                </div>
              </div>
            ) : (
              <div className="overflow-y-auto scrollbar-none" style={{ maxHeight: 340 }}>
                {activity.map((item, i) => {
                  const cfg = EVENT_CFG[item.event_type] ?? EVENT_CFG.SENT;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-2.5"
                      style={{ borderBottom: i < activity.length - 1 ? "1px solid #F9FAFB" : "none" }}
                    >
                      {/* Icon */}
                      <div
                        className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0"
                        style={{ background: cfg.bg }}
                      >
                        <cfg.Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-semibold" style={{ color: cfg.color }}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px]" style={{ color: "#9CA3AF" }}>{item.time_str}</span>
                        </div>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: "#9CA3AF" }}>
                          #{item.short_id}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
