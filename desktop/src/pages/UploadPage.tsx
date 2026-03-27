import { useMemo } from "react";
import { OutputPanel } from "../components/OutputPanel";
import { StatusCard } from "../components/StatusCard";
import { useI18n } from "../i18n/I18nProvider";
import type { Profile, RecentRun } from "../lib/types";

type Props = {
  profiles: Profile[];
  selectedProfile: string;
  ipaPath: string;
  repoOverride: string;
  branchOverride: string;
  repoFallback: string;
  branchFallback: string;
  busy: boolean;
  outputLines: string[];
  recentRun?: RecentRun | null;
  onGoToSettings: () => void;
  onProfileChange: (value: string) => void;
  onIpaPathChange: (value: string) => void;
  onRepoOverrideChange: (value: string) => void;
  onBranchOverrideChange: (value: string) => void;
  onPickIpa: () => Promise<void>;
  onRunUpload: () => Promise<void>;
  onOpenWorkflow: () => Promise<void>;
};

export function UploadPage({
  profiles,
  selectedProfile,
  ipaPath,
  repoOverride,
  branchOverride,
  repoFallback,
  branchFallback,
  busy,
  outputLines,
  recentRun,
  onGoToSettings,
  onProfileChange,
  onIpaPathChange,
  onRepoOverrideChange,
  onBranchOverrideChange,
  onPickIpa,
  onRunUpload,
  onOpenWorkflow,
}: Props) {
  const { t } = useI18n();
  const selected = useMemo(
    () => profiles.find((profile) => profile.name === selectedProfile),
    [profiles, selectedProfile],
  );
  const showLog = busy || outputLines.length > 0;
  const hasRepoSetup = !!repoFallback.trim() && !!branchFallback.trim();
  const hasAccounts = profiles.length > 0;
  const hasProfile = !!selectedProfile;
  const hasIpa = !!ipaPath.trim();
  const isProfileComplete = !!selected?.p8_path && !!selected?.issuer_id && !!selected?.key_id;
  const canUpload = !busy && hasRepoSetup && hasAccounts && hasProfile && hasIpa && isProfileComplete;

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t.upload.eyebrow}</p>
          <h2>{t.upload.title}</h2>
          <p className="muted page-description">{t.upload.description}</p>
        </div>
      </header>

      <div className="upload-layout">
        <section className="panel">
        <div className="grid two">
          <label>
            <span>{t.upload.profile}</span>
            <select
              className="app-select"
              value={selectedProfile}
              onChange={(event) => onProfileChange(event.target.value)}
              disabled={!hasAccounts || busy}
            >
              <option value="">{t.common.selectProfile}</option>
              {profiles.map((profile) => (
                <option key={profile.name} value={profile.name}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.upload.selectedEmail}</span>
            <input
              value={selected?.email || ""}
              readOnly
              placeholder={t.upload.selectedEmailPlaceholder}
            />
          </label>
        </div>
        <label>
          <span>{t.upload.ipaPath}</span>
          <div className="inline-field">
            <input
              value={ipaPath}
              onChange={(event) => onIpaPathChange(event.target.value)}
              placeholder={t.upload.ipaPlaceholder}
            />
            <button type="button" className="secondary" onClick={() => void onPickIpa()}>
              {t.common.choose}
            </button>
          </div>
        </label>
        <div className="grid two">
          <label>
            <span>{t.upload.repoOverride}</span>
            <input
              value={repoOverride}
              onChange={(event) => onRepoOverrideChange(event.target.value)}
              placeholder={repoFallback || t.settings.repoPlaceholder}
            />
          </label>
          <label>
            <span>{t.upload.branchOverride}</span>
            <input
              value={branchOverride}
              onChange={(event) => onBranchOverrideChange(event.target.value)}
              placeholder={branchFallback || t.settings.branchPlaceholder}
            />
          </label>
        </div>
        <p className="muted section-copy">{t.upload.overrideHint}</p>
        <div className="readiness-inline">
          <span className={hasRepoSetup ? "hint-chip done" : "hint-chip"}>
            {t.upload.needRepo}
          </span>
          <span className={hasAccounts ? "hint-chip done" : "hint-chip"}>
            {t.upload.needAccount}
          </span>
          <span className={hasIpa ? "hint-chip done" : "hint-chip"}>
            {t.upload.needIpa}
          </span>
        </div>
        <div className="actions">
          <button type="button" onClick={() => void onRunUpload()} disabled={!canUpload}>
            {t.upload.startUpload}
          </button>
        </div>
        </section>

        {hasAccounts ? (
          <StatusCard run={recentRun} onOpenWorkflow={() => void onOpenWorkflow()} />
        ) : (
          <section className="panel status-card empty-state-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">{t.upload.eyebrow}</p>
                <h3>{t.upload.emptyAccountsTitle}</h3>
              </div>
            </div>
            <p className="muted">{t.upload.emptyAccountsBody}</p>
            <button type="button" className="secondary" onClick={onGoToSettings}>
              {t.common.goToSettings}
            </button>
          </section>
        )}
      </div>

      {showLog ? (
        <details className="panel details-panel" open={busy}>
          <summary>
            <span className="eyebrow">{t.output.eyebrow}</span>
            <strong>{t.output.title}</strong>
          </summary>
          <OutputPanel lines={outputLines} busy={busy} />
        </details>
      ) : null}
    </div>
  );
}
