# AI 标注方案 v2

## 设计原则

1. **灵活标注** — topics 允许 AI 自由生成，后期二次加工统一
2. **固定字段** — difficulty, question_type, skills, exam_types, grade_levels 从预定义列表选
3. **自动推导** — level 由 difficulty 自动计算，不单独标注
4. **二次加工** — 全部标完后，聚类/映射 topics 到标准词汇表；skills 可用规则扩展
5. **粒度要求** — topics 必须足够具体，太粗的标注无法后期修复

---

## 字段定义

### 1. difficulty (1-5)

| 值 | 名称 | 定义 | 自动推导 level |
|----|------|------|----------------|
| 1 | 识记 | 直接应用定义/公式，无需变换 | foundation |
| 2 | 理解 | 单步运算，基础应用 | foundation |
| 3 | 应用 | 2-3 步骤，需要选择方法 | standard |
| 4 | 分析 | 多步骤，需要拆解问题 | extension |
| 5 | 综合 | 竞赛级/证明/创新题 | extension |

**注意**: 不再单独标注 level，由 difficulty 自动映射。

### 2. question_type (10 种)

| 类型 | 定义 | 典型题目 |
|------|------|----------|
| `calculation` | 数值计算，求具体答案 | "计算 $2^3 \times 3^2$" |
| `simplification` | 化简表达式 | "化简 $\frac{x^2-1}{x-1}$" |
| `expansion` | 展开括号/乘法 | "展开 $(x+2)^2$" |
| `factorization` | 因式分解 | "分解 $x^2-4$" |
| `equation_solving` | 解方程/不等式 | "解 $2x+3=7$" |
| `graphing` | 作图/图像分析 | "画出 $y=x^2$ 的图像" |
| `explain` | 解释/说明/证明 | "解释为什么 $a^0=1$" |
| `application` | 文字应用题/建模 | "小明存款 $1000，年利率 5%..." |
| `concept` | 概念讲解/定义（非题目） | 知识点说明、定义、公式推导 |
| `multi_part` | 多小问综合 (≥3 小问) | "(a)(b)(c)(d)..." |

**特殊规则**:
- item.type = `concept` 或 `definition` → question_type 用 `concept`
- item.type = `investigation` → question_type 用 `explain` 或 `multi_part`

### 3. skills (固定 6 种，可多选)

| 技能 | 定义 |
|------|------|
| `calculation` | 数值运算能力 |
| `algebraic_manipulation` | 代数变换能力 |
| `reasoning` | 逻辑推理/论证 |
| `problem_solving` | 建模/策略选择 |
| `pattern_recognition` | 识别规律/结构 |
| `graphing` | 图形绘制/可视化 |

**后期可扩展**: 二次加工时可用规则推断新增 skills（如根据 question_type 推断）

### 4. topics (灵活标注，后期统一)

**标注时**: AI 可自由生成 topic 名称，用英文下划线格式，1-3 个

⚠️ **粒度至关重要** — 太粗的 topic 后期无法细化，信息会永久丢失！

**禁止使用的粗粒度 topics**:
- ❌ `sets` → 应该用 `set_operations`, `subsets`, `cardinality`, `venn_diagrams`
- ❌ `functions` → 应该用 `domain_and_range`, `composite_functions`, `inverse_functions`
- ❌ `exponents` / `powers` → 应该用 `exponent_laws`, `negative_exponents`, `zero_exponent`
- ❌ `fractions` → 应该用 `algebraic_fractions`, `fraction_operations`
- ❌ `factoring` → 应该用 `factorization`, `difference_of_squares`, `factoring_hcf`

**命名规范**:
- 用英文下划线格式: `exponent_laws`, `quadratic_equations`
- 粒度 = 老师口中的"知识点"，不是"章节"
- 常见格式参考:
  - 运算类: `xxx_laws`, `xxx_operations`
  - 方程类: `xxx_equations`
  - 函数类: `xxx_functions`

**后期二次加工**:
1. 统计所有生成的 topics
2. 聚类相似的（如 `exponent_rules` → `exponent_laws`）
3. 建立映射表，批量更新数据库
4. 最终形成标准词汇表

**标准词汇表**:
```
# 统一术语（必须遵守）
exponent_laws, negative_exponents, zero_exponent, fractional_exponents  # 用 exponent 不用 index
completing_the_square  # 带 the
vietas_formulas  # 韦达定理
word_problems  # 应用题
substitution  # 代入
simplifying_expressions  # 化简

# 常见 topics
factorization, expansion, difference_of_squares, perfect_squares
algebraic_fractions, surds, rationalization
linear_equations, quadratic_equations, simultaneous_equations
composite_functions, inverse_functions, domain_and_range
arithmetic_sequences, geometric_sequences, series_sum
matrix_addition, matrix_multiplication, scalar_multiplication
complex_numbers, mathematical_induction, proof
```

### 5. exam_types (5 种，可多选)

| 类型 | 适用 |
|------|------|
| `General` | 基础题，通用 |
| `Cambridge_IGCSE` | IGCSE 考试难度 |
| `IB_AA_SL` | IB AA SL 难度 |
| `IB_AA_HL` | IB AA HL 难度 |
| `Competition` | 竞赛题 (AMC, AHSME, HMMT 等) |

### 6. grade_levels (5 种，可多选)

`Year_9`, `Year_10`, `Year_11`, `Year_12`, `Year_13`

---

## Prompt 模板 v2

```
你是 IB/IGCSE 数学专家。为以下题目标注分类信息。

## 输出格式
返回 JSON 数组，每题一个对象：
[{"id":"完整UUID","difficulty":2,"question_type":"simplification","skills":["algebraic_manipulation"],"topics":["exponent_laws"],"exam_types":["General"],"grade_levels":["Year_9"]}]

## 字段说明

### difficulty (必选，1-5)
1 = 直接套公式，无需思考
2 = 单步运算，基础题
3 = 2-3 步，需要选择方法
4 = 多步骤，需要分析拆解
5 = 竞赛级/证明/综合创新

### question_type (必选，只能选 1 个)
- calculation: 求数值答案
- simplification: 化简表达式
- expansion: 展开
- factorization: 因式分解
- equation_solving: 解方程
- graphing: 作图/图像题
- explain: 解释/说明/证明
- application: 文字应用题/建模
- concept: 概念讲解/定义（用于 item.type=concept/definition）
- multi_part: ≥3 个小问的综合题

### skills (必选，可多选，只能从以下 6 种选)
calculation, algebraic_manipulation, reasoning, problem_solving, pattern_recognition, graphing

### topics (必选，1-3 个，可自由生成)
用英文下划线格式，粒度=老师口中的"知识点"。

⚠️ **粒度至关重要** - 太粗的 topic 后期无法细化，信息会丢失！

粒度示例:
- ✅ negative_exponents, completing_the_square, matrix_multiplication (具体知识点)
- ❌ exponents (太粗，应拆分为 negative_exponents, zero_exponent 等)
- ❌ sets (太粗，应拆分为 set_operations, subsets, cardinality 等)
- ❌ functions (太粗，应拆分为 domain_and_range, composite_functions 等)
- ❌ negative_exponent_type_1 (太细，题型由 question_type 区分)

⚠️ 术语统一 (重要):
- 用 exponent 不用 index: negative_exponents ✓, negative_indices ✗
- 用 completing_the_square (带 the)
- 韦达定理用 vietas_formulas
- 应用题用 word_problems (不用 real_world_problems)
- 代入用 substitution (不用 algebraic_substitution)
- 化简用 simplifying_expressions (不用 simplification 或 algebraic_simplification)

常见 topics:
- 指数: exponent_laws, negative_exponents, zero_exponent, fractional_exponents
- 因式分解: difference_of_squares, perfect_squares, completing_the_square, factorization
- 方程: linear_equations, quadratic_equations, simultaneous_equations, vietas_formulas
- 函数: composite_functions, inverse_functions, domain_and_range
- 数列: arithmetic_sequences, geometric_sequences, series_sum
- 矩阵: matrix_addition, matrix_multiplication, scalar_multiplication
- 高级: complex_numbers, mathematical_induction, proof

### exam_types (必选，可多选)
General, Cambridge_IGCSE, IB_AA_SL, IB_AA_HL, Competition

### grade_levels (必选，可多选)
Year_9, Year_10, Year_11, Year_12, Year_13

## 示例

题目: "Simplify $2^3 \times 2^4$"
→ {"id":"xxx","difficulty":1,"question_type":"simplification","skills":["calculation"],"topics":["exponent_laws"],"exam_types":["General"],"grade_levels":["Year_9"]}

题目: "Explain why $a^0 = 1$"
→ {"id":"xxx","difficulty":2,"question_type":"explain","skills":["reasoning"],"topics":["zero_exponent"],"exam_types":["General"],"grade_levels":["Year_9"]}

题目: "Factorise $x^2 - 9$"
→ {"id":"xxx","difficulty":2,"question_type":"factorization","skills":["algebraic_manipulation","pattern_recognition"],"topics":["difference_of_squares"],"exam_types":["Cambridge_IGCSE"],"grade_levels":["Year_9","Year_10"]}

题目: "(a) Expand $(x+2)^2$ (b) Hence factorise... (c) Solve... (d) Sketch..."
→ {"id":"xxx","difficulty":3,"question_type":"multi_part","skills":["algebraic_manipulation","graphing"],"topics":["perfect_squares","quadratic_equations"],"exam_types":["Cambridge_IGCSE"],"grade_levels":["Year_10"]}

题目: "A car depreciates by 15% each year. If it costs $20000 new, find its value after 3 years."
→ {"id":"xxx","difficulty":3,"question_type":"application","skills":["calculation","problem_solving"],"topics":["percentage","depreciation"],"exam_types":["Cambridge_IGCSE"],"grade_levels":["Year_10"]}

题目 (item.type=concept): "The laws of exponents: $a^m \times a^n = a^{m+n}$, $a^m \div a^n = a^{m-n}$..."
→ {"id":"xxx","difficulty":1,"question_type":"concept","skills":["reasoning"],"topics":["exponent_laws"],"exam_types":["General"],"grade_levels":["Year_9"]}

## 注意
- 不要用 level 字段（已废弃，由 difficulty 自动推导）
- topics 最多 3 个，选最相关的
- topics 用英文下划线格式，必须遵守术语统一规范
- item.type=concept/definition → question_type 用 `concept`
- 竞赛题 (带 Source: AMC/AHSME 等) → exam_types 包含 `Competition`
- 术语统一: exponent(非index), completing_the_square(带the), vietas_formulas, word_problems, substitution

## 题目列表
{questions}

只输出 JSON 数组，不要其他文字。
```

---

## 流程

### 第一阶段：AI 标注
1. **批量大小**: 25 题/批
2. **验证**: 保存前检查 JSON 格式
3. **去重**: topics 自动去重
4. **level 自动生成**: 保存时根据 difficulty 计算

### 第二阶段：二次加工（全部标完后）
1. **统计 topics**: `SELECT DISTINCT jsonb_array_elements_text(metadata->'topics') FROM questions`
2. **聚类合并**: 相似 topics 合并
3. **建立映射表**: 原始值 → 标准值
4. **批量更新**: 用 SQL 批量替换
5. **生成最终词汇表**: 导入 tag_definitions 表

**已知需合并的 topics**:
```
negative_indices → negative_exponents
zero_index → zero_exponent
fractional_indices, rational_exponents, rational_indices → fractional_exponents
index_laws → exponent_laws
completing_square → completing_the_square
sum_and_product_of_roots, sum_product_roots, roots_and_coefficients → vietas_formulas
real_world_problems, real_world_applications → word_problems
algebraic_substitution, variable_substitution → substitution
simplification, algebraic_simplification → simplifying_expressions
square_root → square_roots
consecutive_numbers → consecutive_integers
```

## 清理命令

```sql
-- 清空已有 AI 标注，保留规则预处理字段
UPDATE questions
SET metadata = metadata - 'difficulty' - 'level' - 'question_type' - 'skills' - 'topics' - 'exam_types' - 'grade_levels'
WHERE metadata->>'difficulty' IS NOT NULL;
```
