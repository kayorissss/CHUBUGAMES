import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, Screen, SectionTitle } from "../ui/Glass";
import Icon, { type IconName } from "../ui/Icon";
import { sfx, haptic } from "../core/fx";
import { tr } from "../core/i18n";
import { isDesktop, pcApi } from "../core/desktop";
import { APP_VERSION } from "../core/version";
import { useGame } from "../core/store";

/**
 * ДОПОЛНИТЕЛЬНОЕ — КАТАЛОГ ПРОГРАММ И РЕЛИЗОВ @kayorissss.
 *
 * Заменяет старую проверку глушилок и замер скорости: теперь здесь живут
 * все проекты автора с GitHub (https://github.com/kayorissss), в первую
 * очередь Nukefy-VPN и CHUBUGAMES, со списком актуальных ассетов из GitHub
 * Releases и прямой загрузкой последней версии сразу в папку «Загрузки» на ПК.
 */

export interface ReleaseAssetItem {
  name: string;
  label: string;
  platform: "win-setup" | "win-portable" | "android" | "other";
  sizeBytes: number;
  url: string;
}

export interface KayoRepoProject {
  id: string;
  name: string;
  title: string;
  badge: string;
  icon: IconName;
  accent: string;
  repoUrl: string;
  releasesUrl: string;
  description: string;
  features: string[];
  latestTag: string;
  publishedAt: string;
  assets: ReleaseAssetItem[];
}

const GITHUB_PROFILE_URL = "https://github.com/kayorissss";

const FALLBACK_PROJECTS: KayoRepoProject[] = [
  {
    id: "Nukefy-VPN",
    name: "Nukefy-VPN",
    title: "Nukefy VPN",
    badge: "VPN · Обход блокировок",
    icon: "shield",
    accent: "#9D6BFF",
    repoUrl: "https://github.com/kayorissss/Nukefy-VPN",
    releasesUrl: "https://github.com/kayorissss/Nukefy-VPN/releases",
    description:
      "Быстрый и современный VPN-клиент на ядре sing-box для Windows и Android. Поддержка VLESS, Reality, Hysteria2, TUN-режима, раздельного туннелирования и защиты от DPI/глушилок.",
    features: [
      "Ядро sing-box с полноценным системным TUN-режимом и низким пингом",
      "Сборки для Windows 10/11 x64 (Setup + Portable без установки) и Android APK",
      "Встроенное автообновление, импорт ключей и подписок в один клик",
    ],
    latestTag: "v2.5.11",
    publishedAt: "2026",
    assets: [
      {
        name: "NukefyVPN-Setup-x64.exe",
        label: "Windows x64 · Установщик (Setup)",
        platform: "win-setup",
        sizeBytes: 92_142_670,
        url: "https://github.com/kayorissss/Nukefy-VPN/releases/latest/download/NukefyVPN-Setup-x64.exe",
      },
      {
        name: "NukefyVPN.exe",
        label: "Windows x64 · Portable (без установки)",
        platform: "win-portable",
        sizeBytes: 91_987_064,
        url: "https://github.com/kayorissss/Nukefy-VPN/releases/latest/download/NukefyVPN.exe",
      },
      {
        name: "NukefyVPN-android.apk",
        label: "Android · APK",
        platform: "android",
        sizeBytes: 78_105_241,
        url: "https://github.com/kayorissss/Nukefy-VPN/releases/latest/download/NukefyVPN-android.apk",
      },
    ],
  },
  {
    id: "CHUBUGAMES",
    name: "CHUBUGAMES",
    title: "CHUBUGAMES",
    badge: "Игровой хаб · 29 игр",
    icon: "trophy",
    accent: "#FF8A2B",
    repoUrl: "https://github.com/kayorissss/CHUBUGAMES",
    releasesUrl: "https://github.com/kayorissss/CHUBUGAMES/releases/tag/latest",
    description:
      "Коллекция из 29 аркадных мини-игр, казино с 10 тирами кейсов, боссами по расписанию, прокачкой персонажей и глобальной стратегией. Работает полностью офлайн на ПК и Android.",
    features: [
      "Единый релиз: Setup EXE, Portable EXE (запуск без установки и админки) и Android APK",
      "Кастомная игровая оболочка окна на ПК и плавные 60+ FPS на любом экране",
      "Полное сохранение прогресса, экспорт/импорт профиля и проверка обновлений",
    ],
    latestTag: `v${APP_VERSION}`,
    publishedAt: "2026",
    assets: [
      {
        name: `CHUBUGAMES-${APP_VERSION}-portable.exe`,
        label: "Windows x64 · Portable (без установки и админки)",
        platform: "win-portable",
        sizeBytes: 99_940_552,
        url: `https://github.com/kayorissss/CHUBUGAMES/releases/download/latest/CHUBUGAMES-${APP_VERSION}-portable.exe`,
      },
      {
        name: `CHUBUGAMES-${APP_VERSION}-setup.exe`,
        label: "Windows x64 · Установщик (Setup)",
        platform: "win-setup",
        sizeBytes: 106_185_227,
        url: `https://github.com/kayorissss/CHUBUGAMES/releases/download/latest/CHUBUGAMES-${APP_VERSION}-setup.exe`,
      },
      {
        name: "CHUBUGAMES.apk",
        label: "Android · APK",
        platform: "android",
        sizeBytes: 30_584_753,
        url: "https://github.com/kayorissss/CHUBUGAMES/releases/download/latest/CHUBUGAMES.apk",
      },
    ],
  },
];

function classifyAsset(name: string): {
  label: string;
  platform: ReleaseAssetItem["platform"];
} {
  const low = name.toLowerCase();
  if (low.endsWith(".apk")) {
    return { label: "Android · APK", platform: "android" };
  }
  if (low.endsWith(".exe")) {
    if (low.includes("setup") || low.includes("install")) {
      return { label: "Windows x64 · Установщик (Setup)", platform: "win-setup" };
    }
    return { label: "Windows x64 · Portable (без установки)", platform: "win-portable" };
  }
  return { label: "Файл релиза", platform: "other" };
}

function fmtSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function openExternalUrl(url: string) {
  const api = pcApi();
  if (api?.openExternal) {
    api.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function NetPanel({ onBusy }: { onBusy?: (busy: boolean) => void }) {
  const { toast } = useGame();
  const [projects, setProjects] = useState<KayoRepoProject[]>(FALLBACK_PROJECTS);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pc" | "android">("all");
  const [dlState, setDlState] = useState<
    Record<string, { status: "downloading" | "done" | "error"; pct: number; path?: string; error?: string }>
  >({});

  const desktop = isDesktop();
  const api = pcApi();

  useEffect(() => {
    if (!api?.onDownloadProgress) return;
    return api.onDownloadProgress((d: { fileName?: string; url?: string; pct?: number }) => {
      const key = d.url || d.fileName || "";
      if (!key) return;
      setDlState((prev) => ({
        ...prev,
        [key]: {
          status: "downloading",
          pct: Math.max(1, Math.min(99, Number(d.pct) || 0)),
        },
      }));
    });
  }, [api]);

  const refreshFromGitHub = async () => {
    setLoading(true);
    onBusy?.(true);
    sfx.click();
    try {
      const res = await fetch("https://api.github.com/users/kayorissss/repos?per_page=30&sort=updated", {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
      const repos: any[] = await res.json();

      const updated = await Promise.all(
        repos
          .filter((r) => !r.fork && !r.archived)
          .map(async (repo): Promise<KayoRepoProject> => {
            const preset = FALLBACK_PROJECTS.find(
              (p) => p.name.toLowerCase() === String(repo.name || "").toLowerCase(),
            );
            let latestTag = preset?.latestTag || "latest";
            let publishedAt = preset?.publishedAt || "";
            let assets: ReleaseAssetItem[] = preset?.assets || [];

            try {
              const relRes = await fetch(
                `https://api.github.com/repos/kayorissss/${repo.name}/releases?per_page=5`,
                { headers: { Accept: "application/vnd.github+json" } },
              );
              if (relRes.ok) {
                const relList: any[] = await relRes.json();
                const rel = relList.find((x) => Array.isArray(x.assets) && x.assets.length > 0) || relList[0];
                if (rel) {
                  latestTag = rel.tag_name || rel.name || latestTag;
                  if (rel.published_at) {
                    publishedAt = new Date(rel.published_at).toLocaleDateString("ru-RU");
                  }
                  const rawAssets = (rel.assets || []).filter(
                    (a: any) => a?.name && !/\.(sha256|txt|blockmap|yml)$/i.test(a.name),
                  );
                  if (rawAssets.length > 0) {
                    assets = rawAssets.map((a: any) => {
                      const cls = classifyAsset(a.name);
                      return {
                        name: a.name,
                        label: cls.label,
                        platform: cls.platform,
                        sizeBytes: Number(a.size) || 0,
                        url: a.browser_download_url,
                      };
                    });
                  }
                }
              }
            } catch {
              /* оставляем преднастроенные данные при лимите GitHub API */
            }

            return {
              id: repo.name,
              name: repo.name,
              title: preset?.title || repo.name,
              badge: preset?.badge || (repo.language ? `Проект · ${repo.language}` : "Проект @kayorissss"),
              icon: preset?.icon || "rocket",
              accent: preset?.accent || "#A77BFF",
              repoUrl: repo.html_url || `https://github.com/kayorissss/${repo.name}`,
              releasesUrl: `https://github.com/kayorissss/${repo.name}/releases`,
              description: preset?.description || repo.description || "Официальный репозиторий @kayorissss на GitHub.",
              features: preset?.features || [
                "Открытый исходный код и готовые сборки в разделе Releases",
                "Прямая загрузка последней версии прямо из интерфейса",
              ],
              latestTag,
              publishedAt,
              assets,
            };
          }),
      );

      if (updated.length > 0) {
        // Nukefy-VPN всегда первым, затем остальные
        updated.sort((a, b) => {
          if (a.name === "Nukefy-VPN") return -1;
          if (b.name === "Nukefy-VPN") return 1;
          return 0;
        });
        setProjects(updated);
      }
    } catch {
      /* при офлайне или лимите API остаются актуальные встроенные данные */
    } finally {
      setLoading(false);
      onBusy?.(false);
    }
  };

  useEffect(() => {
    refreshFromGitHub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadAsset = async (proj: KayoRepoProject, asset: ReleaseAssetItem) => {
    sfx.power?.();
    haptic("medium");
    const key = asset.url;

    // Если ссылка ведёт на страницу релиза, а не на прямой бинарник
    if (/\/releases\/tag\//i.test(asset.url)) {
      openExternalUrl(asset.url);
      toast({
        title: tr("Открыта страница релиза"),
        sub: `${proj.title} · ${asset.name}`,
        icon: "download",
      });
      return;
    }

    if (desktop && api?.downloadToDownloads) {
      setDlState((prev) => ({ ...prev, [key]: { status: "downloading", pct: 2 } }));
      onBusy?.(true);
      try {
        const res = await api.downloadToDownloads(asset.url, asset.name);
        if (res?.ok) {
          setDlState((prev) => ({
            ...prev,
            [key]: { status: "done", pct: 100, path: res.path },
          }));
          sfx.legend?.();
          haptic("success");
          toast({
            title: tr("Скачано в «Загрузки»"),
            sub: `${res.fileName || asset.name}`,
            icon: "check",
            tone: "gold",
          });
        } else {
          throw new Error(res?.error || "Ошибка сохранения");
        }
      } catch (err: any) {
        setDlState((prev) => ({
          ...prev,
          [key]: { status: "error", pct: 0, error: String(err?.message || err) },
        }));
        openExternalUrl(asset.url);
      } finally {
        onBusy?.(false);
      }
      return;
    }

    // В браузере или на телефоне — инициируем прямую загрузку файла
    const a = document.createElement("a");
    a.href = asset.url;
    a.download = asset.name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDlState((prev) => ({ ...prev, [key]: { status: "done", pct: 100 } }));
    toast({
      title: tr("Загрузка началась"),
      sub: `${asset.name} → ${tr("Загрузки")}`,
      icon: "download",
      tone: "gold",
    });
  };

  /** Быстрая кнопка «Скачать последнюю версию на ПК» для проекта */
  const downloadLatestForPc = (proj: KayoRepoProject) => {
    const bestPc =
      proj.assets.find((a) => a.platform === "win-setup") ||
      proj.assets.find((a) => a.platform === "win-portable") ||
      proj.assets[0];
    if (bestPc) {
      downloadAsset(proj, bestPc);
    } else {
      openExternalUrl(proj.releasesUrl);
    }
  };

  return (
    <div className="kayo-hub">
      {/* Шапка-баннер профиля GitHub @kayorissss */}
      <Card r="lg" className="kayo-hero">
        <div className="kayo-hero-top">
          <div className="kayo-avatar">
            <Icon name="sparkle" size={22} />
          </div>
          <div className="kayo-hero-info">
            <div className="kayo-hero-kicker">
              <span className="kayo-live-dot" />
              <span>GITHUB · ОФИЦИАЛЬНЫЕ ПРОЕКТЫ АВТОРА</span>
            </div>
            <div className="kayo-hero-title">@kayorissss — Программы и Релизы</div>
            <div className="kayo-hero-sub">
              Все программы и утилиты разработчика в одном месте. Скачивай последние версии{" "}
              <b>Nukefy VPN</b> (клиент обхода блокировок и глушилок) и других проектов сразу в папку{" "}
              <b>«Загрузки»</b> на компьютере или телефоне.
            </div>
          </div>
          <div className="kayo-hero-actions">
            <button
              type="button"
              className="kayo-btn primary"
              onClick={() => {
                sfx.click();
                openExternalUrl(GITHUB_PROFILE_URL);
              }}
            >
              <Icon name="globe" size={14} />
              <span>Профиль GitHub</span>
            </button>
            <button
              type="button"
              className="kayo-btn ghost"
              onClick={refreshFromGitHub}
              disabled={loading}
            >
              <Icon name="refresh" size={14} />
              <span>{loading ? "Обновляем…" : "Проверить релизы"}</span>
            </button>
          </div>
        </div>

        {/* Панель фильтра платформ */}
        <div className="net-tabs" role="tablist" aria-label={tr("Платформа")}>
          {([
            { id: "all", label: "Все сборки", sub: "Windows Setup · Portable · Android APK", icon: "star" as IconName },
            { id: "pc", label: "Для ПК (Windows)", sub: "Прямое скачивание .exe в «Загрузки»", icon: "download" as IconName },
            { id: "android", label: "Для телефона (Android)", sub: "Свежие .apk пакеты", icon: "bolt" as IconName },
          ] as const).map((t) => {
            const on = filter === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={`net-tab ${on ? "on" : ""}`}
                onClick={() => {
                  sfx.click();
                  haptic("light");
                  setFilter(t.id);
                }}
              >
                <span className={`net-tab-ico ${loading ? "net-scan" : ""}`}>
                  <Icon name={t.icon} size={16} />
                </span>
                <span className="net-tab-txt">
                  <span className="t-title-sm">{tr(t.label)}</span>
                  <span className="t-caption">{tr(t.sub)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <SectionTitle
        right={
          <span className="t-label acc-text">
            {projects.length} {projects.length === 1 ? "проект" : "проекта"} · GitHub Releases
          </span>
        }
      >
        {tr("Доступные программы")}
      </SectionTitle>

      <div className="kayo-grid">
        {projects.map((proj, idx) => {
          const visibleAssets = proj.assets.filter((a) => {
            if (filter === "pc") return a.platform === "win-setup" || a.platform === "win-portable";
            if (filter === "android") return a.platform === "android";
            return true;
          });
          const assetsToShow = visibleAssets.length > 0 ? visibleAssets : proj.assets;

          return (
            <motion.div
              key={proj.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
            >
              <Card
                r="lg"
                className="kayo-card"
                style={{ ["--proj-acc" as any]: proj.accent }}
              >
                <div className="kayo-card-head">
                  <div className="kayo-card-ico">
                    <Icon name={proj.icon} size={22} />
                  </div>
                  <div className="kayo-card-titles">
                    <div className="kayo-card-row">
                      <span className="kayo-card-name">{proj.title}</span>
                      <span className="kayo-card-tag">{proj.latestTag}</span>
                      <span className="kayo-card-badge">{proj.badge}</span>
                    </div>
                    <div className="kayo-card-meta">
                      <span>github.com/kayorissss/{proj.name}</span>
                      {proj.publishedAt && <span>· Релиз: {proj.publishedAt}</span>}
                    </div>
                  </div>
                  <div className="kayo-card-cta">
                    <button
                      type="button"
                      className="kayo-btn primary"
                      onClick={() => downloadLatestForPc(proj)}
                    >
                      <Icon name="download" size={14} />
                      <span>Скачать в «Загрузки» (ПК)</span>
                    </button>
                    <button
                      type="button"
                      className="kayo-btn ghost"
                      onClick={() => openExternalUrl(proj.releasesUrl)}
                    >
                      <Icon name="globe" size={13} />
                      <span>Все релизы</span>
                    </button>
                  </div>
                </div>

                <p className="kayo-card-desc">{proj.description}</p>

                <ul className="kayo-card-feats">
                  {proj.features.map((f) => (
                    <li key={f}>
                      <Icon name="check" size={12} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="kayo-assets">
                  <div className="kayo-assets-title">
                    <span>ФАЙЛЫ ПОСЛЕДНЕГО РЕЛИЗА ({proj.latestTag})</span>
                    <button
                      type="button"
                      className="kayo-link"
                      onClick={() => openExternalUrl(proj.repoUrl)}
                    >
                      Открыть репозиторий →
                    </button>
                  </div>
                  <div className="kayo-assets-list">
                    {assetsToShow.map((asset) => {
                      const st = dlState[asset.url];
                      const isDownloading = st?.status === "downloading";
                      const isDone = st?.status === "done";
                      return (
                        <div key={asset.name} className={`kayo-asset ${isDone ? "done" : ""}`}>
                          <div className="kayo-asset-main">
                            <span className="kayo-asset-ico">
                              <Icon
                                name={asset.platform === "android" ? "bolt" : "download"}
                                size={15}
                              />
                            </span>
                            <div className="kayo-asset-txt">
                              <div className="kayo-asset-name">{asset.name}</div>
                              <div className="kayo-asset-sub">
                                <span>{asset.label}</span>
                                {asset.sizeBytes > 0 && <span> · {fmtSize(asset.sizeBytes)}</span>}
                              </div>
                              {isDownloading && (
                                <div className="kayo-asset-bar">
                                  <i style={{ width: `${st.pct}%` }} />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="kayo-asset-acts">
                            {isDone && st?.path && api?.showInFolder && (
                              <button
                                type="button"
                                className="kayo-btn ghost sm"
                                onClick={() => api.showInFolder(st.path)}
                              >
                                Показать в папке
                              </button>
                            )}
                            <button
                              type="button"
                              className={`kayo-btn ${
                                asset.platform === "win-setup" || asset.platform === "win-portable"
                                  ? "primary"
                                  : "ghost"
                              } sm`}
                              disabled={isDownloading}
                              onClick={() => downloadAsset(proj, asset)}
                            >
                              <Icon name={isDone ? "check" : "download"} size={13} />
                              <span>
                                {isDownloading
                                  ? `${st.pct}%`
                                  : isDone
                                    ? "Скачать снова"
                                    : "В Загрузки"}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function NetworkPage({ onBack }: { onBack: () => void }) {
  return (
    <Screen
      title={tr("ДОПОЛНИТЕЛЬНОЕ")}
      sub={tr("Все программы и релизы @kayorissss на GitHub — прямая загрузка в «Загрузки»")}
      right={
        <button
          type="button"
          onClick={() => { sfx.click(); onBack(); }}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 34, height: 34, borderRadius: "var(--r-sm)",
            background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
            color: "var(--text)",
          }}
          aria-label={tr("Закрыть")}
        >
          <Icon name="cross" size={14} />
        </button>
      }
    >
      <NetPanel />
    </Screen>
  );
}
