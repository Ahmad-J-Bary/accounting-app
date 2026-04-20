import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, History, User, Calendar, FileText, Settings, Shield, Trash2, ShoppingCart, Package, Wallet } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";

export default function AuditLog() {
  return (
    <>
      <PageHeader
        title="سجل النشاط"
        subtitle="تتبع جميع الإجراءات والتغييرات في النظام"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "التقارير والإدارة" }, { label: "سجل النشاط" }]}
      />

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في سجل النشاط..." className="pr-10" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الإجراءات</SelectItem>
              <SelectItem value="create">إنشاء</SelectItem>
              <SelectItem value="update">تحديث</SelectItem>
              <SelectItem value="delete">حذف</SelectItem>
              <SelectItem value="login">تسجيل دخول</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المستخدمين</SelectItem>
              <SelectItem value="ahmed">أحمد محمد</SelectItem>
              <SelectItem value="khaled">خالد العمري</SelectItem>
              <SelectItem value="mohammed">محمد علي</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="w-[160px]" />
          <Input type="date" className="w-[160px]" />
          <Button variant="outline"><Filter className="w-4 h-4 ml-2" />تصفية</Button>
          <Button variant="outline">تصدير</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">التاريخ والوقت</TableHead>
              <TableHead className="text-right">المستخدم</TableHead>
              <TableHead className="text-right">الإجراء</TableHead>
              <TableHead className="text-right">الوحدة</TableHead>
              <TableHead className="text-right">التفاصيل</TableHead>
              <TableHead className="text-right">عنوان IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{formatDateTime('2026-04-20 10:30:00')}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>أحمد محمد</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="default" className="bg-green-600">إنشاء</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>فواتير المبيعات</span>
                </div>
              </TableCell>
              <TableCell>إنشاء فاتورة مبيعات INV-2026-0235 للعميل شركة الأفق</TableCell>
              <TableCell>192.168.1.100</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{formatDateTime('2026-04-20 09:45:00')}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>خالد العمري</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">تحديث</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>القيود اليومية</span>
                </div>
              </TableCell>
              <TableCell>تحديث قيد JE-2026-0234 - إضافة سطر جديد</TableCell>
              <TableCell>192.168.1.105</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{formatDateTime('2026-04-20 08:15:00')}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>محمد علي</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="destructive">حذف</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span>المنتجات</span>
                </div>
              </TableCell>
              <TableCell>حذف منتج PRD-001234 (منتهي الصلاحية)</TableCell>
              <TableCell>192.168.1.110</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{formatDateTime('2026-04-19 17:30:00')}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>أحمد محمد</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="default" className="bg-blue-600">تسجيل دخول</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span>المصادقة</span>
                </div>
              </TableCell>
              <TableCell>تسجيل دخول ناجح من فرع الرياض</TableCell>
              <TableCell>192.168.1.100</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{formatDateTime('2026-04-19 16:20:00')}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>خالد العمري</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="default" className="bg-green-600">إنشاء</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                  <span>فواتير المشتريات</span>
                </div>
              </TableCell>
              <TableCell>إنشاء فاتورة مشتريات PO-2026-0156 من المورد مؤسسة التميز</TableCell>
              <TableCell>192.168.1.105</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{formatDateTime('2026-04-19 14:45:00')}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>محمد علي</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">تحديث</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <span>المقبوضات والمدفوعات</span>
                </div>
              </TableCell>
              <TableCell>تأكيد سند قبض R-2026-0089 من العميل شركة النور</TableCell>
              <TableCell>192.168.1.110</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{formatDateTime('2026-04-19 11:00:00')}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>أحمد محمد</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">تحديث</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  <span>الإعدادات</span>
                </div>
              </TableCell>
              <TableCell>تحديث إعدادات الشركة - تغيير عنوان الشركة</TableCell>
              <TableCell>192.168.1.100</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{formatDateTime('2026-04-18 18:30:00')}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>خالد العمري</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="default" className="bg-green-600">إنشاء</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span>المنتجات</span>
                </div>
              </TableCell>
              <TableCell>إنشاء منتج جديد PRD-001235 - جهاز لابتوب Dell</TableCell>
              <TableCell>192.168.1.105</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <div>عرض 1 إلى 8 من أصل 1,234 سجل</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>السابق</Button>
            <Button variant="outline" size="sm">التالي</Button>
          </div>
        </div>
      </Card>
    </>
  );
}
