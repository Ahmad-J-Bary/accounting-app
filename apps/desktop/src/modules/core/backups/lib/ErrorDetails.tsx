/** Expandable "تفاصيل الخطأ" — native raw detail tucked away, never in flow text. */
export function ErrorDetails({ detail }: { detail?: string | null }) {
  if (!detail) return null;
  return (
    <details className="mt-1.5 rounded-lg bg-slate-50 border border-slate-200 p-2">
      <summary className="cursor-pointer text-[11px] font-bold text-slate-500 select-none">
        تفاصيل الخطأ
      </summary>
      <pre dir="ltr" className="mt-1.5 text-[11px] font-mono text-slate-400 whitespace-pre-wrap break-all leading-relaxed">
        {detail}
      </pre>
    </details>
  );
}