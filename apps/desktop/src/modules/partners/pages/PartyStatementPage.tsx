import { useParams } from 'react-router-dom';
import { PartnerStatement } from '../components/PartnerStatement';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { customerService } from '../api/customerService';
import { supplierService } from '../api/supplierService';

interface StatementConfig {
  notFoundMessage: string;
  fetchFn: (id: string) => Promise<{ name: string } | null>;
}

const STATEMENT_CONFIGS: Record<string, StatementConfig> = {
  customer: {
    notFoundMessage: "العميل غير موجود",
    fetchFn: (id) => customerService.get(id),
  },
  supplier: {
    notFoundMessage: "المورد غير موجود",
    fetchFn: (id) => supplierService.get(id),
  },
};

interface PartyStatementPageProps {
  entityName: "customer" | "supplier";
}

export default function PartyStatementPage({ entityName }: PartyStatementPageProps) {
  const { id } = useParams<{ id: string }>();
  const cfg = STATEMENT_CONFIGS[entityName];

  const { data: entity, isLoading } = useQuery({
    queryKey: [entityName, id],
    queryFn: () => cfg.fetchFn(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!id || !entity) {
    return <div className="p-8 text-center text-red-500 font-bold">{cfg.notFoundMessage}</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PartnerStatement partnerId={id} partnerName={entity.name} partnerType={entityName} />
    </div>
  );
}
