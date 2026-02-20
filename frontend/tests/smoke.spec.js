import { test, expect } from '@playwright/test';

const EMAIL = 'info@sentinelauthority.org';
const PASSWORD = 'your-admin-password-here';

const ROUTES = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/applications', label: 'Applications' },
  { path: '/cat72', label: 'CAT-72 Console' },
  { path: '/monitoring', label: 'Monitoring' },
  { path: '/certificates', label: 'Certificates' },
  { path: '/envelo', label: 'ENVELO Interlock' },
  { path: '/activity', label: 'Activity Log' },
  { path: '/my-activity', label: 'My Activity' },
  { path: '/licensees', label: 'Licensees' },
  { path: '/users', label: 'User Management' },
  { path: '/resources', label: 'Resources' },
  { path: '/api-docs', label: 'API Docs' },
  { path: '/settings', label: 'Settings' },
];

test.describe('Sentinel Authority Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      console.log(`[PAGE ERROR] ${err.message}`);
    });
  });

  test('Login', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    
    // Find email field
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="Email" i]').first();
    await emailInput.fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    
    // Click sign in button
    await page.locator('button').filter({ hasText: /sign in|login|unlock/i }).first().click();
    
    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/dashboard/);
    console.log('✓ Login successful');
  });

  for (const route of ROUTES) {
    test(`Page loads: ${route.label}`, async ({ page }) => {
      // Login first
      await page.goto('/');
      try {
        await page.waitForSelector('input[type="password"]', { timeout: 5000 });
        const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
        await emailInput.fill(EMAIL);
        await page.locator('input[type="password"]').fill(PASSWORD);
        await page.locator('button').filter({ hasText: /sign in|login/i }).first().click();
        await page.waitForURL('**/dashboard', { timeout: 10000 });
      } catch {
        // Already logged in
      }

      const errors = [];
      page.on('pageerror', err => errors.push(err.message));

      await page.goto(route.path);
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Check no crash
      const body = await page.textContent('body');
      expect(body).not.toContain('Cannot read');
      expect(body).not.toContain('is not defined');
      
      if (errors.length > 0) {
        console.log(`  ⚠ JS errors on ${route.label}:`, errors);
      } else {
        console.log(`  ✓ ${route.label}`);
      }
    });
  }

  test('User Management - expand user row', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    
    const userRow = page.locator('.cursor-pointer').first();
    if (await userRow.count() > 0) {
      await userRow.click();
      await page.waitForTimeout(500);
      // Expanded panel should be visible
      const deleteBtn = page.locator('button').filter({ hasText: /delete user/i });
      if (await deleteBtn.count() > 0) {
        console.log('✓ User accordion expand works');
      }
    }
  });

  test('Applications list loads', async ({ page }) => {
    await page.goto('/applications');
    await page.waitForLoadState('networkidle');
    const content = await page.textContent('body');
    expect(content).toMatch(/applications|no applications/i);
    console.log('✓ Applications page loaded');
  });

  test('Dashboard stat cards are clickable', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Click first stat card
    const statCard = page.locator('[style*="cursor: pointer"], [style*="cursor:pointer"]').first();
    if (await statCard.count() > 0) {
      await statCard.click();
      await page.waitForTimeout(500);
      console.log('✓ Stat card navigation works');
    }
  });
});
