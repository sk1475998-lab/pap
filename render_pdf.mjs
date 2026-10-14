import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function render() {
    const htmlPath = path.resolve('SUPER_JOB_AGENT_CTO_ENTERPRISE_ARCHITECTURAL_AUDIT.html');
    const pdfPath = path.resolve('SUPER_JOB_AGENT_CTO_ENTERPRISE_ARCHITECTURAL_AUDIT.pdf');
    const pdfCopy = path.resolve('SuperJobAgent_v0.1.2', 'SUPER_JOB_AGENT_CTO_ENTERPRISE_ARCHITECTURAL_AUDIT.pdf');

    console.log('Launching Chromium to render PDF from:', htmlPath);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20mm',
            bottom: '20mm',
            left: '15mm',
            right: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 8pt; font-family: sans-serif; color: #64748b; width: 100%; text-align: right; padding-right: 15mm;">SUPER JOB AGENT — CTO ARCHITECTURAL AUDIT & ENTERPRISE BLUEPRINT</div>',
        footerTemplate: '<div style="font-size: 8pt; font-family: sans-serif; color: #64748b; width: 100%; text-align: center;">Confidential Enterprise Document • Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
    });
    
    await browser.close();
    console.log('Successfully generated PDF at:', pdfPath);
    
    fs.copyFileSync(pdfPath, pdfCopy);
    console.log('Successfully copied PDF to:', pdfCopy);
}

render().catch(err => {
    console.error('Failed to render PDF:', err);
    process.exit(1);
});
