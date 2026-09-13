import { useEffect } from 'react';
import { client } from '@shared/lib/api';
import { useLocalization } from '@app/providers/LocalizationProvider';

export default function AuthCallback() {
  const { t } = useLocalization();
  useEffect(() => {
    client.auth.login();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{t("auth.callback.processing", { namespace: "auth", fallback: "Processing authentication..." })}</p>
      </div>
    </div>
  );
}
