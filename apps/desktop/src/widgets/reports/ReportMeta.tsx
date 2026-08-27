interface ReportMetaProps {
  title: string;
  description: string;
}

export function ReportMeta({ title, description }: ReportMetaProps) {
  return (
    <div className="bg-primary border-b-2 border-primary-foreground/15 rounded-t-xl px-4 py-3 flex items-center justify-end gap-2 text-sm text-primary-foreground/80">
      <span className="text-lg font-black text-primary-foreground">{title}</span>
      <span className="text-primary-foreground/35">|</span>
      <span>{description}</span>
    </div>
  );
}
