const fs = require('fs');
const path = require('path');

const missingFiles = [
  'ch02_expansion', 'ch03_simplifying_fractions', 'ch04_radical_expressions',
  'ch08_simultaneous_equations_part1', 'ch09_inequalities', 'ch10_straight_line',
  'ch11_quadratic_function_part4', 'ch12_sets', 'ch18_number_sequences',
  'ch22_matrices', 'ch24_polynomial_equations', 'ch25_percentage_part2',
  'ch26_ratio_proportion', 'ch27_rates', 'ch28_problem_solving',
  'ch29_financial_math', 'ch30_complex_numbers', 'ch31_complex_plane',
  'ch32_binomial_theorem'
];

console.log('=== 分析19个内容缺失文件 ===\n');

const results = {
  schemaIssue: [],   // 检测器不识别这些schema的内容字段
  reallyEmpty: [],   // 真的没内容
  partial: []        // 部分缺失
};

missingFiles.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extractions', file + '.json'), 'utf-8'));

  let structure = '';
  let items = [];

  if (data.subsections) {
    data.subsections.forEach(sub => {
      if (sub.items) {
        structure = 'subsections[].items[]';
        items.push(...sub.items);
      } else if (sub.content) {
        structure = 'subsections[].content[]';
        items.push(...sub.content);
      }
    });
  } else if (data.sections) {
    data.sections.forEach(sec => {
      if (sec.content) {
        structure = 'sections[].content[]';
        if (Array.isArray(sec.content)) {
          items.push(...sec.content);
        }
      }
    });
  } else if (data.items) {
    structure = 'items[]';
    items.push(...data.items);
  }

  // 统计内容情况
  let hasContentLatex = 0;
  let hasContent = 0;
  let hasLatex = 0;
  let empty = 0;

  items.forEach(item => {
    // Check various content fields
    const hasContentLatexField = item.content_latex && typeof item.content_latex === 'string' && item.content_latex.trim();
    const hasContentString = item.content && typeof item.content === 'string' && item.content.trim();
    const hasContentObject = item.content && typeof item.content === 'object'; // {definitions, formulas, etc}
    const hasLatexField = item.latex && (Array.isArray(item.latex) ? item.latex.length > 0 : (typeof item.latex === 'string' && item.latex.trim()));
    const hasTextField = item.text && typeof item.text === 'string' && item.text.trim();
    const hasProblem = item.problem && typeof item.problem === 'string' && item.problem.trim();
    const hasDescription = item.description && typeof item.description === 'string' && item.description.trim();
    const hasQuestions = item.questions && Array.isArray(item.questions) && item.questions.length > 0;
    const hasInstruction = item.instruction && typeof item.instruction === 'string' && item.instruction.trim();
    const hasFormulaLatex = item.formula_latex && typeof item.formula_latex === 'string' && item.formula_latex.trim();
    const hasTitle = item.title && typeof item.title === 'string' && item.title.trim();
    const hasParts = item.parts && Array.isArray(item.parts) && item.parts.length > 0;
    const hasSolution = item.solution && typeof item.solution === 'object';
    const hasSteps = item.steps && Array.isArray(item.steps) && item.steps.length > 0;
    const hasProblems = item.problems && Array.isArray(item.problems) && item.problems.length > 0;

    if (hasContentLatexField) hasContentLatex++;
    else if (hasContentString || hasContentObject || hasTextField || hasProblem || hasDescription ||
             hasQuestions || hasInstruction || hasFormulaLatex || hasParts || hasSolution || hasSteps || hasProblems) hasContent++;
    else if (hasLatexField) hasLatex++;
    else if (hasTitle) hasContent++;  // Title-only items still have some content
    else empty++;
  });

  const total = items.length;
  const filled = hasContentLatex + hasContent + hasLatex;

  console.log(`📄 ${file}`);
  console.log(`   结构: ${structure}`);
  console.log(`   总项: ${total}`);
  console.log(`   content_latex: ${hasContentLatex}, content: ${hasContent}, latex: ${hasLatex}, 空: ${empty}`);

  if (empty === 0) {
    console.log(`   ✅ 实际都有内容 (schema字段不同)`);
    results.schemaIssue.push(file);
  } else if (empty === total) {
    console.log(`   ❌ 全部为空`);
    results.reallyEmpty.push(file);
  } else {
    console.log(`   ⚠️ 部分为空 (${empty}/${total})`);
    results.partial.push({ file, empty, total });
  }
  console.log('');
});

console.log('=== 汇总 ===');
console.log(`Schema字段问题 (误报): ${results.schemaIssue.length}`);
console.log(`真正为空: ${results.reallyEmpty.length}`);
console.log(`部分为空: ${results.partial.length}`);

if (results.schemaIssue.length > 0) {
  console.log('\n误报文件 (使用 content/latex 而非 content_latex):');
  results.schemaIssue.forEach(f => console.log('  - ' + f));
}

if (results.partial.length > 0) {
  console.log('\n部分为空文件:');
  results.partial.forEach(p => console.log(`  - ${p.file}: ${p.empty}/${p.total} 空`));
}
