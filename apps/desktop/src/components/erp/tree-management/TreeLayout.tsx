import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeLayoutProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onRefresh: () => void;
  loading: boolean;
  
  treeContent: ReactNode;
  sidebarContent: ReactNode;
  
  tableHeader?: ReactNode;
}

export function TreeLayout({
  searchQuery,
  onSearchChange,
  onExpandAll,
  onCollapseAll,
  onRefresh,
  loading,
  treeContent,
  sidebarContent,
  tableHeader
}: TreeLayoutProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card className="xl:col-span-2 flex flex-col h-[calc(100vh-220px)] overflow-hidden border-border/60 shadow-sm">
        {/* Toolbar */}
        <div className="p-4 border-b border-border/40 bg-slate-50/50 flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الرقم..."
              className="pr-9 bg-white"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onExpandAll} className="text-xs h-8">
              توسيع الكل
            </Button>
            <Button variant="ghost" size="sm" onClick={onCollapseAll} className="text-xs h-8">
              طي الكل
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("w-4 h-4 text-slate-600", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Table Header */}
        {tableHeader && (
          <div className="flex text-xs font-semibold text-slate-500 bg-slate-100 py-2 px-3 border-b border-border/40">
            {tableHeader}
          </div>
        )}

        {/* Tree Content */}
        <div className="flex-1 overflow-y-auto p-1">
          {treeContent}
        </div>
      </Card>

      {/* Sidebar Content */}
      <div className="xl:col-span-1">
        {sidebarContent}
      </div>
    </div>
  );
}
