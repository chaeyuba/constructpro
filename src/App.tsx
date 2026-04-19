import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Category = "Earthworks" | "Structural" | "Masonry" | "Finishing" | "Utilities" | "Roofing" | "Closeout";
type ProcurementStatus = "pending" | "ordered" | "partial" | "complete";
type Project = { name: string; type: string; area: number; floors: number; startDate: string; budget: number; duration: number; location: string };
type Task = { id: number; name: string; cat: Category; start: number; dur: number; prog: number; tag: "critical" | "normal" | "milestone" };
type BoqItem = { id: number; trade: Category; item: string; unit: string; qty: number };
type BomItem = { id: number; material: string; unit: string; qty: number; unitCost: number; cat: Category; wastage?: string };
type ProcurementItem = { id: number; material: string; qtyNeeded: number; qtyOrdered: number; qtyDelivered: number; supplier: string; status: ProcurementStatus; date: string };
type Message = { role: "user" | "assistant"; content: string };
type MaybeStorageResult = { value?: string } | string | null;

declare global {
  interface Window {
    storage?: {
      get?: (key: string) => Promise<MaybeStorageResult> | MaybeStorageResult;
      set?: (key: string, value: string) => Promise<void> | void;
      getItem?: (key: string) => Promise<string | null> | string | null;
      setItem?: (key: string, value: string) => Promise<void> | void;
      SpeechRecognition?: never;
    };
    SpeechRecognition?: new () => { lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; start: () => void };
    webkitSpeechRecognition?: new () => { lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; start: () => void };
  }

  interface ImportMetaEnv {
    readonly VITE_AI_PROXY_URL?: string;
  }
}

const AI_ENDPOINT = import.meta.env.VITE_AI_PROXY_URL || "/api/ai-assistant";
const STORAGE_KEY = "constructpro_v1";
const CC: Record<Category, string> = { Earthworks: "#f59e0b", Structural: "#3b82f6", Masonry: "#ef4444", Finishing: "#8b5cf6", Utilities: "#10b981", Roofing: "#06b6d4", Closeout: "#6b7280" };
const STC: Record<ProcurementStatus, string> = { pending: "#6b7280", ordered: "#3b82f6", partial: "#f59e0b", complete: "#10b981" };
const REGIONS = { "NCR (Metro Manila)": 1.15, "Region 4A (CALABARZON)": 1.0, "Region 3 (Central Luzon)": 1.05, "Region 7 (Cebu)": 1.1, "Region 11 (Davao)": 1.08, "Region 6 (Western Visayas)": 0.98, "Region 8 (Eastern Visayas)": 0.95, "Region 1 (Ilocos)": 0.97 } as const;
const BP = { cement: 285, sand: 950, gravel: 1100, r12: 385, r16: 660, r20: 985, tw: 180, chb: 15, rf: 850, pu: 420, pvc2: 220, pvc4: 480, thhn: 2800, tfl: 55, twl: 48, cb: 385, paint: 620, wp: 280, clayTile: 72, roofDeck: 1450 } as const;
const WF = { cement: 0.05, sand: 0.1, gravel: 0.1, rebar: 0.03, chb: 0.05, tiles: 0.1, roof: 0.05, paint: 0.05 } as const;
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
const card: React.CSSProperties = { background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 16 };
const inputStyle: React.CSSProperties = { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", width: "100%" };

const defaultProject: Project = { name: "2-Storey Residential Building", type: "Residential", area: 120, floors: 2, startDate: "2026-05-01", budget: 5000000, duration: 120, location: "San Pablo, Laguna" };
const defaultTasks: Task[] = [
  { id: 1, name: "Site Preparation & Layout", cat: "Earthworks", start: 1, dur: 7, prog: 0, tag: "critical" },
  { id: 2, name: "Excavation & Dewatering", cat: "Earthworks", start: 8, dur: 10, prog: 0, tag: "critical" },
  { id: 3, name: "Foundation & Tie Beam", cat: "Structural", start: 18, dur: 14, prog: 0, tag: "critical" },
  { id: 4, name: "GF Columns & Slab", cat: "Structural", start: 32, dur: 21, prog: 0, tag: "critical" },
  { id: 5, name: "2F Columns & Slab", cat: "Structural", start: 53, dur: 21, prog: 0, tag: "critical" },
  { id: 6, name: "Roof Framing & Roofing", cat: "Roofing", start: 74, dur: 14, prog: 0, tag: "normal" },
  { id: 7, name: "CHB / Masonry Works", cat: "Masonry", start: 60, dur: 25, prog: 0, tag: "normal" },
  { id: 8, name: "Electrical Rough-in", cat: "Utilities", start: 72, dur: 15, prog: 0, tag: "normal" },
  { id: 9, name: "Plumbing Rough-in", cat: "Utilities", start: 72, dur: 15, prog: 0, tag: "normal" },
  { id: 10, name: "Plastering & Screeding", cat: "Finishing", start: 88, dur: 18, prog: 0, tag: "normal" },
  { id: 11, name: "Floor & Wall Tiling", cat: "Finishing", start: 96, dur: 15, prog: 0, tag: "normal" },
  { id: 12, name: "Painting", cat: "Finishing", start: 106, dur: 10, prog: 0, tag: "normal" },
  { id: 13, name: "Final Inspection & Turnover", cat: "Closeout", start: 117, dur: 3, prog: 0, tag: "milestone" },
];
const defaultBoq: BoqItem[] = [
  { id: 1, trade: "Earthworks", item: "Excavation", unit: "cu.m", qty: 85 },
  { id: 2, trade: "Structural", item: "Concrete (Foundation)", unit: "cu.m", qty: 28.5 },
  { id: 3, trade: "Structural", item: "Reinforcing Steel", unit: "kg", qty: 8500 },
  { id: 4, trade: "Masonry", item: "CHB Laying", unit: "sq.m", qty: 340 },
  { id: 5, trade: "Roofing", item: "Metal Roofing", unit: "sq.m", qty: 148 },
];
const defaultBom: BomItem[] = [
  { id: 1, material: "Portland Cement (40kg)", unit: "bags", qty: 1840, unitCost: 285, cat: "Structural", wastage: "5%" },
  { id: 2, material: "Coarse Sand", unit: "cu.m", qty: 38, unitCost: 950, cat: "Structural", wastage: "10%" },
  { id: 3, material: "Deformed Bars 12mm", unit: "pcs", qty: 420, unitCost: 385, cat: "Structural", wastage: "3%" },
  { id: 4, material: "CHB 4in Hollow Blocks", unit: "pcs", qty: 5440, unitCost: 15, cat: "Masonry", wastage: "5%" },
  { id: 5, material: "Long Span Roofing (GI)", unit: "sheets", qty: 62, unitCost: 850, cat: "Roofing", wastage: "5%" },
];
const defaultProc: ProcurementItem[] = [
  { id: 1, material: "Portland Cement (40kg)", qtyNeeded: 1840, qtyOrdered: 500, qtyDelivered: 500, supplier: "Holcim PH", status: "partial", date: "2026-05-05" },
  { id: 2, material: "Deformed Bars (12mm)", qtyNeeded: 420, qtyOrdered: 420, qtyDelivered: 0, supplier: "Pag-asa Steel", status: "ordered", date: "2026-05-08" },
  { id: 3, material: "CHB 4in Hollow Blocks", qtyNeeded: 5440, qtyOrdered: 0, qtyDelivered: 0, supplier: "", status: "pending", date: "" },
];

async function storageGet(key: string) {
  const api = window.storage;
  if (api?.get) {
    const result = await api.get(key);
    return typeof result === "string" || result === null ? result : result?.value ?? null;
  }
  if (api?.getItem) return api.getItem(key);
  return window.localStorage.getItem(key);
}

async function storageSet(key: string, value: string) {
  const api = window.storage;
  if (api?.set) return api.set(key, value);
  if (api?.setItem) return api.setItem(key, value);
  window.localStorage.setItem(key, value);
}

function computeAll(input: { floorArea: number; floors: number; roofType: "metal" | "concrete" | "clay"; region: keyof typeof REGIONS; soilType: "soft" | "medium" | "hard"; windZone: "low" | "moderate" | "high"; seismicZone: "zone2" | "zone4"; }) {
  const { floorArea, floors, roofType, region, soilType, windZone, seismicZone } = input;
  const tfa = floorArea * floors;
  const rm = REGIONS[region] || 1;
  const P = Object.fromEntries(Object.entries(BP).map(([k, v]) => [k, Math.round(v * rm)])) as Record<keyof typeof BP, number>;
  const seisF = seismicZone === "zone4" ? 1.25 : 1;
  const windF = ({ low: 1, moderate: 1.1, high: 1.25 } as const)[windZone] || 1.25;
  const roofFactor = ({ metal: 1, clay: 1.15, concrete: 1.2 } as const)[roofType] || 1;
  const concrete = Number((floorArea * floors * 0.16).toFixed(2));
  const rebarKg = Math.round(concrete * 90 * seisF);
  const wallArea = Math.round(tfa * 1.45);
  const roofArea = Math.round(floorArea * 1.2 * roofFactor);
  const totalDays = Math.round(90 + (tfa - 80) * 0.25 + (floors - 1) * 14 + (soilType === "hard" ? 8 : soilType === "medium" ? 3 : 0));

  const boq: BoqItem[] = [
    { id: 101, trade: "Earthworks", item: `Excavation (${soilType} soil)`, unit: "cu.m", qty: Number((floorArea * 0.9).toFixed(1)) },
    { id: 102, trade: "Structural", item: "Concrete Works", unit: "cu.m", qty: concrete },
    { id: 103, trade: "Structural", item: `Rebar (seismic ${seismicZone})`, unit: "kg", qty: rebarKg },
    { id: 104, trade: "Masonry", item: "CHB Laying", unit: "sq.m", qty: wallArea },
    { id: 105, trade: "Roofing", item: `${roofType} roofing`, unit: "sq.m", qty: roofArea },
  ];

  const bom: BomItem[] = [
    { id: 201, material: "Portland Cement (40kg)", unit: "bags", qty: Math.round(concrete * 8.5 * 1.05), unitCost: P.cement, cat: "Structural", wastage: "5%" },
    { id: 202, material: "Coarse Sand", unit: "cu.m", qty: Number((concrete * 0.48 * 1.1).toFixed(1)), unitCost: P.sand, cat: "Structural", wastage: "10%" },
    { id: 203, material: "Gravel (3/4in)", unit: "cu.m", qty: Number((concrete * 0.96 * 1.1).toFixed(1)), unitCost: P.gravel, cat: "Structural", wastage: "10%" },
    { id: 204, material: "Deformed Bars 12mm", unit: "pcs", qty: Math.round((rebarKg * 0.45 / 8) * 1.03), unitCost: P.r12, cat: "Structural", wastage: "3%" },
    { id: 205, material: "CHB 4in Hollow Blocks", unit: "pcs", qty: Math.round(wallArea * 16 * 1.05), unitCost: P.chb, cat: "Masonry", wastage: "5%" },
    { id: 206, material: roofType === "metal" ? "Long Span Roofing (GI)" : roofType === "concrete" ? "Roof Deck Concrete" : "Clay Roof Tiles", unit: roofType === "metal" ? "sheets" : "sq.m", qty: roofType === "metal" ? Math.round((roofArea / 2.4) * windF * 1.05) : roofArea, unitCost: roofType === "metal" ? P.rf : roofType === "concrete" ? P.roofDeck : P.clayTile, cat: "Roofing", wastage: roofType === "clay" ? "7%" : "5%" },
  ];

  const tasks: Task[] = [
    { id: 101, name: "Site Preparation & Layout", cat: "Earthworks", start: 1, dur: 6, prog: 0, tag: "critical" },
    { id: 102, name: `Excavation (${soilType} soil)`, cat: "Earthworks", start: 7, dur: soilType === "hard" ? 12 : 8, prog: 0, tag: "critical" },
    { id: 103, name: "Foundation & Tie Beams", cat: "Structural", start: 19, dur: 14, prog: 0, tag: "critical" },
    { id: 104, name: "Columns & Slabs", cat: "Structural", start: 33, dur: 24 + (floors - 1) * 12, prog: 0, tag: "critical" },
    { id: 105, name: `${roofType} roofing & framing`, cat: "Roofing", start: 60, dur: windZone === "high" ? 14 : 10, prog: 0, tag: "normal" },
    { id: 106, name: "Masonry Works", cat: "Masonry", start: 55, dur: 20, prog: 0, tag: "normal" },
    { id: 107, name: "Electrical & Plumbing Rough-in", cat: "Utilities", start: 72, dur: 12, prog: 0, tag: "normal" },
    { id: 108, name: "Finishes & Turnover", cat: "Finishing", start: 84, dur: Math.max(12, totalDays - 84), prog: 0, tag: "milestone" },
  ];

  return { boq, bom, tasks, totalDays, summary: { tfa, concrete, rebarKg, wallArea, roofArea, rm, seisF, windF } };
}

function MD({ text }: { text: string }) {
  return <div>{(text || "").split("\n").map((l, i) => <div key={i} style={{ marginBottom: 4 }}>{l}</div>)}</div>;
}

function Gantt({ tasks, duration }: { tasks: Task[]; duration: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{tasks.map((t) => { const left = ((t.start - 1) / duration) * 100; const width = Math.max(6, (t.dur / duration) * 100); return <div key={t.id} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "center" }}><div style={{ fontSize: 12, color: "#cbd5e1" }}>{t.name}</div><div style={{ height: 22, background: "#0f172a", borderRadius: 999, position: "relative" }}><div style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 0, bottom: 0, borderRadius: 999, background: CC[t.cat], opacity: 0.9 }} /></div></div>; })}</div>;
}

function App() {
  const [tab, setTab] = useState("compute");
  const [project, setProject] = useState(defaultProject);
  const [tasks, setTasks] = useState(defaultTasks);
  const [boq, setBoq] = useState(defaultBoq);
  const [bom, setBom] = useState(defaultBom);
  const [proc, setProc] = useState(defaultProc);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [aiLoad, setAiLoad] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([{ role: "assistant", content: "Mabuhay! I can help with BOQ, BOM, schedule review, procurement planning, and value engineering for this project." }]);
  const chatRef = useRef<HTMLDivElement>(null);
  const [wizard, setWizard] = useState({ floorArea: 120, floors: 2, roofType: "metal" as "metal" | "concrete" | "clay", region: "Region 4A (CALABARZON)" as keyof typeof REGIONS, soilType: "medium" as "soft" | "medium" | "hard", windZone: "high" as "low" | "moderate" | "high", seismicZone: "zone4" as "zone2" | "zone4" });

  useEffect(() => { void (async () => { try { const raw = await storageGet(STORAGE_KEY); if (raw) { const saved = JSON.parse(raw) as { project?: Project; tasks?: Task[]; boq?: BoqItem[]; bom?: BomItem[]; proc?: ProcurementItem[] }; if (saved.project) setProject(saved.project); if (saved.tasks) setTasks(saved.tasks); if (saved.boq) setBoq(saved.boq); if (saved.bom) setBom(saved.bom); if (saved.proc) setProc(saved.proc); } } catch {} setLoaded(true); })(); }, []);
  useEffect(() => { if (!loaded) return; const t = window.setTimeout(() => { void storageSet(STORAGE_KEY, JSON.stringify({ project, tasks, boq, bom, proc })); }, 300); return () => window.clearTimeout(t); }, [project, tasks, boq, bom, proc, loaded]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

  const matCost = useMemo(() => bom.reduce((s, m) => s + m.qty * m.unitCost, 0), [bom]);
  const laborCost = Math.round(matCost * 0.35);
  const eqCost = Math.round(matCost * 0.08);
  const contingency = Math.round((matCost + laborCost + eqCost) * 0.1);
  const totalCost = matCost + laborCost + eqCost + contingency;
  const overallProg = Math.round(tasks.reduce((s, t) => s + t.prog, 0) / tasks.length);
  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 4000); };

  const applyCompute = () => {
    const result = computeAll(wizard);
    setBoq(result.boq);
    setBom(result.bom);
    setTasks(result.tasks);
    setProject((p) => ({ ...p, area: wizard.floorArea, floors: wizard.floors, duration: result.totalDays, type: "Residential", name: `${wizard.floors}-Storey Residential Building` }));
    setTab("dashboard");
    showToast(`Applied ${result.boq.length} BOQ items, ${result.bom.length} BOM materials, and ${result.tasks.length} tasks.`);
  };

  const send = async (override?: string) => {
    const prompt = (override ?? input).trim();
    if (!prompt || aiLoad) return;
    if (!override) setInput("");
    const next = [...msgs, { role: "user" as const, content: prompt }];
    setMsgs(next);
    setAiLoad(true);
    try {
      const res = await fetch(AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, system: `You are a Philippine construction PM assistant for ${project.name} in ${project.location}. Budget: ₱${project.budget.toLocaleString()}. Estimate: ₱${totalCost.toLocaleString()}. Progress: ${overallProg}%.`, projectContext: { project, boq, bom, tasks, procurement: proc } }) });
      if (!res.ok) throw new Error("AI endpoint unavailable");
      const data = await res.json() as { content?: string; message?: string };
      setMsgs((m) => [...m, { role: "assistant", content: data.content || data.message || "No response returned." }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "AI endpoint is unavailable. Configure `/api/ai-assistant` or set `VITE_AI_PROXY_URL` to your backend so browser secrets stay protected." }]);
    } finally {
      setAiLoad(false);
    }
  };

  const costPie = [
    { name: "Materials", value: matCost },
    { name: "Labor", value: laborCost },
    { name: "Equipment", value: eqCost },
    { name: "Contingency", value: contingency },
  ];
  const catProgress = Object.values(CC).map(() => null);
  const byCategory = Object.entries(tasks.reduce<Record<string, { total: number; count: number }>>((acc, t) => { acc[t.cat] = acc[t.cat] || { total: 0, count: 0 }; acc[t.cat].total += t.prog; acc[t.cat].count += 1; return acc; }, {})).map(([cat, data]) => ({ cat, prog: Math.round(data.total / data.count) }));

  return <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "Segoe UI, sans-serif" }}>
    {toast ? <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10, background: "#1d4ed8", border: "1px solid #3b82f6", borderRadius: 10, padding: "12px 18px", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>{toast}</div> : null}
    <div style={{ background: "linear-gradient(135deg,#0f2744,#1e293b)", borderBottom: "1px solid #334155", padding: "12px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><div style={{ fontSize: 18, fontWeight: 700 }}>🏗️ ConstructPro <span style={{ fontSize: 10, background: "#1d4ed8", padding: "2px 7px", borderRadius: 999 }}>v3.1</span></div><div style={{ fontSize: 11, color: "#94a3b8" }}>{project.name} · {project.location}</div></div>
      <div style={{ display: "flex", gap: 14, fontSize: 11, flexWrap: "wrap", color: "#94a3b8" }}><span>⚡ {overallProg}%</span><span>💰 {fmt(project.budget)}</span><span>📏 ₱{Math.round(totalCost / (project.area * project.floors)).toLocaleString()}/sqm</span></div>
    </div>
    <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "0 22px", display: "flex", overflowX: "auto" }}>
      {["compute", "dashboard", "schedule", "boq", "bom", "procurement", "reports", "ai"].map((id) => <button key={id} onClick={() => setTab(id)} style={{ padding: "10px 14px", border: "none", background: "transparent", color: tab === id ? "#38bdf8" : "#64748b", borderBottom: tab === id ? "2px solid #38bdf8" : "2px solid transparent", whiteSpace: "nowrap" }}>{id === "bom" ? "BOM & Cost" : id[0].toUpperCase() + id.slice(1)}</button>)}
    </div>
    <div style={{ padding: 22, maxWidth: 1400, margin: "0 auto" }}>
      {tab === "compute" ? <div style={{ display: "grid", gap: 16 }}>
        <div style={card}><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>📐 Smart Compute</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
          <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Floor area per level</div><input type="number" style={inputStyle} value={wizard.floorArea} onChange={(e) => setWizard((w) => ({ ...w, floorArea: Number(e.target.value) }))} /></div>
          <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Floors</div><input type="number" min={1} max={6} style={inputStyle} value={wizard.floors} onChange={(e) => setWizard((w) => ({ ...w, floors: Number(e.target.value) }))} /></div>
          <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Region</div><select style={inputStyle} value={wizard.region} onChange={(e) => setWizard((w) => ({ ...w, region: e.target.value as keyof typeof REGIONS }))}>{Object.keys(REGIONS).map((r) => <option key={r}>{r}</option>)}</select></div>
          <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Roof type</div><select style={inputStyle} value={wizard.roofType} onChange={(e) => setWizard((w) => ({ ...w, roofType: e.target.value as "metal" | "concrete" | "clay" }))}><option value="metal">Metal</option><option value="concrete">Concrete</option><option value="clay">Clay</option></select></div>
          <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Soil type</div><select style={inputStyle} value={wizard.soilType} onChange={(e) => setWizard((w) => ({ ...w, soilType: e.target.value as "soft" | "medium" | "hard" }))}><option value="soft">Soft</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
          <div><div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>Wind zone</div><select style={inputStyle} value={wizard.windZone} onChange={(e) => setWizard((w) => ({ ...w, windZone: e.target.value as "low" | "moderate" | "high" }))}><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></div>
        </div><div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}><button onClick={applyCompute} style={{ background: "linear-gradient(135deg,#059669,#10b981)", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700 }}>Compute and Apply</button></div></div>
      </div> : null}

      {tab === "dashboard" ? <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
          {[{ l: "Overall Progress", v: `${overallProg}%`, c: "#38bdf8" }, { l: "Estimated Cost", v: fmt(totalCost), c: totalCost <= project.budget ? "#10b981" : "#ef4444" }, { l: "Project Duration", v: `${project.duration} days`, c: "#f59e0b" }, { l: "Pending Procurement", v: `${proc.filter((p) => p.status === "pending").length}`, c: "#8b5cf6" }].map((x) => <div key={x.l} style={card}><div style={{ fontSize: 11, color: "#94a3b8" }}>{x.l}</div><div style={{ fontSize: 22, fontWeight: 700, color: x.c }}>{x.v}</div></div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}><div style={{ fontWeight: 700, marginBottom: 10 }}>Cost Breakdown</div><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={costPie} dataKey="value" outerRadius={70}>{costPie.map((_, i) => <Cell key={i} fill={["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][i]} />)}</Pie><Tooltip formatter={(v: number) => fmt(v)} /><Legend /></PieChart></ResponsiveContainer></div>
          <div style={card}><div style={{ fontWeight: 700, marginBottom: 10 }}>Progress by Category</div>{byCategory.map((c) => <div key={c.cat} style={{ marginBottom: 10 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: CC[c.cat as Category] }}>{c.cat}</span><span>{c.prog}%</span></div><div style={{ background: "#334155", borderRadius: 999, height: 8 }}><div style={{ width: `${c.prog}%`, background: CC[c.cat as Category], borderRadius: 999, height: 8 }} /></div></div>)}</div>
        </div>
      </div> : null}

      {tab === "schedule" ? <div style={card}><div style={{ fontWeight: 700, marginBottom: 10 }}>📅 Schedule & Gantt</div><Gantt tasks={tasks} duration={project.duration} /><div style={{ marginTop: 16 }}>{tasks.map((t) => <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12, alignItems: "center", marginBottom: 8 }}><span>{t.name}</span><input type="range" min={0} max={100} value={t.prog} onChange={(e) => setTasks((all) => all.map((x) => x.id === t.id ? { ...x, prog: Number(e.target.value) } : x))} /></div>)}</div></div> : null}

      {tab === "boq" ? <div style={card}><div style={{ fontWeight: 700, marginBottom: 10 }}>📋 Bill of Quantities</div><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Trade", "Item", "Unit", "Qty"].map((h) => <th key={h} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #334155", color: "#94a3b8" }}>{h}</th>)}</tr></thead><tbody>{boq.map((b) => <tr key={b.id}><td style={{ padding: 8 }}>{b.trade}</td><td style={{ padding: 8 }}>{b.item}</td><td style={{ padding: 8 }}>{b.unit}</td><td style={{ padding: 8 }}>{b.qty.toLocaleString()}</td></tr>)}</tbody></table></div> : null}

      {tab === "bom" ? <div style={{ display: "grid", gap: 16 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>{[{ l: "Materials", v: fmt(matCost) }, { l: "Labor", v: fmt(laborCost) }, { l: "Equipment", v: fmt(eqCost) }, { l: "Contingency", v: fmt(contingency) }, { l: "Total", v: fmt(totalCost) }].map((x) => <div key={x.l} style={card}><div style={{ fontSize: 11, color: "#94a3b8" }}>{x.l}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{x.v}</div></div>)}</div><div style={card}><div style={{ fontWeight: 700, marginBottom: 10 }}>🧱 Bill of Materials</div><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Material", "Unit", "Qty", "Unit Cost", "Total"].map((h) => <th key={h} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #334155", color: "#94a3b8" }}>{h}</th>)}</tr></thead><tbody>{bom.map((m) => <tr key={m.id}><td style={{ padding: 8 }}>{m.material}</td><td style={{ padding: 8 }}>{m.unit}</td><td style={{ padding: 8 }}>{Number(m.qty).toLocaleString()}</td><td style={{ padding: 8 }}>{fmt(m.unitCost)}</td><td style={{ padding: 8, color: "#38bdf8" }}>{fmt(m.qty * m.unitCost)}</td></tr>)}</tbody></table></div></div> : null}

      {tab === "procurement" ? <div style={card}><div style={{ fontWeight: 700, marginBottom: 10 }}>🚚 Procurement</div>{proc.map((p) => <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12, alignItems: "center", marginBottom: 10 }}><span>{p.material}</span><span>{p.qtyNeeded}</span><span>{p.qtyOrdered}</span><span>{p.qtyDelivered}</span><span style={{ color: STC[p.status] }}>{p.status}</span></div>)}</div> : null}

      {tab === "reports" ? <div style={{ display: "grid", gap: 16 }}><div style={card}><div style={{ fontWeight: 700, marginBottom: 10 }}>📈 Cost Forecast</div><ResponsiveContainer width="100%" height={260}><LineChart data={tasks.map((t, i) => ({ month: `M${i + 1}`, spending: Math.round(totalCost / Math.max(tasks.length, 1)), cumulative: Math.round((totalCost / Math.max(tasks.length, 1)) * (i + 1)) }))}><XAxis dataKey="month" /><YAxis tickFormatter={(v) => `₱${(v / 1000000).toFixed(1)}M`} /><Tooltip formatter={(v: number) => fmt(v)} /><Legend /><Bar dataKey="spending" fill="#3b82f6" /><Line type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={2} /></LineChart></ResponsiveContainer></div><div style={card}><div style={{ fontWeight: 700, marginBottom: 10 }}>Benchmark</div><div style={{ fontSize: 28, fontWeight: 700, color: "#38bdf8" }}>₱{Math.round(totalCost / (project.area * project.floors)).toLocaleString()}<span style={{ fontSize: 13, color: "#94a3b8" }}>/sqm</span></div></div></div> : null}

      {tab === "ai" ? <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div><div style={{ fontWeight: 700, fontSize: 18 }}>🤖 AI Assistant</div><div style={{ fontSize: 12, color: "#94a3b8" }}>Uses a backend proxy endpoint for safety</div></div><button onClick={() => { const prompt = `Give me 5 value engineering suggestions for a ${project.area}sqm x ${project.floors}F project in ${project.location} with total estimate ${fmt(totalCost)}.`; setInput(prompt); void send(prompt); }} style={{ background: "#059669", color: "white", border: "none", borderRadius: 8, padding: "8px 14px" }}>Value Engineering</button></div><div ref={chatRef} style={{ height: "45vh", overflowY: "auto", padding: 16, background: "#1e293b", border: "1px solid #334155", borderRadius: "12px 12px 0 0" }}>{msgs.map((m, i) => <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}><div style={{ maxWidth: "78%", background: m.role === "user" ? "#1d4ed8" : "#0f172a", border: m.role === "assistant" ? "1px solid #334155" : "none", borderRadius: 12, padding: "10px 14px" }}><MD text={m.content} /></div></div>)}{aiLoad ? <div style={{ color: "#94a3b8" }}>Analyzing your project data...</div> : null}</div><div style={{ display: "flex", gap: 8, padding: 12, background: "#1e293b", border: "1px solid #334155", borderTop: "none", borderRadius: "0 0 12px 12px" }}><input style={inputStyle} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void send()} placeholder="Ask about BOQ, BOM, cost, schedule, or procurement" /><button onClick={() => void send()} disabled={aiLoad} style={{ background: aiLoad ? "#334155" : "#1d4ed8", color: "white", border: "none", borderRadius: 8, padding: "10px 18px" }}>{aiLoad ? "..." : "Send"}</button></div></div> : null}
    </div>
  </div>;
}

export default App;
