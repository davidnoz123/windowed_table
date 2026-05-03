import { http, HttpResponse } from 'msw'
import type { TableRow } from '../api/tableApi'

interface QueryBody {
  start: number
  count: number
  sort: { field: string; direction: string }[]
  filters: { field: string; op: string; value: string | number }[]
}

const STATUSES = ['active', 'inactive', 'pending']
const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance']

function makeRow(index: number): TableRow {
  return {
    id: index + 1,
    name: `Person ${index + 1}`,
    status: STATUSES[index % STATUSES.length],
    department: DEPARTMENTS[index % DEPARTMENTS.length],
    value: parseFloat(((index + 1) * 1.5).toFixed(2)),
    date: '2023-01-01',
  }
}

export const handlers = [
  http.post('/api/table/query', async ({ request }) => {
    const body = (await request.json()) as QueryBody
    const { start, count, filters } = body

    // Simulate filter reducing the total
    let total = 10000
    const nameFilter = filters.find(f => f.field === 'name')
    const statusFilter = filters.find(f => f.field === 'status' && f.op === 'eq')

    if (nameFilter) total = 100
    if (statusFilter) total = 3334

    const available = Math.max(0, total - start)
    const take = Math.min(count, available)

    const rows = Array.from({ length: take }, (_, i) => makeRow(start + i))

    // If status filter, override status on all rows
    if (statusFilter) {
      rows.forEach(r => { r.status = String(statusFilter.value) })
    }

    return HttpResponse.json({ total, rows })
  }),
]
