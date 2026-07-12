import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { useUpdateChecker } from "../hooks/useUpdateChecker";
import { cn } from "@shared/lib/utils";
import { UpdateProgress } from "./UpdateProgress";

type BannerPhase = 'available' | 'downloading' | 'preparing' | 'ready' | 'failed';
type BannerVariant = 'stacked' | 'slim';

interface PhaseMeta {
  label: string;
  color: string;
  dotColor: string;
  btnColor: string;
  Icon: React.ElementType;
}

const PHASE_META: Record<BannerPhase, PhaseMeta> = {
  available: {
    label: "تحديث متاح",
    color: "text-blue-600 dark:text-blue-400",
    dotColor: "bg-blue-500",
    btnColor: "hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    Icon: ArrowDownToLine,
  },
  downloading: {
    label: "جارٍ التنزيل",
    color: "text-blue-600 dark:text-blue-400",
    dotColor: "bg-blue-400 animate-pulse",
    btnColor: "hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    Icon: Download,
  },
  preparing: {
    label: "جارٍ التحضير",
    color: "text-amber-600 dark:text-amber-400",
    dotColor: "bg-amber-400 animate-pulse",
    btnColor: "hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400",
    Icon: RefreshCw,
  },
  ready: {
    label: "جاهز للتثبيت",
    color: "text-emerald-600 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
    btnColor: "hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  failed: {
    label: "فشل التحديث",
    color: "text-rose-600 dark:text-rose-400",
    dotColor: "bg-rose-500",
    btnColor: "hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400",
    Icon: AlertCircle,
  },
};

const headerIconCls: Record<BannerPhase, string> = {
  available:
    "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400",
  downloading:
    "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400",
  preparing:
    "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400",
  ready:
    "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400",
  failed:
    "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400",
};

interface UpdateBannerProps {
  variant?: BannerVariant;
  dark?: boolean;
}

export function UpdateBanner({ variant = 'stacked', dark = false }: UpdateBannerProps) {
  const checker = useUpdateChecker();

  const { error, updateProgress, startUpdate, restartToUpdate, retry } = checker;

  // Hooks must be called unconditionally — before any early return
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const downloadStartRef = useRef<number | null>(null);
  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const phase = checker.phase;
  const updateInfo = checker.updateInfo;

  // All hooks must be called unconditionally — before any conditional return
  useEffect(() => {
    if (phase === 'downloading') {
      downloadStartRef.current = Date.now();
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'downloading' || phase === 'ready' || phase === 'failed') {
      setOpen(true);
    }
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const isOutside =
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        dropdownPanelRef.current && !dropdownPanelRef.current.contains(e.target as Node);
      if (isOutside) setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  const handleStackedDismiss = useCallback(() => {
    setOpen(false);
  }, []);

  const handleToggle = useCallback(() => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: `${rect.bottom + 6}px`,
        right: `${window.innerWidth - rect.right}px`,
      });
    }
    setOpen(v => !v);
  }, [open]);

  // Don't show anything when there's no actual update
  if (!updateInfo || phase === 'idle') return null;

  const isBusy = phase === 'downloading' || phase === 'preparing';
  const elapsed =
    phase === 'downloading' && downloadStartRef.current
      ? (Date.now() - downloadStartRef.current) / 1000
      : 0;
  const speed = updateProgress && elapsed > 0 ? updateProgress.downloaded / elapsed : 0;
  const pct =
    updateProgress && updateProgress.total > 0
      ? Math.round((updateProgress.downloaded / updateProgress.total) * 100)
      : 0;

  // ── Stacked / Slim variant (مكدس / نحيف) ──
  const meta = PHASE_META[phase as BannerPhase] ?? PHASE_META.available;
  const { Icon } = meta;
  const isSlim = variant === 'slim';

  const buttonCls = cn(
    "relative flex items-center gap-1.5 rounded-lg transition-all duration-200 outline-none",
    "focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500",
    isSlim ? "px-1.5 py-0.5" : "px-2.5 py-1.5",
    dark
      ? cn("text-slate-200 hover:bg-white/10", open && "bg-white/10")
      : cn(meta.btnColor, open && "bg-slate-100 dark:bg-slate-800/60")
  );

  return (
    <div className="relative" ref={panelRef} dir="rtl">
      {/* Trigger button */}
      <button ref={buttonRef} className={buttonCls} onClick={handleToggle} title={meta.label}>
        <span className="relative flex items-center justify-center">
          <span className={cn("absolute w-4 h-4 rounded-full opacity-25 animate-ping", meta.dotColor)} />
          <Icon
            className={cn(
              isSlim ? "w-3.5 h-3.5" : "w-4 h-4",
              phase === "preparing" && "animate-spin",
              phase === "downloading" && "animate-bounce"
            )}
          />
        </span>
        {!isSlim && (
          <span className={cn("text-xs font-semibold whitespace-nowrap leading-none", dark ? "text-slate-200" : meta.color)}>
            {meta.label}
          </span>
        )}
        {!isSlim && phase === "available" && (
          <span
            className="text-[10px] font-mono px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 leading-none"
            dir="ltr"
          >
            v{updateInfo.latest_version}
          </span>
        )}
        {isBusy && !isSlim && (
          <span className="text-[10px] font-mono opacity-60">{pct}%</span>
        )}
        <ChevronDown
          className={cn(
            "transition-transform duration-200 opacity-40 shrink-0",
            isSlim ? "w-2.5 h-2.5" : "w-3.5 h-3.5",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown panel */}
      {open && createPortal(
        <div
          ref={dropdownPanelRef}
          style={dropdownStyle}
          className={cn(
            "fixed z-[9999] w-80 rounded-xl shadow-2xl border overflow-hidden",
            "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/60",
            "animate-in slide-in-from-top-2 fade-in duration-150"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <span className={cn("flex items-center justify-center w-7 h-7 rounded-lg border", headerIconCls[phase as BannerPhase])}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {phase === "available" && "تحديث جديد متاح"}
                  {phase === "downloading" && "جارٍ تنزيل التحديث"}
                  {phase === "preparing" && "جارٍ تحضير التثبيت"}
                  {phase === "ready" && "التحديث جاهز للتثبيت"}
                  {phase === "failed" && "فشل عملية التحديث"}
                </div>
                {phase === "available" && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5" dir="ltr">
                    v{updateInfo.current_version} → v{updateInfo.latest_version}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {phase === "available" && "يتوفر إصدار أحدث من تطبيق المُواكب. نوصي بالتحديث للحصول على آخر التحسينات والإصلاحات."}
              {phase === "downloading" && `جارٍ التنزيل... ${pct}% من إجمالي الحزمة.`}
              {phase === "preparing" && "يتم تحضير ملفات التثبيت. الرجاء عدم إغلاق التطبيق."}
              {phase === "ready" && "اكتمل التنزيل. انقر على التثبيت لإعادة التشغيل وتطبيق التحديث."}
              {phase === "failed" && (error || "حدث خطأ غير متوقع أثناء معالجة ملفات التحديث.")}
            </p>

            {/* Progress bar */}
            {isBusy && (
              <UpdateProgress
                phase={phase}
                percentage={pct}
                downloadedBytes={updateProgress?.downloaded || 0}
                totalBytes={updateProgress?.total || 0}
                speed={speed}
                error={error}
                compact
              />
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-0.5">
              {phase === "available" && (
                <>
                  <button
                    onClick={handleStackedDismiss}
                    className="flex-1 text-xs py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                  >
                    لاحقاً
                  </button>
                    <button
                      onClick={startUpdate}
                      className="flex-[2] flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition"
                    >
                      <Download className="w-3.5 h-3.5" /> تحديث الآن
                    </button>
                </>
              )}
              {phase === "ready" && (
                <>
                  <button
                    onClick={handleStackedDismiss}
                    className="flex-1 text-xs py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                  >
                    لاحقاً
                  </button>
                    <button
                      onClick={restartToUpdate}
                      className="flex-[2] flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> إعادة التشغيل والتثبيت
                    </button>
                </>
              )}
              {phase === "failed" && (
                <>
                  <button
                    onClick={handleStackedDismiss}
                    className="flex-1 text-xs py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-medium"
                  >
                    تجاهل
                  </button>
                    <button
                      onClick={retry}
                      className="flex-[2] flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
                    </button>
                </>
              )}
              {isBusy && (
                <div className="w-full text-center text-xs text-slate-400 py-1">جارٍ المعالجة... يُرجى الانتظار</div>
              )}
            </div>
          </div>

        </div>
      , document.body)}
    </div>
  );
}
