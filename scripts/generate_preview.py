#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")

MODEL_DIR = Path(os.environ.get("PIXEL_MODEL_DIR", "/Users/chengyongwei/Documents/326_ckpt_SD_XL"))


def make_dirs(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)


def is_lfs_pointer(path: Path) -> bool:
    try:
        if not path.exists() or path.stat().st_size > 512:
            return False
        head = path.read_text(errors="ignore")
        return head.startswith("version https://git-lfs.github.com/spec/v1")
    except Exception:
        return False


def generate_fallback(prompt: str, output_path: Path, model_dir: Path):
    from PIL import Image, ImageDraw

    cover = model_dir / "_cover_images_" / "cover_image.png"
    if cover.exists():
      img = Image.open(cover).convert("RGB").resize((768, 384))
    else:
      img = Image.new("RGB", (768, 384), (18, 24, 48))

    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((16, 16, 752, 368), radius=18, outline=(130, 170, 255), width=2)
    draw.text((32, 32), "Preview Fallback", fill=(220, 230, 255))
    draw.text((32, 80), f"Model Dir: {model_dir.name}", fill=(180, 200, 255))

    lines = []
    raw = f"Prompt: {prompt}".strip()
    while raw:
      lines.append(raw[:56])
      raw = raw[56:]
      if len(lines) >= 6:
        break

    y = 132
    for line in lines:
      draw.text((32, y), line, fill=(240, 245, 255))
      y += 28

    make_dirs(output_path)
    img.save(output_path)

    return {
      "fallback": True,
      "model_file": None,
      "message": "diffusers 未安装，已输出占位预览图",
    }


def try_generate(prompt: str, output_path: Path, model_dir: Path):
    try:
      import torch
      from diffusers import StableDiffusionXLPipeline
    except Exception:
      return generate_fallback(prompt, output_path, model_dir)

    model_files = list(model_dir.glob("*.safetensors"))
    if not model_files:
      return generate_fallback(prompt, output_path, model_dir)

    model_file = model_files[0]
    if is_lfs_pointer(model_file):
      meta = generate_fallback(prompt, output_path, model_dir)
      meta["message"] = "模型文件仍是 git-lfs 指针，请先拉取真实权重"
      return meta
    device = "cuda" if torch.cuda.is_available() else "mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else "cpu"
    dtype = torch.float16 if device in {"cuda", "mps"} else torch.float32

    pipe = StableDiffusionXLPipeline.from_single_file(str(model_file), torch_dtype=dtype, use_safetensors=True)
    pipe = pipe.to(device)
    image = pipe(
      prompt=f"{prompt}, pixel art, retro game scene, detailed environment, coherent composition",
      negative_prompt="blurry, low quality, deformed, text, watermark",
      num_inference_steps=18,
      guidance_scale=6.0,
      height=384,
      width=768,
    ).images[0]

    make_dirs(output_path)
    image.save(output_path)
    return {
      "fallback": False,
      "model_file": model_file.name,
      "message": "已使用本地模型生成预览图",
    }


def main():
    if len(sys.argv) < 3:
      print(json.dumps({"success": False, "error": "usage: generate_preview.py <prompt> <output_path>"}))
      return 1

    prompt = sys.argv[1]
    output_path = Path(sys.argv[2]).expanduser().resolve()
    model_dir = MODEL_DIR.expanduser().resolve()

    meta = try_generate(prompt, output_path, model_dir)
    print(json.dumps({
      "success": True,
      "output_path": str(output_path),
      "model_dir": str(model_dir),
      **meta,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
