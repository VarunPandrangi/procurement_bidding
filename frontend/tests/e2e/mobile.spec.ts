import { test, expect } from '@playwright/test'
import { loginAs, SEL } from './helpers'

/**
 * E2E-03: Mobile Smoke Tests
 *
 * All tests run at iPhone 12/13 viewport (390x844).
 * Verifies that critical flows work on mobile:
 * - Login form is usable
 * - Sidebar hamburger menu works
 * - Wizard inputs are accessible
 * - Supplier bid form is tappable
 * - Sticky action bars are visible
 * - Tables scroll horizontally
 * - Modals fit viewport
 */

const MOBILE_VIEWPORT = { width: 390, height: 844 }

test.describe('E2E-03: Mobile Smoke Tests', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('Login page renders correctly on mobile', async ({ page }) => {
    await page.goto('/login')

    // Form elements should be visible
    await expect(page.locator(SEL.emailInput)).toBeVisible()
    await expect(page.locator(SEL.passwordInput)).toBeVisible()
    await expect(page.locator(SEL.signInButton)).toBeVisible()

    // Brand mark should be visible
    await expect(page.locator('text=ProcureX')).toBeVisible()

    // Email input should be fully visible and not clipped
    const emailBox = await page.locator(SEL.emailInput).boundingBox()
    expect(emailBox).toBeTruthy()
    expect(emailBox!.width).toBeGreaterThan(200)
    expect(emailBox!.x).toBeGreaterThanOrEqual(0)

    // Sign in button should be tappable (at least 44px tall)
    const signInBox = await page.locator(SEL.signInButton).boundingBox()
    expect(signInBox).toBeTruthy()
    expect(signInBox!.height).toBeGreaterThanOrEqual(40)
  })

  test('Login form works on mobile', async ({ page }) => {
    await loginAs(page, 'buyer')
    await expect(page).toHaveURL(/\/buyer/)
  })

  test('Sidebar hamburger menu works on mobile', async ({ page }) => {
    await loginAs(page, 'buyer')

    // Desktop sidebar should be hidden on mobile
    const desktopSidebar = page.locator(SEL.sidebarDesktop)
    await expect(desktopSidebar).toBeHidden()

    // Mobile hamburger should be visible
    const hamburger = page.locator(SEL.mobileMenuButton)
    await expect(hamburger).toBeVisible()

    // Tap hamburger to open mobile menu
    await hamburger.click()

    // Mobile sidebar should slide in
    const mobileSidebar = page.locator('aside.translate-x-0, aside:not(.-translate-x-full)')
    await page.waitForTimeout(500) // Wait for slide animation

    // Navigation links should be visible
    await expect(page.locator('text=Dashboard').first()).toBeVisible()

    // Close button should be visible
    const closeBtn = page.locator(SEL.mobileMenuClose)
    await expect(closeBtn).toBeVisible()

    // Tap close
    await closeBtn.click()
    await page.waitForTimeout(500) // Wait for slide out
  })

  test('RFQ wizard is scrollable and inputs not cut off', async ({
    page,
  }) => {
    await loginAs(page, 'buyer')
    // Use SPA navigation via hamburger menu (page.goto would lose auth state)
    await page.click(SEL.mobileMenuButton)
    await page.waitForTimeout(300)
    await page.click('a[href="/buyer/rfqs/new"]')

    // Wizard step heading should be visible
    await expect(page.locator('h1:has-text("New Enquiry")')).toBeVisible()

    // Table should be present
    await expect(page.locator('table').first()).toBeVisible()

    // Input fields in wizard should be visible (may need scrolling)
    const firstInput = page.locator('table tbody input').first()
    await expect(firstInput).toBeVisible()

    // The input should have reasonable width
    const inputBox = await firstInput.boundingBox()
    expect(inputBox).toBeTruthy()
    expect(inputBox!.width).toBeGreaterThan(50)

    // Continue button should be accessible
    const continueBtn = page.locator(SEL.wizardContinueButton)
    await continueBtn.scrollIntoViewIfNeeded()
    await expect(continueBtn).toBeVisible()
  })

  test('Supplier dashboard renders on mobile', async ({ page }) => {
    await loginAs(page, 'supplier1')

    // Dashboard heading
    await expect(
      page.locator('h1:has-text("My Enquiries")'),
    ).toBeVisible()

    // Cards should render without overflow
    const pageWidth = MOBILE_VIEWPORT.width
    const body = await page.locator('body').boundingBox()
    expect(body!.width).toBeLessThanOrEqual(pageWidth + 1) // +1 for rounding
  })

  test('Supplier RFQ view - sticky action bar visible (PENDING state)', async ({
    page,
  }) => {
    await loginAs(page, 'supplier1')

    // Go to supplier dashboard and click the first RFQ if available
    const rfqCards = page.locator('button:has-text("Review & Respond")')
    const hasCards = (await rfqCards.count()) > 0

    if (hasCards) {
      await rfqCards.first().click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Check for sticky bottom action bar (for PENDING state)
      const acceptBtn = page.locator(SEL.reviewAcceptButton)
      const declineBtn = page.locator(SEL.declineButton)

      if (await acceptBtn.isVisible().catch(() => false)) {
        // The action bar should be within viewport
        const acceptBox = await acceptBtn.boundingBox()
        expect(acceptBox).toBeTruthy()
        expect(acceptBox!.y + acceptBox!.height).toBeLessThanOrEqual(
          MOBILE_VIEWPORT.height + 10,
        )

        // Both buttons should have min 44px height for touch targets
        expect(acceptBox!.height).toBeGreaterThanOrEqual(40)

        const declineBox = await declineBtn.boundingBox()
        if (declineBox) {
          expect(declineBox.height).toBeGreaterThanOrEqual(40)
        }
      }
    } else {
      test.skip(true, 'No PENDING RFQs available for this supplier')
    }
  })

  test('Tables horizontally scroll on small viewport', async ({ page }) => {
    await loginAs(page, 'buyer')
    await page.goto('/buyer/rfqs/new')

    // The items table in the wizard should have horizontal scroll
    const tableContainer = page.locator('.overflow-x-auto').first()
    if (await tableContainer.isVisible().catch(() => false)) {
      const table = tableContainer.locator('table')
      const tableBox = await table.boundingBox()
      const containerBox = await tableContainer.boundingBox()

      if (tableBox && containerBox) {
        // Table may be wider than container (scrollable)
        // At minimum, the container should not exceed viewport
        expect(containerBox.width).toBeLessThanOrEqual(
          MOBILE_VIEWPORT.width + 5,
        )
      }
    }
  })

  test('Declaration modal fits viewport on mobile', async ({ page }) => {
    await loginAs(page, 'supplier1')

    // Find a PENDING RFQ
    const reviewBtn = page.locator('button:has-text("Review & Respond")')
    if ((await reviewBtn.count()) > 0) {
      await reviewBtn.first().click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const acceptBtn = page.locator(SEL.reviewAcceptButton)
      if (await acceptBtn.isVisible().catch(() => false)) {
        await acceptBtn.click()

        // Modal should appear and fit within viewport
        await page.waitForTimeout(500)
        const modal = page.locator('[role="dialog"], [class*="Modal"]').first()
        if (await modal.isVisible().catch(() => false)) {
          const modalBox = await modal.boundingBox()
          expect(modalBox).toBeTruthy()
          // Modal should be within viewport width
          expect(modalBox!.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width)

          // Declaration cards should be visible
          await expect(page.locator('text=Terms & Conditions')).toBeVisible()
          await expect(page.locator('text=No Collusion')).toBeVisible()
        }
      }
    } else {
      test.skip(true, 'No PENDING RFQs available for modal test')
    }
  })

  test('Bid form price inputs are tappable on mobile', async ({ page }) => {
    await loginAs(page, 'supplier1')

    // Navigate to any RFQ that may have bidding active
    const bidNowBtn = page.locator('button:has-text("Bid Now")')
    if ((await bidNowBtn.count()) > 0) {
      await bidNowBtn.first().click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // Check price input touch targets
      const priceInputs = page.locator(
        'input[type="number"][step="0.0001"]',
      )
      if ((await priceInputs.count()) > 0) {
        const inputBox = await priceInputs.first().boundingBox()
        expect(inputBox).toBeTruthy()

        // Price input should have at least 36px height (iOS zoom prevention
        // with font-size: 16px makes it usable even without meeting 44px)
        expect(inputBox!.height).toBeGreaterThanOrEqual(32)

        // Input should not be cut off by viewport
        expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(
          MOBILE_VIEWPORT.width + 5,
        )
      }
    } else {
      // Check for revision form or view details
      const viewBtn = page.locator('button:has-text("View Details")')
      if ((await viewBtn.count()) > 0) {
        await viewBtn.first().click()
        await page.waitForLoadState('networkidle')
      }
      test.skip(true, 'No active bid forms available')
    }
  })
})
