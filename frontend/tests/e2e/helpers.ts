import { type Page, expect } from '@playwright/test'

// ─── Test Account Credentials ─────────────────────────
export const ACCOUNTS = {
  admin: { email: 'admin@platform.local', password: 'Admin@Secure123' },
  buyer: { email: 'buyer1@platform.local', password: 'Buyer@Secure123' },
  supplier1: { email: 'supplier1@platform.local', password: 'Supplier@Secure1' },
  supplier2: { email: 'supplier2@platform.local', password: 'Supplier@Secure2' },
  supplier3: { email: 'supplier3@platform.local', password: 'Supplier@Secure3' },
} as const

export type AccountRole = keyof typeof ACCOUNTS

// ─── Login Helper ─────────────────────────────────────
export async function loginAs(page: Page, role: AccountRole) {
  const { email, password } = ACCOUNTS[role]

  await page.goto('/login')
  await page.waitForSelector('#login-email')

  await page.fill('#login-email', email)
  await page.fill('#login-password', password)
  await page.click('button[type="submit"]')

  // Wait for navigation away from login
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10_000,
  })
}

// ─── Logout Helper ────────────────────────────────────
export async function logout(page: Page) {
  await page.click('[aria-label="Sign out"]')
  await page.waitForURL('**/login')
}

// ─── Wait for API Response ────────────────────────────
export async function waitForApi(
  page: Page,
  urlPattern: string | RegExp,
  method = 'GET',
) {
  return page.waitForResponse(
    (res) =>
      (typeof urlPattern === 'string'
        ? res.url().includes(urlPattern)
        : urlPattern.test(res.url())) && res.request().method() === method,
    { timeout: 15_000 },
  )
}

// ─── Assert Toast Appeared ────────────────────────────
export async function expectToast(page: Page, textPattern: string | RegExp) {
  const toast = page.locator('[data-testid="toast"], [role="alert"]').filter({
    hasText: typeof textPattern === 'string' ? textPattern : undefined,
  })
  await expect(toast.first()).toBeVisible({ timeout: 5_000 })
}

// ─── Selectors ────────────────────────────────────────
export const SEL = {
  // Login
  emailInput: '#login-email',
  passwordInput: '#login-password',
  signInButton: 'button[type="submit"]',
  errorAlert: '[role="alert"]',

  // Sidebar navigation
  sidebarDesktop: '[data-sidebar]',
  mobileMenuButton: '[aria-label="Open navigation"]',
  mobileMenuClose: '[aria-label="Close navigation"]',
  signOutButton: '[aria-label="Sign out"]',

  // Wizard
  wizardContinueButton: 'button:has-text("Continue")',
  wizardBackButton: 'button:has-text("Back")',
  wizardSaveDraftButton: 'button:has-text("Save as Draft")',
  wizardPublishButton: 'button:has-text("Publish Enquiry")',

  // Supplier actions
  reviewAcceptButton: 'button:has-text("Review & Accept")',
  declineButton: 'button:has-text("Decline")',
  acceptParticipationButton: 'button:has-text("Accept Participation")',
  submitBidButton: 'button:has-text("Submit Bid")',
  submitRevisionButton: 'button:has-text("Submit Revision")',

  // Buyer actions
  publishConfirmButton: 'button:has-text("Publish")',
  closeEarlyButton: 'button:has-text("Close Early")',
  closeEnquiryConfirm: 'button:has-text("Close Enquiry")',

  // Common
  confirmDialogConfirm: '[data-testid="confirm-dialog-confirm"]',
} as const
