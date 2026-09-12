import { useEffect, useState } from "react";
import { Card, Button } from "./Glass";
import Icon from "./Icon";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";
import {
  ACTIONS, ALWAYS, type KeyAction, bind, pretty, readKeymap, resetKeymap, unbind,
} from "../core/keymap";

/**
 * ПЕРЕНАЗНАЧЕНИЕ КЛАВИШ В ИГРАХ.
 *
 * Слой управления (core/keymouse.ts) понимает шесть действий, а какие
 * клавиши к ним ведут — решает человек. Здесь он их и назначает: нажал
 * «НАЗНАЧИТЬ», ударил по любой клавише — готово. Если клавиша уже занята
 * другим действием, она переезжает: двух хозяев у одной кнопки быть не
 * должно.
 *
 * Стрелки, пробел и Shift показаны серыми и не снимаются: на них держатся
 * подсказки в играх, и остаться без стрелок было бы обидно.
 */
export default function KeymapCard() {
  const [map, setMap] = useState(() => readKeymap());
  const [waiting, setWaiting] = useState<KeyAction | null>(null);

  useEffect(() => {
    if (!waiting) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setWaiting(null); return; }
      // служебные клавиши не принимаем: Alt+F4 и Ctrl+Alt+Del никто не отменит
      if (["AltLeft", "AltRight", "MetaLeft", "MetaRight", "F1", "F2", "F3", "F4", "F5",
           "F6", "F7", "F8", "F9", "F10", "F12", "Tab"].includes(e.code)) {
        sfx.error();
        return;
      }
      bind(waiting, e.code);
      setMap(readKeymap());
      setWaiting(null);
      sfx.buy();
      haptic("success");
    };
    // ловим на перехвате и глушим всё: иначе «назначаемая» клавиша уедет
    // в игру или в поле поиска
    window.addEventListener("keydown", onKey, true);
    const onMsg = (e: KeyboardEvent) => e.preventDefault();
    window.addEventListener("keyup", onMsg, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onMsg, true);
    };
  }, [waiting]);

  return (
    <Card r="lg" style={{ padding: 12, marginBottom: 22 }}>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
        <span style={{ color: "var(--acc)", lineHeight: 0 }}><Icon name="settings" size={14} /></span>
        <span className="t-title-sm flex-1">{tr("Клавиши управления в играх")}</span>
        <span className="t-caption" style={{ fontSize: 9 }}>
          {waiting ? tr("жми любую клавишу…") : tr("стрелки, пробел и Shift — всегда")}
        </span>
      </div>

      <div className="eu-rows">
        {ACTIONS.map((a) => {
          const extra = map[a.id] || [];
          const base = ALWAYS[a.id];
          const isWaiting = waiting === a.id;
          return (
            <div
              key={a.id}
              className="eu-row"
              style={{ gridTemplateColumns: "auto 1fr auto auto", opacity: 1, cursor: "default" }}
            >
              <span className="eu-row-k">
                <Icon name={a.id === "act" ? "tap" : a.id === "boost" ? "speed" : "arrowUp"} size={11} />
                {tr(a.name)}
              </span>
              <span className="eu-row-hint" style={{ whiteSpace: "normal" }}>
                {[...base, ...extra].map((c) => (
                  <span key={c} className="eu-keychip">
                    {pretty(c)}
                    {!base.includes(c) && (
                      <button
                        type="button"
                        aria-label={tr("убрать")}
                        onClick={() => { unbind(a.id, c); setMap(readKeymap()); sfx.click(); }}
                      >
                        <Icon name="cross" size={7} />
                      </button>
                    )}
                  </span>
                ))}
              </span>
              <Button
                size="sm"
                variant={isWaiting ? "primary" : "secondary"}
                onClick={() => { setWaiting(isWaiting ? null : a.id); sfx.click(); }}
              >
                {isWaiting ? tr("ОТМЕНА") : tr("НАЗНАЧИТЬ")}
              </Button>
              <span className="eu-row-key">{extra.length}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center" style={{ gap: 8, marginTop: 10 }}>
        <span className="t-caption flex-1" style={{ fontSize: 9 }}>
          {tr("Назначенные клавиши работают в любой игре: они водят палец по полю, а пробел нажимает.")}
        </span>
        <Button
          size="sm"
          onClick={() => { resetKeymap(); setMap(readKeymap()); sfx.tap(); }}
        >
          {tr("СБРОСИТЬ")}
        </Button>
      </div>
    </Card>
  );
}
