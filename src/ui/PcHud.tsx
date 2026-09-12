import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  adaptValue, fpsWatch, onAdapt, onFps, readFps, type FpsSample,
} from "../core/perf";
import { onKeys, onKeysPtr, readKeys, type KeyState } from "../core/keymouse";
import { tr } from "../core/i18n";

/**
 * ПОДСЧЁТКИ В ИГРЕ: счётчик кадров и указатель для WASD.
 *
 * Обе живут в контейнере игры (App вешает их рядом с самой игрой), а не
 * внутри игр: счётчик обязан быть виден в любой из двадцати девяти, иначе
 * «померить FPS в шахматах» превратилось бы в правку двадцати девяти
 * файлов. И там, и здесь — минимум React: цифры обновляются раз в ~450 мс,
 * а кольцо курсора ходит по экрану вообще без перерисовок (transform в DOM).
 */

/** Кадры в секунду. Выключается в настройках: «Игра» → «Показывать FPS». */
export function FpsHud() {
  const [m, setM] = useState<FpsSample>(() => readFps());
  // разрешение рисования меняется адаптивом — показываем его рядом, чтобы
  // было видно: «тормозит» или «картинка стала проще, зато летает»
  const [ad, setAd] = useState(() => adaptValue());
  useEffect(() => onFps(setM), []);
  useEffect(() => onAdapt(() => setAd(adaptValue())), []);
  // для игр без канваса (шахматы, кроссворд) включаем резервный счётчик
  useEffect(() => fpsWatch(), []);

  const tone = m.fps >= 55 ? "" : m.fps >= 30 ? "fps-hud-warn" : "fps-hud-bad";
  const pct = Math.max(3, Math.min(100, (m.fps / 60) * 100));

  return (
    <div className={`fps-hud ${tone}`} role="status" aria-label="FPS">
      <div className="fps-hud-row">
        <span>{m.fps || "—"}</span>
        <small>FPS</small>
      </div>
      <div className="fps-hud-bar" aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </div>
      {m.worst >= 40 && (
        <div className="fps-hud-worst">
          {tr("просадка")} {m.worst} мс
        </div>
      )}
      {ad < 0.99 && (
        <div className="fps-hud-scale">
          {tr("разрешение")} {Math.round(ad * 100)}%
        </div>
      )}
    </div>
  );
}

/**
 * Кольцо там, где сейчас «палец» от клавиатуры, и подсказка по WASD.
 *
 * Показывается только после того, как игрок тронул клавиши: с мышью в руке
 * кольцо только мешало бы, поэтому молчим, пока управление не перешло к
 * клавиатуре. Прячется само, если клавиши не трогать ~1.6 сек.
 *
 * Позицию пишем в transform напрямую: React на каждый кадр тут был бы
 * дороже самой игры.
 */
export function KeyCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState<KeyState>(() => ({ ...readKeys() }));

  useEffect(() => {
    const paint = (x: number, y: number, act: boolean) => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      el.classList.toggle("key-cursor-press", act);
    };
    const offPtr = onKeysPtr(paint);
    let hideT: number | undefined;
    const off = onKeys((s) => {
      setK({ ...s });
      paint(s.x, s.y, s.act);
      if (s.usingKeys) {
        window.clearTimeout(hideT);
        hideT = window.setTimeout(() => {
          readKeys().usingKeys = false;
          setK({ ...readKeys() });
        }, 1600);
      }
    });
    paint(readKeys().x, readKeys().y, readKeys().act);
    return () => {
      offPtr();
      window.clearTimeout(hideT);
      off();
    };
  }, []);

  const shown = k.usingKeys;

  return (
    <AnimatePresence>
      {/* начальную позицию отдаём сразу в style: иначе на первом кадре
          кольцо на мгновение мелькнуло бы в левом верхнем углу поля */}
      {shown && (
        <div
          key="cur"
          className="key-cursor"
          ref={ref}
          style={{ left: 0, top: 0, transform: `translate3d(${k.x}px, ${k.y}px, 0)` }}
          aria-hidden
        >
          <i className={`k-up ${k.up ? "on" : ""}`} />
          <i className={`k-left ${k.left ? "on" : ""}`} />
          <i className={`k-right ${k.right ? "on" : ""}`} />
          <i className={`k-down ${k.down ? "on" : ""}`} />
        </div>
      )}
      {shown && (
        <motion.div
          key="legend"
          className="key-legend"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <span>W A S D</span>
          <em>= {tr("двигать")}</em>
          <span>{tr("ПРОБЕЛ")}</span>
          <em>= {tr("нажать")}</em>
          <span>SHIFT</span>
          <em>= {tr("быстрее")}</em>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
