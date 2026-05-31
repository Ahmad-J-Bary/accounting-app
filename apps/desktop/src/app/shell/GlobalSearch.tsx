import { useState } from 'react';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Card } from '@shared/ui/card';
import { Search, X } from 'lucide-react';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');

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

          {/* Empty State */}
          <div className="max-h-96 overflow-y-auto">
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">البحث الشامل</p>
              <p className="text-sm">اكتب كلمة مفتاحية للبحث في الفواتير والعملاء والمنتجات</p>
            </div>
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
