#!/usr/bin/env python3
"""
提取所有章节起始页并与图片对比验证
"""

import fitz
from pathlib import Path
import json

PDF_PATH = Path("/Users/dingkai/cursorcode/QuestionBank/Algebra full.pdf")
OUTPUT_DIR = Path("/Users/dingkai/cursorcode/QuestionBank/pdf_pages/chapters")
JSON_PATH = Path("/Users/dingkai/cursorcode/QuestionBank/chapter_image_ranges.json")

# 从 PDF 目录获取的章节页码
CHAPTER_PAGES = {
    "ch01": (11, "Algebra"),
    "ch02": (70, "Expansion and Factorisation"),
    "ch03": (82, "Simplifying algebraic fractions"),
    "ch04": (96, "Expansion of radical expressions"),
    "ch05": (100, "Factorization and simplication"),
    "ch06": (145, "Solving equations"),
    "ch07": (175, "Problem solving with algebra"),
    "ch08": (220, "Simultaneous equations"),
    "ch09": (246, "Inequalities"),
    "ch10": (260, "Straight line"),
    "ch11": (284, "Quadratic function"),
    "ch12": (343, "sets"),
    "ch13": (355, "Venn diagrams"),
    "ch14": (398, "Functions"),
    "ch15": (454, "Transformation of functions"),
    "ch16": (524, "logarithms"),
    "ch17": (557, "summary"),
    "ch18": (560, "Number sequences"),
    "ch19": (583, "series"),
    "ch20": (598, "Applications of geometric sequences"),
    "ch21": (614, "Number"),
    "ch22": (650, "matrices"),
    "ch23": (662, "polynomials"),
    "ch24": (697, "Polynomial equations"),
    "ch25": (704, "Percentage"),
    "ch26": (730, "Ratio and proportion"),
    "ch27": (747, "rates"),
    "ch28": (759, "Problem solving"),
    "ch29": (772, "Financial mathematics"),
    "ch30": (791, "Complex numbers"),
    "ch31": (805, "Geometry in the complex plane"),
    "ch32": (824, "The binomial theorem"),
    "ch33": (837, "Reasoning and proof"),
}

def extract_chapter_pages():
    """提取所有章节起始页"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(PDF_PATH)
    print(f"PDF 共有 {len(doc)} 页\n")

    for ch_id, (page_num, title) in CHAPTER_PAGES.items():
        page_idx = page_num - 1
        if page_idx < len(doc):
            page = doc[page_idx]
            mat = fitz.Matrix(1.2, 1.2)
            pix = page.get_pixmap(matrix=mat)
            output_path = OUTPUT_DIR / f"{ch_id}_p{page_num}.png"
            pix.save(output_path)
            print(f"{ch_id}: 第 {page_num} 页 ({title[:30]})")

    doc.close()
    print(f"\n已保存到 {OUTPUT_DIR}")

if __name__ == "__main__":
    extract_chapter_pages()
