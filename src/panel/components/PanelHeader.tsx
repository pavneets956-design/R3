interface Props {
  username: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function PanelHeader({ username, collapsed, onToggleCollapse }: Props) {
  return (
    <div className="r3-header">
      <span className="r3-header__title">R3</span>
      <span className="r3-header__username">{username ?? 'Guest'}</span>
      <button
        className="r3-header__toggle"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {collapsed ? '+' : '−'}
      </button>
    </div>
  );
}
