const C128 = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232",
];

export function code128Pattern(text: string) {
  const value = text.replace(/\s+/g, "");
  if (!value) return "";
  const digits = /^\d+$/.test(value) && value.length % 2 === 0;
  const codes: number[] = [];
  if (digits) {
    codes.push(105);
    for (let i = 0; i < value.length; i += 2) codes.push(Number(value.slice(i, i + 2)));
  } else {
    codes.push(104);
    for (const ch of value) {
      const n = ch.charCodeAt(0) - 32;
      codes.push(n >= 0 && n <= 95 ? n : 16);
    }
  }
  const sum = codes.reduce((acc, code, i) => acc + code * (i === 0 ? 1 : i), 0);
  codes.push(sum % 103);
  return [...codes.map((c) => C128[c]), "2331112"].join("");
}

const EAN_L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const EAN_G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const EAN_R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const EAN_FIRST = ["AAAAAA","AABABB","AABBAB","AABBBA","ABAABB","ABBAAB","ABBBAA","ABABAB","ABABBA","ABBABA"];

export function ean13Pattern(text: string) {
  const digits = text.replace(/\D/g, "").padStart(13, "0").slice(-13);
  const first = Number(digits[0]);
  const set = EAN_FIRST[first];
  let bits = "101";
  for (let i = 1; i <= 6; i++) {
    const d = Number(digits[i]);
    bits += set[i - 1] === "A" ? EAN_L[d] : EAN_G[d];
  }
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(digits[i])];
  bits += "101";
  return bits;
}

export function patternToBars(pattern: string, binary = false) {
  const bars: { x: number; w: number; black: boolean }[] = [];
  let x = 0;
  if (binary) {
    for (const bit of pattern) {
      bars.push({ x, w: 1, black: bit === "1" });
      x += 1;
    }
    return { bars, width: x };
  }
  let black = true;
  for (const ch of pattern) {
    const w = Number(ch);
    bars.push({ x, w, black });
    x += w;
    black = !black;
  }
  return { bars, width: x };
}

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 285;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number) {
  if (!a || !b) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsPoly(ec: number) {
  let poly = [1];
  for (let i = 0; i < ec; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ec: number) {
  const gen = rsPoly(ec);
  const out = data.concat(new Array(ec).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = out[i];
    if (!coef) continue;
    for (let j = 0; j < gen.length; j++) out[i + j] ^= gfMul(gen[j], coef);
  }
  return out.slice(data.length);
}

export function qrGrid(text: string) {
  const raw = Array.from(new TextEncoder().encode(text.replace(/\s+/g, "") || "0"));
  const size = 25;
  const dataCount = 44;
  const ecCount = 10;
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(4, 4);
  push(raw.length, 8);
  raw.slice(0, 32).forEach((b) => push(b, 8));
  push(0, 4);
  while (bits.length % 8) bits.push(0);
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] || 0);
    bytes.push(v);
  }
  const pad = [236, 17];
  let p = 0;
  while (bytes.length < dataCount) bytes.push(pad[p++ % 2]);
  const data = bytes.slice(0, dataCount);
  const all = data.concat(rsEncode(data, ecCount));
  const stream: number[] = [];
  all.forEach((b) => {
    for (let i = 7; i >= 0; i--) stream.push((b >> i) & 1);
  });

  const grid = Array.from({ length: size }, () => Array<number>(size).fill(-1));
  const setFinder = (ox: number, oy: number) => {
    for (let y = -1; y < 8; y++) {
      for (let x = -1; x < 8; x++) {
        const xx = ox + x;
        const yy = oy + y;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        const edge = x >= 0 && y >= 0 && x <= 6 && y <= 6 && (x === 0 || y === 0 || x === 6 || y === 6);
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        grid[yy][xx] = edge || core ? 1 : 0;
      }
    }
  };
  setFinder(0, 0);
  setFinder(size - 7, 0);
  setFinder(0, size - 7);
  for (let i = 8; i < size - 8; i++) {
    if (grid[6][i] === -1) grid[6][i] = i % 2 === 0 ? 1 : 0;
    if (grid[i][6] === -1) grid[i][6] = i % 2 === 0 ? 1 : 0;
  }
  const align = 18;
  for (let y = -2; y <= 2; y++) {
    for (let x = -2; x <= 2; x++) {
      const edge = Math.abs(x) === 2 || Math.abs(y) === 2;
      grid[align + y][align + x] = edge || (x === 0 && y === 0) ? 1 : 0;
    }
  }

  let bit = 0;
  let dir = -1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      const y = dir < 0 ? size - 1 - i : i;
      for (const x of [col, col - 1]) {
        if (grid[y][x] !== -1) continue;
        const v = stream[bit++] || 0;
        const mask = (x + y) % 2 === 0 ? 1 : 0;
        grid[y][x] = v ^ mask;
      }
    }
    dir *= -1;
  }
  return grid.map((row) => row.map((v) => v === 1));
}
