import { useParams } from 'react-router-dom';
import { PartnerStatement } from '../components/PartnerStatement';
import { useState, useEffect } from 'react';
import { customerService } from '../api/customerService';
import type { CustomerDto } from '@erp/shared-types';
import { Loader2 } from 'lucide-react';

export default function CustomerStatementPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      customerService.listCustomers().then(list => {
        const found = list.find(c => c.id === id);
        setCustomer(found || null);
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

  if (!id || !customer) {
    return <div className="p-8 text-center text-red-500 font-bold">العميل غير موجود</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PartnerStatement partnerId={id} partnerName={customer.name} partnerType="customer" />
    </div>
  );
}
