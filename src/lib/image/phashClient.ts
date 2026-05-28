export type PHashHex64 = string; // 16 hex chars for 64-bit hash

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function toGrayscale(r: number, g: number, b: number) {
  // sRGB luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function dct2d(input: number[], size: number) {
  // Naive DCT-II implementation for small sizes (32x32).
  const out = new Array(size * size).fill(0);
  const c = (i: number) => (i === 0 ? 1 / Math.sqrt(2) : 1);
  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let sum = 0;
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const pixel = input[x * size + y];
          sum +=
            pixel *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
        }
      }
      out[u * size + v] = (2 / size) * c(u) * c(v) * sum;
    }
  }
  return out;
}

function median(xs: number[]) {
  if (xs.length === 0) return 0;
  const a = [...xs].sort((p, q) => p - q);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 === 0 ? (a[mid - 1] + a[mid]) / 2 : a[mid];
}

function hexPad(n: bigint, width: number) {
  let h = n.toString(16);
  while (h.length < width) h = `0${h}`;
  return h;
}

export async function computePHashFromFile(file: File): Promise<{ phash: PHashHex64; quality: number }> {
  // Draw into 32x32 grayscale, DCT, take top-left 8x8.
  const bmp = await createImageBitmap(file);
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unsupported");

  ctx.drawImage(bmp, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const gray = new Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const r = data[i * 4 + 0] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    gray[i] = toGrayscale(r, g, b);
  }

  const dct = dct2d(gray, size);
  const block: number[] = [];
  // Take 8x8 block; exclude [0,0] when computing median.
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      if (u === 0 && v === 0) continue;
      block.push(dct[u * size + v]);
    }
  }
  const m = median(block);

  let bits = 0n;
  let bitIdx = 0n;
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      const val = dct[u * size + v];
      const bit = val > m ? 1n : 0n;
      bits |= bit << (63n - bitIdx);
      bitIdx++;
    }
  }

  // Quality is heuristic: based on image size. Bitmap always scaled to 32, so use file size.
  const quality = clamp01(Math.log10(Math.max(1024, file.size)) / 7);
  return { phash: hexPad(bits, 16), quality };
}

export function hammingDistanceHex64(a: PHashHex64, b: PHashHex64) {
  const x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = x;
  let count = 0;
  while (n) {
    n &= n - 1n;
    count++;
  }
  return count;
}

