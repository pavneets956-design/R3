interface Props {
  subreddit: string;
  username: string | null;
}

export function RiskCard({ subreddit: _subreddit, username: _username }: Props) {
  return (
    <div className="r3-section">
      <div className="r3-section__heading">Posting Risk</div>
      <div className="r3-pro-card">
        <div style={{ padding: '8px 0', opacity: 0.3 }}>
          <span className="r3-risk-level r3-risk-level--medium">Medium</span>
          <ul style={{ fontSize: 12, color: '#7c7c7c', marginTop: 4 }}>
            <li>Account age may be too low</li>
            <li>Karma threshold not met</li>
          </ul>
        </div>
        <div className="r3-pro-overlay">
          <span className="r3-pro-badge">Pro</span>
          <span className="r3-pro-cta">Unlock to see your real risk score</span>
          <span className="r3-pro-cta" style={{ fontSize: 11 }}>Coming soon</span>
        </div>
      </div>
    </div>
  );
}
