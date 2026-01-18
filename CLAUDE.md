# QuestionBank 项目规范

> **⚠️ 强制要求**: 以下情况**必须**检查并更新 CLAUDE.md：
> 1. 每次 `git commit` 之前
> 2. 用户说 "exit" / "quit" / "结束" / "bye" 等退出意图时
> 3. 长时间工作后（即使未 commit）
>
> **检查清单**:
> - [ ] 当前状态（章节进度、数据库统计）是否需要更新？
> - [ ] 是否有新的踩坑记录需要补充？

## 项目概述

**QuestionBank** 是 IB/IGCSE 数学题库系统。从 Word 文档图片提取数学题目，存入 Supabase，通过 Web 展示。

### 线上地址

- **网站**: https://web-plum-zeta-69.vercel.app
- **Supabase**: https://orfxntmcywouoqpasivm.supabase.co

## 当前状态 (2026-01-19)

### 章节进度

| 章节 | 状态 | 备注 |
|------|------|------|
| ch01 | ✅ 已完成 | Algebra, 194 张图, 218 items |
| ch02 | ✅ 已完成 | Expansion and Factorisation, 48 张图, 41 items |
| ch03 | ✅ 已完成 | Simplifying algebraic fractions, 46 张图, 39 items |
| ch04 | ✅ 已完成 | Expansion of radical expressions, 16 张图, 14 items |
| ch05 | ✅ 已完成 | Factorization, 177 张图, 171 items |
| ch06 | ✅ 已完成 | Solving equations, 114 张图, 114 items |
| ch07 | ✅ 已完成 | Problem solving with algebra, 133 张图, 108 items |
| ch08 | ✅ 已完成 | Simultaneous equations, 101 张图, 74 items |
| ch09 | ✅ 已完成 | Inequalities, 54 张图, 35 items |
| ch10 | ✅ 已完成 | Straight line, 93 张图, 91 items |
| ch11 | ✅ 已完成 | Quadratic function, 202 张图, 192 items |
| ch12-ch33 | ⏳ 待提取 | 需处理 |

### 数据库统计

- **chapters**: 33 行
- **images**: 1178 行 (ch01-11 已导入)
- **items**: 1097 行
- **questions**: 1097 行

### 踩坑记录

- **images.order_index**: 2026-01-19 添加该列，导入脚本需要此字段排序图片
- **API 100 图片限制**: 2026-01-19 发现。每个 session 累计读取图片不能超过 100 张，否则报错 `Too much media: N images > 100`。图片读取后累积在 context 中，写完 JSON 也不会清除。

### Skill 修改记录

**2026-01-19** - 多次优化 `questionbank-chapter-processor` skill：

1. **Task 子 agent 自动分批**
   - 每个子 agent 独立 context，图片计数不累积
   - 大章节自动分批（每批 ≤80 张），并行处理
   - ch07 (133张) 首次使用成功

2. **平均分配优化**
   - 改用平均分配代替固定 80 张/批
   - 最多 4 个并行 agent，最小批次 30 张

3. **自动批次计算**
   - 支持 "从 chN 开始一批" 命令
   - 自动累加图片数，≤300 张为一批
   - 大章节 (>150张) 单独处理

**Skill 路径**: `~/.claude/skills/questionbank-chapter-processor/skill.md`

**下一批**: 从 ch12 开始 → ch12-ch13 (180张)，ch14 是大章节单独处理

---

## 项目结构

```
QuestionBank/
├── chapter_image_ranges.json       # 章节图片范围 (ch01-ch33)
├── extractions/                    # 提取的 JSON 文件
├── docx_extracted/word/media_compressed/  # 源图片
├── scripts/
│   ├── import-chapter.cjs          # 章节导入脚本
│   └── scan_format_issues.cjs      # 格式检查
├── web/                            # Next.js 前端 (Vercel)
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

检查项:
- JSON 语法
- 星号污染 (`**...**`)
- 内容完整性

### 常见错误

| 错误 | 修复 |
|------|------|
| `[(-2, 1)]` | `[[-2, 1]]` |
| 尾随逗号 | 删除 |
| `**text**` | `text` |

---

## Agent Guidelines

- **Language**: 使用中文交流
- **Plan First**: 复杂任务先提出计划
- **Skill 优先**: 章节处理使用 `questionbank-chapter-processor` skill

### 用户偏好

- 提取完成后自动运行导入脚本
- 每个 session 结束前更新 CLAUDE.md
