// Thin wrapper around the Express API. All paths are relative; Vite proxies /api in dev.
// Sign-in uses an HttpOnly cookie that the browser sends by itself. JavaScript never sees it.
async function request(path, { method = 'GET', body, raw } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        // The server rejects data-changing requests without this header (CSRF protection).
        'X-Requested-With': 'replyflow',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(raw ? { 'Content-Type': raw.type || 'application/octet-stream' } : {}),
      },
      body: raw || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    const err = new Error("Can't reach the server. Check your connection and try again.");
    err.network = true;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A 401 anywhere except the sign-in calls means the session ended: send the person to the sign-in screen.
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('replyflow:unauthorized'));
    }
    const err = new Error(res.status === 413 ? 'That image is too large. Please choose one under 2 MB.' : data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // auth
  me: () => request('/auth/me'),
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  // public website (no sign-in)
  publicSite: () => request('/public/site'),
  publicLegal: (name) => request(`/public/legal/${name}`),
  sendEnquiry: (body) => request('/public/enquiries', { method: 'POST', body }),
  // courses (admin panel)
  courses: () => request('/courses'),
  createCourse: (c) => request('/courses', { method: 'POST', body: c }),
  updateCourse: (id, patch) => request(`/courses/${encodeURIComponent(id)}`, { method: 'PUT', body: patch }),
  deleteCourse: (id) => request(`/courses/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // FAQs, page content, enquiries, images (admin panel)
  faqs: () => request('/faqs'),
  createFaq: (f) => request('/faqs', { method: 'POST', body: f }),
  updateFaq: (id, patch) => request(`/faqs/${id}`, { method: 'PUT', body: patch }),
  moveFaq: (id, direction) => request(`/faqs/${id}/move`, { method: 'POST', body: { direction } }),
  deleteFaq: (id) => request(`/faqs/${id}`, { method: 'DELETE' }),
  pages: () => request('/pages'),
  savePages: (body) => request('/pages', { method: 'PUT', body }),
  enquiries: () => request('/enquiries'),
  enquiryCounts: () => request('/enquiries/counts'),
  setEnquiryStatus: (id, status) => request(`/enquiries/${id}`, { method: 'PUT', body: { status } }),
  convertEnquiry: (id) => request(`/enquiries/${id}/convert`, { method: 'POST' }),
  deleteEnquiry: (id) => request(`/enquiries/${id}`, { method: 'DELETE' }),
  uploadImage: (file) => request('/uploads', { method: 'POST', raw: file }),
  // app
  dashboard: () => request('/dashboard'),
  leads: () => request('/leads'),
  lead: (id) => request(`/leads/${encodeURIComponent(id)}`),
  createLead: (lead) => request('/leads', { method: 'POST', body: lead }),
  updateLead: (id, patch) => request(`/leads/${id}`, { method: 'PUT', body: patch }),
  messages: (leadId) => request(`/messages/${leadId}`),
  sendMessage: (msg) => request('/messages', { method: 'POST', body: msg }),
  analyse: (message, lead) => request('/reply', { method: 'POST', body: { message, lead } }),
  followups: () => request('/followups'),
  createFollowUp: (fu) => request('/followups', { method: 'POST', body: fu }),
  updateFollowUp: (id, patch) => request(`/followups/${id}`, { method: 'PUT', body: patch }),
  settings: () => request('/settings'),
  saveSettings: (patch) => request('/settings', { method: 'PUT', body: patch }),
};

// Pages announce changes to follow-ups so the navigation badge can refresh.
export const notifyFollowUpsChanged = () => window.dispatchEvent(new Event('replyflow:followups-changed'));

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const timeAgo = (iso) => {
  if (!iso) return '—';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

export const ENQUIRY_STATUSES = ['new', 'in-progress', 'resolved'];
export const STATUSES = ['new', 'contacted', 'interested', 'follow-up', 'converted', 'lost'];
export const TEMPERATURES = ['hot', 'warm', 'cold'];
