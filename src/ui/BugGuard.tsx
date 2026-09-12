import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * ЗАЩИТА ОТ ПАДЕНИЙ.
 *
 * Проблема, из-за которой пользователь сказал «защиты от багов в приложении
 * нету»: одна ошибка в одной мини-игре уносила всё приложение в белый экран.
 * Сейв при этом не терялся (пишется на каждое изменение), но человек видел
 * «игра сломалась» и перезагружал страницу с нуля.
 *
 * Что делает этот файл:
 *  • <BugGuard> — ErrorBoundary вокруг каждой игры, вокруг каждой страницы и
 *    вокруг всего приложения. Падение игры убирает на экран игры, а не на
 *    «приложение умерло»: границы раздельные, поэтому остальной интерфейс
 *    продолжает работать.
 *  • экран падения говорит по-русски, что случилось, даёт две кнопки —
 *    «ЕЩЁ РАЗ» (сбросить границу и продолжить) и «ПЕРЕЗАПУСТИТЬ» (полная
 *    перезагрузка), и показывает короткую строку ошибки: без неё баг
 *    починить невозможно, а объяснять его скриншотами — медленно.
 *  • installCrashWatch() ловит window.error и unhandledrejection: обломанные
 *    Promise в мини-играх раньше молча замораживали анимацию — теперь об этом
 *    сообщает уведомление в углу, а в консоли остаётся полный текст.
 *
 * Важно: граница не глотает ошибку в dev-режиме намеренно — мы её сначала
 * показываем, а уже потом решаем, жить ли ей. Vite overlay в dev всё равно
 * перекроет, зато в собранной игре человек увидит внятный экран.
 */

type Props = { children: ReactNode; kind?: "game" | "page" | "app"; name?: string };
type State = { error: Error | null };

export default class BugGuard extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Полная информация — только в консоль: на экране держим одну строку.
    console.error(`[chubgames:${this.props.kind ?? "app"}]`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const kind = this.props.kind ?? "app";
    const first = String(error.message || error).split("\n")[0].slice(0, 160);
    return (
      <div className="bug-wrap">
        <div className="bug-card">
          <div className="bug-kicker">
            <span className="bug-dot" aria-hidden />
            {kind === "game" ? "МИНИ-ИГРА ОСТАНОВИЛАСЬ" : kind === "page" ? "ЭКРАН ОСТАНОВИЛСЯ" : "ОШИБКА"}
          </div>
          <div className="bug-title">{this.props.name || "Что-то пошло не так"}</div>
          <div className="bug-sub">
            Приложение живо, сейв сохранён. Можно попробовать ещё раз — а если
            повторяется, покажите эту строчку разработчику.
          </div>
          <code className="bug-code">{first}</code>
          <div className="bug-actions">
            <button type="button" className="bug-btn primary" onClick={this.reset}>
              ЕЩЁ РАЗ
            </button>
            <button
              type="button"
              className="bug-btn"
              onClick={() => {
                try {
                  localStorage.setItem("chubgames.crash", String(error.message || error));
                } catch {
                  /* localStorage может быть недоступен */
                }
                location.reload();
              }}
            >
              ПЕРЕЗАПУСТИТЬ
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Глобальные ловушки: невыловленный reject и ошибка вне React.
 * Возвращает функцию снятия — App вызывает её в useEffect.
 */
export function installCrashWatch(toast: (msg: string, detail?: string) => void): () => void {
  const onError = (e: ErrorEvent) => {
    // ошибки ресурсов (картинка не влезла в кеш) — не повод дёргать человека
    if (e.target && e.target !== window) return;
    toast("Ошибка в фоне", String(e.message || "").slice(0, 90));
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
    if (/AbortError|Load failed|interrupted/i.test(msg)) return;
    toast("Ошибка в фоне", msg.slice(0, 90));
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
