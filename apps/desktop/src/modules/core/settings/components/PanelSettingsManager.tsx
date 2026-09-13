import React, { useState } from 'react';
import { useSidePanelSettings } from '@shared/hooks';
import type { SidebarWidthPreset } from '@shared/types/sidebar-settings';
import { Label } from "@shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { Switch } from "@shared/ui/switch";
import { Slider } from "@shared/ui/slider";
import { Button } from "@shared/ui/button";
import { LayoutGrid, Type, Monitor, Eye, PanelRightOpen, PanelRightClose } from "lucide-react";
import { SidebarShell, SidebarHeader, SidebarBody, SidebarFooter, SidebarSection, SidebarFieldGroup } from '@widgets/sidebar-shell';
import { SettingsManagerLayout, SettingsGroup } from '@widgets/templates/SettingsManagerLayout';
import { useLocalization } from "@app/providers/LocalizationProvider";

export const PanelSettingsManager: React.FC = () => {
  const { t } = useLocalization();
  const { settings: sideSettings, updateSetting: updateSideSetting, resetSettings: resetSideSettings } = useSidePanelSettings();
  const [previewOverlay, setPreviewOverlay] = useState(false);

  type PresetUnion = 'compact' | 'comfortable' | 'spacious';
  type BorderUnion = 'none' | 'left' | 'right' | 'all';
  type ShadowUnion = 'none' | 'sm' | 'md' | 'lg' | 'xl';
  type OverlayUnion = 'overlay' | 'inline';
  type PlacementUnion = 'left' | 'right' | 'justify';

  return (
    <SettingsManagerLayout resetAction={resetSideSettings}>
      <div className="space-y-5">
        <div className="flex flex-col gap-1 border-r-4 border-emerald-600 pr-3 pb-1 mb-2">
          <h2 className="text-xl font-black text-slate-800">{t("panel.title", { namespace: "settings",  })}</h2>
          <p className="text-xs text-slate-500">{t("panel.description", { namespace: "settings",  })}</p>
        </div>

        <SettingsGroup title={t("panel.layoutTitle", { namespace: "settings",  })} icon={LayoutGrid} color="text-emerald-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">{t("panel.defaultWidth", { namespace: "settings",  })}</Label>
              <Select
                value={sideSettings.widthPreset}
                onValueChange={(v) => updateSideSetting('widthPreset', v as SidebarWidthPreset)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder={t("panel.widthPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrow">{t("panel.widths.narrow", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="standard">{t("panel.widths.standard", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="wide">{t("panel.widths.wide", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="extra-wide">{t("panel.widths.extraWide", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-slate-600 font-semibold">{t("panel.customWidth", { namespace: "settings", vars: { width: sideSettings.customWidth } })}</Label>
              </div>
              <Slider
                value={[sideSettings.customWidth]}
                min={300}
                max={900}
                step={10}
                onValueChange={(v) => updateSideSetting('customWidth', v[0])}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">{t("panel.padding", { namespace: "settings",  })}</Label>
              <Select
                value={sideSettings.paddingPreset}
                onValueChange={(v) => updateSideSetting('paddingPreset', v as PresetUnion)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder={t("panel.paddingPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">{t("panel.paddings.compact", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="comfortable">{t("panel.paddings.comfortable", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="spacious">{t("panel.paddings.spacious", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">{t("panel.spacing", { namespace: "settings",  })}</Label>
              <Select
                value={sideSettings.spacingPreset}
                onValueChange={(v) => updateSideSetting('spacingPreset', v as PresetUnion)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder={t("panel.spacingPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">{t("panel.spacings.compact", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="comfortable">{t("panel.spacings.comfortable", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="spacious">{t("panel.spacings.spacious", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">{t("panel.background", { namespace: "settings",  })}</Label>
              <Select
                value={sideSettings.background}
                onValueChange={(v) => updateSideSetting('background', v)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder={t("panel.backgroundPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bg-white">{t("panel.backgrounds.white", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-slate-50">{t("panel.backgrounds.slate", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="bg-zinc-50">{t("panel.backgrounds.zinc", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">{t("panel.shadow", { namespace: "settings",  })}</Label>
              <Select
                value={sideSettings.shadow}
                onValueChange={(v) => updateSideSetting('shadow', v as ShadowUnion)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder={t("panel.shadowPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("panel.shadows.none", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="sm">{t("panel.shadows.sm", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="md">{t("panel.shadows.md", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="lg">{t("panel.shadows.lg", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="xl">{t("panel.shadows.xl", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("panel.typographyTitle", { namespace: "settings",  })} icon={Type} color="text-amber-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-slate-600 font-semibold">{t("panel.fieldFontSize", { namespace: "settings", vars: { size: sideSettings.fontSize } })}</Label>
              </div>
              <Slider
                value={[sideSettings.fontSize]}
                min={12}
                max={16}
                step={1}
                onValueChange={(v) => updateSideSetting('fontSize', v[0])}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600 font-semibold">{t("panel.borderStyleTitle", { namespace: "settings",  })}</Label>
              <Select
                value={sideSettings.borderStyle}
                onValueChange={(v) => updateSideSetting('borderStyle', v as BorderUnion)}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200">
                  <SelectValue placeholder={t("panel.borderPlaceholder", { namespace: "settings",  })} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("panel.borders.none", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="left">{t("panel.borders.left", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="right">{t("panel.borders.right", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="all">{t("panel.borders.all", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("panel.behaviorTitle", { namespace: "settings",  })} icon={Monitor} color="text-orange-600">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">{t("panel.displayBehavior", { namespace: "settings",  })}</Label>
              </div>
              <Select
                value={sideSettings.overlayVsInline}
                onValueChange={(v) => updateSideSetting('overlayVsInline', v as OverlayUnion)}
              >
                <SelectTrigger className="w-24 h-9 border-slate-200 font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inline">{t("panel.overlayModes.inline", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="overlay">{t("panel.overlayModes.overlay", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">{t("panel.stickyHeaderFooter", { namespace: "settings",  })}</Label>
              </div>
              <Switch
                checked={sideSettings.stickyHeaderFooter}
                onCheckedChange={(v) => updateSideSetting('stickyHeaderFooter', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">{t("panel.saveButtonPlacement", { namespace: "settings",  })}</Label>
              </div>
              <Select
                value={sideSettings.saveButtonPlacement}
                onValueChange={(v) => updateSideSetting('saveButtonPlacement', v as PlacementUnion)}
              >
                <SelectTrigger className="w-24 h-9 border-slate-200 font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">{t("panel.placements.right", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="left">{t("panel.placements.left", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="justify">{t("panel.placements.justify", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">{t("panel.closeButton", { namespace: "settings",  })}</Label>
              </div>
              <Switch
                checked={sideSettings.closeButtonVisibility}
                onCheckedChange={(v) => updateSideSetting('closeButtonVisibility', v)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/30">
              <div className="space-y-0.5">
                <Label className="text-slate-700 font-semibold">{t("panel.animationSpeed", { namespace: "settings",  })}</Label>
              </div>
              <Select
                value={sideSettings.animationSpeed.toString()}
                onValueChange={(v) => updateSideSetting('animationSpeed', parseInt(v))}
              >
                <SelectTrigger className="w-24 h-9 border-slate-200 font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="150">{t("panel.animations.fast", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="300">{t("panel.animations.medium", { namespace: "settings",  })}</SelectItem>
                  <SelectItem value="500">{t("panel.animations.smooth", { namespace: "settings",  })}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("panel.previewTitle", { namespace: "settings",  })} icon={Eye} color="text-violet-600">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant={previewOverlay ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewOverlay(true)}
              className="rounded-lg h-9 text-xs font-bold gap-1.5"
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              {t("panel.previewOverlay", { namespace: "settings",  })}
            </Button>
            <Button
              variant={!previewOverlay ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewOverlay(false)}
              className="rounded-lg h-9 text-xs font-bold gap-1.5"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
              {t("panel.previewInline", { namespace: "settings",  })}
            </Button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40 p-4 flex justify-center items-stretch h-[350px]">
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-lg ml-3 bg-white">
              {t("panel.mainContent", { namespace: "settings",  })}
            </div>
            {!previewOverlay ? (
              <SidebarShell isOpen={true} onClose={() => {}} forceOverlay={false} className="h-full border border-slate-200 rounded-lg overflow-hidden">
                <SidebarHeader title={t("panel.preview.addCustomer", { namespace: "settings",  })} subtitle={t("panel.preview.addCustomerSub", { namespace: "settings",  })} onClose={() => {}} />
                <SidebarBody>
                  <SidebarSection title={t("panel.preview.basicSection", { namespace: "settings",  })}>
                    <SidebarFieldGroup>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold">{t("panel.preview.customerName", { namespace: "settings",  })}</span>
                        <div className="h-9 border border-slate-200 rounded bg-white px-3 flex items-center text-xs text-slate-400">{t("panel.preview.companyName", { namespace: "settings",  })}</div>
                      </div>
                    </SidebarFieldGroup>
                  </SidebarSection>
                </SidebarBody>
                <SidebarFooter onCancel={() => {}} onSave={() => {}} saveLabel={t("panel.preview.saveCustomer", { namespace: "settings",  })} />
              </SidebarShell>
            ) : (
              <SidebarShell isOpen={true} onClose={() => setPreviewOverlay(false)} forceOverlay={true} className="h-full border border-slate-200 rounded-lg overflow-hidden">
                <SidebarHeader title={t("panel.preview.addCustomer", { namespace: "settings",  })} subtitle={t("panel.preview.addCustomerSub", { namespace: "settings",  })} onClose={() => setPreviewOverlay(false)} />
                <SidebarBody>
                  <SidebarSection title={t("panel.preview.basicSection", { namespace: "settings",  })}>
                    <SidebarFieldGroup>
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-bold">{t("panel.preview.customerName", { namespace: "settings",  })}</span>
                        <div className="h-9 border border-slate-200 rounded bg-white px-3 flex items-center text-xs text-slate-400">{t("panel.preview.companyName", { namespace: "settings",  })}</div>
                      </div>
                    </SidebarFieldGroup>
                  </SidebarSection>
                </SidebarBody>
                <SidebarFooter onCancel={() => setPreviewOverlay(false)} onSave={() => setPreviewOverlay(false)} saveLabel={t("panel.preview.saveCustomer", { namespace: "settings",  })} />
              </SidebarShell>
            )}
          </div>
        </SettingsGroup>
      </div>
    </SettingsManagerLayout>
  );
};
