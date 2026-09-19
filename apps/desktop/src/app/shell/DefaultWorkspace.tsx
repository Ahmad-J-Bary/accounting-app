import { DefaultWindowChrome } from "./DefaultWindowChrome";
import { WindowSurface } from "./WindowSurface";

interface DefaultWorkspaceProps {
  children: React.ReactNode;
}

export function DefaultWorkspace({ children }: DefaultWorkspaceProps) {
  return (
    <WindowSurface chrome={<DefaultWindowChrome />} testId="default-workspace">
      {children}
    </WindowSurface>
  );
}
