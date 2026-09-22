import type { ShiftLedger } from './shiftLedger'

export interface CareCoordinator {
  id: string
  name: string
  role: 'clinical lead' | 'credential specialist'
  wards: readonly string[]
  maxOpenWork: number
  available: boolean
}
export interface ShiftWorkRecord { shiftId: string; ward: string; ledger: ShiftLedger }
export interface CareWorkItem {
  id: string
  shiftId: string
  ward: string
  kind: 'credential' | 'transfer'
  status: 'open' | 'stale'
  assigneeId: string | null
  sourceRevision: number
  staffId?: string
}

export const careCoordinators: readonly CareCoordinator[] = [
  { id: 'lead-mira', name: 'Mira Patel', role: 'clinical lead', wards: ['ICU', 'ED'], maxOpenWork: 2, available: true },
  { id: 'lead-ines', name: 'Ines Okafor', role: 'clinical lead', wards: ['ICU'], maxOpenWork: 1, available: true },
  { id: 'cred-jo', name: 'Jo Rivera', role: 'credential specialist', wards: ['ICU', 'ED'], maxOpenWork: 2, available: true },
]

export function careWorkInbox(records: readonly ShiftWorkRecord[], actorId?: string): CareWorkItem[] {
  return records.flatMap(({ shiftId, ward, ledger }) => [
    ...(ledger.transferReviews ?? []).filter(item => item.status === 'open' || item.status === 'stale').map(item => ({
      id: item.id, shiftId, ward, kind: 'transfer' as const, status: item.status as 'open' | 'stale',
      assigneeId: item.assigneeId ?? null, sourceRevision: item.sourceRevision,
    })),
    ...(ledger.credentialWork ?? []).filter(item => item.status === 'open').map(item => ({
      id: item.id, shiftId, ward, kind: 'credential' as const, status: 'open' as const,
      assigneeId: item.assigneeId, sourceRevision: item.sourceRevision, staffId: item.staffId,
    })),
  ]).filter(item => actorId === undefined || item.assigneeId === actorId)
    .sort((a, b) => Number(b.kind === 'credential') - Number(a.kind === 'credential') ||
      Number(a.status === 'stale') - Number(b.status === 'stale') ||
      a.sourceRevision - b.sourceRevision || a.shiftId.localeCompare(b.shiftId) || a.id.localeCompare(b.id))
}

export function careActorLoad(records: readonly ShiftWorkRecord[], actorId: string): number {
  return careWorkInbox(records, actorId).filter(item => item.status === 'open').length
}

export function careClaimBlockers(records: readonly ShiftWorkRecord[], shiftId: string, actorId: string,
  kind: CareWorkItem['kind']): string[] {
  const record = records.find(item => item.shiftId === shiftId)
  const actor = careCoordinators.find(item => item.id === actorId)
  const blockers: string[] = []
  if (!record) blockers.push('Shift was not found.')
  if (!actor?.available) blockers.push('Care coordinator is unavailable.')
  if (record && actor && !actor.wards.includes(record.ward)) blockers.push('Care coordinator is outside ward scope.')
  if (actor && actor.role !== (kind === 'transfer' ? 'clinical lead' : 'credential specialist')) blockers.push('Wrong clinical qualification for this work.')
  if (actor && careActorLoad(records, actorId) >= actor.maxOpenWork) blockers.push('Care coordinator is at capacity.')
  if (kind === 'transfer' && actorId === record?.ledger.rosterOwner) blockers.push('Roster author cannot independently claim review.')
  return blockers
}

export function claimTransferWork(record: ShiftWorkRecord, actorId: string, records: readonly ShiftWorkRecord[],
  expectedRevision: number): ShiftLedger {
  const state = record.ledger
  if (state.revision !== expectedRevision) throw new Error('Roster revision changed before claim.')
  const review = (state.transferReviews ?? []).find(item => item.status === 'open')
  if (review?.sourceRevision !== state.revision) throw new Error('Only current transfer review may be claimed.')
  if (review.assigneeId) throw new Error('Transfer review is already claimed.')
  const blockers = careClaimBlockers(records, record.shiftId, actorId, 'transfer')
  if (blockers.length) throw new Error(blockers[0])
  const revision = state.revision + 1
  return { ...state, revision, transferReviews: state.transferReviews?.map(item => item.id === review.id ?
    { ...item, assigneeId: actorId, sourceRevision: revision } : item),
    history: [...state.history, { revision, action: 'clinical-review-claimed', staffId: record.shiftId, actor: actorId }] }
}

export function claimCredentialWork(record: ShiftWorkRecord, staffId: string, actorId: string,
  records: readonly ShiftWorkRecord[]): ShiftLedger {
  const state = record.ledger
  const work = (state.credentialWork ?? []).find(item => item.staffId === staffId && item.status === 'open')
  if (work?.sourceRevision !== state.revision) throw new Error('Only current credential exception may be claimed.')
  if (work.assigneeId) throw new Error('Credential exception is already claimed.')
  const blockers = careClaimBlockers(records, record.shiftId, actorId, 'credential')
  if (blockers.length) throw new Error(blockers[0])
  const revision = state.revision + 1
  return { ...state, revision, credentialWork: state.credentialWork?.map(item => item.id === work.id ?
    { ...item, assigneeId: actorId, sourceRevision: revision } : item),
    history: [...state.history, { revision, action: 'credential-work-claimed', staffId, actor: actorId }] }
}
