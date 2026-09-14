import { requireThat } from '../workspace/values'
export const workflowKey = "bed-status"
export const workflowLabel = "Bed-state synchronization"
export const ruleKind = "freshness"
export interface BedStatusRecord { measured: number; limit: number; evidence: string; revision: number }
export function validateAuthorization(record: BedStatusRecord) {
  requireThat(Number.isSafeInteger(record.measured) && Number.isSafeInteger(record.limit), 'Workflow measurements must be safe integers.')
  requireThat(record.measured >= 0 && record.limit >= 0, 'Workflow measurements cannot be negative.')
  requireThat(record.measured <= record.limit, 'Bed update age (minutes) exceed Maximum update age.')
  requireThat(record.evidence.trim().length >= 8, 'Bed-state synchronization require traceable evidence.')
  requireThat(record.revision > 0, 'Bed-state synchronization require a current record revision.')
  return { authorized: true as const, fingerprint: [workflowKey, record.measured, record.limit, record.revision].join(':') }
}
export function canRoleAdvance(role: string, phase: string) {
  const matrix: Record<string, readonly string[]> = { draft: ['coordinator'], review: ['reviewer'], authorized: ['operator'], active: ['owner'], blocked: ['reviewer'] }
  return (matrix[phase] ?? []).includes(role)
}
