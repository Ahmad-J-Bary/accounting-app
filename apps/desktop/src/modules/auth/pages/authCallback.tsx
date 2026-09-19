import { useEffect } from 'react';
import { client } from '@shared/lib/api';
import { useLocalization } from '@app/providers/LocalizationProvider';
import { StartupWindowShell } from '@app/shell/StartupWindowShell';

export default function AuthCallback() {
  const { t } = useLocalization();
  useEffect(() => {
    client.auth.login();
  }, []);

  return (
    <StartupWindowShell
      title={t("callback.processing", { namespace: "auth" })}
      subtitle={t("topbar.companyFallback", { namespace: "shell", fallback: "نظام المحاسبة والمخزون" })}
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="text-gray-600">{t("callback.processing", { namespace: "auth",  })}</p>
        </div>
      </div>
    </StartupWindowShell>
  );
}
