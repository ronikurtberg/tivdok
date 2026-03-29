import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, MessageSquare, Camera, TrendingUp, Phone, Globe,
  Shield, Star, Lock, Check, Sparkles, Bot, Crown, X,
} from "lucide-react";

const SKILLS = [
  {
    id: "whatsapp_responder",
    nameHeb: "עונה ב-WhatsApp",
    icon: MessageSquare,
    color: "#25D366",
    bg: "from-green-950 to-emerald-950",
    border: "border-green-700/40",
    price: 19,
    priceLabel: "₪19 / חודש",
    tag: "הכי פופולרי",
    tagColor: "bg-green-500",
    description: "הסוכן עונה לקונים ב-WhatsApp 24/7, מסנן רציניים, קובע פגישות — אתה ישן.",
    bullets: ["מענה אוטומטי תוך 10 שניות", "סינון קונים לא רציניים", "קביעת פגישות", "הודעה אליך רק כשיש עסקה"],
    emoji: "💬",
  },
  {
    id: "photo_boost",
    nameHeb: "שדרוג תמונות AI",
    icon: Camera,
    color: "#818cf8",
    bg: "from-indigo-950 to-violet-950",
    border: "border-indigo-700/40",
    price: 9,
    priceLabel: "₪9 חד-פעמי",
    tag: "חדש",
    tagColor: "bg-indigo-500",
    description: "AI מנתח תמונות הרכב שלך ואומר בדיוק אילו תמונות יגרמו לרכב להימכר מהר יותר.",
    bullets: ["ציון לכל תמונה (1-10)", "המלצה מה לצלם מחדש", "השוואה לתמונות מובילות בשוק", "עצות תאורה וזווית"],
    emoji: "📸",
  },
  {
    id: "price_optimizer",
    nameHeb: "אופטימיזציית מחיר",
    icon: TrendingUp,
    color: "#f59e0b",
    bg: "from-amber-950 to-orange-950",
    border: "border-amber-700/40",
    price: 29,
    priceLabel: "₪29 / חודש",
    tag: "מכר מהר יותר",
    tagColor: "bg-amber-500",
    description: "הסוכן עוקב אחרי השוק כל יום ומתאים את המחיר שלך אוטומטית — תמיד תחרותי.",
    bullets: ["סריקת שוק יומית", "התאמת מחיר אוטומטית", "התראה כשיש הזדמנות", "דוח שבועי"],
    emoji: "📈",
  },
  {
    id: "multi_platform",
    nameHeb: "פרסום רב-פלטפורמי",
    icon: Globe,
    color: "#06b6d4",
    bg: "from-cyan-950 to-sky-950",
    border: "border-cyan-700/40",
    price: 39,
    priceLabel: "₪39 / פרסום",
    tag: "הכי חזק",
    tagColor: "bg-cyan-500",
    description: "הסוכן מפרסם ביד2, פייסבוק, קבוצות WhatsApp ואינסטגרם — בלחיצה אחת.",
    bullets: ["יד2 + פייסבוק + אינסטגרם", "טקסט שיווקי AI", "עדכון מחיר אוטונומי", "סטטיסטיקות מאוחדות"],
    emoji: "🌐",
  },
  {
    id: "habasta_pro",
    nameHeb: "הבסטה PRO ⚔️",
    icon: Zap,
    color: "#f59e0b",
    bg: "from-yellow-950 to-amber-950",
    border: "border-yellow-600/40",
    price: 49,
    priceLabel: "₪49 / עסקה",
    tag: "מהפכני",
    tagColor: "bg-yellow-500",
    description: "שלח את הסוכן להבסטה — זירת המשא ומתן האוטונומית. יתמקח ויסגור עסקה בשמך.",
    bullets: ["כניסה אוטונומית להבסטה", "התמקחות חכמה", "WhatsApp כשנסגר עסקה", "דוח משא ומתן מלא"],
    emoji: "⚔️",
  },
  {
    id: "car_profile",
    nameHeb: "פרופיל רכב קבוע",
    icon: Shield,
    color: "#10b981",
    bg: "from-emerald-950 to-teal-950",
    border: "border-emerald-700/40",
    price: 50,
    priceLabel: "₪50 פעם אחת לתמיד",
    tag: "ייחודי לתיבדוק",
    tagColor: "bg-emerald-500",
    description: "פרופיל קבוע לפי לוחית רישוי — נשאר לנצח, מועבר לבעלים הבא.",
    bullets: ["קשור ללוחית לתמיד", "מועבר לבעלים הבא", "היסטוריה מלאה", "ניתוח ערך עדכני"],
    emoji: "🛡️",
  },
];

const BUNDLES = [
  {
    id: "starter",
    nameHeb: "סוכן מתחיל",
    skills: ["whatsapp_responder", "photo_boost"],
    price: 25,
    priceLabel: "₪25 / חודש",
    saving: "חוסך ₪3",
    color: "from-blue-600 to-indigo-600",
    crown: false,
  },
  {
    id: "pro",
    nameHeb: "סוכן פרו",
    skills: ["whatsapp_responder", "price_optimizer", "multi_platform"],
    price: 69,
    priceLabel: "₪69 / חודש",
    saving: "חוסך ₪18",
    color: "from-amber-500 to-orange-600",
    crown: false,
  },
  {
    id: "superhero",
    nameHeb: "סוכן סופר-גיבור ⚡",
    skills: ["whatsapp_responder", "photo_boost", "price_optimizer", "multi_platform", "habasta_pro", "car_profile"],
    price: 120,
    priceLabel: "₪120",
    saving: "חוסך ₪75",
    color: "from-purple-600 to-pink-600",
    crown: true,
  },
];

function SkillCard({ skill, equipped, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = skill.icon;
  return (
    <motion.div
      layout
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative rounded-2xl border p-4 cursor-pointer transition-all bg-gradient-to-br ${skill.bg} ${skill.border} ${equipped ? "ring-2 ring-white/20" : ""}`}
    >
      {skill.tag && (
        <span className={`absolute top-3 right-3 text-white text-xs font-bold px-2 py-0.5 rounded-full ${skill.tagColor}`}>
          {skill.tag}
        </span>
      )}
      <div className="flex items-start justify-between mb-3 mt-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: skill.color + "22" }}>
            {skill.emoji}
          </div>
          <div>
            <div className="text-white font-bold text-sm">{skill.nameHeb}</div>
            <div className="font-bold text-sm" style={{ color: skill.color }}>{skill.priceLabel}</div>
          </div>
        </div>
        <button
          onClick={() => onToggle(skill.id)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all font-bold text-sm ${
            equipped
              ? "bg-white text-slate-900"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
          }`}
        >
          {equipped ? <Check className="w-4 h-4" /> : "+"}
        </button>
      </div>
      <p className="text-slate-300 text-xs leading-relaxed mb-2">{skill.description}</p>
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        {expanded ? "פחות ▲" : "פרטים ▼"}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 space-y-1 overflow-hidden"
          >
            {skill.bullets.map(b => (
              <li key={b} className="flex items-center gap-1.5 text-xs text-slate-300">
                <Check className="w-3 h-3 shrink-0" style={{ color: skill.color }} />
                {b}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AgentPreview({ equipped, totalPrice }) {
  const skillMap = Object.fromEntries(SKILLS.map(s => [s.id, s]));
  const equippedSkills = equipped.map(id => skillMap[id]).filter(Boolean);
  const power = Math.min(100, equipped.length * 17);

  return (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700 p-4 sticky top-20">
      <div className="text-center mb-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-3xl mb-2 shadow-lg shadow-purple-900/40">
          🤖
        </div>
        <div className="text-white font-bold text-base">הסוכן שלך</div>
        <div className="text-slate-400 text-xs mt-0.5">
          {equipped.length === 0 ? "ללא כישורים עדיין" : `${equipped.length} כישורים מצוידים`}
        </div>
      </div>

      {/* Power bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">עוצמת סוכן</span>
          <span className="text-indigo-300 font-bold">{power}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
            animate={{ width: `${power}%` }}
            transition={{ type: "spring", stiffness: 100 }}
          />
        </div>
      </div>

      {/* Equipped chips */}
      <div className="flex flex-wrap gap-1.5 mb-4 min-h-[36px]">
        {equippedSkills.length === 0 ? (
          <p className="text-slate-600 text-xs">בחר כישורים מהרשימה</p>
        ) : (
          equippedSkills.map(s => (
            <span key={s.id} className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: s.color + "22", color: s.color }}>
              {s.emoji} {s.nameHeb}
            </span>
          ))
        )}
      </div>

      {/* Price */}
      <div className="border-t border-slate-700 pt-3 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">סה"כ</span>
          <span className="text-white font-bold text-lg">
            {totalPrice === 0 ? "חינם" : `₪${totalPrice}`}
          </span>
        </div>
      </div>

      <button
        disabled={equipped.length === 0}
        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
      >
        {equipped.length === 0 ? "בחר כישורים" : "🚀 הפעל סוכן"}
      </button>
      <p className="text-center text-slate-600 text-xs mt-2">תשלום מאובטח · ביטול בכל עת</p>
    </div>
  );
}

export default function StepAgentBuilder({ car, onBack, onHabasta }) {
  const [equipped, setEquipped]     = useState([]);
  const [activeTab, setActiveTab]   = useState("skills");

  const toggle = (id) => {
    setEquipped(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const applyBundle = (bundle) => {
    setEquipped(bundle.skills);
  };

  const totalPrice = equipped.reduce((sum, id) => {
    const s = SKILLS.find(sk => sk.id === id);
    return sum + (s?.price || 0);
  }, 0);

  const carLabel = car
    ? `${car.year || ""} ${car.manufacturer_en || car.manufacturer || ""} ${car.model_en || car.model || ""}`.trim()
    : "הרכב שלך";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white" dir="rtl">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-sm border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="font-bold text-white text-sm">בנה את הסוכן שלך</div>
              <div className="text-slate-500 text-xs">{carLabel}</div>
            </div>
          </div>
          {onBack && (
            <button onClick={onBack} className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
              → חזור
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8">
          <div className="text-5xl mb-3">⚡</div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              חנות הכישורים
            </span>
          </h1>
          <p className="text-slate-300 text-base max-w-lg mx-auto leading-relaxed">
            צייד את הסוכן שלך בסופרפאוורים. כל כישור הוא יכולת AI שמשדרגת את מכירת הרכב שלך —
            <span className="text-indigo-300 font-semibold"> אוטומטית, בלי שתצטרך לעשות כלום.</span>
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 mb-6 max-w-xs mx-auto">
          {[["skills", "🔧 כישורים"], ["bundles", "📦 חבילות"]].map(([t, l]) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t ? "bg-white text-slate-900" : "text-slate-400 hover:text-slate-200"
              }`}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex flex-row-reverse gap-6 items-start">

          {/* Right (RTL: main): skills or bundles */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {activeTab === "skills" && (
                <motion.div key="skills" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SKILLS.map(skill => (
                      <SkillCard
                        key={skill.id}
                        skill={skill}
                        equipped={equipped.includes(skill.id)}
                        onToggle={toggle}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === "bundles" && (
                <motion.div key="bundles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-4">
                  {BUNDLES.map((bundle, i) => {
                    const bundleSkills = SKILLS.filter(s => bundle.skills.includes(s.id));
                    return (
                      <motion.div key={bundle.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: i * 0.08 } }}
                        className={`rounded-2xl border border-slate-700 overflow-hidden`}>
                        <div className={`bg-gradient-to-r ${bundle.color} px-5 py-4 flex items-center justify-between`}>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              {bundle.crown && <Crown className="w-4 h-4 text-yellow-300" />}
                              <span className="font-bold text-white text-base">{bundle.nameHeb}</span>
                            </div>
                            <span className="text-white/80 text-xs">{bundle.saving}</span>
                          </div>
                          <div className="text-left">
                            <div className="text-white font-bold text-xl">{bundle.priceLabel}</div>
                            <button onClick={() => applyBundle(bundle)}
                              className="mt-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
                              בחר חבילה
                            </button>
                          </div>
                        </div>
                        <div className="bg-slate-900/60 px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {bundleSkills.map(s => (
                              <span key={s.id} className="text-xs px-2 py-1 rounded-full"
                                style={{ background: s.color + "20", color: s.color }}>
                                {s.emoji} {s.nameHeb}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Market vision callout */}
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 } }}
                    className="rounded-2xl border border-indigo-700/40 bg-indigo-950/40 p-5 text-center">
                    <div className="text-2xl mb-2">🏪</div>
                    <div className="font-bold text-indigo-300 text-base mb-1">שוק הסוכנים הראשון בישראל</div>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      בקרוב: קנה סוכנים שנבנו ע"י אחרים, מכור את הסוכן שלך לאחרים,
                      השאיל סוכן לחבר — מרקטפלייס שלם של AI לעולם הרכב.
                    </p>
                    <div className="flex gap-2 justify-center mt-3 flex-wrap">
                      {["🧠 סוכן מומחה BMW", "💼 סוכן דילר", "🔎 סוכן ציד עסקאות"].map(t => (
                        <span key={t} className="text-xs bg-indigo-900/60 text-indigo-300 border border-indigo-700/40 px-3 py-1 rounded-full">
                          {t} <Lock className="inline w-2.5 h-2.5 mr-1 opacity-60" />
                        </span>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Left (RTL: side): agent preview */}
          <div className="w-56 shrink-0 hidden sm:block">
            <AgentPreview equipped={equipped} totalPrice={totalPrice} />
          </div>
        </div>

        {/* Mobile agent summary bar */}
        <AnimatePresence>
          {equipped.length > 0 && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-sm border-t border-slate-700 px-4 py-3 flex items-center justify-between"
            >
              <div>
                <div className="text-white font-bold text-sm">{equipped.length} כישורים · ₪{totalPrice}</div>
                <div className="text-slate-400 text-xs">הסוכן שלך מוכן</div>
              </div>
              <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm">
                🚀 הפעל
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
