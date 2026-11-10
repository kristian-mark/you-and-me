/** Names share leftover space and ellipsis only after the score and dots have theirs. */
export function ScoreLine({
  myName,
  partnerName,
  mine,
  theirs,
  myTone,
  partnerTone,
}: {
  myName: string;
  partnerName: string;
  mine: number;
  theirs: number;
  myTone: string;
  partnerTone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      <span className={`size-2.5 shrink-0 rounded-full sm:size-3 ${myTone}`} />
      <span className="min-w-0 flex-1 truncate text-[14px] leading-5 sm:text-[15px]">{myName}</span>
      <span className="shrink-0 text-[15px] leading-none font-semibold tabular-nums sm:text-[18px]">
        {mine}
        <span className="px-0.5 text-[#e6e1d6] sm:px-1">:</span>
        {theirs}
      </span>
      <span className="min-w-0 flex-1 truncate text-right text-[14px] leading-5 sm:text-[15px]">{partnerName}</span>
      <span className={`size-2.5 shrink-0 rounded-full sm:size-3 ${partnerTone}`} />
    </div>
  );
}
