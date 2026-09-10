import { useEffect, useRef, useState } from "react";
import { sfx, haptic } from "../core/fx";
import { isLowFx } from "../core/perf";
import type { Sector } from "../core/wheel";

/**
 * Колесо апгрейда.
 *
 * Секторы рисуются дугами SVG, стрелка неподвижно стоит сверху, крутится
 * само колесо. Анимация идёт по requestAnimationFrame с замедлением
 * (ease-out четвёртой степени) — так колесо честно «доезжает», а не
 * тормозит рывком.
 *
 * Звук тикает не по таймеру, а по фактически пройденным границам
 * секторов: считаем, сколько границ проехали с прошлого кадра. На
 * быстрой прокрутке тиков было бы сотни в секунду, поэтому частота
 * ограничена — иначе получается треск вместо щелчков.
 */

const SIZE = 240;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUT = 104;
const R_IN = 52;

/** Точка на окружности: угол 0 — верх, дальше по часовой */
function pt(angleDeg: number, r: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

/** Путь кольцевого сектора */
function arcPath(start: number, size: number): string {
  // Полный круг дугой нарисовать нельзя — режем на две половины
  if (size >= 359.9) {
    const a = arcPath(0, 180);
    const b = arcPath(180, 180);
    return `${a} ${b}`;
  }
  const end = start + size;
  const large = size > 180 ? 1 : 0;
  const o1 = pt(start, R_OUT);
  const o2 = pt(end, R_OUT);
  const i2 = pt(end, R_IN);
  const i1 = pt(start, R_IN);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${R_IN} ${R_IN} 0 ${large} 0 ${i1.x} ${i1.y}`,
    "Z",
  ].join(" ");
}

export default function Wheel({
  sectors, angle, spinning, duration = 4200, onDone, centerLabel, centerSub,
}: {
  sectors: Sector[];
  /** целевой угол поворота колеса */
  angle: number;
  spinning: boolean;
  duration?: number;
  onDone?: () => void;
  centerLabel?: string;
  centerSub?: string;
}) {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);
  const low = isLowFx();

  useEffect(() => {
    if (!spinning) return;
    const from = fromRef.current;
    // добавляем несколько полных оборотов, чтобы это выглядело как розыгрыш
    const turns = low ? 3 : 5;
    const target = from + turns * 360 + ((angle - (from % 360)) + 360) % 360;
    const t0 = performance.now();
    lastTickRef.current = from;

    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      // сильное замедление к концу
      const e = 1 - Math.pow(1 - k, 4);
      const cur = from + (target - from) * e;
      setShown(cur);

      // тик на каждой пройденной границе сектора, но не чаще 22 в секунду
      if (!low) {
        const bounds = sectors.length;
        const stepDeg = 360 / Math.max(1, bounds);
        if (cur - lastTickRef.current >= stepDeg) {
          lastTickRef.current = cur;
          sfx.wheelTick();
        }
      }

      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else {
        fromRef.current = target;
        onDone?.();
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, angle]);

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, margin: "0 auto" }}>
      {/* Стрелка — неподвижна, смотрит вниз на колесо */}
      <svg
        width={30} height={26}
        viewBox="0 0 30 26"
        style={{ position: "absolute", left: "50%", top: 4, transform: "translateX(-50%)", zIndex: 3 }}
        aria-hidden
      >
        <path d="M15 25 L3 3 h24 Z" fill="var(--acc)" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
      </svg>

      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <g transform={`rotate(${shown} ${CX} ${CY})`}>
          {sectors.map((s, i) => (
            <path
              key={i}
              d={arcPath(s.start, s.size)}
              fill={s.color}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="1.5"
            />
          ))}
          {/* насечки по границам секторов — видно, что колесо крутится */}
          {sectors.map((s, i) => {
            const a = pt(s.start, R_OUT);
            const b = pt(s.start, R_IN);
            return (
              <line
                key={`l${i}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="rgba(0,0,0,0.45)" strokeWidth="1.5"
              />
            );
          })}
        </g>

        {/* обод */}
        <circle cx={CX} cy={CY} r={R_OUT + 4} fill="none" stroke="var(--surface-brd)" strokeWidth="3" />
        <circle cx={CX} cy={CY} r={R_IN - 3} fill="var(--surface)" stroke="var(--surface-brd)" strokeWidth="2" />
      </svg>

      {/* центр — шанс */}
      <div
        style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {centerLabel && (
          <div className="t-num acc-text" style={{ fontSize: 26, lineHeight: 1 }}>{centerLabel}</div>
        )}
        {centerSub && (
          <div className="t-label" style={{ fontSize: 8.5, opacity: 0.65, marginTop: 3 }}>{centerSub}</div>
        )}
      </div>
    </div>
  );
}

/** Короткий вызов вибрации при остановке — вынесен, чтобы не дублировать */
export function wheelStopFeedback(won: boolean) {
  if (won) { sfx.wheelWin(); haptic("success"); }
  else { sfx.gameOver?.(); haptic("error"); }
}
