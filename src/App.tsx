import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { GameProvider, useGame } from "./core/store";
import { Aurora } from "./ui/Glass";
import Nav, { type Tab } from "./components/Nav";

/** Подстраницы поверх вкладок */
export type SubPage = "network" | "casino" | "donate" | "boss" | "fanfic";
import { Toasts, OfflineModal } from "./components/Overlays";
import PcBoost from "./ui/pc/PcBoost";
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
import {
  applyPerfMode, isLowFx, measurePerfOnce, resetFps, startUiWatch,
} from "./core/perf";
import { initDesktopKeys, initStage, isDesktop, hasKeyboard } from "./core/desktop";
import BootScreen from "./ui/BootScreen";
import PcTopBar from "./ui/pc/PcTopBar";
import { FpsHud, KeyCursor } from "./ui/PcHud";
import { initGameKeys, handlesKeysNatively } from "./core/keymouse";
import { setPlaying } from "./core/play";
import { tr } from "./core/i18n";
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
import { resumeNow, setPauseExitHandler } from "./core/pause";
import PauseOverlay from "./ui/PauseOverlay";
import BugGuard, { installCrashWatch } from "./ui/BugGuard";
import { GAME_META } from "./core/content";
import type { GameId } from "./core/types";

/**
 * Заставка вынесена в src/ui/BootScreen.tsx: она одна на телефон и на
 * компьютер. Раньше их было две — мобильная (в этом файле) и десктопная
 * (PcBoot), и они успели разъехаться по анимациям и размерам.
 */

/** Мост между глобальными обработчиками и очередью уведомлений. */
function CrashWatch() {
  const { toast } = useGame();
  useEffect(
    () =>
      installCrashWatch((title, detail) => {
        toast({ title: title, sub: detail, icon: "warn", tone: "bad", ms: 5200 });
      }),
    [toast],
  );
  return null;
}

function Shell() {
  const { s, toast } = useGame();
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
  /** контейнер игры — нужен, чтобы посадить на него клавиатурный слой */
  const playRef = useRef<HTMLDivElement>(null);
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

  /*
   * Слежка за кадрами интерфейса. Главная страница — не игра: там нет
   * канваса, который сам умеет ужиматься, поэтому если монитор не тянет
   * пульсации, стекло и тени, лёгкий режим обязан включиться сам.
   */
  useEffect(() => {
    return startUiWatch((fps) => {
      if (!fps) return;
      setLowFx(true);
      toast({
        title: tr("Интерфейс тормозил — включён лёгкий режим"),
        sub: `${fps} FPS · ${tr("убрали стекло, тени и пульсации")}`,
        icon: "speed",
        tone: "normal",
      });
    });
  }, [toast]);

  // системная кнопка/жест «назад» закрывает игру, а не приложение
  useEffect(() => {
    if (!game) return;
    return pushBack("game", () => setGame(null));
  }, [game]);

  /*
   * «Идёт игра». Один флаг на всё приложение: по нему прячется фоновая
   * аура, засыпает тик автодохода в store и подсвечивается главный экран.
   * Без этого под оверлеем игры continuosно перерисовываются пульсации
   * босса, кубик казино и сундук — на слабом компьютере минус треть кадров.
   */
  useEffect(() => {
    setPlaying(!!game);
    if (game) resetFps();
    return () => setPlaying(false);
  }, [game]);

  // Управление с клавиатуры: WASD и стрелки водят «палец» по полю игры,
  // пробел нажимает. Ставится только пока игра открыта.
  useEffect(() => {
    // на компьютере с мышью и клавиатурой — всегда, даже если окно узкое
    // и ПК-раскладка не включена: с клавиатуры играть никто не запрещал
    if (!game || s.settings.keys === false) return;
    if (!pc && !hasKeyboard()) return;
    // четыре игры читают клавиши сами — слой удвоил бы каждое нажатие
    if (handlesKeysNatively(game)) return;
    const el = playRef.current;
    if (!el) return;
    return initGameKeys(el);
  }, [game, pc, s.settings.keys]);

  // «назад» закрывает подстраницу
  useEffect(() => {
    if (!sub) return;
    return pushBack(`sub:${sub}`, () => setSub(null));
  }, [sub]);

  /*
   * ПАУЗА. Кнопка «Выйти в меню» в PauseOverlay не знает про setGame — она
   * дёргает обработчик отсюда. При выходе паузу снимаем обязательно: иначе
   * следующая игра стартовала бы «на паузе» с оверлеем поверх.
   */
  useEffect(() => {
    setPauseExitHandler(game ? () => setGame(null) : null);
    if (!game) resumeNow();
    return () => setPauseExitHandler(null);
  }, [game]);

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
    progress: <ProgressPage onPlay={(g) => setGame(g)} />,
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
      {/* фон-аура: красиво, но это бесконечная анимация на весь экран.
          Пока открыта игра, её всё равно не видно — значит и тратить на
          неё кадры нечем. */}
      {s.settings.fx && !lowFx && !game && <Aurora />}

      {/* ПК: разделы, профиль и кошелёк живут в верхней панели. На мониторе
          нижнее меню выглядит чужим, а боковая колонка с разделами съедала
          треть ширины, оставляя игры узкой полоской. */}
      {pc && (
        <PcTopBar
          tab={tab}
          sub={sub}
          onTab={(next) => { setSub(null); setTab(next); }}
          onOpen={setSub}
        />
      )}

      {/* display:contents на телефоне — оболочка не влияет на мобильную
          раскладку, но на ПК этоflex-колонка, внутри которой лежат
          страницы, подстраницы и игры */}
      <div className={pc ? "pc-body" : "contents"}>
      <div
        className={`relative h-full ${game ? "page-dormant" : ""}`}
        style={{ zIndex: 1 }}
      >
        <AnimatePresence mode="wait">
          {/*
           * На компьютере, пока открыта игра, главный экран не просто
           * закрыт оверлеем — он размонтирован. Иначе под игрой продолжают
           * жить пульсации босса, свечение сундука и казино: framer-motion
           * считает их в своём rAF, даже когда их не видно. На слабом ПК
           * это минус треть кадров в самой игре.
           * На телефоне оставляем как было: там оверлей и так перекрывает
           * экран, а резкий перемонст заметнее.
           */}
          {pc && game ? null : (
          <motion.div
            key={tab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full"
          >
            <BugGuard kind="page">{pages[tab]}</BugGuard>
          </motion.div>
          )}
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
            className={`fixed inset-0 z-[60] ${pc ? "pc-play-wrap" : ""}${game === "europa" ? " is-europa" : ""}`}
          >
            <div className={pc ? "pc-play game-stage" : "game-stage h-full w-full"} ref={playRef}>
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

            {/* Счётчик кадров — прямо в игре, выключается в настройках
                («Игра» → «Показывать FPS»). Отдельного rAF не тратит:
                кадры считает цикл useCanvas (core/perf.ts). */}
            {s.settings.fpsHud !== false && <FpsHud />}
            {s.settings.keys !== false && !handlesKeysNatively(game) && <KeyCursor />}
            </div>
            <PauseOverlay label={(() => { const g = GAME_META.find((x) => x.id === game); return g ? tr(g.name) : undefined; })()} />
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Сторож фоновых ошибок: невыловленный reject в мини-игре раньше
          просто останавливал анимацию, и выглядело это как «зависло». */}
      <CrashWatch />

      <Toasts />
      <OfflineModal />
      {!game && <UpdateBanner />}
      {!game && <WhatsNew />}

      {/* Бонус за ролик — маленькая плашка в правом нижнем углу поверх всей
          библиотеки (просили именно так): она нужна там, где игрок устал, а
          не только на главной. Внутри игры её нет, чтобы не перекрывать сцену. */}
      {pc && !game && <PcBoost />}

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
