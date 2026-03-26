// ============================================================
//  App.jsx  –  hotILdeals  (connected to MySQL backend)
//  Place in:  client/src/App.jsx
// ============================================================
import { useState, useEffect, useCallback } from "react";
import {
  authAPI, dealsAPI, commentsAPI, categoriesAPI, adminAPI,
  saveToken, clearToken, getToken,
} from "./api";

const AVATARS = ['🐱','🦊','🐸','🦋','🐧','🦁','🐨','🦄','🐙','🦅'];

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
const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60)   return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff/60)} דקות`;
  if (diff < 86400)return `לפני ${Math.floor(diff/3600)} שעות`;
  return `לפני ${Math.floor(diff/86400)} ימים`;
};

// ════════════════════════════════════════════════════════════
export default function App() {
  const [user,          setUser]          = useState(null);
  const [deals,         setDeals]         = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState(null);
  const [selectedDeal,  setSelectedDeal]  = useState(null);
  const [activeTab,     setActiveTab]     = useState("hot");
  const [activeCategory,setActiveCategory]= useState("הכל");
  const [search,        setSearch]        = useState("");
  const [toast,         setToast]         = useState(null);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);

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
    setLoading(true);
    try {
      const params = { sort: activeTab === "hot" ? "hot" : "new", page };
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
  }, [activeTab, activeCategory, search, page]);

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

  // ── Open deal modal ────────────────────────────────────────
  const openDeal = async (id) => {
    try {
      const deal = await dealsAPI.get(id);
      setSelectedDeal(deal);
    } catch (e) { showToast(e.message, "error"); }
  };

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
    <div style={{ fontFamily: "'Assistant',Arial,sans-serif", direction: "rtl", minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800;900&display=swap');
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
        .modal-box{background:#fff;border-radius:var(--r-lg);padding:36px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:var(--sh-lg);animation:slideUp .28s cubic-bezier(.34,1.56,.64,1)}
        @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:14px 28px;border-radius:14px;font-weight:700;z-index:9999;animation:toastIn .35s cubic-bezier(.34,1.56,.64,1);box-shadow:var(--sh-lg);display:flex;align-items:center;gap:10px;font-size:14px}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(24px) scale(.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .vote-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 16px;border:2px solid;border-radius:14px;font-weight:800;font-size:13px;transition:var(--tr);background:var(--surface);min-width:54px}
        .vote-btn:hover{transform:scale(1.08)}
        .vote-btn:active{transform:scale(.95)}
        .vote-hot{border-color:rgba(255,69,0,.25);color:var(--hot)}
        .vote-hot:hover{border-color:var(--hot);background:rgba(255,69,0,.05)}
        .vote-hot.active{background:linear-gradient(135deg,#ff6a00,var(--hot));color:#fff;border-color:var(--hot);box-shadow:0 4px 14px rgba(255,69,0,.38)}
        .vote-cold{border-color:rgba(0,153,255,.25);color:var(--cold)}
        .vote-cold:hover{border-color:var(--cold);background:rgba(0,153,255,.05)}
        .vote-cold.active{background:linear-gradient(135deg,#00b4ff,var(--cold));color:#fff;border-color:var(--cold);box-shadow:0 4px 14px rgba(0,153,255,.38)}
        .deal-card{background:var(--surface);border-radius:var(--r);border:1px solid var(--border);transition:var(--tr);overflow:hidden;position:relative}
        .deal-card:hover{box-shadow:var(--sh-hover);transform:translateY(-4px);border-color:var(--border-2)}
        .deal-card.featured{border-color:rgba(0,56,168,.28);box-shadow:0 0 0 3px rgba(0,56,168,.08)}
        .deal-card.expired{opacity:.52;filter:grayscale(.25)}
        .card-accent{position:absolute;right:0;top:0;bottom:0;width:5px;border-radius:0 var(--r) var(--r) 0}
        .card-img{overflow:hidden}
        .card-img img{transition:transform .4s cubic-bezier(.4,0,.2,1);display:block}
        .deal-card:hover .card-img img{transform:scale(1.06)}
        .badge{padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(0,56,168,.18);border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(0,56,168,.36)}
        @media(max-width:768px){.desktop-only{display:none!important}.main-grid{grid-template-columns:1fr!important}.sidebar{display:none}.deal-page-grid{grid-template-columns:1fr!important}.deal-page-sticky{position:static!important}}
      `}</style>

      {/* HEADER */}
      <header style={{ background: "linear-gradient(135deg, #002A8A 0%, #0038A8 55%, #0047CC 100%)", color: "#fff", position: "sticky", top: 0, zIndex: 100, borderBottom: "1px solid rgba(255,255,255,.08)", boxShadow: "0 4px 30px rgba(0,28,84,.4)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, height: 70, justifyContent: "space-between" }}>

            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
              <div style={{ fontSize: 34, filter: "drop-shadow(0 2px 6px rgba(0,0,0,.25))", lineHeight: 1 }}>🇮🇱</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: "-0.5px", lineHeight: 1.1, display: "flex", alignItems: "center" }}>
                  <span style={{ color: "#fff" }}>hot</span>
                  <span style={{ background: "linear-gradient(90deg,#7ec8ff,#b8e0ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>IL</span>
                  <span style={{ color: "#fff" }}>deals</span>
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", letterSpacing: "0.07em", textTransform: "uppercase" }}>קהילת הדילים הישראלית</div>
              </div>
            </div>

            {/* Search */}
            <div style={{ flex: 1, maxWidth: 580 }} className="desktop-only">
              <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,.12)", border: "1.5px solid rgba(255,255,255,.18)", borderRadius: 30, padding: "0 18px", backdropFilter: "blur(10px)", transition: "all .2s" }}>
                <span style={{ color: "rgba(255,255,255,.55)", fontSize: 15, flexShrink: 0 }}>🔍</span>
                <input
                  placeholder="חפש דילים, מוצרים, חנויות..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  style={{ background: "transparent", border: "none", color: "#fff", fontSize: 14, flex: 1, outline: "none", padding: "11px 10px", direction: "rtl", width: "100%" }}
                />
              </div>
            </div>

            {/* User area */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              {user ? (
                <>
                  {user.role === "admin" && (
                    <button className="btn btn-outline" style={{ borderColor: "rgba(255,255,255,.4)", color: "#fff", padding: "8px 14px", fontSize: 13, borderRadius: 10 }}
                      onClick={() => { setModal("admin"); loadAdmin(); }}>
                      ⚙️ ניהול
                      {adminStats?.pending > 0 && <span style={{ background: "var(--danger)", color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>{adminStats.pending}</span>}
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={() => setModal("newdeal")} style={{ padding: "8px 18px", fontSize: 13, background: "rgba(255,255,255,.2)", backdropFilter: "blur(10px)", boxShadow: "none", border: "1.5px solid rgba(255,255,255,.3)" }}>
                    ➕ שתף דיל
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 10px", background: "rgba(255,255,255,.12)", borderRadius: 12, border: "1px solid rgba(255,255,255,.15)", backdropFilter: "blur(10px)" }}>
                    <span style={{ fontSize: 22 }}>{user.avatar}</span>
                    <div style={{ lineHeight: 1.2 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{user.username}</div>
                      {user.role === "admin" && <div style={{ fontSize: 10, color: "#a8d0ff" }}>מנהל</div>}
                    </div>
                    <button onClick={logout} style={{ background: "rgba(255,255,255,.12)", border: "none", color: "rgba(255,255,255,.8)", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>יציאה</button>
                  </div>
                </>
              ) : (
                <>
                  <button className="btn" style={{ color: "rgba(255,255,255,.85)", background: "transparent", border: "1.5px solid rgba(255,255,255,.25)", padding: "8px 18px", fontSize: 13 }} onClick={() => setModal("login")}>כניסה</button>
                  <button className="btn btn-primary" style={{ padding: "8px 18px", fontSize: 13, background: "rgba(255,255,255,.2)", backdropFilter: "blur(10px)", boxShadow: "none", border: "1.5px solid rgba(255,255,255,.3)" }} onClick={() => setModal("register")}>הצטרף</button>
                </>
              )}
            </div>
          </div>

          {/* Category bar */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 14px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {["הכל", ...categories.map(c => c.name)].map(c => (
              <button key={c} onClick={() => { setActiveCategory(c); setPage(1); }}
                style={{ border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                  background: activeCategory === c ? "#fff" : "rgba(255,255,255,.12)",
                  color: activeCategory === c ? "var(--blue)" : "rgba(255,255,255,.8)",
                  boxShadow: activeCategory === c ? "0 2px 10px rgba(0,0,0,.15)" : "none",
                  transition: "var(--tr)" }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN */}
      {selectedDeal ? (
        <DealPage deal={selectedDeal} currentUser={user} onVote={vote} onComment={addComment}
          onBack={() => setSelectedDeal(null)} isAdmin={user?.role === "admin"}
          onAdminUpdate={adminUpdateDeal} onAdminDelete={adminDeleteDeal} />
      ) : (
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 28 }} className="main-grid">

          {/* Feed */}
          <div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: 14, padding: 5, marginBottom: 22, boxShadow: "var(--sh)", border: "1px solid var(--border)", width: "fit-content" }}>
              {[["hot","🔥 הכי חמים"],["new","✨ חדשים"]].map(([id, label]) => (
                <button key={id} onClick={() => { setActiveTab(id); setPage(1); }}
                  style={{ border: "none", borderRadius: 10, padding: "9px 22px", fontWeight: 700, fontSize: 14, transition: "var(--tr)",
                    background: activeTab === id ? "linear-gradient(135deg,var(--blue-2),var(--blue))" : "transparent",
                    color: activeTab === id ? "#fff" : "var(--text-2)",
                    boxShadow: activeTab === id ? "0 4px 14px rgba(0,56,168,.3)" : "none" }}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ background: "var(--surface)", borderRadius: "var(--r)", border: "1px solid var(--border)", padding: 20, height: 140, animation: "pulse 1.5s ease-in-out infinite", opacity: .7 }} />
                ))}
              </div>
            ) : deals.length === 0 ? (
              <div style={{ background: "var(--surface)", borderRadius: "var(--r)", border: "1px solid var(--border)", textAlign: "center", padding: "60px 24px", boxShadow: "var(--sh)" }}>
                <div style={{ fontSize: 56, marginBottom: 16, filter: "grayscale(.3)" }}>🔍</div>
                <div style={{ fontWeight: 800, fontSize: 20, color: "var(--text)", marginBottom: 8 }}>לא נמצאו דילים</div>
                <div style={{ color: "var(--text-2)", fontSize: 14 }}>נסה לשנות את החיפוש או הקטגוריה</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {deals.map(deal => (
                    <DealCard key={deal.id} deal={deal} currentUser={user}
                      onVote={vote} onOpen={() => openDeal(deal.id)}
                      isAdmin={user?.role === "admin"}
                      onAdminUpdate={adminUpdateDeal}
                      onAdminDelete={adminDeleteDeal}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 28 }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)}
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
            <div style={{ background: "var(--surface)", borderRadius: "var(--r)", padding: 20, boxShadow: "var(--sh)", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                <span>🏆</span> הכי חמים עכשיו
              </div>
              {[...deals].sort((a,b)=>(b.hot-b.cold)-(a.hot-a.cold)).slice(0,5).map((d,i)=>(
                <div key={d.id} onClick={() => openDeal(d.id)}
                  style={{ display:"flex",gap:10,alignItems:"center",padding:"10px 0",borderBottom:"1px solid var(--border)",cursor:"pointer",transition:"var(--tr)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,flexShrink:0,
                    background: i===0 ? "linear-gradient(135deg,#FFD700,#FFA500)" : i<3 ? "var(--surface-3)" : "var(--bg)",
                    color: i===0 ? "#fff" : "var(--text-2)" }}>
                    {i+1}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:600,lineHeight:1.35,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text)" }}>{d.title}</div>
                    <div style={{ fontSize:12,color:"var(--hot)",fontWeight:800,marginTop:2 }}>₪{(+d.deal_price).toLocaleString()}</div>
                  </div>
                  <div style={{ fontSize:11,fontWeight:700,color:"var(--hot)",flexShrink:0 }}>🔥{d.hot-d.cold}</div>
                </div>
              ))}
            </div>

            {!user && (
              <div style={{ background: "linear-gradient(135deg,#002A8A,#0038A8,#0055DD)", borderRadius: "var(--r)", padding: 24, color: "#fff", textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position:"absolute",top:-20,right:-20,fontSize:80,opacity:.08,pointerEvents:"none" }}>🇮🇱</div>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🇮🇱</div>
                <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>הצטרף לקהילה!</div>
                <div style={{ fontSize: 13, marginBottom: 20, opacity: 0.8, lineHeight: 1.6 }}>שתף דילים, הצבע, וחסוך כסף בכל קנייה</div>
                <button className="btn" onClick={() => setModal("register")} style={{ background: "#fff", color: "var(--blue)", width: "100%", fontWeight: 800, padding: "12px", fontSize: 14, borderRadius: 12, boxShadow: "0 4px 14px rgba(0,0,0,.2)" }}>הצטרף בחינם</button>
                <button className="btn" onClick={() => setModal("login")} style={{ background: "transparent", color: "rgba(255,255,255,.7)", width: "100%", fontSize: 13, marginTop: 8, border: "none" }}>יש לי חשבון →</button>
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
      {modal === "admin" && user?.role === "admin" && (
        <AdminPanel
          tab={adminTab} onTab={setAdminTab}
          deals={adminDeals} users={adminUsers} stats={adminStats}
          onClose={() => setModal(null)}
          onUpdate={adminUpdateDeal}
          onDelete={adminDeleteDeal}
          onBanUser={adminBanUser}
        />
      )}

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
  return (
    <div className={`deal-card${deal.is_featured ? " featured" : ""}${deal.is_expired ? " expired" : ""}`}>
      {/* Temperature accent bar */}
      <div className="card-accent" style={{ background: `linear-gradient(180deg,${temp.color},${temp.color}66)` }} />

      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",gap:6,padding:"12px 18px 0",flexWrap:"wrap" }}>
        <span className="badge" style={{ background:temp.bg,color:temp.color }}>{temp.label}</span>
        {deal.is_featured && <span className="badge" style={{ background:"#FFF8E1",color:"#D4920A" }}>⭐ מוצגת</span>}
        {deal.is_expired && <span className="badge" style={{ background:"#FEECEC",color:"var(--danger)" }}>⏰ פג תוקף</span>}
        {!deal.is_approved && <span className="badge" style={{ background:"#E8F0FE",color:"var(--blue)" }}>⏳ ממתין</span>}
        <span className="badge" style={{ background:"var(--surface-3)",color:"var(--text-2)" }}>{deal.category}</span>
        <span style={{ marginRight:"auto",fontSize:11,color:"var(--text-3)",flexShrink:0 }}>{timeAgo(deal.created_at)}</span>
      </div>

      {/* Body */}
      <div style={{ display:"flex",gap:16,padding:"14px 18px",alignItems:"flex-start" }}>
        {/* Image */}
        <div className="card-img" onClick={onOpen}
          style={{ width:136,height:110,borderRadius:12,overflow:"hidden",flexShrink:0,cursor:"pointer",background:"var(--surface-3)",boxShadow:"var(--sh-sm)" }}>
          <img src={deal.image_url || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80"} alt=""
            style={{ width:"100%",height:"100%",objectFit:"cover" }} />
        </div>

        {/* Info */}
        <div style={{ flex:1,minWidth:0 }}>
          <h3 onClick={onOpen}
            style={{ fontWeight:800,fontSize:16,marginBottom:6,cursor:"pointer",lineHeight:1.35,color:"var(--text)",letterSpacing:"-.01em" }}>
            {deal.title}
          </h3>
          <p style={{ fontSize:13,color:"var(--text-2)",marginBottom:12,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>
            {deal.description}
          </p>
          <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
            <span style={{ fontWeight:900,fontSize:24,color:"var(--hot)",letterSpacing:"-.5px",lineHeight:1 }}>
              ₪{(+deal.deal_price).toLocaleString()}
            </span>
            {deal.original_price > deal.deal_price && (
              <span style={{ textDecoration:"line-through",color:"var(--text-3)",fontSize:14 }}>
                ₪{(+deal.original_price).toLocaleString()}
              </span>
            )}
            {discount > 0 && (
              <span style={{ background:"linear-gradient(135deg,#FF6A00,var(--hot))",color:"#fff",borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:800,boxShadow:"0 2px 8px rgba(255,69,0,.28)" }}>
                -{discount}%
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
        <div style={{ display:"flex",flexDirection:"column",gap:8,alignItems:"center",flexShrink:0 }}>
          <button className="vote-btn vote-hot" onClick={() => onVote(deal.id,"hot")}>
            🔥<span style={{ fontSize:14,fontWeight:900 }}>{deal.hot}</span>
          </button>
          <button className="vote-btn vote-cold" onClick={() => onVote(deal.id,"cold")}>
            🧊<span style={{ fontSize:14,fontWeight:900 }}>{deal.cold}</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 18px",borderTop:"1px solid var(--border)",background:"var(--surface-2)",borderRadius:"0 0 var(--r) var(--r)",flexWrap:"wrap" }}>
        <span style={{ fontSize:12,color:"var(--text-2)",display:"flex",alignItems:"center",gap:5 }}>
          <span style={{ fontSize:16 }}>{deal.avatar}</span>
          <span style={{ fontWeight:600 }}>{deal.username}</span>
        </span>
        <button onClick={onOpen} style={{ fontSize:12,color:"var(--text-2)",background:"none",border:"none",display:"flex",alignItems:"center",gap:4,fontWeight:600,cursor:"pointer" }}>
          💬 {deal.comment_count}
        </button>
        <a href={deal.url} target="_blank" rel="noreferrer"
          style={{ fontSize:12,color:"var(--blue)",fontWeight:700,display:"flex",alignItems:"center",gap:4,textDecoration:"none" }}>
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

// ─── Deal Modal ───────────────────────────────────────────────────────────────
function DealModal({ deal, currentUser, onVote, onComment, onClose }) {
  const [comment, setComment] = useState("");
  const temp = getTemp(+deal.hot, +deal.cold);
  const discount = pct(+deal.deal_price, +deal.original_price);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 680 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
          <div style={{ display:"flex",gap:8 }}>
            <span className="badge" style={{ background:temp.bg,color:temp.color }}>{temp.label}</span>
            <span className="badge" style={{ background:"#f0f4ff",color:"var(--mid)" }}>{deal.category}</span>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:24,color:"var(--mid)",lineHeight:1,cursor:"pointer" }}>×</button>
        </div>
        <img src={deal.image_url || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80"} alt="" style={{ width:"100%",height:220,objectFit:"cover",borderRadius:14,marginBottom:16 }} />
        <h2 style={{ fontWeight:900,fontSize:22,marginBottom:10,lineHeight:1.3 }}>{deal.title}</h2>
        <p style={{ color:"var(--mid)",fontSize:15,lineHeight:1.7,marginBottom:16 }}>{deal.description}</p>
        <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:20,flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:12,color:"var(--mid)",marginBottom:2 }}>מחיר עסקה</div>
            <div style={{ fontWeight:900,fontSize:32,color:"var(--orange)" }}>₪{(+deal.deal_price).toLocaleString()}</div>
          </div>
          {deal.original_price > deal.deal_price && (
            <div>
              <div style={{ fontSize:12,color:"var(--mid)",marginBottom:2 }}>מחיר מקורי</div>
              <div style={{ textDecoration:"line-through",fontSize:20,color:"#aaa" }}>₪{(+deal.original_price).toLocaleString()}</div>
            </div>
          )}
          {discount > 0 && <div style={{ background:"var(--orange)",color:"#fff",borderRadius:12,padding:"8px 16px",fontSize:18,fontWeight:900 }}>חיסכון {discount}%</div>}
        </div>
        <div style={{ display:"flex",gap:12,marginBottom:20,padding:16,background:"#fafafa",borderRadius:14 }}>
          <button className="vote-btn vote-hot" style={{ flex:1 }} onClick={() => onVote(deal.id,"hot")}>🔥 חם! <span style={{ fontSize:18,fontWeight:900 }}>{deal.hot}</span></button>
          <button className="vote-btn vote-cold" style={{ flex:1 }} onClick={() => onVote(deal.id,"cold")}>🧊 קר <span style={{ fontSize:18,fontWeight:900 }}>{deal.cold}</span></button>
          <a href={deal.url} target="_blank" rel="noreferrer">
            <button className="btn btn-primary">🛒 לחנות</button>
          </a>
        </div>
        {/* Progress bar */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--mid)",marginBottom:4 }}>
            <span>🔥 חם ({deal.hot})</span><span>🧊 קר ({deal.cold})</span>
          </div>
          <div style={{ height:6,borderRadius:3,background:"#eee",overflow:"hidden" }}>
            <div style={{ height:"100%",borderRadius:3,transition:".5s",width:`${Math.round(+deal.hot/Math.max(+deal.hot+ +deal.cold,1)*100)}%`,background:"linear-gradient(to right,#ff6b00,#ff2d2d)" }} />
          </div>
        </div>
        {/* Comments */}
        <div>
          <div style={{ fontWeight:800,fontSize:16,marginBottom:14 }}>💬 תגובות ({deal.comments?.length || 0})</div>
          <div style={{ maxHeight:220,overflowY:"auto",marginBottom:14 }}>
            {!deal.comments?.length && <div style={{ color:"var(--mid)",textAlign:"center",padding:24,fontSize:14 }}>היה הראשון להגיב! 🎤</div>}
            {deal.comments?.map(c => (
              <div key={c.id} style={{ display:"flex",gap:10,marginBottom:14 }}>
                <span style={{ fontSize:24,flexShrink:0 }}>{c.avatar}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:4 }}>
                    <span style={{ fontWeight:700,fontSize:13 }}>{c.username}</span>
                    <span style={{ color:"#aaa",fontSize:11 }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <div style={{ background:"#f4f5f7",borderRadius:10,padding:"8px 12px",fontSize:14 }}>{c.text}</div>
                </div>
              </div>
            ))}
          </div>
          {currentUser ? (
            <div style={{ display:"flex",gap:10 }}>
              <span style={{ fontSize:24,flexShrink:0 }}>{currentUser.avatar}</span>
              <div style={{ flex:1,display:"flex",gap:8 }}>
                <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key==="Enter" && (onComment(deal.id,comment),setComment(""))} placeholder="כתוב תגובה..." style={{ flex:1 }} />
                <button className="btn btn-primary" onClick={() => { onComment(deal.id,comment); setComment(""); }} style={{ padding:"10px 16px" }}>שלח</button>
              </div>
            </div>
          ) : (
            <div style={{ background:"#f0f5ff",border:"1px dashed var(--blue)",borderRadius:12,padding:14,textAlign:"center",fontSize:14,color:"var(--mid)" }}>
              🔐 התחבר כדי להוסיף תגובה
            </div>
          )}
        </div>
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
      <div className="modal-box" style={{ maxWidth:420,padding:0,overflow:"hidden" }}>
        <div style={{ background:"linear-gradient(135deg,#002A8A,#0038A8,#0055DD)",padding:"32px 36px 28px",textAlign:"center",position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute",top:16,left:16,background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:8,width:32,height:32,fontSize:18,cursor:"pointer",lineHeight:"32px" }}>×</button>
          <div style={{ fontSize:44,marginBottom:10 }}>🇮🇱</div>
          <h2 style={{ fontWeight:900,fontSize:24,color:"#fff",marginBottom:4 }}>ברוך הבא!</h2>
          <p style={{ color:"rgba(255,255,255,.7)",fontSize:13 }}>התחבר כדי להצביע ולשתף דילים</p>
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
      <div className="modal-box" style={{ maxWidth:420,padding:0,overflow:"hidden" }}>
        <div style={{ background:"linear-gradient(135deg,#002A8A,#0038A8,#0055DD)",padding:"32px 36px 28px",textAlign:"center",position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute",top:16,left:16,background:"rgba(255,255,255,.15)",border:"none",color:"#fff",borderRadius:8,width:32,height:32,fontSize:18,cursor:"pointer",lineHeight:"32px" }}>×</button>
          <div style={{ fontSize:44,marginBottom:10 }}>🎉</div>
          <h2 style={{ fontWeight:900,fontSize:24,color:"#fff",marginBottom:4 }}>הצטרף לקהילה</h2>
          <p style={{ color:"rgba(255,255,255,.7)",fontSize:13 }}>חינם לגמרי · דילים חמים · חיסכון אמיתי</p>
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
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
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
              <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                <span style={{ fontSize:30,flexShrink:0 }}>{currentUser.avatar}</span>
                <input value={comment} onChange={e => setComment(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && comment.trim() && (onComment(deal.id,comment),setComment(""))}
                  placeholder="כתוב תגובה..." style={{ flex:1 }} />
                <button className="btn btn-primary" onClick={() => { onComment(deal.id,comment); setComment(""); }} style={{ padding:"11px 20px",flexShrink:0 }}>שלח</button>
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

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({ tab, onTab, deals, users, stats, onClose, onUpdate, onDelete, onBanUser }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:780,maxHeight:"90vh" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <div><h2 style={{ fontWeight:900,fontSize:22 }}>⚙️ פאנל ניהול</h2></div>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:24,cursor:"pointer" }}>×</button>
        </div>

        {stats && (
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20 }}>
            {[["📋 דילים",stats.total_deals,"#fff5f0","var(--orange)"],["⏳ ממתינים",stats.pending,"#fff0f0","var(--red)"],["👥 משתמשים",stats.total_users,"#f0f8ff","var(--blue)"],["⭐ מוצגים",stats.featured,"#fffdf0","#f59c00"]].map(([l,v,bg,c])=>(
              <div key={l} style={{ background:bg,borderRadius:12,padding:14,textAlign:"center" }}>
                <div style={{ fontSize:22,fontWeight:900,color:c }}>{v}</div>
                <div style={{ fontSize:12,color:"var(--mid)",marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex",gap:4,background:"#f4f5f7",borderRadius:10,padding:4,marginBottom:20 }}>
          {[["deals","📋 דילים"],["pending","⏳ ממתינים"],["users","👥 משתמשים"]].map(([id,label])=>(
            <button key={id} onClick={() => onTab(id)} style={{ flex:1,border:"none",borderRadius:8,padding:"8px 12px",fontWeight:700,fontSize:13,
              background:tab===id?"#fff":"transparent",color:tab===id?"var(--orange)":"var(--mid)",boxShadow:tab===id?"var(--shadow)":"none" }}>
              {label}{id==="pending"&&stats?.pending>0?` (${stats.pending})`:""}
            </button>
          ))}
        </div>

        <div style={{ maxHeight:440,overflowY:"auto" }}>
          {(tab==="deals"?deals:tab==="pending"?deals.filter(d=>!d.is_approved):null)?.map(deal => (
            <div key={deal.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
              <img src={deal.image_url||"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&q=60"} alt="" style={{ width:56,height:44,objectFit:"cover",borderRadius:8,flexShrink:0 }} />
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{deal.title}</div>
                <div style={{ fontSize:11,color:"var(--mid)",marginTop:2 }}>
                  {deal.store} · {deal.category} · {deal.avatar}{deal.username}
                  {!deal.is_approved && <span style={{ color:"var(--blue)",marginRight:6 }}>· ממתין</span>}
                  {deal.is_featured && <span style={{ color:"#f59c00",marginRight:6 }}>· מוצג</span>}
                </div>
              </div>
              <div style={{ display:"flex",gap:5,flexShrink:0 }}>
                {!deal.is_approved && <button className="btn btn-success" style={{ padding:"4px 8px",fontSize:11 }} onClick={() => onUpdate(deal.id,{is_approved:1})}>✅</button>}
                <button className="btn btn-ghost" style={{ padding:"4px 8px",fontSize:11 }} onClick={() => onUpdate(deal.id,{is_featured:deal.is_featured?0:1})}>{deal.is_featured?"⭐":"☆"}</button>
                <button className="btn btn-ghost" style={{ padding:"4px 8px",fontSize:11 }} onClick={() => onUpdate(deal.id,{is_expired:deal.is_expired?0:1})}>{deal.is_expired?"🔄":"⏰"}</button>
                <button className="btn btn-danger" style={{ padding:"4px 8px",fontSize:11 }} onClick={() => onDelete(deal.id)}>🗑️</button>
              </div>
            </div>
          ))}

          {tab==="users" && users.map(u => (
            <div key={u.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:32 }}>{u.avatar}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:14 }}>
                  {u.username} {u.role==="admin" && <span style={{ background:"#ffcc00",color:"#333",borderRadius:4,padding:"1px 6px",fontSize:11 }}>מנהל</span>}
                  {u.is_banned && <span style={{ background:"#fee",color:"var(--red)",borderRadius:4,padding:"1px 6px",fontSize:11,marginRight:4 }}>חסום</span>}
                </div>
                <div style={{ fontSize:12,color:"var(--mid)" }}>{u.email} · נרשם: {u.created_at?.split("T")[0]}</div>
              </div>
              {u.role !== "admin" && (
                <button className={`btn ${u.is_banned?"btn-success":"btn-danger"}`} style={{ padding:"4px 12px",fontSize:11 }} onClick={() => onBanUser(u.id)}>
                  {u.is_banned?"🔓 שחרר":"🚫 חסום"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
