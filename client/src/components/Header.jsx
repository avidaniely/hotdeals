import React from "react";

const catIcons = {
  'הכל':          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  'אלקטרוניקה':  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  'אוכל ומשקאות':<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  'אופנה':        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>,
  'נסיעות':       <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  'ספורט':        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/></svg>,
  'בית וגינה':    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  'תינוקות':      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 100 10A5 5 0 0012 2z"/><path d="M5 22c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg>,
  'משחקים':       <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1" fill="currentColor"/><circle cx="17" cy="13" r="1" fill="currentColor"/><path d="M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 019.828 16h4.344a2 2 0 011.414.586L17 18c.5.5 1 1 2 1a3 3 0 003-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z"/></svg>,
  'בריאות':       <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
};

const FallbackIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

export default function Header({
  user, search, categories, activeCategory, adminStats,
  onSearch, onCategory, onModal, onAdmin, onLogout,
}) {
  return (
    <header dir="rtl" className="site-header">
      <div className="header-inner">

        {/* ── Top row ─────────────────────────────────── */}
        <div className="header-row">

          {/* Logo */}
          <a href="/" className="header-logo">
            <img src="/logo.png" alt="hotILdeals" />
            <span className="header-logo-name">hotILdeals</span>
          </a>

          {/* Search */}
          <div className="header-search">
            <div className="search-bar">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                placeholder="חפש מותגים, מוצרים, חנויות..."
                value={search}
                onChange={e => onSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="header-actions">
            {user?.role === "admin" && (
              <button
                type="button"
                onClick={onAdmin}
                style={{ position:"relative", height:34, padding:"0 12px", borderRadius:999, border:"1px solid var(--border)", background:"#fff", color:"#111", display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:500, cursor:"pointer" }}
              >
                <span>⚙️</span>
                <span>ניהול</span>
                {adminStats?.pending > 0 && (
                  <span style={{ minWidth:16, height:16, padding:"0 4px", borderRadius:999, background:"var(--danger)", color:"#fff", fontSize:10, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                    {adminStats.pending}
                  </span>
                )}
              </button>
            )}

            {user ? (
              <>
                <button type="button" className="btn-post" onClick={() => onModal("newdeal")}>
                  <span style={{ fontSize:16 }}>+</span> שתף דיל
                </button>
                <div className="user-chip">
                  <div className="user-avatar">{user.avatar}</div>
                  <span style={{ color:"#111", fontSize:13, fontWeight:500, maxWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {user.username}
                  </span>
                  {user.role === "admin" && (
                    <span style={{ fontSize:10, color:"var(--brand)", fontWeight:700 }}>מנהל</span>
                  )}
                  <button type="button" onClick={onLogout} style={{ border:"none", background:"transparent", color:"var(--text-3)", fontSize:12, fontWeight:500, cursor:"pointer", padding:0 }}>
                    יציאה
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="btn-login" onClick={() => onModal("login")}>כניסה</button>
                <button type="button" className="btn-post" onClick={() => onModal("register")}>הצטרף</button>
              </>
            )}
          </div>
        </div>

        {/* ── Category bar ─────────────────────────────── */}
        <div className="cat-nav">
          {["הכל", ...categories.map(c => c.name)].map(c => (
            <button
              key={c}
              type="button"
              className={`cat-btn${activeCategory === c ? " active" : ""}`}
              onClick={() => onCategory(c === "הכל" ? null : c)}
            >
              <span style={{ display:"flex", alignItems:"center", opacity: activeCategory === c ? 1 : 0.7 }}>
                {catIcons[c] || <FallbackIcon />}
              </span>
              <span>{c}</span>
            </button>
          ))}
        </div>

      </div>
    </header>
  );
}
