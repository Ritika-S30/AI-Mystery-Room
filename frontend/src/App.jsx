import React, { useEffect, useState } from 'react';

// In development, keep API calls same-origin so Vite forwards /api to Express.
// Production can set an API origin when the frontend and backend are separate.
function resolveApiBase() {
  if (import.meta.env.DEV) return { base: '', error: '' };

  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!configured) {
    return {
      base: '',
      error: 'The production API URL is missing. Set VITE_API_BASE_URL to your backend Render URL and redeploy the frontend.',
    };
  }

  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
      return { base: '', error: 'VITE_API_BASE_URL must be the public HTTPS URL of the deployed backend.' };
    }
    if (url.pathname !== '/' || url.search || url.hash) {
      return { base: '', error: 'VITE_API_BASE_URL must be the backend origin only, without a path or query.' };
    }
    return { base: url.origin, error: '' };
  } catch {
    return { base: '', error: 'VITE_API_BASE_URL must be a valid HTTPS backend URL.' };
  }
}

const { base: API_BASE, error: API_CONFIG_ERROR } = resolveApiBase();
const GUEST_KEY = 'mystery-room-guest';
const ACTIVE_KEY = 'mystery-room-active-investigation';
const HINT_LIMITS = { easy: 2, medium: 3, hard: 3 };

function getGuestId() {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

async function api(path, { guestId, ...options } = {}) {
  if (API_CONFIG_ERROR) throw new Error(API_CONFIG_ERROR);
  const response = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(guestId ? { 'x-guest-id': guestId } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function App() {
  const [guestId] = useState(getGuestId);
  const [investigations, setInvestigations] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [solution, setSolution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [noteText, setNoteText] = useState('');
  const [noteEvidence, setNoteEvidence] = useState('');
  const [question, setQuestion] = useState('');
  const [hint, setHint] = useState('');
  const [accusedId, setAccusedId] = useState('');

  const refreshList = async () => {
    const list = await api('/investigations', { guestId });
    setInvestigations(list);
  };

  const openInvestigation = async (id) => {
    setLoading(true);
    setError('');
    setSolution(null);
    setHint('');
    try {
      const data = await api(`/investigations/${id}`, { guestId });
      setWorkspace(data);
      localStorage.setItem(ACTIVE_KEY, id);
      setAccusedId(data.investigation.accusation || '');
      if (data.investigation.status === 'completed') {
        const reveal = await api(`/investigations/${id}/solution`, { guestId });
        setSolution(reveal.solution);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await api('/investigations', { guestId });
        if (!mounted) return;
        setInvestigations(list);
        const activeId = localStorage.getItem(ACTIVE_KEY);
        if (activeId && list.some((item) => item.id === activeId)) await openInvestigation(activeId);
      } catch (requestError) {
        if (mounted) setError(requestError.message);
      }
    })();
    return () => { mounted = false; };
  }, [guestId]);

  const startInvestigation = async () => {
    setLoading(true);
    setError('');
    try {
      const generated = await api('/mysteries/generate', {
        method: 'POST', body: JSON.stringify({ difficulty }),
      });
      const mysteryId = generated?.mystery?.id ?? generated?.mystery?._id;
      if (typeof mysteryId !== 'string' || !/^[a-f\d]{24}$/i.test(mysteryId)) {
        throw new Error('The generated mystery did not include a valid case ID. Please try again.');
      }
      const created = await api('/investigations', {
        guestId, method: 'POST', body: JSON.stringify({ mysteryId }),
      });
      localStorage.setItem(ACTIVE_KEY, created.investigation.id);
      setWorkspace({ ...generated, investigation: created.investigation });
      setSolution(null);
      setAccusedId('');
      await refreshList();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const markReviewed = async (evidenceId) => {
    try {
      const data = await api(`/investigations/${workspace.investigation.id}/evidence/${evidenceId}/review`, { guestId, method: 'POST' });
      setWorkspace((current) => ({ ...current, investigation: data.investigation }));
    } catch (requestError) { setError(requestError.message); }
  };

  const saveNote = async (event) => {
    event.preventDefault();
    if (!noteText.trim()) return;
    try {
      const data = await api(`/investigations/${workspace.investigation.id}/notes`, {
        guestId, method: 'POST', body: JSON.stringify({ text: noteText, ...(noteEvidence ? { evidenceId: noteEvidence } : {}) }),
      });
      setWorkspace((current) => ({ ...current, investigation: data.investigation }));
      setNoteText('');
      setNoteEvidence('');
    } catch (requestError) { setError(requestError.message); }
  };

  const askHint = async (event) => {
    event.preventDefault();
    setHint('');
    try {
      const data = await api(`/investigations/${workspace.investigation.id}/hint`, {
        guestId, method: 'POST', body: JSON.stringify({ question }),
      });
      setHint(data.hint);
      setWorkspace((current) => ({ ...current, investigation: { ...current.investigation, hintsUsed: data.hintsUsed } }));
    } catch (requestError) { setError(requestError.message); }
  };

  const makeAccusation = async (event) => {
    event.preventDefault();
    if (!accusedId) return;
    setError('');
    try {
      const data = await api(`/investigations/${workspace.investigation.id}/accuse`, {
        guestId, method: 'POST', body: JSON.stringify({ suspectId: accusedId }),
      });
      setWorkspace((current) => ({ ...current, investigation: data.investigation }));
      setSolution(data.solution);
      await refreshList();
    } catch (requestError) { setError(requestError.message); }
  };

  const goHome = () => {
    setWorkspace(null);
    setSolution(null);
    setError('');
    localStorage.removeItem(ACTIVE_KEY);
    refreshList().catch((requestError) => setError(requestError.message));
  };

  return (
    <main className="page-shell app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); goHome(); }} aria-label="AI Mystery Room home">
          <span className="brand-mark" aria-hidden="true">✳</span><span>AI MYSTERY ROOM</span>
        </a>
        <span className="edition">{workspace ? 'ACTIVE CASE FILE' : 'A CASE AWAITS'}</span>
      </header>

      {error && <div className="alert" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss message">×</button></div>}
      {loading && <div className="loading-line" role="status">Preparing your case…</div>}

      {!workspace ? (
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="status-dot" /> YOUR NEXT INVESTIGATION</p>
            <h1 id="hero-title">Every detail<br />has a <em>story.</em></h1>
            <p className="intro">Step into a mystery, study the evidence, and decide what really happened. The answer is there. You just have to find it.</p>
            <div className="start-controls">
              <label htmlFor="difficulty">CASE DIFFICULTY</label>
              <select id="difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
              </select>
            </div>
            <button className="start-button" type="button" disabled={loading} onClick={startInvestigation}>
              <span>{loading ? 'Preparing your case…' : 'Start an investigation'}</span><span aria-hidden="true">↗</span>
            </button>
            {investigations.length > 0 && <section className="saved-cases"><h2>CONTINUE A CASE</h2>{investigations.map((item) => (
              <button className="saved-case" type="button" key={item.id} onClick={() => openInvestigation(item.id)}>
                <span><strong>{item.title}</strong><small>{item.status === 'completed' ? 'Case complete' : 'In progress'} · {item.difficulty}</small></span><span aria-hidden="true">→</span>
              </button>
            ))}</section>}
          </div>
          <aside className="case-card" aria-label="Investigation preview"><div className="card-topline"><span>CASE FILE</span><span>NO. 001</span></div><div className="file-stamp" aria-hidden="true">?</div><div className="card-caption"><span className="caption-label">THE ROOM IS QUIET</span><p>But the evidence<br />has a lot to say.</p></div><div className="card-footer"><span>OPEN CASE</span><span>•••</span></div></aside>
        </section>
      ) : (
        <section className="workspace" aria-label="Investigation workspace">
          <div className="workspace-heading">
            <button type="button" className="text-button" onClick={goHome}>← All cases</button>
            <p className="eyebrow"><span className="status-dot" /> CASE FILE · {workspace.mystery.difficulty?.toUpperCase()}</p>
            <h1>{workspace.mystery.title}</h1>
            <p className="case-intro">{workspace.mystery.description}</p>
            <div className="case-meta"><span>LOCATION · {workspace.mystery.location}</span><span>VICTIM · {workspace.mystery.victim?.name}</span></div>
            <p className="scenario">{workspace.mystery.scenario}</p>
          </div>

          <div className="progress-strip"><span>INVESTIGATION PROGRESS</span><strong>{workspace.investigation.reviewedEvidence.length} / {workspace.evidence.length} evidence reviewed</strong><span>{workspace.investigation.hintsUsed} hints used</span></div>

          <div className="investigation-grid">
            <section className="panel evidence-panel"><div className="section-heading"><div><p className="eyebrow">THE EVIDENCE ROOM</p><h2>Evidence</h2></div><span>{workspace.evidence.length} ITEMS</span></div>
              <div className="evidence-list">{workspace.evidence.map((item, index) => {
                const reviewed = workspace.investigation.reviewedEvidence.includes(item._id);
                return <article className={`evidence-card ${reviewed ? 'is-reviewed' : ''}`} key={item._id}>
                  <div className="evidence-number">EVIDENCE {String(index + 1).padStart(2, '0')} <span>{reviewed ? 'REVIEWED ✓' : item.type.replaceAll('_', ' ')}</span></div>
                  <h3>{item.title}</h3><p>{item.content}</p>
                  <div className="evidence-meta">{item.relevantAt && <span>{new Date(item.relevantAt).toLocaleString()}</span>}{item.relatedLocation && <span>{item.relatedLocation}</span>}</div>
                  {item.relatedSuspects?.length > 0 && <small>Related to {workspace.suspects.filter((s) => item.relatedSuspects.includes(s._id)).map((s) => s.name).join(', ')}</small>}
                  {workspace.investigation.status === 'active' && <button className="text-button review-button" type="button" onClick={() => markReviewed(item._id)} disabled={reviewed}>{reviewed ? 'Added to your review log' : 'Mark as reviewed'}</button>}
                </article>;
              })}</div>
            </section>

            <div className="side-column">
              <section className="panel"><div className="section-heading"><div><p className="eyebrow">PEOPLE OF INTEREST</p><h2>Suspects</h2></div></div>
                <div className="suspect-list">{workspace.suspects.map((suspect, index) => <article className="suspect-card" key={suspect._id}><span className="suspect-index">0{index + 1}</span><div><h3>{suspect.name}</h3><p>{suspect.age} · {suspect.relationshipToCase}</p><p>{suspect.background}</p><p><strong>Possible motive</strong> {suspect.motive}</p><p><strong>Alibi</strong> {suspect.alibi}</p>{suspect.relevantInformation && <p>{suspect.relevantInformation}</p>}</div></article>)}</div>
              </section>

              <section className="panel timeline-panel"><div className="section-heading"><div><p className="eyebrow">WHEN IT HAPPENED</p><h2>Case timeline</h2></div></div><ol className="timeline">{workspace.mystery.timeline.map((event, index) => <li key={`${event.at}-${index}`}><time>{event.at}</time><p>{event.event}</p></li>)}</ol></section>

              <section className="panel"><div className="section-heading"><div><p className="eyebrow">YOUR CASEBOOK</p><h2>Investigation notes</h2></div></div>
                {workspace.investigation.notes.map((note) => <article className="note-entry" key={note.id}><p>{note.text}</p>{note.evidenceId && <small>Linked to {workspace.evidence.find((e) => e._id === note.evidenceId)?.title || 'evidence'}</small>}</article>)}
                {workspace.investigation.status === 'active' && <form className="stack-form" onSubmit={saveNote}><label htmlFor="note">Add a private note</label><textarea id="note" value={noteText} onChange={(event) => setNoteText(event.target.value)} maxLength={4000} rows="3" placeholder="Record a detail or connection…" required /><select aria-label="Link note to evidence" value={noteEvidence} onChange={(event) => setNoteEvidence(event.target.value)}><option value="">No linked evidence</option>{workspace.evidence.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select><button className="action-button" type="submit">Save note</button></form>}
              </section>

              <section className="panel assistant-panel"><div className="section-heading"><div><p className="eyebrow">REASON IT THROUGH</p><h2>Ask for a hint</h2></div></div><p className="panel-copy">The case assistant can point you toward evidence without naming a culprit. {workspace.investigation.hintsUsed} / {HINT_LIMITS[workspace.mystery.difficulty]} hints used.</p>
                {hint && <blockquote className="hint-answer">{hint}</blockquote>}
                {workspace.investigation.status === 'active' && workspace.investigation.hintsUsed < HINT_LIMITS[workspace.mystery.difficulty] && <form className="stack-form" onSubmit={askHint}><label htmlFor="question">What are you stuck on? <span>optional</span></label><textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={600} rows="2" placeholder="Ask about a clue, alibi, or connection…" /><button className="action-button" type="submit">Ask the assistant</button></form>}
              </section>

              {workspace.investigation.status === 'active' ? <section className="panel accuse-panel"><p className="eyebrow">YOUR CONCLUSION</p><h2>Make an accusation</h2><p className="panel-copy">Choose the suspect you believe is responsible. The solution will be revealed after you submit.</p><form className="stack-form" onSubmit={makeAccusation}><label htmlFor="accused">I accuse</label><select id="accused" value={accusedId} onChange={(event) => setAccusedId(event.target.value)} required><option value="">Select a suspect</option>{workspace.suspects.map((suspect) => <option key={suspect._id} value={suspect._id}>{suspect.name}</option>)}</select><button className="start-button" type="submit" disabled={!accusedId}>Submit accusation <span aria-hidden="true">↗</span></button></form></section> : <section className={`solution-panel ${workspace.investigation.result ? 'correct' : 'incorrect'}`}>
                <p className="eyebrow">INVESTIGATION CLOSED</p><h2>{workspace.investigation.result ? 'Correct accusation.' : 'That was not the culprit.'}</h2><p className="score-result">Final score: <strong>{workspace.investigation.score ?? 0}</strong> points</p>
                {solution && <><p className="solution-culprit">The culprit was <strong>{solution.culprit.name}</strong>.</p><h3>Motive</h3><p>{solution.motive}</p><h3>What happened</h3><p>{solution.whatHappened}</p><h3>How the clues connect</h3><p>{solution.explanation}</p><div className="reveal-list"><h3>Important clues</h3>{solution.importantClues.map((clue, index) => <p key={`clue-${index}`}><strong>{clue.evidence?.title}:</strong> {clue.explanation}</p>)}<h3>Red herrings</h3>{solution.redHerrings.map((clue, index) => <p key={`red-${index}`}><strong>{clue.evidence?.title}:</strong> {clue.explanation}</p>)}</div></>}
                {solution && <button className="text-button" type="button" onClick={goHome}>Start another mystery →</button>}
              </section>}
            </div>
          </div>
        </section>
      )}
      <footer className="footer"><span>OBSERVE CLOSELY. THINK CLEARLY.</span><span>FICTIONAL CASES · REAL DEDUCTION</span></footer>
    </main>
  );
}

export default App;
