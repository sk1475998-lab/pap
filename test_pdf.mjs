
import { chromium } from '@playwright/test';

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<h1>Test</h1><p>Working</p>');
    await page.pdf({ path: 'test_render.pdf', format: 'A4' });
    await browser.close();
    console.log('Playwright test script executed successfully!');
}
main();
