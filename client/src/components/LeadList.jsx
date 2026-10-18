import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, STATUSES, TEMPERATURES, timeAgo } from '../api.js';
import { Link, navigate } from '../router.jsx';
import Dialog from './ui/Dialog.jsx';
import Icon from './ui/Icon.jsx';
import { EmptyState, ErrorState, InlineError, SkeletonRows } from './ui/States.jsx';
import { Signal, StatusTag } from './ui/Signal.jsx';
import { useToast } from './ui/Toast.jsx';

const EMPTY_FORM = { name: '', phone: '', class: '', course: '', source: 'Manual' };
const SOURCES = ['Manual', 'Instagram', 'WhatsApp', 'Phone', 'Website'];

export default function LeadList({ query }) {
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(STATUSES.includes(query.get('status')) ? query.get('status') : 'all');
  const [temp, setTemp] = useState(TEMPERATURES.includes(query.get('temperature')) ? query.get('temperature') : 'all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);

  const load = useCallback(() => {
    setError('');
    setLoading(true);
    api.leads().then(setLeads).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    api.settings().then((s) => setCourses(s.courses || [])).catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (status === 'all' || l.status === status) &&
        (temp === 'all' || l.temperature === temp) &&
        (!q || l.name.toLowerCase().includes(q) || (l.phone || '').includes(q)),
    );
  }, [leads, search, status, temp]);

  const filtering = search.trim() || status !== 'all' || temp !== 'all';
  const clearFilters = () => { setSearch(''); setStatus('all'); setTemp('all'); };

  const openForm = () => { setForm(EMPTY_FORM); setNameError(''); setShowForm(true); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setNameError('Enter the student’s name.'); return; }
    setSaving(true);
    try {
      const lead = await api.createLead(form);
      setLeads((prev) => [lead, ...prev]);
      setShowForm(false);
      toast.success(`${lead.name} added.`);
      navigate(`/admin/leads/${lead.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <header className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="page-sub">Every enquiry, with its status and how warm it is.</p>
        </div>
        <button type="button" className="btn primary" onClick={openForm}>
          <Icon name="plus" size={16} /> Add lead
        </button>
      </header>

      <div className="toolbar" role="search">
        <div className="search">
          <Icon name="search" size={16} />
          <input
            type="search"
            aria-label="Search by name or phone"
            placeholder="Search name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select aria-label="Filter by interest level" value={temp} onChange={(e) => setTemp(e.target.value)}>
          <option value="all">All interest</option>
          {TEMPERATURES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
        </select>
        {!loading && !error && (
          <p className="toolbar-count" aria-live="polite">
            {filtering ? `${filtered.length} of ${leads.length}` : `${leads.length}`} {leads.length === 1 ? 'lead' : 'leads'}
          </p>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="panel"><SkeletonRows rows={8} /></div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          {filtering ? (
            <EmptyState icon="search" title="No leads match these filters" action={<button type="button" className="btn" onClick={clearFilters}>Clear filters</button>} />
          ) : (
            <EmptyState icon="leads" title="No leads yet" action={<button type="button" className="btn primary" onClick={openForm}>Add the first lead</button>}>
              Enquiries you add or receive will be listed here.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col" className="hide-md">Course</th>
                <th scope="col" className="hide-md">Source</th>
                <th scope="col">Status</th>
                <th scope="col">Interest</th>
                <th scope="col" className="num hide-sm">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="clickable"
                  onClick={(e) => { if (!e.target.closest('a')) navigate(`/admin/leads/${l.id}`); }}
                >
                  <td>
                    <Link to={`/admin/leads/${l.id}`} className="cell-name">{l.name}</Link>
                    <span className="cell-sub">{l.intent || 'No intent yet'}</span>
                  </td>
                  <td className="hide-md">{l.course || '—'}{l.class ? <span className="cell-sub inline"> · Class {l.class}</span> : null}</td>
                  <td className="hide-md">{l.source}</td>
                  <td><StatusTag status={l.status} /></td>
                  <td><Signal level={l.temperature} showLabel /></td>
                  <td className="num hide-sm">{timeAgo(l.lastContactedAt || l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={showForm}
        onClose={() => !saving && setShowForm(false)}
        title="Add a lead"
        footer={(
          <>
            <button type="button" className="btn" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            <button type="submit" form="add-lead-form" className="btn primary" disabled={saving}>{saving ? 'Creating…' : 'Create lead'}</button>
          </>
        )}
      >
        <form id="add-lead-form" className="form-grid" onSubmit={submit} noValidate>
          <div className="field span-2">
            <label htmlFor="lead-name">Student name</label>
            <input
              id="lead-name"
              value={form.name}
              aria-required="true"
              aria-invalid={nameError ? 'true' : undefined}
              aria-describedby={nameError ? 'lead-name-error' : undefined}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setNameError(''); }}
            />
            <InlineError id="lead-name-error">{nameError}</InlineError>
          </div>
          <div className="field">
            <label htmlFor="lead-phone">Phone</label>
            <input id="lead-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="lead-class">Class</label>
            <input id="lead-class" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="lead-course">Course</label>
            <select id="lead-course" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
              <option value="">Not sure yet</option>
              {courses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lead-source">Source</label>
            <select id="lead-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
