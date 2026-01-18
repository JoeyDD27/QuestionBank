#!/usr/bin/env python3
"""
根据 Word 文档分页标记，精确映射页码到图片编号
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

def extract_pages_and_images():
    """提取每一页包含的图片"""
    with open(DOC_XML, 'r') as f:
        content = f.read()

    rid_to_image = parse_rels()

    # 找到所有分页标记和图片引用的位置
    page_break_pattern = re.compile(r'<w:lastRenderedPageBreak/>')
    img_pattern = re.compile(r'r:embed="(rId\d+)"')

    page_breaks = [m.start() for m in page_break_pattern.finditer(content)]
    img_refs = [(m.start(), m.group(1)) for m in img_pattern.finditer(content)]

    print(f"找到 {len(page_breaks)} 个分页标记")
    print(f"找到 {len(img_refs)} 个图片引用")

    # 为每张图片确定所在页码
    # 页码 = 该图片位置之前有多少个分页标记 + 1
    image_to_page = {}
    page_to_images = {}

    for img_pos, rid in img_refs:
        img_num = rid_to_image.get(rid, 0)
        if img_num == 0:
            continue

        # 计算这张图片在第几页
        page_num = 1
        for pb_pos in page_breaks:
            if pb_pos < img_pos:
                page_num += 1
            else:
                break

        image_to_page[img_num] = page_num

        if page_num not in page_to_images:
            page_to_images[page_num] = []
        page_to_images[page_num].append(img_num)

    return image_to_page, page_to_images

def main():
    print("解析 Word 文档...\n")
    image_to_page, page_to_images = extract_pages_and_images()

    # 统计信息
    all_images = sorted(image_to_page.keys())
    all_pages = sorted(page_to_images.keys())

    print(f"\n图片范围: image{min(all_images)} - image{max(all_images)}")
    print(f"页码范围: 第{min(all_pages)}页 - 第{max(all_pages)}页")

    # 目录：(章节ID, 标题, 起始页码)
    TOC = [
        ("ch01", "Algebra", 11),
        ("ch02", "Expansion and Factorisation", 70),
        ("ch03", "Solving equations", 145),
        ("ch04", "Simultaneous equations", 220),
        ("ch05", "Inequalities", 246),
        ("ch06", "Straight line", 260),
        ("ch07", "Quadratic function", 284),
        ("ch08", "sets", 343),
        ("ch09", "Functions", 398),
        ("ch10", "Transformation of functions", 454),
        ("ch11", "logarithms", 524),
        ("ch12", "Number sequences", 560),
        ("ch13", "series", 583),
        ("ch14", "Number", 614),
        ("ch15", "matrices", 650),
        ("ch16", "polynomials", 662),
        ("ch17", "Polynomial equations", 697),
        ("ch18", "Percentage", 704),
        ("ch19", "Ratio and proportion", 730),
        ("ch20", "rates", 747),
        ("ch21", "Problem solving", 759),
    ]

    # 计算每个章节的图片范围
    print("\n" + "="*70)
    print("章节图片范围（基于分页标记）:")
    print("="*70)

    results = []
    for i, (ch_id, title, start_page) in enumerate(TOC):
        # 确定该章节的页码范围
        if i + 1 < len(TOC):
            end_page = TOC[i+1][2] - 1
        else:
            end_page = max(all_pages)

        # 收集该页码范围内的所有图片
        chapter_images = []
        for page in range(start_page, end_page + 1):
            if page in page_to_images:
                chapter_images.extend(page_to_images[page])

        if chapter_images:
            chapter_images.sort()
            start_img = min(chapter_images)
            end_img = max(chapter_images)
            count = len(chapter_images)
        else:
            start_img = end_img = count = 0

        results.append((ch_id, title, start_img, end_img, count, start_page, end_page))
        print(f"{ch_id}: image{start_img:4d} - image{end_img:4d}  ({count:4d} imgs)  页{start_page}-{end_page}  {title}")

    # 输出 JSON
    print("\n" + "="*70)
    print("JSON 格式:")
    print("="*70)
    print("{")
    for ch_id, title, start_img, end_img, count, start_page, end_page in results:
        print(f'  "{ch_id}": {{"title": "{title}", "start": {start_img}, "end": {end_img}, "pages": [{start_page}, {end_page}]}},')
    print("}")

if __name__ == "__main__":
    main()
