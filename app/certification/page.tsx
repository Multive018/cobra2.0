"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Poppins } from "next/font/google";
import {
  AlertTriangle,
  Box,
  Check,
  ChevronRight,
  CloudUpload,
  Combine,
  Download,
  FileSpreadsheet,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  X,
} from "lucide-react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const KG_TO_BAG = 60;
const CERT_FILTERS = ["RFA", "CAFE", "NET ZERO", "EUDR", "AAA"] as const;
const MONTH_ORDER = ["Mar-26", "Apr-26", "May-26", "Jun-26", "Jul-26", "Aug-26"] as const;

type CertType = (typeof CERT_FILTERS)[number];
type Unit = "kg" | "bag" | "mt";
type MainTab = "physical" | "certification" | "tracker" | "contracts" | "blends";
type UploadMode = "purchases" | "sales" | "manual";
type PopupState = { message: string; kind: "error" | "success" };

type CertifiedStock = {
  id: number;
  season?: string | null;
  sale_type?: string | null;
  outturn?: string | null;
  lot_number: string;
  strategy?: string | null;
  cooperative?: string | null;
  wet_mill?: string | null;
  county?: string | null;
  grade?: string | null;
  grower_code?: string | null;
  purchased_weight: number | string;
  rfa_certified?: boolean | number | string;
  rfa_expiry_date?: string | null;
  rfa_certificate_holder?: string | null;
  rfa_declared_weight?: number | string | null;
  eudr_certified?: boolean | number | string;
  eudr_expiry_date?: string | null;
  eudr_certificate_holder?: string | null;
  eudr_declared_weight?: number | string | null;
  cafe_certified?: boolean | number | string;
  cafe_expiry_date?: string | null;
  cafe_certificate_holder?: string | null;
  cafe_declared_weight?: number | string | null;
  impact_certified?: boolean | number | string;
  impact_expiry_date?: string | null;
  impact_declared_weight?: number | string | null;
  aaa_project?: boolean | number | string;
  aaa_volume?: number | string | null;
  geodata_available?: boolean | number | string;
  aaa_declared_weight?: number | string | null;
  netzero_project?: boolean | number | string;
  netzero_declared_weight?: number | string | null;
  fully_declared?: boolean | number | string;
  recorded_date?: string | null;
};

type SaleContract = {
  id: number;
  contract_number: string;
  client?: string | null;
  weight_kilos: number | string;
  shipping_date: string;
  strategy?: string | null;
  quality?: string | null;
  grade?: string | null;
  certifications: any;
  blend_id?: number | null;
  blend_name?: string | null;
};

type Blend = {
  id: number;
  name: string;
  client?: string | null;
  grade?: string | null;
  cup_profile?: string | null;
  blend_no?: string | null;
  [key: string]: any;
};

type PhysicalRow = {
  stack: string;
  theoretical: number;
  months: Record<string, number>;
  shorts: number;
  net: number;
};

type PhysicalDataState = {
  gridData: PhysicalRow[];
  months: string[];
  kpis: { totalTheoretical: number; totalShorts: number; totalNet: number };
};

type CertRow = {
  strategy: string;
  available: number;
  shipmentsByMonth: Record<string, number>;
  totalShipment: number;
  netPosition: number;
  tags: string[];
  linkedLots: number;
  linkedContracts: number;
};

type TrackerRow = {
  cert: CertType;
  totalKg: number;
  declaredKg: number;
  balanceKg: number;
  lotCount: number;
  expiringSoon: number;
  holders: { name: string; value: number }[];
};

type BlendComponent = { key: string; label: string };
type BlendFormState = Record<string, string>;

const BLEND_COMPONENTS: BlendComponent[] = [
  { key: "finished", label: "Finished" },
  { key: "post_natural", label: "Post Natural" },
  { key: "post_specialty_washed", label: "Specialty Washed" },
  { key: "post_17_up_top", label: "17 Up Top" },
  { key: "post_16_top", label: "16 Top" },
  { key: "post_15_top", label: "15 Top" },
  { key: "post_pb_top", label: "PB Top" },
  { key: "post_17_up_plus", label: "17 Up Plus" },
  { key: "post_16_plus", label: "16 Plus" },
  { key: "post_15_plus", label: "15 Plus" },
  { key: "post_14_plus", label: "14 Plus" },
  { key: "post_pb_plus", label: "PB Plus" },
  { key: "post_17_up_faq", label: "17 Up FAQ" },
  { key: "post_16_faq", label: "16 FAQ" },
  { key: "post_15_faq", label: "15 FAQ" },
  { key: "post_14_faq", label: "14 FAQ" },
  { key: "post_pb_faq", label: "PB FAQ" },
  { key: "post_faq_minus", label: "FAQ Minus" },
  { key: "post_grinder_bold", label: "Grinder Bold" },
  { key: "post_grinder_light", label: "Grinder Light" },
  { key: "post_mh", label: "MH" },
  { key: "post_ml", label: "ML" },
  { key: "post_rejects_s", label: "Rejects S" },
  { key: "post_rejects_p", label: "Rejects P" },
];

const INITIAL_BLEND_FORM: BlendFormState = {
  name: "",
  client: "",
  grade: "",
  cup_profile: "",
  blend_no: "",
  ...Object.fromEntries(BLEND_COMPONENTS.map((c) => [c.key, ""])),
};

const SAMPLE_STOCKS: CertifiedStock[] = [
  { id: 1, season: "2025/26", sale_type: "Export", outturn: "OP-01", lot_number: "LOT-1178", strategy: "TOP AA", cooperative: "Kahawa Farmers Co-op", wet_mill: "Mugumo Wet Mill", county: "Kiambu", grade: "AA", grower_code: "GROW-10031", purchased_weight: 12840, rfa_certified: true, rfa_expiry_date: "2026-11-30", rfa_certificate_holder: "Kahawa Farmers Co-op", rfa_declared_weight: 8420, eudr_certified: true, eudr_expiry_date: "2026-08-15", eudr_certificate_holder: "Kahawa Farmers Co-op", eudr_declared_weight: 6420, cafe_certified: true, cafe_expiry_date: "2026-09-12", cafe_certificate_holder: "Mugumo Wet Mill", cafe_declared_weight: 9010, impact_certified: false, aaa_project: true, aaa_volume: 4200, geodata_available: true, aaa_declared_weight: 4200, netzero_project: false, fully_declared: false, recorded_date: "2025-12-01" },
  { id: 2, season: "2025/26", sale_type: "Domestic", outturn: "OP-02", lot_number: "LOT-1184", strategy: "TOP AB", cooperative: "Ruiru Growers Union", wet_mill: "Thika Hills Mill", county: "Kiambu", grade: "AB", grower_code: "GROW-20115", purchased_weight: 9850, rfa_certified: true, rfa_expiry_date: "2026-10-28", rfa_certificate_holder: "Ruiru Growers Union", cafe_certified: true, cafe_expiry_date: "2026-07-10", cafe_certificate_holder: "Thika Hills Mill", impact_certified: true, impact_expiry_date: "2026-12-31", impact_declared_weight: 2450, aaa_project: false, netzero_project: true, netzero_declared_weight: 1450, fully_declared: false, recorded_date: "2025-12-10" },
  { id: 3, season: "2025/26", sale_type: "Export", outturn: "OP-04", lot_number: "LOT-1201", strategy: "FAQ AA", cooperative: "Nyeri Highlands Co-op", wet_mill: "Tetu Station", county: "Nyeri", grade: "PB", grower_code: "GROW-30044", purchased_weight: 15620, rfa_certified: true, rfa_expiry_date: "2026-12-20", rfa_certificate_holder: "Nyeri Highlands Co-op", eudr_certified: true, eudr_expiry_date: "2026-12-20", eudr_certificate_holder: "Nyeri Highlands Co-op", cafe_certified: true, cafe_expiry_date: "2026-12-20", cafe_certificate_holder: "Tetu Station", impact_certified: true, impact_expiry_date: "2026-12-20", aaa_project: true, aaa_declared_weight: 15620, netzero_project: true, netzero_declared_weight: 15620, fully_declared: true, recorded_date: "2025-12-15" },
  { id: 4, season: "2025/26", sale_type: "Export", outturn: "OP-06", lot_number: "LOT-1210", strategy: "GRINDER", cooperative: "Meru Peak Union", wet_mill: "Nkubu Wet Mill", county: "Meru", grade: "C", grower_code: "GROW-40081", purchased_weight: 7320, aaa_project: true, aaa_declared_weight: 3100, geodata_available: false, fully_declared: false, recorded_date: "2025-12-18" },
  { id: 5, season: "2025/26", sale_type: "Export", outturn: "OP-07", lot_number: "LOT-1215", strategy: "PLUS AB", cooperative: "Meru Peak Union", wet_mill: "Nkubu Wet Mill", county: "Meru", grade: "AB", grower_code: "GROW-40105", purchased_weight: 6600, eudr_certified: true, eudr_expiry_date: "2026-08-02", eudr_certificate_holder: "Meru Peak Union", aaa_project: true, aaa_declared_weight: 4200, fully_declared: false, recorded_date: "2025-12-19" },
];

const SAMPLE_SALES: SaleContract[] = [
  { id: 1, contract_number: "SC-2026-001", client: "Client A", weight_kilos: 12000, shipping_date: "2026-03-15", strategy: "TOP AA", quality: "Premium", grade: "AA", certifications: ["RFA", "EUDR", "CAFE"] },
  { id: 2, contract_number: "SC-2026-002", client: "Client B", weight_kilos: 8000, shipping_date: "2026-04-10", strategy: "FAQ AA", quality: "Standard", grade: "AB", certifications: ["RFA", "CAFE", "Impact"] },
  { id: 3, contract_number: "SC-2026-003", client: "Client C", weight_kilos: 5500, shipping_date: "2026-05-22", strategy: "GRINDER", quality: "Commercial", grade: "PB", certifications: [] },
  { id: 4, contract_number: "SC-2026-004", client: "Client D", weight_kilos: 9000, shipping_date: "2026-06-30", strategy: "PLUS AB", quality: "Standard", grade: "AB", certifications: ["AAA", "NET ZERO"] },
];

const SAMPLE_BLENDS: Blend[] = [
  { id: 1, name: "Premium Espresso", client: "Client A", grade: "AA", cup_profile: "Chocolate, Sweet", blend_no: "BL-1001", post_natural: 20, post_17_up_top: 25, post_16_top: 15, post_15_plus: 10, post_grinder_light: 5, post_faq_minus: 25 },
  { id: 2, name: "House Blend", client: "Client B", grade: "AB", cup_profile: "Balanced", blend_no: "BL-1002", post_17_up_plus: 18, post_16_faq: 22, post_pb_faq: 12, post_mh: 8, post_ml: 4, post_rejects_s: 36 },
  { id: 3, name: "Filter Blend", client: "Client C", grade: "PB", cup_profile: "Bright", blend_no: "BL-1003", post_specialty_washed: 10, post_15_top: 18, post_14_plus: 8, post_faq_minus: 64 },
];

const SAMPLE_PHYSICAL: PhysicalRow[] = [
  { stack: "finished", theoretical: 22340, months: { "Mar-26": 400, "Apr-26": 800, "May-26": 900, "Jun-26": 600, "Jul-26": 500, "Aug-26": 450 }, shorts: 3650, net: 18690 },
  { stack: "post_natural", theoretical: 17880, months: { "Mar-26": 300, "Apr-26": 500, "May-26": 760, "Jun-26": 680, "Jul-26": 440, "Aug-26": 410 }, shorts: 3090, net: 14790 },
  { stack: "post_17_up_top", theoretical: 29120, months: { "Mar-26": 1200, "Apr-26": 1500, "May-26": 1300, "Jun-26": 1600, "Jul-26": 900, "Aug-26": 700 }, shorts: 7200, net: 21920 },
  { stack: "post_16_faq", theoretical: 9800, months: { "Mar-26": 250, "Apr-26": 300, "May-26": 200, "Jun-26": 180, "Jul-26": 140, "Aug-26": 120 }, shorts: 1190, net: 8610 },
  { stack: "post_grinder_bold", theoretical: 5600, months: { "Mar-26": 0, "Apr-26": 300, "May-26": 500, "Jun-26": 200, "Jul-26": 100, "Aug-26": 50 }, shorts: 1150, net: 4450 },
];

function asNumber(value: unknown) {
  const n = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function bool(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseCerts(raw: any): string[] {
  if (Array.isArray(raw)) return Array.from(new Set(raw.map(String).filter(Boolean)));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return Array.from(new Set(parsed.map(String).filter(Boolean)));
      if (parsed) return [String(parsed)];
    } catch {
      return Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
    }
  }
  return [];
}

function formatMonth(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Unscheduled";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function convertQty(value: number, unit: Unit) {
  if (unit === "bag") return value / KG_TO_BAG;
  if (unit === "mt") return value / 1000;
  return value;
}

function unitText(unit: Unit) {
  return unit === "bag" ? "BAGS" : unit.toUpperCase();
}

function formatQty(value: number, unit: Unit, decimals?: number) {
  const nextDecimals = decimals ?? (unit === "mt" ? 2 : 0);
  const converted = convertQty(value, unit);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: nextDecimals, minimumFractionDigits: nextDecimals }).format(converted);
}

function stackLabel(stack: string) {
  return stack.replace(/_/g, " ");
}

function buildPhysicalData(rows: PhysicalRow[]): PhysicalDataState {
  return {
    gridData: rows,
    months: [...MONTH_ORDER],
    kpis: {
      totalTheoretical: rows.reduce((sum, r) => sum + asNumber(r.theoretical), 0),
      totalShorts: rows.reduce((sum, r) => sum + asNumber(r.shorts), 0),
      totalNet: rows.reduce((sum, r) => sum + asNumber(r.net), 0),
    },
  };
}

function getBlendCompositionRow(blend: Blend) {
  return BLEND_COMPONENTS.map((comp) => ({ ...comp, value: asNumber(blend[comp.key] ?? blend.components?.[comp.key] ?? 0) })).filter((entry) => entry.value > 0);
}

function normalizeBlendForm(form: BlendFormState) {
  return Object.fromEntries(Object.entries(form).map(([k, v]) => [k, k === "name" || k === "client" || k === "grade" || k === "cup_profile" || k === "blend_no" ? v.trim() : v === "" ? 0 : Number(v)]));
}

function safeRows(data: any) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function SectionCard({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#F5F5F3] px-5 py-4">
        <div>
          <div className="text-sm font-bold text-[#51534a]">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-[#968C83]">{subtitle}</div> : null}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, tone = "default" }: { title: string; value: string; subtitle?: string; tone?: "default" | "good" | "warn" }) {
  const toneClass = tone === "good" ? "text-[#007680]" : tone === "warn" ? "text-[#B9975B]" : "text-[#51534a]";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#968C83]">{title}</div>
      <div className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</div>
      {subtitle ? <div className="mt-2 text-xs text-[#968C83]">{subtitle}</div> : null}
    </div>
  );
}

function Chip({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-4 py-1.5 text-sm font-bold transition ${active ? "border-[#007680] bg-[#007680] text-white" : "border-[#D6D2C4] bg-white text-[#968C83] hover:border-[#007680] hover:text-[#007680]"}`}>{children}</button>;
}

function FileField({ label, accept, file, onFile }: { label: string; accept: string; file: File | null; onFile: (f: File | null) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#968C83]">{label}</label>
      <div className="rounded-lg border border-dashed border-[#D6D2C4] bg-white p-3">
        <input type="file" accept={accept} onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-[#51534a]" />
      </div>
      {file ? <div className="mt-1 text-[11px] font-bold text-[#007680]">{file.name}</div> : null}
    </div>
  );
}

function Popup({ text, onClose }: { text: PopupState | null; onClose: () => void }) {
  if (!text) return null;
  const isError = text.kind === "error";
  return (
    <div className={`fixed right-4 top-4 z-[80] max-w-md rounded-2xl border px-4 py-3 shadow-lg ${isError ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className={`mt-0.5 ${isError ? "text-red-600" : "text-emerald-600"}`} />
        <div className={`text-sm font-semibold ${isError ? "text-red-700" : "text-emerald-700"}`}>{text.message}</div>
        <button onClick={onClose} className={`ml-2 rounded-full p-1 ${isError ? "text-red-500 hover:bg-red-100" : "text-emerald-500 hover:bg-emerald-100"}`}><X size={14} /></button>
      </div>
    </div>
  );
}

function ExportMenu({ open, onDownload }: { open: boolean; onDownload: (type: "csv" | "excel") => void }) {
  if (!open) return null;
  return (
    <div className="absolute right-0 top-[52px] z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
      <button type="button" onClick={() => onDownload("csv")} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Download CSV</button>
      <button type="button" onClick={() => onDownload("excel")} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Download Excel</button>
    </div>
  );
}

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: any) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("");
}

function toExcelHtml(title: string, rows: Record<string, any>[]) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const headHtml = headers.map((h) => `<th style="border:1px solid #ccc;padding:6px;background:#51534a;color:#fff;text-align:left;">${h}</th>`).join("");
  const bodyHtml = rows.map((row) => `<tr>${headers.map((h) => `<td style="border:1px solid #ccc;padding:6px;">${String(row[h] ?? "")}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><table>${headers.length ? `<thead><tr>${headHtml}</tr></thead>` : ""}<tbody>${bodyHtml}</tbody></table></body></html>`;
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<MainTab>("physical");
  const [unit, setUnit] = useState<Unit>("kg");
  const [stocks, setStocks] = useState<CertifiedStock[]>(SAMPLE_STOCKS);
  const [sales, setSales] = useState<SaleContract[]>(SAMPLE_SALES);
  const [blends, setBlends] = useState<Blend[]>(SAMPLE_BLENDS);
  const [physicalData, setPhysicalData] = useState<PhysicalDataState>({ gridData: [], months: [...MONTH_ORDER], kpis: { totalTheoretical: 0, totalShorts: 0, totalNet: 0 } });
  const [loading, setLoading] = useState(true);
  const [physicalLoading, setPhysicalLoading] = useState(false);
  const [activeCert, setActiveCert] = useState<CertType>("RFA");
  const [trackerCert, setTrackerCert] = useState<CertType>("RFA");
  const [selectedBlendId, setSelectedBlendId] = useState<number | null>(null);
  const [blendSearch, setBlendSearch] = useState("");
  const [blendForm, setBlendForm] = useState<BlendFormState>({ ...INITIAL_BLEND_FORM });
  const [blendCreateOpen, setBlendCreateOpen] = useState(false);
  const [toast, setToast] = useState<PopupState | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null);
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [manualSale, setManualSale] = useState({ contract_number: "", client: "", weight_kilos: "", quality: "", grade: "", shipping_date: "", certifications: "" });
  const [editingContractId, setEditingContractId] = useState<number | null>(null);
  const [contractEdit, setContractEdit] = useState<{ quality: string; grade: string; certifications: string[]; blend_id: number | "" }>({ quality: "", grade: "", certifications: [], blend_id: "" });
  const [blendAllocContractId, setBlendAllocContractId] = useState<number | "">("");
  const [blendBusy, setBlendBusy] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("purchases");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const recordsModalRef = useRef<HTMLDivElement | null>(null);
  const downloadWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [stocksRes, salesRes, blendsRes] = await Promise.all([
          fetch("/api/certified_stocks", { cache: "no-store" }),
          fetch("/api/contracts", { cache: "no-store" }),
          fetch("/api/blends", { cache: "no-store" }),
        ]);

        if (stocksRes.ok) {
          const rows = safeRows(await stocksRes.json());
          setStocks(rows.length ? rows : SAMPLE_STOCKS);
        } else {
          setStocks(SAMPLE_STOCKS);
        }

        if (salesRes.ok) {
          const rows = safeRows(await salesRes.json());
          setSales(rows.length ? rows : SAMPLE_SALES);
        } else {
          setSales(SAMPLE_SALES);
        }

        if (blendsRes.ok) {
          const rows = safeRows(await blendsRes.json());
          setBlends(rows.length ? rows : SAMPLE_BLENDS);
        } else {
          setBlends(SAMPLE_BLENDS);
        }
      } catch {
        setStocks(SAMPLE_STOCKS);
        setSales(SAMPLE_SALES);
        setBlends(SAMPLE_BLENDS);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedBlendId && blends.length > 0) setSelectedBlendId(blends[0].id);
  }, [blends, selectedBlendId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (recordsModalRef.current && !recordsModalRef.current.contains(event.target as Node)) setUploadOpen(false);
    }
    if (uploadOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [uploadOpen]);

  useEffect(() => {
    function onDownloadOutside(event: MouseEvent) {
      if (downloadWrapRef.current && !downloadWrapRef.current.contains(event.target as Node)) setDownloadOpen(false);
    }
    if (downloadOpen) document.addEventListener("mousedown", onDownloadOutside);
    return () => document.removeEventListener("mousedown", onDownloadOutside);
  }, [downloadOpen]);

  const certificationRows = useMemo(() => {
    const rows = new Map<string, CertRow>();
    const months = new Set<string>(MONTH_ORDER as unknown as string[]);

    const activeFlag = (stock: CertifiedStock) => {
      switch (activeCert) {
        case "RFA": return bool(stock.rfa_certified);
        case "CAFE": return bool(stock.cafe_certified);
        case "NET ZERO": return bool(stock.netzero_project);
        case "EUDR": return bool(stock.eudr_certified);
        case "AAA": return bool(stock.aaa_project);
      }
    };

    stocks.filter(activeFlag).forEach((stock) => {
      const strategy = stock.strategy || "Unassigned";
      const current = rows.get(strategy) ?? { strategy, available: 0, shipmentsByMonth: {}, totalShipment: 0, netPosition: 0, tags: [], linkedLots: 0, linkedContracts: 0 };
      current.available += asNumber(stock.purchased_weight);
      current.netPosition += asNumber(stock.purchased_weight);
      current.linkedLots += 1;
      rows.set(strategy, current);
    });

    sales.forEach((sale) => {
      const certs = parseCerts(sale.certifications).map((c) => c.toUpperCase());
      if (!certs.includes(activeCert)) return;
      const strategy = sale.strategy || sale.quality || "Unassigned";
      const current = rows.get(strategy) ?? { strategy, available: 0, shipmentsByMonth: {}, totalShipment: 0, netPosition: 0, tags: [], linkedLots: 0, linkedContracts: 0 };
      const month = formatMonth(sale.shipping_date);
      months.add(month);
      current.shipmentsByMonth[month] = (current.shipmentsByMonth[month] || 0) + asNumber(sale.weight_kilos);
      current.totalShipment += asNumber(sale.weight_kilos);
      current.netPosition -= asNumber(sale.weight_kilos);
      current.tags = Array.from(new Set([...current.tags, ...certs]));
      current.linkedContracts += 1;
      rows.set(strategy, current);
    });

    const tableData = Array.from(rows.values()).sort((a, b) => a.strategy.localeCompare(b.strategy));
    const certMonths = Array.from(months).sort((a, b) => {
      const ai = MONTH_ORDER.indexOf(a as (typeof MONTH_ORDER)[number]);
      const bi = MONTH_ORDER.indexOf(b as (typeof MONTH_ORDER)[number]);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    const stock = tableData.reduce((sum, row) => sum + row.available, 0);
    const shorts = tableData.reduce((sum, row) => sum + row.totalShipment, 0);
    const net = tableData.reduce((sum, row) => sum + row.netPosition, 0);
    const supplyChainStock = stocks.filter((stockRow) => activeFlag(stockRow) && ["RFA", "CAFE", "EUDR"].includes(activeCert)).reduce((sum, stockRow) => sum + asNumber(stockRow.purchased_weight), 0);

    return { tableData, months: certMonths, kpis: { stock, shorts, net, supplyChainStock } };
  }, [activeCert, sales, stocks]);

  const activeCertLots = useMemo(() => stocks.filter((stock) => {
    switch (activeCert) {
      case "RFA": return bool(stock.rfa_certified);
      case "CAFE": return bool(stock.cafe_certified);
      case "NET ZERO": return bool(stock.netzero_project);
      case "EUDR": return bool(stock.eudr_certified);
      case "AAA": return bool(stock.aaa_project);
    }
  }), [stocks, activeCert]);

  const activeCertContracts = useMemo(() => sales.filter((sale) => parseCerts(sale.certifications).some((c) => c.toUpperCase() === activeCert)), [sales, activeCert]);

  const certInsights = useMemo(() => {
    const certifiedKg = activeCertLots.reduce((sum, stock) => sum + asNumber(stock.purchased_weight), 0);
    const declaredKg = activeCertContracts.reduce((sum, sale) => sum + asNumber(sale.weight_kilos), 0);
    return { certifiedKg, declaredKg, linkedContracts: activeCertContracts.length, coverage: certifiedKg > 0 ? (declaredKg / certifiedKg) * 100 : 0 };
  }, [activeCertLots, activeCertContracts]);

  const trackerRows = useMemo(() => {
    return CERT_FILTERS.map((cert) => {
      const certLots = stocks.filter((stock) => {
        switch (cert) {
          case "RFA": return bool(stock.rfa_certified);
          case "CAFE": return bool(stock.cafe_certified);
          case "NET ZERO": return bool(stock.netzero_project);
          case "EUDR": return bool(stock.eudr_certified);
          case "AAA": return bool(stock.aaa_project);
        }
      });

      const totalKg = certLots.reduce((sum, stock) => sum + asNumber(stock.purchased_weight), 0);
      const declaredKg = certLots.reduce((sum, stock) => {
        switch (cert) {
          case "RFA": return sum + asNumber(stock.rfa_declared_weight);
          case "CAFE": return sum + asNumber(stock.cafe_declared_weight);
          case "EUDR": return sum + asNumber(stock.eudr_declared_weight);
          case "AAA": return sum + asNumber(stock.aaa_declared_weight);
          case "NET ZERO": return sum + asNumber(stock.netzero_declared_weight);
        }
      }, 0);
      const holders = certLots.reduce<Record<string, number>>((acc, stock) => {
        const holder = cert === "RFA" ? stock.rfa_certificate_holder || stock.cooperative || "Unspecified" : cert === "CAFE" ? stock.cafe_certificate_holder || stock.cooperative || "Unspecified" : cert === "EUDR" ? stock.eudr_certificate_holder || stock.cooperative || "Unspecified" : stock.cooperative || "Unspecified";
        acc[holder] = (acc[holder] || 0) + asNumber(stock.purchased_weight);
        return acc;
      }, {});
      const expiringSoon = certLots.filter((stock) => {
        const expiries = [stock.rfa_expiry_date, stock.eudr_expiry_date, stock.cafe_expiry_date, stock.impact_expiry_date].filter(Boolean) as string[];
        return expiries.some((expiry) => {
          const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return days >= 0 && days <= 120;
        });
      }).length;

      return {
        cert,
        totalKg,
        declaredKg,
        balanceKg: totalKg - declaredKg,
        lotCount: certLots.length,
        expiringSoon,
        holders: Object.entries(holders).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6),
      };
    });
  }, [stocks]);

  const trackerSelected = useMemo(() => trackerRows.find((item) => item.cert === trackerCert) ?? trackerRows[0], [trackerRows, trackerCert]);

  const visibleBlends = useMemo(() => {
    const q = blendSearch.trim().toLowerCase();
    return blends.map((blend) => ({ blend, composition: getBlendCompositionRow(blend), linkedContracts: sales.filter((sale) => Number(sale.blend_id) === blend.id) }))
      .filter(({ blend }) => !q || [blend.name, blend.client, blend.grade, blend.cup_profile, blend.blend_no].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [blends, sales, blendSearch]);

  const selectedBlendData = useMemo(() => {
    const blend = selectedBlendId ? blends.find((b) => b.id === selectedBlendId) ?? null : blends[0] ?? null;
    if (!blend) return null;
    return { blend, composition: getBlendCompositionRow(blend), linkedContracts: sales.filter((sale) => Number(sale.blend_id) === blend.id) };
  }, [blends, sales, selectedBlendId]);

  const blendCompositionTotal = useMemo(() => BLEND_COMPONENTS.reduce((sum, comp) => sum + asNumber(blendForm[comp.key]), 0), [blendForm]);
  const blendValidationMessage = useMemo(() => {
    const entered = BLEND_COMPONENTS.some((comp) => asNumber(blendForm[comp.key]) > 0);
    if (!blendCreateOpen || !entered) return "";
    if (Math.abs(blendCompositionTotal - 100) < 0.01) return "";
    return blendCompositionTotal > 100 ? `Blend composition is over 100% (${blendCompositionTotal.toFixed(2)}%). Reduce one or more components.` : `Blend composition is below 100% (${blendCompositionTotal.toFixed(2)}%). Add the remaining percentage before saving.`;
  }, [blendCreateOpen, blendCompositionTotal, blendForm]);

  const physicalRows = physicalData;
  const physicalTop = physicalRows.gridData.slice().sort((a, b) => b.theoretical - a.theoretical)[0];
  const physicalMostShorts = physicalRows.gridData.slice().sort((a, b) => b.shorts - a.shorts)[0];

  const showToast = (message: string, kind: "error" | "success") => setToast({ message, kind });

  async function refreshPhysical() {
    try {
      setPhysicalLoading(true);
      const res = await fetch("/api/physical_stock_position", { cache: "no-store" });
      if (!res.ok) throw new Error("Physical position fetch failed");
      const data = await res.json();
      const rawRows = safeRows(data);
      if (rawRows.length > 0) {
        const rows: PhysicalRow[] = rawRows.map((row: any) => ({
          stack: String(row.stack ?? row.position ?? row.strategy ?? "unassigned"),
          theoretical: asNumber(row.theoretical ?? row.theoretical_volume ?? row.available ?? row.volume ?? row.stock ?? 0),
          months: MONTH_ORDER.reduce((acc, month) => ({ ...acc, [month]: asNumber(row.months?.[month] ?? row[month] ?? row.shipmentsByMonth?.[month] ?? 0) }), {} as Record<string, number>),
          shorts: asNumber(row.shorts ?? row.total_shorts ?? row.totalShorts ?? 0),
          net: asNumber(row.net ?? row.net_position ?? row.netPosition ?? 0),
        }));
        const months = Array.isArray(data?.months) && data.months.length ? data.months : [...MONTH_ORDER];
        const kpis = data?.kpis ? { totalTheoretical: asNumber(data.kpis.totalTheoretical), totalShorts: asNumber(data.kpis.totalShorts), totalNet: asNumber(data.kpis.totalNet) } : buildPhysicalData(rows).kpis;
        setPhysicalData({ gridData: rows, months, kpis });
      } else {
        setPhysicalData(buildPhysicalData(SAMPLE_PHYSICAL));
      }
      showToast("Physical positions refreshed.", "success");
    } catch {
      setPhysicalData(buildPhysicalData(SAMPLE_PHYSICAL));
      showToast("Physical refresh fell back to sample data.", "error");
    } finally {
      setPhysicalLoading(false);
    }
  }

  async function saveBlend() {
    if (!blendForm.name.trim()) {
      showToast("Blend name is required.", "error");
      return;
    }
    if (Math.abs(blendCompositionTotal - 100) > 0.01) {
      showToast(`Blend composition must equal exactly 100%. Current total: ${blendCompositionTotal.toFixed(2)}%.`, "error");
      return;
    }

    try {
      const payload = normalizeBlendForm(blendForm);
      const response = await fetch("/api/blends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to create blend");
      const createdBlend: Blend = { id: data?.id ?? Date.now(), ...payload } as Blend;
      setBlends((prev) => [createdBlend, ...prev]);
      setSelectedBlendId(createdBlend.id);
      setBlendCreateOpen(false);
      setBlendForm({ ...INITIAL_BLEND_FORM });
      showToast("Blend saved successfully.", "success");
    } catch (error: any) {
      showToast(error?.message || "Failed to create blend.", "error");
    }
  }

  async function updateContractBlend(contractId: number, blendId: number | null) {
    const contract = sales.find((sale) => sale.id === contractId);
    if (!contract) return;
    const response = await fetch("/api/contracts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: contractId, quality: contract.quality || contract.strategy || "", grade: contract.grade || "", certifications: parseCerts(contract.certifications), blend_id: blendId }),
    });
    if (!response.ok) throw new Error("Failed to update contract");
    const selected = blends.find((b) => b.id === blendId);
    setSales((prev) => prev.map((sale) => (sale.id === contractId ? { ...sale, blend_id: blendId, blend_name: selected?.name ?? null } : sale)));
  }

  async function saveContractEdit() {
    if (editingContractId === null) return;
    try {
      const response = await fetch("/api/contracts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingContractId, quality: contractEdit.quality, grade: contractEdit.grade, certifications: contractEdit.certifications, blend_id: contractEdit.blend_id === "" ? null : contractEdit.blend_id }),
      });
      if (!response.ok) throw new Error("Failed to update contract");
      const selectedBlendForUpdate = blends.find((b) => b.id === Number(contractEdit.blend_id));
      setSales((prev) => prev.map((sale) => sale.id === editingContractId ? { ...sale, quality: contractEdit.quality, grade: contractEdit.grade, certifications: contractEdit.certifications, blend_id: contractEdit.blend_id === "" ? null : Number(contractEdit.blend_id), blend_name: selectedBlendForUpdate?.name ?? null } : sale));
      setEditingContractId(null);
      showToast("Contract updated.", "success");
    } catch {
      showToast("Failed to save contract changes.", "error");
    }
  }

  async function uploadPurchases() {
    if (!purchaseFile) return;
    try {
      const formData = new FormData();
      formData.append("xbs_file", purchaseFile);
      const res = await fetch("http://localhost:8100/api/xbs_purchase_upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      setUploadOpen(false);
      setPurchaseFile(null);
      showToast("Purchases uploaded successfully.", "success");
    } catch {
      showToast("Purchase upload failed.", "error");
    }
  }

  async function uploadSalesFile() {
    if (!salesFile) return;
    try {
      const formData = new FormData();
      formData.append("sol_file", salesFile);
      const res = await fetch("http://localhost:8100/api/upload_sol_report", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      setUploadOpen(false);
      setSalesFile(null);
      showToast("Sales uploaded successfully.", "success");
    } catch {
      showToast("Sales upload failed.", "error");
    }
  }

  async function saveManualSale(e: React.FormEvent) {
    e.preventDefault();
    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractNumber: manualSale.contract_number, client: manualSale.client, weight: manualSale.weight_kilos, quality: manualSale.quality, grade: manualSale.grade, shippingDate: manualSale.shipping_date, certifications: parseCerts(manualSale.certifications) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to add sale");
      if (data?.sale) setSales((prev) => [...prev, data.sale]);
      setManualSale({ contract_number: "", client: "", weight_kilos: "", quality: "", grade: "", shipping_date: "", certifications: "" });
      setUploadOpen(false);
      showToast("Sale added successfully.", "success");
    } catch {
      showToast("Failed to add sale.", "error");
    }
  }

  async function deleteBlend(blendId: number) {
    const linked = sales.filter((sale) => Number(sale.blend_id) === blendId);
    try {
      if (linked.length > 0) {
        await Promise.all(linked.map((sale) => updateContractBlend(sale.id, null)));
      }
      const previous = blends;
      setBlends((prev) => prev.filter((blend) => blend.id !== blendId));
      if (selectedBlendId === blendId) setSelectedBlendId(null);
      setSales((prev) => prev.map((sale) => (Number(sale.blend_id) === blendId ? { ...sale, blend_id: null, blend_name: null } : sale)));
      const response = await fetch("/api/blends", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: blendId }),
      });
      if (!response.ok && ![404, 405].includes(response.status)) throw new Error("Delete failed");
      showToast("Blend deleted.", "success");
    } catch {
      showToast("Failed to delete blend.", "error");
    }
  }

  function openAddUpload(mode: UploadMode = "purchases") {
    setUploadMode(mode);
    setUploadOpen(true);
  }

  function exportCurrentView(format: "csv" | "excel") {
    let rows: Record<string, any>[] = [];
    let title = "positions";

    if (activeTab === "physical") {
      title = "physical";
      rows = physicalRows.gridData.map((row) => ({
        Stack: stackLabel(row.stack),
        Theoretical: row.theoretical,
        ...Object.fromEntries(MONTH_ORDER.map((m) => [m, row.months[m] ?? 0])),
        Shorts: row.shorts,
        Net: row.net,
      }));
    }

    if (activeTab === "certification") {
      title = `certification-${activeCert}`;
      rows = certificationRows.tableData.map((row) => ({
        Strategy: row.strategy,
        Available: row.available,
        ...Object.fromEntries(certificationRows.months.map((m) => [m, row.shipmentsByMonth[m] || 0])),
        ShipmentTotal: row.totalShipment,
        NetPosition: row.netPosition,
        LinkedLots: row.linkedLots,
        LinkedContracts: row.linkedContracts,
        Tags: row.tags.join(" | "),
      }));
    }

    if (activeTab === "tracker") {
      title = `tracker-${trackerCert}`;
      rows = trackerRows.map((row) => ({
        Cert: row.cert,
        TotalKg: row.totalKg,
        DeclaredKg: row.declaredKg,
        BalanceKg: row.balanceKg,
        LotCount: row.lotCount,
        ExpiringSoon: row.expiringSoon,
        Coverage: row.totalKg > 0 ? ((row.declaredKg / row.totalKg) * 100).toFixed(1) : "0.0",
        Holders: row.holders.map((h) => `${h.name}: ${h.value}`).join(" | "),
      }));
    }

    if (activeTab === "contracts") {
      title = "contracts";
      rows = sales.map((sale) => ({
        Contract: sale.contract_number,
        Client: sale.client || "",
        WeightKg: sale.weight_kilos,
        ShipDate: sale.shipping_date,
        Quality: sale.quality || sale.strategy || "",
        Grade: sale.grade || "",
        Certifications: parseCerts(sale.certifications).join(" | "),
        Blend: sale.blend_name || "",
      }));
    }

    if (activeTab === "blends") {
      title = "blends";
      rows = visibleBlends.map(({ blend, composition, linkedContracts }) => ({
        Name: blend.name,
        Client: blend.client || "",
        BlendNo: blend.blend_no || "",
        Grade: blend.grade || "",
        CupProfile: blend.cup_profile || "",
        Composition: composition.map((c) => `${c.label}: ${c.value}%`).join(" | "),
        CompositionTotal: composition.reduce((s, c) => s + c.value, 0),
        LinkedContracts: linkedContracts.length,
      }));
    }

    if (format === "csv") {
      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("CSV download started.", "success");
      return;
    }

    const html = toExcelHtml(title, rows);
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Excel download started.", "success");
  }

  if (loading) {
    return <div className={`${poppins.className} min-h-screen bg-[#D6D2C4] flex items-center justify-center text-[#51534a] font-bold`}>Loading position data…</div>;
  }

  const trackerCoverage = trackerSelected?.totalKg ? ((trackerSelected.declaredKg / Math.max(1, trackerSelected.totalKg)) * 100).toFixed(1) : "0.0";

  return (
    <main className={`${poppins.className} min-h-screen bg-[#D6D2C4] text-[#51534a]`}>
      <Popup text={toast} onClose={() => setToast(null)} />

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div ref={recordsModalRef} className="w-full max-w-4xl overflow-hidden rounded-2xl bg-[#EFEFE9] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D6D2C4] bg-white px-6 py-4">
              <div>
                <div className="text-lg font-bold text-[#51534a]">Add / Upload Records</div>
                <div className="text-xs text-[#968C83]">Purchases, sales, and manual records</div>
              </div>
              <button onClick={() => setUploadOpen(false)} className="rounded-full p-1.5 text-[#968C83] hover:bg-[#D6D2C4]/30 hover:text-[#51534a]"><X size={18} /></button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-[#D6D2C4] bg-white/60 px-5 py-3">
              {([["purchases", "Purchases"], ["sales", "Sales"], ["manual", "Manual Sale"]] as [UploadMode, string][]).map(([mode, label]) => (
                <Chip key={mode} active={uploadMode === mode} onClick={() => setUploadMode(mode)}>{label}</Chip>
              ))}
            </div>

            <div className="grid gap-0 md:grid-cols-3">
              <div className={`border-b border-[#D6D2C4] p-5 md:border-b-0 md:border-r ${uploadMode === "purchases" ? "bg-white" : "bg-white/60"} space-y-4`}>
                <div className="flex items-center gap-2 text-sm font-bold text-[#51534a]"><CloudUpload size={16} className="text-[#007680]" /> Upload Purchases</div>
                <FileField label="Purchase File" accept=".xls,.xlsx,.csv" file={purchaseFile} onFile={setPurchaseFile} />
                <button onClick={uploadPurchases} disabled={!purchaseFile} className="w-full rounded-lg bg-[#007680] px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50">Upload Purchases</button>
              </div>

              <div className={`border-b border-[#D6D2C4] p-5 md:border-b-0 md:border-r ${uploadMode === "sales" ? "bg-white" : "bg-white/60"} space-y-4`}>
                <div className="flex items-center gap-2 text-sm font-bold text-[#51534a]"><FileSpreadsheet size={16} className="text-[#B9975B]" /> Upload Sales</div>
                <FileField label="Sales File" accept=".xls,.xlsx,.csv" file={salesFile} onFile={setSalesFile} />
                <button onClick={uploadSalesFile} disabled={!salesFile} className="w-full rounded-lg bg-[#51534a] px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50">Upload Sales</button>
              </div>

              <form onSubmit={saveManualSale} className={`space-y-3 p-5 ${uploadMode === "manual" ? "bg-white" : "bg-white/60"}`}>
                <div className="flex items-center gap-2 text-sm font-bold text-[#51534a]"><Plus size={16} className="text-[#007680]" /> Manual Sale</div>
                <input required value={manualSale.contract_number} onChange={(e) => setManualSale((p) => ({ ...p, contract_number: e.target.value }))} placeholder="Contract Number" className="w-full rounded-lg border border-[#D6D2C4] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input value={manualSale.client} onChange={(e) => setManualSale((p) => ({ ...p, client: e.target.value }))} placeholder="Client" className="w-full rounded-lg border border-[#D6D2C4] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input required value={manualSale.weight_kilos} onChange={(e) => setManualSale((p) => ({ ...p, weight_kilos: e.target.value }))} placeholder="Weight (kg)" type="number" className="w-full rounded-lg border border-[#D6D2C4] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input required value={manualSale.shipping_date} onChange={(e) => setManualSale((p) => ({ ...p, shipping_date: e.target.value }))} type="date" className="w-full rounded-lg border border-[#D6D2C4] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input value={manualSale.quality} onChange={(e) => setManualSale((p) => ({ ...p, quality: e.target.value }))} placeholder="Quality" className="w-full rounded-lg border border-[#D6D2C4] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input value={manualSale.grade} onChange={(e) => setManualSale((p) => ({ ...p, grade: e.target.value }))} placeholder="Grade" className="w-full rounded-lg border border-[#D6D2C4] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input value={manualSale.certifications} onChange={(e) => setManualSale((p) => ({ ...p, certifications: e.target.value }))} placeholder="Certifications (comma-separated)" className="w-full rounded-lg border border-[#D6D2C4] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <button type="submit" className="w-full rounded-lg bg-[#007680] px-4 py-2 text-sm font-bold text-white shadow-sm">Save Sale</button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {blendCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-[#EFEFE9] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D6D2C4] bg-white px-6 py-4">
              <div>
                <div className="text-lg font-bold text-[#51534a]">Create New Blend</div>
                <div className="text-xs text-[#968C83]">Composition must equal exactly 100%</div>
              </div>
              <button onClick={() => setBlendCreateOpen(false)} className="rounded-full p-1.5 text-[#968C83] hover:bg-[#D6D2C4]/30 hover:text-[#51534a]"><X size={18} /></button>
            </div>

            <div className="max-h-[calc(90vh-72px)] overflow-y-auto p-5">
              {blendValidationMessage ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
                  {blendValidationMessage}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <input value={blendForm.name} onChange={(e) => setBlendForm((p) => ({ ...p, name: e.target.value }))} placeholder="Blend Name *" className="rounded-lg border border-[#D6D2C4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input value={blendForm.client} onChange={(e) => setBlendForm((p) => ({ ...p, client: e.target.value }))} placeholder="Client" className="rounded-lg border border-[#D6D2C4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input value={blendForm.blend_no} onChange={(e) => setBlendForm((p) => ({ ...p, blend_no: e.target.value }))} placeholder="Blend No." className="rounded-lg border border-[#D6D2C4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input value={blendForm.grade} onChange={(e) => setBlendForm((p) => ({ ...p, grade: e.target.value }))} placeholder="Grade" className="rounded-lg border border-[#D6D2C4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                <input value={blendForm.cup_profile} onChange={(e) => setBlendForm((p) => ({ ...p, cup_profile: e.target.value }))} placeholder="Cup Profile" className="rounded-lg border border-[#D6D2C4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680] md:col-span-2 xl:col-span-4" />
              </div>

              <div className="mt-5 rounded-2xl border border-[#D6D2C4] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[#51534a]">Composition</div>
                  <div className={Math.abs(blendCompositionTotal - 100) < 0.01 ? "font-bold text-[#007680]" : blendCompositionTotal > 100 ? "font-bold text-red-600" : "font-bold text-[#B9975B]"}>{blendCompositionTotal.toFixed(2)}%</div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D6D2C4]"><div className="h-full rounded-full bg-[#007680]" style={{ width: `${Math.min(100, blendCompositionTotal)}%` }} /></div>
                <div className="mt-2 text-xs text-[#968C83]">Composition must equal exactly 100% before saving.</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {BLEND_COMPONENTS.map((comp) => (
                    <div key={comp.key}>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#968C83]">{comp.label}</label>
                      <input type="number" min="0" max="100" step="0.01" value={blendForm[comp.key]} onChange={(e) => setBlendForm((p) => ({ ...p, [comp.key]: e.target.value }))} className="w-full rounded-lg border border-[#D6D2C4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button onClick={() => setBlendCreateOpen(false)} className="rounded-lg border border-[#D6D2C4] bg-white px-4 py-2 text-sm font-bold text-[#51534a]">Cancel</button>
                <button onClick={saveBlend} disabled={!blendForm.name.trim() || Math.abs(blendCompositionTotal - 100) > 0.01} className="rounded-lg bg-[#007680] px-5 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50">Save Blend</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#007680] text-white shadow-sm"><ShieldCheck size={20} /></div>
              <div>
                <h1 className="text-2xl font-bold text-[#51534a]">Positions</h1>
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-3" ref={downloadWrapRef}>
            <div className="flex items-center rounded-lg border border-[#968C83]/20 bg-white p-1 shadow-sm">
              {(["kg", "bag", "mt"] as Unit[]).map((u) => (
                <button key={u} onClick={() => setUnit(u)} className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${unit === u ? "bg-[#007680] text-white shadow-sm" : "text-[#968C83] hover:bg-[#D6D2C4]/30"}`}>{u.toUpperCase()}</button>
              ))}
            </div>
            <div className="relative">
              <button onClick={() => setDownloadOpen((prev) => !prev)} className="flex items-center gap-2 rounded-lg border border-[#968C83]/20 bg-white px-4 py-2 text-sm font-bold text-[#51534a] shadow-sm hover:bg-[#F5F5F3]"><Download size={16} /> Download</button>
              <ExportMenu open={downloadOpen} onDownload={exportCurrentView} />
            </div>
            <button onClick={() => openAddUpload("purchases")} className="flex items-center gap-2 rounded-lg bg-[#007680] px-4 py-2 text-sm font-bold text-white shadow-sm"><Upload size={16} /> Add / Upload</button>
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-[#968C83]/30">
          <button onClick={() => setActiveTab("physical")} className={`flex items-center gap-2 whitespace-nowrap border-b-4 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "physical" ? "border-[#007680] text-[#007680]" : "border-transparent text-[#968C83] hover:border-[#968C83]/30 hover:text-[#51534a]"}`}><Box size={16} /> Physical</button>
          <button onClick={() => setActiveTab("certification")} className={`flex items-center gap-2 whitespace-nowrap border-b-4 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "certification" ? "border-[#007680] text-[#007680]" : "border-transparent text-[#968C83] hover:border-[#968C83]/30 hover:text-[#51534a]"}`}><FileText size={16} /> Certification</button>
          <button onClick={() => setActiveTab("tracker")} className={`flex items-center gap-2 whitespace-nowrap border-b-4 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "tracker" ? "border-[#007680] text-[#007680]" : "border-transparent text-[#968C83] hover:border-[#968C83]/30 hover:text-[#51534a]"}`}><Users size={16} /> Certification Tracker</button>
          <button onClick={() => setActiveTab("contracts")} className={`flex items-center gap-2 whitespace-nowrap border-b-4 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "contracts" ? "border-[#007680] text-[#007680]" : "border-transparent text-[#968C83] hover:border-[#968C83]/30 hover:text-[#51534a]"}`}><FileSpreadsheet size={16} /> Contracts</button>
          <button onClick={() => setActiveTab("blends")} className={`flex items-center gap-2 whitespace-nowrap border-b-4 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "blends" ? "border-[#007680] text-[#007680]" : "border-transparent text-[#968C83] hover:border-[#968C83]/30 hover:text-[#51534a]"}`}><Combine size={16} /> Blends</button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard title={activeTab === "certification" ? `${activeCert} Total Stock` : activeTab === "physical" ? "Physical Theoretical Stock" : activeTab === "tracker" ? `${trackerCert} Stock Position` : "Total Sales"} value={activeTab === "certification" ? formatQty(certificationRows.kpis.stock, unit) : activeTab === "physical" ? formatQty(physicalRows.kpis.totalTheoretical, unit) : activeTab === "tracker" ? formatQty(trackerSelected?.totalKg ?? 0, unit) : formatQty(sales.reduce((s, sale) => s + asNumber(sale.weight_kilos), 0), unit)} subtitle="Displayed in selected unit" />
          <MetricCard title={activeTab === "certification" ? `${activeCert} Shorts` : activeTab === "physical" ? "Physical Shorts" : activeTab === "tracker" ? `${trackerCert} Coverage` : "Linked Blends"} value={activeTab === "certification" ? formatQty(certificationRows.kpis.shorts, unit) : activeTab === "physical" ? formatQty(physicalRows.kpis.totalShorts, unit) : activeTab === "tracker" ? trackerCoverage + "%" : String(sales.filter((s) => s.blend_id).length)} tone={activeTab === "certification" || activeTab === "physical" ? "warn" : "default"} subtitle="Filtered from current view" />
          <MetricCard title={activeTab === "certification" ? `${activeCert} Net Position` : activeTab === "physical" ? "Physical Net Position" : activeTab === "tracker" ? `${trackerCert} Focused Balance` : "Open Contracts"} value={activeTab === "certification" ? formatQty(certificationRows.kpis.net, unit) : activeTab === "physical" ? formatQty(physicalRows.kpis.totalNet, unit) : activeTab === "tracker" ? formatQty(trackerSelected?.balanceKg ?? 0, unit) : String(sales.filter((s) => !s.blend_id).length)} tone="good" subtitle="Positive or negative balance" />
          <MetricCard title="Current Unit" value={unitText(unit)} subtitle="Applies across the page" />
        </div>

        {activeTab === "physical" && (
          <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <SectionCard title="Physical Stock Position" subtitle="Theoretical, shorts, and net balances" right={<button onClick={refreshPhysical} disabled={physicalLoading} className="rounded-lg bg-[#007680] px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50">{physicalLoading ? "Refreshing..." : "Refresh Physical"}</button>}>
              {physicalRows.gridData.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D6D2C4] bg-[#F5F5F3] p-10 text-center text-sm text-[#968C83]">
                  No physical stock position has been loaded yet. Click Refresh Physical to fetch the current data.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[1100px] w-full text-sm">
                    <thead className="sticky top-0 bg-[#51534a] text-xs uppercase tracking-wider text-white">
                      <tr>
                        <th className="px-4 py-3 text-left">Post Stack</th>
                        <th className="px-4 py-3 text-right">Theoretical ({unitText(unit)})</th>
                        {physicalRows.months.map((m) => <th key={m} className="px-4 py-3 text-right">{m}</th>)}
                        <th className="px-4 py-3 text-right">Total Shorts</th>
                        <th className="px-4 py-3 text-right">Net Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {physicalRows.gridData.map((row, idx) => (
                        <tr key={row.stack} className={idx % 2 === 0 ? "bg-white" : "bg-[#FCF7EA]"}>
                          <td className="px-4 py-3 font-medium text-[#007680]">{stackLabel(row.stack)}</td>
                          <td className="px-4 py-3 text-right font-bold">{formatQty(row.theoretical, unit)}</td>
                          {physicalRows.months.map((m) => <td key={m} className="px-4 py-3 text-right text-[#968C83]">{row.months[m] ? formatQty(row.months[m], unit) : "-"}</td>)}
                          <td className="px-4 py-3 text-right font-medium text-[#5B3427]">{formatQty(row.shorts, unit)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${row.net >= 0 ? "text-[#007680]" : "text-[#B9975B]"}`}>{row.net > 0 ? "+" : ""}{formatQty(row.net, unit)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#EFEFE9] font-bold text-[#51534a]">
                      <tr>
                        <td className="px-4 py-3">TOTALS</td>
                        <td className="px-4 py-3 text-right">{formatQty(physicalRows.kpis.totalTheoretical, unit)}</td>
                        {physicalRows.months.map((m) => <td key={m} className="px-4 py-3 text-right">{formatQty(physicalRows.gridData.reduce((s, r) => s + (r.months[m] || 0), 0), unit)}</td>)}
                        <td className="px-4 py-3 text-right">{formatQty(physicalRows.kpis.totalShorts, unit)}</td>
                        <td className={`px-4 py-3 text-right ${physicalRows.kpis.totalNet >= 0 ? "text-[#007680]" : "text-[#B9975B]"}`}>{physicalRows.kpis.totalNet > 0 ? "+" : ""}{formatQty(physicalRows.kpis.totalNet, unit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Physical Insights" subtitle="Quick operational readout">
                <div className="space-y-3 text-sm text-[#51534a]">
                  <div className="flex justify-between"><span>Largest stack</span><span className="font-bold">{physicalTop?.stack ? stackLabel(physicalTop.stack) : "—"}</span></div>
                  <div className="flex justify-between"><span>Most shorts</span><span className="font-bold">{physicalMostShorts?.stack ? stackLabel(physicalMostShorts.stack) : "—"}</span></div>
                  <div className="flex justify-between"><span>Positive stacks</span><span className="font-bold">{physicalRows.gridData.filter((r) => r.net >= 0).length}</span></div>
                  <div className="flex justify-between"><span>Negative stacks</span><span className="font-bold">{physicalRows.gridData.filter((r) => r.net < 0).length}</span></div>
                </div>
              </SectionCard>
              <SectionCard title="Physical Data Status" subtitle="Refresh is safe against bad API shapes">
                <div className="text-sm leading-6 text-[#968C83]">The refresh flow normalizes values and falls back to sample data if the API response is incomplete or uses unexpected field types, preventing NaN issues on reload.</div>
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === "certification" && (
          <div className="grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
            <SectionCard title="Certification Position" subtitle={`Viewing ${activeCert} positions and certification-linked sales`}>
              <div className="mb-4 flex flex-wrap gap-2">{CERT_FILTERS.map((cert) => <Chip key={cert} active={activeCert === cert} onClick={() => setActiveCert(cert)}>{cert}</Chip>)}</div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
                <MetricCard title="Certified Stock" value={formatQty(certificationRows.kpis.stock, unit)} subtitle="Current certification-linked stock" />
                <MetricCard title="Linked Sales" value={formatQty(certificationRows.kpis.shorts, unit)} tone="warn" subtitle="Sales carrying the selected certification" />
                <MetricCard title="Net Position" value={formatQty(certificationRows.kpis.net, unit)} tone="good" subtitle="Stock minus linked sales" />
                <MetricCard title="Coverage" value={certificationRows.kpis.stock > 0 ? `${((certificationRows.kpis.shorts / certificationRows.kpis.stock) * 100).toFixed(1)}%` : "0.0%"} subtitle="Sales as a share of stock" />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1150px] w-full text-sm">
                  <thead className="sticky top-0 bg-[#51534a] text-xs uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-4 py-3 text-left">Strategy</th>
                      <th className="px-4 py-3 text-right">Available ({unitText(unit)})</th>
                      {certificationRows.months.map((month) => <th key={month} className="px-4 py-3 text-right">{month}</th>)}
                      <th className="px-4 py-3 text-right">Shipment Total</th>
                      <th className="px-4 py-3 text-right">Net Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificationRows.tableData.length > 0 ? certificationRows.tableData.map((row, idx) => (
                      <tr key={row.strategy} className={idx % 2 === 0 ? "bg-white" : "bg-[#FCF7EA]"}>
                        <td className="px-4 py-3 font-medium text-[#007680]"><span className="inline-flex items-center gap-2"><ChevronRight size={14} className="text-[#968C83]" />{row.strategy}</span></td>
                        <td className="px-4 py-3 text-right font-bold">{formatQty(row.available, unit)}</td>
                        {certificationRows.months.map((month) => <td key={month} className="px-4 py-3 text-right text-[#968C83]">{row.shipmentsByMonth[month] ? formatQty(row.shipmentsByMonth[month], unit) : "-"}</td>)}
                        <td className="px-4 py-3 text-right font-medium text-[#5B3427]">{formatQty(row.totalShipment, unit)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${row.netPosition >= 0 ? "text-[#007680]" : "text-[#B9975B]"}`}>{row.netPosition > 0 ? "+" : ""}{formatQty(row.netPosition, unit)}</td>
                      </tr>
                    )) : <tr><td colSpan={certificationRows.months.length + 4} className="px-4 py-8 text-center italic text-[#968C83]">No certification rows found.</td></tr>}
                  </tbody>
                  <tfoot className="bg-[#EFEFE9] font-bold text-[#51534a]">
                    <tr>
                      <td className="px-4 py-3">TOTALS</td>
                      <td className="px-4 py-3 text-right">{formatQty(certificationRows.kpis.stock, unit)}</td>
                      {certificationRows.months.map((month) => <td key={month} className="px-4 py-3 text-right">{formatQty(certificationRows.tableData.reduce((sum, r) => sum + (r.shipmentsByMonth[month] || 0), 0), unit)}</td>)}
                      <td className="px-4 py-3 text-right">{formatQty(certificationRows.kpis.shorts, unit)}</td>
                      <td className={`px-4 py-3 text-right ${certificationRows.kpis.net >= 0 ? "text-[#007680]" : "text-[#B9975B]"}`}>{certificationRows.kpis.net > 0 ? "+" : ""}{formatQty(certificationRows.kpis.net, unit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Certification Links" subtitle="Linked stock lots and linked contracts for the active certification" right={<span className="rounded-full bg-[#A4DBE8]/30 px-3 py-1 text-xs font-bold text-[#007680]">{activeCert}</span>}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-[#F5F5F3] p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-[#968C83]">Stock lots</div><div className="mt-1 text-xl font-bold text-[#51534a]">{activeCertLots.length}</div></div>
                  <div className="rounded-2xl bg-[#F5F5F3] p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-[#968C83]">Contracts</div><div className="mt-1 text-xl font-bold text-[#51534a]">{activeCertContracts.length}</div></div>
                  <div className="rounded-2xl bg-[#F5F5F3] p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-[#968C83]">Coverage</div><div className="mt-1 text-xl font-bold text-[#007680]">{certInsights.coverage.toFixed(1)}%</div></div>
                  <div className="rounded-2xl bg-[#F5F5F3] p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-[#968C83]">Net</div><div className={`mt-1 text-xl font-bold ${certificationRows.kpis.net >= 0 ? "text-[#007680]" : "text-[#B9975B]"}`}>{certificationRows.kpis.net > 0 ? "+" : ""}{formatQty(certificationRows.kpis.net, unit)}</div></div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#968C83]">Linked lots</div>
                  <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {activeCertLots.length > 0 ? activeCertLots.map((lot) => (
                      <div key={lot.id} className="rounded-xl border border-[#D6D2C4] bg-[#F5F5F3] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-[#007680]">{lot.lot_number}</div>
                            <div className="text-xs text-[#968C83]">{lot.cooperative || lot.strategy || "Unassigned"}</div>
                          </div>
                          <div className="text-xs font-bold text-[#51534a]">{formatQty(asNumber(lot.purchased_weight), unit)} {unitText(unit)}</div>
                        </div>
                        <div className="mt-1 text-[11px] text-[#51534a]">Holder: <span className="font-semibold">{activeCert === "RFA" ? lot.rfa_certificate_holder || "—" : activeCert === "CAFE" ? lot.cafe_certificate_holder || "—" : activeCert === "EUDR" ? lot.eudr_certificate_holder || "—" : lot.cooperative || "—"}</span></div>
                      </div>
                    )) : <div className="text-sm italic text-[#968C83]">No linked lots for this certification.</div>}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#968C83]">Linked contracts</div>
                  <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                    {activeCertContracts.length > 0 ? activeCertContracts.map((sale) => (
                      <div key={sale.id} className="rounded-xl border border-[#D6D2C4] bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-bold text-[#007680]">{sale.contract_number}</div>
                            <div className="text-xs text-[#968C83]">{sale.client || "No client"} · {sale.strategy || sale.quality || "Unassigned"}</div>
                          </div>
                          <div className="text-xs font-bold text-[#51534a]">{formatQty(asNumber(sale.weight_kilos), unit)} {unitText(unit)}</div>
                        </div>
                      </div>
                    )) : <div className="text-sm italic text-[#968C83]">No contracts linked to this certification.</div>}
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === "tracker" && (
          <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <SectionCard title="Certification Tracker" subtitle="Position, coverage, and focused balance by certification">
              <div className="mb-4 flex flex-wrap gap-2">{trackerRows.map((item) => <Chip key={item.cert} active={trackerCert === item.cert} onClick={() => setTrackerCert(item.cert)}>{item.cert}</Chip>)}</div>

              <div className="grid gap-4 sm:grid-cols-2">
                {trackerRows.map((item) => (
                  <button key={item.cert} type="button" onClick={() => setTrackerCert(item.cert)} className={`text-left rounded-2xl border p-4 transition ${trackerCert === item.cert ? "border-[#007680] bg-[#EAF8FA]" : "border-slate-200 bg-white hover:border-[#007680]/30"}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-[#51534a]">{item.cert}</div>
                      <div className="text-xs font-bold text-[#968C83]">{item.lotCount} lots</div>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-[#007680]">{formatQty(item.totalKg, unit)}</div>
                    <div className="mt-1 text-xs text-[#968C83]">Coverage {item.totalKg > 0 ? ((item.declaredKg / item.totalKg) * 100).toFixed(1) : "0.0"}%</div>
                    <div className="mt-1 text-xs text-[#968C83]">Focused balance {formatQty(item.balanceKg, unit)}</div>
                    <div className="mt-3 h-2 rounded-full bg-[#D6D2C4]"><div className="h-2 rounded-full bg-[#007680]" style={{ width: `${Math.min(100, item.totalKg ? (item.declaredKg / item.totalKg) * 100 : 0)}%` }} /></div>
                  </button>
                ))}
              </div>
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title={`${trackerSelected?.cert ?? trackerCert} Holder Concentration`} subtitle="Top certificate holders by selected certification">
                <div className="space-y-3">
                  {trackerSelected?.holders.length ? trackerSelected.holders.map((holder) => (
                    <div key={holder.name} className="rounded-xl border border-[#D6D2C4] bg-[#F5F5F3] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[#51534a]">{holder.name}</div>
                          <div className="text-[11px] text-[#968C83]">{formatQty(holder.value, unit)} {unitText(unit)}</div>
                        </div>
                        <div className="text-xs font-bold text-[#007680]">{trackerSelected?.totalKg ? ((holder.value / trackerSelected.totalKg) * 100).toFixed(1) : "0.0"}%</div>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-[#D6D2C4]"><div className="h-2 rounded-full bg-[#007680]" style={{ width: `${trackerSelected?.totalKg ? Math.min(100, (holder.value / trackerSelected.totalKg) * 100) : 0}%` }} /></div>
                    </div>
                  )) : <div className="text-sm italic text-[#968C83]">No holder data available.</div>}
                </div>
              </SectionCard>

              <SectionCard title="Expiry and Coverage Overview" subtitle="Useful certification risk snapshot">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span>Total lots</span><span className="font-bold">{trackerSelected?.lotCount ?? 0}</span></div>
                  <div className="flex justify-between text-sm"><span>Expiring in 120 days</span><span className="font-bold">{trackerSelected?.expiringSoon ?? 0}</span></div>
                  <div className="flex justify-between text-sm"><span>Total certified volume</span><span className="font-bold">{formatQty(trackerSelected?.totalKg ?? 0, unit)} {unitText(unit)}</span></div>
                  <div className="rounded-xl bg-[#EAF8FA] p-3 text-xs text-[#007680]">This tab carries the certificate-holder view, concentration bars, position, coverage, and focused balance.</div>
                </div>
              </SectionCard>

              <SectionCard title="Certified Stock Tracker Data" subtitle="Full records from certified_stock_tracker">
                <div className="mx-auto max-h-[340px] max-w-full overflow-auto rounded-xl border border-[#D6D2C4]">
                  <table className="min-w-[1900px] w-full text-xs">
                    <thead className="sticky top-0 bg-[#51534a] text-white">
                      <tr>
                        <th className="px-3 py-2 text-left">Season</th>
                        <th className="px-3 py-2 text-left">Sale Type</th>
                        <th className="px-3 py-2 text-left">Outturn</th>
                        <th className="px-3 py-2 text-left">Lot</th>
                        <th className="px-3 py-2 text-left">Strategy</th>
                        <th className="px-3 py-2 text-left">Cooperative</th>
                        <th className="px-3 py-2 text-left">Wet Mill</th>
                        <th className="px-3 py-2 text-left">County</th>
                        <th className="px-3 py-2 text-left">Grade</th>
                        <th className="px-3 py-2 text-left">Grower</th>
                        <th className="px-3 py-2 text-right">Purchased</th>
                        <th className="px-3 py-2 text-center">RFA</th>
                        <th className="px-3 py-2 text-center">RFA Expiry</th>
                        <th className="px-3 py-2 text-center">RFA Holder</th>
                        <th className="px-3 py-2 text-right">RFA Decl.</th>
                        <th className="px-3 py-2 text-center">EUDR</th>
                        <th className="px-3 py-2 text-center">EUDR Expiry</th>
                        <th className="px-3 py-2 text-center">EUDR Holder</th>
                        <th className="px-3 py-2 text-right">EUDR Decl.</th>
                        <th className="px-3 py-2 text-center">CAFE</th>
                        <th className="px-3 py-2 text-center">CAFE Expiry</th>
                        <th className="px-3 py-2 text-center">CAFE Holder</th>
                        <th className="px-3 py-2 text-right">CAFE Decl.</th>
                        <th className="px-3 py-2 text-center">Impact</th>
                        <th className="px-3 py-2 text-center">Impact Expiry</th>
                        <th className="px-3 py-2 text-right">Impact Decl.</th>
                        <th className="px-3 py-2 text-center">AAA</th>
                        <th className="px-3 py-2 text-right">AAA Vol.</th>
                        <th className="px-3 py-2 text-center">Geo</th>
                        <th className="px-3 py-2 text-right">AAA Decl.</th>
                        <th className="px-3 py-2 text-center">Net Zero</th>
                        <th className="px-3 py-2 text-right">Net Zero Decl.</th>
                        <th className="px-3 py-2 text-center">Fully Declared</th>
                        <th className="px-3 py-2 text-left">Recorded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map((row, idx) => (
                        <tr key={row.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#FCF7EA]"}>
                          <td className="px-3 py-2">{row.season || "-"}</td>
                          <td className="px-3 py-2">{row.sale_type || "-"}</td>
                          <td className="px-3 py-2">{row.outturn || "-"}</td>
                          <td className="px-3 py-2 font-bold text-[#007680]">{row.lot_number}</td>
                          <td className="px-3 py-2">{row.strategy || "-"}</td>
                          <td className="px-3 py-2">{row.cooperative || "-"}</td>
                          <td className="px-3 py-2">{row.wet_mill || "-"}</td>
                          <td className="px-3 py-2">{row.county || "-"}</td>
                          <td className="px-3 py-2">{row.grade || "-"}</td>
                          <td className="px-3 py-2">{row.grower_code || "-"}</td>
                          <td className="px-3 py-2 text-right font-bold">{formatQty(asNumber(row.purchased_weight), unit)}</td>
                          <td className="px-3 py-2 text-center">{bool(row.rfa_certified) ? "Yes" : "No"}</td>
                          <td className="px-3 py-2 text-center">{row.rfa_expiry_date || "-"}</td>
                          <td className="px-3 py-2 text-center">{row.rfa_certificate_holder || "-"}</td>
                          <td className="px-3 py-2 text-right">{row.rfa_declared_weight != null ? asNumber(row.rfa_declared_weight) : "-"}</td>
                          <td className="px-3 py-2 text-center">{bool(row.eudr_certified) ? "Yes" : "No"}</td>
                          <td className="px-3 py-2 text-center">{row.eudr_expiry_date || "-"}</td>
                          <td className="px-3 py-2 text-center">{row.eudr_certificate_holder || "-"}</td>
                          <td className="px-3 py-2 text-right">{row.eudr_declared_weight != null ? asNumber(row.eudr_declared_weight) : "-"}</td>
                          <td className="px-3 py-2 text-center">{bool(row.cafe_certified) ? "Yes" : "No"}</td>
                          <td className="px-3 py-2 text-center">{row.cafe_expiry_date || "-"}</td>
                          <td className="px-3 py-2 text-center">{row.cafe_certificate_holder || "-"}</td>
                          <td className="px-3 py-2 text-right">{row.cafe_declared_weight != null ? asNumber(row.cafe_declared_weight) : "-"}</td>
                          <td className="px-3 py-2 text-center">{bool(row.impact_certified) ? "Yes" : "No"}</td>
                          <td className="px-3 py-2 text-center">{row.impact_expiry_date || "-"}</td>
                          <td className="px-3 py-2 text-right">{row.impact_declared_weight != null ? asNumber(row.impact_declared_weight) : "-"}</td>
                          <td className="px-3 py-2 text-center">{bool(row.aaa_project) ? "Yes" : "No"}</td>
                          <td className="px-3 py-2 text-right">{row.aaa_volume != null ? asNumber(row.aaa_volume) : "-"}</td>
                          <td className="px-3 py-2 text-center">{bool(row.geodata_available) ? "Yes" : "No"}</td>
                          <td className="px-3 py-2 text-right">{row.aaa_declared_weight != null ? asNumber(row.aaa_declared_weight) : "-"}</td>
                          <td className="px-3 py-2 text-center">{bool(row.netzero_project) ? "Yes" : "No"}</td>
                          <td className="px-3 py-2 text-right">{row.netzero_declared_weight != null ? asNumber(row.netzero_declared_weight) : "-"}</td>
                          <td className="px-3 py-2 text-center">{bool(row.fully_declared) ? "Yes" : "No"}</td>
                          <td className="px-3 py-2">{row.recorded_date || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === "contracts" && (
          <SectionCard title="Contracts" subtitle="Edit certifications and blend allocations directly from the table" right={<button onClick={() => openAddUpload("sales")} className="rounded-lg bg-[#007680] px-4 py-2 text-sm font-bold text-white shadow-sm"><Plus size={16} className="mr-2 inline-block" />Add Sales</button>}>
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full text-sm">
                <thead className="bg-[#51534a] text-xs uppercase tracking-wider text-white">
                  <tr>
                    <th className="px-4 py-3 text-left">Contract</th>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-right">Weight ({unitText(unit)})</th>
                    <th className="px-4 py-3 text-left">Ship Date</th>
                    <th className="px-4 py-3 text-left">Quality</th>
                    <th className="px-4 py-3 text-left">Grade</th>
                    <th className="px-4 py-3 text-left">Certifications</th>
                    <th className="px-4 py-3 text-left">Blend</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale, idx) => {
                    const editing = editingContractId === sale.id;
                    return (
                      <tr key={sale.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#FCF7EA]"}>
                        <td className="px-4 py-3 font-bold text-[#007680]">{sale.contract_number}</td>
                        <td className="px-4 py-3">{sale.client || "-"}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatQty(asNumber(sale.weight_kilos), unit)}</td>
                        <td className="px-4 py-3 text-[#968C83]">{formatMonth(sale.shipping_date)}</td>
                        <td className="px-4 py-3">{editing ? <input value={contractEdit.quality} onChange={(e) => setContractEdit((p) => ({ ...p, quality: e.target.value }))} className="w-full rounded-lg border border-[#D6D2C4] px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#007680]" /> : <span>{sale.quality || sale.strategy || "-"}</span>}</td>
                        <td className="px-4 py-3">{editing ? <input value={contractEdit.grade} onChange={(e) => setContractEdit((p) => ({ ...p, grade: e.target.value }))} className="w-full rounded-lg border border-[#D6D2C4] px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#007680]" /> : <span>{sale.grade || "-"}</span>}</td>
                        <td className="px-4 py-3">
                          {editing ? (
                            <div className="min-w-[220px] space-y-2">
                              <select value="" onChange={(e) => { const val = e.target.value; if (val === "UNCERTIFIED") setContractEdit((p) => ({ ...p, certifications: [] })); else if (val && !contractEdit.certifications.includes(val)) setContractEdit((p) => ({ ...p, certifications: [...p.certifications, val] })); }} className="w-full rounded-lg border border-[#D6D2C4] px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#007680]">
                                <option value="" disabled>Add certification…</option>
                                <option value="UNCERTIFIED">Uncertified (Clear All)</option>
                                {CERT_FILTERS.map((c) => <option key={c} value={c} disabled={contractEdit.certifications.includes(c)}>{c}</option>)}
                              </select>
                              <div className="flex flex-wrap gap-1">{contractEdit.certifications.map((cert) => <span key={cert} className="inline-flex items-center gap-1 rounded-full bg-[#A4DBE8]/30 px-2 py-1 text-[10px] font-bold text-[#007680]"><button type="button" onClick={() => setContractEdit((p) => ({ ...p, certifications: p.certifications.filter((c) => c !== cert) }))} className="leading-none">×</button>{cert}</span>)}</div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">{parseCerts(sale.certifications).length ? parseCerts(sale.certifications).map((cert) => <span key={cert} className="rounded-full bg-[#D6D2C4]/30 px-2 py-0.5 text-[10px] font-bold text-[#51534a]">{cert}</span>) : <span className="text-xs italic text-[#968C83]">Uncertified</span>}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">{editing ? <select value={contractEdit.blend_id} onChange={(e) => setContractEdit((p) => ({ ...p, blend_id: e.target.value ? Number(e.target.value) : "" }))} className="w-full rounded-lg border border-[#D6D2C4] px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#007680]"><option value="">No Blend</option>{blends.map((blend) => <option key={blend.id} value={blend.id}>{blend.name}</option>)}</select> : <span>{sale.blend_name || <span className="italic text-[#968C83]">Unassigned</span>}</span>}</td>
                        <td className="px-4 py-3 text-center">
                          {editing ? (
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={saveContractEdit} className="rounded-lg bg-[#007680] p-1.5 text-white shadow-sm"><Check size={14} /></button>
                              <button onClick={() => setEditingContractId(null)} className="rounded-lg bg-[#B9975B] p-1.5 text-white shadow-sm"><X size={14} /></button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingContractId(sale.id); setContractEdit({ quality: sale.quality || sale.strategy || "", grade: sale.grade || "", certifications: parseCerts(sale.certifications), blend_id: sale.blend_id || "" }); }} className="rounded-lg p-1.5 text-[#007680] hover:bg-[#007680]/10"><Pencil size={14} /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {activeTab === "blends" && (
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard title="Blend Directory" right={<button onClick={() => setBlendCreateOpen(true)} className="rounded-lg bg-[#007680] px-4 py-2 text-sm font-bold text-white shadow-sm"><Plus size={16} className="mr-2 inline-block" />Create Blend</button>}>
              <div className="relative mb-4">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#968C83]" />
                <input value={blendSearch} onChange={(e) => setBlendSearch(e.target.value)} placeholder="Search blends by name, client, grade, blend no." className="w-full rounded-lg border border-[#D6D2C4] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#007680]" />
              </div>
              <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {visibleBlends.length > 0 ? visibleBlends.map(({ blend, composition, linkedContracts }) => {
                  const selected = selectedBlendData?.blend.id === blend.id;
                  const totalComp = composition.reduce((sum, c) => sum + c.value, 0);
                  return (
                    <button key={blend.id} type="button" onClick={() => setSelectedBlendId(blend.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-[#007680] bg-[#EAF8FA]" : "border-[#D6D2C4] bg-white hover:border-[#007680]/30"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 font-bold text-[#007680]"><ChevronRight size={14} className={selected ? "rotate-90 transition" : "transition"} />{blend.name}</div>
                          <div className="mt-1 text-xs text-[#968C83]">{blend.client || "-"} · {blend.blend_no || "-"} · {blend.grade || "-"}</div>
                          <div className="mt-1 text-xs text-[#51534a]">{blend.cup_profile || "No cup profile"}</div>
                        </div>
                        <div className="text-right text-xs">
                          <div className="font-bold text-[#51534a]">{linkedContracts.length} contracts</div>
                          <div className="text-[#968C83]">{composition.length} non-zero components</div>
                          <div className={Math.abs(totalComp - 100) < 0.01 ? "font-bold text-[#007680]" : totalComp > 100 ? "font-bold text-red-600" : "font-bold text-[#B9975B]"}>{totalComp.toFixed(2)}%</div>
                        </div>
                      </div>
                    </button>
                  );
                }) : <div className="py-8 text-center text-sm italic text-[#968C83]">No blends found.</div>}
              </div>
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Blend Composition" subtitle="Only non-zero post stacks are shown here">
                {selectedBlendData ? (
                  <div className="space-y-4">
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between"><span>Blend name</span><span className="font-bold">{selectedBlendData.blend.name}</span></div>
                      <div className="flex justify-between"><span>Client</span><span className="font-bold">{selectedBlendData.blend.client || "-"}</span></div>
                      <div className="flex justify-between"><span>Blend no.</span><span className="font-bold">{selectedBlendData.blend.blend_no || "-"}</span></div>
                      <div className="flex justify-between"><span>Linked contracts</span><span className="font-bold">{selectedBlendData.linkedContracts.length}</span></div>
                    </div>

                    <div className="rounded-2xl border border-[#D6D2C4] bg-[#F5F5F3] p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-[#51534a]">Composition total</div>
                        <div className={Math.abs(selectedBlendData.composition.reduce((s, c) => s + c.value, 0) - 100) < 0.01 ? "font-bold text-[#007680]" : selectedBlendData.composition.reduce((s, c) => s + c.value, 0) > 100 ? "font-bold text-red-600" : "font-bold text-[#B9975B]"}>{selectedBlendData.composition.reduce((s, c) => s + c.value, 0).toFixed(2)}%</div>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D6D2C4]"><div className="h-full rounded-full bg-[#007680]" style={{ width: `${Math.min(100, selectedBlendData.composition.reduce((s, c) => s + c.value, 0))}%` }} /></div>
                      <div className="mt-2 text-xs text-[#968C83]">Only non-zero post stacks are listed.</div>
                    </div>

                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {selectedBlendData.composition.length > 0 ? selectedBlendData.composition.map((comp) => (
                        <div key={comp.key} className="rounded-xl border border-[#D6D2C4] bg-white px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-bold text-[#007680]">{comp.label}</div>
                              <div className="text-xs text-[#968C83]">Post stack</div>
                            </div>
                            <div className="text-right"><div className="text-sm font-bold text-[#51534a]">{comp.value.toFixed(2)}%</div></div>
                          </div>
                        </div>
                      )) : <div className="text-sm italic text-[#968C83]">No non-zero post stacks in this blend.</div>}
                    </div>

                    <div className="rounded-2xl border border-[#D6D2C4] bg-white p-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#968C83]">Linked contracts</div>
                      <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                        {selectedBlendData.linkedContracts.length > 0 ? selectedBlendData.linkedContracts.map((sale) => (
                          <div key={sale.id} className="rounded-xl border border-[#D6D2C4] bg-[#F5F5F3] px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-sm font-bold text-[#007680]">{sale.contract_number}</div>
                                <div className="text-xs text-[#968C83]">{sale.client || "-"} · {sale.strategy || sale.quality || "Unassigned"}</div>
                              </div>
                              <div className="text-xs font-bold text-[#51534a]">{formatQty(asNumber(sale.weight_kilos), unit)} {unitText(unit)}</div>
                            </div>
                          </div>
                        )) : <div className="text-sm italic text-[#968C83]">No contracts allocated to this blend.</div>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button onClick={() => selectedBlendData && deleteBlend(selectedBlendData.blend.id)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50" disabled={selectedBlendData.linkedContracts.length > 0}>Delete Blend</button>
                      <div className="flex items-center gap-2">
                        <select value={blendAllocContractId} onChange={(e) => setBlendAllocContractId(e.target.value ? Number(e.target.value) : "")} className="rounded-lg border border-[#D6D2C4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#007680]">
                          <option value="">Select contract</option>
                          {sales.filter((s) => !s.blend_id || Number(s.blend_id) !== selectedBlendData.blend.id).map((sale) => <option key={sale.id} value={sale.id}>{sale.contract_number}</option>)}
                        </select>
                        <button
                          onClick={async () => {
                            if (blendAllocContractId !== "") {
                              setBlendBusy(true);
                              try {
                                await updateContractBlend(Number(blendAllocContractId), selectedBlendData.blend.id);
                                setBlendAllocContractId("");
                                showToast("Contract allocated to blend.", "success");
                              } catch {
                                showToast("Failed to allocate contract to blend.", "error");
                              } finally {
                                setBlendBusy(false);
                              }
                            }
                          }}
                          className="rounded-lg bg-[#007680] px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                          disabled={blendAllocContractId === "" || blendBusy}
                        >
                          Allocate
                        </button>
                      </div>
                    </div>
                  </div>
                ) : <div className="text-sm italic text-[#968C83]">Select a blend to see its composition.</div>}
              </SectionCard>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        </div>
      </div>
    </main>
  );
}
