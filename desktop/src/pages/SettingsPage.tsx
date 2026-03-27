import { useState } from "react";
import { OutputPanel } from "../components/OutputPanel";
import { ProfileEditor } from "../components/ProfileEditor";
import { useI18n } from "../i18n/I18nProvider";
import { pickFile } from "../lib/api";
import type { Profile, RepoCheckResult } from "../lib/types";

type Props = {
  repo: string;
  branch: string;
  githubToken: string;
  profiles: Profile[];
  repoCheck: RepoCheckResult | null;
  busy: boolean;
  outputLines: string[];
  onRepoChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onSaveSettings: () => Promise<void>;
  onRunBootstrap: () => Promise<void>;
  onCheckRepo: () => Promise<void>;
  onSaveProfiles: (profiles: Profile[]) => Promise<void>;
};

const emptyProfile = (): Profile => ({
  name: "",
  email: "",
  issuer_id: "",
  key_id: "",
  p8_path: "",
});

export function SettingsPage({
  repo,
  branch,
  githubToken,
  profiles,
  repoCheck,
  busy,
  outputLines,
  onRepoChange,
  onBranchChange,
  onTokenChange,
  onSaveSettings,
  onRunBootstrap,
  onCheckRepo,
  onSaveProfiles,
}: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Profile>(emptyProfile);
  const [editingName, setEditingName] = useState<string | null>(null);

  const resetEditor = () => {
    setDraft(emptyProfile());
    setEditingName(null);
  };

  const handlePickP8 = async () => {
    const selected = await pickFile("p8");
    if (selected) {
      setDraft((current) => ({ ...current, p8_path: selected }));
    }
  };

  const handleSaveProfile = async () => {
    const trimmed = {
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim(),
      issuer_id: draft.issuer_id.trim(),
      key_id: draft.key_id.trim(),
      p8_path: draft.p8_path.trim(),
    };

    if (
      !trimmed.name ||
      !trimmed.email ||
      !trimmed.issuer_id ||
      !trimmed.key_id ||
      !trimmed.p8_path
    ) {
      return;
    }

    const nextProfiles = editingName
      ? profiles.map((profile) =>
          profile.name === editingName ? trimmed : profile,
        )
      : [...profiles, trimmed];

    await onSaveProfiles(nextProfiles);
    resetEditor();
  };

  const handleEdit = (profile: Profile) => {
    setDraft(profile);
    setEditingName(profile.name);
  };

  const handleDelete = async (profileName: string) => {
    await onSaveProfiles(profiles.filter((profile) => profile.name !== profileName));
    if (editingName === profileName) {
      resetEditor();
    }
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">{t.settings.eyebrow}</p>
            <h3>{t.settings.title}</h3>
          </div>
        </div>
        <div className="grid two">
          <label>
            <span>{t.settings.repo}</span>
            <input
              value={repo}
              onChange={(event) => onRepoChange(event.target.value)}
              placeholder={t.settings.repoPlaceholder}
            />
          </label>
          <label>
            <span>{t.settings.branch}</span>
            <input
              value={branch}
              onChange={(event) => onBranchChange(event.target.value)}
              placeholder={t.settings.branchPlaceholder}
            />
          </label>
        </div>
        <label>
          <span>{t.settings.token}</span>
          <input
            type="password"
            value={githubToken}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder={t.settings.tokenPlaceholder}
          />
        </label>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => void onSaveSettings()}>
            {t.settings.saveSettings}
          </button>
          <button type="button" className="secondary" onClick={() => void onCheckRepo()}>
            {t.settings.testConnection}
          </button>
          <button type="button" onClick={() => void onRunBootstrap()} disabled={busy}>
            {t.settings.initializeRepo}
          </button>
        </div>
        {repoCheck ? (
          <p className={`notice ${repoCheck.ok ? "success" : "error"}`}>
            {repoCheck.message}
          </p>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">{t.settings.profilesEyebrow}</p>
            <h3>{t.settings.profilesTitle}</h3>
          </div>
        </div>
        <div className="profile-list">
          {profiles.length === 0 ? (
            <p className="muted">{t.settings.noProfiles}</p>
          ) : (
            profiles.map((profile) => (
              <article key={profile.name} className="profile-card">
                <div>
                  <strong>{profile.name}</strong>
                  <p>{profile.email}</p>
                </div>
                <div className="profile-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleEdit(profile)}
                  >
                    {t.common.edit}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void handleDelete(profile.name)}
                  >
                    {t.common.delete}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <ProfileEditor
        draft={draft}
        onChange={setDraft}
        onPickP8={handlePickP8}
        onSave={() => void handleSaveProfile()}
        onCancel={resetEditor}
        editingName={editingName}
      />
      <OutputPanel lines={outputLines} busy={busy} />
    </div>
  );
}
