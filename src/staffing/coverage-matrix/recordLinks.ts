import type { ShiftCollection } from './shiftCollection'

type Record = ShiftCollection['shifts'][number]
function selected(path: string, id: string) { return path + (path.includes('?') ? '&' : '?') + 'record=' + encodeURIComponent(id) }
export function recordDetailPath(record: Record) { return selected('/wards/' + record.ward + '/coverage/2026-09-14', record.id) }
export function recordDecisionPath(record: Record) { return selected('/wards/' + record.ward + '/transfers/HDU', record.id) }
