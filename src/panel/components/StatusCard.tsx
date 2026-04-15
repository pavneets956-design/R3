interface Props {
  postId: string | null;
  username: string | null;
}

export function StatusCard({ postId: _postId, username: _username }: Props) {
  return (
    <div className="r3-section">
      <div className="r3-section__heading">Post Visibility</div>
      <div className="r3-pro-card">
        <div style={{ padding: '8px 0', opacity: 0.3 }}>
          <span style={{ fontSize: 13, color: '#7c7c7c' }}>Status unknown</span>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Last checked: —</div>
        </div>
        <div className="r3-pro-overlay">
          <span className="r3-pro-badge">Pro</span>
          <span className="r3-pro-cta">Unlock to check if your post is visible</span>
          <span className="r3-pro-cta" style={{ fontSize: 11 }}>Coming soon</span>
        </div>
      </div>
    </div>
  );
}
