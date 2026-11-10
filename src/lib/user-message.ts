const CONNECTION =
  /EMAXCONNSESSION|max clients reached|too many clients|ECONNRESET|ETIMEDOUT|ECONNREFUSED|Connection terminated|connection terminated|remaining connection slots|sorry, too many clients|Связь прервалась/i;

/** Pool and network failures. The game screen retries these and does not block on them. */
export function isConnectionFailure(message: string) {
  return CONNECTION.test(message);
}

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
  if (isConnectionFailure(message)) return "Связь прервалась";
  return message || fallback;
}
