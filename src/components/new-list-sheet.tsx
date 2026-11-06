import { useState } from "react";
import { Circle } from "lucide-react";
import { useCouple } from "@/lib/couple-store";

const TEMPLATES = [
  {
    id: "go",
    label: "Куда сходить",
    items: [
      "Музей, в котором ещё не были",
      "Спектакль",
      "Новый район пешком",
      "Ресторан, который советовали друзья",
      "Живой концерт",
      "Смотровая площадка",
    ],
  },
  {
    id: "watch",
    label: "Что посмотреть",
    items: [
      "Фильм, который кто-то советовал",
      "Сериал на вечер",
      "Документалка",
      "Мультфильм из детства",
      "Что-то в оригинале",
      "Классика, до которой не доходили",
    ],
  },
  {
    id: "cook",
    label: "Что приготовить",
    items: [
      "Завтрак на двоих в выходной",
      "Блюдо другой кухни",
      "Домашний хлеб",
      "Десерт",
      "Суп на неделю",
      "Ужин без рецепта",
    ],
  },
  {
    id: "cities",
    label: "Города",
    items: [
      "Город на выходные",
      "Город, где никто из вас не был",
      "Соседний город на машине",
      "Город у моря",
      "Город в горах",
      "Город ради одного музея",
    ],
  },
  { id: "empty", label: "Пустой", items: [] },
] as const;

export function NewListSheet({ onClose }: { onClose: () => void }) {
  const addList = useCouple((s) => s.addList);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["id"] | null>(null);
  const [anyone, setAnyone] = useState(true);

  const picked = TEMPLATES.find((t) => t.id === template);

  const applyTemplate = (id: (typeof TEMPLATES)[number]["id"]) => {
    const next = TEMPLATES.find((t) => t.id === id);
    if (!next) return;
    setTemplate(id);
    if (!title.trim()) setTitle(next.label);
  };

  const save = () => {
    const name = title.trim() || picked?.label || "Список";
    addList({
      title: name,
      details: details.trim(),
      anyoneCanDone: anyone,
      items: picked?.items ? [...picked.items] : [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-md flex-col">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-5 pb-3">
          <button type="button" onClick={onClose} className="justify-self-start text-[17px] text-muted">
            Отмена
          </button>
          <h2 className="text-[17px] font-semibold">Новый список</h2>
          <button
            type="button"
            onClick={save}
            className={`justify-self-end text-[17px] ${title.trim() || template ? "text-blue" : "text-muted"}`}
          >
            Готово
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-8">
          <label className="block rounded-2xl bg-raised px-4 py-3">
            <span className="text-[11px] tracking-wider text-muted">НАЗВАНИЕ</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Куда сходить"
              className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
            />
          </label>

          <label className="block rounded-2xl bg-raised px-4 py-3">
            <span className="text-[11px] tracking-wider text-muted">ПОДРОБНОСТИ</span>
            <input
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Москва, этой осенью"
              className="mt-1 w-full bg-transparent text-[17px] outline-none placeholder:text-muted"
            />
          </label>

          <p className="pt-2 text-[11px] tracking-widest text-muted">НАЧАТЬ С ШАБЛОНА</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                className={`rounded-full px-3 py-2 text-[14px] ${
                  template === t.id ? "bg-chip text-fg" : "bg-raised text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {picked && picked.items.length ? (
            <div className="rounded-2xl bg-raised px-4 py-4">
              <p className="mb-3 text-[13px] leading-snug text-muted">
                {picked.items.length} пунктов в шаблоне — лишнее можно убрать потом
              </p>
              {picked.items.map((item) => (
                <div key={item} className="flex items-center gap-3 py-2 text-[15px] text-muted">
                  <Circle className="size-5 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4 rounded-2xl bg-raised px-4 py-4">
            <div>
              <p className="text-[16px] font-medium">Любой может отметить</p>
              <p className="mt-1 text-[13px] leading-snug text-muted">
                выключите — только тот, кто добавил пункт
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={anyone}
              onClick={() => setAnyone((v) => !v)}
              className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full ${anyone ? "bg-blue" : "bg-chip"}`}
            >
              <span className={`absolute top-0.5 size-5 rounded-full bg-fg ${anyone ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
