import React, { useState } from "react";
import { getTemp, pct, timeAgo } from "../helpers";

export default function DealPage({ deal, currentUser, onVote, onComment, onBack, isAdmin, onAdminUpdate, onAdminDelete }) {
  const [comment, setComment] = useState("");
  const temp       = getTemp(+deal.hot, +deal.cold);
  const discount   = pct(+deal.deal_price, +deal.original_price);
  const totalVotes = +deal.hot + +deal.cold;
  const hotPct     = Math.round(+deal.hot / Math.max(totalVotes, 1) * 100);

  return (
    <main style={{ maxWidth:1280, margin:"0 auto", padding:"24px 24px" }}>
      {/* Back */}
      <button onClick={onBack}
        style={{ display:"inline-flex", alignItems:"center", gap:8, background:"var(--surface)", border:"1.5px solid var(--border)", borderRadius:8, padding:"8px 16px", fontSize:14, fontWeight:700, color:"var(--text-2)", cursor:"pointer", marginBottom:24, transition:"var(--tr)" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor="var(--brand)"; e.currentTarget.style.color="var(--brand)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text-2)"; }}>
        ← חזרה לדילים
      </button>

      {/* Two-column layout */}
      <div className="deal-page-grid">

        {/* LEFT: Image + Title + Description + Comments */}
        <div>
          {/* Hero image */}
          <div style={{ borderRadius:12, overflow:"hidden", marginBottom:20, boxShadow:"var(--sh-lg)", aspectRatio:"16/9", background:"var(--surface-3)" }}>
            <img src={deal.image_url || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900&q=80"} alt=""
              style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          </div>

          {/* Badges */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
            <span className="badge" style={{ background:temp.bg, color:temp.color, padding:"4px 12px", fontSize:12 }}>{temp.label}</span>
            {deal.is_featured && <span className="badge" style={{ background:"#FFF8E1", color:"#D4920A" }}>⭐ מוצגת</span>}
            {deal.is_expired  && <span className="badge" style={{ background:"#FEECEC", color:"var(--danger)" }}>⏰ פג תוקף</span>}
            {!deal.is_approved && <span className="badge" style={{ background:"var(--brand-lt)", color:"var(--brand)" }}>⏳ ממתין</span>}
            <span className="badge" style={{ background:"var(--surface-2)", color:"var(--text-2)" }}>{deal.category}</span>
          </div>

          {/* Title */}
          <h1 style={{ fontWeight:900, fontSize:26, lineHeight:1.35, marginBottom:10, color:"var(--text)", letterSpacing:"-.3px" }}>
            {deal.title}
          </h1>

          {/* Meta */}
          <div style={{ display:"flex", gap:16, fontSize:13, color:"var(--text-2)", marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:18 }}>{deal.avatar}</span>
              <strong style={{ color:"var(--text)" }}>{deal.username}</strong>
            </span>
            {deal.store && <span style={{ display:"flex", alignItems:"center", gap:4 }}><span>📦</span>{deal.store}</span>}
            <span style={{ display:"flex", alignItems:"center", gap:4 }}><span>🕐</span>{timeAgo(deal.created_at)}</span>
          </div>

          {/* Description */}
          {deal.description && (
            <div style={{ background:"var(--surface)", borderRadius:10, padding:20, marginBottom:20, border:"1px solid var(--border)", lineHeight:1.8, color:"var(--text-2)", fontSize:14, boxShadow:"var(--sh-sm)" }}>
              {deal.description}
            </div>
          )}

          {/* Comments */}
          <div style={{ background:"var(--surface)", borderRadius:12, padding:24, border:"1px solid var(--border)", boxShadow:"var(--sh-sm)" }}>
            <h3 style={{ fontWeight:800, fontSize:16, marginBottom:18, color:"var(--text)", display:"flex", alignItems:"center", gap:8 }}>
              💬 <span>תגובות</span>
              <span style={{ background:"var(--surface-2)", color:"var(--text-2)", borderRadius:20, padding:"2px 10px", fontSize:12, fontWeight:700 }}>
                {deal.comments?.length || 0}
              </span>
            </h3>

            <div style={{ maxHeight:400, overflowY:"auto", marginBottom:18 }}>
              {!deal.comments?.length && (
                <div style={{ textAlign:"center", padding:"32px 24px", color:"var(--text-3)" }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🎤</div>
                  <div style={{ fontWeight:700, fontSize:14 }}>היה הראשון להגיב!</div>
                </div>
              )}
              {deal.comments?.map(c => (
                <div key={c.id} style={{ display:"flex", gap:12, marginBottom:16 }}>
                  <span style={{ fontSize:28, flexShrink:0, lineHeight:1 }}>{c.avatar}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontWeight:700, fontSize:13, color:"var(--text)" }}>{c.username}</span>
                      <span style={{ color:"var(--text-3)", fontSize:11 }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <div style={{ background:"var(--surface-2)", borderRadius:10, padding:"9px 14px", fontSize:13, lineHeight:1.6, color:"var(--text)" }}>
                      {c.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {currentUser ? (
              <div style={{ display:"flex", gap:10, alignItems:"flex-start", background:"var(--surface-2)", border:"1px solid var(--border)", borderRadius:12, padding:12, marginTop:4 }}>
                <span style={{ fontSize:24, flexShrink:0, width:40, height:40, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", background:"#fff", boxShadow:"var(--sh-sm)" }}>
                  {currentUser.avatar}
                </span>
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                  <input value={comment} onChange={e => setComment(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && comment.trim() && (onComment(deal.id, comment), setComment(""))}
                    placeholder="כתוב תגובה..."
                    style={{ width:"100%", minHeight:44, background:"#fff", border:"1.5px solid var(--border)", borderRadius:10, padding:"10px 14px", fontSize:14 }} />
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"var(--text-3)" }}>Enter לשליחה מהירה</span>
                    <button className="btn btn-primary" onClick={() => { onComment(deal.id, comment); setComment(""); }} style={{ padding:"8px 16px", borderRadius:8, fontSize:13 }}>
                      שלח
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background:"var(--surface-2)", border:"1.5px dashed var(--border-2)", borderRadius:10, padding:14, textAlign:"center", fontSize:14, color:"var(--text-2)" }}>
                🔐 התחבר כדי להוסיף תגובה
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Sticky action panel */}
        <div style={{ position:"sticky", top:80 }} className="deal-page-sticky">

          {/* Price card */}
          <div style={{ background:"var(--surface)", borderRadius:12, padding:22, border:"1px solid var(--border)", boxShadow:"var(--sh)", marginBottom:14 }}>
            <div style={{ fontSize:11, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".07em", marginBottom:5 }}>מחיר עסקה</div>
            <div style={{ fontWeight:900, fontSize:40, color:"var(--hot)", lineHeight:1, letterSpacing:"-1px", marginBottom:5 }}>
              ₪{(+deal.deal_price).toLocaleString()}
            </div>
            {deal.original_price > deal.deal_price && (
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <span style={{ textDecoration:"line-through", color:"var(--text-3)", fontSize:16 }}>
                  ₪{(+deal.original_price).toLocaleString()}
                </span>
                {discount > 0 && (
                  <span style={{ background:"var(--brand)", color:"#fff", borderRadius:8, padding:"3px 10px", fontSize:13, fontWeight:800 }}>
                    -{discount}%
                  </span>
                )}
              </div>
            )}

            <a href={deal.url} target="_blank" rel="noreferrer" style={{ textDecoration:"none", display:"block", marginBottom:14 }}>
              <button className="btn btn-primary" style={{ width:"100%", padding:"13px", fontSize:15, borderRadius:10 }}>
                🛒 עבור למבצע
              </button>
            </a>

            {/* Votes */}
            <div style={{ display:"flex", gap:10, marginBottom:14 }}>
              <button className="vote-btn vote-hot" style={{ flex:1, justifyContent:"center", padding:"11px", fontSize:14 }} onClick={() => onVote(deal.id, "hot")}>
                🔥 <span style={{ fontWeight:900, fontSize:17 }}>{deal.hot}</span>
              </button>
              <button className="vote-btn vote-cold" style={{ flex:1, justifyContent:"center", padding:"11px", fontSize:14 }} onClick={() => onVote(deal.id, "cold")}>
                🧊 <span style={{ fontWeight:900, fontSize:17 }}>{deal.cold}</span>
              </button>
            </div>

            {/* Progress bar */}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-3)", marginBottom:5 }}>
                <span>🔥 {deal.hot} קולות</span>
                <span>🧊 {deal.cold} קולות</span>
              </div>
              <div style={{ height:7, borderRadius:4, background:"var(--surface-3)", overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:4, transition:"width .5s ease", width:`${hotPct}%`, background:"var(--brand)" }} />
              </div>
            </div>
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div style={{ background:"var(--surface)", borderRadius:12, padding:16, border:"1px solid var(--border)", boxShadow:"var(--sh-sm)" }}>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--text-2)", marginBottom:10 }}>⚙️ פעולות ניהול</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {!deal.is_approved && (
                  <button className="btn btn-success" style={{ padding:"9px" }} onClick={() => onAdminUpdate(deal.id, { is_approved:1 })}>✅ אשר דיל</button>
                )}
                <button className="btn btn-ghost" style={{ padding:"9px" }} onClick={() => onAdminUpdate(deal.id, { is_featured: deal.is_featured ? 0 : 1 })}>
                  {deal.is_featured ? "⭐ הסר הצגה" : "⭐ סמן כמוצג"}
                </button>
                <button className="btn btn-ghost" style={{ padding:"9px" }} onClick={() => onAdminUpdate(deal.id, { is_expired: deal.is_expired ? 0 : 1 })}>
                  {deal.is_expired ? "🔄 שחזר" : "⏰ סמן כפג תוקף"}
                </button>
                <button className="btn btn-danger" style={{ padding:"9px" }} onClick={() => { onAdminDelete(deal.id); onBack(); }}>🗑️ מחק דיל</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
