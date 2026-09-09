import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, Screen, Chip } from "../ui/Glass";
import Icon from "../ui/Icon";
import { sfx, haptic } from "../core/fx";
import { askDeepSeek, getKey, hasKey, setKey, type ChatMsg } from "../core/ai";

const SUGGEST = [
  "Придумай обзывалку для Шитова",
  "Как не спалиться, что играю на паре",
  "Сочини тост за Радомира",
  "Отмазка за прогул, чтобы поверили",
];

/** Отдельная страница чата с DeepSeek. */
export default function AiPage({ onBack }: { onBack: () => void }) {
  const [keyInput, setKeyInput] = useState(getKey());
  const [ready, setReady] = useState(hasKey());
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setErr(null);
    setInput("");
    const next: ChatMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setBusy(true);
    sfx.click();
    const ac = new AbortController();
    abort.current = ac;
    const res = await askDeepSeek(next, ac.signal);
    setBusy(false);
    abort.current = null;
    if ("error" in res) {
      setErr(res.error);
      haptic("error");
    } else {
      setMsgs((m) => [...m, { role: "assistant", content: res.text }]);
      haptic("light");
    }
  };

  const saveKey = () => {
    setKey(keyInput);
    setReady(hasKey());
    sfx.buy();
    haptic("success");
    setErr(null);
  };

  return (
    <Screen
      title="СПРОСИТЬ У ИИ"
      sub="DeepSeek · бета"
      right={
        <button
          type="button"
          onClick={() => { sfx.click(); onBack(); }}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 34, height: 34, borderRadius: "var(--r-sm)",
            background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
          }}
        >
          <Icon name="cross" size={15} />
        </button>
      }
    >
      {!ready ? (
        <Card r="lg" style={{ padding: 16 }}>
          <div className="flex items-center" style={{ gap: 9, marginBottom: 8 }}>
            <Icon name="brain" size={19} accent />
            <div className="t-title-sm">Нужен ключ DeepSeek</div>
            <Chip active>БЕТА</Chip>
          </div>
          <div className="t-body" style={{ lineHeight: 1.55, marginBottom: 13 }}>
            Запрос уходит напрямую с телефона в DeepSeek. Ключ хранится только на
            этом устройстве и никуда не отправляется. Всё остальное в игре
            работает офлайн, как и раньше.
          </div>
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-..."
            spellCheck={false}
            autoCapitalize="none"
            className="w-full t-body"
            style={{
              padding: "12px 13px", borderRadius: "var(--r-md)",
              background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              color: "var(--text)", outline: "none",
            }}
          />
          <button
            type="button"
            onClick={saveKey}
            disabled={keyInput.trim().length < 10}
            className="w-full t-title-sm"
            style={{
              marginTop: 11, padding: "13px 0", borderRadius: "var(--r-md)",
              background: "var(--acc)", color: "var(--acc-ink)", fontWeight: 700,
              opacity: keyInput.trim().length < 10 ? 0.5 : 1,
            }}
          >
            СОХРАНИТЬ КЛЮЧ
          </button>
          <div className="t-caption" style={{ marginTop: 10, lineHeight: 1.5 }}>
            Ключ берётся на platform.deepseek.com в разделе API keys. Он платный,
            но стоит копейки за запрос.
          </div>
        </Card>
      ) : (
        <>
          <div
            ref={scrollRef}
            style={{
              display: "flex", flexDirection: "column", gap: 9,
              minHeight: 240, maxHeight: "52vh", overflowY: "auto",
              marginBottom: 12,
            }}
          >
            {msgs.length === 0 && (
              <Card r="lg" style={{ padding: 14 }}>
                <div className="t-body" style={{ marginBottom: 11, lineHeight: 1.5 }}>
                  Спроси что угодно. Он в курсе, кто такие Шитов, Радомир и
                  остальные.
                </div>
                <div className="flex flex-col" style={{ gap: 7 }}>
                  {SUGGEST.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => send(sug)}
                      className="t-body"
                      style={{
                        padding: "10px 12px", borderRadius: "var(--r-md)",
                        background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                        textAlign: "left",
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {msgs.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="t-body"
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%", padding: "11px 13px",
                  borderRadius: "var(--r-md)",
                  background: m.role === "user" ? "var(--acc)" : "var(--surface-2)",
                  color: m.role === "user" ? "var(--acc-ink)" : "var(--text)",
                  border: m.role === "user" ? "none" : "1px solid var(--surface-brd)",
                  whiteSpace: "pre-wrap", lineHeight: 1.55,
                }}
              >
                {m.content}
              </motion.div>
            ))}

            <AnimatePresence>
              {busy && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center"
                  style={{
                    alignSelf: "flex-start", gap: 7,
                    padding: "11px 13px", borderRadius: "var(--r-md)",
                    background: "var(--surface-2)", border: "1px solid var(--surface-brd)",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                      transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
                      style={{ width: 6, height: 6, borderRadius: 999, background: "var(--acc)" }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {err && (
            <div className="t-caption" style={{ marginBottom: 9, color: "var(--danger)" }}>
              {err}
            </div>
          )}

          <div className="flex" style={{ gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              placeholder="Спроси что-нибудь"
              className="flex-1 t-body min-w-0"
              style={{
                padding: "12px 13px", borderRadius: "var(--r-md)",
                background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                color: "var(--text)", outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => (busy ? abort.current?.abort() : send(input))}
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 46, borderRadius: "var(--r-md)",
                background: "var(--acc)", color: "var(--acc-ink)",
              }}
            >
              <Icon name={busy ? "pause" : "chevron"} size={17} />
            </button>
          </div>

          <div className="flex" style={{ gap: 8, marginTop: 11 }}>
            <button
              type="button"
              onClick={() => { setMsgs([]); sfx.click(); }}
              className="t-caption flex items-center"
              style={{
                gap: 6, padding: "8px 12px", borderRadius: "var(--r-sm)",
                background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              }}
            >
              <Icon name="trash" size={12} /> Очистить
            </button>
            <button
              type="button"
              onClick={() => {
                setKey(""); setKeyInput(""); setReady(false); setMsgs([]); sfx.click();
              }}
              className="t-caption flex items-center"
              style={{
                gap: 6, padding: "8px 12px", borderRadius: "var(--r-sm)",
                background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              }}
            >
              <Icon name="lock" size={12} /> Забыть ключ
            </button>
          </div>
        </>
      )}
    </Screen>
  );
}
