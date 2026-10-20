// Comprehensive FontAwesome 6 Icon Library for Rock View Beach Resort Management System

export function FaIcon({ name, size = 16, color = 'currentColor', style = {} }: any) {
  const iconClass = name.startsWith('fa') ? name : `fas fa-${name}`;
  return <i className={iconClass} style={{ fontSize: size, color, ...style }} />;
}

export function DefaultUserAvatar({ size = 44, bg = 'rgba(148, 163, 184, 0.25)', iconColor = '#FFFFFF', style = {} }: any) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
        ...style,
      }}
    >
      <i className="fas fa-user" style={{ fontSize: Math.round(size * 0.48), color: iconColor }} />
    </div>
  );
}

export function IconDashboard({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-chart-line" style={{ fontSize: size, color, ...style }} />;
}

export function IconAnalytics({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-chart-pie" style={{ fontSize: size, color, ...style }} />;
}

export function IconMessages({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-comments" style={{ fontSize: size, color, ...style }} />;
}

export function IconDining({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-utensils" style={{ fontSize: size, color, ...style }} />;
}

export function IconUsers({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-users" style={{ fontSize: size, color, ...style }} />;
}

export function IconTelemetry({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-bolt" style={{ fontSize: size, color, ...style }} />;
}

export function IconLedger({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-calendar-check" style={{ fontSize: size, color, ...style }} />;
}

export function IconCsv({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-file-csv" style={{ fontSize: size, color, ...style }} />;
}

export function IconSettings({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-gear" style={{ fontSize: size, color, ...style }} />;
}

export function IconSignOut({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-right-from-bracket" style={{ fontSize: size, color, ...style }} />;
}

export function IconSearch({ size = 16, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-magnifying-glass" style={{ fontSize: size, color, ...style }} />;
}

export function IconBell({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-bell" style={{ fontSize: size, color, ...style }} />;
}

export function IconSun({ size = 16, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-sun" style={{ fontSize: size, color, ...style }} />;
}

export function IconMoon({ size = 16, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-moon" style={{ fontSize: size, color, ...style }} />;
}

export function IconCrown({ size = 20, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-crown" style={{ fontSize: size, color, ...style }} />;
}

export function IconTrendingUp({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-arrow-trend-up" style={{ fontSize: size, color, ...style }} />;
}

export function IconCreditCard({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-credit-card" style={{ fontSize: size, color, ...style }} />;
}

export function IconWallet({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-wallet" style={{ fontSize: size, color, ...style }} />;
}

export function IconBuilding({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-hotel" style={{ fontSize: size, color, ...style }} />;
}

export function IconShield({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-shield-halved" style={{ fontSize: size, color, ...style }} />;
}

export function IconBriefcase({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-briefcase" style={{ fontSize: size, color, ...style }} />;
}

export function IconCalendar({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-calendar-days" style={{ fontSize: size, color, ...style }} />;
}

export function IconCheckCircle({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-circle-check" style={{ fontSize: size, color, ...style }} />;
}

export function IconClock({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-clock" style={{ fontSize: size, color, ...style }} />;
}

export function IconStar({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-star" style={{ fontSize: size, color, ...style }} />;
}

export function IconFilter({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-filter" style={{ fontSize: size, color, ...style }} />;
}

export function IconDownload({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-download" style={{ fontSize: size, color, ...style }} />;
}

export function IconRefresh({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-arrows-rotate" style={{ fontSize: size, color, ...style }} />;
}

export function IconLock({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-lock" style={{ fontSize: size, color, ...style }} />;
}

export function IconKey({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-key" style={{ fontSize: size, color, ...style }} />;
}

export function IconWave({ size = 18, color = 'currentColor', style = {} }: any) {
  return <i className="fas fa-water" style={{ fontSize: size, color, ...style }} />;
}
