import type { AppLanguage, TranslationTree } from "@shared/types/i18n";

export const setup: Record<AppLanguage, TranslationTree> = {
  ar: {
    language: {
      title: "اختر اللغة",
      subtitle: "Choose Language",
      arabic: "العربية",
      english: "English",
      continue: "التالي",
      changeLaterHint: "يمكنك تغيير هذا لاحقاً من الإعدادات",
    },
    welcome: {
      title: "مرحباً بك في نظام المحاسبة",
      descCurrencies: "لنبدأ بإعداد المنشأة والعملات. أدخل اسم المنشأة ثم اختر العملة الأساسية.",
      descCompanyOnly: "أدخل اسم المنشأة لإكمال الإعداد.",
      companyName: "اسم المنشأة",
      companyNamePlaceholder: "أدخل اسم المنشأة",
      companyType: "نوع الشركة",
      existingCompany: "شركة قائمة",
      existingCompanyDesc: "لديك بيانات مالية سابقة وتريد نقل الوضع الحالي للشركة إلى التطبيق.",
      newCompany: "شركة جديدة",
      newCompanyDesc: "ستبدأ المحاسبة من بداية نشاط الشركة داخل التطبيق.",
      baseCurrencyInfo: "العملة الأساسية",
      baseCurrencyDesc: "هي العملة التي تُسجل بها جميع المعاملات المالية في النظام. يمكنك تحويلها إلى أي عملة أخرى لاحقاً.",
      startSetup: "بدء الإعداد",
      save: "حفظ",
      saving: "جاري الحفظ...",
    },
    currency: {
      title: "اختيار العملات",
      desc: "اختر العملة الأساسية (إلزامي) وعملة ثانوية (اختياري)",
      searchPlaceholder: "بحث عن عملة...",
      base: "أساسية",
      secondary: "ثانوية",
      confirm: "تأكيد الإعداد",
      selectBase: "الرجاء اختيار العملة الأساسية",
      baseLabel: "العملة الأساسية",
      secondaryLabel: "الثانوية",
      baseSelected: "العملة الأساسية:",
      secondarySelected: "الثانوية:",
    },
    done: {
      title: "تم الإعداد بنجاح",
      loading: "جاري تحميل التطبيق...",
    },
    updateRequired: {
      title: "قاعدة البيانات من إصدار أحدث",
      description:
        "نسخة قاعدة البيانات هذه أُعدّت بإصدار أحدث من التطبيق، ولا يمكن فتحها أو ترقيتها من هذه النسخة حفاظًا على سلامة بياناتك وقيودك المحاسبية.",
      dbVersion: "إصدار القاعدة:",
      appVersion: "الإصدار المتاح لديك:",
      instruction: "يُرجى تحديث التطبيق إلى أحدث إصدار ثم إعادة المحاولة.",
    },
  },
  en: {
    language: {
      title: "Choose Language",
      subtitle: "اختر اللغة",
      arabic: "العربية",
      english: "English",
      continue: "Next",
      changeLaterHint: "You can change this later in Settings",
    },
    welcome: {
      title: "Welcome to the Accounting System",
      descCurrencies:
        "Let's set up your company and currencies. Enter your company name, then choose the base currency.",
      descCompanyOnly: "Enter your company name to complete the setup.",
      companyName: "Company Name",
      companyNamePlaceholder: "Enter company name",
      companyType: "Company Type",
      existingCompany: "Existing Company",
      existingCompanyDesc:
        "You have previous financial data and want to migrate your current company state to the app.",
      newCompany: "New Company",
      newCompanyDesc:
        "You will start accounting from the beginning of the company's activity in the app.",
      baseCurrencyInfo: "Base Currency",
      baseCurrencyDesc:
        "This is the currency used for all financial transactions in the system. You can change it to any other currency later.",
      startSetup: "Start Setup",
      save: "Save",
      saving: "Saving...",
    },
    currency: {
      title: "Select Currencies",
      desc: "Choose the base currency (required) and a secondary currency (optional)",
      searchPlaceholder: "Search for a currency...",
      base: "Base",
      secondary: "Secondary",
      confirm: "Confirm Setup",
      selectBase: "Please select the base currency",
      baseLabel: "Base Currency",
      secondaryLabel: "Secondary",
      baseSelected: "Base:",
      secondarySelected: "Secondary:",
    },
    done: {
      title: "Setup Completed Successfully",
      loading: "Loading application...",
    },
    updateRequired: {
      title: "Database is from a Newer Version",
      description:
        "This database was prepared with a newer version of the application and cannot be opened or upgraded from this version to protect your data integrity and accounting constraints.",
      dbVersion: "Database version:",
      appVersion: "Your app version:",
      instruction: "Please update the application to the latest version and try again.",
    },
  },
};
