/**
 * Бета: обращение к DeepSeek API.
 *
 * Ключ вводит сам пользователь и хранится только на устройстве
 * (localStorage). Никакого прокси и телеметрии — запрос идёт напрямую
 * с телефона в api.deepseek.com. Без ключа режим просто не включается,
 * офлайн-работа остальной игры не страдает.
 */

const KEY_STORE = "chubgames.deepseekKey";
const ENDPOINT = "https://api.deepseek.com/chat/completions";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export const getKey = () => localStorage.getItem(KEY_STORE) || "";
export const setKey = (k: string) => {
  if (k) localStorage.setItem(KEY_STORE, k.trim());
  else localStorage.removeItem(KEY_STORE);
};
export const hasKey = () => getKey().length > 10;

/** Характер бота: он «свой» из компании, а не корпоративный ассистент */
export const SYSTEM_PROMPT: ChatMsg = {
  role: "system",
  content:
    "Ты — ИИ-помощник внутри мобильной игры ЧУБУГЕЙМ, которую Ваня Чубуков сделал " +
    "про свою компанию друзей: Лёха Бургер, Безумный Макс, Серёга Каракулик, " +
    "Артём Трампович, Радомир, Кудря и препод Шитов Андрей. " +
    "Отвечай коротко, по-русски, живым разговорным языком, без канцелярита и " +
    "без списков там, где хватит пары фраз. Можешь шутить, но по делу.",
};

export type AskResult = { text: string } | { error: string };

/** Один запрос к модели. Никогда не бросает — ошибки возвращаются полем error. */
export async function askDeepSeek(
  history: ChatMsg[],
  signal?: AbortSignal,
): Promise<AskResult> {
  const key = getKey();
  if (!key) return { error: "Нет ключа API. Добавь его в настройках режима." };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [SYSTEM_PROMPT, ...history.slice(-12)],
        temperature: 1.1,
        max_tokens: 700,
        stream: false,
      }),
      signal,
    });

    if (res.status === 401) return { error: "Ключ не подошёл. Проверь его в настройках." };
    if (res.status === 402) return { error: "На балансе DeepSeek закончились деньги." };
    if (res.status === 429) return { error: "Слишком часто. Подожди немного." };
    if (!res.ok) return { error: `Сервер ответил ${res.status}. Попробуй позже.` };

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!text) return { error: "Пустой ответ от модели." };
    return { text };
  } catch (e: any) {
    if (e?.name === "AbortError") return { error: "Отменено." };
    return { error: "Нет связи с DeepSeek. Нужен интернет." };
  }
}
