const fs = require('fs');
const path = require('path');

const files = [
  { name: 'ch24_polynomial_equations', structure: 'sections' },
  { name: 'ch25_percentage_part2', structure: 'sections' },
  { name: 'ch29_financial_math', structure: 'subsections' },
  { name: 'ch30_complex_numbers', structure: 'sections' }
];

function hasContent(item) {
  return item.content_latex ||
    (item.content && typeof item.content === 'string') ||
    (item.content && typeof item.content === 'object') ||
    item.latex || item.text || item.problem || item.description ||
    (item.questions && item.questions.length > 0) ||
    item.instruction || item.formula_latex ||
    (item.parts && item.parts.length > 0) ||
    (item.solution && typeof item.solution === 'object') ||
    (item.steps && item.steps.length > 0) ||
    (item.problems && item.problems.length > 0) ||
    item.title;
}

console.log('=== 检查19个真正空的项目 ===\n');

let totalEmpty = 0;

files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extractions', file.name + '.json'), 'utf-8'));
  console.log('📄 ' + file.name);
  console.log('-'.repeat(50));

  const container = file.structure === 'sections' ? data.sections : data.subsections;

  container.forEach((sec, si) => {
    if (sec.content && Array.isArray(sec.content)) {
      sec.content.forEach((item, ii) => {
        if (!hasContent(item)) {
          totalEmpty++;
          const sectionName = sec.title || sec.section || `Section ${si}`;
          console.log(`\n[${sectionName}] Item #${ii}:`);
          console.log(JSON.stringify(item, null, 2));
        }
      });
    }
  });
  console.log('\n');
});

console.log('=== 总计: ' + totalEmpty + ' 个空项目 ===');
