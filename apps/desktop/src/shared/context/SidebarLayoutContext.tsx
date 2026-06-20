import { createContext } from 'react';
import type {
  SidebarLayoutConfig,
  SidebarItemId,
  SidebarGroupId,
  SidebarItemConfig,
} from '@shared/types/sidebar-config';

import { SidebarLayoutContextType } from '@shared/types/sidebar-config';

export const SidebarLayoutContext = createContext<SidebarLayoutContextType | undefined>(undefined);

