import { requireThat } from '../workspace/values'
export const workflowKey = "shift-handoff"
export const workflowLabel = "Clinical shift handoff"
export const ruleKind = "sequence"
export interface ShiftHandoffRecord { measured: number; limit: number; evidence: string; revision: number }
export function validateAuthorization(record: ShiftHandoffRecord) {
  requireThat(Number.isSafeInteger(record.measured) && Number.isSafeInteger(record.limit), 'Workflow measurements must be safe integers.')
  requireThat(record.measured >= 0 && record.limit >= 0, 'Workflow measurements cannot be negative.')
  requireThat(record.measured >= record.limit, 'Completed handoff step have not reached Required handoff step.')
  requireThat(record.evidence.trim().length >= 8, 'Clinical shift handoff require traceable evidence.')
  requireThat(record.revision > 0, 'Clinical shift handoff require a current record revision.')
  return { authorized: true as const, fingerprint: [workflowKey, record.measured, record.limit, record.revision].join(':') }
}
export function canRoleAdvance(role: string, phase: string) {
  const matrix: Record<string, readonly string[]> = { draft: ['coordinator'], review: ['reviewer'], authorized: ['operator'], active: ['owner'], blocked: ['reviewer'] }
  return (matrix[phase] ?? []).includes(role)
}
