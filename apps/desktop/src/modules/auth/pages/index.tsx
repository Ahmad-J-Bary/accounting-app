import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { currencyService } from '@modules/core/api/currencyService';
import { settingsService } from '@modules/core/api/settingsService';
import { useLocalization } from '@app/providers/LocalizationProvider';
import { StartupWindowShell } from '@app/shell/StartupWindowShell';

export default function Index() {
  const navigate = useNavigate();
  const { t } = useLocalization();

  useEffect(() => {
    (async () => {
      try {
        const [setupDone, settings] = await Promise.all([
          currencyService.isSetupComplete(),
          settingsService.getSettings(),
        ]);
        const needsCompanyConfig = !settings.company_name || settings.company_name === 'شركتي';
        navigate(setupDone && !needsCompanyConfig ? '/dashboard' : '/setup', { replace: true });
      } catch {
        navigate('/dashboard', { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <StartupWindowShell
      title={t("loading", { namespace: "auth" })}
      subtitle={t("topbar.companyFallback", { namespace: "shell", fallback: "نظام المحاسبة والمخزون" })}
    >
      <div className="flex min-h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
          <p className="text-gray-600">{t("loading", { namespace: "auth",  })}</p>
        </div>
      </div>
    </StartupWindowShell>
  );
}
