import { tr } from "../core/i18n";
import GameIntro, { IntroGroup, IntroOption } from "./GameIntro";

/**
 * Меню настольной игры: соперник, сторона, уровень, старт.
 *
 * Общее для шахмат, шашек и нард. Пользователь жаловался на все три
 * экрана отдельно и об одном и том же: «выбор сложности стрёмный»,
 * «НАЧАТЬ ПАРТИЮ не понятно где, оно сливается с фоном», «скудновато
 * начало». Поэтому меню переехало на общий каркас GameIntro: кнопка
 * старта закреплена внизу крупной акцентной плашкой и не уезжает со
 * скроллом, «Выйти» рядом с ней настоящей кнопкой, а выбранный вариант
 * заливается акцентом целиком, а не обводится еле заметной рамкой.
 *
 * Добавлен выбор стороны — раньше играть можно было только белыми.
 */

export type VsMode = "bot" | "duo";
export type Side = "w" | "b";

export interface LevelDef {
  id: 1 | 2 | 3;
  name: string;
  sub: string;
}

export default function BoardMenu({
  title, subtitle, icon, vs, onVs, level, onLevel, levels, onStart, onExit,
  side, onSide, sideLabels, accentPieces,
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
  onExit: () => void;
  /** Выбор стороны. Если не передан — блок не показывается. */
  side?: Side;
  onSide?: (s: Side) => void;
  /** Как называются стороны в этой игре */
  sideLabels?: [string, string];
  /** декоративная строка фигур под заголовком */
  accentPieces?: React.ReactNode;
}) {
  const [lightName, darkName] = sideLabels ?? [tr("БЕЛЫЕ"), tr("ЧЁРНЫЕ")];

  return (
    <GameIntro
      title={title}
      subtitle={subtitle}
      icon={icon}
      startLabel={tr("НАЧАТЬ ПАРТИЮ")}
      onStart={onStart}
      onExit={onExit}
    >
      {accentPieces && (
        <div
          className="flex items-center justify-center"
          style={{
            marginBottom: 16, padding: "14px 0",
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
            border: "1px solid var(--surface-brd)",
          }}
        >
          {accentPieces}
        </div>
      )}

      <IntroGroup label={tr("СОПЕРНИК")}>
        <div className="flex" style={{ gap: 8 }}>
          <IntroOption
            label={tr("ПРОТИВ БОТА")}
            active={vs === "bot"}
            onClick={() => onVs("bot")}
          />
          <IntroOption
            label={tr("С ДРУГОМ")}
            active={vs === "duo"}
            onClick={() => onVs("duo")}
          />
        </div>
      </IntroGroup>

      {/* Сторона: только против бота — вдвоём цвет определяется очередью */}
      {side && onSide && vs === "bot" && (
        <IntroGroup label={tr("ИГРАЮ ЗА")}>
          <div className="flex" style={{ gap: 8 }}>
            <IntroOption
              label={lightName}
              desc={tr("ходишь первым")}
              active={side === "w"}
              onClick={() => onSide("w")}
            />
            <IntroOption
              label={darkName}
              desc={tr("соперник начинает")}
              active={side === "b"}
              onClick={() => onSide("b")}
            />
          </div>
        </IntroGroup>
      )}

      {vs === "bot" ? (
        <IntroGroup label={tr("СЛОЖНОСТЬ")}>
          {levels.map((l) => {
            const on = level === l.id;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onLevel(l.id)}
                className="flex items-center w-full"
                style={{
                  textAlign: "left", marginBottom: 8, gap: 12,
                  padding: "13px 14px", borderRadius: "var(--r-md)",
                  background: on ? "var(--acc)" : "var(--surface-2)",
                  border: `1px solid ${on ? "var(--acc)" : "var(--btn-brd)"}`,
                  color: on ? "var(--acc-ink)" : "var(--text)",
                  transition: "background .16s, border-color .16s, color .16s",
                }}
              >
                {/* индикатор силы: три полоски */}
                <span className="flex items-end shrink-0" style={{ gap: 3, height: 18 }}>
                  {[0, 1, 2].map((k) => (
                    <span
                      key={k}
                      style={{
                        width: 4, height: 6 + k * 6, borderRadius: 2,
                        background: k < l.id
                          ? (on ? "var(--acc-ink)" : "var(--acc)")
                          : (on ? "color-mix(in srgb, var(--acc-ink) 30%, transparent)" : "var(--btn-brd)"),
                      }}
                    />
                  ))}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="t-title-sm block clip1" style={{ fontSize: 12.5 }}>
                    {tr(l.name)}
                  </span>
                  <span
                    className="block clip1"
                    style={{
                      fontSize: 10.5, marginTop: 2,
                      color: on
                        ? "color-mix(in srgb, var(--acc-ink) 72%, transparent)"
                        : "var(--text-mute)",
                    }}
                  >
                    {tr(l.sub)}
                  </span>
                </span>
              </button>
            );
          })}
        </IntroGroup>
      ) : (
        <div
          style={{
            padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--surface)", border: "1px solid var(--surface-brd)",
          }}
        >
          <div className="t-body" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
            {tr("Играете по очереди на одном телефоне. Приложение подскажет, чей ход.")}
          </div>
        </div>
      )}
    </GameIntro>
  );
}
