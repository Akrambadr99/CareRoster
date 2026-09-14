import { requireThat } from '../workspace/values'
export const workflowKey = "agency-booking"
export const workflowLabel = "Agency staff booking"
export const ruleKind = "window"
export interface AgencyBookingRecord { measured: number; limit: number; evidence: string; revision: number }
export function validateAuthorization(record: AgencyBookingRecord) {
  requireThat(Number.isSafeInteger(record.measured) && Number.isSafeInteger(record.limit), 'Workflow measurements must be safe integers.')
  requireThat(record.measured >= 0 && record.limit >= 0, 'Workflow measurements cannot be negative.')
  requireThat(record.measured <= record.limit, 'Arrival minute falls outside Latest safe arrival minute.')
  requireThat(record.evidence.trim().length >= 8, 'Agency staff booking require traceable evidence.')
  requireThat(record.revision > 0, 'Agency staff booking require a current record revision.')
  return { authorized: true as const, fingerprint: [workflowKey, record.measured, record.limit, record.revision].join(':') }
}
export function canRoleAdvance(role: string, phase: string) {
  const matrix: Record<string, readonly string[]> = { draft: ['coordinator'], review: ['reviewer'], authorized: ['operator'], active: ['owner'], blocked: ['reviewer'] }
  return (matrix[phase] ?? []).includes(role)
}
