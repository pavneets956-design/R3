import { useState } from 'react';
import { usePageContext } from '../hooks/usePageContext';
import { isInstalled } from '../storage';
import { PanelHeader } from './PanelHeader';
import { RulesBlock } from './RulesBlock';
import { RiskCard } from './RiskCard';
import { StatusCard } from './StatusCard';
import { NotesBlock } from './NotesBlock';
import { PanelFooter } from './PanelFooter';
import { ProUnlockedToast } from './Toast';
import { ErrorBoundary } from './ErrorBoundary';
import type { PageContext } from '../../shared/types';

export function FloatingPanel() {
  const ctx = usePageContext();
  const [collapsed, setCollapsed] = useState(false);
  const [firstInstall] = useState(() => !isInstalled());

  const username = ctx?.username ?? null;

  return (
    <div className="r3-host">
      <div className="r3-panel">
        <PanelHeader
          username={username}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />

        {!collapsed && (
          <div className="r3-body">
            {firstInstall && <WelcomeState />}

            {!firstInstall && (!ctx || ctx.pageType === 'other' || (ctx.pageType !== 'profile' && !ctx.subreddit)) && (
              <MinimalState />
            )}

            {!firstInstall && ctx && ctx.pageType === 'profile' && (
              <ProfileState username={username} />
            )}

            {!firstInstall && ctx && ctx.subreddit && ctx.pageType !== 'profile' && (
              <FullPanel ctx={ctx} />
            )}
          </div>
        )}

        <PanelFooter />
      </div>
      <ProUnlockedToast />
    </div>
  );
}

function WelcomeState() {
  return (
    <div className="r3-welcome">
      <div className="r3-welcome__title">Welcome to R3</div>
      <div className="r3-welcome__body">
        Navigate to a subreddit to see its rules, check your posting risk,
        and track whether your posts stay visible.
      </div>
    </div>
  );
}

function MinimalState() {
  return (
    <div className="r3-minimal">No subreddit detected on this page.</div>
  );
}

function ProfileState({ username }: { username: string | null }) {
  return (
    <div className="r3-minimal">
      Viewing profile{username ? ` of ${username}` : ''}.
    </div>
  );
}

function FullPanel({ ctx }: { ctx: PageContext }) {
  const { username, subreddit, pageType, postId } = ctx;

  if (!subreddit) return <MinimalState />;

  if (pageType === 'submit') {
    return (
      <>
        <ErrorBoundary><RiskCard subreddit={subreddit} username={username} /></ErrorBoundary>
        <ErrorBoundary><RulesBlock subreddit={subreddit} /></ErrorBoundary>
        <ErrorBoundary><StatusCard postId={postId} username={username} subreddit={subreddit} /></ErrorBoundary>
        <ErrorBoundary><NotesBlock username={username} subreddit={subreddit} /></ErrorBoundary>
      </>
    );
  }

  return (
    <>
      <ErrorBoundary><RulesBlock subreddit={subreddit} /></ErrorBoundary>
      <ErrorBoundary><RiskCard subreddit={subreddit} username={username} /></ErrorBoundary>
      <ErrorBoundary><StatusCard postId={postId} username={username} subreddit={subreddit} /></ErrorBoundary>
      <ErrorBoundary><NotesBlock username={username} subreddit={subreddit} /></ErrorBoundary>
    </>
  );
}
