import { useTabs } from "@app/providers/TabContext";
import { useAppearance } from "@shared/hooks/useAppearance";
import { WorkspaceTabStrip } from "./WorkspaceTabStrip";

export function TabBar() {
  const {
    tabs,
    switchTab,
    closeTab,
    openDashboardTab,
    closeOtherTabs,
    closeTabsToRight,
    closeTabsToLeft,
    closeAllTabs,
    reopenLastClosedTab,
    duplicateTab,
    pinTab,
    unpinTab,
  } = useTabs();
  const { settings } = useAppearance();

  return (
    <WorkspaceTabStrip
      tabs={tabs}
      tabStyle={settings.tabStyle}
      onActivate={switchTab}
      onClose={closeTab}
      onNewTab={openDashboardTab}
      onCloseOthers={closeOtherTabs}
      onCloseToRight={closeTabsToRight}
      onCloseToLeft={closeTabsToLeft}
      onCloseAll={closeAllTabs}
      onReopenLastClosed={reopenLastClosedTab}
      onDuplicate={duplicateTab}
      onPin={pinTab}
      onUnpin={unpinTab}
    />
  );
}
