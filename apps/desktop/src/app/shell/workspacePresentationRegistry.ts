import type { MotionMode, TabStyleMode } from "@shared/types/appearance";

export interface WorkspacePresentationDefinition {
  id: TabStyleMode;
  badgeKey: string;
  titleKey: string;
  descriptionKey: string;
}

export interface MotionLevelDefinition {
  id: MotionMode;
  labelKey: string;
  descriptionKey: string;
}

export const WORKSPACE_PRESENTATIONS: WorkspacePresentationDefinition[] = [
  {
    id: "default",
    badgeKey: "appearance.preview.defaultBadge",
    titleKey: "appearance.preview.defaultTitle",
    descriptionKey: "appearance.tabStyleDescriptions.default",
  },
  {
    id: "browser",
    badgeKey: "appearance.preview.browserBadge",
    titleKey: "appearance.preview.browserTitle",
    descriptionKey: "appearance.tabStyleDescriptions.browser",
  },
  {
    id: "vscode",
    badgeKey: "appearance.preview.vscodeBadge",
    titleKey: "appearance.preview.vscodeTitle",
    descriptionKey: "appearance.tabStyleDescriptions.vscode",
  },
];

export const MOTION_LEVELS: MotionLevelDefinition[] = [
  {
    id: "none",
    labelKey: "appearance.motions.none",
    descriptionKey: "appearance.motionDescriptions.none",
  },
  {
    id: "light",
    labelKey: "appearance.motions.light",
    descriptionKey: "appearance.motionDescriptions.light",
  },
  {
    id: "standard",
    labelKey: "appearance.motions.standard",
    descriptionKey: "appearance.motionDescriptions.standard",
  },
  {
    id: "high",
    labelKey: "appearance.motions.high",
    descriptionKey: "appearance.motionDescriptions.high",
  },
];
