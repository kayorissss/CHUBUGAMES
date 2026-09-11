import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { GameProvider, useGame } from "./core/store";
import { Aurora } from "./ui/Glass";
import Nav, { type Tab } from "./components/Nav";

/** Подстраницы поверх вкладок */
export type SubPage = "network" | "casino" | "donate" | "boss" | "fanfic";
import { Toasts, OfflineModal } from "./components/Overlays";
import UpdateBanner from "./ui/UpdateBanner";
import WhatsNew from "./ui/WhatsNew";
import {
  cancelBossNotifications,
  initNotificationsOnFirstRun,
  scheduleBossNotifications,
  scheduleNewsNotifications,
  cancelNewsNotifications,
  syncInstalledVersion,
} from "./core/notify";
import { upcomingBosses } from "./core/bosses";
import { applyPerfMode, isLowFx, measurePerfOnce } from "./core/perf";
import { initDesktopKeys, initStage, isDesktop } from "./core/desktop";
import BootScreen from "./ui/BootScreen";
import PcTopBar from "./ui/pc/PcTopBar";
import FanficPage from "./pages/Fanfic";
import Home from "./pages/Home";
import { ModesProvider } from "./core/modes";
import Casino from "./pages/Casino";
import Donate from "./pages/Donate";
import BossFight from "./pages/BossFight";
import ProgressPage from "./pages/Progress";
import Shop from "./pages/Shop";
import Friends from "./pages/Friends";
import Settings from "./pages/Settings";
import Network from "./pages/Network";
import BurgerRain from "./games/BurgerRain";
import Clicker from "./games/Clicker";
import MergeHeads from "./games/MergeHeads";
import WhackFriend from "./games/WhackFriend";
import ArtyomBite from "./games/ArtyomBite";
import ShitovRun from "./games/ShitovRun";
import RadomirBeat from "./games/RadomirBeat";
import BurgerStack from "./games/BurgerStack";
import Cheat from "./games/Cheat";
import Elevator from "./games/Elevator";
import Basket from "./games/Basket";
import Volley from "./games/Volley";
import Penalty from "./games/Penalty";
import Pool from "./games/Pool";
import Crossword from "./games/Crossword";
import Bus12 from "./games/Bus12";
import ChubPet from "./games/ChubPet";
import MaksBeard from "./games/MaksBeard";
import MotoArtyom from "./games/MotoArtyom";
import FuelHunt from "./games/FuelHunt";
import KirillHands from "./games/KirillHands";
import Europa from "./games/Europa";
import Chess from "./games/Chess";
import Checkers from "./games/Checkers";
import Backgammon from "./games/Backgammon";
import { pageVariants, subPageVariants, gameVariants } from "./core/motion";
import Canteen from "./games/Canteen";
import WhoWasIt from "./games/WhoWasIt";
import RadomirFlight from "./games/RadomirFlight";
import DormDefense from "./games/DormDefense";
import { unlockAudio } from "./core/fx";
import { pushBack } from "./core/nav";
import type { GameId } from "./core/types";

/**
 * Заставка вынесена в src/ui/BootScreen.tsx: она одна на телефон и на
 * компьютер. Раньше их было две — мобильная (в этом файле) и десктопная
 * (PcBoot), и они успели разъехаться по анимациям и размерам.
 */

function Shell() {
  const { s } = useGame();
  /** ПК-раскладка: верхняя панель вместо нижнего меню, две колонки на главной */
  const pc = isDesktop();
  const [splash, setSplash] = useState(true);
  /*
   * Стартовый раздел умеет приходить из адреса: ?tab=settings. Нужно это
   * ярлыкам PWA (public/manifest.json → shortcuts) и ссылкам из уведомлений:
   * без проверки человек получил бы всегда домашний экран.
   */
  const [tab, setTab] = useState<Tab>(() => {
    const want = new URLSearchParams(location.search).get("tab");
    return (["home", "progress", "shop", "friends", "settings"] as const).includes(want as Tab)
      ? (want as Tab)
      : "home";
  });
  const [game, setGame] = useState<GameId | null>(null);
  // отдельные подстраницы поверх вкладок
  const [sub, setSub] = useState<SubPage | null>(null);
  // Влияет на анимации: в облегчённом режиме их выключаем целиком
  const [lowFx, setLowFx] = useState(() => isLowFx());

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Слабые телефоны: сначала быстрая догадка по железу (чтобы первые
  // секунды не лагали), потом честный замер FPS — он и решает.
  // Гадать по числу ядер бесполезно: у Realme C3 их восемь.
  useEffect(() => {
    applyPerfMode();
    measurePerfOnce((weak) => setLowFx(weak));
  }, []);

  useEffect(() => { void syncInstalledVersion(); }, []);

  /*
   * ПК-версия. На телефоне «назад» — системный жест, на компьютере его
   * нет, поэтому вешаем Escape на тот же стек слоёв (core/nav.ts).
   * Класс на <html> позволяет прятать чисто мобильные элементы.
   */
  useEffect(() => {
    if (!isDesktop()) return;
    document.documentElement.classList.add("is-desktop");
    const offKeys = initDesktopKeys();
    const offStage = initStage();
    // Цифры 1-5 — переключение разделов с клавиатуры
    const order: Tab[] = ["home", "progress", "shop", "friends", "settings"];
    const onNav = (e: Event) => {
      const i = (e as CustomEvent<number>).detail;
      if (order[i]) { setSub(null); setTab(order[i]); }
    };
    window.addEventListener("chub:nav", onNav);
    return () => {
      offKeys();
      offStage();
      window.removeEventListener("chub:nav", onNav);
    };
  }, []);

  // При первом запуске система сама спросит про уведомления — тумблер в
  // настройках после этого только включает и выключает напоминания.
  useEffect(() => { void initNotificationsOnFirstRun(); }, []);

  // Напоминания о боссах. Расписание считается формулой, поэтому ставим
  // их сразу на 12 часов вперёд — приложение может долго не открываться.
  // Переставляем при каждом запуске, чтобы список всегда был свежим.
  useEffect(() => {
    if (s.settings.notifyBoss) void scheduleBossNotifications(upcomingBosses());
    else void cancelBossNotifications();
  }, [s.settings.notifyBoss]);

  // Канал НОВИНКИ: напоминание про ежедневки. Перепланируем при запуске,
  // потому что расписание ставится на неделю вперёд и постепенно расходуется.
  useEffect(() => {
    if (s.settings.notifyNews) void scheduleNewsNotifications();
    else void cancelNewsNotifications();
  }, [s.settings.notifyNews]);

  // системная кнопка/жест «назад» закрывает игру, а не приложение
  useEffect(() => {
    if (!game) return;
    return pushBack("game", () => setGame(null));
  }, [game]);

  // «назад» закрывает подстраницу
  useEffect(() => {
    if (!sub) return;
    return pushBack(`sub:${sub}`, () => setSub(null));
  }, [sub]);

  // с любой вкладки «назад» возвращает на Игры
  useEffect(() => {
    if (game || sub || tab === "home") return;
    return pushBack(`tab:${tab}`, () => setTab("home"));
  }, [tab, game, sub]);

  // блокируем зум/скролл жестами
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", prevent);
    document.addEventListener("dblclick", prevent);
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("dblclick", prevent);
    };
  }, []);

  const pages: Record<Tab, React.ReactNode> = {
    home: <Home onPlay={(g) => setGame(g)} onOpenProfile={() => setTab("progress")} onOpen={setSub} />,
    progress: <ProgressPage />,
    shop: <Shop />,
    friends: <Friends />,
    settings: <Settings onOpen={setSub} onTab={setTab} />,
  };

  return (
    <ModesProvider
      onSwitchGame={(g) => setGame(g)}
      currentGame={game}
      bestOf={(g) => s.games[g]?.best ?? 0}
    >
    <MotionConfig reducedMotion={lowFx ? "always" : "never"}>
    <div className={pc ? "h-full w-full pc-shell" : "h-full w-full relative overflow-hidden"} style={{ background: "var(--bg)" }}>
      {s.settings.fx && !lowFx && <Aurora />}

      {/* ПК: разделы, профиль и кошелёк живут в верхней панели. На мониторе
          нижнее меню выглядит чужим, а боковая колонка с разделами съедала
          треть ширины, оставляя игры узкой полоской. */}
      {pc && (
        <PcTopBar
          tab={tab}
          sub={sub}
          onTab={(next) => { setSub(null); setTab(next); }}
          onOpen={setSub}
          onOpenProfile={() => { setSub(null); setTab("progress"); }}
        />
      )}

      {/* display:contents на телефоне — оболочка не влияет на мобильную
          раскладку, но на ПК этоflex-колонка, внутри которой лежат
          страницы, подстраницы и игры */}
      <div className={pc ? "pc-body" : "contents"}>
      <div className="relative h-full" style={{ zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full"
          >
            {pages[tab]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Подстраницы поверх вкладок */}
      <AnimatePresence>
        {sub && (
          <motion.div
            key={sub}
            variants={subPageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 pc-sub"
            style={{ zIndex: 40, background: "var(--bg)" }}
          >
            {sub === "network" && <Network onBack={() => setSub(null)} />}
            {sub === "casino" && <Casino onBack={() => setSub(null)} />}
            {sub === "donate" && <Donate onBack={() => setSub(null)} />}
            {sub === "boss" && <BossFight onBack={() => setSub(null)} />}
            {sub === "fanfic" && <FanficPage onBack={() => setSub(null)} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Нижнее меню видно и поверх подстраниц (казино, донат…),
          поэтому переключение вкладки обязано закрывать подстраницу —
          иначе тапы по вкладкам «не работают». */}
      {/* На ПК разделы живут в боковой панели, нижнее меню там лишнее */}
      {!game && !pc && (
        <Nav
          tab={tab}
          onTab={(next) => { setSub(null); setTab(next); }}
        />
      )}

      <AnimatePresence>
        {game && (
          <motion.div
            key={game}
            variants={gameVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`fixed inset-0 z-[60] ${pc ? "pc-play-wrap" : ""}`}
          >
            <div className={pc ? "pc-play" : "h-full w-full"}>
            {game === "burger" && <BurgerRain onExit={() => setGame(null)} />}
            {game === "clicker" && <Clicker onExit={() => setGame(null)} />}
            {game === "merge" && <MergeHeads onExit={() => setGame(null)} />}
            {game === "whack" && <WhackFriend onExit={() => setGame(null)} />}
            {game === "bite" && <ArtyomBite onExit={() => setGame(null)} />}
            {game === "dino" && <ShitovRun onExit={() => setGame(null)} />}
            {game === "radomir" && <RadomirBeat onExit={() => setGame(null)} />}
            {game === "stack" && <BurgerStack onExit={() => setGame(null)} />}
            {game === "sort" && <Canteen onExit={() => setGame(null)} />}
            {game === "memory" && <WhoWasIt onExit={() => setGame(null)} />}
            {game === "flap" && <RadomirFlight onExit={() => setGame(null)} />}
            {game === "defend" && <DormDefense onExit={() => setGame(null)} />}
            {game === "basket" && <Basket onExit={() => setGame(null)} />}
            {game === "volley" && <Volley onExit={() => setGame(null)} />}
            {game === "penalty" && <Penalty onExit={() => setGame(null)} />}
            {game === "pool" && <Pool onExit={() => setGame(null)} />}
            {game === "crossword" && <Crossword onExit={() => setGame(null)} />}
            {game === "bus" && <Bus12 onExit={() => setGame(null)} />}
            {game === "pet" && <ChubPet onExit={() => setGame(null)} />}
            {game === "beard" && <MaksBeard onExit={() => setGame(null)} />}
            {game === "moto" && <MotoArtyom onExit={() => setGame(null)} />}
            {game === "fuel" && <FuelHunt onExit={() => setGame(null)} />}
            {game === "hands" && <KirillHands onExit={() => setGame(null)} />}
            {game === "europa" && <Europa onExit={() => setGame(null)} />}
            {game === "chess" && <Chess onExit={() => setGame(null)} />}
            {game === "checkers" && <Checkers onExit={() => setGame(null)} />}
            {game === "nards" && <Backgammon onExit={() => setGame(null)} />}
            {game === "cheat" && <Cheat onExit={() => setGame(null)} />}
            {game === "lift" && <Elevator onExit={() => setGame(null)} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <Toasts />
      <OfflineModal />
      {!game && <UpdateBanner />}
      {!game && <WhatsNew />}

      <AnimatePresence>
        {splash && (
          <BootScreen
            onDone={() => setSplash(false)}
            minMs={lowFx ? 1000 : pc ? 1500 : 1250}
            maxMs={pc ? 2200 : 1700}
          />
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
    </ModesProvider>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
