import { useState } from "react";
import { OutputPanel } from "../components/OutputPanel";
import { ProfileEditor } from "../components/ProfileEditor";
import { useI18n, type Locale } from "../i18n/I18nProvider";
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
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
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
  locale,
  onLocaleChange,
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
  const [tokenVisible, setTokenVisible] = useState(false);
  const showLog = busy || outputLines.length > 0;
  const hasRepo = !!repo.trim();
  const hasBranch = !!branch.trim();
  const hasToken = !!githubToken.trim();
  const canSaveSettings = !busy && hasRepo && hasBranch && hasToken;
  const canCheckRepo = !busy && hasRepo && hasToken;
  const canInitialize = !busy && hasRepo && hasBranch && hasToken;

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
      <header className="page-header">
        <div>
          <p className="eyebrow">{t.settings.eyebrow}</p>
          <h2>{t.settings.title}</h2>
          <p className="muted page-description">{t.settings.description}</p>
        </div>
      </header>

      <div className="settings-layout">
        <div className="settings-main">
          <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">{t.settings.languageEyebrow}</p>
                <h3>{t.settings.languageTitle}</h3>
                <p className="muted section-copy">{t.settings.languageHint}</p>
              </div>
            </div>
            <div className="language-actions">
              <button
                type="button"
                className={locale === "en" ? "tab active compact" : "tab compact"}
                onClick={() => onLocaleChange("en")}
              >
                {t.app.english}
              </button>
              <button
                type="button"
                className={locale === "zh" ? "tab active compact" : "tab compact"}
                onClick={() => onLocaleChange("zh")}
              >
                {t.app.chinese}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">{t.settings.eyebrow}</p>
                <h3>{t.settings.title}</h3>
                <p className="muted section-copy">{t.settings.repoHint}</p>
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
              <div className="input-with-action">
                <input
                  type={tokenVisible ? "text" : "password"}
                  value={githubToken}
                  onChange={(event) => onTokenChange(event.target.value)}
                  placeholder={t.settings.tokenPlaceholder}
                />
                <button
                  type="button"
                  className="secondary inline-action"
                  onClick={() => setTokenVisible((current) => !current)}
                >
                  {tokenVisible ? t.common.hide : t.common.show}
                </button>
              </div>
            </label>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => void onSaveSettings()}
                disabled={!canSaveSettings}
              >
                {t.settings.saveSettings}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => void onCheckRepo()}
                disabled={!canCheckRepo}
              >
                {t.settings.testConnection}
              </button>
              <button type="button" onClick={() => void onRunBootstrap()} disabled={!canInitialize}>
                {t.settings.initializeRepo}
              </button>
            </div>
          </section>

          {showLog ? (
            <details className="panel details-panel" open={busy}>
              <summary>
                <span className="eyebrow">{t.settings.logEyebrow}</span>
                <strong>{t.settings.logTitle}</strong>
              </summary>
              <OutputPanel lines={outputLines} busy={busy} />
            </details>
          ) : null}
        </div>

        <section className="panel account-panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">{t.settings.profilesEyebrow}</p>
              <h3>{t.settings.profilesTitle}</h3>
              <p className="muted section-copy">{t.settings.profilesHint}</p>
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
          <p className="muted profile-count">
            {t.settings.profileCount.replace("{count}", String(profiles.length))}
          </p>
          <div className="profile-editor-wrap">
            <ProfileEditor
              draft={draft}
              onChange={setDraft}
              onPickP8={handlePickP8}
              onSave={() => void handleSaveProfile()}
              onCancel={resetEditor}
              editingName={editingName}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
