import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, serverTimestamp, updateDoc, setDoc, getDoc, getDocs, where
} from "firebase/firestore";
import { useAuth } from "../App";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// ─── DATE HELPER — parse YYYY-MM-DD as LOCAL date (avoids UTC timezone shift)
const parseLocalDate = (str) => {
  if (!str) return new Date(0);
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// ─── DEFAULT CATEGORIES ───────────────────────────────────────────────────────
// Category groups (order matters — shown in this order in Budget & Categories pages)
const CATEGORY_GROUPS = [
  { id:"income",         label:"Income",                type:"income"  },
  { id:"housing",        label:"Housing",               type:"expense" },
  { id:"transportation", label:"Transportation",        type:"expense" },
  { id:"food",           label:"Food & Dining",         type:"expense" },
  { id:"health",         label:"Health & Medical",      type:"expense" },
  { id:"personal",       label:"Personal Care",         type:"expense" },
  { id:"entertainment",  label:"Entertainment",         type:"expense" },
  { id:"children",       label:"Children",              type:"expense" },
  { id:"savings",        label:"Savings & Investments", type:"expense" },
  { id:"loans",          label:"Loans & Debt",          type:"expense" },
  { id:"insurance",      label:"Insurance",             type:"expense" },
  { id:"gifts",          label:"Gifts & Donations",     type:"expense" },
  { id:"taxes",          label:"Taxes",                 type:"expense" },
  { id:"other",          label:"Other",                 type:"expense" },
];

const DEFAULT_CATEGORIES = [
  // ── INCOME ──
  { id:"d_salary",      label:"Salary",             type:"income",  group:"income",        icon:"💼", color:"#1e9e6b" },
  { id:"d_bonus",       label:"Bonus",              type:"income",  group:"income",        icon:"🎁", color:"#1e9e6b" },
  { id:"d_freelance",   label:"Freelance",          type:"income",  group:"income",        icon:"💻", color:"#1e9e6b" },
  { id:"d_investment",  label:"Investment Returns", type:"income",  group:"income",        icon:"📈", color:"#1e9e6b" },
  { id:"d_rental",      label:"Rental Income",      type:"income",  group:"income",        icon:"🏘️", color:"#1e9e6b" },
  { id:"d_other_in",    label:"Other Income",       type:"income",  group:"income",        icon:"➕", color:"#1e9e6b" },
  // ── HOUSING ──
  { id:"d_rent",        label:"Rent / Mortgage",    type:"expense", group:"housing",       icon:"🏠", color:"#e05c5c" },
  { id:"d_electricity", label:"Electricity",        type:"expense", group:"housing",       icon:"⚡", color:"#e05c5c" },
  { id:"d_gas_util",    label:"Gas",                type:"expense", group:"housing",       icon:"🔥", color:"#e05c5c" },
  { id:"d_water",       label:"Water & Sewer",      type:"expense", group:"housing",       icon:"💧", color:"#e05c5c" },
  { id:"d_internet",    label:"Internet",           type:"expense", group:"housing",       icon:"📡", color:"#e05c5c" },
  { id:"d_phone",       label:"Phone",              type:"expense", group:"housing",       icon:"📱", color:"#e05c5c" },
  { id:"d_maintenance", label:"Maintenance",        type:"expense", group:"housing",       icon:"🔧", color:"#e05c5c" },
  // ── TRANSPORTATION ──
  { id:"d_car_payment", label:"Car Payment",        type:"expense", group:"transportation",icon:"🚗", color:"#3b72d9" },
  { id:"d_car_ins",     label:"Car Insurance",      type:"expense", group:"transportation",icon:"🛡️", color:"#3b72d9" },
  { id:"d_fuel",        label:"Fuel / Charge",      type:"expense", group:"transportation",icon:"⛽", color:"#3b72d9" },
  { id:"d_uber",        label:"Uber / Taxi",        type:"expense", group:"transportation",icon:"🚕", color:"#3b72d9" },
  { id:"d_transit",     label:"Public Transit",     type:"expense", group:"transportation",icon:"🚌", color:"#3b72d9" },
  { id:"d_parking",     label:"Parking",            type:"expense", group:"transportation",icon:"🅿️", color:"#3b72d9" },
  // ── FOOD & DINING ──
  { id:"d_groceries",   label:"Groceries",          type:"expense", group:"food",          icon:"🛒", color:"#c9931a" },
  { id:"d_dining_col",  label:"Colombia Food",      type:"expense", group:"food",          icon:"🇨🇴", color:"#c9931a" },
  { id:"d_restaurants", label:"Restaurants",        type:"expense", group:"food",          icon:"🍽️", color:"#c9931a" },
  { id:"d_takeout",     label:"Rappi / Delivery",   type:"expense", group:"food",          icon:"🛵", color:"#c9931a" },
  { id:"d_coffee",      label:"Coffee Shops",       type:"expense", group:"food",          icon:"☕", color:"#c9931a" },
  { id:"d_fastfood",    label:"Fast Food",          type:"expense", group:"food",          icon:"🍔", color:"#c9931a" },
  // ── HEALTH & MEDICAL ──
  { id:"d_doctor",      label:"Doctor / Medical",   type:"expense", group:"health",        icon:"🏥", color:"#e05c5c" },
  { id:"d_dentist",     label:"Dentist",            type:"expense", group:"health",        icon:"🦷", color:"#e05c5c" },
  { id:"d_pharmacy",    label:"Pharmacy",           type:"expense", group:"health",        icon:"💊", color:"#e05c5c" },
  { id:"d_gym",         label:"Gym / Fitness",      type:"expense", group:"health",        icon:"🏋️", color:"#e05c5c" },
  // ── PERSONAL CARE ──
  { id:"d_hair",        label:"Hair & Nails",       type:"expense", group:"personal",      icon:"💇", color:"#7c5cdb" },
  { id:"d_clothing",    label:"Clothing",           type:"expense", group:"personal",      icon:"👗", color:"#7c5cdb" },
  { id:"d_amazon",      label:"Amazon",             type:"expense", group:"personal",      icon:"📦", color:"#7c5cdb" },
  { id:"d_shopping",    label:"Shopping",           type:"expense", group:"personal",      icon:"🛍️", color:"#7c5cdb" },
  // ── ENTERTAINMENT ──
  { id:"d_streaming",   label:"Streaming (Netflix+)",type:"expense",group:"entertainment", icon:"🎬", color:"#a678e8" },
  { id:"d_subscriptions",label:"Subscriptions",     type:"expense", group:"entertainment", icon:"🔄", color:"#a678e8" },
  { id:"d_events",      label:"Events & Outings",   type:"expense", group:"entertainment", icon:"🎭", color:"#a678e8" },
  { id:"d_travel",      label:"Travel / Hotels",    type:"expense", group:"entertainment", icon:"✈️", color:"#a678e8" },
  // ── CHILDREN ──
  { id:"d_school",      label:"School (Jaco)",      type:"expense", group:"children",      icon:"🏫", color:"#1e8fa0" },
  { id:"d_kids_act",    label:"Kids Activities",    type:"expense", group:"children",      icon:"🧸", color:"#1e8fa0" },
  { id:"d_kids_misc",   label:"Belen / Other Kids", type:"expense", group:"children",      icon:"👶", color:"#1e8fa0" },
  // ── SAVINGS ──
  { id:"d_investments", label:"Investments",        type:"expense", group:"savings",       icon:"📈", color:"#1e9e6b" },
  { id:"d_emergency",   label:"Emergency Fund",     type:"expense", group:"savings",       icon:"🏦", color:"#1e9e6b" },
  { id:"d_retirement",  label:"Retirement",         type:"expense", group:"savings",       icon:"💰", color:"#1e9e6b" },
  // ── LOANS ──
  { id:"d_credit_card", label:"Credit Card Payment",type:"expense", group:"loans",         icon:"💳", color:"#d94f4f" },
  { id:"d_student_loan",label:"Student Loan",       type:"expense", group:"loans",         icon:"🎓", color:"#d94f4f" },
  // ── INSURANCE ──
  { id:"d_health_ins",  label:"Health Insurance",   type:"expense", group:"insurance",     icon:"❤️", color:"#888"    },
  { id:"d_car_ins2",    label:"Auto Insurance",     type:"expense", group:"insurance",     icon:"🚗", color:"#888"    },
  { id:"d_life_ins",    label:"Life Insurance",     type:"expense", group:"insurance",     icon:"🛡️", color:"#888"    },
  // ── GIFTS & DONATIONS ──
  { id:"d_church",      label:"Church / Parish",    type:"expense", group:"gifts",         icon:"⛪", color:"#888"    },
  { id:"d_charity",     label:"Charity",            type:"expense", group:"gifts",         icon:"🤝", color:"#888"    },
  { id:"d_gifts",       label:"Gifts",              type:"expense", group:"gifts",         icon:"🎁", color:"#888"    },
  // ── TAXES ──
  { id:"d_taxes",       label:"Taxes",              type:"expense", group:"taxes",         icon:"📄", color:"#888"    },
  // ── OTHER ──
  { id:"d_pets",        label:"Pet Expenses",       type:"expense", group:"other",         icon:"🐾", color:"#888"    },
  { id:"d_misc",        label:"Miscellaneous",      type:"expense", group:"other",         icon:"📦", color:"#888"    },
];

const ICON_OPTIONS  = ["💼","💻","🏠","🚗","🛒","🍽️","❤️","🎭","💰","🌐","🎓","👶","👗","📱","✈️","🐾","🎁","💊","⚡","🏋️","📚","🎮","🍺","☕","🏦","➕","📄","🔧","🎵","🏥"];
const COLOR_OPTIONS = ["#4caf88","#e05c5c","#5b8dee","#e8a547","#e8775c","#a678e8","#e8c547","#888","#4caf99","#e87788","#78b0e8","#c8a547"];

const fmt    = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const fmtDec = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    home:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
    plus:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    list:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    target:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    split:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    chart:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    gauge:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2a10 10 0 0 1 7.38 16.75"/><path d="M12 2a10 10 0 0 0-7.38 16.75"/><line x1="12" y1="12" x2="15.5" y2="8.5"/><circle cx="12" cy="12" r="2"/></svg>,
    tag:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    logout:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    x:        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    trash:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
    chevL:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6"/></svg>,
    chevR:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>,
    edit:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    download: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    upload:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    help:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    grid:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
    chat:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 0 2 2z"/></svg>,
    send:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>,
    bank:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12,2 2,7 22,7"/></svg>,
    reconcile:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    sparkle:  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
  };
  return icons[name] || null;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((p, i) => <div key={i} className="value" style={{ color: p.color }}>{p.name}: {fmt(p.value)}</div>)}
    </div>
  );
};

function MonthNav({ month, year, onPrev, onNext }) {
  return (
    <div className="month-nav">
      <button onClick={onPrev}><Icon name="chevL" size={14} /></button>
      <span className="month-label">{MONTHS[month]} {year}</span>
      <button onClick={onNext}><Icon name="chevR" size={14} /></button>
    </div>
  );
}

// ─── CATEGORY MODAL ───────────────────────────────────────────────────────────
function CategoryModal({ cat, onClose, onSave }) {
  const [form, setForm] = useState(cat
    ? { label: cat.label, type: cat.type, icon: cat.icon, color: cat.color, monthlyBudget: cat.monthlyBudget || 0,
        group: cat.group || (cat.type === "income" ? "income" : "other") }
    : { label: "", type: "expense", icon: "📦", color: "#888", group: "other" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const save = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form });
      onClose();
    } catch(e) {
      setError("Failed to save. Check your connection and try again.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{cat ? "Edit Category" : "New Category"}</span>
          <button className="modal-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {["income","expense"].map(t => (
            <button key={t} className={`tab-btn ${form.type === t ? "active" : ""}`} onClick={() => setForm(f => ({ ...f, type: t, group: t === "income" ? "income" : (f.group === "income" ? "other" : f.group) }))}>
              {t === "income" ? "Income" : "Expense"}
            </button>
          ))}
        </div>
        <div className="form-group">
            <label>Category Name</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Groceries" />
          </div>
        <div className="form-group">
          <label>Group</label>
          <select value={form.group || "other"} onChange={e => setForm(f => ({ ...f, group: e.target.value }))}>
            {CATEGORY_GROUPS
              .filter(g => g.type === form.type || g.id === "income")
              .map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Icon</label>
          <div className="cat-list" style={{ maxHeight: 80, overflowY: "auto" }}>
            {ICON_OPTIONS.map(ic => (
              <button key={ic} className="cat-pill"
                style={{ background: form.icon === ic ? "var(--gold-dim)" : "transparent", borderColor: form.icon === ic ? "var(--gold)" : "rgba(255,255,255,0.08)", fontSize: 18, padding: "4px 8px" }}
                onClick={() => setForm(f => ({ ...f, icon: ic }))}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Color</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COLOR_OPTIONS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: form.color === c ? "3px solid white" : "2px solid transparent", cursor: "pointer" }} />
            ))}
          </div>
        </div>
        <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>{form.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: form.color }}>{form.label || "Category name"}</div>

          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {error && <span style={{fontSize:12,color:"#e05c5c",marginRight:"auto"}}>{error}</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{opacity:saving?0.6:1}}>
            {saving ? "Saving..." : cat ? "Save Changes" : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TRANSACTION MODAL ────────────────────────────────────────────────────────

// ─── CALCULATOR ──────────────────────────────────────────────────────────────
function Calculator({ onUse, onClose, initial }) {
  const [display, setDisplay] = useState(initial ? String(initial) : "0");
  const [expr, setExpr]       = useState("");       // full expression string
  const [fresh, setFresh]     = useState(!initial); // next digit replaces display

  const MAX_DIGITS = 10;

  const push = (val) => {
    if (fresh) {
      setDisplay(val === "." ? "0." : val);
      setFresh(false);
    } else {
      if (val === "." && display.includes(".")) return;
      if (display === "0" && val !== ".") {
        setDisplay(val);
      } else {
        if (display.replace(".","").replace("-","").length >= MAX_DIGITS) return;
        setDisplay(d => d + val);
      }
    }
  };

  const pressOp = (op) => {
    setExpr(display + " " + op + " ");
    setFresh(true);
  };

  const pressEqual = () => {
    try {
      if (!expr) return;
      const parts = expr.trim().split(" ");
      const left  = parseFloat(parts[0]);
      const op    = parts[1];
      const right = parseFloat(display);
      let result;
      if      (op === "+") result = left + right;
      else if (op === "−") result = left - right;
      else if (op === "×") result = left * right;
      else if (op === "÷") result = right !== 0 ? left / right : 0;
      else return;
      const rounded = Math.round(result * 100) / 100;
      setDisplay(String(rounded));
      setExpr("");
      setFresh(true);
    } catch { /* ignore */ }
  };

  const pressBackspace = () => {
    if (fresh || display === "0") return;
    const next = display.slice(0, -1);
    setDisplay(next === "" || next === "-" ? "0" : next);
  };

  const pressClear = () => { setDisplay("0"); setExpr(""); setFresh(true); };

  const pressSign = () => {
    if (display === "0") return;
    setDisplay(d => d.startsWith("-") ? d.slice(1) : "-" + d);
  };

  const pressPct = () => {
    const val = parseFloat(display) / 100;
    setDisplay(String(Math.round(val * 1000000) / 1000000));
    setFresh(true);
  };

  const useResult = () => {
    const val = parseFloat(display);
    if (!isNaN(val) && val > 0) { onUse(String(Math.round(val * 100) / 100)); onClose(); }
  };

  const BUTTONS = [
    { label:"C",   action: pressClear,        style:"fn"  },
    { label:"+/−", action: pressSign,          style:"fn"  },
    { label:"%",   action: pressPct,           style:"fn"  },
    { label:"÷",   action: ()=>pressOp("÷"),   style:"op"  },
    { label:"7",   action: ()=>push("7"),      style:"num" },
    { label:"8",   action: ()=>push("8"),      style:"num" },
    { label:"9",   action: ()=>push("9"),      style:"num" },
    { label:"×",   action: ()=>pressOp("×"),   style:"op"  },
    { label:"4",   action: ()=>push("4"),      style:"num" },
    { label:"5",   action: ()=>push("5"),      style:"num" },
    { label:"6",   action: ()=>push("6"),      style:"num" },
    { label:"−",   action: ()=>pressOp("−"),   style:"op"  },
    { label:"1",   action: ()=>push("1"),      style:"num" },
    { label:"2",   action: ()=>push("2"),      style:"num" },
    { label:"3",   action: ()=>push("3"),      style:"num" },
    { label:"+",   action: ()=>pressOp("+"),   style:"op"  },
    { label:"⌫",   action: pressBackspace,     style:"num" },
    { label:"0",   action: ()=>push("0"),      style:"num" },
    { label:".",   action: ()=>push("."),      style:"num" },
    { label:"=",   action: pressEqual,         style:"eq"  },
  ];

  // Keyboard support
  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= "0" && e.key <= "9") push(e.key);
      else if (e.key === ".")  push(".");
      else if (e.key === "+")  pressOp("+");
      else if (e.key === "-")  pressOp("−");
      else if (e.key === "*")  pressOp("×");
      else if (e.key === "/")  { e.preventDefault(); pressOp("÷"); }
      else if (e.key === "Enter" || e.key === "=") pressEqual();
      else if (e.key === "Backspace") pressBackspace();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const displayNum = display.length > 9
    ? parseFloat(display).toExponential(3)
    : display;

  return (
    <div className="calc-overlay" onClick={onClose}>
      <div className="calc" onClick={e => e.stopPropagation()}>
        {/* Display */}
        <div className="calc-display">
          <div className="calc-expr">{expr || " "}</div>
          <div className="calc-num">{displayNum}</div>
        </div>
        {/* Buttons */}
        <div className="calc-grid">
          {BUTTONS.map((b, i) => (
            <button key={i} className={`calc-btn calc-btn-${b.style}`} onClick={b.action}>
              {b.label}
            </button>
          ))}
        </div>
        {/* Use result */}
        <button className="calc-use-btn" onClick={useResult}>
          Use {parseFloat(display) > 0 ? `$${Math.round(parseFloat(display)*100)/100}` : "result"} →
        </button>
      </div>
    </div>
  );
}

function TxModal({ onClose, onSave, user, categories, accounts, tx }) {
  const now = new Date();
  const incCats = categories.filter(c => c.type === "income");
  const expCats = categories.filter(c => c.type === "expense");
  const [form, setForm] = useState(tx ? {
    type: tx.type,
    categoryId: tx.categoryId || (tx.type === "income" ? incCats[0]?.id : expCats[0]?.id) || "",
    description: tx.description || "",
    amount: tx.amount || "",
    date: tx.date || now.toISOString().slice(0, 10),
    paidBy: tx.paidBy || "",
    accountId: tx.accountId || ""
  } : {
    type: "expense", categoryId: expCats[0]?.id || "",
    description: "", amount: "",
    date: now.toISOString().slice(0, 10),
    paidBy: user?.displayName?.split(" ")[0] || "",
    accountId: ""
  });
  const [catSearch, setCatSearch] = useState("");
  const [showCalc, setShowCalc]   = useState(false);

  const activeCats = form.type === "income" ? incCats : expCats;
  const filteredCats = catSearch.trim()
    ? activeCats.filter(c => c.label.toLowerCase().includes(catSearch.toLowerCase()))
    : activeCats;
  const selectedCat = categories.find(c => c.id === form.categoryId);

  const save = async () => {
    if (!form.description || !form.amount || isNaN(Number(form.amount))) return;
    const cat = categories.find(c => c.id === form.categoryId);
    await onSave({ ...form, amount: parseFloat(form.amount), categoryLabel: cat?.label || "", categoryIcon: cat?.icon || "📦", categoryColor: cat?.color || "#888" });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{tx ? "Edit Transaction" : "New Transaction"}</span>
          <button className="modal-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {["income","expense"].map(t => (
            <button key={t} className={`tab-btn ${form.type === t ? "active" : ""}`}
              onClick={() => { setForm(f => ({ ...f, type: t, categoryId: (t === "income" ? incCats : expCats)[0]?.id || "" })); setCatSearch(""); }}>
              {t === "income" ? "Income" : "Expense"}
            </button>
          ))}
        </div>
        <div className="form-group">
          <label>Category</label>
          {/* Selected category preview */}
          {selectedCat && (
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"var(--surface2)", borderRadius:8, padding:"8px 12px", marginBottom:8, border:`1px solid ${selectedCat.color}44` }}>
              <span style={{ fontSize:16 }}>{selectedCat.icon}</span>
              <span style={{ fontSize:13, fontWeight:500, color:selectedCat.color, flex:1 }}>{selectedCat.label}</span>
              <span style={{ fontSize:11, color:"var(--text3)" }}>selected</span>
            </div>
          )}
          {/* Search input */}
          <input
            className="search-input"
            placeholder={`Search ${form.type} categories...`}
            value={catSearch}
            onChange={e => setCatSearch(e.target.value)}
            style={{ marginBottom:8 }}
          />
          {/* Category list */}
          <div style={{ maxHeight:160, overflowY:"auto", display:"flex", flexDirection:"column", gap:2 }}>
            {filteredCats.length === 0 ? (
              <div style={{ fontSize:13, color:"var(--text3)", padding:"10px 12px", textAlign:"center" }}>
                No categories match "{catSearch}"
              </div>
            ) : filteredCats.map(c => (
              <button key={c.id}
                style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"8px 12px", borderRadius:8,
                  background: form.categoryId === c.id ? c.color+"22" : "transparent",
                  border: "1px solid " + (form.categoryId === c.id ? c.color+"66" : "transparent"),
                  cursor:"pointer", width:"100%", textAlign:"left",
                  transition:"background 0.12s",
                }}
                onClick={() => { setForm(f => ({ ...f, categoryId: c.id })); setCatSearch(""); }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{c.icon}</span>
                <span style={{ fontSize:13, fontWeight: form.categoryId === c.id ? 500 : 400, color: form.categoryId === c.id ? c.color : "var(--text2)" }}>{c.label}</span>
                {form.categoryId === c.id && <span style={{ marginLeft:"auto", fontSize:11, color:c.color }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Whole Foods" />
          </div>
          <div className="form-group">
            <label>Amount ($)</label>
            <div style={{ display:"flex", gap:6 }}>
              <input type="number" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00" style={{ flex:1 }} />
              <button type="button" className="calc-trigger-btn"
                onClick={() => setShowCalc(s => !s)}
                title="Open calculator">
                🧮
              </button>
            </div>
            {showCalc && (
              <Calculator
                initial={parseFloat(form.amount) || null}
                onUse={val => setForm(f => ({ ...f, amount: val }))}
                onClose={() => setShowCalc(false)}
              />
            )}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Paid by</label>
            <input value={form.paidBy} onChange={e => setForm(f => ({ ...f, paidBy: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}><Icon name="plus" size={14} /> Add</button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: CATEGORIES ─────────────────────────────────────────────────────────
function CategoriesPage({ categories, onAdd, onEdit, onDelete }) {
  const [showModal, setShowModal]   = useState(false);
  const [editCat, setEditCat]       = useState(null);
  const [collapsed, setCollapsed]   = useState({});  // groupId -> bool

  const income  = categories.filter(c => c.type === "income");
  const expense = categories.filter(c => c.type === "expense");

  const toggleGroup = (id) => setCollapsed(s => ({ ...s, [id]: !s[id] }));

  const CatItem = ({ c }) => (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
      <div style={{ width:32, height:32, borderRadius:8, background:c.color+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{c.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500 }}>{c.label}</div>
        {c.group && <div style={{ fontSize:11, color:"var(--text3)" }}>{CATEGORY_GROUPS.find(g=>g.id===c.group)?.label || c.group}</div>}
      </div>
      <button className="btn btn-ghost btn-sm" style={{ padding:5 }} onClick={() => { setEditCat(c); setShowModal(true); }}><Icon name="edit" size={13}/></button>
      {!c.id?.startsWith("d_") && (
        <button className="btn btn-ghost btn-sm" style={{ padding:5 }} onClick={() => { if(window.confirm(`Delete "${c.label}"?`)) onDelete(c.id); }}><Icon name="trash" size={13}/></button>
      )}
    </div>
  );

  // Build grouped expense map
  const groupedExpense = CATEGORY_GROUPS.filter(g => g.type === "expense").map(grp => ({
    grp,
    cats: expense.filter(c => (c.group || "other") === grp.id)
  })).filter(({ cats }) => cats.length > 0);

  // Ungrouped fallback
  const ungrouped = expense.filter(c => !c.group || !CATEGORY_GROUPS.find(g => g.id === c.group));

  return (
    <div>
      <div className="page-header page-header-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
        <div><h1>Categories</h1><p>Set monthly budgets in the Budget tab</p></div>
        <button className="btn btn-primary" onClick={() => { setEditCat(null); setShowModal(true); }}>
          <Icon name="plus" size={14}/> New Category
        </button>
      </div>

      <div className="kpi-grid" style={{ marginBottom:18 }}>
        <div className="kpi-card"><div className="kpi-label">Income</div><div className="kpi-value green">{income.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Expense</div><div className="kpi-value">{expense.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Groups</div><div className="kpi-value">{groupedExpense.length}</div></div>
      </div>

      {/* Income — single flat card */}
      <div className="card" style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:income.length > 0 ? 4 : 0, cursor:"pointer" }}
          onClick={() => toggleGroup("_income")}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:13, fontWeight:600 }}>💵 Income</span>
            <span className="badge green">{income.length}</span>
          </div>
          <span style={{ fontSize:12, color:"var(--text3)" }}>{collapsed["_income"] ? "▶" : "▼"}</span>
        </div>
        {!collapsed["_income"] && (
          income.length === 0
            ? <div className="empty" style={{ padding:"16px 0" }}><p>No income categories yet</p></div>
            : income.map(c => <CatItem key={c.id} c={c}/>)
        )}
      </div>

      {/* Expense groups — one collapsible card per group */}
      {groupedExpense.map(({ grp, cats }) => (
        <div key={grp.id} className="card" style={{ marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", padding:"2px 0" }}
            onClick={() => toggleGroup(grp.id)}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>{grp.label}</span>
              <span className="badge" style={{ background:"var(--surface3)", color:"var(--text3)" }}>{cats.length}</span>
            </div>
            <span style={{ fontSize:12, color:"var(--text3)" }}>{collapsed[grp.id] ? "▶" : "▼"}</span>
          </div>
          {!collapsed[grp.id] && cats.map(c => <CatItem key={c.id} c={c}/>)}
        </div>
      ))}

      {/* Ungrouped fallback */}
      {ungrouped.length > 0 && (
        <div className="card" style={{ marginBottom:8 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
            onClick={() => toggleGroup("_ungrouped")}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text3)" }}>Other / Ungrouped</span>
              <span className="badge" style={{ background:"var(--surface3)", color:"var(--text3)" }}>{ungrouped.length}</span>
            </div>
            <span style={{ fontSize:12, color:"var(--text3)" }}>{collapsed["_ungrouped"] ? "▶" : "▼"}</span>
          </div>
          {!collapsed["_ungrouped"] && ungrouped.map(c => <CatItem key={c.id} c={c}/>)}
        </div>
      )}

      {showModal && (
        <CategoryModal cat={editCat} onClose={() => setShowModal(false)}
          onSave={async (data) => { if (editCat) await onEdit(editCat.id, data); else await onAdd(data); }} />
      )}
    </div>
  );
}

// ─── PAGE: BUDGET EXECUTION ───────────────────────────────────────────────────
// Monthly budget plan stored in Firestore as: budgetPlans/{YYYY-MM}
// Each doc: { categoryId: amount, ... }

function BudgetPage({ transactions, categories, db, householdId, accounts }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());
  const [plan, setPlan]   = useState({});         // { categoryId: budgetAmount }
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({});
  const [saving, setSaving]   = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const monthKey = `${householdId}_${year}-${String(month+1).padStart(2,"0")}`;

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); };

  // Load plan for selected month from Firestore
  useEffect(() => {
    const ref = doc(db, "budgetPlans", monthKey);
    const unsub = onSnapshot(ref, snap => {
      setPlan(snap.exists() ? snap.data() : {});
    });
    return unsub;
  }, [monthKey]);

  // Actuals for this month
  const monthTx = transactions.filter(t => {
    const d = parseLocalDate(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const actualMap = {};
  monthTx.forEach(t => { actualMap[t.categoryId] = (actualMap[t.categoryId] || 0) + t.amount; });

  const incCats = categories.filter(c => c.type === "income");
  const expCats = categories.filter(c => c.type === "expense");

  const totalIncomeBudget  = incCats.reduce((s,c) => s + (plan[c.id] || 0), 0);
  const totalExpenseBudget = expCats.reduce((s,c) => s + (plan[c.id] || 0), 0);
  const totalIncomeActual  = incCats.reduce((s,c) => s + (actualMap[c.id] || 0), 0);
  const totalExpenseActual = expCats.reduce((s,c) => s + (actualMap[c.id] || 0), 0);
  const plannedSavings = totalIncomeBudget - totalExpenseBudget;
  const actualSavings  = totalIncomeActual - totalExpenseActual;
  const incomePct      = totalIncomeBudget  > 0 ? Math.min(100, Math.round(totalIncomeActual  / totalIncomeBudget  * 100)) : 0;
  const expensePct     = totalExpenseBudget > 0 ? Math.min(100, Math.round(totalExpenseActual / totalExpenseBudget * 100)) : 0;

  const light = (pct, type) => {
    if (type === "income") {
      if (pct >= 100) return { color: "#4caf88", label: "Goal met" };
      if (pct >= 60)  return { color: "#e8a547", label: "In progress" };
      return              { color: "#e05c5c", label: "Behind" };
    }
    if (pct > 100)  return { color: "#d94f4f", label: "Overspent" };
    if (pct === 100) return { color: "#3b72d9", label: "Fully used" };
    if (pct >= 80)  return { color: "#c9931a", label: "Almost used" };
    return              { color: "#1e9e6b", label: "On track" };
  };

  const startEdit = () => {
    setDraft(Object.fromEntries(categories.map(c => [c.id, plan[c.id] || ""])));
    setEditing(true);
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const clean = Object.fromEntries(
        Object.entries(draft).map(([k,v]) => [k, parseFloat(v) || 0]).filter(([,v]) => v > 0)
      );
      await setDoc(doc(db, "budgetPlans", monthKey), { ...clean, householdId });
      setEditing(false);
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const copyFromPrevMonth = async () => {
    const prevM   = month === 0 ? 11 : month - 1;
    const prevY   = month === 0 ? year - 1 : year;
    // Key must match the same format as monthKey: {householdId}_{YYYY-MM}
    const prevKey = `${householdId}_${prevY}-${String(prevM+1).padStart(2,"0")}`;
    try {
      const snap = await getDoc(doc(db, "budgetPlans", prevKey));
      if (snap.exists()) {
        const { householdId: _hid, ...prevData } = snap.data();
        await setDoc(doc(db, "budgetPlans", monthKey), { ...prevData, householdId });
        setCopyMsg(`Copied from ${MONTHS[prevM]} ${prevY}`);
        setTimeout(() => setCopyMsg(""), 3000);
      } else {
        setCopyMsg(`No budget plan found for ${MONTHS[prevM]} ${prevY}`);
        setTimeout(() => setCopyMsg(""), 3000);
      }
    } catch(e) {
      console.error("Copy failed:", e);
      setCopyMsg("Copy failed — check console");
      setTimeout(() => setCopyMsg(""), 3000);
    }
  };

  const hasPlan = Object.keys(plan).length > 0;

  const [inlineEdit, setInlineEdit] = useState(null);
  const [inlineVal, setInlineVal]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeOnly, setActiveOnly]     = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState({}); // groupId -> bool
  const toggleBudgetGroup = (id) => setCollapsedGroups(s => ({ ...s, [id]: !s[id] }));

  // Money available to assign = sum of budget account balances
  const budgetAccountBalance = accounts
    .filter(a => (a.accountRole || "budget") === "budget")
    .reduce((sum, acc) => {
      const txForAcc = transactions.filter(t => (t.accountId||"") === acc.id && t.date >= (acc.openingDate||""));
      const inflow  = txForAcc.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
      const outflow = txForAcc.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
      return sum + (acc.openingBalance||0) + inflow - outflow;
    }, 0);

  const totalAssigned   = totalExpenseBudget;  // total assigned to expense categories
  const moneyAvailable  = budgetAccountBalance;
  const overAssigned    = totalAssigned > moneyAvailable && moneyAvailable > 0;
  const assignedGap     = totalAssigned - moneyAvailable;

  const saveInline = async (catId) => {
    const val = parseFloat(inlineVal) || 0;
    const updated = { ...plan, [catId]: val, householdId };
    await setDoc(doc(db, "budgetPlans", monthKey), updated);
    setInlineEdit(null);
    setInlineVal("");
  };

  // Categorize each expense category for filter
  const getCatStatus = (c) => {
    if (c.type === "income") return "funded"; // income rows not filtered
    const budget = plan[c.id] || 0;
    const actual = actualMap[c.id] || 0;
    if (budget === 0 && actual === 0) return "funded";
    if (actual > budget && budget > 0) return "overspent";
    if (budget === 0 || actual < budget) return "underfunded";
    return "funded";
  };

  const CatRow = ({ c, type }) => {
    const budget    = plan[c.id] || 0;
    const actual    = actualMap[c.id] || 0;
    const available = budget - actual;   // Available = Assigned − Spent
    const pct       = budget > 0 ? Math.min(100, Math.round(actual / budget * 100)) : 0;
    const status    = light(pct, type);
    const variance  = actual - budget;
    const isEditing = inlineEdit === c.id;
    if (budget === 0 && actual === 0) {
      if (activeOnly) return null;  // hide inactive when filter is on
      if (statusFilter !== "all") return null; // always hide in status-filter mode
    }
    // Apply status filter (expenses only)
    if (type === "expense" && statusFilter !== "all" && getCatStatus(c) !== statusFilter) return null;
    return (
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
        <div style={{ width:32, height:32, borderRadius:8, background:c.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{c.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: budget > 0 ? 5 : 0 }}>
            <span style={{ fontSize:13, fontWeight:500 }}>{c.label}</span>
            {/* Available badge — shows Available amount prominently */}
            {!isEditing && budget > 0 && (
              <span style={{
                fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:100,
                background: available < 0 ? "var(--red-dim)" : available === 0 ? "var(--surface3)" : "var(--green-dim)",
                color: available < 0 ? "var(--red)" : available === 0 ? "var(--text3)" : "var(--green)",
                flexShrink:0
              }}>
                {available < 0 ? `-${fmt(Math.abs(available))}` : `+${fmt(available)}`} left
              </span>
            )}
            {isEditing ? (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:12, color:"var(--text3)" }}>$</span>
                <input type="number" autoFocus value={inlineVal}
                  onChange={e => setInlineVal(e.target.value)}
                  onKeyDown={e => { if(e.key==="Enter") saveInline(c.id); if(e.key==="Escape") setInlineEdit(null); }}
                  style={{ width:90, background:"var(--surface2)", border:"1px solid var(--gold)", borderRadius:6, color:"var(--text)", fontSize:13, padding:"3px 8px", outline:"none", textAlign:"right" }} />
                <button className="btn btn-primary btn-sm" style={{ padding:"4px 10px" }} onClick={() => saveInline(c.id)}>✓</button>
                <button className="btn btn-ghost btn-sm" style={{ padding:"4px 8px" }} onClick={() => setInlineEdit(null)}>✕</button>
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:"var(--text3)"}}>
                    <span style={{color:"var(--text2)"}}>{fmtDec(actual)}</span> spent
                    {budget > 0 && <span style={{color:"var(--text3)"}}> of {fmt(budget)}</span>}
                  </span>
                  <button className="btn btn-ghost btn-sm" style={{ padding:"3px 7px", fontSize:11 }}
                    onClick={() => { setInlineEdit(c.id); setInlineVal(budget || ""); }}>
                    {budget > 0 ? "edit" : "+ set budget"}
                  </button>
                </div>
              </div>
            )}
          </div>
          {budget > 0 && !isEditing && (
            <>
              <div className="progress-bar" style={{ height:5 }}>
                <div className="progress-fill" style={{ width:pct+"%", background:status.color }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span style={{ fontSize:11, color:status.color, fontWeight:500 }}>{pct}% — {status.label}</span>
                <span style={{ fontSize:11, color:(variance>0&&type==="expense")||(variance<0&&type==="income") ? "#e05c5c":"#4caf88" }}>
                  {type==="expense"
                    ? variance>0 ? `${fmt(Math.abs(variance))} over` : `${fmt(Math.abs(variance))} under`
                    : variance>0 ? `+${fmt(Math.abs(variance))} above` : `${fmt(Math.abs(variance))} short`}
                </span>
              </div>
            </>
          )}
          {budget===0 && actual>0 && !isEditing && <div style={{ fontSize:11, color:"var(--text3)", marginTop:3 }}>No budget set — click to add</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header page-header-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
        <div><h1>Budget Execution</h1><p>Monthly plan vs actuals</p></div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end" }}>
          <MonthNav month={month} year={year} onPrev={prevMonth} onNext={nextMonth} />
          {hasPlan
            ? <button className="btn btn-ghost btn-sm" onClick={startEdit}><Icon name="edit" size={13} /> Edit Plan</button>
            : <button className="btn btn-primary btn-sm" onClick={startEdit}><Icon name="plus" size={13} /> Set Budget</button>
          }
          <button className="btn btn-ghost btn-sm" onClick={copyFromPrevMonth}><Icon name="chevL" size={13} /> Copy prev month</button>
          {hasPlan && <button className="btn btn-ghost btn-sm" onClick={() => downloadBudgetCSV(plan, categories, transactions, month, year)}><Icon name="download" size={13} /> Export CSV</button>}
        </div>
      </div>

      {copyMsg && <div className="banner info">{copyMsg}</div>}

      {/* ── Uncategorized warning ── */}
      {(() => {
        const uncatAmt   = actualMap[""] || 0;
        const totalSpend = Object.values(actualMap).reduce((s,v)=>s+v,0);
        const uncatPct   = totalSpend > 0 ? Math.round(uncatAmt / totalSpend * 100) : 0;
        if (uncatPct < 5 || uncatAmt < 50) return null;
        return (
          <div style={{
            display:"flex", alignItems:"flex-start", gap:12,
            background:"rgba(201,147,26,0.10)", border:"1px solid rgba(201,147,26,0.25)",
            borderRadius:"var(--radius-sm)", padding:"11px 14px", marginBottom:14
          }}>
            <span style={{fontSize:18,flexShrink:0}}>⚠️</span>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--gold)"}}>
                {fmt(uncatAmt)} uncategorized ({uncatPct}% of spend)
              </div>
              <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>
                These transactions have no category — go to Transactions and assign them to keep your budget accurate.
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Zero-based banner: money available vs assigned ── */}
      {hasPlan && accounts.length > 0 && (
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"12px 16px", borderRadius:"var(--radius-sm)", marginBottom:16,
          background: overAssigned ? "var(--red-dim)" : "var(--green-dim)",
          border: `1px solid ${overAssigned ? "rgba(217,79,79,0.25)" : "rgba(30,158,107,0.25)"}`,
          flexWrap:"wrap", gap:10
        }}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:overAssigned?"var(--red)":"var(--green)"}}>
              {overAssigned
                ? `⚠ You've assigned ${fmt(assignedGap)} more than you have`
                : `✓ Budget is balanced`}
            </div>
            <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
              Available in budget accounts: {fmt(moneyAvailable)} · Assigned to expenses: {fmt(totalAssigned)}
            </div>
          </div>
          {overAssigned && (
            <div style={{fontSize:12,color:"var(--red)"}}>
              Reduce expense budgets by {fmt(assignedGap)} to balance
            </div>
          )}
        </div>
      )}

      {!hasPlan ? (
        <div className="card" style={{ textAlign:"center", padding:"48px 24px" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
          <div style={{ fontSize:15, fontWeight:500, marginBottom:8 }}>No budget plan for {MONTHS[month]} {year}</div>
          <div style={{ fontSize:13, color:"var(--text3)", marginBottom:24 }}>Set your income targets and expense limits for this month.</div>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button className="btn btn-primary" onClick={startEdit}><Icon name="plus" size={14} /> Set Budget</button>
            <button className="btn btn-ghost" onClick={copyFromPrevMonth}><Icon name="chevL" size={13} /> Copy from previous month</button>
          </div>
        </div>
      ) : (
        <>
          <div className="kpi-grid" style={{ marginBottom:20 }}>
            <div className="kpi-card"><div className="kpi-label">Income Actual</div><div className="kpi-value green">{fmt(totalIncomeActual)}</div><div className="kpi-sub">of {fmt(totalIncomeBudget)} planned · {incomePct}%</div></div>
            <div className="kpi-card"><div className="kpi-label">Expenses Actual</div><div className={`kpi-value ${expensePct > 100 ? "red" : "blue"}`}>{fmt(totalExpenseActual)}</div><div className="kpi-sub">of {fmt(totalExpenseBudget)} budgeted · {expensePct}%</div></div>
            <div className="kpi-card"><div className="kpi-label">Budget Remaining</div><div className={`kpi-value ${totalExpenseBudget - totalExpenseActual >= 0 ? "green" : "red"}`}>{fmt(Math.abs(totalExpenseBudget - totalExpenseActual))}</div><div className="kpi-sub">{totalExpenseBudget - totalExpenseActual >= 0 ? "left to spend" : "over budget"}</div></div>
            {(() => {
              const sRate = totalIncomeActual > 0 ? Math.round(actualSavings/totalIncomeActual*100) : 0;
              const srColor = sRate >= 20 ? "var(--green)" : sRate >= 10 ? "var(--gold)" : sRate >= 0 ? "var(--amber)" : "var(--red)";
              const srLabel = sRate >= 20 ? "✓ Great" : sRate >= 10 ? "On target" : sRate >= 0 ? "Below target" : "Deficit";
              return (
                <div className="kpi-card">
                  <div className="kpi-label">Savings Rate</div>
                  <div className="kpi-value" style={{color:srColor}}>{sRate}%</div>
                  <div className="kpi-sub" style={{color:srColor,fontWeight:500}}>{srLabel}</div>
                  <div className="kpi-sub" style={{marginTop:2}}>target: 10–20%</div>
                </div>
              );
            })()}
          </div>

          <div className="card" style={{ marginBottom:20 }}>
            <div className="card-title" style={{ marginBottom:16 }}>{MONTHS[month]} {year} — Summary</div>
            <div className="budget-summary-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                  <span style={{ color:"var(--text2)" }}>💵 Income fulfillment</span>
                  <span style={{ color:"#4caf88", fontWeight:500 }}>{incomePct}%</span>
                </div>
                <div className="progress-bar" style={{ height:10 }}>
                  <div className="progress-fill" style={{ width:incomePct+"%", background:"#4caf88" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text3)", marginTop:5 }}>
                  <span>Received: {fmt(totalIncomeActual)}</span><span>Target: {fmt(totalIncomeBudget)}</span>
                </div>
              </div>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                  <span style={{ color:"var(--text2)" }}>💸 Budget execution</span>
                  <span style={{ color:light(expensePct,"expense").color, fontWeight:500 }}>{expensePct}%</span>
                </div>
                <div className="progress-bar" style={{ height:10 }}>
                  <div className="progress-fill" style={{ width:expensePct+"%", background:light(expensePct,"expense").color }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text3)", marginTop:5 }}>
                  <span>Spent: {fmt(totalExpenseActual)}</span>
                  <span style={{ color: totalExpenseBudget - totalExpenseActual >= 0 ? "#4caf88" : "#e05c5c", fontWeight:500 }}>
                    {totalExpenseBudget - totalExpenseActual >= 0 ? fmt(totalExpenseBudget - totalExpenseActual) + " remaining" : fmt(totalExpenseActual - totalExpenseBudget) + " over"}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ borderTop:"1px solid var(--border)", marginTop:16, paddingTop:14, display:"flex", gap:28, flexWrap:"wrap" }}>
              {[{label:"Planned savings",value:plannedSavings},{label:"Actual savings",value:actualSavings},{label:"Savings variance",value:actualSavings-plannedSavings,prefix:true}].map(({label,value,prefix})=>(
                <div key={label}>
                  <div style={{ fontSize:11, color:"var(--text3)" }}>{label}</div>
                  <div style={{ fontSize:18, fontWeight:600, color:value>=0?"#4caf88":"#e05c5c" }}>{prefix&&value>0?"+":""}{fmt(value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Status filter tabs + active toggle ── */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div className="tab-bar" style={{marginBottom:0}}>
                {[
                  {id:"all",         label:"All"},
                  {id:"underfunded", label:"🟡 Underfunded"},
                  {id:"overspent",   label:"🔴 Overspent"},
                  {id:"funded",      label:"🟢 Funded"},
                ].map(f => (
                  <button key={f.id} className={`tab-btn ${statusFilter===f.id?"active":""}`}
                    onClick={()=>setStatusFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
              {statusFilter !== "all" && (
                <span style={{fontSize:12,color:"var(--text3)"}}>
                  {expCats.filter(c=>getCatStatus(c)===statusFilter).length} {expCats.filter(c=>getCatStatus(c)===statusFilter).length===1?"category":"categories"}
                </span>
              )}
            </div>
            <button
              onClick={()=>setActiveOnly(a=>!a)}
              style={{
                fontSize:12, padding:"5px 10px", borderRadius:6, border:"1px solid var(--border2)",
                background: activeOnly ? "var(--gold-dim)" : "transparent",
                color: activeOnly ? "var(--gold)" : "var(--text3)", cursor:"pointer",
                fontFamily:"var(--font)", whiteSpace:"nowrap"
              }}>
              {activeOnly ? "✓ Active only" : "Show all categories"}
            </button>
          </div>

          {/* ── Income card — only show when filter is All or matches ── */}
          {(statusFilter === "all" || statusFilter === "funded") && (
            <div className="card" style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div className="card-title">💵 Income</div>
                <div style={{fontSize:11,color:"var(--text3)"}}>Assigned / Received / Available</div>
              </div>
              {incCats.every(c=>!plan[c.id]&&!actualMap[c.id])
                ? <div className="empty"><p>No income data this month</p></div>
                : incCats.map(c=><CatRow key={c.id} c={c} type="income"/>)}
            </div>
          )}

          {/* ── Expense groups — collapsible ── */}
          {(() => {
            const expGroups = CATEGORY_GROUPS.filter(g => g.type === "expense");
            return expGroups.map(grp => {
              const grpCats = expCats.filter(c => (c.group||"other") === grp.id);
              // Apply activeOnly filter at group level
              const activeCats = activeOnly
                ? grpCats.filter(c => (plan[c.id]||0) > 0 || (actualMap[c.id]||0) > 0)
                : grpCats;
              // Apply status filter
              const filtered = statusFilter === "all"
                ? activeCats
                : activeCats.filter(c => getCatStatus(c) === statusFilter);
              if (filtered.length === 0) return null;

              const grpBudget  = activeCats.reduce((s,c)=>s+(plan[c.id]||0),0);
              const grpActual  = activeCats.reduce((s,c)=>s+(actualMap[c.id]||0),0);
              const grpAvail   = grpBudget - grpActual;
              const isCollapsed = collapsedGroups[grp.id];
              const grpStatus  = grpActual > grpBudget && grpBudget > 0 ? "over"
                               : grpActual === grpBudget && grpBudget > 0 ? "exact"
                               : "ok";

              return (
                <div key={grp.id} className="card" style={{marginBottom:8}}>
                  {/* Group header — click to collapse */}
                  <div className="budget-group-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",marginBottom: isCollapsed ? 0 : 10}}
                    onClick={() => toggleBudgetGroup(grp.id)}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{grp.label}</span>
                      <span style={{fontSize:11,color:"var(--text3)"}}>{filtered.length} {filtered.length===1?"category":"categories"}</span>
                    </div>
                    <div className="group-stats" style={{display:"flex",alignItems:"center",gap:8}}>
                      {grpBudget > 0 && (
                        <div style={{display:"flex",gap:10,fontSize:12,alignItems:"center"}}>
                          <span style={{color:"var(--text3)"}}>{fmt(grpActual)} <span style={{color:"var(--text3)",fontWeight:400}}>/ {fmt(grpBudget)}</span></span>
                          <span style={{
                            fontWeight:600, fontSize:12, padding:"1px 8px", borderRadius:100,
                            background: grpStatus==="over" ? "var(--red-dim)" : grpStatus==="exact" ? "var(--blue-dim)" : "var(--green-dim)",
                            color: grpStatus==="over" ? "var(--red)" : grpStatus==="exact" ? "var(--blue)" : "var(--green)"
                          }}>
                            {grpAvail >= 0 ? `+${fmt(grpAvail)}` : fmt(grpAvail)}
                          </span>
                        </div>
                      )}
                      <span style={{fontSize:11,color:"var(--text3)",marginLeft:4}}>{isCollapsed ? "▶" : "▼"}</span>
                    </div>
                  </div>
                  {/* Category rows — hidden when collapsed */}
                  {!isCollapsed && filtered.map(c=><CatRow key={c.id} c={c} type="expense"/>)}
                </div>
              );
            });
          })()}
        </>
      )}

      {editing && (
        <div className="modal-overlay" onClick={()=>setEditing(false)}>
          <div className="modal" style={{ maxWidth:540 }} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Budget Plan — {MONTHS[month]} {year}</span>
              <button className="modal-close" onClick={()=>setEditing(false)}><Icon name="x"/></button>
            </div>
            <p style={{ fontSize:12, color:"var(--text3)", marginBottom:16 }}>Set your income targets and expense limits for this month. Leave blank to track without a cap.</p>

            <div style={{ fontWeight:500, fontSize:12, color:"var(--text2)", marginBottom:10 }}>💵 Income targets</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
              {incCats.map(c=>(
                <div className="form-group" key={c.id} style={{ marginBottom:0 }}>
                  <label>{c.icon} {c.label}</label>
                  <input type="number" placeholder="0"
                    value={draft[c.id] || ""}
                    onChange={e=>setDraft(d=>({...d,[c.id]:e.target.value}))} />
                </div>
              ))}
            </div>

            <div style={{ fontWeight:500, fontSize:12, color:"var(--text2)", marginBottom:10 }}>💸 Expense limits</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, maxHeight:300, overflowY:"auto" }}>
              {expCats.map(c=>(
                <div className="form-group" key={c.id} style={{ marginBottom:0 }}>
                  <label>{c.icon} {c.label}</label>
                  <input type="number" placeholder="0"
                    value={draft[c.id] || ""}
                    onChange={e=>setDraft(d=>({...d,[c.id]:e.target.value}))} />
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePlan} disabled={saving} style={{opacity:saving?0.6:1}}>
                {saving?"Saving...":"Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── PAGE: OVERVIEW ───────────────────────────────────────────────────────────
function OverviewPage({ transactions, goals, categories, householdId, db, onNavigate }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear]   = useState(now.getFullYear());
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  const monthTx  = transactions.filter(t => { const d = parseLocalDate(t.date); return d.getMonth() === month && d.getFullYear() === year; });
  const income   = monthTx.filter(t => t.type === "income").reduce((s,t) => s+t.amount, 0);
  const expenses = monthTx.filter(t => t.type === "expense").reduce((s,t) => s+t.amount, 0);
  const balance  = income - expenses;
  const totalSaved  = goals.reduce((s,g) => s+(g.saved||0), 0);
  const totalTarget = goals.reduce((s,g) => s+(g.target||0), 0);

  // Budget execution for overview
  const monthKey = `${householdId}_${year}-${String(month+1).padStart(2,"0")}`;
  const [monthPlan, setMonthPlan] = useState({});
  useEffect(() => {
    if (!householdId) return;
    const ref = doc(db, "budgetPlans", monthKey);
    const unsub = onSnapshot(ref, snap => setMonthPlan(snap.exists() ? snap.data() : {}));
    return unsub;
  }, [monthKey, householdId]);

  const incCats = categories.filter(c => c.type === "income");
  const expCats = categories.filter(c => c.type === "expense");
  const totalIncomeBudget  = incCats.reduce((s,c) => s + (monthPlan[c.id] || 0), 0);
  const totalExpenseBudget = expCats.reduce((s,c) => s + (monthPlan[c.id] || 0), 0);
  const incomePct  = totalIncomeBudget  > 0 ? Math.min(100, Math.round(income  / totalIncomeBudget  * 100)) : null;
  const expensePct = totalExpenseBudget > 0 ? Math.min(100, Math.round(expenses / totalExpenseBudget * 100)) : null;
  const lightColor = (pct, type) => {
    if (type === "income")  return pct >= 100 ? "#1e9e6b" : pct >= 60 ? "#c9931a" : "#d94f4f";
    // expense: only red if genuinely overspent (>100%)
    if (pct > 100)  return "#d94f4f";
    if (pct === 100) return "#3b72d9";  // fully used — neutral blue
    if (pct >= 80)  return "#c9931a";   // warning amber
    return "#1e9e6b";                    // green = under budget = good
  };

  const PIE_COLS = [
    "#3b72d9","#1e9e6b","#c9931a","#a678e8","#1e8fa0",
    "#d97b26","#7c5cdb","#2e9e7a","#d94f7c","#5b9bd9",
    "#8b6914","#4caf6a","#9e4f1e","#6878d9","#1e7a9e",
    "#b85ccc","#4f9e2e","#d94f4f","#7a8f1e","#cc7a5c"
  ];

  // Group small categories into "Other" — show top 10, bucket the rest
  const catMap = {};
  monthTx.filter(t => t.type === "expense").forEach(t => {
    const l = t.categoryLabel || "Uncategorized";
    catMap[l] = (catMap[l] || 0) + t.amount;
  });
  const totalExp = Object.values(catMap).reduce((s,v)=>s+v,0);
  const allSlices = Object.entries(catMap)
    .map(([name,value]) => ({ name, value }))
    .sort((a,b) => b.value - a.value);
  const TOP_N = 9;
  const topSlices  = allSlices.slice(0, TOP_N);
  const restSlices = allSlices.slice(TOP_N);
  const otherVal   = restSlices.reduce((s,s2)=>s+s2.value,0);
  const pieData = otherVal > 0
    ? [...topSlices, { name: `Other (${restSlices.length})`, value: otherVal }]
    : topSlices;

  const barData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month-5+i, 1); const m2 = d.getMonth(), y2 = d.getFullYear();
    const tx = transactions.filter(t => { const td = parseLocalDate(t.date); return td.getMonth()===m2 && td.getFullYear()===y2; });
    return { name: MONTHS[m2].slice(0,3), Income: tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0), Expenses: tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0) };
  });

  return (
    <div>
      <div className="page-header page-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><h1>Overview</h1><p>Family financial summary</p></div>
        <MonthNav month={month} year={year} onPrev={prevMonth} onNext={nextMonth} />
      </div>
      {/* ── Row 1: Cash summary ── */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-clickable" onClick={() => onNavigate && onNavigate({ type:"income", month, year })}
          title="View income transactions">
          <div className="kpi-label">Income <span className="kpi-nav-hint">→</span></div>
          <div className="kpi-value green">{fmt(income)}</div>
          <div className="kpi-sub">received this month</div>
        </div>
        <div className="kpi-card kpi-clickable" onClick={() => onNavigate && onNavigate({ type:"expense", month, year })}
          title="View expense transactions">
          <div className="kpi-label">Expenses <span className="kpi-nav-hint">→</span></div>
          <div className="kpi-value" style={{color: expensePct !== null && expensePct > 100 ? "var(--red)" : "var(--text)"}}>{fmt(expenses)}</div>
          <div className="kpi-sub">spent this month</div>
        </div>
        <div className="kpi-card kpi-clickable" onClick={() => onNavigate && onNavigate({ type:"all", month, year })}
          title="View all transactions">
          <div className="kpi-label">Balance <span className="kpi-nav-hint">→</span></div>
          <div className={`kpi-value ${balance>=0?"green":"red"}`}>{fmt(balance)}</div>
          <div className="kpi-sub">{balance>=0?"surplus this month":"deficit this month"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Saved</div>
          <div className="kpi-value gold">{fmt(totalSaved)}</div>
          <div className="kpi-sub">of {fmt(totalTarget)} goal</div>
        </div>
      </div>

      {/* ── Budget snapshot — single summary row, links to Budget page ── */}
      {(totalExpenseBudget > 0 || totalIncomeBudget > 0) && (
        <div className="kpi-card kpi-clickable" style={{marginBottom:20, borderLeft:"3px solid var(--gold)"}}
          onClick={() => onNavigate && onNavigate({ page:"budget", month, year })}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <div>
              <div className="kpi-label">Budget Plan — {MONTHS[month]} <span className="kpi-nav-hint">→ view full budget</span></div>
              <div style={{display:"flex",gap:20,marginTop:6,flexWrap:"wrap"}}>
                {totalExpenseBudget > 0 && (
                  <div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>Expenses</div>
                    <div style={{fontSize:15,fontWeight:600,color:expenses>totalExpenseBudget?"var(--red)":expenses===totalExpenseBudget?"var(--blue)":"var(--text)"}}>
                      {fmt(expenses)} <span style={{fontSize:11,color:"var(--text3)",fontWeight:400}}>of {fmt(totalExpenseBudget)}</span>
                    </div>
                  </div>
                )}
                {totalExpenseBudget > 0 && (
                  <div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>Remaining</div>
                    <div style={{fontSize:15,fontWeight:600,color:totalExpenseBudget-expenses>=0?"var(--green)":"var(--red)"}}>
                      {fmt(Math.abs(totalExpenseBudget-expenses))} {totalExpenseBudget-expenses>=0?"left":"over"}
                    </div>
                  </div>
                )}
                {totalIncomeBudget > 0 && (
                  <div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>Income</div>
                    <div style={{fontSize:15,fontWeight:600,color:lightColor(incomePct||0,"income")}}>
                      {incomePct}% received
                    </div>
                  </div>
                )}
              </div>
            </div>
            {totalExpenseBudget > 0 && (
              <div style={{minWidth:120}}>
                <div className="progress-bar" style={{height:6}}>
                  <div className="progress-fill" style={{width:Math.min(100,expensePct||0)+"%",background:lightColor(expensePct||0,"expense")}}/>
                </div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4,textAlign:"right"}}>{expensePct}% of budget used</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Income vs Expenses — 6 months</div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill:"rgba(26,26,46,0.45)", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"rgba(26,26,46,0.45)", fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Income" fill="#1e9e6b" radius={[4,4,0,0]} />
                <Bar dataKey="Expenses" fill="#7c9fd4" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Spending by Category</div>
          {pieData.length > 0
            ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">{pieData.map((entry,i) => {
                const cat = categories.find(c => c.label === entry.name);
                return <Cell key={i} fill={cat?.color || PIE_COLS[i % PIE_COLS.length]} />;
              })}</Pie><Tooltip content={<CustomTooltip />} formatter={(v,name)=>[fmt(v), `${name} (${Math.round(v/totalExp*100)}%)`]} /><Legend iconType="circle" iconSize={8} formatter={v=><span style={{color:"rgba(26,26,46,0.55)",fontSize:12}}>{v}</span>} /></PieChart></ResponsiveContainer></div>
            : <div className="empty"><p>No expenses this month</p></div>}
        </div>
      </div>
    </div>
  );
}

// ─── DOWNLOAD HELPERS ────────────────────────────────────────────────────────
function downloadBudgetCSV(plan, categories, transactions, month, year) {
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthTx = transactions.filter(t => {
    const d = parseLocalDate(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const actualMap = {};
  monthTx.forEach(t => { actualMap[t.categoryId] = (actualMap[t.categoryId] || 0) + t.amount; });

  const headers = ["Type","Category","Budgeted ($)","Actual ($)","Variance ($)","Fulfillment %"];
  const rows = [];

  const incCats = categories.filter(c => c.type === "income");
  const expCats = categories.filter(c => c.type === "expense");

  [...incCats, ...expCats].forEach(c => {
    const budget = plan[c.id] || 0;
    const actual = actualMap[c.id] || 0;
    if (budget === 0 && actual === 0) return;
    const variance = c.type === "income" ? actual - budget : budget - actual;
    const pct = budget > 0 ? Math.round(actual / budget * 100) : "";
    rows.push([c.type, c.label, budget, actual.toFixed(2), variance.toFixed(2), pct ? pct + "%" : "—"]);
  });

  // Totals row
  const totalIncBudget = incCats.reduce((s,c) => s+(plan[c.id]||0),0);
  const totalExpBudget = expCats.reduce((s,c) => s+(plan[c.id]||0),0);
  const totalIncActual = incCats.reduce((s,c) => s+(actualMap[c.id]||0),0);
  const totalExpActual = expCats.reduce((s,c) => s+(actualMap[c.id]||0),0);
  rows.push([]);
  rows.push(["SUMMARY","Total Income", totalIncBudget, totalIncActual.toFixed(2), (totalIncActual-totalIncBudget).toFixed(2), totalIncBudget>0?Math.round(totalIncActual/totalIncBudget*100)+"%":"—"]);
  rows.push(["SUMMARY","Total Expenses", totalExpBudget, totalExpActual.toFixed(2), (totalExpBudget-totalExpActual).toFixed(2), totalExpBudget>0?Math.round(totalExpActual/totalExpBudget*100)+"%":"—"]);
  rows.push(["SUMMARY","Net Savings", totalIncBudget-totalExpBudget, (totalIncActual-totalExpActual).toFixed(2), ((totalIncActual-totalExpActual)-(totalIncBudget-totalExpBudget)).toFixed(2), totalIncActual>0?Math.round((totalIncActual-totalExpActual)/totalIncActual*100)+"%":"—"]);

  const csv = [
    [`Budget Execution Report — ${MONTHS[month]} ${year}`],
    [],
    headers,
    ...rows
  ].map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `budget-execution-${year}-${String(month+1).padStart(2,"0")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


function downloadTransactions(transactions) {
  const headers = ["Date","Type","Category","Description","Amount","Paid By"];
  const rows = transactions.map(t => [t.date, t.type, t.categoryLabel||t.categoryId||"", t.description, t.amount, t.paidBy||""]);
  const csv  = [headers,...rows].map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "casa-budget-transactions.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ─── IMPORT MODAL ────────────────────────────────────────────────────────────

// ─── BANK STATEMENT IMPORT ────────────────────────────────────────────────────
// Supports Capital One CSV format:
// Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit

const MAPPING_STORAGE_KEY = "casaBudget_bankMappings";

function loadSavedMappings() {
  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveMappings(mappings) {
  try { localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mappings)); }
  catch { /* ignore */ }
}

// Normalize merchant name for matching
function normalizeMerchant(desc) {
  return desc
    .replace(/[*#@]/g, " ")
    .replace(/\s+\d{3,}.*$/, "")   // remove trailing numbers
    .replace(/\s+(SAS|LLC|INC|CORP|SA|DL)$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .substring(0, 30);
}

function parseBankCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], isCapitalOne: false };

  const parseRow = (line) => {
    const result = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === "," && !inQ) { result.push(cur.trim().replace(/^"|"$/g,"")); cur = ""; }
      else { cur += line[i]; }
    }
    result.push(cur.trim().replace(/^"|"$/g,""));
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim());
  const isCapitalOne = headers.includes("transaction date") && headers.includes("debit") && headers.includes("credit");
  const isAppFormat  = headers.includes("date") && headers.includes("type") && headers.includes("amount");

  if (!isCapitalOne && !isAppFormat) return { rows: [], isCapitalOne: false, error: "Unrecognized format. Expected Capital One or app export CSV." };

  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });

  return { rows, isCapitalOne, headers };
}



// ─── SIMPLEFIN SYNC MODAL ─────────────────────────────────────────────────────
const PROXY = "/.netlify/functions/simplefin-proxy";

async function sfProxy(body) {
  const res = await fetch(PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function SimplefinModal({ onClose, onImport, categories, user, db }) {
  const SF_KEY = `sf_url_${user?.uid || ""}`;

  const [step, setStep]           = useState(() => localStorage.getItem(SF_KEY) ? "ready" : "connect");
  const [token, setToken]         = useState("");
  const [accessUrl, setAccessUrl] = useState(() => localStorage.getItem(SF_KEY) || "");
  const [sfAccounts, setSfAccounts] = useState([]);
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [imported, setImported]   = useState(0);
  const [error, setError]         = useState("");

  const savedMappings = loadSavedMappings();

  // Auto-sync if already connected
  useEffect(() => {
    if (step === "ready" && accessUrl) doFetch(accessUrl);
  }, []);

  const handleClaim = async () => {
    if (!token.trim()) return;
    setLoading(true); setError("");
    try {
      const { accessUrl: url } = await sfProxy({ action: "claim", setupToken: token.trim() });
      localStorage.setItem(SF_KEY, url);
      setAccessUrl(url);
      setStep("syncing");
      await doFetch(url);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  const doFetch = async (url) => {
    setStep("syncing"); setLoading(true); setError(""); setRows([]);
    try {
      const { accounts, errors } = await sfProxy({ action: "fetch", accessUrl: url });
      if (errors?.length) setError("⚠ " + errors.join(" | "));
      setSfAccounts(accounts || []);

      // Flatten all transactions across all accounts
      const all = [];
      (accounts || []).forEach(acc => {
        (acc.transactions || []).forEach(tx => {
          const amt = parseFloat(tx.amount || "0");
          if (amt === 0) return;
          const raw  = tx.posted ? new Date(tx.posted * 1000) : new Date();
          const date = `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,"0")}-${String(raw.getDate()).padStart(2,"0")}`;
          all.push({
            date,
            description:   (tx.description || tx.payee || "Transaction").trim(),
            amount:        Math.abs(amt),
            type:          amt < 0 ? "expense" : "income",
            accountName:   acc.name || "",
            _merchantKey:  normalizeMerchant(tx.description || tx.payee || ""),
            categoryId:    "", categoryLabel: "", categoryIcon: "📦", categoryColor: "#888",
            _mapped:       false,
          });
        });
      });
      all.sort((a, b) => b.date.localeCompare(a.date));

      // Apply saved mappings first
      const newMappings = { ...savedMappings };
      all.forEach(r => {
        if (r.type === "expense" && newMappings[r._merchantKey]) {
          const cat = categories.find(c => c.id === newMappings[r._merchantKey]);
          if (cat) { r.categoryId=cat.id; r.categoryLabel=cat.label; r.categoryIcon=cat.icon; r.categoryColor=cat.color; r._mapped=true; }
        }
      });

      // AI map remaining
      const unmapped = {};
      all.forEach(r => { if (r.type==="expense" && !r._mapped) unmapped[r._merchantKey] = { description: r.description }; });
      const pending = Object.entries(unmapped).map(([key, val]) => ({ key, ...val }));

      if (pending.length > 0) {
        const catList = categories.filter(c=>c.type==="expense").map(c=>`${c.id}: ${c.label}`).join(", ");
        const BATCH = 15;
        for (let i = 0; i < pending.length; i += BATCH) {
          const batch = pending.slice(i, i + BATCH);
          try {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "claude-sonnet-4-6", max_tokens: 400,
                messages: [{ role: "user", content:
                  `Map these to budget categories. Return ONLY JSON array.
Categories: ${catList}
${batch.map((p,i)=>`${i}: "${p.description}"`).join("\n")}
Return: [{"index":0,"categoryId":"d_xxx"},...]`
                }]
              })
            });
            const data = await res.json();
            const raw  = data.content?.[0]?.text || "[]";
            const json = raw.match(/\[[\s\S]*\]/);
            if (json) {
              JSON.parse(json[0]).forEach(({ index, categoryId }) => {
                const item = batch[index];
                if (item && categoryId) newMappings[item.key] = categoryId;
              });
            }
          } catch(e) { console.warn("AI batch:", e); }
          setAiProgress(Math.min(100, Math.round((i+BATCH)/pending.length*100)));
        }
        // Apply AI mappings
        all.forEach(r => {
          if (!r._mapped && newMappings[r._merchantKey]) {
            const cat = categories.find(c=>c.id===newMappings[r._merchantKey]);
            if (cat) { r.categoryId=cat.id; r.categoryLabel=cat.label; r.categoryIcon=cat.icon; r.categoryColor=cat.color; r._mapped=true; }
          }
        });
        saveMappings(newMappings);
      }

      setRows(all);
      setStep("review");
    } catch(e) { setError(e.message); setStep(accessUrl ? "ready" : "connect"); }
    setLoading(false);
  };

  const updateRow = (idx, categoryId) => {
    const cat = categories.find(c=>c.id===categoryId);
    setRows(prev => prev.map((r,i) => i!==idx ? r : {
      ...r, categoryId:cat?.id||"", categoryLabel:cat?.label||"", categoryIcon:cat?.icon||"📦", categoryColor:cat?.color||"#888", _mapped:!!cat
    }));
  };

  const skipRow = (idx) => setRows(prev => prev.filter((_,i)=>i!==idx));

  const doImport = async () => {
    setImporting(true);
    let count = 0;
    for (const r of rows) {
      const { _merchantKey, _mapped, accountName, ...clean } = r;
      await onImport(clean);
      count++; setImported(count);
    }
    setStep("done");
    setImporting(false);
  };

  const disconnect = () => {
    localStorage.removeItem(SF_KEY);
    setAccessUrl(""); setToken(""); setRows([]); setSfAccounts([]);
    setStep("connect"); setError("");
  };

  const fmt    = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n||0);
  const fmtDec = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:660}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>⚡</span>
            <span className="modal-title">
              {step==="connect" && "Connect Bank via SimpleFIN"}
              {step==="ready"   && "Sync Bank Transactions"}
              {step==="syncing" && "Syncing…"}
              {step==="review"  && `Review ${rows.length} Transactions`}
              {step==="done"    && "Import Complete"}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}><Icon name="x"/></button>
        </div>

        {/* ── CONNECT ── */}
        {step==="connect" && (
          <div>
            <div style={{background:"var(--surface2)",borderRadius:12,padding:"14px 16px",marginBottom:16,fontSize:13,color:"var(--text3)",lineHeight:1.6}}>
              <strong style={{color:"var(--text2)",display:"block",marginBottom:6}}>How it works</strong>
              SimpleFIN connects to your bank and shares transactions with this app.
              Your bank credentials never touch Casa Budget — SimpleFIN handles the connection.
              Cost: <strong style={{color:"var(--text2)"}}>$1.50/month</strong> paid to SimpleFIN.
            </div>

            <div style={{marginBottom:16}}>
              {[
                ["1","Get a setup token","Go to simplefin.org/create → connect your bank → copy the Setup Token"],
                ["2","Paste it below","One-time setup — we store a private key so future syncs are one tap"],
              ].map(([n,title,desc])=>(
                <div key={n} style={{display:"flex",gap:12,marginBottom:10}}>
                  <div style={{width:24,height:24,borderRadius:"50%",background:"var(--gold-dim)",color:"var(--gold)",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</div>
                  <div><div style={{fontSize:13,fontWeight:500}}>{title}</div><div style={{fontSize:12,color:"var(--text3)"}}>{desc}</div></div>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>Setup Token (from SimpleFIN)</label>
              <textarea value={token} onChange={e=>setToken(e.target.value)}
                placeholder="Paste your SimpleFIN setup token here…"
                style={{height:70,resize:"none",fontFamily:"monospace",fontSize:11}}/>
            </div>
            {error && <div className="banner warning" style={{marginBottom:12}}>⚠ {error}</div>}
            <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
              <a href="https://beta-bridge.simplefin.org/simplefin/create" target="_blank" rel="noreferrer"
                style={{fontSize:12,color:"var(--gold)"}}>Get a token from SimpleFIN →</a>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleClaim} disabled={loading||!token.trim()}>
                  {loading?"Connecting…":"Connect"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── READY (already connected) ── */}
        {step==="ready" && (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:32,marginBottom:10}}>🏦</div>
            <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>Bank connected</div>
            <div style={{fontSize:12,color:"var(--text3)",marginBottom:20}}>
              {sfAccounts.length > 0
                ? sfAccounts.map(a=>a.name).join(", ")
                : "Ready to sync"}
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button className="btn btn-ghost btn-sm" onClick={disconnect} style={{color:"var(--red)"}}>Disconnect</button>
              <button className="btn btn-primary" onClick={()=>doFetch(accessUrl)} disabled={loading}>
                {loading?"Syncing…":"⚡ Sync now"}
              </button>
            </div>
          </div>
        )}

        {/* ── SYNCING ── */}
        {step==="syncing" && (
          <div style={{padding:"20px 0",textAlign:"center"}}>
            <div style={{fontSize:28,marginBottom:12}}>⏳</div>
            <div style={{fontSize:14,fontWeight:500,marginBottom:6}}>
              {aiProgress===0?"Fetching from bank…":`AI mapping merchants… ${aiProgress}%`}
            </div>
            {aiProgress>0 && (
              <div className="progress-bar" style={{height:6,maxWidth:260,margin:"8px auto 0"}}>
                <div className="progress-fill" style={{width:aiProgress+"%",background:"var(--gold)"}}/>
              </div>
            )}
            {error && <div className="banner warning" style={{marginTop:14}}>{error}</div>}
          </div>
        )}

        {/* ── REVIEW ── */}
        {step==="review" && (
          <div>
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              <div className="kpi-card" style={{flex:1,padding:"10px 14px"}}>
                <div className="kpi-label">Transactions</div>
                <div className="kpi-value">{rows.length}</div>
              </div>
              <div className="kpi-card" style={{flex:1,padding:"10px 14px"}}>
                <div className="kpi-label">Mapped</div>
                <div className="kpi-value green">{rows.filter(r=>r._mapped).length}</div>
              </div>
              <div className="kpi-card" style={{flex:1,padding:"10px 14px"}}>
                <div className="kpi-label">Unmapped</div>
                <div className="kpi-value" style={{color:rows.filter(r=>!r._mapped&&r.type==="expense").length>0?"var(--amber)":"var(--green)"}}>
                  {rows.filter(r=>!r._mapped&&r.type==="expense").length}
                </div>
              </div>
              <div className="kpi-card" style={{flex:1,padding:"10px 14px"}}>
                <div className="kpi-label">Total Spend</div>
                <div className="kpi-value" style={{fontSize:16,color:"var(--text)"}}>
                  {fmt(rows.filter(r=>r.type==="expense").reduce((s,r)=>s+r.amount,0))}
                </div>
              </div>
            </div>

            {error && <div className="banner warning" style={{marginBottom:10}}>{error}</div>}

            <div style={{maxHeight:280,overflowY:"auto",border:"1px solid var(--border)",borderRadius:10,marginBottom:14}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:"var(--surface2)",position:"sticky",top:0}}>
                    <th style={{padding:"7px 10px",textAlign:"left",color:"var(--text3)",fontWeight:500,whiteSpace:"nowrap"}}>Date</th>
                    <th style={{padding:"7px 10px",textAlign:"left",color:"var(--text3)",fontWeight:500}}>Description</th>
                    <th style={{padding:"7px 10px",textAlign:"left",color:"var(--text3)",fontWeight:500,minWidth:130}}>Category</th>
                    <th style={{padding:"7px 10px",textAlign:"right",color:"var(--text3)",fontWeight:500,whiteSpace:"nowrap"}}>Amount</th>
                    <th style={{padding:"7px 10px",width:30}}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r,i)=>(
                    <tr key={i} style={{borderTop:"1px solid var(--border)",background:!r._mapped&&r.type==="expense"?"rgba(201,147,26,0.04)":"transparent"}}>
                      <td style={{padding:"6px 10px",color:"var(--text3)",whiteSpace:"nowrap"}}>{r.date}</td>
                      <td style={{padding:"6px 10px",color:"var(--text)",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        <div style={{fontWeight:500}}>{r.description}</div>
                        <div style={{fontSize:10,color:"var(--text3)"}}>{r.accountName}</div>
                      </td>
                      <td style={{padding:"6px 10px"}}>
                        <select value={r.categoryId} onChange={e=>updateRow(i,e.target.value)}
                          style={{width:"100%",fontSize:12,background:"var(--surface2)",border:`1px solid ${!r._mapped&&r.type==="expense"?"var(--amber)":"var(--border)"}`,borderRadius:6,color:"var(--text)",padding:"3px 6px",outline:"none"}}>
                          <option value="">— Unassigned —</option>
                          {categories.filter(c=>c.type===r.type).map(c=>(
                            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{padding:"6px 10px",textAlign:"right",fontWeight:600,color:r.type==="income"?"var(--green)":"var(--red)",whiteSpace:"nowrap"}}>
                        {r.type==="income"?"+":"-"}{fmtDec(r.amount)}
                      </td>
                      <td style={{padding:"6px 10px",textAlign:"center"}}>
                        <button onClick={()=>skipRow(i)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14}}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importing && (
              <div style={{marginBottom:10}}>
                <div className="progress-bar" style={{height:5}}>
                  <div className="progress-fill" style={{width:`${Math.round(imported/rows.length*100)}%`,background:"var(--green)"}}/>
                </div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Importing {imported}/{rows.length}…</div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={disconnect} style={{color:"var(--red)",marginRight:"auto"}}>
                Disconnect bank
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={doImport} disabled={importing||rows.length===0}>
                {importing?`Importing…`:`Import ${rows.length} transactions`}
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step==="done" && (
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:40,marginBottom:10}}>✅</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Done!</div>
            <div style={{fontSize:13,color:"var(--text3)",marginBottom:20}}>{imported} transactions imported · Merchant mappings saved</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button className="btn btn-ghost" onClick={()=>{setStep("ready");setRows([]);setImported(0);}}>Sync again</button>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BankImportModal({ onClose, onImport, categories }) {
  const [step, setStep]           = useState("upload");   // upload | mapping | review | done
  const [rawRows, setRawRows]     = useState([]);
  const [mappings, setMappings]   = useState({});          // merchantKey -> { categoryId, confirmed }
  const [pendingRows, setPending] = useState([]);          // rows needing mapping decisions
  const [finalRows, setFinalRows] = useState([]);          // rows ready to import
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [imported, setImported]   = useState(0);
  const [error, setError]         = useState("");
  const [overlapCount, setOverlapCount] = useState(0);

  const savedMappings = loadSavedMappings();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows, isCapitalOne, error: parseErr } = parseBankCSV(ev.target.result);
      if (parseErr) { setError(parseErr); return; }

      // Normalize rows to common format
      const normalized = rows
        .filter(r => {
          // Skip Capital One payment rows
          if (isCapitalOne && r["category"] === "Payment/Credit") return false;
          // Skip empty amounts
          const debit  = parseFloat(r["debit"]  || r["amount"] || "0") || 0;
          const credit = parseFloat(r["credit"] || "0") || 0;
          return debit > 0 || credit > 0;
        })
        .map(r => {
          if (isCapitalOne) {
            const debit  = parseFloat(r["debit"]  || "0") || 0;
            const credit = parseFloat(r["credit"] || "0") || 0;
            const rawDate = r["transaction date"] || r["posted date"] || "";
            // Convert M/D/YYYY to YYYY-MM-DD
            const dateParts = rawDate.split("/");
            const isoDate = dateParts.length === 3
              ? `${dateParts[2]}-${dateParts[0].padStart(2,"0")}-${dateParts[1].padStart(2,"0")}`
              : rawDate;
            return {
              date:         isoDate,
              description:  r["description"]?.trim() || "",
              bankCategory: r["category"]?.trim() || "",
              amount:       credit > 0 ? credit : debit,
              type:         credit > 0 ? "income" : "expense",
              cardNo:       r["card no."] || "",
              _merchantKey: normalizeMerchant(r["description"] || ""),
            };
          } else {
            return {
              date:         r["date"],
              description:  r["description"],
              bankCategory: r["category"] || "",
              amount:       parseFloat(r["amount"]) || 0,
              type:         r["type"]?.toLowerCase() || "expense",
              _merchantKey: normalizeMerchant(r["description"] || ""),
            };
          }
        });

      setRawRows(normalized);

      // Apply saved mappings and find what still needs mapping
      const localMappings = { ...savedMappings };
      const needsMapping  = {};
      normalized.forEach(r => {
        if (r.type === "expense" && !localMappings[r._merchantKey]) {
          needsMapping[r._merchantKey] = {
            description:  r.description,
            bankCategory: r.bankCategory,
            count:        (needsMapping[r._merchantKey]?.count || 0) + 1,
            totalAmount:  (needsMapping[r._merchantKey]?.totalAmount || 0) + r.amount,
            categoryId:   "",
          };
        }
      });

      setMappings(localMappings);
      setPending(Object.entries(needsMapping).map(([key, val]) => ({ key, ...val })));
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  const runAIMapping = async () => {
    if (pending.length === 0) { buildFinalRows(mappings); return; }
    setAiLoading(true);
    setAiProgress(0);

    const catList = categories
      .filter(c => c.type === "expense")
      .map(c => `${c.id}: ${c.label}`)
      .join(", ");

    // Process in batches of 15
    const BATCH = 15;
    const newMappings = { ...mappings };

    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH);
      const prompt = `Map these bank transactions to budget categories. Return ONLY valid JSON array, no explanation.

Available expense categories: ${catList}

Transactions to map (merchant: bankCategory):
${batch.map((p,idx) => `${idx}: "${p.description}" (bank category: ${p.bankCategory})`).join("\n")}

Rules:
- Return array of {index, categoryId} objects
- categoryId must be one of the ids listed above, or null if truly none fits
- Use null for income-like entries (refunds, credits)
- RAPPI, delivery apps → use takeout/delivery category if exists, else dining
- Juan Valdez, Starbucks, Vigilante → coffee category
- Amazon, Mercado Libre → most likely merchandise/shopping
- Farmatodo, pharmacy → pharmacy/health
- Apple.com/Bill, streaming → entertainment/streaming

Return: [{"index":0,"categoryId":"d_xxx"},...]`;

      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }]
          })
        });
        const data = await res.json();
        const raw  = data.content?.[0]?.text || "[]";
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const results = JSON.parse(jsonMatch[0]);
          results.forEach(({ index, categoryId }) => {
            const item = batch[index];
            if (item && categoryId) {
              newMappings[item.key] = categoryId;
            }
          });
        }
      } catch(e) { console.error("AI batch error:", e); }

      setAiProgress(Math.min(100, Math.round((i + BATCH) / pending.length * 100)));
    }

    setMappings(newMappings);
    buildFinalRows(newMappings, pending);
    setAiLoading(false);
  };

  const buildFinalRows = (currentMappings, stillPending) => {
    const rows = rawRows.map(r => {
      let categoryId = r.type === "income" ? "" : (currentMappings[r._merchantKey] || "");
      // For income rows, try to find an income category
      if (r.type === "income") {
        const incomeCat = categories.find(c => c.type === "income" && c.label.toLowerCase().includes("other"));
        categoryId = incomeCat?.id || "";
      }
      const cat = categories.find(c => c.id === categoryId);
      return {
        ...r,
        categoryId:    cat?.id    || "",
        categoryLabel: cat?.label || r.bankCategory || "Uncategorized",
        categoryIcon:  cat?.icon  || "📦",
        categoryColor: cat?.color || "#888",
        paidBy:        "",
        _mapped:       !!cat,
      };
    });

    const unmappedCount = rows.filter(r => r.type === "expense" && !r._mapped).length;
    setFinalRows(rows);
    setOverlapCount(unmappedCount);
    setStep("review");
  };

  const updateRowMapping = (idx, categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    setFinalRows(prev => prev.map((r, i) => i !== idx ? r : {
      ...r,
      categoryId:    cat?.id    || "",
      categoryLabel: cat?.label || "Uncategorized",
      categoryIcon:  cat?.icon  || "📦",
      categoryColor: cat?.color || "#888",
      _mapped:       !!cat,
    }));
  };

  const doImport = async () => {
    // Save all mappings for future use
    const finalMappings = { ...mappings };
    finalRows.forEach(r => {
      if (r.categoryId) finalMappings[r._merchantKey] = r.categoryId;
    });
    saveMappings(finalMappings);

    setImporting(true);
    let count = 0;
    for (const r of finalRows) {
      const { _merchantKey, _mapped, bankCategory, cardNo, ...clean } = r;
      await onImport(clean);
      count++;
      setImported(count);
    }
    setStep("done");
    setImporting(false);
  };

  const skipRow = (idx) => setFinalRows(prev => prev.filter((_, i) => i !== idx));

  const fmtDec = (n) => `$${(n||0).toFixed(2)}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            {step === "upload"  && "Import Bank Statement"}
            {step === "mapping" && "AI Category Mapping"}
            {step === "review"  && `Review ${finalRows.length} Transactions`}
            {step === "done"    && "Import Complete"}
          </span>
          <button className="modal-close" onClick={onClose}><Icon name="x"/></button>
        </div>

        {/* ── STEP: UPLOAD ── */}
        {step === "upload" && (
          <div>
            <div style={{ background:"var(--surface2)", border:"2px dashed var(--border2)", borderRadius:12, padding:"32px 24px", textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🏦</div>
              <div style={{ fontSize:14, fontWeight:500, color:"var(--text)", marginBottom:6 }}>Upload your bank statement CSV</div>
              <div style={{ fontSize:12, color:"var(--text3)", marginBottom:20 }}>
                Capital One format supported · App export format also works
              </div>
              <input type="file" accept=".csv" id="bank-csv-upload" style={{ display:"none" }} onChange={handleFile} />
              <label htmlFor="bank-csv-upload" className="btn btn-primary" style={{ cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7 }}>
                <Icon name="upload" size={14}/> Choose CSV file
              </label>
            </div>
            {error && <div className="banner warning">⚠ {error}</div>}
            <div style={{ background:"var(--surface2)", borderRadius:10, padding:"12px 16px", fontSize:12, color:"var(--text3)" }}>
              <div style={{ fontWeight:500, color:"var(--text2)", marginBottom:6 }}>How to export from Capital One:</div>
              <div>1. Log in → Transactions tab → Download Transactions</div>
              <div>2. Choose CSV format → select date range → Download</div>
              <div style={{ marginTop:8, color:"var(--text3)" }}>Payment rows are automatically skipped. AI will map merchants to your categories.</div>
            </div>
          </div>
        )}

        {/* ── STEP: MAPPING ── */}
        {step === "mapping" && (
          <div>
            <div style={{ background:"var(--surface2)", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{rawRows.length} transactions found</div>
                  <div style={{ fontSize:12, color:"var(--text3)", marginTop:2 }}>
                    {rawRows.filter(r => r.type==="expense").length} expenses · {rawRows.filter(r => r.type==="income").length} income/credits
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12, color:"var(--text3)" }}>
                    {Object.keys(savedMappings).length > 0
                      ? `✓ ${Object.keys(savedMappings).length} merchants already mapped from history`
                      : "No saved mappings yet"}
                  </div>
                  <div style={{ fontSize:12, color:"var(--text3)", marginTop:2 }}>
                    {pending.length} merchants need mapping
                  </div>
                </div>
              </div>
              {pending.length > 0 && (
                <div style={{ background:"var(--gold-dim)", border:"1px solid rgba(201,147,26,0.2)", borderRadius:8, padding:"10px 12px", fontSize:12, color:"var(--gold)", marginBottom:10 }}>
                  ✦ AI will map {pending.length} new merchants to your categories automatically
                </div>
              )}
            </div>

            {aiLoading && (
              <div style={{ marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                  <span style={{ color:"var(--text2)" }}>Mapping with AI...</span>
                  <span style={{ color:"var(--gold)" }}>{aiProgress}%</span>
                </div>
                <div className="progress-bar" style={{ height:8 }}>
                  <div className="progress-fill" style={{ width:aiProgress+"%", background:"var(--gold)" }}/>
                </div>
                <div style={{ fontSize:11, color:"var(--text3)", marginTop:6 }}>Analyzing merchant names and matching to your categories</div>
              </div>
            )}

            {pending.length > 0 && !aiLoading && (
              <div style={{ maxHeight:200, overflowY:"auto", marginBottom:16, border:"1px solid var(--border)", borderRadius:10 }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ background:"var(--surface2)", position:"sticky", top:0 }}>
                      <th style={{ padding:"7px 10px", textAlign:"left", color:"var(--text3)", fontWeight:500 }}>Merchant</th>
                      <th style={{ padding:"7px 10px", textAlign:"left", color:"var(--text3)", fontWeight:500 }}>Bank Category</th>
                      <th style={{ padding:"7px 10px", textAlign:"right", color:"var(--text3)", fontWeight:500 }}>Count / Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((p, i) => (
                      <tr key={i} style={{ borderTop:"1px solid var(--border)" }}>
                        <td style={{ padding:"6px 10px", color:"var(--text)", fontWeight:500, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.description}</td>
                        <td style={{ padding:"6px 10px", color:"var(--text3)" }}>{p.bankCategory}</td>
                        <td style={{ padding:"6px 10px", textAlign:"right", color:"var(--text3)" }}>{p.count}× · {fmtDec(p.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pending.length === 0 && (
              <div className="banner success" style={{ marginBottom:16 }}>✓ All merchants already mapped from your import history!</div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={runAIMapping} disabled={aiLoading}>
                {aiLoading ? "Mapping..." : pending.length > 0 ? `✦ Map ${pending.length} merchants with AI` : "Continue to Review →"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: REVIEW ── */}
        {step === "review" && (
          <div>
            <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
              <div className="kpi-card" style={{ flex:1, padding:"10px 14px" }}>
                <div className="kpi-label">Total</div>
                <div className="kpi-value">{finalRows.length}</div>
                <div className="kpi-sub">transactions</div>
              </div>
              <div className="kpi-card" style={{ flex:1, padding:"10px 14px" }}>
                <div className="kpi-label">Mapped</div>
                <div className="kpi-value green">{finalRows.filter(r=>r._mapped).length}</div>
                <div className="kpi-sub">to your categories</div>
              </div>
              <div className="kpi-card" style={{ flex:1, padding:"10px 14px" }}>
                <div className="kpi-label">Unmapped</div>
                <div className="kpi-value" style={{ color: overlapCount > 0 ? "var(--amber)" : "var(--green)" }}>{overlapCount}</div>
                <div className="kpi-sub">needs manual fix</div>
              </div>
              <div className="kpi-card" style={{ flex:1, padding:"10px 14px" }}>
                <div className="kpi-label">Total Spend</div>
                <div className="kpi-value red">{fmtDec(finalRows.filter(r=>r.type==="expense").reduce((s,r)=>s+r.amount,0))}</div>
                <div className="kpi-sub">expenses</div>
              </div>
            </div>

            <div style={{ maxHeight:320, overflowY:"auto", border:"1px solid var(--border)", borderRadius:10, marginBottom:14 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"var(--surface2)", position:"sticky", top:0 }}>
                    <th style={{ padding:"7px 10px", textAlign:"left", color:"var(--text3)", fontWeight:500, minWidth:80 }}>Date</th>
                    <th style={{ padding:"7px 10px", textAlign:"left", color:"var(--text3)", fontWeight:500 }}>Description</th>
                    <th style={{ padding:"7px 10px", textAlign:"left", color:"var(--text3)", fontWeight:500 }}>Category</th>
                    <th style={{ padding:"7px 10px", textAlign:"right", color:"var(--text3)", fontWeight:500 }}>Amount</th>
                    <th style={{ padding:"7px 10px", textAlign:"center", color:"var(--text3)", fontWeight:500, width:36 }}>✕</th>
                  </tr>
                </thead>
                <tbody>
                  {finalRows.map((r, i) => (
                    <tr key={i} style={{ borderTop:"1px solid var(--border)", background: !r._mapped && r.type==="expense" ? "rgba(201,147,26,0.04)" : "transparent" }}>
                      <td style={{ padding:"6px 10px", color:"var(--text3)", whiteSpace:"nowrap" }}>{r.date}</td>
                      <td style={{ padding:"6px 10px", color:"var(--text)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.description}</td>
                      <td style={{ padding:"6px 10px", minWidth:140 }}>
                        <select
                          value={r.categoryId}
                          onChange={e => updateRowMapping(i, e.target.value)}
                          style={{ width:"100%", fontSize:12, background:"var(--surface2)", border:`1px solid ${!r._mapped && r.type==="expense" ? "var(--amber)" : "var(--border)"}`, borderRadius:6, color:"var(--text)", padding:"3px 6px", outline:"none" }}>
                          <option value="">— Unassigned —</option>
                          {categories.filter(c => c.type === r.type).map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding:"6px 10px", textAlign:"right", fontWeight:600, color:r.type==="income"?"var(--green)":"var(--red)", whiteSpace:"nowrap" }}>
                        {r.type==="income"?"+":"-"}{fmtDec(r.amount)}
                      </td>
                      <td style={{ padding:"6px 10px", textAlign:"center" }}>
                        <button onClick={() => skipRow(i)} style={{ background:"none", border:"none", color:"var(--text3)", cursor:"pointer", fontSize:14, lineHeight:1 }} title="Skip this transaction">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {overlapCount > 0 && (
              <div className="banner warning" style={{ marginBottom:10 }}>
                ⚠ {overlapCount} transactions are unassigned — use the dropdowns above to fix, or import as-is
              </div>
            )}

            {importing && (
              <div style={{ marginBottom:12 }}>
                <div className="progress-bar" style={{ height:6 }}>
                  <div className="progress-fill" style={{ width: `${Math.round(imported/finalRows.length*100)}%`, background:"var(--green)" }}/>
                </div>
                <div style={{ fontSize:11, color:"var(--text3)", marginTop:4 }}>Importing {imported} of {finalRows.length}...</div>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setStep("mapping")}>← Back</button>
              <button className="btn btn-primary" onClick={doImport} disabled={importing}>
                {importing ? `Importing ${imported}/${finalRows.length}...` : `Import ${finalRows.length} transactions`}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === "done" && (
          <div style={{ textAlign:"center", padding:"28px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>Import complete!</div>
            <div style={{ fontSize:13, color:"var(--text3)", marginBottom:8 }}>
              {imported} transactions imported successfully.
            </div>
            <div style={{ fontSize:12, color:"var(--green)", marginBottom:24 }}>
              ✓ Merchant mappings saved — future imports will be faster
            </div>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportModal({ onClose, onImport, categories }) {
  const [step, setStep]         = useState("upload"); // upload | preview | done
  const [rows, setRows]         = useState([]);
  const [errors, setErrors]     = useState([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported]   = useState(0);

  const REQUIRED_COLS = ["date","type","category","description","amount"];

  const parseCSV = (text) => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    const parseRow = line => {
      const result = []; let cur = ""; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQ = !inQ; }
        else if (line[i] === "," && !inQ) { result.push(cur.trim()); cur = ""; }
        else { cur += line[i]; }
      }
      result.push(cur.trim());
      return result;
    };
    const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g,""));
    const rows = lines.slice(1).map((line, i) => {
      const vals = parseRow(line);
      const obj = {};
      headers.forEach((h, j) => { obj[h] = vals[j] || ""; });
      obj._line = i + 2;
      return obj;
    });
    return { headers, rows };
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows: parsed } = parseCSV(ev.target.result);
      const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
      if (missing.length > 0) {
        setErrors([`Missing required columns: ${missing.join(", ")}. Expected: Date, Type, Category, Description, Amount`]);
        return;
      }
      const errs = [];
      const valid = parsed.map(r => {
        const rowErrs = [];
        if (!r.date || isNaN(Date.parse(r.date))) rowErrs.push("invalid date");
        if (!["income","expense"].includes(r.type?.toLowerCase())) rowErrs.push("type must be 'income' or 'expense'");
        if (!r.description?.trim()) rowErrs.push("missing description");
        const amt = parseFloat(r.amount);
        if (isNaN(amt) || amt <= 0) rowErrs.push("amount must be a positive number");
        if (rowErrs.length > 0) errs.push(`Row ${r._line}: ${rowErrs.join(", ")}`);
        // Match category by label (case-insensitive)
        const cat = categories.find(c => c.label.toLowerCase() === r.category?.toLowerCase() && c.type === r.type?.toLowerCase());
        return {
          ...r,
          type: r.type?.toLowerCase(),
          amount: amt,
          categoryId: cat?.id || "",
          categoryLabel: cat?.label || r.category || "Uncategorized",
          categoryIcon: cat?.icon || "📦",
          categoryColor: cat?.color || "#888",
          paidBy: r.paidby || r["paid by"] || "",
          _valid: rowErrs.length === 0,
          _catFound: !!cat,
        };
      }).filter(r => r._valid);
      setRows(valid);
      setErrors(errs);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    setImporting(true);
    let count = 0;
    for (const r of rows) {
      await onImport(r);
      count++;
      setImported(count);
    }
    setStep("done");
    setImporting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Import Transactions</span>
          <button className="modal-close" onClick={onClose}><Icon name="x" /></button>
        </div>

        {step === "upload" && (
          <div>
            <div style={{ background:"var(--surface2)", border:"1px dashed var(--border)", borderRadius:10, padding:"28px", textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>📂</div>
              <div style={{ fontSize:13, color:"var(--text2)", marginBottom:12 }}>Upload a CSV file with your transactions</div>
              <input type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }} id="csv-upload" />
              <label htmlFor="csv-upload" className="btn btn-primary" style={{ cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, padding:"9px 16px", borderRadius:8, background:"var(--gold)", color:"#fff", fontSize:13, fontWeight:500 }}>
                <Icon name="upload" size={14} /> Choose CSV file
              </label>
            </div>

            {errors.length > 0 && (
              <div style={{ background:"var(--red-dim)", borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
                {errors.map((e,i) => <div key={i} style={{ fontSize:12, color:"var(--red)", marginBottom:3 }}>⚠ {e}</div>)}
              </div>
            )}

            <div style={{ background:"var(--surface2)", borderRadius:8, padding:"12px 14px" }}>
              <div style={{ fontSize:12, fontWeight:500, color:"var(--text2)", marginBottom:8 }}>Required CSV format</div>
              <code style={{ fontSize:11, color:"var(--text3)", lineHeight:1.8, display:"block" }}>
                Date, Type, Category, Description, Amount, Paid By<br/>
                2024-04-01, expense, Supermarket, Whole Foods, 120.50, Nicolas<br/>
                2024-04-01, income, Salary, April paycheck, 5000, Nicolas
              </code>
              <div style={{ fontSize:11, color:"var(--text3)", marginTop:8 }}>
                • Date format: YYYY-MM-DD &nbsp;•&nbsp; Type: income or expense<br/>
                • Category must match an existing category name exactly<br/>
                • Amount must be a positive number
              </div>
            </div>
            <div style={{ marginTop:12, fontSize:12, color:"var(--text3)" }}>
              💡 Tip: Export your transactions first to see the exact format expected.
            </div>
          </div>
        )}

        {step === "preview" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:13, color:"var(--text2)" }}>
                <span style={{ color:"#4caf88", fontWeight:500 }}>{rows.length} valid rows</span> ready to import
                {errors.length > 0 && <span style={{ color:"#e05c5c", marginLeft:8 }}>{errors.length} rows skipped</span>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setStep("upload"); setRows([]); setErrors([]); }}>← Back</button>
            </div>

            {errors.length > 0 && (
              <div style={{ background:"var(--red-dim)", borderRadius:8, padding:"10px 14px", marginBottom:12, maxHeight:80, overflowY:"auto" }}>
                {errors.map((e,i) => <div key={i} style={{ fontSize:11, color:"var(--red)", marginBottom:2 }}>⚠ {e}</div>)}
              </div>
            )}

            <div style={{ maxHeight:260, overflowY:"auto", border:"1px solid var(--border)", borderRadius:8, marginBottom:16 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:"var(--surface2)", position:"sticky", top:0 }}>
                    {["Date","Type","Category","Description","Amount","Paid By"].map(h => (
                      <th key={h} style={{ padding:"7px 10px", textAlign:"left", color:"var(--text3)", fontWeight:500, fontSize:11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r,i) => (
                    <tr key={i} style={{ borderTop:"1px solid var(--border)" }}>
                      <td style={{ padding:"6px 10px", color:"var(--text3)" }}>{r.date}</td>
                      <td style={{ padding:"6px 10px" }}>
                        <span className={`badge ${r.type==="income"?"green":"red"}`}>{r.type}</span>
                      </td>
                      <td style={{ padding:"6px 10px", color: r._catFound?"var(--text)":"#e8a547" }}>
                        {r.categoryLabel}{!r._catFound && " ⚠"}
                      </td>
                      <td style={{ padding:"6px 10px", color:"var(--text2)" }}>{r.description}</td>
                      <td style={{ padding:"6px 10px", color: r.type==="income"?"#4caf88":"#e05c5c", fontWeight:500 }}>
                        ${r.amount.toFixed(2)}
                      </td>
                      <td style={{ padding:"6px 10px", color:"var(--text3)" }}>{r.paidBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.some(r => !r._catFound) && (
              <div style={{ fontSize:12, color:"#e8a547", marginBottom:12 }}>
                ⚠ Rows marked with ⚠ have unrecognized categories — they'll import as "Uncategorized". Create the category first and re-import to fix.
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={doImport} disabled={importing || rows.length===0}>
                {importing ? `Importing ${imported}/${rows.length}...` : `Import ${rows.length} transactions`}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div style={{ textAlign:"center", padding:"28px 0" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:16, fontWeight:500, marginBottom:8 }}>Import complete!</div>
            <div style={{ fontSize:13, color:"var(--text3)", marginBottom:24 }}>{imported} transactions added successfully.</div>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE: TRANSACTIONS ───────────────────────────────────────────────────────
function TransactionsPage({ transactions, categories, onDelete, onEdit, onImport, initialFilter, onFilterConsumed, sfUser, db }) {
  const now = new Date();
  const [month, setMonth]             = useState(initialFilter?.month ?? now.getMonth());
  const [year, setYear]               = useState(initialFilter?.year  ?? now.getFullYear());
  const [typeFilter, setTypeFilter]   = useState(initialFilter?.type  ?? "all");
  const [catFilter, setCatFilter]     = useState("all");

  // Consume the initial filter once on mount so back-navigation doesn't re-apply it
  useEffect(() => {
    if (initialFilter && onFilterConsumed) onFilterConsumed();
  }, []); // eslint-disable-line
  const [search, setSearch]           = useState("");
  const [editTx, setEditTx]           = useState(null);
  const [showImport, setShowImport]         = useState(false);
  const [showBankImport, setShowBankImport] = useState(false);
  const [showSimplefin, setShowSimplefin]   = useState(false);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); setCatFilter("all"); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); setCatFilter("all"); };

  // Filter to selected month first
  const monthTx = transactions.filter(t => {
    const d = parseLocalDate(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  // Category totals within the selected month
  const catTotals = {};
  monthTx.forEach(t => {
    const key = t.categoryId || "other";
    if (!catTotals[key]) catTotals[key] = { label: t.categoryLabel || t.categoryId || "Other", icon: t.categoryIcon || "📦", color: t.categoryColor || "#888", type: t.type, income: 0, expense: 0 };
    if (t.type === "income") catTotals[key].income += t.amount;
    else catTotals[key].expense += t.amount;
  });

  const totalIncome  = monthTx.filter(t => t.type === "income").reduce((s,t) => s + t.amount, 0);
  const totalExpense = monthTx.filter(t => t.type === "expense").reduce((s,t) => s + t.amount, 0);

  // Apply type, category and search filters on top of month
  const filtered = monthTx.filter(t => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (catFilter  !== "all" && (t.categoryId || "other") !== catFilter) return false;
    if (search && !t.description?.toLowerCase().includes(search.toLowerCase()) &&
        !t.categoryLabel?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredIncome  = filtered.filter(t => t.type === "income").reduce((s,t) => s + t.amount, 0);
  const filteredExpense = filtered.filter(t => t.type === "expense").reduce((s,t) => s + t.amount, 0);

  // Category list sorted by total descending
  const sortedCats = Object.entries(catTotals)
    .filter(([, c]) => typeFilter === "all" || c.type === typeFilter)
    .sort(([,a],[,b]) => (b.income + b.expense) - (a.income + a.expense));

  const clearFilters = () => { setTypeFilter("all"); setCatFilter("all"); setSearch(""); };
  const hasFilters = typeFilter !== "all" || catFilter !== "all" || search !== "";

  return (
    <div>
      <div className="page-header page-header-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
        <div><h1>Transactions</h1><p>{MONTHS[month]} {year}</p></div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <MonthNav month={month} year={year} onPrev={prevMonth} onNext={nextMonth} />
          <button className="btn btn-ghost btn-sm" onClick={() => setShowBankImport(true)} title="Import Capital One or bank statement CSV">
            🏦 Bank Import
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowSimplefin(true)}>
            ⚡ Sync Bank
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}><Icon name="upload" size={13} /> App CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadTransactions(filtered)}><Icon name="download" size={13} /> Export CSV</button>
        </div>
      </div>

      <div className="tx-split" style={{ display:"flex", gap:16, alignItems:"flex-start" }}>

        {/* ── LEFT: category filter sidebar ── */}
        <div className="tx-sidebar" style={{ width:200, flexShrink:0 }}>
          <div className="card" style={{ padding:"12px 0" }}>
            {/* Type tabs */}
            <div className="tx-type-btns tx-type-row" style={{ padding:"0 12px 10px", borderBottom:"1px solid var(--border)" }}>
              {["all","income","expense"].map(f => (
                <button key={f}
                  onClick={() => { setTypeFilter(f); setCatFilter("all"); }}
                  style={{ display:"block", width:"100%", textAlign:"left", padding:"6px 8px", borderRadius:6, border:"none", cursor:"pointer", fontSize:13, fontWeight: typeFilter===f ? 500 : 400, background: typeFilter===f ? "var(--gold-dim)" : "transparent", color: typeFilter===f ? "var(--gold)" : "var(--text3)", marginBottom:2 }}>
                  {f === "all" ? "All Types" : f === "income" ? "💵 Income" : "💸 Expenses"}
                </button>
              ))}
            </div>

            {/* Category list */}
            <div className="tx-cat-list tx-cat-scroll" style={{ padding:"10px 12px 4px", display:"flex", flexDirection:"column" }}>
              <div style={{ fontSize:11, fontWeight:500, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>By Category</div>
              <button
                onClick={() => setCatFilter("all")}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"5px 8px", borderRadius:6, border:"none", cursor:"pointer", fontSize:12, background: catFilter==="all" ? "var(--surface2)" : "transparent", color:"var(--text2)", marginBottom:2 }}>
                <span>All categories</span>
              </button>
              {sortedCats.map(([catId, c]) => {
                const total = typeFilter === "income" ? c.income : typeFilter === "expense" ? c.expense : c.income + c.expense;
                const isActive = catFilter === catId;
                return (
                  <button key={catId}
                    onClick={() => setCatFilter(isActive ? "all" : catId)}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"5px 8px", borderRadius:6, border:"none", cursor:"pointer", fontSize:12, background: isActive ? c.color+"22" : "transparent", color: isActive ? c.color : "var(--text3)", marginBottom:2 }}>
                    <span style={{ display:"flex", alignItems:"center", gap:6, minWidth:0 }}>
                      <span style={{ fontSize:13 }}>{c.icon}</span>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.label}</span>
                    </span>
                    <span style={{ fontSize:11, fontWeight:500, flexShrink:0, marginLeft:4 }}>
                      {fmt(total)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT: transaction list ── */}
        <div style={{ flex:1, minWidth:0 }}>
          {/* Summary bar */}
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            <div className="kpi-card" style={{ flex:1, minWidth:120, padding:"12px 16px" }}>
              <div className="kpi-label">Income</div>
              <div className="kpi-value green" style={{ fontSize:18 }}>{fmt(filteredIncome)}</div>
              {hasFilters && filteredIncome !== totalIncome && <div className="kpi-sub">{fmt(totalIncome)} total</div>}
            </div>
            <div className="kpi-card" style={{ flex:1, minWidth:120, padding:"12px 16px" }}>
              <div className="kpi-label">Expenses</div>
              <div className="kpi-value" style={{ fontSize:18, color:"var(--text)" }}>{fmt(filteredExpense)}</div>
              {hasFilters && filteredExpense !== totalExpense && <div className="kpi-sub">{fmt(totalExpense)} total</div>}
            </div>
            <div className="kpi-card" style={{ flex:1, minWidth:120, padding:"12px 16px" }}>
              <div className="kpi-label">Net</div>
              <div className={`kpi-value ${filteredIncome - filteredExpense >= 0 ? "green" : "red"}`} style={{ fontSize:18 }}>{fmt(filteredIncome - filteredExpense)}</div>
              <div className="kpi-sub">{filtered.length} {filtered.length===1?"transaction":"transactions"}</div>
            </div>
          </div>

          {/* Search + clear */}
          <div style={{ display:"flex", gap:10, marginBottom:14 }}>
            <input
              style={{ flex:1, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", color:"var(--text)", fontFamily:"var(--font)", fontSize:13, padding:"7px 12px", outline:"none" }}
              placeholder="Search description or category..." value={search} onChange={e => setSearch(e.target.value)} />
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ whiteSpace:"nowrap" }}>
                Clear filters
              </button>
            )}
          </div>

          {/* Transaction list */}
          <div className="card">
            {filtered.length === 0 ? (
              <div className="empty"><div className="empty-icon">🔍</div><p>No transactions match your filters</p></div>
            ) : (
              <div className="tx-list">
                {filtered.map(t => (
                  <div key={t.id} className="tx-item">
                    <div className="tx-icon" style={{ background:(t.categoryColor||"#888")+"22" }}><span style={{ fontSize:16 }}>{t.categoryIcon||"📦"}</span></div>
                    <div className="tx-info">
                      <div className="tx-desc">{t.description}</div>
                      <div className="tx-meta">{t.categoryLabel||t.categoryId} · {t.date} · {t.paidBy||"—"}</div>
                    </div>
                    <div className={`tx-amount ${t.type}`}>{t.type==="income"?"+":"-"}{fmtDec(t.amount)}</div>
                    <div className="tx-actions">
                      <button className="btn btn-ghost btn-icon" onClick={() => setEditTx(t)}><Icon name="edit" size={14} /></button>
                      <button className="btn btn-ghost btn-icon" onClick={() => { if(window.confirm("Delete this transaction?")) onDelete("transactions",t.id); }}><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editTx && <TxModal tx={editTx} onClose={() => setEditTx(null)} user={null} categories={categories}
        onSave={async (data) => { await onEdit(editTx.id, data); setEditTx(null); }} />}
      {showImport     && <ImportModal      onClose={() => setShowImport(false)}      onImport={onImport} categories={categories} />}
      {showBankImport && <BankImportModal  onClose={() => setShowBankImport(false)}  onImport={onImport} categories={categories} />}
      {showSimplefin  && <SimplefinModal   onClose={() => setShowSimplefin(false)}   onImport={onImport} categories={categories} user={sfUser} db={db}/>}
    </div>
  );
}

// ─── PAGE: SAVINGS GOALS ──────────────────────────────────────────────────────
function GoalModal({ goal, onClose, onSave }) {
  const [form, setForm] = useState(goal||{ name:"", target:"", saved:"", icon:"🎯", deadline:"" });
  const save = async () => {
    if (!form.name||!form.target) return;
    await onSave({ ...form, target:parseFloat(form.target), saved:parseFloat(form.saved||0) });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{goal?"Edit Goal":"New Savings Goal"}</span>
          <button className="modal-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="form-row">
          {err && <div style={{color:"var(--red)",fontSize:12,marginBottom:10,background:"var(--red-dim)",padding:"8px 12px",borderRadius:6}}>{err}</div>}
          <div className="form-group"><label>Goal Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Emergency Fund" /></div>
          <div className="form-group"><label>Icon</label><input value={form.icon} onChange={e=>setForm(f=>({...f,icon:e.target.value}))} maxLength={2} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Target ($)</label><input type="number" value={form.target} onChange={e=>setForm(f=>({...f,target:e.target.value}))} placeholder="5000" /></div>
          <div className="form-group"><label>Already Saved ($)</label><input type="number" value={form.saved} onChange={e=>setForm(f=>({...f,saved:e.target.value}))} placeholder="0" /></div>
        </div>
        <div className="form-group"><label>Target Date</label><input type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} /></div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>{goal?"Save":"Create Goal"}</button>
        </div>
      </div>
    </div>
  );
}

function GoalsPage({ goals, onDelete, onEdit }) {
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal]   = useState(null);
  const totalSaved  = goals.reduce((s,g)=>s+(g.saved||0),0);
  const totalTarget = goals.reduce((s,g)=>s+(g.target||0),0);
  const overallPct  = totalTarget>0?Math.min(100,Math.round(totalSaved/totalTarget*100)):0;
  const colors = ["#e8c547","#4caf88","#5b8dee","#a678e8","#e8a547","#e05c5c"];
  return (
    <div>
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div><h1>Savings Goals</h1><p>Track your family's savings targets</p></div>
        <button className="btn btn-primary" onClick={() => { setEditGoal(null); setShowModal(true); }}><Icon name="plus" size={14} /> Add Goal</button>
      </div>
      {goals.length > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
            <div className="card-title">Overall Progress</div>
            <span style={{ fontSize:13, color:"var(--gold)", fontWeight:600 }}>{overallPct}%</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width:overallPct+"%", background:"var(--gold)" }} /></div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:12, color:"var(--text3)" }}>
            <span>{fmt(totalSaved)} saved</span><span>{fmt(totalTarget)} total</span>
          </div>
        </div>
      )}
      <div className="card">
        {goals.length===0 ? <div className="empty"><div className="empty-icon">🎯</div><p>No savings goals yet</p></div> : goals.map((g,i) => {
          const pct = g.target>0?Math.round(g.saved/g.target*100):0;
          const color = colors[i%colors.length];
          return (
            <div key={g.id} className="goal-item">
              <div className="goal-header">
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:20 }}>{g.icon||"🎯"}</span>
                  <div><div className="goal-name">{g.name}</div>{g.deadline&&<div className="goal-amounts">By {g.deadline}</div>}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div className="goal-amounts">{fmt(g.saved)} / {fmt(g.target)}</div>
                  <span style={{ fontSize:13, fontWeight:600, color }}>{pct}%</span>
                  <button className="btn btn-ghost btn-sm" style={{ padding:5 }} onClick={() => { setEditGoal(g); setShowModal(true); }}><Icon name="edit" size={13} /></button>
                  <button className="btn btn-ghost btn-sm" style={{ padding:5 }} onClick={() => onDelete("goals",g.id)}><Icon name="trash" size={13} /></button>
                </div>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width:pct+"%", background:color }} /></div>
              <div style={{ marginTop:6, fontSize:12, color:"var(--text3)" }}>{fmt(g.target-g.saved)} remaining</div>
            </div>
          );
        })}
      </div>
      {showModal && <GoalModal goal={editGoal} onClose={()=>setShowModal(false)} onSave={async(data)=>{ if(editGoal){const{id,...r}={...editGoal,...data};await onEdit(editGoal.id,r);}else await onEdit(null,data);}} />}
    </div>
  );
}

// ─── PAGE: SHARED BILLS ───────────────────────────────────────────────────────
function BillModal({ onClose, onSave, user }) {
  const [form, setForm] = useState({ name:"", total:"", splitType:"50/50", paidBy:user?.displayName?.split(" ")[0]||"", dueDate:"" });
  const save = async () => {
    if (!form.name||!form.total) return;
    await onSave({ ...form, total:parseFloat(form.total), settled:false });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add Shared Bill</span>
          <button className="modal-close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Bill Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Netflix" /></div>
          <div className="form-group"><label>Total ($)</label><input type="number" value={form.total} onChange={e=>setForm(f=>({...f,total:e.target.value}))} placeholder="0.00" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Split</label><select value={form.splitType} onChange={e=>setForm(f=>({...f,splitType:e.target.value}))}><option value="50/50">50/50</option><option value="full">Full (one person)</option></select></div>
          <div className="form-group"><label>Paid by</label><input value={form.paidBy} onChange={e=>setForm(f=>({...f,paidBy:e.target.value}))} /></div>
        </div>
        <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} /></div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Add Bill</button>
        </div>
      </div>
    </div>
  );
}

function BillsPage({ bills, onDelete, onToggle }) {
  const [showModal, setShowModal] = useState(false);
  const { user, household } = useAuth();
  const unsettled = bills.filter(b=>!b.settled);
  const settled   = bills.filter(b=>b.settled);
  const owedTotal = unsettled.filter(b=>b.splitType==="50/50").reduce((s,b)=>s+b.total/2,0);
  return (
    <div>
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div><h1>Shared Bills</h1><p>Who owes what</p></div>
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}><Icon name="plus" size={14} /> Add Bill</button>
      </div>
      {unsettled.length>0&&<div className="kpi-grid" style={{marginBottom:20}}>
        <div className="kpi-card"><div className="kpi-label">Pending</div><div className="kpi-value">{unsettled.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">50/50 Owed Each</div><div className="kpi-value gold">{fmtDec(owedTotal)}</div></div>
      </div>}
      <div className="card">
        <div className="card-title" style={{marginBottom:12}}>Pending</div>
        {unsettled.length===0?<div className="empty"><div className="empty-icon">✅</div><p>All bills settled!</p></div>:unsettled.map(b=>(
          <div key={b.id} className="bill-item">
            <div className="bill-header">
              <span className="bill-name">{b.name}</span>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span className="bill-total">{fmtDec(b.total)}</span>
                <button className="btn btn-primary btn-sm" onClick={()=>onToggle(b.id,true)}>Settled</button>
                <button className="btn btn-ghost btn-sm" style={{padding:5}} onClick={()=>onDelete("bills",b.id)}><Icon name="trash" size={13}/></button>
              </div>
            </div>
            <div className="bill-split"><span>Split: {b.splitType}</span>{b.splitType==="50/50"&&<span>· Each: {fmtDec(b.total/2)}</span>}<span>· Paid by: {b.paidBy}</span>{b.dueDate&&<span>· Due: {b.dueDate}</span>}</div>
          </div>
        ))}
      </div>
      {settled.length>0&&<div className="card" style={{marginTop:16}}>
        <div className="card-title" style={{marginBottom:12}}>Settled</div>
        {settled.map(b=>(
          <div key={b.id} className="bill-item" style={{opacity:0.5}}>
            <div className="bill-header">
              <span className="bill-name" style={{textDecoration:"line-through"}}>{b.name}</span>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span className="badge green">Settled</span>
                <button className="btn btn-ghost btn-sm" onClick={()=>onToggle(b.id,false)}>Reopen</button>
                <button className="btn btn-ghost btn-sm" style={{padding:5}} onClick={()=>onDelete("bills",b.id)}><Icon name="trash" size={13}/></button>
              </div>
            </div>
          </div>
        ))}
      </div>}
      {showModal&&<BillModal onClose={()=>setShowModal(false)} onSave={async(data)=>{await addDoc(collection(db,"bills"),{...data,householdId:household.id,createdAt:serverTimestamp()});}} user={user}/>}
    </div>
  );
}

// ─── PAGE: ANALYTICS ─────────────────────────────────────────────────────────
function AnalyticsPage({ transactions, categories }) {
  const now = new Date();
  const monthlyData = Array.from({length:12},(_,i)=>{
    const tx = transactions.filter(t=>{const d=new Date(t.date);return d.getMonth()===i&&d.getFullYear()===now.getFullYear();});
    return{name:MONTHS[i].slice(0,3),Income:tx.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),Expenses:tx.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0)};
  });
  const catTotals={};
  transactions.filter(t=>t.type==="expense").forEach(t=>{const l=t.categoryLabel||"Other";catTotals[l]=(catTotals[l]||0)+t.amount;});
  const topCats=Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxCat=topCats[0]?.[1]||1;
  // Normalize names: remove accents, trim, capitalize first letter
  // Prevents "Nicolas" vs "Nicolás" splitting into two people
  const normName = (n) => (n||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  const byPerson={};
  transactions.filter(t=>t.type==="expense"&&t.paidBy).forEach(t=>{
    const n = normName(t.paidBy);
    if (n) byPerson[n]=(byPerson[n]||0)+t.amount;
  });
  const [analyticsYear, setAnalyticsYear] = useState(now.getFullYear());
  return (
    <div>
      <div className="page-header page-header-row" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
        <div><h1>Analytics</h1><p>Spending trends & patterns</p></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setAnalyticsYear(y=>y-1)}>←</button>
          <span style={{fontSize:13,fontWeight:500,minWidth:40,textAlign:"center"}}>{analyticsYear}</span>
          <button className="btn btn-ghost btn-sm" disabled={analyticsYear>=now.getFullYear()} onClick={()=>setAnalyticsYear(y=>y+1)}>→</button>
        </div>
      </div>
      <div className="card" style={{marginBottom:20}}>
        <div className="card-title">Monthly Cashflow {now.getFullYear()}</div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:"rgba(26,26,46,0.45)",fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"rgba(26,26,46,0.45)",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v/1000}k`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="Income" fill="#1e9e6b" radius={[4,4,0,0]}/>
              <Bar dataKey="Expenses" fill="#7c9fd4" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{marginBottom:14}}>Top Expense Categories</div>
          {topCats.length===0?<div className="empty"><p>No data yet</p></div>:topCats.map(([label,val],idx)=>{
            const cat = categories.find(c=>c.label===label);
            const color = cat?.color || PIE_COLS[idx % PIE_COLS.length];
            return (
              <div key={label} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:5}}>
                  <span>{cat?.icon||""} {label}</span>
                  <span style={{color:"var(--text2)",fontWeight:500}}>{fmt(val)}</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{width:Math.round(val/maxCat*100)+"%",background:color}}/></div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <div className="card-title" style={{marginBottom:14}}>Spending by Person</div>
          {Object.keys(byPerson).length===0?<div className="empty"><p>No data yet</p></div>:(
            Object.entries(byPerson).sort((a,b)=>b[1]-a[1]).map(([name,val],i)=>(
              <div key={name} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:i===0?"var(--gold-dim)":"var(--blue-dim)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:i===0?"var(--gold)":"var(--blue)"}}>{name.charAt(0).toUpperCase()}</div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{name}</div><div style={{fontSize:12,color:"var(--text3)"}}>{fmt(val)} spent</div></div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: HOW TO USE ────────────────────────────────────────────────────────
function HowToPage({ household }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (household?.code) { navigator.clipboard.writeText(household.code); setCopied(true); setTimeout(()=>setCopied(false),2000); }
  };

  const Section = ({ emoji, title, children }) => (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <span style={{ fontSize:22 }}>{emoji}</span>
        <h2 style={{ fontSize:16, fontWeight:500, margin:0 }}>{title}</h2>
      </div>
      <div style={{ paddingLeft:32 }}>{children}</div>
    </div>
  );

  const Step = ({ n, text }) => (
    <div style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
      <div style={{ width:24, height:24, borderRadius:"50%", background:"var(--gold-dim)", color:"var(--gold)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, flexShrink:0 }}>{n}</div>
      <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.6, paddingTop:3 }}>{text}</div>
    </div>
  );

  const Tip = ({ text }) => (
    <div style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
      <span style={{ color:"var(--gold)", fontSize:14, flexShrink:0, paddingTop:1 }}>✦</span>
      <div style={{ fontSize:13, color:"var(--text3)", lineHeight:1.6 }}>{text}</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1>How to Use Casa Budget</h1>
        <p>A quick guide to get you and your household up and running</p>
      </div>

      {household && (
        <div className="card" style={{ marginBottom:28, borderColor:"var(--gold)", borderWidth:1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div>
              <div className="card-title">Your Household</div>
              <div style={{ fontSize:16, fontWeight:500, marginTop:4 }}>{household.name}</div>
              <div style={{ fontSize:13, color:"var(--text3)", marginTop:2 }}>
                {household.memberEmails?.length || 1} member{(household.memberEmails?.length||1)>1?"s":""}
              </div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:11, color:"var(--text3)", marginBottom:6 }}>Share this code to invite someone</div>
              <div style={{ display:"flex", alignItems:"center", gap:10, background:"var(--surface2)", borderRadius:10, padding:"12px 20px", cursor:"pointer" }} onClick={copy}>
                <span style={{ fontSize:28, fontWeight:700, letterSpacing:"0.2em", color:"var(--gold)", fontFamily:"monospace" }}>{household.code}</span>
                <span style={{ fontSize:12, color:"var(--text3)" }}>{copied?"✓ Copied!":"tap to copy"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ alignItems:"start" }}>
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <Section emoji="🚀" title="Getting started">
              <Step n="1" text="Go to Categories first. This is where you create your income sources and expense categories (e.g. Salary, Rent, Groceries) — categories are just labels, no amounts yet. Group related ones together (Housing, Food, Income, etc.) to keep a long list organized." />
              <Step n="2" text="Then go to the Budget tab. This is where you set your monthly targets — how much income you expect and how much you plan to spend per category. Click 'Set Budget' to enter your plan for the month." />
              <Step n="3" text="Log transactions using the + button as you receive income or spend money. Pick the matching category so it feeds your budget execution automatically." />
              <Step n="4" text="Check Overview anytime for a quick snapshot of budget execution. Go to the Budget tab for the full detailed breakdown, category by category." />
              <Tip text="Accounts (Checking, Credit Card, Cash, etc.) are optional, not required to log a transaction — set them up in Accounts if you want to track balances per account, e.g. to see what's sitting in savings versus what's on a credit card." />
            </Section>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <Section emoji="🏡" title="Sharing with a partner">
              <Step n="1" text="Your 6-character household code is shown above — tap it to copy." />
              <Step n="2" text="Share it with your partner however you'd normally send them a short code (text, chat, in person)." />
              <Step n="3" text="They sign in with their own Google account. The first time, they'll be asked to set up a household — they should choose 'Join existing' and paste in your code, rather than 'Create new'." />
              <Step n="4" text="Once joined, you'll both see the same accounts, transactions, budget, goals, and bills in real time — there's no separate 'your data' and 'their data' inside one household." />
              <Tip text="Going solo? No problem — just use it yourself and ignore the sharing feature. Nothing about the app requires a second person." />
              <Tip text="Anyone with the code can join, so treat it a little like a shared password — share it directly with the person you want in your household, not somewhere public." />
            </Section>
          </div>

          <div className="card">
            <Section emoji="🏦" title="Bank sync & importing transactions">
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.7, marginBottom:14 }}>
                There are three separate ways to get transactions in — worth knowing which is which:
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
                {[
                  { label:"⚡ Sync Bank", desc:"Live connection via SimpleFIN — pulls transactions directly from your bank. Requires a SimpleFIN setup token (a small monthly cost, separate from this app, paid to SimpleFIN) and your bank credentials, which go to SimpleFIN, never to Casa Budget." },
                  { label:"🏦 Bank Import", desc:"Upload a CSV statement exported from your bank (Capital One's format is explicitly supported) for a one-time import — no ongoing connection or token needed." },
                  { label:"App CSV", desc:"Round-trips this app's own export format — useful for restoring or moving data, not for importing a raw bank statement." },
                ].map(({label,desc}) => (
                  <div key={label} style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{label}</div>
                    <div style={{ fontSize:12, color:"var(--text3)", lineHeight:1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
              <Tip text="After any import, skim the reviewed list before confirming — it's the easiest moment to catch a transaction that shouldn't be there, especially if you've synced the same date range more than once." />
            </Section>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <Section emoji="🎯" title="Savings Goals">
              <Step n="1" text="Go to Savings Goals and create a goal — name it, pick an icon, set a target amount, and optionally a target date." />
              <Step n="2" text="Update the 'saved' amount manually as you put money aside — there's no automatic link between a transaction and a goal's progress." />
              <Step n="3" text="Edit a goal any time to adjust the target, the saved amount, or the date as plans change." />
              <Tip text="Create a Savings category in your budget and log transfers there as transactions, so setting money aside also shows up as part of your monthly execution, not just inside the goal itself." />
            </Section>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <Section emoji="📊" title="Understanding Budget Execution">
              <div style={{ fontSize:13, color:"var(--text2)", lineHeight:1.7, marginBottom:14 }}>
                Budget Execution shows you three things at once:
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
                {[
                  { color:"#4caf88", label:"Income fulfillment", desc:"What % of your income target you've actually received this month." },
                  { color:"#e05c5c", label:"Expense execution", desc:"What % of your expense budget you've used. Green = under budget, red = over." },
                  { color:"#e8c547", label:"Savings rate", desc:"Actual savings ÷ actual income. Tells you how much of what you earned you kept." },
                ].map(({color,label,desc}) => (
                  <div key={label} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:color, flexShrink:0, marginTop:4 }}/>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{label}</div>
                      <div style={{ fontSize:12, color:"var(--text3)", lineHeight:1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:"var(--text3)", lineHeight:1.6, marginBottom:14, background:"var(--surface2)", borderRadius:8, padding:"10px 12px" }}>
                Worked example: budgeted income $5,000, actual $5,000 → 100% fulfillment. Budgeted expenses $4,000, actual $3,200 → 80% execution (green, under budget). Savings rate = ($5,000 − $3,200) ÷ $5,000 = 36%.
              </div>
              <Tip text="Traffic lights: green = on track, yellow = 80%+ used (warning), red = over budget. These apply per category as well as to the overall totals." />
              <Tip text="Overview gives you the same three numbers at a glance; the Budget tab breaks them down category by category." />
            </Section>
          </div>

          <div className="card" style={{ marginBottom:16 }}>
            <Section emoji="💳" title="Shared Bills">
              <Step n="1" text="Add a shared bill (e.g. rent, Netflix) with the total amount, who paid it, and a due date." />
              <Step n="2" text="Choose 50/50 to split it equally between the household, or 'Full' if one person is covering the whole thing (still logged, just not split)." />
              <Step n="3" text="Mark bills as Settled once the split has actually been paid back. Reopen a bill if that turns out to be premature." />
              <Tip text="The owed total at the top adds up every unsettled 50/50 bill — it's a running tally of who owes whom, not a single bill's detail." />
              <Tip text="Bills here are one-off entries, not automatically recurring — for a monthly bill like rent, add a new entry each month rather than expecting last month's to reappear." />
            </Section>
          </div>

          <div className="card">
            <Section emoji="💡" title="Tips & best practices">
              <Tip text="Set budgets at the start of each month — use 'Copy from previous month' to save time." />
              <Tip text="Log transactions as they happen, not at the end of the month, for the most accurate picture." />
              <Tip text="Use the Analytics page at year-end to review your full year of cashflow." />
              <Tip text="Download CSV from Transactions anytime to import into Excel or your accountant's tools." />
              <Tip text="Create custom categories in Categories for anything not covered by the defaults, and group related ones together." />
              <Tip text="If you use Sync Bank, review the imported list each time before confirming — it's the simplest way to catch anything that looks off." />
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── ACCOUNT MODAL ────────────────────────────────────────────────────────────
const ACCOUNT_TYPES = [
  { id:"checking",   label:"Checking",      icon:"🏦" },
  { id:"savings",    label:"Savings",       icon:"💰" },
  { id:"credit",     label:"Credit Card",   icon:"💳" },
  { id:"cash",       label:"Cash",          icon:"💵" },
  { id:"investment", label:"Investment",    icon:"📈" },
  { id:"other",      label:"Other",         icon:"🏧" },
];

function AccountModal({ account, onClose, onSave }) {
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState(account ? {
    name: account.name, type: account.type,
    openingBalance: account.openingBalance, openingDate: account.openingDate,
    color: account.color || "#3b72d9",
    accountRole: account.accountRole || "budget",   // "budget" | "tracking"
    includeInTotal: account.includeInTotal !== false
  } : {
    name: "", type: "checking",
    openingBalance: "", openingDate: today,
    color: "#3b72d9", accountRole: "budget", includeInTotal: true
  });
  const [saving, setSaving] = useState(false);

  const COLORS = ["#3b72d9","#1e9e6b","#d94f4f","#c9931a","#7c5cdb","#1e8fa0","#888"];

  const save = async () => {
    if (!form.name.trim() || form.openingBalance === "") return;
    setSaving(true);
    await onSave({ ...form, openingBalance: parseFloat(form.openingBalance) || 0 });
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{account ? "Edit Account" : "New Account"}</span>
          <button className="modal-close" onClick={onClose}><Icon name="x"/></button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Account Name</label>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Chase Checking" autoFocus />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              {ACCOUNT_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Opening Balance ($)</label>
            <input type="number" value={form.openingBalance}
              onChange={e=>setForm(f=>({...f,openingBalance:e.target.value}))}
              placeholder="0.00" />
          </div>
          <div className="form-group">
            <label>Balance Date</label>
            <input type="date" value={form.openingDate}
              onChange={e=>setForm(f=>({...f,openingDate:e.target.value}))} />
          </div>
        </div>

        <div className="form-group">
          <label>Color</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {COLORS.map(c=>(
              <button key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                style={{width:28,height:28,borderRadius:"50%",background:c,border:form.color===c?"3px solid var(--text)":"2px solid transparent",cursor:"pointer"}}/>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Account Role</label>
          <div style={{display:"flex",gap:8}}>
            {[
              {id:"budget",   label:"💰 Budget Account",  desc:"Affects your available money to assign"},
              {id:"tracking", label:"📊 Tracking Only",   desc:"Net worth only — investments, loans"},
            ].map(r => (
              <button key={r.id} type="button"
                onClick={()=>setForm(f=>({...f, accountRole:r.id, includeInTotal: r.id==="tracking" ? true : f.includeInTotal}))}
                style={{
                  flex:1, padding:"10px 12px", borderRadius:"var(--radius-sm)", cursor:"pointer",
                  border: form.accountRole===r.id ? "2px solid var(--gold)" : "1px solid var(--border2)",
                  background: form.accountRole===r.id ? "var(--gold-dim)" : "var(--surface2)",
                  textAlign:"left"
                }}>
                <div style={{fontSize:13,fontWeight:500,color:form.accountRole===r.id?"var(--gold)":"var(--text)"}}>{r.label}</div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="form-group" style={{flexDirection:"row",alignItems:"center",gap:10,marginBottom:0}}>
          <input type="checkbox" id="includeTotal" checked={form.includeInTotal}
            onChange={e=>setForm(f=>({...f,includeInTotal:e.target.checked}))}
            style={{width:16,height:16,cursor:"pointer"}} />
          <label htmlFor="includeTotal" style={{textTransform:"none",letterSpacing:0,fontSize:13,color:"var(--text2)",cursor:"pointer"}}>
            Include in net worth total
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving?"Saving...": account?"Save Changes":"Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RECONCILE MODAL ──────────────────────────────────────────────────────────
function ReconcileModal({ account, computedBalance, onClose, onSave }) {
  const [actual, setActual] = useState("");
  const [saving, setSaving] = useState(false);
  const diff = actual !== "" ? parseFloat(actual) - computedBalance : null;
  const fmt = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);

  const save = async () => {
    if (actual === "") return;
    setSaving(true);
    await onSave(parseFloat(actual));
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Reconcile — {account.name}</span>
          <button className="modal-close" onClick={onClose}><Icon name="x"/></button>
        </div>

        <div style={{background:"var(--surface2)",borderRadius:10,padding:"14px 16px",marginBottom:16}}>
          <div style={{fontSize:11,color:"var(--text3)",marginBottom:4}}>App calculated balance</div>
          <div style={{fontSize:22,fontWeight:700,color:"var(--text)"}}>{fmt(computedBalance)}</div>
        </div>

        <div className="form-group">
          <label>Your actual bank balance today ($)</label>
          <input type="number" value={actual} onChange={e=>setActual(e.target.value)}
            placeholder="Check your banking app" autoFocus />
        </div>

        {diff !== null && (
          <div style={{
            background: Math.abs(diff) < 0.01 ? "var(--green-dim)" : "var(--red-dim)",
            border: `1px solid ${Math.abs(diff) < 0.01 ? "rgba(30,158,107,0.3)" : "rgba(217,79,79,0.3)"}`,
            borderRadius:10, padding:"12px 16px", marginBottom:16
          }}>
            {Math.abs(diff) < 0.01 ? (
              <div style={{color:"var(--green)",fontWeight:600}}>✓ Perfectly reconciled!</div>
            ) : (
              <>
                <div style={{fontSize:12,color:"var(--text3)",marginBottom:4}}>Difference</div>
                <div style={{fontSize:20,fontWeight:700,color:"var(--red)"}}>
                  {diff > 0 ? "+" : ""}{fmt(diff)}
                </div>
                <div style={{fontSize:12,color:"var(--text3)",marginTop:4}}>
                  {diff > 0 ? "Your bank shows more than logged — possible unlogged income" : "Your bank shows less — possible unlogged expenses or bank fees"}
                </div>
              </>
            )}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || actual===""}>
            {saving ? "Saving..." : "Save Reconciliation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: ACCOUNTS ───────────────────────────────────────────────────────────
function AccountsPage({ accounts, transactions, onAdd, onEdit, onDelete }) {
  const [showModal, setShowModal]         = useState(false);
  const [editAcc, setEditAcc]             = useState(null);
  const [reconcileAcc, setReconcileAcc]   = useState(null);

  const fmt    = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n||0);
  const fmtDec = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);

  // Compute running balance for each account
  const getBalance = (acc) => {
    const txSinceOpening = transactions.filter(t => {
      if ((t.accountId || "") !== acc.id) return false;
      return t.date >= acc.openingDate;
    });
    const inflow  = txSinceOpening.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
    const outflow = txSinceOpening.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
    return (acc.openingBalance||0) + inflow - outflow;
  };

  const netWorth = accounts
    .filter(a=>a.includeInTotal!==false)
    .reduce((s,a)=>s+getBalance(a), 0);

  const ACCOUNT_TYPES_MAP = Object.fromEntries(ACCOUNT_TYPES.map(t=>[t.id,t]));

  return (
    <div>
      <div className="page-header page-header-row" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
        <div><h1>Accounts</h1><p>Running balances & reconciliation</p></div>
        <button className="btn btn-primary" onClick={()=>{setEditAcc(null);setShowModal(true);}}>
          <Icon name="plus" size={14}/> Add Account
        </button>
      </div>

      {/* Net worth summary */}
      {accounts.length > 0 && (() => {
        const budgetAccs   = accounts.filter(a => (a.accountRole||"budget")==="budget" && a.includeInTotal!==false);
        const trackingAccs = accounts.filter(a => (a.accountRole||"budget")==="tracking" && a.includeInTotal!==false);
        const creditAccs   = accounts.filter(a => a.type==="credit" && a.includeInTotal!==false);
        const assets       = accounts.filter(a => a.type!=="credit" && a.includeInTotal!==false).reduce((s,a)=>s+Math.max(0,getBalance(a)),0);
        const liabilities  = accounts.filter(a => a.type==="credit" && a.includeInTotal!==false).reduce((s,a)=>s+Math.max(0,getBalance(a)),0);
        return (
          <div style={{marginBottom:20}}>
            {/* Main net worth tile */}
            <div className="card" style={{borderLeft:"3px solid var(--blue)",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                <div>
                  <div className="card-title">Net Worth</div>
                  <div style={{fontSize:32,fontWeight:700,color:netWorth>=0?"var(--green)":"var(--red)",marginTop:4,lineHeight:1}}>
                    {fmtDec(netWorth)}
                  </div>
                  <div style={{fontSize:12,color:"var(--text3)",marginTop:6}}>
                    {accounts.filter(a=>a.includeInTotal!==false).length} accounts tracked
                  </div>
                </div>
                <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:11,color:"var(--text3)",marginBottom:3}}>Assets</div>
                    <div style={{fontSize:18,fontWeight:600,color:"var(--green)"}}>{fmt(assets)}</div>
                  </div>
                  <div style={{fontSize:18,color:"var(--text3)"}}>−</div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:11,color:"var(--text3)",marginBottom:3}}>Liabilities</div>
                    <div style={{fontSize:18,fontWeight:600,color:"var(--red)"}}>{fmt(liabilities)}</div>
                  </div>
                </div>
              </div>
              {/* Mini balance bar */}
              {(assets + liabilities) > 0 && (
                <div style={{marginTop:14}}>
                  <div className="progress-bar" style={{height:6}}>
                    <div className="progress-fill" style={{width:`${Math.min(100,Math.round(assets/(assets+liabilities)*100))}%`,background:"var(--green)"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text3)",marginTop:4}}>
                    <span>{Math.round(assets/(assets+liabilities)*100)}% assets</span>
                    <span>{Math.round(liabilities/(assets+liabilities)*100)}% liabilities</span>
                  </div>
                </div>
              )}
            </div>

            {/* Per-account quick summary row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:4}}>
              {accounts.filter(a=>a.includeInTotal!==false).map(acc => {
                const bal    = getBalance(acc);
                const acType = ACCOUNT_TYPES_MAP[acc.type] || {icon:"🏧"};
                const isCredit = acc.type === "credit";
                const isPos  = isCredit ? bal <= 0 : bal >= 0;
                return (
                  <div key={acc.id} className="kpi-card" style={{borderLeft:`3px solid ${acc.color||"var(--blue)"}`}}>
                    <div style={{fontSize:13,marginBottom:2}}>{acType.icon}</div>
                    <div style={{fontSize:11,color:"var(--text3)",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acc.name}</div>
                    <div style={{fontSize:16,fontWeight:700,color:isPos?"var(--green)":"var(--red)"}}>{fmtDec(Math.abs(bal))}</div>
                    <div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>
                      {isCredit ? (bal<=0?"available":"owed") : (bal>=0?"balance":"overdrawn")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {accounts.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">🏦</div>
            <p>No accounts yet</p>
            <p style={{fontSize:11,color:"var(--text3)"}}>Add your bank accounts to track running balances and reconcile with your statements</p>
            <button className="btn btn-primary" style={{marginTop:8}} onClick={()=>setShowModal(true)}>
              <Icon name="plus" size={14}/> Add First Account
            </button>
          </div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {accounts.map(acc => {
            const balance    = getBalance(acc);
            const acType     = ACCOUNT_TYPES_MAP[acc.type] || {icon:"🏧",label:"Account"};
            const isCredit   = acc.type === "credit";
            const txCount    = transactions.filter(t=>(t.accountId||"")=== acc.id).length;
            const lastRecon  = acc.lastReconciled;
            const reconDiff  = acc.lastReconciledBalance != null ? balance - acc.lastReconciledBalance : null;

            return (
              <div key={acc.id} className="card" style={{borderLeft:`3px solid ${acc.color||"var(--blue)"}`}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                  {/* Icon */}
                  <div style={{width:42,height:42,borderRadius:12,background:(acc.color||"#3b72d9")+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                    {acType.icon}
                  </div>

                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>{acc.name}</div>
                        <div style={{fontSize:12,color:"var(--text3)",display:"flex",alignItems:"center",gap:8}}>
                      {acType.label} · {txCount} transactions logged
                      <span style={{
                        padding:"1px 7px",borderRadius:100,fontSize:11,fontWeight:500,
                        background:acc.accountRole==="tracking"?"var(--blue-dim)":"var(--gold-dim)",
                        color:acc.accountRole==="tracking"?"var(--blue)":"var(--gold)"
                      }}>
                        {acc.accountRole==="tracking"?"Tracking":"Budget"}
                      </span>
                    </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:22,fontWeight:700,color:isCredit?(balance<=0?"var(--green)":"var(--red)"):(balance>=0?"var(--green)":"var(--red)")}}>
                          {fmtDec(balance)}
                        </div>
                        <div style={{fontSize:11,color:"var(--text3)"}}>
                          {isCredit ? (balance<=0?"credit balance":"amount owed") : "current balance"}
                        </div>
                      </div>
                    </div>

                    {/* Balance bar */}
                    <div style={{marginTop:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text3)",marginBottom:5}}>
                        <span>Opening: {fmtDec(acc.openingBalance)} on {acc.openingDate}</span>
                        {lastRecon && <span>Reconciled: {lastRecon}</span>}
                      </div>

                      {/* Reconciliation status */}
                      {reconDiff !== null && (
                        <div style={{
                          display:"flex",alignItems:"center",gap:6,
                          fontSize:12,padding:"5px 10px",borderRadius:6,marginBottom:8,
                          background:Math.abs(reconDiff)<0.01?"var(--green-dim)":"var(--red-dim)",
                          color:Math.abs(reconDiff)<0.01?"var(--green)":"var(--red)"
                        }}>
                          {Math.abs(reconDiff)<0.01
                            ? "✓ Reconciled — no discrepancy"
                            : `⚠ ${fmtDec(Math.abs(reconDiff))} gap since last reconciliation`}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      <button className="btn btn-ghost btn-sm"
                        onClick={()=>setReconcileAcc(acc)}
                        style={{display:"flex",alignItems:"center",gap:5}}>
                        <Icon name="reconcile" size={13}/> Reconcile
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>{setEditAcc(acc);setShowModal(true);}}>
                        <Icon name="edit" size={13}/> Edit
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{color:"var(--red)"}}
                        onClick={()=>{ if(window.confirm(`Delete "${acc.name}"?`)) onDelete(acc.id); }}>
                        <Icon name="trash" size={13}/> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <AccountModal account={editAcc} onClose={()=>setShowModal(false)}
          onSave={async(data)=>{ if(editAcc) await onEdit(editAcc.id,data); else await onAdd(data); }} />
      )}

      {reconcileAcc && (
        <ReconcileModal
          account={reconcileAcc}
          computedBalance={getBalance(reconcileAcc)}
          onClose={()=>setReconcileAcc(null)}
          onSave={async(actualBalance)=>{
            await onEdit(reconcileAcc.id,{
              lastReconciled: new Date().toISOString().slice(0,10),
              lastReconciledBalance: actualBalance,
            });
            setReconcileAcc(null);
          }}
        />
      )}
    </div>
  );
}

// ─── NAV + DASHBOARD ─────────────────────────────────────────────────────────
// Primary nav shown in bottom bar on mobile (max 5)
const NAV_PRIMARY = [
  { id: "overview",     label: "Overview",     icon: "home"  },
  { id: "transactions", label: "Transactions", icon: "list"  },
  { id: "budget",       label: "Budget",       icon: "gauge" },
  { id: "categories",   label: "Categories",   icon: "tag"   },
  { id: "more",         label: "More",         icon: "grid"  }, // opens drawer
];

// All nav items (for desktop sidebar + More drawer)
const NAV = [
  { id: "overview",     label: "Overview",      icon: "home"   },
  { id: "transactions", label: "Transactions",  icon: "list"   },
  { id: "budget",       label: "Budget",        icon: "gauge"  },
  { id: "accounts",     label: "Accounts",      icon: "bank"   },
  { id: "categories",   label: "Categories",    icon: "tag"    },
  { id: "goals",        label: "Savings Goals", icon: "target" },
  { id: "bills",        label: "Shared Bills",  icon: "split"  },
  { id: "analytics",    label: "Analytics",     icon: "chart"  },
  { id: "howto",        label: "How to Use",    icon: "help"   },
];


// ─── QUICK LOG CHAT ───────────────────────────────────────────────────────────
function QuickLogChat({ categories, transactions, householdId, onSave, onAddCategory, user }) {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed]   = useState(null);   // AI result
  const [msg, setMsg]         = useState(null);    // feedback message
  const [askCreate, setAskCreate] = useState(null); // { label, type, suggestedIcon, suggestedColor }
  const inputRef = useRef(null);

  // Budget plan for this month (to show remaining)
  const now = new Date();
  const monthKey = `${householdId}_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const [plan, setPlan] = useState({});
  useEffect(() => {
    if (!householdId) return;
    const ref = doc(db, "budgetPlans", monthKey);
    const unsub = onSnapshot(ref, snap => setPlan(snap.exists() ? snap.data() : {}));
    return unsub;
  }, [monthKey, householdId]);

  // Actuals for this month per category
  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const actualMap = {};
  monthTx.forEach(t => { actualMap[t.categoryId] = (actualMap[t.categoryId] || 0) + t.amount; });

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const reset = () => { setParsed(null); setMsg(null); setAskCreate(null); setInput(""); };

  const parseWithAI = async (text) => {
    setLoading(true); setParsed(null); setMsg(null); setAskCreate(null);
    try {
      const catList = categories.map(c => `${c.label} (${c.type}, id:${c.id})`).join(", ");
      const today   = new Date().toISOString().slice(0, 10);
      const userName = user?.displayName?.split(" ")[0] || "me";

      const prompt = `You are a transaction parser for a family budget app. Parse this input and return ONLY valid JSON, no explanation.

User input: "${text}"
Today: ${today}
User first name: ${userName}
Available categories: ${catList}

Rules:
- amount: positive number (required)
- type: "income" or "expense" — infer from context (salary/paycheck/received = income, everything else = expense)  
- categoryId: pick the best matching id from the list above, or null if none fits
- categoryLabel: the label of matched category, or your best guess label if no match
- description: clean short description (capitalize first letter)
- date: YYYY-MM-DD (default today if not mentioned, "yesterday" = ${new Date(Date.now()-86400000).toISOString().slice(0,10)})
- paidBy: person name if mentioned, otherwise "${userName}"
- confidence: 0-1 how confident you are in the category match

Return JSON like:
{"amount":6.00,"type":"expense","categoryId":"d_coffee","categoryLabel":"Coffee Shops","description":"Coffee","date":"${today}","paidBy":"${userName}","confidence":0.95}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const raw  = data.content?.[0]?.text?.trim() || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      const result = JSON.parse(jsonMatch[0]);

      // Find the actual category object
      const cat = result.categoryId ? categories.find(c => c.id === result.categoryId) : null;
      result.category = cat || null;

      // If no match or low confidence, flag for user
      if (!cat) {
        result.noMatch = true;
      }
      setParsed(result);
    } catch(e) {
      setMsg({ type:"error", text:"Couldn't understand that. Try: 'coffee 6' or 'salary 5000'" });
    }
    setLoading(false);
  };

  const handleSend = () => {
    const t = input.trim();
    if (!t) return;
    parseWithAI(t);
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    const cat = parsed.category;
    await onSave({
      type:          parsed.type,
      categoryId:    cat?.id || "",
      categoryLabel: cat?.label || parsed.categoryLabel || "Uncategorized",
      categoryIcon:  cat?.icon  || "📦",
      categoryColor: cat?.color || "#888",
      description:   parsed.description,
      amount:        parsed.amount,
      date:          parsed.date,
      paidBy:        parsed.paidBy,
    });

    // Build feedback message with budget remaining
    let feedback = `✅ Logged: ${cat?.icon || "📦"} ${parsed.description} — $${parsed.amount}`;
    if (cat && cat.type === "expense") {
      const budget  = plan[cat.id] || 0;
      const spent   = (actualMap[cat.id] || 0) + parsed.amount;
      if (budget > 0) {
        const remaining = budget - spent;
        if (remaining > 0) {
          feedback += `\n💡 You have $${remaining.toFixed(0)} remaining in ${cat.label} this month.`;
        } else {
          feedback += `\n⚠️ You're $${Math.abs(remaining).toFixed(0)} over budget for ${cat.label} this month.`;
        }
      } else {
        feedback += `\n💡 No budget set for ${cat.label} — add one in the Budget tab.`;
      }
    }
    setMsg({ type:"success", text: feedback });
    setParsed(null);
    setInput("");
  };

  const handleCreateCategory = async () => {
    if (!askCreate || !parsed) return;
    const newCat = {
      label: askCreate.label,
      type:  parsed.type,
      icon:  askCreate.icon  || (parsed.type === "income" ? "💰" : "📦"),
      color: askCreate.color || (parsed.type === "income" ? "#1e9e6b" : "#d94f4f"),
    };
    await onAddCategory(newCat);
    // Re-fetch category (it'll appear via snapshot), then confirm
    setMsg({ type:"info", text:`📁 Category "${askCreate.label}" created! Tap ✓ to log the transaction.` });
    setAskCreate(null);
    // Update parsed to reflect new category will be created
    setParsed(p => ({ ...p, categoryLabel: askCreate.label, noMatch: false }));
  };

  const fmt = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
  const today = new Date().toISOString().slice(0,10);
  const dateLabel = parsed?.date === today ? "Today"
    : parsed?.date === new Date(Date.now()-86400000).toISOString().slice(0,10) ? "Yesterday"
    : parsed?.date || "";

  return (
    <>
      {/* Floating bubble */}
      <button className="chat-bubble" onClick={() => { setOpen(o=>!o); reset(); }}>
        {open ? <Icon name="x" size={22}/> : <Icon name="chat" size={22}/>}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:"var(--gold)"}}><Icon name="sparkle" size={14}/></span>
              <span style={{fontSize:13,fontWeight:600}}>Quick Log</span>
            </div>
            <span style={{fontSize:11,color:"var(--text3)"}}>Type anything — I'll parse it</span>
          </div>

          <div className="chat-body">
            {/* Examples when idle */}
            {!parsed && !msg && !loading && (
              <div className="chat-examples">
                {["coffee 6","salary 5000","uber 12.50 yesterday","groceries 87 natalia"].map(ex => (
                  <button key={ex} className="chat-example-pill"
                    onClick={() => { setInput(ex); parseWithAI(ex); }}>
                    {ex}
                  </button>
                ))}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="chat-thinking">
                <div className="chat-dots"><span/><span/><span/></div>
                <span>Parsing...</span>
              </div>
            )}

            {/* Parsed result confirmation */}
            {parsed && !loading && (
              <div className="chat-result">
                {/* Category */}
                <div className="chat-result-cat" style={{borderColor: parsed.category?.color || "var(--border2)"}}>
                  <span style={{fontSize:22}}>{parsed.category?.icon || "📦"}</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:parsed.category?.color||"var(--text)"}}>
                      {parsed.category?.label || parsed.categoryLabel}
                    </div>
                    <div style={{fontSize:11,color:"var(--text3)"}}>
                      {parsed.type === "income" ? "Income" : "Expense"} · {dateLabel} · {parsed.paidBy}
                    </div>
                  </div>
                  <div style={{marginLeft:"auto",fontSize:18,fontWeight:700,color:parsed.type==="income"?"var(--green)":"var(--red)"}}>
                    {parsed.type==="income"?"+":"-"}{fmt(parsed.amount)}
                  </div>
                </div>

                {/* No category match warning */}
                {parsed.noMatch && (
                  <div className="chat-no-match">
                    <div style={{fontSize:12,color:"var(--amber)",marginBottom:8}}>
                      ⚠ No matching category for "<strong>{parsed.categoryLabel}</strong>"
                    </div>
                    {!askCreate ? (
                      <div style={{display:"flex",gap:6}}>
                        <button className="btn btn-primary btn-sm"
                          onClick={() => setAskCreate({ label: parsed.categoryLabel, icon: parsed.type==="income"?"💰":"📦", color: parsed.type==="income"?"#1e9e6b":"#d94f4f" })}>
                          + Create category
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setParsed(p=>({...p,noMatch:false,category:null}))}>
                          Log anyway
                        </button>
                      </div>
                    ) : (
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{fontSize:12,color:"var(--text2)"}}>Create "{askCreate.label}"?</span>
                        <button className="btn btn-primary btn-sm" onClick={handleCreateCategory}>Yes, create</button>
                        <button className="btn btn-ghost btn-sm" onClick={()=>setAskCreate(null)}>Cancel</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Budget context preview */}
                {parsed.category && parsed.type === "expense" && (() => {
                  const budget  = plan[parsed.category.id] || 0;
                  const spent   = actualMap[parsed.category.id] || 0;
                  const remaining = budget - spent - parsed.amount;
                  if (budget === 0) return null;
                  return (
                    <div className="chat-budget-hint" style={{borderColor: remaining>=0?"var(--green)":"var(--red)"}}>
                      <span style={{fontSize:11,color:"var(--text3)"}}>After logging:</span>
                      <span style={{fontSize:12,fontWeight:600,color:remaining>=0?"var(--green)":"var(--red)"}}>
                        {remaining>=0 ? `$${remaining.toFixed(0)} left` : `$${Math.abs(remaining).toFixed(0)} over`} in {parsed.category.label}
                      </span>
                    </div>
                  );
                })()}

                {/* Confirm / Cancel */}
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button className="btn btn-primary" style={{flex:1}} onClick={handleConfirm}>
                    ✓ Log it
                  </button>
                  <button className="btn btn-ghost" onClick={reset}>
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Success / error message */}
            {msg && !parsed && (
              <div className={`chat-msg chat-msg-${msg.type}`}>
                <div style={{whiteSpace:"pre-line",fontSize:13}}>{msg.text}</div>
                <button className="btn btn-ghost btn-sm" style={{marginTop:8,width:"100%"}} onClick={reset}>
                  Log another
                </button>
              </div>
            )}
          </div>

          {/* Input row */}
          <div className="chat-input-row">
            <input
              ref={inputRef}
              className="chat-input"
              placeholder="coffee 6, salary 5000, uber 12..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && input.trim()) handleSend(); }}
              disabled={loading}
            />
            <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim() || loading}>
              <Icon name="send" size={16}/>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function Dashboard({ householdId }) {
  const { user, household, signOut } = useAuth();
  const [page, setPage]             = useState("overview");
  // Pre-seed filter when navigating from Overview tiles
  const [txFilter, setTxFilter] = useState(null); // { type, month, year }
  const navigateToTx = (filter) => {
    if (filter.page === "budget") {
      setPage("budget");
    } else {
      setTxFilter(filter);
      setPage("transactions");
    }
  };
  const [transactions, setTx]       = useState([]);
  const [goals, setGoals]           = useState([]);
  const [bills, setBills]           = useState([]);
  const [categories, setCategories] = useState([]);
  const [showTxModal, setShowTxModal]     = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [accounts, setAccounts]           = useState([]);

  useEffect(() => {
    const txQ   = query(collection(db,"transactions"),where("householdId","==",householdId));
    const unsubTx   = onSnapshot(txQ,   snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      docs.sort((a,b)=>((b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
      setTx(docs);
    });
    const gQ    = query(collection(db,"goals"),       where("householdId","==",householdId));
    const unsubG    = onSnapshot(gQ,    snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      docs.sort((a,b)=>((b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
      setGoals(docs);
    });
    const bQ    = query(collection(db,"bills"),       where("householdId","==",householdId));
    const unsubB    = onSnapshot(bQ,    snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      docs.sort((a,b)=>((b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
      setBills(docs);
    });
    const catsQ = query(collection(db,"categories"),  where("householdId","==",householdId));
    const unsubCats = onSnapshot(catsQ, snap=>{
      if (snap.empty) {
        // Only seed if truly empty — avoids duplicates on re-mount
        DEFAULT_CATEGORIES.forEach(({ id: _id, ...c }) =>
          addDoc(collection(db,"categories"),{...c,householdId,createdAt:serverTimestamp()})
        );
      } else {
        // Deduplicate in memory: keep only first occurrence of each label+type combo
        const seen = new Set();
        const rawDocs = snap.docs.map(d=>({...d.data(), id:d.id}));
        rawDocs.sort((a,b)=>((a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)));
        const docs = rawDocs.filter(d => {
          const key = `${d.type}::${d.label?.trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setCategories(docs);
      }
    });
    const accQ    = query(collection(db,"accounts"), where("householdId","==",householdId));
    const unsubAcc = onSnapshot(accQ, snap=>{
      const docs = snap.docs.map(d=>({...d.data(),id:d.id}));
      docs.sort((a,b)=>((a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)));
      setAccounts(docs);
    });
    // Migrate categories missing a group field — runs once in background
    (async () => {
      try {
        const snap = await getDocs(query(collection(db,"categories"), where("householdId","==",householdId)));
        const updates = [];
        snap.docs.forEach(d => {
          if (!d.data().group) {
            const data = d.data();
            const group = DEFAULT_GROUP_BY_ID[d.id] || guessGroup(data.label, data.type);
            updates.push(updateDoc(doc(db,"categories",d.id), { group }));
          }
        });
        if (updates.length) {
          await Promise.all(updates);
          console.log(`Migrated ${updates.length} categories to groups`);
        } else {
          console.log("Category groups: all up to date");
        }
      } catch(e) { console.warn("Group migration failed:", e.message); }
    })();

    return () => { unsubTx(); unsubG(); unsubB(); unsubCats(); unsubAcc(); };
  }, []);

  const addCategory  = async (data) => {
    // Prevent duplicates: check label+type uniqueness (case-insensitive)
    const exists = categories.some(c =>
      c.label.trim().toLowerCase() === data.label.trim().toLowerCase() &&
      c.type === data.type
    );
    if (exists) { alert(`A ${data.type} category named "${data.label}" already exists.`); return; }
    await addDoc(collection(db,"categories"),{...data,householdId,createdAt:serverTimestamp()});
  };
  const editCategory = async (id, data) => {
    try {
      if (id) {
        await updateDoc(doc(db,"categories",id), data);
      } else {
        await addDoc(collection(db,"categories"),{...data,householdId,createdAt:serverTimestamp()});
      }
    } catch(e) { console.error("editCategory error:", e); throw e; }
  };
  const deleteCategory = async (id) => { if(window.confirm("Delete this category?")) await deleteDoc(doc(db,"categories",id)); };
  const addTx        = async (data) => { await addDoc(collection(db,"transactions"),{...data,householdId,createdAt:serverTimestamp(),addedBy:user.email}); };
  const addAccount   = async (data) => addDoc(collection(db,"accounts"),{...data,householdId,createdAt:serverTimestamp()});
  const editAccount  = async (id, data) => updateDoc(doc(db,"accounts",id),data);
  const deleteAccount= async (id) => deleteDoc(doc(db,"accounts",id));
  const updateTx     = (id, data) => updateDoc(doc(db,"transactions",id), { ...data, updatedAt: serverTimestamp() });
  const deleteItem   = (col,id) => { if(window.confirm("Delete?")) deleteDoc(doc(db,col,id)); };
  const saveGoal     = (id,data) => id ? updateDoc(doc(db,"goals",id),data) : addDoc(collection(db,"goals"),{...data,householdId,createdAt:serverTimestamp()});
  const toggleBill   = (id,settled) => updateDoc(doc(db,"bills",id),{settled});

  const FAB = { overview:()=>setShowTxModal(true), transactions:()=>setShowTxModal(true), goals:()=>setShowGoalModal(true) };

  const [showMore, setShowMore] = useState(false);
  const isMorePage = !NAV_PRIMARY.find(n => n.id === page) && page !== "more";

  return (
    <div className="app-shell">
      {/* More drawer — mobile only */}
      {showMore && (
        <div className="more-overlay" onClick={() => setShowMore(false)}>
          <div className="more-drawer" onClick={e => e.stopPropagation()}>
            <div className="more-drawer-handle"/>
            <div className="more-drawer-title">Menu</div>

            {/* Accounts — featured at top of More drawer */}
            <button className={`more-drawer-item more-drawer-item-featured ${page==="accounts"?"active":""}`}
              onClick={() => { setPage("accounts"); setShowMore(false); }}>
              <Icon name="bank" size={20}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:14}}>Accounts & Net Worth</div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>Balances, reconciliation & net worth</div>
              </div>
              <span style={{fontSize:11,color:"var(--text3)"}}>→</span>
            </button>

            <div className="more-drawer-divider"/>
            <div className="more-drawer-title" style={{paddingTop:4}}>More Pages</div>

            {NAV.slice(4).filter(n=>n.id!=="accounts").map(n => (
              <button key={n.id} className={`more-drawer-item ${page===n.id?"active":""}`}
                onClick={() => { setPage(n.id); setShowMore(false); }}>
                <Icon name={n.icon} size={18}/>{n.label}
              </button>
            ))}
            <div className="more-drawer-divider"/>
            {household && (
              <div className="more-drawer-household">
                <div style={{fontWeight:500,color:"var(--text2)",marginBottom:2}}>{household?.name || "My Household"}</div>
                <div style={{fontSize:12,color:"var(--text3)"}}>
                  Invite code: <span
                    style={{color:"var(--gold)",fontFamily:"monospace",letterSpacing:"0.12em",cursor:"pointer"}}
                    onClick={() => { navigator.clipboard?.writeText(household?.code||""); }}
                    title="Tap to copy">
                    {household?.code || "———"}
                  </span>
                  <span style={{fontSize:11,color:"var(--text3)",marginLeft:6}}>tap to copy</span>
                </div>
              </div>
            )}
            <div className="more-drawer-user">
              <div className="user-avatar" style={{width:36,height:36}}>
                {user?.photoURL ? <img src={user.photoURL} alt=""/> : null}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:"var(--text)"}}>{user?.displayName}</div>
                <div style={{fontSize:12,color:"var(--text3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.email}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={signOut} style={{flexShrink:0}}>
                <Icon name="logout" size={14}/> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile top header ── */}
      <header className="mobile-header">
        <div className="mobile-header-logo">
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="#e8c547" fillOpacity="0.18"/>
            <path d="M7 14 Q14 7 21 14 Q14 21 7 14Z" fill="#e8c547" opacity="0.85"/>
            <circle cx="14" cy="14" r="3" fill="#e8c547"/>
          </svg>
          <span className="mobile-header-title">Casa Budget</span>
        </div>
        <div className="mobile-header-right">
          {user?.photoURL && (
            <div className="mobile-header-avatar">
              <img src={user.photoURL} alt="" />
            </div>
          )}
          <span className="mobile-header-name">{user?.displayName?.split(" ")[0]}</span>
          <button className="mobile-header-logout" onClick={signOut} title="Sign out">
            <Icon name="logout" size={16}/>
          </button>
        </div>
      </header>

      <nav className="sidebar">
        <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="#e8c547" fillOpacity="0.15"/>
            <path d="M7 14 Q14 7 21 14 Q14 21 7 14Z" fill="#e8c547" opacity="0.8"/>
            <circle cx="14" cy="14" r="3" fill="#e8c547"/>
          </svg>
          <span className="sidebar-logo-text">Casa Budget</span>
        </div>

        {/* Desktop: show all nav items */}
        <div className="nav-desktop">
          {NAV.map(n => (
            <button key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}>
              <Icon name={n.icon} size={15}/>{n.label}
            </button>
          ))}
        </div>

        {/* Mobile: show primary 4 + More button */}
        <div className="nav-mobile">
          {NAV_PRIMARY.map(n => n.id === "more" ? (
            <button key="more"
              className={`nav-item ${(showMore || isMorePage) ? "active" : ""}`}
              onClick={() => setShowMore(s => !s)}>
              <Icon name="grid" size={20}/><span>More</span>
            </button>
          ) : (
            <button key={n.id} className={`nav-item ${page===n.id && !showMore ? "active" : ""}`}
              onClick={() => { setPage(n.id); setShowMore(false); }}>
              <Icon name={n.icon} size={20}/><span>{n.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          {household && (
            <div className="household-chip">
              <div className="hh-name">{household.name}</div>
              <div>Code: <span className="hh-code"
                style={{cursor:"pointer"}}
                onClick={() => navigator.clipboard?.writeText(household.code||"")}
                title="Click to copy">
                {household.code}
              </span></div>
            </div>
          )}
          <div className="user-chip">
            <div className="user-avatar">{user?.photoURL?<img src={user.photoURL} alt=""/>:null}</div>
            <span className="user-name">{user?.displayName?.split(" ")[0]}</span>
            <button className="sign-out-btn" onClick={signOut}><Icon name="logout" size={15}/></button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {page==="overview"     && <OverviewPage     transactions={transactions} goals={goals} categories={categories} householdId={householdId} db={db} onNavigate={navigateToTx}/>}
        {page==="transactions" && <TransactionsPage transactions={transactions} categories={categories} onDelete={deleteItem} onEdit={updateTx} onImport={addTx} initialFilter={txFilter} onFilterConsumed={()=>setTxFilter(null)} sfUser={user} db={db}/>}
        {page==="budget"       && <BudgetPage       transactions={transactions} categories={categories} db={db} householdId={householdId} accounts={accounts}/>}
        {page==="categories"   && <CategoriesPage   categories={categories} onAdd={addCategory} onEdit={editCategory} onDelete={deleteCategory}/>}
        {page==="goals"        && <GoalsPage        goals={goals} onDelete={deleteItem} onEdit={saveGoal}/>}
        {page==="bills"        && <BillsPage        bills={bills} onDelete={deleteItem} onToggle={toggleBill}/>}
        {page==="analytics"    && <AnalyticsPage    transactions={transactions} categories={categories}/>}
        {page==="accounts"     && <AccountsPage     accounts={accounts} transactions={transactions} onAdd={addAccount} onEdit={editAccount} onDelete={deleteAccount}/>}
        {page==="howto"        && <HowToPage household={household}/>}

        {FAB[page] && (
          <button className="fab" onClick={FAB[page]}><Icon name="plus" size={22}/></button>
        )}
      </main>

      {showTxModal   && <TxModal  onClose={()=>setShowTxModal(false)}  onSave={addTx}  user={user} categories={categories} accounts={accounts}/>}
      {showGoalModal && <GoalModal goal={null} onClose={()=>setShowGoalModal(false)} onSave={(data)=>saveGoal(null,data)}/>}

      <QuickLogChat
        categories={categories}
        transactions={transactions}
        householdId={householdId}
        onSave={addTx}
        onAddCategory={addCategory}
        user={user}
      />
    </div>
  );
}
