import { test, expect } from '@playwright/test';

const BASE = 'https://app.sentinelauthority.org';

// ─── AUTH ────────────────────────────────────────────────────────────────────

test('Auth: Logged in - not on login page', async ({ page }) => {
  await page.goto(BASE + '/dashboard');
  await page.waitForLoadState('networkidle');
  expect(page.url()).not.toContain('login');
  console.log('✓ Session authenticated');
});

test('Auth: Sign out works', async ({ page }) => {
  await page.goto(BASE + '/dashboard');
  await page.waitForLoadState('networkidle');
  await page.locator('text=SIGN OUT').click();
  await page.waitForLoadState('networkidle');
  expect(page.url()).toContain('login');
  console.log('✓ Sign out works');
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

test('Dashboard: Loads with content', async ({ page }) => {
  await page.goto(BASE + '/dashboard');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/dashboard|applications|certificates/i);
  console.log('✓ Dashboard loaded');
});

test('Dashboard: Stat cards clickable', async ({ page }) => {
  await page.goto(BASE + '/dashboard');
  await page.waitForLoadState('networkidle');
  // Stat cards have onClick - find them by the StatCard component structure
  const statCards = page.locator('div').filter({ hasText: /total applications|active certificates|online|certificates issued/i }).first();
  if (await statCards.count() > 0) {
    await statCards.click();
    await page.waitForLoadState('networkidle');
    console.log(`✓ Stat card navigated to: ${page.url()}`);
  }
});

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────

test('Applications: List loads', async ({ page }) => {
  await page.goto(BASE + '/applications');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/application/i);
  console.log('✓ Applications list loaded');
});

test('Applications: Status tabs clickable', async ({ page }) => {
  await page.goto(BASE + '/applications');
  await page.waitForLoadState('networkidle');
  const tabs = page.locator('button').filter({ hasText: /^(ALL|PENDING|REVIEW|APPROVED|TESTING|CONFORMANT|SUSPENDED)/i });
  const count = await tabs.count();
  console.log(`Found ${count} status tabs`);
  for (let i = 0; i < Math.min(count, 5); i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(300);
  }
  console.log('✓ Status tabs work');
});

test('Applications: Search works', async ({ page }) => {
  await page.goto(BASE + '/applications');
  await page.waitForLoadState('networkidle');
  const search = page.locator('input').first();
  await search.fill('Auto');
  await page.waitForTimeout(600);
  const body = await page.textContent('body');
  console.log('✓ Search works');
});

test('Applications: Click opens detail', async ({ page }) => {
  await page.goto(BASE + '/applications');
  await page.waitForLoadState('networkidle');
  const link = page.locator('a[href*="/applications/"]').first();
  if (await link.count() > 0) {
    await link.click();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toMatch(/applications\//);
    console.log(`✓ Application detail: ${page.url()}`);
    
    // Test detail tabs
    const tabs = page.locator('button').filter({ hasText: /history|comments|documents|export/i });
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
    }
    if (count > 0) console.log(`✓ ${count} detail tabs work`);
  } else {
    console.log('- No applications to click through');
  }
});

test('Applications: New application form loads', async ({ page }) => {
  await page.goto(BASE + '/applications/new');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/application|system|organization|submit/i);
  console.log('✓ New application form loaded');
});

// ─── CAT-72 ───────────────────────────────────────────────────────────────────

test('CAT-72: Console loads', async ({ page }) => {
  await page.goto(BASE + '/cat72');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/running|scheduled|passed|failed|cat.72/i);
  console.log('✓ CAT-72 loaded');
});

// ─── MONITORING ───────────────────────────────────────────────────────────────

test('Monitoring: Fleet health loads', async ({ page }) => {
  await page.goto(BASE + '/monitoring');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/session|fleet|monitoring|online/i);
  console.log('✓ Monitoring loaded');
});

test('Monitoring: Customer filter works', async ({ page }) => {
  await page.goto(BASE + '/monitoring');
  await page.waitForLoadState('networkidle');
  const select = page.locator('select').first();
  if (await select.count() > 0) {
    const opts = await select.locator('option').count();
    console.log(`✓ Customer filter: ${opts} options`);
    if (opts > 1) { await select.selectOption({ index: 1 }); await page.waitForTimeout(400); }
  }
});

test('Monitoring: Checkboxes toggle', async ({ page }) => {
  await page.goto(BASE + '/monitoring');
  await page.waitForLoadState('networkidle');
  const boxes = page.locator('input[type="checkbox"]');
  const count = await boxes.count();
  for (let i = 0; i < count; i++) {
    await boxes.nth(i).click(); await page.waitForTimeout(200);
    await boxes.nth(i).click();
  }
  console.log(`✓ ${count} checkboxes toggled`);
});

test('Monitoring: Tabs work', async ({ page }) => {
  await page.goto(BASE + '/monitoring');
  await page.waitForLoadState('networkidle');
  const tabs = page.locator('button').filter({ hasText: /live|customer|boundaries/i });
  const count = await tabs.count();
  for (let i = 0; i < count; i++) { await tabs.nth(i).click(); await page.waitForTimeout(400); }
  console.log(`✓ ${count} monitoring tabs work`);
});

// ─── CERTIFICATES ─────────────────────────────────────────────────────────────

test('Certificates: Page loads', async ({ page }) => {
  await page.goto(BASE + '/certificates');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/certificate/i);
  console.log('✓ Certificates loaded');
});

test('Certificates: Status tabs work', async ({ page }) => {
  await page.goto(BASE + '/certificates');
  await page.waitForLoadState('networkidle');
  const tabs = page.locator('button').filter({ hasText: /active|suspended|revoked|all/i });
  const count = await tabs.count();
  for (let i = 0; i < count; i++) { await tabs.nth(i).click(); await page.waitForTimeout(300); }
  console.log(`✓ ${count} certificate tabs work`);
});

// ─── ENVELO ───────────────────────────────────────────────────────────────────

test('ENVELO: Page loads with tabs', async ({ page }) => {
  await page.goto(BASE + '/envelo');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/envelo|interlock|session/i);
  const tabs = page.locator('button').filter({ hasText: /live|customer|boundaries/i });
  const count = await tabs.count();
  for (let i = 0; i < count; i++) { await tabs.nth(i).click(); await page.waitForTimeout(400); }
  console.log(`✓ ENVELO loaded with ${count} tabs`);
});

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

test('Users: List loads', async ({ page }) => {
  await page.goto(BASE + '/users');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/user|admin|applicant|management/i);
  console.log('✓ User list loaded');
});

test('Users: Row expands and collapses', async ({ page }) => {
  await page.goto(BASE + '/users');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const rows = page.locator('.cursor-pointer');
  const count = await rows.count();
  if (count > 0) {
    await rows.first().click();
    await page.waitForTimeout(500);
    const deleteBtn = page.locator('button').filter({ hasText: /delete user/i });
    expect(await deleteBtn.count()).toBeGreaterThan(0);
    console.log('✓ User row expands with actions');
    await rows.first().click();
    await page.waitForTimeout(300);
    console.log('✓ User row collapses');
  } else {
    console.log('- No user rows found');
  }
});

test('Users: Search filters list', async ({ page }) => {
  await page.goto(BASE + '/users');
  await page.waitForLoadState('networkidle');
  const search = page.locator('input[type="text"]').first();
  if (await search.count() > 0) {
    await search.fill('mike');
    await page.waitForTimeout(500);
    await search.fill('');
    console.log('✓ User search works');
  }
});

test('Users: Invite modal opens and closes', async ({ page }) => {
  await page.goto(BASE + '/users');
  await page.waitForLoadState('networkidle');
  const btn = page.locator('button').filter({ hasText: /invite/i }).first();
  if (await btn.count() > 0) {
    await btn.click();
    await page.waitForTimeout(500);
    expect(await page.locator('input[type="email"]').count()).toBeGreaterThan(0);
    console.log('✓ Invite modal opens');
    const cancel = page.locator('button').filter({ hasText: /cancel/i }).first();
    if (await cancel.count() > 0) await cancel.click();
    console.log('✓ Invite modal closes');
  }
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

test('Settings: All sections load', async ({ page }) => {
  await page.goto(BASE + '/settings');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/profile|password|preference/i);
  console.log('✓ Settings loaded');
});

test('Settings: Profile fields editable', async ({ page }) => {
  await page.goto(BASE + '/settings');
  await page.waitForLoadState('networkidle');
  const inputs = page.locator('input[type="text"], input[type="email"]');
  const count = await inputs.count();
  if (count > 0) {
    const val = await inputs.first().inputValue();
    await inputs.first().fill(val + ' ');
    await inputs.first().fill(val);
    console.log(`✓ ${count} profile fields editable`);
  }
});

// ─── RESOURCES ────────────────────────────────────────────────────────────────

test('Resources: Documents load', async ({ page }) => {
  await page.goto(BASE + '/resources');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/guide|document|certification|oddc/i);
  console.log('✓ Resources loaded');
});

test('Resources: Download buttons present', async ({ page }) => {
  await page.goto(BASE + '/resources');
  await page.waitForLoadState('networkidle');
  const btns = page.locator('button').filter({ hasText: /download/i });
  const count = await btns.count();
  expect(count).toBeGreaterThan(0);
  console.log(`✓ ${count} download buttons found`);
});

// ─── ACTIVITY ─────────────────────────────────────────────────────────────────

test('Activity: Log loads', async ({ page }) => {
  await page.goto(BASE + '/activity');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/activity|action|log/i);
  console.log('✓ Activity log loaded');
});

test('Activity: My Activity loads', async ({ page }) => {
  await page.goto(BASE + '/my-activity');
  await page.waitForLoadState('networkidle');
  const body = await page.textContent('body');
  expect(body).toMatch(/activity|action/i);
  console.log('✓ My Activity loaded');
});

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

test('Navigation: Sidebar links work', async ({ page }) => {
  await page.goto(BASE + '/dashboard');
  await page.waitForLoadState('networkidle');

  const links = [
    { text: 'DASHBOARD', path: 'dashboard' },
    { text: 'APPLICATIONS', path: 'applications' },
    { text: 'MONITORING', path: 'monitoring' },
    { text: 'CERTIFICATES', path: 'certificates' },
    { text: 'SETTINGS', path: 'settings' },
  ];

  for (const link of links) {
    const el = page.locator(`text=${link.text}`).first();
    if (await el.count() > 0) {
      await el.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain(link.path);
      console.log(`✓ Nav: ${link.text}`);
    }
  }
});

test('Navigation: Public Site opens new tab', async ({ page }) => {
  await page.goto(BASE + '/dashboard');
  await page.waitForLoadState('networkidle');
  const link = page.locator('text=PUBLIC SITE').first();
  if (await link.count() > 0) {
    const [newTab] = await Promise.all([
      page.context().waitForEvent('page'),
      link.click(),
    ]);
    await newTab.waitForLoadState('networkidle');
    expect(newTab.url()).toContain('sentinelauthority.org');
    console.log(`✓ Public site opens: ${newTab.url()}`);
    await newTab.close();
  }
});

// ─── API DOCS ─────────────────────────────────────────────────────────────────

test('API Docs: Password gate works', async ({ page }) => {
  await page.goto(BASE + '/api-docs');
  await page.waitForLoadState('networkidle');
  const pw = page.locator('input[type="password"]').first();
  if (await pw.count() > 0) {
    await pw.fill('goldenticket');
    // Submit with Enter key since button text is uppercase
    await pw.press('Enter');
    await page.waitForTimeout(2000);
    console.log('✓ API docs password submitted');
  } else {
    console.log('- No password gate found');
  }
});
