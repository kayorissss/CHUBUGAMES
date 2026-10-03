import { motion } from "framer-motion";
import { tr } from "../core/i18n";
import { Panel, Screen, Tap } from "../ui/Glass";
import Icon from "../ui/Icon";
import { sfx, haptic } from "../core/fx";
import { isDesktop } from "../core/desktop";

/** Ссылка на приём донатов */
export const DONATE_URL = "https://pay.cloudtips.ru/p/cab48a6e";
export const AUTHOR_URL = "https://t.me/kayorisan";

/* tr() на уровне модуля возвращал всегда русский: язык в этот момент ещё
   не выбран. Сами строки — оригиналы, перевод вызывается в render. */
const PERKS = [
  { icon: "bolt", title: "Новые игры", desc: "Каждое обновление — ещё режимы и механики" },
  { icon: "users", title: "Больше друзей", desc: "Новые персонажи и боссы в общаге" },
  { icon: "sparkle", title: "Оформление", desc: "Анимации, скины, украшения" },
  { icon: "shield", title: "Без рекламы", desc: "Ролики только по желанию, за награду" },
] as const;

const SUMS = ["100 ₽", "300 ₽", "500 ₽", "1000 ₽"];

/**
 * ПОДДЕРЖКА.
 *
 * Претензия: «экран поддержки уродлив». Что было не так:
 *   • золото было вбито хексами (`rgba(255,176,32,.45)`), поэтому плашка не
 *     перекрашивалась ни под тему, ни под акцент и выглядела наклейкой;
 *   • три бесконечных цикла анимации («дышащий» фон, пульсирующая иконка,
 *     подъезжающие кнопки) — на мониторе это не «живой» экран, а жужжащий,
 *     и он стоит кадров фреймеру на пустой странице;
 *   • два абзаца текста были написаны мимо `tr()` — при английском языке
 *     страница поддержки оставалась русской;
 *   • на ПК всё шло одной колонкой на 400 px под левым краем, и справа
 *     стояла мёртвая пустота.
 *
 * Стало: спокойная плашка на токенах, без бесконечных петель, с двумя
 * колонками на мониторе (решение о сумме — слева, «куда идут деньги» и
 * автор — справа) и с переводом всех строк.
 */
export default function Donate({ onBack }: { onBack: () => void }) {
  const pc = isDesktop();
  const open = (url: string) => {
    sfx.click();
    haptic("light");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Screen
      title={tr("ПОДДЕРЖКА")}
      sub={tr("Проект делается для своих")}
      right={
        <button
          type="button"
          onClick={() => { sfx.click(); onBack(); }}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 34, height: 34, borderRadius: "var(--r-sm)",
            background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
          }}
          aria-label={tr("Закрыть")}
        >
          <Icon name="cross" size={15} />
        </button>
      }
    >
      <div className={`pc-don ${pc ? "pc-don-wide" : ""}`}>
        {/* ── решение ── */}
        <motion.div
          className="pc-don-col"
          initial={{ opacity: 0, y: pc ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Panel r="xl" strong className="pc-don-hero">
            <span className="pc-don-ico" aria-hidden>
              <Icon name="heart" size={30} />
            </span>
            <div className="t-display pc-don-title">{tr("СПАСИБО")}</div>
            <div className="t-body pc-don-lead">
              {tr("CHUBUGAMES бесплатный и без обязательной рекламы. Если игра зашла — можно закинуть на развитие. Любая сумма помогает и мотивирует пилить дальше.")}
            </div>

            {/* Подсказка по суммам: так проще решиться, чем перед пустым полем */}
            <div className="pc-don-sums">
              {SUMS.map((x) => (
                <button
                  key={x}
                  type="button"
                  className="pc-don-sum t-num"
                  onClick={() => open(DONATE_URL)}
                >
                  {x}
                </button>
              ))}
            </div>

            <Tap
              onClick={() => open(DONATE_URL)}
              accent
              r="md"
              center
              className="w-full py-4 t-title"
              style={{ fontSize: 15 }}
              sound="coin"
            >
              <span className="inline-flex items-center" style={{ gap: 9 }}>
                <Icon name="gift" size={17} />{tr("ПОДДЕРЖАТЬ ПРОЕКТ")}
              </span>
            </Tap>

            <div className="t-caption pc-don-note">
              {tr("Откроется CloudTips — карта, СБП")}
            </div>
          </Panel>

          <div className="pc-don-plain">
            {tr("Поддержка добровольная и ни на что не влияет в игре — никаких платных преимуществ здесь нет.")}
          </div>
        </motion.div>

        {/* ── на что идёт и кто автор ── */}
        <motion.div
          className="pc-don-col"
          initial={{ opacity: 0, y: pc ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: pc ? 0.05 : 0.1, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="t-label pc-don-cap">{tr("Куда пойдут деньги")}</div>
          <div className="pc-don-perks">
            {PERKS.map((p) => (
              <div key={p.title} className="pc-don-perk">
                <span className="pc-don-perk-ico" aria-hidden>
                  <Icon name={p.icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="t-title-sm block">{tr(p.title)}</span>
                  <span className="t-caption block pc-don-perk-desc">{tr(p.desc)}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="t-label pc-don-cap">{tr("Связь")}</div>
          <Panel r="lg" style={{ padding: 0 }}>
            <button type="button" className="pc-don-author" onClick={() => open(AUTHOR_URL)}>
              <span className="pc-don-perk-ico" aria-hidden>
                <Icon name="user" size={16} />
              </span>
              <span className="flex-1 min-w-0 text-left">
                <span className="t-title-sm block">{tr("Написать автору")}</span>
                <span className="t-caption block pc-don-perk-desc">
                  {tr("идеи, баги, предложения — @kayorisan")}
                </span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          </Panel>
        </motion.div>
      </div>
    </Screen>
  );
}
