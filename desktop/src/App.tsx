import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "./i18n/I18nProvider";
import {
  checkRepoAccess,
  fetchRecentRun,
  loadAppConfig,
  loadScriptState,
  openExternal,
  pickFile,
  runBootstrap,
  runDeploy,
  saveAppConfig,
  saveProfiles,
  saveSettings,
  subscribeToScriptOutput,
} from "./lib/api";
import { parseDeployOutput } from "./lib/parseOutput";
import type {
  AppConfig,
  Profile,
  RecentRun,
  RepoCheckResult,
  ScriptOutputEvent,
} from "./lib/types";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadPage } from "./pages/UploadPage";

type Tab = "settings" | "upload";
type NoticeKind = "info" | "success" | "error";

type ToastNotice = {
  message: string;
  kind: NoticeKind;
};

export default function App() {
  const { locale, setLocale, t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [githubToken, setGithubToken] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [ipaPath, setIpaPath] = useState("");
  const [repoOverride, setRepoOverride] = useState("");
  const [branchOverride, setBranchOverride] = useState("");
  const [repoCheck, setRepoCheck] = useState<RepoCheckResult | null>(null);
  const [recentRun, setRecentRun] = useState<RecentRun | null>(null);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const outputLinesRef = useRef<string[]>([]);

  useEffect(() => {
    let dispose: () => void = () => undefined;

    void (async () => {
      const [scriptState, appConfig] = await Promise.all([
        loadScriptState(),
        loadAppConfig(),
      ]);

      setRepo(scriptState.settings.repo);
      setBranch(scriptState.settings.branch || "main");
      setProfiles(scriptState.profiles);
      setGithubToken(appConfig.githubToken || "");
      setSelectedProfile(appConfig.lastProfile || scriptState.profiles[0]?.name || "");
      setIpaPath(appConfig.lastIpaPath || "");
      setRecentRun(appConfig.lastRun || null);
    })();

    void subscribeToScriptOutput((event) => {
      const nextLine = formatOutputLine(event);
      setOutputLines((current) => {
        const next = [...current, nextLine];
        outputLinesRef.current = next;
        return next;
      });
    }).then((unlisten) => {
      dispose = unlisten;
    });

    return () => {
      dispose();
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotice((current) => (current?.message === notice.message ? null : current));
    }, 2600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [notice]);

  const effectiveRepo = repoOverride.trim() || repo.trim();
  const effectiveBranch = branchOverride.trim() || branch.trim() || "main";

  const persistAppConfig = async (partial?: Partial<AppConfig>) => {
    const next: AppConfig = {
      githubToken,
      lastProfile: selectedProfile,
      lastIpaPath: ipaPath,
      lastRun: recentRun,
      ...partial,
    };
    await saveAppConfig(next);
  };

  const showNotice = (message: string, kind: NoticeKind = "info") => {
    setNotice({ message, kind });
  };

  const handleSaveSettings = async () => {
    await saveSettings(repo.trim(), branch.trim() || "main");
    await persistAppConfig({ githubToken });
    showNotice(t.settings.settingsSaved, "success");
  };

  const handleSaveProfiles = async (nextProfiles: Profile[]) => {
    await saveProfiles(nextProfiles);
    setProfiles(nextProfiles);
    if (!selectedProfile && nextProfiles.length > 0) {
      setSelectedProfile(nextProfiles[0].name);
    }
    showNotice(t.settings.profilesSaved, "success");
  };

  const handleCheckRepo = async () => {
    if (!repo.trim() || !githubToken.trim()) {
      showNotice(t.settings.repoTokenRequired, "error");
      return;
    }
    const result = await checkRepoAccess(repo.trim(), githubToken.trim());
    setRepoCheck(result);
    showNotice(result.message, result.ok ? "success" : "error");
  };

  const handleRunBootstrap = async () => {
    setBusy(true);
    setOutputLines([]);
    outputLinesRef.current = [];
    setNotice(null);
    try {
      await handleSaveSettings();
      await runBootstrap(repo.trim(), branch.trim() || "main", githubToken.trim());
      showNotice(t.settings.bootstrapFinished, "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const handlePickIpa = async () => {
    const selected = await pickFile("ipa");
    if (selected) {
      setIpaPath(selected);
      await persistAppConfig({ lastIpaPath: selected });
    }
  };

  const handleRunUpload = async () => {
    if (!selectedProfile) {
      showNotice(t.upload.selectProfileRequired, "error");
      return;
    }
    if (!ipaPath.trim()) {
      showNotice(t.upload.selectIpaRequired, "error");
      return;
    }
    const profile = profiles.find((item) => item.name === selectedProfile);
    if (!profile?.p8_path || !profile.issuer_id || !profile.key_id) {
      showNotice(t.upload.incompleteProfile, "error");
      return;
    }

    setBusy(true);
    setOutputLines([]);
    outputLinesRef.current = [];
    setNotice(null);

    try {
      await persistAppConfig({
        githubToken,
        lastProfile: selectedProfile,
        lastIpaPath: ipaPath,
      });

      await runDeploy({
        profile: selectedProfile,
        ipaPath: ipaPath.trim(),
        repo: effectiveRepo,
        branch: effectiveBranch,
        githubToken: githubToken.trim(),
      });

      const parsed = parseDeployOutput(outputLinesRef.current);
      const latest = await fetchRecentRun(effectiveRepo, githubToken.trim());
      const nextRun: RecentRun = {
        profile: parsed.profile || selectedProfile,
        releaseTag: parsed.releaseTag || null,
        workflowUrl: parsed.workflowUrl || latest?.htmlUrl || null,
        status: latest?.status || t.status.queued,
        conclusion: latest?.conclusion || null,
        createdAt: latest?.createdAt || null,
      };

      setRecentRun(nextRun);
      await persistAppConfig({ lastRun: nextRun });
      showNotice(t.upload.uploadSuccess, "success");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenWorkflow = async () => {
    if (!recentRun?.workflowUrl) {
      return;
    }
    await openExternal(recentRun.workflowUrl);
  };

  const tabs = useMemo(
    () => [
      { id: "settings" as const, label: t.app.settingsTab },
      { id: "upload" as const, label: t.app.uploadTab },
    ],
    [t],
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-block">
            <p className="eyebrow">{t.app.desktopWrapper}</p>
            <h1>{t.app.title}</h1>
            <p className="muted">{t.app.subtitle}</p>
          </div>
        </div>

        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "tab active" : "tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-meta">
          <span className={`status-badge ${busy ? "running" : "idle"}`}>
            {busy ? t.app.busy : t.app.ready}
          </span>
          <p>{t.app.idleHint}</p>
        </div>
      </aside>

      <main className="content">
        {notice ? (
          <div className={`toast ${notice.kind}`}>
            <span className={`status-dot ${notice.kind}`} />
            <p>{notice.message}</p>
            <button type="button" className="toast-close" onClick={() => setNotice(null)}>
              ×
            </button>
          </div>
        ) : null}
        {activeTab === "settings" ? (
          <SettingsPage
            repo={repo}
            branch={branch}
            githubToken={githubToken}
            profiles={profiles}
            repoCheck={repoCheck}
            busy={busy}
            outputLines={outputLines}
            locale={locale}
            onLocaleChange={setLocale}
            onRepoChange={setRepo}
            onBranchChange={setBranch}
            onTokenChange={setGithubToken}
            onSaveSettings={handleSaveSettings}
            onRunBootstrap={handleRunBootstrap}
            onCheckRepo={handleCheckRepo}
            onSaveProfiles={handleSaveProfiles}
          />
        ) : (
          <UploadPage
            profiles={profiles}
            selectedProfile={selectedProfile}
            ipaPath={ipaPath}
            repoOverride={repoOverride}
            branchOverride={branchOverride}
            repoFallback={repo}
            branchFallback={branch}
            busy={busy}
            outputLines={outputLines}
            recentRun={recentRun}
            onGoToSettings={() => setActiveTab("settings")}
            onProfileChange={setSelectedProfile}
            onIpaPathChange={setIpaPath}
            onRepoOverrideChange={setRepoOverride}
            onBranchOverrideChange={setBranchOverride}
            onPickIpa={handlePickIpa}
            onRunUpload={handleRunUpload}
            onOpenWorkflow={handleOpenWorkflow}
          />
        )}
      </main>
    </div>
  );
}

function formatOutputLine(event: ScriptOutputEvent) {
  if (event.kind === "stderr") {
    return `[stderr] ${event.line}`;
  }
  if (event.kind === "exit") {
    return `[exit] ${event.line}`;
  }
  return event.line;
}
