import { Tap } from "./Glass";
import GameIcon from "./GameIcon";
import Icon from "./Icon";
import { tr } from "../core/i18n";
import { fmt } from "../core/format";
import { sfx, haptic } from "../core/fx";
import { useGame } from "../core/store";
import type { GameId } from "../core/types";
import type { GameMeta } from "../core/content";

/**
 * ПЛИТКА МИНИ-ИГРЫ.
 *
 * Одна разметка на телефон и на компьютер. Раньше на ПК использовалась
 * та же вертикальная карточка, что и в списке на телефоне: на широком окне
 * она растягивалась в простыню, и получалось «накидано». Здесь плитка
 * сама меняет плотность через CSS (.pc-tile в index.css), а содержимое
 * остаётся общим — правка карточки приходит в оба интерфейса сразу.
 *
 * Долгий тап (телефон) / правый клик (мышь) — закрепить игру: закреплённые
 * идут первыми в любой сортировке.
 */

export default function GameTile({
  g, unlocked, lockedLevel, onPlay, compact,
}: {
  g: GameMeta;
  unlocked: boolean;
  lockedLevel?: number;
  onPlay: (id: GameId) => void;
  /** Узкая колонка (телефон) — на ПК не используется */
  compact?: boolean;
}) {
  const { s, set } = useGame();
  const st = s.games[g.id];
  const fav = (s.settings.favGames || []).includes(g.id);

  const toggleFav = () => {
    if (!unlocked) return;
    haptic("medium");
    sfx.tap?.();
    set((d) => {
      const cur = d.settings.favGames || [];
      d.settings.favGames = cur.includes(g.id)
        ? cur.filter((x) => x !== g.id)
        : [...cur, g.id];
    });
  };

  return (
    <Tap
      onClick={() => unlocked && onPlay(g.id)}
      onLongPress={toggleFav}
      disabled={!unlocked}
      solid
      r="lg"
      className={`w-full h-full pc-tile ${unlocked ? "" : "pc-tile-locked"}`}
      sound="power"
      style={{ display: "block" }}
    >
      {/* мягкая подсветка сверху появляется на.hover — только на ПК */}
      <span aria-hidden className="pc-tile-wash" />

      <div
        className="flex flex-col h-full"
        style={{ padding: compact ? 13 : undefined, minHeight: compact ? 152 : undefined }}
      >
        <div className="flex items-start justify-between pc-tile-top">
          <span className="pc-tile-badge" style={{ lineHeight: 0, color: "var(--text)" }}>
            {unlocked ? (
              <GameIcon id={g.id} size={27} />
            ) : (
              <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 018 0v3" />
              </svg>
            )}
          </span>
          <span className="flex items-center pc-tile-tags">
            {fav && (
              <span style={{ color: "var(--gold)", lineHeight: 0 }}>
                <Icon name="star" size={12} />
              </span>
            )}
            <span className="t-label pc-tile-tag">{tr(g.tag)}</span>
          </span>
        </div>

        <div className="t-title-sm clip1 pc-tile-name">{unlocked ? tr(g.name) : "?????"}</div>
        <div className="t-caption clip2 pc-tile-desc">
          {unlocked ? tr(g.desc) : `${tr("Уровень")} ${lockedLevel ?? 0}`}
        </div>

        {unlocked && (
          <div className="flex items-center justify-between pc-tile-foot">
            <span className="t-num acc-text pc-tile-best">{fmt(st.best)}</span>
            <span className="t-caption pc-tile-plays">
              {st.plays} {tr("игр")}
            </span>
            {/* на мыши — явная подсказка, что это кнопка «в игру» */}
            <span className="t-label pc-tile-go">
              {tr("Играть")} <Icon name="chevron" size={11} />
            </span>
          </div>
        )}
      </div>
    </Tap>
  );
}
