import { DefaultWindowChrome } from "./DefaultWindowChrome";

interface DefaultWorkspaceProps {
  children: React.ReactNode;
}

export function DefaultWorkspace({ children }: DefaultWorkspaceProps) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden" data-testid="default-workspace">
      <DefaultWindowChrome />
      {children}
    </div>
  );
}
