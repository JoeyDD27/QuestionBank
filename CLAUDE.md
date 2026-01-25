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

## 章节处理流程

使用 `questionbank-chapter-processor` skill:

```
"提取 ch02" 或 "process chapter 2"
```

自动执行:
1. 读取 chapter_image_ranges.json 获取图片范围
2. 分 part 读图提取内容 → JSON
3. 运行 `node scripts/import-chapter.cjs --ch=N`
4. 上传图片 + 导入数据库

验证: https://web-plum-zeta-69.vercel.app

**Skill 路径**: `~/.claude/skills/questionbank-chapter-processor/skill.md`

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
  --clear         清除已有数据
  --images-only   仅上传图片
  --data-only     仅导入数据
  --dry-run       预览模式
```

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
- **MinerU** (`/home/dkai/.venvs/mineru/bin/magic-pdf` v1.3.12): 切大图表（柱状图含标题轴标签）
- **Grounding DINO** (`IDEA-Research/grounding-dino-base`，mineru venv): 切小图形（几何形状等）
- **LLM 闭环**: Claude 评估裁切完整性 → 生成定向 GDINO prompt → 重跑，最多 4 轮
- **合并脚本**: `scripts/extract_figures.py`（已实现 MinerU+GDINO 合并，未含 LLM 闭环）
- **IoU 去重阈值**: 0.3，整页误检过滤: 面积 > 60%

### 当前试验范围
Unit 1 graph 前 15 张图 (image1-15)，验证完整管道后再扩大。

### 待执行
1. 管道多源化改造（import 脚本 --source 参数 + web 前端多源支持）
2. 压缩图片 + 建立 chapter_image_ranges
3. 图表裁切（MinerU + GDINO 组合）
4. 内容提取（LLM 读图 → LaTeX）
5. 导入数据库 + 验证 Web 效果

### 硬编码改造清单
见 [docs/year4-analysis.md](docs/year4-analysis.md) 第 3 节

---

## Agent Guidelines

- **Language**: 使用中文交流
- **Plan First**: 复杂任务先提出计划
- **Skill 优先**: 章节处理使用 `questionbank-chapter-processor` skill
- 提取完成后自动运行导入脚本
