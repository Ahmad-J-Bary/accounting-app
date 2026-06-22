import { cn } from '@shared/lib/utils';
import { Check } from 'lucide-react';
import type { NavMenuType, SidenavShape, TopnavShape, NavbarAppearance } from '@shared/types/appearance';
import { computeLayoutType } from '@shared/config/computeLayoutType';
import { getLayoutDefinition } from '@shared/config/layoutRegistry';
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

/** بطاقة اختيار مصغّرة موحّدة الحجم */
function OptionCard({
  isActive,
  onClick,
  label,
  preview,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
  preview: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-0.5 p-1 rounded-md border transition-all text-center w-full',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60',
      )}
    >
      {isActive && (
        <span className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-primary rounded-full flex items-center justify-center z-10 shadow-sm">
          <Check className="w-1.5 h-1.5 text-primary-foreground" />
        </span>
      )}
      {/* معاينة بصرية بارتفاع ثابت موحّد */}
      <div className="w-full h-11 overflow-hidden rounded border border-slate-100 flex items-stretch">
        <div className="w-full">{preview}</div>
      </div>
      <span className={cn('text-[8px] font-bold leading-none mt-px', isActive ? 'text-primary' : 'text-slate-600')}>
        {label}
      </span>
    </button>
  );
}

/** عنوان قسم فرعي */
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[8px] font-bold text-slate-400 tracking-wide uppercase mb-1">
      {children}
    </span>
  );
}

/** مجموعة أفقية: عنوان + شبكة بطاقات */
function CardGroup({
  label,
  cols,
  children,
}: {
  label: string;
  cols: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-0">
      <SubLabel>{label}</SubLabel>
       <div
         className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </div>
  );
}

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

  const showSidenav = navMenuType === 'sidenav' || navMenuType === 'combo';
  const showTopnav  = navMenuType === 'topnav'  || navMenuType === 'combo';

  return (
    <div className="space-y-1.5">

      {/* ── قائمة التنقل ── */}
      <CardGroup label="قائمة التنقل" cols={3}>
        {([
          { id: 'sidenav' as NavMenuType, label: 'شريط جانبي', preview: <SidenavPreview /> },
          { id: 'topnav'  as NavMenuType, label: 'شريط علوي',  preview: <TopnavPreview /> },
          { id: 'combo'   as NavMenuType, label: 'مدمج',        preview: <ComboPreview /> },
        ]).map(opt => (
          <OptionCard
            key={opt.id}
            isActive={navMenuType === opt.id}
            onClick={() => onChange({ navMenuType: opt.id, sidenavShape: 'default', topnavShape: 'default' })}
            label={opt.label}
            preview={opt.preview}
          />
        ))}
      </CardGroup>

      {/* ── شكل العمودي + مظهر العمودي (صف واحد) ── */}
      {showSidenav && (
        <div className="flex gap-1.5 items-start">
          <CardGroup label="شكل الشريط العمودي" cols={2}>
            {([
              { id: 'default' as SidenavShape, label: 'كامل', preview: <SidenavDefaultPreview /> },
              { id: 'stacked' as SidenavShape, label: 'مكدس', preview: <SidenavStackedPreview /> },
            ]).map(opt => (
              <OptionCard
                key={opt.id}
                isActive={sidenavShape === opt.id}
                onClick={() => onChange({ sidenavShape: opt.id })}
                label={opt.label}
                preview={opt.preview}
              />
            ))}
          </CardGroup>

          <CardGroup label="مظهر الشريط العمودي" cols={2}>
            {([
              { id: 'light' as NavbarAppearance, label: 'فاتح', preview: <VerticalLightPreview /> },
              { id: 'dark'  as NavbarAppearance, label: 'داكن', preview: <VerticalDarkPreview /> },
            ]).map(opt => (
              <OptionCard
                key={opt.id}
                isActive={verticalNavbarAppearance === opt.id}
                onClick={() => onChange({ verticalNavbarAppearance: opt.id })}
                label={opt.label}
                preview={opt.preview}
              />
            ))}
          </CardGroup>
        </div>
      )}

      {/* ── شكل الأفقي + مظهر الأفقي (صف واحد) ── */}
      {showTopnav && (
        <div className="flex gap-1.5 items-start">
          <CardGroup label="شكل الشريط الأفقي" cols={3}>
            {([
              { id: 'default' as TopnavShape, label: 'كامل', preview: <TopnavDefaultPreview /> },
              { id: 'slim'    as TopnavShape, label: 'نحيف', preview: <TopnavSlimPreview /> },
              { id: 'stacked' as TopnavShape, label: 'مكدس', preview: <TopnavStackedPreview /> },
            ]).map(opt => (
              <OptionCard
                key={opt.id}
                isActive={topnavShape === opt.id}
                onClick={() => onChange({ topnavShape: opt.id })}
                label={opt.label}
                preview={opt.preview}
              />
            ))}
          </CardGroup>

          <CardGroup label="مظهر الشريط الأفقي" cols={2}>
            {([
              { id: 'light' as NavbarAppearance, label: 'فاتح', preview: <HorizontalLightPreview /> },
              { id: 'dark'  as NavbarAppearance, label: 'داكن', preview: <HorizontalDarkPreview /> },
            ]).map(opt => (
              <OptionCard
                key={opt.id}
                isActive={horizontalNavbarAppearance === opt.id}
                onClick={() => onChange({ horizontalNavbarAppearance: opt.id })}
                label={opt.label}
                preview={opt.preview}
              />
            ))}
          </CardGroup>
        </div>
      )}

      {/* ── معاينة التخطيط المختار ── */}
      <div className="border-t border-slate-100 pt-1.5">
        <SubLabel>معاينة التخطيط المختار</SubLabel>
        <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-1 flex gap-1.5 items-center">
          <div className="w-14 shrink-0 overflow-hidden rounded border border-slate-200 shadow-sm">
            <FinalPreview />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-bold text-[10px] text-slate-800 truncate leading-tight">{layoutDef.nameAr}</p>
            <p className="text-[8px] text-slate-400 leading-snug line-clamp-2">{layoutDef.description}</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {([
                navMenuType === 'sidenav' ? 'جانبي' : navMenuType === 'topnav' ? 'علوي' : 'مدمج',
                navMenuType !== 'topnav'  ? `جانبي: ${sidenavShape === 'default' ? 'كامل' : 'مكدس'}` : null,
                navMenuType !== 'sidenav' ? `علوي: ${topnavShape === 'default' ? 'كامل' : topnavShape === 'slim' ? 'نحيف' : 'مكدس'}` : null,
                verticalNavbarAppearance === 'dark' ? 'داكن' : 'فاتح',
              ].filter(Boolean) as string[]).map(tag => (
                <span key={tag} className="px-1 py-px rounded bg-slate-100 text-[7px] font-semibold text-slate-500">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
