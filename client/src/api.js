// ============================================================
//  api.js  –  all calls to the Express backend
//  Place in:  client/src/api.js
// ============================================================

const BASE = import.meta.env.VITE_API_URL || '/api';

// ── Token helpers ────────────────────────────────────────────
export const getToken  = ()        => localStorage.getItem('hd_token');
export const saveToken = (t)       => localStorage.setItem('hd_token', t);
export const clearToken = ()       => localStorage.removeItem('hd_token');

const headers = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

// ── Generic fetch wrapper ────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers(),
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה לא ידועה');
  return data;
}

// ════════════════════════════════════════════════════════════
//  Auth
// ════════════════════════════════════════════════════════════
export const authAPI = {
  register: (username, email, password) =>
    api('/auth/register', { method: 'POST', body: { username, email, password } }),
  login: (username, password) =>
    api('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => api('/auth/me'),
};

// ════════════════════════════════════════════════════════════
//  Deals
// ════════════════════════════════════════════════════════════
export const dealsAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/deals${qs ? '?' + qs : ''}`);
  },
  get: (id) => api(`/deals/${id}`),
  create: (deal) =>
    api('/deals', { method: 'POST', body: deal }),
  delete: (id) =>
    api(`/deals/${id}`, { method: 'DELETE' }),
  vote: (id, vote_type) =>
    api(`/deals/${id}/vote`, { method: 'POST', body: { vote_type } }),
  myVote: (id) => api(`/deals/${id}/my-vote`),
};

// ════════════════════════════════════════════════════════════
//  Comments
// ════════════════════════════════════════════════════════════
export const commentsAPI = {
  add: (dealId, text) =>
    api(`/deals/${dealId}/comments`, { method: 'POST', body: { text } }),
  delete: (commentId) =>
    api(`/comments/${commentId}`, { method: 'DELETE' }),
};

// ════════════════════════════════════════════════════════════
//  Categories
// ════════════════════════════════════════════════════════════
export const categoriesAPI = {
  list: () => api('/categories'),
};

// ════════════════════════════════════════════════════════════
//  Admin
// ════════════════════════════════════════════════════════════
export const adminAPI = {
  deals: ()           => api('/admin/deals'),
  stats: ()           => api('/admin/stats'),
  users: ()           => api('/admin/users'),
  updateDeal: (id, patch) =>
    api(`/admin/deals/${id}`, { method: 'PATCH', body: patch }),
  banUser: (id) =>
    api(`/admin/users/${id}/ban`, { method: 'PATCH' }),
};

// ════════════════════════════════════════════════════════════
//  Hunter Sources (admin)
// ════════════════════════════════════════════════════════════
export const hunterAPI = {
  getSources:   ()                    => api('/admin/sources'),
  addSource:    (body)                => api('/admin/sources', { method: 'POST', body }),
  toggleSource: (id, is_active)       => api(`/admin/sources/${id}`, { method: 'PATCH', body: { is_active } }),
  deleteSource: (id)                  => api(`/admin/sources/${id}`, { method: 'DELETE' }),
  run:          ()                    => api('/admin/hunt', { method: 'POST' }),
  runSource:    (id)                  => api(`/admin/hunt/${id}`, { method: 'POST' }),
  getConfig:    ()                    => api('/admin/hunter-config'),
  saveConfig:   (body)                => api('/admin/hunter-config', { method: 'PATCH', body }),
  getLogs:      ()                    => api('/admin/hunter-logs'),
  getPrompts:   ()                    => api('/admin/prompts'),
  addPrompt:    (body)                => api('/admin/prompts',     { method: 'POST',  body }),
  updatePrompt: (id, body)            => api(`/admin/prompts/${id}`, { method: 'PATCH', body }),
  deletePrompt: (id)                  => api(`/admin/prompts/${id}`, { method: 'DELETE' }),
  assignPrompt: (sourceId, promptId)  => api(`/admin/sources/${sourceId}`, { method: 'PATCH', body: { prompt_id: promptId } }),
  toggleProxy:  (id, use_proxy)       => api(`/admin/sources/${id}`, { method: 'PATCH', body: { use_proxy } }),
  updateSource: (id, body)            => api(`/admin/sources/${id}`, { method: 'PATCH', body }),
  importDeals:     (payload)          => api('/admin/import-deals',  { method: 'POST', body: { payload } }),
  getOpenAIConfig: ()                 => api('/admin/openai-config'),
  saveOpenAIConfig:(body)             => api('/admin/openai-config', { method: 'POST', body }),
  runOpenAI:       ()                 => api('/admin/openai-run',    { method: 'POST' }),
};
