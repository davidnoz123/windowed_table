const API_BASE = '/api'

export interface SortField {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilterField {
  field: string
  op: 'eq' | 'neq' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string | number
}

export interface TableRow {
  id: number
  name: string
  status: string
  department: string
  value: number
  date: string
}

export interface TableQueryParams {
  start: number
  count: number
  sort: SortField[]
  filters: FilterField[]
}

export interface TableResponse {
  total: number
  rows: TableRow[]
}

export async function queryTable(params: TableQueryParams): Promise<TableResponse> {
  const res = await fetch(`${API_BASE}/table/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json() as Promise<TableResponse>
}
