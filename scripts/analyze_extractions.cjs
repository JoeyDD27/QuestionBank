#!/usr/bin/env node
/**
 * Analyze extracted JSON files for quality and consistency
 * Usage: node scripts/analyze_extractions.js
 */

const fs = require('fs');
const path = require('path');

const EXTRACTIONS_DIR = path.join(__dirname, '..', 'extractions');

// Target schema based on database types
const TARGET_SCHEMA = {
  item_types: ['concept', 'example', 'exercise'],
  required_question_fields: ['problem_latex'],
  optional_question_fields: ['answer_latex', 'solution_steps', 'choices', 'label']
};

function analyzeFile(filePath) {
  const filename = path.basename(filePath);
  const rawContent = fs.readFileSync(filePath, 'utf-8');

  const analysis = {
    filename,
    fileSize: fs.statSync(filePath).size,
    schema: { type: 'unknown', topLevelKeys: [] },
    stats: {
      items: 0,
      questions: 0,
      questionsWithAnswer: 0,
      questionsWithoutAnswer: 0,
      concepts: 0,
      examples: 0,
      exercises: 0
    },
    issues: [],
    sampleContent: null
  };

  // Try to parse JSON
  let content;
  try {
    content = JSON.parse(rawContent);
  } catch (e) {
    analysis.issues.push(`JSON_PARSE_ERROR: ${e.message.split('\n')[0].substring(0, 60)}`);
    return analysis;
  }

  analysis.schema = detectSchema(content);

  // Analyze based on detected schema
  extractStats(content, analysis);

  // Check for issues
  checkIssues(content, analysis);

  // Get sample content for review
  analysis.sampleContent = getSampleContent(content);

  return analysis;
}

function detectSchema(content) {
  const keys = Object.keys(content);

  // Detect structure type - check more patterns
  if (content.subsections && Array.isArray(content.subsections)) {
    // Check if subsections have items or content
    const hasItems = content.subsections.some(s => s.items);
    const hasContent = content.subsections.some(s => s.content);
    if (hasItems) return { type: 'subsections_items', topLevelKeys: keys };
    if (hasContent) return { type: 'subsections_content', topLevelKeys: keys };
    return { type: 'subsections', topLevelKeys: keys };
  }
  if (content.sections && Array.isArray(content.sections)) {
    return { type: 'sections', topLevelKeys: keys };
  }
  if (content.extractions && Array.isArray(content.extractions)) {
    return { type: 'extractions', topLevelKeys: keys };
  }
  if (content.items && Array.isArray(content.items)) {
    return { type: 'items_flat', topLevelKeys: keys };
  }
  if (content.concepts || content.examples || content.exercises) {
    return { type: 'categorized', topLevelKeys: keys };
  }
  if (content.data && Array.isArray(content.data)) {
    return { type: 'data', topLevelKeys: keys };
  }

  return { type: 'unknown', topLevelKeys: keys };
}

function extractStats(content, analysis) {
  const stats = analysis.stats;

  // Handle different schemas
  if (content.subsections) {
    for (const subsection of content.subsections) {
      if (subsection.items) {
        processItems(subsection.items, stats);
      }
      if (subsection.content && Array.isArray(subsection.content)) {
        processContent(subsection.content, stats);
      }
    }
  } else if (content.sections) {
    for (const section of content.sections) {
      if (section.content && Array.isArray(section.content)) {
        processContent(section.content, stats);
      }
      if (section.subsections) {
        for (const sub of section.subsections) {
          if (sub.content) {
            stats.items++;
            if (sub.type) countType(sub.type, stats);
          }
        }
      }
      // Section itself might be an item
      if (section.type) {
        stats.items++;
        countType(section.type, stats);
      }
    }
  } else if (content.extractions) {
    for (const extraction of content.extractions) {
      stats.items++;
      if (extraction.type) {
        countType(extraction.type, stats);
      }
      if (extraction.content && Array.isArray(extraction.content)) {
        stats.questions += extraction.content.length;
        for (const item of extraction.content) {
          if (item.latex || item.answer || item.answer_latex) {
            stats.questionsWithAnswer++;
          } else {
            stats.questionsWithoutAnswer++;
          }
        }
      }
      if (extraction.questions) {
        processQuestions(extraction.questions, stats);
      }
    }
  } else if (content.items) {
    processItems(content.items, stats);
  } else if (content.concepts || content.examples || content.exercises) {
    if (content.concepts) {
      stats.concepts += content.concepts.length;
      stats.items += content.concepts.length;
    }
    if (content.examples) {
      stats.examples += content.examples.length;
      stats.items += content.examples.length;
      for (const ex of content.examples) {
        if (ex.questions) {
          processQuestions(ex.questions, stats);
        }
      }
    }
    if (content.exercises) {
      stats.exercises += content.exercises.length;
      stats.items += content.exercises.length;
      for (const ex of content.exercises) {
        if (ex.questions) {
          processQuestions(ex.questions, stats);
        }
      }
    }
  }
}

function processItems(items, stats) {
  for (const item of items) {
    stats.items++;
    if (item.type) {
      countType(item.type, stats);
    }
    if (item.questions && Array.isArray(item.questions)) {
      processQuestions(item.questions, stats);
    }
    // Some items have content_latex with embedded questions
    if (item.content_latex && !item.questions) {
      // Count as a single question
      stats.questions++;
      if (item.answer_latex || item.answer) {
        stats.questionsWithAnswer++;
      } else {
        stats.questionsWithoutAnswer++;
      }
    }
  }
}

function processContent(contentArr, stats) {
  for (const item of contentArr) {
    stats.items++;
    if (item.type) {
      countType(item.type, stats);
    }
    if (item.questions && Array.isArray(item.questions)) {
      processQuestions(item.questions, stats);
    }
    if (item.examples && Array.isArray(item.examples)) {
      for (const ex of item.examples) {
        stats.items++;
        stats.examples++;
      }
    }
  }
}

function processQuestions(questions, stats) {
  stats.questions += questions.length;
  for (const q of questions) {
    if (q.answer_latex || q.answer || q.solution) {
      stats.questionsWithAnswer++;
    } else {
      stats.questionsWithoutAnswer++;
    }
  }
}

function countType(type, stats) {
  const t = type.toLowerCase();
  if (t === 'concept' || t === 'definition') {
    stats.concepts++;
  } else if (t === 'example' || t === 'worked_example') {
    stats.examples++;
  } else if (t === 'exercise' || t === 'practice' || t === 'problem') {
    stats.exercises++;
  }
}

function checkIssues(content, analysis) {
  const issues = analysis.issues;

  // Check for empty content
  if (analysis.stats.items === 0) {
    issues.push('NO_ITEMS: File contains no items');
  }

  // Check answer rate
  const totalQ = analysis.stats.questions;
  const withAnswer = analysis.stats.questionsWithAnswer;
  if (totalQ > 0) {
    const answerRate = withAnswer / totalQ;
    if (answerRate < 0.3) {
      issues.push(`LOW_ANSWER_RATE: Only ${Math.round(answerRate * 100)}% of questions have answers`);
    }
  }

  // Check for missing chapter info
  if (!content.chapter && !content.section) {
    issues.push('NO_CHAPTER_INFO: Missing chapter identifier');
  }

  // Check for source_images references
  let hasSourceImages = false;
  JSON.stringify(content, (key, value) => {
    if (key === 'source_images' || key === 'source_image' || key === 'image') {
      hasSourceImages = true;
    }
    return value;
  });
  if (!hasSourceImages) {
    issues.push('NO_IMAGE_REFS: No source image references found');
  }

  // Check for LaTeX content
  const contentStr = JSON.stringify(content);
  if (!contentStr.includes('$') && !contentStr.includes('\\')) {
    issues.push('NO_LATEX: No LaTeX formatting detected');
  }
}

function getSampleContent(content) {
  // Get first item/question as sample
  if (content.subsections && content.subsections[0]?.items?.[0]) {
    return content.subsections[0].items[0];
  }
  if (content.extractions && content.extractions[0]) {
    return content.extractions[0];
  }
  if (content.items && content.items[0]) {
    return content.items[0];
  }
  if (content.concepts && content.concepts[0]) {
    return content.concepts[0];
  }
  if (content.examples && content.examples[0]) {
    return content.examples[0];
  }
  return null;
}

function generateReport(analyses) {
  let report = '# Extraction Quality Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `Total files: ${analyses.length}\n\n`;

  // Schema summary
  report += '## Schema Types\n\n';
  const schemaTypes = {};
  for (const a of analyses) {
    const t = a.schema.type;
    schemaTypes[t] = (schemaTypes[t] || 0) + 1;
  }
  report += '| Schema Type | Count |\n|-------------|-------|\n';
  for (const [type, count] of Object.entries(schemaTypes)) {
    report += `| ${type} | ${count} |\n`;
  }
  report += '\n';

  // Overall stats
  report += '## Overall Statistics\n\n';
  let totalItems = 0, totalQuestions = 0, totalWithAnswer = 0;
  for (const a of analyses) {
    totalItems += a.stats.items;
    totalQuestions += a.stats.questions;
    totalWithAnswer += a.stats.questionsWithAnswer;
  }
  report += `- Total items: ${totalItems}\n`;
  report += `- Total questions: ${totalQuestions}\n`;
  report += `- Questions with answers: ${totalWithAnswer} (${totalQuestions > 0 ? Math.round(totalWithAnswer / totalQuestions * 100) : 0}%)\n\n`;

  // Issues summary
  report += '## Files with Issues\n\n';
  const filesWithIssues = analyses.filter(a => a.issues.length > 0);
  if (filesWithIssues.length === 0) {
    report += 'No issues detected.\n\n';
  } else {
    report += `${filesWithIssues.length} files have issues:\n\n`;
    report += '| File | Issues |\n|------|--------|\n';
    for (const a of filesWithIssues) {
      report += `| ${a.filename} | ${a.issues.join(', ')} |\n`;
    }
    report += '\n';
  }

  // Quality classification
  report += '## Quality Classification\n\n';
  const good = [], medium = [], poor = [];
  for (const a of analyses) {
    const hasStructure = a.schema.type !== 'unknown';
    const hasContent = a.stats.items > 0;
    const hasAnswers = a.stats.questions === 0 || a.stats.questionsWithAnswer / a.stats.questions >= 0.3;
    const noMajorIssues = !a.issues.some(i => i.startsWith('NO_ITEMS') || i.startsWith('NO_LATEX'));

    if (hasStructure && hasContent && hasAnswers && noMajorIssues) {
      good.push(a);
    } else if (hasContent && !a.issues.some(i => i.startsWith('NO_ITEMS'))) {
      medium.push(a);
    } else {
      poor.push(a);
    }
  }

  report += `| Quality | Count | Action |\n|---------|-------|--------|\n`;
  report += `| ✅ Good | ${good.length} | Convert with script |\n`;
  report += `| ⚠️ Medium | ${medium.length} | Convert + review |\n`;
  report += `| ❌ Poor | ${poor.length} | Re-extract |\n`;
  report += '\n';

  if (poor.length > 0) {
    report += '### Files to Re-extract\n\n';
    for (const a of poor) {
      report += `- ${a.filename}: ${a.issues.join(', ')}\n`;
    }
    report += '\n';
  }

  // Detailed file analysis
  report += '## Detailed File Analysis\n\n';
  for (const a of analyses) {
    const quality = good.includes(a) ? '✅' : medium.includes(a) ? '⚠️' : '❌';
    report += `### ${quality} ${a.filename}\n\n`;
    report += `- Schema: ${a.schema.type}\n`;
    report += `- Size: ${(a.fileSize / 1024).toFixed(1)} KB\n`;
    report += `- Items: ${a.stats.items} (concepts: ${a.stats.concepts}, examples: ${a.stats.examples}, exercises: ${a.stats.exercises})\n`;
    report += `- Questions: ${a.stats.questions} (${a.stats.questionsWithAnswer} with answers)\n`;
    if (a.issues.length > 0) {
      report += `- Issues: ${a.issues.join(', ')}\n`;
    }
    report += '\n';
  }

  return report;
}

// Main
function main() {
  console.log('Analyzing extraction files...\n');

  const files = fs.readdirSync(EXTRACTIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(EXTRACTIONS_DIR, f));

  console.log(`Found ${files.length} JSON files\n`);

  const analyses = files.map(f => {
    console.log(`Analyzing ${path.basename(f)}...`);
    return analyzeFile(f);
  });

  const report = generateReport(analyses);

  const reportPath = path.join(__dirname, '..', 'extraction_quality_report.md');
  fs.writeFileSync(reportPath, report);

  console.log(`\nReport saved to: ${reportPath}`);

  // Print summary
  const issues = analyses.filter(a => a.issues.length > 0);
  console.log(`\nSummary:`);
  console.log(`- Total files: ${analyses.length}`);
  console.log(`- Files with issues: ${issues.length}`);
}

main();
