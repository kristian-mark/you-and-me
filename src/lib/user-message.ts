const CONNECTION =
  /EMAXCONNSESSION|max clients reached|too many clients|ECONNRESET|ETIMEDOUT|ECONNREFUSED|Connection terminated|connection terminated|remaining connection slots|sorry, too many clients|Связь прервалась/i;

/** Longer phrases first, so "invalid email or password" is not read as "invalid email". */
const AUTH_RU: Array<[RegExp, string]> = [
  [/too many requests/i, "Слишком много попыток, подожди немного"],
  [/invalid email or password/i, "Неверная почта или пароль"],
  [/user already exists/i, "Такой аккаунт уже есть"],
  [/password too short/i, "Пароль слишком короткий"],
  [/password too long/i, "Пароль слишком длинный"],
  [/invalid email/i, "Неверная почта"],
  [/invalid password/i, "Неверный пароль"],
  [/user not found/i, "Аккаунт не найден"],
  [/email not verified/i, "Почта ещё не подтверждена"],
  [/credential account not found/i, "Для этой почты нет входа по паролю"],
  [/failed to create user/i, "Не удалось создать аккаунт"],
  [/failed to create session/i, "Не удалось войти"],
  [/session expired/i, "Сессия истекла — войди ещё раз"],
];

function authRussian(message: string) {
  for (const [pattern, russian] of AUTH_RU) {
    if (pattern.test(message)) return russian;
  }
  return "";
}

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
  const russian = authRussian(message);
  if (russian) return russian;
  if (isConnectionFailure(message)) return "Связь прервалась";
  if (/[а-яё]/i.test(message)) return message;
  return fallback;
}
