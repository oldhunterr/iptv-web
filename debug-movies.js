const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));
  page.on('requestfailed', request => {
    console.error('REQUEST FAILED:', request.url(), request.failure()?.errorText);
  });
  page.on('response', response => {
    if (response.url().includes('/api/proxy/player_api') && !response.ok()) {
      console.error('API FAILED:', response.url(), response.status());
    }
  });

  await page.goto('http://localhost:3000');
  
  try {
    await page.waitForSelector('input[placeholder*="Host"]', { timeout: 3000 });
    await page.type('input[placeholder*="Host"]', 'nvr.xcm9xplus.org:2052');
    await page.type('input[placeholder*="Username"]', '66764023');
    await page.type('input[placeholder*="Password"]', '13715132950979');
    await page.click('button[type="submit"]');
  } catch(e) {}

  await page.waitForSelector('[data-testid="app-dashboard"]', { timeout: 10000 });
  
  console.log("Clicking Movies tab...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Movies'));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 5000));
  
  const movieCount = await page.evaluate(() => {
    const cards = document.querySelectorAll('div[data-testid*="catalog-item"]');
    return cards.length;
  });
  
  console.log("Movies found on page:", movieCount);
  await browser.close();
})();
