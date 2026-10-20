import React from 'react';

export interface JournalFormState {
  mode: 'pair' | 'single';
  debit_account_code: string;
  credit_account_code: string;
  amount_php: number;
  particulars: string;
  reference_id: string;
  category: string;
}

interface JournalVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLightMode: boolean;
  themeBorder: string;
  themeText: string;
  themeMuted: string;
  chartOfAccounts: any[];
  journalForm: JournalFormState;
  setJournalForm: React.Dispatch<React.SetStateAction<JournalFormState>>;
  postingJournal: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export default function JournalVoucherModal({
  isOpen,
  onClose,
  isLightMode,
  themeBorder,
  themeText,
  themeMuted,
  chartOfAccounts,
  journalForm,
  setJournalForm,
  postingJournal,
  onSubmit,
}: JournalVoucherModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 12px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: isLightMode ? '#FFFFFF' : '#0F172A',
          borderRadius: 22,
          border: `1px solid ${themeBorder}`,
          boxShadow: '0 25px 60px -12px rgba(0,0,0,0.6)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${themeBorder}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '.72rem',
                color: '#0EA5E9',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
              }}
            >
              DOUBLE-ENTRY BOOKKEEPING
            </span>
            <h3
              className="serif"
              style={{
                fontSize: '1.25rem',
                margin: '4px 0 0',
                color: themeText,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <i className="fas fa-plus" /> Record Journal Voucher
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: themeMuted,
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Mode Toggle */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                background: isLightMode ? '#F1F5F9' : 'rgba(30,41,59,0.8)',
                padding: 4,
                borderRadius: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setJournalForm({ ...journalForm, mode: 'pair' })}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background:
                    journalForm.mode === 'pair' ? (isLightMode ? '#FFFFFF' : '#0F172A') : 'transparent',
                  color: journalForm.mode === 'pair' ? (isLightMode ? '#0284C7' : '#38BDF8') : themeMuted,
                  fontSize: '.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-scale-balanced" style={{ marginRight: 6 }} />
                Double-Entry Pair (Debit & Credit)
              </button>
              <button
                type="button"
                onClick={() => setJournalForm({ ...journalForm, mode: 'single' })}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background:
                    journalForm.mode === 'single' ? (isLightMode ? '#FFFFFF' : '#0F172A') : 'transparent',
                  color: journalForm.mode === 'single' ? (isLightMode ? '#0284C7' : '#38BDF8') : themeMuted,
                  fontSize: '.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-bolt" style={{ marginRight: 6 }} />
                Single Adjustment Entry
              </button>
            </div>

            {journalForm.mode === 'pair' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div>
                  <label
                    style={{
                      fontSize: '.78rem',
                      color: isLightMode ? '#047857' : '#34D399',
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Debit Account (Assets / Expenses) *
                  </label>
                  <select
                    value={journalForm.debit_account_code}
                    onChange={(e) => setJournalForm({ ...journalForm, debit_account_code: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#FFF' : '#1E293B',
                      color: themeText,
                      fontSize: '.84rem',
                    }}
                  >
                    {(chartOfAccounts.length > 0
                      ? chartOfAccounts
                      : [
                          { code: '1010', name: 'Cash on Hand & Digital Wallets' },
                          { code: '1020', name: 'Accounts Receivable - Guest Folios' },
                          { code: '5010', name: 'Kitchen & Food Supplies Expenses' },
                          { code: '5020', name: 'Housekeeping Linens & Guest Amenities' },
                          { code: '5030', name: 'Resort Utilities & Generator Fuel' },
                          { code: '5040', name: 'Repairs & Property Maintenance' },
                          { code: '2020', name: 'Guest Refunds Payable' },
                        ]
                    ).map((acc: any) => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '.78rem',
                      color: isLightMode ? '#1D4ED8' : '#60A5FA',
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Credit Account (Revenue / Liabilities) *
                  </label>
                  <select
                    value={journalForm.credit_account_code}
                    onChange={(e) => setJournalForm({ ...journalForm, credit_account_code: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#FFF' : '#1E293B',
                      color: themeText,
                      fontSize: '.84rem',
                    }}
                  >
                    {(chartOfAccounts.length > 0
                      ? chartOfAccounts
                      : [
                          { code: '4010', name: 'Room Accommodations Revenue' },
                          { code: '4020', name: 'Kitchen & Dining Revenue' },
                          { code: '4030', name: 'Island Tours & Water Activities' },
                          { code: '2010', name: 'Guest Reservation Deposits & Advances' },
                          { code: '1010', name: 'Cash on Hand & Digital Wallets' },
                        ]
                    ).map((acc: any) => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div>
                  <label
                    style={{
                      fontSize: '.78rem',
                      color: themeMuted,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Account *
                  </label>
                  <select
                    value={journalForm.debit_account_code}
                    onChange={(e) => setJournalForm({ ...journalForm, debit_account_code: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#FFF' : '#1E293B',
                      color: themeText,
                      fontSize: '.84rem',
                    }}
                  >
                    {(chartOfAccounts.length > 0
                      ? chartOfAccounts
                      : [
                          { code: '1010', name: 'Cash on Hand & Digital Wallets' },
                          { code: '4010', name: 'Room Accommodations Revenue' },
                          { code: '5010', name: 'Kitchen & Food Supplies' },
                        ]
                    ).map((acc: any) => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      fontSize: '.78rem',
                      color: themeMuted,
                      fontWeight: 700,
                      display: 'block',
                      marginBottom: 4,
                    }}
                  >
                    Entry Type *
                  </label>
                  <select
                    value={journalForm.category}
                    onChange={(e) => setJournalForm({ ...journalForm, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: `1px solid ${themeBorder}`,
                      background: isLightMode ? '#FFF' : '#1E293B',
                      color: themeText,
                      fontSize: '.84rem',
                    }}
                  >
                    <option value="ADJUSTMENT">Adjustment (DEBIT)</option>
                    <option value="REVENUE">Revenue (CREDIT)</option>
                    <option value="PAYMENT">Payment (DEBIT)</option>
                    <option value="EXPENSE">Expense (DEBIT)</option>
                    <option value="REFUND">Refund (DEBIT)</option>
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <label
                  style={{
                    fontSize: '.78rem',
                    color: themeMuted,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Amount in Philippine Peso (PHP) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={journalForm.amount_php || ''}
                  onChange={(e) =>
                    setJournalForm({ ...journalForm, amount_php: parseFloat(e.target.value) || 0 })
                  }
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                    fontSize: '.84rem',
                    fontWeight: 700,
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: '.78rem',
                    color: themeMuted,
                    fontWeight: 700,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Category
                </label>
                <select
                  value={journalForm.category}
                  onChange={(e) => setJournalForm({ ...journalForm, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${themeBorder}`,
                    background: isLightMode ? '#FFF' : '#1E293B',
                    color: themeText,
                    fontSize: '.84rem',
                  }}
                >
                  <option value="REVENUE">Revenue</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="REFUND">Refund</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: '.78rem',
                  color: themeMuted,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Particulars / Description *
              </label>
              <input
                required
                placeholder="e.g. Cash settlement for walk-in guest at Unit GEL Premier Suite"
                value={journalForm.particulars}
                onChange={(e) => setJournalForm({ ...journalForm, particulars: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFF' : '#1E293B',
                  color: themeText,
                  fontSize: '.84rem',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: '.78rem',
                  color: themeMuted,
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Reference / Voucher ID (Optional)
              </label>
              <input
                placeholder="e.g. OR-2026-9014 or RES-1010"
                value={journalForm.reference_id}
                onChange={(e) => setJournalForm({ ...journalForm, reference_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${themeBorder}`,
                  background: isLightMode ? '#FFF' : '#1E293B',
                  color: themeText,
                  fontSize: '.84rem',
                }}
              />
            </div>

            {/* Submit Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                style={{ color: themeText }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-sky btn-sm"
                disabled={postingJournal}
                style={{ fontWeight: 700 }}
              >
                {postingJournal ? 'Posting Voucher…' : 'Save & Post Journal Entry ✦'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
