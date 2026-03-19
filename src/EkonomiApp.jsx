import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, saveUserData, loadAllUserData, loadProfile, upsertProfile } from "./lib/supabase";

// ============================================================
// MOCK DATA & INITIAL STATE
// ============================================================
const INITIAL_USERS = [
  { id: 1, username: "admin", password: "posten28", role: "admin", lastLogin: "2026-03-05 14:22", disabled: false },
  { id: 2, username: "editor1", password: "editor123", role: "editor", lastLogin: "2026-03-04 09:10", disabled: false },
];

const INVITE_CODES = ["BUDGET2026", "SPARAPENGAR", "EKONOMI99"];

const INITIAL_EXPENSES = [
  { id: 1,  service: "Matkonto",             cost: 4000, dueDate: "", status: "unpaid",   category: "Mat",             tags: [], order: 1 },
  { id: 2,  service: "El + Vatten",           cost: 1000, dueDate: "", status: "autogiro", category: "Boende",          tags: [], order: 2 },
  { id: 3,  service: "Hyra",                  cost: 11500,dueDate: "", status: "unpaid",   category: "Boende",          tags: [], order: 3 },
  { id: 4,  service: "Allente",               cost: 0,    dueDate: "", status: "unpaid",   category: "Boende",          tags: [], order: 4 },
  { id: 5,  service: "Unionen",               cost: 140,  dueDate: "", status: "autogiro", category: "Försäkring",      tags: [], order: 5 },
  { id: 6,  service: "Buss",                  cost: 1370, dueDate: "", status: "unpaid",   category: "Transport",       tags: [], order: 6 },
  { id: 7,  service: "Comviq",                cost: 1198, dueDate: "", status: "autogiro", category: "Prenumerationer", tags: [], order: 7 },
  { id: 8,  service: "Försäkring (ses över)", cost: 0,    dueDate: "", status: "unpaid",   category: "Försäkring",      tags: [], order: 8 },
  { id: 9,  service: "Anyfin",                cost: 3430, dueDate: "", status: "autogiro", category: "Lån",             tags: [], order: 9 },
  { id: 10, service: "Coeo",                  cost: 1200, dueDate: "", status: "autogiro", category: "Lån",             tags: [], order: 10 },
  { id: 11, service: "Svea",                  cost: 282,  dueDate: "", status: "autogiro", category: "Lån",             tags: [], order: 11 },
];

const INITIAL_DEBTS = [
  { id: 1, name: "Coeo",     total: 7000,   remaining: 7000,   monthly: 1200, interest: 0, autogiro: false, startDate: "2024-06-01" },
  { id: 2, name: "Anyfin",   total: 127254, remaining: 124745, monthly: 3430, interest: 0, autogiro: false, startDate: "2024-11-01" },
  { id: 3, name: "Remember", total: 4000,   remaining: 3782,   monthly: 200,  interest: 0, autogiro: false, startDate: "2024-11-01" },
  { id: 4, name: "Resurs",   total: 4000,   remaining: 4000,   monthly: 204,  interest: 0, autogiro: false, startDate: "2025-01-01" },
];

const INITIAL_ASSETS = [
  { id: 1, name: "Sparkonto SEB", amount: 15000, type: "savings" },
  { id: 2, name: "Avanza – Aktier", amount: 23000, type: "investments" },
  { id: 3, name: "Kontanter", amount: 2000, type: "cash" },
];

const INITIAL_SAVINGS_ACCOUNTS = [
  { id: 1, name: "Nödfond – SEB", balance: 15000, goal: 30000, bank: "SEB", color: "#10b981", monthlyDeposit: 1000, monthlyActive: true },
  { id: 2, name: "Semester 2026", balance: 4200, goal: 10000, bank: "SEB", color: "#3b82f6", monthlyDeposit: 500, monthlyActive: true },
  { id: 3, name: "Buffert", balance: 2800, goal: 5000, bank: "SEB", color: "#8b5cf6", monthlyDeposit: 300, monthlyActive: true },
];

const INITIAL_INCOME = [
  { id: 1, name: "Lön – Huvudarbete", amount: 27660, type: "salary", month: "2026-03" },
];

const INITIAL_BEREDSKAP = [];

const INITIAL_EXTRA_INCOME = [
  { id: 1, name: "Semesterbonus", amount: 6247, month: "2026-06", emoji: "🌴" },
];

const STATUS_OPTIONS = [
  { id: "paid", label: "Betald", color: "#10b981", icon: "✓", bg: "#d1fae5" },
  { id: "autogiro", label: "Autogiro", color: "#f59e0b", icon: "⟳", bg: "#fef3c7" },
  { id: "unpaid", label: "Obetald", color: "#ef4444", icon: "!", bg: "#fee2e2" },
];

const CATEGORIES = ["Boende", "Transport", "Mat", "Försäkring", "Prenumerationer", "Hälsa", "Nöje", "Övrigt"];

const TAGS_COLORS = {
  "Boende": "#3b82f6", "Transport": "#f59e0b", "Prenumerationer": "#8b5cf6",
  "Försäkring": "#10b981", "Hälsa": "#ec4899", "Mat": "#ef4444",
  "Autogiro": "#f97316", "Lån": "#6366f1", "Nöje": "#14b8a6",
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function getSalaryDate(year, month) {
  const d = new Date(year, month - 1, 25);
  const dow = d.getDay();
  if (dow === 6) return new Date(year, month - 1, 24);
  if (dow === 0) return new Date(year, month - 1, 23);
  return d;
}

function getSalaryMonthKeyForDate(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  let y = d.getFullYear();
  let m = d.getMonth(); // 0-index
  // Rule: invoices before the 25th belong to previous salary month
  if (d.getDate() < 25) {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function getNextSalary() {
  const now = new Date();
  const thisMonth = getSalaryDate(now.getFullYear(), now.getMonth() + 1);
  if (now <= thisMonth) return thisMonth;
  const next = now.getMonth() === 11
    ? getSalaryDate(now.getFullYear() + 1, 1)
    : getSalaryDate(now.getFullYear(), now.getMonth() + 2);
  return next;
}

function daysUntil(date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / 86400000);
}

function formatSEK(n) {
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(n);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("sv-SE");
}

function calcDebtPayoff(remaining, monthly) {
  if (monthly <= 0) return { months: 0, date: "–" };
  const months = Math.ceil(remaining / monthly);
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return { months, date: d.toLocaleDateString("sv-SE", { year: "numeric", month: "long" }) };
}

function calcFinancialHealth(income, expenses, debts, assets) {
  const totalExpenses = expenses.reduce((s, e) => s + e.cost, 0);
  const totalDebt = debts.reduce((s, d) => s + d.remaining, 0);
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
  const leftover = income - totalExpenses;
  const savingsRate = income > 0 ? (leftover / income) * 100 : 0;
  const debtRatio = income > 0 ? (totalDebt / (income * 12)) * 100 : 100;
  const paymentScore = expenses.filter(e => e.status === "paid").length / Math.max(expenses.length, 1) * 100;
  const emergencyCoverage = totalExpenses > 0 ? (totalAssets / totalExpenses) * 10 : 0;

  const score = Math.min(100, Math.max(0,
    savingsRate * 0.35 +
    (100 - Math.min(debtRatio, 100)) * 0.25 +
    paymentScore * 0.25 +
    Math.min(emergencyCoverage, 100) * 0.15
  ));
  return Math.round(score);
}

// ============================================================
// COMPONENTS
// ============================================================

// ---- TAG PILL ----
function TagPill({ tag, onRemove }) {
  const color = TAGS_COLORS[tag] || "#6b7280";
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
    }}>
      {tag}
      {onRemove && <span onClick={onRemove} style={{ cursor: "pointer", opacity: 0.7, marginLeft: 2 }}>×</span>}
    </span>
  );
}

// ---- STATUS BADGE ----
function StatusBadge({ status, onChange, editable }) {
  const s = STATUS_OPTIONS.find(x => x.id === status) || STATUS_OPTIONS[0];
  if (!editable) return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
      {s.icon} {s.label}
    </span>
  );
  return (
    <select value={status} onChange={e => onChange(e.target.value)} style={{
      background: s.bg, color: s.color, border: `1.5px solid ${s.color}44`,
      borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
      outline: "none", appearance: "none", textAlign: "center"
    }}>
      {STATUS_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.icon} {opt.label}</option>)}
    </select>
  );
}

// ---- INLINE EDIT ----
function InlineEdit({ value, onChange, type = "text", style = {}, prefix = "" }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef();

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  if (!editing) return (
    <span onClick={() => setEditing(true)} style={{ cursor: "text", borderBottom: "1px dashed #cbd5e1", paddingBottom: 1, ...style }}>
      {prefix}{type === "number" ? formatSEK(val) : val}
    </span>
  );

  return (
    <input
      ref={ref} type={type} value={val}
      onChange={e => setVal(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
      onBlur={() => { setEditing(false); onChange(val); }}
      onKeyDown={e => { if (e.key === "Enter") { setEditing(false); onChange(val); } }}
      style={{
        border: "none", borderBottom: "2px solid #3b82f6", background: "transparent",
        outline: "none", fontSize: "inherit", fontFamily: "inherit", width: type === "number" ? 90 : 120,
        ...style
      }}
    />
  );
}

// ---- PROGRESS BAR ----
function ProgressBar({ value, max, color = "#3b82f6", height = 6 }) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100));
  return (
    <div style={{ background: "var(--border)", borderRadius: 99, height, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 99, transition: "width 0.6s ease" }} />
    </div>
  );
}

// ---- CARD ----
function Card({ children, style = {}, className = "" }) {
  return (
    <div style={{
      background: "var(--card)", borderRadius: 16, padding: "20px 24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
      border: "1px solid var(--border)", ...style
    }}>
      {children}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
// ============================================================
// LOCALSTORAGE HELPERS
// ============================================================
// TAG_META defines how each tag renders as a badge in Prognos
const FORECAST_TAG_META = {
  lon:       { label: "Lön",       icon: "💼", bg: "#dbeafe", fg: "#1d4ed8" },
  beredskap: { label: "Beredskap", icon: "🛡", bg: "#d1fae5", fg: "#059669" },
  nylon:     { label: "Ny lön",    icon: "📈", bg: "#eff6ff", fg: "#2563eb" },
  semester:  { label: "Semester",  icon: "🌴", bg: "#fef9c3", fg: "#92400e" },
  dubbel:    { label: "Dubbel",    icon: "⚡", bg: "#fef3c7", fg: "#b45309" },
};

const DEFAULT_BEREDSKAPYPES = [
  { key: "grundlon",          name: "Grundlön",                  desc: "Endast grundlön, ingen beredskap",             icon: "💼", color: "#94a3b8", amount: 27660, group: "bas",       readOnly: true, tags: ["lon"] },
  { key: "ny_grundlon",       name: "Ny grundlön",               desc: "Uppdaterad grundlön utan beredskap",          icon: "📈", color: "#2563eb", amount: 30000, group: "bas",       tags: ["lon", "nylon"] },
  { key: "semesterlön",       name: "Semesterlön",               desc: "Lön under semesterperiod",                    icon: "🌴", color: "#f59e0b", amount: 27660, group: "bas",       tags: ["lon", "semester"] },
  { key: "lon_full",          name: "Lön + Full Beredskap",      desc: "Grundlön + helg- och veckoberedskap",          icon: "🛡", color: "#10b981", amount: 34160, group: "enkel",     tags: ["lon", "beredskap"] },
  { key: "lon_halv",          name: "Lön + Halv Beredskap",      desc: "Grundlön + halv beredskap (vecka eller helg)", icon: "🌗", color: "#3b82f6", amount: 31160, group: "enkel",     tags: ["lon", "beredskap"] },
  { key: "lon_helg",          name: "Lön + Helg",                desc: "Grundlön + helgberedskap",                    icon: "🌅", color: "#8b5cf6", amount: 31660, group: "enkel",     tags: ["lon", "beredskap"] },
  { key: "nylon_full",        name: "Ny lön + Full Beredskap",   desc: "Ny lön + helg- och veckoberedskap",            icon: "🛡", color: "#059669", amount: 37000, group: "nylon",     tags: ["nylon", "beredskap"] },
  { key: "nylon_halv",        name: "Ny lön + Halv Beredskap",   desc: "Ny lön + halv beredskap",                     icon: "🌗", color: "#2563eb", amount: 34000, group: "nylon",     tags: ["nylon", "beredskap"] },
  { key: "nylon_helg",        name: "Ny lön + Helg",             desc: "Ny lön + helgberedskap",                      icon: "🌅", color: "#7c3aed", amount: 35000, group: "nylon",     tags: ["nylon", "beredskap"] },
  { key: "dubbel_full",       name: "Dubbel + Full Beredskap",   desc: "Dubbel beredskap – helg + vecka × 2",         icon: "⚡", color: "#f59e0b", amount: 40660, group: "dubbel",    tags: ["lon", "beredskap", "dubbel"] },
  { key: "dubbel_halv",       name: "Dubbel + Halv Beredskap",   desc: "Dubbel beredskap – halv",                     icon: "⚡", color: "#f97316", amount: 37660, group: "dubbel",    tags: ["lon", "beredskap", "dubbel"] },
  { key: "dubbel_helg",       name: "Dubbel + Helg",             desc: "Dubbel helgberedskap",                        icon: "🌟", color: "#ec4899", amount: 35660, group: "dubbel",    tags: ["lon", "beredskap", "dubbel"] },
  { key: "dubbel_nylon_full", name: "Dubbel Ny lön + Full",      desc: "Dubbel beredskap med ny lön – full",          icon: "⚡", color: "#a855f7", amount: 44000, group: "dubbel_ny", tags: ["nylon", "beredskap", "dubbel"] },
  { key: "dubbel_nylon_halv", name: "Dubbel Ny lön + Halv",      desc: "Dubbel beredskap med ny lön – halv",          icon: "⚡", color: "#6366f1", amount: 41000, group: "dubbel_ny", tags: ["nylon", "beredskap", "dubbel"] },
  { key: "dubbel_nylon_helg", name: "Dubbel Ny lön + Helg",      desc: "Dubbel beredskap med ny lön – helg",          icon: "🌟", color: "#0ea5e9", amount: 39000, group: "dubbel_ny", tags: ["nylon", "beredskap", "dubbel"] },
];

function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export default function App() {
  const [theme, setTheme] = useState(() => loadLS("theme", "light"));
  const [user, setUser] = useState(null);
  const [supabaseUser, setSupabaseUser] = useState(null); // auth.users record
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false); // true once session check is done
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Data state – all persisted to localStorage
  const [expenses, setExpenses] = useState(() => loadLS("expenses", INITIAL_EXPENSES));
  const [debts, setDebts] = useState(() => loadLS("debts", INITIAL_DEBTS));
  const [assets, setAssets] = useState(() => loadLS("assets", INITIAL_ASSETS));
  const [income, setIncome] = useState(() => loadLS("income", INITIAL_INCOME));
  const [beredskap, setBeredskap] = useState(() => loadLS("beredskap", INITIAL_BEREDSKAP));
  const [extraIncome, setExtraIncome] = useState(() => loadLS("extraIncome", INITIAL_EXTRA_INCOME));
  const [savingsAccounts, setSavingsAccounts] = useState(() => loadLS("savingsAccounts", INITIAL_SAVINGS_ACCOUNTS));
  const [users, setUsers] = useState(() => loadLS("users", INITIAL_USERS));
  const [goals, setGoals] = useState(() => loadLS("goals", INITIAL_GOALS));
  const [history, setHistory] = useState(() => loadLS("history", []));
  const [pageVisibility, setPageVisibility] = useState(() => loadLS("pageVisibility", {
    budget: true, income: true, debts: true, savings: true, goals: true, forecast: true, ai: true, history: true, calculator: true,
  }));
  const [monthlyHistory, setMonthlyHistory] = useState(() => loadLS("monthlyHistory", []));

  // ── UNDO SYSTEM ──────────────────────────────────────────────
  const [undoStack, setUndoStack] = useState([]);
  const [undoToast, setUndoToast] = useState(null); // { label }
  const undoToastTimer = useRef(null);

  function pushUndo(label) {
    const snapshot = { expenses, debts, goals, income, beredskap, extraIncome, savingsAccounts, monthlyHistory, monthSchedule };
    setUndoStack(s => [...s.slice(-19), { label, snapshot, ts: Date.now() }]);
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current);
    setUndoToast({ label });
    undoToastTimer.current = setTimeout(() => setUndoToast(null), 3500);
  }

  function applyUndo() {
    setUndoStack(s => {
      if (!s.length) return s;
      const last = s[s.length - 1];
      const { snapshot } = last;
      // Schedule state restoration outside the updater to avoid React batching issues
      setTimeout(() => {
        if (snapshot.expenses        !== undefined) setExpenses(snapshot.expenses);
        if (snapshot.debts           !== undefined) setDebts(snapshot.debts);
        if (snapshot.goals           !== undefined) setGoals(snapshot.goals);
        if (snapshot.income          !== undefined) setIncome(snapshot.income);
        if (snapshot.beredskap       !== undefined) setBeredskap(snapshot.beredskap);
        if (snapshot.extraIncome     !== undefined) setExtraIncome(snapshot.extraIncome);
        if (snapshot.savingsAccounts !== undefined) setSavingsAccounts(snapshot.savingsAccounts);
        if (snapshot.monthlyHistory  !== undefined) setMonthlyHistory(snapshot.monthlyHistory);
        if (snapshot.monthSchedule   !== undefined) setMonthSchedule(snapshot.monthSchedule);
        setUndoToast(null);
      }, 0);
      return s.slice(0, -1);
    });
  }
  const [futureSalaries, setFutureSalaries] = useState(() => loadLS("futureSalaries", []));
  const [monthSchedule, setMonthSchedule] = useState(() => loadLS("monthSchedule", {}));
  const [appTexts, setAppTexts] = useState(() => {
    const saved = loadLS("appTexts", {});
    const defaults = {
      appName: "EkonomiKollen",
      appTagline: "Din personliga ekonomiöversikt",
      appVersion: "v2.0 – Skandinavisk design",
      dashboardTitle: "Översikt",
      aiWelcome: "Hej! Jag är din AI-ekonomiassistent. Fråga mig vad som helst om din ekonomi – budget, skulder, sparande eller framtid.",
      aiPlaceholder: "Ställ en fråga om din ekonomi… (Enter för att skicka)",
      loginTitle: "Välkommen",
      loginSubtitle: "Logga in för att fortsätta",
      dashboardCards: { hero: true, salary: true, debts: true, goals: true, savings: true, spartips: true, wishes: true },
      beredskapRates: { "Full Beredskap": 34160, "Endast Vecka": 30160, "Endags Helg": 31660, "Endast Lön": 0, "Dubbel Beredskap": 40660, "Dubbel Helg": 35660, "Dubbel Vecka": 32660 },
      savingsHighThreshold: 10000,
      savingsHighRate: 40,
      savingsLowThreshold: 5000,
      savingsLowRate: 15,
    };
    const merged = { ...defaults, ...saved };
    // Migration: seed missing types from DEFAULT_BEREDSKAPYPES
    if (!merged.beredskapTypes || merged.beredskapTypes.length === 0) {
      merged.beredskapTypes = DEFAULT_BEREDSKAPYPES;
    } else {
      // Merge in any new default types that don't exist yet (by key)
      const existingKeys = new Set(merged.beredskapTypes.map(t => t.key));
      const missing = DEFAULT_BEREDSKAPYPES.filter(t => !existingKeys.has(t.key));
      if (missing.length > 0) {
        // Insert missing types in correct position relative to their group neighbours
        const result = [...merged.beredskapTypes];
        missing.forEach(newType => {
          const defaultIdx = DEFAULT_BEREDSKAPYPES.findIndex(t => t.key === newType.key);
          // Find the first default type after this one that already exists in result
          const insertBefore = DEFAULT_BEREDSKAPYPES.slice(defaultIdx + 1).find(t => existingKeys.has(t.key));
          const pos = insertBefore ? result.findIndex(t => t.key === insertBefore.key) : result.length;
          result.splice(pos, 0, newType);
          existingKeys.add(newType.key);
        });
        merged.beredskapTypes = result;
      }
    }
    return merged;
  });
  const [notifications, setNotifications] = useState([]);
  const [plannedExpenses, setPlannedExpenses] = useState(() => loadLS("plannedExpenses", []));
  const [recurringExpenses, setRecurringExpenses] = useState(() => loadLS("recurringExpenses", []));
  const [purchases, setPurchases] = useState(() => loadLS("purchases", []));

  const [aiMessages, setAiMessages] = useState(() => {
    const saved = loadLS("aiMessages", null);
    return saved || [{ role: "assistant", content: "Hej! Jag är din AI-ekonomiassistent. Fråga mig vad som helst om din ekonomi – budget, skulder, sparande eller framtid." }];
  });

  // Persist all data to localStorage on change
  useEffect(() => { saveLS("theme", theme); }, [theme]);
  useEffect(() => { saveLS("expenses", expenses); }, [expenses]);
  useEffect(() => { saveLS("debts", debts); }, [debts]);
  useEffect(() => { saveLS("assets", assets); }, [assets]);
  useEffect(() => { saveLS("income", income); }, [income]);
  useEffect(() => { saveLS("beredskap", beredskap); }, [beredskap]);
  useEffect(() => { saveLS("extraIncome", extraIncome); }, [extraIncome]);
  useEffect(() => { saveLS("savingsAccounts", savingsAccounts); }, [savingsAccounts]);
  useEffect(() => { saveLS("users", users); }, [users]);
  useEffect(() => { saveLS("goals", goals); }, [goals]);
  useEffect(() => { saveLS("history", history); }, [history]);
  useEffect(() => { saveLS("pageVisibility", pageVisibility); }, [pageVisibility]);
  useEffect(() => { saveLS("monthlyHistory", monthlyHistory); }, [monthlyHistory]);
  useEffect(() => { saveLS("futureSalaries", futureSalaries); }, [futureSalaries]);
  useEffect(() => { saveLS("monthSchedule", monthSchedule); }, [monthSchedule]);
  useEffect(() => { saveLS("appTexts", appTexts); }, [appTexts]);
  useEffect(() => { saveLS("plannedExpenses", plannedExpenses); }, [plannedExpenses]);
  useEffect(() => { saveLS("recurringExpenses", recurringExpenses); }, [recurringExpenses]);
  useEffect(() => { saveLS("purchases", purchases); }, [purchases]);
  const [wishes, setWishes] = useState(() => loadLS("wishes", []));
  const [categoryMeta, setCategoryMeta] = useState(() => loadLS("categoryMeta", {
    "Boende":          { icon: "🏠", color: "#3b82f6" },
    "Mat":             { icon: "🛒", color: "#f59e0b" },
    "Transport":       { icon: "🚌", color: "#06b6d4" },
    "Försäkring":      { icon: "🛡️", color: "#10b981" },
    "Prenumerationer": { icon: "📱", color: "#8b5cf6" },
    "Lån":             { icon: "💳", color: "#ef4444" },
    "Hälsa":           { icon: "❤️", color: "#ec4899" },
    "Nöje":            { icon: "🎮", color: "#f97316" },
    "Övrigt":          { icon: "📦", color: "#94a3b8" },
  }));
  useEffect(() => { saveLS("categoryMeta", categoryMeta); }, [categoryMeta]);
  useEffect(() => { saveLS("wishes", wishes); }, [wishes]);

  // ── RESTORE SESSION & CLOUD DATA ─────────────────────────────
  async function restoreUserSession(sessionUser) {
    setSupabaseUser(sessionUser);
    const profile = await loadProfile(sessionUser.id);
    if (profile) {
      setUser({ id: profile.user_id, username: profile.username || sessionUser.email, role: profile.role || "admin", displayName: profile.display_name || profile.username || sessionUser.email });
      if (profile.theme) setTheme(profile.theme);
    } else {
      const username = sessionUser.email?.split("@")[0] || "user";
      upsertProfile(sessionUser.id, { username, display_name: username, role: "admin", theme: "light" });
      setUser({ id: sessionUser.id, username, role: "admin", displayName: username });
    }
    const cloudData = await loadAllUserData(sessionUser.id);
    if (Object.keys(cloudData).length > 0) {
      if (cloudData.expenses) setExpenses(cloudData.expenses);
      if (cloudData.debts) setDebts(cloudData.debts);
      if (cloudData.assets) setAssets(cloudData.assets);
      if (cloudData.income) setIncome(cloudData.income);
      if (cloudData.beredskap) setBeredskap(cloudData.beredskap);
      if (cloudData.extraIncome) setExtraIncome(cloudData.extraIncome);
      if (cloudData.savingsAccounts) setSavingsAccounts(cloudData.savingsAccounts);
      if (cloudData.goals) setGoals(cloudData.goals);
      if (cloudData.history) setHistory(cloudData.history);
      if (cloudData.pageVisibility) setPageVisibility(cloudData.pageVisibility);
      if (cloudData.monthlyHistory) setMonthlyHistory(cloudData.monthlyHistory);
      if (cloudData.futureSalaries) setFutureSalaries(cloudData.futureSalaries);
      if (cloudData.monthSchedule) setMonthSchedule(cloudData.monthSchedule);
      if (cloudData.appTexts) setAppTexts(prev => ({ ...prev, ...cloudData.appTexts }));
      if (cloudData.plannedExpenses) setPlannedExpenses(cloudData.plannedExpenses);
      if (cloudData.recurringExpenses) setRecurringExpenses(cloudData.recurringExpenses);
      if (cloudData.purchases) setPurchases(cloudData.purchases);
      if (cloudData.wishes) setWishes(cloudData.wishes);
      if (cloudData.categoryMeta) setCategoryMeta(cloudData.categoryMeta);
      if (cloudData.aiMessages) setAiMessages(cloudData.aiMessages);
      if (cloudData.users) setUsers(cloudData.users);
    }
    setCloudLoaded(true);
  }

  // ── SUPABASE AUTH LISTENER ──────────────────────────────────
  useEffect(() => {
    // 1. Restore session from storage FIRST
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        restoreUserSession(session.user).then(() => setAuthReady(true));
      } else {
        setAuthReady(true);
      }
    });

    // 2. Listen for subsequent auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // already handled by getSession above
      if (session?.user) {
        restoreUserSession(session.user);
      } else {
        setSupabaseUser(null);
        setUser(null);
        setCloudLoaded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── REALTIME SYNC (live updates across devices) ─────────────
  const realtimeIgnoreRef = useRef({}); // keys we just saved ourselves
  const DATA_SETTERS = {
    expenses: setExpenses, debts: setDebts, assets: setAssets, income: setIncome,
    beredskap: setBeredskap, extraIncome: setExtraIncome, savingsAccounts: setSavingsAccounts,
    goals: setGoals, history: setHistory, pageVisibility: setPageVisibility,
    monthlyHistory: setMonthlyHistory, futureSalaries: setFutureSalaries,
    monthSchedule: setMonthSchedule, plannedExpenses: setPlannedExpenses,
    recurringExpenses: setRecurringExpenses,
    wishes: setWishes, categoryMeta: setCategoryMeta, aiMessages: setAiMessages, users: setUsers,
  };

  useEffect(() => {
    if (!supabaseUser) return;
    const channel = supabase
      .channel('user_data_sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_data',
        filter: `user_id=eq.${supabaseUser.id}`,
      }, (payload) => {
        const row = payload.new;
        if (!row || !row.data_key) return;
        // Skip if we just saved this key ourselves (within last 2s)
        if (realtimeIgnoreRef.current[row.data_key] && Date.now() - realtimeIgnoreRef.current[row.data_key] < 2000) return;
        const setter = DATA_SETTERS[row.data_key];
        if (setter) {
          if (row.data_key === 'appTexts') {
            setAppTexts(prev => ({ ...prev, ...row.data_value }));
          } else {
            setter(row.data_value);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabaseUser?.id]);

  const cloudSaveTimers = useRef({});
  function cloudSave(key, value) {
    if (!supabaseUser) return;
    if (cloudSaveTimers.current[key]) clearTimeout(cloudSaveTimers.current[key]);
    cloudSaveTimers.current[key] = setTimeout(() => {
      realtimeIgnoreRef.current[key] = Date.now(); // mark to skip our own echo
      saveUserData(supabaseUser.id, key, value);
    }, 800);
  }

  // Cloud-sync all data on changes (only after initial cloud load)
  useEffect(() => { if (cloudLoaded) cloudSave("expenses", expenses); }, [expenses, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("debts", debts); }, [debts, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("assets", assets); }, [assets, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("income", income); }, [income, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("beredskap", beredskap); }, [beredskap, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("extraIncome", extraIncome); }, [extraIncome, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("savingsAccounts", savingsAccounts); }, [savingsAccounts, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("goals", goals); }, [goals, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("history", history); }, [history, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("pageVisibility", pageVisibility); }, [pageVisibility, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("monthlyHistory", monthlyHistory); }, [monthlyHistory, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("futureSalaries", futureSalaries); }, [futureSalaries, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("monthSchedule", monthSchedule); }, [monthSchedule, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("appTexts", appTexts); }, [appTexts, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("plannedExpenses", plannedExpenses); }, [plannedExpenses, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("recurringExpenses", recurringExpenses); }, [recurringExpenses, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("wishes", wishes); }, [wishes, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("categoryMeta", categoryMeta); }, [categoryMeta, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("aiMessages", aiMessages); }, [aiMessages, cloudLoaded]);
  useEffect(() => { if (cloudLoaded) cloudSave("users", users); }, [users, cloudLoaded]);
  useEffect(() => { if (cloudLoaded && supabaseUser) upsertProfile(supabaseUser.id, { theme }); }, [theme, cloudLoaded]);


  const promoteRef = useRef([]);
  useEffect(() => {
    function promote() {
      const now = new Date();
      // Step 1: pull out due items from plannedExpenses
      setPlannedExpenses(prev => {
        const due = prev.filter(p => p.dueDate && new Date(p.dueDate) <= now);
        if (!due.length) return prev;
        promoteRef.current = due; // stage for step 2
        return prev.filter(p => !due.includes(p));
      });
      // Step 2: add staged items to expenses (runs after step 1 commits)
      setTimeout(() => {
        if (!promoteRef.current.length) return;
        const due = promoteRef.current;
        promoteRef.current = [];
        setExpenses(es => {
          const maxOrd = es.length ? Math.max(...es.map(e => e.order)) : 0;
          return [...es, ...due.map((p, idx) => ({
            id: Date.now() + idx, service: p.service, cost: p.cost,
            category: p.category, status: "unpaid", tags: [],
            order: maxOrd + idx + 1, debtLink: null, dueDate: "", temporary: true,
          }))];
        });
      }, 0);
    }
    promote();
    const t = setInterval(promote, 60000);
    return () => clearInterval(t);
  }, []);

  // Computed values

  const now_d = new Date();
  // Salary month key (before 25th belongs to previous salary month)
  const currentMonthKey = getSalaryMonthKeyForDate(now_d);
  const baseSalaryIncome = income.find(i => i.type === "salary")?.amount || 0;
  const baseOtherIncome = income.filter(i => i.type !== "salary").reduce((s, i) => s + i.amount, 0);

  // Resolve effective salary for a given month using new beredskapTypes system
  function resolveMonthSalary(monthKey) {
    // Check for manual amount override first
    const override = monthSchedule[monthKey + "_amount"];
    if (override != null && override !== "") return Number(override);
    const schedType = monthSchedule[monthKey];
    if (!schedType) return baseSalaryIncome;
    const types = appTexts.beredskapTypes || [];
    const found = types.find(t => t.key === schedType);
    if (found) return Number(found.amount);
    // legacy fallback
    const rates = appTexts.beredskapRates || {};
    if (schedType === "Endast Lön") return baseSalaryIncome;
    const total = rates[schedType];
    if (total != null) return Number(total);
    return baseSalaryIncome;
  }

  const effectiveSalary = resolveMonthSalary(currentMonthKey);
  const totalIncome = effectiveSalary + baseOtherIncome
    + extraIncome.filter(e => e.month === currentMonthKey).reduce((s, e) => s + e.amount, 0);
  // Exclude expenses linked to fully paid-off debts (remaining === 0) — freeing up that money
  // Also exclude hidden (eye-toggled) expenses
  const paidOffDebtIds = new Set(debts.filter(d => d.remaining <= 0).map(d => d.id));
  const totalExpenses = expenses.reduce((s, e) => {
    if (e.hidden) return s;
    if (e.skipMonths && e.skipMonths.includes(currentMonthKey)) return s;
    if (e.debtLink && paidOffDebtIds.has(e.debtLink)) return s;
    return s + e.cost;
  }, 0);

  // Planned costs should affect the salary month they belong to (before 25th => previous salary)
  const plannedThisMonth = plannedExpenses.filter(p => {
    if (!p.dueDate) return false;
    return getSalaryMonthKeyForDate(p.dueDate) === currentMonthKey;
  }).reduce((s, p) => s + p.cost, 0);
  // Recurring expenses that have started by this salary period
  const recurringThisMonth = recurringExpenses.filter(r => {
    if (!r.startDate) return false;
    return getSalaryMonthKeyForDate(r.startDate) <= currentMonthKey;
  }).filter(r => !r.hidden).reduce((s, r) => s + r.cost, 0);
  const leftover = totalIncome - totalExpenses - plannedThisMonth - recurringThisMonth;
  const totalDebts = debts.reduce((s, d) => s + d.remaining, 0);
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0) + savingsAccounts.reduce((s, sa) => s + sa.balance, 0);
  const netWorth = totalAssets;
  const healthScore = calcFinancialHealth(totalIncome, expenses, debts, assets);
  const nextSalary = getNextSalary();
  const daysToSalary = daysUntil(nextSalary);

  // CSS vars based on theme
  const THEMES = {
    light: {
      "--bg": "#f5f6fa", "--bg2": "#eef0f6", "--card": "#ffffff",
      "--border": "#e4e7ef", "--text": "#1a1d2e", "--text2": "#6b7280",
      "--accent": "#3b82f6", "--hover": "#f0f4ff"
    },
    dark: {
      "--bg": "#1e1f22", "--bg2": "#2b2d31", "--card": "#313338",
      "--border": "#3b3d44", "--text": "#dbdee1", "--text2": "#949ba4",
      "--accent": "#3b82f6", "--hover": "#35373c"
    },
    bee: {
      "--bg": "#fffbeb", "--bg2": "#fef3c7", "--card": "#ffffff",
      "--border": "#fde68a", "--text": "#1c1917", "--text2": "#78716c",
      "--accent": "#f59e0b", "--hover": "#fef9c3"
    },
    pink: {
      "--bg": "#fdf2f8", "--bg2": "#fce7f3", "--card": "#ffffff",
      "--border": "#fbcfe8", "--text": "#1a1a2e", "--text2": "#9d174d",
      "--accent": "#ec4899", "--hover": "#fdf4ff"
    },
  };
  const cssVars = THEMES[theme] || THEMES.light;

  useEffect(() => {
    // Generate notifications
    const notifs = [];
    const today = new Date();
    expenses.forEach(e => {
      const d = daysUntil(e.dueDate);
      if (d < 0 && e.status === "unpaid") notifs.push({ type: "error", text: `${e.service} är förfallen med ${Math.abs(d)} dagar!` });
      else if (d <= 3 && d >= 0 && e.status === "unpaid") notifs.push({ type: "warning", text: `${e.service} förfaller om ${d} dagar` });
    });
    if (daysToSalary <= 5) notifs.push({ type: "info", text: `Lön om ${daysToSalary} dagar! (${nextSalary.toLocaleDateString("sv-SE")})` });
    setNotifications(notifs);
  }, [expenses]);

  function addToHistory(action, oldVal, newVal) {
    setHistory(h => [{ action, oldVal, newVal, time: new Date().toLocaleTimeString("sv-SE") }, ...h.slice(0, 49)]);
  }

  function updateExpense(id, field, value) {
    setExpenses(es => es.map(e => e.id === id ? { ...e, [field]: value } : e));
  }

  function updateDebt(id, field, value) {
    setDebts(ds => ds.map(d => d.id === id ? { ...d, [field]: value } : d));
  }

  // Show loading spinner while restoring session
  if (!authReady) return (
    <div style={{ ...cssVars, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 16, opacity: 0.7 }}>Laddar...</div>
      </div>
    </div>
  );

  if (!user) return <LoginPage onLogin={(u) => setUser(u)} users={users} inviteCodes={INVITE_CODES} setUsers={setUsers} theme={theme} cssVars={cssVars} supabaseUser={supabaseUser} />;

  const canEdit = user.role === "admin" || user.role === "editor";

  return (
    <div style={{ ...cssVars, minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }
        select, input { font-family: inherit; color: var(--text); }
        button { font-family: inherit; cursor: pointer; }
        .ai-font { font-family: 'Aptos', 'Segoe UI Variable', 'Segoe UI', 'Gill Sans', sans-serif !important; }
        .row-hover:hover { background: var(--hover) !important; transition: background 0.15s; }
        .nav-item { padding: 9px 14px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500; transition: all 0.15s; color: var(--text2); }
        .nav-item:hover { background: var(--hover); color: var(--text); }
        .nav-item.active { background: #3b82f620; color: #3b82f6; font-weight: 600; }
        .btn { padding: 8px 18px; border-radius: 10px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .btn-primary { background: #3b82f6; color: #fff; }
        .btn-primary:hover { background: #2563eb; }
        .btn-ghost { background: var(--border); color: var(--text2); }
        .btn-ghost:hover { background: var(--bg2); color: var(--text); }
        .btn-danger { background: #fee2e2; color: #ef4444; }
        .btn-danger:hover { background: #fecaca; }
        input[type="text"], input[type="number"], input[type="password"], select, textarea {
          background: var(--bg2); border: 1.5px solid var(--border); border-radius: 10px;
          padding: 8px 12px; font-size: 14px; outline: none; width: 100%; transition: border-color 0.15s;
        }
        input:focus, select:focus, textarea:focus { border-color: #3b82f6; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .modal { background: var(--card); border-radius: 20px; padding: 32px; min-width: 360px; max-width: 520px; width: 100%; box-shadow: 0 24px 48px rgba(0,0,0,0.15); border: 1px solid var(--border); max-height: 90vh; overflow-y: auto; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes streakPop { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        .streak-pop { animation: streakPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes milestoneIn { 0%{transform:translateY(-12px) scale(0.9);opacity:0} 100%{transform:translateY(0) scale(1);opacity:1} }
        .milestone-in { animation: milestoneIn 0.4s ease forwards; }
        @keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1} 100%{transform:translateY(60px) rotate(360deg);opacity:0} }
        .confetti-piece { animation: confettiFall 1.2s ease-in forwards; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .fadeIn { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .budget-max-width { max-width: 760px; width: 100%; }
        .page-content-inner { max-width: 1400px; width: 100%; margin: 0 auto; }
        table { border-collapse: collapse; width: 100%; }
        th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text2); padding: 8px 12px; border-bottom: 1.5px solid var(--border); }
        td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 14px; vertical-align: middle; }

        .mobile-bottom-nav {
          display: none;
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
          background: var(--card); border-top: 1px solid var(--border);
          padding: 6px 2px calc(6px + env(safe-area-inset-bottom));
          overflow-x: auto; -webkit-overflow-scrolling: touch;
        }
        .mobile-bottom-nav::-webkit-scrollbar { display: none; }
        .mobile-bottom-nav-inner { display: flex; align-items: stretch; min-width: max-content; padding: 0 4px; }
        .mob-nav-item {
          display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 2px; padding: 5px 8px; border-radius: 10px; border: none;
          background: transparent; cursor: pointer; font-family: inherit;
          color: var(--text2); font-size: 9px; font-weight: 600; min-width: 52px; transition: all 0.15s;
        }
        .mob-nav-item.active { color: #3b82f6; background: #3b82f610; }
        .mob-nav-item .mob-icon { font-size: 17px; line-height: 1; }

        @media (max-width: 768px) {
          .mobile-bottom-nav { display: block; }
          .sidebar-desktop { display: none !important; }
          .main-topbar { padding: 12px 16px 0 !important; }
          .main-topbar-title { font-size: 18px !important; }
          .main-topbar-sub { display: none !important; }
          .main-page-wrap { margin-left: 0 !important; }
          .main-page-content { padding: 12px 16px 100px !important; }
          .dash-row1 { grid-template-columns: 1fr !important; }
          .dash-row2 { grid-template-columns: 1fr !important; }
          .dash-summary { grid-template-columns: 1fr 1fr !important; }
          .settings-grid { grid-template-columns: 1fr !important; }
          .admin-grid { grid-template-columns: 1fr !important; }
          .modal { padding: 20px 16px !important; min-width: unset !important; }
          .hero-amount { font-size: 42px !important; }
          .salary-days-num { font-size: 52px !important; }
          td, th { padding: 7px 8px !important; font-size: 12px !important; }
          .budget-max-width { max-width: 100% !important; }
          .forecast-wrap { overflow-x: auto; }
        }
        @media (max-width: 480px) {
          .dash-summary { grid-template-columns: 1fr !important; }
          .hero-amount { font-size: 34px !important; }
        }
        @media (min-width: 1600px) {
          .dash-row1 { grid-template-columns: 1fr 380px !important; }
          .dash-row2 { grid-template-columns: 1fr 1fr 1fr !important; }
          .hero-amount { font-size: 56px !important; }
          .salary-days-num { font-size: 60px !important; }
        }
      `}</style>

      {/* SIDEBAR */}
      <Sidebar page={page} setPage={setPage} user={user} setUser={setUser} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} theme={theme} setTheme={setTheme} notifications={notifications} pageVisibility={pageVisibility} appTexts={appTexts} />

      {/* MAIN CONTENT */}
      <div className="main-page-wrap" style={{ flex: 1, overflow: "auto", marginLeft: sidebarOpen ? 260 : 0, transition: "margin-left 0.3s ease" }}>
        {/* TOP BAR */}
        <div className="main-topbar" style={{ padding: "16px 32px 0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost" style={{ padding: "6px 10px" }}>☰</button>}
            <div>
              <div className="main-topbar-title" style={{ fontSize: 22, fontWeight: 700 }}>{PAGE_LABELS[page] || page}</div>
              <div className="main-topbar-sub" style={{ fontSize: 13, color: "var(--text2)" }}>Senast uppdaterad: {new Date().toLocaleString("sv-SE")}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600 }}>
              {user.role === "admin" ? "👑" : user.role === "editor" ? "✏️" : "👁️"} {user.username}
            </div>
          </div>
        </div>

        <div className="main-page-content fadeIn" style={{ padding: "16px 32px 40px" }}><div className="page-content-inner">
          {page === "dashboard" && <DashboardPage totalIncome={totalIncome} totalExpenses={totalExpenses} leftover={leftover} totalDebts={totalDebts} netWorth={netWorth} healthScore={healthScore} daysToSalary={daysToSalary} nextSalary={nextSalary} debts={debts} expenses={expenses} savings={savingsAccounts} goals={goals} history={history} wishes={wishes} setWishes={setWishes} user={user} appTexts={appTexts} />}
          {page === "budget" && <BudgetPage expenses={expenses} setExpenses={setExpenses} canEdit={canEdit} addToHistory={addToHistory} debts={debts} setDebts={setDebts} plannedExpenses={plannedExpenses} setPlannedExpenses={setPlannedExpenses} categoryMeta={categoryMeta} setCategoryMeta={setCategoryMeta} pushUndo={pushUndo} recurringExpenses={recurringExpenses} setRecurringExpenses={setRecurringExpenses} />}
          {page === "income" && <IncomePage income={income} setIncome={setIncome} extraIncome={extraIncome} setExtraIncome={setExtraIncome} beredskap={beredskap} setBeredskap={setBeredskap} canEdit={canEdit} futureSalaries={futureSalaries} setFutureSalaries={setFutureSalaries} pushUndo={pushUndo} monthSchedule={monthSchedule} setMonthSchedule={setMonthSchedule} appTexts={appTexts} />}
          {page === "debts" && <DebtsPage debts={debts} setDebts={setDebts} canEdit={canEdit} updateDebt={updateDebt} pushUndo={pushUndo} expenses={expenses} />}
          {page === "savings" && <SavingsPage savingsAccounts={savingsAccounts} setSavingsAccounts={setSavingsAccounts} assets={assets} setAssets={setAssets} canEdit={canEdit} pushUndo={pushUndo} />}
          {page === "goals" && <GoalsPage goals={goals} setGoals={setGoals} canEdit={canEdit} pushUndo={pushUndo} />}
          {page === "forecast" && <ForecastPage income={income} expenses={expenses} debts={debts} extraIncome={extraIncome} beredskap={beredskap} futureSalaries={futureSalaries} plannedExpenses={plannedExpenses} monthSchedule={monthSchedule} appTexts={appTexts} recurringExpenses={recurringExpenses} />}
          {page === "ai" && <AIPage messages={aiMessages} setMessages={setAiMessages} income={totalIncome} expenses={totalExpenses} debts={totalDebts} netWorth={netWorth} healthScore={healthScore} leftover={leftover} allDebts={debts} allExpenses={expenses} appTexts={appTexts} setPage={setPage} goals={goals} />}
          {page === "history" && <MonthlyHistoryPage monthlyHistory={monthlyHistory} setMonthlyHistory={setMonthlyHistory} expenses={expenses} setExpenses={setExpenses} totalIncome={totalIncome} totalExpenses={totalExpenses} leftover={leftover} debts={debts} pushUndo={pushUndo} />}
          {page === "profile" && <ProfilePage user={user} setUser={setUser} users={users} setUsers={setUsers} theme={theme} setTheme={setTheme} />}
          {page === "calculator" && <CalculatorPage />}
          {page === "admin" && user.role === "admin" && <AdminPage users={users} setUsers={setUsers} expenses={expenses} setExpenses={setExpenses} history={history} pageVisibility={pageVisibility} setPageVisibility={setPageVisibility} appTexts={appTexts} setAppTexts={setAppTexts} />}
        </div></div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <MobileBottomNav page={page} setPage={setPage} user={user} pageVisibility={pageVisibility} setUser={setUser} />

      {/* ══ UNDO TOAST ══ */}
      {undoToast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: "#1e1f22", color: "#fff", borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
          <span>↩ {undoToast.label} ändrat</span>
          <button onClick={applyUndo} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Ångra
          </button>
          <button onClick={() => setUndoToast(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16, padding: "0 2px" }}>✕</button>
        </div>
      )}
    </div>
  );
}

const PAGE_LABELS = {
  dashboard: "Översikt",
  budget: "Budget",
  income: "Inkomster",
  debts: "Skulder",
  savings: "Sparande",
  goals: "Mål",
  forecast: "Prognos",
  ai: "AI-assistent",
  history: "Månadshistorik",
  profile: "Min profil",
  calculator: "Kalkylator",
  admin: "Adminpanel",
};

// ============================================================
// LOGIN PAGE
// ============================================================
function LoginPage({ onLogin, users, inviteCodes, setUsers, theme, cssVars, supabaseUser }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(() => loadLS("rememberUser", ""));
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => !!loadLS("rememberUser", ""));
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  async function handleLogin() {
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError("Felaktigt e-post eller lösenord.");
    } else {
      if (rememberMe) saveLS("rememberUser", email);
      else saveLS("rememberUser", "");
    }
  }

  async function handleRegister() {
    setError(""); setLoading(true);
    const { error: err } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccessMsg("Konto skapat! Du är nu inloggad.");
    }
  }

  // Label fix: "Användarnamn" -> "E-post"
  const usernameLabel = "E-post";
  const usernamePlaceholder = "din@email.com";


  return (
    <div style={{ ...cssVars, minHeight: "100vh", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, button { font-family: 'DM Sans', sans-serif; }
        .login-input {
          width: 100%; background: #f7f8fa; border: 1.5px solid #e8eaed;
          border-radius: 12px; padding: 13px 16px; font-size: 15px; color: #1a1a2e;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-input:focus { border-color: #1a5c45; box-shadow: 0 0 0 3px rgba(26,92,69,0.1); background: #fff; }
        .login-input::placeholder { color: #b0b5bf; }
        .login-btn-primary {
          width: 100%; background: #1a5c45; color: #fff; border: none;
          border-radius: 12px; padding: 14px; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
          letter-spacing: 0.01em;
        }
        .login-btn-primary:hover { background: #145038; box-shadow: 0 4px 16px rgba(26,92,69,0.3); transform: translateY(-1px); }
        .login-btn-primary:active { transform: translateY(0); }
        .login-btn-secondary {
          width: 100%; background: transparent; color: #1a5c45; border: 1.5px solid #1a5c45;
          border-radius: 12px; padding: 13px; font-size: 15px; font-weight: 700;
          cursor: pointer; transition: all 0.2s;
        }
        .login-btn-secondary:hover { background: #1a5c4510; }
        .tab-pill { flex: 1; padding: 9px; border-radius: 9px; border: none; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s; letter-spacing: 0.01em; }
        .login-card { background: #fff; border-radius: 28px; overflow: hidden; display: flex; box-shadow: 0 24px 64px rgba(0,0,0,0.12); max-width: 900px; width: 100%; min-height: 560px; }
        @keyframes floatUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .login-anim { animation: floatUp 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes shimmer { 0%,100% { opacity:0.6 } 50% { opacity:1 } }
        .stat-card { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 14px; padding: 14px 18px; backdrop-filter: blur(8px); }
        @media (max-width: 640px) { .login-panel-right { display: none !important; } .login-card { max-width: 420px; } }
      `}</style>

      <div className="login-card">
        {/* ── LEFT: Form panel ── */}
        <div style={{ flex: "0 0 420px", padding: "44px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* Logo */}
          <div className="login-anim" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #1a5c45, #27a06e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💰</div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.02em" }}>EkonomiKollen</span>
          </div>

          {/* Heading */}
          <div className="login-anim" style={{ animationDelay: "0.05s", marginBottom: 28 }}>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, color: "#1a1a2e", letterSpacing: "-0.03em", lineHeight: 1.15, marginBottom: 8 }}>
              {mode === "login" ? "Välkommen\ntillbaka! 👋" : "Skapa\nkonto ✨"}
            </h1>
            <p style={{ color: "#8a909c", fontSize: 14, lineHeight: 1.5 }}>
              {mode === "login" ? "Logga in med din e-post." : "Skapa ett nytt konto med e-post och lösenord."}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="login-anim" style={{ animationDelay: "0.08s", display: "flex", gap: 6, background: "#f0f2f5", borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {["login", "register"].map(m => (
              <button key={m} className="tab-pill" onClick={() => { setMode(m); setError(""); }}
                style={{ background: mode === m ? "#1a5c45" : "transparent", color: mode === m ? "#fff" : "#8a909c" }}>
                {m === "login" ? "Logga in" : "Registrera"}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="login-anim" style={{ animationDelay: "0.12s", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>{usernameLabel}</label>
              <input className="login-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={usernamePlaceholder} />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>Lösenord</label>
                {mode === "login" && <span style={{ fontSize: 12, color: "#1a5c45", fontWeight: 600, cursor: "pointer" }}>Glömt lösenord?</span>}
              </div>
              <div style={{ position: "relative" }}>
                <input className="login-input" type={showPass ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleRegister())}
                  placeholder="••••••••" style={{ paddingRight: 44 }} />
                <button onClick={() => setShowPass(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#8a909c", padding: 4 }}>
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* No invite code needed for cloud registration */}

            {mode === "login" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => setRememberMe(v => !v)}
                  style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${rememberMe ? "#1a5c45" : "#d1d5db"}`, background: rememberMe ? "#1a5c45" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}>
                  {rememberMe && <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>✓</span>}
                </button>
                <span style={{ fontSize: 13, color: "#8a909c", cursor: "pointer", userSelect: "none" }} onClick={() => setRememberMe(v => !v)}>Kom ihåg mig</span>
              </div>
            )}

            {error && (
              <div style={{ background: "#fef2f2", color: "#dc2626", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚠️</span> {error}
              </div>
            )}

            {successMsg && (
              <div style={{ background: "#d1fae5", color: "#065f46", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>✅</span> {successMsg}
              </div>
            )}

            <button className="login-btn-primary" onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading}>
              {loading ? "Laddar..." : mode === "login" ? "Logga in →" : "Skapa konto →"}
            </button>
          </div>

          <p className="login-anim" style={{ animationDelay: "0.2s", marginTop: 28, fontSize: 12, color: "#b0b5bf", textAlign: "center", lineHeight: 1.6 }}>
            Genom att logga in godkänner du våra <span style={{ color: "#1a5c45", cursor: "pointer" }}>användarvillkor</span> och <span style={{ color: "#1a5c45", cursor: "pointer" }}>integritetspolicy</span>.
          </p>
        </div>

        {/* ── RIGHT: Visual panel ── */}
        <div className="login-panel-right" style={{ flex: 1, background: "linear-gradient(145deg, #0d3d2b 0%, #1a5c45 45%, #27a06e 100%)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 36 }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", top: 40, right: 40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
          <div style={{ position: "absolute", bottom: 120, left: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />

          {/* Big emoji graphic */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -58%)", fontSize: 110, filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.3))", animation: "shimmer 3s ease-in-out infinite" }}>
            💹
          </div>

          {/* Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative", zIndex: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Din ekonomi, ett ögonkast</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { emoji: "📊", label: "Budget", value: "Full kontroll" },
                { emoji: "🎯", label: "Mål", value: "Nå dina drömmar" },
                { emoji: "💳", label: "Skulder", value: "Smart avbetalning" },
                { emoji: "📈", label: "Prognos", value: "Planera framåt" },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{s.emoji}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: "0.02em" }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MOBILE BOTTOM NAV
// ============================================================
function MobileBottomNav({ page, setPage, user, pageVisibility, setUser }) {
  const allItems = [
    { id: "dashboard", icon: "🏠", label: "Hem" },
    { id: "budget",    icon: "💳", label: "Budget" },
    { id: "income",    icon: "💰", label: "Inkomst" },
    { id: "debts",     icon: "📉", label: "Skulder" },
    { id: "savings",   icon: "🏦", label: "Spar" },
    { id: "goals",     icon: "🎯", label: "Mål" },
    { id: "forecast",  icon: "📊", label: "Prognos" },
    { id: "history",   icon: "📅", label: "Historik" },
    { id: "calculator",icon: "🧮", label: "Kalkyl" },
    { id: "ai",        icon: "🤖", label: "AI" },
  ];
  if (user?.role === "admin") allItems.push({ id: "admin", icon: "⚙️", label: "Admin" });
  allItems.push({ id: "profile", icon: "👤", label: "Profil" });

  const items = allItems.filter(i => i.id === "dashboard" || i.id === "profile" || i.id === "admin" || pageVisibility?.[i.id] !== false);

  return (
    <nav className="mobile-bottom-nav">
      <div className="mobile-bottom-nav-inner">
        {items.map(item => (
          <button key={item.id} className={`mob-nav-item${page === item.id ? " active" : ""}`} onClick={() => setPage(item.id)}>
            <span className="mob-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
function Sidebar({ page, setPage, user, setUser, sidebarOpen, setSidebarOpen, theme, setTheme, notifications, pageVisibility, appTexts = {} }) {
  const allNavItems = [
    { id: "dashboard", icon: "🏠", label: "Översikt", alwaysShow: true },
    { id: "budget", icon: "💳", label: "Budget" },
    { id: "income", icon: "💰", label: "Inkomster" },
    { id: "debts", icon: "📉", label: "Skulder" },
    { id: "savings", icon: "🏦", label: "Sparande" },
    { id: "goals", icon: "🎯", label: "Mål" },
    { id: "forecast", icon: "📊", label: "Prognos" },
    { id: "history", icon: "📅", label: "Månadshistorik" },
    { id: "calculator", icon: "🧮", label: "Kalkylator" },
    { id: "ai", icon: "🤖", label: "AI-assistent" },
  ];
  const navItems = allNavItems.filter(item => item.alwaysShow || pageVisibility[item.id] !== false);
  if (user.role === "admin") navItems.push({ id: "admin", icon: "⚙️", label: "Adminpanel", alwaysShow: true });
  navItems.push({ id: "profile", icon: "👤", label: "Min profil", alwaysShow: true });

  if (!sidebarOpen) return null;

  return (
    <div className="sidebar-desktop" style={{
      position: "fixed", left: 0, top: 0, bottom: 0, width: 260,
      background: "var(--card)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", padding: "24px 16px", zIndex: 50,
      overflow: "auto"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, paddingLeft: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em" }}>💰 {appTexts.appName || "EkonomiKollen"}</div>
          <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>{appTexts.appVersion || "v2.0 – Skandinavisk design"}</div>
        </div>
        <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 18, padding: 4 }}>✕</button>
      </div>

      <div style={{ flex: 1 }}>
        {navItems.map(item => (
          <div key={item.id} className={`nav-item${page === item.id ? " active" : ""}`} onClick={() => setPage(item.id)}>
            <span style={{ fontSize: 16, width: 20, textAlign: "center", display: "block" }}>{item.icon}</span>
            {item.label}
            {item.id === "ai" && <span style={{ marginLeft: "auto", background: "#3b82f620", color: "#3b82f6", borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>AI</span>}
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 16 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[{id:"light",label:"☀"},{id:"dark",label:"◑"},{id:"bee",label:"🐝"},{id:"pink",label:"🌸"}].map(t => (
            <button key={t.id} onClick={() => setTheme(t.id)} className="btn" style={{ flex: 1, padding: "6px 0", fontSize: 13, background: theme === t.id ? "#3b82f6" : "var(--bg2)", color: theme === t.id ? "#fff" : "var(--text2)", border: "none", borderRadius: 8 }}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={async () => { saveLS("sessionUserId", null); await supabase.auth.signOut(); setUser(null); }} style={{ width: "100%", background: "var(--bg2)", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>
          ← Logga ut
        </button>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD PAGE
// ============================================================
// DASHBOARD PAGE
// ============================================================
const PEPTALKS = [
  { condition: (l) => l > 5000,  msg: "Du är i full kontroll — så här bygger man en stark ekonomi. 🚀" },
  { condition: (l) => l > 2000,  msg: "Bra marginal! Varje krona du sparar idag är frihet imorgon. 💪" },
  { condition: (l) => l > 0,     msg: "Du håller dig på rätt spår. Fortsätt — det lönar sig! 🌱" },
  { condition: (l) => l === 0,   msg: "Precis på nollan — du hanterar din ekonomi, och det räknas. ⭐" },
  { condition: (l) => l < 0,     msg: "En tuff månad gör dig starkare. Du ser det, du hanterar det. 🔥" },
];


// ============================================================
// WISHES WIDGET — Advanced with inline editing, links, priority
// ============================================================

const WISH_PRIORITIES = [
  { id: "none",   label: "Ingen",  emoji: "–",  color: "#94a3b8", bg: "#f1f5f9" },
  { id: "high",   label: "Hög",    emoji: "🔥", color: "#ef4444", bg: "#fee2e2" },
  { id: "medium", label: "Medel",  emoji: "⭐", color: "#f59e0b", bg: "#fef3c7" },
  { id: "low",    label: "Låg",    emoji: "💭", color: "#6b7280", bg: "#f3f4f6" },
];

const WISH_CATEGORIES = [
  { id: "none",      label: "Ingen",      emoji: "–"  },
  { id: "köp",      label: "Köp",       emoji: "🛍️" },
  { id: "upplevelse", label: "Upplevelse", emoji: "🎉" },
  { id: "resa",     label: "Resa",      emoji: "✈️" },
  { id: "hem",      label: "Hem",       emoji: "🏠" },
  { id: "övrigt",   label: "Övrigt",    emoji: "💡" },
];

// Detect URLs in text and render them as clickable links
function RenderTextWithLinks({ text, done }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <span style={{ textDecoration: done ? "line-through" : "none", wordBreak: "break-word" }}>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          let display = part;
          try {
            const u = new URL(part);
            display = u.hostname.replace("www.", "") + (u.pathname.length > 1 ? "…" : "");
          } catch {}
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                color: "#3b82f6", textDecoration: "underline", fontWeight: 600,
                background: "#3b82f610", borderRadius: 4, padding: "0 4px",
                fontSize: "0.92em", cursor: "pointer", display: "inline-flex",
                alignItems: "center", gap: 3
              }}>
              🔗 {display}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// Inline-editable wish row
function WishRow({ w, setWishes }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(w.text);
  const [editNote, setEditNote] = useState(w.note || "");
  const [editLink, setEditLink] = useState(w.link || "");
  const [editPrice, setEditPrice] = useState(w.price || "");
  const [editPriority, setEditPriority] = useState(w.priority || "none");
  const [editCategory, setEditCategory] = useState(w.category || "none");
  const inputRef = useRef();

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  function saveEdit() {
    if (!editText.trim()) return;
    setWishes(ws => ws.map(x => x.id === w.id ? {
      ...x,
      text: editText.trim(),
      note: editNote.trim(),
      link: editLink.trim(),
      price: editPrice ? Number(editPrice) : null,
      priority: editPriority,
      category: editCategory,
    } : x));
    setEditing(false);
  }

  function cancelEdit() {
    setEditText(w.text);
    setEditNote(w.note || "");
    setEditLink(w.link || "");
    setEditPrice(w.price || "");
    setEditPriority(w.priority || "none");
    setEditCategory(w.category || "none");
    setEditing(false);
  }

  const prio = WISH_PRIORITIES.find(p => p.id === (w.priority || "none")) || WISH_PRIORITIES[0];
  const cat  = WISH_CATEGORIES.find(c => c.id === (w.category || "none")) || WISH_CATEGORIES[0];
  const hasPrio = prio.id !== "none";
  const hasCat  = cat.id !== "none";

  if (editing) {
    return (
      <div style={{
        borderRadius: 14, border: "2px solid #ec4899", background: "var(--card)",
        padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10
      }}>
        {/* Text */}
        <input ref={inputRef} value={editText} onChange={e => setEditText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) saveEdit(); if (e.key === "Escape") cancelEdit(); }}
          placeholder="Önskemål…"
          style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%" }} />

        {/* Note */}
        <input value={editNote} onChange={e => setEditNote(e.target.value)}
          placeholder="Anteckning (valfri)…"
          style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "7px 12px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%" }} />

        {/* Link + Price row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input value={editLink} onChange={e => setEditLink(e.target.value)}
            placeholder="🔗 Länk (https://…)"
            style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "7px 12px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%" }} />
          <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
            placeholder="Pris kr"
            style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "7px 12px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none", width: 100 }} />
        </div>

        {/* Priority + Category */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Prioritet</div>
            <div style={{ display: "flex", gap: 5 }}>
              {WISH_PRIORITIES.map(p => (
                <button key={p.id} onClick={() => setEditPriority(p.id)}
                  style={{ flex: 1, border: editPriority === p.id ? `2px solid ${p.color}` : "2px solid transparent", background: editPriority === p.id ? p.bg : "var(--bg2)", borderRadius: 8, padding: "5px 4px", fontSize: 11, fontWeight: 700, color: editPriority === p.id ? p.color : "var(--text2)", cursor: "pointer", fontFamily: "inherit" }}>
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Kategori</div>
            <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
              style={{ width: "100%", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
              {WISH_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={cancelEdit}
            style={{ background: "var(--bg2)", border: "none", borderRadius: 9, padding: "7px 16px", fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "inherit" }}>
            Avbryt
          </button>
          <button onClick={saveEdit}
            style={{ background: "#ec4899", color: "#fff", border: "none", borderRadius: 9, padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            💾 Spara
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px",
      borderRadius: 13, border: `1.5px solid ${w.done ? "var(--border)" : hasPrio ? prio.color + "44" : "var(--border)"}`,
      background: w.done ? "var(--bg2)" : hasPrio ? prio.bg + "66" : "var(--bg2)",
      opacity: w.done ? 0.6 : 1, transition: "opacity 0.2s",
    }}>
      {/* Checkbox */}
      <button onClick={() => setWishes(ws => ws.map(x => x.id === w.id ? {...x, done: !x.done} : x))}
        style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${w.done ? "#10b981" : hasPrio ? prio.color : "#cbd5e1"}`, background: w.done ? "#10b981" : "transparent", color: "#fff", fontSize: 12, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
        {w.done ? "✓" : ""}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title + priority + category badges */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <span style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>
            <RenderTextWithLinks text={w.text} done={w.done} />
          </span>
          {hasPrio && <span style={{ fontSize: 11, background: prio.bg, color: prio.color, borderRadius: 99, padding: "1px 7px", fontWeight: 700 }}>{prio.emoji} {prio.label}</span>}
          {hasCat  && <span style={{ fontSize: 11, background: "var(--bg2)", color: "var(--text2)", borderRadius: 99, padding: "1px 7px", fontWeight: 600 }}>{cat.emoji} {cat.label}</span>}
          {w.price ? <span style={{ fontSize: 11, background: "#e0f2fe", color: "#0369a1", borderRadius: 99, padding: "1px 8px", fontWeight: 700 }}>💰 {Number(w.price).toLocaleString("sv-SE")} kr</span> : null}
        </div>

        {/* Note */}
        {w.note && (
          <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 3, fontStyle: "italic" }}>📝 {w.note}</div>
        )}

        {/* Link */}
        {w.link && (
          <div style={{ marginTop: 4 }}>
            <a href={w.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none", fontWeight: 600, background: "#eff6ff", borderRadius: 6, padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
              🔗 {(() => { try { return new URL(w.link).hostname.replace("www.", ""); } catch { return w.link.slice(0, 40); } })()}
              <span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>
            </a>
          </div>
        )}

        {/* Meta */}
        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>✍ {w.author} · {w.createdAt}</div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <button onClick={() => setEditing(true)}
          style={{ background: "#eff6ff", border: "none", borderRadius: 7, padding: "4px 8px", fontSize: 12, cursor: "pointer", color: "#3b82f6", fontWeight: 700 }}>✏️</button>
        <button onClick={() => setWishes(ws => ws.filter(x => x.id !== w.id))}
          style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "4px 8px", fontSize: 12, cursor: "pointer", color: "#ef4444", fontWeight: 700 }}>✕</button>
      </div>
    </div>
  );
}

function WishesWidget({ wishes, setWishes, user }) {
  const [wishText, setWishText] = useState("");
  const [wishLink, setWishLink] = useState("");
  const [wishPrice, setWishPrice] = useState("");
  const [wishPriority, setWishPriority] = useState("none");
  const [wishCategory, setWishCategory] = useState("none");
  const [showForm, setShowForm] = useState(false);
  const [sortBy, setSortBy] = useState("newest"); // newest | priority | price | category
  const [filterDone, setFilterDone] = useState("all"); // all | active | done

  function addWish() {
    if (!wishText.trim()) return;
    setWishes(ws => [{
      id: Date.now(),
      text: wishText.trim(),
      note: "",
      link: wishLink.trim(),
      price: wishPrice ? Number(wishPrice) : null,
      priority: wishPriority,
      category: wishCategory,
      author: user?.username || "?",
      createdAt: new Date().toLocaleDateString("sv-SE"),
      done: false,
    }, ...ws]);
    setWishText("");
    setWishLink("");
    setWishPrice("");
    setWishPriority("none");
    setWishCategory("none");
    setShowForm(false);
  }

  const prioOrder = { high: 0, medium: 1, low: 2, none: 3 };

  const filtered = wishes.filter(w => {
    if (filterDone === "active") return !w.done;
    if (filterDone === "done") return w.done;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "priority") return (prioOrder[a.priority || "none"] ?? 3) - (prioOrder[b.priority || "none"] ?? 3);
    if (sortBy === "price") return (b.price || 0) - (a.price || 0);
    if (sortBy === "category") return (a.category || "").localeCompare(b.category || "");
    return b.id - a.id; // newest
  });

  const doneCount = wishes.filter(w => w.done).length;
  const totalPrice = wishes.filter(w => w.price && !w.done).reduce((s, w) => s + w.price, 0);

  return (
    <div style={{ background: "var(--card)", borderRadius: 24, padding: "28px 30px", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>💌</span>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Önskemål</div>
        <div style={{ display: "flex", gap: 6, marginLeft: 4 }}>
          <span style={{ fontSize: 11, background: "#fce7f3", color: "#db2777", borderRadius: 99, padding: "2px 9px", fontWeight: 700 }}>{wishes.filter(w => !w.done).length} aktiva</span>
          {doneCount > 0 && <span style={{ fontSize: 11, background: "#d1fae5", color: "#059669", borderRadius: 99, padding: "2px 9px", fontWeight: 700 }}>✓ {doneCount} klara</span>}
          {totalPrice > 0 && <span style={{ fontSize: 11, background: "#e0f2fe", color: "#0369a1", borderRadius: 99, padding: "2px 9px", fontWeight: 700 }}>💰 {totalPrice.toLocaleString("sv-SE")} kr</span>}
        </div>
        <button onClick={() => setShowForm(f => !f)}
          style={{ marginLeft: "auto", background: showForm ? "#fce7f3" : "#ec4899", color: showForm ? "#db2777" : "#fff", border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {showForm ? "✕ Stäng" : "+ Nytt"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: "var(--bg2)", borderRadius: 14, padding: "16px", marginBottom: 14, border: "1.5px solid #f9a8d4", display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={wishText} onChange={e => setWishText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addWish(); }}
            placeholder="Vad önskar du? (Enter för att spara)"
            autoFocus
            style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 13px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input value={wishLink} onChange={e => setWishLink(e.target.value)}
              placeholder="🔗 Länk (https://…)"
              style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%" }} />
            <input type="number" value={wishPrice} onChange={e => setWishPrice(e.target.value)}
              placeholder="Pris kr"
              style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none", width: 100 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Prioritet</div>
              <div style={{ display: "flex", gap: 5 }}>
                {WISH_PRIORITIES.map(p => (
                  <button key={p.id} onClick={() => setWishPriority(p.id)}
                    style={{ flex: 1, border: wishPriority === p.id ? `2px solid ${p.color}` : "2px solid transparent", background: wishPriority === p.id ? p.bg : "var(--card)", borderRadius: 8, padding: "5px 4px", fontSize: 11, fontWeight: 700, color: wishPriority === p.id ? p.color : "var(--text2)", cursor: "pointer", fontFamily: "inherit" }}>
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Kategori</div>
              <select value={wishCategory} onChange={e => setWishCategory(e.target.value)}
                style={{ width: "100%", background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
                {WISH_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowForm(false)}
              style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "7px 16px", fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "inherit" }}>
              Avbryt
            </button>
            <button onClick={addWish} disabled={!wishText.trim()}
              style={{ background: wishText.trim() ? "#ec4899" : "#f9a8d4", color: "#fff", border: "none", borderRadius: 9, padding: "7px 20px", fontSize: 13, fontWeight: 700, cursor: wishText.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
              💌 Lägg till
            </button>
          </div>
        </div>
      )}

      {/* Filters + Sort */}
      {wishes.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          {["all", "active", "done"].map(f => (
            <button key={f} onClick={() => setFilterDone(f)}
              style={{ background: filterDone === f ? "#ec4899" : "var(--bg2)", color: filterDone === f ? "#fff" : "var(--text2)", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {f === "all" ? "Alla" : f === "active" ? "Aktiva" : "Klara"}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>Sortera:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", fontSize: 12, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
              <option value="newest">Nyast</option>
              <option value="priority">Prioritet</option>
              <option value="price">Pris</option>
              <option value="category">Kategori</option>
            </select>
          </div>
        </div>
      )}

      {wishes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text2)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💌</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Inga önskemål ännu</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Skriv vad du eller din partner önskar – köp, utflykter, saker att göra</div>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text2)", fontSize: 13 }}>Inga önskemål matchar filtret</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(w => (
            <WishRow key={w.id} w={w} setWishes={setWishes} />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardPage({ totalIncome, totalExpenses, leftover, totalDebts, netWorth, healthScore, daysToSalary, nextSalary, debts, expenses, savings, goals, history, wishes = [], setWishes, user, appTexts = {} }) {
  const allGoals    = goals || [];
  const activeGoals = allGoals.filter(g => g.saved < g.target);
  const [pinnedGoalId, setPinnedGoalId] = useState(null);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [pinnedSavingsId, setPinnedSavingsId] = useState(null);
  const [showSavingsPicker, setShowSavingsPicker] = useState(false);
  const [blickfangTab, setBlickfangTab] = useState("goals"); // "goals" | "savings"

  const allSavings = savings || [];

  const displayGoal = pinnedGoalId
    ? allGoals.find(g => g.id === pinnedGoalId) || activeGoals[0]
    : activeGoals[0] || null;

  const pep = PEPTALKS.find(p => p.condition(leftover)) || PEPTALKS[PEPTALKS.length - 1];
  const dc = { hero: true, salary: true, debts: true, goals: true, savings: true, spartips: true, wishes: true, ...(appTexts.dashboardCards || {}) };

  const leftoverBg = leftover > 0
    ? "linear-gradient(145deg, #064e3b 0%, #059669 100%)"
    : leftover < 0
    ? "linear-gradient(145deg, #7f1d1d 0%, #dc2626 100%)"
    : "linear-gradient(145deg, #78350f 0%, #d97706 100%)";

  // Debt stats
  const totalPaidOff  = debts.reduce((s, d) => s + (d.total - d.remaining), 0);
  const totalOriginal = debts.reduce((s, d) => s + d.total, 0);
  const debtPct       = totalOriginal > 0 ? Math.round((totalPaidOff / totalOriginal) * 100) : 0;

  // Debt payments from Budget only — expenses linked to a debt
  const budgetLinkedDebtTotal = expenses
    .filter(e => e.debtLink)
    .reduce((s, e) => s + e.cost, 0);
  const paidThisMonth = expenses
    .filter(e => e.debtLink && e.status === "paid")
    .reduce((s, e) => s + e.cost, 0);

  // Savings stats
  // Savings stats (allSavings already declared above)
  const totalSavingsBalance = allSavings.reduce((s, a) => s + a.balance, 0);
  const totalSavingsGoal    = allSavings.reduce((s, a) => s + a.goal, 0);
  const totalMonthlySavings = allSavings.reduce((s, a) => s + (a.monthlyDeposit || 0), 0);
  const savingsPct          = totalSavingsGoal > 0 ? Math.round((totalSavingsBalance / totalSavingsGoal) * 100) : 0;
  const savingsRemaining    = Math.max(0, totalSavingsGoal - totalSavingsBalance);
  const savingsMonthsLeft   = totalMonthlySavings > 0 ? Math.ceil(savingsRemaining / totalMonthlySavings) : null;
  const savingsDoneDate     = savingsMonthsLeft ? (() => {
    const d = new Date(); d.setMonth(d.getMonth() + savingsMonthsLeft);
    return d.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  })() : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ══ ROW 1: Hero + Lön side by side ══ */}
      {(dc.hero || dc.salary) && <div className="dash-row1" style={{ display: "grid", gridTemplateColumns: dc.hero && dc.salary ? "1fr 320px" : "1fr", gap: 16 }}>

        {/* HERO — Kvar denna månad */}
        <div style={{ background: leftoverBg, borderRadius: 24, padding: "36px 40px", color: "#fff", position: "relative", overflow: "hidden", minHeight: 200 }}>
          <div style={{ position: "absolute", right: -60, top: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ position: "absolute", right: 40, bottom: -80, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.65, marginBottom: 10 }}>Kvar denna månad</div>
          <div className="hero-amount" style={{ fontSize: 62, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1, position: "relative" }}>{formatSEK(leftover)}</div>
          <div style={{ marginTop: 18, fontSize: 15, opacity: 0.88, fontStyle: "italic", maxWidth: 380 }}>{pep.msg}</div>
          <div style={{ marginTop: 20, display: "flex", gap: 20, opacity: 0.75 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Inkomst</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{formatSEK(totalIncome)}</div>
            </div>
            <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Utgifter</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{formatSEK(totalExpenses)}</div>
            </div>
          </div>
        </div>

        {/* Nästa lön */}
        <div style={{ background: "var(--card)", borderRadius: 24, padding: "32px 28px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text2)" }}>💸 Nästa lön</div>
          <div>
            <div className="salary-days-num" style={{ fontSize: 68, fontWeight: 900, letterSpacing: "-0.05em", color: "#3b82f6", lineHeight: 1 }}>{daysToSalary}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text2)", marginTop: 2 }}>dagar kvar</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
            {nextSalary.toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ background: "var(--bg2)", borderRadius: 99, height: 6, overflow: "hidden" }}>
            <div style={{ width: `${Math.round((1 - daysToSalary / 25) * 100)}%`, background: "#3b82f6", height: "100%", borderRadius: 99 }} />
          </div>
        </div>
      </div>}

      {/* ══ ROW 2: Skulder + Mål side by side ══ */}
      {(dc.debts || dc.goals || dc.savings) && <div className="dash-row2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Skulder */}
        {dc.debts && <div style={{ background: "var(--card)", borderRadius: 24, padding: "28px 30px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text2)" }}>📉 Skulder</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em", color: "#ef4444" }}>{formatSEK(totalDebts)}</div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>totalt kvar</div>
            </div>
          </div>

          {/* Monthly payments highlight — from Budget linked posts only */}
          {budgetLinkedDebtTotal > 0 && (
            <div style={{ background: "linear-gradient(135deg, #d1fae5, #a7f3d0)", borderRadius: 14, padding: "12px 16px", marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>
                💸 Betalt denna månad: {formatSEK(paidThisMonth > 0 ? paidThisMonth : budgetLinkedDebtTotal)}
              </div>
              <div style={{ fontSize: 12, color: "#059669", marginTop: 4 }}>
                {paidThisMonth > 0
                  ? `${paidThisMonth >= budgetLinkedDebtTotal ? "✓ Alla" : `${Math.round((paidThisMonth / budgetLinkedDebtTotal) * 100)}% av`} månadens ${formatSEK(budgetLinkedDebtTotal)} inbetalda`
                  : `Skuldbetalningar i budget denna månad`}
              </div>
              {totalPaidOff > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #6ee7b7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#065f46", fontWeight: 600 }}>Totalt avbetalat:</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>{formatSEK(totalPaidOff)} ({debtPct}%)</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {debts.map(d => {
              const pct = Math.round(((d.total - d.remaining) / Math.max(d.total, 1)) * 100);
              const barColor = pct > 66 ? "#10b981" : pct > 33 ? "#f59e0b" : "#ef4444";
              return (
                <div key={d.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>{formatSEK(d.remaining)}</span>
                  </div>
                  <div style={{ background: "var(--bg2)", borderRadius: 99, height: 7, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, background: barColor, height: "100%", borderRadius: 99, transition: "width 0.6s ease" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3 }}>{pct}% betald</div>
                </div>
              );
            })}
          </div>
        </div>

        }
        {(dc.goals || dc.savings) && <div style={{ background: "var(--card)", borderRadius: 24, padding: "28px 30px", border: "1px solid var(--border)", position: "relative" }}>

          {/* Tab bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 4, background: "var(--bg2)", borderRadius: 10, padding: 3 }}>
              {[{ id: "goals", label: "🎯 Mål" }, { id: "savings", label: "🏦 Spar" }].map(tab => (
                <button key={tab.id} onClick={() => setBlickfangTab(tab.id)}
                  style={{ padding: "5px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    background: blickfangTab === tab.id ? "var(--card)" : "transparent",
                    color: blickfangTab === tab.id ? "var(--text)" : "var(--text2)",
                    boxShadow: blickfangTab === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s" }}>
                  {tab.label}
                </button>
              ))}
            </div>
            {blickfangTab === "goals" && activeGoals.length >= 1 && (
              <button onClick={() => setShowGoalPicker(v => !v)}
                style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", background: "#dbeafe", border: "none", borderRadius: 99, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                Byt mål ▾
              </button>
            )}
            {blickfangTab === "savings" && allSavings.length >= 1 && (
              <button onClick={() => setShowSavingsPicker(v => !v)}
                style={{ fontSize: 11, fontWeight: 700, color: "#10b981", background: "#d1fae5", border: "none", borderRadius: 99, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                Byt konto ▾
              </button>
            )}
          </div>

          {/* Goal picker dropdown */}
          {showGoalPicker && blickfangTab === "goals" && (
            <div style={{ position: "absolute", top: 72, right: 20, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "8px", zIndex: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 220 }}>
              {activeGoals.map(g => (
                <button key={g.id} onClick={() => { setPinnedGoalId(g.id); setShowGoalPicker(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 10, border: "none", background: g.id === (displayGoal?.id) ? "var(--hover)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <span style={{ fontSize: 18 }}>{g.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{g.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>{Math.round((g.saved / g.target) * 100)}% klart</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── GOALS TAB ── */}
          {blickfangTab === "goals" && (
            displayGoal ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, background: displayGoal.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 }}>{displayGoal.icon}</div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{displayGoal.name}</div>
                    {displayGoal.description && <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>{displayGoal.description}</div>}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: displayGoal.color }}>{formatSEK(displayGoal.saved)}</span>
                    <span style={{ fontSize: 14, color: "var(--text2)" }}>av {formatSEK(displayGoal.target)}</span>
                  </div>
                  <div style={{ background: "var(--bg2)", borderRadius: 99, height: 12, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, Math.round((displayGoal.saved / displayGoal.target) * 100))}%`, background: displayGoal.color, height: "100%", borderRadius: 99, transition: "width 0.6s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: displayGoal.color }}>{Math.round((displayGoal.saved / displayGoal.target) * 100)}% klart</span>
                    <span style={{ fontSize: 13, color: "var(--text2)" }}>{formatSEK(displayGoal.target - displayGoal.saved)} kvar</span>
                  </div>
                </div>
                {displayGoal.monthlyActive && displayGoal.monthlyDeposit > 0 && (() => {
                  const rem = displayGoal.target - displayGoal.saved;
                  const months = Math.ceil(rem / displayGoal.monthlyDeposit);
                  const d = new Date(); d.setMonth(d.getMonth() + months);
                  const date = d.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
                  return (
                    <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 12 }}>
                      <span style={{ color: "var(--text2)" }}>📅 {formatSEK(displayGoal.monthlyDeposit)}/mån · klart</span>
                      <span style={{ fontWeight: 700, color: displayGoal.color, textTransform: "capitalize" }}>{date}</span>
                    </div>
                  );
                })()}
                {activeGoals.length > 1 && (
                  <div style={{ fontSize: 12, color: "var(--text2)", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    {activeGoals.length - 1} fler pågående mål
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text2)" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Inga aktiva mål</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Lägg till ett mål under Mål-sidan</div>
              </div>
            )
          )}

          {/* Savings picker dropdown */}
          {showSavingsPicker && blickfangTab === "savings" && (
            <div style={{ position: "absolute", top: 72, right: 20, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "8px", zIndex: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 220 }}>
              <button onClick={() => { setPinnedSavingsId(null); setShowSavingsPicker(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 10, border: "none", background: !pinnedSavingsId ? "var(--hover)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 18 }}>📊</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Alla konton</div>
                  <div style={{ fontSize: 11, color: "var(--text2)" }}>Visa alla sparkonton</div>
                </div>
              </button>
              {allSavings.map(acc => (
                <button key={acc.id} onClick={() => { setPinnedSavingsId(acc.id); setShowSavingsPicker(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 10, border: "none", background: acc.id === pinnedSavingsId ? "var(--hover)" : "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: acc.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{acc.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>{Math.round((acc.balance / Math.max(acc.goal, 1)) * 100)}% · {formatSEK(acc.balance)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── SAVINGS TAB ── */}
          {blickfangTab === "savings" && (
            allSavings.length > 0 ? (
              pinnedSavingsId ? (() => {
                const acc = allSavings.find(a => a.id === pinnedSavingsId) || allSavings[0];
                const pct = Math.min(100, (acc.balance / Math.max(acc.goal, 1)) * 100);
                const remaining = Math.max(0, acc.goal - acc.balance);
                const monthly = acc.monthlyDeposit || 0;
                const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;
                const doneDate = monthsLeft ? (() => { const d = new Date(); d.setMonth(d.getMonth() + monthsLeft); return d.toLocaleDateString("sv-SE", { month: "long", year: "numeric" }); })() : null;
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                      <div style={{ width: 64, height: 64, borderRadius: 20, background: acc.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, flexShrink: 0 }}>🏦</div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{acc.name}</div>
                        <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>{acc.bank}</div>
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                        <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", color: acc.color }}>{formatSEK(acc.balance)}</span>
                        <span style={{ fontSize: 14, color: "var(--text2)" }}>av {formatSEK(acc.goal)}</span>
                      </div>
                      <div style={{ background: "var(--bg2)", borderRadius: 99, height: 12, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, background: acc.color, height: "100%", borderRadius: 99, transition: "width 0.6s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: acc.color }}>{Math.round(pct)}% klart</span>
                        <span style={{ fontSize: 13, color: "var(--text2)" }}>{formatSEK(remaining)} kvar</span>
                      </div>
                    </div>
                    {doneDate && (
                      <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 12 }}>
                        <span style={{ color: "var(--text2)" }}>📅 {formatSEK(monthly)}/mån · klart</span>
                        <span style={{ fontWeight: 700, color: acc.color, textTransform: "capitalize" }}>{doneDate}</span>
                      </div>
                    )}
                    {allSavings.length > 1 && (
                      <div style={{ fontSize: 12, color: "var(--text2)", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                        {allSavings.length - 1} fler sparkonton
                      </div>
                    )}
                  </div>
                );
              })() : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {totalMonthlySavings > 0 && (
                  <div style={{ background: "linear-gradient(135deg, #d1fae5, #a7f3d0)", borderRadius: 14, padding: "12px 16px", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>
                      💰 Sparat denna månad: {formatSEK(totalMonthlySavings)}
                    </div>
                    <div style={{ fontSize: 12, color: "#059669", marginTop: 4 }}>
                      Planerad månadsinsättning på alla konton
                    </div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #6ee7b7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#065f46", fontWeight: 600 }}>Totalt sparat:</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#065f46" }}>{formatSEK(totalSavingsBalance)} ({savingsPct}%)</span>
                    </div>
                  </div>
                )}
                {allSavings.map(acc => {
                  const pct = Math.min(100, (acc.balance / Math.max(acc.goal, 1)) * 100);
                  const remaining = Math.max(0, acc.goal - acc.balance);
                  const monthly = acc.monthlyDeposit || 0;
                  const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;
                  const doneDate = monthsLeft ? (() => {
                    const d = new Date(); d.setMonth(d.getMonth() + monthsLeft);
                    return d.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
                  })() : null;
                  return (
                    <div key={acc.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: acc.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{acc.name}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: acc.color }}>{formatSEK(acc.balance)}</span>
                          <span style={{ fontSize: 11, color: "var(--text2)", marginLeft: 4 }}>/ {formatSEK(acc.goal)}</span>
                        </div>
                      </div>
                      <div style={{ background: "var(--bg2)", borderRadius: 99, height: 6, overflow: "hidden", marginBottom: 3 }}>
                        <div style={{ width: `${pct}%`, background: acc.color, height: "100%", borderRadius: 99, transition: "width 0.6s ease" }} />
                      </div>
                      {doneDate && (
                        <div style={{ fontSize: 11, color: "var(--text2)", display: "flex", justifyContent: "space-between" }}>
                          <span>{Math.round(pct)}% · {formatSEK(remaining)} kvar</span>
                          <span style={{ color: acc.color, fontWeight: 600, textTransform: "capitalize" }}>klart {doneDate}</span>
                        </div>
                      )}
                      {!doneDate && (
                        <div style={{ fontSize: 11, color: "var(--text2)" }}>{Math.round(pct)}% · {formatSEK(remaining)} kvar</div>
                      )}
                    </div>
                  );
                })}
                <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>Totalt sparat</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>{formatSEK(allSavings.reduce((s,a) => s + a.balance, 0))}</span>
                </div>
              </div>
              )
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text2)" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🏦</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Inga sparkonton</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Lägg till ett konto under Sparande</div>
              </div>
            )
          )}
        </div>}
      </div>}

      {/* ══ SPARTIPS ══ */}
      {dc.spartips && (() => {
        const highT = Number(appTexts.savingsHighThreshold ?? 10000);
        const highR = Number(appTexts.savingsHighRate ?? 40);
        const lowT  = Number(appTexts.savingsLowThreshold ?? 5000);
        const lowR  = Number(appTexts.savingsLowRate ?? 15);
        let rate = null, label = "", bg = "", color = "";
        if (leftover >= highT) {
          rate = highR; label = "bra månad 🚀"; bg = "linear-gradient(135deg,#d1fae5,#6ee7b7)"; color = "#065f46";
        } else if (leftover < highT && leftover >= 0 && leftover < lowT) {
          rate = lowR; label = "tight månad 💪"; bg = "linear-gradient(135deg,#fef3c7,#fde68a)"; color = "#78350f";
        }
        if (rate === null || leftover <= 0) return null;
        const amount = Math.round(leftover * rate / 100);
        return (
          <div style={{ background: bg, borderRadius: 20, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 36, flexShrink: 0 }}>🐷</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Spartips — {label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: "-0.02em" }}>{formatSEK(amount)}</div>
              <div style={{ fontSize: 13, color, opacity: 0.8, marginTop: 2 }}>= {rate}% av dina {formatSEK(leftover)} kvar denna månad</div>
            </div>
          </div>
        );
      })()}

      {/* ══ ÖNSKEMÅL ══ */}
      {dc.wishes && <WishesWidget wishes={wishes} setWishes={setWishes} user={user} />}
    </div>
  );
}



// ============================================================
// REUSABLE CALENDAR PICKER
// ============================================================
function CalendarPicker({ parts, setParts, error, accentColor = "#8b5cf6", showTime = true }) {
  const MONTHS_LONG = ["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"];
  const DAYS = ["Mån","Tis","Ons","Tor","Fre","Lör","Sön"];
  const { year, month, day, hour = 9, minute = 0 } = parts;
  const firstDay = new Date(year, month-1, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const borderColor = error ? "#ef4444" : "var(--border)";
  return (
    <div style={{ border: "1.5px solid " + borderColor, borderRadius: 14, overflow: "hidden", background: "var(--card)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: accentColor, color: "#fff" }}>
        <button onClick={() => setParts(p => { let m=p.month-1,y=p.year; if(m<1){m=12;y--;} return {...p,month:m,year:y,day:Math.min(p.day,new Date(y,m,0).getDate())}; })}
          style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", width: 28, height: 28, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{MONTHS_LONG[month-1]} {year}</span>
        <button onClick={() => setParts(p => { let m=p.month+1,y=p.year; if(m>12){m=1;y++;} return {...p,month:m,year:y,day:Math.min(p.day,new Date(y,m,0).getDate())}; })}
          style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", width: 28, height: 28, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "var(--bg2)" }}>
        {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text2)", padding: "6px 0", textTransform: "uppercase" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, padding: "6px 8px 8px" }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isSelected = d === day;
          const isToday = d === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
          return (
            <button key={i} onClick={() => setParts(p => ({...p, day: d}))}
              style={{ width: "100%", aspectRatio: "1", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: isSelected||isToday ? 700 : 400,
                background: isSelected ? accentColor : isToday ? accentColor+"22" : "transparent",
                color: isSelected ? "#fff" : isToday ? accentColor : "var(--text)",
                outline: isToday && !isSelected ? "1.5px solid " + accentColor : "none" }}>
              {d}
            </button>
          );
        })}
      </div>
      {showTime && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px 10px", borderTop: "1px solid var(--border)", background: "var(--bg2)" }}>
          <span style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, flexShrink: 0 }}>🕐 Klockan</span>
          <select value={hour} onChange={e => setParts(p=>({...p,hour:+e.target.value}))}
            style={{ flex: 1, background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
            {Array.from({length:24},(_,i)=>i).map(h=><option key={h} value={h}>{String(h).padStart(2,"0")}</option>)}
          </select>
          <span style={{ fontWeight: 700, color: "var(--text2)" }}>:</span>
          <select value={minute} onChange={e => setParts(p=>({...p,minute:+e.target.value}))}
            style={{ flex: 1, background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 8px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
            {[0,15,30,45].map(m=><option key={m} value={m}>{String(m).padStart(2,"0")}</option>)}
          </select>
        </div>
      )}
      <div style={{ padding: "7px 12px", background: accentColor, color: "#fff", fontSize: 12, fontWeight: 700, textAlign: "center" }}>
        📅 {day} {["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"][month-1]} {year}{showTime ? " kl. " + String(hour).padStart(2,"0") + ":" + String(minute).padStart(2,"0") : ""}
      </div>
    </div>
  );
}

// ============================================================
// BUDGET PAGE — clean grouped card design
// ============================================================
const CATEGORY_META = {
  "Boende":          { icon: "🏠", color: "#3b82f6" },
  "Mat":             { icon: "🛒", color: "#f59e0b" },
  "Transport":       { icon: "🚌", color: "#06b6d4" },
  "Försäkring":      { icon: "🛡️", color: "#10b981" },
  "Prenumerationer": { icon: "📱", color: "#8b5cf6" },
  "Lån":             { icon: "💳", color: "#ef4444" },
  "Hälsa":           { icon: "❤️", color: "#ec4899" },
  "Nöje":            { icon: "🎮", color: "#f97316" },
  "Övrigt":          { icon: "📦", color: "#94a3b8" },
};

const STATUS_CYCLE  = { unpaid: "autogiro", autogiro: "paid", paid: "unpaid" };
const STATUS_STYLE  = {
  paid:     { dot: "#10b981", label: "Betald",   rowBg: "#f0fdf4", rowBgDark: "#052e16", textColor: "#15803d" },
  autogiro: { dot: "#f59e0b", label: "Autogiro", rowBg: "#fffbeb", rowBgDark: "#422006", textColor: "#b45309" },
  unpaid:   { dot: "#94a3b8", label: "Obetald",  rowBg: "transparent",          rowBgDark: "transparent",   textColor: "#94a3b8" },
};

function BudgetPage({ expenses, setExpenses, canEdit, addToHistory, debts, setDebts, plannedExpenses = [], setPlannedExpenses, categoryMeta: _catMeta, setCategoryMeta, pushUndo = () => {}, recurringExpenses = [], setRecurringExpenses }) {
  const CATEGORY_META = _catMeta || {
    "Boende": { icon: "🏠", color: "#3b82f6" }, "Mat": { icon: "🛒", color: "#f59e0b" },
    "Transport": { icon: "🚌", color: "#06b6d4" }, "Försäkring": { icon: "🛡️", color: "#10b981" },
    "Prenumerationer": { icon: "📱", color: "#8b5cf6" }, "Lån": { icon: "💳", color: "#ef4444" },
    "Hälsa": { icon: "❤️", color: "#ec4899" }, "Nöje": { icon: "🎮", color: "#f97316" },
    "Övrigt": { icon: "📦", color: "#94a3b8" },
  };
  const CATEGORIES = Object.keys(CATEGORY_META);
  const [editingId,  setEditingId]  = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [linkingId,  setLinkingId]  = useState(null);
  const [skipMonthsId, setSkipMonthsId] = useState(null);
  const [newExp, setNewExp] = useState({ service: "", cost: "", category: "Övrigt", status: "unpaid", temporary: false });
  const [budgetTab, setBudgetTab] = useState("budget");
  const [showAddPlanned, setShowAddPlanned] = useState(false);
  const [newPlanned, setNewPlanned] = useState({ service: "", cost: "", category: "Övrigt", dueDate: "", note: "" });
  const [plannedErrors, setPlannedErrors] = useState({});
  const [dueDateParts, setDueDateParts] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth()+1, day: d.getDate(), hour: 9, minute: 0 };
  });
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [newRec, setNewRec] = useState({ service: "", cost: "", category: "Övrigt", startDate: "" });

  const MONTH_NAMES_SV = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
  function toggleSkipMonth(expId, monthKey) {
    setExpenses(es => es.map(e => {
      if (e.id !== expId) return e;
      const arr = e.skipMonths || [];
      const next = arr.includes(monthKey) ? arr.filter(m => m !== monthKey) : [...arr, monthKey];
      return { ...e, skipMonths: next };
    }));
  }

  const [editCat, setEditCat] = useState(null); // { name, icon, color, originalName }
  const dragRef = useRef({ dragId: null, dragOverId: null });
  const [, forceUpdate] = useState(0);
  const setDragState = (dragId, dragOverId) => {
    dragRef.current = { dragId, dragOverId };
    forceUpdate(n => n + 1);
  };

  const sorted = [...expenses].sort((a, b) => a.order - b.order);
  const totalBudget = expenses.filter(e => !e.hidden).reduce((s, e) => s + e.cost, 0);
  const paid   = expenses.filter(e => !e.hidden && e.status === "paid").reduce((s, e) => s + e.cost, 0);
  const unpaid = expenses.filter(e => !e.hidden && e.status !== "paid").reduce((s, e) => s + e.cost, 0);

  const groupOrder = [];
  const groups = {};
  sorted.forEach(e => {
    if (!groups[e.category]) { groups[e.category] = []; groupOrder.push(e.category); }
    groups[e.category].push(e);
  });
  const uniqueGroupOrder = [...new Set(groupOrder)];

  function updateExpense(id, field, value) {
    setExpenses(es => es.map(e => e.id === id ? { ...e, [field]: value } : e));
  }

  function deleteExpense(id) {
    pushUndo("Ta bort utgift");
    setExpenses(es => es.filter(e => e.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function addExpense() {
    if (!newExp.service.trim()) return;
    const e = { ...newExp, id: Date.now(), cost: parseFloat(newExp.cost) || 0, tags: [], order: expenses.length + 1, debtLink: null, dueDate: "" };
    setExpenses(es => [...es, e]);
    setNewExp({ service: "", cost: "", category: "Övrigt", status: "unpaid", temporary: false });
    setShowAdd(false);
  }

  function cycleStatus(e) {
    const next = STATUS_CYCLE[e.status];
    updateExpense(e.id, "status", next);
    if (next === "paid" && e.debtLink) {
      setDebts(ds => ds.map(d => d.id === e.debtLink ? { ...d, remaining: Math.max(0, d.remaining - e.cost) } : d));
    }
  }

  function handleDragStart(ev, id) { ev.dataTransfer.effectAllowed = "move"; setDragState(id, null); }
  function handleDragOver(ev, id)  { ev.preventDefault(); if (id !== dragRef.current.dragId) setDragState(dragRef.current.dragId, id); }
  function handleDrop(ev, targetId) {
    ev.preventDefault();
    const { dragId } = dragRef.current;
    if (!dragId || dragId === targetId) { setDragState(null, null); return; }
    setExpenses(prev => {
      const arr = [...prev].sort((a, b) => a.order - b.order);
      const from = arr.findIndex(x => x.id === dragId);
      const to   = arr.findIndex(x => x.id === targetId);
      const r = [...arr]; const [m] = r.splice(from, 1); r.splice(to, 0, m);
      const targetExp = arr.find(x => x.id === targetId);
      if (m.category !== targetExp.category) m.category = targetExp.category;
      return r.map((item, i) => ({ ...item, order: i + 1 }));
    });
    setDragState(null, null);
  }

  const { dragId, dragOverId } = dragRef.current;

  // ── Planned helpers ──────────────────────────────────────────────────────
  function validatePlanned() {
    const e = {};
    if (!newPlanned.service.trim()) e.service = "Ange namn";
    if (!newPlanned.cost || parseFloat(newPlanned.cost) <= 0) e.cost = "Ange belopp";
    if (!newPlanned.dueDate) e.dueDate = "Välj datum och tid";
    return e;
  }
  function buildDueDate() {
    const { year, month, day, hour, minute } = dueDateParts;
    if (!year || !month || !day) return "";
    return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
  }
  function addPlanned() {
    const iso = buildDueDate();
    setNewPlanned(n => ({ ...n, dueDate: iso }));
    const errs = {};
    if (!newPlanned.service.trim()) errs.service = "Ange namn";
    if (!newPlanned.cost || parseFloat(newPlanned.cost) <= 0) errs.cost = "Ange belopp";
    if (!iso) errs.dueDate = "Välj datum och tid";
    if (Object.keys(errs).length) { setPlannedErrors(errs); return; }
    setPlannedExpenses(ps => [...ps, {
      id: Date.now(), service: newPlanned.service.trim(),
      cost: parseFloat(newPlanned.cost), category: newPlanned.category,
      dueDate: iso, note: newPlanned.note.trim(),
    }]);
    setNewPlanned({ service: "", cost: "", category: "Övrigt", dueDate: "", note: "" });
    const nd = new Date(); setDueDateParts({ year: nd.getFullYear(), month: nd.getMonth()+1, day: nd.getDate(), hour: 9, minute: 0 });
    setPlannedErrors({});
    setShowAddPlanned(false);
  }
  function deletePlanned(id) { setPlannedExpenses(ps => ps.filter(p => p.id !== id)); }
  function promoteNow(p) {
    setExpenses(es => {
      const max = es.length ? Math.max(...es.map(e => e.order)) : 0;
      return [...es, { id: Date.now(), service: p.service, cost: p.cost, category: p.category,
        status: "unpaid", tags: [], order: max + 1, debtLink: null, dueDate: "", temporary: true }];
    });
    deletePlanned(p.id);
  }
  const now = new Date();
  const plannedSorted = [...plannedExpenses].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const plannedTotal = plannedExpenses.reduce((s, p) => s + p.cost, 0);

  return (
    <div className="budget-max-width" style={{ maxWidth: 720 }}>

      {/* ══ KATEGORI-REDIGERA MODAL ══ */}
      {editCat && (() => {
        const PRESET_COLORS = ["#3b82f6","#f59e0b","#06b6d4","#10b981","#8b5cf6","#ef4444","#ec4899","#f97316","#94a3b8","#84cc16","#14b8a6","#a855f7","#0ea5e9","#fb923c","#e11d48"];
        const PRESET_EMOJIS = ["🏠","🛒","🚌","🛡️","📱","💳","❤️","🎮","📦","✈️","🎓","🐾","🍕","☕","🎵","💡","🏋️","👕","🧴","📚","🚗","🏥","🎁","🏖️","💼"];
        return (
          <div className="modal-overlay" onClick={() => setEditCat(null)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{editCat.onCreate ? "Ny kategori" : "Redigera kategori"}</div>
                <button onClick={() => setEditCat(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text2)" }}>✕</button>
              </div>

              {/* Preview */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, background: editCat.color + "15", border: `2px solid ${editCat.color}`, marginBottom: 20 }}>
                <span style={{ fontSize: 22 }}>{editCat.icon}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: editCat.color }}>{editCat.name || "Kategorinamn"}</span>
              </div>

              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Namn</label>
                <input value={editCat.name} onChange={e => setEditCat(c => ({ ...c, name: e.target.value }))}
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }} />
              </div>

              {/* Emoji picker */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Emoji</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {PRESET_EMOJIS.map(em => (
                    <button key={em} onClick={() => setEditCat(c => ({ ...c, icon: em }))}
                      style={{ fontSize: 20, padding: "5px 7px", borderRadius: 8, border: `2px solid ${editCat.icon === em ? editCat.color : "transparent"}`, background: editCat.icon === em ? editCat.color + "20" : "var(--bg2)", cursor: "pointer", lineHeight: 1 }}>
                      {em}
                    </button>
                  ))}
                </div>
                <input value={editCat.icon} onChange={e => setEditCat(c => ({ ...c, icon: e.target.value }))}
                  placeholder="Eller skriv valfri emoji…"
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 18, fontFamily: "inherit", outline: "none", color: "var(--text)" }} />
              </div>

              {/* Color picker */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Färg</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  {PRESET_COLORS.map(col => (
                    <button key={col} onClick={() => setEditCat(c => ({ ...c, color: col }))}
                      style={{ width: 28, height: 28, borderRadius: 99, background: col, border: `3px solid ${editCat.color === col ? "var(--text)" : "transparent"}`, cursor: "pointer", transition: "border 0.1s" }} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="color" value={editCat.color} onChange={e => setEditCat(c => ({ ...c, color: e.target.value }))}
                    style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid var(--border)", cursor: "pointer", padding: 2 }} />
                  <span style={{ fontSize: 12, color: "var(--text2)", fontFamily: "monospace" }}>{editCat.color}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => {
                  if (!editCat.name.trim()) return;
                  setCategoryMeta(m => {
                    const updated = { ...m };
                    const meta = { icon: editCat.icon, color: editCat.color };
                    if (editCat.onCreate) {
                      updated[editCat.name] = meta;
                    } else if (editCat.name !== editCat.originalName) {
                      delete updated[editCat.originalName];
                      updated[editCat.name] = meta;
                      setExpenses(es => es.map(e => e.category === editCat.originalName ? { ...e, category: editCat.name } : e));
                    } else {
                      updated[editCat.name] = meta;
                    }
                    return updated;
                  });
                  if (editCat.onCreate) setNewExp(n => ({ ...n, category: editCat.name }));
                  setEditCat(null);
                }} style={{ flex: 1, background: editCat.color, color: "#fff", border: "none", borderRadius: 12, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Spara
                </button>
                <button onClick={() => setEditCat(null)}
                  style={{ background: "var(--bg2)", border: "none", borderRadius: 12, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Tab switcher ── */}
      <div style={{ display: "flex", gap: 4, background: "var(--card)", borderRadius: 14, padding: 4, marginBottom: 20, border: "1px solid var(--border)", width: "fit-content" }}>
        {[
          { id: "budget",  label: "💳 Budget" },
          { id: "planned", label: "🗓 Planerade", count: plannedExpenses.length },
          { id: "recurring", label: "🔁 Sittande", count: recurringExpenses.length },
        ].map(t => (
          <button key={t.id} onClick={() => setBudgetTab(t.id)} style={{
            padding: "8px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 6,
            background: budgetTab === t.id ? "#3b82f6" : "transparent",
            color: budgetTab === t.id ? "#fff" : "var(--text2)",
            boxShadow: budgetTab === t.id ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ background: budgetTab === t.id ? "rgba(255,255,255,0.3)" : "#8b5cf6", color: "#fff", borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════ BUDGET TAB ══════════ */}
      {budgetTab === "budget" && (<>
        <div className="dash-summary" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total budget",    value: totalBudget, color: "var(--text)" },
            { label: "Betalt",          value: paid,        color: "#10b981" },
            { label: "Kvar att betala", value: unpaid,      color: "#ef4444" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--card)", borderRadius: 16, padding: "16px 20px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: "-0.02em" }}>{formatSEK(s.value)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {uniqueGroupOrder.map(cat => {
            const meta  = CATEGORY_META[cat] || CATEGORY_META["Övrigt"];
            const items = groups[cat];
            const groupTotal = items.reduce((s, e) => s + e.cost, 0);
            return (
              <div key={cat} style={{ background: "var(--card)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: `1px solid ${meta.color}20`, background: meta.color + "08" }}>
                  <button onClick={() => setEditCat({ name: cat, icon: meta.icon, color: meta.color, originalName: cat })}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}>
                    <span style={{ fontSize: 15 }}>{meta.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{cat}</span>
                    <span style={{ fontSize: 10, color: meta.color, opacity: 0.45 }}>✏️</span>
                  </button>
                  <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--text2)" }}>{formatSEK(groupTotal)}</span>
                </div>
                {items.map(e => {
                  const ss = STATUS_STYLE[e.status] || STATUS_STYLE.unpaid;
                  const isEditing = editingId === e.id;
                  const isLinking = linkingId === e.id;
                  const linkedDebt = e.debtLink ? debts.find(d => d.id === e.debtLink) : null;
                  return (
                    <div key={e.id}>
                      <div
                        draggable={canEdit && !isEditing}
                        onDragStart={ev => handleDragStart(ev, e.id)}
                        onDragOver={ev => handleDragOver(ev, e.id)}
                        onDrop={ev => handleDrop(ev, e.id)}
                        onDragEnd={() => setDragState(null, null)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 18px", borderBottom: "1px solid var(--border)",
                          background: dragOverId === e.id ? "var(--hover)" : dragId === e.id ? "var(--bg2)" : isEditing ? "var(--bg2)" : ss.rowBg,
                          opacity: dragId === e.id ? 0.45 : 1, transition: "background 0.15s",
                          cursor: canEdit && !isEditing ? "grab" : "default",
                          flexWrap: isEditing ? "wrap" : "nowrap",
                        }}
                      >
                        {canEdit && !isEditing && <span style={{ color: "var(--border)", fontSize: 13, userSelect: "none", flexShrink: 0 }}>⠿</span>}
                        {isEditing ? (
                          <>
                            <input value={e.service} onChange={ev => updateExpense(e.id, "service", ev.target.value)}
                              style={{ flex: 2, minWidth: 120, background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }} />
                            <input type="number" value={e.cost} onChange={ev => updateExpense(e.id, "cost", parseFloat(ev.target.value) || 0)}
                              style={{ flex: 1, minWidth: 80, background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }} />
                            <select value={e.category} onChange={ev => updateExpense(e.id, "category", ev.target.value)}
                              style={{ flex: 1, minWidth: 110, background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
                              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                            <button onClick={() => setEditingId(null)} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Klar ✓</button>
                          </>
                        ) : (
                          <>
                            {canEdit && <button onClick={() => updateExpense(e.id, "hidden", !e.hidden)}
                              style={{ background: "none", border: "none", fontSize: 15, cursor: "pointer", color: e.hidden ? "#cbd5e1" : "var(--text2)", padding: "2px 4px", flexShrink: 0, opacity: e.hidden ? 0.5 : 0.7, transition: "opacity 0.15s" }}
                              title={e.hidden ? "Visa i beräkning" : "Dölj från beräkning"}>
                              {e.hidden ? "🙈" : "👁️"}
                            </button>}
                            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text)", minWidth: 0, opacity: e.hidden ? 0.4 : 1, textDecoration: e.hidden ? "line-through" : "none", transition: "opacity 0.2s" }}>
                              {e.service}
                              {e.hidden && <span style={{ marginLeft: 7, fontSize: 10, background: "#f1f5f9", color: "#94a3b8", borderRadius: 99, padding: "1px 7px", fontWeight: 700, verticalAlign: "middle" }}>Dold</span>}
                              {e.temporary && <span style={{ marginLeft: 7, fontSize: 10, background: "#fdf4ff", color: "#9333ea", border: "1px solid #e9d5ff", borderRadius: 99, padding: "1px 7px", fontWeight: 700, verticalAlign: "middle" }}>🕐 Tillfällig</span>}
                              {linkedDebt && (linkedDebt.remaining <= 0
                                ? <span style={{ marginLeft: 7, fontSize: 10, background: "#d1fae5", color: "#10b981", borderRadius: 99, padding: "1px 7px", fontWeight: 700, verticalAlign: "middle" }}>✅ {linkedDebt.name} – frigjord!</span>
                                : <span style={{ marginLeft: 7, fontSize: 10, background: "#fef3c7", color: "#b45309", borderRadius: 99, padding: "1px 7px", fontWeight: 700, verticalAlign: "middle" }}>🔗 {linkedDebt.name}</span>
                              )}
                              {(e.skipMonths && e.skipMonths.length > 0) && <span style={{ marginLeft: 7, fontSize: 10, background: "#fef3c7", color: "#92400e", borderRadius: 99, padding: "1px 7px", fontWeight: 700, verticalAlign: "middle" }}>⏸ Pausad {e.skipMonths.length} mån</span>}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flexShrink: 0, opacity: e.hidden ? 0.4 : 1 }}>{formatSEK(e.cost)}</span>
                            {canEdit && <button onClick={() => cycleStatus(e)} style={{ background: ss.rowBg || "var(--bg2)", border: `1px solid ${ss.dot}44`, borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: ss.dot, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>{ss.label}</button>}
                            {canEdit && <>
                              <button onClick={() => setEditingId(e.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "var(--text2)", padding: "2px 4px", flexShrink: 0 }}>✎</button>
                              <button onClick={() => deleteExpense(e.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: "#ef444480", padding: "2px 4px", flexShrink: 0 }}>✕</button>
                              <button onClick={() => setLinkingId(isLinking ? null : e.id)} style={{ background: "none", border: "none", fontSize: 12, cursor: "pointer", color: e.debtLink ? "#f59e0b" : "var(--text2)", padding: "2px 4px", flexShrink: 0 }} title="Länka till skuld">🔗</button>
                              <button onClick={() => setSkipMonthsId(skipMonthsId === e.id ? null : e.id)} style={{ background: "none", border: "none", fontSize: 12, cursor: "pointer", color: (e.skipMonths && e.skipMonths.length > 0) ? "#f59e0b" : "var(--text2)", padding: "2px 4px", flexShrink: 0 }} title="Pausa specifika månader">📅</button>
                            </>}
                          </>
                        )}
                      </div>
                      {isLinking && (
                        <div style={{ padding: "10px 18px", background: "var(--bg2)", borderBottom: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginRight: 4 }}>Länka till skuld:</span>
                          <button onClick={() => { updateExpense(e.id, "debtLink", null); setLinkingId(null); }}
                            style={{ padding: "5px 12px", borderRadius: 99, border: `1.5px solid ${!e.debtLink ? "#64748b" : "var(--border)"}`, background: !e.debtLink ? "#f1f5f9" : "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--text2)", fontFamily: "inherit" }}>Ingen länk</button>
                          {debts.map(d => (
                            <button key={d.id} onClick={() => { updateExpense(e.id, "debtLink", d.id); setLinkingId(null); }}
                              style={{ padding: "5px 12px", borderRadius: 99, border: `1.5px solid ${e.debtLink === d.id ? "#f59e0b" : "var(--border)"}`, background: e.debtLink === d.id ? "#fef3c7" : "transparent", fontSize: 12, fontWeight: 600, cursor: "pointer", color: e.debtLink === d.id ? "#b45309" : "var(--text)", fontFamily: "inherit" }}>
                              {d.name} — {formatSEK(d.remaining)} kvar
                            </button>
                          ))}
                        </div>
                      )}
                      {skipMonthsId === e.id && (
                        <div style={{ padding: "10px 18px", background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>Pausa i vilka månader? (fakturan räknas inte dessa månader)</div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {Array.from({ length: 12 }, (_, mi) => {
                              const d2 = new Date();
                              const md = new Date(d2.getFullYear(), d2.getMonth() + mi, 1);
                              const mk = `${md.getFullYear()}-${String(md.getMonth()+1).padStart(2,"0")}`;
                              const active = (e.skipMonths || []).includes(mk);
                              return (
                                <button key={mk} onClick={() => toggleSkipMonth(e.id, mk)}
                                  style={{ padding: "4px 10px", borderRadius: 99, border: `1.5px solid ${active ? "#f59e0b" : "var(--border)"}`, background: active ? "#fef3c7" : "transparent", fontSize: 11, fontWeight: 600, cursor: "pointer", color: active ? "#92400e" : "var(--text2)", fontFamily: "inherit", textTransform: "capitalize" }}>
                                  {md.toLocaleDateString("sv-SE", { month: "short", year: "2-digit" })}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {canEdit && (
          <button onClick={() => setShowAdd(true)}
            style={{ marginTop: 10, width: "100%", background: "var(--card)", border: "2px dashed var(--border)", borderRadius: 16, padding: "16px", fontSize: 14, fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#3b82f6"; e.currentTarget.style.color="#3b82f6"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text2)"; }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Lägg till post
          </button>
        )}
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setExpenses(es => es.filter(e => !e.temporary).map(e => ({ ...e, status: "unpaid" })))}
            style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            🔄 Återställ till ny månad
          </button>
        </div>
      </>)}

      {/* ══════════ PLANERADE TAB ══════════ */}
      {budgetTab === "planned" && (<>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[{ label: "Antal planerade", value: `${plannedExpenses.length} st`, color: "#8b5cf6" }, { label: "Total summa", value: formatSEK(plannedTotal), color: "#f59e0b" }].map(s => (
            <div key={s.label} style={{ background: "var(--card)", borderRadius: 16, padding: "16px 20px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", borderRadius: 14, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18 }}>🗓</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#5b21b6" }}>Planerade engångskostnader</div>
            <div style={{ fontSize: 12, color: "#6d28d9", marginTop: 2, lineHeight: 1.5 }}>Framtida kostnader som 30-dagars fakturor och bokade köp. De syns direkt i <strong>Prognosen</strong> på rätt <strong>löneperiod</strong> (före 25:e = förra lönen) och flyttas automatiskt till Budget som en tillfällig post när datumet och klockslaget infaller.</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {plannedSorted.length === 0 && (
            <div style={{ textAlign: "center", padding: "50px 0", color: "var(--text2)" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🗓</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Inga planerade kostnader</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Lägg till framtida engångskostnader nedan</div>
            </div>
          )}
          {plannedSorted.map(p => {
            const due = new Date(p.dueDate);
            const isPast = due <= now;
            const daysLeft = Math.ceil((due - now) / 86400000);
            const meta = CATEGORY_META[p.category] || CATEGORY_META["Övrigt"];
            const salaryMonthKey = getSalaryMonthKeyForDate(due);
            const [salaryYear, salaryMonth] = salaryMonthKey.split("-").map(Number);
            const salaryMonthLabel = new Date(salaryYear, salaryMonth - 1, 1).toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
            return (
              <div key={p.id} style={{
                background: isPast ? "#fff5f5" : "var(--card)", borderRadius: 14, padding: "14px 18px",
                border: `1px solid ${isPast ? "#fca5a5" : "var(--border)"}`,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: meta.color+"18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{p.service}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>📅 {due.toLocaleDateString("sv-SE",{day:"numeric",month:"short",year:"numeric"})} {due.toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"})}</span>
                    <span style={{ color: meta.color, fontWeight: 600 }}>{p.category}</span>
                    {p.note && <span style={{ fontStyle: "italic" }}>"{p.note}"</span>}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {isPast
                      ? <span style={{ fontSize: 11, background: "#fee2e2", color: "#ef4444", borderRadius: 99, padding: "2px 8px", fontWeight: 700 }}>⚠ Förfallen – väntar på flytt</span>
                      : daysLeft <= 7
                        ? <span style={{ fontSize: 11, background: "#fef3c7", color: "#b45309", borderRadius: 99, padding: "2px 8px", fontWeight: 700 }}>⏰ Om {daysLeft} dag{daysLeft !== 1 ? "ar" : ""}</span>
                        : <span style={{ fontSize: 11, background: "#ede9fe", color: "#7c3aed", borderRadius: 99, padding: "2px 8px", fontWeight: 600, textTransform: "capitalize" }}>💰 Påverkar {salaryMonthLabel}</span>
                    }
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b", flexShrink: 0 }}>{formatSEK(p.cost)}</div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {isPast && <button onClick={() => promoteNow(p)} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>→ Flytta nu</button>}
                    <button onClick={() => deletePlanned(p.id)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#ef444480", padding: "2px 6px" }}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {canEdit && (
          <button onClick={() => setShowAddPlanned(true)}
            style={{ width: "100%", background: "var(--card)", border: "2px dashed #8b5cf660", borderRadius: 16, padding: "16px", fontSize: 14, fontWeight: 600, color: "#8b5cf6", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#8b5cf6"; e.currentTarget.style.background="#faf5ff"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#8b5cf660"; e.currentTarget.style.background="var(--card)"; }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Lägg till planerad kostnad
          </button>
        )}
      </>)}

      {/* ══════════ SITTANDE / RECURRING TAB ══════════ */}
      {budgetTab === "recurring" && (<>
        <div style={{ background: "linear-gradient(135deg,#dbeafe,#bfdbfe)", borderRadius: 14, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18 }}>🔁</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af" }}>Sittande fakturor</div>
            <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 2, lineHeight: 1.5 }}>Löpande kostnader som börjar från ett visst datum och räknas in varje månad framöver. T.ex. en ny prenumeration som startar mars – den påverkar alla lönemånader from startdatumet.</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Antal sittande", value: `${recurringExpenses.length} st`, color: "#3b82f6" },
            { label: "Total summa/mån", value: formatSEK(recurringExpenses.filter(r => !r.hidden).reduce((s, r) => s + r.cost, 0)), color: "#ef4444" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--card)", borderRadius: 16, padding: "16px 20px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {recurringExpenses.length === 0 && (
            <div style={{ textAlign: "center", padding: "50px 0", color: "var(--text2)" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔁</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Inga sittande fakturor</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Lägg till löpande kostnader som gäller from ett visst datum</div>
            </div>
          )}
          {[...recurringExpenses].sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "")).map(r => {
            const salaryKey = r.startDate ? getSalaryMonthKeyForDate(r.startDate) : "";
            const [sy, sm] = salaryKey ? salaryKey.split("-").map(Number) : [0, 0];
            const salaryLabel = salaryKey ? new Date(sy, sm - 1, 1).toLocaleDateString("sv-SE", { month: "long", year: "numeric" }) : "–";
            const meta = (CATEGORY_META || {})[r.category] || { icon: "📦", color: "#94a3b8" };
            return (
              <div key={r.id} style={{
                background: r.hidden ? "var(--bg2)" : "var(--card)", borderRadius: 14, padding: "14px 18px",
                border: `1px solid ${r.hidden ? "var(--border)" : meta.color + "44"}`,
                display: "flex", alignItems: "center", gap: 12,
                opacity: r.hidden ? 0.55 : 1, transition: "opacity 0.2s",
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: meta.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textDecoration: r.hidden ? "line-through" : "none" }}>{r.service}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>📅 Från {r.startDate ? new Date(r.startDate).toLocaleDateString("sv-SE") : "–"}</span>
                    <span style={{ color: meta.color, fontWeight: 600 }}>{r.category}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", borderRadius: 99, padding: "2px 8px", fontWeight: 600, textTransform: "capitalize" }}>💰 From {salaryLabel}</span>
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#ef4444", flexShrink: 0 }}>{formatSEK(r.cost)}</div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setRecurringExpenses(rs => rs.map(x => x.id === r.id ? { ...x, hidden: !x.hidden } : x))}
                      style={{ background: "none", border: "none", fontSize: 15, cursor: "pointer", color: r.hidden ? "#cbd5e1" : "var(--text2)", padding: "2px 4px" }}
                      title={r.hidden ? "Visa" : "Dölj"}>
                      {r.hidden ? "🙈" : "👁️"}
                    </button>
                    <button onClick={() => setRecurringExpenses(rs => rs.filter(x => x.id !== r.id))}
                      style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#ef444480", padding: "2px 6px" }}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {canEdit && !showAddRecurring && (
            <button onClick={() => setShowAddRecurring(true)}
              style={{ width: "100%", background: "var(--card)", border: "2px dashed #3b82f660", borderRadius: 16, padding: "16px", fontSize: 14, fontWeight: 600, color: "#3b82f6", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#3b82f6"; e.currentTarget.style.background="#eff6ff"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="#3b82f660"; e.currentTarget.style.background="var(--card)"; }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Lägg till sittande faktura
            </button>
        )}
        {canEdit && showAddRecurring && (
            <div style={{ background: "var(--card)", borderRadius: 16, padding: "20px", border: "2px solid #3b82f6" }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>🔁 Ny sittande faktura</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Namn</label>
                  <input autoFocus placeholder="t.ex. Spotify, Gym..." value={newRec.service}
                    onChange={e => setNewRec(n => ({ ...n, service: e.target.value }))}
                    style={{ width: "100%", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 15, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Kostnad (kr/mån)</label>
                  <input type="number" placeholder="0" value={newRec.cost}
                    onChange={e => setNewRec(n => ({ ...n, cost: e.target.value }))}
                    style={{ width: "100%", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 15, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Startdatum (from)</label>
                  <input type="date" value={newRec.startDate}
                    onChange={e => setNewRec(n => ({ ...n, startDate: e.target.value }))}
                    style={{ width: "100%", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                  {newRec.startDate && (() => {
                    const sk = getSalaryMonthKeyForDate(newRec.startDate);
                    const [sy2, sm2] = sk.split("-").map(Number);
                    const label = new Date(sy2, sm2 - 1, 1).toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
                    return <div style={{ fontSize: 11, color: "#1d4ed8", marginTop: 4 }}>💰 Räknas from <strong style={{ textTransform: "capitalize" }}>{label}</strong> löneperiod</div>;
                  })()}
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Kategori</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {CATEGORIES.map(c => { const m = CATEGORY_META[c] || { icon: "📦", color: "#94a3b8" }; const sel = newRec.category === c; return (
                      <button key={c} onClick={() => setNewRec(n => ({ ...n, category: c }))}
                        style={{ padding: "6px 12px", borderRadius: 99, border: `1.5px solid ${sel ? m.color : "var(--border)"}`, background: sel ? m.color + "18" : "transparent", color: sel ? m.color : "var(--text2)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                        <span>{m.icon}</span>{c}
                      </button>
                    ); })}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowAddRecurring(false)} className="btn btn-ghost" style={{ flex: 1, padding: "11px" }}>Avbryt</button>
                <button onClick={() => {
                  if (!newRec.service.trim() || !newRec.cost || !newRec.startDate) return;
                  setRecurringExpenses(rs => [...rs, {
                    id: Date.now(), service: newRec.service.trim(),
                    cost: parseFloat(newRec.cost), category: newRec.category,
                    startDate: newRec.startDate, hidden: false,
                  }]);
                  setNewRec({ service: "", cost: "", category: "Övrigt", startDate: "" });
                  setShowAddRecurring(false);
                }} style={{ flex: 2, padding: "11px", fontSize: 15, background: "#3b82f6", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Spara ＋</button>
              </div>
            </div>
        )}
      </>)}

      {/* ══════════ MODAL: Ny budget-post ══════════ */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={ev => ev.stopPropagation()} style={{ width: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Ny post</div>
              <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", fontSize: 20, color: "var(--text2)", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Namn</label>
                <input autoFocus placeholder="t.ex. Netflix, Hyra..." value={newExp.service}
                  onChange={e => setNewExp(n => ({ ...n, service: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") addExpense(); }}
                  style={{ width: "100%", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 15, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Kostnad (kr)</label>
                <input type="number" placeholder="0" value={newExp.cost}
                  onChange={e => setNewExp(n => ({ ...n, cost: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") addExpense(); }}
                  style={{ width: "100%", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 15, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Kategori</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CATEGORIES.map(c => { const m = CATEGORY_META[c]||CATEGORY_META["Övrigt"]; const sel = newExp.category===c; return (
                    <button key={c} onClick={() => setNewExp(n => ({ ...n, category: c }))}
                      style={{ padding: "6px 12px", borderRadius: 99, border: `1.5px solid ${sel?m.color:"var(--border)"}`, background: sel?m.color+"18":"transparent", color: sel?m.color:"var(--text2)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                      <span>{m.icon}</span>{c}
                    </button>
                  ); })}
                  <button onClick={() => setEditCat({ name: "", icon: "📦", color: "#94a3b8", originalName: null, onCreate: true })}
                    style={{ padding: "6px 12px", borderRadius: 99, border: "1.5px dashed var(--border)", background: "transparent", color: "var(--text2)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                    + Ny kategori
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Status</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ id:"unpaid",label:"Obetald",activeBg:"#f1f5f9",color:"#64748b"},{id:"autogiro",label:"Autogiro",activeBg:"#fef3c7",color:"#b45309"},{id:"paid",label:"Betald",activeBg:"#bbf7d0",color:"#15803d"}].map(s => (
                    <button key={s.id} onClick={() => setNewExp(n => ({ ...n, status: s.id }))}
                      style={{ flex: 1, padding: "9px", borderRadius: 10, border: `1.5px solid ${newExp.status===s.id?s.color:"var(--border)"}`, background: newExp.status===s.id?s.activeBg:"transparent", color: newExp.status===s.id?s.color:"var(--text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div onClick={() => setNewExp(n => ({ ...n, temporary: !n.temporary }))}
                style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:`1.5px solid ${newExp.temporary?"#9333ea":"var(--border)"}`,background:newExp.temporary?"#fdf4ff":"var(--bg2)",cursor:"pointer",userSelect:"none" }}>
                <div style={{ width:36,height:20,borderRadius:99,background:newExp.temporary?"#9333ea":"var(--border)",position:"relative",transition:"background 0.2s",flexShrink:0 }}>
                  <div style={{ position:"absolute",top:2,left:newExp.temporary?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <div>
                  <div style={{ fontSize:13,fontWeight:700,color:newExp.temporary?"#9333ea":"var(--text)" }}>🕐 Tillfällig faktura</div>
                  <div style={{ fontSize:11,color:"var(--text2)",marginTop:1 }}>Räknas in denna månad men tas bort vid månadsåterställning</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowAdd(false)} className="btn btn-ghost" style={{ flex: 1, padding: "11px" }}>Avbryt</button>
              <button onClick={addExpense} className="btn btn-primary" style={{ flex: 2, padding: "11px", fontSize: 15 }}>Lägg till ＋</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL: Planerad kostnad ══════════ */}
      {showAddPlanned && (
        <div className="modal-overlay" onClick={() => { setShowAddPlanned(false); setPlannedErrors({}); const nd=new Date(); setDueDateParts({year:nd.getFullYear(),month:nd.getMonth()+1,day:nd.getDate(),hour:9,minute:0}); }}>
          <div className="modal" onClick={ev => ev.stopPropagation()} style={{ width: 460 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>🗓 Planerad kostnad</div>
              <button onClick={() => { setShowAddPlanned(false); setPlannedErrors({}); const nd=new Date(); setDueDateParts({year:nd.getFullYear(),month:nd.getMonth()+1,day:nd.getDate(),hour:9,minute:0}); }} style={{ background: "none", border: "none", fontSize: 20, color: "var(--text2)", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Namn</label>
                <input autoFocus placeholder="t.ex. Hotell, Faktura Inet, TV…" value={newPlanned.service}
                  onChange={e => { setNewPlanned(n => ({ ...n, service: e.target.value })); setPlannedErrors(v => ({ ...v, service: undefined })); }}
                  style={{ width: "100%", background: "var(--bg2)", border: `1.5px solid ${plannedErrors.service?"#ef4444":"var(--border)"}`, borderRadius: 10, padding: "10px 14px", fontSize: 15, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                {plannedErrors.service && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{plannedErrors.service}</div>}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Belopp (kr)</label>
                <input type="number" placeholder="0" value={newPlanned.cost}
                  onChange={e => { setNewPlanned(n => ({ ...n, cost: e.target.value })); setPlannedErrors(v => ({ ...v, cost: undefined })); }}
                  style={{ width: "100%", background: "var(--bg2)", border: `1.5px solid ${plannedErrors.cost?"#ef4444":"var(--border)"}`, borderRadius: 10, padding: "10px 14px", fontSize: 15, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                {plannedErrors.cost && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{plannedErrors.cost}</div>}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Förfallodatum &amp; tid</label>
                <CalendarPicker
                  parts={dueDateParts}
                  setParts={(p) => { setDueDateParts(p); setPlannedErrors(v=>({...v,dueDate:undefined})); }}
                  error={!!plannedErrors.dueDate}
                />
                {plannedErrors.dueDate && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{plannedErrors.dueDate}</div>}
                <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>Fakturan flyttas automatiskt till Budget vid detta klockslag.</div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Kategori</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CATEGORIES.map(c => { const m = CATEGORY_META[c]||CATEGORY_META["Övrigt"]; const sel = newPlanned.category===c; return (
                    <button key={c} onClick={() => setNewPlanned(n => ({ ...n, category: c }))}
                      style={{ padding: "6px 12px", borderRadius: 99, border: `1.5px solid ${sel?m.color:"var(--border)"}`, background: sel?m.color+"18":"transparent", color: sel?m.color:"var(--text2)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                      <span>{m.icon}</span>{c}
                    </button>
                  ); })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Anteckning (valfri)</label>
                <input placeholder="t.ex. 30 dagars kredit hos Elgiganten…" value={newPlanned.note}
                  onChange={e => setNewPlanned(n => ({ ...n, note: e.target.value }))}
                  style={{ width: "100%", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => { setShowAddPlanned(false); setPlannedErrors({}); const nd=new Date(); setDueDateParts({year:nd.getFullYear(),month:nd.getMonth()+1,day:nd.getDate(),hour:9,minute:0}); }} className="btn btn-ghost" style={{ flex: 1, padding: "11px" }}>Avbryt</button>
              <button onClick={addPlanned} style={{ flex: 2, padding: "11px", fontSize: 15, background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Spara planerad ＋</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// INCOME PAGE — helper component
function AddMonthRow({ onAdd }) {
  const [addY, setAddY] = useState(new Date().getFullYear());
  const [addM, setAddM] = useState("");
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
      <select value={addY} onChange={e => setAddY(Number(e.target.value))}
        style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
        {[-1,0,1,2].map(d => { const y = new Date().getFullYear()+d; return <option key={y} value={y}>{y}</option>; })}
      </select>
      <select value={addM} onChange={e => setAddM(e.target.value)}
        style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
        <option value="">Välj månad...</option>
        {MONTH_NAMES.map((n, i) => {
          const mk = `${addY}-${String(i+1).padStart(2,"0")}`;
          return <option key={mk} value={mk}>{n} {addY}</option>;
        })}
      </select>
      <button onClick={() => { if (addM) { onAdd(addM); setAddM(""); } }}
        className="btn btn-primary" style={{ fontSize: 12, padding: "6px 14px", flexShrink: 0 }}>+ Lägg till månad</button>
    </div>
  );
}

// ============================================================
// INCOME PAGE
// ============================================================
function IncomePage({ income, setIncome, extraIncome, setExtraIncome, beredskap, setBeredskap, canEdit, futureSalaries, setFutureSalaries, pushUndo = () => {}, monthSchedule = {}, setMonthSchedule = () => {}, appTexts = {} }) {
  const [showAddExtra,  setShowAddExtra]  = useState(false);
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // monthKey of open dropdown

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e) => {
      const target = e.target;
      if (target instanceof Element && target.closest('[data-income-schedule-dropdown="true"]')) return;
      setOpenDropdown(null);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [openDropdown]);
  const [newExtra, setNewExtra] = useState(() => {
    const d = new Date();
    return { name: "", amount: 0, month: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, emoji: "⭐", color: "#f59e0b" };
  });
  const [newBeredskap, setNewBeredskap] = useState({ type: "Hel", payoutMonth: "" });

  const currentSalary = income.find(i => i.type === "salary");
  const nowIncome = new Date();
  const curMonthKey = `${nowIncome.getFullYear()}-${String(nowIncome.getMonth() + 1).padStart(2, "0")}`;

  const beredskapTypes = appTexts.beredskapTypes || [];
  const SCHED_TYPES = beredskapTypes.map(t => t.key);

  // Resolve effective salary for any month using beredskapTypes
  function resolveMonthSalaryLocal(monthKey) {
    // Check for manual amount override first
    const override = monthSchedule[monthKey + "_amount"];
    if (override != null && override !== "") return Number(override);
    const schedKey = monthSchedule[monthKey];
    const base = currentSalary?.amount || 0;
    if (!schedKey) return base;
    const found = beredskapTypes.find(t => t.key === schedKey);
    if (found) return Number(found.amount);
    return base;
  }

  // Build list of 12 months (current - 3 to current + 8)
  const schedMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(nowIncome.getFullYear(), nowIncome.getMonth() - 2 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  });

  function fmtMonth(ym) {
    if (!ym) return "–";
    const [y, m] = ym.split("-");
    return new Date(+y, +m - 1, 1).toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  }

  function updateIncome(id, field, value) {
    setIncome(is => is.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

    const iStyle = { width: "100%", background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "7px 10px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 8 };
  const lStyle = { fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 };

  const totalMonthly = resolveMonthSalaryLocal(curMonthKey)
    + income.filter(i => i.type !== "salary").reduce((s, i) => s + i.amount, 0)
    + extraIncome.filter(e => e.month === curMonthKey).reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      {/* Total header */}
      <div style={{ background: "linear-gradient(135deg, #064e3b, #10b981)", borderRadius: 20, padding: "20px 28px", marginBottom: 24, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total månadsinkomst</div>
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 4 }}>{formatSEK(totalMonthly)}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 14, opacity: 0.85 }}>
          <div>Lön denna månad: {formatSEK(resolveMonthSalaryLocal(curMonthKey))}</div>
          <div>Övrigt: {formatSEK(extraIncome.filter(e => e.month === curMonthKey).reduce((s, e) => s + e.amount, 0))}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

        {/* ── 💼 Löneschema månad för månad ── */}
        <Card style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>💼 Lön & Beredskapsschema</div>
            <div style={{ fontSize: 12, color: "var(--text2)" }}>
              Grundlön: <strong style={{ color: "var(--text)" }}>{formatSEK(currentSalary?.amount || 0)}</strong>
              {" · "}Ändra direkt i fältet nedan
            </div>
          </div>

          {/* Base salary inline edit */}
          {currentSalary && canEdit && (
            <div style={{ background: "var(--bg2)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, border: "2px solid #10b981", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981", flexShrink: 0 }}>Grundlön (kr):</span>
              <InlineEdit value={currentSalary.amount} onChange={v => updateIncome(currentSalary.id, "amount", parseFloat(v) || 0)} />
              <span style={{ fontSize: 11, color: "var(--text2)" }}>= Grundlön i schemat</span>
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                {monthSchedule[curMonthKey + "_amount"] != null && monthSchedule[curMonthKey + "_amount"] !== "" ? (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>Override: {formatSEK(Number(monthSchedule[curMonthKey + "_amount"]))}</span>
                    <button onClick={() => setMonthSchedule(s => { const ns = { ...s }; delete ns[curMonthKey + "_amount"]; return ns; })}
                      style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕ Ta bort</button>
                  </>
                ) : (
                  <button onClick={() => {
                    const val = prompt("Ange override-lön för denna månad (kr):", String(resolveMonthSalaryLocal(curMonthKey)));
                    if (val != null && val !== "") setMonthSchedule(s => ({ ...s, [curMonthKey + "_amount"]: parseFloat(val) || 0 }));
                  }}
                    style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    ✏️ Override
                  </button>
                )}
              </span>
            </div>
          )}

          {/* Month schedule — add/remove freely */}
          {(() => {
            const btypes = appTexts.beredskapTypes || [];
            const COLORS = Object.fromEntries(btypes.map(t => [t.key, t.color]));
            const allMonths = Object.keys(monthSchedule)
              .filter(k => /^\d{4}-\d{2}$/.test(k))
              .sort();
            // Always show current month even if not in schedule
            const monthsToShow = allMonths.includes(curMonthKey) ? allMonths : [...allMonths, curMonthKey].sort();

            // Helper to get year-month string from +/- offset
            function mkOffset(base, delta) {
              const [y, m] = base.split("-").map(Number);
              const d = new Date(y, m - 1 + delta, 1);
              return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
            }

            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, marginBottom: 10 }}>
                  {monthsToShow.map(mk => {
                    const isCurrent = mk === curMonthKey;
                    const selected = monthSchedule[mk] || null;
                    const resolved = resolveMonthSalaryLocal(mk);
                    const col = selected ? (COLORS[selected] || "#3b82f6") : "#94a3b8";
                    return (
                      <div key={mk} style={{ borderRadius: 12, border: "2px solid " + (isCurrent ? col : "var(--border)"), background: isCurrent ? col + "12" : "var(--bg2)", padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? col : "var(--text2)", textTransform: "capitalize" }}>
                            {fmtMonth(mk)}{isCurrent && " ✦"}
                          </div>
                          {canEdit && mk !== curMonthKey && (
                            <button onClick={() => setMonthSchedule(s => Object.fromEntries(Object.entries(s).filter(([k]) => k !== mk && k !== (mk + "_amount"))))}
                              style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>✕</button>
                          )}
                        </div>
                        {canEdit ? (() => {
                          const btypes = appTexts.beredskapTypes || [];
                          const isOpen = openDropdown === mk;
                          const selType = btypes.find(t => t.key === selected);
                          const meta = selType || { icon: "💼", color: "#94a3b8", name: "Grundlön" };
                          const GROUP_LABELS = { bas: "💼 Grundlön & Semester", enkel: "🛡 Beredskap", nylon: "📈 Ny lön", dubbel: "⚡ Dubbel beredskap", dubbel_ny: "⚡ Dubbel – Ny lön" };
                          const groupOrder = ["bas", "enkel", "nylon", "dubbel", "dubbel_ny"];
                          const grouped = groupOrder.map(g => ({ g, items: btypes.filter(t => t.group === g) })).filter(x => x.items.length);
                          return (
                            <div data-income-schedule-dropdown="true" style={{ position: "relative" }}>
                              <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(isOpen ? null : mk); }}
                                style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, background: meta.color + "18", border: `1.5px solid ${meta.color}55`, borderRadius: 9, padding: "6px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: meta.color, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.name}</span>
                                <span style={{ fontSize: 9, color: meta.color, opacity: 0.7 }}>{isOpen ? "▲" : "▼"}</span>
                              </button>
                              {isOpen && (
                                <div onClick={e => e.stopPropagation()}
                                  style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100, background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", overflow: "hidden", minWidth: 220, maxHeight: 320, overflowY: "auto" }}>
                                  {grouped.map(({ g, items }) => (
                                    <div key={g}>
                                      <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 12px 3px", background: "var(--bg2)", position: "sticky", top: 0 }}>{GROUP_LABELS[g] || g}</div>
                                      {items.map(t => {
                                        const isSelected = selected === t.key;
                                        return (
                                          <button key={t.key} onClick={() => { setMonthSchedule(s => { const ns = { ...s, [mk]: t.key }; delete ns[mk + "_amount"]; return ns; }); setOpenDropdown(null); }}
                                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: isSelected ? t.color + "14" : "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                                            <div style={{ width: 28, height: 28, borderRadius: 7, background: t.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{t.icon}</div>
                                            <div style={{ flex: 1, textAlign: "left" }}>
                                              <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? t.color : "var(--text)" }}>{t.name}</div>
                                              <div style={{ fontSize: 10, color: t.color, fontWeight: 600 }}>{Number(t.amount).toLocaleString("sv-SE")} kr</div>
                                            </div>
                                            {isSelected && <span style={{ fontSize: 12, color: t.color }}>✓</span>}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          <div style={{ fontSize: 12, fontWeight: 600, color: col }}>{selType?.name || "Grundlön"}</div>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 800, color: col, marginTop: 6 }}>
                          {canEdit ? (
                            <InlineEdit
                              value={resolved}
                              type="number"
                              onChange={v => {
                                const num = parseFloat(v) || 0;
                                // Store override amount in monthSchedule as _amountOverride
                                setMonthSchedule(s => ({ ...s, [mk + "_amount"]: num }));
                              }}
                              prefix="kr"
                            />
                          ) : formatSEK(resolved)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add month picker */}
                {canEdit && <AddMonthRow onAdd={mk => setMonthSchedule(s => ({ ...s, [mk]: s[mk] || "" }))} />}
              </div>
            );
          })()}


          {/* Non-salary incomes */}
          {income.filter(i => i.type !== "salary").length > 0 && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Övrig fast inkomst</div>
              {income.filter(i => i.type !== "salary").map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {canEdit ? <InlineEdit value={i.name} onChange={v => updateIncome(i.id, "name", v)} /> : i.name}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#10b981" }}>
                    {canEdit ? <InlineEdit value={i.amount} onChange={v => updateIncome(i.id, "amount", parseFloat(v) || 0)} /> : formatSEK(i.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ══ EXTRA INKOMST MODAL ══ */}
        {showExtraModal && (() => {
          const PRESET_COLORS = ["#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#ec4899","#f97316","#06b6d4","#84cc16","#14b8a6","#a855f7","#0ea5e9","#fb923c","#e11d48","#94a3b8"];
          const PRESET_EMOJIS = ["⭐","💰","🌴","🎁","🏆","💼","🎓","🔧","🎵","🏋️","✈️","🐾","🍕","☕","📚","🚗","🏥","👕","💡","🎮","🌟","💎","🛠","📸","🤝"];
          return (
            <div className="modal-overlay" onClick={() => setShowExtraModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>➕ Ny extra inkomst</div>
                  <button onClick={() => setShowExtraModal(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text2)" }}>✕</button>
                </div>

                {/* Live preview */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: (newExtra.color || "#f59e0b") + "18", border: `2px solid ${newExtra.color || "#f59e0b"}`, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: (newExtra.color || "#f59e0b") + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{newExtra.emoji || "⭐"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: newExtra.color || "#f59e0b" }}>{newExtra.name || "Namn på inkomst"}</div>
                    <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 1 }}>{fmtMonth(newExtra.month)} · {newExtra.amount ? Number(newExtra.amount).toLocaleString("sv-SE") + " kr" : "0 kr"}</div>
                  </div>
                </div>

                {/* Name */}
                <div style={{ marginBottom: 14 }}>
                  <label style={lStyle}>Namn</label>
                  <input value={newExtra.name} onChange={e => setNewExtra(n => ({ ...n, name: e.target.value }))}
                    placeholder="t.ex. Frilansuppdrag"
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }} />
                </div>

                {/* Amount */}
                <div style={{ marginBottom: 14 }}>
                  <label style={lStyle}>Belopp (kr)</label>
                  <input type="number" value={newExtra.amount} onChange={e => setNewExtra(n => ({ ...n, amount: e.target.value }))}
                    placeholder="0"
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }} />
                </div>

                {/* Month */}
                <div style={{ marginBottom: 14 }}>
                  <label style={lStyle}>Månad</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={newExtra.month ? newExtra.month.split("-")[1] : ""}
                      onChange={e => { const y = newExtra.month ? newExtra.month.split("-")[0] : String(new Date().getFullYear()); setNewExtra(n => ({ ...n, month: y + "-" + e.target.value })); }}
                      style={{ flex: 1, background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
                      <option value="">Månad</option>
                      {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m,i) => <option key={m} value={m}>{["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"][i]}</option>)}
                    </select>
                    <select value={newExtra.month ? newExtra.month.split("-")[0] : String(new Date().getFullYear())}
                      onChange={e => { const m = newExtra.month ? newExtra.month.split("-")[1] : ""; setNewExtra(n => ({ ...n, month: m ? e.target.value + "-" + m : "" })); }}
                      style={{ flex: "0 0 90px", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }}>
                      {[0,1,2,3].map(i => { const y = String(new Date().getFullYear() + i - 1); return <option key={y} value={y}>{y}</option>; })}
                    </select>
                  </div>
                </div>

                {/* Emoji picker */}
                <div style={{ marginBottom: 14 }}>
                  <label style={lStyle}>Emoji</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {PRESET_EMOJIS.map(em => (
                      <button key={em} onClick={() => setNewExtra(n => ({ ...n, emoji: em }))}
                        style={{ fontSize: 20, padding: "5px 7px", borderRadius: 8, border: `2px solid ${newExtra.emoji === em ? (newExtra.color || "#f59e0b") : "transparent"}`, background: newExtra.emoji === em ? (newExtra.color || "#f59e0b") + "20" : "var(--bg2)", cursor: "pointer", lineHeight: 1 }}>
                        {em}
                      </button>
                    ))}
                  </div>
                  <input value={newExtra.emoji} onChange={e => setNewExtra(n => ({ ...n, emoji: e.target.value }))}
                    placeholder="Eller skriv valfri emoji…"
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 18, fontFamily: "inherit", outline: "none", color: "var(--text)" }} />
                </div>

                {/* Color picker */}
                <div style={{ marginBottom: 24 }}>
                  <label style={lStyle}>Färg</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    {PRESET_COLORS.map(col => (
                      <button key={col} onClick={() => setNewExtra(n => ({ ...n, color: col }))}
                        style={{ width: 28, height: 28, borderRadius: 99, background: col, border: `3px solid ${newExtra.color === col ? "var(--text)" : "transparent"}`, cursor: "pointer", transition: "border 0.1s" }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="color" value={newExtra.color || "#f59e0b"} onChange={e => setNewExtra(n => ({ ...n, color: e.target.value }))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid var(--border)", cursor: "pointer", padding: 2 }} />
                    <span style={{ fontSize: 12, color: "var(--text2)", fontFamily: "monospace" }}>{newExtra.color || "#f59e0b"}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => {
                    if (!newExtra.name.trim() || !newExtra.month) return;
                    setExtraIncome(ei => [...ei, { ...newExtra, id: Date.now(), amount: parseFloat(newExtra.amount) || 0 }]);
                    setNewExtra({ name: "", amount: 0, month: curMonthKey, emoji: "⭐", color: "#f59e0b" });
                    setShowExtraModal(false);
                  }} style={{ flex: 1, background: newExtra.color || "#f59e0b", color: "#fff", border: "none", borderRadius: 12, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Lägg till
                  </button>
                  <button onClick={() => setShowExtraModal(false)}
                    style={{ background: "var(--bg2)", border: "none", borderRadius: 12, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                    Avbryt
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Extra Income */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>⭐ Extra inkomst</div>
            {canEdit && <button onClick={() => setShowExtraModal(true)} className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 12 }}>+ Lägg till</button>}
          </div>
          {extraIncome.length === 0 && <div style={{ fontSize: 12, color: "var(--text2)", textAlign: "center", padding: "12px 0" }}>Ingen extra inkomst tillagd</div>}
          {extraIncome.map(e => (
            <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: (e.color || "#f59e0b") + "25", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {e.emoji || "⭐"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: e.color || "#f59e0b" }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>{fmtMonth(e.month)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: e.color || "#f59e0b" }}>{formatSEK(e.amount)}</div>
                  {canEdit && <button onClick={() => (() => { pushUndo("Extra inkomst"); setExtraIncome(ei => ei.filter(x => x.id !== e.id)); })()} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 15, opacity: 0.6, padding: 0 }}>✕</button>}
                </div>
              </div>
            </div>
          ))}
        </Card>

      </div>
    </div>
  );
}

// ============================================================
// DEBTS PAGE
// ============================================================
function DebtsPage({ debts, setDebts, canEdit, updateDebt, pushUndo = () => {}, expenses }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newDebt, setNewDebt] = useState({ name: "", total: "", remaining: "", monthly: "", interest: "", autogiro: false });
  const [errors, setErrors] = useState({});

  const totalRemaining = debts.reduce((s, d) => s + d.remaining, 0);
  const totalMonthly   = debts.reduce((s, d) => s + d.monthly, 0);

  function validate() {
    const e = {};
    if (!newDebt.name.trim())                        e.name      = "Ange ett namn";
    if (!newDebt.total    || parseFloat(newDebt.total)    <= 0) e.total     = "Ange totalt belopp";
    if (!newDebt.remaining|| parseFloat(newDebt.remaining)<= 0) e.remaining = "Ange återstående belopp";
    if (!newDebt.monthly  || parseFloat(newDebt.monthly)  <= 0) e.monthly   = "Ange månadskostnad";
    return e;
  }

  function addDebt() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const total     = parseFloat(newDebt.total)     || 0;
    const remaining = parseFloat(newDebt.remaining) || 0;
    const monthly   = parseFloat(newDebt.monthly)   || 0;
    const interest  = parseFloat(newDebt.interest)  || 0;
    setDebts(ds => [...ds, {
      id: Date.now(), name: newDebt.name.trim(),
      total, remaining, monthly, interest,
      autogiro: newDebt.autogiro,
      startDate: new Date().toISOString().split("T")[0]
    }]);
    setNewDebt({ name: "", total: "", remaining: "", monthly: "", interest: "", autogiro: false });
    setErrors({});
    setShowAdd(false);
  }

  function closeModal() {
    setShowAdd(false);
    setErrors({});
    setNewDebt({ name: "", total: "", remaining: "", monthly: "", interest: "", autogiro: false });
  }

  const Field = ({ label, field, type = "number", placeholder }) => (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={newDebt[field]}
        onChange={e => { setNewDebt(n => ({ ...n, [field]: e.target.value })); setErrors(ev => ({ ...ev, [field]: undefined })); }}
        style={{ background: "var(--bg2)", border: `1.5px solid ${errors[field] ? "#ef4444" : "var(--border)"}`, borderRadius: 10, padding: "10px 14px", fontSize: 15, color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }}
      />
      {errors[field] && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{errors[field]}</div>}
    </div>
  );

  return (
    <div>
      {/* Summary header */}
      <div className="dash-summary" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <Card style={{ background: "linear-gradient(135deg, #7f1d1d, #ef4444)", border: "none", color: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 600, textTransform: "uppercase" }}>Total skuld</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{formatSEK(totalRemaining)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase" }}>Registrerad amortering</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#f59e0b", marginTop: 6 }}>{formatSEK(totalMonthly)}</div>
          <div style={{ fontSize: 10, color: "var(--text2)", marginTop: 4 }}>Lägg till i Budget för att räknas</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase" }}>Antal skulder</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#3b82f6", marginTop: 6 }}>{debts.length}</div>
        </Card>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">+ Lägg till skuld</button>
        )}
      </div>

      {/* Debt Cards */}
      <div className="dash-row2" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {debts.map(d => {
          const po  = calcDebtPayoff(d.remaining, d.monthly);
          const pct = Math.round(((d.total - d.remaining) / Math.max(d.total, 1)) * 100);
          return (
            <Card key={d.id} style={{ position: "relative", overflow: "hidden" }}>
              {/* Accent bar */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, #10b981 ${pct}%, var(--border) ${pct}%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, paddingTop: 8 }}>
                <div>
                  {canEdit
                    ? <InlineEdit value={d.name} onChange={v => updateDebt(d.id, "name", v)} style={{ fontSize: 17, fontWeight: 800 }} />
                    : <div style={{ fontSize: 17, fontWeight: 800 }}>{d.name}</div>}
                  <div style={{ marginTop: 4 }}>
                    {d.autogiro
                      ? <span style={{ background: "#fef3c7", color: "#b45309", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⟳ Autogiro</span>
                      : <span style={{ background: "var(--bg2)", color: "var(--text2)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>Manuell</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>
                    {canEdit
                      ? <InlineEdit value={d.remaining} onChange={v => updateDebt(d.id, "remaining", parseFloat(v) || 0)} type="number" style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }} />
                      : formatSEK(d.remaining)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>kvar av {formatSEK(d.total)}</div>
                </div>
              </div>

              <ProgressBar value={d.total - d.remaining} max={d.total} color="#10b981" height={8} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: "var(--text2)" }}>{pct}% betald</span>
                <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>{formatSEK(d.total - d.remaining)} betalt</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { label: "Per månad", key: "monthly",  color: "#3b82f6", editable: true  },
                  { label: "Ränta",     key: "interest", color: "#f59e0b", editable: false, suffix: "%" },
                  { label: "Mån kvar",  key: null,       color: "#8b5cf6", editable: false, display: po.months },
                ].map(item => (
                  <div key={item.label} style={{ background: "var(--bg2)", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: item.color }}>
                      {canEdit && item.editable
                        ? <InlineEdit value={d[item.key]} onChange={v => updateDebt(d.id, item.key, parseFloat(v) || 0)} type="number" style={{ fontSize: 14, fontWeight: 800, color: item.color, width: 70 }} />
                        : item.display !== undefined ? item.display : `${d[item.key]}${item.suffix || ""}`}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, background: "var(--bg2)", borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text2)" }}>📅 Färdigbetald</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{po.date}</span>
              </div>

              {canEdit && (
                <button
                  onClick={() => { pushUndo("Ta bort skuld"); setDebts(ds => ds.filter(x => x.id !== d.id)); }}
                  style={{ marginTop: 10, width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px", fontSize: 12, color: "#ef4444", cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  🗑 Ta bort skuld
                </button>
              )}
            </Card>
          );
        })}

        {debts.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 0", color: "var(--text2)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Inga skulder registrerade</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Lägg till en skuld för att börja följa din avbetalning</div>
          </div>
        )}
      </div>

      {/* Debt Projection */}
      {debts.length > 0 && (
        <>
          <Card style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📉 Skuldutveckling</div>
            <DebtProjectionChart debts={debts} />
          </Card>

          <Card style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📅 Skuldfrihetsdatum</div>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: "var(--border)", borderRadius: 99 }} />
              {debts.map(d => {
                const po = calcDebtPayoff(d.remaining, d.monthly);
                return (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0 10px 28px", position: "relative" }}>
                    <div style={{ position: "absolute", left: 4, width: 10, height: 10, borderRadius: "50%", background: "#ef4444", border: "2px solid var(--card)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)" }}>{po.months} månader – {po.date}</div>
                    </div>
                    <div style={{ background: "#d1fae5", color: "#10b981", borderRadius: 10, padding: "4px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                      +{formatSEK(d.monthly)}/mån frigjort
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* ── ADD DEBT MODAL ── */}
      {showAdd && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 460 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>➕ Lägg till skuld</div>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, color: "var(--text2)", cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Namn */}
              <Field label="Namn på skuld" field="name" type="text" placeholder="t.ex. Anyfin, Svea, Resurs..." />

              {/* Totalt & Återstående side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Totalt belopp (kr)" field="total" placeholder="0" />
                <Field label="Återstående (kr)"   field="remaining" placeholder="0" />
              </div>

              {/* Månadskostnad & Ränta side by side */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Månadskostnad (kr)" field="monthly"  placeholder="0" />
                <Field label="Ränta (%)"           field="interest" placeholder="0" />
              </div>

              {/* Autogiro toggle */}
              <div
                onClick={() => setNewDebt(n => ({ ...n, autogiro: !n.autogiro }))}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 12,
                  border: `1.5px solid ${newDebt.autogiro ? "#f59e0b" : "var(--border)"}`,
                  background: newDebt.autogiro ? "#fef9ec" : "var(--bg2)",
                  cursor: "pointer", userSelect: "none", transition: "all 0.15s"
                }}>
                <div style={{
                  width: 36, height: 20, borderRadius: 99,
                  background: newDebt.autogiro ? "#f59e0b" : "var(--border)",
                  position: "relative", transition: "background 0.2s", flexShrink: 0
                }}>
                  <div style={{
                    position: "absolute", top: 2, left: newDebt.autogiro ? 18 : 2,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: newDebt.autogiro ? "#b45309" : "var(--text)" }}>
                    ⟳ Autogiro
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>
                    Dras automatiskt varje månad
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={closeModal} className="btn btn-ghost" style={{ flex: 1, padding: "11px" }}>Avbryt</button>
              <button onClick={addDebt}   className="btn btn-primary" style={{ flex: 2, padding: "11px", fontSize: 15 }}>Lägg till skuld ＋</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DebtProjectionChart({ debts }) {
  const months = 36;
  const labels = [];
  const data = [];
  let current = debts.reduce((s, d) => s + d.remaining, 0);

  for (let i = 0; i <= months; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    labels.push(d.toLocaleDateString("sv-SE", { month: "short", year: "2-digit" }));
    data.push(Math.max(0, current));
    current -= debts.reduce((s, d) => s + d.monthly, 0);
  }

  const max = data[0] || 1;
  const width = 600, height = 160;
  const pts = data.map((v, i) => `${(i / months) * width},${height - (v / max) * (height - 20)}`).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height + 30}`} style={{ width: "100%", minWidth: 400 }}>
        <defs>
          <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${height} ${pts} ${width},${height}`} fill="url(#debtGrad)" />
        <polyline points={pts} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((v, i) => v <= 0 && data[i - 1] > 0 ? (
          <g key={i}>
            <line x1={`${(i / months) * width}`} y1="0" x2={`${(i / months) * width}`} y2={height} stroke="#10b981" strokeWidth="1.5" strokeDasharray="4,4" />
            <text x={`${(i / months) * width + 4}`} y="14" fontSize="11" fill="#10b981" fontWeight="700">Skuldfri!</text>
          </g>
        ) : null)}
        {[0, 6, 12, 18, 24, 30, 36].map(i => (
          <text key={i} x={`${(i / months) * width}`} y={height + 20} fontSize="10" fill="#94a3b8" textAnchor="middle">{labels[i]}</text>
        ))}
      </svg>
    </div>
  );
}

// ============================================================
// SAVINGS PAGE
// ============================================================
function SavingsPage({ savingsAccounts, setSavingsAccounts, assets, setAssets, canEdit, pushUndo = () => {} }) {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", balance: "", goal: "", bank: "", color: "#10b981", monthlyDeposit: "", monthlyActive: true });
  const [newAsset, setNewAsset] = useState({ name: "", amount: 0, type: "savings" });

  const totalSavings = savingsAccounts.reduce((s, a) => s + a.balance, 0);
  const totalAssets = assets.reduce((s, a) => s + a.amount, 0);

  function updateAccount(id, field, value) {
    setSavingsAccounts(accs => accs.map(a => a.id === id ? { ...a, [field]: value } : a));
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <Card style={{ background: "linear-gradient(135deg, #064e3b, #10b981)", border: "none", color: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 600, textTransform: "uppercase" }}>Totalt sparande</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>{formatSEK(totalSavings)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase" }}>Totala tillgångar</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#8b5cf6", marginTop: 6 }}>{formatSEK(totalAssets)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, textTransform: "uppercase" }}>Sparkonton</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#3b82f6", marginTop: 6 }}>{savingsAccounts.length} st</div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Savings Accounts */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>💰 Sparkonton</h3>
            {canEdit && <button onClick={() => setShowAddAccount(true)} className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}>+ Lägg till</button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {savingsAccounts.map(acc => {
              const pct = Math.min(100, (acc.balance / Math.max(acc.goal, 1)) * 100);
              const remaining = Math.max(0, acc.goal - acc.balance);
              const monthly = acc.monthlyDeposit || 0;
              const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;
              const doneDate = monthsLeft ? (() => {
                const d = new Date();
                d.setMonth(d.getMonth() + monthsLeft);
                return d.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
              })() : null;
              return (
                <Card key={acc.id} style={{ padding: "16px 18px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: acc.color }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingTop: 4 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{acc.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                        <span style={{ background: "#dbeafe", color: "#2563eb", borderRadius: 6, padding: "1px 7px", fontWeight: 600 }}>{acc.bank}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: acc.color }}>
                        {canEdit ? <InlineEdit value={acc.balance} onChange={v => updateAccount(acc.id, "balance", parseFloat(v) || 0)} type="number" style={{ color: acc.color, fontSize: 18, fontWeight: 800 }} /> : formatSEK(acc.balance)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text2)" }}>av {formatSEK(acc.goal)}</div>
                    </div>
                  </div>
                  <ProgressBar value={acc.balance} max={acc.goal} color={acc.color} height={6} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, marginBottom: monthly > 0 && acc.monthlyActive !== false ? 10 : 0 }}>
                    <span style={{ fontSize: 11, color: "var(--text2)" }}>{Math.round(pct)}% av målet</span>
                    <span style={{ fontSize: 11, color: acc.color, fontWeight: 600 }}>{formatSEK(remaining)} kvar</span>
                  </div>

                  {/* Monthly stats + growth chart */}
                  {monthly > 0 && acc.monthlyActive !== false && (() => {
                    const chartMonths = 6;
                    const chartPoints = Array.from({ length: chartMonths + 1 }, (_, i) => Math.min(acc.goal, acc.balance + monthly * i));
                    const chartW = 220, chartH = 44;
                    return (
                      <div style={{ background: "var(--bg2)", borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>📈 Tillväxt nästa 6 månader</div>
                        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + 16}`} style={{ overflow: "visible" }}>
                          <defs>
                            <linearGradient id={`sav-grad-${acc.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={acc.color} stopOpacity="0.3" />
                              <stop offset="100%" stopColor={acc.color} stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          {(() => {
                            const pts = chartPoints.map((v, i) => [i * (chartW / chartMonths), chartH - (v / Math.max(acc.goal, 1)) * chartH]);
                            const areaPath = `M${pts[0][0]},${chartH} ${pts.map(p => `L${p[0]},${p[1]}`).join(" ")} L${pts[pts.length-1][0]},${chartH} Z`;
                            const linePath = `M${pts.map(p => `${p[0]},${p[1]}`).join(" L")}`;
                            return (
                              <>
                                <path d={areaPath} fill={`url(#sav-grad-${acc.id})`} />
                                <path d={linePath} fill="none" stroke={acc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                {pts.map((p, i) => i % 2 === 0 && <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={acc.color} />)}
                                <line x1="0" y1="0" x2={chartW} y2="0" stroke={acc.color} strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.4" />
                                {pts.map((p, i) => i % 2 === 0 && <text key={i} x={Math.max(8, Math.min(chartW - 8, p[0]))} y={chartH + 13} textAnchor={i === 0 ? "start" : i === chartMonths ? "end" : "middle"} fontSize="8" fill="var(--text2)">{i === 0 ? "Nu" : `+${i}m`}</text>)}
                              </>
                            );
                          })()}
                        </svg>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
                          {[
                            { label: "Per månad", value: formatSEK(monthly), color: "#3b82f6" },
                            { label: "Månader kvar", value: monthsLeft ?? "–", color: acc.color },
                            { label: "Klart", value: doneDate ? doneDate.charAt(0).toUpperCase() + doneDate.slice(1) : "–", color: "#10b981", small: true },
                          ].map(item => (
                            <div key={item.label} style={{ background: "var(--card)", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                              <div style={{ fontSize: 9, color: "var(--text2)", marginBottom: 1, fontWeight: 600, textTransform: "uppercase" }}>{item.label}</div>
                              <div style={{ fontSize: item.small ? 10 : 13, fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        {doneDate && (
                          <div style={{ marginTop: 8, background: "var(--card)", borderRadius: 8, padding: "6px 10px", display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "var(--text2)" }}>💰 Sparat totalt</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: acc.color }}>{formatSEK(acc.goal)} i {doneDate.charAt(0).toUpperCase() + doneDate.slice(1)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {canEdit && (
                    <button onClick={() => { pushUndo("Ta bort sparkonto"); setSavingsAccounts(accs => accs.filter(a => a.id !== acc.id)); }} style={{ marginTop: 4, width: "100%", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "5px", fontSize: 12, color: "#ef4444", cursor: "pointer" }}>Ta bort</button>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Assets */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>📊 Tillgångar</h3>
            {canEdit && <button onClick={() => setShowAddAsset(true)} className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}>+ Lägg till</button>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {assets.map(a => (
              <Card key={a.id} style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text2)" }}>{a.type === "savings" ? "Sparande" : a.type === "investments" ? "Investeringar" : "Kontanter"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#8b5cf6" }}>
                      {canEdit ? <InlineEdit value={a.amount} onChange={v => setAssets(as => as.map(x => x.id === a.id ? { ...x, amount: parseFloat(v) || 0 } : x))} type="number" style={{ fontSize: 16, fontWeight: 800, color: "#8b5cf6" }} /> : formatSEK(a.amount)}
                    </div>
                    {canEdit && <button onClick={() => { pushUndo("Ta bort tillgång"); setAssets(as => as.filter(x => x.id !== a.id)); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>✕</button>}
                  </div>
                </div>
              </Card>
            ))}
            {canEdit && (
              <Card style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input placeholder="Namn" value={newAsset.name} onChange={e => setNewAsset(n => ({ ...n, name: e.target.value }))} />
                  <input type="number" placeholder="Belopp" value={newAsset.amount} onChange={e => setNewAsset(n => ({ ...n, amount: e.target.value }))} />
                  <select value={newAsset.type} onChange={e => setNewAsset(n => ({ ...n, type: e.target.value }))}>
                    <option value="savings">Sparande</option>
                    <option value="investments">Investeringar</option>
                    <option value="cash">Kontanter</option>
                  </select>
                  <button onClick={() => { setAssets(as => [...as, { ...newAsset, id: Date.now(), amount: parseFloat(newAsset.amount) || 0 }]); setNewAsset({ name: "", amount: 0, type: "savings" }); }} className="btn btn-primary">Lägg till tillgång</button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {showAddAccount && (
        <div className="modal-overlay" onClick={() => setShowAddAccount(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Nytt sparkonto</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { placeholder: "Kontonamn", key: "name", type: "text" },
                { placeholder: "Nuvarande saldo (kr)", key: "balance", type: "number" },
                { placeholder: "Sparmål (kr)", key: "goal", type: "number" },
                { placeholder: "Månadsinsättning (kr/mån, valfritt)", key: "monthlyDeposit", type: "number" },
                { placeholder: "Bank", key: "bank", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <input type={f.type} placeholder={f.placeholder} value={newAccount[f.key]}
                    onChange={e => setNewAccount(n => ({ ...n, [f.key]: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 12px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 4 }}>Färg</label>
                <input type="color" value={newAccount.color} onChange={e => setNewAccount(n => ({ ...n, color: e.target.value }))} style={{ width: 60, height: 36, padding: 2, borderRadius: 8, border: "1.5px solid var(--border)", cursor: "pointer" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowAddAccount(false)} className="btn btn-ghost" style={{ flex: 1 }}>Avbryt</button>
                <button onClick={() => { setSavingsAccounts(accs => [...accs, { ...newAccount, id: Date.now(), balance: parseFloat(newAccount.balance) || 0, goal: parseFloat(newAccount.goal) || 0, monthlyDeposit: parseFloat(newAccount.monthlyDeposit) || 0, monthlyActive: true }]); setShowAddAccount(false); setNewAccount({ name: "", balance: "", goal: "", bank: "", color: "#10b981", monthlyDeposit: "", monthlyActive: true }); }} className="btn btn-primary" style={{ flex: 1 }}>Skapa konto</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// BANKING PAGE
// ============================================================
function BankingPage({ savingsAccounts, assets }) {
  const [customItems, setCustomItems] = useState([
    { id: 1, name: "SEB Personkort", info: "Kreditlimit 20 000 kr", type: "card" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", info: "", type: "other" });

  const sebAccounts = savingsAccounts.filter(a => a.bank === "SEB");
  const sebBalance = sebAccounts.reduce((s, a) => s + a.balance, 0);
  const avanzaAssets = assets.filter(a => a.type === "investments");
  const avanzaTotal = avanzaAssets.reduce((s, a) => s + a.amount, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        {/* SEB */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#006AB0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="36" height="18" viewBox="0 0 90 40">
                <text x="5" y="32" fontFamily="Arial" fontWeight="900" fontSize="32" fill="white">SEB</text>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>SEB</div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>Skandinaviska Enskilda Banken</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#006AB0" }}>{formatSEK(sebBalance)}</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>totalt saldo</div>
            </div>
          </div>
          {sebAccounts.map(acc => (
            <div key={acc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{acc.name}</div>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>Mål: {formatSEK(acc.goal)}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{formatSEK(acc.balance)}</div>
            </div>
          ))}
          {sebAccounts.length === 0 && <div style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", padding: "20px 0" }}>Inga SEB-konton registrerade</div>}
        </Card>

        {/* Avanza */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FF6600", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="40" height="24" viewBox="0 0 100 50">
                <text x="2" y="38" fontFamily="Arial" fontWeight="900" fontSize="28" fill="white">avanza</text>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Avanza</div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>Aktier & Investeringar</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6600" }}>{formatSEK(avanzaTotal)}</div>
              <div style={{ fontSize: 11, color: "var(--text2)" }}>portföljvärde</div>
            </div>
          </div>
          {avanzaAssets.map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#FF6600" }}>{formatSEK(a.amount)}</div>
            </div>
          ))}
          {avanzaAssets.length === 0 && <div style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", padding: "20px 0" }}>Inga Avanza-tillgångar registrerade</div>}
        </Card>
      </div>

      {/* Custom items */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📌 Övrigt finansiellt</div>
          <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary" style={{ padding: "6px 14px", fontSize: 12 }}>+ Lägg till</button>
        </div>
        {showAdd && (
          <div style={{ background: "var(--bg2)", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <input placeholder="Namn (t.ex. SEB Kreditkort)" value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))} />
            <input placeholder="Info (t.ex. limit 20 000 kr)" value={newItem.info} onChange={e => setNewItem(n => ({ ...n, info: e.target.value }))} />
            <select value={newItem.type} onChange={e => setNewItem(n => ({ ...n, type: e.target.value }))}>
              <option value="card">Kort</option>
              <option value="loan">Lån</option>
              <option value="account">Konto</option>
              <option value="other">Övrigt</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAdd(false)} className="btn btn-ghost" style={{ flex: 1 }}>Avbryt</button>
              <button onClick={() => { setCustomItems(ci => [...ci, { ...newItem, id: Date.now() }]); setShowAdd(false); setNewItem({ name: "", info: "", type: "other" }); }} className="btn btn-primary" style={{ flex: 1 }}>Lägg till</button>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {customItems.map(item => (
            <div key={item.id} style={{ background: "var(--bg2)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>{item.info}</div>
              <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 4, fontWeight: 600 }}>{item.type === "card" ? "💳 Kort" : item.type === "loan" ? "📄 Lån" : item.type === "account" ? "🏦 Konto" : "📌 Övrigt"}</div>
              <button onClick={() => setCustomItems(ci => ci.filter(x => x.id !== item.id))} style={{ marginTop: 8, background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>Ta bort</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// GOALS PAGE
// ============================================================

// ============================================================
// IMAGE SEARCH PICKER COMPONENT
// ============================================================
function ImageSearchPicker({ onSelect, onClose, accentColor = "#3b82f6" }) {
  const [tab, setTab]         = useState("url"); // "url" | "upload"
  const [url, setUrl]         = useState("");
  const [preview, setPreview] = useState(null);  // only used for uploads
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  function handleConfirm() {
    if (tab === "url" && url.trim()) onSelect(url.trim());
    else if (tab === "upload" && preview) onSelect(preview);
  }

  const canConfirm = tab === "url" ? url.trim().length > 0 : !!preview;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card)", borderRadius: 20, width: "min(520px, 96vw)",
        display: "flex", flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.25)", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>🖼️ Välj bild</div>
          <button onClick={onClose} style={{ background: "var(--bg2)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 14, color: "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {[{ id: "url", label: "🔗 Klistra in länk" }, { id: "upload", label: "📁 Ladda upp" }].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setPreview(null); setUrl(""); }}
              style={{ flex: 1, padding: "12px", border: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", color: tab === t.id ? accentColor : "var(--text2)", borderBottom: tab === t.id ? `2.5px solid ${accentColor}` : "2.5px solid transparent", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {tab === "url" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Bild-URL</label>
              <input
                autoFocus
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === "Enter" && canConfirm && handleConfirm()}
                placeholder="https://exempel.com/bild.jpg"
                style={{ background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }}
              />
              <div style={{ fontSize: 12, color: "var(--text2)", opacity: 0.8 }}>
                💡 Högerklicka på en bild på webben → "Kopiera bildadress" och klistra in här
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Välj fil från din enhet</label>
              <div onClick={() => fileRef.current.click()}
                style={{ border: `2px dashed ${accentColor}55`, borderRadius: 14, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: accentColor + "08", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = accentColor + "18"}
                onMouseLeave={e => e.currentTarget.style.background = accentColor + "08"}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Klicka för att välja bild</div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>JPG, PNG, WebP, GIF</div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
              </div>
            </div>
          )}

          {/* Preview – only for uploads */}
          {tab === "upload" && preview && (
            <div style={{ borderRadius: 14, overflow: "hidden", border: "2px solid var(--border)", aspectRatio: "16/9", position: "relative" }}>
              <img src={preview} alt="Förhandsvisning" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <button onClick={() => setPreview(null)}
                style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 26, height: 26, color: "#fff", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0 22px 20px", display: "flex", gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: "var(--bg2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Avbryt
          </button>
          <button onClick={handleConfirm} disabled={!canConfirm}
            style={{ flex: 2, background: canConfirm ? accentColor : "var(--bg2)", color: canConfirm ? "#fff" : "var(--text2)", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: canConfirm ? "pointer" : "default", fontFamily: "inherit", transition: "all 0.2s" }}>
            ✓ Använd bild
          </button>
        </div>
      </div>
    </div>
  );
}

const INITIAL_GOALS = [
  { id: 1, name: "Bio-kväll", description: "Spara till en biokväll med popcorn", target: 100, saved: 60, color: "#f59e0b", icon: "🎬", category: "Nöje", monthlyDeposit: 0, monthlyActive: false, streak: 0, lastDepositMonth: null, milestonesSeen: [] },
  { id: 2, name: "Paris 2026", description: "Semester i Paris – flyg + hotell", target: 5000, saved: 1200, color: "#3b82f6", icon: "🗼", category: "Resor", monthlyDeposit: 500, monthlyActive: true, streak: 3, lastDepositMonth: null, milestonesSeen: [25] },
  { id: 3, name: "Ny laptop", description: "MacBook för jobb och studier", target: 15000, saved: 4500, color: "#8b5cf6", icon: "💻", category: "Teknik", monthlyDeposit: 1000, monthlyActive: true, streak: 2, lastDepositMonth: null, milestonesSeen: [25] },
];

const GOAL_CATEGORIES = ["Nöje", "Resor", "Teknik", "Hälsa", "Hem", "Övrigt"];
const GOAL_ICONS = ["🎬", "🗼", "💻", "🏖", "🎮", "🚗", "🏠", "📚", "🎵", "💪", "✈️", "🍕", "👟", "🎁", "🐶"];
const GOAL_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316"];

function GoalsPage({ goals, setGoals, canEdit, pushUndo = () => {} }) {
  const [showAdd, setShowAdd] = useState(false);
  const [adjustGoalId, setAdjustGoalId] = useState(null);
  const [adjustMode, setAdjustMode] = useState("add");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [editGoal, setEditGoal] = useState(null);
  const [editGoalTab, setEditGoalTab] = useState("basic");
  const [infoGoalId, setInfoGoalId] = useState(null);
  const [markDoneGoalId, setMarkDoneGoalId] = useState(null);
  const [imagePickerFor, setImagePickerFor] = useState(null); // "edit" | "new"
  const [newGoal, setNewGoal] = useState({ name: "", description: "", target: "", saved: 0, color: "#3b82f6", icon: "🎯", category: "Övrigt", monthlyDeposit: "", monthlyActive: false, date: "", notes: "", links: [], costs: [], ideas: [], isFree: false, image: null, imageOffsetY: 50 });

  const totalSaved = goals.filter(g => !g.isFree).reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.filter(g => !g.isFree).reduce((s, g) => s + g.target, 0);
  const completed = goals.filter(g => g.manuallyCompleted || (!g.isFree && g.saved >= g.target));
  const active = goals.filter(g => !g.manuallyCompleted && (g.isFree || g.saved < g.target));

  function addGoal() {
    if (!newGoal.name) return;
    if (!newGoal.isFree && !newGoal.target) return;
    const monthly = parseFloat(newGoal.monthlyDeposit) || 0;
    setGoals(gs => [...gs, {
      ...newGoal, id: Date.now(),
      target: newGoal.isFree ? 0 : (parseFloat(newGoal.target) || 0),
      saved: newGoal.isFree ? 0 : (parseFloat(newGoal.saved) || 0),
      monthlyDeposit: newGoal.isFree ? 0 : monthly,
      monthlyActive: !newGoal.isFree && monthly > 0,
      streak: 0,
      lastDepositMonth: null,
      milestonesSeen: [],
    }]);
    setNewGoal({ name: "", description: "", target: "", saved: 0, color: "#3b82f6", icon: "🎯", category: "Övrigt", monthlyDeposit: "", monthlyActive: false, isFree: false, image: null, imageOffsetY: 50 });
    setShowAdd(false);
  }

  function handleAdjust(id) {
    const goal = goals.find(g => g.id === id);
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt)) return;
    const thisMonth = new Date().toISOString().slice(0,7); // "2026-03"
    setGoals(gs => gs.map(g => {
      if (g.id !== id) return g;
      let newSaved = adjustMode === "set" ? amt : g.saved + (adjustMode === "subtract" ? -amt : amt);
      newSaved = Math.max(0, newSaved);
      // Streak: if adding money this month and not already counted
      let newStreak = g.streak || 0;
      let lastMonth = g.lastDepositMonth || null;
      if ((adjustMode === "add" || adjustMode === "set") && newSaved > g.saved) {
        const prevMonth = lastMonth ? new Date(lastMonth + "-01") : null;
        const now = new Date();
        const sameMonth = prevMonth && prevMonth.getFullYear() === now.getFullYear() && prevMonth.getMonth() === now.getMonth();
        if (!sameMonth) {
          // Check if consecutive (last deposit was last month)
          const expectedPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0,7);
          newStreak = lastMonth === expectedPrev ? newStreak + 1 : 1;
          lastMonth = thisMonth;
        }
      }
      // Check milestones (25, 50, 75)
      const newPct = Math.min(100, Math.round((newSaved / g.target) * 100));
      const milestonesSeen = g.milestonesSeen || [];
      const newMilestones = [25, 50, 75].filter(m => newPct >= m && !milestonesSeen.includes(m));
      return { ...g, saved: newSaved, streak: newStreak, lastDepositMonth: lastMonth, milestonesSeen: [...milestonesSeen, ...newMilestones], newMilestone: newMilestones[0] || null };
    }));
    setAdjustGoalId(null);
    setAdjustAmount("");
    // Clear newMilestone after 3s
    setTimeout(() => setGoals(gs => gs.map(g => g.id === id ? { ...g, newMilestone: null } : g)), 3500);
  }

  function deleteGoal(id) {
    pushUndo("Mål");
    setGoals(gs => gs.filter(g => g.id !== id));
  }

  return (
    <div className="fadeIn">
      {/* ══ IMAGE SEARCH PICKER ══ */}
      {imagePickerFor && (
        <ImageSearchPicker
          accentColor={imagePickerFor === "edit" ? ((editGoal && editGoal.color) || "#3b82f6") : ((newGoal && newGoal.color) || "#3b82f6")}
          onClose={() => setImagePickerFor(null)}
          onSelect={url => {
            if (imagePickerFor === "edit") {
              setEditGoal(g => ({ ...g, image: url, imageOffsetY: 50 }));
            } else {
              setNewGoal(n => ({ ...n, image: url, imageOffsetY: 50 }));
            }
            setImagePickerFor(null);
          }}
        />
      )}

      {/* ══ EDIT GOAL MODAL ══ */}
      {editGoal && (() => {
        const col = editGoal.color || "#3b82f6";
        const iStyle = { width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" };
        const lStyle = { fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 };
        const links = editGoal.links || [];
        const costs = editGoal.costs || [];
        const ideas = editGoal.ideas || [];
        const totalCosts = costs.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

        const SECTION_TABS = [
          { id: "basic", icon: "✏️", label: "Grundinfo" },
          { id: "details", icon: "📋", label: "Detaljer" },
          { id: "links", icon: "🔗", label: `Länkar${links.length ? ` (${links.length})` : ""}` },
          { id: "costs", icon: "💸", label: `Kostnader${costs.length ? ` (${costs.length})` : ""}` },
          { id: "ideas", icon: "💡", label: `Idéer${ideas.length ? ` (${ideas.length})` : ""}` },
        ];

        return (
          <div className="modal-overlay" onClick={() => setEditGoal(null)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "var(--card)", borderRadius: 24, width: "min(640px, 96vw)",
              maxHeight: "92vh", display: "flex", flexDirection: "column",
              boxShadow: "0 32px 80px rgba(0,0,0,0.22)", overflow: "hidden"
            }}>
              {/* Colorful header banner */}
              <div style={{ background: `linear-gradient(135deg, ${col}dd, ${col}88)`, padding: "22px 28px 18px", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Icon picker inline */}
                    <div style={{ position: "relative" }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, cursor: "pointer", border: "2px solid rgba(255,255,255,0.4)" }}
                        onClick={() => setEditGoalTab(editGoalTab === "_iconpick" ? "basic" : "_iconpick")}>
                        {editGoal.icon}
                      </div>
                    </div>
                    <div>
                      <input value={editGoal.name} onChange={e => setEditGoal(g => ({ ...g, name: e.target.value }))}
                        placeholder="Målnamn…"
                        style={{ background: "transparent", border: "none", outline: "none", fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "inherit", width: "100%", letterSpacing: "-0.01em" }} />
                      <input value={editGoal.description ?? ""} onChange={e => setEditGoal(g => ({ ...g, description: e.target.value }))}
                        placeholder="Kort beskrivning…"
                        style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "inherit", width: "100%", marginTop: 2 }} />
                    </div>
                  </div>
                  <button onClick={() => setEditGoal(null)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
                </div>
                {/* Color swatches in header */}
                <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
                  {GOAL_COLORS.map(c => (
                    <button key={c} onClick={() => setEditGoal(g => ({ ...g, color: c }))}
                      style={{ width: editGoal.color === c ? 26 : 20, height: editGoal.color === c ? 26 : 20, borderRadius: "50%", background: c, border: `3px solid ${editGoal.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }} />
                  ))}
                </div>
              </div>

              {/* Icon picker overlay */}
              {editGoalTab === "_iconpick" && (
                <div style={{ padding: "14px 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Välj ikon — tryck för att välja</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {GOAL_ICONS.map(icon => (
                      <button key={icon} onClick={() => { setEditGoal(g => ({ ...g, icon })); setEditGoalTab("basic"); }}
                        style={{ width: 38, height: 38, borderRadius: 10, border: `2px solid ${editGoal.icon === icon ? col : "transparent"}`, background: editGoal.icon === icon ? col + "20" : "var(--card)", fontSize: 20, cursor: "pointer" }}>{icon}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Section tabs */}
              <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", flexShrink: 0, overflowX: "auto" }}>
                {SECTION_TABS.map(t => (
                  <button key={t.id} onClick={() => setEditGoalTab(t.id)}
                    style={{ padding: "11px 14px", border: "none", background: "transparent", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: editGoalTab === t.id ? col : "var(--text2)", borderBottom: editGoalTab === t.id ? `2.5px solid ${col}` : "2.5px solid transparent", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div style={{ padding: "20px 28px", overflowY: "auto", flex: 1 }}>

                {/* ── BASIC ── */}
                {(editGoalTab === "basic" || editGoalTab === "_iconpick") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* isFree toggle */}
                    <button onClick={() => setEditGoal(g => ({ ...g, isFree: !g.isFree }))}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `2px solid ${editGoal.isFree ? "#10b981" : "var(--border)"}`, background: editGoal.isFree ? "#d1fae5" : "var(--bg2)", cursor: "pointer", width: "100%", boxSizing: "border-box", transition: "all 0.18s", fontFamily: "inherit" }}>
                      <span style={{ fontSize: 20 }}>{editGoal.isFree ? "✅" : "🆓"}</span>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: editGoal.isFree ? "#059669" : "var(--text)" }}>Gratis aktivitet</div>
                        <div style={{ fontSize: 11, color: "var(--text2)" }}>T.ex. utflykt, picknick, promenad – kostar inget</div>
                      </div>
                    </button>

                    {!editGoal.isFree && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <label style={lStyle}>Målbelopp (kr)</label>
                          <input type="number" value={editGoal.target ?? ""} onChange={e => setEditGoal(g => ({ ...g, target: e.target.value }))} style={iStyle} placeholder="0" />
                        </div>
                        <div>
                          <label style={lStyle}>Redan sparat (kr)</label>
                          <input type="number" value={editGoal.saved ?? ""} onChange={e => setEditGoal(g => ({ ...g, saved: e.target.value }))} style={iStyle} placeholder="0" />
                        </div>
                        <div>
                          <label style={lStyle}>Månadsinsättning (kr)</label>
                          <input type="number" value={editGoal.monthlyDeposit ?? ""} onChange={e => setEditGoal(g => ({ ...g, monthlyDeposit: e.target.value }))} style={iStyle} placeholder="valfritt" />
                        </div>
                        <div>
                          <label style={lStyle}>Kategori</label>
                          <select value={editGoal.category || "Övrigt"} onChange={e => setEditGoal(g => ({ ...g, category: e.target.value }))}
                            style={{ ...iStyle, appearance: "none", cursor: "pointer" }}>
                            {GOAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                    {editGoal.isFree && (
                      <div>
                        <label style={lStyle}>Kategori</label>
                        <select value={editGoal.category || "Övrigt"} onChange={e => setEditGoal(g => ({ ...g, category: e.target.value }))}
                          style={{ ...iStyle, appearance: "none", cursor: "pointer" }}>
                          {GOAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Image */}
                    <div>
                      <label style={lStyle}>📷 Bild (valfritt)</label>
                      {editGoal.image ? (
                        <div>
                          <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "2px solid var(--border)", height: 140 }}>
                            <img src={editGoal.image} alt="Målbild" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `center ${editGoal.imageOffsetY ?? 50}%`, display: "block" }} />
                            <button onClick={() => setEditGoal(g => ({ ...g, image: null }))} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 26, height: 26, color: "#fff", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                            <button onClick={() => setImagePickerFor("edit")} style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 8, padding: "4px 10px", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🔍 Byt bild</button>
                          </div>
                          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 700, whiteSpace: "nowrap" }}>↕ Justera</span>
                            <input type="range" min="0" max="100" value={editGoal.imageOffsetY ?? 50}
                              onChange={e => setEditGoal(g => ({ ...g, imageOffsetY: Number(e.target.value) }))}
                              style={{ flex: 1, accentColor: col, cursor: "pointer" }} />
                            <span style={{ fontSize: 11, color: "var(--text2)", width: 32, textAlign: "right" }}>{editGoal.imageOffsetY ?? 50}%</span>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setImagePickerFor("edit")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, border: "2px dashed var(--border)", background: "var(--bg2)", cursor: "pointer", color: "var(--text2)", fontSize: 13, fontWeight: 600, width: "100%", boxSizing: "border-box", fontFamily: "inherit" }}>
                          <span style={{ fontSize: 20 }}>🔍</span> Sök och välj bild...
                        </button>
                      )}
                    </div>

                    {/* Progress preview */}
                    {!editGoal.isFree && parseFloat(editGoal.target) > 0 && (
                      <div style={{ background: "var(--bg2)", borderRadius: 12, padding: "12px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: "var(--text2)" }}>Förhandsvisning</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: col }}>{Math.min(100, Math.round((parseFloat(editGoal.saved)||0) / parseFloat(editGoal.target) * 100))}%</span>
                        </div>
                        <div style={{ background: "var(--border)", borderRadius: 99, height: 8 }}>
                          <div style={{ width: `${Math.min(100, Math.round((parseFloat(editGoal.saved)||0) / parseFloat(editGoal.target) * 100))}%`, background: col, height: "100%", borderRadius: 99, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── DETAILS ── */}
                {editGoalTab === "details" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={lStyle}>📅 Måldatum</label>
                      <input type="date" value={editGoal.date ?? ""} onChange={e => setEditGoal(g => ({ ...g, date: e.target.value }))} style={iStyle} />
                    </div>
                    <div>
                      <label style={lStyle}>💬 Anteckningar</label>
                      <textarea value={editGoal.notes ?? ""} onChange={e => setEditGoal(g => ({ ...g, notes: e.target.value }))}
                        placeholder="Vad ska vi göra? Vem är med? Hur ser drömmen ut?" rows={5}
                        style={{ ...iStyle, resize: "vertical", lineHeight: 1.6 }} />
                    </div>
                  </div>
                )}

                {/* ── LINKS ── */}
                {editGoalTab === "links" && (
                  <div>
                    {links.length === 0 && <div style={{ textAlign: "center", padding: "20px 0 12px", color: "var(--text2)", fontSize: 14 }}>🔗 Inga länkar än</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {links.map((link, i) => {
                        const catIcon = { Hotell:"🏨", Flyg:"✈️", Restaurang:"🍽", Aktivitet:"🎯", Övrigt:"🔗" }[link.category] || "🔗";
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: col + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{catIcon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{link.name || "Namnlös länk"}</div>
                              <a href={link.url.startsWith("http") ? link.url : "https://" + link.url} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 12, color: col, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{link.url}</a>
                            </div>
                            <span style={{ fontSize: 11, background: col + "18", color: col, borderRadius: 99, padding: "3px 10px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{link.category}</span>
                            <button onClick={() => setEditGoal(g => ({ ...g, links: (g.links||[]).filter((_,j) => j !== i) }))}
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: 0, opacity: 0.5, flexShrink: 0 }}>✕</button>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ background: col + "0c", borderRadius: 14, padding: "16px 18px", border: `1.5px dashed ${col}44` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: col, marginBottom: 12 }}>+ Lägg till länk</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div><label style={lStyle}>Namn</label><input id="link-name" placeholder="t.ex. Grand Hôtel" style={iStyle} /></div>
                        <div><label style={lStyle}>Kategori</label>
                          <select id="link-cat" style={{ ...iStyle, appearance: "none" }}>
                            {["Hotell","Flyg","Restaurang","Aktivitet","Övrigt"].map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginBottom: 12 }}><label style={lStyle}>URL</label><input id="link-url" placeholder="https://…" style={iStyle} /></div>
                      <button onClick={() => {
                        const name = document.getElementById("link-name").value.trim();
                        const url = document.getElementById("link-url").value.trim();
                        const cat = document.getElementById("link-cat").value;
                        if (!url) return;
                        setEditGoal(g => ({ ...g, links: [...(g.links||[]), { name, url, category: cat }] }));
                        document.getElementById("link-name").value = "";
                        document.getElementById("link-url").value = "";
                      }} style={{ width: "100%", background: col, color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Lägg till länk</button>
                    </div>
                  </div>
                )}

                {/* ── COSTS ── */}
                {editGoalTab === "costs" && (
                  <div>
                    {costs.length > 0 && (
                      <div style={{ background: col + "12", border: `1px solid ${col}30`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>Totalt planerat</span>
                        <span style={{ fontSize: 20, fontWeight: 800, color: col }}>{totalCosts.toLocaleString("sv-SE")} kr</span>
                      </div>
                    )}
                    {costs.length === 0 && <div style={{ textAlign: "center", padding: "20px 0 12px", color: "var(--text2)", fontSize: 14 }}>💸 Inga kostnadsposter än</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {costs.map((cost, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: col + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>💸</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{cost.name}</div>
                            {cost.note && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{cost.note}</div>}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: col, flexShrink: 0 }}>{(parseFloat(cost.amount)||0).toLocaleString("sv-SE")} kr</div>
                          <button onClick={() => setEditGoal(g => ({ ...g, costs: (g.costs||[]).filter((_,j) => j !== i) }))}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: 0, opacity: 0.5, flexShrink: 0 }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: col + "0c", borderRadius: 14, padding: "16px 18px", border: `1.5px dashed ${col}44` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: col, marginBottom: 12 }}>+ Lägg till kostnadspost</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10, marginBottom: 10 }}>
                        <div><label style={lStyle}>Benämning</label><input id="cost-name" placeholder="t.ex. Hotell 2 nätter" style={iStyle} /></div>
                        <div><label style={lStyle}>Belopp (kr)</label><input id="cost-amount" type="number" placeholder="0" style={iStyle} /></div>
                      </div>
                      <div style={{ marginBottom: 12 }}><label style={lStyle}>Anteckning (valfritt)</label><input id="cost-note" placeholder="t.ex. Bokad via Hotels.com" style={iStyle} /></div>
                      <button onClick={() => {
                        const name = document.getElementById("cost-name").value.trim();
                        const amount = document.getElementById("cost-amount").value;
                        const note = document.getElementById("cost-note").value.trim();
                        if (!name) return;
                        setEditGoal(g => ({ ...g, costs: [...(g.costs||[]), { name, amount, note }] }));
                        document.getElementById("cost-name").value = "";
                        document.getElementById("cost-amount").value = "";
                        document.getElementById("cost-note").value = "";
                      }} style={{ width: "100%", background: col, color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Lägg till post</button>
                    </div>
                  </div>
                )}

                {/* ── IDEAS ── */}
                {editGoalTab === "ideas" && (
                  <div>
                    {ideas.length === 0 && <div style={{ textAlign: "center", padding: "20px 0 12px", color: "var(--text2)", fontSize: 14 }}>💡 Inga idéer än</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {ideas.map((idea, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: col + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{idea.emoji || "💡"}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{idea.text}</div>
                            {idea.detail && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 3 }}>{idea.detail}</div>}
                          </div>
                          <button onClick={() => setEditGoal(g => ({ ...g, ideas: (g.ideas||[]).filter((_,j) => j !== i) }))}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: 0, opacity: 0.5, flexShrink: 0 }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: col + "0c", borderRadius: 14, padding: "16px 18px", border: `1.5px dashed ${col}44` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: col, marginBottom: 12 }}>+ Lägg till idé</div>
                      <div style={{ display: "grid", gridTemplateColumns: "50px 1fr", gap: 10, marginBottom: 10 }}>
                        <div><label style={lStyle}>Emoji</label><input id="idea-emoji" placeholder="💡" maxLength={4} style={{ ...iStyle, textAlign: "center", fontSize: 18, padding: "8px" }} /></div>
                        <div><label style={lStyle}>Idé</label><input id="idea-text" placeholder="t.ex. Provsmaka lokal mat" style={iStyle} /></div>
                      </div>
                      <div style={{ marginBottom: 12 }}><label style={lStyle}>Detalj (valfritt)</label><input id="idea-detail" placeholder="t.ex. Kolla in Södermalm" style={iStyle} /></div>
                      <button onClick={() => {
                        const text = document.getElementById("idea-text").value.trim();
                        const emoji = document.getElementById("idea-emoji").value.trim() || "💡";
                        const detail = document.getElementById("idea-detail").value.trim();
                        if (!text) return;
                        setEditGoal(g => ({ ...g, ideas: [...(g.ideas||[]), { text, emoji, detail }] }));
                        document.getElementById("idea-text").value = "";
                        document.getElementById("idea-emoji").value = "";
                        document.getElementById("idea-detail").value = "";
                      }} style={{ width: "100%", background: col, color: "#fff", border: "none", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Lägg till idé</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, flexShrink: 0, background: "var(--card)" }}>
                <button onClick={() => {
                  pushUndo("Mål");
                  setGoals(gs => gs.map(g => g.id === editGoal.id ? { ...g, ...editGoal, target: editGoal.isFree ? 0 : (parseFloat(editGoal.target) || g.target), saved: editGoal.isFree ? 0 : (parseFloat(editGoal.saved) || 0), monthlyDeposit: editGoal.isFree ? 0 : (parseFloat(editGoal.monthlyDeposit) || 0), imageOffsetY: editGoal.imageOffsetY ?? 50 } : g));
                  setEditGoal(null);
                }} style={{ flex: 1, background: col, color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  ✓ Spara ändringar
                </button>
                <button onClick={() => setEditGoal(null)}
                  style={{ background: "var(--bg2)", border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MARK DONE CONFIRMATION MODAL */}
      {markDoneGoalId && (() => {
        const goal = goals.find(g => g.id === markDoneGoalId);
        if (!goal) return null;
        return (
          <div className="modal-overlay" onClick={() => setMarkDoneGoalId(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: "var(--card)", borderRadius: 24, width: "min(400px, 94vw)", padding: "32px 28px", boxShadow: "0 32px 80px rgba(0,0,0,0.22)", textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Markera som klart?</div>
              <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 24, lineHeight: 1.6 }}>
                <strong style={{ color: "var(--text)" }}>{goal.name}</strong> kommer att flyttas till Klarade mål. Du kan alltid återaktivera det senare.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setMarkDoneGoalId(null)} style={{ flex: 1, background: "var(--bg2)", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>Avbryt</button>
                <button onClick={() => {
                  pushUndo("Mål");
                  setGoals(gs => gs.map(g => g.id === markDoneGoalId ? { ...g, manuallyCompleted: true } : g));
                  setMarkDoneGoalId(null);
                }} style={{ flex: 1, background: "#10b981", color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Ja, markera klart!</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Summary header */}
      <div style={{ background: "linear-gradient(135deg, #4c1d95, #7c3aed)", borderRadius: 20, padding: "24px 32px", marginBottom: 24, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Totalt sparat mot mål</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 4 }}>{formatSEK(totalSaved)}</div>
          <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>av {formatSEK(totalTarget)} totalt</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>Framsteg</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%</div>
          <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
            <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 99, padding: "3px 12px", fontSize: 12 }}>✅ {completed.length} klara</span>
            <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 99, padding: "3px 12px", fontSize: 12 }}>⏳ {active.length} pågående</span>
          </div>
        </div>
      </div>

      {/* Add button */}
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">
            + Nytt mål
          </button>
        </div>
      )}

      {/* ══ CREATE GOAL MODAL ══ */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--card)", borderRadius: 24, width: "min(520px, 96vw)",
            maxHeight: "88vh", display: "flex", flexDirection: "column",
            boxShadow: "0 32px 80px rgba(0,0,0,0.22)", overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${newGoal.color}dd, ${newGoal.color}88)`, padding: "22px 28px 18px", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,0.25)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: "2px solid rgba(255,255,255,0.4)" }}>
                    {newGoal.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{newGoal.name || "Nytt mål"}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{newGoal.description || "Beskriv ditt mål…"}</div>
                  </div>
                </div>
                <button onClick={() => setShowAdd(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
                {GOAL_COLORS.map(c => (
                  <button key={c} onClick={() => setNewGoal(n => ({ ...n, color: c }))}
                    style={{ width: newGoal.color === c ? 26 : 20, height: newGoal.color === c ? 26 : 20, borderRadius: "50%", background: c, border: `3px solid ${newGoal.color === c ? "#fff" : "transparent"}`, cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }} />
                ))}
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: "22px 28px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Name + description */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Namn *</label>
                  <input value={newGoal.name} onChange={e => setNewGoal(n => ({ ...n, name: e.target.value }))} placeholder="t.ex. Paris-resa, Ny laptop…"
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", color: "var(--text)", fontFamily: "inherit" }} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Beskrivning</label>
                  <input value={newGoal.description} onChange={e => setNewGoal(n => ({ ...n, description: e.target.value }))} placeholder="Vad handlar det om?"
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", color: "var(--text)", fontFamily: "inherit" }} />
                </div>

                {/* isFree toggle */}
                <div style={{ gridColumn: "1/-1" }}>
                  <button onClick={() => setNewGoal(n => ({ ...n, isFree: !n.isFree }))}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `2px solid ${newGoal.isFree ? "#10b981" : "var(--border)"}`, background: newGoal.isFree ? "#d1fae5" : "var(--bg2)", cursor: "pointer", width: "100%", boxSizing: "border-box", transition: "all 0.18s", fontFamily: "inherit" }}>
                    <span style={{ fontSize: 20 }}>{newGoal.isFree ? "✅" : "🆓"}</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: newGoal.isFree ? "#059669" : "var(--text)" }}>Gratis aktivitet</div>
                      <div style={{ fontSize: 11, color: "var(--text2)" }}>T.ex. utflykt, picknick, promenad – kostar inget</div>
                    </div>
                  </button>
                </div>

                {!newGoal.isFree && <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Målbelopp (kr) *</label>
                    <input type="number" value={newGoal.target} onChange={e => setNewGoal(n => ({ ...n, target: e.target.value }))} placeholder="5 000"
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", color: "var(--text)", fontFamily: "inherit" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Redan sparat (kr)</label>
                    <input type="number" value={newGoal.saved} onChange={e => setNewGoal(n => ({ ...n, saved: e.target.value }))} placeholder="0"
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", color: "var(--text)", fontFamily: "inherit" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Månadsinsättning (kr)</label>
                    <input type="number" value={newGoal.monthlyDeposit} onChange={e => setNewGoal(n => ({ ...n, monthlyDeposit: e.target.value }))} placeholder="valfritt"
                      style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", color: "var(--text)", fontFamily: "inherit" }} />
                  </div>
                </>}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Kategori</label>
                  <select value={newGoal.category} onChange={e => setNewGoal(n => ({ ...n, category: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", color: "var(--text)", fontFamily: "inherit", appearance: "none" }}>
                    {GOAL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Image */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>📷 Bild (valfritt)</label>
                {newGoal.image ? (
                  <div>
                    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "2px solid var(--border)", height: 130 }}>
                      <img src={newGoal.image} alt="Målbild" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `center ${newGoal.imageOffsetY ?? 50}%`, display: "block" }} />
                      <button onClick={() => setNewGoal(n => ({ ...n, image: null }))} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 26, height: 26, color: "#fff", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      <button onClick={() => setImagePickerFor("new")} style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 8, padding: "4px 10px", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>🔍 Byt bild</button>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 700, whiteSpace: "nowrap" }}>↕ Justera</span>
                      <input type="range" min="0" max="100" value={newGoal.imageOffsetY ?? 50}
                        onChange={e => setNewGoal(n => ({ ...n, imageOffsetY: Number(e.target.value) }))}
                        style={{ flex: 1, accentColor: newGoal.color || "#3b82f6", cursor: "pointer" }} />
                      <span style={{ fontSize: 11, color: "var(--text2)", width: 32, textAlign: "right" }}>{newGoal.imageOffsetY ?? 50}%</span>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setImagePickerFor("new")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, border: "2px dashed var(--border)", background: "var(--bg2)", cursor: "pointer", color: "var(--text2)", fontSize: 13, fontWeight: 600, width: "100%", boxSizing: "border-box", fontFamily: "inherit" }}>
                    <span style={{ fontSize: 20 }}>🔍</span> Sök och välj bild...
                  </button>
                )}
              </div>

              {/* Icon picker */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Välj ikon</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {GOAL_ICONS.map(icon => (
                    <button key={icon} onClick={() => setNewGoal(n => ({ ...n, icon }))}
                      style={{ width: 42, height: 42, borderRadius: 12, border: `2px solid ${newGoal.icon === icon ? newGoal.color : "var(--border)"}`, background: newGoal.icon === icon ? newGoal.color + "20" : "var(--bg2)", fontSize: 20, cursor: "pointer", transition: "all 0.15s" }}>{icon}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, flexShrink: 0 }}>
              <button onClick={() => setShowAdd(false)} style={{ background: "var(--bg2)", border: "none", borderRadius: 12, padding: "12px 20px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", color: "var(--text)" }}>Avbryt</button>
              <button onClick={addGoal} style={{ flex: 1, background: newGoal.color, color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Skapa mål</button>
            </div>
          </div>
        </div>
      )}

      {/* Active goals */}
      {active.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>⏳ Pågående mål</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16 }}>
            {active.map(goal => {
              const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
              const remaining = goal.target - goal.saved;
              const monthly = goal.monthlyDeposit || 0;
              const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;
              const doneDate = monthsLeft ? (() => {
                const d = new Date(); d.setMonth(d.getMonth() + monthsLeft);
                return d.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
              })() : null;
              // Milestones: which ones are reached
              const milestonesSeen = goal.milestonesSeen || [];
              const milestones = [25, 50, 75].map(m => ({ pct: m, reached: pct >= m, seen: milestonesSeen.includes(m) }));
              // Savings growth mini-chart data: project future months
              const chartMonths = 6;
              const chartPoints = Array.from({ length: chartMonths + 1 }, (_, i) => Math.min(goal.target, goal.saved + monthly * i));
              const chartMax = goal.target;
              const chartW = 220, chartH = 50;

/* NOTE: streak removed */
              return (
                <Card key={goal.id} style={{ position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: goal.color }} />

                  {/* Goal image */}
                  {goal.image && (
                    <div style={{ margin: "8px -24px 12px", overflow: "hidden", maxHeight: 130 }}>
                      <img src={goal.image} alt={goal.name} style={{ width: "100%", objectFit: "cover", maxHeight: 130, display: "block", objectPosition: `center ${goal.imageOffsetY ?? 50}%` }} />
                    </div>
                  )}

                  {/* Milestone celebration toast */}
                  {goal.newMilestone && (
                    <div className="milestone-in" style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 20, background: goal.color, color: "#fff", borderRadius: 99, padding: "6px 18px", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}>
                      🎉 {goal.newMilestone}% uppnått!
                    </div>
                  )}

                  <div style={{ paddingTop: goal.newMilestone ? 38 : 8 }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 13, background: goal.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>{goal.icon}</div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800 }}>{goal.name}</div>
                          {goal.description && <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 1 }}>{goal.description}</div>}
                          <div style={{ display: "flex", gap: 5, marginTop: 3, alignItems: "center" }}>
                            <span style={{ fontSize: 11, background: goal.color + "20", color: goal.color, borderRadius: 99, padding: "1px 8px", fontWeight: 700 }}>{goal.category}</span>
                            {/* Free badge */}
                            {goal.isFree && (
                              <span style={{ fontSize: 11, background: "#d1fae5", color: "#059669", borderRadius: 99, padding: "1px 8px", fontWeight: 700 }}>🆓 Gratis</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setInfoGoalId(infoGoalId === goal.id ? null : goal.id)}
                            style={{ width: 26, height: 26, borderRadius: "50%", background: infoGoalId === goal.id ? goal.color + "30" : "var(--bg2)", border: `1.5px solid ${infoGoalId === goal.id ? goal.color : "var(--border)"}`, color: infoGoalId === goal.id ? goal.color : "var(--text2)", cursor: "pointer", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>i</button>
                          <button onClick={() => setMarkDoneGoalId(goal.id)} title="Markera klart" style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", fontSize: 14, opacity: 0.7, padding: 0 }}>✅</button>
                          <button onClick={() => { setEditGoal({ ...goal }); setEditGoalTab("basic"); }} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 14, opacity: 0.6, padding: 0 }}>✏️</button>
                          <button onClick={() => deleteGoal(goal.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, opacity: 0.4, padding: 0 }}>✕</button>
                        </div>
                      )}
                    </div>

                    {/* For free goals: show a simple "Planerad aktivitet" banner */}
                    {goal.isFree ? (
                      <div style={{ background: "#d1fae5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>🆓</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>Gratis aktivitet – inget sparande behövs!</span>
                      </div>
                    ) : <>
                    {/* Milestone dots */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--text2)" }}>Milstolpar:</span>
                      {milestones.map(m => (
                        <div key={m.pct} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <div style={{ width: 16, height: 16, borderRadius: "50%", background: m.reached ? goal.color : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 800, transition: "all 0.4s" }}>
                            {m.reached ? "✓" : ""}
                          </div>
                          <span style={{ fontSize: 10, color: m.reached ? goal.color : "var(--text2)", fontWeight: m.reached ? 700 : 400 }}>{m.pct}%</span>
                        </div>
                      ))}
                      <span style={{ fontSize: 10, color: "var(--text2)", marginLeft: "auto" }}>🏁 100%</span>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: goal.color }}>{formatSEK(goal.saved)}</span>
                        <span style={{ fontSize: 13, color: "var(--text2)" }}>av {formatSEK(goal.target)}</span>
                      </div>
                      <div style={{ background: "var(--bg2)", borderRadius: 99, height: 10, overflow: "hidden", position: "relative" }}>
                        {/* Milestone tick marks */}
                        {[25, 50, 75].map(m => (
                          <div key={m} style={{ position: "absolute", left: `${m}%`, top: 0, bottom: 0, width: 2, background: "var(--card)", zIndex: 2, opacity: 0.6 }} />
                        ))}
                        <div style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${goal.color}cc, ${goal.color})`, height: "100%", borderRadius: 99, transition: "width 0.7s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: goal.color }}>{pct}% klart</span>
                        <span style={{ fontSize: 11, color: "var(--text2)" }}>{formatSEK(remaining)} kvar</span>
                      </div>
                    </div>
                    </>}

                    {/* Growth mini-chart (only if monthly deposit set & active) */}
                    {goal.monthlyActive && monthly > 0 && chartPoints.length > 1 && (
                      <div style={{ background: "var(--bg2)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>📈 Tillväxt nästa 6 månader</div>
                        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + 16}`} style={{ overflow: "visible" }}>
                          {/* Area fill */}
                          <defs>
                            <linearGradient id={`grad-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={goal.color} stopOpacity="0.3" />
                              <stop offset="100%" stopColor={goal.color} stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          {(() => {
                            const pts = chartPoints.map((v, i) => [i * (chartW / chartMonths), chartH - (v / chartMax) * chartH]);
                            const areaPath = `M${pts[0][0]},${chartH} ${pts.map(p => `L${p[0]},${p[1]}`).join(" ")} L${pts[pts.length-1][0]},${chartH} Z`;
                            const linePath = `M${pts.map(p => `${p[0]},${p[1]}`).join(" L")}`;
                            return (
                              <>
                                <path d={areaPath} fill={`url(#grad-${goal.id})`} />
                                <path d={linePath} fill="none" stroke={goal.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                {pts.map((p, i) => i % 2 === 0 && (
                                  <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={goal.color} />
                                ))}
                                {/* Goal line */}
                                <line x1="0" y1="0" x2={chartW} y2="0" stroke={goal.color} strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.4" />
                                {/* Labels */}
                                {pts.map((p, i) => i % 2 === 0 && (
                                  <text key={i} x={Math.max(8, Math.min(chartW - 8, p[0]))} y={chartH + 13} textAnchor={i === 0 ? "start" : i === chartMonths ? "end" : "middle"} fontSize="8" fill="var(--text2)">
                                    {i === 0 ? "Nu" : `+${i}m`}
                                  </text>
                                ))}
                              </>
                            );
                          })()}
                        </svg>
                        {/* Summary below chart */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
                          {[
                            { label: "Per månad", value: formatSEK(monthly), color: "#3b82f6" },
                            { label: "Månader kvar", value: monthsLeft ?? "–", color: goal.color },
                            { label: "Klart", value: doneDate ? doneDate.charAt(0).toUpperCase() + doneDate.slice(1) : "–", color: "#10b981", small: true },
                          ].map(item => (
                            <div key={item.label} style={{ background: "var(--card)", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                              <div style={{ fontSize: 9, color: "var(--text2)", marginBottom: 1, fontWeight: 600, textTransform: "uppercase" }}>{item.label}</div>
                              <div style={{ fontSize: item.small ? 10 : 13, fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sparat totalt footer */}
                    {goal.monthlyActive && monthly > 0 && doneDate && (
                      <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "7px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: "var(--text2)" }}>💰 Sparat totalt</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: goal.color }}>{formatSEK(goal.target)} i {doneDate.charAt(0).toUpperCase() + doneDate.slice(1)}</span>
                      </div>
                    )}

                    {/* Action buttons */}
                    {canEdit && (
                      adjustGoalId === goal.id ? (
                        <div style={{ background: "var(--bg2)", borderRadius: 12, padding: 12, border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                            {[{ mode: "add", label: "+ Sätt in" }, { mode: "subtract", label: "− Ta ut" }, { mode: "set", label: "✎ Sätt till" }].map(opt => (
                              <button key={opt.mode} onClick={() => setAdjustMode(opt.mode)} style={{ flex: 1, padding: "5px", borderRadius: 8, border: `1.5px solid ${adjustMode === opt.mode ? goal.color : "var(--border)"}`, background: adjustMode === opt.mode ? goal.color + "15" : "transparent", color: adjustMode === opt.mode ? goal.color : "var(--text2)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{opt.label}</button>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder={adjustMode === "set" ? `Sätt till (nuv: ${goal.saved})` : "Belopp (SEK)"} autoFocus style={{ flex: 1, background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 13, outline: "none", color: "var(--text)", fontFamily: "inherit" }} />
                            <button onClick={() => handleAdjust(goal.id)} style={{ background: goal.color, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>OK</button>
                            <button onClick={() => { setAdjustGoalId(null); setAdjustAmount(""); }} style={{ background: "var(--border)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 13, cursor: "pointer", color: "var(--text2)" }}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { setAdjustGoalId(goal.id); setAdjustMode("add"); setAdjustAmount(""); }} style={{ flex: 1, background: goal.color + "15", color: goal.color, border: `1.5px solid ${goal.color}33`, borderRadius: 10, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            Sätt in pengar
                          </button>
                          {monthly > 0 && (
                            <button onClick={() => setGoals(gs => gs.map(g => g.id === goal.id ? { ...g, monthlyActive: !g.monthlyActive } : g))}
                              title={goal.monthlyActive ? "Stäng av månadsvisning" : "Sätt på månadsvisning"}
                              style={{ background: goal.monthlyActive ? goal.color + "18" : "var(--bg2)", color: goal.monthlyActive ? goal.color : "var(--text2)", border: `1.5px solid ${goal.monthlyActive ? goal.color + "44" : "var(--border)"}`, borderRadius: 10, padding: "7px 12px", fontSize: 16, cursor: "pointer" }}>
                              📅
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>

                  {/* ══ INFO PANEL ══ */}
                  {infoGoalId === goal.id && (
                    <div className="fadeIn" style={{ margin: "12px -24px -20px", borderTop: `2px solid ${goal.color}30`, background: goal.color + "06", borderRadius: "0 0 16px 16px", overflow: "hidden" }}>
                      {/* Panel header */}
                      <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${goal.color}20` }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: goal.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>Detaljer om målet</div>
                      </div>

                      <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

                        {/* Description + notes */}
                        {(goal.description || goal.notes || goal.date) && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {goal.description && (
                              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>📝 {goal.description}</div>
                            )}
                            {goal.date && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, background: goal.color + "15", borderRadius: 8, padding: "7px 12px" }}>
                                <span style={{ fontSize: 16 }}>📅</span>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: goal.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>Måldatum</div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{new Date(goal.date).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })}</div>
                                </div>
                              </div>
                            )}
                            {goal.notes && (
                              <div style={{ background: "var(--bg2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--text2)", lineHeight: 1.7, whiteSpace: "pre-wrap", borderLeft: `3px solid ${goal.color}` }}>
                                {goal.notes}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Links */}
                        {(goal.links||[]).length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>🔗 Länkar ({goal.links.length})</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {goal.links.map((link, i) => {
                                const catIcon = { Hotell:"🏨", Flyg:"✈️", Restaurang:"🍽", Aktivitet:"🎯", Övrigt:"🔗" }[link.category] || "🔗";
                                return (
                                  <a key={i} href={link.url.startsWith("http") ? link.url : "https://" + link.url} target="_blank" rel="noopener noreferrer"
                                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--card)", borderRadius: 10, border: `1px solid ${goal.color}25`, textDecoration: "none", transition: "background 0.15s" }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 9, background: goal.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{catIcon}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{link.name || link.url}</div>
                                      <div style={{ fontSize: 11, color: goal.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.url}</div>
                                    </div>
                                    <span style={{ fontSize: 10, background: goal.color + "18", color: goal.color, borderRadius: 99, padding: "3px 9px", fontWeight: 700, flexShrink: 0 }}>{link.category}</span>
                                    <span style={{ fontSize: 12, color: goal.color, flexShrink: 0 }}>↗</span>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Costs */}
                        {(goal.costs||[]).length > 0 && (
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>💸 Planerade kostnader</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: goal.color }}>{(goal.costs.reduce((s,c) => s+(parseFloat(c.amount)||0),0)).toLocaleString("sv-SE")} kr</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {goal.costs.map((cost, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--card)", borderRadius: 10, border: `1px solid ${goal.color}20` }}>
                                  <div style={{ width: 30, height: 30, borderRadius: 8, background: goal.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>💸</div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{cost.name}</div>
                                    {cost.note && <div style={{ fontSize: 11, color: "var(--text2)" }}>{cost.note}</div>}
                                  </div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: goal.color }}>{(parseFloat(cost.amount)||0).toLocaleString("sv-SE")} kr</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Ideas */}
                        {(goal.ideas||[]).length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>💡 Idéer & aktiviteter ({goal.ideas.length})</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                              {goal.ideas.map((idea, i) => (
                                <div key={i} style={{ padding: "10px 12px", background: "var(--card)", borderRadius: 10, border: `1px solid ${goal.color}20` }}>
                                  <div style={{ fontSize: 20, marginBottom: 5 }}>{idea.emoji || "💡"}</div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{idea.text}</div>
                                  {idea.detail && <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 3, lineHeight: 1.4 }}>{idea.detail}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Empty state */}
                        {!goal.description && !goal.date && !goal.notes && !(goal.links||[]).length && !(goal.costs||[]).length && !(goal.ideas||[]).length && (
                          <div style={{ textAlign: "center", padding: "12px 0", color: "var(--text2)", fontSize: 13 }}>
                            Inga detaljer ännu — tryck ✏️ för att fylla i allt
                          </div>
                        )}

                        {/* Edit shortcut */}
                        <button onClick={() => { setEditGoal({...goal}); setEditGoalTab("basic"); setInfoGoalId(null); }}
                          style={{ width: "100%", background: goal.color + "15", color: goal.color, border: `1.5px solid ${goal.color}33`, borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          ✏️ Redigera detaljer
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed goals */}
      {completed.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>✅ Uppnådda mål</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {completed.map(goal => (
              <div key={goal.id} style={{ background: "#d1fae5", borderRadius: 16, border: "1px solid #a7f3d0", overflow: "hidden", position: "relative" }}>
                {goal.image && (
                  <div style={{ height: 90, overflow: "hidden" }}>
                    <img src={goal.image} alt={goal.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `center ${goal.imageOffsetY != null ? goal.imageOffsetY : 50}%` }} />
                  </div>
                )}
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: "#10b981" + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{goal.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#065f46" }}>{goal.name}</div>
                    <div style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>
                      {goal.manuallyCompleted ? "🎉 Markerat som klart!" : `🎉 ${formatSEK(goal.target)} uppnått!`}
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button onClick={() => { pushUndo("Mål"); setGoals(gs => gs.map(g => g.id === goal.id ? { ...g, manuallyCompleted: false } : g)); }} title="Återaktivera" style={{ background: "none", border: "1px solid #10b981", borderRadius: 8, color: "#059669", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "3px 8px", fontFamily: "inherit" }}>↩ Återaktivera</button>
                      <button onClick={() => { setEditGoal({ ...goal }); setEditGoalTab("basic"); }} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: 14, opacity: 0.6, padding: 0 }}>✏️</button>
                      <button onClick={() => deleteGoal(goal.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, opacity: 0.5 }}>✕</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text2)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Inga mål ännu</div>
          <div style={{ fontSize: 14 }}>Klicka på + Nytt mål för att komma igång!</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FORECAST PAGE
// ============================================================
function ForecastPage({ income, expenses, debts, extraIncome, beredskap, futureSalaries = [], plannedExpenses = [], monthSchedule = {}, appTexts = {}, recurringExpenses = [] }) {
  const months = 12;
  const rows = [];
  const baseSalary    = income.find(i => i.type === "salary")?.amount || 0;
  const baseOther     = income.filter(i => i.type !== "salary").reduce((s, i) => s + i.amount, 0);
  const now           = new Date();
  const sortedFuture  = [...futureSalaries].sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
  const beredskapTypes = appTexts.beredskapTypes || [];
  // Pre-compute payoff month index for each debt (how many months from now until paid off)
  const debtPayoffMonth = {};
  debts.forEach(d => {
    debtPayoffMonth[d.id] = d.remaining <= 0 ? -1 : calcDebtPayoff(d.remaining, d.monthly).months;
  });

  function salaryForMonth(monthKey) {
    const override = monthSchedule[monthKey + "_amount"];
    if (override != null && override !== "") return Number(override);
    const schedKey = monthSchedule[monthKey];
    if (schedKey) {
      const found = beredskapTypes.find(t => t.key === schedKey);
      if (found) return Number(found.amount);
    }
    return baseSalary;
  }

  for (let i = 0; i < months; i++) {
    const d          = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
    const salary     = salaryForMonth(monthKey);
    const activeDebts = debts.filter(d2 => calcDebtPayoff(d2.remaining, d2.monthly).months > i);
    // Debts that get paid off exactly at month i
    const debtFreedThisMonth = [];
    // Skip expenses linked to paid-off debts, temporary for future months, hidden, and skipped months
    const monthExpenses = expenses.reduce((s, e) => {
      if (e.hidden) return s;
      // Skip if this expense is paused in this month
      if (e.skipMonths && e.skipMonths.includes(monthKey)) return s;
      // Debt-linked: check if debt is already paid off by this month
      if (e.debtLink) {
        const payoff = debtPayoffMonth[e.debtLink];
        if (payoff != null && payoff <= i) {
          // Debt paid off by or before this month — don't count expense
          if (payoff === i && !debtFreedThisMonth.find(x => x.id === e.debtLink)) {
            const debt = debts.find(dd => dd.id === e.debtLink);
            if (debt) debtFreedThisMonth.push(debt);
          }
          return s;
        }
      }
      if (e.temporary && i > 0) return s;
      return s + e.cost;
    }, 0);
    // Collect expenses that are skipped this month for notation
    const skippedExpenses = expenses.filter(e => !e.hidden && e.skipMonths && e.skipMonths.includes(monthKey));
    const extraItems = extraIncome.filter(e => e.month === monthKey);
    const extra      = extraItems.reduce((s, e) => s + e.amount, 0);
    const schedKey   = monthSchedule[monthKey] || null;
    const schedType  = schedKey;
    const foundType  = schedKey ? beredskapTypes.find(t => t.key === schedKey) : null;
    const beredskapTotal = foundType ? Number(foundType.amount) : null;
    const beredskapBonus = beredskapTotal != null ? beredskapTotal - baseSalary : 0;
    const plannedItems = plannedExpenses.filter(p => {
      if (!p.dueDate) return false;
      return getSalaryMonthKeyForDate(p.dueDate) === monthKey;
    });
    const plannedCost = plannedItems.reduce((s, p) => s + p.cost, 0);
    // Recurring expenses active for this month
    const recurringCost = recurringExpenses.filter(r => {
      if (r.hidden || !r.startDate) return false;
      return getSalaryMonthKeyForDate(r.startDate) <= monthKey;
    }).reduce((s, r) => s + r.cost, 0);
    const totalIn    = salary + baseOther + extra;
    const leftover   = totalIn - monthExpenses - plannedCost - recurringCost;
    const salaryChange = sortedFuture.find(fs => fs.fromMonth === monthKey);
    // debtFreeings: debts whose linked expenses become free this month
    const allDebtFreeings = [...debtFreedThisMonth, ...debts.filter(d2 => {
      const pm = debtPayoffMonth[d2.id];
      return pm === i && !debtFreedThisMonth.find(x => x.id === d2.id);
    })];
    rows.push({ label: monthLabel, monthKey, income: totalIn, salary, expenses: monthExpenses, plannedCost, plannedItems, recurringCost, leftover, extra, extraItems, beredskapBonus, schedType, salaryChange, debtFreeings: allDebtFreeings, skippedExpenses });
  }

  return (
    <div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 700 }}>🔮 12-månadsprognos</div>
        <div className="forecast-wrap" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Månad</th>
              <th>Inkomst</th>
              <th>Fasta utgifter</th>
              <th>Sittande</th>
              <th>Planerade</th>
              <th>Kvar</th>
              <th>Noteringar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="row-hover" style={{ fontWeight: i === 0 ? 700 : 400, background: row.plannedCost > 0 ? "#faf5ff" : row.salaryChange ? "#eff6ff" : i === 0 ? "var(--hover)" : "transparent" }}>
                <td style={{ textTransform: "capitalize", fontWeight: 600 }}>{row.label}</td>
                <td style={{ color: "#10b981", fontWeight: 700 }}>{formatSEK(row.income)}</td>
                <td style={{ color: "#ef4444" }}>{formatSEK(row.expenses)}</td>
                <td style={{ color: row.recurringCost > 0 ? "#3b82f6" : "var(--text2)", fontWeight: row.recurringCost > 0 ? 700 : 400 }}>{row.recurringCost > 0 ? formatSEK(row.recurringCost) : "–"}</td>
                <td style={{ color: row.plannedCost > 0 ? "#8b5cf6" : "var(--text2)", fontWeight: row.plannedCost > 0 ? 700 : 400 }}>{row.plannedCost > 0 ? formatSEK(row.plannedCost) : "–"}</td>
                <td style={{ fontWeight: 800, color: row.leftover >= 0 ? "#10b981" : "#ef4444" }}>{formatSEK(row.leftover)}</td>
                <td style={{ fontSize: 12 }}>
                  {row.salaryChange && (
                    <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 6, padding: "1px 8px", marginRight: 4, fontWeight: 700 }}>
                      💼 Ny lön {formatSEK(row.salaryChange.amount)}{row.salaryChange.note ? ` · ${row.salaryChange.note}` : ""}
                    </span>
                  )}
                  {row.schedType && (() => {
                    const btypes = appTexts.beredskapTypes || [];
                    const found = btypes.find(t => t.key === row.schedType);
                    if (!found) return null;
                    const tags = found.tags || [];
                    // Always show at least the type icon+name if no tags defined
                    if (tags.length === 0) {
                      if (found.readOnly) return null;
                      return (
                        <span style={{ background: found.color + "22", color: found.color, borderRadius: 6, padding: "2px 8px", marginRight: 4, fontWeight: 700, border: `1px solid ${found.color}44`, fontSize: 11 }}>
                          {found.icon} {found.name}
                        </span>
                      );
                    }
                    return tags.map(tag => {
                      const m = FORECAST_TAG_META[tag];
                      if (!m) return null;
                      // For beredskap tag, append the bonus amount
                      const bonus = tag === "beredskap" && row.beredskapBonus > 0
                        ? ` +${row.beredskapBonus.toLocaleString("sv-SE")} kr` : "";
                      return (
                        <span key={tag} style={{ background: m.bg, color: m.fg, borderRadius: 6, padding: "2px 8px", marginRight: 4, fontWeight: 700, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {m.icon} {m.label}{bonus}
                        </span>
                      );
                    });
                  })()}
                  {row.extra > 0 && (row.extraItems || []).map(e => (
                    <span key={e.id} style={{ background: (e.color || "#f59e0b") + "25", color: e.color || "#f59e0b", borderRadius: 6, padding: "1px 8px", marginRight: 4, fontWeight: 600, border: `1px solid ${(e.color || "#f59e0b")}44` }}>
                      {e.emoji || "⭐"} {e.name} {formatSEK(e.amount)}
                    </span>
                  ))}
                  {(row.plannedItems||[]).map(p => <span key={p.id} style={{ background: "#ede9fe", color: "#7c3aed", borderRadius: 6, padding: "1px 8px", marginRight: 4, fontWeight: 600 }}>🗓 {p.service} {formatSEK(p.cost)}</span>)}
                  {row.debtFreeings.map(d => <span key={d.id} style={{ background: "#d1fae5", color: "#10b981", borderRadius: 6, padding: "1px 8px", marginRight: 4, fontWeight: 700 }}>✅ {d.name} avbetald</span>)}
                  {(row.skippedExpenses||[]).map(e => <span key={e.id} style={{ background: "#fef3c7", color: "#92400e", borderRadius: 6, padding: "1px 8px", marginRight: 4, fontWeight: 600, fontSize: 11 }}>⏸ {e.service} pausad</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// MONTHLY HISTORY PAGE
// ============================================================
function MonthlyHistoryPage({ monthlyHistory, setMonthlyHistory, expenses, setExpenses, totalIncome, totalExpenses, leftover, debts, pushUndo = () => {} }) {
  const [showClose, setShowClose] = useState(false);
  const [note, setNote]           = useState("");
  const [compareA, setCompareA]   = useState(null);
  const [compareB, setCompareB]   = useState(null);

  const now      = new Date();
  const today    = now.getDate();
  // Current tracked month: if today < 25 we're still in this month's cycle,
  // if we've already closed this month (salary not yet), still show current month.
  // After closing, next open month is auto-advanced.
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Figure out which month to show as "active" — the latest unclosed month
  // The salary date is the 25th (or earlier if weekend)
  const salaryDay = getSalaryDate(currentYear, currentMonth + 1).getDate();
  const canCloseToday = today >= salaryDay; // can only close on/after salary date

  // Build the current month key like "mars 2026"
  const activeMonthLabel = now.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
  // Next month label
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const nextMonthLabel = nextMonthDate.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });

  // Check if this month has already been closed
  const isCurrentMonthClosed = monthlyHistory.some(m =>
    m.month.toLowerCase() === activeMonthLabel.toLowerCase()
  );

  // If current month is closed, show next month as "upcoming"
  const displayMonth    = isCurrentMonthClosed ? nextMonthLabel : activeMonthLabel;
  const salaryDateStr   = getSalaryDate(currentYear, currentMonth + 1).toLocaleDateString("sv-SE");
  const daysUntilSalary = canCloseToday ? 0 : salaryDay - today;

  function closeMonth() {
    const paidCount   = expenses.filter(e => e.status === "paid").length;
    const unpaidCount = expenses.filter(e => e.status === "unpaid").length;
    const autoCount   = expenses.filter(e => e.status === "autogiro").length;
    const entry = {
      id:          Date.now(),
      month:       activeMonthLabel,
      closedAt:    now.toLocaleDateString("sv-SE"),
      income:      totalIncome,
      expenses:    totalExpenses,
      leftover,
      debtTotal:   debts.reduce((s, d) => s + d.remaining, 0),
      paidCount,
      unpaidCount,
      autoCount,
      note:        note.trim(),
    };
    setMonthlyHistory(h => [entry, ...h]);
    setExpenses(es => es.filter(e => !e.temporary).map(e => ({ ...e, status: "unpaid" })));
    setNote("");
    setShowClose(false);
  }

  const avg = (key) => monthlyHistory.length
    ? Math.round(monthlyHistory.reduce((s, m) => s + (m[key] || 0), 0) / monthlyHistory.length)
    : 0;

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Month status banner */}
      <div style={{
        background: isCurrentMonthClosed
          ? "linear-gradient(135deg, #065f46, #10b981)"
          : "linear-gradient(135deg, #1e3a5f, #2563eb)",
        borderRadius: 20, padding: "24px 32px", marginBottom: 24, color: "#fff",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7, marginBottom: 6 }}>
            {isCurrentMonthClosed ? "✅ Stängd · Nästa månad" : "Aktuell månad"}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", textTransform: "capitalize" }}>{displayMonth}</div>
          {isCurrentMonthClosed ? (
            <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
              {activeMonthLabel.charAt(0).toUpperCase() + activeMonthLabel.slice(1)} är stängd — nästa månaden öppnas automatiskt
            </div>
          ) : (
            <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
              Inkomst − Utgifter = <span style={{ fontWeight: 800 }}>{Math.abs(leftover).toLocaleString("sv-SE")} kr {leftover >= 0 ? "kvar" : "underskott"}</span>
            </div>
          )}
        </div>

        {!isCurrentMonthClosed && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {!canCloseToday && (
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                🔒 Stängs tidigast {salaryDateStr}<br />
                <span style={{ opacity: 0.8, fontSize: 11 }}>om {daysUntilSalary} dagar (efter löning)</span>
              </div>
            )}
            <button
              onClick={() => canCloseToday ? setShowClose(v => !v) : null}
              disabled={!canCloseToday}
              style={{
                background: canCloseToday ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)",
                border: "1.5px solid rgba(255,255,255,0.3)", color: canCloseToday ? "#fff" : "rgba(255,255,255,0.4)",
                borderRadius: 12, padding: "10px 22px", fontSize: 14, fontWeight: 700,
                cursor: canCloseToday ? "pointer" : "not-allowed", fontFamily: "inherit", backdropFilter: "blur(4px)"
              }}>
              {showClose ? "✕ Avbryt" : canCloseToday ? "📅 Stäng månaden" : "📅 Stäng månaden"}
            </button>
          </div>
        )}
      </div>

      {showClose && !isCurrentMonthClosed && (
        <div style={{ background: "var(--card)", borderRadius: 18, border: "1px solid var(--border)", padding: "22px 26px", marginBottom: 20 }} className="fadeIn">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, textTransform: "capitalize" }}>Stäng {activeMonthLabel}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Inkomst",  value: totalIncome,   color: "#10b981" },
              { label: "Utgifter", value: totalExpenses,  color: "#ef4444" },
              { label: "Kvar",     value: leftover,       color: leftover >= 0 ? "#10b981" : "#ef4444" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--bg2)", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value.toLocaleString("sv-SE")} kr</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Notering (valfritt)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="t.ex. Dyr månad pga semesterresa…"
              style={{ width: "100%", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 14px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 16 }}>⚠️ Alla räkningar återställs till Obetald när du stänger månaden.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowClose(false)} className="btn btn-ghost" style={{ flex: 1 }}>Avbryt</button>
            <button onClick={closeMonth} className="btn btn-primary" style={{ flex: 2 }}>✓ Bekräfta och stäng månaden</button>
          </div>
        </div>
      )}

      {/* Stats row */}
      {monthlyHistory.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Snitt inkomst",  value: avg("income"),   color: "#10b981" },
            { label: "Snitt utgifter", value: avg("expenses"), color: "#ef4444" },
            { label: "Snitt kvar",     value: avg("leftover"), color: avg("leftover") >= 0 ? "#10b981" : "#ef4444" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--card)", borderRadius: 16, padding: "16px 20px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value.toLocaleString("sv-SE")} kr</div>
            </div>
          ))}
        </div>
      )}

      {/* ══ JÄMFÖRELSE ══ */}
      {monthlyHistory.length >= 2 && (() => {
        const months = [...monthlyHistory].reverse(); // oldest first for display
        const mA = compareA ? monthlyHistory.find(m => m.id === compareA) : monthlyHistory[1];
        const mB = compareB ? monthlyHistory.find(m => m.id === compareB) : monthlyHistory[0];
        const metrics = [
          { key: "income",   label: "Inkomst",  color: "#10b981", icon: "💰" },
          { key: "expenses", label: "Utgifter", color: "#ef4444", icon: "🧾" },
          { key: "leftover", label: "Kvar",     color: "#3b82f6", icon: "✅" },
        ];
        const maxVal = mA && mB
          ? Math.max(...metrics.map(m => Math.max(Math.abs(mA[m.key]||0), Math.abs(mB[m.key]||0))), 1)
          : 1;

        const selStyle = { background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "7px 12px", fontSize: 13, color: "var(--text)", fontFamily: "inherit", outline: "none", cursor: "pointer" };
        return (
          <div style={{ background: "var(--card)", borderRadius: 20, padding: "24px 28px", marginBottom: 20, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>📊 Månadshjämförelse</div>

            {/* Pickers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", marginBottom: 24 }}>
              <select style={selStyle} value={mA?.id ?? ""} onChange={e => setCompareA(Number(e.target.value))}>
                {monthlyHistory.map(m => <option key={m.id} value={m.id}>{m.month}</option>)}
              </select>
              <span style={{ fontWeight: 800, color: "var(--text2)", fontSize: 18 }}>vs</span>
              <select style={selStyle} value={mB?.id ?? ""} onChange={e => setCompareB(Number(e.target.value))}>
                {monthlyHistory.map(m => <option key={m.id} value={m.id}>{m.month}</option>)}
              </select>
            </div>

            {mA && mB && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {metrics.map(met => {
                  const valA = mA[met.key] || 0;
                  const valB = mB[met.key] || 0;
                  const diff = valB - valA;
                  const pctA = Math.round((Math.abs(valA) / maxVal) * 100);
                  const pctB = Math.round((Math.abs(valB) / maxVal) * 100);
                  const diffColor = met.key === "expenses"
                    ? (diff > 0 ? "#ef4444" : "#10b981")
                    : (diff >= 0 ? "#10b981" : "#ef4444");
                  return (
                    <div key={met.key}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{met.icon} {met.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: diffColor, background: diffColor + "18", borderRadius: 99, padding: "2px 10px" }}>
                          {diff >= 0 ? "+" : ""}{diff.toLocaleString("sv-SE")} kr
                        </span>
                      </div>
                      {/* Bar A */}
                      <div style={{ marginBottom: 5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text2)", marginBottom: 3 }}>
                          <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{mA.month}</span>
                          <span style={{ fontWeight: 700, color: "var(--text)" }}>{valA.toLocaleString("sv-SE")} kr</span>
                        </div>
                        <div style={{ background: "var(--bg2)", borderRadius: 99, height: 10, overflow: "hidden" }}>
                          <div style={{ width: `${pctA}%`, background: met.color, height: "100%", borderRadius: 99, opacity: 0.5, transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                      {/* Bar B */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text2)", marginBottom: 3 }}>
                          <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{mB.month}</span>
                          <span style={{ fontWeight: 700, color: "var(--text)" }}>{valB.toLocaleString("sv-SE")} kr</span>
                        </div>
                        <div style={{ background: "var(--bg2)", borderRadius: 99, height: 10, overflow: "hidden" }}>
                          <div style={{ width: `${pctB}%`, background: met.color, height: "100%", borderRadius: 99, transition: "width 0.4s ease" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* History list */}
      {monthlyHistory.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text2)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Ingen historik ännu</div>
          <div style={{ fontSize: 14 }}>Stäng din första månad ovan för att börja spåra.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {monthlyHistory.map((m, i) => (
            <div key={m.id} style={{ background: "var(--card)", borderRadius: 18, border: "1px solid var(--border)", padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", textTransform: "capitalize" }}>{m.month}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>Stängd {m.closedAt}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", color: m.leftover >= 0 ? "#10b981" : "#ef4444" }}>
                    {m.leftover >= 0 ? "+" : ""}{m.leftover.toLocaleString("sv-SE")} kr
                  </div>
                  <button onClick={() => (() => { pushUndo("Månadshistorik"); setMonthlyHistory(h => h.filter(x => x.id !== m.id)); })()}
                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, opacity: 0.5, padding: 4 }}>✕</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: m.note ? 12 : 0 }}>
                {[
                  { label: "Inkomst",      val: m.income,    color: "#10b981" },
                  { label: "Utgifter",     val: m.expenses,  color: "#ef4444" },
                  { label: "Skulder",      val: m.debtTotal, color: "#f59e0b" },
                  { label: "Räkn. betalda", val: `${m.paidCount}/${m.paidCount + m.unpaidCount + m.autoCount}`, color: "#3b82f6", raw: true },
                ].map(s => (
                  <div key={s.label} style={{ background: "var(--bg2)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.raw ? s.val : `${s.val.toLocaleString("sv-SE")} kr`}</div>
                  </div>
                ))}
              </div>
              {m.note && (
                <div style={{ fontSize: 13, color: "var(--text2)", fontStyle: "italic", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  📝 {m.note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PROFILE PAGE
// ============================================================
function ProfilePage({ user, setUser, users, setUsers, theme = "light", setTheme }) {
  const [displayName, setDisplayName] = useState(user.displayName || user.username);
  const [currentPw,   setCurrentPw]   = useState("");
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [pwMsg,       setPwMsg]       = useState(null);
  const [nameMsg,     setNameMsg]     = useState(null);

  function saveDisplayName() {
    const updated = { ...user, displayName };
    setUsers(us => us.map(u => u.id === user.id ? updated : u));
    setUser(updated);
    setNameMsg({ ok: true, text: "Namn sparat!" });
    setTimeout(() => setNameMsg(null), 2500);
  }

  function changePassword() {
    if (currentPw !== user.password) { setPwMsg({ ok: false, text: "Nuvarande lösenord stämmer inte." }); return; }
    if (newPw.length < 4)            { setPwMsg({ ok: false, text: "Nytt lösenord måste vara minst 4 tecken." }); return; }
    if (newPw !== confirmPw)         { setPwMsg({ ok: false, text: "Lösenorden matchar inte." }); return; }
    const updated = { ...user, password: newPw };
    setUsers(us => us.map(u => u.id === user.id ? updated : u));
    setUser(updated);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setPwMsg({ ok: true, text: "Lösenord ändrat!" });
    setTimeout(() => setPwMsg(null), 2500);
  }

  const ROLE_LABELS = { admin: "👑 Admin", editor: "✏️ Redigerare", viewer: "👁️ Visare" };
  const initials = (user.displayName || user.username).slice(0, 2).toUpperCase();

  return (
    <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Avatar card */}
      <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "28px 32px", display: "flex", gap: 24, alignItems: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{initials}</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{user.displayName || user.username}</div>
          <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>@{user.username}</div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, background: "#ede9fe", color: "#7c3aed", borderRadius: 99, padding: "3px 12px" }}>{ROLE_LABELS[user.role] || user.role}</span>
          </div>
        </div>
      </div>

      {/* Display name */}
      <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "24px 28px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Visningsnamn</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Syns i appen. Påverkar inte inloggningen.</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            style={{ flex: 1, background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 14px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none" }} />
          <button onClick={saveDisplayName} className="btn btn-primary" style={{ padding: "9px 20px" }}>Spara</button>
        </div>
        {nameMsg && <div style={{ marginTop: 10, fontSize: 13, color: nameMsg.ok ? "#10b981" : "#ef4444", fontWeight: 600 }}>{nameMsg.ok ? "✓" : "✗"} {nameMsg.text}</div>}
      </div>

      {/* Change password */}
      <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "24px 28px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Byt lösenord</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Välj ett nytt lösenord för ditt konto.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "Nuvarande lösenord", val: currentPw, set: setCurrentPw },
            { label: "Nytt lösenord",      val: newPw,     set: setNewPw },
            { label: "Bekräfta nytt",      val: confirmPw, set: setConfirmPw },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>{f.label}</label>
              <input type="password" value={f.val} onChange={e => f.set(e.target.value)}
                style={{ width: "100%", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "9px 14px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
        {pwMsg && <div style={{ marginTop: 10, fontSize: 13, color: pwMsg.ok ? "#10b981" : "#ef4444", fontWeight: 600 }}>{pwMsg.ok ? "✓" : "✗"} {pwMsg.text}</div>}
        <button onClick={changePassword} className="btn btn-primary" style={{ marginTop: 16, width: "100%", padding: "11px" }}>Byt lösenord</button>
      </div>

      {/* Account info */}
      <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "24px 28px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Kontoinformation</div>
        {[
          { label: "Användarnamn", val: user.username },
          { label: "Roll",         val: ROLE_LABELS[user.role] || user.role },
          { label: "Konto-ID",     val: `#${user.id}` },
          { label: "Status",       val: user.disabled ? "⛔ Inaktivt" : "✅ Aktivt" },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 14 }}>
            <span style={{ color: "var(--text2)", fontWeight: 500 }}>{r.label}</span>
            <span style={{ fontWeight: 600 }}>{r.val}</span>
          </div>
        ))}
      </div>
      {/* Theme selector */}
      <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "24px 28px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🎨 Tema</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Välj utseende för appen</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { id: "light", label: "Standard",   emoji: "☀️", desc: "Ljust och rent",      preview: { bg: "#f5f6fa", card: "#ffffff", accent: "#3b82f6", text: "#1a1d2e" } },
            { id: "dark",  label: "Mörkt",      emoji: "🌙", desc: "Skonsamt för ögonen", preview: { bg: "#1e1f22", card: "#313338", accent: "#3b82f6", text: "#dbdee1" } },
            { id: "bee",   label: "Sommartema", emoji: "🐝", desc: "Solsken och bin",     preview: { bg: "#fffbeb", card: "#ffffff", accent: "#f59e0b", text: "#1c1917" } },
            { id: "pink",  label: "Rosa",       emoji: "🌸", desc: "Mjukt och varmt",     preview: { bg: "#fdf2f8", card: "#ffffff", accent: "#ec4899", text: "#1a1a2e" } },
          ].map(t => {
            const active = theme === t.id;
            return (
              <button key={t.id} onClick={() => setTheme(t.id)}
                style={{ background: t.preview.bg, border: "2.5px solid " + (active ? t.preview.accent : "transparent"), borderRadius: 16, padding: "16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s", boxShadow: active ? "0 0 0 4px " + t.preview.accent + "25" : "none" }}>
                <div style={{ background: t.preview.card, borderRadius: 8, padding: "8px 10px", marginBottom: 10, border: "1px solid " + t.preview.accent + "30", display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.preview.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 4, borderRadius: 99, background: t.preview.text, opacity: 0.5, marginBottom: 3, width: "60%" }} />
                    <div style={{ height: 3, borderRadius: 99, background: t.preview.accent, opacity: 0.4, width: "40%" }} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{t.emoji}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.preview.text }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: t.preview.text, opacity: 0.6, marginTop: 1 }}>{t.desc}</div>
                  </div>
                  {active && <span style={{ marginLeft: "auto", fontSize: 14, color: t.preview.accent }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CALCULATOR PAGE
// ============================================================
function CalculatorPage() {
  const [pctAmount,  setPctAmount]  = useState("");
  const [pctOf,      setPctOf]      = useState("");
  const [pctResult,  setPctResult]  = useState(null);

  const [sekAmount,  setSekAmount]  = useState("");
  const [eurRate,    setEurRate]    = useState("11.50");
  const [usdRate,    setUsdRate]    = useState("10.40");

  const [whatPct,    setWhatPct]    = useState("");
  const [ofTotal,    setOfTotal]    = useState("");

  const eurResult = sekAmount && eurRate ? (parseFloat(sekAmount) / parseFloat(eurRate)).toFixed(2) : null;
  const usdResult = sekAmount && usdRate ? (parseFloat(sekAmount) / parseFloat(usdRate)).toFixed(2) : null;
  const pctCalcResult = whatPct && ofTotal ? ((parseFloat(whatPct) / parseFloat(ofTotal)) * 100).toFixed(1) : null;

  function calcPct() {
    const a = parseFloat(pctAmount);
    const b = parseFloat(pctOf);
    if (!isNaN(a) && !isNaN(b)) setPctResult((a / 100) * b);
  }

  const inputStyle = { background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 15, color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 };

  return (
    <div style={{ maxWidth: 700, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

      {/* % av X */}
      <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "24px 26px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📐 Procent av belopp</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Hur mycket är X% av ett belopp?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Procent (%)</label>
            <input style={inputStyle} type="number" placeholder="t.ex. 12" value={pctAmount} onChange={e => { setPctAmount(e.target.value); setPctResult(null); }} />
          </div>
          <div>
            <label style={labelStyle}>Av belopp (kr)</label>
            <input style={inputStyle} type="number" placeholder="t.ex. 50 000" value={pctOf} onChange={e => { setPctOf(e.target.value); setPctResult(null); }} />
          </div>
        </div>
        <button onClick={calcPct} className="btn btn-primary" style={{ width: "100%", marginTop: 16, padding: "11px", fontSize: 15 }}>Räkna ut</button>
        {pctResult !== null && (
          <div style={{ marginTop: 16, background: "linear-gradient(135deg, #dbeafe, #ede9fe)", borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4c1d95", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Resultat</div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#3b82f6" }}>{pctResult.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} kr</div>
            <div style={{ fontSize: 13, color: "#5b21b6", marginTop: 4 }}>{pctAmount}% av {parseFloat(pctOf).toLocaleString("sv-SE")} kr</div>
          </div>
        )}
      </div>

      {/* Vad är X% av Y */}
      <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "24px 26px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🔢 Hur många % är X av Y?</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Räkna ut vilken andel ett belopp utgör.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Del (kr)</label>
            <input style={inputStyle} type="number" placeholder="t.ex. 1 500" value={whatPct} onChange={e => setWhatPct(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Av totalt (kr)</label>
            <input style={inputStyle} type="number" placeholder="t.ex. 27 660" value={ofTotal} onChange={e => setOfTotal(e.target.value)} />
          </div>
        </div>
        {pctCalcResult !== null && (
          <div style={{ marginTop: 16, background: "linear-gradient(135deg, #d1fae5, #a7f3d0)", borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#064e3b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Resultat</div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#10b981" }}>{pctCalcResult}%</div>
            <div style={{ fontSize: 13, color: "#065f46", marginTop: 4 }}>{parseFloat(whatPct).toLocaleString("sv-SE")} kr av {parseFloat(ofTotal).toLocaleString("sv-SE")} kr</div>
          </div>
        )}
        {!pctCalcResult && <div style={{ height: 70 }} />}
      </div>

      {/* SEK → EUR/USD */}
      <div style={{ background: "var(--card)", borderRadius: 20, border: "1px solid var(--border)", padding: "24px 26px", gridColumn: "1 / -1" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>💱 Valutaomvandlare — SEK till EUR & USD</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Ange kurs manuellt (uppdatera vid behov)</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Belopp (SEK)</label>
            <input style={inputStyle} type="number" placeholder="t.ex. 10 000" value={sekAmount} onChange={e => setSekAmount(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>EUR-kurs (1 EUR = ? SEK)</label>
            <input style={inputStyle} type="number" step="0.01" value={eurRate} onChange={e => setEurRate(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>USD-kurs (1 USD = ? SEK)</label>
            <input style={inputStyle} type="number" step="0.01" value={usdRate} onChange={e => setUsdRate(e.target.value)} />
          </div>
        </div>
        {sekAmount && (eurResult || usdResult) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>🇪🇺 Euro</div>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#b45309" }}>€ {parseFloat(eurResult).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 13, color: "#92400e", marginTop: 4 }}>Kurs: 1 EUR = {eurRate} SEK</div>
            </div>
            <div style={{ background: "linear-gradient(135deg, #dbeafe, #bfdbfe)", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>🇺🇸 US-dollar</div>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.03em", color: "#1d4ed8" }}>$ {parseFloat(usdResult).toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 13, color: "#1e3a5f", marginTop: 4 }}>Kurs: 1 USD = {usdRate} SEK</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// AI PAGE
// ============================================================
// Simple markdown renderer for AI responses
function MarkdownText({ text }) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      elements.push(<div key={i} style={{ fontSize: 14, fontWeight: 800, marginTop: 10, marginBottom: 4, color: "var(--text)" }}>{renderInline(line.slice(4))}</div>);
    } else if (line.startsWith("## ")) {
      elements.push(<div key={i} style={{ fontSize: 15, fontWeight: 800, marginTop: 12, marginBottom: 4, color: "var(--text)" }}>{renderInline(line.slice(3))}</div>);
    } else if (line.startsWith("# ")) {
      elements.push(<div key={i} style={{ fontSize: 16, fontWeight: 900, marginTop: 12, marginBottom: 6, color: "var(--text)" }}>{renderInline(line.slice(2))}</div>);
    } else if (/^[-*•] /.test(line)) {
      elements.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
          <span style={{ color: "#3b82f6", fontWeight: 700, flexShrink: 0 }}>•</span>
          <span>{renderInline(line.replace(/^[-*•] /, ""))}</span>
        </div>
      );
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\./)[1];
      elements.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
          <span style={{ color: "#3b82f6", fontWeight: 700, flexShrink: 0, minWidth: 16 }}>{num}.</span>
          <span>{renderInline(line.replace(/^\d+\. /, ""))}</span>
        </div>
      );
    } else if (line.trim() === "" || line.trim() === "---") {
      elements.push(<div key={i} style={{ height: 6 }} />);
    } else {
      elements.push(<div key={i} style={{ marginBottom: 2 }}>{renderInline(line)}</div>);
    }
    i++;
  }
  return <div style={{ fontSize: 14, lineHeight: 1.65 }}>{elements}</div>;
}

function renderInline(text) {
  // bold **x**, italic *x*, code `x`, and page refs [→ Sida]
  const parts = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[→ (.+?)\]/g;
  let last = 0, m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index} style={{ fontWeight: 700, color: "var(--text)" }}>{m[1]}</strong>);
    else if (m[2]) parts.push(<em key={m.index} style={{ fontStyle: "italic", opacity: 0.85 }}>{m[2]}</em>);
    else if (m[3]) parts.push(<code key={m.index} style={{ fontFamily: "monospace", background: "rgba(59,130,246,0.15)", color: "#60a5fa", borderRadius: 4, padding: "1px 5px", fontSize: 13 }}>{m[3]}</code>);
    else if (m[4]) parts.push(<span key={m.index} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(59,130,246,0.15)", color: "#60a5fa", borderRadius: 6, padding: "1px 8px", fontSize: 12, fontWeight: 700, margin: "0 2px" }}>→ {m[4]}</span>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}

function AIPage({ messages, setMessages, income, expenses, debts, netWorth, healthScore, leftover, allDebts, allExpenses, appTexts = {}, setPage, goals }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setLoading(true);

    const systemPrompt = `Du är en svensk AI-ekonomiassistent för appen EkonomiKollen. Svara alltid på svenska. Var tydlig, engagerande och handlingsinriktad med konkreta siffror.

Användarens ekonomi:
- Månadsinkomst: ${formatSEK(income)} | Utgifter: ${formatSEK(expenses)} | Kvar: ${formatSEK(leftover)}
- Total skuld: ${formatSEK(debts)} | Hälsopoäng: ${healthScore}/100
- Skulder: ${allDebts.map(d => `${d.name}: ${formatSEK(d.remaining)} kvar (${formatSEK(d.monthly)}/mån)`).join("; ")}
- Utgifter: ${allExpenses.slice(0, 10).map(e => `${e.service}: ${formatSEK(e.cost)}`).join("; ")}
- Mål: ${(goals || []).map(g => `${g.name}: ${formatSEK(g.saved)}/${formatSEK(g.target)}`).join("; ") || "inga"}

FORMATTERINGSREGLER (viktigt!):
- Använd **fetstil** för viktiga belopp och nyckelord
- Använd *kursiv* för betoning
- Använd bullet-listor med "- " för råd och steg
- Använd rubriker med "## " för avsnitt om svaret är långt
- Referera till appsidor med [→ Sidnamn] t.ex. [→ Budget], [→ Skulder], [→ Mål], [→ Sparande], [→ Prognos]
- Håll svaret strukturerat men inte längre än nödvändigt`;

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("ai-chat", {
        body: {
          systemPrompt,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        },
      });
      if (fnError) throw fnError;
      const reply = fnData?.reply || "Tyvärr kunde jag inte svara just nu.";
      setMessages(m => [...m, { role: "assistant", content: reply }].slice(-40));
    } catch (e) {
      console.error("AI error:", e);
      setMessages(m => [...m, { role: "assistant", content: "Anslutningsfel. Försök igen om en stund." }]);
    }
    setLoading(false);
  }

  // Page nav refs — clickable pill navigates to that page
  const PAGE_REFS = { "Budget": "budget", "Skulder": "debts", "Mål": "goals", "Sparande": "savings", "Prognos": "forecast", "Inkomster": "income", "Översikt": "dashboard" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", borderRadius: 20, overflow: "hidden", border: "1px solid var(--border)", background: "var(--card)" }}>
      <style>{`
        @keyframes aiPulse { 0%,100%{opacity:.25} 50%{opacity:1} }
        .ai-dot { animation: aiPulse 1.3s ease-in-out infinite; }
        @keyframes msgIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .ai-msg { animation: msgIn 0.2s ease forwards; }
        .ai-chip { transition: all 0.15s; }
        .ai-chip:hover { background: var(--bg2) !important; }
        .ai-send:hover:not(:disabled) { opacity: 0.85; }
        .ai-nav-btn:hover { background: var(--bg2) !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>AI-assistent</div>
            <div style={{ fontSize: 11, color: "var(--text2)" }}>Fråga om din ekonomi</div>
          </div>
        </div>
        <button onClick={() => setMessages([{ role: "assistant", content: appTexts.aiWelcome || "Hej! Jag är din AI-ekonomiassistent. Fråga mig vad som helst om din ekonomi – budget, skulder, sparande eller framtid." }])}
          style={{ background: "none", border: "1px solid var(--border)", color: "var(--text2)", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
          Rensa
        </button>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
        {messages.map((msg, i) => (
          <div key={i} className="ai-msg" style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: msg.role === "user" ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {msg.role === "user"
                ? <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{msg.content[0]?.toUpperCase() || "?"}</span>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="white"/></svg>
              }
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: "72%",
              background: msg.role === "user" ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "var(--bg2)",
              color: msg.role === "user" ? "#fff" : "var(--text)",
              borderRadius: msg.role === "user" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
              padding: "12px 16px",
              fontSize: 14, lineHeight: 1.65,
              border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
            }}>
              {msg.role === "user"
                ? <span>{msg.content}</span>
                : <div>
                    {msg.content.split(/(\[→ [^\]]+\])/).map((part, j) => {
                      const navMatch = part.match(/^\[→ (.+)\]$/);
                      if (navMatch && PAGE_REFS[navMatch[1]]) {
                        return (
                          <button key={j} onClick={() => setPage(PAGE_REFS[navMatch[1]])} className="ai-nav-btn"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "var(--card)", color: "#6366f1", borderRadius: 6, padding: "2px 9px", fontSize: 12, fontWeight: 600, margin: "1px 3px", border: "1px solid #6366f120", cursor: "pointer", fontFamily: "inherit", verticalAlign: "middle" }}>
                            → {navMatch[1]}
                          </button>
                        );
                      }
                      return <MarkdownText key={j} text={part} />;
                    })}
                  </div>
              }
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-msg" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="white"/></svg>
            </div>
            <div style={{ background: "var(--bg2)", borderRadius: "4px 18px 18px 18px", padding: "14px 18px", border: "1px solid var(--border)", display: "flex", gap: 5, alignItems: "center" }}>
              {[0, 1, 2].map(j => (
                <div key={j} className="ai-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", animationDelay: `${j * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggested questions ── */}
      <div style={{ padding: "10px 24px 8px", display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        {["Kan jag betala av mer?", "Vilken skuld prioritera?", "Var kan jag spara?", "Skuldfri — när?"].map(q => (
          <button key={q} onClick={() => setInput(q)} className="ai-chip"
            style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 99, padding: "5px 14px", fontSize: 12, color: "var(--text2)", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            {q}
          </button>
        ))}
      </div>

      {/* ── Input ── */}
      <div style={{ padding: "12px 20px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "var(--bg2)", borderRadius: 14, border: "1.5px solid var(--border)", padding: "10px 10px 10px 16px", transition: "border-color 0.15s" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={appTexts.aiPlaceholder || "Fråga om din ekonomi…"}
            rows={1}
            style={{ flex: 1, resize: "none", border: "none", background: "transparent", padding: "2px 0", fontSize: 14, outline: "none", lineHeight: 1.5, fontFamily: "inherit", color: "var(--text)", maxHeight: 120, overflowY: "auto" }}
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="ai-send"
            style={{ background: loading || !input.trim() ? "var(--border)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none", borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: loading || !input.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "opacity 0.15s" }}>
            ↑
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text2)", textAlign: "center", marginTop: 6 }}>
          AI kan göra fel — verifiera viktig ekonomisk information.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN PAGE
// ============================================================
function Toggle({ checked, onChange }) {
  return (
    <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, cursor: "pointer", flexShrink: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{
        position: "absolute", cursor: "pointer", inset: 0,
        background: checked ? "#3b82f6" : "var(--border)",
        borderRadius: 24, transition: "background 0.2s"
      }}>
        <span style={{
          position: "absolute", height: 18, width: 18,
          left: checked ? 23 : 3, bottom: 3,
          background: "white", borderRadius: "50%",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
        }} />
      </span>
    </label>
  );
}

function AdminStatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ background: bg || "var(--bg2)", borderRadius: 14, padding: "16px 20px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: (color || "#3b82f6") + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: color || "var(--text)" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

function DangerAction({ action }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Card style={{ border: "1.5px solid #fca5a5" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{action.icon}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{action.title}</div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 3 }}>{action.desc}</div>
            <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3, fontWeight: 600 }}>{action.detail}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {confirmed ? (
            <>
              <button onClick={() => { action.btnAction(); setConfirmed(false); }} className="btn btn-danger" style={{ background: "#ef4444", color: "#fff" }}>
                ⚠️ Bekräfta
              </button>
              <button onClick={() => setConfirmed(false)} className="btn btn-ghost">Avbryt</button>
            </>
          ) : (
            <button onClick={() => setConfirmed(true)} className="btn btn-danger">{action.btnLabel}</button>
          )}
        </div>
      </div>
    </Card>
  );
}

function AdminPage({ users, setUsers, expenses, setExpenses, history, pageVisibility, setPageVisibility, appTexts, setAppTexts, baseSalary = 0 }) {
  const [tab, setTab] = useState("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("editor");
  const [addError, setAddError] = useState("");
  const [logFilter, setLogFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [currency, setCurrency] = useState("SEK");
  const [sysSettings, setSysSettings] = useState({
    realtimeSync: true, animations: true, aiAssistant: true,
    scenarioSim: true, timelineForecasts: true, twoFactor: false, auditLog: true,
  });
  const [localStatuses, setLocalStatuses] = useState(
    STATUS_OPTIONS.map(s => ({ ...s, labelEdited: s.label, iconEdited: s.icon }))
  );
  const [statusSaved, setStatusSaved] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editPassword, setEditPassword] = useState("");

  const tabs = [
    { id: "users",    label: "👥 Användare" },
    { id: "texts",    label: "✏️ Apptexter" },
    { id: "lontyper", label: "🛡 Löntyper" },
    { id: "statuses", label: "🎨 Statusar" },
    { id: "log",      label: "📋 Aktivitetslogg" },
    { id: "settings", label: "⚙️ Inställningar" },
    { id: "danger",   label: "🔴 Farlig zon" },
  ];

  const activeUsers = users.filter(u => !u.disabled).length;
  const adminCount = users.filter(u => u.role === "admin").length;
  const filteredLog = history.filter(h =>
    !logFilter || h.action?.toLowerCase().includes(logFilter.toLowerCase())
  );

  function handleAddUser() {
    if (!newUsername.trim()) { setAddError("Användarnamn krävs."); return; }
    if (!newPassword.trim()) { setAddError("Lösenord krävs."); return; }
    if (users.find(u => u.username === newUsername)) { setAddError("Användarnamnet är redan taget."); return; }
    setUsers(us => [...us, { id: Date.now(), username: newUsername, password: newPassword, role: newRole, lastLogin: "–", disabled: false }]);
    setNewUsername(""); setNewPassword(""); setNewRole("editor"); setAddError(""); setShowAddUser(false);
  }

  function handleSavePassword() {
    if (!editPassword.trim()) return;
    setUsers(us => us.map(u => u.id === editingUser ? { ...u, password: editPassword } : u));
    setEditingUser(null); setEditPassword("");
  }

  const ROLE_META = {
    admin: { label: "Admin", color: "#8b5cf6", bg: "#ede9fe" },
    editor: { label: "Redigerare", color: "#3b82f6", bg: "#dbeafe" },
    viewer: { label: "Visare", color: "#64748b", bg: "#f1f5f9" },
  };

  return (
    <div className="fadeIn">
      <style>{`
        .admin-tab-btn { padding: 9px 16px; border-radius: 10px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; white-space: nowrap; }
        .admin-user-row:hover { background: var(--hover) !important; }
        .admin-input { background: var(--bg2); border: 1.5px solid var(--border); border-radius: 10px; padding: 8px 12px; font-size: 14px; outline: none; width: 100%; color: var(--text); font-family: inherit; transition: border-color 0.15s; }
        .admin-input:focus { border-color: #3b82f6; }
      `}</style>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <AdminStatCard icon="👥" label="Totalt användare" value={users.length} color="#3b82f6" />
        <AdminStatCard icon="✅" label="Aktiva användare" value={activeUsers} color="#10b981" />
        <AdminStatCard icon="👑" label="Administratörer" value={adminCount} color="#8b5cf6" />
        <AdminStatCard icon="📋" label="Loggade händelser" value={history.length} color="#f59e0b" />
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--card)", borderRadius: 14, padding: 5, border: "1px solid var(--border)", width: "fit-content", flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="admin-tab-btn" style={{
            background: tab === t.id ? (t.id === "danger" ? "#ef4444" : "#3b82f6") : "transparent",
            color: tab === t.id ? "#fff" : (t.id === "danger" ? "#ef4444" : "var(--text2)"),
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Alla användare</div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{users.length} konton registrerade</div>
              </div>
              <button onClick={() => setShowAddUser(v => !v)} className="btn btn-primary" style={{ fontSize: 13 }}>
                {showAddUser ? "✕ Avbryt" : "+ Lägg till användare"}
              </button>
            </div>

            {showAddUser && (
              <div style={{ background: "var(--bg2)", borderRadius: 14, padding: "20px", marginBottom: 20, border: "1px solid var(--border)" }} className="fadeIn">
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ny användare</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Användarnamn</label>
                    <input className="admin-input" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="användarnamn" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Lösenord</label>
                    <input className="admin-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>Roll</label>
                    <select className="admin-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                      <option value="admin">Admin</option>
                      <option value="editor">Redigerare</option>
                      <option value="viewer">Visare</option>
                    </select>
                  </div>
                  <button onClick={handleAddUser} className="btn btn-primary">Skapa</button>
                </div>
                {addError && <div style={{ marginTop: 10, fontSize: 13, color: "#ef4444", background: "#fee2e2", borderRadius: 8, padding: "8px 12px" }}>{addError}</div>}
              </div>
            )}

            <table>
              <thead>
                <tr>
                  <th>Användare</th>
                  <th>Roll</th>
                  <th>Senaste inloggning</th>
                  <th>Status</th>
                  <th>Lösenord</th>
                  <th>Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const rm = ROLE_META[u.role] || ROLE_META.viewer;
                  return (
                    <tr key={u.id} className="admin-user-row" style={{ transition: "background 0.15s" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: 10, background: rm.bg, color: rm.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                            {u.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{u.username}</div>
                            <div style={{ fontSize: 11, color: "var(--text2)" }}>ID #{u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select value={u.role}
                          onChange={e => setUsers(us => us.map(x => x.id === u.id ? { ...x, role: e.target.value } : x))}
                          style={{ background: rm.bg, color: rm.color, border: `1.5px solid ${rm.color}44`, borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
                          <option value="admin">👑 Admin</option>
                          <option value="editor">✏️ Redigerare</option>
                          <option value="viewer">👁️ Visare</option>
                        </select>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.lastLogin === "–" ? "#94a3b8" : "#10b981", display: "inline-block" }} />
                          {u.lastLogin}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Toggle checked={!u.disabled} onChange={val => setUsers(us => us.map(x => x.id === u.id ? { ...x, disabled: !val } : x))} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: u.disabled ? "#ef4444" : "#10b981" }}>
                            {u.disabled ? "Inaktiv" : "Aktiv"}
                          </span>
                        </div>
                      </td>
                      <td>
                        {editingUser === u.id ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <input className="admin-input" type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Nytt lösenord" style={{ width: 130, padding: "4px 8px", fontSize: 12 }} />
                            <button onClick={handleSavePassword} className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 12 }}>Spara</button>
                            <button onClick={() => { setEditingUser(null); setEditPassword(""); }} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditingUser(u.id)} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>🔑 Ändra</button>
                        )}
                      </td>
                      <td>
                        {u.username !== "admin" ? (
                          confirmDelete === u.id ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => { setUsers(us => us.filter(x => x.id !== u.id)); setConfirmDelete(null); }} className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 12 }}>Bekräfta</button>
                              <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete(u.id)} className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 12 }}>Ta bort</button>
                          )
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text2)", fontStyle: "italic" }}>Skyddad</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Role permissions reference */}
          <Card>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🔐 Rollbehörigheter</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { role: "admin", icon: "👑", perms: ["Läsa data", "Redigera data", "Hantera användare", "Systemkonfiguration", "Aktivitetslogg", "Farlig zon"] },
                { role: "editor", icon: "✏️", perms: ["Läsa data", "Redigera data", "–", "–", "–", "–"] },
                { role: "viewer", icon: "👁️", perms: ["Läsa data", "–", "–", "–", "–", "–"] },
              ].map(({ role, icon, perms }) => {
                const rm = ROLE_META[role];
                return (
                  <div key={role} style={{ background: rm.bg, borderRadius: 14, padding: "16px", border: `1px solid ${rm.color}33` }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: rm.color, marginBottom: 12 }}>{icon} {rm.label}</div>
                    {perms.map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: p === "–" ? "#94a3b8" : "var(--text)", marginBottom: 6 }}>
                        <span style={{ color: p === "–" ? "#94a3b8" : rm.color, fontWeight: 700 }}>{p === "–" ? "✗" : "✓"}</span> {p === "–" ? <span style={{ textDecoration: "line-through", opacity: 0.5 }}>{["Redigera data", "Hantera användare", "Systemkonfiguration", "Aktivitetslogg", "Farlig zon"][i - 1] || p}</span> : p}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── APPTEXTER TAB ── */}
      {tab === "texts" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🏷️ Appnamn & identitet</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Titel, tagline och version som visas i sidofältet och inloggning</div>
            {[
              { key: "appName",    label: "Appens namn",       placeholder: "EkonomiKollen" },
              { key: "appTagline", label: "Tagline (inloggning)", placeholder: "Din personliga ekonomiöversikt" },
              { key: "appVersion", label: "Versiontext (sidebar)", placeholder: "v2.0 – Skandinavisk design" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{f.label}</label>
                <input className="admin-input" value={appTexts[f.key] || ""} onChange={e => setAppTexts(t => ({ ...t, [f.key]: e.target.value }))} placeholder={f.placeholder} />
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🤖 AI-assistent</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Välkomsttext och platshållare i AI-chatten</div>
            {[
              { key: "aiWelcome",     label: "Välkomstmeddelande", multiline: true, placeholder: "Hej! Jag är din AI-ekonomiassistent…" },
              { key: "aiPlaceholder", label: "Platshållartext i chattrutan", placeholder: "Ställ en fråga om din ekonomi…" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{f.label}</label>
                {f.multiline
                  ? <textarea className="admin-input" value={appTexts[f.key] || ""} onChange={e => setAppTexts(t => ({ ...t, [f.key]: e.target.value }))} placeholder={f.placeholder} rows={3} style={{ resize: "vertical" }} />
                  : <input className="admin-input" value={appTexts[f.key] || ""} onChange={e => setAppTexts(t => ({ ...t, [f.key]: e.target.value }))} placeholder={f.placeholder} />
                }
              </div>
            ))}

            <div style={{ marginTop: 8, background: "var(--bg2)", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>Förhandsgranskning</div>
              <div style={{ fontSize: 13, color: "var(--text)", fontStyle: "italic", lineHeight: 1.5 }}>
                "{appTexts.aiWelcome || "Hej! Jag är din AI-ekonomiassistent…"}"
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🔐 Inloggningssida</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Text som visas på inloggningssidan</div>
            {[
              { key: "loginTitle",    label: "Titel",    placeholder: "Välkommen" },
              { key: "loginSubtitle", label: "Underrubrik", placeholder: "Logga in för att fortsätta" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{f.label}</label>
                <input className="admin-input" value={appTexts[f.key] || ""} onChange={e => setAppTexts(t => ({ ...t, [f.key]: e.target.value }))} placeholder={f.placeholder} />
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>↩️ Återställ texter</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Återgå till standardtexter om du ångrar dina ändringar</div>
            <button onClick={() => setAppTexts({
              appName: "EkonomiKollen", appTagline: "Din personliga ekonomiöversikt",
              appVersion: "v2.0 – Skandinavisk design", dashboardTitle: "Översikt",
              aiWelcome: "Hej! Jag är din AI-ekonomiassistent. Fråga mig vad som helst om din ekonomi – budget, skulder, sparande eller framtid.",
              aiPlaceholder: "Ställ en fråga om din ekonomi… (Enter för att skicka)",
              loginTitle: "Välkommen", loginSubtitle: "Logga in för att fortsätta",
            })} className="btn btn-danger" style={{ fontSize: 13, padding: "10px 20px" }}>
              Återställ till standardtexter
            </button>
          </Card>
        </div>
      )}

      {/* ── STATUSES TAB ── */}
      {tab === "statuses" && (() => {
        const PRESET_ICONS = ["✅","⏳","🔄","🚫","💰","📌","⚡","🎯","🔒","📋","❌","✓"];
        return (
          <Card>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Statusdefinitioner</div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Anpassa etikett och ikon för varje status. ID och färglogik är fast.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {localStatuses.map((s, idx) => (
                <div key={s.id} style={{ background: "var(--bg2)", borderRadius: 16, padding: "16px 20px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    {/* Color swatch + id */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, border: `2px solid ${s.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{s.iconEdited}</div>
                      <span style={{ fontFamily: "monospace", fontSize: 10, background: "var(--border)", borderRadius: 4, padding: "1px 6px", color: "var(--text2)" }}>{s.id}</span>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                      {/* Label */}
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Etikett</label>
                        <input value={s.labelEdited} onChange={e => setLocalStatuses(ls => ls.map((x, i) => i === idx ? { ...x, labelEdited: e.target.value } : x))}
                          style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "6px 10px", fontSize: 14, color: "var(--text)", fontFamily: "inherit", outline: "none", width: "100%" }} />
                      </div>
                      {/* Icon picker */}
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Ikon</label>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {PRESET_ICONS.map(ic => (
                            <button key={ic} onClick={() => setLocalStatuses(ls => ls.map((x, i) => i === idx ? { ...x, iconEdited: ic } : x))}
                              style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${s.iconEdited === ic ? s.color : "var(--border)"}`, background: s.iconEdited === ic ? s.bg : "transparent", fontSize: 16, cursor: "pointer" }}>{ic}</button>
                          ))}
                          <input value={s.iconEdited} onChange={e => setLocalStatuses(ls => ls.map((x, i) => i === idx ? { ...x, iconEdited: e.target.value } : x))}
                            style={{ width: 50, background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "4px 6px", fontSize: 18, textAlign: "center", outline: "none", color: "var(--text)" }} placeholder="✏️" />
                        </div>
                      </div>
                    </div>
                    {/* Preview */}
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Förhandsvisning</div>
                      <span style={{ borderRadius: 99, padding: "5px 14px", fontSize: 12, fontWeight: 700,
                        background: s.id === "paid" ? "#bbf7d0" : s.id === "autogiro" ? "#fde68a" : "var(--bg2)",
                        color: s.id === "paid" ? "#15803d" : s.id === "autogiro" ? "#b45309" : "#94a3b8" }}>
                        {s.iconEdited} {s.labelEdited}
                      </span>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 8 }}>
                        {expenses.filter(e => e.status === s.id).length} utgifter
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button onClick={() => setLocalStatuses(STATUS_OPTIONS.map(s => ({ ...s, labelEdited: s.label, iconEdited: s.icon })))} className="btn btn-ghost" style={{ flex: 1 }}>Återställ</button>
              <button onClick={() => { setStatusSaved(true); setTimeout(() => setStatusSaved(false), 2000); }} className="btn btn-primary" style={{ flex: 2 }}>
                {statusSaved ? "✓ Sparat!" : "Spara ändringar"}
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--text2)" }}>
              💡 Ändringar av etiketter och ikoner gäller inom sessionen. Status-ID och färger är fasta.
            </div>
          </Card>
        );
      })()}

      {/* ── LOG TAB ── */}
      {tab === "log" && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Aktivitetslogg</div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>{history.length} händelser registrerade</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                className="admin-input"
                value={logFilter}
                onChange={e => setLogFilter(e.target.value)}
                placeholder="🔍 Filtrera händelser..."
                style={{ width: 220 }}
              />
              {history.length > 0 && (
                <span style={{ fontSize: 12, color: "var(--text2)", whiteSpace: "nowrap" }}>
                  {filteredLog.length} / {history.length} visas
                </span>
              )}
            </div>
          </div>
          {history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text2)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Inga aktiviteter loggade ännu</div>
              <div style={{ fontSize: 13 }}>Ändringar i budget och inkomst visas här.</div>
            </div>
          ) : filteredLog.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text2)", fontSize: 14 }}>
              Inga händelser matchar "<strong>{logFilter}</strong>"
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>#</th>
                  <th style={{ width: 100 }}>Tid</th>
                  <th>Åtgärd</th>
                  <th>Gammalt värde</th>
                  <th>Nytt värde</th>
                </tr>
              </thead>
              <tbody>
                {filteredLog.map((h, i) => (
                  <tr key={i} className="row-hover">
                    <td style={{ fontSize: 12, color: "var(--text2)", fontFamily: "monospace" }}>#{history.length - i}</td>
                    <td>
                      <span style={{ fontSize: 12, background: "var(--bg2)", borderRadius: 6, padding: "3px 8px", fontFamily: "monospace", color: "var(--text2)" }}>{h.time}</span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{h.action}</td>
                    <td>
                      {h.oldVal !== undefined && (
                        <span style={{ fontSize: 12, background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "2px 8px" }}>
                          {String(h.oldVal)}
                        </span>
                      )}
                    </td>
                    <td>
                      {h.newVal !== undefined && (
                        <span style={{ fontSize: 12, background: "#d1fae5", color: "#059669", borderRadius: 6, padding: "2px 8px" }}>
                          {String(h.newVal)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ── SETTINGS TAB ── */}
      {/* ── LÖNTYPER TAB ── */}
      {tab === "lontyper" && (() => {
        const btypes = appTexts.beredskapTypes || [];
        const GROUP_LABELS = { bas: "💼 Bas (Grundlön & Semester)", enkel: "🛡 Enkel beredskap", nylon: "📈 Ny lön", dubbel: "⚡ Dubbel beredskap", dubbel_ny: "⚡ Dubbel – Ny lön" };
        const groupOrder = ["bas", "enkel", "nylon", "dubbel", "dubbel_ny"];
        const grouped = groupOrder.map(g => ({ g, items: btypes.filter(t => t.group === g) })).filter(x => x.items.length);
        const base = baseSalary || 27660;

        const updateType = (key, field, value) => {
          setAppTexts(t => ({
            ...t,
            beredskapTypes: (t.beredskapTypes || []).map(bt =>
              bt.key === key ? { ...bt, [field]: value } : bt
            )
          }));
        };

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1d4ed8)", borderRadius: 16, padding: "18px 24px", color: "#fff" }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>🛡 Löntyper & Beredskapsersättning</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                Justera namn, beskrivning och totalbelopp per löntyp. Alla ändringar återspeglas direkt i Inkomster-schemat och Prognos.
              </div>
            </div>
            {grouped.map(({ g, items }) => (
              <Card key={g}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  {GROUP_LABELS[g] || g}
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>
                {items.map(t => {
                  const diff = t.readOnly ? 0 : Number(t.amount) - base;
                  return (
                    <div key={t.key} style={{ background: "var(--bg2)", borderRadius: 12, marginBottom: 10, border: `1.5px solid ${t.color}33`, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: t.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{t.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            value={t.name}
                            onChange={e => updateType(t.key, "name", e.target.value)}
                            disabled={t.readOnly}
                            style={{ background: "transparent", border: "none", outline: "none", fontSize: 14, fontWeight: 700, color: t.color, fontFamily: "inherit", width: "100%", padding: 0, cursor: t.readOnly ? "default" : "text" }}
                          />
                          <input
                            value={t.desc}
                            onChange={e => updateType(t.key, "desc", e.target.value)}
                            disabled={t.readOnly}
                            style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: "var(--text2)", fontFamily: "inherit", width: "100%", padding: 0, marginTop: 3, cursor: t.readOnly ? "default" : "text" }}
                            placeholder="Beskrivning…"
                          />
                        </div>
                        {t.readOnly ? (
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Grundlön</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#94a3b8" }}>{Number(t.amount).toLocaleString("sv-SE")} kr</div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 10, color: "var(--text2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total lön (kr)</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input type="number" value={t.amount}
                                  onChange={e => updateType(t.key, "amount", e.target.value === "" ? 0 : Number(e.target.value))}
                                  style={{ width: 110, background: "var(--card)", border: `1.5px solid ${t.color}66`, borderRadius: 8, padding: "7px 10px", fontSize: 14, fontWeight: 700, color: "var(--text)", fontFamily: "inherit", outline: "none", textAlign: "right" }} />
                                <span style={{ fontSize: 12, color: "var(--text2)" }}>kr</span>
                              </div>
                            </div>
                            <div style={{ textAlign: "center", minWidth: 80, padding: "8px 10px", background: t.color + "18", borderRadius: 10, border: `1px solid ${t.color}33` }}>
                              <div style={{ fontSize: 9, color: t.color, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>vs grundlön</div>
                              <div style={{ fontSize: 14, fontWeight: 800, color: diff >= 0 ? t.color : "#ef4444" }}>{diff >= 0 ? "+" : ""}{diff.toLocaleString("sv-SE")}</div>
                              <div style={{ fontSize: 9, color: t.color, opacity: 0.8 }}>kr</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </Card>
            ))}
          </div>
        );
      })()}

      {tab === "settings" && (
        <div className="settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Synliga sidor</div>
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Styr vilka sidor som visas i navigationsmenyn</div>
              {[
                { key: "budget", icon: "💳", label: "Budget", desc: "Hantera månatliga utgifter" },
                { key: "income", icon: "💰", label: "Inkomster", desc: "Lön, beredskap och extra inkomster" },
                { key: "debts", icon: "📉", label: "Skulder", desc: "Skuldöversikt och skuldfrihetsdatum" },
                { key: "savings", icon: "🏦", label: "Sparande", desc: "Sparkonton och tillgångar" },
                { key: "goals", icon: "🎯", label: "Mål", desc: "Sparmål och framsteg" },
                { key: "forecast", icon: "📊", label: "Prognos", desc: "Ekonomisk framtidsprognos" },
                { key: "ai", icon: "🤖", label: "AI-assistent", desc: "AI-chattfunktionen" },
                { key: "calculator", icon: "🧮", label: "Kalkylator", desc: "Räkneverktyg och valutaomvandlare" },
                { key: "history", icon: "📅", label: "Månadshistorik", desc: "Stäng månader och se historik" },
              ].map(s => (
                <div key={s.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>{s.desc}</div>
                    </div>
                  </div>
                  <Toggle checked={pageVisibility[s.key] !== false} onChange={val => setPageVisibility(prev => ({ ...prev, [s.key]: val }))} />
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Systeminställningar</div>
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Konfigurera systemfunktioner globalt</div>
              {[
                { key: "animations", icon: "✨", label: "Animationer", desc: "Aktivera övergångsanimationer i gränssnittet" },
                { key: "twoFactor", icon: "🔐", label: "Tvåfaktorsautent.", desc: "Kräv 2FA vid inloggning (rekommenderas)" },
                { key: "auditLog", icon: "📋", label: "Aktivitetsloggning", desc: "Logga alla ändringar i systemet" },
              ].map(s => (
                <div key={s.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{s.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>{s.desc}</div>
                    </div>
                  </div>
                  <Toggle checked={sysSettings[s.key]} onChange={val => setSysSettings(prev => ({ ...prev, [s.key]: val }))} />
                </div>
              ))}
            </Card>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📋 Kort på Översikt</div>
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Välj vilka kort som visas på översiktssidan</div>
              {[
                { key: "hero",     icon: "💰", label: "Kvar denna månad",  desc: "Stora hero-kortet med saldo" },
                { key: "salary",   icon: "📅", label: "Nästa lön",         desc: "Nedräkning till lönedatum" },
                { key: "debts",    icon: "📉", label: "Skulder",           desc: "Skuldöversikt med progress" },
                { key: "goals",    icon: "🎯", label: "Mål",               desc: "Aktiva sparmål" },
                { key: "savings",  icon: "🏦", label: "Sparande",          desc: "Sparkonton och saldo" },
                { key: "spartips", icon: "🐷", label: "Spartips",          desc: "Rekommendation att spara X%" },
                { key: "wishes",   icon: "💌", label: "Önskemål",          desc: "Önskelista för hushållet" },
              ].map(card => {
                const cards = { hero: true, salary: true, debts: true, goals: true, savings: true, spartips: true, wishes: true, ...(appTexts.dashboardCards || {}) };
                const isOn = cards[card.key] !== false;
                return (
                  <div key={card.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{card.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{card.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>{card.desc}</div>
                      </div>
                    </div>
                    <Toggle checked={isOn} onChange={val => setAppTexts(t => ({ ...t, dashboardCards: { hero: true, salary: true, debts: true, goals: true, savings: true, spartips: true, wishes: true, ...(t.dashboardCards || {}), [card.key]: val } }))} />
                  </div>
                );
              })}
            </Card>

            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🐷 Spartips — Procentsatser</div>
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Styr vilken sparrekommendation som visas på Översikt beroende på hur mycket som är kvar</div>
              {[
                { label: "Bra månad", desc: "Kvar ≥ tröskelvärde", threshKey: "savingsHighThreshold", rateKey: "savingsHighRate", color: "#10b981", emoji: "🚀" },
                { label: "Tight månad", desc: "Kvar < tröskelvärde & ≥ 0", threshKey: "savingsLowThreshold", rateKey: "savingsLowRate", color: "#f59e0b", emoji: "💪" },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 18, padding: "14px", background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>{row.emoji}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{row.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text2)" }}>{row.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Tröskel (kr)</label>
                      <input type="number" className="admin-input"
                        value={appTexts[row.threshKey] ?? (row.threshKey === "savingsHighThreshold" ? 10000 : 5000)}
                        onChange={e => setAppTexts(t => ({ ...t, [row.threshKey]: Number(e.target.value) }))}
                        style={{ width: "100%", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>Andel att spara (%)</label>
                      <input type="number" min="0" max="100" className="admin-input"
                        value={appTexts[row.rateKey] ?? (row.rateKey === "savingsHighRate" ? 40 : 15)}
                        onChange={e => setAppTexts(t => ({ ...t, [row.rateKey]: Number(e.target.value) }))}
                        style={{ width: "100%", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: row.color, fontWeight: 600 }}>
                    Exempel: {(appTexts[row.threshKey] ?? (row.threshKey === "savingsHighThreshold" ? 10000 : 5000)).toLocaleString("sv-SE")} kr kvar → spara {appTexts[row.rateKey] ?? (row.rateKey === "savingsHighRate" ? 40 : 15)}% = {Math.round(Number(appTexts[row.threshKey] ?? (row.threshKey === "savingsHighThreshold" ? 10000 : 5000)) * Number(appTexts[row.rateKey] ?? (row.rateKey === "savingsHighRate" ? 40 : 15)) / 100).toLocaleString("sv-SE")} kr
                  </div>
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Inbjudningskoder</div>
              <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14 }}>Koder som tillåter nya användare att registrera sig</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["BUDGET2026", "SPARAPENGAR", "EKONOMI99"].map(code => (
                  <div key={code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg2)", borderRadius: 10, padding: "10px 14px", border: "1px solid var(--border)" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em" }}>{code}</span>
                    <span style={{ fontSize: 11, background: "#d1fae5", color: "#059669", borderRadius: 99, padding: "2px 10px", fontWeight: 700 }}>AKTIV</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── DANGER ZONE TAB ── */}
      {tab === "danger" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fee2e2", borderRadius: 14, padding: "16px 20px", border: "1.5px solid #fca5a5", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#b91c1c", marginBottom: 4 }}>Farlig zon – Irreversibla åtgärder</div>
              <div style={{ fontSize: 13, color: "#dc2626" }}>Åtgärderna nedan kan inte ångras. Var försiktig och se till att du vet vad du gör.</div>
            </div>
          </div>

          <DangerAction action={{ icon: "🗑️", title: "Rensa aktivitetslogg", desc: "Tar bort alla loggade händelser permanent. Kan inte återställas.", btnLabel: "Rensa logg", btnAction: () => {}, detail: `${history.length} händelser kommer att raderas` }} />
          <DangerAction action={{ icon: "💸", title: "Återställ utgifter", desc: "Ersätter alla utgifter med standarddata. Alla anpassningar försvinner.", btnLabel: "Återställ utgifter", btnAction: () => setExpenses(INITIAL_EXPENSES), detail: `${expenses.length} utgifter påverkas` }} />
          <DangerAction action={{ icon: "👤", title: "Ta bort alla icke-admin-användare", desc: "Tar bort alla konton förutom adminanvändaren.", btnLabel: "Ta bort användare", btnAction: () => setUsers(us => us.filter(u => u.username === "admin")), detail: `${users.filter(u => u.username !== "admin").length} konton kommer att raderas` }} />
        </div>
      )}
    </div>
  );
}
