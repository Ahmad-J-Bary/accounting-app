import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@shared/ui/alert-dialog";
import { AlertTriangle, FolderTree, Trash2 } from "lucide-react";
import { useLocalization } from "@app/providers/LocalizationProvider";

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
  const { t } = useLocalization();
  if (!kind) return null;

  let title: string;
  let description: React.ReactNode;
  let confirmLabel: string;
  let tone: "amber" | "rose" = "rose";

  if (kind.type === "sub_empty") {
    title = t("categories.delete.subTitle", { namespace: "inventory", fallback: "حذف التصنيف الفرعي" });
    description = (
      <span>
        {t("categories.delete.confirmSub", { namespace: "inventory", fallback: "هل تريد بالتأكيد حذف التصنيف الفرعي" })}{" "}
        <span className="font-bold text-slate-900">«{categoryName}»</span>؟
        {t("categories.delete.noMaterials", { namespace: "inventory", fallback: "لا توجد مواد مرتبطة به." })}
      </span>
    );
    confirmLabel = t("actions.delete", { namespace: "common", fallback: "حذف" });
    tone = "amber";
  } else if (kind.type === "sub_with_materials") {
    title = t("categories.delete.hasMaterialsTitle", { namespace: "inventory", fallback: "تنبيه: التصنيف يحتوي على مواد" });
    description = (
      <div className="space-y-2 text-right">
        <p>
          {t("categories.delete.subCategory", { namespace: "inventory", fallback: "التصنيف الفرعي" })} <span className="font-bold text-slate-900">«{categoryName}»</span>{" "}
          {t("categories.delete.contains", { namespace: "inventory", fallback: "يحتوي على" })} <span className="font-black text-rose-600">{kind.materialCount}</span> {t("categories.delete.materialNoun", { namespace: "inventory", fallback: "مادة." })}
        </p>
        <p className="text-slate-700">
          {kind.isGeneralSub
            ? <>{t("categories.delete.reassignToDefault", { namespace: "inventory", vars: { name: "غير مصنف" }, fallback: "سيتم تعديل تصنيفات هذه المواد إلى التصنيف الافتراضي «غير مصنف»." })}</>
            : <>{t("categories.delete.reassignToGeneralSub", { namespace: "inventory", vars: { name: kind.targetName }, fallback: `سيتم تعديل تصنيفات هذه المواد إلى التصنيف الفرعي العام «${kind.targetName}» ضمن نفس التصنيف الرئيسي.` })}</>
          }
        </p>
        <p className="text-xs text-slate-500">{t("categories.delete.continue", { namespace: "inventory", fallback: "هل تريد المتابعة؟" })}</p>
      </div>
    );
    confirmLabel = t("categories.delete.confirmReassign", { namespace: "inventory", fallback: "نعم، احذف وأعد توزيع المواد" });
    tone = "rose";
  } else if (kind.type === "root_no_subs") {
    title = t("categories.delete.rootTitle", { namespace: "inventory", fallback: "حذف التصنيف الرئيسي" });
    description = (
      <span>
        {t("categories.delete.confirmRoot", { namespace: "inventory", fallback: "هل تريد بالتأكيد حذف التصنيف الرئيسي" })}{" "}
        <span className="font-bold text-slate-900">«{categoryName}»</span>؟
      </span>
    );
    confirmLabel = t("actions.delete", { namespace: "common", fallback: "حذف" });
    tone = "amber";
  } else {
    title = t("categories.delete.includesSubsTitle", { namespace: "inventory", fallback: "تنبيه: الحذف سيشمل التصنيفات الفرعية" });
    description = (
      <div className="space-y-2 text-right">
        <p>
          {t("categories.delete.rootCategory", { namespace: "inventory", fallback: "التصنيف الرئيسي" })} <span className="font-bold text-slate-900">«{categoryName}»</span>{" "}
          {t("categories.delete.contains", { namespace: "inventory", fallback: "يحتوي على" })} <span className="font-black text-rose-600">{kind.subCount}</span> {t("categories.delete.subCategoryNoun", { namespace: "inventory", fallback: "تصنيف فرعي." })}
        </p>
        <p className="text-slate-700">
          {t("categories.delete.deleteRootAndSubs", { namespace: "inventory", fallback: "سيتم حذف التصنيف الرئيسي وجميع التصنيفات الفرعية الخاصة به." })}
        </p>
        {kind.subMaterialCount > 0 && (
          <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs">
            {t("categories.delete.subsContain", { namespace: "inventory", fallback: "تنبيه: تحتوي التصنيفات الفرعية على" })}{" "}
            <span className="font-black">{kind.subMaterialCount}</span>{" "}
            {t("categories.delete.materialsReassignedTo", { namespace: "inventory", vars: { name: kind.targetName }, fallback: `مادة سيتم تعديل تصنيفها إلى «${kind.targetName}».` })}
          </p>
        )}
        <p className="text-xs text-slate-500">{t("categories.delete.continue", { namespace: "inventory", fallback: "هل تريد المتابعة؟" })}</p>
      </div>
    );
    confirmLabel = t("categories.delete.confirmAll", { namespace: "inventory", fallback: "نعم، احذف الكل" });
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
            {t("actions.cancel", { namespace: "common", fallback: "إلغاء" })}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={confirming}
            className={tone === "rose"
              ? "bg-rose-600 hover:bg-rose-700 font-bold gap-1.5"
              : "bg-amber-600 hover:bg-amber-700 font-bold gap-1.5"}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirming ? t("states.deleting", { namespace: "common", fallback: "جاري الحذف..." }) : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
