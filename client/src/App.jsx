// ============================================================
//  App.jsx  –  hotILdeals  (connected to MySQL backend)
//  Place in:  client/src/App.jsx
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, useMatch } from "react-router-dom";
import {
  authAPI, dealsAPI, commentsAPI, categoriesAPI, adminAPI, hunterAPI,
  saveToken, clearToken, getToken,
} from "./api";

// ── Helpers ──────────────────────────────────────────────────
const getTemp = (hot, cold) => {
  const s = hot - cold;
  if (s > 150) return { label: "🔥 לוהט",    color: "#ff2d2d", bg: "#fff0f0" };
  if (s > 80)  return { label: "🔥 חם מאוד", color: "#ff6b00", bg: "#fff5f0" };
  if (s > 30)  return { label: "♨️ חם",       color: "#ff9500", bg: "#fffbf0" };
  if (s > 0)   return { label: "🌤 פושר",     color: "#ffcc00", bg: "#fffdf0" };
  return              { label: "🧊 קר",        color: "#4db6ff", bg: "#f0f8ff" };
};
const pct = (p, o) => o ? Math.round((1 - p / o) * 100) : 0;
const qualityBadge = (score) => {
  if (!score) return null;
  if (score >= 90) return { label: `💎 ${score}`, color: '#7C3AED', bg: '#F5F3FF' };
  if (score >= 75) return { label: `🔥 ${score}`, color: '#DC2626', bg: '#FFF0F0' };
  if (score >= 60) return { label: `⭐ ${score}`, color: '#D97706', bg: '#FFFBF0' };
  if (score >= 45) return { label: `👍 ${score}`, color: '#059669', bg: '#F0FFF7' };
  if (score >= 30) return { label: `💰 ${score}`, color: '#6B7280', bg: '#F3F4F6' };
  return null;
};
const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60)   return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff/60)} דקות`;
  if (diff < 86400)return `לפני ${Math.floor(diff/3600)} שעות`;
  return `לפני ${Math.floor(diff/86400)} ימים`;
};

// ════════════════════════════════════════════════════════════
export default function App() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dealMatch = useMatch('/deal/:id');

  // Derive filter state from URL
  const activeTab      = searchParams.get('sort')     || 'hot';
  const activeCategory = searchParams.get('category') || 'הכל';
  const search         = searchParams.get('search')   || '';
  const page           = parseInt(searchParams.get('page')) || 1;

  const updateParams = (updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v === null || v === undefined || v === '' || v === 1) next.delete(k);
        else next.set(k, String(v));
      });
      return next;
    }, { replace: true });
  };

  const [user,          setUser]          = useState(null);
  const [deals,         setDeals]         = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState(null);
  const [selectedDeal,  setSelectedDeal]  = useState(null);
  const [toast,         setToast]         = useState(null);
  const [totalPages,    setTotalPages]    = useState(1);
  const [adminOpen,     setAdminOpen]     = useState(false);

  // Admin state
  const [adminTab,      setAdminTab]      = useState("deals");
  const [adminDeals,    setAdminDeals]    = useState([]);
  const [adminUsers,    setAdminUsers]    = useState([]);
  const [adminStats,    setAdminStats]    = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Load categories + restore session ─────────────────────
  useEffect(() => {
    categoriesAPI.list().then(cats => setCategories(cats)).catch(() => {});
    if (getToken()) {
      authAPI.me().then(u => setUser(u)).catch(() => clearToken());
    }
  }, []);

  // ── Fetch deals ────────────────────────────────────────────
  const fetchDeals = useCallback(async () => {
    if (dealMatch) return; // don't fetch feed when on deal page
    setLoading(true);
    try {
      const params = { sort: activeTab, page };
      if (activeCategory !== "הכל") params.category = activeCategory;
      if (search) params.search = search;
      const data = await dealsAPI.list(params);
      setDeals(data.deals);
      setTotalPages(data.pages);
    } catch (e) {
      showToast("שגיאה בטעינת הדילים", "error");
    } finally {
      setLoading(false);
    }
  }, [searchParams, dealMatch]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // ── Auth ───────────────────────────────────────────────────
  const login = async (username, password) => {
    try {
      const { token, user: u } = await authAPI.login(username, password);
      saveToken(token);
      setUser(u);
      setModal(null);
      showToast(`ברוך הבא, ${u.username}! 🎉`);
    } catch (e) { showToast(e.message, "error"); }
  };

  const register = async (username, email, password) => {
    try {
      const { token, user: u } = await authAPI.register(username, email, password);
      saveToken(token);
      setUser(u);
      setModal(null);
      showToast(`ברוך הבא לקהילה, ${u.username}! 🎊`);
    } catch (e) { showToast(e.message, "error"); }
  };

  const logout = () => { clearToken(); setUser(null); showToast("להתראות! 👋"); };

  // ── Vote ───────────────────────────────────────────────────
  const vote = async (dealId, voteType) => {
    if (!user) return showToast("יש להתחבר כדי להצביע", "error");
    try {
      await dealsAPI.vote(dealId, voteType);
      fetchDeals();
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Add comment ────────────────────────────────────────────
  const addComment = async (dealId, text) => {
    if (!user) return showToast("יש להתחבר כדי להגיב", "error");
    try {
      const comment = await commentsAPI.add(dealId, text);
      setSelectedDeal(prev => ({ ...prev, comments: [...(prev?.comments || []), comment] }));
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Submit new deal ────────────────────────────────────────
  const submitDeal = async (deal) => {
    try {
      await dealsAPI.create(deal);
      setModal(null);
      fetchDeals();
      showToast(user.role === "admin" ? "העסקה פורסמה!" : "העסקה נשלחה לאישור ✅");
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Open deal page ─────────────────────────────────────────
  const openDeal = (id) => navigate('/deal/' + id);

  // ── Load deal from URL ─────────────────────────────────────
  useEffect(() => {
    if (dealMatch) {
      const id = parseInt(dealMatch.params.id);
      if (!selectedDeal || selectedDeal.id !== id) {
        dealsAPI.get(id).then(setSelectedDeal).catch(() => navigate('/'));
      }
    } else {
      setSelectedDeal(null);
    }
  }, [dealMatch?.params.id]);

  // ── Admin actions ──────────────────────────────────────────
  const loadAdmin = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    const [d, u, s] = await Promise.all([adminAPI.deals(), adminAPI.users(), adminAPI.stats()]);
    setAdminDeals(d); setAdminUsers(u); setAdminStats(s);
  }, [user]);

  const adminUpdateDeal = async (id, patch) => {
    await adminAPI.updateDeal(id, patch);
    await loadAdmin();
    fetchDeals();
    showToast("עודכן!");
  };

  const adminDeleteDeal = async (id) => {
    await dealsAPI.delete(id);
    await loadAdmin();
    fetchDeals();
    showToast("נמחק");
  };

  const adminBanUser = async (id) => {
    await adminAPI.banUser(id);
    await loadAdmin();
    showToast("סטטוס משתמש עודכן");
  };

  return (
    <div style={{ fontFamily: "'Noto Sans Hebrew',Arial,sans-serif", direction: "rtl", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        :root{
          --blue:#0038A8;--blue-2:#1a56db;--blue-dk:#002A8A;
          --hot:#FF4500;--cold:#0099FF;
          --success:#00A85A;--danger:#E8304A;--warn:#F59C00;
          --bg:#EEF2FC;--surface:#fff;--surface-2:#F4F7FF;--surface-3:#EBF0FD;
          --text:#0D1B3E;--text-2:#4A6090;--text-3:#9BADC8;
          --border:rgba(0,56,168,.1);--border-2:rgba(0,56,168,.22);
          --r:16px;--r-lg:24px;--r-sm:10px;
          --sh-sm:0 2px 8px rgba(0,28,84,.07);
          --sh:0 4px 20px rgba(0,28,84,.1),0 1px 4px rgba(0,28,84,.05);
          --sh-lg:0 12px 40px rgba(0,28,84,.14),0 2px 8px rgba(0,28,84,.06);
          --sh-hover:0 20px 60px rgba(0,28,84,.18),0 4px 16px rgba(0,28,84,.08);
          --tr:all .22s cubic-bezier(.4,0,.2,1)
        }
        button{cursor:pointer;font-family:inherit}
        input,textarea,select{font-family:inherit}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border-radius:var(--r-sm);border:none;font-size:14px;font-weight:700;transition:var(--tr);letter-spacing:.01em;white-space:nowrap}
        .btn-primary{background:linear-gradient(135deg,var(--blue-2),var(--blue));color:#fff;box-shadow:0 4px 14px rgba(0,56,168,.3)}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,56,168,.42);filter:brightness(1.08)}
        .btn-primary:active{transform:translateY(1px)}
        .btn-ghost{background:transparent;color:var(--text-2);border:1.5px solid var(--border)}
        .btn-ghost:hover{background:var(--surface-2);border-color:var(--border-2)}
        .btn-danger{background:linear-gradient(135deg,#f0556e,var(--danger));color:#fff;box-shadow:0 3px 10px rgba(232,48,74,.25)}
        .btn-danger:hover{filter:brightness(1.1);transform:translateY(-1px)}
        .btn-success{background:linear-gradient(135deg,#1dbe6e,var(--success));color:#fff;box-shadow:0 3px 10px rgba(0,168,90,.25)}
        .btn-success:hover{filter:brightness(1.1);transform:translateY(-1px)}
        .btn-outline{background:transparent;border:2px solid var(--blue);color:var(--blue)}
        .btn-outline:hover{background:var(--blue);color:#fff}
        input[type=text],input[type=email],input[type=password],input[type=number],input[type=url],textarea,select{width:100%;padding:11px 16px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;outline:none;background:var(--surface-2);transition:var(--tr);direction:rtl;color:var(--text)}
        input:focus,textarea:focus,select:focus{border-color:var(--blue);background:#fff;box-shadow:0 0 0 4px rgba(0,56,168,.1)}
        label{display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--text-2)}
        .modal-overlay{position:fixed;inset:0;background:rgba(8,18,48,.65);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(12px)}
        .modal-box{background:#fff;border-radius:var(--r-lg);padding:36px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.28),0 2px 10px rgba(0,0,0,.12);animation:slideUp .28s cubic-bezier(.34,1.56,.64,1)}
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:14px 28px;border-radius:14px;font-weight:700;z-index:9999;animation:toastIn .35s cubic-bezier(.34,1.56,.64,1);box-shadow:var(--sh-lg);display:flex;align-items:center;gap:10px;font-size:14px}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(24px) scale(.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .vote-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:12px 16px;border:2px solid;border-radius:18px;font-weight:800;font-size:13px;transition:var(--tr);background:var(--surface);min-width:64px;box-shadow:0 8px 18px rgba(0,28,84,.06)}
        .vote-btn:hover{transform:translateY(-2px) scale(1.03);box-shadow:0 14px 24px rgba(0,28,84,.12)}
        .vote-btn:active{transform:scale(.95)}
        .vote-hot{border-color:rgba(255,69,0,.25);color:var(--hot)}
        .vote-hot:hover{border-color:var(--hot);background:rgba(255,69,0,.05)}
        .vote-hot.active{background:linear-gradient(135deg,#ff6a00,var(--hot));color:#fff;border-color:var(--hot);box-shadow:0 4px 14px rgba(255,69,0,.38)}
        .vote-cold{border-color:rgba(0,153,255,.25);color:var(--cold)}
        .vote-cold:hover{border-color:var(--cold);background:rgba(0,153,255,.05)}
        .vote-cold.active{background:linear-gradient(135deg,#00b4ff,var(--cold));color:#fff;border-color:var(--cold);box-shadow:0 4px 14px rgba(0,153,255,.38)}
        .deal-card{background:linear-gradient(180deg,#fff 0%,#f4f7ff 100%);border-radius:22px;border:1px solid var(--border);transition:var(--tr);overflow:hidden;position:relative;box-shadow:0 10px 28px rgba(0,28,84,.08),0 2px 8px rgba(0,28,84,.04)}
        .deal-card:hover{box-shadow:0 24px 54px rgba(0,28,84,.16),0 6px 18px rgba(0,28,84,.08);transform:translateY(-6px);border-color:var(--border-2)}
        .deal-card.featured{border-color:rgba(0,56,168,.28);box-shadow:0 0 0 3px rgba(0,56,168,.08)}
        .deal-card.expired{opacity:.52;filter:grayscale(.25)}
        .deal-entrance{opacity:0;transform:translateY(18px) scale(.985);animation:dealIn .45s cubic-bezier(.22,1,.36,1) forwards}
        @keyframes dealIn{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
        .card-accent{position:absolute;right:0;top:0;bottom:0;width:5px;border-radius:0 22px 22px 0}
        .card-img{overflow:hidden}
        .card-img img{transition:transform .4s cubic-bezier(.4,0,.2,1);display:block}
        .deal-card:hover .card-img img{transform:scale(1.06)}
        .badge{padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
        .skeleton-shimmer{position:relative;overflow:hidden}
        .skeleton-shimmer::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:skeletonMove 1.4s ease-in-out infinite}
        @keyframes skeletonMove{100%{transform:translateX(100%)}}
        .mobile-only{display:none!important}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(0,56,168,.18);border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(0,56,168,.36)}
        @media(max-width:768px){
          .desktop-only{display:none!important}
          .mobile-only{display:block!important}
          .main-grid{grid-template-columns:1fr!important}
          .sidebar{display:none}
          .deal-page-grid{grid-template-columns:1fr!important}
          .deal-page-sticky{position:static!important}
          .deal-card{border-radius:18px}
          .deals-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* HEADER */}
      <header dir="rtl" style={{ position:"sticky", top:0, zIndex:100, width:"100%", background:"rgba(255,255,255,0.96)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", borderBottom:"1px solid var(--border)", boxShadow:"0 4px 20px rgba(13,27,62,0.06)", fontFamily:"'Noto Sans Hebrew',Arial,sans-serif" }}>
        <div style={{ maxWidth:1600, margin:"0 auto", padding:"10px 40px 0" }}>

          {/* Row 1 */}
          <div style={{ display:"flex", alignItems:"center", gap:16, minHeight:74 }}>

            {/* Logo */}
            <a href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none", color:"var(--text)", flexShrink:0 }}>
              <img src="/logo.png" alt="hotILdeals" style={{ height:44, width:"auto", display:"block" }} />
            </a>

            {/* Search */}
            <div style={{ flex:1, display:"flex", justifyContent:"center", minWidth:0 }}>
              <div style={{ width:"100%", maxWidth:680 }}>
                <div style={{ display:"flex", alignItems:"center", height:48, borderRadius:999, background:"#fff", border:"1px solid rgba(13,27,62,0.16)", padding:"0 14px", boxShadow:"0 1px 2px rgba(13,27,62,0.03)" }}>
                  <span style={{ display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text)", marginLeft:10, flexShrink:0 }}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0a7 7 0 0114 0z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <input
                    placeholder="חפש מותגים, מוצרים, חנויות..."
                    value={search}
                    onChange={e => updateParams({ search: e.target.value, page: null })}
                    style={{ flex:1, width:"100%", border:"none", outline:"none", background:"transparent", color:"var(--text)", fontSize:15, fontWeight:400, direction:"rtl" }}
                  />
                </div>
              </div>
            </div>

            {/* User area */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginRight:"auto", flexShrink:0 }}>
              {user?.role === "admin" && (
                <button type="button" onClick={() => { setAdminOpen(true); loadAdmin(); window.scrollTo(0,0); }} style={{ position:"relative", height:40, padding:"0 14px", borderRadius:999, border:"1px solid var(--border)", background:"#fff", color:"#111", display:"flex", alignItems:"center", gap:8, fontSize:14, fontWeight:500, cursor:"pointer" }}>
                  <span style={{ fontSize:15 }}>⚙️</span>
                  <span>ניהול</span>
                  {adminStats?.pending > 0 && <span style={{ minWidth:18, height:18, padding:"0 5px", borderRadius:999, background:"var(--danger)", color:"#fff", fontSize:11, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>{adminStats.pending}</span>}
                </button>
              )}
              {user ? (
                <>
                  <button type="button" onClick={() => setModal("newdeal")} style={{ height:42, padding:"0 18px", borderRadius:999, border:"none", background:"var(--blue)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 8px 18px rgba(0,56,168,0.16)" }}>שתף דיל</button>
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 6px 5px 10px", borderRadius:999, border:"1px solid var(--border)", background:"#fff" }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--surface-3)", color:"var(--blue)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, flexShrink:0 }}>{user.avatar}</div>
                    <span style={{ color:"#111", fontSize:14, fontWeight:500, maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.username}</span>
                    {user.role === "admin" && <span style={{ fontSize:11, color:"var(--blue)", fontWeight:700 }}>מנהל</span>}
                    <button type="button" onClick={logout} style={{ border:"none", background:"transparent", color:"var(--text-2)", fontSize:13, fontWeight:500, cursor:"pointer", padding:0 }}>יציאה</button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setModal("login")} style={{ height:40, padding:"0 16px", borderRadius:999, border:"1px solid var(--border)", background:"#fff", color:"#111", fontSize:14, fontWeight:500, cursor:"pointer" }}>כניסה</button>
                  <button type="button" onClick={() => setModal("register")} style={{ height:42, padding:"0 18px", borderRadius:999, border:"none", background:"var(--blue)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 8px 18px rgba(0,56,168,0.16)" }}>הצטרף</button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Categories */}
          {(() => {
            const catIcons = {
              'הכל':          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
              'אלקטרוניקה':  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
              'אוכל ומשקאות':<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
              'אופנה':        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>,
              'נסיעות':       <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.18 6.18l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
              'ספורט':        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/><path d="M2 12h20"/></svg>,
              'בית וגינה':    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
              'תינוקות':      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 100 10A5 5 0 0012 2z"/><path d="M5 22c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg>,
              'משחקים':       <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="11" r="1" fill="currentColor"/><circle cx="17" cy="13" r="1" fill="currentColor"/><path d="M17.32 5H6.68a4 4 0 00-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 003 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 019.828 16h4.344a2 2 0 011.414.586L17 18c.5.5 1 1 2 1a3 3 0 003-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0017.32 5z"/></svg>,
              'בריאות':       <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
            };
            return (
              <div style={{ display:"flex", alignItems:"center", gap:8, minHeight:54, overflowX:"auto", scrollbarWidth:"none", msOverflowStyle:"none", borderTop:"1px solid rgba(0,56,168,0.06)" }}>
                {["הכל", ...categories.map(c => c.name)].map(c => {
                  const active = activeCategory === c;
                  return (
                    <button key={c} type="button" onClick={() => updateParams({ category: c === 'הכל' ? null : c, page: null })}
                      style={{ height:34, padding:"0 14px", borderRadius:999, border: active ? "1px solid rgba(0,56,168,0.12)" : "1px solid transparent", background: active ? "var(--surface-2)" : "transparent", color: active ? "var(--blue)" : "#111", fontSize:14, fontWeight: active ? 700 : 500, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, transition:"all .18s ease", display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ display:"flex", alignItems:"center", opacity:0.7 }}>{catIcons[c] || <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>}</span>
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

        </div>
      </header>

      {/* MAIN */}
      {adminOpen && user?.role === "admin" ? (
        <AdminPage
          tab={adminTab} onTab={setAdminTab}
          deals={adminDeals} users={adminUsers} stats={adminStats}
          categories={categories}
          onClose={() => setAdminOpen(false)}
          onUpdate={adminUpdateDeal}
          onDelete={adminDeleteDeal}
          onBanUser={adminBanUser}
        />
      ) : dealMatch ? (
        selectedDeal ? (
          <DealPage deal={selectedDeal} currentUser={user} onVote={vote} onComment={addComment}
            onBack={() => navigate('/')} isAdmin={user?.role === "admin"}
            onAdminUpdate={adminUpdateDeal} onAdminDelete={adminDeleteDeal} />
        ) : (
          <div style={{ textAlign:"center", padding:"80px 24px", color:"var(--text-2)", fontSize:16 }}>טוען דיל...</div>
        )
      ) : (
      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "28px 40px" }}>

        {/* Mobile search */}
        <div className="mobile-only" style={{ marginBottom:12 }}>
          <div style={{ display:"flex",alignItems:"center",background:"#fff",border:"1.5px solid var(--border)",borderRadius:18,padding:"0 14px",boxShadow:"var(--sh-sm)" }}>
            <span style={{ color:"var(--text-3)",fontSize:15 }}>🔍</span>
            <input placeholder="חפש דילים, מוצרים, חנויות..." value={search} onChange={e => updateParams({ search: e.target.value, page: null })}
              style={{ background:"transparent",border:"none",color:"var(--text)",fontSize:14,flex:1,outline:"none",padding:"13px 10px",direction:"rtl",width:"100%" }} />
          </div>
        </div>

        {/* Mobile filter tray */}
        <div className="mobile-only" style={{ marginBottom:16 }}>
          <div style={{ background:"var(--surface)",border:"1px solid var(--border)",borderRadius:18,padding:12,boxShadow:"var(--sh)" }}>
            <div style={{ display:"flex",gap:8,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none" }}>
              {[["hot","🔥 הכי חמים"],["new","✨ חדשים"],["quality","💎 איכות"]].map(([id,label]) => (
                <button key={id} onClick={() => updateParams({ sort: id, page: null })}
                  style={{ border:"none",borderRadius:999,padding:"9px 14px",fontWeight:800,fontSize:13,whiteSpace:"nowrap",flexShrink:0,
                    background:activeTab===id?"linear-gradient(135deg,var(--blue-2),var(--blue))":"var(--surface-2)",
                    color:activeTab===id?"#fff":"var(--text-2)" }}>
                  {label}
                </button>
              ))}
              {["הכל",...categories.map(c=>c.name)].map(c => (
                <button key={c} onClick={() => updateParams({ category: c === 'הכל' ? null : c, page: null })}
                  style={{ border:"1px solid var(--border)",borderRadius:999,padding:"9px 14px",fontWeight:800,fontSize:13,whiteSpace:"nowrap",flexShrink:0,
                    background:activeCategory===c?"var(--blue)":"#fff",
                    color:activeCategory===c?"#fff":"var(--text-2)" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 36 }} className="main-grid">

          {/* Feed */}
          <div>
            {/* Sort tabs */}
            <div style={{ display:"flex", gap:0, borderBottom:"2px solid #eef0f8", marginBottom:20 }}>
              {[["hot","🔥 הכי חמים"],["new","✨ חדשים"],["quality","💎 איכות"]].map(([id, label]) => (
                <button key={id} onClick={() => updateParams({ sort: id, page: null })}
                  style={{
                    background:"none",
                    border:"none",
                    borderBottom: activeTab===id ? "3px solid var(--blue)" : "3px solid transparent",
                    marginBottom:-2,
                    padding:"10px 22px",
                    fontWeight: activeTab===id ? 700 : 500,
                    fontSize:14,
                    cursor:"pointer",
                    color: activeTab===id ? "var(--blue)" : "var(--text-2)",
                    transition:"color .15s, border-color .15s",
                  }}
                  onMouseEnter={e => { if(activeTab!==id) e.currentTarget.style.color="var(--text)"; }}
                  onMouseLeave={e => { if(activeTab!==id) e.currentTarget.style.color="var(--text-2)"; }}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ background:"var(--surface)",borderRadius:22,border:"1px solid var(--border)",padding:18,boxShadow:"var(--sh-sm)" }}>
                    <div style={{ display:"flex",gap:18 }}>
                      <div className="skeleton-shimmer" style={{ width:164,height:128,borderRadius:16,background:"var(--surface-3)",flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div className="skeleton-shimmer" style={{ width:"32%",height:20,borderRadius:999,background:"var(--surface-3)",marginBottom:12 }} />
                        <div className="skeleton-shimmer" style={{ width:"78%",height:16,borderRadius:8,background:"var(--surface-3)",marginBottom:10 }} />
                        <div className="skeleton-shimmer" style={{ width:"92%",height:14,borderRadius:8,background:"var(--surface-3)",marginBottom:8 }} />
                        <div className="skeleton-shimmer" style={{ width:"68%",height:14,borderRadius:8,background:"var(--surface-3)",marginBottom:18 }} />
                        <div className="skeleton-shimmer" style={{ width:"34%",height:30,borderRadius:12,background:"var(--surface-3)" }} />
                      </div>
                      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                        <div className="skeleton-shimmer" style={{ width:72,height:64,borderRadius:16,background:"var(--surface-3)" }} />
                        <div className="skeleton-shimmer" style={{ width:72,height:64,borderRadius:16,background:"var(--surface-3)" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : deals.length === 0 ? (
              <div style={{ background:"linear-gradient(180deg,#fff,#f8faff)",borderRadius:24,border:"1px solid var(--border)",textAlign:"center",padding:"70px 28px",boxShadow:"var(--sh)" }}>
                <div style={{ width:90,height:90,margin:"0 auto 18px",borderRadius:28,display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,var(--surface-3),#dfe8ff)",fontSize:42,boxShadow:"0 12px 28px rgba(0,28,84,.08)" }}>🔍</div>
                <div style={{ fontWeight:900,fontSize:24,color:"var(--text)",marginBottom:10 }}>לא נמצאו דילים</div>
                <div style={{ color:"var(--text-2)",fontSize:15,lineHeight:1.7,maxWidth:380,margin:"0 auto 22px" }}>לא מצאנו תוצאות לחיפוש הזה. נסה לשנות את החיפוש, לעבור קטגוריה, או לפרסם דיל חדש.</div>
                <div style={{ display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap" }}>
                  <button className="btn btn-ghost" onClick={() => setSearchParams({}, { replace: true })} style={{ padding:"12px 16px",borderRadius:12 }}>נקה סינון</button>
                  <button className="btn btn-primary" onClick={() => user ? setModal("newdeal") : setModal("register")} style={{ padding:"12px 16px",borderRadius:12 }}>
                    {user ? "שתף דיל חדש" : "הצטרף לקהילה"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {deals.map((deal, index) => (
                    <div key={deal.id} style={{ animationDelay:`${index * 70}ms` }}>
                      <DealCard deal={deal} currentUser={user}
                        onVote={vote} onOpen={() => openDeal(deal.id)}
                        isAdmin={user?.role === "admin"}
                        onAdminUpdate={adminUpdateDeal}
                        onAdminDelete={adminDeleteDeal}
                      />
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 28 }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => updateParams({ page: p })}
                        style={{ width: 38, height: 38, borderRadius: 10, border: "1.5px solid var(--border)", cursor: "pointer",
                          background: p === page ? "linear-gradient(135deg,var(--blue-2),var(--blue))" : "var(--surface)",
                          color: p === page ? "#fff" : "var(--text-2)", fontWeight: 700, fontSize: 14,
                          boxShadow: p === page ? "0 4px 14px rgba(0,56,168,.3)" : "none",
                          transition: "var(--tr)" }}>
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="sidebar" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {adminStats && user?.role === "admin" && (
              <div style={{ background: "var(--surface)", borderRadius: "var(--r)", padding: 20, boxShadow: "var(--sh)", border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📊</span> סטטיסטיקות
                </div>
                {[["דילים סה״כ",adminStats.total_deals,"📋"],["ממתינים",adminStats.pending,"⏳"],["משתמשים",adminStats.total_users,"👥"],["תגובות",adminStats.total_comments,"💬"]].map(([l,v,icon])=>(
                  <div key={l} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--border)" }}>
                    <span style={{ color:"var(--text-2)",fontSize:13,display:"flex",alignItems:"center",gap:6 }}><span>{icon}</span>{l}</span>
                    <span style={{ fontWeight:800,fontSize:17,color:"var(--blue)" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top deals */}
            <div style={{ background:"var(--surface)",borderRadius:20,padding:20,boxShadow:"var(--sh)",border:"1px solid var(--border)" }}>
              <div style={{ fontWeight:900,fontSize:16,marginBottom:16,color:"var(--text)",display:"flex",alignItems:"center",gap:8 }}>
                <span>🏆</span> הכי חמים עכשיו
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {[...deals].sort((a,b)=>(b.hot-b.cold)-(a.hot-a.cold)).slice(0,5).map((d,i)=>(
                  <div key={d.id} onClick={() => openDeal(d.id)}
                    style={{ display:"flex",gap:12,alignItems:"center",padding:12,border:"1px solid var(--border)",borderRadius:16,cursor:"pointer",transition:"var(--tr)",background:"linear-gradient(180deg,#fff,#f8faff)" }}
                    onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 10px 24px rgba(0,28,84,.1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                    <div style={{ width:34,height:34,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,flexShrink:0,
                      background:i===0?"linear-gradient(135deg,#FFD700,#FFA500)":"var(--surface-3)",
                      color:i===0?"#fff":"var(--text-2)" }}>
                      {i+1}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:13,fontWeight:800,lineHeight:1.45,color:"var(--text)",marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{d.title}</div>
                      <div style={{ fontSize:12,color:"var(--hot)",fontWeight:900 }}>₪{(+d.deal_price).toLocaleString()}</div>
                    </div>
                    <div style={{ flexShrink:0,background:"rgba(255,69,0,.08)",color:"var(--hot)",borderRadius:999,padding:"6px 9px",fontSize:12,fontWeight:900 }}>
                      🔥{d.hot-d.cold}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!user && (
              <div style={{ background:"linear-gradient(135deg,#002A8A,#0038A8,#0055DD)",borderRadius:22,padding:26,color:"#fff",textAlign:"center",position:"relative",overflow:"hidden",boxShadow:"0 18px 42px rgba(0,28,84,.24)" }}>
                <div style={{ position:"absolute",top:-18,right:-18,width:110,height:110,borderRadius:"50%",background:"rgba(255,255,255,.06)" }} />
                <div style={{ fontSize:42,marginBottom:12,position:"relative" }}>🇮🇱</div>
                <div style={{ fontWeight:900,fontSize:20,marginBottom:8,position:"relative" }}>הצטרף לקהילה!</div>
                <div style={{ fontSize:14,marginBottom:22,opacity:.86,lineHeight:1.7,position:"relative" }}>שתף דילים, הצבע, שמור מועדפים, וחסוך כסף בכל קנייה</div>
                <button className="btn" onClick={() => setModal("register")} style={{ background:"#fff",color:"var(--blue)",width:"100%",fontWeight:900,padding:14,fontSize:15,borderRadius:14,boxShadow:"0 10px 24px rgba(0,0,0,.18)" }}>הצטרף בחינם</button>
                <button className="btn" onClick={() => setModal("login")} style={{ background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.86)",width:"100%",fontSize:13,marginTop:10,border:"1px solid rgba(255,255,255,.15)",borderRadius:14,padding:12 }}>יש לי חשבון</button>
              </div>
            )}
          </div>
        </div>
      </main>
      )}

      {/* MODALS */}
      {modal === "login"    && <LoginModal onLogin={login} onClose={() => setModal(null)} onRegister={() => setModal("register")} />}
      {modal === "register" && <RegisterModal onRegister={register} onClose={() => setModal(null)} onLogin={() => setModal("login")} />}
      {modal === "newdeal"  && <NewDealModal categories={categories} onSubmit={submitDeal} onClose={() => setModal(null)} />}

      {toast && (
        <div className="toast" style={{ background: toast.type === "error" ? "linear-gradient(135deg,#f0556e,var(--danger))" : "linear-gradient(135deg,#1dbe6e,var(--success))", color: "#fff" }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────
function DealCard({ deal, currentUser, onVote, onOpen, isAdmin, onAdminUpdate, onAdminDelete }) {
  const temp = getTemp(+deal.hot, +deal.cold);
  const discount = pct(+deal.deal_price, +deal.original_price);
  const qBadge = qualityBadge(deal.quality_score);
  return (
    <div className={`deal-card deal-entrance${deal.is_featured ? " featured" : ""}${deal.is_expired ? " expired" : ""}`}>
      {/* Temperature accent bar */}
      <div className="card-accent" style={{ background:`linear-gradient(180deg,${temp.color},${temp.color}66)` }} />

      {/* Header badges */}
      <div style={{ display:"flex",alignItems:"center",gap:6,padding:"12px 18px 0",flexWrap:"wrap" }}>
        <span className="badge" style={{ background:temp.bg,color:temp.color }}>{temp.label}</span>
        {qBadge && <span className="badge" style={{ background:qBadge.bg,color:qBadge.color,fontWeight:800 }} title="ציון איכות דיל">{qBadge.label}</span>}
        {deal.is_featured && <span className="badge" style={{ background:"#FFF8E1",color:"#D4920A" }}>⭐ מוצגת</span>}
        {deal.is_expired && <span className="badge" style={{ background:"#FEECEC",color:"var(--danger)" }}>⏰ פג תוקף</span>}
        {!deal.is_approved && <span className="badge" style={{ background:"#E8F0FE",color:"var(--blue)" }}>⏳ ממתין</span>}
        <span className="badge" style={{ background:"var(--surface-3)",color:"var(--text-2)" }}>{deal.category}</span>
        <span style={{ marginRight:"auto",fontSize:11,color:"var(--text-3)",flexShrink:0 }}>{timeAgo(deal.created_at)}</span>
      </div>

      {/* Body */}
      <div style={{ display:"flex",gap:18,padding:"16px 18px 18px",alignItems:"stretch" }}>
        {/* Image */}
        <div className="card-img" onClick={onOpen}
          style={{ width:164,height:128,borderRadius:16,overflow:"hidden",flexShrink:0,cursor:"pointer",background:"var(--surface-3)",boxShadow:"0 8px 22px rgba(0,28,84,.12)" }}>
          <img src={deal.image_url || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80"} alt=""
            style={{ width:"100%",height:"100%",objectFit:"cover" }} />
        </div>

        {/* Info */}
        <div style={{ flex:1,minWidth:0,display:"flex",flexDirection:"column",justifyContent:"space-between" }}>
          <div>
            <h3 onClick={onOpen}
              style={{ fontWeight:900,fontSize:18,marginBottom:8,cursor:"pointer",lineHeight:1.45,color:"var(--text)",letterSpacing:"-.02em",transition:"var(--tr)" }}
              onMouseEnter={e => { e.currentTarget.style.color="var(--blue)"; e.currentTarget.style.transform="translateX(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.color="var(--text)"; e.currentTarget.style.transform="translateX(0)"; }}>
              {deal.title}
            </h3>
            <p style={{ fontSize:14,color:"var(--text-2)",marginBottom:14,lineHeight:1.7,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>
              {deal.description}
            </p>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
            <span style={{ fontWeight:900,fontSize:28,color:"var(--hot)",letterSpacing:"-.6px",lineHeight:1 }}>
              ₪{(+deal.deal_price).toLocaleString()}
            </span>
            {deal.original_price > deal.deal_price && (
              <span style={{ textDecoration:"line-through",color:"var(--text-3)",fontSize:15 }}>
                ₪{(+deal.original_price).toLocaleString()}
              </span>
            )}
            {discount > 0 && (
              <span style={{ background:"linear-gradient(135deg,#FF6A00,var(--hot))",color:"#fff",borderRadius:999,padding:"6px 12px",fontSize:13,fontWeight:900,boxShadow:"0 8px 20px rgba(255,69,0,.28)" }}>
                חיסכון {discount}%-
              </span>
            )}
          </div>
          {deal.store && (
            <div style={{ marginTop:8,fontSize:12,color:"var(--text-2)",display:"flex",alignItems:"center",gap:5 }}>
              <span style={{ opacity:.5 }}>📦</span> {deal.store}
            </div>
          )}
        </div>

        {/* Vote column */}
        <div style={{ display:"flex",flexDirection:"column",gap:10,alignItems:"center",flexShrink:0 }}>
          <button className="vote-btn vote-hot" onClick={() => onVote(deal.id,"hot")} style={{ minWidth:72,minHeight:64 }}>
            <span style={{ fontSize:18,lineHeight:1 }}>🔥</span>
            <span style={{ fontSize:11,fontWeight:800,lineHeight:1 }}>חם</span>
            <span style={{ fontSize:18,fontWeight:900,lineHeight:1 }}>{deal.hot}</span>
          </button>
          <button className="vote-btn vote-cold" onClick={() => onVote(deal.id,"cold")} style={{ minWidth:72,minHeight:64 }}>
            <span style={{ fontSize:18,lineHeight:1 }}>🧊</span>
            <span style={{ fontSize:11,fontWeight:800,lineHeight:1 }}>קר</span>
            <span style={{ fontSize:18,fontWeight:900,lineHeight:1 }}>{deal.cold}</span>
          </button>
        </div>
      </div>

      {/* Footer utility strip */}
      <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 18px",borderTop:"1px solid rgba(0,56,168,.08)",background:"linear-gradient(180deg,rgba(244,247,255,.75),rgba(235,240,253,.9))",borderRadius:"0 0 22px 22px",flexWrap:"wrap" }}>
        <span style={{ fontSize:12,color:"var(--text-2)",display:"flex",alignItems:"center",gap:6,padding:"6px 10px",background:"rgba(255,255,255,.7)",borderRadius:999 }}>
          <span style={{ fontSize:16 }}>{deal.avatar}</span>
          <span style={{ fontWeight:700 }}>{deal.username}</span>
        </span>
        <button onClick={onOpen} style={{ fontSize:12,color:"var(--text-2)",background:"rgba(255,255,255,.7)",border:"none",borderRadius:999,display:"flex",alignItems:"center",gap:6,fontWeight:700,cursor:"pointer",padding:"6px 10px" }}>
          💬 {deal.comment_count}
        </button>
        <a href={deal.url} target="_blank" rel="noreferrer"
          style={{ fontSize:12,color:"#fff",fontWeight:800,display:"flex",alignItems:"center",gap:6,textDecoration:"none",background:"linear-gradient(135deg,var(--blue-2),var(--blue))",borderRadius:999,padding:"7px 12px",boxShadow:"0 8px 18px rgba(0,56,168,.22)" }}>
          🛒 לחנות
        </a>
        {isAdmin && (
          <div style={{ marginRight:"auto",display:"flex",gap:5 }}>
            {!deal.is_approved && <button className="btn btn-success" style={{ padding:"3px 8px",fontSize:10 }} onClick={() => onAdminUpdate(deal.id,{is_approved:1})}>✅</button>}
            <button className="btn btn-ghost" style={{ padding:"3px 8px",fontSize:10 }} onClick={() => onAdminUpdate(deal.id,{is_featured:deal.is_featured?0:1})}>{deal.is_featured?"⭐":"☆"}</button>
            <button className="btn btn-ghost" style={{ padding:"3px 8px",fontSize:10 }} onClick={() => onAdminUpdate(deal.id,{is_expired:deal.is_expired?0:1})}>{deal.is_expired?"🔄":"⏰"}</button>
            <button className="btn btn-danger" style={{ padding:"3px 8px",fontSize:10 }} onClick={() => onAdminDelete(deal.id)}>🗑️</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Auth Modals ──────────────────────────────────────────────────────────────
function LoginModal({ onLogin, onClose, onRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:420,padding:0,overflow:"hidden",borderRadius:26,border:"1px solid rgba(255,255,255,.14)",boxShadow:"0 24px 80px rgba(0,0,0,.28),0 2px 10px rgba(0,0,0,.12)" }}>
        <div style={{ background:"linear-gradient(135deg,#002A8A,#0038A8,#0055DD)",padding:"34px 36px 30px",textAlign:"center",position:"relative" }}>
          <div style={{ position:"absolute",inset:0,background:"radial-gradient(circle at top right,rgba(255,255,255,.14),transparent 36%)" }} />
          <button onClick={onClose} style={{ position:"absolute",top:16,left:16,background:"rgba(255,255,255,.16)",border:"1px solid rgba(255,255,255,.14)",color:"#fff",borderRadius:10,width:36,height:36,fontSize:18,cursor:"pointer",lineHeight:"36px",backdropFilter:"blur(8px)" }}>×</button>
          <div style={{ fontSize:44,marginBottom:10,position:"relative" }}>🇮🇱</div>
          <h2 style={{ fontWeight:900,fontSize:24,color:"#fff",marginBottom:4,position:"relative" }}>ברוך הבא!</h2>
          <p style={{ color:"rgba(255,255,255,.7)",fontSize:13,position:"relative" }}>התחבר כדי להצביע ולשתף דילים</p>
        </div>
        <div style={{ padding:"28px 36px 32px" }}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div><label>שם משתמש</label><input placeholder="הכנס שם משתמש" value={username} onChange={e => setUsername(e.target.value)} /></div>
            <div><label>סיסמה</label><input type="password" placeholder="הכנס סיסמה" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && onLogin(username,password)} /></div>
            <button className="btn btn-primary" style={{ width:"100%",padding:14,fontSize:16,marginTop:4,borderRadius:12 }} onClick={() => onLogin(username,password)}>כניסה</button>
            <div style={{ textAlign:"center",fontSize:13,color:"var(--text-2)" }}>
              אין לך חשבון?{" "}
              <button onClick={onRegister} style={{ background:"none",border:"none",color:"var(--blue)",fontWeight:700,fontSize:13,cursor:"pointer" }}>הירשם עכשיו</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterModal({ onRegister, onClose, onLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:420,padding:0,overflow:"hidden",borderRadius:26,border:"1px solid rgba(255,255,255,.14)",boxShadow:"0 24px 80px rgba(0,0,0,.28),0 2px 10px rgba(0,0,0,.12)" }}>
        <div style={{ background:"linear-gradient(135deg,#002A8A,#0038A8,#0055DD)",padding:"34px 36px 30px",textAlign:"center",position:"relative" }}>
          <div style={{ position:"absolute",inset:0,background:"radial-gradient(circle at top right,rgba(255,255,255,.14),transparent 36%)" }} />
          <button onClick={onClose} style={{ position:"absolute",top:16,left:16,background:"rgba(255,255,255,.16)",border:"1px solid rgba(255,255,255,.14)",color:"#fff",borderRadius:10,width:36,height:36,fontSize:18,cursor:"pointer",lineHeight:"36px",backdropFilter:"blur(8px)" }}>×</button>
          <div style={{ fontSize:44,marginBottom:10,position:"relative" }}>🎉</div>
          <h2 style={{ fontWeight:900,fontSize:24,color:"#fff",marginBottom:4,position:"relative" }}>הצטרף לקהילה</h2>
          <p style={{ color:"rgba(255,255,255,.7)",fontSize:13,position:"relative" }}>חינם לגמרי · דילים חמים · חיסכון אמיתי</p>
        </div>
        <div style={{ padding:"28px 36px 32px" }}>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div><label>שם משתמש</label><input placeholder="בחר שם ייחודי" value={username} onChange={e => setUsername(e.target.value)} /></div>
            <div><label>אימייל</label><input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><label>סיסמה</label><input type="password" placeholder="לפחות 6 תווים" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <button className="btn btn-primary" style={{ width:"100%",padding:14,fontSize:16,marginTop:4,borderRadius:12 }} onClick={() => onRegister(username,email,password)}>🚀 צור חשבון</button>
            <div style={{ textAlign:"center",fontSize:13,color:"var(--text-2)" }}>
              כבר יש לך חשבון?{" "}
              <button onClick={onLogin} style={{ background:"none",border:"none",color:"var(--blue)",fontWeight:700,fontSize:13,cursor:"pointer" }}>כניסה</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Deal Modal ───────────────────────────────────────────────────────────
function NewDealModal({ categories, onSubmit, onClose }) {
  const [form, setForm] = useState({ title:"",description:"",url:"",image_url:"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80",store:"",original_price:"",deal_price:"",category_id:"" });
  const set = (k,v) => setForm(p => ({...p,[k]:v}));
  const discount = form.original_price && form.deal_price ? pct(+form.deal_price,+form.original_price) : 0;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:580 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
          <h2 style={{ fontWeight:900,fontSize:22 }}>🛍️ שתף דיל חדש</h2>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:24,color:"var(--mid)",cursor:"pointer" }}>×</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div><label>כותרת *</label><input placeholder="תאר את הדיל..." value={form.title} onChange={e => set("title",e.target.value)} /></div>
          <div><label>תיאור</label><textarea rows={3} placeholder="פרטים נוספים..." value={form.description} onChange={e => set("description",e.target.value)} style={{ resize:"vertical" }} /></div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div><label>מחיר מקורי (₪)</label><input type="number" placeholder="999" value={form.original_price} onChange={e => set("original_price",e.target.value)} /></div>
            <div><label>מחיר עסקה (₪) {discount>0 && <span style={{ color:"var(--hot)" }}>-{discount}%</span>}</label><input type="number" placeholder="599" value={form.deal_price} onChange={e => set("deal_price",e.target.value)} /></div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div><label>חנות *</label><input placeholder="Amazon, KSP..." value={form.store} onChange={e => set("store",e.target.value)} /></div>
            <div><label>קטגוריה *</label>
              <select value={form.category_id} onChange={e => set("category_id",e.target.value)}>
                <option value="">בחר קטגוריה...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div><label>קישור לעסקה</label><input placeholder="https://..." value={form.url} onChange={e => set("url",e.target.value)} /></div>
          <div><label>תמונה (URL)</label><input placeholder="https://..." value={form.image_url} onChange={e => set("image_url",e.target.value)} /></div>
          {form.image_url && <img src={form.image_url} alt="" onError={e => e.target.style.display="none"} style={{ width:"100%",height:120,objectFit:"cover",borderRadius:10 }} />}
          <button className="btn btn-primary" style={{ width:"100%",justifyContent:"center",padding:14,fontSize:16 }}
            onClick={() => { if(!form.title||!form.deal_price||!form.category_id||!form.store) return alert("מלא שדות חובה"); onSubmit(form); }}>
            🚀 פרסם דיל
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Deal Page ────────────────────────────────────────────────────────────────
function DealPage({ deal, currentUser, onVote, onComment, onBack, isAdmin, onAdminUpdate, onAdminDelete }) {
  const [comment, setComment] = useState("");
  const temp = getTemp(+deal.hot, +deal.cold);
  const discount = pct(+deal.deal_price, +deal.original_price);
  const totalVotes = +deal.hot + +deal.cold;
  const hotPct = Math.round(+deal.hot / Math.max(totalVotes, 1) * 100);

  return (
    <main style={{ maxWidth: 1600, margin: "0 auto", padding: "28px 40px" }}>
      {/* Back */}
      <button onClick={onBack} style={{ display:"inline-flex",alignItems:"center",gap:8,background:"var(--surface)",border:"1.5px solid var(--border)",borderRadius:12,padding:"9px 18px",fontSize:14,fontWeight:700,color:"var(--text-2)",cursor:"pointer",marginBottom:28,boxShadow:"var(--sh-sm)",transition:"var(--tr)" }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--border-2)";e.currentTarget.style.color="var(--blue)"}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-2)"}}>
        ← חזרה לדילים
      </button>

      {/* Two-column layout */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 340px",gap:28,alignItems:"start" }} className="deal-page-grid">

        {/* LEFT: Image + Title + Description + Comments */}
        <div>
          {/* Hero image */}
          <div style={{ borderRadius:20,overflow:"hidden",marginBottom:22,boxShadow:"var(--sh-lg)",aspectRatio:"16/9",background:"var(--surface-3)" }}>
            <img src={deal.image_url || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900&q=80"} alt=""
              style={{ width:"100%",height:"100%",objectFit:"cover" }} />
          </div>

          {/* Badges */}
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:14 }}>
            <span className="badge" style={{ background:temp.bg,color:temp.color,padding:"5px 14px",fontSize:13 }}>{temp.label}</span>
            {deal.is_featured && <span className="badge" style={{ background:"#FFF8E1",color:"#D4920A" }}>⭐ מוצגת</span>}
            {deal.is_expired && <span className="badge" style={{ background:"#FEECEC",color:"var(--danger)" }}>⏰ פג תוקף</span>}
            {!deal.is_approved && <span className="badge" style={{ background:"#E8F0FE",color:"var(--blue)" }}>⏳ ממתין</span>}
            <span className="badge" style={{ background:"var(--surface-3)",color:"var(--text-2)" }}>{deal.category}</span>
          </div>

          {/* Title */}
          <h1 style={{ fontWeight:900,fontSize:30,lineHeight:1.3,marginBottom:12,color:"var(--text)",letterSpacing:"-.5px" }}>{deal.title}</h1>

          {/* Meta */}
          <div style={{ display:"flex",gap:18,fontSize:13,color:"var(--text-2)",marginBottom:24,flexWrap:"wrap",alignItems:"center" }}>
            <span style={{ display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ fontSize:18 }}>{deal.avatar}</span>
              <strong style={{ color:"var(--text)" }}>{deal.username}</strong>
            </span>
            {deal.store && <span style={{ display:"flex",alignItems:"center",gap:5 }}><span>📦</span>{deal.store}</span>}
            <span style={{ display:"flex",alignItems:"center",gap:5 }}><span>🕐</span>{timeAgo(deal.created_at)}</span>
          </div>

          {/* Description */}
          {deal.description && (
            <div style={{ background:"var(--surface)",borderRadius:16,padding:22,marginBottom:24,border:"1px solid var(--border)",lineHeight:1.85,color:"var(--text-2)",fontSize:15,boxShadow:"var(--sh-sm)" }}>
              {deal.description}
            </div>
          )}

          {/* Comments */}
          <div style={{ background:"var(--surface)",borderRadius:20,padding:28,border:"1px solid var(--border)",boxShadow:"var(--sh)" }}>
            <h3 style={{ fontWeight:800,fontSize:18,marginBottom:20,color:"var(--text)",display:"flex",alignItems:"center",gap:8 }}>
              💬 <span>תגובות</span>
              <span style={{ background:"var(--surface-3)",color:"var(--text-2)",borderRadius:20,padding:"2px 10px",fontSize:13,fontWeight:700 }}>{deal.comments?.length || 0}</span>
            </h3>
            <div style={{ maxHeight:400,overflowY:"auto",marginBottom:20 }}>
              {!deal.comments?.length && (
                <div style={{ textAlign:"center",padding:"40px 24px",color:"var(--text-3)" }}>
                  <div style={{ fontSize:40,marginBottom:10 }}>🎤</div>
                  <div style={{ fontWeight:700,fontSize:15 }}>היה הראשון להגיב!</div>
                </div>
              )}
              {deal.comments?.map(c => (
                <div key={c.id} style={{ display:"flex",gap:12,marginBottom:18 }}>
                  <span style={{ fontSize:30,flexShrink:0,lineHeight:1 }}>{c.avatar}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:6 }}>
                      <span style={{ fontWeight:700,fontSize:13,color:"var(--text)" }}>{c.username}</span>
                      <span style={{ color:"var(--text-3)",fontSize:11 }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <div style={{ background:"var(--surface-2)",borderRadius:12,padding:"10px 16px",fontSize:14,lineHeight:1.6,color:"var(--text)" }}>{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            {currentUser ? (
              <div style={{ display:"flex",gap:12,alignItems:"flex-start",background:"linear-gradient(180deg,rgba(244,247,255,1),rgba(235,240,253,.9))",border:"1px solid var(--border)",borderRadius:18,padding:14,marginTop:8 }}>
                <span style={{ fontSize:28,flexShrink:0,width:44,height:44,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",boxShadow:"var(--sh-sm)" }}>
                  {currentUser.avatar}
                </span>
                <div style={{ flex:1,display:"flex",flexDirection:"column",gap:10 }}>
                  <input value={comment} onChange={e => setComment(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && comment.trim() && (onComment(deal.id,comment),setComment(""))}
                    placeholder="כתוב תגובה..."
                    style={{ width:"100%",minHeight:48,background:"#fff",border:"1.5px solid rgba(0,56,168,.12)",borderRadius:14,padding:"12px 14px",fontSize:14 }} />
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <span style={{ fontSize:12,color:"var(--text-3)" }}>Enter לשליחה מהירה</span>
                    <button className="btn btn-primary" onClick={() => { onComment(deal.id,comment); setComment(""); }} style={{ padding:"10px 18px",borderRadius:12 }}>שלח</button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background:"var(--surface-2)",border:"1.5px dashed var(--border-2)",borderRadius:14,padding:16,textAlign:"center",fontSize:14,color:"var(--text-2)" }}>
                🔐 התחבר כדי להוסיף תגובה
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Sticky action panel */}
        <div style={{ position:"sticky",top:90 }} className="deal-page-sticky">
          {/* Price card */}
          <div style={{ background:"var(--surface)",borderRadius:20,padding:24,border:"1px solid var(--border)",boxShadow:"var(--sh)",marginBottom:16 }}>
            <div style={{ fontSize:11,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:6 }}>מחיר עסקה</div>
            <div style={{ fontWeight:900,fontSize:44,color:"var(--hot)",lineHeight:1,letterSpacing:"-1px",marginBottom:6 }}>
              ₪{(+deal.deal_price).toLocaleString()}
            </div>
            {deal.original_price > deal.deal_price && (
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
                <span style={{ textDecoration:"line-through",color:"var(--text-3)",fontSize:18 }}>₪{(+deal.original_price).toLocaleString()}</span>
                {discount > 0 && (
                  <span style={{ background:"linear-gradient(135deg,#FF6A00,var(--hot))",color:"#fff",borderRadius:10,padding:"4px 12px",fontSize:14,fontWeight:800,boxShadow:"0 3px 10px rgba(255,69,0,.3)" }}>
                    חיסכון {discount}%
                  </span>
                )}
              </div>
            )}
            <a href={deal.url} target="_blank" rel="noreferrer" style={{ textDecoration:"none",display:"block",marginBottom:16 }}>
              <button className="btn btn-primary" style={{ width:"100%",padding:"15px",fontSize:16,borderRadius:14,boxShadow:"0 6px 20px rgba(0,56,168,.35)" }}>
                🛒 עבור למבצע
              </button>
            </a>

            {/* Votes */}
            <div style={{ display:"flex",gap:10,marginBottom:16 }}>
              <button className="vote-btn vote-hot" style={{ flex:1,justifyContent:"center",padding:"12px",fontSize:15 }} onClick={() => onVote(deal.id,"hot")}>
                🔥 <span style={{ fontWeight:900,fontSize:18 }}>{deal.hot}</span>
              </button>
              <button className="vote-btn vote-cold" style={{ flex:1,justifyContent:"center",padding:"12px",fontSize:15 }} onClick={() => onVote(deal.id,"cold")}>
                🧊 <span style={{ fontWeight:900,fontSize:18 }}>{deal.cold}</span>
              </button>
            </div>

            {/* Progress bar */}
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text-3)",marginBottom:6 }}>
                <span>🔥 {deal.hot} קולות</span><span>🧊 {deal.cold} קולות</span>
              </div>
              <div style={{ height:8,borderRadius:4,background:"var(--surface-3)",overflow:"hidden" }}>
                <div style={{ height:"100%",borderRadius:4,transition:"width .6s cubic-bezier(.4,0,.2,1)",width:`${hotPct}%`,background:"linear-gradient(to left,#FF6A00,var(--hot))" }} />
              </div>
            </div>
          </div>

          {/* Admin actions */}
          {isAdmin && (
            <div style={{ background:"var(--surface)",borderRadius:16,padding:18,border:"1px solid var(--border)",boxShadow:"var(--sh-sm)" }}>
              <div style={{ fontWeight:700,fontSize:13,color:"var(--text-2)",marginBottom:12 }}>⚙️ פעולות ניהול</div>
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {!deal.is_approved && <button className="btn btn-success" style={{ padding:"10px" }} onClick={() => onAdminUpdate(deal.id,{is_approved:1})}>✅ אשר דיל</button>}
                <button className="btn btn-ghost" style={{ padding:"10px" }} onClick={() => onAdminUpdate(deal.id,{is_featured:deal.is_featured?0:1})}>{deal.is_featured?"⭐ הסר הצגה":"⭐ סמן כמוצג"}</button>
                <button className="btn btn-ghost" style={{ padding:"10px" }} onClick={() => onAdminUpdate(deal.id,{is_expired:deal.is_expired?0:1})}>{deal.is_expired?"🔄 שחזר":"⏰ סמן כפג תוקף"}</button>
                <button className="btn btn-danger" style={{ padding:"10px" }} onClick={() => { onAdminDelete(deal.id); onBack(); }}>🗑️ מחק דיל</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// ─── Admin Page (full-page, not a modal) ──────────────────────────────────────
function AdminPage({ tab, onTab, deals, users, stats, categories, onClose, onUpdate, onDelete, onBanUser }) {
  // Hunter state
  const [hunting,      setHunting]      = useState(false);
  const [huntResult,   setHuntResult]   = useState(null);
  const [huntingSource, setHuntingSource] = useState(null); // source id being hunted
  const [sources,      setSources]      = useState([]);
  const [srcLoaded,    setSrcLoaded]    = useState(false);
  const [newSrc,       setNewSrc]       = useState({ name:'', url:'', store:'', category_name:'אלקטרוניקה' });
  const [addingSrc,    setAddingSrc]    = useState(false);
  const [editingSrc,   setEditingSrc]   = useState(null); // id of source being edited
  const [editSrcData,  setEditSrcData]  = useState({});
  // AI config state
  const [aiConfig,     setAiConfig]     = useState(null);
  const [aiSaving,     setAiSaving]     = useState(false);
  const [aiSaved,      setAiSaved]      = useState(false);
  // Logs state
  const [logs,         setLogs]         = useState([]);
  const [logsLoaded,   setLogsLoaded]   = useState(false);
  // Prompts state
  const [prompts,      setPrompts]      = useState([]);
  const [promptsLoaded,setPromptsLoaded]= useState(false);
  const [editingPrompt,setEditingPrompt]= useState(null); // null | 'new' | {id,...}
  const [promptDraft,  setPromptDraft]  = useState({ name:'', description:'', prompt_text:'' });
  const [promptSaving, setPromptSaving] = useState(false);
  // OpenAI state
  const [oaiCfg,       setOaiCfg]       = useState(null);
  const [oaiLoaded,    setOaiLoaded]    = useState(false);
  const [oaiSaving,    setOaiSaving]    = useState(false);
  const [oaiSaved,     setOaiSaved]     = useState(false);
  const [oaiRunning,   setOaiRunning]   = useState(false);
  const [oaiRunResult, setOaiRunResult] = useState(null);
  // Import state
  const [importJson,   setImportJson]   = useState('');
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    if ((tab === 'sources' || tab === 'ai') && !srcLoaded) {
      hunterAPI.getSources().then(r => { setSources(r); setSrcLoaded(true); }).catch(() => {});
    }
    if (tab === 'ai' && !aiConfig) {
      hunterAPI.getConfig().then(cfg => setAiConfig(cfg)).catch(() => {});
    }
    if (tab === 'logs' && !logsLoaded) {
      hunterAPI.getLogs().then(r => { setLogs(r); setLogsLoaded(true); }).catch(() => {});
    }
    if ((tab === 'prompts' || tab === 'sources') && !promptsLoaded) {
      hunterAPI.getPrompts().then(r => { setPrompts(r); setPromptsLoaded(true); }).catch(() => {});
    }
    if (tab === 'openai' && !oaiLoaded) {
      hunterAPI.getOpenAIConfig().then(cfg => {
        // sites stored as JSON array string → show as newline-separated for textarea
        try { cfg._sitesText = JSON.parse(cfg.openai_sites || '[]').join('\n'); } catch { cfg._sitesText = ''; }
        setOaiCfg(cfg);
        setOaiLoaded(true);
      }).catch(() => {});
    }
  }, [tab, srcLoaded, aiConfig, logsLoaded, promptsLoaded, oaiLoaded]);

  const runHunterNow = async () => {
    setHunting(true); setHuntResult(null);
    try {
      const result = await hunterAPI.run();
      setHuntResult(result);
      // Refresh logs if on logs tab
      setLogsLoaded(false);
    }
    catch (e) { setHuntResult({ error: e.message }); }
    finally { setHunting(false); }
  };

  const runSourceNow = async (id) => {
    setHuntingSource(id); setHuntResult(null);
    try {
      const result = await hunterAPI.runSource(id);
      setHuntResult(result);
      setLogsLoaded(false);
    }
    catch (e) { setHuntResult({ error: e.message }); }
    finally { setHuntingSource(null); }
  };

  const toggleSource = async (id, cur) => {
    await hunterAPI.toggleSource(id, cur ? 0 : 1);
    setSources(s => s.map(x => x.id === id ? { ...x, is_active: cur ? 0 : 1 } : x));
  };
  const toggleProxy = async (id, cur) => {
    await hunterAPI.toggleProxy(id, cur ? 0 : 1);
    setSources(s => s.map(x => x.id === id ? { ...x, use_proxy: cur ? 0 : 1 } : x));
  };
  const saveEditSrc = async (id) => {
    await hunterAPI.updateSource(id, editSrcData);
    setSources(s => s.map(x => x.id === id ? { ...x, ...editSrcData } : x));
    setEditingSrc(null);
  };
  const toggleSearch = async (id, cur) => {
    await hunterAPI.updateSource(id, { use_search: cur ? 0 : 1 });
    setSources(s => s.map(x => x.id === id ? { ...x, use_search: cur ? 0 : 1 } : x));
  };
  const deleteSource = async (id) => {
    await hunterAPI.deleteSource(id);
    setSources(s => s.filter(x => x.id !== id));
  };
  const addSource = async () => {
    if (!newSrc.name || !newSrc.url || !newSrc.store) return;
    setAddingSrc(true);
    try {
      const created = await hunterAPI.addSource(newSrc);
      setSources(s => [created, ...s]);
      setNewSrc({ name:'', url:'', store:'', category_name:'אלקטרוניקה' });
    } finally { setAddingSrc(false); }
  };
  const saveAiConfig = async () => {
    setAiSaving(true);
    try { await hunterAPI.saveConfig(aiConfig); setAiSaved(true); setTimeout(() => setAiSaved(false), 2500); }
    finally { setAiSaving(false); }
  };


  const TABS = [
    { id:'overview', icon:'📊', label:'סקירה' },
    { id:'deals',    icon:'📋', label:'דילים',    badge: null },
    { id:'pending',  icon:'⏳', label:'ממתינים',  badge: stats?.pending > 0 ? stats.pending : null },
    { id:'users',    icon:'👥', label:'משתמשים' },
    { id:'sources',  icon:'🌐', label:'מקורות' },
    { id:'ai',       icon:'🤖', label:'AI הגדרות' },
    { id:'prompts',  icon:'📝', label:'פרומפטים' },
    { id:'openai',   icon:'✨', label:'OpenAI' },
    { id:'logs',     icon:'📋', label:'לוג' },
  ];

  const inputStyle = { padding:"9px 12px",borderRadius:8,border:"1.5px solid var(--border)",fontSize:13,background:"var(--surface)",color:"var(--text)",width:"100%",boxSizing:"border-box" };
  const fieldLabel = { display:"block",fontSize:12,fontWeight:700,color:"var(--text-2)",marginBottom:5 };

  return (
    <div style={{ minHeight:"calc(100vh - 72px)",background:"var(--bg)",display:"flex",flexDirection:"column" }}>

      {/* ── Page Header ── */}
      <div style={{ background:"linear-gradient(135deg,#002A8A,#0038A8)",padding:"18px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:26 }}>⚙️</span>
          <div>
            <div style={{ fontWeight:900,fontSize:18,color:"#fff" }}>פאנל ניהול</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.55)" }}>hotILdeals admin</div>
          </div>
        </div>
        <button onClick={() => { onClose(); window.scrollTo(0, 0); }}
          style={{ background:"rgba(255,255,255,.15)",border:"1.5px solid rgba(255,255,255,.3)",color:"#fff",borderRadius:10,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
          ← חזור לאתר
        </button>
      </div>

      {/* ── Body: sidebar + content ── */}
      <div style={{ display:"flex",flex:1,maxWidth:1300,width:"100%",margin:"0 auto",padding:"24px",gap:20,alignItems:"flex-start" }}>

        {/* Sidebar */}
        <div style={{ width:180,background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",padding:"12px 8px",display:"flex",flexDirection:"column",gap:2,flexShrink:0,boxShadow:"var(--sh-sm)",position:"sticky",top:24 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => onTab(t.id)}
              style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,transition:"var(--tr)",textAlign:"right",width:"100%",position:"relative",
                background:tab===t.id?"var(--blue)":"transparent",
                color:tab===t.id?"#fff":"var(--text-2)" }}>
              <span style={{ fontSize:16,flexShrink:0 }}>{t.icon}</span>
              <span style={{ flex:1 }}>{t.label}</span>
              {t.badge && <span style={{ background:"var(--danger)",color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:900 }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1,background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",padding:28,boxShadow:"var(--sh-sm)",minHeight:500 }}>

          {/* ── OVERVIEW ── */}
          {tab==="overview" && (
            <div>
              <div style={{ fontWeight:900,fontSize:18,color:"var(--text)",marginBottom:20 }}>סקירה כללית</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:24 }}>
                {[["📋","דילים סה״כ",stats?.total_deals,"var(--blue)","#EEF2FC"],
                  ["⏳","ממתינים לאישור",stats?.pending,"var(--danger)","#FFF0F0"],
                  ["👥","משתמשים",stats?.total_users,"var(--blue)","#EEF2FC"],
                  ["💬","תגובות",stats?.total_comments,"var(--success)","#F0FFF7"],
                  ["⭐","מוצגים",stats?.featured,"var(--warn)","#FFFBF0"],
                ].map(([icon,label,val,color,bg])=>(
                  <div key={label} style={{ background:bg,borderRadius:14,padding:"18px 16px",border:`1px solid ${color}22`,textAlign:"center" }}>
                    <div style={{ fontSize:28,marginBottom:6 }}>{icon}</div>
                    <div style={{ fontSize:28,fontWeight:900,color,lineHeight:1 }}>{val ?? '—'}</div>
                    <div style={{ fontSize:12,color:"var(--text-2)",marginTop:4 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Quick Run Deal Hunter */}
              <div style={{ background:"linear-gradient(135deg,#002A8A,#0047CC)",borderRadius:16,padding:24 }}>
                <div style={{ display:"flex",alignItems:"center",gap:16,flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800,fontSize:16,color:"#fff",marginBottom:4 }}>🤖 Deal Hunter</div>
                    <div style={{ fontSize:13,color:"rgba(255,255,255,.65)" }}>סורק חנויות ישראליות עם AI · רץ אוטומטית לפי הגדרות</div>
                  </div>
                  <button className="btn" onClick={runHunterNow} disabled={hunting}
                    style={{ background:"rgba(255,255,255,.18)",color:"#fff",border:"1.5px solid rgba(255,255,255,.35)",padding:"10px 24px",fontSize:14,flexShrink:0 }}>
                    {hunting ? "🔍 סורק..." : "▶ הרץ עכשיו"}
                  </button>
                </div>
                {huntResult && !huntResult.error && (
                  <div style={{ marginTop:14,background:"rgba(255,255,255,.1)",borderRadius:10,padding:"12px 16px",fontSize:13,color:"#fff",display:"flex",gap:20,flexWrap:"wrap" }}>
                    <span>✅ נמצאו: <strong>{huntResult.found}</strong></span>
                    <span>⏭ כפולים: <strong>{huntResult.skipped}</strong></span>
                    <span>⏱ זמן: <strong>{huntResult.duration}s</strong></span>
                    {huntResult.errors?.length > 0 && <span style={{ color:"#ffaaaa" }}>⚠️ {huntResult.errors.length} שגיאות</span>}
                  </div>
                )}
                {huntResult?.error && (
                  <div style={{ marginTop:14,background:"rgba(255,0,0,.25)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#ffcccc" }}>❌ {huntResult.error}</div>
                )}
              </div>
            </div>
          )}

          {/* ── DEALS / PENDING ── */}
          {(tab==="deals"||tab==="pending") && (
            <div>
              <div style={{ fontWeight:900,fontSize:18,color:"var(--text)",marginBottom:20 }}>
                {tab==="deals" ? `📋 כל הדילים (${deals.length})` : `⏳ ממתינים לאישור (${deals.filter(d=>!d.is_approved).length})`}
              </div>
              {(tab==="deals" ? deals : deals.filter(d=>!d.is_approved)).map(deal => (
                <div key={deal.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
                  <img src={deal.image_url||"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&q=60"} alt=""
                    style={{ width:60,height:48,objectFit:"cover",borderRadius:10,flexShrink:0 }} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text)" }}>{deal.title}</div>
                    <div style={{ fontSize:11,color:"var(--text-2)",marginTop:3,display:"flex",gap:8,flexWrap:"wrap" }}>
                      <span>₪{(+deal.deal_price).toLocaleString()}</span>
                      <span>·</span><span>{deal.store}</span>
                      <span>·</span><span>{deal.category}</span>
                      <span>·</span><span>{deal.avatar}{deal.username}</span>
                      {!deal.is_approved && <span style={{ color:"var(--blue)",fontWeight:700 }}>ממתין</span>}
                      {deal.is_featured && <span style={{ color:"var(--warn)",fontWeight:700 }}>מוצג</span>}
                      {deal.is_expired && <span style={{ color:"var(--danger)",fontWeight:700 }}>פג תוקף</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex",gap:5,flexShrink:0 }}>
                    {!deal.is_approved && <button className="btn btn-success" style={{ padding:"5px 10px",fontSize:11 }} onClick={() => onUpdate(deal.id,{is_approved:1})}>✅ אשר</button>}
                    <button className="btn btn-ghost" style={{ padding:"5px 8px",fontSize:11 }} onClick={() => onUpdate(deal.id,{is_featured:deal.is_featured?0:1})} title={deal.is_featured?"הסר הצגה":"סמן כמוצג"}>{deal.is_featured?"⭐":"☆"}</button>
                    <button className="btn btn-ghost" style={{ padding:"5px 8px",fontSize:11 }} onClick={() => onUpdate(deal.id,{is_expired:deal.is_expired?0:1})} title={deal.is_expired?"שחזר":"סמן כפג תוקף"}>{deal.is_expired?"🔄":"⏰"}</button>
                    <button className="btn btn-danger" style={{ padding:"5px 8px",fontSize:11 }} onClick={() => onDelete(deal.id)}>🗑️</button>
                  </div>
                </div>
              ))}
              {(tab==="pending" && deals.filter(d=>!d.is_approved).length===0) && (
                <div style={{ textAlign:"center",padding:"48px 24px",color:"var(--text-2)" }}>
                  <div style={{ fontSize:48,marginBottom:12 }}>✅</div>
                  <div style={{ fontWeight:700,fontSize:16 }}>אין דילים ממתינים</div>
                </div>
              )}
            </div>
          )}

          {/* ── USERS ── */}
          {tab==="users" && (
            <div>
              <div style={{ fontWeight:900,fontSize:18,color:"var(--text)",marginBottom:20 }}>👥 משתמשים ({users.length})</div>
              {users.map(u => (
                <div key={u.id} style={{ display:"flex",gap:14,alignItems:"center",padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:34,flexShrink:0 }}>{u.avatar}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700,fontSize:14,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                      {u.username}
                      {u.role==="admin" && <span style={{ background:"linear-gradient(135deg,#FFD700,#FFA500)",color:"#333",borderRadius:6,padding:"1px 8px",fontSize:11,fontWeight:800 }}>מנהל</span>}
                      {u.is_banned && <span style={{ background:"#fee",color:"var(--danger)",borderRadius:6,padding:"1px 8px",fontSize:11,fontWeight:800 }}>חסום</span>}
                    </div>
                    <div style={{ fontSize:12,color:"var(--text-2)",marginTop:2 }}>{u.email} · נרשם: {u.created_at?.split("T")[0]}</div>
                  </div>
                  {u.role !== "admin" && (
                    <button className={`btn ${u.is_banned?"btn-success":"btn-danger"}`} style={{ padding:"6px 14px",fontSize:12 }} onClick={() => onBanUser(u.id)}>
                      {u.is_banned ? "🔓 שחרר" : "🚫 חסום"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── SOURCES ── */}
          {tab==="sources" && (
            <div>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                <div style={{ fontWeight:900,fontSize:18,color:"var(--text)" }}>🌐 מקורות סריקה</div>
                <button className="btn" onClick={runHunterNow} disabled={hunting || !!huntingSource}
                  style={{ background:"linear-gradient(135deg,#002A8A,#0047CC)",color:"#fff",padding:"9px 20px",fontSize:13,border:"none" }}>
                  {hunting ? "🔍 סורק הכל..." : "▶ הרץ הכל"}
                </button>
              </div>
              <div style={{ fontSize:13,color:"var(--text-2)",marginBottom:12 }}>הגדר אילו אתרים ה-AI יסרוק לדילים חדשים</div>
              {huntResult && !huntResult.error && (
                <div style={{ marginBottom:14,padding:"10px 16px",borderRadius:10,background:"rgba(0,200,100,.12)",fontSize:13,color:"var(--success)",fontWeight:700 }}>
                  ✅ נמצאו {huntResult.found} דילים · {huntResult.skipped} כפולים · {huntResult.duration}s
                  {huntResult.errors?.length > 0 && <span style={{ color:"var(--danger)",marginRight:8 }}> · ⚠️ {huntResult.errors.length} שגיאות</span>}
                </div>
              )}
              {huntResult?.error && (
                <div style={{ marginBottom:14,padding:"10px 16px",borderRadius:10,background:"rgba(255,0,0,.1)",fontSize:13,color:"var(--danger)",fontWeight:700 }}>❌ {huntResult.error}</div>
              )}

              {/* Add form */}
              <div style={{ background:"var(--surface-2)",borderRadius:14,padding:18,marginBottom:20,border:"1px solid var(--border)" }}>
                <div style={{ fontWeight:700,fontSize:14,marginBottom:14,color:"var(--text)" }}>+ הוסף מקור חדש</div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
                  <div><label style={fieldLabel}>שם מקור</label><input placeholder="KSP, Bug, Amazon..." value={newSrc.name} onChange={e=>setNewSrc(s=>({...s,name:e.target.value}))} style={inputStyle} /></div>
                  <div><label style={fieldLabel}>שם חנות (לתצוגה)</label><input placeholder="KSP" value={newSrc.store} onChange={e=>setNewSrc(s=>({...s,store:e.target.value}))} style={inputStyle} /></div>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,marginBottom:14 }}>
                  <div><label style={fieldLabel}>כתובת URL לסריקה</label><input placeholder="https://ksp.co.il/web/cat/offers" value={newSrc.url} onChange={e=>setNewSrc(s=>({...s,url:e.target.value}))} style={inputStyle} /></div>
                  <div><label style={fieldLabel}>קטגוריה</label>
                    <select value={newSrc.category_name} onChange={e=>setNewSrc(s=>({...s,category_name:e.target.value}))} style={inputStyle}>
                      {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ padding:"9px 22px",fontSize:13 }} onClick={addSource} disabled={addingSrc}>
                  {addingSrc ? "שומר..." : "+ הוסף מקור"}
                </button>
              </div>

              {/* List */}
              {!srcLoaded && <div style={{ textAlign:"center",padding:32,color:"var(--text-2)" }}>טוען...</div>}
              {srcLoaded && sources.length === 0 && (
                <div style={{ textAlign:"center",padding:40,color:"var(--text-2)" }}>
                  <div style={{ fontSize:40,marginBottom:10 }}>🌐</div>
                  <div style={{ fontWeight:700 }}>אין מקורות — הוסף את הראשון למעלה</div>
                </div>
              )}
              {sources.map(src => (
                <div key={src.id} style={{ borderBottom:"1px solid var(--border)" }}>
                  <div style={{ display:"flex",gap:14,alignItems:"center",padding:"14px 0" }}>
                    <div style={{ width:40,height:40,borderRadius:10,background:"var(--surface-3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>🌐</div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:700,fontSize:14,color:"var(--text)" }}>{src.name}
                        <span style={{ fontWeight:400,color:"var(--text-2)",fontSize:12,marginRight:8 }}>{src.store} · {src.category_name}</span>
                      </div>
                      <div style={{ fontSize:11,color:"var(--text-3)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{src.url}</div>
                    </div>
                    <div style={{ display:"flex",gap:8,flexShrink:0,alignItems:"center",flexWrap:"wrap" }}>
                      <select
                        value={src.prompt_id || ''}
                        onChange={async e => {
                          const pid = e.target.value ? +e.target.value : null;
                          await hunterAPI.assignPrompt(src.id, pid);
                          setSources(s => s.map(x => x.id === src.id ? { ...x, prompt_id: pid, prompt_name: prompts.find(p=>p.id===pid)?.name || null } : x));
                        }}
                        style={{ padding:"5px 10px",fontSize:12,borderRadius:8,border:"1.5px solid var(--border)",background:"var(--surface)",color:"var(--text)",cursor:"pointer" }}>
                        <option value="">🌐 גלובלי</option>
                        {prompts.map(p => <option key={p.id} value={p.id}>📝 {p.name}</option>)}
                      </select>
                      <button onClick={() => toggleSource(src.id, src.is_active)}
                        style={{ padding:"5px 14px",fontSize:12,borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,
                          background:src.is_active?"#e8f5e9":"#fce4e4",color:src.is_active?"#2e7d32":"#c62828" }}>
                        {src.is_active ? "● פעיל" : "○ מושהה"}
                      </button>
                      <button onClick={() => toggleProxy(src.id, src.use_proxy)}
                        title={src.use_proxy ? "VPN פרוקסי פעיל — לחץ לכיבוי" : "לחץ להפעלת VPN פרוקסי"}
                        style={{ padding:"5px 12px",fontSize:12,borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,
                          background:src.use_proxy?"#e8f0ff":"var(--surface-3)",color:src.use_proxy?"#002A8A":"var(--text-3)" }}>
                        {src.use_proxy ? "🔒 VPN" : "🌍 ישיר"}
                      </button>
                      <button
                        onClick={async () => {
                          const next = (src.adapter_mode || 'http') === 'http' ? 'browser' : 'http';
                          await hunterAPI.updateSource(src.id, { adapter_mode: next });
                          setSources(s => s.map(x => x.id === src.id ? { ...x, adapter_mode: next } : x));
                        }}
                        title={(src.adapter_mode||'http')==='browser' ? "מצב דפדפן (Playwright) — לחץ למצב HTTP" : "מצב HTTP — לחץ למצב דפדפן (Playwright)"}
                        style={{ padding:"5px 12px",fontSize:12,borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,
                          background:(src.adapter_mode||'http')==='browser'?"#f3e8ff":"var(--surface-3)",
                          color:(src.adapter_mode||'http')==='browser'?"#6b21a8":"var(--text-3)" }}>
                        {(src.adapter_mode||'http')==='browser' ? "🖥️ דפדפן" : "⚡ HTTP"}
                      </button>
                      <button onClick={() => toggleSearch(src.id, src.use_search)}
                        title={src.use_search ? "מצב חיפוש פעיל — לחץ לכיבוי" : "לחץ להפעלת מצב חיפוש (DuckDuckGo)"}
                        style={{ padding:"5px 12px",fontSize:12,borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,
                          background:src.use_search?"#fff8e1":"var(--surface-3)",color:src.use_search?"#e65100":"var(--text-3)" }}>
                        {src.use_search ? "🔎 חיפוש" : "📄 סריקה"}
                      </button>
                      <button
                        onClick={() => runSourceNow(src.id)}
                        disabled={huntingSource === src.id || hunting}
                        style={{ padding:"5px 14px",fontSize:12,borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,
                          background:"linear-gradient(135deg,#002A8A,#0047CC)",color:"#fff",opacity:(huntingSource===src.id||hunting)?0.6:1 }}>
                        {huntingSource === src.id ? "🔍..." : "▶ הרץ"}
                      </button>
                      <button className="btn btn-ghost" style={{ padding:"5px 9px",fontSize:12 }}
                        onClick={() => { setEditingSrc(editingSrc===src.id?null:src.id); setEditSrcData({ name:src.name, url:src.url, store:src.store, category_name:src.category_name, search_query:src.search_query||'' }); }}>
                        ✏️
                      </button>
                      <button className="btn btn-danger" style={{ padding:"5px 9px",fontSize:12 }} onClick={() => deleteSource(src.id)}>🗑️</button>
                    </div>
                  </div>
                  {editingSrc === src.id && (
                    <div style={{ background:"var(--surface-2)",borderRadius:12,padding:16,marginBottom:14,border:"1px solid var(--border)" }}>
                      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10 }}>
                        <div><label style={fieldLabel}>שם מקור</label><input value={editSrcData.name||''} onChange={e=>setEditSrcData(d=>({...d,name:e.target.value}))} style={inputStyle} /></div>
                        <div><label style={fieldLabel}>שם חנות</label><input value={editSrcData.store||''} onChange={e=>setEditSrcData(d=>({...d,store:e.target.value}))} style={inputStyle} /></div>
                      </div>
                      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,marginBottom:12 }}>
                        <div><label style={fieldLabel}>URL</label><input value={editSrcData.url||''} onChange={e=>setEditSrcData(d=>({...d,url:e.target.value}))} style={{...inputStyle,direction:"ltr"}} /></div>
                        <div><label style={fieldLabel}>קטגוריה</label>
                          <select value={editSrcData.category_name||''} onChange={e=>setEditSrcData(d=>({...d,category_name:e.target.value}))} style={inputStyle}>
                            {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      {src.use_search && (
                        <div style={{ marginBottom:12 }}>
                          <label style={fieldLabel}>שאילתת חיפוש (DuckDuckGo)</label>
                          <input value={editSrcData.search_query||''} onChange={e=>setEditSrcData(d=>({...d,search_query:e.target.value}))}
                            placeholder={`${src.store} מבצע deals`} style={{...inputStyle,direction:"ltr"}} />
                          <div style={{ fontSize:11,color:"var(--text-3)",marginTop:4 }}>לדוגמה: <code>amazon.co.il deals ₪</code> · השאר ריק לברירת מחדל</div>
                        </div>
                      )}
                      <div style={{ display:"flex",gap:8 }}>
                        <button className="btn btn-primary" style={{ padding:"7px 20px",fontSize:13 }} onClick={() => saveEditSrc(src.id)}>💾 שמור</button>
                        <button className="btn btn-ghost" style={{ padding:"7px 14px",fontSize:13 }} onClick={() => setEditingSrc(null)}>ביטול</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── AI SETTINGS ── */}
          {tab==="ai" && (
            <div>
              <div style={{ fontWeight:900,fontSize:18,color:"var(--text)",marginBottom:6 }}>🤖 הגדרות AI</div>
              <div style={{ fontSize:13,color:"var(--text-2)",marginBottom:24 }}>הגדר את ספק ה-AI, המודל, הטוקן, הפרומפט ולוח הזמנים לסריקה אוטומטית</div>

              {!aiConfig ? (
                <div style={{ textAlign:"center",padding:40,color:"var(--text-2)" }}>טוען הגדרות...</div>
              ) : (
                <div style={{ display:"flex",flexDirection:"column",gap:20 }}>

                  {/* Provider + model + key */}
                  <div style={{ background:"var(--surface-2)",borderRadius:14,padding:20,border:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800,fontSize:14,color:"var(--text)",marginBottom:16 }}>🔌 ספק AI</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
                      <div>
                        <label style={fieldLabel}>ספק</label>
                        <select value={aiConfig.ai_provider||'anthropic'} onChange={e=>setAiConfig(c=>({...c,ai_provider:e.target.value}))} style={inputStyle}>
                          <option value="anthropic">Anthropic (Claude)</option>
                          <option value="openai">OpenAI (GPT)</option>
                        </select>
                      </div>
                      <div>
                        <label style={fieldLabel}>מודל</label>
                        <input value={aiConfig.ai_model||''} onChange={e=>setAiConfig(c=>({...c,ai_model:e.target.value}))}
                          placeholder="claude-haiku-4-5-20251001" style={inputStyle} />
                      </div>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                      <div>
                        <label style={fieldLabel}>API Key / Token</label>
                        <input type="password" value={aiConfig.ai_api_key||''} onChange={e=>setAiConfig(c=>({...c,ai_api_key:e.target.value}))}
                          placeholder="sk-ant-... / הכנס טוקן חדש" style={inputStyle} />
                        <div style={{ fontSize:11,color:"var(--text-3)",marginTop:4 }}>הטוקן מוצג כ-•••• — הכנס ערך חדש כדי לשנות</div>
                      </div>
                      <div>
                        <label style={fieldLabel}>מקסימום טוקנים לתשובה</label>
                        <input type="number" value={aiConfig.ai_max_tokens||1800} onChange={e=>setAiConfig(c=>({...c,ai_max_tokens:e.target.value}))}
                          min={500} max={4000} style={inputStyle} />
                      </div>
                    </div>
                  </div>

                  {/* Schedule + enabled */}
                  <div style={{ background:"var(--surface-2)",borderRadius:14,padding:20,border:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800,fontSize:14,color:"var(--text)",marginBottom:16 }}>⏰ תזמון</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"end" }}>
                      <div>
                        <label style={fieldLabel}>Cron Expression (שרת צריך restart לאחר שינוי)</label>
                        <input value={aiConfig.schedule||'0 */6 * * *'} onChange={e=>setAiConfig(c=>({...c,schedule:e.target.value}))}
                          placeholder="0 */6 * * *" style={inputStyle} />
                        <div style={{ fontSize:11,color:"var(--text-3)",marginTop:4 }}>
                          כל 6 שעות: <code>0 */6 * * *</code> · כל יום בחצות: <code>0 0 * * *</code> · כל שעה: <code>0 * * * *</code>
                        </div>
                      </div>
                      <div style={{ paddingBottom:22 }}>
                        <button onClick={()=>setAiConfig(c=>({...c,enabled:c.enabled==='1'?'0':'1'}))}
                          style={{ padding:"9px 18px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
                            background:aiConfig.enabled==='1'?"#e8f5e9":"#fce4e4",
                            color:aiConfig.enabled==='1'?"#2e7d32":"#c62828" }}>
                          {aiConfig.enabled==='1' ? "● מופעל" : "○ מושהה"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* VPN Proxy */}
                  <div style={{ background:"var(--surface-2)",borderRadius:14,padding:20,border:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800,fontSize:14,color:"var(--text)",marginBottom:6 }}>🔒 VPN פרוקסי (לאתרים עם הגבלה גיאוגרפית)</div>
                    <div style={{ fontSize:12,color:"var(--text-2)",marginBottom:14 }}>
                      מקורות עם 🔒 VPN יסרקו דרך פרוקסי זה. תמיכה ב-SOCKS5 ו-HTTPS.
                    </div>
                    <div>
                      <label style={fieldLabel}>כתובת פרוקסי</label>
                      <input
                        value={aiConfig.vpn_proxy || ''}
                        onChange={e => setAiConfig(c => ({ ...c, vpn_proxy: e.target.value }))}
                        placeholder="socks5://user:pass@192.168.50.116:1080"
                        style={inputStyle}
                        dir="ltr"
                      />
                      <div style={{ fontSize:11,color:"var(--text-3)",marginTop:4 }}>
                        פורמטים: <code>socks5://user:pass@host:port</code> · <code>http://user:pass@host:port</code>
                      </div>
                    </div>
                  </div>

                  {/* Popularity thresholds */}
                  <div style={{ background:"var(--surface-2)",borderRadius:14,padding:20,border:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800,fontSize:14,color:"var(--text)",marginBottom:6 }}>📈 סף פופולריות (לאתרי אגרגטור)</div>
                    <div style={{ fontSize:12,color:"var(--text-2)",marginBottom:14 }}>
                      השתמש ב-<code style={{ background:"var(--surface-3)",padding:"1px 5px",borderRadius:4 }}>{'{min_votes}'}</code> ו-<code style={{ background:"var(--surface-3)",padding:"1px 5px",borderRadius:4 }}>{'{min_comments}'}</code> בפרומפט כדי לסנן לפי פופולריות
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                      <div>
                        <label style={fieldLabel}>מינימום הצבעות 🔥</label>
                        <input type="number" min={0} max={1000}
                          value={aiConfig.min_votes ?? 5}
                          onChange={e=>setAiConfig(c=>({...c,min_votes:e.target.value}))}
                          style={inputStyle} />
                      </div>
                      <div>
                        <label style={fieldLabel}>מינימום תגובות 💬</label>
                        <input type="number" min={0} max={500}
                          value={aiConfig.min_comments ?? 2}
                          onChange={e=>setAiConfig(c=>({...c,min_comments:e.target.value}))}
                          style={inputStyle} />
                      </div>
                    </div>
                  </div>


                  {/* Save + Run */}
                  <div style={{ display:"flex",alignItems:"center",gap:14,flexWrap:"wrap" }}>
                    <button className="btn btn-primary" style={{ padding:"12px 32px",fontSize:15 }} onClick={saveAiConfig} disabled={aiSaving}>
                      {aiSaving ? "שומר..." : "💾 שמור הגדרות"}
                    </button>
                    <button className="btn" onClick={runHunterNow} disabled={hunting}
                      style={{ background:"linear-gradient(135deg,#002A8A,#0047CC)",color:"#fff",padding:"12px 28px",fontSize:15,border:"none" }}>
                      {hunting ? "🔍 סורק..." : "▶ הרץ עכשיו"}
                    </button>
                    {aiSaved && <span style={{ color:"var(--success)",fontWeight:700,fontSize:14 }}>✅ נשמר בהצלחה!</span>}
                    {huntResult && !huntResult.error && <span style={{ color:"var(--success)",fontWeight:700,fontSize:13 }}>✅ נמצאו {huntResult.found} דילים</span>}
                    {huntResult?.error && <span style={{ color:"var(--danger)",fontWeight:700,fontSize:13 }}>❌ {huntResult.error}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PROMPTS ── */}
          {tab==="prompts" && (
            <div>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
                <div>
                  <div style={{ fontWeight:900,fontSize:18,color:"var(--text)" }}>📝 מאגר פרומפטים</div>
                  <div style={{ fontSize:13,color:"var(--text-2)",marginTop:4 }}>הגדר תבניות פרומפט — הקצה לכל מקור את התבנית המתאימה</div>
                </div>
                {editingPrompt === null && (
                  <button className="btn btn-primary" style={{ fontSize:13 }}
                    onClick={() => { setPromptDraft({ name:'', description:'', prompt_text:'' }); setEditingPrompt('new'); }}>
                    + פרומפט חדש
                  </button>
                )}
              </div>

              {/* Create / Edit form */}
              {editingPrompt !== null && (
                <div style={{ background:"var(--surface-2)",borderRadius:14,padding:20,marginBottom:24,border:"1.5px solid var(--blue)" }}>
                  <div style={{ fontWeight:800,fontSize:15,color:"var(--text)",marginBottom:16 }}>
                    {editingPrompt === 'new' ? '+ פרומפט חדש' : `✏️ עריכה: ${editingPrompt.name}`}
                  </div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
                    <div>
                      <label style={fieldLabel}>שם הפרומפט</label>
                      <input value={promptDraft.name} onChange={e=>setPromptDraft(d=>({...d,name:e.target.value}))}
                        placeholder="מרצ'נט כללי, אגרגטור..." style={inputStyle} />
                    </div>
                    <div>
                      <label style={fieldLabel}>תיאור קצר</label>
                      <input value={promptDraft.description} onChange={e=>setPromptDraft(d=>({...d,description:e.target.value}))}
                        placeholder="לאתרי חנויות, לאגרגטורים..." style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom:6 }}>
                    <label style={fieldLabel}>
                      טקסט הפרומפט
                      <span style={{ fontWeight:400,marginRight:8,color:"var(--text-3)" }}>
                        משתנים: <code style={{ background:"var(--surface-3)",padding:"1px 5px",borderRadius:4 }}>{'{store}'}</code>
                        {' '}<code style={{ background:"var(--surface-3)",padding:"1px 5px",borderRadius:4 }}>{'{min_votes}'}</code>
                        {' '}<code style={{ background:"var(--surface-3)",padding:"1px 5px",borderRadius:4 }}>{'{min_comments}'}</code>
                      </span>
                    </label>
                    <textarea value={promptDraft.prompt_text} onChange={e=>setPromptDraft(d=>({...d,prompt_text:e.target.value}))}
                      rows={10} style={{ ...inputStyle,resize:"vertical",fontFamily:"monospace",fontSize:12,lineHeight:1.6 }} />
                  </div>
                  <div style={{ display:"flex",gap:10,marginTop:14 }}>
                    <button className="btn btn-primary" disabled={promptSaving || !promptDraft.name || !promptDraft.prompt_text}
                      onClick={async () => {
                        setPromptSaving(true);
                        try {
                          if (editingPrompt === 'new') {
                            const created = await hunterAPI.addPrompt(promptDraft);
                            setPrompts(p => [...p, created]);
                          } else {
                            await hunterAPI.updatePrompt(editingPrompt.id, promptDraft);
                            setPrompts(p => p.map(x => x.id === editingPrompt.id ? { ...x, ...promptDraft } : x));
                          }
                          setEditingPrompt(null);
                        } finally { setPromptSaving(false); }
                      }}>
                      {promptSaving ? "שומר..." : "💾 שמור"}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setEditingPrompt(null)}>ביטול</button>
                  </div>
                </div>
              )}

              {/* Prompts list */}
              {!promptsLoaded && <div style={{ textAlign:"center",padding:40,color:"var(--text-2)" }}>טוען...</div>}
              {promptsLoaded && prompts.length === 0 && (
                <div style={{ textAlign:"center",padding:60,color:"var(--text-2)" }}>
                  <div style={{ fontSize:48,marginBottom:12 }}>📝</div>
                  <div style={{ fontWeight:700 }}>אין פרומפטים — צור את הראשון</div>
                </div>
              )}
              {prompts.map(p => (
                <div key={p.id} style={{ borderBottom:"1px solid var(--border)",padding:"16px 0" }}>
                  <div style={{ display:"flex",alignItems:"flex-start",gap:12 }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:4 }}>
                        <span style={{ fontWeight:800,fontSize:15,color:"var(--text)" }}>{p.name}</span>
                        {p.description && <span style={{ fontSize:12,color:"var(--text-2)" }}>{p.description}</span>}
                        <span style={{ fontSize:11,color:"var(--text-3)",marginRight:"auto" }}>
                          מוקצה ל-{sources.filter(s=>s.prompt_id===p.id).length} מקורות
                        </span>
                      </div>
                      <pre style={{ fontSize:11,color:"var(--text-2)",background:"var(--surface-3)",borderRadius:8,padding:"8px 12px",whiteSpace:"pre-wrap",wordBreak:"break-all",maxHeight:80,overflow:"hidden",fontFamily:"monospace",lineHeight:1.5 }}>
                        {p.prompt_text}
                      </pre>
                    </div>
                    <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                      <button className="btn btn-ghost" style={{ padding:"5px 12px",fontSize:12 }}
                        onClick={() => { setPromptDraft({ name:p.name, description:p.description||'', prompt_text:p.prompt_text }); setEditingPrompt(p); }}>
                        ✏️ ערוך
                      </button>
                      <button className="btn btn-danger" style={{ padding:"5px 9px",fontSize:12 }}
                        onClick={async () => {
                          await hunterAPI.deletePrompt(p.id);
                          setPrompts(ps => ps.filter(x => x.id !== p.id));
                          setSources(ss => ss.map(s => s.prompt_id === p.id ? { ...s, prompt_id: null, prompt_name: null } : s));
                        }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── LOGS ── */}
          {tab==="logs" && (
            <div>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
                <div>
                  <div style={{ fontWeight:900,fontSize:18,color:"var(--text)" }}>📋 לוג הרצות Deal Hunter</div>
                  <div style={{ fontSize:13,color:"var(--text-2)",marginTop:4 }}>היסטוריה של כל הרצות — אוטומטיות וידניות</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => { setLogsLoaded(false); }}>🔄 רענן</button>
              </div>

              {!logsLoaded && <div style={{ textAlign:"center",padding:48,color:"var(--text-2)" }}>טוען לוג...</div>}
              {logsLoaded && logs.length === 0 && (
                <div style={{ textAlign:"center",padding:60,color:"var(--text-2)" }}>
                  <div style={{ fontSize:48,marginBottom:12 }}>📋</div>
                  <div style={{ fontWeight:700,fontSize:16 }}>אין הרצות עדיין</div>
                  <div style={{ fontSize:13,marginTop:6 }}>הרץ את ה-Deal Hunter כדי לראות לוגים כאן</div>
                </div>
              )}
              {logsLoaded && logs.length > 0 && (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
                    <thead>
                      <tr style={{ background:"var(--surface-2)",borderBottom:"2px solid var(--border)" }}>
                        {["תאריך ושעה","מופעל ע״י","מקור","נמצאו","כפולים","שגיאות","זמן"].map(h => (
                          <th key={h} style={{ padding:"10px 14px",textAlign:"right",fontWeight:700,color:"var(--text-2)",fontSize:12,whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => {
                        const errs = log.errors ? (() => { try { return JSON.parse(log.errors); } catch(e) { return [log.errors]; } })() : [];
                        return (
                          <React.Fragment key={log.id}>
                            <tr style={{ borderBottom: errs.length > 0 ? "none" : "1px solid var(--border)" }}>
                              <td style={{ padding:"10px 14px",color:"var(--text)",whiteSpace:"nowrap" }}>
                                {new Date(log.run_at).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}
                              </td>
                              <td style={{ padding:"10px 14px" }}>
                                <span style={{ padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                                  background:log.triggered_by==='manual'?"#EEF2FC":"#F0FFF7",
                                  color:log.triggered_by==='manual'?"var(--blue)":"var(--success)" }}>
                                  {log.triggered_by==='manual' ? '👤 ידני' : '🤖 אוטומטי'}
                                </span>
                              </td>
                              <td style={{ padding:"10px 14px",color:"var(--text)",fontSize:12 }}>
                                {log.source_name
                                  ? <span style={{ padding:"2px 8px",borderRadius:6,background:"var(--surface-2)",border:"1px solid var(--border)",fontWeight:600 }}>🌐 {log.source_name}</span>
                                  : <span style={{ color:"var(--text-3)" }}>הכל</span>}
                              </td>
                              <td style={{ padding:"10px 14px",fontWeight:700,color:"var(--success)" }}>{log.total_found}</td>
                              <td style={{ padding:"10px 14px",color:"var(--text-2)" }}>{log.total_skipped}</td>
                              <td style={{ padding:"10px 14px" }}>
                                {errs.length > 0 ? (
                                  <span style={{ color:"var(--danger)",fontWeight:700 }}>⚠️ {errs.length}</span>
                                ) : (
                                  <span style={{ color:"var(--success)" }}>✅ 0</span>
                                )}
                              </td>
                              <td style={{ padding:"10px 14px",color:"var(--text-2)" }}>{log.duration_seconds}s</td>
                            </tr>
                            {errs.length > 0 && (
                              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                                <td colSpan={7} style={{ padding:"0 14px 12px 14px" }}>
                                  <div style={{ background:"#FFF5F5",border:"1px solid #FFCCCC",borderRadius:10,padding:"10px 14px" }}>
                                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
                                      <div style={{ fontSize:11,fontWeight:800,color:"var(--danger)" }}>שגיאות:</div>
                                      <button
                                        onClick={() => navigator.clipboard.writeText(errs.join('\n'))}
                                        style={{ fontSize:11,padding:"3px 10px",borderRadius:6,border:"1px solid #FFAAAA",background:"#fff",color:"var(--danger)",cursor:"pointer",fontWeight:700 }}>
                                        📋 העתק
                                      </button>
                                    </div>
                                    {errs.map((err, i) => (
                                      <div key={i} style={{ fontSize:12,color:"#c62828",fontFamily:"monospace",lineHeight:1.7,wordBreak:"break-all" }}>
                                        • {err}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── OPENAI TAB ── */}
          {tab==="openai" && (
            <div>
              <div style={{ fontWeight:900,fontSize:18,color:"var(--text)",marginBottom:4 }}>✨ OpenAI Deals Scheduler</div>
              <div style={{ fontSize:13,color:"var(--text-2)",marginBottom:24 }}>הגדר את סוכן הדילים האוטומטי — מופעל פעם ביום, שולח דילים לתור האישור</div>

              {!oaiLoaded && <div style={{ textAlign:"center",padding:48,color:"var(--text-2)" }}>טוען...</div>}

              {oaiLoaded && oaiCfg && (() => {
                const set = (key, val) => setOaiCfg(c => ({ ...c, [key]: val }));
                const save = async () => {
                  setOaiSaving(true); setOaiSaved(false);
                  try {
                    let sitesArr = (oaiCfg._sitesText || '').split('\n').map(s => s.trim()).filter(Boolean);
                    await hunterAPI.saveOpenAIConfig({
                      openai_enabled:         oaiCfg.openai_enabled,
                      openai_model:           oaiCfg.openai_model,
                      openai_sites:           JSON.stringify(sitesArr),
                      openai_schedule:        oaiCfg.openai_schedule,
                      openai_timeout:         oaiCfg.openai_timeout,
                      openai_max_retries:     oaiCfg.openai_max_retries,
                      openai_prompt:          oaiCfg.openai_prompt,
                      openai_scoring_prompt:  oaiCfg.openai_scoring_prompt,
                      openai_candidate_limit: oaiCfg.openai_candidate_limit,
                    });
                    setOaiSaved(true);
                    setTimeout(() => setOaiSaved(false), 3000);
                  } catch(e) { alert('שגיאה בשמירה: ' + e.message); }
                  finally { setOaiSaving(false); }
                };
                const runNow = async () => {
                  setOaiRunning(true); setOaiRunResult(null);
                  try { const r = await hunterAPI.runOpenAI(); setOaiRunResult(r); setOaiLoaded(false); }
                  catch(e) { setOaiRunResult({ error: e.message }); }
                  finally { setOaiRunning(false); }
                };
                const doImport = async () => {
                  setImporting(true); setImportResult(null);
                  try {
                    const parsed = JSON.parse(importJson);
                    const r = await hunterAPI.importDeals(parsed);
                    setImportResult(r);
                  } catch(e) { setImportResult({ error: e.message }); }
                  finally { setImporting(false); }
                };

                return (
                  <div style={{ display:"flex",flexDirection:"column",gap:20 }}>

                    {/* Enable + Run */}
                    <div style={{ display:"flex",alignItems:"center",gap:12,padding:"16px 20px",background:"var(--surface-2)",borderRadius:12,border:"1px solid var(--border)" }}>
                      <label style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer",flex:1 }}>
                        <input type="checkbox" checked={oaiCfg.openai_enabled==='1'}
                          onChange={e => set('openai_enabled', e.target.checked ? '1' : '0')}
                          style={{ width:18,height:18,cursor:"pointer" }} />
                        <span style={{ fontWeight:700,fontSize:14,color:"var(--text)" }}>
                          {oaiCfg.openai_enabled==='1' ? '✅ מופעל — ירוץ לפי לוח הזמנים' : '⏸️ מושבת'}
                        </span>
                      </label>
                      <button onClick={runNow} disabled={oaiRunning}
                        className="btn btn-primary" style={{ fontSize:13,padding:"8px 18px",borderRadius:8 }}>
                        {oaiRunning ? '⏳ מריץ...' : '▶ הרץ עכשיו'}
                      </button>
                    </div>

                    {/* Run result */}
                    {oaiRunResult && (
                      <div style={{ padding:"14px 18px",borderRadius:10,border:"1px solid",
                        borderColor: oaiRunResult.error ? "var(--danger)" : "var(--success)",
                        background:  oaiRunResult.error ? "#fff5f5" : "#f0fff7",
                        color:       oaiRunResult.error ? "var(--danger)" : "var(--success)",
                        fontSize:13, fontWeight:700 }}>
                        {oaiRunResult.error ? `❌ ${oaiRunResult.error}` : `✅ יובאו ${oaiRunResult.imported} דילים, דולגו ${oaiRunResult.skipped}`}
                      </div>
                    )}

                    {/* Status */}
                    {(oaiCfg.openai_last_run || oaiCfg.openai_last_status) && (
                      <div style={{ padding:"14px 18px",borderRadius:10,background:"var(--surface-2)",border:"1px solid var(--border)",fontSize:12,display:"flex",flexDirection:"column",gap:6 }}>
                        <div style={{ fontWeight:700,color:"var(--text-2)",marginBottom:2 }}>סטטוס אחרון</div>
                        {oaiCfg.openai_last_run && <div>⏱️ הרצה אחרונה: {new Date(oaiCfg.openai_last_run).toLocaleString('he-IL')}</div>}
                        {oaiCfg.openai_last_status && <div>{oaiCfg.openai_last_status==='success' ? '✅ הצליח' : `❌ נכשל`}</div>}
                        {oaiCfg.openai_last_error && <div style={{ color:"var(--danger)",fontFamily:"monospace",wordBreak:"break-all" }}>שגיאה: {oaiCfg.openai_last_error}</div>}
                        {oaiCfg.openai_last_response && (
                          <details style={{ marginTop:4 }}>
                            <summary style={{ cursor:"pointer",fontWeight:700,color:"var(--text-2)" }}>תגובה אחרונה (תצוגה מקדימה)</summary>
                            <pre style={{ fontSize:11,marginTop:6,padding:10,background:"#fff",borderRadius:6,border:"1px solid var(--border)",overflowX:"auto",maxHeight:500,whiteSpace:"pre-wrap",wordBreak:"break-all" }}>{oaiCfg.openai_last_response}</pre>
                          </details>
                        )}
                      </div>
                    )}

                    {/* Settings grid */}
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
                      <div>
                        <label style={fieldLabel}>מודל OpenAI</label>
                        <input style={inputStyle} value={oaiCfg.openai_model||''} onChange={e=>set('openai_model',e.target.value)} placeholder="gpt-4o-mini" />
                      </div>
                      <div>
                        <label style={fieldLabel}>לוח זמנים (cron)</label>
                        <input style={inputStyle} value={oaiCfg.openai_schedule||''} onChange={e=>set('openai_schedule',e.target.value)} placeholder="0 8 * * *" />
                      </div>
                      <div>
                        <label style={fieldLabel}>Timeout (ms)</label>
                        <input style={inputStyle} type="number" value={oaiCfg.openai_timeout||''} onChange={e=>set('openai_timeout',e.target.value)} />
                      </div>
                      <div>
                        <label style={fieldLabel}>מקסימום ניסיונות חוזרים</label>
                        <input style={inputStyle} type="number" value={oaiCfg.openai_max_retries||''} onChange={e=>set('openai_max_retries',e.target.value)} />
                      </div>
                    </div>

                    {/* Sites */}
                    <div>
                      <label style={fieldLabel}>אתרים לסריקה (אחד בכל שורה)</label>
                      <textarea style={{ ...inputStyle,height:100,resize:"vertical",fontFamily:"monospace",fontSize:12 }}
                        value={oaiCfg._sitesText||''}
                        onChange={e=>set('_sitesText',e.target.value)}
                        placeholder={"ksp.co.il\nivory.co.il\nbug.co.il"} />
                    </div>

                    {/* Scoring Prompt */}
                    <div>
                      <label style={fieldLabel}>🎯 פרומפט דירוג מועמדים — השתמש ב-{'{{site_candidates_json}}'} להכנסת הדאטה שנאספה</label>
                      <div style={{ fontSize:11,color:"var(--text-3)",marginBottom:6 }}>כשמוגדר, המערכת תאסוף מועמדים מהמקורות הפעילים ותשלח אותם ל-OpenAI לדירוג. ריק = מצב ישן (פרומפט כללי בלבד)</div>
                      <textarea style={{ ...inputStyle,height:220,resize:"vertical",fontFamily:"monospace",fontSize:12 }}
                        value={oaiCfg.openai_scoring_prompt||''}
                        onChange={e=>set('openai_scoring_prompt',e.target.value)}
                        placeholder={'You are a deals scoring AI...\nCandidates: {{site_candidates_json}}\n\nReturn JSON: {"d":"...","k":[...],"sites":{...}}'} />
                    </div>

                    {/* Candidate limit */}
                    <div style={{ maxWidth:300 }}>
                      <label style={fieldLabel}>מקסימום מועמדים לאתר (לפרומפט הדירוג)</label>
                      <input style={inputStyle} type="number" min="5" max="100"
                        value={oaiCfg.openai_candidate_limit||'20'}
                        onChange={e=>set('openai_candidate_limit',e.target.value)} />
                    </div>

                    {/* Legacy Prompt */}
                    <details>
                      <summary style={{ cursor:"pointer",fontSize:13,fontWeight:700,color:"var(--text-2)",padding:"8px 0" }}>📜 פרומפט ישן (מצב ללא איסוף) — השתמש ב-{'{{sites}}'}</summary>
                      <textarea style={{ ...inputStyle,height:160,resize:"vertical",fontFamily:"monospace",fontSize:12,marginTop:8 }}
                        value={oaiCfg.openai_prompt||''}
                        onChange={e=>set('openai_prompt',e.target.value)} />
                    </details>

                    {/* Save */}
                    <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                      <button onClick={save} disabled={oaiSaving} className="btn btn-primary" style={{ fontSize:14,padding:"10px 28px",borderRadius:10 }}>
                        {oaiSaving ? '⏳ שומר...' : '💾 שמור הגדרות'}
                      </button>
                      {oaiSaved && <span style={{ color:"var(--success)",fontWeight:700,fontSize:13 }}>✅ נשמר בהצלחה</span>}
                    </div>

                    {/* Manual JSON Import */}
                    <div style={{ borderTop:"2px solid var(--border)",paddingTop:24,marginTop:4 }}>
                      <div style={{ fontWeight:800,fontSize:15,color:"var(--text)",marginBottom:6 }}>📥 ייבוא ידני</div>
                      <div style={{ fontSize:12,color:"var(--text-2)",marginBottom:12 }}>הדבק JSON שקיבלת מסוכן AI חיצוני — ייובא ישירות לתור האישור</div>
                      <textarea style={{ ...inputStyle,height:600,maxHeight:"70vh",resize:"vertical",fontFamily:"monospace",fontSize:11,direction:"ltr",overflowY:"auto" }}
                        value={importJson} onChange={e=>setImportJson(e.target.value)}
                        placeholder={'{"d":"2026-03-31","k":["r","n","p","o","dp","s","u","i"],"sites":{"ksp.co.il":[[1,"מוצר",999,1299,23,87,"https://...",["https://..."]]]}}'} />
                      <div style={{ display:"flex",alignItems:"center",gap:12,marginTop:10 }}>
                        <button onClick={doImport} disabled={importing||!importJson.trim()} className="btn btn-outline" style={{ fontSize:13,padding:"8px 20px",borderRadius:8 }}>
                          {importing ? '⏳ מייבא...' : '📥 ייבא דילים'}
                        </button>
                        {importResult && (
                          <span style={{ fontSize:13,fontWeight:700,color:importResult.error?"var(--danger)":"var(--success)" }}>
                            {importResult.error ? `❌ ${importResult.error}` : `✅ יובאו ${importResult.imported}, דולגו ${importResult.skipped}`}
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>
          )}

        </div>{/* /content */}
      </div>{/* /body */}
    </div>
  );
}
