#!/usr/bin/env node
/**
 * Step 0: 扫描所有JSON文件，检测星号污染和内容缺失
 */

const fs = require('fs');
const path = require('path');

const EXTRACTIONS_DIR = path.join(__dirname, '..', 'extractions');

// 检测星号模式
const ASTERISK_PATTERN = /\*\*[^*]+\*\*/;

// 结果统计
const results = {
  total: 0,
  withAsterisk: [],
  withMissingContent: [],
  jsonError: [],
  details: {}
};

// 递归检查对象中的字符串
function checkForAsterisk(obj, path = '') {
  if (typeof obj === 'string') {
    return ASTERISK_PATTERN.test(obj);
  }
  if (Array.isArray(obj)) {
    return obj.some((item, i) => checkForAsterisk(item, `${path}[${i}]`));
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).some(([key, value]) =>
      checkForAsterisk(value, `${path}.${key}`)
    );
  }
  return false;
}

// 检查内容缺失
function checkContentMissing(data) {
  const missing = [];

  // 检查items
  if (data.items) {
    data.items.forEach((item, i) => {
      if (!item.content_latex || item.content_latex.trim() === '') {
        missing.push({ type: 'item', index: i, title: item.title || `Item ${i}` });
      }
    });
  }

  // 检查subsections
  if (data.subsections) {
    data.subsections.forEach((sub, i) => {
      if (sub.items) {
        sub.items.forEach((item, j) => {
          if (!item.content_latex || item.content_latex.trim() === '') {
            missing.push({
              type: 'subsection_item',
              subsection: sub.title || `Subsection ${i}`,
              index: j,
              title: item.title || `Item ${j}`
            });
          }
        });
      }
      if (sub.content) {
        sub.content.forEach((item, j) => {
          if (!item.content_latex && !item.latex && !item.text) {
            missing.push({
              type: 'subsection_content',
              subsection: sub.title || `Subsection ${i}`,
              index: j
            });
          }
        });
      }
    });
  }

  // 检查sections
  if (data.sections) {
    data.sections.forEach((sec, i) => {
      if (sec.content) {
        sec.content.forEach((item, j) => {
          if (!item.content_latex && !item.latex && !item.text) {
            missing.push({
              type: 'section_content',
              section: sec.title || `Section ${i}`,
              index: j
            });
          }
        });
      }
    });
  }

  return missing;
}

// 扫描所有文件
const files = fs.readdirSync(EXTRACTIONS_DIR)
  .filter(f => f.endsWith('.json'))
  .sort();

console.log(`扫描 ${files.length} 个JSON文件...\n`);

files.forEach(file => {
  results.total++;
  const filePath = path.join(EXTRACTIONS_DIR, file);
  const baseName = file.replace('.json', '');

  results.details[baseName] = {
    hasAsterisk: false,
    missingContent: [],
    jsonError: false
  };

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // 检查星号
    if (checkForAsterisk(data)) {
      results.withAsterisk.push(baseName);
      results.details[baseName].hasAsterisk = true;
    }

    // 检查内容缺失
    const missing = checkContentMissing(data);
    if (missing.length > 0) {
      results.withMissingContent.push(baseName);
      results.details[baseName].missingContent = missing;
    }

  } catch (e) {
    if (e instanceof SyntaxError) {
      results.jsonError.push(baseName);
      results.details[baseName].jsonError = true;
    } else {
      console.error(`Error reading ${file}:`, e.message);
    }
  }
});

// 输出结果
console.log('='.repeat(60));
console.log('扫描结果');
console.log('='.repeat(60));

console.log(`\n总文件数: ${results.total}`);
console.log(`有星号污染: ${results.withAsterisk.length}`);
console.log(`有内容缺失: ${results.withMissingContent.length}`);
console.log(`JSON错误: ${results.jsonError.length}`);

if (results.withAsterisk.length > 0) {
  console.log(`\n--- 星号污染文件 (${results.withAsterisk.length}) ---`);
  results.withAsterisk.forEach(f => console.log(`  - ${f}`));
}

if (results.withMissingContent.length > 0) {
  console.log(`\n--- 内容缺失文件 (${results.withMissingContent.length}) ---`);
  results.withMissingContent.forEach(f => {
    const detail = results.details[f];
    console.log(`  - ${f}: ${detail.missingContent.length}项缺失`);
  });
}

if (results.jsonError.length > 0) {
  console.log(`\n--- JSON错误文件 (${results.jsonError.length}) ---`);
  results.jsonError.forEach(f => console.log(`  - ${f}`));
}

// 输出状态表更新数据
console.log('\n' + '='.repeat(60));
console.log('状态表更新数据 (Markdown格式)');
console.log('='.repeat(60) + '\n');

files.forEach(file => {
  const baseName = file.replace('.json', '');
  const detail = results.details[baseName];

  let asteriskStatus = detail.jsonError ? '-' : (detail.hasAsterisk ? '⚠️有' : '✅无');
  let contentStatus = detail.jsonError ? '-' : (detail.missingContent.length > 0 ? `⚠️${detail.missingContent.length}项` : '✅');
  let overallStatus = detail.jsonError ? '❌ JSON_ERROR' :
                      (detail.hasAsterisk || detail.missingContent.length > 0) ? '⚠️ WARN' : '✅ PASS';

  console.log(`| ${baseName} | ${asteriskStatus} | ${contentStatus} | ${overallStatus} |`);
});

// 保存详细结果到JSON
const outputPath = path.join(__dirname, '..', 'format_scan_results.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n详细结果已保存到: format_scan_results.json`);
