import { useTabs } from "@app/providers/TabContext";
import { useAppearance } from "@shared/hooks/useAppearance";
import { WorkspaceTabStrip } from "./WorkspaceTabStrip";
import { DefaultTabBar } from "./DefaultTabBar";

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

  if (settings.tabStyle === "default") {
    return <DefaultTabBar />;
  }

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
