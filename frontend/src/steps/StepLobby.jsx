import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Star, MapPin, ChevronRight,
  Trophy, Send, ArrowRight, Wifi, WifiOff,
} from "lucide-react";

const STYLE_META = {
  pushy:     { label: "נוקשה",  color: "text-red-300",    bg: "bg-red-950/40",    border: "border-red-700/40"    },
  confident: { label: "בטוח",   color: "text-indigo-300", bg: "bg-indigo-950/40", border: "border-indigo-700/40" },
  pressure:  { label: "לחץ",    color: "text-orange-300", bg: "bg-orange-950/40", border: "border-orange-700/40" },
  naive:     { label: "תמים",   color: "text-emerald-300",bg: "bg-emerald-950/40",border: "border-emerald-700/40"},
  loud:      { label: "ישיר",   color: "text-amber-300",  bg: "bg-amber-950/40",  border: "border-amber-700/40"  },
};

const STATUS_META = {
  waiting:    { dot: "bg-emerald-400 animate-pulse", label: "זמין",     text: "text-emerald-400" },
  in_session: { dot: "bg-amber-400",                 label: "בשיחה",    text: "text-amber-400"   },
  done:       { dot: "bg-slate-500",                 label: "סגר עסקה", text: "text-slate-400"   },
};

const fmt = n => n ? `₪${Number(n).toLocaleString()}` : "";

// ── Dealer lobby card ──────────────────────────────────────────────────────────

function DealerCard({ dealer, onWalkUp }) {
  const style   = STYLE_META[dealer.style] || STYLE_META.confident;
  const statusM = STATUS_META[dealer.dealer_status] || STATUS_META.waiting;
  const available = dealer.dealer_status === "waiting";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={available ? { scale: 1.02 } : {}}
      className={`relative rounded-2xl border ${style.border} ${style.bg} p-5 flex flex-col gap-3 ${available ? "cursor-pointer" : "opacity-55"}`}
      onClick={() => available && onWalkUp(dealer)}
    >
      <div className="absolute top-4 left-4 flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${statusM.dot}`} />
        <span className={`text-xs font-medium ${statusM.text}`}>{statusM.label}</span>
      </div>

      <div className="text-center pt-3">
        <div className="text-5xl mb-2 select-none">{dealer.avatar}</div>
        <div className="text-white font-bold text-base">{dealer.name}</div>
        <div className={`text-xs font-medium mt-0.5 ${style.color}`}>{dealer.title}</div>
      </div>

      <div className="flex justify-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{dealer.city}</span>
        {dealer.years_exp > 0 && (
          <span className="flex items-center gap-1"><Star className="w-3 h-3" />{dealer.years_exp} שנה</span>
        )}
      </div>

      <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
        <div className="text-white font-semibold text-sm">{dealer.car_label}</div>
        <div className="text-slate-400 text-xs mt-0.5">{(dealer.car_km || 0).toLocaleString()} ק"מ</div>
        <div className={`font-bold text-base mt-1 ${style.color}`}>{fmt(dealer.asking_price)}</div>
      </div>

      <p className="text-slate-400 text-xs italic text-center leading-relaxed">"{dealer.catchphrase}"</p>

      <div className="space-y-1">
        {dealer.traits.slice(0, 2).map((t, i) => (
          <div key={i} className={`flex items-start gap-1.5 text-xs text-slate-400`}>
            <span className={`mt-0.5 ${style.color}`}>•</span> {t}
          </div>
        ))}
      </div>

      {available && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          className="w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 mt-1 bg-slate-700 hover:bg-slate-600 transition-all"
        >
          <MessageSquare className="w-4 h-4" /> גש אליו
        </motion.button>
      )}
    </motion.div>
  );
}

// ── Walk-up modal ──────────────────────────────────────────────────────────────

function WalkUpModal({ dealer, onConfirm, onCancel }) {
  const [name, setName]     = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const style = STYLE_META[dealer?.style] || STYLE_META.confident;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/lobby/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealer_session_id: dealer.session_id,
          buyer_name: name || "קונה",
          buyer_budget: budget ? Number(budget) : null,
        }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      onConfirm(data.session_id);
    } catch (e) {
      alert("שגיאה: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className={`bg-slate-900 border ${style.border} rounded-2xl p-6 max-w-sm w-full`}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">{dealer?.avatar}</div>
          <div className="text-white font-bold text-base">{dealer?.name}</div>
          <div className={`text-xs ${style.color} mt-0.5`}>{dealer?.title}</div>
          <p className="text-slate-400 text-sm mt-3 italic">"{dealer?.catchphrase}"</p>
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">השם שלך (אופציונלי)</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="קונה"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">תקציב מקסימלי (אופציונלי)</label>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="לא חובה"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors">
            ביטול
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><ChevronRight className="w-4 h-4" /> גש לדיל!</>
            }
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Session chat ───────────────────────────────────────────────────────────────

function SessionScreen({ sessionId, dealer, onBack }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [connected, setConnected] = useState(false);
  const [deal, setDeal]           = useState(null);
  const [typing, setTyping]       = useState(false);
  const wsRef     = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const style     = STYLE_META[dealer?.style] || STYLE_META.confident;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.hostname}:8000/ws/lobby/${sessionId}`);
    wsRef.current = ws;
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => { setConnected(false); setTyping(false); };
    ws.onerror = () => { setConnected(false); setTyping(false); };
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === "msg") {
          setTyping(false);
          setMessages(prev => [...prev, d.msg]);
        } else if (d.type === "session_closed") {
          setConnected(false);
          if (d.status?.deal) setDeal(d.status.deal);
        }
      } catch {}
    };
    return () => ws.close();
  }, [sessionId]);

  const sendMsg = () => {
    const text = inputText.trim();
    if (!text || !connected || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ text }));
    setInputText("");
    setTyping(true);
    inputRef.current?.focus();
  };

  const QUICK = ["מה הכי נמוך שתסכים?", "תן לי מחיר סופי", "יש מקום לדיון?", "אני מוכן לסגור עכשיו"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col text-white" dir="rtl">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-700 backdrop-blur-sm">
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
          <ArrowRight className="w-4 h-4" /> חזור ללובי
        </button>
        <div className="text-center">
          <div className="text-white font-bold text-sm">{dealer?.avatar} {dealer?.name}</div>
          <div className={`text-xs ${style.color}`}>{dealer?.title}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {connected
            ? <><Wifi className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400 text-xs">מחובר</span></>
            : <><WifiOff className="w-4 h-4 text-slate-500" /><span className="text-slate-500 text-xs">מנותק</span></>
          }
        </div>
      </div>

      <div className={`px-4 py-2 ${style.bg} border-b ${style.border} flex items-center justify-between`}>
        <span className="text-sm font-medium text-white">{dealer?.car_label}</span>
        <span className={`font-bold ${style.color}`}>{fmt(dealer?.asking_price)}</span>
      </div>

      <AnimatePresence>
        {deal && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/20 border-b border-emerald-500/40 px-4 py-3 flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-300 font-bold text-lg">עסקה נסגרה! {fmt(deal.price)}</span>
            <Trophy className="w-5 h-5 text-emerald-400" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-20">
            <div className="text-4xl mb-3">{dealer?.avatar}</div>
            <p className="text-sm">ממתין לדילר...</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map(msg => {
            const mine = msg.actor === "buyer";
            return (
              <motion.div key={msg.id}
                initial={{ opacity: 0, x: mine ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex flex-col gap-1 ${mine ? "items-start" : "items-end"}`}
              >
                <span className="text-xs text-slate-500 px-1">
                  {mine ? "אתה" : dealer?.name}
                </span>
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                  mine
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : `${style.bg} border ${style.border} text-white rounded-tl-sm`
                }`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  {msg.price && (
                    <div className={`text-xs font-bold mt-1 ${mine ? "text-indigo-200" : style.color}`}>
                      {fmt(msg.price)}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {typing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-end gap-1">
              <span className="text-xs text-slate-500 px-1">{dealer?.name}</span>
              <div className={`${style.bg} border ${style.border} rounded-2xl rounded-tl-sm px-4 py-3`}>
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <motion.span key={i}
                      className="w-1.5 h-1.5 rounded-full bg-slate-400"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {!deal && connected && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-slate-800/60">
          {QUICK.map(q => (
            <button key={q} onClick={() => setInputText(q)}
              className="shrink-0 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-3 bg-slate-900/80 border-t border-slate-700 backdrop-blur-sm">
        <div className="flex gap-2">
          <input ref={inputRef} value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMsg()}
            disabled={!connected || !!deal}
            placeholder={deal ? "עסקה נסגרה" : "כתוב הצעה או שאלה..."}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-40"
          />
          <button onClick={sendMsg} disabled={!inputText.trim() || !connected || !!deal}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl transition-colors shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function StepLobby({ onBack }) {
  const [dealers, setDealers]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [walkUpTarget, setWalkUpTarget] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  const fetchLobby = useCallback(async () => {
    try {
      const resp = await fetch("/api/lobby");
      if (resp.ok) {
        const data = await resp.json();
        setDealers(data.dealers || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLobby();
    const id = setInterval(fetchLobby, 8000);
    return () => clearInterval(id);
  }, [fetchLobby]);

  const handleSessionStart = (sessionId) => {
    setActiveSession({ sessionId, dealer: walkUpTarget });
    setWalkUpTarget(null);
  };

  if (activeSession) {
    return (
      <SessionScreen
        sessionId={activeSession.sessionId}
        dealer={activeSession.dealer}
        onBack={() => { setActiveSession(null); fetchLobby(); }}
      />
    );
  }

  const waitingCount = dealers.filter(d => d.dealer_status === "waiting").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white" dir="rtl">

      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-base">🏪 לובי הבסטה</div>
            <div className="text-slate-500 text-xs">{waitingCount} דילרים זמינים לשיחה</div>
          </div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack}
                className="text-slate-400 hover:text-white transition-colors text-sm flex items-center gap-1">
                → חזור
              </button>
            )}
            <button onClick={fetchLobby}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
              רענן
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8">
          <div className="text-5xl mb-3">🏪</div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              לובי הדילרים
            </span>
          </h1>
          <p className="text-slate-300 text-base max-w-lg mx-auto leading-relaxed">
            כאן עומדים סוכני AI של מוכרי רכב — כל אחד עם אישיות ייחודית.
            <span className="text-amber-300 font-semibold"> גש לדילר, התמקח, נסה לסגור עסקה.</span>
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dealers.map((dealer, i) => (
              <motion.div key={dealer.session_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.07 } }}>
                <DealerCard dealer={dealer} onWalkUp={setWalkUpTarget} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {walkUpTarget && (
          <WalkUpModal
            dealer={walkUpTarget}
            onConfirm={handleSessionStart}
            onCancel={() => setWalkUpTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
