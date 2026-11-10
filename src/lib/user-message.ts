/** Turn a thrown error into the sentence shown in the app. */
export function userMessage(error: unknown, fallback: string) {
  let message = "";
  if (error instanceof Error && error.message.trim()) message = error.message.trim();
  else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    message = error.message.trim();
  }
  if (/too many requests/i.test(message)) return "Слишком много попыток, подожди немного";
  return message || fallback;
}
