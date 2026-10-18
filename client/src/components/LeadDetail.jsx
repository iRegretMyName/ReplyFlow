import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, fmtDate, notifyFollowUpsChanged, STATUSES, TEMPERATURES, timeAgo } from '../api.js';
import { Link } from '../router.jsx';
import Icon from './ui/Icon.jsx';
import { ErrorState, SkeletonRows, Spinner } from './ui/States.jsx';
import { Signal } from './ui/Signal.jsx';
import { useToast } from './ui/Toast.jsx';

const cap = (s) => s[0].toUpperCase() + s.slice(1);

export default function LeadDetail({ leadId }) {
  const toast = useToast();
  const [lead, setLead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [error, setError] = useState('');
  const current = useRef(leadId);
  const thread = useRef(null);

  // Message composer (log an incoming or outgoing message by hand)
  const [newText, setNewText] = useState('');
  const [newSender, setNewSender] = useState('student');

  // AI analysis state
  const [enquiry, setEnquiry] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [draft, setDraft] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [approving, setApproving] = useState(false);

  // Follow-up scheduling
  const [fuWhen, setFuWhen] = useState('');
  const [fuReason, setFuReason] = useState('');

  const load = useCallback(async () => {
    const id = leadId;
    try {
      const [l, m, f] = await Promise.all([api.lead(id), api.messages(id), api.followups()]);
      if (current.current !== id) return; // person moved to another lead meanwhile
      setError('');
      setLead(l);
      setMessages(m);
      setFollowups(f.filter((x) => x.leadId === id));
      document.title = `${l.name} · ReplyFlow`;
      // Pre-fill the enquiry box with the most recent student message
      const lastStudent = [...m].reverse().find((x) => x.sender === 'student');
      setEnquiry((prev) => prev || lastStudent?.text || '');
    } catch (e) {
      if (current.current === id) setError(e.status === 404 ? 'This lead could not be found. It may have been removed.' : e.message);
    }
  }, [leadId]);

  useEffect(() => {
    current.current = leadId;
    setLead(null);
    setError('');
    setAnalysis(null);
    setAiError(null);
    setEnquiry('');
    load();
  }, [leadId, load]);

  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [messages]);

  const update = async (patch) => {
    try {
      setLead(await api.updateLead(leadId, patch));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const addMessage = async (e) => {
    e.preventDefault();
    if (!newText.trim()) return;
    try {
      await api.sendMessage({ leadId, sender: newSender, text: newText });
      setNewText('');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const analyse = async () => {
    setAiBusy(true);
    setAiError(null);
    setAnalysis(null);
    try {
      const result = await api.analyse(enquiry, lead);
      setAnalysis(result);
      setDraft(result.reply);
    } catch (err) {
      setAiError(err.data?.error ? err.data : { error: err.message });
    } finally {
      setAiBusy(false);
    }
  };

  // Send the approved draft as a staff message and apply the AI's classification.
  // Nothing reaches the student until a person clicks this.
  const approveDraft = async () => {
    if (!draft.trim()) return;
    setApproving(true);
    try {
      await api.sendMessage({ leadId, sender: 'staff', text: draft });
      await api.updateLead(leadId, {
        category: analysis.category,
        intent: analysis.intent,
        temperature: analysis.leadTemperature,
        status: lead.status === 'new' ? 'contacted' : lead.status,
      });
      if (analysis.suggestedFollowUpHours) {
        const when = new Date(Date.now() + analysis.suggestedFollowUpHours * 3600_000);
        await api.createFollowUp({
          leadId,
          scheduledFor: when.toISOString(),
          reason: `Check in on: ${analysis.intent}`,
        });
        notifyFollowUpsChanged();
      }
      setAnalysis(null);
      setDraft('');
      toast.success('Reply logged and lead updated.');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApproving(false);
    }
  };

  const scheduleFollowUp = async (e) => {
    e.preventDefault();
    if (!fuWhen) return;
    try {
      await api.createFollowUp({
        leadId,
        scheduledFor: new Date(fuWhen).toISOString(),
        reason: fuReason || 'Follow-up',
      });
      setFuWhen('');
      setFuReason('');
      toast.success('Follow-up scheduled.');
      notifyFollowUpsChanged();
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const completeFollowUp = async (id) => {
    try {
      await api.updateFollowUp(id, { status: 'completed' });
      toast.success('Marked as done.');
      notifyFollowUpsChanged();
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const pendingFollowUps = useMemo(
    () => followups.filter((f) => f.status === 'pending').sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)),
    [followups],
  );

  const back = (
    <Link to="/admin/leads" className="back-link"><Icon name="back" size={16} /> All leads</Link>
  );

  if (error && !lead) {
    return (
      <section>
        {back}
        <header className="page-head"><h1>Lead</h1></header>
        <ErrorState message={error} onRetry={load} />
      </section>
    );
  }
  if (!lead) {
    return (
      <section>
        {back}
        <header className="page-head"><h1>Lead</h1></header>
        <div className="panel"><SkeletonRows rows={5} /></div>
      </section>
    );
  }

  return (
    <section>
      {back}

      <header className="page-head">
        <div>
          <h1>{lead.name}</h1>
          <p className="page-sub lead-meta">
            <span>{lead.course || 'No course'}</span>
            <span>Class {lead.class || '—'}</span>
            <span>{lead.phone ? <a className="link" href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}>{lead.phone}</a> : 'No phone'}</span>
            <span>via {lead.source}</span>
          </p>
        </div>
      </header>

      <div className="status-bar">
        <div className="field">
          <label htmlFor="lead-status">Status</label>
          <select id="lead-status" value={lead.status} onChange={(e) => update({ status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lead-temp">Interest</label>
          <select id="lead-temp" value={lead.temperature} onChange={(e) => update({ temperature: e.target.value })}>
            {TEMPERATURES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
          </select>
        </div>
        <dl className="facts">
          <div><dt>Category</dt><dd>{lead.category}</dd></div>
          <div><dt>Intent</dt><dd>{lead.intent || '—'}</dd></div>
          <div><dt>Last contacted</dt><dd>{timeAgo(lead.lastContactedAt)}</dd></div>
        </dl>
      </div>

      <div className="two-col">
        <section aria-labelledby="conv-h">
          <h2 id="conv-h">Conversation</h2>
          <div className="thread" ref={thread} tabIndex={0} role="log" aria-label="Conversation messages">
            {messages.length === 0 && <p className="muted thread-empty">No messages yet. Log what the student sent, or paste it into the assistant.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.sender}`}>
                <p>{m.text}</p>
                <p className="bubble-meta">
                  {m.sender === 'student' ? 'Student' : (m.by || 'Staff')} · {fmtDate(m.timestamp)}
                </p>
              </div>
            ))}
          </div>
          <form className="composer" onSubmit={addMessage}>
            <select aria-label="Who sent this message" value={newSender} onChange={(e) => setNewSender(e.target.value)}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
            <input aria-label="Message to log" value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Log a message…" maxLength={2000} />
            <button className="btn" type="submit" disabled={!newText.trim()}>Log</button>
          </form>
        </section>

        <div>
          <section aria-labelledby="ai-h">
            <h2 id="ai-h"><Icon name="spark" size={16} /> AI reply assistant</h2>
            <div className="card">
              <div className="field">
                <label htmlFor="enquiry">Student's enquiry</label>
                <textarea id="enquiry" rows={4} value={enquiry} onChange={(e) => setEnquiry(e.target.value)} placeholder="Paste or pick the enquiry to analyse" />
              </div>
              <button type="button" className="btn primary" onClick={analyse} disabled={aiBusy || !enquiry.trim()}>
                {aiBusy ? <><Spinner /> Analysing…</> : 'Analyse & draft reply'}
              </button>

              {aiError && (
                <div className="form-error" role="alert">
                  <Icon name="alert" size={18} />
                  <span>{aiError.error}<span className="form-error-sub">{aiError.fallback || 'You can still reply manually.'}</span></span>
                </div>
              )}

              {analysis && (
                <div className="analysis">
                  <div className="analysis-head">
                    <span className="tag">{analysis.category}</span>
                    <Signal level={analysis.leadTemperature} showLabel />
                    <span className="meter-wrap">
                      <span className="meter" role="img" aria-label={`Confidence ${Math.round(analysis.confidence * 100)} percent`}>
                        <span style={{ width: `${Math.round(analysis.confidence * 100)}%` }} />
                      </span>
                      <span className="meter-label">{Math.round(analysis.confidence * 100)}% confident</span>
                    </span>
                  </div>
                  <p className="analysis-intent"><strong>Intent:</strong> {analysis.intent}</p>
                  {analysis.reasoning && <p className="muted small"><em>{analysis.reasoning}</em></p>}
                  {analysis.confidence < 0.6 && (
                    <div className="warn-box" role="note"><Icon name="alert" size={16} /> Low confidence. Read the draft carefully before sending.</div>
                  )}
                  <div className="field">
                    <label htmlFor="draft">Draft reply (edit before sending)</label>
                    <textarea id="draft" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} />
                  </div>
                  <div className="row-actions">
                    <button type="button" className="btn primary" onClick={approveDraft} disabled={!draft.trim() || approving}>
                      {approving ? <><Spinner /> Saving…</> : <><Icon name="send" size={16} /> Approve &amp; send</>}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setAnalysis(null)} disabled={approving}>Discard</button>
                  </div>
                  <p className="small muted">Approving logs the reply as sent, updates the lead, and schedules a check-in in {analysis.suggestedFollowUpHours}h.</p>
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="fu-h">
            <h2 id="fu-h">Follow-ups</h2>
            <div className="card">
              {pendingFollowUps.length === 0 && <p className="muted small">Nothing scheduled.</p>}
              <ul className="fu-list">
                {pendingFollowUps.map((f) => (
                  <li key={f.id} className="fu-row">
                    <div>
                      <strong>{f.reason}</strong>
                      <div className={`small ${new Date(f.scheduledFor) < new Date() ? 'is-overdue' : 'muted'}`}>{fmtDate(f.scheduledFor)}</div>
                    </div>
                    <button type="button" className="btn small" onClick={() => completeFollowUp(f.id)}><Icon name="check" size={15} /> Done</button>
                  </li>
                ))}
              </ul>
              <form className="schedule" onSubmit={scheduleFollowUp}>
                <div className="field">
                  <label htmlFor="fu-when">When</label>
                  <input id="fu-when" type="datetime-local" value={fuWhen} onChange={(e) => setFuWhen(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="fu-reason">Reason (optional)</label>
                  <input id="fu-reason" value={fuReason} onChange={(e) => setFuReason(e.target.value)} maxLength={300} />
                </div>
                <button className="btn" type="submit">Schedule</button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
