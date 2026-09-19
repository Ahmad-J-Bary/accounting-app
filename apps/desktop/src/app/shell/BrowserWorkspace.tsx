import { BrowserChrome } from "./BrowserChrome";
import { WindowSurface } from "./WindowSurface";

interface BrowserWorkspaceProps {
  children: React.ReactNode;
  isExchangeVisible: boolean;
  onToggleExchange: () => void;
}

export function BrowserWorkspace({
  children,
  isExchangeVisible,
  onToggleExchange,
}: BrowserWorkspaceProps) {
  return (
    <WindowSurface
      chrome={<BrowserChrome isExchangeVisible={isExchangeVisible} onToggleExchange={onToggleExchange} />}
      testId="browser-workspace"
    >
      {children}
    </WindowSurface>
  );
}
