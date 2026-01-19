# QuestionBank 项目规范

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
| **阶段2** | 结构化：添加 section/topic 层级、合并相关 items、知识点标签 | ⏳ 待开始 |
| **阶段3** | 出卷功能：勾选题目、生成 PDF | ⏳ 待开始 |

### 线上地址

- **网站**: https://web-plum-zeta-69.vercel.app
- **Supabase**: https://orfxntmcywouoqpasivm.supabase.co

### 部署命令

```bash
cd web && vercel --prod
```

## 当前状态

- **阶段1完成**: 33 章，2609 items，2952 图片
- **详细记录**: [docs/phase1-notes.md](docs/phase1-notes.md)

---

## 项目结构

```
QuestionBank/
├── chapter_image_ranges.json       # 章节图片范围
├── extractions/                    # 提取的 JSON 文件
├── docx_extracted/word/media_compressed/  # 源图片
├── scripts/
│   ├── import-chapter.cjs          # 章节导入脚本
│   └── scan_format_issues.cjs      # 格式检查
├── web/                            # Next.js 前端 (Vercel)
├── docs/                           # 归档文档
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

## Agent Guidelines

- **Language**: 使用中文交流
- **Plan First**: 复杂任务先提出计划
- **Skill 优先**: 章节处理使用 `questionbank-chapter-processor` skill
- 提取完成后自动运行导入脚本
