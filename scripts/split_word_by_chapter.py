#!/usr/bin/env python3
"""
按章节标题拆分 Word 文档，统计每个章节的图片范围
使用 document.xml 字符位置确保精确顺序
"""

import re
from pathlib import Path

DOCX_DIR = Path("/Users/dingkai/cursorcode/QuestionBank/docx_extracted")
DOC_XML = DOCX_DIR / "word/document.xml"
RELS_XML = DOCX_DIR / "word/_rels/document.xml.rels"

def parse_rels():
    """解析 rels 文件，建立 rId -> image 编号的映射"""
    with open(RELS_XML, 'r') as f:
        content = f.read()
    pattern = r'Id="(rId\d+)"[^>]*Target="media/image(\d+)\.png"'
    matches = re.findall(pattern, content)
    return {rid: int(num) for rid, num in matches}

def extract_chapter_image_ranges():
    """从 document.xml 提取章节和图片的对应关系"""
    with open(DOC_XML, 'r') as f:
        content = f.read()

    rid_to_image = parse_rels()

    # 找到所有 Heading 1 段落（样式值为 "1"）
    # 使用正则表达式找到段落及其样式
    heading1_pattern = re.compile(
        r'<w:p[^>]*>.*?<w:pStyle\s+w:val="1"/>.*?</w:p>',
        re.DOTALL
    )

    # 找到所有图片引用
    img_pattern = re.compile(r'r:embed="(rId\d+)"')

    # 收集所有事件（标题和图片）及其位置
    events = []

    # 找标题
    for m in heading1_pattern.finditer(content):
        para_content = m.group(0)
        pos = m.start()
        # 提取标题文本
        text_matches = re.findall(r'<w:t[^>]*>([^<]*)</w:t>', para_content)
        title = ''.join(text_matches).strip()
        if title:
            events.append(('heading', title, pos))

    # 找图片
    for m in img_pattern.finditer(content):
        rid = m.group(1)
        img_num = rid_to_image.get(rid, 0)
        if img_num > 0:
            events.append(('image', img_num, m.start()))

    # 按位置排序
    events.sort(key=lambda x: x[2])

    # 计算每个章节的图片范围
    chapters = []
    current_chapter = None
    chapter_images = []

    for etype, value, pos in events:
        if etype == 'heading':
            if current_chapter:
                chapters.append((current_chapter, chapter_images.copy()))
            current_chapter = value
            chapter_images = []
        elif etype == 'image':
            chapter_images.append(value)

    # 添加最后一个章节
    if current_chapter:
        chapters.append((current_chapter, chapter_images.copy()))

    return chapters

def main():
    print("从 document.xml 提取章节图片范围...\n")

    chapters = extract_chapter_image_ranges()

    print(f"找到 {len(chapters)} 个章节\n")
    print("章节图片范围:")
    print("=" * 80)

    total_images = 0
    results = []

    for i, (title, images) in enumerate(chapters):
        if images:
            start_img = min(images)
            end_img = max(images)
            count = len(images)
        else:
            start_img = end_img = count = 0

        total_images += count
        ch_id = f"ch{i+1:02d}"
        results.append((ch_id, title, start_img, end_img, count))
        print(f"{ch_id}: image{start_img:4d} - image{end_img:4d}  ({count:4d} imgs)  {title[:45]}")

    print(f"\n总计: {total_images} 张图片")

    # 输出 JSON
    print("\n" + "=" * 80)
    print("JSON 格式:")
    print("{")
    for ch_id, title, start, end, count in results:
        safe_title = title.replace('"', '\\"')
        print(f'  "{ch_id}": {{"title": "{safe_title}", "start": {start}, "end": {end}}},')
    print("}")

if __name__ == "__main__":
    main()
