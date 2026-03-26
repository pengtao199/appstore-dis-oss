import { useI18n } from "../i18n/I18nProvider";

type Props = {
  lines: string[];
  busy: boolean;
};

export function OutputPanel({ lines, busy }: Props) {
  const { t } = useI18n();

  return (
    <section className="panel terminal-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t.output.eyebrow}</p>
          <h3>{t.output.title}</h3>
        </div>
        <span className={`status-badge ${busy ? "running" : "idle"}`}>
          {busy ? t.output.running : t.output.idle}
        </span>
      </div>
      <pre className="terminal">
        {lines.length > 0 ? lines.join("\n") : t.output.empty}
      </pre>
    </section>
  );
}
