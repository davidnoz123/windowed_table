import { test, expect } from '@playwright/test'

// Assumes the FastAPI backend is running on http://localhost:8000
// and the Vite dev server is on http://localhost:5173.

test.describe('Windowed Table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait until at least one row is visible
    await page.waitForSelector('[data-testid^="row-"]', { timeout: 10_000 })
  })

  // ── Initial load ────────────────────────────────────────────────────────────

  test('renders table with column headers', async ({ page }) => {
    await expect(page.getByTestId('virtual-table')).toBeVisible()
    await expect(page.getByTestId('sort-name')).toBeVisible()
    await expect(page.getByTestId('sort-status')).toBeVisible()
    await expect(page.getByTestId('sort-value')).toBeVisible()
  })

  test('shows 10,000 total rows in header', async ({ page }) => {
    await expect(page.getByText(/10,000 rows/)).toBeVisible()
  })

  test('first row contains expected fields', async ({ page }) => {
    const row0 = page.getByTestId('row-0')
    await expect(row0).toBeVisible()
    // id cell should be "1"
    await expect(page.getByTestId('cell-id-0')).toHaveText('1')
  })

  // ── Virtual scrolling ────────────────────────────────────────────────────────

  test('scrolling down loads new rows', async ({ page }) => {
    const container = page.getByTestId('table-container')

    // Scroll 100 rows down (100 × 32 = 3200 px)
    await container.evaluate((el) => { el.scrollTop = 3200 })

    // Wait for a row near index 100 to appear
    await page.waitForSelector('[data-testid="row-100"]', { timeout: 5_000 })
    await expect(page.getByTestId('cell-id-100')).toHaveText('101')
  })

  test('rows near index 0 are no longer in the DOM after scrolling deep', async ({ page }) => {
    const container = page.getByTestId('table-container')

    // Scroll far down (500 rows × 32 px)
    await container.evaluate((el) => { el.scrollTop = 16000 })
    await page.waitForTimeout(400)

    // Row 0 should have been virtualised away
    await expect(page.getByTestId('row-0')).not.toBeVisible()
  })

  // ── Sorting ──────────────────────────────────────────────────────────────────

  test('clicking Name header sorts ascending and resets scroll', async ({ page }) => {
    const container = page.getByTestId('table-container')

    // Scroll down first
    await container.evaluate((el) => { el.scrollTop = 3200 })
    await page.waitForSelector('[data-testid="row-100"]')

    // Sort ascending by name
    await page.getByTestId('sort-name').click()

    // Scroll should reset to top
    const scrollTop = await container.evaluate((el) => el.scrollTop)
    expect(scrollTop).toBe(0)

    // Sort indicator ▲ should appear
    await expect(page.getByTestId('sort-name')).toHaveText(/▲/)

    // First two visible names should be in ascending order
    const name0 = await page.getByTestId('cell-name-0').textContent()
    const name1 = await page.getByTestId('cell-name-1').textContent()
    expect(name0!.localeCompare(name1!) <= 0).toBeTruthy()
  })

  test('clicking Name header twice sorts descending', async ({ page }) => {
    await page.getByTestId('sort-name').click()
    await page.getByTestId('sort-name').click()

    await expect(page.getByTestId('sort-name')).toHaveText(/▼/)

    const name0 = await page.getByTestId('cell-name-0').textContent()
    const name1 = await page.getByTestId('cell-name-1').textContent()
    expect(name0!.localeCompare(name1!) >= 0).toBeTruthy()
  })

  test('clicking Name header three times removes sort', async ({ page }) => {
    await page.getByTestId('sort-name').click()
    await page.getByTestId('sort-name').click()
    await page.getByTestId('sort-name').click()

    const headerText = await page.getByTestId('sort-name').textContent()
    expect(headerText).not.toMatch(/[▲▼]/)
  })

  // ── Filtering ────────────────────────────────────────────────────────────────

  test('filtering by status "active" reduces total and shows only active rows', async ({ page }) => {
    await page.getByTestId('filter-status').fill('active')

    // Wait for total to change
    await expect(page.getByText(/rows/)).not.toHaveText(/10,000 rows/, { timeout: 3_000 })

    // All visible status cells should contain "active"
    const statusCells = page.locator('[data-testid^="cell-status-"]')
    const count = await statusCells.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(statusCells.nth(i)).toHaveText(/active/i)
    }
  })

  test('clearing a filter restores the original total', async ({ page }) => {
    await page.getByTestId('filter-name').fill('Alice')
    await expect(page.getByText(/rows/)).not.toHaveText(/10,000 rows/, { timeout: 3_000 })

    await page.getByTestId('filter-name').fill('')
    await expect(page.getByText(/10,000 rows/)).toBeVisible({ timeout: 3_000 })
  })

  // ── Combined ─────────────────────────────────────────────────────────────────

  test('sort and filter work together', async ({ page }) => {
    await page.getByTestId('filter-status').fill('active')
    await page.getByTestId('sort-value').click()   // sort ascending by value

    await page.waitForTimeout(400)

    // All visible status cells are "active"
    const statusCells = page.locator('[data-testid^="cell-status-"]')
    const count = await statusCells.count()
    for (let i = 0; i < Math.min(count, 3); i++) {
      await expect(statusCells.nth(i)).toHaveText(/active/i)
    }

    // Values should be in ascending order
    const v0 = parseFloat((await page.getByTestId('cell-value-0').textContent()) ?? '0')
    const v1 = parseFloat((await page.getByTestId('cell-value-1').textContent()) ?? '0')
    expect(v0).toBeLessThanOrEqual(v1)
  })
})
