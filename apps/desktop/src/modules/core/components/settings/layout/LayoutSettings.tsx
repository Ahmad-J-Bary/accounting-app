import type { NavMenuType, SidenavShape, TopnavShape, NavbarAppearance } from '@shared/types/appearance';
import { computeLayoutType } from '@shared/config/computeLayoutType';
import { getLayoutDefinition } from '@shared/config/layoutRegistry';
import { cn } from '@shared/lib/utils';
import { LayoutOptionCard } from './LayoutOptionCard';
import { ShapeSelector } from './ShapeSelector';
import { AppearanceSelector } from './AppearanceSelector';
import {
  SidenavPreview,
  TopnavPreview,
  ComboPreview,
  SidenavDefaultPreview,
  SidenavStackedPreview,
  TopnavDefaultPreview,
  TopnavSlimPreview,
  TopnavStackedPreview,
  VerticalLightPreview,
  VerticalDarkPreview,
  HorizontalLightPreview,
  HorizontalDarkPreview,
  getFinalPreview,
} from './LayoutPreview';

interface LayoutSettingsProps {
  navMenuType: NavMenuType;
  sidenavShape: SidenavShape;
  topnavShape: TopnavShape;
  verticalNavbarAppearance: NavbarAppearance;
  horizontalNavbarAppearance: NavbarAppearance;
  onChange: (partial: {
    navMenuType?: NavMenuType;
    sidenavShape?: SidenavShape;
    topnavShape?: TopnavShape;
    verticalNavbarAppearance?: NavbarAppearance;
    horizontalNavbarAppearance?: NavbarAppearance;
  }) => void;
}

const NAV_MENU_OPTIONS: {
  id: NavMenuType;
  label: string;
  description: string;
  preview: React.ReactNode;
}[] = [
  { id: 'sidenav', label: 'Sidenav', description: 'شريط جانبي رئيسي', preview: <SidenavPreview /> },
  { id: 'topnav', label: 'Topnav', description: 'شريط تنقل علوي فقط', preview: <TopnavPreview /> },
  { id: 'combo', label: 'Combo', description: 'شريط جانبي + شريط علوي معاً', preview: <ComboPreview /> },
];

const SIDENAV_SHAPE_OPTIONS = [
  { id: 'default' as SidenavShape, label: 'Default', description: 'شريط جانبي بعرض كامل', preview: <SidenavDefaultPreview /> },
  { id: 'stacked' as SidenavShape, label: 'Stacked', description: 'شريط جانبي مع عناصر مكدسة', preview: <SidenavStackedPreview /> },
];

const TOPNAV_SHAPE_OPTIONS = [
  { id: 'default' as TopnavShape, label: 'Default', description: 'شريط أفقي كامل', preview: <TopnavDefaultPreview /> },
  { id: 'slim' as TopnavShape, label: 'Slim', description: 'شريط أفقي نحيف', preview: <TopnavSlimPreview /> },
  { id: 'stacked' as TopnavShape, label: 'Stacked', description: 'شريط علوي مع شريط أفقي مكدس', preview: <TopnavStackedPreview /> },
];

export function LayoutSettings({
  navMenuType,
  sidenavShape,
  topnavShape,
  verticalNavbarAppearance,
  horizontalNavbarAppearance,
  onChange,
}: LayoutSettingsProps) {
  const layoutType = computeLayoutType({ navMenuType, sidenavShape, topnavShape, verticalNavbarAppearance, horizontalNavbarAppearance });
  const layoutDef = getLayoutDefinition(layoutType);
  const FinalPreview = getFinalPreview(layoutType);

  return (
    <div className="space-y-6">

      {/* Step 1: Navigation Menu */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-slate-400 tracking-wide">Navigation Menu</h4>
        <div className="grid grid-cols-3 gap-3">
          {NAV_MENU_OPTIONS.map((opt) => (
            <LayoutOptionCard
              key={opt.id}
              isActive={navMenuType === opt.id}
              onClick={() => {
                const next: Parameters<typeof onChange>[0] = { navMenuType: opt.id };
                if (opt.id === 'sidenav') {
                  next.sidenavShape = 'default';
                  next.topnavShape = 'default';
                } else if (opt.id === 'topnav') {
                  next.sidenavShape = 'default';
                  next.topnavShape = 'default';
                } else {
                  next.sidenavShape = 'default';
                  next.topnavShape = 'default';
                }
                onChange(next);
              }}
              label={opt.label}
              description={opt.description}
              preview={opt.preview}
            />
          ))}
        </div>
      </div>

      {/* Step 2: Conditional sections */}
      {(navMenuType === 'sidenav' || navMenuType === 'combo') && (
        <div className="space-y-4">
          <ShapeSelector
            title="Sidenav Shape"
            options={SIDENAV_SHAPE_OPTIONS}
            value={sidenavShape}
            onChange={(v) => onChange({ sidenavShape: v as SidenavShape })}
          />
          <AppearanceSelector
            title="Vertical Navbar Appearance"
            value={verticalNavbarAppearance}
            onChange={(v) => onChange({ verticalNavbarAppearance: v })}
            lightPreview={<VerticalLightPreview />}
            darkPreview={<VerticalDarkPreview />}
          />
        </div>
      )}

      {(navMenuType === 'topnav' || navMenuType === 'combo') && (
        <div className="space-y-4">
          <ShapeSelector
            title="Topnav Shape"
            options={TOPNAV_SHAPE_OPTIONS}
            value={topnavShape}
            onChange={(v) => onChange({ topnavShape: v as TopnavShape })}
          />
          <AppearanceSelector
            title="Horizontal Navbar Appearance"
            value={horizontalNavbarAppearance}
            onChange={(v) => onChange({ horizontalNavbarAppearance: v })}
            lightPreview={<HorizontalLightPreview />}
            darkPreview={<HorizontalDarkPreview />}
          />
        </div>
      )}

      {/* Final Preview */}
      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-xs font-semibold text-slate-400 mb-3 tracking-wide">
          Preview
        </h4>
        <div className="rounded-xl border-2 border-primary/20 bg-primary/[0.02] p-4 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-1/2 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
              <FinalPreview />
            </div>
            <div className="flex-1 space-y-2">
              <h4 className="font-bold text-slate-800 text-base">{layoutDef.nameAr}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{layoutDef.description}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600">
                  القائمة: {navMenuType === 'sidenav' ? 'شريط جانبي' : navMenuType === 'topnav' ? 'شريط علوي' : 'مدمج'}
                </span>
                {navMenuType !== 'topnav' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600">
                    الشريط الجانبي: {sidenavShape === 'default' ? 'كامل' : 'مكدس'}
                  </span>
                )}
                {navMenuType !== 'sidenav' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600">
                    الشريط العلوي: {topnavShape === 'default' ? 'كامل' : topnavShape === 'slim' ? 'نحيف' : 'مكدس'}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600">
                  المظهر: {verticalNavbarAppearance === 'dark' ? 'داكن' : 'فاتح'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
