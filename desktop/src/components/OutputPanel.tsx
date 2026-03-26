type Props = {
  lines: string[];
  busy: boolean;
};

export function OutputPanel({ lines, busy }: Props) {
  return (
    <section className="panel terminal-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Live output</p>
          <h3>Script console</h3>
        </div>
        <span className={`status-badge ${busy ? "running" : "idle"}`}>
          {busy ? "Running" : "Idle"}
        </span>
      </div>
      <pre className="terminal">
        {lines.length > 0 ? lines.join("\n") : "No script output yet."}
      </pre>
    </section>
  );
}
