import { array, booleanValue, finiteNumber, nonEmptyText, nonNegativeInteger, nullable, object, oneOf, optional, refine, text, uniqueBy } from '../../workspace/storageValidation'
import type { ShiftCollection, ShiftRecord, StaffCredential } from './shiftCollection'
import type { CredentialWork, ShiftLedger, TransferReview } from './shiftLedger'
import type { StaffAssignment } from './coverage'

const calendarDate = refine(text, value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'expected a calendar date')
const staff = object<StaffAssignment>({
  id: nonEmptyText, name: text, skill: oneOf('Critical care RN', 'Respiratory therapist'),
  starts: finiteNumber, ends: finiteNumber, breakStart: finiteNumber, breakEnd: finiteNumber, credentialUntil: calendarDate,
})
const transfer = object<TransferReview>({
  id: nonEmptyText, sourceRevision: nonNegativeInteger, requestedBy: text, assignee: text,
  assigneeId: optional(nullable(nonEmptyText)), status: oneOf('open', 'stale', 'completed', 'superseded'),
  supersedesId: optional(nonEmptyText), outcome: optional(oneOf('approved', 'changes_requested')), reason: optional(text),
})
const credentialWork = object<CredentialWork>({
  id: nonEmptyText, staffId: nonEmptyText, sourceRevision: nonNegativeInteger, assigneeId: nullable(nonEmptyText), status: oneOf('open', 'completed'),
})
const ledger = object<ShiftLedger>({
  staff: uniqueBy(array(staff), 'id'), transferApproved: booleanValue, transferSourceRevision: nullable(nonNegativeInteger),
  rosterOwner: text, transferReviewer: nullable(text), transferReviews: optional(uniqueBy(array(transfer), 'id')),
  credentialWork: optional(uniqueBy(array(credentialWork), 'id')), revision: nonNegativeInteger,
  history: array(object<ShiftLedger['history'][number]>({ revision: nonNegativeInteger, action: text, staffId: nonEmptyText, actor: optional(text) })),
})
const shift = object<ShiftRecord>({ id: nonEmptyText, ward: nonEmptyText, ledger, archived: booleanValue })
const credential = object<StaffCredential>({ id: nonEmptyText, revision: nonNegativeInteger, until: calendarDate, shiftIds: array(nonEmptyText) })
export const shiftCollectionRule = object<ShiftCollection>({
  shifts: uniqueBy(array(shift), 'id'), credentials: uniqueBy(array(credential), 'id'),
  audit: array(object<ShiftCollection['audit'][number]>({ action: text, id: nonEmptyText, related: array(nonEmptyText) })),
})
