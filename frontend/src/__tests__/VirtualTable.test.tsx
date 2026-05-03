import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VirtualTable } from '../components/VirtualTable'

// ─── Mock TanStack Virtual ────────────────────────────────────────────────────
// jsdom has no layout engine; mock the virtualizer so it renders a fixed window.

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => {
    const visibleCount = Math.min(count, 20)
    return {
      getVirtualItems: () =>
        Array.from({ length: visibleCount }, (_, i) => ({
          index: i,
          key: i,
          start: i * 32,
        })),
      getTotalSize: () => count * 32,
    }
  },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function renderTable() {
  const client = makeClient()
  return render(
    <QueryClientProvider client={client}>
      <VirtualTable />
    </QueryClientProvider>,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VirtualTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the table container and column headers', () => {
    renderTable()
    expect(screen.getByTestId('virtual-table')).toBeInTheDocument()
    expect(screen.getByTestId('table-container')).toBeInTheDocument()
    expect(screen.getByTestId('sort-name')).toBeInTheDocument()
    expect(screen.getByTestId('sort-status')).toBeInTheDocument()
  })

  it('renders initial rows from the API', async () => {
    renderTable()
    // Wait for actual data cells to appear (row-0 renders immediately as placeholder)
    await waitFor(() => {
      expect(screen.getByTestId('cell-name-0')).toBeInTheDocument()
    })
    expect(screen.getByTestId('cell-name-0')).toHaveTextContent('Person 1')
  })

  it('renders filter inputs for every column', () => {
    renderTable()
    expect(screen.getByTestId('filter-id')).toBeInTheDocument()
    expect(screen.getByTestId('filter-name')).toBeInTheDocument()
    expect(screen.getByTestId('filter-status')).toBeInTheDocument()
    expect(screen.getByTestId('filter-department')).toBeInTheDocument()
    expect(screen.getByTestId('filter-value')).toBeInTheDocument()
    expect(screen.getByTestId('filter-date')).toBeInTheDocument()
  })

  it('shows sort indicator when a column header is clicked', async () => {
    renderTable()
    await waitFor(() => screen.getByTestId('row-0'))

    act(() => {
      fireEvent.click(screen.getByTestId('sort-name'))
    })

    // After clicking ascending, indicator ▲ should appear in the header text
    await waitFor(() => {
      expect(screen.getByTestId('sort-name').textContent).toMatch(/▲/)
    })
  })

  it('toggles sort direction on second click', async () => {
    renderTable()
    await waitFor(() => screen.getByTestId('row-0'))

    act(() => { fireEvent.click(screen.getByTestId('sort-name')) })
    await waitFor(() => expect(screen.getByTestId('sort-name').textContent).toMatch(/▲/))

    act(() => { fireEvent.click(screen.getByTestId('sort-name')) })
    await waitFor(() => expect(screen.getByTestId('sort-name').textContent).toMatch(/▼/))
  })

  it('removes sort on third click', async () => {
    renderTable()
    await waitFor(() => screen.getByTestId('row-0'))

    act(() => { fireEvent.click(screen.getByTestId('sort-name')) })
    act(() => { fireEvent.click(screen.getByTestId('sort-name')) })
    act(() => { fireEvent.click(screen.getByTestId('sort-name')) })

    await waitFor(() => {
      const header = screen.getByTestId('sort-name').textContent ?? ''
      expect(header).not.toMatch(/[▲▼]/)
    })
  })

  it('typing in a filter input updates the input value', async () => {
    renderTable()
    const filterInput = screen.getByTestId('filter-status')

    act(() => {
      fireEvent.change(filterInput, { target: { value: 'active' } })
    })

    expect(filterInput).toHaveValue('active')
  })

  it('applying a name filter reduces total rows shown in header', async () => {
    renderTable()
    await waitFor(() => screen.getByTestId('row-0'))

    act(() => {
      fireEvent.change(screen.getByTestId('filter-name'), { target: { value: 'Alice' } })
    })

    // MSW returns total=100 when a name filter is present
    await waitFor(() => {
      expect(screen.getByText(/100/)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('rows display correct cell content', async () => {
    renderTable()
    await waitFor(() => {
      expect(screen.getByTestId('cell-name-0')).toBeInTheDocument()
    })

    // Row 0: id=1, name="Person 1", status="active", value="1.50"
    expect(screen.getByTestId('cell-id-0')).toHaveTextContent('1')
    expect(screen.getByTestId('cell-name-0')).toHaveTextContent('Person 1')
    expect(screen.getByTestId('cell-value-0')).toHaveTextContent('1.50')
  })
})
