# Year 4 Math 文档分析与处理方案

> 此文档记录了对 Year 4 math.docx 的技术分析结论和处理方案决策。

## 1. 文档结构分析

### 基本信息
- **文件**: Year 4 math.docx (604 MB)
- **已解压到**: `year4_extracted/`
- **总图片数**: 366 张 (word/media/)
- **图片类型**: 323 png + 18 jpeg + 25 gif
- **XML 文本**: 50,159 字符，1,436 段落

### 文档性质：混合型（主要是情况 A）
- **293 张全页截图** (~2200x3090 像素) — 教材页面扫描/截图
- **33 张小图** (≤800px) — 概念说明用的独立图表
- **大量原生文本** — 部分内容在 XML 中有文字（与截图内容部分重复）

### 5 个 Unit 结构

| Unit | 段落范围 | 文本量 | 图片数 | 图片范围 |
|------|---------|--------|--------|---------|
| Unit 1 graph | P0-P239 | 10,798 chars | 51 | image1-51 |
| Unit 2 numbers | P240-P672 | 20,261 chars | 38 | image52-89 |
| Unit 3 fraction | P673-P910 | 4,124 chars | 92 | image90-181 |
| Unit 4 decimal | P911-P1067 | 4,892 chars | 35 | image182-216 |
| Unit 5 geometry | P1068-P1435 | 9,938 chars | 150 | image217-366 |

### Unit 1 详细结构 (前 60 段落)
```
P0: "Year 4 math"
P1: "Unit 1 graph"
P2-P3: 概念 - Pictogram
P4: [小图 image1.png 630x431] — 象形统计图
P5: 概念 - Bar chart
P6: [小图 image2.png 493x406] — 柱状图示例
P7: 概念 - Line graph
P8: [小图 image3.png 630x563] — 折线图
P9-P10: 概念 - Pie chart
P11: [小图 image4.jpeg] — 饼图
P12: 概念 - Histogram
P13: [小图 image5.png 717x484] — 直方图
P14: Tables
P15: [小图 image6.png 344x180] — 表格
P16-P17: 概念说明 + image7.png
P18-P21: Bar Graphs 练习说明文字
P22: [全页截图 image8.png 2199x3092] — 第155页
P23-P28: 题目文字 (a)-(f)
...后续为更多全页截图练习题
```

## 2. 图表裁切方案：MinerU + Grounding DINO 组合

### PoC 测试结论

| 页面类型 | MinerU 单独 | GDINO 单独 | 组合 |
|---------|------------|-----------|------|
| 柱状图 (image8) | ✅ 完整(含标题轴标签) | ⚠️ 丢标题轴标签 | ✅ 用 MinerU |
| 几何图形 (image220, 6个) | ❌ 合并成3组 | ✅ 6个独立 | ✅ 6/6 全覆盖 |
| 分数条 (image95, q1-3) | ✅ 3条全切 | ❌ 没检测到 | ✅ 用 MinerU |
| 分数圆 (image95, q4-6) | ❌ 完全丢失 | ⚠️ 只切分割圆 | ⚠️ 需要定向 prompt |

### 关键发现：GDINO prompt 调整可以解决漏切
- 通用 prompt `"chart. diagram. figure. geometric shape."` → 灰色纯圆检测不到
- 定向 prompt `"circle. filled circle. shaded circle. solid circle."` → **所有圆全部找到**
- 这验证了「LLM 评估 → 生成定向 prompt → GDINO 重跑」闭环的可行性

### 最终方案：4 轮 LLM 驱动闭环

```
全页截图 → MinerU（一次性，切大图表）
         → GDINO 第1轮（通用 prompt）
         → 合并 + LLM 评估
         → 如果缺失 → LLM 生成定向 prompt → GDINO 第2轮
         → 合并 + LLM 评估
         → ... 最多4轮
         → 超过4轮 → 标记 figure_status="missing"，人工补全
```

- **MinerU**: 擅长完整图表（柱状图含标题和轴标签）
- **GDINO**: 擅长独立小图形，prompt 可定制
- **LLM (Claude Opus 4.5)**: 评估裁切完整性，生成定向 prompt
- 合并时用 **IoU 去重**（阈值 0.3），过滤整页误检（面积 > 60% 页面）

### 工具环境
- **MinerU**: `/home/dkai/.venvs/mineru/bin/magic-pdf` (v1.3.12)
- **Grounding DINO**: `IDEA-Research/grounding-dino-base` (通过 mineru venv 的 transformers 4.57.6)
- **GPU**: NVIDIA (12GB), CUDA 12.9
- **脚本**: `scripts/extract_figures.py` — 已实现 MinerU + GDINO 合并（未含 LLM 闭环）

## 3. 管道多源化改造（待执行）

### 硬编码问题清单

| 文件 | 问题 | 修改 |
|------|------|------|
| `scripts/import-chapter.cjs:56` | `STORAGE_PATH = 'algebra'` | 按 --source 参数决定 |
| `scripts/import-chapter.cjs:54` | `IMAGES_DIR` 指向 docx_extracted | 按 source 切换目录 |
| `scripts/import-chapter.cjs:123-128` | `getChapterFromDB` 无 source_id 过滤 | 加 source_id 条件 |
| `web/src/lib/supabase.ts:11` | `getImageUrl` 硬编码 `algebra/` | 用 storage_path 字段 |
| `web/src/app/page.tsx:8-18` | 查询所有 chapters 无 source 过滤 | 按 source 分组 |
| `web/src/app/page.tsx:88` | 标题硬编码 "Algebra" | 动态显示 |
| `chapter_image_ranges.json` | 只有 algebra | 新建 configs/year4/ |

### 图片存储
- Algebra: `question-images/algebra/`
- Year 4: `question-images/year4/` （独立子目录避免命名冲突）

### 数据库
- `sources`、`chapters.source_id`、`images.source_id` 字段已存在，只需正确使用
- 新增 1 行 sources（"Year 4 math"）
- 新增对应 chapters 和 items

## 4. 下一步执行计划

### 试验范围：Unit 1 前 15 张图 (image1-15)
- image1-7: 概念说明小图（象形图、柱状图、折线图、饼图、直方图、表格）
- image8-15: 练习题全页截图（含柱状图等需要裁切的图表）

### 执行步骤
1. **管道多源化改造** — import 脚本 + web 前端支持多 source
2. **压缩图片** — year4_extracted/word/media/ → media_compressed/
3. **图表裁切** — 对 image8-15 跑 MinerU + GDINO 组合管道
4. **LLM 闭环验证** — 人工在 Claude Code 中评估每张裁切图，必要时增加 GDINO 轮次
5. **内容提取** — LLM 读全页截图提取文字 + LaTeX
6. **生成 extraction JSON** — extractions/year4/ch01_part1.json
7. **数据库导入** — `node scripts/import-chapter.cjs --ch=1 --source=year4`
8. **验证** — Web 前端查看效果

### 数据模型扩展
题目 JSON 增加 figure_images 字段：
```json
{
  "type": "exercise",
  "content_latex": "1. Study the bar graph...\n\n[figure:fig_01.jpg]\n\n(a) ___ apples were sold.",
  "source_images": ["image8.png"],
  "figure_images": ["fig_01_bar_chart.jpg"],
  "figure_status": "complete"  // or "missing"
}
```
