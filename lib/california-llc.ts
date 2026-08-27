export type CaliforniaLlcComplianceInput = {
  businessId?: string;
  formationDate?: string | null;
  taxYearType?: "calendar" | "fiscal";
  annualTaxApplies?: boolean;
  additionalLlcFeeStatus?: "yes" | "no" | "unknown";
};

export type GeneratedObligation = {
  title: string;
  category: string;
  amountDue: number | null;
  dueDate: string | null;
  frequency: "annual";
  officialPaymentUrl: string;
  notes: string;
};

const FTB_LLC_URL = "https://www.ftb.ca.gov/file/business/types/limited-liability-company/index.html";

export function getNextCaliforniaAnnualTaxDueDate(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const candidate = new Date(year, 3, 15);
  const dueYear = referenceDate <= candidate ? year : year + 1;
  return `${dueYear}-04-15`;
}

export function generateCaliforniaLlcObligations(
  input: CaliforniaLlcComplianceInput,
  referenceDate = new Date(),
): GeneratedObligation[] {
  const obligations: GeneratedObligation[] = [];

  if (input.annualTaxApplies !== false) {
    obligations.push({
      title: "California LLC Annual Tax",
      category: "Franchise Tax",
      amountDue: 800,
      dueDate:
        input.taxYearType === "fiscal"
          ? null
          : getNextCaliforniaAnnualTaxDueDate(referenceDate),
      frequency: "annual",
      officialPaymentUrl: FTB_LLC_URL,
      notes:
        "Track the California minimum annual LLC tax separately from any additional income-based LLC fee. Confirm current applicability and due date with the California Franchise Tax Board before payment.",
    });
  }

  obligations.push({
    title: "California LLC Return / Form 568",
    category: "Annual Report",
    amountDue: null,
    dueDate: null,
    frequency: "annual",
    officialPaymentUrl: FTB_LLC_URL,
    notes:
      "Annual filing reminder. Exact due date can vary based on tax year and entity circumstances; confirm with the California Franchise Tax Board.",
  });

  if (input.additionalLlcFeeStatus !== "no") {
    obligations.push({
      title: "California Additional LLC Fee Review",
      category: "Franchise Tax",
      amountDue: null,
      dueDate: null,
      frequency: "annual",
      officialPaymentUrl: FTB_LLC_URL,
      notes:
        "Review whether the California income-based LLC fee applies. This is separate from the $800 minimum annual LLC tax.",
    });
  }

  return obligations;
}
