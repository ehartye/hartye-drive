import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [, , src, dest] = process.argv;
const data = new Uint8Array(fs.readFileSync(src));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

const out = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  let lastY = null;
  let line = [];
  const lines = [];
  for (const item of content.items) {
    if (!item.str) continue;
    const y = Math.round(item.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      lines.push(line.join('').replace(/\s+/g, ' ').trim());
      line = [];
    }
    line.push(item.str + (item.hasEOL ? ' ' : ''));
    lastY = y;
  }
  lines.push(line.join('').replace(/\s+/g, ' ').trim());
  out.push(`\n\n===== PAGE ${i} =====\n` + lines.filter(Boolean).join('\n'));
}
fs.writeFileSync(dest, out.join('\n'), 'utf8');
console.log(`pages=${doc.numPages} chars=${out.join('').length}`);
