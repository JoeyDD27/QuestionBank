# Phase 2 设计文档：多维度分类系统

> 版本：v0.2 (2026-01-20)
> 状态：方案确定

## 背景

### 老师反馈需求

老师希望题库支持以下维度筛选和组题：

1. 按知识点分类
2. 按难易度分类
3. 按年级分类
4. 按题型分类
5. 专项组题
6. 按易错点、难点组题
7. 组试卷（测试卷、单元测试卷、学初/学末卷）
8. 按技能分类（基础计算、逻辑思维、实际应用）
9. 按考试分类（Cambridge、竞赛、NCEA 等）

### 需求覆盖度

| 老师需求 | 方案字段 | 覆盖 |
|---------|----------|------|
| 按知识点分类 | `topics` + `ib_topics` + `chapters` | ✅ |
| 按难易度分类 | `difficulty` + `level` | ✅ |
| 按年级分类 | `grade_levels` + `level` | ✅ |
| 按题型分类 | `question_type` + `items.type` | ✅ |
| 专项组题 | 多字段组合筛选 | ✅ |
| 易错点/难点 | `flags` + `pitfalls` | ✅ |
| 组试卷 | Phase 3 前端功能 | ✅ |
| 按技能分类 | `skills` | ✅ |
| 按考试分类 | `exam_types` | ✅ |

### 当前数据概况

| 指标 | 数量 |
|------|------|
| 章节 (chapters) | 33 |
| 题目 (items) | 2609 |
| 图片 (images) | 2952 |

**题目类型分布 (items.type)：**

| type | 数量 | 说明 |
|------|------|------|
| exercise | 1279 | 练习题 |
| example | 712 | 带解答的示例题 |
| concept | 558 | 概念讲解 |
| definition | 34 | 定义 |
| investigation | 26 | 探究活动 |

**题目来源：**

- 主体 (~95%)：Haese Mathematics IB 教材
- 补充 (~5%)：AoPS (Art of Problem Solving) 竞赛书
  - 竞赛题来源：AMC (12), AHSME (7), Mandelbrot (6), HMMT (5), ARML (3)
  - 带 ★ 星号难题：23 题
  - 带 Hints 提示：25 题

**题目内容特征：**

| 特征 | 数量 | 占比 |
|------|------|------|
| 纯数学题 | 1745 | 67% |
| 金融/货币相关 | 276 | 11% |
| 几何图形 | 260 | 10% |
| 文字应用题 | 137 | 5% |
| 时间相关 | 127 | 5% |
| 距离相关 | 64 | 2% |
| 有图形描述 | 854 | 33% |

---

## 层级结构分析

### 现有结构

```
chapters (33个，按主题分)
    └── items (2609个)
```

### 发现的问题

1. **章节过大**：部分章节超过 200 items
2. **内容混杂**：一个章节混合了原书多个章节的内容
3. **原书 Section 信息丢失**：Exercise 编号 (如 2A, 8B) 未被利用

**原书结构示例：**

```
Haese 原书 Chapter 2 (Algebra)
├── Section A → EXERCISE 2A
├── Section B → EXERCISE 2B
├── Section C → EXERCISE 2C
└── REVIEW SET 2A, 2B
```

**我们的章节与原书对应关系：**

| 我们的章节 | Items | 混合了原书章节 |
|-----------|-------|---------------|
| Algebra | 203 | Ch2, Ch8 |
| Solving equations | 98 | Ch1, 4, 6, 11, 16, 19 |
| The binomial theorem | 98 | Ch1, 8, 9, 10 |
| Quadratic function | 188 | Ch2, 19, 20 |

### 采用方案：混合方案

**保持现有结构 + metadata 存储原书信息 + 前端虚拟展示**

```
现有结构不变：
chapters (33个，按主题分)
    └── items (2609个)
            └── metadata: { exercise_id, original_chapter, ... }

前端支持两种视图：
1. 按主题浏览（用现有 chapters）
2. 按原书章节浏览（用 metadata.exercise_id 分组）
```

**选择理由：**

1. 按主题分类是老师需要的
2. 原书 section 可通过 metadata 恢复
3. 不改表结构，风险小
4. 保持灵活性

---

## 设计原则

1. **可扩展性** - 用 JSONB 存储标签，未来新增维度无需改表结构
2. **标准化** - 建立标签词汇表，确保标签一致性和可维护性
3. **对齐 IB 大纲** - 使用官方 topic 编号 + 人话关键词双重标识
4. **规则 + AI 混合** - 能规则提取的先规则，AI 只补充无法自动判断的字段
5. **多语言支持** - 标签支持中英文显示

---

## Schema 设计

### 1. 题目元数据字段

```sql
-- 在 questions 表添加 metadata 字段
ALTER TABLE questions ADD COLUMN metadata JSONB DEFAULT '{}';

-- GIN 索引支持高效查询
CREATE INDEX idx_questions_metadata ON questions USING GIN (metadata);
```

### 2. metadata 结构

```json
{
  // === 原书信息 ===
  "original_chapter": 8,
  "original_section": "A",
  "exercise_id": "8A",
  "exercise_type": "exercise",

  // === 难度 ===
  "difficulty": 3,
  "level": "intermediate",

  // === 知识点 ===
  "ib_topics": ["1.2", "1.3"],
  "topics": ["等差数列", "等比数列", "arithmetic_sequence", "geometric_sequence"],

  // === 题型 ===
  "question_type": "calculation",

  // === 技能 ===
  "skills": ["calculation", "algebraic_manipulation"],

  // === 考试适用 ===
  "exam_types": ["IB_AA_SL", "Cambridge_IGCSE"],
  "grade_levels": ["Year_10", "Year_11"],

  // === 应用场景 ===
  "contexts": ["pure_math"],

  // === 特殊标记 ===
  "flags": ["common_mistake", "has_solution"],
  "pitfalls": ["sign_error"],

  // === 题目特征 ===
  "has_diagram": true,
  "sub_question_count": 6,

  // === 竞赛来源 ===
  "source": {
    "competition": "AMC 12",
    "year": 2020
  }
}
```

### 3. 标签词汇表

```sql
CREATE TABLE tag_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,        -- 标签类别
  code TEXT NOT NULL,            -- 标签代码
  label_en TEXT NOT NULL,        -- 英文名称
  label_zh TEXT,                 -- 中文名称
  parent_code TEXT,              -- 父级代码（支持层级）
  level_sl BOOLEAN DEFAULT true, -- IB SL 是否包含
  level_hl BOOLEAN DEFAULT true, -- IB HL 是否包含
  description TEXT,              -- 详细说明
  sort_order INT DEFAULT 0,      -- 排序
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, code)
);
```

### 4. 章节与 IB Topic 映射

```sql
CREATE TABLE chapter_topic_mapping (
  chapter_id UUID REFERENCES chapters(id),
  ib_topic_code TEXT,
  PRIMARY KEY (chapter_id, ib_topic_code)
);
```

---

## 标签词汇表定义

### difficulty (难度等级)

| code | label_en | label_zh | 说明 |
|------|----------|----------|------|
| 1 | Basic | 基础 | 定义理解、直接代入 |
| 2 | Easy | 简单 | 单步运算、简单变换 |
| 3 | Medium | 中等 | 多步骤、需要技巧 |
| 4 | Hard | 较难 | 综合应用、Challenge 级 |
| 5 | Competition | 竞赛 | 竞赛级 (AMC/HMMT 等) |

### level (通用难度) - 新增

| code | label_en | label_zh | 对应 difficulty |
|------|----------|----------|-----------------|
| beginner | Beginner | 入门 | 1-2 |
| intermediate | Intermediate | 中级 | 2-3 |
| advanced | Advanced | 进阶 | 3-4 |
| competition | Competition | 竞赛 | 4-5 |

### question_type (题型) - 新增

| code | label_en | label_zh | 说明 |
|------|----------|----------|------|
| calculation | Calculation | 计算题 | 求值、数值运算 |
| simplification | Simplification | 化简题 | 代数化简 |
| equation_solving | Equation solving | 解方程 | 求解方程/不等式 |
| proof | Proof | 证明题 | 数学证明 |
| application | Application | 应用题 | 实际问题/文字题 |
| graphing | Graphing | 作图题 | 画图、图像分析 |
| fill_blank | Fill in blank | 填空题 | 补全答案 |
| explain | Explain | 解释题 | 说明理由 |
| multi_part | Multi-part | 综合题 | 多问大题 |
| true_false | True/False | 判断题 | 判断对错 |

### skill (技能)

| code | label_en | label_zh | 说明 |
|------|----------|----------|------|
| calculation | Calculation | 计算能力 | 数值运算、代数计算 |
| algebraic_manipulation | Algebraic manipulation | 代数变换 | 展开、因式分解、化简 |
| reasoning | Logical reasoning | 逻辑推理 | 演绎推理、分析 |
| problem_solving | Problem solving | 综合解题 | 多知识点综合 |
| exploration | Exploration | 探究发现 | Investigation 类 |
| proof | Proof | 证明 | 数学证明 |
| modeling | Modeling | 建模应用 | 实际问题建模 |
| graphing | Graphing | 图像分析 | 函数图像、几何图形 |

### ib_topic (IB 数学大纲 Topic)

**Topic 1: Number & Algebra**

| code | label_en | label_zh | SL | HL |
|------|----------|----------|----|----|
| 1 | Number & Algebra | 数与代数 | ✓ | ✓ |
| 1.1 | Scientific notation | 科学记数法 | ✓ | ✓ |
| 1.2 | Arithmetic sequences | 等差数列 | ✓ | ✓ |
| 1.3 | Geometric sequences | 等比数列 | ✓ | ✓ |
| 1.4 | Financial applications | 金融应用 | ✓ | ✓ |
| 1.5 | Logarithms intro | 对数入门 | ✓ | ✓ |
| 1.6 | Proofs | 证明 | ✓ | ✓ |
| 1.7 | Laws of exponents | 指数定律 | ✓ | ✓ |
| 1.8 | Sum of infinite geometric series | 无穷等比级数 | ✓ | ✓ |
| 1.9 | Binomial theorem | 二项式定理 | ✓ | ✓ |
| 1.10 | Counting principles | 计数原理 | - | ✓ |
| 1.11 | Partial fractions | 部分分式 | - | ✓ |
| 1.12 | Complex numbers | 复数 | - | ✓ |
| 1.13 | Polar & Euler forms | 极坐标与欧拉形式 | - | ✓ |
| 1.14 | Matrices | 矩阵 | - | ✓ |
| 1.15 | Eigenvalues | 特征值 | - | ✓ |

**Topic 2: Functions**

| code | label_en | label_zh | SL | HL |
|------|----------|----------|----|----|
| 2 | Functions | 函数 | ✓ | ✓ |
| 2.1 | Linear functions | 一次函数 | ✓ | ✓ |
| 2.2 | Quadratic functions | 二次函数 | ✓ | ✓ |
| 2.3 | Transformations | 函数变换 | ✓ | ✓ |
| 2.4 | Composite functions | 复合函数 | ✓ | ✓ |
| 2.5 | Exponential functions | 指数函数 | ✓ | ✓ |
| 2.6 | Logarithmic functions | 对数函数 | ✓ | ✓ |
| 2.7 | Polynomial functions | 多项式函数 | - | ✓ |
| 2.8 | Rational functions | 有理函数 | - | ✓ |
| 2.9 | Odd and even functions | 奇偶函数 | - | ✓ |

**Topic 3: Geometry & Trigonometry**

| code | label_en | label_zh | SL | HL |
|------|----------|----------|----|----|
| 3 | Geometry & Trigonometry | 几何与三角 | ✓ | ✓ |
| 3.1 | Distance and midpoint | 距离与中点 | ✓ | ✓ |
| 3.2 | Circle geometry | 圆的几何 | ✓ | ✓ |
| 3.3 | Trigonometric ratios | 三角比 | ✓ | ✓ |
| 3.4 | Trigonometric identities | 三角恒等式 | ✓ | ✓ |
| 3.5 | Trigonometric equations | 三角方程 | ✓ | ✓ |

**Topic 4: Statistics & Probability** (当前题库暂未覆盖)

**Topic 5: Calculus** (当前题库暂未覆盖)

### topics (知识点关键词) - 新增

AI 从题目内容提取的人话关键词，中英文双语：

| code | label_zh |
|------|----------|
| negative_exponents | 负指数 |
| zero_exponent | 零指数 |
| exponent_laws | 指数定律 |
| factorization | 因式分解 |
| expanding_brackets | 展开括号 |
| difference_of_squares | 平方差 |
| perfect_square | 完全平方 |
| completing_the_square | 配方法 |
| quadratic_formula | 求根公式 |
| discriminant | 判别式 |
| simultaneous_equations | 联立方程 |
| substitution_method | 代入法 |
| elimination_method | 消元法 |
| linear_inequality | 一次不等式 |
| quadratic_inequality | 二次不等式 |
| arithmetic_sequence | 等差数列 |
| geometric_sequence | 等比数列 |
| compound_interest | 复利 |
| depreciation | 折旧 |
| logarithm_laws | 对数法则 |
| function_notation | 函数记号 |
| domain_range | 定义域与值域 |
| inverse_function | 反函数 |
| composite_function | 复合函数 |
| vertical_horizontal_shift | 平移变换 |
| reflection | 反射变换 |
| stretch_compression | 伸缩变换 |
| complex_conjugate | 共轭复数 |
| modulus_argument | 模与辐角 |
| pascals_triangle | 帕斯卡三角 |
| binomial_coefficient | 二项式系数 |
| mathematical_induction | 数学归纳法 |

### exam_type (考试类型)

| code | label_en | label_zh |
|------|----------|----------|
| IB_AA_SL | IB Analysis SL | IB 分析 SL |
| IB_AA_HL | IB Analysis HL | IB 分析 HL |
| IB_AI_SL | IB Applications SL | IB 应用 SL |
| IB_AI_HL | IB Applications HL | IB 应用 HL |
| Cambridge_IGCSE | Cambridge IGCSE | 剑桥 IGCSE |
| Cambridge_AS | Cambridge AS Level | 剑桥 AS |
| Cambridge_A2 | Cambridge A2 Level | 剑桥 A2 |
| Competition | Math Competition | 数学竞赛 |
| NCEA | NCEA | 新西兰 NCEA |
| General | General Practice | 通用练习 |

### context (应用场景)

| code | label_en | label_zh |
|------|----------|----------|
| pure_math | Pure mathematics | 纯数学 |
| finance | Financial | 金融理财 |
| physics | Physics | 物理应用 |
| geometry | Geometry | 几何图形 |
| real_world | Real world | 生活实际 |
| statistics | Statistics | 统计数据 |

### flag (特殊标记)

| code | label_en | label_zh |
|------|----------|----------|
| challenge | Challenge problem | 挑战题 |
| has_solution | Has solution | 有解答 |
| has_hints | Has hints | 有提示 |
| common_mistake | Common mistake | 易错点 |
| key_concept | Key concept | 核心概念 |
| multi_step | Multi-step | 多步骤 |
| requires_diagram | Requires diagram | 需要图形 |

### pitfalls (易错点详情) - 新增

| code | label_en | label_zh |
|------|----------|----------|
| sign_error | Sign error | 符号错误 |
| calculation_error | Calculation error | 计算错误 |
| missing_case | Missing case | 漏考虑情况 |
| unit_conversion | Unit conversion | 单位换算 |
| domain_range_error | Domain/Range error | 定义域值域错误 |
| order_of_operations | Order of operations | 运算顺序错误 |
| missing_solution | Missing solution | 漏解 |
| extraneous_solution | Extraneous solution | 增根 |

---

## 章节与 IB Topic 映射

| 章节 | IB Topics |
|------|-----------|
| Algebra | 1.1, 1.7 |
| Expansion and Factorisation | 1.7, 2.2 |
| Simplifying algebraic fractions | 1.7, 1.11 |
| Expansion of radical expressions | 1.7 |
| Factorization and simplication | 1.7, 2.2 |
| Solving equations | 2.1, 2.2 |
| Problem solving with algebra | 1, 2 |
| Simultaneous equations | 2.1 |
| Inequalities | 2.1, 2.2 |
| Straight line | 2.1, 3.1 |
| Quadratic function | 2.2 |
| sets | 1 |
| Venn diagrams | 1, 4 |
| Functions | 2.3, 2.4 |
| Transformation of functions | 2.3 |
| logarithms | 1.5, 2.6 |
| Number sequences | 1.2 |
| series | 1.2, 1.3, 1.8 |
| Applications of geometric sequences | 1.3, 1.4 |
| Number | 1.1 |
| matrices | 1.14 |
| polynomials | 2.7 |
| Polynomial equations | 2.7 |
| Percentage | 1 |
| Ratio and proportion | 1 |
| rates | 1 |
| Problem solving | 1, 2 |
| Financial mathematics | 1.4 |
| Complex numbers | 1.12 |
| Geometry in the complex plane | 1.13 |
| The binomial theorem | 1.9 |
| Reasoning and proof | 1.6 |

---

## 标注策略

### Step 1: 规则预处理（不调用 AI）

从现有内容自动提取：

```javascript
function extractMetadata(question, item, chapter) {
  const metadata = {};
  const text = question.problem_latex;

  // === 原书信息 ===
  const exerciseMatch = text.match(/^(EXERCISE|REVIEW SET)\s+(\d+)([A-Z]?\.?\d*)/);
  if (exerciseMatch) {
    metadata.exercise_type = exerciseMatch[1] === 'REVIEW SET' ? 'review' : 'exercise';
    metadata.original_chapter = parseInt(exerciseMatch[2]);
    metadata.original_section = exerciseMatch[3] || null;
    metadata.exercise_id = exerciseMatch[2] + (exerciseMatch[3] || '');
  }

  // === 竞赛来源 ===
  const sourceMatch = text.match(/\(Source: ([^)]+)\)/);
  if (sourceMatch) {
    metadata.source = { competition: sourceMatch[1] };
    metadata.flags = ['challenge'];
    metadata.difficulty = 5;
    metadata.level = 'competition';
    metadata.exam_types = ['Competition'];
  }

  // === 难度标记 ===
  if (text.includes('★') || text.includes('\\star') || text.includes('Challenge')) {
    metadata.flags = metadata.flags || [];
    metadata.flags.push('challenge');
    metadata.difficulty = metadata.difficulty || 4;
    metadata.level = metadata.level || 'advanced';
  }

  // === Hints ===
  if (text.includes('Hints:')) {
    metadata.flags = metadata.flags || [];
    metadata.flags.push('has_hints');
  }

  // === 有解答 ===
  if (item.type === 'example' || text.includes('Solution')) {
    metadata.flags = metadata.flags || [];
    metadata.flags.push('has_solution');
  }

  // === 图形 ===
  if (/diagram|graph|figure|shown|below/i.test(text)) {
    metadata.has_diagram = true;
  }

  // === 应用场景 ===
  if (/£|€|\$|yen|peso|interest|investment|compound|depreciation/i.test(text)) {
    metadata.contexts = ['finance'];
  } else if (/rectangle|triangle|circle|area|perimeter|angle/i.test(text)) {
    metadata.contexts = ['geometry'];
  } else if (/km|metre|speed|distance|travel|rate/i.test(text)) {
    metadata.contexts = ['real_world'];
  } else {
    metadata.contexts = ['pure_math'];
  }

  // === 子题数量 ===
  const subQuestions = text.match(/\([a-z]\)/g);
  if (subQuestions) {
    metadata.sub_question_count = subQuestions.length;
    if (subQuestions.length >= 4) {
      metadata.question_type = 'multi_part';
    }
  }

  // === 从章节映射 IB topics ===
  metadata.ib_topics = getTopicsFromChapter(chapter.id);

  return metadata;
}
```

### Step 2: AI 补充标注

只让 AI 判断规则无法确定的字段：

```
你是 IB/IGCSE 数学专家。补充以下题目的分类标签。

已知信息：
- 章节：{chapter_title}
- 内容类型：{item_type}
- 已提取：{existing_metadata}

题目内容：
{problem_latex}

请补充（只返回 JSON，不要解释）：
{
  "difficulty": 1-5,
  "level": "beginner|intermediate|advanced|competition",
  "question_type": "...",
  "skills": [...],
  "topics": [...],
  "ib_topics": [...],
  "exam_types": [...],
  "grade_levels": [...],
  "flags": [...],
  "pitfalls": [...]
}

=== 标准 ===

difficulty:
- 1 = 定义理解、直接代入
- 2 = 单步运算、简单变换
- 3 = 多步骤、需要技巧
- 4 = 综合应用、Challenge 级
- 5 = 竞赛级

question_type 从以下选择：
calculation, simplification, equation_solving, proof, application,
graphing, fill_blank, explain, multi_part, true_false

skills 从以下选择：
calculation, algebraic_manipulation, reasoning, problem_solving,
exploration, proof, modeling, graphing

topics 用英文下划线格式 + 中文，如：
["negative_exponents", "负指数", "factorization", "因式分解"]

exam_types 从以下选择：
IB_AA_SL, IB_AA_HL, Cambridge_IGCSE, Competition, General

grade_levels 从以下选择：
Year_9, Year_10, Year_11, Year_12, Year_13

pitfalls（如果是易错题）从以下选择：
sign_error, calculation_error, missing_case, unit_conversion,
domain_range_error, order_of_operations, missing_solution, extraneous_solution
```

---

## 扩展性说明

### 新增维度流程

未来新增分类维度只需：

1. 在 `tag_definitions` 表添加新 category 和 codes
2. 更新 AI prompt 包含新字段
3. 前端添加筛选 UI

**无需：**
- 修改 questions 表结构
- 重新处理已有数据（可增量更新 metadata）

### 可能的未来维度

| 维度 | category | 说明 |
|------|----------|------|
| 认知层次 | cognitive_level | remember / understand / apply / analyze |
| 答题时间 | estimated_time | 1min / 3min / 5min / 10min+ |
| 相似题组 | similar_group | 聚类相似题目 |
| 学生易错率 | error_rate | 基于答题数据统计 |
| 先修知识 | prerequisites | 需要先掌握的 topics |

---

## 查询示例

```sql
-- 查找 difficulty 3+ 的二次函数题
SELECT * FROM questions
WHERE (metadata->>'difficulty')::int >= 3
  AND metadata->'ib_topics' ? '2.2';

-- 查找适合 IB SL 的计算题
SELECT * FROM questions
WHERE metadata->'exam_types' ? 'IB_AA_SL'
  AND metadata->>'question_type' = 'calculation';

-- 查找有解答的金融应用题
SELECT * FROM questions
WHERE metadata->'contexts' ? 'finance'
  AND metadata->'flags' ? 'has_solution';

-- 查找易错的符号问题
SELECT * FROM questions
WHERE metadata->'pitfalls' ? 'sign_error';

-- 按原书 Exercise 编号查找
SELECT * FROM questions
WHERE metadata->>'exercise_id' = '8A';

-- 统计各难度分布
SELECT
  metadata->>'difficulty' as difficulty,
  COUNT(*)
FROM questions
WHERE metadata->>'difficulty' IS NOT NULL
GROUP BY metadata->>'difficulty'
ORDER BY difficulty;

-- 统计各题型分布
SELECT
  metadata->>'question_type' as question_type,
  COUNT(*)
FROM questions
WHERE metadata->>'question_type' IS NOT NULL
GROUP BY metadata->>'question_type'
ORDER BY COUNT(*) DESC;
```

---

## 实施计划

| 步骤 | 任务 | 说明 |
|------|------|------|
| 1 | 建表 migration | metadata 字段、tag_definitions、chapter_topic_mapping |
| 2 | 导入标签词汇表 | 初始化所有 tag_definitions |
| 3 | 建立章节映射 | 填充 chapter_topic_mapping |
| 4 | 规则预处理脚本 | 提取原书信息、竞赛来源、flags 等 |
| 5 | AI 标注脚本 | 补充 difficulty、skills、topics、question_type 等 |
| 6 | 前端筛选 UI | 实现多维度筛选界面 |

### 成本估算

- 规则预处理：0 成本
- AI 标注（Claude）：~$5-10（2609 题）

---

## 参考资料

- [IB Mathematics: Analysis and Approaches Guide](https://dp.uwcea.org/docs/Mathematics%20-%20Analysis%20and%20Approaches%20Subject%20Guide.pdf)
- [IB HL Math AA Syllabus | Eduib](https://www.eduib.com/blog/ib-hl-math-aa-syllabus)
- [Revision Village - IB Math AA](https://www.revisionvillage.com/ib-math/analysis-and-approaches-sl/)
