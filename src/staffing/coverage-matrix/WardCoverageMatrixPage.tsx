import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { assignmentFinding, assignments, candidateAssignments, coverageAt, coverageGaps, requirements } from './coverage'
import type { StaffAssignment } from './coverage'
function requireDefaultCandidate(): StaffAssignment {
  const candidate = candidateAssignments.find(item => item.id === 'RN-4')
  if (!candidate) throw new Error('Coverage candidates are unavailable.')
  return candidate
}
const defaultCandidate = requireDefaultCandidate()
export function WardCoverageMatrixPage() {
  const { ward, date } = useParams()
  const shiftDate = date ?? '2026-09-14'
  const [staff, setStaff] = useState<readonly StaffAssignment[]>(assignments)
  const [selectedId, setSelectedId] = useState(defaultCandidate.id)
  const [notice, setNotice] = useState('')
  const candidate = candidateAssignments.find(item => item.id === selectedId) ?? defaultCandidate
  const finding = assignmentFinding(staff, candidate, shiftDate)
  const gaps = coverageGaps(staff, shiftDate)
  function assign() {
    if (finding) { setNotice(finding); return }
    setStaff(current => [...current, candidate])
    setNotice(`${candidate.name} added to the Night shift.`)
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
      <p role="status">{notice}</p>
      <details><summary>Assigned staff and breaks</summary>
        <ul>{staff.map(person => <li key={person.id}>{person.name} · {person.skill} · break {person.breakStart}:00–{person.breakEnd}:00</li>)}</ul>
      </details>
    </section>
  </div>
}
