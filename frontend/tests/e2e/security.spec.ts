import { test, expect } from '@playwright/test'
import { loginAs, ACCOUNTS, SEL } from './helpers'

/**
 * E2E-02: Security & Zero Data Leakage Tests
 *
 * Verifies:
 * - Role-based access control prevents unauthorized route access
 * - Unauthenticated users are redirected to login
 * - Failed login shows appropriate error
 * - Role-based redirects work correctly
 */

test.describe('E2E-02: Security & Zero Data Leakage', () => {
  test.describe('Unauthenticated access is blocked', () => {
    test('visiting /buyer redirects to /login', async ({ page }) => {
      await page.goto('/buyer')
      await expect(page).toHaveURL(/\/login/)
    })

    test('visiting /admin redirects to /login', async ({ page }) => {
      await page.goto('/admin')
      await expect(page).toHaveURL(/\/login/)
    })

    test('visiting /supplier redirects to /login', async ({ page }) => {
      await page.goto('/supplier')
      await expect(page).toHaveURL(/\/login/)
    })

    test('visiting /buyer/rfqs/new redirects to /login', async ({ page }) => {
      await page.goto('/buyer/rfqs/new')
      await expect(page).toHaveURL(/\/login/)
    })

    test('visiting /admin/users redirects to /login', async ({ page }) => {
      await page.goto('/admin/users')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('Cross-role access is blocked', () => {
    test('supplier cannot access /buyer routes', async ({ page }) => {
      await loginAs(page, 'supplier1')
      await expect(page).toHaveURL(/\/supplier/)

      // Try navigating to buyer route
      await page.goto('/buyer')
      await page.waitForTimeout(1000)

      // Should be redirected back to supplier dashboard (not buyer)
      const url = page.url()
      expect(url).not.toContain('/buyer')
      expect(url).toMatch(/\/(supplier|login)/)
    })

    test('supplier cannot access /admin routes', async ({ page }) => {
      await loginAs(page, 'supplier1')

      await page.goto('/admin')
      await page.waitForTimeout(1000)

      const url = page.url()
      expect(url).not.toContain('/admin')
      expect(url).toMatch(/\/(supplier|login)/)
    })

    test('buyer cannot access /admin routes', async ({ page }) => {
      await loginAs(page, 'buyer')

      await page.goto('/admin')
      await page.waitForTimeout(1000)

      const url = page.url()
      expect(url).not.toContain('/admin')
      expect(url).toMatch(/\/(buyer|login)/)
    })

    test('buyer cannot access /supplier routes', async ({ page }) => {
      await loginAs(page, 'buyer')

      await page.goto('/supplier')
      await page.waitForTimeout(1000)

      const url = page.url()
      expect(url).not.toContain('/supplier')
      expect(url).toMatch(/\/(buyer|login)/)
    })

    test('admin cannot access /buyer routes', async ({ page }) => {
      await loginAs(page, 'admin')

      await page.goto('/buyer')
      await page.waitForTimeout(1000)

      const url = page.url()
      expect(url).not.toContain('/buyer')
      expect(url).toMatch(/\/(admin|login)/)
    })

    test('admin cannot access /supplier routes', async ({ page }) => {
      await loginAs(page, 'admin')

      await page.goto('/supplier')
      await page.waitForTimeout(1000)

      const url = page.url()
      expect(url).not.toContain('/supplier')
      expect(url).toMatch(/\/(admin|login)/)
    })
  })

  test.describe('Login validation', () => {
    test('wrong password shows error message', async ({ page }) => {
      await page.goto('/login')

      await page.fill(SEL.emailInput, ACCOUNTS.buyer.email)
      await page.fill(SEL.passwordInput, 'WrongPassword123')
      await page.click(SEL.signInButton)

      // Error alert should appear
      await expect(page.locator(SEL.errorAlert)).toBeVisible({
        timeout: 5_000,
      })
      await expect(page.locator(SEL.errorAlert)).toContainText(
        /incorrect|invalid|wrong/i,
      )

      // Should still be on login page
      await expect(page).toHaveURL(/\/login/)
    })

    test('non-existent user shows error message', async ({ page }) => {
      await page.goto('/login')

      await page.fill(SEL.emailInput, 'nonexistent@example.com')
      await page.fill(SEL.passwordInput, 'SomePassword123')
      await page.click(SEL.signInButton)

      await expect(page.locator(SEL.errorAlert)).toBeVisible({
        timeout: 5_000,
      })

      // Should still be on login page
      await expect(page).toHaveURL(/\/login/)
    })

    test('empty form submission is prevented', async ({ page }) => {
      await page.goto('/login')

      // The form should have required attributes, preventing submission
      const emailRequired = await page
        .locator(SEL.emailInput)
        .getAttribute('required')
      const passwordRequired = await page
        .locator(SEL.passwordInput)
        .getAttribute('required')

      expect(emailRequired).not.toBeNull()
      expect(passwordRequired).not.toBeNull()
    })
  })

  test.describe('Role-based login redirects', () => {
    test('admin login redirects to /admin', async ({ page }) => {
      await loginAs(page, 'admin')
      await expect(page).toHaveURL(/\/admin/)
    })

    test('buyer login redirects to /buyer', async ({ page }) => {
      await loginAs(page, 'buyer')
      await expect(page).toHaveURL(/\/buyer/)
    })

    test('supplier login redirects to /supplier', async ({ page }) => {
      await loginAs(page, 'supplier1')
      await expect(page).toHaveURL(/\/supplier/)
    })
  })

  test.describe('Session and token security', () => {
    test('logout prevents access to protected routes', async ({ page }) => {
      // Login first
      await loginAs(page, 'buyer')
      await expect(page).toHaveURL(/\/buyer/)

      // Logout
      await page.locator('[data-sidebar]').locator(SEL.signOutButton).click()
      await expect(page).toHaveURL(/\/login/)

      // Try to access protected route
      await page.goto('/buyer')
      await expect(page).toHaveURL(/\/login/)
    })

    test('accessing root / redirects based on auth state', async ({
      page,
    }) => {
      // Not logged in — should go to login
      await page.goto('/')
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('404 handling', () => {
    test('unknown route shows 404 or redirects', async ({ page }) => {
      await page.goto('/nonexistent-route-xyz')
      await page.waitForTimeout(1000)

      // Should either show a 404 page or redirect to login
      const url = page.url()
      const has404 = await page
        .locator('text=404')
        .first()
        .isVisible()
        .catch(() => false)
      const hasNotFound = await page
        .locator('h1:has-text("not found")')
        .isVisible()
        .catch(() => false)
      const isOnLogin = url.includes('/login')

      expect(has404 || hasNotFound || isOnLogin).toBeTruthy()
    })
  })
})
