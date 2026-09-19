import { BrowserChrome } from "./BrowserChrome";

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
    <>
      <BrowserChrome isExchangeVisible={isExchangeVisible} onToggleExchange={onToggleExchange} />
      <div className="min-h-0 flex-1 overflow-hidden" data-testid="browser-workspace">
        {children}
      </div>
    </>
  );
}
