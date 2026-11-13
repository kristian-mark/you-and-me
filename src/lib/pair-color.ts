export type PieceColor = "blue" | "pink";

export function parsePieceColor(value: string | null | undefined): PieceColor | null {
  return value === "blue" || value === "pink" ? value : null;
}

export function otherPieceColor(color: PieceColor): PieceColor {
  return color === "blue" ? "pink" : "blue";
}

/**
 * Colors belong to the person, so both phones get the same answer.
 * An empty choice uses the seat: the first member (a) is blue, the second is pink.
 * If that still collides, the first member keeps their color and the second takes the other one.
 * An explicit choice beats an empty one.
 */
export function pairColors(input: {
  mySeat: "a" | "b" | null;
  myChoice: PieceColor | null;
  partnerChoice: PieceColor | null;
}): { me: PieceColor; partner: PieceColor } {
  const seat = input.mySeat === "b" ? "b" : "a";
  const aChoice = seat === "a" ? input.myChoice : input.partnerChoice;
  const bChoice = seat === "b" ? input.myChoice : input.partnerChoice;
  let a: PieceColor = aChoice ?? "blue";
  let b: PieceColor = bChoice ?? "pink";
  if (a === b) {
    if (aChoice && !bChoice) b = otherPieceColor(a);
    else if (bChoice && !aChoice) a = otherPieceColor(b);
    else b = otherPieceColor(a);
  }
  return seat === "a" ? { me: a, partner: b } : { me: b, partner: a };
}

export function pieceBg(color: PieceColor) {
  return color === "blue" ? "bg-blue" : "bg-pink";
}

export function pieceText(color: PieceColor) {
  return color === "blue" ? "text-blue" : "text-pink";
}

export function pieceBorder(color: PieceColor) {
  return color === "blue" ? "border-blue" : "border-pink";
}

export function pieceRing(color: PieceColor) {
  return color === "blue" ? "ring-blue" : "ring-pink";
}

export function pieceRingSoft(color: PieceColor) {
  return color === "blue" ? "ring-blue/70" : "ring-pink/70";
}

/** Tinted button fill that stays readable on either person color. */
export function pieceWash(color: PieceColor) {
  return color === "blue" ? "bg-[#1a3a52] text-blue" : "bg-[#3d2433] text-pink";
}

export function pieceCss(color: PieceColor) {
  return color === "blue" ? "var(--color-blue)" : "var(--color-pink)";
}
