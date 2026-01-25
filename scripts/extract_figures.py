#!/usr/bin/env python3
"""
组合图表裁切管道：MinerU + Grounding DINO
- MinerU: 擅长完整图表（含标题、轴标签）
- Grounding DINO: 擅长独立小图形（几何形状等）
- IoU 去重合并，过滤整页误检
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection


# ── 配置 ──────────────────────────────────────────────
MINERU_BIN = "/home/dkai/.venvs/mineru/bin/magic-pdf"
GDINO_MODEL_ID = "IDEA-Research/grounding-dino-base"
GDINO_PROMPT = "chart. diagram. figure. geometric shape. graph. table. picture."
GDINO_BOX_THRESHOLD = 0.2
GDINO_TEXT_THRESHOLD = 0.2
IOU_MERGE_THRESHOLD = 0.3  # IoU > 此值视为同一区域
PAGE_AREA_RATIO = 0.6       # 面积占比 > 此值视为整页误检


# ── 工具函数 ───────────────────────────────────────────
def compute_iou(box1, box2):
    """计算两个 bbox 的 IoU。box 格式: (x1, y1, x2, y2)"""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - inter

    return inter / union if union > 0 else 0


def is_whole_page(box, img_w, img_h):
    """判断 bbox 是否覆盖了整页"""
    area = (box[2] - box[0]) * (box[3] - box[1])
    page_area = img_w * img_h
    return area / page_area > PAGE_AREA_RATIO


def poly_to_bbox(poly, scale_x=1.0, scale_y=1.0):
    """MinerU poly [x1,y1,x2,y2,x3,y3,x4,y4] → bbox (x1,y1,x2,y2)"""
    xs = [poly[i] * scale_x for i in range(0, len(poly), 2)]
    ys = [poly[i] * scale_y for i in range(1, len(poly), 2)]
    return (min(xs), min(ys), max(xs), max(ys))


# ── MinerU 提取 ───────────────────────────────────────
def run_mineru(image_path, output_dir):
    """运行 MinerU，返回检测到的图表区域列表"""
    img_name = Path(image_path).stem
    mineru_out = os.path.join(output_dir, "mineru", img_name)

    # 运行 MinerU
    cmd = [MINERU_BIN, "-p", image_path, "-o", os.path.join(output_dir, "mineru"), "-m", "auto"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    # 读取 model.json 获取 bbox
    model_json = os.path.join(mineru_out, "auto", f"{img_name}_model.json")
    if not os.path.exists(model_json):
        print(f"  [MinerU] 无输出: {model_json}")
        return []

    with open(model_json) as f:
        model_data = json.load(f)

    page = model_data[0]
    page_w = page["page_info"]["width"]
    page_h = page["page_info"]["height"]

    # 获取原图尺寸计算缩放
    img = Image.open(image_path)
    img_w, img_h = img.size
    scale_x = img_w / page_w
    scale_y = img_h / page_h

    # 提取 figure 区域 (category_id=3)
    figures = []
    images_dir = os.path.join(mineru_out, "auto", "images")

    for det in page["layout_dets"]:
        if det["category_id"] == 3 and det["score"] > 0.5:
            bbox = poly_to_bbox(det["poly"], scale_x, scale_y)
            bbox = tuple(int(v) for v in bbox)

            if is_whole_page(bbox, img_w, img_h):
                continue

            # 找到对应的裁切图
            crop_path = None
            if os.path.exists(images_dir):
                crops = os.listdir(images_dir)
                if crops:
                    # MinerU 按顺序生成，取第一个匹配的
                    crop_path = os.path.join(images_dir, crops[0]) if len(crops) == 1 else None
                    # 如果有多个 crop，尝试匹配 (简化处理)
                    if len(crops) > 0:
                        crop_path = os.path.join(images_dir, crops[len(figures)])  if len(figures) < len(crops) else None

            figures.append({
                "source": "mineru",
                "bbox": bbox,
                "score": det["score"],
                "label": "figure",
                "crop_path": crop_path,
            })

    print(f"  [MinerU] 检测到 {len(figures)} 个图表区域")
    return figures


# ── Grounding DINO 提取 ────────────────────────────────
class GDINODetector:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading Grounding DINO on {self.device}...")
        self.processor = AutoProcessor.from_pretrained(GDINO_MODEL_ID)
        self.model = AutoModelForZeroShotObjectDetection.from_pretrained(GDINO_MODEL_ID).to(self.device)
        print("Grounding DINO ready.")

    def detect(self, image_path, output_dir):
        """运行 GDINO，返回检测到的图形区域列表"""
        img_name = Path(image_path).stem
        gdino_out = os.path.join(output_dir, "gdino", img_name)
        os.makedirs(gdino_out, exist_ok=True)

        image = Image.open(image_path).convert("RGB")
        img_w, img_h = image.size

        inputs = self.processor(images=image, text=GDINO_PROMPT, return_tensors="pt").to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)

        results = self.processor.post_process_grounded_object_detection(
            outputs,
            inputs.input_ids,
            threshold=GDINO_BOX_THRESHOLD,
            text_threshold=GDINO_TEXT_THRESHOLD,
            target_sizes=[image.size[::-1]]
        )[0]

        figures = []
        for i, (box, score, label) in enumerate(zip(
            results["boxes"].cpu().tolist(),
            results["scores"].cpu().tolist(),
            results["labels"]
        )):
            bbox = tuple(int(v) for v in box)

            if is_whole_page(bbox, img_w, img_h):
                continue

            # 裁切并保存
            x1, y1, x2, y2 = bbox
            cropped = image.crop((x1, y1, x2, y2))
            crop_path = os.path.join(gdino_out, f"crop_{i}_{label.replace(' ','_')[:20]}.jpg")
            cropped.save(crop_path, quality=95)

            figures.append({
                "source": "gdino",
                "bbox": bbox,
                "score": score,
                "label": label,
                "crop_path": crop_path,
            })

        print(f"  [GDINO] 检测到 {len(figures)} 个图形区域 (过滤整页后)")
        return figures


# ── 合并去重 ───────────────────────────────────────────
def merge_detections(mineru_figs, gdino_figs, image_path, output_dir):
    """合并两个来源的检测结果，IoU 去重"""
    img_name = Path(image_path).stem
    merged_dir = os.path.join(output_dir, "merged", img_name)
    os.makedirs(merged_dir, exist_ok=True)

    image = Image.open(image_path).convert("RGB")

    # 先加入所有 MinerU 结果（优先，因为图表更完整）
    merged = list(mineru_figs)

    # 逐个检查 GDINO 结果，只保留不重叠的
    for gfig in gdino_figs:
        is_duplicate = False
        for mfig in merged:
            iou = compute_iou(gfig["bbox"], mfig["bbox"])
            if iou > IOU_MERGE_THRESHOLD:
                is_duplicate = True
                break

        if not is_duplicate:
            merged.append(gfig)

    # 保存合并后的裁切图
    results = []
    for i, fig in enumerate(merged):
        x1, y1, x2, y2 = fig["bbox"]
        cropped = image.crop((x1, y1, x2, y2))

        src_tag = "M" if fig["source"] == "mineru" else "G"
        crop_name = f"fig_{i:02d}_{src_tag}_{fig['label'].replace(' ','_')[:15]}.jpg"
        crop_path = os.path.join(merged_dir, crop_name)
        cropped.save(crop_path, quality=95)

        results.append({
            "index": i,
            "source": fig["source"],
            "label": fig["label"],
            "score": round(fig["score"], 3),
            "bbox": list(fig["bbox"]),
            "crop_file": crop_name,
        })

    # 保存元数据
    meta_path = os.path.join(merged_dir, "figures.json")
    with open(meta_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"  [合并] MinerU={len(mineru_figs)}, GDINO={len(gdino_figs)} → 合并后={len(results)}")
    return results


# ── 主函数 ─────────────────────────────────────────────
def process_image(image_path, output_dir, gdino_detector):
    """处理单张全页截图"""
    img_name = Path(image_path).name
    print(f"\n{'='*60}")
    print(f"处理: {img_name}")
    print(f"{'='*60}")

    # 1. MinerU
    mineru_figs = run_mineru(image_path, output_dir)

    # 2. Grounding DINO
    gdino_figs = gdino_detector.detect(image_path, output_dir)

    # 3. 合并
    merged = merge_detections(mineru_figs, gdino_figs, image_path, output_dir)

    return merged


def main():
    import argparse
    parser = argparse.ArgumentParser(description="MinerU + GDINO 组合图表裁切")
    parser.add_argument("--images", nargs="+", required=True, help="待处理的图片路径")
    parser.add_argument("--output", required=True, help="输出目录")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)

    # 初始化 GDINO (只加载一次)
    gdino = GDINODetector()

    all_results = {}
    for img_path in args.images:
        results = process_image(img_path, args.output, gdino)
        all_results[Path(img_path).name] = results

    # 汇总
    print(f"\n{'='*60}")
    print("汇总:")
    for name, figs in all_results.items():
        sources = [f["source"] for f in figs]
        m_count = sources.count("mineru")
        g_count = sources.count("gdino")
        print(f"  {name}: {len(figs)} 个图表 (MinerU={m_count}, GDINO独有={g_count})")


if __name__ == "__main__":
    main()
