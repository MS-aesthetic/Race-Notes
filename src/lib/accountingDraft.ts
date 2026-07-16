export const ACCOUNTING_DRAFT_KEY = 'race_notes_accounting_draft';

export interface AccountingDraft {
  name: string;
  desc: string;
  amount: string;
  type: 'income' | 'expense';
  payer: string;
  payee: string;
  weekendId: string;
  weekendName: string;
  receiptPhoto: string;
  category: string;
  entryDate: string;
}

const draftKeys = [
  'name', 'desc', 'amount', 'type', 'payer', 'payee', 'weekendId', 'weekendName',
  'receiptPhoto', 'category', 'entryDate',
] as const;

const isAccountingDraft = (value: unknown): value is AccountingDraft => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return Object.keys(draft).length === draftKeys.length
    && draftKeys.every(key => typeof draft[key] === 'string')
    && (draft.type === 'income' || draft.type === 'expense');
};

export const clearAccountingDraft = () => {
  try { localStorage.removeItem(ACCOUNTING_DRAFT_KEY); } catch { /* device storage is optional */ }
};

export const readAccountingDraft = (): AccountingDraft | null => {
  let raw: string | null;
  try { raw = localStorage.getItem(ACCOUNTING_DRAFT_KEY); } catch { return null; }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isAccountingDraft(parsed)) return parsed;
  } catch { /* remove corrupt device scratch data */ }
  clearAccountingDraft();
  return null;
};

export const writeAccountingDraft = (draft: AccountingDraft) => {
  const write = (value: AccountingDraft) => {
    try {
      localStorage.setItem(ACCOUNTING_DRAFT_KEY, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };
  if (write(draft) || !draft.receiptPhoto) return;
  write({ ...draft, receiptPhoto: '' });
};
