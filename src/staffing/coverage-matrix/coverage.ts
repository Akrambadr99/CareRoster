export type Skill = 'Critical care RN' | 'Respiratory therapist'
export interface StaffAssignment { id: string; name: string; skill: Skill; starts: number; ends: number; breakStart: number; breakEnd: number; credentialUntil: string }
export interface CoverageRequirement { skill: Skill; start: number; end: number; minimum: number }
export const requirements: readonly CoverageRequirement[] = [
  { skill: 'Critical care RN', start: 19, end: 23, minimum: 4 },
  { skill: 'Respiratory therapist', start: 19, end: 23, minimum: 1 },
]
export const assignments: readonly StaffAssignment[] = [
  { id: 'RN-1', name: 'A. Malik', skill: 'Critical care RN', starts: 19, ends: 23, breakStart: 20, breakEnd: 20, credentialUntil: '2026-12-31' },
  { id: 'RN-2', name: 'B. Chen', skill: 'Critical care RN', starts: 19, ends: 23, breakStart: 21, breakEnd: 22, credentialUntil: '2026-12-31' },
  { id: 'RN-3', name: 'C. Diaz', skill: 'Critical care RN', starts: 19, ends: 23, breakStart: 22, breakEnd: 23, credentialUntil: '2026-12-31' },
  { id: 'RT-1', name: 'D. Shah', skill: 'Respiratory therapist', starts: 19, ends: 23, breakStart: 20, breakEnd: 20, credentialUntil: '2026-12-31' },
]
export const candidateAssignments: readonly StaffAssignment[] = [
  { id: 'RN-4', name: 'E. Flores', skill: 'Critical care RN', starts: 19, ends: 23, breakStart: 20, breakEnd: 20, credentialUntil: '2026-12-31' },
  { id: 'RN-5', name: 'F. Jones', skill: 'Critical care RN', starts: 19, ends: 23, breakStart: 20, breakEnd: 20, credentialUntil: '2026-09-13' },
  { id: 'RT-2', name: 'G. Patel', skill: 'Respiratory therapist', starts: 19, ends: 23, breakStart: 20, breakEnd: 20, credentialUntil: '2026-12-31' },
]
export function coverageAt(staff: readonly StaffAssignment[], skill: Skill, hour: number, date: string): number {
  return staff.filter(person => person.skill === skill && person.credentialUntil >= date &&
    person.starts <= hour && hour < person.ends && !(person.breakStart <= hour && hour < person.breakEnd)).length
}
export function coverageGaps(staff: readonly StaffAssignment[], date: string, rules = requirements) {
  return rules.flatMap(rule => Array.from({ length: rule.end - rule.start }, (_, index) => {
    const hour = rule.start + index
    const assigned = coverageAt(staff, rule.skill, hour, date)
    return assigned < rule.minimum ? [{ skill: rule.skill, hour, assigned, required: rule.minimum }] : []
  }).flat())
}
export function assignmentFinding(staff: readonly StaffAssignment[], candidate: StaffAssignment, date: string): string | null {
  if (staff.some(person => person.id === candidate.id)) return 'Staff member is already assigned.'
  if (candidate.credentialUntil < date) return 'Credential expired before the shift.'
  if (candidate.ends <= candidate.starts) return 'Shift end must follow shift start.'
  return null
}
