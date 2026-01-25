/**
 * 解析套题，拆分子题
 *
 * Usage: node scripts/parse-subquestions.cjs [--dry-run] [--limit=N]
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// Load .env file
function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          const value = trimmed.slice(eqIndex + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

loadEnv();

const supabase = createClient(
  'https://orfxntmcywouoqpasivm.supabase.co',
  process.env.SUPABASE_ANON_KEY
);

// 解析命令行参数
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitMatch = args.find(a => a.startsWith('--limit='));
const limit = limitMatch ? parseInt(limitMatch.split('=')[1]) : null;

// 最小长度阈值
const MIN_PROBLEM_SET_LENGTH = 1500;

/**
 * 判断是否为套题
 */
function isProblemSet(content) {
  if (content.length < MIN_PROBLEM_SET_LENGTH) return false;

  // 检查是否有套题标题
  const hasProblemSetTitle = /^(REVIEW SET|EXERCISE|Challenge Problems)/i.test(content);

  // 检查是否有多个主题号（至少3个不同的题号）
  const mainQuestions = content.match(/\n(\d+)\.\s+/g) || [];
  const uniqueNums = new Set(mainQuestions.map(m => m.match(/\d+/)[0]));
  const hasMultipleQuestions = uniqueNums.size >= 3;

  return hasProblemSetTitle || hasMultipleQuestions;
}

/**
 * 解析套题，提取子题
 */
function parseSubquestions(content) {
  const subquestions = [];

  // 提取标题（如果有）
  let title = '';
  const titleMatch = content.match(/^(REVIEW SET \w+|EXERCISE \w+|Challenge Problems)\n+/i);
  if (titleMatch) {
    title = titleMatch[1];
    content = content.slice(titleMatch[0].length);
  }

  // 按主题号分割 (1. 2. 3. 或 16.44 格式)
  const parts = content.split(/\n(?=\d+\.(?:\d+)?\s+)/);

  for (const part of parts) {
    if (!part.trim()) continue;

    // 提取主题号
    const mainMatch = part.match(/^(\d+(?:\.\d+)?)\.\s*/);
    if (!mainMatch) continue;

    const mainLabel = mainMatch[1];
    let mainContent = part.slice(mainMatch[0].length);

    // 移除 Solution/Answer 部分
    const solutionIndex = mainContent.search(/\n\s*(Solution|Answer)s?:?\s*\n/i);
    if (solutionIndex > 0) {
      mainContent = mainContent.slice(0, solutionIndex);
    }

    // 检查是否有子题 (a), (b), (c)
    const hasLetterSubs = /\n\s*\([a-z]\)\s+/i.test(mainContent);
    // 检查是否有 (i), (ii), (iii) 格式
    const hasRomanSubs = /\n\s*\([ivx]+\)\s+/i.test(mainContent);

    if (hasLetterSubs) {
      // 按 (a), (b), (c) 分割 - 这是主要的子题分割
      const subParts = mainContent.split(/\n(?=\s*\([a-z]\)\s+)/i);

      // 第一部分是共享题干（可能包含 (i), (ii) 指令）
      const context = subParts[0].trim() || null;

      for (let i = 1; i < subParts.length; i++) {
        const subPart = subParts[i];
        const subMatch = subPart.match(/^\s*\(([a-z])\)\s*/i);
        if (!subMatch) continue;

        const subLabel = subMatch[1].toLowerCase();
        let subContent = subPart.slice(subMatch[0].length).trim();

        subquestions.push({
          label: `${mainLabel}(${subLabel})`,
          context: context,
          content: subContent
        });
      }
    } else if (hasRomanSubs) {
      // 只有 (i), (ii), (iii)，没有 (a), (b)
      const subParts = mainContent.split(/\n(?=\s*\([ivx]+\)\s+)/i);
      const context = subParts[0].trim() || null;

      for (let i = 1; i < subParts.length; i++) {
        const subPart = subParts[i];
        const subMatch = subPart.match(/^\s*\(([ivx]+)\)\s*/i);
        if (!subMatch) continue;

        const subLabel = subMatch[1].toLowerCase();
        let subContent = subPart.slice(subMatch[0].length).trim();

        subquestions.push({
          label: `${mainLabel}(${subLabel})`,
          context: context,
          content: subContent
        });
      }
    } else {
      // 没有子题，整个作为一个子题
      subquestions.push({
        label: mainLabel,
        context: null,
        content: mainContent.trim()
      });
    }
  }

  return { title, subquestions };
}

/**
 * 分页获取所有 questions
 */
async function fetchAllQuestions() {
  const allQuestions = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, problem_latex')
      .range(offset, offset + pageSize - 1)
      .order('id');

    if (error) throw error;
    if (!data || data.length === 0) break;

    allQuestions.push(...data);
    offset += pageSize;

    if (data.length < pageSize) break;
  }

  return allQuestions;
}

/**
 * 主函数
 */
async function main() {
  console.log('=== 解析套题子题 ===\n');
  console.log(`模式: ${dryRun ? 'DRY RUN (不写入数据库)' : '正式运行'}`);
  if (limit) console.log(`限制: 处理前 ${limit} 个套题`);
  console.log('');

  // 获取所有 questions
  console.log('获取题目数据...');
  const questions = await fetchAllQuestions();
  console.log(`总题目数: ${questions.length}`);

  // 筛选套题
  const problemSets = questions.filter(q => isProblemSet(q.problem_latex));
  console.log(`识别为套题: ${problemSets.length}`);

  // 限制处理数量
  const toProcess = limit ? problemSets.slice(0, limit) : problemSets;
  console.log(`本次处理: ${toProcess.length}\n`);

  let totalSubquestions = 0;
  const results = [];

  for (const q of toProcess) {
    const { title, subquestions } = parseSubquestions(q.problem_latex);

    console.log(`[${q.id.slice(0, 8)}] ${title || '(EXERCISE 片段)'}`);
    console.log(`  内容长度: ${q.problem_latex.length}`);
    console.log(`  拆分子题: ${subquestions.length}`);

    if (subquestions.length > 0) {
      // 显示前3个子题
      for (let i = 0; i < Math.min(3, subquestions.length); i++) {
        const sq = subquestions[i];
        const preview = sq.content.slice(0, 50).replace(/\n/g, ' ');
        console.log(`    ${sq.label}: ${preview}...`);
      }
      if (subquestions.length > 3) {
        console.log(`    ... 还有 ${subquestions.length - 3} 个子题`);
      }
    }
    console.log('');

    totalSubquestions += subquestions.length;
    results.push({
      questionId: q.id,
      title,
      subquestions
    });
  }

  console.log('=== 统计 ===');
  console.log(`套题数: ${toProcess.length}`);
  console.log(`总子题数: ${totalSubquestions}`);
  console.log(`平均每套: ${(totalSubquestions / toProcess.length).toFixed(1)} 题`);

  if (dryRun) {
    console.log('\n[DRY RUN] 未写入数据库');
    return;
  }

  // 写入数据库
  console.log('\n=== 写入数据库 ===');

  for (const result of results) {
    const { questionId, subquestions } = result;

    if (subquestions.length === 0) continue;

    // 更新父题状态
    await supabase
      .from('questions')
      .update({
        is_problem_set: true,
        subquestion_count: subquestions.length
      })
      .eq('id', questionId);

    // 插入子题
    const subqRows = subquestions.map((sq, idx) => ({
      question_id: questionId,
      label: sq.label,
      context_latex: sq.context,
      content_latex: sq.content,
      order_index: idx + 1
    }));

    const { error: insertError } = await supabase
      .from('subquestions')
      .insert(subqRows);

    if (insertError) {
      console.error(`插入失败 [${questionId}]:`, insertError);
    } else {
      console.log(`✓ ${questionId.slice(0, 8)}: ${subquestions.length} 子题`);
    }
  }

  console.log('\n完成!');
}

main().catch(console.error);
