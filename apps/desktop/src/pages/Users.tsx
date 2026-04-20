import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Filter, Shield, Key, MoreHorizontal, Eye, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";

export default function Users() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="إدارة المستخدمين والتحكم في صلاحيات الوصول"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "التقارير والإدارة" }, { label: "المستخدمون والصلاحيات" }]}
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" />مستخدم جديد</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>إضافة مستخدم جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الاسم الكامل</Label>
                    <Input placeholder="أحمد محمد" />
                  </div>
                  <div>
                    <Label>البريد الإلكتروني</Label>
                    <Input type="email" placeholder="ahmed@example.com" />
                  </div>
                  <div>
                    <Label>اسم المستخدم</Label>
                    <Input placeholder="ahmed.mohamed" />
                  </div>
                  <div>
                    <Label>رقم الهاتف</Label>
                    <Input placeholder="+966 5XXXXXXXXX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الدور</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الدور" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">مدير عام</SelectItem>
                        <SelectItem value="accountant">محاسب</SelectItem>
                        <SelectItem value="sales">موظف مبيعات</SelectItem>
                        <SelectItem value="inventory">موظف مخزون</SelectItem>
                        <SelectItem value="viewer">مشاهد فقط</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>الفرع</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="riyadh">فرع الرياض</SelectItem>
                        <SelectItem value="jeddah">فرع جدة</SelectItem>
                        <SelectItem value="dammam">فرع الدمام</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>كلمة المرور</Label>
                    <Input type="password" />
                  </div>
                  <div>
                    <Label>تأكيد كلمة المرور</Label>
                    <Input type="password" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
                <Button>إنشاء المستخدم</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
          <TabsTrigger value="roles">الأدوار</TabsTrigger>
          <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="بحث باسم المستخدم أو البريد..." className="pr-10" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأدوار</SelectItem>
                  <SelectItem value="admin">مدير عام</SelectItem>
                  <SelectItem value="accountant">محاسب</SelectItem>
                  <SelectItem value="sales">موظف مبيعات</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  <SelectItem value="riyadh">فرع الرياض</SelectItem>
                  <SelectItem value="jeddah">فرع جدة</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline"><Filter className="w-4 h-4 ml-2" />تصفية</Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">الفرع</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-center">تاريخ الإنشاء</TableHead>
                  <TableHead className="text-center w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">أم</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">أحمد محمد</div>
                        <div className="text-xs text-muted-foreground">ahmed@example.com</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>مدير عام</TableCell>
                  <TableCell>فرع الرياض</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />نشط
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">2026-01-15</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                        <DropdownMenuItem><Key className="w-4 h-4 ml-2" />تعيين الصلاحيات</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600"><Trash2 className="w-4 h-4 ml-2" />حذف</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-purple-600 text-white text-xs">خع</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">خالد العمري</div>
                        <div className="text-xs text-muted-foreground">khaled@example.com</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>محاسب</TableCell>
                  <TableCell>فرع جدة</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />نشط
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">2026-02-20</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                        <DropdownMenuItem><Key className="w-4 h-4 ml-2" />تعيين الصلاحيات</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600"><Trash2 className="w-4 h-4 ml-2" />حذف</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-green-600 text-white text-xs">مح</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">محمد علي</div>
                        <div className="text-xs text-muted-foreground">mohammed@example.com</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>موظف مبيعات</TableCell>
                  <TableCell>فرع الرياض</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="w-3 h-3" />معطل
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">2026-03-10</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 ml-2" />عرض</DropdownMenuItem>
                        <DropdownMenuItem><Key className="w-4 h-4 ml-2" />تعيين الصلاحيات</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600"><Trash2 className="w-4 h-4 ml-2" />حذف</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">الأدوار المخصصة</h3>
              <Button><Plus className="w-4 h-4 ml-2" />دور جديد</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="p-4 border-2 border-primary">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold">مدير عام</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">صلاحيات كاملة على جميع أجزاء النظام</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge variant="secondary" className="text-xs">المحاسبة</Badge>
                  <Badge variant="secondary" className="text-xs">المبيعات</Badge>
                  <Badge variant="secondary" className="text-xs">المخزون</Badge>
                  <Badge variant="secondary" className="text-xs">التقارير</Badge>
                  <Badge variant="secondary" className="text-xs">الإعدادات</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">3 مستخدمين</span>
                  <Button variant="ghost" size="sm">تعديل</Button>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Key className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold">محاسب</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">إدارة القيود المحاسبية والتقارير المالية</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge variant="secondary" className="text-xs">المحاسبة</Badge>
                  <Badge variant="secondary" className="text-xs">التقارير</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">5 مستخدمين</span>
                  <Button variant="ghost" size="sm">تعديل</Button>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold">موظف مبيعات</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">إنشاء وإدارة فواتير المبيعات</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge variant="secondary" className="text-xs">المبيعات</Badge>
                  <Badge variant="secondary" className="text-xs">العملاء</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">8 مستخدمين</span>
                  <Button variant="ghost" size="sm">تعديل</Button>
                </div>
              </Card>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">مصفوفة الصلاحيات</h3>
            </div>

            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-right px-4 py-3 font-medium">الصلاحية</th>
                    <th className="text-center px-4 py-3 font-medium">مدير عام</th>
                    <th className="text-center px-4 py-3 font-medium">محاسب</th>
                    <th className="text-center px-4 py-3 font-medium">موظف مبيعات</th>
                    <th className="text-center px-4 py-3 font-medium">موظف مخزون</th>
                    <th className="text-center px-4 py-3 font-medium">مشاهد</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">لوحة التحكم</td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">دليل الحسابات</td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">القيود اليومية</td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">فواتير المبيعات</td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">فواتير المشتريات</td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">المخزون والمنتجات</td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">التقارير</td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">الإعدادات</td>
                    <td className="px-4 py-3 text-center"><Switch defaultChecked /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                    <td className="px-4 py-3 text-center"><Switch /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
