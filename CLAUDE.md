# QuestionBank 项目规范

> 本文档供 AI 助手使用，定义了数据格式规范和质量标准。

---

## Schema 规范

### 支持的 Schema 类型

项目中有 **10 种 Schema** 用于组织数学题库内容：

| Schema | 数量 | 顶层结构 | 说明 |
|--------|------|----------|------|
| `items_flat` | 7 | `{ items: [...] }` | 平铺 items 列表 |
| `subsections_items` | 6 | `{ subsections: [{ items: [...] }] }` | 子节包含 items |
| `subsections_content` | 9 | `{ subsections: [{ content: [...] }] }` | 子节包含 content |
| `sections` | 17 | `{ sections: [{ content: [...] }] }` | 章节包含 content |
| `categorized` | 3 | `{ concepts, examples, exercises }` | 按类型分类 |
| `extractions` | 3 | `{ extractions: [...] }` | 提取内容列表 |
| `content_root` | 18 | `{ content: [...] }` | 根级 content 数组 |
| `extracted_content` | 2 | `{ extracted_content: [...] }` | 提取内容 |
| `topics` | 1 | `{ topics: [...] }` | 主题列表 |
| `questions` | 1 | `{ questions: [...] }` | 问题列表 |

### 通用字段

```typescript
interface BaseItem {
  type: "concept" | "example" | "exercise" | "definition" | "investigation";
  content_latex?: string;      // LaTeX 格式内容 (items_flat)
  content?: string;            // 纯文本内容 (sections/subsections)
  latex?: string | string[];   // LaTeX 公式
  source_images?: string[];    // 源图片引用
  image?: string;              // 单张图片引用
}
```

### items_flat Schema

```json
{
  "chapter": 1,
  "part": 1,
  "images_range": "1-40",
  "items": [
    {
      "type": "example",
      "content_latex": "Example 1\\n\\nWrite in product notation:\\n\\na $t \\times 6s$",
      "source_images": ["image1.png"]
    }
  ]
}
```

### sections Schema

```json
{
  "chapter": "12",
  "title": "Sets",
  "sections": [
    {
      "section": "Set Notation",
      "images": ["image1179.png"],
      "content": [
        {
          "type": "concept",
          "content": "The objects in a set are called elements.",
          "latex": ["\\in \\text{ means 'is a member of'}"]
        }
      ]
    }
  ]
}
```

---

## LaTeX 格式规范

### 行内公式

使用 `$...$` 包裹：

```latex
a $t \times 6s$
```

### 多行公式

使用 `\n` 换行，保持 `$...$` 包裹每个独立公式：

```latex
Solutions:\n\na $t \times 6s = 6st$\n\nb $4 \times k + m \times 3 = 4k + 3m$
```

### 常用符号

| 符号 | LaTeX | 示例 |
|------|-------|------|
| 乘号 | `\times` | $3 \times 4$ |
| 分数 | `\frac{a}{b}` | $\frac{1}{2}$ |
| 幂 | `^` | $x^2$ |
| 下标 | `_` | $a_n$ |
| 根号 | `\sqrt{}` | $\sqrt{x}$ |
| 不等号 | `\neq`, `\leq`, `\geq` | $x \neq 0$ |
| 属于 | `\in`, `\notin` | $x \in A$ |
| 集合 | `\{...\}` | $\{1, 2, 3\}$ |
| 省略号 | `\ldots` | $1, 2, \ldots$ |
| 空集 | `\varnothing` | $\varnothing$ |

### 避免的格式

❌ **Markdown 加粗**：`**text**` → 会被误判为格式污染
✅ 使用纯文本或 LaTeX `\textbf{}`

---

## 质量检查清单

### 文件级检查

```javascript
const PASS = (
  JSON.parse(content) !== null &&           // JSON 有效
  hasItems(data) &&                          // 有内容
  !hasAsteriskPollution(content) &&          // 无 ** 污染
  hasValidLatex(data)                        // LaTeX 格式正确
);
```

### 内容检查规则

1. **JSON 有效性**
   - 能被 `JSON.parse()` 解析
   - 常见错误：坐标点 `(-2, 1)` 应为 `[-2, 1]`

2. **星号污染检测**
   ```javascript
   const HAS_ASTERISK = /\*\*[^*]+\*\*/.test(content);
   // 清理方法
   content.replace(/\*\*([^*]+)\*\*/g, '$1');
   ```

3. **内容完整性**
   - `content_latex` 或 `content` 字段非空
   - 检查所有 items/content 数组元素

4. **章节匹配**
   - 文件名章节号 === 内容中 chapter 字段

---

## 踩坑经验

### JSON 格式错误

| 错误 | 原因 | 修复 |
|------|------|------|
| `[(-2, 1)]` | 坐标点不是有效 JSON | `[[-2, 1]]` |
| 尾随逗号 | JSON 不允许 | 删除最后的 `,` |
| 单引号 | JSON 只接受双引号 | `'` → `"` |

### 星号污染

Claude 提取时可能生成 `**加粗文字**`，需要清理：

```javascript
// 检测
/\*\*[^*]+\*\*/.test(content)

// 清理
content.replace(/\*\*([^*]+)\*\*/g, '$1')
```

### Schema 识别

不同文件使用不同 schema，检测顺序：

```javascript
if (data.items && !data.subsections && !data.sections) → items_flat
if (data.subsections?.[0]?.items) → subsections_items
if (data.subsections?.[0]?.content) → subsections_content
if (data.sections) → sections
if (data.concepts && data.examples) → categorized
if (data.extractions) → extractions
if (data.content && !data.items) → content_root
if (data.extracted_content) → extracted_content
if (data.topics) → topics
if (data.questions) → questions
```

### 内容字段差异

| Schema | 内容字段 | 备注 |
|--------|----------|------|
| items_flat | `content_latex` | 包含完整 LaTeX |
| sections | `content` + `latex` | 分离存储 |
| subsections_content | `content` | 可能无 LaTeX |

---

## 文件命名规范

```
ch{NN}_{topic}_part{N}.json
```

示例：
- `ch01_algebra_part1.json`
- `ch15_transformations_part2.json`

---

## 验证脚本

运行格式扫描：

```bash
node scripts/scan_format_issues.cjs
```

输出：
- 星号污染文件列表
- 内容缺失文件列表
- JSON 错误文件列表
- 每个文件的状态 (PASS/WARN/FAIL)
