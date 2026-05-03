import {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
  type ChangeEvent,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { queryTable, getDistinctValues, type SortField, type FilterField, type TableRow } from '../api/tableApi'
import { MultiSelectFilter } from './MultiSelectFilter'

// ─── constants ───────────────────────────────────────────────────────────────

const ROW_HEIGHT = 32
const OVERSCAN = 10
const CONTAINER_HEIGHT = 600
const DEBOUNCE_MS = 300

// ─── column definitions ──────────────────────────────────────────────────────

interface ColumnDef {
  field: keyof TableRow
  label: string
  width: number
}

const COLUMNS: ColumnDef[] = [
  { field: 'id',         label: 'ID',         width: 80  },
  { field: 'name',       label: 'Name',       width: 200 },
  { field: 'status',     label: 'Status',     width: 120 },
  { field: 'department', label: 'Department', width: 160 },
  { field: 'value',      label: 'Value',      width: 120 },
  { field: 'date',       label: 'Date',       width: 120 },
]

// ─── debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── component ───────────────────────────────────────────────────────────────

export function VirtualTable() {
  const parentRef = useRef<HTMLDivElement>(null)

  const { data: statusOptions = [] } = useQuery({
    queryKey: ['distinct', 'status'],
    queryFn: () => getDistinctValues('status'),
  })

  const { data: departmentOptions = [] } = useQuery({
    queryKey: ['distinct', 'department'],
    queryFn: () => getDistinctValues('department'),
  })

  const [sort, setSort] = useState<SortField[]>([])
  const [rawFilters, setRawFilters] = useState<Record<string, string>>({})
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string[]>([])
  const debouncedRawFilters = useDebounce(rawFilters, DEBOUNCE_MS)

  const filtersArray = useMemo<FilterField[]>(() => {
    const filters: FilterField[] = []
    
    Object.entries(debouncedRawFilters)
      .filter(([, v]) => v.trim() !== '')
      .forEach(([field, value]) => {
        filters.push({ field, op: 'contains' as const, value })
      })
    
    if (selectedStatus.length > 0 && selectedStatus.length < statusOptions.length) {
      filters.push({ field: 'status', op: 'in' as const, value: selectedStatus })
    }
    
    if (selectedDepartment.length > 0 && selectedDepartment.length < departmentOptions.length) {
      filters.push({ field: 'department', op: 'in' as const, value: selectedDepartment })
    }
    
    return filters
  }, [debouncedRawFilters, selectedStatus, selectedDepartment, statusOptions.length, departmentOptions.length])

  // total rows (seeded with assumed default; updated from API)
  const [totalRows, setTotalRows] = useState(10000)

  // virtualizer
  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const windowStart = virtualItems.length > 0 ? virtualItems[0].index : 0
  const windowEnd   = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : 49
  const windowCount = windowEnd - windowStart + 1

  // data fetch
  const { data, isFetching } = useQuery({
    queryKey: ['table', windowStart, windowCount, sort, filtersArray],
    queryFn: () => queryTable({ start: windowStart, count: windowCount, sort, filters: filtersArray }),
    placeholderData: keepPreviousData,
  })

  // update total whenever it changes
  useEffect(() => {
    if (data?.total !== undefined) setTotalRows(data.total)
  }, [data?.total])

  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = 0
    }
  }, [sort, filtersArray])

  const handleStatusChange = useCallback((selected: string[]) => {
    setSelectedStatus(selected)
  }, [])

  const handleDepartmentChange = useCallback((selected: string[]) => {
    setSelectedDepartment(selected)
  }, [])

  // map virtualizer index -> row
  const rowMap = useMemo(() => {
    const map = new Map<number, TableRow>()
    if (data) {
      data.rows.forEach((row, i) => map.set(windowStart + i, row))
    }
    return map
  }, [data, windowStart])
  
  const isStaleData = useMemo(() => {
    if (!data) return false
    return data.start !== windowStart
  }, [data, windowStart])

  // ─── handlers ──────────────────────────────────────────────────────────────

  const handleSort = useCallback((field: string) => {
    setSort(prev => {
      const existing = prev.find(s => s.field === field)
      if (!existing) return [{ field, direction: 'asc' as const }]
      if (existing.direction === 'asc') return [{ field, direction: 'desc' as const }]
      return []
    })
  }, [])

  const handleFilterChange = useCallback(
    (field: string, e: ChangeEvent<HTMLInputElement>) => {
      setRawFilters(prev => ({ ...prev, [field]: e.target.value }))
    },
    [],
  )

  const getSortIndicator = (field: string) => {
    const s = sort.find(s => s.field === field)
    if (!s) return null
    return s.direction === 'asc' ? ' ▲' : ' ▼'
  }

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div data-testid="virtual-table" style={{ fontFamily: 'inherit', fontSize: 14 }}>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 0', flexWrap: 'wrap' }}>
        {COLUMNS.map(col => {
          if (col.field === 'status') {
            return (
              <MultiSelectFilter
                key={col.field}
                label={col.label}
                options={statusOptions}
                selected={selectedStatus}
                onChange={handleStatusChange}
                width={col.width}
              />
            )
          }
          if (col.field === 'department') {
            return (
              <MultiSelectFilter
                key={col.field}
                label={col.label}
                options={departmentOptions}
                selected={selectedDepartment}
                onChange={handleDepartmentChange}
                width={col.width}
              />
            )
          }
          return (
            <input
              key={col.field}
              data-testid={`filter-${col.field}`}
              placeholder={`Filter ${col.label}…`}
              value={rawFilters[col.field] ?? ''}
              onChange={e => handleFilterChange(col.field, e)}
              style={{ width: col.width - 8, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 3 }}
            />
          )
        })}
      </div>

      {/* ── Column headers ── */}
      <div
        style={{
          display: 'flex',
          borderTop: '2px solid #555',
          borderBottom: '2px solid #555',
          background: '#f0f0f0',
          userSelect: 'none',
        }}
      >
        {COLUMNS.map(col => (
          <div
            key={col.field}
            data-testid={`sort-${col.field}`}
            onClick={() => handleSort(col.field)}
            style={{
              width: col.width,
              flexShrink: 0,
              padding: '6px 8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {col.label}{getSortIndicator(col.field)}
          </div>
        ))}
        {/* loading indicator */}
        <div style={{ marginLeft: 'auto', padding: '6px 8px', color: '#999', fontSize: 12 }}>
          {isFetching ? 'Loading…' : `${totalRows.toLocaleString()} rows`}
        </div>
      </div>

      {/* ── Scroll container ── */}
      <div
        ref={parentRef}
        data-testid="table-container"
        style={{
          height: CONTAINER_HEIGHT,
          overflow: 'auto',
          position: 'relative',
          border: '1px solid #ddd',
        }}
      >
        {/* inner div whose height equals total virtual height */}
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {virtualItems.map(virtualItem => {
            const row = rowMap.get(virtualItem.index)
            return (
              <div
                key={virtualItem.key}
                data-testid={`row-${virtualItem.index}`}
                style={{
                  position: 'absolute',
                  top: virtualItem.start,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  background: virtualItem.index % 2 === 0 ? '#fafafa' : '#fff',
                  borderBottom: '1px solid #eee',
                }}
              >
                {row && !isStaleData ? (
                  COLUMNS.map(col => (
                    <div
                      key={col.field}
                      data-testid={`cell-${col.field}-${virtualItem.index}`}
                      style={{
                        width: col.width,
                        flexShrink: 0,
                        padding: '0 8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.field === 'value'
                        ? (row[col.field] as number).toFixed(2)
                        : String(row[col.field])}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '0 8px', color: '#bbb' }}>—</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
