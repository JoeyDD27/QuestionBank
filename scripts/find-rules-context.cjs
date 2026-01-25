const fs = require('fs');
const xml = fs.readFileSync('docx_extracted/word/document.xml', 'utf-8');

// Find "Rules for square" and surrounding context
const idx = xml.indexOf('Rules for square');
if (idx !== -1) {
  // Get surrounding 2000 chars
  const start = Math.max(0, idx - 1000);
  const end = Math.min(xml.length, idx + 1000);
  const context = xml.substring(start, end);

  // Find nearest rId references
  const rIdMatches = context.match(/r:embed="rId\d+"/g);
  console.log('Context around "Rules for square":');
  console.log('  rIds nearby:', rIdMatches ? rIdMatches.join(', ') : 'none');

  // Extract text content
  const textMatches = context.match(/<w:t[^>]*>[^<]*<\/w:t>/g);
  if (textMatches) {
    const texts = textMatches.map(m => m.replace(/<[^>]+>/g, '')).filter(t => t.trim());
    console.log('  Texts nearby:', texts.join(' | '));
  }

  // Check position in document
  console.log('\n  Position in document:', idx, '/', xml.length);
  console.log('  Percent into document:', ((idx / xml.length) * 100).toFixed(1) + '%');
}
