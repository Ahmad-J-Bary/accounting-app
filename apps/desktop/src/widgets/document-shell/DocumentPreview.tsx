import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Printer, Download, Mail, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DocumentItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface DocumentPreviewProps {
  type: 'sales' | 'purchase' | 'receipt' | 'payment';
  documentNumber: string;
  date: string;
  partyName: string;
  partyType: 'customer' | 'supplier';
  status: string;
  items: DocumentItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  total: number;
  notes?: string;
  onPrint?: () => void;
  onDownload?: () => void;
  onEmail?: () => void;
}

export function DocumentPreview({
  type,
  documentNumber,
  date,
  partyName,
  partyType,
  status,
  items,
  subtotal,
  taxAmount,
  discountAmount,
  total,
  notes,
  onPrint,
  onDownload,
  onEmail,
}: DocumentPreviewProps) {
  const getTypeLabel = () => {
    switch (type) {
      case 'sales':
        return 'فاتورة مبيعات';
      case 'purchase':
        return 'فاتورة مشتريات';
      case 'receipt':
        return 'سند قبض';
      case 'payment':
        return 'سند صرف';
    }
  };

  const getPartyLabel = () => {
    return partyType === 'customer' ? 'العميل' : 'المورد';
  };

  return (
    <Card className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">شركة بردى للصناعة</h1>
          <p className="text-sm text-muted-foreground">المحاسبة والمخزون</p>
        </div>
        <div className="text-left">
          <div className="text-xl font-bold mb-1">{getTypeLabel()}</div>
          <div className="text-sm text-muted-foreground">{documentNumber}</div>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Document Info */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-sm text-muted-foreground mb-1">{getPartyLabel()}</div>
          <div className="font-semibold">{partyName}</div>
        </div>
        <div className="text-left">
          <div className="text-sm text-muted-foreground mb-1">التاريخ</div>
          <div className="font-semibold">{date}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          status === 'paid' 
            ? 'bg-primary text-primary-foreground' 
            : status === 'pending' 
              ? 'bg-secondary text-secondary-foreground' 
              : 'bg-destructive text-destructive-foreground'
        }`}>
          {status === 'paid' ? 'مدفوع' : status === 'pending' ? 'مسودة' : 'متأخر'}
        </span>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="text-center">الكمية</TableHead>
              <TableHead className="text-left">سعر الوحدة</TableHead>
              <TableHead className="text-left">الإجمالي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-center">{item.quantity}</TableCell>
                <TableCell className="text-left">{item.unitPrice.toFixed(2)}</TableCell>
                <TableCell className="text-left">{item.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">المجموع الفرعي</span>
          <span className="font-semibold">{subtotal.toFixed(2)}</span>
        </div>
        {discountAmount && discountAmount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">الخصم</span>
            <span className="font-semibold text-red-600">-{discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">الضريبة</span>
          <span className="font-semibold">{taxAmount.toFixed(2)}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between text-lg font-bold">
          <span>الإجمالي</span>
          <span>{total.toFixed(2)}</span>
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div className="mb-6 p-4 bg-slate-50 rounded-md">
          <div className="text-sm text-muted-foreground mb-1">ملاحظات</div>
          <div className="text-sm">{notes}</div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground mb-6">
        <p>شكراً لتعاملكم معنا</p>
        <p>شركة بردى للصناعة - دمشق، الجمهورية العربية السورية</p>
        <p>هاتف: +963 11 234 5678 | بريد: info@barada.com</p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onPrint}>
          <Printer className="w-4 h-4 ml-2" />
          طباعة
        </Button>
        <Button variant="outline" onClick={onDownload}>
          <Download className="w-4 h-4 ml-2" />
          تحميل PDF
        </Button>
        <Button variant="outline" onClick={onEmail}>
          <Mail className="w-4 h-4 ml-2" />
          إرسال بالبريد
        </Button>
        <Button variant="outline">
          <Share2 className="w-4 h-4 ml-2" />
          مشاركة
        </Button>
      </div>
    </Card>
  );
}
