import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, timeAgo } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Link } from '../router.jsx';
import { EmptyState, ErrorState, SkeletonRows } from './ui/States.jsx';
import { Signal } from './ui/Signal.jsx';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const plural = (n, one, many) => (n === 1 ? one : many);

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [due, setDue] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([api.dashboard(), api.followups(), api.leads()])
      .then(([dash, followups, leads]) => {
        const names = Object.fromEntries(leads.map((l) => [l.id, l]));
        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
        setDue(
          followups
            .filter((f) => f.status === 'pending' && new Date(f.scheduledFor) <= endOfDay)
            .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
            .slice(0, 6)
            .map((f) => ({ ...f, lead: names[f.leadId] })),
        );
        setData(dash);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const dateLine = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const first = user.displayName.split(' ')[0];

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">{dateLine}</p>
          <h1>{greeting()}, {first}.</h1>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !data && <div className="panel"><SkeletonRows rows={6} /></div>}

      {data && (
        <>
          <div className="brief">
            <Link to="/admin/followups" className="brief-item">
              <span className="numeral">{data.followUpsDue}</span>
              <span className="brief-text">
                <strong>{plural(data.followUpsDue, 'follow-up', 'follow-ups')} due</strong>
                <span>today or overdue</span>
              </span>
            </Link>
            <Link to="/admin/enquiries" className="brief-item">
              <span className="numeral">{data.newEnquiries ?? 0}</span>
              <span className="brief-text">
                <strong>new {plural(data.newEnquiries ?? 0, 'enquiry', 'enquiries')}</strong>
                <span>from the website</span>
              </span>
            </Link>
            <Link to="/admin/leads?temperature=hot" className="brief-item">
              <span className="numeral">{data.hotLeads}</span>
              <span className="brief-text">
                <strong>hot {plural(data.hotLeads, 'lead', 'leads')}</strong>
                <span>ready to act on</span>
              </span>
            </Link>
          </div>

          <dl className="ledger">
            <div><dt>Total leads</dt><dd>{data.totalLeads}</dd></div>
            <div><dt>New today</dt><dd>{data.newToday}</dd></div>
            <div><dt>New this week</dt><dd>{data.newThisWeek}</dd></div>
            <div><dt>Converted</dt><dd>{data.converted}</dd></div>
          </dl>

          <div className="split">
            <section aria-labelledby="recent-h">
              <h2 id="recent-h">Recent enquiries</h2>
              <div className="panel">
                {data.recentLeads.length === 0 ? (
                  <EmptyState icon="leads" title="No enquiries yet">
                    New leads show up here as they come in. <Link to="/admin/leads" className="link">Add one</Link>
                  </EmptyState>
                ) : (
                  <ul className="rows">
                    {data.recentLeads.map((l) => (
                      <li key={l.id}>
                        <Link to={`/admin/leads/${l.id}`} className="row">
                          <Signal level={l.temperature} />
                          <span className="row-main">
                            <strong>{l.name}</strong>
                            <span className="row-sub">{l.course || 'No course'} · {l.intent || 'No intent yet'}</span>
                          </span>
                          <span className="row-meta">{timeAgo(l.createdAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section aria-labelledby="due-h">
              <h2 id="due-h">Due now</h2>
              <div className="panel">
                {due.length === 0 ? (
                  <EmptyState icon="check" title="You're all caught up">Nothing is due today.</EmptyState>
                ) : (
                  <ul className="rows">
                    {due.map((f) => {
                      const overdue = new Date(f.scheduledFor).getTime() < Date.now();
                      return (
                        <li key={f.id}>
                          <Link to={`/admin/leads/${f.leadId}`} className="row">
                            <span className="row-main">
                              <strong>{f.lead?.name || 'Unknown lead'}</strong>
                              <span className="row-sub">{f.reason}</span>
                            </span>
                            <span className={`row-meta ${overdue ? 'is-overdue' : ''}`}>{overdue ? 'Overdue · ' : ''}{fmtDate(f.scheduledFor)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
