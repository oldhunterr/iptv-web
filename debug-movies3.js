const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
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
  
  const html = await page.evaluate(() => document.body.innerText);
  console.log(html.substring(0, 1000));
  
  await browser.close();
})();
