import type { AppLanguage, TranslationTree } from "@shared/types/i18n";

export const validation: Record<AppLanguage, TranslationTree> = {
  ar: {
    mapping: {
      noCategory: "لم يتم العثور على تصنيف الأصل المناسب",
      noAssetAccount: "لم يتم العثور على حساب الأصل المناسب",
      noPaymentAccount: "لم يتم العثور على حساب الدفع المناسب",
      noDepExpenseAccount: "لم يتم العثور على حساب مصروف الإهلاك",
      noAccDepAccount: "لم يتم العثور على حساب مجمع الإهلاك",
      incompleteAccounts: "بيانات الحسابات المحاسبية غير مكتملة",
    },
  },
  en: {
    mapping: {
      noCategory: "No suitable asset category was found",
      noAssetAccount: "No suitable asset account was found",
      noPaymentAccount: "No suitable payment account was found",
      noDepExpenseAccount: "No depreciation expense account was found",
      noAccDepAccount: "No accumulated depreciation account was found",
      incompleteAccounts: "Accounting accounts data is incomplete",
    },
  },
};