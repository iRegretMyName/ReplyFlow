import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtDate, notifyFollowUpsChanged } from '../api.js';
import { Link } from '../router.jsx';
import Dialog from './ui/Dialog.jsx';
import Icon from './ui/Icon.jsx';
import { EmptyState, ErrorState, SkeletonRows } from './ui/States.jsx';
import { useToast } from './ui/Toast.jsx';

export default function FollowUps() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [leads, setLeads] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null); // follow-up being cancelled
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(() => {
    setError('');
    return Promise.all([api.followups(), api.leads()])
      .then(([f, l]) => {
        setItems(f);
        setLeads(Object.fromEntries(l.map((x) => [x.id, x])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (fu, status) => {
    setBusyId(fu.id);
    try {
      await api.updateFollowUp(fu.id, { status });
      toast.success(status === 'completed' ? 'Marked as done.' : 'Follow-up cancelled.');
      notifyFollowUpsChanged();
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const groups = useMemo(() => {
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    const now = Date.now();
    const pending = items.filter((f) => f.status === 'pending').sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    return [
      { id: 'overdue', title: 'Overdue', list: pending.filter((f) => new Date(f.scheduledFor).getTime() < now) },
      { id: 'today', title: 'Due today', list: pending.filter((f) => { const t = new Date(f.scheduledFor).getTime(); return t >= now && t <= endOfToday.getTime(); }) },
      { id: 'later', title: 'Coming up', list: pending.filter((f) => new Date(f.scheduledFor).getTime() > endOfToday.getTime()) },
    ].filter((g) => g.list.length);
  }, [items]);

  const askCancel = (fu) => { setConfirm(fu); setConfirmOpen(true); };
  const doCancel = async () => { setConfirmOpen(false); await setStatus(confirm, 'cancelled'); };

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Follow-ups</h1>
          <p className="page-sub">Check-ins you've scheduled, oldest first.</p>
        </div>
      </header>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="panel"><SkeletonRows rows={5} /></div>
      ) : groups.length === 0 ? (
        <div className="panel"><EmptyState icon="check" title="No pending follow-ups">When you approve a reply, a check-in is scheduled here automatically.</EmptyState></div>
      ) : (
        groups.map((g) => (
          <section key={g.id} className={`group group-${g.id}`} aria-labelledby={`g-${g.id}`}>
            <h2 id={`g-${g.id}`}>{g.title} <span className="count">{g.list.length}</span></h2>
            <ul className="panel rows">
              {g.list.map((f) => {
                const lead = leads[f.leadId];
                return (
                  <li key={f.id} className="row static">
                    <span className="row-main">
                      <Link to={`/admin/leads/${f.leadId}`} className="cell-name">{lead?.name || 'Unknown lead'}</Link>
                      <span className="row-sub">{f.reason}</span>
                      <span className={`row-sub ${g.id === 'overdue' ? 'is-overdue' : ''}`}>
                        {g.id === 'overdue' && <Icon name="alert" size={14} />}
                        {g.id === 'overdue' ? 'Overdue · ' : ''}{fmtDate(f.scheduledFor)}
                      </span>
                    </span>
                    <span className="row-actions">
                      <button type="button" className="btn small" disabled={busyId === f.id} onClick={() => setStatus(f, 'completed')}>
                        <Icon name="check" size={15} /> Done
                      </button>
                      <button type="button" className="btn small ghost" disabled={busyId === f.id} onClick={() => askCancel(f)}>Cancel</button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancel this follow-up?"
        size="sm"
        footer={(
          <>
            <button type="button" className="btn" onClick={() => setConfirmOpen(false)}>Keep it</button>
            <button type="button" className="btn danger" onClick={doCancel}>Cancel follow-up</button>
          </>
        )}
      >
        <p>
          {confirm ? <>The check-in with <strong>{leads[confirm.leadId]?.name || 'this lead'}</strong> will be removed from your list.</> : null}
        </p>
      </Dialog>
    </section>
  );
}
