import React, { useState } from 'react';
import { useNavSidebarSettings } from '@shared/hooks';
import type { NavLayoutType, SidebarDensityPreset, GroupCollapseBehavior, GroupHeaderStyle } from '@shared/types/sidebar-settings';
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Slider } from "@shared/ui/slider";
import { LayoutGrid, Menu, Sliders, Eye,
  LayoutDashboard, BookOpen, FileText, Receipt,
  ShoppingCart, Package, Warehouse, BarChart3,
  Settings, Users, Wallet, ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@shared/lib/utils";
import { SettingsManagerLayout, SettingsGroup } from '@widgets/templates/SettingsManagerLayout';
import { useLocalization } from "@app/providers/LocalizationProvider";

// ── Standalone mini sidebar preview (no router dependency) ──────────
interface NavPreviewProps {
  background: string;
  activeBg: string;
  collapsed: boolean;
  iconOnly: boolean;
  showSectionHeaders: boolean;
  showLabels: boolean;
  bordered: boolean;
  density: SidebarDensityPreset;
  fontSize: number;
  layoutType: NavLayoutType;
  groupHeaderStyle: string;
}

function NavSidebarPreview({
  background, activeBg, collapsed, iconOnly,
  showSectionHeaders, showLabels, bordered,
  density, fontSize, layoutType, groupHeaderStyle,
}: NavPreviewProps) {
  const { t } = useLocalization();
  const [activeItem, setActiveItem] = useState(() => t("navbar.preview.items.dashboard", { namespace: "settings",  }));
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const PREVIEW_GROUPS = [
    {
      title: t("navbar.preview.groups.home", { namespace: "settings",  }),
      items: [
        { label: t("navbar.preview.items.dashboard", { namespace: "settings",  }), icon: LayoutDashboard, active: true },
      ],
    },
    {
      title: t("navbar.preview.groups.accounting", { namespace: "settings",  }),
      items: [
        { label: t("navbar.preview.items.chartOfAccounts", { namespace: "settings",  }), icon: BookOpen, active: false },
        { label: t("navbar.preview.items.journalEntries", { namespace: "settings",  }), icon: FileText, active: false },
      ],
    },
    {
      title: t("navbar.preview.groups.sales", { namespace: "settings",  }),
      items: [
        { label: t("navbar.preview.items.salesInvoices", { namespace: "settings",  }), icon: Receipt, active: false },
        { label: t("navbar.preview.items.purchaseInvoices", { namespace: "settings",  }), icon: ShoppingCart, active: false },
      ],
    },
    {
      title: t("navbar.preview.groups.inventory", { namespace: "settings",  }),
      items: [
        { label: t("navbar.preview.items.materials", { namespace: "settings",  }), icon: Package, active: false },
        { label: t("navbar.preview.items.inventoryMovements", { namespace: "settings",  }), icon: Warehouse, active: false },
      ],
    },
    {
      title: t("navbar.preview.groups.management", { namespace: "settings",  }),
      items: [
        { label: t("navbar.preview.items.reports", { namespace: "settings",  }), icon: BarChart3, active: false },
        { label: t("navbar.preview.items.users", { namespace: "settings",  }), icon: Users, active: false },
        { label: t("navbar.preview.items.settings", { namespace: "settings",  }), icon: Settings, active: false },
      ],
    },
  ];

  // sync external collapse change
  React.useEffect(() => { setIsCollapsed(collapsed); }, [collapsed]);

  const isBgLight = background === 'bg-white' || background === 'bg-slate-50';
  const textClass = isBgLight ? 'text-slate-800' : 'text-white';
  const subtextClass = isBgLight ? 'text-slate-500' : 'text-slate-400';
  const borderClass = isBgLight ? 'border-slate-200' : 'border-white/10';
  const sectionHeaderClass = isBgLight ? 'text-slate-400' : 'text-slate-500';
  const inactiveTxtClass = isBgLight ? 'text-slate-600' : 'text-slate-400';
  const collapseBtnBg = isBgLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/5 hover:bg-white/10 text-slate-400';

  const densityPy = density === 'compact' ? 'py-1' : density === 'spacious' ? 'py-2.5' : 'py-1.5';
  const densityPx = isCollapsed ? 'px-1.5' : 'px-2';
  const sectionSpacing = density === 'compact' ? 'space-y-2' : density === 'spacious' ? 'space-y-5' : 'space-y-3';
  const logoHeight = density === 'compact' ? 'h-10' : density === 'spacious' ? 'h-14' : 'h-12';
  const fontSizeStyle = { fontSize: `${Math.max(9, fontSize - 2)}px` };

  // TopNav slim layout
  if (layoutType === 'topnav-slim') {
    return (
      <div className={cn("w-full flex flex-col rounded-lg overflow-hidden border", borderClass)}>
        <div className={cn("flex items-center gap-2 px-3 h-10 border-b shrink-0", background, borderClass)}>
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-3.5 h-3.5 text-white" />
          </div>
          <span className={cn("text-[10px] font-bold", textClass)}>{t("navbar.preview.systemName", { namespace: "settings",  })}</span>
          <div className="flex-1" />
          {PREVIEW_GROUPS.flatMap(g => g.items).slice(0, 5).map(item => (
            <button
              key={item.label}
              onClick={() => setActiveItem(item.label)}
              className={cn(
                "flex items-center gap-1 px-2 h-7 rounded text-[9px] font-bold transition-all",
                activeItem === item.label
                  ? `${activeBg} text-white`
                  : `${inactiveTxtClass} hover:bg-white/10`
              )}
            >
              <item.icon className="w-3 h-3" />
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex-1 bg-slate-50 flex items-center justify-center min-h-[120px]">
          <span className="text-[10px] text-slate-400 font-bold">{t("navbar.preview.mainContent", { namespace: "settings",  })}</span>
        </div>
      </div>
    );
  }

  const effectiveIconOnly = isCollapsed && iconOnly;
  const sidebarWidth = isCollapsed ? (effectiveIconOnly ? '44px' : '44px') : '140px';

  return (
    <div className={cn("flex rounded-lg overflow-hidden border", borderClass)} style={{ height: '340px' }}>
      {/* Sidebar */}
      <aside
        className={cn("flex flex-col shrink-0 transition-all duration-300", background, bordered ? `border-l ${borderClass}` : '')}
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      >
        {/* Logo */}
        <div className={cn("flex items-center border-b shrink-0", borderClass, logoHeight, isCollapsed ? 'justify-center px-1' : 'gap-2 px-3')}>
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
            <LayoutDashboard className="w-3.5 h-3.5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className={cn("font-bold leading-tight truncate", textClass)} style={{ fontSize: '10px' }}>{t("navbar.preview.systemName", { namespace: "settings",  })}</div>
              <div className={cn("truncate", subtextClass)} style={{ fontSize: '8px' }}>{t("navbar.preview.systemSub", { namespace: "settings",  })}</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className={cn("flex-1 overflow-hidden py-2 px-1", sectionSpacing)}>
          {PREVIEW_GROUPS.map((group) => {
            const showHeader = showSectionHeaders && !isCollapsed && !effectiveIconOnly;
            return (
              <div key={group.title}>
                {showHeader && (() => {
                  if (groupHeaderStyle === 'line') {
                    return (
                      <div className="flex items-center gap-1 px-2 mb-1">
                        <span className={cn("uppercase tracking-widest font-bold shrink-0", sectionHeaderClass)} style={{ fontSize: '7px' }}>
                          {group.title}
                        </span>
                        <div className={cn("flex-1 h-px border-t opacity-10", borderClass)} />
                      </div>
                    );
                  }
                  if (groupHeaderStyle === 'card') {
                    return (
                      <div className={cn(
                        "mx-1 px-2 py-0.5 rounded text-[6px] font-black border mb-1",
                        isBgLight
                          ? "bg-slate-100/70 text-slate-800 border-slate-200/50 shadow-sm"
                          : "bg-white/5 text-white border-white/5 shadow-sm"
                      )}>
                        {group.title}
                      </div>
                    );
                  }
                  return (
                    <div className={cn("px-2 mb-1 uppercase tracking-widest font-bold", sectionHeaderClass)} style={{ fontSize: '7px' }}>
                      {group.title}
                    </div>
                  );
                })()}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = activeItem === item.label;
                    return (
                      <li key={item.label}>
                        <button
                          onClick={() => setActiveItem(item.label)}
                          className={cn(
                            "w-full flex items-center gap-1.5 rounded transition-all",
                            densityPy, densityPx,
                            isCollapsed ? 'justify-center' : '',
                            isActive
                              ? `${activeBg} text-white font-medium shadow-sm`
                              : `${inactiveTxtClass}`
                          )}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <item.icon className={cn("shrink-0", isActive ? 'text-white' : (isBgLight ? 'text-slate-500' : 'text-slate-500'))} style={{ width: '11px', height: '11px' }} />
                          {!isCollapsed && showLabels && (
                            <span className="truncate" style={fontSizeStyle}>{item.label}</span>
                          )}
                          {isActive && !isCollapsed && (
                            <div className="mr-auto w-1 h-1 rounded-full bg-white animate-pulse" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Collapse button */}
        <div className={cn("border-t px-1 py-1 flex justify-center", borderClass)}>
          <button
            onClick={() => setIsCollapsed(p => !p)}
            className={cn("rounded p-1 transition-all", collapseBtnBg)}
          >
            {isCollapsed
              ? <ChevronLeft className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />
            }
          </button>
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className={cn("border-t px-3 py-1.5 flex items-center gap-1.5", borderClass)}>
            <Wallet className={cn("w-3 h-3", subtextClass)} />
            <span className={subtextClass} style={{ fontSize: '8px' }}>v0.8.11</span>
          </div>
        )}
      </aside>

      {/* Main content placeholder */}
      <div className="flex-1 bg-slate-50 flex flex-col">
        <div className="h-8 bg-white border-b border-slate-200 flex items-center px-3 gap-2">
          <div className="w-14 h-3 bg-slate-200 rounded-full" />
          <div className="w-10 h-3 bg-slate-100 rounded-full" />
          <div className="flex-1" />
          <div className="w-6 h-6 rounded-full bg-blue-100" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          <div className="h-4 bg-slate-200 rounded-lg w-1/3" />
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-lg border border-slate-200 shadow-sm" />
            ))}
          </div>
          <div className="h-24 bg-white rounded-lg border border-slate-200 shadow-sm" />
        </div>
      </div>
    </div>
  );
}

export const NavbarSettingsManager: React.FC = () => {
  const { t } = useLocalization();
  const { settings: navSettings, updateSetting: updateNavSetting, resetSettings: resetNavSettings } = useNavSidebarSettings();

  return (
    <SettingsManagerLayout resetAction={resetNavSettings}>
      <div className="space-y-5">
        <div className="flex flex-col gap-1 border-r-4 border-primary pr-3 pb-1 mb-2">
          <h2 className="text-xl font-black text-foreground">{t("navbar.title", { namespace: "settings",  })}</h2>
          <p className="text-xs text-muted-foreground">{t("navbar.description", { namespace: "settings",  })}</p>
        </div>

        <SettingsGroup title={t("navbar.layoutTitle", { namespace: "settings",  })} icon={Menu} color="text-primary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground font-semibold">{t("navbar.layoutType", { namespace: "settings",  })}</Label>
              <Select
                value={navSettings.navLayoutType}
                onValueChange={(v) => updateNavSetting('navLayoutType', v as NavLayoutType)}
              >
                <SelectTrigger className="h-10 rounded-lg border-muted">
                  <SelectValue placeholder={t("navbar.layoutPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">{t("navbar.layouts.vertical", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="topnav-slim">{t("navbar.layouts.topnavSlim", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-muted-foreground font-semibold">{t("navbar.width", { namespace: "settings", vars: { width: navSettings.navWidth } })}</Label>
              </div>
              <Slider
                value={[navSettings.navWidth]}
                min={180}
                max={320}
                step={5}
                disabled={navSettings.navLayoutType === 'topnav-slim'}
                onValueChange={(v) => updateNavSetting('navWidth', v[0])}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground font-semibold">{t("navbar.density", { namespace: "settings",  })}</Label>
              <Select
                value={navSettings.navDensity}
                onValueChange={(v) => updateNavSetting('navDensity', v as SidebarDensityPreset)}
              >
                <SelectTrigger className="h-10 rounded-lg border-muted">
                  <SelectValue placeholder={t("navbar.densityPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">{t("navbar.densities.compact", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="comfortable">{t("navbar.densities.comfortable", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="spacious">{t("navbar.densities.spacious", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-muted-foreground font-semibold">{t("navbar.fontSize", { namespace: "settings", vars: { size: navSettings.navFontSize } })}</Label>
              </div>
              <Slider
                value={[navSettings.navFontSize]}
                min={12}
                max={16}
                step={1}
                onValueChange={(v) => updateNavSetting('navFontSize', v[0])}
                className="py-2"
              />
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("navbar.colorsTitle", { namespace: "settings",  })} icon={LayoutGrid} color="text-primary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground font-semibold">{t("navbar.background", { namespace: "settings",  })}</Label>
              <Select
                value={navSettings.navBackground}
                onValueChange={(v) => updateNavSetting('navBackground', v)}
              >
                <SelectTrigger className="h-10 rounded-lg border-muted">
                  <SelectValue placeholder={t("navbar.backgroundPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bg-slate-900">{t("navbar.backgrounds.dark", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-slate-950">{t("navbar.backgrounds.veryDark", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-slate-800">{t("navbar.backgrounds.darkGray", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-white">{t("navbar.backgrounds.white", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-slate-50">{t("navbar.backgrounds.lightGray", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground font-semibold">{t("navbar.activeBg", { namespace: "settings",  })}</Label>
              <Select
                value={navSettings.navActiveBg}
                onValueChange={(v) => updateNavSetting('navActiveBg', v)}
              >
                <SelectTrigger className="h-10 rounded-lg border-muted">
                  <SelectValue placeholder={t("navbar.activePlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bg-blue-600">{t("navbar.activeColors.royalBlue", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-emerald-600">{t("navbar.activeColors.emerald", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-slate-700">{t("navbar.activeColors.gray", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-rose-600">{t("navbar.activeColors.rose", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-violet-600">{t("navbar.activeColors.violet", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground font-semibold">{t("navbar.hover", { namespace: "settings",  })}</Label>
              <Select
                value={navSettings.navHoverBg}
                onValueChange={(v) => updateNavSetting('navHoverBg', v)}
              >
                <SelectTrigger className="h-10 rounded-lg border-muted">
                  <SelectValue placeholder={t("navbar.hoverPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hover:bg-white/5 hover:text-white">{t("navbar.hoverStyles.default", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="hover:bg-white/10 hover:text-white">{t("navbar.hoverStyles.glow", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="hover:bg-slate-800 hover:text-white">{t("navbar.hoverStyles.dark", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="hover:bg-transparent hover:text-white">{t("navbar.hoverStyles.none", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("navbar.optionsTitle", { namespace: "settings",  })} icon={Sliders} color="text-cyan-600">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 rounded-xl border border-muted bg-muted/30">
              <Label className="text-foreground font-semibold">{t("navbar.showLabels", { namespace: "settings",  })}</Label>
              <Switch
                checked={navSettings.navShowLabels}
                onCheckedChange={(v) => updateNavSetting('navShowLabels', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-muted bg-muted/30">
              <Label className="text-foreground font-semibold">{t("navbar.showSectionHeaders", { namespace: "settings",  })}</Label>
              <Switch
                checked={navSettings.navShowSectionHeaders}
                onCheckedChange={(v) => updateNavSetting('navShowSectionHeaders', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-muted bg-muted/30">
              <Label className="text-foreground font-semibold">{t("navbar.rememberState", { namespace: "settings",  })}</Label>
              <Switch
                checked={navSettings.navRemembersState}
                onCheckedChange={(v) => updateNavSetting('navRemembersState', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-muted bg-muted/30">
              <Label className="text-foreground font-semibold">{t("navbar.bordered", { namespace: "settings",  })}</Label>
              <Switch
                checked={navSettings.navBordered}
                onCheckedChange={(v) => updateNavSetting('navBordered', v)}
              />
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("navbar.groupBehaviorTitle", { namespace: "settings",  })} icon={Sliders} color="text-teal-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground font-bold text-xs">{t("navbar.groupCollapseBehavior", { namespace: "settings",  })}</Label>
              <Select
                value={navSettings.navGroupCollapseBehavior}
                onValueChange={(v) => updateNavSetting('navGroupCollapseBehavior', v as GroupCollapseBehavior)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200 text-xs">
                  <SelectValue placeholder={t("navbar.groupBehaviorPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">{t("navbar.groupBehaviors.free", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="accordion">{t("navbar.groupBehaviors.accordion", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="all-expanded">{t("navbar.groupBehaviors.allExpanded", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground font-bold text-xs">{t("navbar.groupHeaderStyle", { namespace: "settings",  })}</Label>
              <Select
                value={navSettings.navGroupHeaderStyle}
                onValueChange={(v) => updateNavSetting('navGroupHeaderStyle', v as GroupHeaderStyle)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200 text-xs">
                  <SelectValue placeholder={t("navbar.groupStylePlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">{t("navbar.groupStyles.classic", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="line">{t("navbar.groupStyles.line", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="card">{t("navbar.groupStyles.card", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsGroup>

        {/* ── Live Preview ── */}
        <SettingsGroup title={t("navbar.previewTitle", { namespace: "settings",  })} icon={Eye} color="text-primary">
          <p className="text-xs text-muted-foreground mb-4 font-medium">
            {t("navbar.previewHint", { namespace: "settings",  })}
          </p>
          <NavSidebarPreview
            background={navSettings.navBackground}
            activeBg={navSettings.navActiveBg}
            collapsed={navSettings.navCollapsed}
            iconOnly={navSettings.navIconOnly}
            showSectionHeaders={navSettings.navShowSectionHeaders}
            showLabels={navSettings.navShowLabels}
            bordered={navSettings.navBordered}
            density={navSettings.navDensity}
            fontSize={navSettings.navFontSize}
            layoutType={navSettings.navLayoutType}
            groupHeaderStyle={navSettings.navGroupHeaderStyle}
          />
        </SettingsGroup>
      </div>
    </SettingsManagerLayout>
  );
};

