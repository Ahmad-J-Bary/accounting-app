import { useState, useEffect } from "react";
import { Building, FileText, DollarSign, Palette, Table2, PanelRightOpen, Settings as SettingsIcon, Globe, ShieldCheck, Sliders, FileDown, Database, Menu } from "lucide-react";
import { settingsService } from '@modules/core/api/settingsService';
import type { CompanySettings as CompanySettingsType } from "@erp/shared-types";
import { useIsMobile, useIsTablet } from "@shared/hooks/useResponsive";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@shared/ui/sheet";
import { SettingsNavigation } from "@widgets/templates/SettingsNavigation";

import { TableSettingsManager } from "../components/TableSettingsManager";
import { NavbarSettingsManager } from "../components/NavbarSettingsManager";
import { SidebarContentManager } from "../components/SidebarContentManager";
import { PanelSettingsManager } from "../components/PanelSettingsManager";
import { PageHeaderSettingsManager } from "../components/PageHeaderSettingsManager";
import CurrencySettings from "@modules/core/currencies/pages/currencySettings";
import { CompanySettings } from "../components/CompanySettings";
import { PrefixSettings } from "../components/PrefixSettings";
import { FinancialSettings } from "../components/FinancialSettings";
import { AboutSettings } from "../components/AboutSettings";
import { UnderDevelopmentSection } from "../components/UnderDevelopmentSection";
import { WarehouseSettings } from "../components/WarehouseSettings";
import { AppearanceSettings } from "../components/AppearanceSettings";
import { LocalizationSettings } from "../components/LocalizationSettings";
import { ExportSettings } from "../components/ExportSettings";
import { DataBackupSection } from "@modules/core/backups/components/DataBackupSection";

import { SettingsLayout } from "@widgets/templates/SettingsLayout";
import { useLocalization } from "@app/providers/LocalizationProvider";

export default function Settings() {
  const { t, direction, isRTL } = useLocalization();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [settings, setSettings] = useState<CompanySettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  const [activeNav, setActiveNav] = useState(() => {
    return localStorage.getItem('erp_settings_active_nav') || 'company';
  });

  const [appearanceExpanded, setAppearanceExpanded] = useState(() => {
    const active = localStorage.getItem('erp_settings_active_nav') || 'company';
    return ['tables', 'navbar', 'sidebar-content', 'panel', 'page-header', 'appearance'].includes(active);
  });

  useEffect(() => {
    localStorage.setItem('erp_settings_active_nav', activeNav);
  }, [activeNav]);

  const load = async () => {
    setLoading(true);
    try { setSettings(await settingsService.getSettings()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (key: keyof CompanySettingsType, value: string | number | boolean) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-black text-muted-foreground">{t("loading", { namespace: "settings" })}</p>
      </div>
    );
  }

  if (!settings) return null;

  const sidebarItems = [
    { id: "company", label: t("nav.company", { namespace: "settings" }), icon: Building },
    { id: "prefixes", label: t("nav.prefixes", { namespace: "settings" }), icon: FileText },
    { id: "currencies", label: t("nav.currencies", { namespace: "settings" }), icon: DollarSign },
    { id: "financial", label: t("nav.financial", { namespace: "settings" }), icon: SettingsIcon },
    { id: "warehouses", label: t("nav.warehouses", { namespace: "settings" }), icon: Building },
    { id: "localization", label: t("nav.localization", { namespace: "settings" }), icon: Globe },
    { id: "export", label: t("nav.export", { namespace: "settings" }), icon: FileDown },
    { id: "backups", label: t("nav.backups", { namespace: "settings" }), icon: Database },
    { id: "security", label: t("nav.security", { namespace: "settings" }), icon: ShieldCheck },
    { id: "about", label: t("nav.about", { namespace: "settings" }), icon: SettingsIcon },
  ];

  const appearanceItems = [
    { id: "tables", label: t("nav.tables", { namespace: "settings" }), icon: Table2 },
    { id: "navbar", label: t("nav.navbar", { namespace: "settings" }), icon: PanelRightOpen },
    { id: "sidebar-content", label: t("nav.sidebarContent", { namespace: "settings" }), icon: Sliders },
    { id: "panel", label: t("nav.panel", { namespace: "settings" }), icon: PanelRightOpen },
    { id: "page-header", label: "رأس الصفحة", icon: Palette },
    { id: "appearance", label: t("nav.appearance", { namespace: "settings" }), icon: Palette },
  ];

  const allItems = [...sidebarItems, ...appearanceItems];
  const activeItem = allItems.find(i => i.id === activeNav);
  const ActiveIcon = activeItem?.icon || SettingsIcon;

  const handleNavChange = (id: string) => {
    setActiveNav(id);
    if (isMobile || isTablet) setMobileNavOpen(false);
  };

  const renderNavContent = () => (
    <SettingsNavigation
      items={sidebarItems}
      groupItems={appearanceItems}
      groupLabel={t("nav.appearanceCategory", { namespace: "settings" })}
      activeNav={activeNav}
      onNavChange={handleNavChange}
      groupExpanded={appearanceExpanded}
      onGroupToggle={() => setAppearanceExpanded(!appearanceExpanded)}
    />
  );

  const mobileTrigger = isMobile || isTablet ? (
    <button
      onClick={() => setMobileNavOpen(true)}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-foreground font-bold text-sm"
      aria-label={t("pageTitle", { namespace: "settings" })}
    >
      <ActiveIcon className="w-4 h-4" />
      <span className="truncate max-w-[140px]">{activeItem?.label}</span>
      <Menu className="w-4 h-4 text-muted-foreground" />
    </button>
  ) : undefined;

  return (
    <SettingsLayout
      title={t("pageTitle", { namespace: "settings" })}
      description={t("pageDescription", { namespace: "settings" })}
      actions={mobileTrigger}
      sidebar={renderNavContent()}
      showSidebar={!isMobile && !isTablet}
    >
      {renderSection()}

      {(isMobile || isTablet) && (
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side={isRTL ? "right" : "left"} className="w-[280px] sm:w-[320px] p-4 overflow-y-auto" dir={direction}>
            <SheetTitle className="text-start">{t("pageTitle", { namespace: "settings" })}</SheetTitle>
            <SheetDescription className="sr-only">{t("pageDescription", { namespace: "settings" })}</SheetDescription>
            <div className="mt-4">
              {renderNavContent()}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </SettingsLayout>
  );

  function renderSection() {
    switch (activeNav) {
      case "company":
        return <CompanySettings settings={settings} onChange={handleChange} />;
      case "prefixes":
        return <PrefixSettings settings={settings} onChange={handleChange} />;
      case "currencies":
        return <CurrencySettings />;
      case "financial":
        return <FinancialSettings settings={settings} onChange={handleChange} />;
      case "warehouses":
        return <WarehouseSettings settings={settings} onChange={handleChange} />;
      case "tables":
        return <TableSettingsManager />;
      case "navbar":
        return <NavbarSettingsManager />;
      case "sidebar-content":
        return <SidebarContentManager />;
      case "panel":
        return <PanelSettingsManager />;
      case "page-header":
        return <PageHeaderSettingsManager />;
      case "appearance":
        return <AppearanceSettings />;
      case "about":
        return <AboutSettings />;
      case "localization":
        return <LocalizationSettings settings={settings} onChange={handleChange} />;
      case "export":
        return <ExportSettings />;
      case "backups":
        return <DataBackupSection />;
      case "security":
        return <UnderDevelopmentSection />;
      default:
        return <UnderDevelopmentSection />;
    }
  }
}
