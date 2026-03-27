import os
from PIL import Image
from io import BytesIO


ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif"}


def list_images(site_root, slug):
    path = os.path.join(site_root, "foto", slug)
    if not os.path.isdir(path):
        return []
    return sorted([f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))])


def _next_name(path, slug):
    existing = [f for f in os.listdir(path) if f.lower().endswith(".jpg")]
    nums = []
    for f in existing:
        stem = os.path.splitext(f)[0]
        if stem.startswith(f"{slug}-"):
            tail = stem[len(slug)+1:]
            if tail.isdigit():
                nums.append(int(tail))
    n = max(nums, default=0) + 1
    return f"{slug}-{n:02d}.jpg"


def save_image(site_root, slug, storage):
    path = os.path.join(site_root, "foto", slug)
    os.makedirs(path, exist_ok=True)

    ext = os.path.splitext(storage.filename or "")[1].lower()
    if ext not in ALLOWED_EXTS and ext:
        raise ValueError(f"Unsupported format: {ext}")

    data = storage.read()
    img = Image.open(BytesIO(data)).convert("RGB")
    name = _next_name(path, slug)
    img.save(os.path.join(path, name), "JPEG", quality=92)
    return name
