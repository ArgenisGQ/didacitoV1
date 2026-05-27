import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => {
      console.log('PAGE ERROR MESSAGE:', error.message);
      console.log('PAGE ERROR STACK:', error.stack);
    });

    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
    
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
  } catch (e) {
    console.log("PUPPETEER EXCEPTION:", e);
  }
})();
