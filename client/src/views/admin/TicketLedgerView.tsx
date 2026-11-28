import StaffTicketsList from '../../components/StaffTicketsList';

interface TicketLedgerViewProps {
  isLightMode: boolean;
  themeCardBg: string;
  themeBorder: string;
  themeShadow: string;
  themeText: string;
  themeMuted: string;
  onBack: () => void;
}

export function TicketLedgerView({ isLightMode, themeCardBg, themeBorder, themeShadow, themeText, themeMuted, onBack }: TicketLedgerViewProps) {
  return (
    <div className="panel" style={{ background: themeCardBg, border: `1px solid ${themeBorder}`, borderRadius: 20, padding: 24, boxShadow: themeShadow, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${themeBorder}` }}>
        <div>
          <span style={{ fontSize: '.74rem', color: isLightMode ? '#006699' : '#38BDF8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Tracked guest tickets
          </span>
          <h2 style={{ fontSize: '1.6rem', margin: '4px 0 0', color: themeText, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800 }}>
            Ticket Ledger
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: `1px solid ${themeBorder}`, background: 'transparent', color: themeText, fontSize: '.84rem', fontWeight: 700, cursor: 'pointer' }}
        >
          <i className="fas fa-arrow-left" aria-hidden="true" />
          Back to Customer Services
        </button>
      </div>

      <StaffTicketsList isLightMode={isLightMode} themeBg={themeCardBg} themeText={themeText} themeMuted={themeMuted} themeBorder={themeBorder} />
    </div>
  );
}
