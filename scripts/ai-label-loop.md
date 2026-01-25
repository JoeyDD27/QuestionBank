# AI 标注自动化循环

## 当前进度

```
已标注: 0/2609
剩余: 2609 题 (~105 批，每批 25 题)
状态: 验证阶段 - 51 题分层抽样待标注
```

## 方案文档

**Prompt 模板和字段定义**: `docs/labeling-schema-v2.md`

v2 要点：
- 废弃 level 字段（由 difficulty 自动推导）
- topics 灵活生成，后期二次加工统一
- question_type 扩展到 10 种（含 concept, application）
- 批量大小 25 题

## 验证批次

**文件**: `scripts/validation_batch.json` (51 题)

**覆盖范围**:
- 10 章节: Algebra, Functions, Quadratic function, Number sequences, Complex numbers, matrices, Financial mathematics, Venn diagrams, Problem solving with algebra, Reasoning and proof
- 5 类型: concept(10), definition(7), example(10), exercise(20), investigation(4)

**验证通过后**开始正式批量标注。

## 新 Session 启动

```
继续 Phase 2 Step 5 AI 标注。

检查进度: node scripts/ai-label-fetch.cjs --stats

循环逻辑:
1. node scripts/ai-label-fetch.cjs --batch-size=25 --output=/tmp/batch.json
2. 读取 /tmp/batch.json，用 Task tool (sonnet) 按 docs/labeling-schema-v2.md 的 prompt 标注
3. 将结果写入 /tmp/batch_result.json
4. node scripts/ai-label-save.cjs --input=/tmp/batch_result.json
5. 重复直到 unlabeled=0

重要：AI 返回的 id 可能是短格式，需要映射回完整 UUID。
```

## 检查命令

```bash
# 查看进度
node scripts/ai-label-fetch.cjs --stats

# 验证数据库
SELECT COUNT(*) FILTER (WHERE metadata->>'difficulty' IS NOT NULL) as labeled FROM questions;

# 检查 difficulty 分布
SELECT metadata->>'difficulty' as difficulty, COUNT(*)
FROM questions
WHERE metadata->>'difficulty' IS NOT NULL
GROUP BY 1 ORDER BY 1;

# 检查 topics 分布
SELECT jsonb_array_elements_text(metadata->'topics') as topic, COUNT(*)
FROM questions
WHERE metadata->'topics' IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

# 检查 question_type 分布
SELECT metadata->>'question_type' as qtype, COUNT(*)
FROM questions
WHERE metadata->>'question_type' IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC;
```
