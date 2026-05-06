import { useState } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Card } from '@shared/ui/card';
import { Search, X, FileText, Receipt, User, Package, ChevronRight, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '@shared/lib/format';

interface SearchResult {
  id: string;
  type: 'invoice' | 'customer' | 'product' | 'journal' | 'payment';
  title: string;
  subtitle: string;
  date: string;
  amount?: number;
  status?: string;
  url: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');

  const mockResults: SearchResult[] = [
    {
      id: '1',
      type: 'invoice',
      title: 'INV-2026-0235',
      subtitle: 'شركة الأفق',
      date: '2026-04-20',
      amount: 15000,
      status: 'paid',
      url: '/sales-invoices/1',
    },
    {
      id: '2',
      type: 'invoice',
      title: 'INV-2026-0234',
      subtitle: 'شركة النور',
      date: '2026-04-19',
      amount: 25000,
      status: 'pending',
      url: '/sales-invoices/2',
    },
    {
      id: '3',
      type: 'customer',
      title: 'شركة الأفق',
      subtitle: 'رياض - حي الملقا',
      date: '2026-01-15',
      url: '/customers/1',
    },
    {
      id: '4',
      type: 'product',
      title: 'لابتوب Dell XPS 15',
      subtitle: 'إلكترونيات - 50 وحدة',
      date: '2026-03-10',
      url: '/products/1',
    },
    {
      id: '5',
      type: 'journal',
      title: 'JE-2026-0234',
      subtitle: 'مبيعات نقدية',
      date: '2026-04-20',
      amount: 15000,
      url: '/journal/1',
    },
    {
      id: '6',
      type: 'payment',
      title: 'R-2026-0089',
      subtitle: 'سند قبض من شركة النور',
      date: '2026-04-19',
      amount: 10000,
      url: '/payments/1',
    },
  ];

  const filteredResults = query
    ? mockResults.filter((r) => {
        const q = (query || "").toLowerCase();
        const titleMatch = (r.title || "").toLowerCase().includes(q);
        const subtitleMatch = (r.subtitle || "").toLowerCase().includes(q);
        return titleMatch || subtitleMatch;
      })
    : mockResults.slice(0, 5);

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'invoice':
        return <Receipt className="w-4 h-4 text-blue-600" />;
      case 'customer':
        return <User className="w-4 h-4 text-green-600" />;
      case 'product':
        return <Package className="w-4 h-4 text-purple-600" />;
      case 'journal':
        return <FileText className="w-4 h-4 text-amber-600" />;
      case 'payment':
        return <Receipt className="w-4 h-4 text-teal-600" />;
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'invoice':
        return 'فاتورة';
      case 'customer':
        return 'عميل';
      case 'product':
        return 'منتج';
      case 'journal':
        return 'قيد';
      case 'payment':
        return 'سند';
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const statusMap: Record<string, { className: string; label: string }> = {
      paid: { className: 'bg-green-100 text-green-700', label: 'مدفوع' },
      pending: { className: 'bg-amber-100 text-amber-700', label: 'مسودة' },
      overdue: { className: 'bg-red-100 text-red-700', label: 'متأخر' },
    };
    const config = statusMap[status];
    if (!config) return null;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl">
        <Card className="shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="بحث في الفواتير، العملاء، المنتجات، القيود..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-0 focus-visible:ring-0 px-0 text-lg"
              autoFocus
            />
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mb-4 opacity-50" />
                <p>لا توجد نتائج</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredResults.map((result) => (
                  <button
                    key={result.id}
                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-right"
                    onClick={() => {
                      onClose();
                      // Navigate to result.url
                    }}
                  >
                    <div className="p-2 rounded-full bg-slate-100">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{result.title}</span>
                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-slate-100 rounded">
                          {getTypeLabel(result.type)}
                        </span>
                        {getStatusBadge(result.status)}
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">{result.subtitle}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(result.date)}
                        </div>
                        {result.amount && (
                          <div className="font-medium">{formatCurrency(result.amount)}</div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>استخدم الأسهم للتنقل، Enter للاختيار</div>
              <div>ESC للإغلاق</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
