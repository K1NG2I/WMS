import sharp from "sharp";

const JPEG_QUALITY = 95;
const ANALYSIS_SIZE = 200;

async function analyzeBrightRegion(buffer) {
  const meta = await sharp(buffer).metadata();
  const ow = meta.width || 1;
  const oh = meta.height || 1;

  const { data, info } = await sharp(buffer)
    .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const threshold = 180;

  const rowBright = new Float64Array(h);
  const colBright = new Float64Array(w);
  let totalBright = 0;
  let brightPixels = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = data[y * w + x];
      if (v > threshold) {
        rowBright[y]++;
        colBright[x]++;
        totalBright += v;
        brightPixels++;
      }
    }
  }

  if (brightPixels < w * h * 0.05) {
    return null;
  }

  let top = 0, bottom = h - 1;
  for (let y = 0; y < h; y++) {
    if (rowBright[y] > w * 0.15) { top = y; break; }
  }
  for (let y = h - 1; y >= 0; y--) {
    if (rowBright[y] > w * 0.15) { bottom = y; break; }
  }

  let left = 0, right = w - 1;
  for (let x = 0; x < w; x++) {
    if (colBright[x] > h * 0.1) { left = x; break; }
  }
  for (let x = w - 1; x >= 0; x--) {
    if (colBright[x] > h * 0.1) { right = x; break; }
  }

  const padPx = 3;
  top = Math.max(0, top - padPx);
  bottom = Math.min(h - 1, bottom + padPx);
  left = Math.max(0, left - padPx);
  right = Math.min(w - 1, right + padPx);

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;
  if (cropW < w * 0.2 || cropH < h * 0.2) return null;

  const scaleX = ow / w;
  const scaleY = oh / h;

  // Generous padding for tilted documents — corners extend beyond the
  // axis-aligned bounding box of the bright region.
  const padXPct = Math.round(cropW * scaleX * 0.25);
  const padYPct = Math.round(cropH * scaleY * 0.15);

  const rawLeft = Math.max(0, Math.round(left * scaleX) - padXPct);
  const rawTop = Math.max(0, Math.round(top * scaleY) - padYPct);
  const rawW = Math.round(cropW * scaleX) + padXPct * 2;
  const rawH = Math.round(cropH * scaleY) + padYPct * 2;

  const finalW = Math.min(rawW, ow - rawLeft);
  const finalH = Math.min(rawH, oh - rawTop);

  if (finalW < 100 || finalH < 100) return null;

  return { left: rawLeft, top: rawTop, width: finalW, height: finalH };
}

async function preprocessImage(buffer) {
  console.log(`[preprocess] input: ${buffer.length} bytes`);
  try {
    const region = await analyzeBrightRegion(buffer);
    let pipeline = sharp(buffer);

    if (region) {
      console.log(`[preprocess] document region: ${region.left},${region.top} ${region.width}x${region.height}`);
      pipeline = pipeline.extract(region);
    } else {
      console.log(`[preprocess] no bright region detected — using full image`);
    }

    const meta = await pipeline.metadata();
    if ((meta.width || 0) < 1500) {
      pipeline = pipeline.resize({ width: 1500, kernel: "lanczos3" });
    }

    const out = await pipeline
      .normalise({ low: 2, high: 98 })
      .sharpen({ sigma: 0.8 })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    console.log(`[preprocess] output: ${out.length} bytes`);
    return out;
  } catch (err) {
    console.error("[preprocess] error:", err.message);
    return buffer;
  }
}

export { preprocessImage };
