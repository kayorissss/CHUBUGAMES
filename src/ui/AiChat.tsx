import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, Button, Chip } from "./Glass";
import { sfx, haptic } from "../core/fx";
import { askDeepSeek, getKey, hasKey, setKey, type ChatMsg } from "../core/ai";

const SUGGEST = [
  "Придумай обзывалку для Шитова",
  "Как не спалиться, что играю на паре",
  "Сочини тост за Радомира",
];

/**
 * Бета-режим: чат с DeepSeek прямо из игры.
 * Ключ хранится локально, режим полностью опционален.
 */
export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [keyInput, setKeyInput] = useState(getKey());
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
    sfx.buy();
    haptic("success");
    setErr(null);
  };

  return (
    <Card r="lg" style={{ padding: 14 }}>
      <div className="flex items-center" style={{ gap: 9 }}>
        <div className="t-title-sm">Спросить у ИИ</div>
        <Chip active>БЕТА</Chip>
      </div>
      <div className="t-caption" style={{ marginTop: 3, lineHeight: 1.5 }}>
        Работает на DeepSeek. Нужен интернет и свой ключ API — он хранится только
        на этом телефоне.
      </div>

      {!hasKey() && (
        <div style={{ marginTop: 13 }}>
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="sk-..."
            spellCheck={false}
            autoCapitalize="none"
            className="w-full t-body"
            style={{
              padding: "11px 12px",
              borderRadius: "var(--r-md)",
              background: "var(--btn-bg)",
              border: "1px solid var(--btn-brd)",
              color: "var(--text)",
              outline: "none",
            }}
          />
          <div className="flex" style={{ gap: 8, marginTop: 9 }}>
            <Button variant="primary" full sound="none" onClick={saveKey}>
              Сохранить ключ
            </Button>
          </div>
          <div className="t-caption" style={{ marginTop: 8, lineHeight: 1.5 }}>
            Ключ берётся на platform.deepseek.com → API keys.
          </div>
        </div>
      )}

      {hasKey() && !open && (
        <div style={{ marginTop: 13 }}>
          <Button variant="primary" full sound="power" onClick={() => setOpen(true)}>
            Открыть чат
          </Button>
        </div>
      )}

      <AnimatePresence>
        {hasKey() && open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div
              ref={scrollRef}
              style={{
                marginTop: 13,
                maxHeight: 300,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {msgs.length === 0 && (
                <div className="flex flex-wrap" style={{ gap: 7 }}>
                  {SUGGEST.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => send(sug)}
                      className="t-caption"
                      style={{
                        padding: "8px 11px",
                        borderRadius: "var(--r-sm)",
                        background: "var(--btn-bg)",
                        border: "1px solid var(--btn-brd)",
                        textAlign: "left",
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              {msgs.map((m, i) => (
                <div
                  key={i}
                  className="t-body"
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    background: m.role === "user" ? "var(--acc)" : "var(--btn-bg)",
                    color: m.role === "user" ? "var(--acc-ink)" : "var(--text)",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {m.content}
                </div>
              ))}

              {busy && (
                <div
                  className="t-caption"
                  style={{
                    alignSelf: "flex-start",
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    background: "var(--btn-bg)",
                  }}
                >
                  думает…
                </div>
              )}
            </div>

            {err && (
              <div className="t-caption" style={{ marginTop: 9, color: "var(--danger)" }}>
                {err}
              </div>
            )}

            <div className="flex" style={{ gap: 8, marginTop: 11 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
                placeholder="Спроси что-нибудь"
                className="flex-1 t-body min-w-0"
                style={{
                  padding: "11px 12px",
                  borderRadius: "var(--r-md)",
                  background: "var(--btn-bg)",
                  border: "1px solid var(--btn-brd)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
              <Button
                variant="primary"
                size="sm"
                sound="none"
                onClick={() => (busy ? abort.current?.abort() : send(input))}
              >
                {busy ? "Стоп" : "→"}
              </Button>
            </div>

            <div className="flex" style={{ gap: 8, marginTop: 9 }}>
              <Button variant="ghost" size="sm" sound="none" onClick={() => setMsgs([])}>
                Очистить
              </Button>
              <Button
                variant="ghost" size="sm" sound="none"
                onClick={() => { setKey(""); setKeyInput(""); setOpen(false); setMsgs([]); }}
              >
                Забыть ключ
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
