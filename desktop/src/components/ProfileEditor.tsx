import type { Profile } from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  draft: Profile;
  onChange: (profile: Profile) => void;
  onPickP8: () => void;
  onSave: () => void;
  onCancel: () => void;
  editingName?: string | null;
};

export function ProfileEditor({
  draft,
  onChange,
  onPickP8,
  onSave,
  onCancel,
  editingName,
}: Props) {
  const { t } = useI18n();

  return (
    <section className="profile-editor">
      <div className="section-header">
        <div>
          <p className="eyebrow">
            {editingName ? t.profileEditor.editEyebrow : t.profileEditor.newEyebrow}
          </p>
          <h3>{editingName ?? t.profileEditor.createTitle}</h3>
        </div>
      </div>
      <div className="grid two">
        <label>
          <span>{t.profileEditor.name}</span>
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder={t.profileEditor.namePlaceholder}
          />
        </label>
        <label>
          <span>{t.profileEditor.email}</span>
          <input
            value={draft.email}
            onChange={(event) => onChange({ ...draft, email: event.target.value })}
            placeholder={t.profileEditor.emailPlaceholder}
          />
        </label>
        <label>
          <span>{t.profileEditor.issuerId}</span>
          <input
            value={draft.issuer_id}
            onChange={(event) =>
              onChange({ ...draft, issuer_id: event.target.value })
            }
          />
        </label>
        <label>
          <span>{t.profileEditor.keyId}</span>
          <input
            value={draft.key_id}
            onChange={(event) => onChange({ ...draft, key_id: event.target.value })}
          />
        </label>
      </div>
      <label>
        <span>{t.profileEditor.p8Path}</span>
        <div className="inline-field">
          <input
            value={draft.p8_path}
            onChange={(event) => onChange({ ...draft, p8_path: event.target.value })}
            placeholder={t.profileEditor.p8Placeholder}
          />
          <button type="button" className="secondary" onClick={onPickP8}>
            {t.common.choose}
          </button>
        </div>
      </label>
      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="button" onClick={onSave}>
          {t.profileEditor.saveProfile}
        </button>
      </div>
    </section>
  );
}
