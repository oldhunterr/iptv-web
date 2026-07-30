const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ defaultViewport: { width: 1280, height: 720 } });
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
  
  console.log("Waiting a bit...");
  await new Promise(r => setTimeout(r, 2000));

  console.log("Clicking Movies tab...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Movies'));
    if (btn) btn.click();
  });

  console.log("Waiting for grid to load...");
  await new Promise(r => setTimeout(r, 8000));
  
  console.log("Taking screenshot...");
  await page.screenshot({ path: 'C:\\Users\\Sayed Ali\\Desktop\\iptv web testing\\iptv-nextjs\\public\\docs\\debug-movies.png', fullPage: true });
  
  await browser.close();
  console.log("Done");
})();
