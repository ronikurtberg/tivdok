import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Users, Bot, User, MessageSquare, CheckCircle2,
  XCircle, ArrowRightLeft, AlertTriangle, Trophy, Phone,
  ChevronRight, Play, Pause, Send, Store, Swords,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

const KIND_META = {
  system:      { color: "text-slate-400", bg: "bg-slate-800/60", icon: Store,         label: "מערכת" },
  agent_msg:   { color: "text-blue-300",  bg: "bg-blue-950/60",  icon: Bot,           label: "סוכן" },
  offer:       { color: "text-amber-300", bg: "bg-amber-950/60", icon: ArrowRightLeft, label: "הצעה" },
  counter:     { color: "text-orange-300",bg: "bg-orange-950/60",icon: ArrowRightLeft, label: "נגדית" },
  accept:      { color: "text-emerald-300",bg:"bg-emerald-950/60",icon: CheckCircle2,  label: "קבלה" },
  reject:      { color: "text-red-300",   bg: "bg-red-950/60",   icon: XCircle,       label: "דחייה" },
  escalate:    { color: "text-yellow-300",bg: "bg-yellow-950/60",icon: AlertTriangle,  label: "התראה" },
  human_msg:   { color: "text-purple-300",bg: "bg-purple-950/60",icon: User,           label: "אנושי" },
  deal_done:   { color: "text-emerald-300",bg:"bg-emerald-900/80",icon: Trophy,        label: "עסקה!" },
};

const ACTOR_LABEL = (actor, buyers) => {
  if (actor === "seller")        return "🤖 סוכן המוכר";
  if (actor === "system")        return "🏪 הבסטה";
  if (actor === "human_seller")  return "👤 המוכר";
  if (actor.startsWith("buyer_")) {
    const id = actor.replace("buyer_", "");
    const b = buyers.find(b => b.buyer_id === id);
    return b ? `🤖 ${b.agent_name}` : `🤖 קונה ${id}`;
  }
  return actor;
};

const fmt = n => n ? `₪${Number(n).toLocaleString()}` : "";

// ── Setup screen ──────────────────────────────────────────────────────────────

function SetupScreen({ car, market, onStart }) {
  const askingDefault = car?.asking_price || market?.median_price || 80000;
  const [askingPrice, setAskingPrice]   = useState(askingDefault);
  const [floorPrice, setFloorPrice]     = useState(Math.round(askingDefault * 0.87));
  const [personality, setPersonality]   = useState("flexible");
  const [buyers, setBuyers]             = useState([
    { name: "סוכן קונה א", budget: Math.round(askingDefault * 0.9), strategy: "haggler" },
    { name: "סוכן קונה ב", budget: Math.round(askingDefault * 0.82), strategy: "sniper" },
  ]);
  const [maxRounds, setMaxRounds]       = useState(8);
  const [loading, setLoading]           = useState(false);

  const addBuyer = () => setBuyers(b => [
    ...b,
    { name: `סוכן קונה ${String.fromCharCode(1488 + b.length)}`, budget: Math.round(askingDefault * 0.85), strategy: "patient" },
  ]);

  const removeBuyer = i => setBuyers(b => b.filter((_, idx) => idx !== i));

  const updateBuyer = (i, key, val) => setBuyers(b =>
    b.map((buyer, idx) => idx === i ? { ...buyer, [key]: val } : buyer)
  );

  const handleStart = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/habasta/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller: {
            car: car || { manufacturer: "Toyota", model: "Corolla", year: 2019, km: 85000 },
            asking_price: askingPrice,
            floor_price: floorPrice,
            personality,
          },
          buyers: buyers.map(b => ({ budget: b.budget, strategy: b.strategy, name: b.name })),
          max_rounds: maxRounds,
        }),
      });
      const data = await resp.json();
      onStart(data.arena_id, buyers);
    } catch (e) {
      alert("שגיאה ביצירת הבסטה: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const carLabel = car
    ? `${car.year || ""} ${car.manufacturer || ""} ${car.model || ""}`.trim()
    : "רכב ללא פרטים";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Swords className="w-8 h-8 text-amber-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              הבסטה
            </h1>
            <Swords className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-slate-300 text-lg">זירת המשא ומתן האוטונומית — סוכני AI מתמקחים במקומך</p>
          <p className="text-slate-500 text-sm mt-1">רכב: <span className="text-slate-300">{carLabel}</span></p>
        </motion.div>

        {/* Seller config */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
          className="bg-slate-800/60 rounded-2xl p-5 mb-4 border border-slate-700">
          <h2 className="text-amber-400 font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4" /> הגדרות סוכן המוכר
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">מחיר פתיחה</label>
              <input type="number" value={askingPrice}
                onChange={e => setAskingPrice(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">מחיר רצפה (פרטי — הקונה לא יראה)</label>
              <input type="number" value={floorPrice}
                onChange={e => setFloorPrice(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs text-slate-400 mb-1 block">אישיות הסוכן</label>
            <div className="flex gap-2">
              {[["firm", "נוקשה 💪"], ["flexible", "גמיש 🤝"], ["eager", "ממהר ⚡"]].map(([v, l]) => (
                <button key={v} onClick={() => setPersonality(v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${personality === v ? "bg-amber-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Buyers config */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
          className="bg-slate-800/60 rounded-2xl p-5 mb-4 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-blue-400 font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> סוכני קונים ({buyers.length})
            </h2>
            {buyers.length < 4 && (
              <button onClick={addBuyer}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                + הוסף קונה
              </button>
            )}
          </div>
          <div className="space-y-3">
            {buyers.map((b, i) => (
              <div key={i} className="bg-slate-900/60 rounded-xl p-3 flex gap-3 items-center">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <input value={b.name} onChange={e => updateBuyer(i, "name", e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white" placeholder="שם" />
                  <input type="number" value={b.budget} onChange={e => updateBuyer(i, "budget", Number(e.target.value))}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white" placeholder="תקציב" />
                  <select value={b.strategy} onChange={e => updateBuyer(i, "strategy", e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-white">
                    <option value="haggler">מתמקח 🔄</option>
                    <option value="sniper">צלף 🎯</option>
                    <option value="patient">סבלני ⏳</option>
                  </select>
                </div>
                {buyers.length > 1 && (
                  <button onClick={() => removeBuyer(i)} className="text-slate-500 hover:text-red-400 transition-colors">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Rounds + start */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
          className="flex items-center gap-4 mb-6">
          <div className="flex-1 bg-slate-800/60 rounded-2xl p-4 border border-slate-700">
            <label className="text-xs text-slate-400 mb-1 block">מספר סבבים</label>
            <input type="number" min={3} max={20} value={maxRounds}
              onChange={e => setMaxRounds(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white" />
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.4 } }}
          onClick={handleStart} disabled={loading}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 text-lg transition-all shadow-lg shadow-amber-900/30">
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Play className="w-5 h-5" /> פתח את הבסטה!</>
          )}
        </motion.button>
      </div>
    </div>
  );
}

// ── Arena screen ──────────────────────────────────────────────────────────────

function ArenaScreen({ arenaId, buyers, car }) {
  const [events, setEvents]           = useState([]);
  const [status, setStatus]           = useState(null);
  const [connected, setConnected]     = useState(false);
  const [escalations, setEscalations] = useState([]);
  const [humanText, setHumanText]     = useState("");
  const [humanActor, setHumanActor]   = useState("human_seller");
  const [deal, setDeal]               = useState(null);
  const wsRef                         = useRef(null);
  const bottomRef                     = useRef(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [events, scrollToBottom]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname;
    const port = 8000;
    const ws = new WebSocket(`${protocol}://${host}:${port}/ws/habasta/${arenaId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "arena_closed") {
          setStatus(data.status);
          setEscalations(data.escalations || []);
          if (data.status?.deal) setDeal(data.status.deal);
          setConnected(false);
          return;
        }
        setEvents(prev => [...prev, data]);
        if (data.kind === "deal_done") setDeal({ price: data.price });
      } catch {}
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => ws.close();
  }, [arenaId]);

  const sendHumanMsg = () => {
    if (!humanText.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: "human_msg",
      actor: humanActor,
      text: humanText.trim(),
    }));
    setHumanText("");
  };

  const BUYERS_MAP = buyers.reduce((acc, b) => {
    if (b.buyer_id) acc[b.buyer_id] = b;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col text-white" dir="rtl">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-700 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Swords className="w-5 h-5 text-amber-400" />
          <span className="font-bold text-amber-400 text-lg">הבסטה</span>
          <span className="text-slate-500 text-sm">#{arenaId}</span>
        </div>
        <div className="flex items-center gap-3">
          {connected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              זירה פעילה
            </span>
          ) : deal ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <Trophy className="w-4 h-4" /> עסקה נסגרה!
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-400 text-sm">
              <span className="w-2 h-2 bg-slate-500 rounded-full" />
              נסגר
            </span>
          )}
          <span className="text-slate-500 text-sm">{events.length} אירועים</span>
        </div>
      </div>

      {/* Participants bar */}
      <div className="flex gap-2 px-4 py-2 bg-slate-900/40 border-b border-slate-800 overflow-x-auto">
        <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-800/40 rounded-lg px-3 py-1.5 shrink-0">
          <Bot className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-amber-300 text-xs font-medium">סוכן המוכר</span>
        </div>
        {buyers.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5 bg-blue-950/60 border border-blue-800/40 rounded-lg px-3 py-1.5 shrink-0">
            <Bot className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-300 text-xs font-medium">{b.name}</span>
            <span className="text-slate-500 text-xs">({b.strategy})</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 bg-purple-950/60 border border-purple-800/40 rounded-lg px-3 py-1.5 shrink-0">
          <User className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-purple-300 text-xs font-medium">כניסה ידנית</span>
        </div>
      </div>

      {/* Deal banner */}
      <AnimatePresence>
        {deal && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-emerald-500/20 border-b border-emerald-500/40 px-4 py-3 text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-300 font-bold text-lg">
              <Trophy className="w-5 h-5" />
              עסקה נסגרה! מחיר סופי: {fmt(deal.price)}
              <Trophy className="w-5 h-5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Escalations */}
      <AnimatePresence>
        {escalations.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-start gap-2 text-sm">
            <Phone className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <span className="text-yellow-300">{msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Events feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {events.length === 0 && (
          <div className="text-center text-slate-500 mt-16">
            <Zap className="w-8 h-8 mx-auto mb-3 animate-pulse text-amber-600" />
            <p>ממתין לסוכנים...</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {events.map((ev) => {
            const meta = KIND_META[ev.kind] || KIND_META.agent_msg;
            const Icon = meta.icon;
            const isSystem = ev.actor === "system";
            const isDeal = ev.kind === "deal_done";

            if (isSystem && !isDeal) {
              return (
                <motion.div key={ev.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-slate-500 text-xs py-1">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span>{ev.content}</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </motion.div>
              );
            }

            return (
              <motion.div key={ev.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl p-3 border ${meta.bg} ${
                  isDeal ? "border-emerald-500/50" : "border-slate-700/50"
                }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{ACTOR_LABEL(ev.actor, buyers)}</span>
                    <span className="text-slate-600">·</span>
                    <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">{meta.label}</span>
                  </div>
                  {ev.price && (
                    <span className={`text-sm font-bold ${meta.color}`}>{fmt(ev.price)}</span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed ${isDeal ? "text-emerald-200 font-semibold" : "text-slate-200"}`}>
                  {ev.content}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Human walk-in input */}
      <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-700 backdrop-blur-sm">
        <div className="flex gap-2 items-center">
          <select value={humanActor} onChange={e => setHumanActor(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-sm text-purple-300 shrink-0">
            <option value="human_seller">👤 אני המוכר</option>
            <option value="human_buyer">👤 אני קונה</option>
          </select>
          <input
            value={humanText}
            onChange={e => setHumanText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendHumanMsg()}
            placeholder="כנס לזירה ידנית — כתוב הצעה או הודעה..."
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button onClick={sendHumanMsg} disabled={!humanText.trim() || !connected}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-colors shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1.5 text-center">
          הסוכנים מנהלים את המשא ומתן — אתם יכולים להתערב בכל רגע
        </p>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function StepHabasta({ car, market, onNext }) {
  const [phase, setPhase]     = useState("setup");   // "setup" | "arena"
  const [arenaId, setArenaId] = useState(null);
  const [buyers, setBuyers]   = useState([]);

  const handleStart = (id, buyerList) => {
    setArenaId(id);
    setBuyers(buyerList);
    setPhase("arena");
  };

  if (phase === "setup") {
    return <SetupScreen car={car} market={market} onStart={handleStart} />;
  }

  return <ArenaScreen arenaId={arenaId} buyers={buyers} car={car} />;
}
