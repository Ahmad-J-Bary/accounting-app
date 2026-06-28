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
  ChevronUp,
  ChevronDown,
  Info,
  ExternalLink,
  Zap
} from "lucide-react";
import { Button } from "@shared/ui/button";
import { useUpdateChecker } from "../hooks/useUpdateChecker";
import { cn } from "@shared/lib/utils";
import { UpdateProgress } from "./UpdateProgress";

type BannerPhase = 'available' | 'downloading' | 'preparing' | 'ready' | 'failed';
type BannerVariant = 'full' | 'stacked' | 'slim';

const phaseColors: Record<BannerPhase, { bg: string; border: string; accent: string; text: string }> = {
  available: {
    bg: "bg-blue-50/95 dark:bg-blue-950/20",
    border: "border-blue-150 dark:border-blue-900/40",
    accent: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300"
  },
  downloading: {
    bg: "bg-blue-50/90 dark:bg-blue-950/15",
    border: "border-blue-150 dark:border-blue-900/30",
    accent: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300"
  },
  preparing: {
    bg: "bg-amber-50/95 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-900/40",
    accent: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300"
  },
  ready: {
    bg: "bg-emerald-50/95 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-900/40",
    accent: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300"
  },
  failed: {
    bg: "bg-rose-50/95 dark:bg-rose-950/20",
    border: "border-rose-200 dark:border-rose-900/40",
    accent: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300"
  }
};

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

function PhaseIcon({ phase }: { phase: BannerPhase }) {
  switch (phase) {
    case 'available':    return <ArrowDownToLine className="w-4 h-4" />;
    case 'downloading':  return <Download className="w-4 h-4 animate-bounce" />;
    case 'preparing':    return <RefreshCw className="w-4 h-4 animate-spin" />;
    case 'ready':        return <CheckCircle2 className="w-4 h-4" />;
    case 'failed':       return <AlertCircle className="w-4 h-4" />;
  }
}

interface UpdateBannerProps {
  variant?: BannerVariant;
  dark?: boolean;
}

const MOCK_INFO = {
  has_update: true,
  current_version: "0.9.2",
  latest_version: "1.0.0-معاينة",
  release_name: "إصدار المعاينة التطويري",
  release_body: "• تحسينات عامة على واجهة التحديث\n• دعم RTL بالكامل\n• إصلاح مشكلة 403 لمستودع GitHub",
  release_url: "https://github.com/Ahmad-J-Bary/accounting-app",
  download_url: "https://github.com/Ahmad-J-Bary/accounting-app/releases/download/v0.9.2/Almowakeb_0.9.2_x64-setup.exe",
};

export function UpdateBanner({ variant = 'full', dark = false }: UpdateBannerProps) {
  const checker = useUpdateChecker();

  const { error, updateProgress, startUpdate, restartToUpdate, retry } = checker;

  // Always force 'available' phase and mock data when there's no real update
  const phase: BannerPhase = checker.phase === 'idle' ? 'available' : (checker.phase as BannerPhase);
  const updateInfo = checker.updateInfo || MOCK_INFO;

  // Shared state hooks
  const [visible, setVisible] = useState(true);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const downloadStartRef = useRef<number | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 'downloading') {
      downloadStartRef.current = Date.now();
    }
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
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

  const handleFullDismiss = useCallback(() => {
    setVisible(false);
  }, []);

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

  // ── Full variant (كامل) ──
  if (variant === 'full') {
    const currentColors = phaseColors[phase] || phaseColors.available;

    return (
      <div
        className={cn(
          "w-full transition-all duration-300 ease-in-out border-b backdrop-blur-sm select-none",
          currentColors.bg,
          currentColors.border,
          visible ? "translate-y-0 opacity-100 max-h-[500px]" : "-translate-y-2 opacity-0 max-h-0 overflow-hidden"
        )}
        dir="rtl"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Right section: Icon + Message */}
            <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
              <div className={cn("w-1 h-6 rounded-full shrink-0", currentColors.accent)} />
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                  "bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800",
                  currentColors.text
                )}
              >
                <PhaseIcon phase={phase} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {phase === 'available' && "يتوفر إصدار جديد من تطبيق المواكب"}
                    {phase === 'downloading' && "جاري تنزيل التحديث الجديد..."}
                    {phase === 'preparing' && "جاري تحضير ملفات التثبيت..."}
                    {phase === 'ready' && "اكتمل التنزيل! التحديث جاهز للتثبيت الآن"}
                    {phase === 'failed' && "فشل التحديث"}
                  </span>
                  {phase === 'available' && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      dir="ltr"
                    >
                      v{updateInfo.current_version} → v{updateInfo.latest_version}
                    </span>
                  )}
                  {phase === 'ready' && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      (سيعاد تشغيل التطبيق تلقائياً)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {phase === 'failed' && (error || "حدث خطأ غير متوقع.")}
                  {phase === 'available' && "نوصي بتنزيل التحديث للحصول على آخر التحسينات والأمان."}
                  {phase === 'preparing' && "الرجاء عدم إغلاق التطبيق أثناء تحضير الحزمة."}
                  {phase === 'downloading' && `${pct}% تم تنزيله من إجمالي الحزمة.`}
                  {phase === 'ready' && "تم التحقق من سلامة الملفات وباتت جاهزة للتطبيق الفوري."}
                </p>
              </div>
            </div>

            {/* Middle section: Integrated inline progress bar */}
            {isBusy && (
              <div className="flex-1 max-w-xs md:max-w-md w-full mx-auto md:mx-0">
                <UpdateProgress
                  phase={phase}
                  percentage={pct}
                  downloadedBytes={updateProgress?.downloaded || 0}
                  totalBytes={updateProgress?.total || 0}
                  speed={speed}
                  error={error}
                  compact
                />
              </div>
            )}

            {/* Left section: Action buttons */}
            <div className="flex items-center gap-2 shrink-0 justify-end">
              {phase === 'available' && (
                <>
                  {updateInfo.release_body && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                      className="h-8 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                    >
                      {showReleaseNotes ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                      ملاحظات الإصدار
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFullDismiss}
                    className="h-8 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                  >
                    لاحقاً
                  </Button>
                  <Button
                    size="sm"
                    onClick={startUpdate}
                    className="h-8 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    تحديث الآن
                  </Button>
                </>
              )}
              {phase === 'ready' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleFullDismiss}
                    className="h-8 text-xs font-medium text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                  >
                    لاحقاً
                  </Button>
                  <Button
                    size="sm"
                    onClick={restartToUpdate}
                    className="h-8 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    إعادة التشغيل وتطبيق التحديث
                  </Button>
                </>
              )}
              {phase === 'failed' && (
                <>
                  <button
                    onClick={handleFullDismiss}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                    title="تجاهل"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <Button
                    size="sm"
                    onClick={retry}
                    className="h-8 px-4 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    إعادة المحاولة
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Expandable Release Notes Area */}
          {phase === 'available' && updateInfo.release_body && showReleaseNotes && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 animate-in slide-in-from-top-1 duration-200">
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 rounded-lg text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    تفاصيل التحديث لـ {updateInfo.release_name || `v${updateInfo.latest_version}`}
                  </h4>
                  {updateInfo.release_url && (
                    <a
                      href={updateInfo.release_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      عرض على GitHub
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <div className="text-xs whitespace-pre-wrap leading-relaxed font-sans opacity-95">
                  {updateInfo.release_body}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Stacked / Slim variant (مكدس / نحيف) ──
  const meta = PHASE_META[phase] ?? PHASE_META.available;
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
              <span className={cn("flex items-center justify-center w-7 h-7 rounded-lg border", headerIconCls[phase])}>
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
              {phase === "available" && "يتوفر إصدار أحدث من تطبيق المواكب. نوصي بالتحديث للحصول على آخر التحسينات والإصلاحات."}
              {phase === "downloading" && `جارٍ التنزيل... ${pct}% من إجمالي الحزمة.`}
              {phase === "preparing" && "يتم تحضير ملفات التثبيت. الرجاء عدم إغلاق التطبيق."}
              {phase === "ready" && "اكتمل التنزيل. انقر على التثبيت لإعادة التشغيل وتطبيق التحديث."}
              {phase === "failed" && (error || "حدث خطأ غير متوقع أثناء معالجة ملفات التحديث.")}
            </p>

            {/* Release notes */}
            {phase === "available" && updateInfo.release_body && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 p-3 max-h-28 overflow-y-auto">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap className="w-3 h-3 text-blue-500 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">ملاحظات الإصدار</span>
                  {updateInfo.release_url && (
                    <a
                      href={updateInfo.release_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mr-auto text-[10px] text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5 font-semibold hover:underline"
                    >
                      GitHub <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                  {updateInfo.release_body}
                </div>
              </div>
            )}

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
                    onClick={() => { startUpdate(); setOpen(false); }}
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
                    onClick={() => { restartToUpdate(); setOpen(false); }}
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
                    onClick={() => { retry(); setOpen(false); }}
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

          {/* Mock badge: shown when there's no real update */}
          {(checker.phase === 'idle' || !checker.updateInfo) && (
            <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200/50 dark:border-amber-800/30">
              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                معاينة – لا يوجد تحديث حقيقي
              </span>
            </div>
          )}
        </div>
      , document.body)}
    </div>
  );
}
