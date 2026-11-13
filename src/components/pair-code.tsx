import { formatPairCode } from "@/lib/pair-code";

export function PairCode({
  code,
  label,
  hint,
  size = "md",
  framed = true,
}: {
  code: string | null | undefined;
  label: string;
  hint?: string;
  size?: "md" | "lg";
  framed?: boolean;
}) {
  const pretty = formatPairCode(code);
  return (
    <div className={framed ? "rounded-[22px] bg-raised px-5 py-5" : ""}>
      <p className="text-[12px] tracking-[0.16em] text-muted uppercase">{label}</p>
      {pretty ? (
        <p
          className={`mt-3 font-semibold tracking-[0.18em] break-all text-fg ${
            size === "lg" ? "text-[32px] min-[380px]:text-[40px]" : "text-[28px]"
          }`}
        >
          {pretty}
        </p>
      ) : (
        <p className="mt-3 text-[16px] text-muted">Код появится после входа</p>
      )}
      {hint ? <p className="mt-2 text-[14px] leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}
