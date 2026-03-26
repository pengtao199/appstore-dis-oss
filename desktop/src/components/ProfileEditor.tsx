import type { Profile } from "../lib/types";

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
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{editingName ? "Edit profile" : "New profile"}</p>
          <h3>{editingName ?? "Create Apple profile"}</h3>
        </div>
      </div>
      <div className="grid two">
        <label>
          <span>Profile name</span>
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="dev_a"
          />
        </label>
        <label>
          <span>Developer email</span>
          <input
            value={draft.email}
            onChange={(event) => onChange({ ...draft, email: event.target.value })}
            placeholder="name@example.com"
          />
        </label>
        <label>
          <span>Issuer ID</span>
          <input
            value={draft.issuer_id}
            onChange={(event) =>
              onChange({ ...draft, issuer_id: event.target.value })
            }
          />
        </label>
        <label>
          <span>Key ID</span>
          <input
            value={draft.key_id}
            onChange={(event) => onChange({ ...draft, key_id: event.target.value })}
          />
        </label>
      </div>
      <label>
        <span>P8 path</span>
        <div className="inline-field">
          <input
            value={draft.p8_path}
            onChange={(event) => onChange({ ...draft, p8_path: event.target.value })}
            placeholder="/path/to/AuthKey.p8"
          />
          <button type="button" className="secondary" onClick={onPickP8}>
            Choose
          </button>
        </div>
      </label>
      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={onSave}>
          Save profile
        </button>
      </div>
    </section>
  );
}
