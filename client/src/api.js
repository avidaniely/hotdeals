// ============================================================
//  api.js  –  all calls to the Express backend
//  Place in:  client/src/api.js
// ============================================================

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
  register: (username, email, password, avatar) =>
    api('/auth/register', { method: 'POST', body: { username, email, password, avatar } }),
  login: (username, password) =>
    api('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => api('/auth/me'),
  googleComplete: (pendingToken, username) =>
    api('/auth/google/complete', { method: 'POST', body: { pendingToken, username } }),
};

// ════════════════════════════════════════════════════════════
//  User
// ════════════════════════════════════════════════════════════
export const userAPI = {
  updateAvatarPhoto: (file) => {
    const form = new FormData();
    form.append('avatar', file);
    return fetch(`${BASE}/users/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'שגיאה בהעלאת התמונה');
      return data;
    });
  },
  updateAvatarEmoji: (avatar) =>
    api('/users/me', { method: 'PATCH', body: { avatar } }),
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
