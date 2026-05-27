import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import path from 'path';

(async () => {
  console.log('Building...');
  const build = exec('npm run build');
  await new Promise(r => build.on('close', r));
  
  console.log('Starting preview...');
  const preview = exec('npm run preview -- --port 4173');
  
  // wait for preview server
  await new Promise(r => setTimeout(r, 2000));

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message, error.stack));

  console.log('Navigating...');
  await page.goto('http://localhost:4173');
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
  preview.kill();
  console.log('Done.');
})();
