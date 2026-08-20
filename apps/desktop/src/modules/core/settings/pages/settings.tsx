import { useState, useEffect } from "react";
import { Building, FileText, DollarSign, Palette, ChevronDown, ChevronUp, Table2, PanelRightOpen, Settings as SettingsIcon, Globe, ShieldCheck, Sliders, FileDown, Database } from "lucide-react";
import { settingsService } from '@modules/core/api/settingsService';
import type { CompanySettings as CompanySettingsType } from "@erp/shared-types";
import { cn } from "@shared/lib/utils";

import { TableSettingsManager } from "../components/TableSettingsManager";
import { NavbarSettingsManager } from "../components/NavbarSettingsManager";
import { SidebarContentManager } from "../components/SidebarContentManager";
import { PanelSettingsManager } from "../components/PanelSettingsManager";
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

export default function Settings() {
  const [settings, setSettings] = useState<CompanySettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeNav, setActiveNav] = useState(() => {
    return localStorage.getItem('erp_settings_active_nav') || 'company';
  });

  const [appearanceExpanded, setAppearanceExpanded] = useState(() => {
    const active = localStorage.getItem('erp_settings_active_nav') || 'company';
    return ['tables', 'navbar', 'sidebar-content', 'panel', 'appearance'].includes(active);
  });

  // Save active sub-tab on change
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
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="font-black text-slate-400">جاري تحميل الإعدادات...</p>
      </div>
    );
  }

  if (!settings) return null;

  const sidebarItems = [
    { id: "company", label: "بيانات الشركة", icon: Building },
    { id: "prefixes", label: "الأرقام التسلسلية", icon: FileText },
    { id: "currencies", label: "إدارة العملات", icon: DollarSign },
    { id: "financial", label: "الإعدادات المالية", icon: SettingsIcon },
    { id: "warehouses", label: "المستودعات", icon: Building },
    { id: "localization", label: "اللغة والمنطقة", icon: Globe },
    { id: "export", label: "إعدادات التصدير", icon: FileDown },
    { id: "backups", label: "البيانات والنسخ الاحتياطية", icon: Database },
    { id: "security", label: "الأمان والوصول", icon: ShieldCheck },
    { id: "about", label: "حول التطبيق", icon: SettingsIcon },
  ];

  const appearanceItems = [
    { id: "tables", label: "مظهر الجداول", icon: Table2 },
    { id: "navbar", label: "مظهر قائمة التنقل الجانبي", icon: PanelRightOpen },
    { id: "sidebar-content", label: "محتوى وترتيب القائمة", icon: Sliders },
    { id: "panel", label: "لوحة العمليات والنماذج", icon: PanelRightOpen },
    { id: "appearance", label: "المظهر العام", icon: Palette },
  ];

  const renderSection = () => {
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
        break;
      default:
        return <UnderDevelopmentSection />;
    }
  };

  return (
    <SettingsLayout
      title="إعدادات النظام"
      description="تخصيص الخيارات الأساسية، الهوية البصرية، والقواعد المحاسبية للمنشأة."
      sidebar={
        <nav className="space-y-2">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
                activeNav === item.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </button>
          ))}

          {/* Appearance Category */}
          <div className="space-y-1">
            <button
              onClick={() => setAppearanceExpanded(!appearanceExpanded)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl font-bold transition-all text-slate-500 hover:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <Palette className="w-4.5 h-4.5" />
                <span>المظهر</span>
              </div>
              {appearanceExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {appearanceExpanded && (
              <div className="mr-6 space-y-1">
                {appearanceItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveNav(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-all",
                      activeNav === item.id
                        ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                        : "text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      }
    >
      {renderSection()}
    </SettingsLayout>
  );
}
