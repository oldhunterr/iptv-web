const puppeteer = require('puppeteer');

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--start-fullscreen'] // This grants permission for Fullscreen API in automated Chrome
  });
  
  const page = await browser.newPage();
  // Bypass permissions if asked
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:3000', []);

  console.log("Navigating to app...");
  await page.goto('http://localhost:3000');
  
  // Login if needed
  try {
    await page.waitForSelector('input[placeholder*="Host"]', { timeout: 3000 });
    console.log("Logging in...");
    await page.type('input[placeholder*="Host"]', 'nvr.xcm9xplus.org:2052');
    await page.type('input[placeholder*="Username"]', '66764023');
    await page.type('input[placeholder*="Password"]', '13715132950979');
    await page.click('button[type="submit"]');
  } catch (e) {
    console.log("Already logged in or login failed");
  }

  console.log("Waiting for dashboard...");
  await page.waitForSelector('[data-testid="app-dashboard"]', { timeout: 15000 });

  console.log("Navigating to Live TV...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const liveBtn = buttons.find(b => b.textContent.includes('Live TV'));
    if (liveBtn) liveBtn.click();
  });

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // Wait for channels to load
  await wait(2000);
  
  console.log("Clicking a live channel...");
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div[data-testid*="catalog-item"]'));
    if (cards.length > 0) cards[1].click();
  });

  console.log("Waiting for video player...");
  await page.waitForSelector('button[data-testid="fullscreen-button"]', { timeout: 10000 });
  await wait(2000); // let stream load

  console.log("Clicking fullscreen...");
  // Click using native event to ensure it's a trusted user gesture
  await page.click('button[data-testid="fullscreen-button"]');
  
  await wait(1000);
  
  const isFullscreen = await page.evaluate(() => {
    return !!document.fullscreenElement || 
           !!document.webkitFullscreenElement ||
           (document.querySelector('video') && document.querySelector('video').webkitDisplayingFullscreen);
  });
  
  if (isFullscreen) {
    console.log("SUCCESS: Player went fullscreen!");
  } else {
    console.log("FAILED: Player did not go fullscreen. Checking console logs...");
    // Let's also check if the video element is full screen
  }
  
  await browser.close();
})();
