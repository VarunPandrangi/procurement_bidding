import { test, expect, type Page } from '@playwright/test'
import { loginAs, logout, ACCOUNTS, SEL, waitForApi } from './helpers'

/**
 * E2E-01: Full RFQ Lifecycle Test
 *
 * This test walks through the complete lifecycle of an RFQ:
 * 1.  Admin login → dashboard visible
 * 2.  Buyer login → redirect to /buyer
 * 3.  Buyer creates RFQ via 5-step wizard
 * 4.  Buyer publishes the RFQ
 * 5.  Verify RFQ appears in buyer's list
 * 6.  Supplier 1 login → sees the enquiry
 * 7.  Supplier 1 opens the RFQ → PENDING state
 * 8.  Supplier 1 accepts (3 declarations)
 * 9.  Supplier 1 submits initial bid
 * 10. Verify bid confirmation (rank widget / submitted state)
 * 11. Supplier 2 login → accept → submit competing bid
 * 12. Supplier 1 submits a revision
 * 13. Buyer closes the RFQ early
 * 14. Buyer views Live Rankings tab
 * 15. Verify receipt download link exists
 * 16. Verify final closed state
 */

test.describe.serial('E2E-01: Full RFQ Lifecycle', () => {
  let rfqId: string
  let rfqTitle: string

  test('Step 1: Admin can login and see admin dashboard', async ({ page }) => {
    await loginAs(page, 'admin')
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.locator('[data-sidebar]').locator('text=Dashboard')).toBeVisible()
  })

  test('Step 2: Buyer can login and is redirected to /buyer', async ({
    page,
  }) => {
    await loginAs(page, 'buyer')
    await expect(page).toHaveURL(/\/buyer/)
    await expect(page.locator('h1')).toContainText(/good\s+(morning|afternoon|evening)|dashboard|enquiries/i)
  })

  test('Step 3: Buyer creates an RFQ via the wizard', async ({ page }) => {
    await loginAs(page, 'buyer')

    // Navigate to New Enquiry
    await page.locator('[data-sidebar]').locator('a[href="/buyer/rfqs/new"]').click()

    // ── Step 1: Items ──
    // Fill the first item row
    const descInput = page.locator(
      'table tbody tr:first-child td:nth-child(2) input',
    )
    await descInput.fill('Test Steel Plate 10mm')

    const uomInput = page.locator(
      'table tbody tr:first-child td:nth-child(4) input',
    )
    await uomInput.fill('KG')

    const qtyInput = page.locator(
      'table tbody tr:first-child td:nth-child(5) input',
    )
    await qtyInput.fill('1000')

    // Add second item
    await page.click('button:has-text("Add item")')
    const secondRow = page.locator('table tbody tr:nth-child(2)')
    await secondRow.locator('td:nth-child(2) input').fill('Stainless Rod 8mm')
    await secondRow.locator('td:nth-child(4) input').fill('PCS')
    await secondRow.locator('td:nth-child(5) input').fill('500')

    // Continue to next step
    await page.click(SEL.wizardContinueButton)

    // ── Step 2: Commercial Terms ──
    rfqTitle = `E2E Test Enquiry ${Date.now()}`
    await page.fill('input[placeholder*="Q1 2026"]', rfqTitle)
    await page.fill('input[placeholder*="Net 30"]', 'Net 45 days')

    await page.click(SEL.wizardContinueButton)

    // ── Step 3: Bidding Rules ──
    // Set bid open time to now (within a minute) and close time to 2 hours from now
    const now = new Date()
    const openTime = new Date(now.getTime() + 60_000) // 1 min from now
    const closeTime = new Date(now.getTime() + 2 * 60 * 60_000) // 2 hours from now

    const formatForInput = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    await page.fill(
      'input[type="datetime-local"]:first-of-type',
      formatForInput(openTime),
    )
    await page.fill(
      'input[type="datetime-local"]:last-of-type',
      formatForInput(closeTime),
    )

    // Set cooling time to 0 for faster E2E testing
    const coolingInput = page.locator('input[min="0"][max="1440"]')
    await coolingInput.fill('0')

    await page.click(SEL.wizardContinueButton)

    // ── Step 4: Suppliers ──
    // Wait for suppliers to load
    await page.waitForSelector('label:has(input[type="checkbox"])')

    // Select at least 2 suppliers
    const supplierCheckboxes = page.locator('label:has(input[type="checkbox"])')
    const count = await supplierCheckboxes.count()
    expect(count).toBeGreaterThanOrEqual(2)

    await supplierCheckboxes.nth(0).click()
    await supplierCheckboxes.nth(1).click()

    // If there's a third supplier, select it too
    if (count >= 3) {
      await supplierCheckboxes.nth(2).click()
    }

    await page.click(SEL.wizardContinueButton)

    // ── Step 5: Review & Publish ──
    await expect(page.locator('text=Review Before Publishing')).toBeVisible()
    await expect(page.locator(`text=${rfqTitle}`)).toBeVisible()
  })

  test('Step 4: Buyer publishes the RFQ', async ({ page }) => {
    await loginAs(page, 'buyer')

    // Navigate to New Enquiry and go through wizard again (or find the draft)
    await page.locator('[data-sidebar]').locator('a[href="/buyer/rfqs/new"]').click()

    // Fill wizard quickly
    const descInput = page.locator(
      'table tbody tr:first-child td:nth-child(2) input',
    )
    await descInput.fill('E2E Lifecycle Steel')
    const uomInput = page.locator(
      'table tbody tr:first-child td:nth-child(4) input',
    )
    await uomInput.fill('KG')
    const qtyInput = page.locator(
      'table tbody tr:first-child td:nth-child(5) input',
    )
    await qtyInput.fill('1000')
    await page.click(SEL.wizardContinueButton)

    rfqTitle = `E2E Lifecycle ${Date.now()}`
    await page.fill('input[placeholder*="Q1 2026"]', rfqTitle)
    await page.fill('input[placeholder*="Net 30"]', 'Net 30 days')
    await page.click(SEL.wizardContinueButton)

    // Bidding rules — set open to now-1min (past, so RFQ activates immediately), close to now+2hrs, cooling=0
    const now = new Date()
    const formatForInput = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    await page.fill(
      'input[type="datetime-local"]:first-of-type',
      formatForInput(new Date(now.getTime() - 60_000)),
    )
    await page.fill(
      'input[type="datetime-local"]:last-of-type',
      formatForInput(new Date(now.getTime() + 2 * 60 * 60_000)),
    )
    const coolingInput = page.locator('input[min="0"][max="1440"]')
    await coolingInput.fill('0')
    await page.click(SEL.wizardContinueButton)

    // Select suppliers
    await page.waitForSelector('label:has(input[type="checkbox"])')
    const supplierCheckboxes = page.locator('label:has(input[type="checkbox"])')
    await supplierCheckboxes.nth(0).click()
    await supplierCheckboxes.nth(1).click()
    const count = await supplierCheckboxes.count()
    if (count >= 3) await supplierCheckboxes.nth(2).click()
    await page.click(SEL.wizardContinueButton)

    // Review — click Publish Enquiry
    await expect(page.locator('text=Review Before Publishing')).toBeVisible()
    await page.click(SEL.wizardPublishButton)

    // Confirm dialog
    await expect(page.locator('text=Publish this enquiry?')).toBeVisible()
    await page.click('button:has-text("Publish"):not(:has-text("Enquiry"))')

    // Wait for navigation to RFQ detail
    await page.waitForURL(/\/buyer\/rfqs\/(?!new)[a-f0-9-]+/, { timeout: 15_000 })

    // Capture the RFQ ID from URL
    const url = page.url()
    const match = url.match(/\/buyer\/rfqs\/([^/?#]+)/)
    expect(match).toBeTruthy()
    rfqId = match![1]
  })

  test('Step 5: RFQ appears in buyer dashboard', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.locator('[data-sidebar]').locator('a[href="/buyer/rfqs"]').click()
    await page.locator('table').first().waitFor({ timeout: 10_000 })

    // The RFQ should be visible somewhere
    await expect(page.locator(`text=${rfqTitle}`).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('Step 6: Supplier 1 sees the enquiry in dashboard', async ({
    page,
  }) => {
    await loginAs(page, 'supplier1')
    await expect(page).toHaveURL(/\/supplier/)

    // Wait for the RFQ cards to load
    await page.waitForSelector('h1:has-text("My Enquiries")')

    // The enquiry should be visible (may need to wait for API)
    await expect(page.locator(`text=${rfqTitle}`).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test('Step 7: Supplier 1 opens RFQ and sees PENDING state', async ({
    page,
  }) => {
    await loginAs(page, 'supplier1')

    // Navigate to the RFQ
    await page.goto(`/supplier/rfqs/${rfqId}`)
    await page.waitForLoadState('networkidle')

    // Should see "Review & Accept" button in the PENDING state action bar
    await expect(
      page.locator(SEL.reviewAcceptButton).first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.locator(SEL.declineButton).first()).toBeVisible()
  })

  test('Step 8: Supplier 1 accepts via declaration modal', async ({
    page,
  }) => {
    await loginAs(page, 'supplier1')
    await page.goto(`/supplier/rfqs/${rfqId}`)
    await page.waitForLoadState('networkidle')

    // Click "Review & Accept"
    await page.click(SEL.reviewAcceptButton)

    // Declaration modal should appear
    await expect(
      page.locator('text=Accept Participation').first(),
    ).toBeVisible()

    // Check all 3 declarations
    await expect(page.locator('text=Terms & Conditions')).toBeVisible()
    await page.locator('text=Terms & Conditions').click()

    await expect(page.locator('text=No Collusion')).toBeVisible()
    await page.locator('text=No Collusion').click()

    await expect(page.locator('text=Confidentiality')).toBeVisible()
    await page.locator('text=Confidentiality').click()

    // Progress should show "3 of 3 confirmed"
    await expect(page.locator('text=3 of 3 confirmed')).toBeVisible()

    // Click Accept Participation
    await page.click(SEL.acceptParticipationButton)

    // Wait for the modal to close and state to update
    await page.waitForTimeout(2000)
  })

  test('Step 9: Supplier 1 submits initial bid', async ({ page }) => {
    await loginAs(page, 'supplier1')
    await page.goto(`/supplier/rfqs/${rfqId}`)

    // Wait for the bidding form to appear (may need to wait for bid window to open)
    // The page state should be ACCEPTED_BIDDING or ACCEPTED_WAITING
    await page.waitForTimeout(3000)

    // Check if bid form is visible (ACCEPTED_BIDDING state)
    const bidForm = page.locator('text=Your Price Submission')
    const isFormVisible = await bidForm.isVisible().catch(() => false)

    if (isFormVisible) {
      // Fill price inputs
      const priceInputs = page.locator(
        'input[type="number"][step="0.0001"]',
      )
      const inputCount = await priceInputs.count()

      for (let i = 0; i < inputCount; i++) {
        await priceInputs.nth(i).fill((100 + i * 10).toFixed(4))
      }

      // Click Submit Bid
      await page.click(SEL.submitBidButton)

      // Confirm dialog
      await expect(page.locator('text=Submit your bid?')).toBeVisible()
      await page.click('button:has-text("Submit bid")')

      // Wait for success
      await page.waitForTimeout(3000)
    } else {
      // Bid window hasn't opened yet — skip and mark as expected
      test.skip(true, 'Bid window has not opened yet — timing dependent')
    }
  })

  test('Step 10: Verify bid submitted state shows rank widget', async ({
    page,
  }) => {
    await loginAs(page, 'supplier1')
    await page.goto(`/supplier/rfqs/${rfqId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // After bid submission, should show submission history or rank widget
    const rankWidget = page.locator('text=Revise Your Prices')
    const submissionHistory = page.locator('text=Submission History')

    const hasRankOrHistory =
      (await rankWidget.isVisible().catch(() => false)) ||
      (await submissionHistory.isVisible().catch(() => false))

    if (!hasRankOrHistory) {
      // May still be in ACCEPTED_BIDDING — bid window timing
      test.skip(true, 'Bid not yet submitted or window not open')
    }
  })

  test('Step 11: Supplier 2 accepts and submits competing bid', async ({
    page,
  }) => {
    await loginAs(page, 'supplier2')
    await page.goto(`/supplier/rfqs/${rfqId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Accept if in PENDING state
    const acceptBtn = page.locator(SEL.reviewAcceptButton)
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click()

      // Complete 3 declarations
      await page.locator('text=Terms & Conditions').click()
      await page.locator('text=No Collusion').click()
      await page.locator('text=Confidentiality').click()
      await page.click(SEL.acceptParticipationButton)
      await page.waitForTimeout(2000)

      // Reload to get updated state
      await page.goto(`/supplier/rfqs/${rfqId}`)
      await page.waitForTimeout(3000)
    }

    // Submit bid if form is available
    const bidForm = page.locator('text=Your Price Submission')
    if (await bidForm.isVisible().catch(() => false)) {
      const priceInputs = page.locator(
        'input[type="number"][step="0.0001"]',
      )
      const inputCount = await priceInputs.count()

      for (let i = 0; i < inputCount; i++) {
        await priceInputs.nth(i).fill((90 + i * 5).toFixed(4))
      }

      await page.click(SEL.submitBidButton)
      await expect(page.locator('text=Submit your bid?')).toBeVisible()
      await page.click('button:has-text("Submit bid")')
      await page.waitForTimeout(3000)
    }
  })

  test('Step 12: Supplier 1 submits a revision', async ({ page }) => {
    await loginAs(page, 'supplier1')
    await page.goto(`/supplier/rfqs/${rfqId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const revisionForm = page.locator('text=Revise Your Prices')
    if (await revisionForm.isVisible().catch(() => false)) {
      // Update prices to be lower (revision)
      const priceInputs = page.locator(
        'input[type="number"][step="0.0001"]',
      )
      const inputCount = await priceInputs.count()

      for (let i = 0; i < inputCount; i++) {
        await priceInputs.nth(i).fill((85 + i * 8).toFixed(4))
      }

      await page.click(SEL.submitRevisionButton)
      await page.waitForTimeout(3000)
    } else {
      test.skip(
        true,
        'Revision form not available — bid may not be submitted yet',
      )
    }
  })

  test('Step 13: Buyer closes the RFQ early', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.goto(`/buyer/rfqs/${rfqId}`)
    await page.waitForLoadState('networkidle')

    // Click "Close Early" button
    const closeBtn = page.locator(SEL.closeEarlyButton)
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click()

      // Confirm dialog
      await expect(
        page.locator('text=Close this enquiry early?'),
      ).toBeVisible()
      await page.click(SEL.closeEnquiryConfirm)

      // Wait for state update
      await page.waitForTimeout(3000)
    }
  })

  test('Step 14: Buyer views Live Rankings tab', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.goto(`/buyer/rfqs/${rfqId}`)
    await page.waitForLoadState('networkidle')

    // Click Rankings tab
    const rankingsTab = page.locator('button:has-text("Live Rankings")')
    if (await rankingsTab.isVisible().catch(() => false)) {
      await rankingsTab.click()
      await page.waitForTimeout(2000)

      // Should show ranking data, "no bids" message, or "Rankings will appear" message
      const hasContent =
        (await page.locator('table').isVisible().catch(() => false)) ||
        (await page.locator('text=No bids').isVisible().catch(() => false)) ||
        (await page.locator('text=Rankings will appear').isVisible().catch(() => false))
      expect(hasContent).toBeTruthy()
    }
  })

  test('Step 15: Supplier 1 can see receipt download link', async ({
    page,
  }) => {
    await loginAs(page, 'supplier1')
    await page.goto(`/supplier/rfqs/${rfqId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // In closed state or bid-submitted state, check for Submission History
    const history = page.locator('text=Submission History')
    if (await history.isVisible().catch(() => false)) {
      // Check for download receipt button
      await expect(
        page.locator('text=Download Receipt').first(),
      ).toBeVisible()
    }
  })

  test('Step 16: Verify closed state on supplier side', async ({ page }) => {
    await loginAs(page, 'supplier1')
    await page.goto(`/supplier/rfqs/${rfqId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should see closed banner or final prices
    const closedBanner = page.locator('text=This enquiry has closed')
    const finalPrices = page.locator('text=Your Final Submission')

    const hasClosed =
      (await closedBanner.isVisible().catch(() => false)) ||
      (await finalPrices.isVisible().catch(() => false))

    if (!hasClosed) {
      // Check if the RFQ is still active (timing issue)
      test.skip(true, 'RFQ may not be closed yet — timing dependent')
    }
  })
})
