import type { RecentRun } from "../lib/types";

type Props = {
  run?: RecentRun | null;
  onOpenWorkflow?: () => void;
};

export function StatusCard({ run, onOpenWorkflow }: Props) {
  const hasRun = !!run?.releaseTag || !!run?.workflowUrl || !!run?.status;

  return (
    <section className="panel status-card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Recent task</p>
          <h3>Latest workflow state</h3>
        </div>
      </div>
      {!hasRun ? (
        <p className="muted">No upload has been triggered from the desktop app yet.</p>
      ) : (
        <div className="status-grid">
          <div>
            <span className="label">Profile</span>
            <strong>{run?.profile || "-"}</strong>
          </div>
          <div>
            <span className="label">Release tag</span>
            <strong>{run?.releaseTag || "-"}</strong>
          </div>
          <div>
            <span className="label">Status</span>
            <strong>{run?.status || "-"}</strong>
          </div>
          <div>
            <span className="label">Conclusion</span>
            <strong>{run?.conclusion || "-"}</strong>
          </div>
          <div>
            <span className="label">Created at</span>
            <strong>{run?.createdAt || "-"}</strong>
          </div>
        </div>
      )}
      {run?.workflowUrl ? (
        <button type="button" className="secondary" onClick={onOpenWorkflow}>
          Open GitHub Actions
        </button>
      ) : null}
    </section>
  );
}
