interface ReportMetaProps {
  title: string;
  description: string;
}

export function ReportMeta({ title, description }: ReportMetaProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-center text-sm text-slate-600">
      <span className="text-lg font-black text-slate-900">{title}</span>
      <span className="mx-2 text-slate-300">|</span>
      <span>{description}</span>
    </div>
  );
}
