import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, Screen, Tap } from "../ui/Glass";
import Icon from "../ui/Icon";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";
import {
  FANFICS, blockAt, hasVoice, readFanfic, writeFanfic,
  type Fanfic, type FanficChapter,
} from "../core/fanfic";

/**
 * СБОРНИК ФАНФИКОВ — читалка с озвучкой.
 *
 * Главное здесь: пока играет аудио, подсвечивается тот абзац, который
 * сейчас читают, и страница сама подкручивается к нему. Синхронизация
 * по таймкодам из core/fanfic.ts.
 */

function Reader({ fic, ch, onBack }: { fic: Fanfic; ch: FanficChapter; onBack: () => void }) {
  const [cur, setCur] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [font, setFont] = useState(() => readFanfic().fontSize);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const voice = hasVoice(ch);

  // Следим за временем аудио и подсвечиваем нужный абзац
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCur(blockAt(ch.blocks, a.currentTime));
    const onEnd = () => { setPlaying(false); setCur(-1); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
    };
  }, [ch]);

  // Подкручиваем к подсвеченному абзацу
  useEffect(() => {
    if (cur < 0 || !boxRef.current) return;
    const el = boxRef.current.querySelector<HTMLElement>(`[data-i="${cur}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [cur]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    sfx.click();
    haptic("light");
    if (a.paused) { void a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };

  const setFontSize = (n: number) => {
    const v = Math.max(13, Math.min(24, n));
    setFont(v);
    const p = readFanfic();
    writeFanfic({ ...p, fontSize: v });
  };

  return (
    <Screen
      className="pc-reader"
      title={ch.title}
      sub={fic.title}
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
      {/* Панель управления: озвучка и размер шрифта */}
      <Panel r="lg" style={{ padding: 11, marginBottom: 12 }}>
        <div className="flex items-center" style={{ gap: 9 }}>
          {voice && (
            <Tap
              onClick={toggle}
              accent={playing}
              r="sm"
              center
              className="t-label shrink-0"
              style={{ padding: "9px 14px", fontSize: 9.5 }}
              sound="none"
            >
              <span className="inline-flex items-center" style={{ gap: 6 }}>
                <Icon name={playing ? "pause" : "play"} size={13} />
                {playing ? tr("ПАУЗА") : tr("ОЗВУЧКА")}
              </span>
            </Tap>
          )}

          <span className="flex-1" />

          <button
            type="button"
            onClick={() => setFontSize(font - 1)}
            className="t-num"
            style={{
              width: 30, height: 30, borderRadius: "var(--r-sm)",
              background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
            }}
          >−</button>
          <span className="t-num" style={{ fontSize: 11, minWidth: 26, textAlign: "center" }}>
            {font}
          </span>
          <button
            type="button"
            onClick={() => setFontSize(font + 1)}
            className="t-num"
            style={{
              width: 30, height: 30, borderRadius: "var(--r-sm)",
              background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
            }}
          >+</button>
        </div>

        {voice && (
          <div className="t-caption" style={{ marginTop: 8, fontSize: 9.5 }}>
            {tr("Во время озвучки подсвечивается читаемый абзац")}
          </div>
        )}
      </Panel>

      {ch.audio && <audio ref={audioRef} src={ch.audio} preload="metadata" />}

      {/* Текст главы */}
      <div ref={boxRef}>
        {ch.blocks.map((b, i) => (
          <div key={i} data-i={i}>
            {b.image && (
              <img
                src={b.image}
                alt=""
                style={{
                  width: "100%", borderRadius: "var(--r-md)",
                  margin: "12px 0", display: "block",
                }}
              />
            )}
            <motion.p
              animate={{
                backgroundColor: cur === i ? "var(--acc-soft)" : "rgba(0,0,0,0)",
                color: cur === i ? "var(--text)" : "var(--text-dim)",
              }}
              transition={{ duration: 0.25 }}
              style={{
                fontSize: font,
                lineHeight: 1.72,
                padding: "9px 12px",
                borderRadius: "var(--r-sm)",
                marginBottom: 6,
                borderLeft: cur === i ? "2.5px solid var(--acc)" : "2.5px solid transparent",
              }}
            >
              {b.text}
            </motion.p>
          </div>
        ))}
      </div>

      <div style={{ height: 30 }} />
    </Screen>
  );
}

export default function FanficPage({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<{ fic: Fanfic; ch: FanficChapter } | null>(null);

  if (open) {
    return <Reader fic={open.fic} ch={open.ch} onBack={() => setOpen(null)} />;
  }

  return (
    <Screen
      title={tr("ФАНФИКИ")}
      sub={tr("Сборник историй")}
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
      <AnimatePresence>
        {FANFICS.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Panel r="xl" style={{ padding: 16, marginBottom: 12 }}>
              <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
                <span
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: 46, height: 46, borderRadius: "var(--r-sm)",
                    background: "var(--violet-soft)", color: "var(--violet)",
                  }}
                >
                  <Icon name="note" size={22} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="t-title-sm clip1 block">{f.title}</span>
                  <span className="t-caption clip1 block" style={{ marginTop: 2 }}>
                    {f.author} · {f.chapters.length} {tr("глав")}
                  </span>
                </span>
              </div>

              <div className="t-caption" style={{ marginBottom: 12, lineHeight: 1.55 }}>
                {f.about}
              </div>

              {f.chapters.map((c) => (
                <Tap
                  key={c.id}
                  onClick={() => { sfx.click(); setOpen({ fic: f, ch: c }); }}
                  r="sm"
                  className="w-full"
                  style={{ padding: "11px 13px", marginBottom: 6, display: "block" }}
                >
                  <span className="flex items-center" style={{ gap: 9 }}>
                    <span className="t-body flex-1 text-left clip1" style={{ fontSize: 12.5 }}>
                      {c.title}
                    </span>
                    {hasVoice(c) && (
                      <span style={{ color: "var(--ok)", lineHeight: 0 }}>
                        <Icon name="sound" size={13} />
                      </span>
                    )}
                    <Icon name="chevron" size={13} />
                  </span>
                </Tap>
              ))}
            </Panel>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="t-caption" style={{ textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
        {tr("Пришли текст, картинки и озвучку — добавлю сюда как отдельную историю.")}
      </div>
    </Screen>
  );
}
