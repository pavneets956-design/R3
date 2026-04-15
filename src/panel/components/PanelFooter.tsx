import { UpgradeCTA } from './UpgradeCTA';

export function PanelFooter() {
  const optionsUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('src/options/options.html')
      : '#';

  return (
    <div className="r3-footer">
      <a href={optionsUrl} target="_blank" rel="noopener noreferrer" className="r3-footer__link">
        R3 Settings
      </a>
      <UpgradeCTA />
    </div>
  );
}
