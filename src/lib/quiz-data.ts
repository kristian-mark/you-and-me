export type QuizTopic =
  | "talk"
  | "avoid"
  | "heard"
  | "attune"
  | "fight"
  | "repair"
  | "space"
  | "together"
  | "home"
  | "money"
  | "future"
  | "trust"
  | "warmth"
  | "stress"
  | "cool"
  | "flirt";

export type QuizItem = {
  id: string;
  topic: QuizTopic;
  asPartner: boolean;
  text: string;
  options: [string, string, string, string];
};

export const TOPICS: {
  topic: QuizTopic;
  kind: "align" | "complement";
  ring: "speech" | "conflict" | "close" | "life" | "safe";
  you: string;
  them: string;
  optionsYou: QuizItem["options"];
  optionsThem: QuizItem["options"];
}[] = [
  {
    topic: "talk",
    kind: "align",
    ring: "speech",
    you: "Насколько тебе легко сказать партнёру, что тебя тревожит?",
    them: "Как бы партнёр ответил: легко ли им сказать тебе, что их тревожит?",
    optionsYou: [
      "Говорю сразу, как есть",
      "Говорю, но сначала собираюсь",
      "Жду удобный момент",
      "Обычно оставляю при себе",
    ],
    optionsThem: [
      "Говорит сразу, как есть",
      "Говорит, но сначала собирается",
      "Обычно ждёт удобный момент",
      "Обычно оставляет при себе",
    ],
  },
  {
    topic: "avoid",
    kind: "align",
    ring: "speech",
    you: "Есть ли темы, которые вы вдвоём обходите?",
    them: "Как думаешь, сколько тем партнёр предпочитает обходить?",
    optionsYou: [
      "Нет, говорим обо всём",
      "Одна-две",
      "Несколько, и это заметно",
      "Много — проще не начинать",
    ],
    optionsThem: [
      "Ни одной — говорит обо всём",
      "Одна-две",
      "Несколько, и это заметно",
      "Много — им проще не начинать",
    ],
  },
  {
    topic: "heard",
    kind: "align",
    ring: "speech",
    you: "Когда рассказываешь о дне, чувствуешь, что тебя слышат?",
    them: "Как думаешь, партнёр чувствует, что ты его слышишь?",
    optionsYou: ["Почти всегда", "Чаще да", "Через раз", "Редко"],
    optionsThem: ["Почти всегда", "Чаще да", "Через раз", "Редко"],
  },
  {
    topic: "attune",
    kind: "align",
    ring: "speech",
    you: "Партнёр замечает, что ты устал, без слов?",
    them: "Замечаешь ли ты без слов, что партнёр устал?",
    optionsYou: [
      "Почти всегда замечает",
      "Чаще да, чем нет",
      "Только если сказать прямо",
      "Обычно нет",
    ],
    optionsThem: [
      "Почти всегда замечаю",
      "Чаще да, чем нет",
      "Только если скажет прямо",
      "Обычно нет",
    ],
  },
  {
    topic: "fight",
    kind: "align",
    ring: "conflict",
    you: "Чем обычно заканчиваются ваши ссоры?",
    them: "Как бы партнёр сказал, чем обычно заканчиваются ваши ссоры?",
    optionsYou: [
      "Разговариваем и миримся",
      "Само сходит на нет",
      "Замолкаем, но осадок остаётся",
      "Каждый остаётся при своём",
    ],
    optionsThem: [
      "Разговариваем и миримся",
      "Само сходит на нет",
      "Замолкаем, но осадок остаётся",
      "Каждый остаётся при своём",
    ],
  },
  {
    topic: "cool",
    kind: "align",
    ring: "conflict",
    you: "Как быстро ты остываешь после ссоры?",
    them: "Как быстро, по-твоему, остывает партнёр после ссоры?",
    optionsYou: ["Почти сразу", "В тот же вечер", "К следующему дню", "Держится дольше"],
    optionsThem: ["Почти сразу", "В тот же вечер", "К следующему дню", "Держится дольше"],
  },
  {
    topic: "repair",
    kind: "complement",
    ring: "conflict",
    you: "Кто чаще делает первый шаг к примирению?",
    them: "Как думает партнёр: кто чаще делает первый шаг к примирению?",
    optionsYou: ["Я", "Оба примерно одинаково", "Партнёр", "Часто никто"],
    optionsThem: ["Я", "Оба примерно одинаково", "Партнёр", "Часто никто"],
  },
  {
    topic: "space",
    kind: "align",
    ring: "close",
    you: "Сколько тишины тебе нужно обычным вечером?",
    them: "Сколько тишины, по-твоему, нужно партнёру обычным вечером?",
    optionsYou: [
      "Почти не нужна",
      "Час-два в день",
      "Половину вечера спокойно",
      "Чем больше, тем лучше",
    ],
    optionsThem: [
      "Почти не нужна",
      "Час-два в день",
      "Половину вечера спокойно",
      "Чем больше, тем лучше",
    ],
  },
  {
    topic: "together",
    kind: "align",
    ring: "close",
    you: "Сколько общего времени в неделю вам достаточно?",
    them: "Сколько общего времени, как тебе кажется, хочет партнёр?",
    optionsYou: ["Почти каждый вечер", "Несколько вечеров", "Один вечер", "Редкие встречи"],
    optionsThem: ["Почти каждый вечер", "Несколько вечеров", "Один вечер", "Редкие встречи"],
  },
  {
    topic: "home",
    kind: "complement",
    ring: "life",
    you: "Какая часть домашней работы на тебе?",
    them: "Какую часть домашней работы, по мнению партнёра, делаешь ты?",
    optionsYou: ["Почти всё", "Больше половины", "Примерно половину", "Меньше половины"],
    optionsThem: ["Почти всё", "Больше половины", "Примерно половину", "Меньше половины"],
  },
  {
    topic: "money",
    kind: "align",
    ring: "life",
    you: "Как вы решаете траты на двоих?",
    them: "Как бы партнёр описал ваши решения про деньги?",
    optionsYou: [
      "Обсуждаем спокойно",
      "Иногда спорим, но договариваемся",
      "Часто натягивает",
      "Избегаем разговора",
    ],
    optionsThem: [
      "Обсуждаем спокойно",
      "Иногда спорим, но договариваемся",
      "Часто натягивает",
      "Избегаем разговора",
    ],
  },
  {
    topic: "future",
    kind: "align",
    ring: "life",
    you: "Насколько совпадают ваши планы на ближайший год?",
    them: "Как партнёр видит совпадение ваших планов на год?",
    optionsYou: ["Почти совпадают", "В главном да", "Скорее разные", "Почти не говорим об этом"],
    optionsThem: ["Почти совпадают", "В главном да", "Скорее разные", "Почти не говорим об этом"],
  },
  {
    topic: "warmth",
    kind: "align",
    ring: "close",
    you: "Хватает ли тебе тепла и касаний в паре?",
    them: "Хватает ли, как ты думаешь, партнёру тепла и касаний?",
    optionsYou: ["Да, в кайф", "В целом да", "Хотелось бы больше", "Почти не хватает"],
    optionsThem: ["Да, в кайф", "В целом да", "Хотелось бы больше", "Почти не хватает"],
  },
  {
    topic: "stress",
    kind: "align",
    ring: "safe",
    you: "Когда тебе тяжело, партнёр рядом как опора?",
    them: "Когда партнёру тяжело, ты рядом как опора?",
    optionsYou: ["Да, сразу", "Чаще да", "Иногда теряемся", "Каждый варится сам"],
    optionsThem: ["Да, сразу", "Чаще да", "Иногда теряемся", "Каждый варится сам"],
  },
  {
    topic: "trust",
    kind: "align",
    ring: "safe",
    you: "Насколько тебе спокойно, когда партнёр где-то без тебя?",
    them: "Насколько спокойно партнёру, когда ты где-то без него?",
    optionsYou: ["Полностью спокойно", "В целом спокойно", "Иногда крутит", "Часто тревожит"],
    optionsThem: ["Полностью спокойно", "В целом спокойно", "Иногда крутит", "Часто тревожит"],
  },
  {
    topic: "flirt",
    kind: "align",
    ring: "safe",
    you: "Если бы к тебе проявил интерес кто-то посторонний, что бы ты сделал?",
    them: "А партнёр — что бы сделал, если бы к нему проявил интерес кто-то посторонний?",
    optionsYou: [
      "Сказал бы сразу",
      "Обозначил границу и отпустил",
      "Не придал бы значения",
      "Было бы приятно, но не больше",
    ],
    optionsThem: [
      "Сказал бы мне сразу",
      "Обозначил границу и отпустил",
      "Не придал бы значения",
      "Было бы приятно, но не больше",
    ],
  },
];

export const QUIZ: QuizItem[] = [
  ...TOPICS.map((t) => ({
    id: `y-${t.topic}`,
    topic: t.topic,
    asPartner: false,
    text: t.you,
    options: t.optionsYou,
  })),
  ...TOPICS.map((t) => ({
    id: `p-${t.topic}`,
    topic: t.topic,
    asPartner: true,
    text: t.them,
    options: t.optionsThem,
  })),
];

export const TOPIC_LABEL: Record<QuizTopic, string> = {
  talk: "Разговор",
  avoid: "Запретные темы",
  heard: "Быть услышанным",
  attune: "Чувствовать без слов",
  fight: "Ссоры",
  repair: "Примирение",
  space: "Личное пространство",
  together: "Общее время",
  home: "Быт",
  money: "Деньги",
  future: "Планы",
  trust: "Спокойствие",
  warmth: "Тепло",
  stress: "Опора",
  cool: "Остывать",
  flirt: "Границы",
};

export const RING_LABEL = {
  speech: "Речь",
  conflict: "Конфликт",
  close: "Близость",
  life: "Быт и планы",
  safe: "Опора",
};

function pct(points: number, max: number) {
  if (max <= 0) return 0;
  return Math.round((points / max) * 100);
}

function pairScore(kind: "align" | "complement", a: number, b: number) {
  if (kind === "complement") return 3 - Math.min(3, Math.abs(a + b - 3));
  return 3 - Math.abs(a - b);
}

const GROWTH: Record<QuizTopic, string> = {
  talk: "Договоритесь о коротком «сейчас не время / давай через час». Тревога не обязана ждать идеальный момент.",
  avoid: "Назовите одну обходимую тему вслух и поставьте ей 20 минут, не чтобы решить, а чтобы просто быть рядом с ней.",
  heard: "Попробуйте правило: один говорит две минуты, второй только кивает и в конце повторяет суть своими словами.",
  attune: "Раз в день спрашивайте не «как дела», а «ты сейчас больше устал или скорее раздражён?»",
  fight: "После ссоры нужен ремонт: кто что услышал, чего хотел. Без этого осадок складывается в стену.",
  cool: "Разный темп остывания — не характер. Договоритесь не решать ничего, пока оба не выдохнули.",
  repair: "Если первый шаг всегда на одном, это выгорает. Чередуйте: сегодня ты, в следующий раз я.",
  space: "Тишина — не отказ. Скажите заранее: «мне час одному, потом я ваш».",
  together: "Если одному нужно больше вечеров, чем другому, фиксируйте два слота в неделю, которые не отменяют.",
  home: "Составьте список дел на неделю и отметьте, кто что берёт. Ощущение «я делаю всё» часто живёт без списка.",
  money: "Одна общая цифра на двоих и одна личная. Споры про траты почти всегда про контроль, не про чек.",
  future: "Напишите по три пункта «через год». Сравните. Разница — не провал, пока она названа.",
  warmth: "Тепло лучше назначать, чем ждать настроения. Один жест в день — уже ритуал, не спектакль.",
  stress: "В тяжёлый день спрашивайте: «тебе побыть рядом или помочь делом?» Это два разных запроса.",
  trust: "Тревога без фактов кормится паузами. Короткое «я на месте» снимает больше, чем долгий допрос.",
  flirt: "Граница звучит спокойно: «мне приятно, и я в паре». Скрытость ранит сильнее, чем сам интерес.",
};

const SEE: Record<QuizTopic, { good: string; miss: string }> = {
  talk: {
    good: "Вы примерно одинаково видите, насколько легко говорить о тревоге.",
    miss: "Один думает, что разговор открытый, другой — что многое остаётся внутри.",
  },
  avoid: {
    good: "Совпадает картина запретных тем.",
    miss: "У вас разный список того, о чём лучше молчать. Это уже тема сама по себе.",
  },
  heard: {
    good: "Ощущение «меня слышат» у вас близкое.",
    miss: "Кто-то уходит с разговора сытым, кто-то — неувиденным.",
  },
  attune: {
    good: "Вы похоже оцениваете, замечаете ли усталость без слов.",
    miss: "Один ждёт, что его прочтут, другой ждёт прямой просьбы.",
  },
  fight: {
    good: "Ссоры вы описываете похоже — значит, живёте в одной истории.",
    miss: "После конфликта у вас две разные версии финала. Имеет смысл сверять конец, не начало.",
  },
  cool: {
    good: "Темп остывания вы видите близко.",
    miss: "Один уже в порядке, второй ещё в ссоре. Не торопите «ну всё».",
  },
  repair: {
    good: "Вы согласны, кто тянет перемирие.",
    miss: "Каждый считает, что мост строит он. Или оба ждут другого.",
  },
  space: {
    good: "Запрос на тишину вы читаете похоже.",
    miss: "Одному тишина — отдых, другому — холод. Назовите её вслух.",
  },
  together: {
    good: "Аппетит к общему времени совпадает.",
    miss: "Разный голод по вечерам вместе. Без договорённости кто-то всегда будет голоден.",
  },
  home: {
    good: "Раздел быта вы видите согласованно.",
    miss: "Оба могут быть уверены, что тянут больше. Нужна таблица, не ощущение.",
  },
  money: {
    good: "Деньги обсуждаете в одной тональности.",
    miss: "Для одного разговор про траты спокойный, для другого — поле боя.",
  },
  future: {
    good: "Год впереди вы рисуете похоже.",
    miss: "Планы либо разные, либо о них молчите. Это не одно и то же — уточните.",
  },
  warmth: {
    good: "Про тепло вы на одной волне.",
    miss: "Одному касаний хватает, другому нет. Это не «избалованность», это разный термостат.",
  },
  stress: {
    good: "В тяжёлые дни вы одинаково чувствуете опору.",
    miss: "Кто-то остаётся один, когда думает, что его держат.",
  },
  trust: {
    good: "Спокойствие на расстоянии у вас близкое.",
    miss: "Одному легко отпускать, другому крутит. Факты тут помогают лучше клятв.",
  },
  flirt: {
    good: "Границу с чужим интересом вы понимаете похоже.",
    miss: "Разное чувство, что считать изменой внимания. Проговорите до случая, не после.",
  },
};

export type TopicResult = {
  topic: QuizTopic;
  label: string;
  ring: keyof typeof RING_LABEL;
  mySelf: number;
  theirSelf?: number;
  myGuess?: number;
  theirGuess?: number;
  climate: number;
  match?: number;
  iSeeThem?: number;
  theySeeMe?: number;
  myText: string;
  theirText?: string;
  guessText?: string;
  note: string;
};

export type QuizReport = {
  duo: boolean;
  score: number;
  climate: number;
  match: number;
  insight: number;
  rings: { id: keyof typeof RING_LABEL; label: string; value: number }[];
  topics: TopicResult[];
  weak: TopicResult[];
  strong: TopicResult[];
  archetype: { name: string; text: string };
  summary: string;
};

export function buildReport(mine: number[], partner?: number[]): QuizReport {
  const mySelf = mine.slice(0, 16);
  const myGuess = mine.slice(16, 32);
  const duo = Boolean(partner && partner.length >= 16);
  const theirSelf = duo ? partner!.slice(0, 16) : undefined;
  const theirGuess = duo && partner!.length >= 32 ? partner!.slice(16, 32) : undefined;

  const topics: TopicResult[] = TOPICS.map((t, i) => {
    const a = mySelf[i] ?? 0;
    const climate = Math.round(((3 - a) / 3) * 100);
    const result: TopicResult = {
      topic: t.topic,
      label: TOPIC_LABEL[t.topic],
      ring: t.ring,
      mySelf: a,
      myGuess: myGuess[i],
      climate,
      myText: t.optionsYou[a] ?? "",
      guessText: t.optionsThem[myGuess[i] ?? 0],
      note: GROWTH[t.topic],
    };
    if (theirSelf) {
      const b = theirSelf[i] ?? 0;
      result.theirSelf = b;
      result.theirText = t.optionsYou[b];
      result.match = pct(pairScore(t.kind, a, b), 3);
      if (myGuess[i] !== undefined) {
        result.iSeeThem = pct(3 - Math.abs(myGuess[i] - b), 3);
      }
      if (theirGuess && theirGuess[i] !== undefined) {
        result.theySeeMe = pct(3 - Math.abs(theirGuess[i] - a), 3);
      }
    } else if (myGuess[i] !== undefined) {
      result.iSeeThem = pct(3 - Math.abs(myGuess[i] - a), 3);
    }
    return result;
  });

  const climate = Math.round(topics.reduce((s, t) => s + t.climate, 0) / topics.length);
  const matchVals = topics.map((t) => t.match).filter((v): v is number => v !== undefined);
  const seeVals = topics.flatMap((t) => [t.iSeeThem, t.theySeeMe]).filter((v): v is number => v !== undefined);
  const match = matchVals.length ? Math.round(matchVals.reduce((s, v) => s + v, 0) / matchVals.length) : 0;
  const insight = seeVals.length ? Math.round(seeVals.reduce((s, v) => s + v, 0) / seeVals.length) : 0;

  const rings = (["speech", "conflict", "close", "life", "safe"] as const).map((id) => {
    const pack = topics.filter((t) => t.ring === id);
    const value = Math.round(
      pack.reduce((s, t) => s + (duo ? (t.match ?? t.climate) : t.climate), 0) / pack.length,
    );
    return { id, label: RING_LABEL[id], value };
  });

  const ranked = [...topics].sort((a, b) => {
    const ga = duo ? 100 - (a.match ?? a.climate) + (3 - (a.climate / 100) * 3) : 100 - a.climate;
    const gb = duo ? 100 - (b.match ?? b.climate) + (3 - (b.climate / 100) * 3) : 100 - b.climate;
    return gb - ga;
  });

  const score = duo
    ? Math.round(climate * 0.28 + match * 0.4 + insight * 0.32)
    : climate;

  const arch = duo
    ? archetype(score, match, insight, rings)
    : {
        name: "Пока один голос",
        text: "Это срез по твоим ответам. Когда партнёр пройдёт тот же тест, балл пересчитается: совпадение и то, насколько вы угадываете друг друга.",
      };

  const summary = duo
    ? duoSummary(score, match, insight, ranked)
    : `По твоим ответам климат пары около ${climate} из 100. Самые напряжённые места: ${ranked
        .slice(0, 3)
        .map((t) => t.label.toLowerCase())
        .join(", ")}.`;

  return {
    duo,
    score,
    climate,
    match,
    insight,
    rings,
    topics,
    weak: ranked.slice(0, 3),
    strong: [...ranked].reverse().slice(0, 3),
    archetype: arch,
    summary,
  };
}

function archetype(
  score: number,
  match: number,
  insight: number,
  rings: QuizReport["rings"],
) {
  const top = [...rings].sort((a, b) => b.value - a.value)[0];
  if (insight >= 75 && match >= 70) {
    return {
      name: "Настроенные",
      text: "Вы и живёте похоже, и довольно точно читаете ответы друг друга. Это редкое сочетание.",
    };
  }
  if (match >= 72 && insight < 58) {
    return {
      name: "Близкие по ритму",
      text: "Привычки совпадают сильнее, чем догадки. Вы похожи, но не всегда знаете, что у другого внутри.",
    };
  }
  if (insight >= 72 && match < 58) {
    return {
      name: "Внимательные",
      text: "Вы хорошо угадываете партнёра, хотя сами по себе разные. Разница не мешает, пока её видите.",
    };
  }
  if (top?.id === "conflict" && top.value < 55) {
    return {
      name: "После бури",
      text: "Главное напряжение сейчас в ссорах и примирении. Остальное может быть целым — чините именно этот контур.",
    };
  }
  if (top?.id === "speech" && score >= 50) {
    return {
      name: "Ищущие слова",
      text: "Опора есть, но речь проседает: недосказанность, обход тем, ощущение «меня не слышат».",
    };
  }
  if (score >= 58) {
    return {
      name: "В процессе",
      text: "Каркас держит. Трение в двух-трёх зонах — рабочее состояние пары, не диагноз.",
    };
  }
  return {
    name: "На пересборке",
    text: "Расхождений больше, чем совпадений. Это не конец, а карта: с чего начать разговор.",
  };
}

function duoSummary(score: number, match: number, insight: number, ranked: TopicResult[]) {
  const hard = ranked.slice(0, 2).map((t) => t.label.toLowerCase());
  return `Совместимость ${score} из 100. Совпадение ответов ${match}%, точность взгляда ${insight}%. Больше всего расходится ${hard.join(" и ")}.`;
}

export { SEE };
