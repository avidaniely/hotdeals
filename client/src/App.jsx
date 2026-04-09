// ============================================================
//  App.jsx  –  hotILdeals  (shell — components are in ./components/)
// ============================================================
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, useMatch } from "react-router-dom";
import {
  authAPI, dealsAPI, commentsAPI, categoriesAPI, adminAPI,
  saveToken, clearToken, getToken,
} from "./api";
import "./App.css";
import Header      from "./components/Header";
import DealCard    from "./components/DealCard";
import DealPage    from "./components/DealPage";
import AdminPage   from "./components/AdminPage";
import LoginModal    from "./components/LoginModal";
import RegisterModal from "./components/RegisterModal";
import NewDealModal  from "./components/NewDealModal";

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

      {/* HEADER */}
      <Header
        user={user}
        search={search}
        categories={categories}
        activeCategory={activeCategory}
        adminStats={adminStats}
        onSearch={v => updateParams({ search: v, page: null })}
        onCategory={c => updateParams({ category: c === 'הכל' ? null : c, page: null })}
        onModal={setModal}
        onAdmin={() => { setAdminOpen(true); loadAdmin(); window.scrollTo(0, 0); }}
        onLogout={logout}
      />

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
            <div style={{ display:"flex", alignItems:"center", background:"#fff", border:"1.5px solid var(--border)", borderRadius:18, padding:"0 14px", boxShadow:"var(--sh-sm)" }}>
              <span style={{ color:"var(--text-3)", fontSize:15 }}>🔍</span>
              <input placeholder="חפש דילים, מוצרים, חנויות..." value={search}
                onChange={e => updateParams({ search: e.target.value, page: null })}
                style={{ background:"transparent", border:"none", color:"var(--text)", fontSize:14, flex:1, outline:"none", padding:"13px 10px", direction:"rtl", width:"100%" }} />
            </div>
          </div>

          {/* Mobile filter tray */}
          <div className="mobile-only" style={{ marginBottom:16 }}>
            <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:18, padding:12, boxShadow:"var(--sh)" }}>
              <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, scrollbarWidth:"none" }}>
                {[["hot","🔥 הכי חמים"],["new","✨ חדשים"],["quality","💎 איכות"]].map(([id,label]) => (
                  <button key={id} onClick={() => updateParams({ sort: id, page: null })}
                    style={{ border:"none", borderRadius:999, padding:"9px 14px", fontWeight:800, fontSize:13, whiteSpace:"nowrap", flexShrink:0,
                      background: activeTab===id ? "var(--brand)" : "var(--surface-2)",
                      color: activeTab===id ? "#fff" : "var(--text-2)" }}>
                    {label}
                  </button>
                ))}
                {["הכל", ...categories.map(c => c.name)].map(c => (
                  <button key={c} onClick={() => updateParams({ category: c === 'הכל' ? null : c, page: null })}
                    style={{ border:"1px solid var(--border)", borderRadius:999, padding:"9px 14px", fontWeight:800, fontSize:13, whiteSpace:"nowrap", flexShrink:0,
                      background: activeCategory===c ? "var(--brand)" : "#fff",
                      color: activeCategory===c ? "#fff" : "var(--text-2)" }}>
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
              <div style={{ display:"flex", gap:0, borderBottom:"2px solid var(--border)", marginBottom:20 }}>
                {[["hot","🔥 הכי חמים"],["new","✨ חדשים"],["quality","💎 איכות"]].map(([id, label]) => (
                  <button key={id} onClick={() => updateParams({ sort: id, page: null })}
                    style={{
                      background:"none",
                      border:"none",
                      borderBottom: activeTab===id ? "3px solid var(--brand)" : "3px solid transparent",
                      marginBottom:-2,
                      padding:"10px 22px",
                      fontWeight: activeTab===id ? 700 : 500,
                      fontSize:14,
                      cursor:"pointer",
                      color: activeTab===id ? "var(--brand)" : "var(--text-2)",
                      transition:"color .15s, border-color .15s",
                    }}
                    onMouseEnter={e => { if(activeTab!==id) e.currentTarget.style.color="var(--text)"; }}
                    onMouseLeave={e => { if(activeTab!==id) e.currentTarget.style.color="var(--text-2)"; }}>
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", padding:18, boxShadow:"var(--sh-sm)" }}>
                      <div style={{ display:"flex", gap:18 }}>
                        <div className="skeleton-shimmer" style={{ width:130, height:110, borderRadius:8, background:"var(--surface-3)", flexShrink:0 }} />
                        <div style={{ flex:1 }}>
                          <div className="skeleton-shimmer" style={{ width:"32%", height:18, borderRadius:999, background:"var(--surface-3)", marginBottom:10 }} />
                          <div className="skeleton-shimmer" style={{ width:"78%", height:14, borderRadius:8, background:"var(--surface-3)", marginBottom:8 }} />
                          <div className="skeleton-shimmer" style={{ width:"92%", height:12, borderRadius:8, background:"var(--surface-3)", marginBottom:18 }} />
                          <div className="skeleton-shimmer" style={{ width:"34%", height:28, borderRadius:8, background:"var(--surface-3)" }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : deals.length === 0 ? (
                <div style={{ background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", textAlign:"center", padding:"60px 28px", boxShadow:"var(--sh)" }}>
                  <div style={{ fontSize:42, marginBottom:12 }}>🔍</div>
                  <div style={{ fontWeight:900, fontSize:22, color:"var(--text)", marginBottom:8 }}>לא נמצאו דילים</div>
                  <div style={{ color:"var(--text-2)", fontSize:14, lineHeight:1.7, maxWidth:360, margin:"0 auto 20px" }}>
                    לא מצאנו תוצאות לחיפוש הזה. נסה לשנות את החיפוש, לעבור קטגוריה, או לפרסם דיל חדש.
                  </div>
                  <div style={{ display:"flex", justifyContent:"center", gap:10, flexWrap:"wrap" }}>
                    <button className="btn btn-ghost" onClick={() => setSearchParams({}, { replace: true })} style={{ padding:"10px 16px", borderRadius:8 }}>נקה סינון</button>
                    <button className="btn btn-primary" onClick={() => user ? setModal("newdeal") : setModal("register")} style={{ padding:"10px 16px", borderRadius:8 }}>
                      {user ? "שתף דיל חדש" : "הצטרף לקהילה"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => updateParams({ page: p })}
                          style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid var(--border)", cursor: "pointer",
                            background: p === page ? "var(--brand)" : "var(--surface)",
                            color: p === page ? "#fff" : "var(--text-2)", fontWeight: 700, fontSize: 14,
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
                <div style={{ background: "var(--surface)", borderRadius: 10, padding: 18, boxShadow: "var(--sh-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>📊</span> סטטיסטיקות
                  </div>
                  {[["דילים סה״כ", adminStats.total_deals,"📋"],["ממתינים", adminStats.pending,"⏳"],["משתמשים", adminStats.total_users,"👥"],["תגובות", adminStats.total_comments,"💬"]].map(([l,v,icon]) => (
                    <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ color:"var(--text-2)", fontSize:13, display:"flex", alignItems:"center", gap:6 }}><span>{icon}</span>{l}</span>
                      <span style={{ fontWeight:800, fontSize:16, color:"var(--brand)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Top deals */}
              <div style={{ background:"var(--surface)", borderRadius:10, padding:18, boxShadow:"var(--sh-sm)", border:"1px solid var(--border)" }}>
                <div style={{ fontWeight:900, fontSize:15, marginBottom:14, color:"var(--text)", display:"flex", alignItems:"center", gap:8 }}>
                  <span>🏆</span> הכי חמים עכשיו
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {[...deals].sort((a,b) => (b.hot-b.cold)-(a.hot-a.cold)).slice(0,5).map((d,i) => (
                    <div key={d.id} onClick={() => openDeal(d.id)}
                      style={{ display:"flex", gap:10, alignItems:"center", padding:10, border:"1px solid var(--border)", borderRadius:8, cursor:"pointer", transition:"var(--tr)", background:"var(--surface)" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor="var(--brand)"; e.currentTarget.style.background="var(--brand-lt)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.background="var(--surface)"; }}>
                      <div style={{ width:28, height:28, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, flexShrink:0,
                        background: i===0 ? "linear-gradient(135deg,#FFD700,#FFA500)" : "var(--surface-2)",
                        color: i===0 ? "#fff" : "var(--text-2)" }}>
                        {i+1}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, lineHeight:1.4, color:"var(--text)", marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.title}</div>
                        <div style={{ fontSize:12, color:"var(--hot)", fontWeight:800 }}>₪{(+d.deal_price).toLocaleString()}</div>
                      </div>
                      <div style={{ flexShrink:0, background:"var(--brand-lt)", color:"var(--brand)", borderRadius:999, padding:"4px 8px", fontSize:12, fontWeight:800 }}>
                        🔥{d.hot-d.cold}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!user && (
                <div style={{ background:"linear-gradient(135deg,var(--brand-dk),var(--brand))", borderRadius:12, padding:22, color:"#fff", textAlign:"center", position:"relative", overflow:"hidden", boxShadow:"0 8px 28px rgba(247,100,27,.28)" }}>
                  <div style={{ position:"absolute", top:-16, right:-16, width:90, height:90, borderRadius:"50%", background:"rgba(255,255,255,.08)" }} />
                  <div style={{ fontSize:38, marginBottom:10, position:"relative" }}>🇮🇱</div>
                  <div style={{ fontWeight:900, fontSize:18, marginBottom:6, position:"relative" }}>הצטרף לקהילה!</div>
                  <div style={{ fontSize:13, marginBottom:18, opacity:.88, lineHeight:1.7, position:"relative" }}>שתף דילים, הצבע, שמור מועדפים, וחסוך כסף בכל קנייה</div>
                  <button className="btn" onClick={() => setModal("register")} style={{ background:"#fff", color:"var(--brand)", width:"100%", fontWeight:900, padding:12, fontSize:14, borderRadius:10, boxShadow:"0 6px 18px rgba(0,0,0,.18)" }}>הצטרף בחינם</button>
                  <button className="btn" onClick={() => setModal("login")} style={{ background:"rgba(255,255,255,.1)", color:"rgba(255,255,255,.9)", width:"100%", fontSize:13, marginTop:8, border:"1px solid rgba(255,255,255,.18)", borderRadius:10, padding:10 }}>יש לי חשבון</button>
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
