import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { assignmentFinding, candidateAssignments, coverageAt, coverageGaps, requirements } from './coverage'
import type { StaffAssignment } from './coverage'
import { assignStaff, changeCredential, readShiftLedger, removeStaff, saveShiftLedger, transferBlockers } from './shiftLedger'
import { careCoordinators, careWorkInbox, claimCredentialWork } from './clinicalWorkload'
function requireDefaultCandidate(): StaffAssignment {
  const candidate = candidateAssignments.find(item => item.id === 'RN-4')
  if (!candidate) throw new Error('Coverage candidates are unavailable.')
  return candidate
}
const defaultCandidate = requireDefaultCandidate()
export function WardCoverageMatrixPage() {
  const { ward, date } = useParams()
  const shiftDate = date ?? '2026-09-14'
  const [shift, setShift] = useState(() => readShiftLedger(window.localStorage))
  const staff = shift.staff
  const [selectedId, setSelectedId] = useState(defaultCandidate.id)
  const [notice, setNotice] = useState('')
  const [specialistId, setSpecialistId] = useState('cred-jo')
  const candidate = candidateAssignments.find(item => item.id === selectedId) ?? defaultCandidate
  const finding = assignmentFinding(staff, candidate, shiftDate)
  const gaps = coverageGaps(staff, shiftDate)
  function assign() {
    if (finding) { setNotice(finding); return }
    setShift(saveShiftLedger(window.localStorage, assignStaff(shift, candidate, shiftDate)))
    setNotice(`${candidate.name} added to the Night shift.`)
  }
  function remove(id: string) {
    try { setShift(saveShiftLedger(window.localStorage, removeStaff(shift, id))); setNotice(`${id} removed from shift.`) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Removal failed.') }
  }
  function reviewCredential(id: string, until: string) {
    try { setShift(saveShiftLedger(window.localStorage, changeCredential(shift, id, until, specialistId))); setNotice(`${id} credential reviewed; transfer eligibility recalculated.`) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Credential review failed.') }
  }
  return <div className="suite-page">
    <header className="suite-title"><div><small>WARD / SKILL-MIX COVERAGE</small>
      <h1>Ward staffing coverage matrix</h1>
      <p>{ward ?? 'WARD-ICU'} · Night shift · {shiftDate}</p>
    </div></header>
    <section className="suite-card" aria-label="Hourly coverage">
      <h2>Hourly skill mix</h2>
      <table><caption>{ward ?? 'WARD-ICU'} Night shift</caption>
        <thead><tr><th>Role</th><th>Required</th><th>19:00</th><th>20:00</th><th>21:00</th><th>22:00</th></tr></thead>
        <tbody>{requirements.map(rule => <tr key={rule.skill}><th scope="row">{rule.skill}</th>
          <td>{rule.minimum}</td>{[19, 20, 21, 22].map(hour => <td key={hour}>
            {coverageAt(staff, rule.skill, hour, shiftDate)}
          </td>)}</tr>)}</tbody></table>
      <p>{gaps.length} uncovered role-hour(s).</p>
      <p>Roster revision {shift.revision} · Transfer coverage {shift.transferApproved ? 'approved' : 'pending'}</p>
      {transferBlockers(shift, shiftDate).map(item => <p role="alert" key={item}>{item}</p>)}
      {gaps.length > 0 && <ul>{gaps.map(gap => <li key={gap.skill + String(gap.hour)}>
        {gap.skill} at {gap.hour}:00: {gap.assigned}/{gap.required}
      </li>)}</ul>}
    </section>
    <section className="suite-card" aria-label="Assign available staff">
      <h2>Available staff</h2>
      <label>Candidate <select value={selectedId} onChange={event => { setSelectedId(event.target.value); }}>
        {candidateAssignments.map(person => <option key={person.id} value={person.id}>
          {person.name} · {person.skill} · credential until {person.credentialUntil}
        </option>)}</select></label>
      {finding && <p>{finding}</p>}
      <button disabled={Boolean(finding)} onClick={assign}>Assign to shift</button>
      <label>Credential specialist <select value={specialistId} onChange={event => { setSpecialistId(event.target.value) }}>
        {careCoordinators.filter(item => item.role === 'credential specialist').map(item =>
          <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <div aria-label="Credential exception inbox">
        <h3>Credential exceptions</h3>
        {careWorkInbox([{ shiftId: 'WARD-ICU-NIGHT', ward: 'ICU', ledger: shift }]).filter(item =>
          item.kind === 'credential').map(item => <p key={item.id}>{item.staffId} · {item.assigneeId ?? 'unclaimed'}
          <button onClick={() => { try {
            const record = { shiftId: 'WARD-ICU-NIGHT', ward: 'ICU', ledger: shift }
            setShift(saveShiftLedger(window.localStorage, claimCredentialWork(record, item.staffId ?? '', specialistId, [record])))
            setNotice('Credential exception claimed.')
          } catch (error) { setNotice(error instanceof Error ? error.message : 'Claim failed.') } }}>Claim exception</button></p>)}
      </div>
      <p role="status">{notice}</p>
      <details><summary>Assigned staff and breaks</summary>
        <ul>{staff.map(person => <li key={person.id}>{person.name} · {person.skill} · break {person.breakStart}:00–{person.breakEnd}:00
          {candidateAssignments.some(item => item.id === person.id) && <button onClick={() => { remove(person.id) }}>Remove {person.id}</button>}
          {person.id === 'RN-4' && <button onClick={() => { reviewCredential(person.id, person.credentialUntil < shiftDate ? '2026-12-31' : '2026-09-13') }}>Review RN-4 credential</button>}
        </li>)}</ul>
      </details>
    </section>
  </div>
}
