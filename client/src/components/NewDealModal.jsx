import React, { useState } from "react";
import { pct } from "../helpers";

export default function NewDealModal({ categories, onSubmit, onClose }) {
  const [form, setForm] = useState({
    title:"", description:"", url:"",
    image_url:"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80",
    store:"", original_price:"", deal_price:"", category_id:""
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const discount = form.original_price && form.deal_price ? pct(+form.deal_price, +form.original_price) : 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:580 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h2 style={{ fontWeight:900, fontSize:20 }}>🛍️ שתף דיל חדש</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, color:"var(--text-3)", cursor:"pointer" }}>×</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label>כותרת *</label>
            <input placeholder="תאר את הדיל..." value={form.title} onChange={e => set("title", e.target.value)} />
          </div>
          <div>
            <label>תיאור</label>
            <textarea rows={3} placeholder="פרטים נוספים..." value={form.description} onChange={e => set("description", e.target.value)} style={{ resize:"vertical" }} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label>מחיר מקורי (₪)</label>
              <input type="number" placeholder="999" value={form.original_price} onChange={e => set("original_price", e.target.value)} />
            </div>
            <div>
              <label>
                מחיר עסקה (₪){" "}
                {discount > 0 && <span style={{ color:"var(--brand)" }}>-{discount}%</span>}
              </label>
              <input type="number" placeholder="599" value={form.deal_price} onChange={e => set("deal_price", e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label>חנות *</label>
              <input placeholder="Amazon, KSP..." value={form.store} onChange={e => set("store", e.target.value)} />
            </div>
            <div>
              <label>קטגוריה *</label>
              <select value={form.category_id} onChange={e => set("category_id", e.target.value)}>
                <option value="">בחר קטגוריה...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label>קישור לעסקה</label>
            <input placeholder="https://..." value={form.url} onChange={e => set("url", e.target.value)} />
          </div>
          <div>
            <label>תמונה (URL)</label>
            <input placeholder="https://..." value={form.image_url} onChange={e => set("image_url", e.target.value)} />
          </div>
          {form.image_url && (
            <img src={form.image_url} alt="" onError={e => { e.target.style.display="none"; }}
              style={{ width:"100%", height:100, objectFit:"cover", borderRadius:8 }} />
          )}
          <button
            className="btn btn-primary"
            style={{ width:"100%", justifyContent:"center", padding:13, fontSize:15, borderRadius:10 }}
            onClick={() => {
              if (!form.title || !form.deal_price || !form.category_id || !form.store) return alert("מלא שדות חובה");
              onSubmit(form);
            }}
          >
            🚀 פרסם דיל
          </button>
        </div>
      </div>
    </div>
  );
}
