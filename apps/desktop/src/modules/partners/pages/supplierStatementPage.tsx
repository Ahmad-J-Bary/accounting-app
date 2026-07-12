import { useParams } from 'react-router-dom';
import { PartnerStatement } from '../components/PartnerStatement';
import { useState, useEffect } from 'react';
import { supplierService } from '../api/supplierService';
import type { SupplierDto } from '@erp/shared-types';
import { Loader2 } from 'lucide-react';

export default function SupplierStatementPage() {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<SupplierDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      supplierService.listSuppliers().then(list => {
        const found = list.find(s => s.id === id);
        setSupplier(found || null);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!id || !supplier) {
    return <div className="p-8 text-center text-red-500 font-bold">المورد غير موجود</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PartnerStatement partnerId={id} partnerName={supplier.name} partnerType="supplier" />
    </div>
  );
}