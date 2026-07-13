import { createContext } from 'react';
import { SidebarLayoutContextType } from '@shared/types/sidebar-config';

export const SidebarLayoutContext = createContext<SidebarLayoutContextType | undefined>(undefined);

