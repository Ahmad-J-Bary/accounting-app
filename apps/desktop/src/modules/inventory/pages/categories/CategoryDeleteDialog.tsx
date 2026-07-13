import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@shared/ui/alert-dialog";
import { AlertTriangle, FolderTree, Trash2 } from "lucide-react";

export type CategoryDeleteKind =
  | { type: "sub_empty" }
  | { type: "sub_with_materials"; materialCount: number; targetName: string; isGeneralSub: boolean }
  | { type: "root_no_subs" }
  | { type: "root_with_subs"; subCount: number; subMaterialCount: number; targetName: string };

export interface CategoryDeleteDialogProps {
  open: boolean;
  kind: CategoryDeleteKind | null;
  categoryName: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}

export function CategoryDeleteDialog({
  open, kind, categoryName, onCancel, onConfirm, confirming,
}: CategoryDeleteDialogProps) {
  if (!kind) return null;

  let title: string;
  let description: React.ReactNode;
  let confirmLabel: string;
  let tone: "amber" | "rose" = "rose";

  if (kind.type === "sub_empty") {
    title = "حذف التصنيف الفرعي";
    description = (
      <span>
        هل تريد بالتأكيد حذف التصنيف الفرعي{" "}
        <span className="font-bold text-slate-900">«{categoryName}»</span>؟
        لا توجد مواد مرتبطة به.
      </span>
    );
    confirmLabel = "حذف";
    tone = "amber";
  } else if (kind.type === "sub_with_materials") {
    title = "تنبيه: التصنيف يحتوي على مواد";
    description = (
      <div className="space-y-2 text-right">
        <p>
          التصنيف الفرعي <span className="font-bold text-slate-900">«{categoryName}»</span>{" "}
          يحتوي على <span className="font-black text-rose-600">{kind.materialCount}</span> مادة.
        </p>
        <p className="text-slate-700">
          {kind.isGeneralSub
            ? <>سيتم تعديل تصنيفات هذه المواد إلى التصنيف الافتراضي <span className="font-bold text-blue-700">«غير مصنف»</span>.</>
            : <>سيتم تعديل تصنيفات هذه المواد إلى التصنيف الفرعي العام <span className="font-bold text-blue-700">«{kind.targetName}»</span> ضمن نفس التصنيف الرئيسي.</>
          }
        </p>
        <p className="text-xs text-slate-500">هل تريد المتابعة؟</p>
      </div>
    );
    confirmLabel = "نعم، احذف وأعد توزيع المواد";
    tone = "rose";
  } else if (kind.type === "root_no_subs") {
    title = "حذف التصنيف الرئيسي";
    description = (
      <span>
        هل تريد بالتأكيد حذف التصنيف الرئيسي{" "}
        <span className="font-bold text-slate-900">«{categoryName}»</span>؟
      </span>
    );
    confirmLabel = "حذف";
    tone = "amber";
  } else {
    title = "تنبيه: الحذف سيشمل التصنيفات الفرعية";
    description = (
      <div className="space-y-2 text-right">
        <p>
          التصنيف الرئيسي <span className="font-bold text-slate-900">«{categoryName}»</span>{" "}
          يحتوي على <span className="font-black text-rose-600">{kind.subCount}</span> تصنيف فرعي.
        </p>
        <p className="text-slate-700">
          سيتم حذف التصنيف الرئيسي وجميع التصنيفات الفرعية الخاصة به.
        </p>
        {kind.subMaterialCount > 0 && (
          <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs">
            تنبيه: تحتوي التصنيفات الفرعية على{" "}
            <span className="font-black">{kind.subMaterialCount}</span> مادة سيتم تعديل
            تصنيفها إلى <span className="font-bold">«{kind.targetName}»</span>.
          </p>
        )}
        <p className="text-xs text-slate-500">هل تريد المتابعة؟</p>
      </div>
    );
    confirmLabel = "نعم، احذف الكل";
    tone = "rose";
  }

  const Icon = tone === "rose" ? AlertTriangle : FolderTree;
  const iconWrap = tone === "rose" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600";

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !confirming) onCancel(); }}>
      <AlertDialogContent dir="rtl" className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconWrap}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-base text-right">{title}</AlertDialogTitle>
              <AlertDialogDescription className="text-right text-sm leading-relaxed mt-2">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 flex-row-reverse">
          <AlertDialogCancel disabled={confirming} className="font-bold">
            إلغاء
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={confirming}
            className={tone === "rose"
              ? "bg-rose-600 hover:bg-rose-700 font-bold gap-1.5"
              : "bg-amber-600 hover:bg-amber-700 font-bold gap-1.5"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirming ? "جاري الحذف..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
