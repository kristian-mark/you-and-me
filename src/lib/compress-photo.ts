const MAX_SIDE = 480;
const MAX_CHARS = 45_000;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
}

function draw(img: HTMLImageElement, side: number) {
  const scale = Math.min(1, side / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let quality = 0.7;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > MAX_CHARS && quality > 0.28) {
    quality -= 0.12;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  if (out.length > MAX_CHARS && side > 240) {
    return draw(img, Math.round(side * 0.72));
  }
  return out.length > MAX_CHARS ? "" : out;
}

export async function compressPhotoFile(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return draw(img, MAX_SIDE);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressPhotoData(dataUrl: string) {
  if (!dataUrl) return "";
  if (/^https?:\/\//i.test(dataUrl) || dataUrl.startsWith("blob:")) return dataUrl;
  if (dataUrl.length <= MAX_CHARS && dataUrl.startsWith("data:image/jpeg")) return dataUrl;
  try {
    const img = await loadImage(dataUrl);
    return draw(img, MAX_SIDE);
  } catch {
    return "";
  }
}
