import { useAppearance } from '@shared/hooks/useAppearance';
import { UpdateBanner } from '@modules/core/components/UpdateBanner';

export function FullBannerSlot() {
  const { settings } = useAppearance();
  if (settings.updateBannerStyle !== 'full') return null;
  return <UpdateBanner variant="full" />;
}
