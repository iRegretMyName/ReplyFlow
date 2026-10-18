// Enquiries sent through the website's contact form.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ENQUIRY_STATUSES, fmtDate, notifyFollowUpsChanged, timeAgo } from '../api.js';
import { useAuth } from '../auth.jsx';
import { navigate } from '../router.jsx';
import Dialog from './ui/Dialog.jsx';
import Icon from './ui/Icon.jsx';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from './ui/States.jsx';
import { useToast } from './ui/Toast.jsx';

const LABEL = { new: 'New', 'in-progress': 'In progress', resolved: 'Resolved' };
const TAB_ALL = 'all';
const notifyEnquiriesChanged = () => window.dispatchEvent(new Event('replyflow:enquiries-changed'));

export default function Enquiries() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('new');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const load = useCallback(() => {
    setError(''); setLoading(true);
    api.enquiries().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => Object.fromEntries([[TAB_ALL, items.length], ...ENQUIRY_STATUSES.map((s) => [s, items.filter((e) => e.status === s).length])]), [items]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((e) => (tab === TAB_ALL || e.status === tab) && (!q || [e.name, e.phone, e.email, e.course, e.message].some((v) => (v || '').toLowerCase().includes(q))));
  }, [items, tab, search]);

  const replace = (u) => { setItems((l) => l.map((x) => (x.id === u.id ? u : x))); setCurrent(u); notifyEnquiriesChanged(); };
  const setStatus = async (status) => {
    setBusy('status');
    try { replace(await api.setEnquiryStatus(current.id, status)); toast.success(`Marked as ${LABEL[status].toLowerCase()}.`); } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };
  const convert = async () => {
    setBusy('convert');
    try { const { lead, enquiry } = await api.convertEnquiry(current.id); replace(enquiry); notifyFollowUpsChanged(); toast.success(`${lead.name} is now in your leads.`); setOpen(false); navigate(`/admin/leads/${lead.id}`); } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };
  const remove = async () => {
    setBusy('delete');
    try { await api.deleteEnquiry(current.id); setItems((l) => l.filter((x) => x.id !== current.id)); notifyEnquiriesChanged(); toast.success('Enquiry deleted.'); setConfirmDel(false); setOpen(false); } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };
  const openItem = (e) => { setCurrent(e); setOpen(true); };

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Enquiries</h1>
          <p className="page-sub">Messages sent through the contact form on your website.</p>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Filter enquiries">
        {[...ENQUIRY_STATUSES, TAB_ALL].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === TAB_ALL ? 'All' : LABEL[t]} <span className="count">{counts[t] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="toolbar" role="search">
        <div className="search"><Icon name="search" size={16} /><input type="search" aria-label="Search enquiries" placeholder="Search name, contact or message" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <button type="button" className="btn" onClick={load}>Refresh</button>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : loading ? <div className="panel"><SkeletonRows rows={5} /></div> : shown.length === 0 ? (
        <div className="panel">
          {items.length === 0
            ? <EmptyState icon="inbox" title="No enquiries yet">When a visitor sends the contact form, it shows up here.</EmptyState>
            : <EmptyState icon="search" title="Nothing here" action={<button type="button" className="btn" onClick={() => { setTab(TAB_ALL); setSearch(''); }}>Show all</button>} />}
        </div>
      ) : (
        <ul className="panel rows">
          {shown.map((e) => (
            <li key={e.id}>
              <button type="button" className="row enq-row" onClick={() => openItem(e)}>
                <span className={`dot dot-${e.status}`} aria-hidden="true" />
                <span className="row-main">
                  <strong>{e.name}{e.course && <span className="tag">{e.course}</span>}</strong>
                  <span className="row-sub clamp">{e.message}</span>
                </span>
                <span className="row-meta"><span className={`tag tag-${e.status === 'new' ? 'new' : e.status === 'resolved' ? 'lost' : ''}`}>{LABEL[e.status]}</span><br />{timeAgo(e.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => !busy && setOpen(false)} title={current ? `Enquiry from ${current.name}` : 'Enquiry'}
        footer={current && (
          <>
            {user.role === 'admin' && <button type="button" className="btn danger-ghost" onClick={() => setConfirmDel(true)} disabled={!!busy}>Delete</button>}
            <button type="button" className="btn primary" onClick={convert} disabled={!!busy}>{busy === 'convert' ? <><Spinner /> Adding…</> : current.leadId ? 'Open lead' : 'Add to leads'}</button>
          </>
        )}>
        {current && (
          <div className="enq-detail">
            <dl className="facts-list">
              <div><dt>Received</dt><dd>{fmtDate(current.createdAt)}</dd></div>
              {current.course && <div><dt>Course</dt><dd>{current.course}</dd></div>}
              {current.phone && <div><dt>Phone</dt><dd><a className="link" href={`tel:${current.phone.replace(/[^\d+]/g, '')}`}>{current.phone}</a></dd></div>}
              {current.email && <div><dt>Email</dt><dd><a className="link" href={`mailto:${current.email}`}>{current.email}</a></dd></div>}
            </dl>
            <p className="enq-message">{current.message}</p>
            <div className="field">
              <label htmlFor="enq-status">Status</label>
              <select id="enq-status" value={current.status} onChange={(e) => setStatus(e.target.value)} disabled={busy === 'status'}>
                {ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
              </select>
            </div>
            {current.leadId && <p className="muted small">Already in your leads.</p>}
          </div>
        )}
      </Dialog>

      <Dialog open={confirmDel} onClose={() => !busy && setConfirmDel(false)} title="Delete this enquiry?" size="sm"
        footer={<><button type="button" className="btn" onClick={() => setConfirmDel(false)} disabled={!!busy}>Keep it</button><button type="button" className="btn danger" onClick={remove} disabled={!!busy}>{busy === 'delete' ? 'Deleting…' : 'Delete enquiry'}</button></>}>
        <p>The enquiry from <strong>{current?.name}</strong> will be permanently removed. If you added it to your leads, the lead stays.</p>
      </Dialog>
    </section>
  );
}
