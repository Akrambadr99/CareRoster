import { describe, expect, it } from 'vitest'
import { assignmentFinding, assignments, candidateAssignments, coverageAt, coverageGaps } from './coverage'
describe('ward coverage', () => {
  it('counts only overlapping and credentialed staff outside breaks', () => {
    expect(coverageAt(assignments, 'Critical care RN', 20, '2026-09-14')).toBe(3)
    expect(coverageAt(assignments, 'Critical care RN', 21, '2026-09-14')).toBe(2)
  })
  it('reports time-specific skill shortages', () => {
    expect(coverageGaps(assignments, '2026-09-14')).toContainEqual({ skill: 'Critical care RN', hour: 21, assigned: 2, required: 4 })
  })
  it('rejects expired or duplicate assignments', () => {
    expect(assignmentFinding(assignments, candidateAssignments[1]!, '2026-09-14')).toMatch(/expired/)
    expect(assignmentFinding(assignments, assignments[0]!, '2026-09-14')).toMatch(/already/)
  })
  it('reduces gaps after a qualified addition', () => {
    expect(coverageGaps([...assignments, candidateAssignments[0]!], '2026-09-14').length)
      .toBeLessThan(coverageGaps(assignments, '2026-09-14').length)
  })
})
