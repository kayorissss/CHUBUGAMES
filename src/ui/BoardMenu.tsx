import { motion } from "framer-motion";
import { tr } from "../core/i18n";
import { sfx } from "../core/fx";
import Icon from "../ui/Icon";
import { EASE, listItem } from "../core/motion";
import { isLowFx } from "../core/perf";

/**
 * Меню настольной игры: соперник, уровень, старт.
 *
 * Общее для шахмат, шашек и нард — пользователь жаловался, что экраны
 * выбора выглядят криво. Здесь единая сетка отступов, крупный заголовок
 * с декоративной подложкой и аккуратные карточки выбора без «резких»
 * появлений: блоки въезжают каскадом.
 */

export type VsMode = "bot" | "duo";

export interface LevelDef {
  id: 1 | 2 | 3;
  name: string;
  sub: string;
}

export default function BoardMenu({
  title, subtitle, icon, vs, onVs, level, onLevel, levels, onStart, accentPieces,
}: {
  title: string;
  subtitle: string;
  icon: "brain" | "dice" | "clover";
  vs: VsMode;
  onVs: (v: VsMode) => void;
  level: 1 | 2 | 3;
  onLevel: (l: 1 | 2 | 3) => void;
  levels: LevelDef[];
  onStart: () => void;
  /** декоративная строка фигур под заголовком */
  accentPieces?: React.ReactNode;
}) {
  const low = isLowFx();
  const fade = (i: number) =>
    low ? {} : {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { delay: 0.05 + i * 0.05, duration: 0.32, ease: EASE },
    };

  return (
    <div
      className="flex-1 flex flex-col justify-center overflow-y-auto"
      style={{ padding: "calc(var(--sat) + 74px) 20px calc(var(--sab) + 26px)" }}
    >
      {/* Шапка */}
      <motion.div {...fade(0)} style={{ textAlign: "center", marginBottom: 18 }}>
        <div
          style={{
            width: 62, height: 62, margin: "0 auto 12px",
            borderRadius: 18,
            background: "var(--acc-soft)",
            border: "1px solid var(--acc)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--acc)",
          }}
        >
          <Icon name={icon} size={30} />
        </div>
        <div className="t-display" style={{ fontSize: 23, lineHeight: 1.15 }}>{title}</div>
        <div
          className="t-body"
          style={{ fontSize: 12, opacity: 0.58, marginTop: 6, lineHeight: 1.5 }}
        >
          {subtitle}
        </div>
        {accentPieces && <div style={{ marginTop: 12 }}>{accentPieces}</div>}
      </motion.div>

      {/* Соперник */}
      <motion.div {...fade(1)}>
        <div className="t-label" style={{ fontSize: 9.5, opacity: 0.55, marginBottom: 8 }}>
          {tr("СОПЕРНИК")}
        </div>
        <div className="flex" style={{ gap: 8, marginBottom: 16 }}>
          {([["bot", "ПРОТИВ БОТА"], ["duo", "С ДРУГОМ"]] as [VsMode, string][]).map(([id, nm]) => {
            const on = vs === id;
            return (
              <button
                key={id}
                onClick={() => { onVs(id); sfx.click(); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: "var(--r-md)",
                  background: on ? "var(--acc)" : "var(--surface)",
                  color: on ? "var(--acc-ink)" : "var(--text-mute)",
                  border: `1px solid ${on ? "var(--acc)" : "var(--surface-brd)"}`,
                }}
              >
                <span className="t-label" style={{ fontSize: 10.5 }}>{tr(nm)}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Уровень — только против бота */}
      {vs === "bot" && (
        <motion.div variants={listItem} initial={low ? false : "initial"} animate="animate">
          <div className="t-label" style={{ fontSize: 9.5, opacity: 0.55, marginBottom: 8 }}>
            {tr("СЛОЖНОСТЬ")}
          </div>
          {levels.map((l) => {
            const on = level === l.id;
            return (
              <button
                key={l.id}
                onClick={() => { onLevel(l.id); sfx.click(); }}
                className="flex items-center"
                style={{
                  width: "100%", textAlign: "left", marginBottom: 8, gap: 12,
                  padding: "12px 14px", borderRadius: "var(--r-md)",
                  background: on ? "var(--acc-soft)" : "var(--surface)",
                  border: `1px solid ${on ? "var(--acc)" : "var(--surface-brd)"}`,
                  color: "var(--fg)",
                }}
              >
                {/* индикатор силы: три полоски */}
                <span className="flex items-end shrink-0" style={{ gap: 3, height: 18 }}>
                  {[0, 1, 2].map((k) => (
                    <span
                      key={k}
                      style={{
                        width: 4, height: 6 + k * 6, borderRadius: 2,
                        background: k < l.id ? (on ? "var(--acc)" : "var(--text-mute)") : "var(--btn-brd)",
                      }}
                    />
                  ))}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="t-label"
                    style={{ fontSize: 11.5, display: "block", color: on ? "var(--acc)" : undefined }}
                  >
                    {tr(l.name)}
                  </span>
                  <span
                    className="t-body"
                    style={{ fontSize: 10.5, opacity: 0.58, display: "block", marginTop: 2 }}
                  >
                    {tr(l.sub)}
                  </span>
                </span>
              </button>
            );
          })}
        </motion.div>
      )}

      {vs === "duo" && (
        <div
          style={{
            padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--surface)", border: "1px solid var(--surface-brd)",
            marginBottom: 8,
          }}
        >
          <div className="t-body" style={{ fontSize: 11.5, opacity: 0.72, lineHeight: 1.55 }}>
            {tr("Играете по очереди на одном телефоне. Приложение подскажет, чей ход.")}
          </div>
        </div>
      )}

      <motion.button
        {...fade(3)}
        onClick={onStart}
        className="btn-acc t-label"
        style={{ width: "100%", marginTop: 14, padding: "15px 0", borderRadius: "var(--r-md)", fontSize: 13 }}
      >
        {tr("НАЧАТЬ ПАРТИЮ")}
      </motion.button>
    </div>
  );
}
