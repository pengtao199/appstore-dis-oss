import { useMemo } from "react";
import { OutputPanel } from "../components/OutputPanel";
import { StatusCard } from "../components/StatusCard";
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
  const selected = useMemo(
    () => profiles.find((profile) => profile.name === selectedProfile),
    [profiles, selectedProfile],
  );

  return (
    <div className="page-grid upload-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Upload</p>
            <h3>Trigger GitHub Action</h3>
          </div>
        </div>
        <div className="grid two">
          <label>
            <span>Profile</span>
            <select
              value={selectedProfile}
              onChange={(event) => onProfileChange(event.target.value)}
            >
              <option value="">Select a profile</option>
              {profiles.map((profile) => (
                <option key={profile.name} value={profile.name}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Selected email</span>
            <input value={selected?.email || ""} readOnly placeholder="Profile email" />
          </label>
        </div>
        <label>
          <span>IPA path</span>
          <div className="inline-field">
            <input
              value={ipaPath}
              onChange={(event) => onIpaPathChange(event.target.value)}
              placeholder="/absolute/path/app.ipa"
            />
            <button type="button" className="secondary" onClick={() => void onPickIpa()}>
              Choose
            </button>
          </div>
        </label>
        <div className="grid two">
          <label>
            <span>Repo override</span>
            <input
              value={repoOverride}
              onChange={(event) => onRepoOverrideChange(event.target.value)}
              placeholder={repoFallback || "owner/repo"}
            />
          </label>
          <label>
            <span>Branch override</span>
            <input
              value={branchOverride}
              onChange={(event) => onBranchOverrideChange(event.target.value)}
              placeholder={branchFallback || "main"}
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" onClick={() => void onRunUpload()} disabled={busy}>
            Start upload
          </button>
        </div>
      </section>

      <StatusCard run={recentRun} onOpenWorkflow={() => void onOpenWorkflow()} />
      <OutputPanel lines={outputLines} busy={busy} />
    </div>
  );
}
