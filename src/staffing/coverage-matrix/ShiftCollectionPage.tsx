import { recordDetailPath, recordDecisionPath } from './recordLinks'
import { Link } from 'react-router-dom'
import { saveCurrentCollection } from '../../workspace/recordStorage'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { careCoordinators } from './clinicalWorkload'
import { archiveShift, claimShiftTransfer, readShiftCollection, requestShiftTransfers, reviseCredential,
  saveShiftCollection, shiftInbox, shiftRows } from './shiftCollection'

export function ShiftCollectionPage() {
  const [collection, setCollection] = useState(() => readShiftCollection(window.localStorage))
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('active')
  const [lead, setLead] = useState('lead-mira'); const [checked, setChecked] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const selectedId = params.get('shift') ?? 'ICU-NIGHT-15'; const selected = collection.shifts.find(item => item.id === selectedId)
  function choose(id: string) { setParams(current => { const next = new URLSearchParams(current); next.set('shift', id); return next }) }
  function persist(next: typeof collection, message: string) { try { setCollection(saveCurrentCollection(window.localStorage, collection, next, readShiftCollection, saveShiftCollection)); setNotice(message); return true } catch (error) { setNotice(error instanceof Error ? error.message : 'Save failed. Your input is preserved.'); return false } }
  function run(action: () => typeof collection, success: string) {
    try { return persist(action(), success) } catch (error) { setNotice(error instanceof Error ? error.message : 'Shift operation failed.'); return false }
  }
  return <main className="suite-page"><header className="suite-title"><div><small>STAFFING / CLINICAL RESPONSIBILITY</small>
    <h1>Ward shift workspace</h1><p>Independent ward rosters connected to staff credentials and clinical transfer review.</p></div></header>
    <section className="metrics" aria-label="Shift summary">
      <article><small>Active shifts</small><strong>{collection.shifts.filter(item => !item.archived).length}</strong></article>
      <article><small>Clinical work</small><strong>{shiftInbox(collection).length}</strong></article>
      <article><small>Shared credentials</small><strong>{collection.credentials.length}</strong></article>
    </section>
    <section className="suite-card" aria-label="Clinical queue"><h2>Clinical work queue</h2>
      {shiftInbox(collection).length ? <ul>{shiftInbox(collection).map(item => <li key={item.shiftId + item.id}>
        <button onClick={() => { choose(item.shiftId) }}>{item.shiftId}</button> · {item.ward} · {item.kind} ·
        {item.assigneeId ?? 'team queue'} · {item.status}</li>)}</ul> : <p>No active clinical work.</p>}
      <label>Clinical lead <select value={lead} onChange={event => { setLead(event.target.value) }}>
        {careCoordinators.filter(item => item.role === 'clinical lead').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </section>
    <section className="suite-card" aria-label="Shift collection"><h2>Ward shifts</h2>
      <label>Search shifts <input value={query} onChange={event => { setQuery(event.target.value) }} /></label>
      <label>Show <select value={filter} onChange={event => { setFilter(event.target.value) }}><option value="active">Active</option>
        <option value="archived">Archived</option><option value="all">All</option></select></label>
      {shiftRows(collection, query, filter).length ? <ul>{shiftRows(collection, query, filter).map(record => <li key={record.id}>
        <label><input type="checkbox" checked={checked.includes(record.id)} onChange={event => {
          setChecked(current => event.target.checked ? [...current, record.id] : current.filter(id => id !== record.id))
        }} /> Select {record.id}</label>
        <button aria-current={selectedId === record.id ? 'true' : undefined} onClick={() => { choose(record.id) }}>
          {record.id} · {record.ward}</button> · roster r{record.ledger.revision} · {record.ledger.staff.length} staff
        {record.archived ? ' · archived' : ''}</li>)}</ul> : <p>No shifts match this view.</p>}
      <button disabled={!checked.length} onClick={() => { const result = requestShiftTransfers(collection, checked)
        persist(result.collection, `${String(result.updated.length)} requested; ${String(result.skipped.length)} skipped; ${String(result.blocked.length)} blocked.`)
      }}>Request selected transfer reviews</button>
    </section>
    <section className="suite-card" aria-label="Selected shift"><h2>{selected?.id ?? 'Select a shift'}</h2>{selected && <>
      <p>{selected.ward} · roster r{selected.ledger.revision} · {selected.ledger.staff.length} assigned staff</p>
      <p>Transfer {selected.ledger.transferApproved ? 'approved' : 'pending'} · reviewer {selected.ledger.transferReviews?.find(item => item.status === 'open')?.assigneeId ?? 'unclaimed'}</p>
      <button onClick={() => { run(() => claimShiftTransfer(collection, selected.id, lead, selected.ledger.revision), 'Transfer review claimed.') }}>Claim selected transfer review</button>
      {collection.credentials.filter(item => item.shiftIds.includes(selected.id)).map(credential => <button key={credential.id} onClick={() => {
        try { const result = reviseCredential(collection, credential.id, credential.until === '2026-12-31' ? '2026-09-13' : '2026-12-31', credential.revision)
          persist(result.collection, `${String(result.updated.length)} related shifts updated; ${String(result.blocked.length)} blocked.`)
        } catch (error) { setNotice(error instanceof Error ? error.message : 'Credential update failed.') }
      }}>Toggle linked {credential.id} credential</button>)}
      <button onClick={() => { run(() => archiveShift(collection, selected.id), 'Shift archived.') }}>Archive shift</button>
      <details><summary>Roster history</summary><ol>{selected.ledger.history.map(item =>
        <li key={item.revision}>{item.action} · r{item.revision} · {item.staffId}</li>)}</ol></details>
    </>}</section>
    <section className="suite-card" aria-label="Shift audit"><h2>Collection audit</h2><ol>{collection.audit.toReversed().slice(0, 8).map((item, index) =>
      <li key={index}>{item.action} · {item.id} · {item.related.join(', ') || 'none'}</li>)}</ol></section>
    <nav aria-label="Selected record workflows">{selected && !selected.archived && <><Link to={recordDetailPath(selected)}>Open record details</Link>{' · '}<Link to={recordDecisionPath(selected)}>Open decision workflow</Link></>} <button onClick={() => { try { setCollection(readShiftCollection(window.localStorage)); setNotice('Workspace refreshed; selection preserved.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Refresh failed.') } }}>Refresh workspace</button></nav>
    <p role="status">{notice}</p>
  </main>
}
