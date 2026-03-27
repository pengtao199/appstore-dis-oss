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
  const hasProfile = !!selectedProfile;
  const hasIpa = !!ipaPath.trim();
  const usingOverrides = !!repoOverride.trim() || !!branchOverride.trim();

  return (
    <div className="page-grid upload-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">{t.upload.eyebrow}</p>
            <h3>{t.upload.title}</h3>
          </div>
        </div>
        <div className="grid two">
          <label>
            <span>{t.upload.profile}</span>
            <select
              value={selectedProfile}
              onChange={(event) => onProfileChange(event.target.value)}
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
        <div className="actions">
          <button type="button" onClick={() => void onRunUpload()} disabled={busy}>
            {t.upload.startUpload}
          </button>
        </div>
      </section>

      <section className="panel guide-panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">{t.upload.guideEyebrow}</p>
            <h3>{t.upload.guideTitle}</h3>
          </div>
        </div>
        <div className="guide-list">
          <div className={`guide-item ${hasProfile ? "done" : ""}`}>
            <strong>1</strong>
            <p>{t.upload.stepProfile}</p>
          </div>
          <div className={`guide-item ${hasIpa ? "done" : ""}`}>
            <strong>2</strong>
            <p>{t.upload.stepIpa}</p>
          </div>
          <div className={`guide-item ${!usingOverrides ? "done" : ""}`}>
            <strong>3</strong>
            <p>{t.upload.stepOverride}</p>
          </div>
          <div className={`guide-item ${hasProfile && hasIpa ? "done" : ""}`}>
            <strong>4</strong>
            <p>{t.upload.stepRun}</p>
          </div>
        </div>
      </section>

      <StatusCard run={recentRun} onOpenWorkflow={() => void onOpenWorkflow()} />
      <OutputPanel lines={outputLines} busy={busy} />
    </div>
  );
}
