import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AccountDto } from "@erp/shared-types";
import { accountingService } from "@/services/accountingService";
import type {
  AccountType,
  AccountCategory,
  SaveAccountCommand,
} from "@/services/accountingService";

const ACCOUNT_TYPES = [
  "Assets",
  "Liabilities",
  "Equity",
  "Revenue",
  "Expenses",
] as const;
const ACCOUNT_CATEGORIES = ["Summary", "Detail"] as const;

const accountSchema = z.object({
  code: z.string().min(1, "رقم الحساب مطلوب"),
  name_ar: z.string().min(2, "اسم الحساب مطلوب"),
  name_en: z.string().optional(),
  account_type: z.enum(ACCOUNT_TYPES),
  parent_id: z.string().nullable(),
  category: z.enum(ACCOUNT_CATEGORIES),
  opening_balance: z.string().default("0"),
  notes: z.string().optional(),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initialData?: AccountDto | null;
  parentAccount?: AccountDto | null;
  allAccounts: AccountDto[];
}

const isAccountType = (value: string): value is AccountType =>
  (ACCOUNT_TYPES as readonly string[]).includes(value);

const isAccountCategory = (value: string): value is AccountCategory =>
  (ACCOUNT_CATEGORIES as readonly string[]).includes(value);

const toAccountType = (
  value: string,
  fallback: AccountType = "Assets",
): AccountType => (isAccountType(value) ? value : fallback);

const toAccountCategory = (
  value: string,
  fallback: AccountCategory = "Detail",
): AccountCategory => (isAccountCategory(value) ? value : fallback);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return "حدث خطأ أثناء حفظ الحساب";
};

export function AccountDialog({
  open,
  onOpenChange,
  onSaved,
  initialData,
  parentAccount,
  allAccounts,
}: AccountDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: "",
      name_ar: "",
      name_en: "",
      account_type: "Assets",
      parent_id: null,
      category: "Detail",
      opening_balance: "0",
      notes: "",
      is_default: false,
      is_active: true,
    },
  });

  useEffect(() => {
    if (!open) return;

    setError(null);

    if (initialData) {
      form.reset({
        code: initialData.code,
        name_ar: initialData.name_ar,
        name_en: initialData.name_en || "",
        account_type: toAccountType(initialData.account_type),
        parent_id: initialData.parent_id,
        category: toAccountCategory(initialData.category),
        opening_balance: initialData.opening_balance || "0",
        notes: initialData.notes || "",
        is_default: initialData.is_default || false,
        is_active: initialData.is_active ?? true,
      });
      return;
    }

    if (parentAccount) {
      form.reset({
        code: "",
        name_ar: "",
        name_en: "",
        account_type: toAccountType(parentAccount.account_type),
        parent_id: parentAccount.id,
        category: "Detail",
        opening_balance: "0",
        notes: "",
        is_default: false,
        is_active: true,
      });
      return;
    }

    form.reset({
      code: "",
      name_ar: "",
      name_en: "",
      account_type: "Assets",
      parent_id: null,
      category: "Summary",
      opening_balance: "0",
      notes: "",
      is_default: false,
      is_active: true,
    });
  }, [open, initialData, parentAccount, form]);

  const onSubmit = async (values: AccountFormValues) => {
    setLoading(true);
    setError(null);

    try {
      let level = 1;
      if (values.parent_id) {
        const parent = allAccounts.find((a) => a.id === values.parent_id);
        if (parent) level = (parent.level || 1) + 1;
      }

      const payload: SaveAccountCommand = {
        code: values.code.trim(),
        name_ar: values.name_ar.trim(),
        name_en: (values.name_en || "").trim(),
        account_type: values.account_type,
        parent_id: values.parent_id === "null" ? null : values.parent_id,
        category: values.category,
        level,
        opening_balance: values.opening_balance || "0",
        notes: values.notes?.trim() ? values.notes.trim() : null,
        is_default: values.is_default,
        is_active: values.is_active,
      };

      if (initialData) {
        await accountingService.updateAccount(initialData.id, payload);
      } else {
        await accountingService.createAccount(payload);
      }

      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      console.error(e);
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const summaryAccounts = allAccounts.filter(
    (a) => toAccountCategory(a.category) === "Summary",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "تعديل الحساب" : "إضافة حساب جديد"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "قم بتعديل بيانات الحساب المحاسبي"
              : "أدخل تفاصيل الحساب الجديد لتتم إضافته إلى دليل الحسابات."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم الحساب</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: 1101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تصنيف الحساب</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر التصنيف" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Detail">
                          حساب فرعي (تفصيلي)
                        </SelectItem>
                        <SelectItem value="Summary">
                          حساب رئيسي (تجميعي)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name_ar"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم الحساب (عربي)</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: الأصول المتداولة" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name_en"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم الحساب (إنجليزي) - اختياري</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: Current Assets" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>طبيعة الحساب</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!parentAccount || !!initialData}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر طبيعة الحساب" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Assets">أصول (Assets)</SelectItem>
                        <SelectItem value="Liabilities">
                          خصوم (Liabilities)
                        </SelectItem>
                        <SelectItem value="Equity">
                          حقوق ملكية (Equity)
                        </SelectItem>
                        <SelectItem value="Revenue">
                          إيرادات (Revenue)
                        </SelectItem>
                        <SelectItem value="Expenses">
                          مصروفات (Expenses)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الحساب الأب</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "null"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="بدون حساب أب" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        <SelectItem value="null">
                          -- مستوى أول (بدون أب) --
                        </SelectItem>
                        {summaryAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} - {a.name_ar}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {form.watch("category") === "Detail" && (
              <FormField
                control={form.control}
                name="opening_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الرصيد الافتتاحي</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>
                      اتركه 0 إذا لم يكن هناك رصيد افتتاحي
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>حالة الحساب</FormLabel>
                      <FormDescription className="text-[10px]">
                        تفعيل أو تعطيل الحساب
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        className="w-4 h-4 cursor-pointer"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>حساب افتراضي</FormLabel>
                      <FormDescription className="text-[10px]">
                        حساب نظام أساسي
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        className="w-4 h-4 cursor-pointer"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات</FormLabel>
                  <FormControl>
                    <Textarea placeholder="أية ملاحظات إضافية..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "جاري الحفظ..." : "حفظ الحساب"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
