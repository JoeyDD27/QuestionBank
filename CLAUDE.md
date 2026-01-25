# QuestionBank 项目规范

## 当前状态 (2026-01-21)

**Phase 3: 出卷功能 - ✅ 完成**

### 出卷核心功能
- 题目勾选: `/questions` 页面可勾选单题或全选当前页
- 工作区侧边栏: 右侧显示已选题目列表（可折叠，有题目时自动展开）
- 出卷预览: `/worksheet` 页面支持拖拽排序、预览题目卷/答案卷
- 打印 PDF: 浏览器打印，KaTeX 矢量渲染，质量清晰
- Word 导出: 支持导出题目卷/答案卷为 .docx 文件
- Compact 模式: 小题 (a)(b)(c)... 自动排列为 2 列，节省纸张
- 无答案提示: 答案卷显示"答案未录入"，题目卡片显示"无答案"标签

### 筛选页 UX 改进
- 搜索框: 支持搜索题目内容，500ms 防抖
- 快速筛选: Easy / Medium / Hard / Examples 一键预设
- 筛选器折叠: Item Type / Difficulty 默认展开，其他折叠
- Topics 搜索: 输入框过滤 topics
- Topics 按章节过滤: 选择章节后只显示该章节的 topics
- Labeled count 联动: 选择章节后显示该章节的已标注数
- Header 徽章: 显示已选数量，点击跳转 worksheet
- 键盘快捷键: j/k 上下，Space 选中，Enter 去 worksheet
- 偏好记忆: 折叠状态保存到 localStorage

### 技术栈
- React Context + localStorage (状态管理)
- @dnd-kit/sortable (拖拽排序)
- window.print() (零依赖 PDF 生成)
- docx + file-saver (Word 导出)

### Phase 2 标注统计 (已完成)

| 指标 | 值 |
|------|-----|
| Questions | 2609 (100%) |
| Subquestions | 1633 (100%) |
| 方案 | `docs/labeling-schema-v2.md` |

---

## 项目概述

**QuestionBank** 是 IB/IGCSE 数学题库系统。从 Word 文档图片提取数学题目，存入 Supabase，通过 Web 展示。

## 用户画像与场景

### 目标用户
**IB/IGCSE 数学老师**

### 核心使用场景
1. **按知识点筛选题目** - 老师想找"负指数运算"相关练习题
2. **按题型/难度筛选** - 选择适合学生水平的题目
3. **生成练习卷** - 勾选题目 → 导出 PDF（题目卷 + 答案卷分开）
4. **备课参考** - 查看 concept 和 example 作为教学素材

## 开发阶段

| 阶段 | 目标 | 状态 |
|------|------|------|
| **阶段1** | 基础提取：完整准确地从图片提取内容 | ✅ 完成 |
| **阶段2** | 结构化：添加 metadata、知识点标签、难度分类 | ✅ 完成 |
| **阶段3** | 出卷功能：勾选题目、生成 PDF | ✅ 完成 |

### Phase 2 进度

| Step | 任务 | 状态 |
|------|------|------|
| 1 | 建表 migration (metadata, tag_definitions, chapter_topic_mapping) | ✅ |
| 2 | 导入标签词汇表 (90 条) | ✅ |
| 3 | 章节与 IB Topic 映射 (46 条) | ✅ |
| 4 | 规则预处理 (2609 题 metadata 基础字段) | ✅ |
| 5 | AI 标注 (difficulty, skills, topics 等) | ✅ 2609 questions + 1633 subquestions |
| 6 | 前端筛选 UI | ✅ 基础版完成 |

**Step 5 方案**: `docs/labeling-schema-v2.md`

### 线上地址

- **网站**: https://web-plum-zeta-69.vercel.app
- **Supabase**: https://orfxntmcywouoqpasivm.supabase.co

### 部署命令

```bash
cd web && vercel --prod
```

## 当前状态

- **Algebra 阶段1完成**: 33 章，2609 items，2952 图片
- **Year 4 math 处理中**: 文档已解压分析，PoC 验证通过
- **详细记录**: [docs/phase1-notes.md](docs/phase1-notes.md), [docs/year4-analysis.md](docs/year4-analysis.md)
- **阶段2方案**: [docs/phase2-classification-design.md](docs/phase2-classification-design.md)

---

## 项目结构

```
QuestionBank/
├── chapter_image_ranges.json       # Algebra 章节图片范围
├── extractions/                    # 提取的 JSON 文件
├── docx_extracted/word/media_compressed/  # Algebra 源图片
├── year4_extracted/word/media/     # Year 4 源图片 (366张)
├── Year 4 math.docx               # Year 4 原始文档
├── scripts/
│   ├── import-chapter.cjs          # 章节导入脚本
│   ├── extract_figures.py          # MinerU+GDINO 图表裁切
│   └── scan_format_issues.cjs      # 格式检查
├── web/                            # Next.js 前端 (Vercel)
├── docs/                           # 归档文档
│   ├── phase1-notes.md             # Algebra Phase 1 记录
│   └── year4-analysis.md           # Year 4 分析与方案
└── .env                            # Supabase 密钥
```

## 章节处理流程（Year 4 完整流程）

### 完整工作流程

**每个章节/Part 必须按顺序执行以下步骤**：

#### 1. 读取图片范围
```bash
# 查看 configs/year4/chapter_image_ranges.json
```

#### 2. 识别需要裁切的图片
- 读取该 Part 的所有图片
- 判断哪些图片包含需要内联显示的图表

#### 3. 执行图表裁切（如有需要）
```bash
/home/dkai/.venvs/mineru/bin/python scripts/extract_figures.py \
  --images year4_extracted/word/media/imageXX.png ... \
  --output year4_figures/unitN
```
- **必须执行 LLM 4 轮评审**（见"图表裁切执行流程"）

#### 4. 提取内容到 JSON
- 创建 `extractions_year4/chXX_*_partN.json`
- 在需要的位置添加 `[FIGURE:N]` 标记

#### 5. 执行内容质量自检（必须）
- **逐题核对**：同时打开原图和 JSON，逐字对照
- 检查：题号、公式、文字、选项、特殊符号
- 记录：`✅ 内容自检完成：X 道题目，Y 张图表，逐字核对无误`

#### 6. 导入数据库
```bash
node scripts/import-chapter.cjs --ch=N --source=year4 [--clear]
```

#### 7. 上传裁切图（如有）
```bash
# 先配置 scripts/upload-figures.cjs 的 FIGURE_MAP
node scripts/upload-figures.cjs --source=year4 --ch=N
```

#### 8. 部署验证
```bash
cd web && vercel --prod
```

验证: https://web-plum-zeta-69.vercel.app

---

### Algebra 章节处理（简化流程）

使用 `questionbank-chapter-processor` skill:

```
"提取 ch02" 或 "process chapter 2"
```

Algebra 源图已是独立题目，不需要图表裁切。

**Skill 路径**: `~/.claude/skills/questionbank-chapter-processor/skill.md`

---

## 内容提取质量检查（必须执行）

**重要**: 每次提取内容后，必须自己严格执行以下检查流程，不依赖用户确认。

### 检查流程

#### 1. 文字内容检查（逐题核对）

对每道题目，必须同时打开：
- 原始图片（source image）
- 提取的 JSON 内容

逐字核对以下内容：
- [ ] 题目编号是否正确（1, 2, 3... 或 (a), (b), (c)...）
- [ ] 数学公式是否完整（检查每个符号、数字、运算符）
- [ ] 文字描述是否准确（不能凭印象，必须逐字对照）
- [ ] 选项内容是否正确（选择题的每个选项）
- [ ] 特殊符号是否正确（★, ○, □ 等符号的数量和位置）

#### 2. 图表裁切检查

对每张裁切的图表：
- [ ] 图表是否完整（标题、轴标签、数据都在）
- [ ] 是否裁切了正确的图表（不是页码、装饰图案等）
- [ ] 多图题目是否裁切了所有需要的图表

#### 3. 映射关系检查

- [ ] `[FIGURE:N]` 标记位置是否正确
- [ ] `source_images` 是否指向正确的图片
- [ ] FIGURE_MAP 中的 order_index 是否与题目对应

### 常见错误类型

| 错误类型 | 示例 | 预防方法 |
|---------|------|---------|
| 符号数量错误 | 4个★写成3个★ | 逐个数符号 |
| 公式不完整 | 漏掉 $\circ +$ | 逐字符对照 |
| 数字抄错 | 260 写成 206 | 重复核对数字 |
| 问题理解错 | "○ + ★" 写成 "★" | 仔细读题 |

### 自检记录

完成检查后，在 commit message 或输出中注明：
```
✅ 内容自检完成：X 道题目，Y 张图表，逐字核对无误
```

---
## 子章节映射与筛选（必须保持与 Word 顺序一致）

当新增/替换 Word 或 PDF 文件时，必须同步更新子章节映射与筛选顺序，确保：
1. `items.sub_chapter` 映射与 Word 章节顺序一致
2. `/questions` 子章节筛选列表按 Word 顺序显示

流程：
1. 以 `section_index.json` 为权威索引（来自 Word/PDF 的 TOC/结构解析）。
2. 生成并更新以下配置：
   - `sub_chapters.json`（根目录）
   - `web/src/data/sub-chapters.json`
3. 运行脚本回填数据库：
   ```bash
   node scripts/import-sub-chapters.cjs
   ```
4. 线上验证：`/questions` 选择章节，检查子章节顺序与题目归属是否正确。

若出现顺序异常，优先检查 `sub_chapters.json` 是否与 `section_index.json` 一致，再确认前端已部署。

---

## Schema: items_flat (标准格式)

```json
{
  "chapter": 2,
  "part": 1,
  "images_range": "195-224",
  "items": [
    {
      "type": "example",
      "content_latex": "Example 1\n\nExpand:\n\n(a) $3(x+2)$\n\nSolutions:\n\n(a) $3x+6$",
      "source_images": ["image195.png"]
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | concept / example / exercise / definition / investigation |
| content_latex | string | 完整内容，LaTeX 格式 |
| source_images | string[] | 源图片文件名 |

### 题号格式

| Level | Format | Example |
|-------|--------|---------|
| Main | `1.` | `1. Simplify:` |
| Sub | `(a)` | `(a) $x^2$` |
| Sub-sub | `(i)` | `(i) $\frac{1}{2}$` |

---

## LaTeX 规范

### 公式

- 行内: `$...$`
- 换行: 用 `\n`（JSON 中的实际换行）

### 常用符号

| 符号 | LaTeX |
|------|-------|
| × | `\times` |
| ÷ | `\div` |
| 分数 | `\frac{a}{b}` |
| 根号 | `\sqrt{x}` |
| 集合 | `\{1,2,3\}` |

### 禁止

- `**markdown 加粗**` → 格式污染
- `\\n` → 会显示为字面 `\n`
- `\texteuro` → 用 `€` 代替
- `*斜体*` → 会原样显示

### 特殊处理

- **货币符号**: JSON 中用 `\$` 转义，导入脚本自动处理
- **数学分隔符**: `$...$` 会被转换为 `｢...｣` 避免与货币冲突

---

## Supabase

- **Project ID**: `orfxntmcywouoqpasivm`
- **Tables**: chapters, images, items, questions
- **Storage**: `question-images/algebra/`

### 导入脚本

```bash
node scripts/import-chapter.cjs --ch=N [options]

选项:
  --source=NAME   数据源: algebra (默认) 或 year4
  --clear         清除已有数据
  --images-only   仅上传图片
  --data-only     仅导入数据
  --dry-run       预览模式
```

**自动图片压缩**: 脚本会自动检测超大图片（>1800px），使用 PIL 压缩后再上传。
- 原始图片: `media/` 目录
- 压缩图片: `media_compressed/` 目录（自动创建）
- 避免 Claude API 400 错误（多图请求限制 2000px）

从 `.env` 读取 `SUPABASE_ANON_KEY`。

---

## 质量检查

```bash
node scripts/scan_format_issues.cjs
```

检查项: JSON 语法、星号污染、内容完整性

---

## Year 4 Math 处理

### 文档分析结论
- **文件**: `Year 4 math.docx` (604MB)，已解压到 `year4_extracted/`
- **性质**: 混合文档 — 293 张全页截图 + 33 张小图 + 原生文本
- **5 个 Unit**: graph(51图), numbers(38图), fraction(92图), decimal(35图), geometry(150图)
- **详细分析**: [docs/year4-analysis.md](docs/year4-analysis.md)

### 图表裁切方案：MinerU + Grounding DINO 组合 + LLM 4轮闭环

**工具说明**:
- **MinerU** (`/home/dkai/.venvs/mineru/bin/magic-pdf` v1.3.12): 切大图表（柱状图含标题轴标签）
- **Grounding DINO** (`IDEA-Research/grounding-dino-base`，mineru venv): 切小图形（几何形状等）
- **合并脚本**: `scripts/extract_figures.py`（MinerU+GDINO 合并）
- **去重规则**: IoU > 0.3 去重，面积 > 60% 整页误检过滤

---

## 图表裁切执行流程（必须执行）

**重要**: 对于包含图表的图片，必须执行以下完整流程，不能跳过。

### Step 1: 识别需要裁切的图片

读取图片后，判断是否包含需要内联显示的图表：
- 柱状图、折线图、饼图
- 数轴、数线
- Venn 图、集合图
- 称重天平、容器图
- 几何图形
- 表格（如果需要单独显示）

**纯文字/公式题目不需要裁切**。

### Step 2: MinerU + GDINO 裁切

```bash
# 使用 mineru venv
/home/dkai/.venvs/mineru/bin/python scripts/extract_figures.py \
  --images year4_extracted/word/media/imageXX.png [imageYY.png ...] \
  --output year4_figures/unitN
```

裁切结果保存在 `year4_figures/unitN/merged/imageXX/` 下。

### Step 3: LLM 评审裁切质量（最多 4 轮）

**第 1 轮: 检查裁切结果**

用 Read 工具查看每个裁切结果，检查：
- [ ] 图表是否完整（标题、轴标签、数据、图例都在）
- [ ] 是否包含多余内容（题目文字、页码、装饰元素）
- [ ] 横向页面是否需要先旋转

**第 2-4 轮: 定向修复（如需要）**

如果裁切不完整或包含多余内容：

1. 分析问题原因
2. 生成定向 GDINO prompt，例如：
   - "bar chart with title and axis labels"
   - "number line from 0 to 100"
   - "Venn diagram with two circles"
3. 重新运行裁切脚本
4. 再次检查结果

**最多重复 4 轮**，如果仍无法满意，记录问题并手动处理。

### Step 4: 记录裁切结果

完成后记录：
```
✅ 图表裁切完成：X 张图片，Y 个图表，质量检查通过
问题图片（如有）：imageXX - 原因
```

### 常见裁切问题

| 问题 | 解决方案 |
|------|---------|
| 图表被切割不完整 | 调整 GDINO prompt，扩大检测范围 |
| 包含题目文字 | 使用更精确的 prompt，如 "chart only" |
| 横向页面方向错误 | 先旋转图片再裁切 |
| 检测到整页 | 已自动过滤（面积 > 60%） |
| 重复检测 | 已自动去重（IoU > 0.3） |

---

### 硬编码改造清单
见 [docs/year4-analysis.md](docs/year4-analysis.md) 第 3 节

---

## 图表内联显示流程

将全页扫描图中的图表裁切出来，内联显示在题目文字的正确位置。

### 原理

`content_latex` 中用 `[FIGURE:N]` 标记图片位置（N 从 0 开始，对应 `question_figures` 的 `order_index`）。前端 `ContentWithFigures` 组件解析标记，将文字和图片交错渲染。

- 有标记 → 图片内联显示在文字中间，隐藏顶部缩略图
- 无标记 → 保持原有行为（顶部缩略图 + 纯文字），Algebra 题目完全不受影响

### 完整步骤（以 Year 4 ch01 为例）

#### Step 1: 图表裁切

用 MinerU + Grounding DINO 从全页扫描图中裁切图表：

```bash
# 使用 mineru venv
/home/dkai/.venvs/mineru/bin/python scripts/extract_figures.py \
  --images year4_extracted/word/media/image8.png ... \
  --output year4_figures/unit1
```

裁切结果保存在 `year4_figures/unit1/merged/imageN/` 下。

#### Step 2: LLM 评审裁切质量

逐个检查裁切结果（用 Read 工具查看图片），确认：
- 图表完整（含标题、轴标签、数据）
- 无多余内容（不含题目文字、页码等）
- 横向页面需先旋转再裁切（结果在 `unit1_rotated/`）

对应关系示例：
| 题目 | 源图（整页） | 裁切图（图表） |
|------|-------------|---------------|
| Exercise 7 | image8.png | `unit1/merged/image8/fig_00_M_figure.jpg` |
| Exercise 12 | image13.png | `unit1/merged/image13/fig_00_M_figure.jpg` |
| Example 13 [FIGURE:0] | image14.png | `unit1_rotated/merged/image14_rotated/fig_00_M_figure.jpg` |
| Example 13 [FIGURE:1] | image15.png | `unit1_rotated/merged/image15_rotated/fig_00_M_figure.jpg` |

概念题（item 1-6）的源图本身就是独立图表，直接使用 `year4_extracted/word/media_compressed/imageN.png`。

#### Step 3: 配置上传映射

编辑 `scripts/upload-figures.cjs` 中的 `FIGURE_MAP`：

```js
const FIGURE_MAP = {
  // order_index → [{ file, label }]
  1: [{ file: 'year4_extracted/word/media_compressed/image1.png', label: 'pictograph' }],
  // ...
  7: [{ file: 'year4_figures/unit1/merged/image8/fig_00_M_figure.jpg', label: 'fruit_bar_graph' }],
  // 多图题目按顺序排列
  13: [
    { file: '.../fig_00_M_figure.jpg', label: 'stickers_bar_graph' },  // [FIGURE:0]
    { file: '.../fig_00_M_figure.jpg', label: 'bar_model_before' },    // [FIGURE:1]
  ]
};
```

#### Step 4: 在 JSON 中添加 `[FIGURE:N]` 标记

在 `extractions_year4/chXX_*.json` 的 `content_latex` 中插入标记：

```
概念题：标题后  → [FIGURE:0]
练习题：题干后、子题前 → [FIGURE:0]
多图题：按位置分别标记 → [FIGURE:0], [FIGURE:1], ...
```

标记规则：
- `[FIGURE:N]` 单独占一行（前后用 `\n\n` 分隔）
- N 与 `question_figures.order_index` 一一对应
- 不影响 `$...$` → `｢...｣` 的转换
- 截断显示时自动避免切断标记

#### Step 5: 导入数据 + 上传图表

**必须先导入数据再上传图表**（因为上传需要 question_id）：

```bash
# 1. 导入数据（生成新的 question_id）
node scripts/import-chapter.cjs --ch=1 --source=year4 --clear --data-only

# 2. 上传裁切图到 question_figures（会清除旧 figures 再重建）
node scripts/upload-figures.cjs --source=year4 --ch=1
```

⚠️ 如果重新导入数据（`--clear`），旧 question_id 失效，**必须重新运行 upload-figures**。

#### Step 6: 部署验证

```bash
cd web && npx vercel --prod
```

验证清单：
- [ ] Year 4 题目：图表在文字正确位置内联显示
- [ ] Algebra 题目：仍以缩略图方式显示（无 `[FIGURE:N]` 标记，不受影响）
- [ ] 出卷预览：图表内联显示
- [ ] Word 导出：图表在正确位置

### 关键文件

| 文件 | 作用 |
|------|------|
| `web/src/components/ContentWithFigures.tsx` | 解析 `[FIGURE:N]`，交错渲染文字和图片 |
| `web/src/components/QuestionCard.tsx` | 有标记时用 ContentWithFigures，隐藏缩略图 |
| `web/src/components/WorksheetPrintView.tsx` | 出卷预览内联图片 |
| `web/src/lib/export-word.ts` | Word 导出内联图片 |
| `scripts/upload-figures.cjs` | 上传裁切图到 question_figures |
| `scripts/extract_figures.py` | MinerU+GDINO 图表裁切管道 |

### 图片优先级

`[FIGURE:N]` 的图片来源优先级：
1. `question_figures`（裁切图，通过 upload-figures.cjs 上传）
2. `source_images`（源图，来自 images 表）— 仅当无 question_figures 时回退

---

## Agent Guidelines

- **Language**: 使用中文交流
- **Plan First**: 复杂任务先提出计划
- **Skill 优先**: 章节处理使用 `questionbank-chapter-processor` skill
- 提取完成后自动运行导入脚本
