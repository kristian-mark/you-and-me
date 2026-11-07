export type DailyQuestion = {
  id: string;
  topic: string;
  text: string;
};

export const DAILY_QUESTIONS: DailyQuestion[] = [
  {
    id: "real",
    topic: "мы двое",
    text: "Когда ты впервые понял, что это серьёзно?",
  },
  {
    id: "laugh",
    topic: "мы двое",
    text: "Какой момент с нами ты пересказываешь чаще всего?",
  },
  {
    id: "safe",
    topic: "тепло",
    text: "Где тебе со мной спокойнее всего?",
  },
  {
    id: "hard",
    topic: "правда",
    text: "О чём нам до сих пор трудно говорить вслух?",
  },
  {
    id: "home",
    topic: "быт",
    text: "Какая мелочь дома сразу делает день лучше?",
  },
  {
    id: "future",
    topic: "впереди",
    text: "Какой ближайший год ты хочешь прожить вместе?",
  },
  {
    id: "touch",
    topic: "тепло",
    text: "Какое простое касание тебе нужно, когда день тяжёлый?",
  },
  {
    id: "first",
    topic: "мы двое",
    text: "Что ты заметил во мне в самый первый вечер?",
  },
  {
    id: "space",
    topic: "ритм",
    text: "Когда тебе нужно побыть одному — как это лучше сказать?",
  },
  {
    id: "proud",
    topic: "мы двое",
    text: "За что в нас как в паре тебе не стыдно?",
  },
  {
    id: "repair",
    topic: "ссора",
    text: "Что тебя быстрее всего возвращает после ссоры?",
  },
  {
    id: "gift",
    topic: "забота",
    text: "Какой подарок без цены ты запомнил надолго?",
  },
];

export function questionById(id: string) {
  return DAILY_QUESTIONS.find((q) => q.id === id) ?? DAILY_QUESTIONS[0];
}

export function pickQuestion(dateIso: string, skipIds: string[]) {
  const start = new Date(`${dateIso}T12:00:00`);
  const day = Math.floor(start.getTime() / 86400000);
  const pool = DAILY_QUESTIONS.filter((q) => !skipIds.includes(q.id));
  const list = pool.length ? pool : DAILY_QUESTIONS;
  return list[Math.abs(day) % list.length];
}
