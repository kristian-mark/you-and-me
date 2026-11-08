import { leavePairRemote } from "@/lib/pair-server";
import { useCouple } from "@/lib/couple-store";

export async function leaveSharedPair() {
  await leavePairRemote();
  useCouple.getState().leavePair();
}
