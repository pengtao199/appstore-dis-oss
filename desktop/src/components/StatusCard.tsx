import type { RecentRun } from "../lib/types";
import { useI18n } from "../i18n/I18nProvider";

type Props = {
  run?: RecentRun | null;
  onOpenWorkflow?: () => void;
};

export function StatusCard({ run, onOpenWorkflow }: Props) {
  const { t } = useI18n();
  const hasRun = !!run?.releaseTag || !!run?.workflowUrl || !!run?.status;

  return (
    <section className="panel status-card">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t.status.eyebrow}</p>
          <h3>{t.status.title}</h3>
        </div>
      </div>
      {!hasRun ? (
        <p className="muted">{t.status.empty}</p>
      ) : (
        <div className="status-grid">
          <div>
            <span className="label">{t.status.profile}</span>
            <strong>{run?.profile || t.common.none}</strong>
          </div>
          <div>
            <span className="label">{t.status.releaseTag}</span>
            <strong>{run?.releaseTag || t.common.none}</strong>
          </div>
          <div>
            <span className="label">{t.status.status}</span>
            <strong>{run?.status || t.common.none}</strong>
          </div>
          <div>
            <span className="label">{t.status.conclusion}</span>
            <strong>{run?.conclusion || t.common.none}</strong>
          </div>
          <div>
            <span className="label">{t.status.createdAt}</span>
            <strong>{run?.createdAt || t.common.none}</strong>
          </div>
        </div>
      )}
      {run?.workflowUrl ? (
        <button type="button" className="secondary" onClick={onOpenWorkflow}>
          {t.status.openActions}
        </button>
      ) : null}
    </section>
  );
}
