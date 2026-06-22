import type {
  LayoutType,
  NavMenuType,
  SidenavShape,
  TopnavShape,
  NavbarAppearance,
} from '@shared/types/appearance';

export interface CompoundLayoutState {
  navMenuType: NavMenuType;
  sidenavShape: SidenavShape;
  topnavShape: TopnavShape;
  verticalNavbarAppearance: NavbarAppearance;
  horizontalNavbarAppearance: NavbarAppearance;
}

export function computeLayoutType(state: CompoundLayoutState): LayoutType {
  switch (state.navMenuType) {
    case 'sidenav':
      return 'vertical';
    case 'topnav':
      if (state.topnavShape === 'slim') return 'topnav-slim';
      if (state.topnavShape === 'stacked') return 'horizontal-slim';
      return 'navbar-horizontal';
    case 'combo':
      if (state.topnavShape === 'slim') return 'combo-nav-slim';
      if (state.topnavShape === 'stacked') return 'combo-nav-stacked';
      return 'combo-nav';
  }
}

export function deriveCompoundFromLayout(layout: LayoutType): CompoundLayoutState {
  switch (layout) {
    case 'vertical':
      return {
        navMenuType: 'sidenav',
        sidenavShape: 'default',
        topnavShape: 'default',
        verticalNavbarAppearance: 'dark',
        horizontalNavbarAppearance: 'dark',
      };
    case 'topnav-slim':
      return {
        navMenuType: 'topnav',
        sidenavShape: 'default',
        topnavShape: 'slim',
        verticalNavbarAppearance: 'dark',
        horizontalNavbarAppearance: 'dark',
      };
    case 'navbar-horizontal':
      return {
        navMenuType: 'topnav',
        sidenavShape: 'default',
        topnavShape: 'default',
        verticalNavbarAppearance: 'dark',
        horizontalNavbarAppearance: 'dark',
      };
    case 'horizontal-slim':
      return {
        navMenuType: 'topnav',
        sidenavShape: 'default',
        topnavShape: 'stacked',
        verticalNavbarAppearance: 'dark',
        horizontalNavbarAppearance: 'dark',
      };
    case 'combo-nav':
      return {
        navMenuType: 'combo',
        sidenavShape: 'default',
        topnavShape: 'default',
        verticalNavbarAppearance: 'dark',
        horizontalNavbarAppearance: 'dark',
      };
    case 'combo-nav-slim':
      return {
        navMenuType: 'combo',
        sidenavShape: 'default',
        topnavShape: 'slim',
        verticalNavbarAppearance: 'dark',
        horizontalNavbarAppearance: 'dark',
      };
    case 'combo-nav-stacked':
      return {
        navMenuType: 'combo',
        sidenavShape: 'default',
        topnavShape: 'stacked',
        verticalNavbarAppearance: 'dark',
        horizontalNavbarAppearance: 'dark',
      };
  }
}
