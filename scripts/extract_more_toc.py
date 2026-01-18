#!/usr/bin/env python3
import fitz
from pathlib import Path

PDF_PATH = Path("/Users/dingkai/cursorcode/QuestionBank/Algebra full.pdf")
OUTPUT_DIR = Path("/Users/dingkai/cursorcode/QuestionBank/pdf_pages")

doc = fitz.open(PDF_PATH)
OUTPUT_DIR.mkdir(exist_ok=True)

# 提取更多目录页和所有章节起始页
for page_num in [6, 7, 8, 9, 10]:  # 更多目录页
    page = doc[page_num]
    mat = fitz.Matrix(1.5, 1.5)
    pix = page.get_pixmap(matrix=mat)
    pix.save(OUTPUT_DIR / f"toc_{page_num+1}.png")
    print(f"保存目录页 {page_num+1}")

doc.close()
