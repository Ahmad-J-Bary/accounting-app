import { RefreshCw } from "lucide-react";

export function UnderDevelopmentSection() {
  return (
    <div className="flex flex-col items-center justify-center p-20 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 text-slate-400 text-center space-y-4">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
        <RefreshCw className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <h3 className="font-black text-slate-600">هذا القسم قيد التطوير</h3>
        <p className="text-sm font-medium">سيتم توفير خيارات إضافية في التحديثات القادمة.</p>
      </div>
    </div>
  );
}
