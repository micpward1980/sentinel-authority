import { chromium } from '@playwright/test';

export default async function globalSetup() {
  const browser = await chromium.launch({ headless: false }); // headed so we can debug
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://app.sentinelauthority.org/');
  await page.waitForLoadState('networkidle');
  
  // Fill form
  const inputs = page.locator('input');
  await inputs.nth(0).fill('info@sentinelauthority.org');
  await inputs.nth(1).fill('Swsales1980!');
  await page.locator('button').first().click();
  
  // Wait until we leave the login page
  await page.waitForURL(url => !url.toString().includes('login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Check localStorage for token
  const token = await page.evaluate(() => {
    return Object.entries(localStorage).map(([k,v]) => `${k}=${v.substring(0,30)}`).join(', ');
  });
  console.log('localStorage keys:', token);
  console.log('Current URL after login:', page.url());
  
  // Save full state including localStorage
  await context.storageState({ path: 'tests/.auth.json' });
  const size = require('fs').statSync('tests/.auth.json').size;
  console.log(`✓ Auth saved (${size} bytes)`);
  
  await browser.close();
}
