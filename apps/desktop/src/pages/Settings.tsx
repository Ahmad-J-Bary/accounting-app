import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Building2, Warehouse, FileText, Settings as SettingsIcon, Globe, Palette, Bell, Shield, Printer } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <>
      <PageHeader
        title="الإعدادات"
        subtitle="إعدادات النظام والتكوينات العامة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "التقارير والإدارة" }, { label: "الإعدادات" }]}
      />

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
          <TabsTrigger value="company">الشركة</TabsTrigger>
          <TabsTrigger value="branches">الفروع</TabsTrigger>
          <TabsTrigger value="warehouses">المستودعات</TabsTrigger>
          <TabsTrigger value="taxes">الضرائب</TabsTrigger>
          <TabsTrigger value="invoicing">الفواتير</TabsTrigger>
          <TabsTrigger value="general">عام</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">إعدادات الشركة</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label>اسم الشركة</Label>
                  <Input defaultValue="شركة النجاح التجارية" />
                </div>
                <div>
                  <Label>الاسم بالإنجليزية</Label>
                  <Input defaultValue="Al-Najah Trading Company" />
                </div>
                <div>
                  <Label>رقم السجل التجاري</Label>
                  <Input defaultValue="1010234567" />
                </div>
                <div>
                  <Label>الرقم الضريبي</Label>
                  <Input defaultValue="300123456700003" />
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>العنوان</Label>
                  <Textarea rows={3} defaultValue="شارع الملك فهد، حي الملقا، الرياض، المملكة العربية السعودية" />
                </div>
                <div>
                  <Label>رقم الهاتف</Label>
                  <Input defaultValue="+966 11 234 5678" />
                </div>
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <Input defaultValue="info@alnajah.com" />
                </div>
                <div>
                  <Label>الموقع الإلكتروني</Label>
                  <Input defaultValue="https://alnajah.com" />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline">إلغاء</Button>
              <Button>حفظ التغييرات</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="branches">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">إعدادات الفروع</h2>
              </div>
              <Button>إضافة فرع جديد</Button>
            </div>

            <div className="space-y-4">
              <div className="border border-border rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium">فرع الرياض - الرئيسي</h3>
                    <p className="text-sm text-muted-foreground">الفرع المركزي للشركة</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">العنوان:</span>
                    <p>شارع الملك فهد، الرياض</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الهاتف:</span>
                    <p>+966 11 234 5678</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">المدير:</span>
                    <p>أحمد محمد</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الحالة:</span>
                    <span className="text-green-600">نشط</span>
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium">فرع جدة</h3>
                    <p className="text-sm text-muted-foreground">فرع منطقة مكة المكرمة</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">العنوان:</span>
                    <p>شارع التحلية، جدة</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الهاتف:</span>
                    <p>+966 12 345 6789</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">المدير:</span>
                    <p>خالد العمري</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الحالة:</span>
                    <span className="text-green-600">نشط</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="warehouses">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">إعدادات المستودعات</h2>
              </div>
              <Button>إضافة مستودع جديد</Button>
            </div>

            <div className="space-y-4">
              <div className="border border-border rounded-md p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium">مستودع الرياض الرئيسي</h3>
                    <p className="text-sm text-muted-foreground">المستودع المركزي</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">تعديل</Button>
                    <Switch defaultChecked />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">العنوان:</span>
                    <p>حي الصناعية، الرياض</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">المسؤول:</span>
                    <p>محمد علي</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">السعة:</span>
                    <p>10,000 وحدة</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الحالة:</span>
                    <span className="text-green-600">نشط</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="taxes">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">إعدادات الضرائب</h2>
            </div>

            <div className="space-y-6">
              <div>
                <Label>نسبة ضريبة القيمة المضافة (%)</Label>
                <Input type="number" defaultValue="15" className="w-32" />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">إعدادات الفواتير الضريبية</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">إظهار ضريبة القيمة المضافة في الفواتير</div>
                    <p className="text-sm text-muted-foreground">تضمين تفاصيل الضريبة في الفواتير المطبوعة</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">استبعاد الضريبة للعملاء المعفين</div>
                    <p className="text-sm text-muted-foreground">للعملاء الحاصلين على إعفاء ضريبي</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button>حفظ التغييرات</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="invoicing">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">إعدادات الفواتير</h2>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>بادئة رقم فاتورة المبيعات</Label>
                  <Input defaultValue="INV-" />
                </div>
                <div>
                  <Label>بادئة رقم فاتورة المشتريات</Label>
                  <Input defaultValue="PO-" />
                </div>
                <div>
                  <Label>بادئة رقم سند القبض</Label>
                  <Input defaultValue="R-" />
                </div>
                <div>
                  <Label>بادئة رقم سند الصرف</Label>
                  <Input defaultValue="P-" />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium">خيارات الطباعة</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">طباعة الشعار</div>
                    <p className="text-sm text-muted-foreground">إظهار شعار الشركة في الفواتير</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">طباعة الباركود</div>
                    <p className="text-sm text-muted-foreground">إضافة باركود للمنتجات في الفاتورة</p>
                  </div>
                  <Switch />
                </div>
              </div>

              <div>
                <Label>قالب الفاتورة الافتراضي</Label>
                <Select defaultValue="standard">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">القالب القياسي</SelectItem>
                    <SelectItem value="detailed">القالب المفصل</SelectItem>
                    <SelectItem value="simple">القالب البسيط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button>حفظ التغييرات</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <SettingsIcon className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">الإعدادات العامة</h2>
            </div>

            <Tabs defaultValue="language">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="language">اللغة</TabsTrigger>
                <TabsTrigger value="theme">المظهر</TabsTrigger>
                <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
                <TabsTrigger value="security">الأمان</TabsTrigger>
              </TabsList>

              <TabsContent value="language" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    <h3 className="font-medium">إعدادات اللغة</h3>
                  </div>
                  <div>
                    <Label>اللغة الافتراضية</Label>
                    <Select defaultValue="ar">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ar">العربية</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>تنسيق التاريخ</Label>
                    <Select defaultValue="gregorian">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gregorian">التقويم الميلادي</SelectItem>
                        <SelectItem value="hijri">التقويم الهجري</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>تنسيق العملة</Label>
                    <Select defaultValue="sar">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sar">ريال سعودي (SAR)</SelectItem>
                        <SelectItem value="usd">دولار أمريكي (USD)</SelectItem>
                        <SelectItem value="eur">يورو (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="theme" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    <h3 className="font-medium">إعدادات المظهر</h3>
                  </div>
                  <div>
                    <Label>السمة</Label>
                    <Select defaultValue="light">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">فاتح</SelectItem>
                        <SelectItem value="dark">داكن</SelectItem>
                        <SelectItem value="system">تلقائي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>اللون الأساسي</Label>
                    <Select defaultValue="blue">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="blue">أزرق</SelectItem>
                        <SelectItem value="green">أخضر</SelectItem>
                        <SelectItem value="purple">بنفسجي</SelectItem>
                        <SelectItem value="orange">برتقالي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notifications" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    <h3 className="font-medium">إعدادات الإشعارات</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">إشعارات المخزون المنخفض</div>
                        <p className="text-sm text-muted-foreground">تنبيه عند وصول المخزون للحد الأدنى</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">إشعارات الفواتير المتأخرة</div>
                        <p className="text-sm text-muted-foreground">تنبيه عند تأخر سداد الفواتير</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">إشعارات البريد الإلكتروني</div>
                        <p className="text-sm text-muted-foreground">إرسال ملخص يومي عبر البريد</p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    <h3 className="font-medium">إعدادات الأمان</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">المصادقة الثنائية</div>
                        <p className="text-sm text-muted-foreground">تطلب رمز تحقق إضافي</p>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">تسجيل الخروج التلقائي</div>
                        <p className="text-sm text-muted-foreground">بعد 30 دقيقة من عدم النشاط</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div>
                      <Label>تاريخ انتهاء كلمة المرور (أيام)</Label>
                      <Input type="number" defaultValue="90" className="w-32" />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 flex justify-end">
              <Button>حفظ التغييرات</Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
