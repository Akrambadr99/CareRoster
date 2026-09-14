import { requireThat } from '../workspace/values'
export const workflowKey = "credential-check"
export const workflowLabel = "Clinical credential validity"
export const ruleKind = "qualification"
export interface CredentialCheckRecord { measured: number; limit: number; evidence: string; revision: number }
export function validateAuthorization(record: CredentialCheckRecord) {
  requireThat(Number.isSafeInteger(record.measured) && Number.isSafeInteger(record.limit), 'Workflow measurements must be safe integers.')
  requireThat(record.measured >= 0 && record.limit >= 0, 'Workflow measurements cannot be negative.')
  requireThat(record.measured >= record.limit, 'Credential score fall below Minimum credential score.')
  requireThat(record.evidence.trim().length >= 8, 'Clinical credential validity require traceable evidence.')
  requireThat(record.revision > 0, 'Clinical credential validity require a current record revision.')
  return { authorized: true as const, fingerprint: [workflowKey, record.measured, record.limit, record.revision].join(':') }
}
export function canRoleAdvance(role: string, phase: string) {
  const matrix: Record<string, readonly string[]> = { draft: ['coordinator'], review: ['reviewer'], authorized: ['operator'], active: ['owner'], blocked: ['reviewer'] }
  return (matrix[phase] ?? []).includes(role)
}
