import type { PartnerDto, CreatePaymentRequest } from "@erp/shared-types";
import type { Currency } from "@modules/core/api/currencyService";
import type { PartnerRequest } from "@modules/partners/api/partnerService";
import { PartnerForm } from '@modules/partners/components/PartnerForm';
import { PaymentForm, PAYMENT_CONFIGS } from '@modules/partners/components/PaymentForm';
import { PartnerDetailView } from '@modules/partners/components/PartnerDetailView';

type PartnerWithRatios = PartnerDto & {
  calculatedRatio: number;
  calculatedCapitalRatio: number;
  displayAmountBase: number;
};

interface PartnersSidePanelProps {
  activePanel: "edit" | "drawings" | "view" | null;
  selectedPartner: PartnerWithRatios | null;
  editPartner: PartnerDto | null;
  baseCurrency: Currency | null;
  currencies: Currency[];
  formatAmount: (val: number, opts: { currencyCode: string }) => string;
  saving: boolean;
  drawingsSaving: boolean;
  onEdit: (partner: PartnerDto) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onSaveForm: (payload: PartnerRequest) => Promise<void>;
  onSaveDrawings: (payload: CreatePaymentRequest) => Promise<void>;
}

export function PartnersSidePanel({
  activePanel,
  selectedPartner,
  editPartner,
  baseCurrency,
  currencies,
  formatAmount,
  saving,
  drawingsSaving,
  onEdit,
  onDelete,
  onClose,
  onSaveForm,
  onSaveDrawings,
}: PartnersSidePanelProps) {
  if (activePanel === "edit") {
    return (
      <PartnerForm
        open={true}
        onClose={onClose}
        partner={editPartner}
        onSave={onSaveForm}
        saving={saving}
      />
    );
  }

  if (activePanel === "drawings" && selectedPartner) {
    return (
      <PaymentForm
        config={PAYMENT_CONFIGS.partner(selectedPartner)}
        onSave={onSaveDrawings}
        onClose={onClose}
        saving={drawingsSaving}
      />
    );
  }

  if (activePanel === "view" && selectedPartner) {
    return (
      <PartnerDetailView
        key={selectedPartner.id}
        partner={selectedPartner}
        baseCurrency={baseCurrency}
        onEdit={() => onEdit(selectedPartner)}
        onDelete={onDelete}
        onClose={onClose}
      />
    );
  }

  return null;
}