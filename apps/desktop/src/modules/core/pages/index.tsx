import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { currencyService } from '@modules/core/api/currencyService';
import { settingsService } from '@modules/core/api/settingsService';

export default function Index() {
  const navigate = useNavigate();

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">جاري التحميل...</p>
      </div>
    </div>
  );
}
