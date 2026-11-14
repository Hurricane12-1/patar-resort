import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import GuestIcon, { type GuestIconName } from '../../components/guest/GuestIcon';
import { useGuestPortal } from '../../components/guest/GuestPortalContext';
import { toast } from '../../components/Toasts';
import { isValidPHMobile, to11Digits } from '../../lib/format';
import {
  detectCardBrand,
  memberSinceLabel,
  passesLuhn,
  paymentDisplay,
  stayPhase,
  type GuestPaymentMethod,
} from '../../lib/guestPortal';

const CARD_SHADOW = 'shadow-[0_1px_2px_rgba(24,34,43,0.04),0_10px_28px_rgba(24,34,43,0.06)]';

const SECTIONS: { id: string; label: string; icon: GuestIconName }[] = [
  { id: 'personal', label: 'Personal info', icon: 'user' },
  { id: 'address', label: 'Home address', icon: 'home' },
  { id: 'emergency', label: 'Emergency contact', icon: 'shield' },
  { id: 'payments', label: 'Payment methods', icon: 'wallet' },
  { id: 'preferences', label: 'Preferences', icon: 'bell' },
  { id: 'security', label: 'Sign-in & security', icon: 'lock' },
];

function formatMobile(phone: string): string {
  const digits = to11Digits(phone);
  return digits.length === 11 ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : phone;
}

export default function GuestProfile() {
  const portal = useGuestPortal();
  const { account, mode } = portal;
  const p = account.profile;

  const checks = [
    { section: 'personal', label: 'Name and mobile number', done: Boolean(p.firstName && p.lastName && p.phone) },
    { section: 'personal', label: 'Email address', done: Boolean(p.email) },
    { section: 'address', label: 'Home address', done: Boolean(p.street && p.city) },
    { section: 'emergency', label: 'Emergency contact', done: Boolean(p.emergencyName && p.emergencyPhone) },
    { section: 'payments', label: 'Payment method', done: account.payments.length > 0 },
  ];
  const completed = checks.filter((c) => c.done).length;
  const percent = Math.round((completed / checks.length) * 100);

  const activeStays = portal.bookings.filter((b) => stayPhase(b, portal.today) !== 'cancelled');
  const nights = activeStays.reduce((sum, b) => sum + b.nights, 0);
  const since = memberSinceLabel(p.memberSince);

  return (
    <div>
      <section className={`gp-animate-in relative overflow-hidden rounded-[26px] border border-[#E8E2D6] bg-white ${CARD_SHADOW}`}>
        <div className="absolute inset-y-0 right-0 hidden w-[42%] md:block" aria-hidden="true">
          <img src="/images/hero.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-white/0" />
        </div>
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 md:max-w-[64%]">
          <div className="flex items-center gap-4 sm:gap-5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#18222B] text-[22px] font-bold tracking-wide text-white ring-4 ring-[#F4EDE0] sm:h-20 sm:w-20 sm:text-[26px]">
              {portal.initials}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {mode === 'account' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6EF] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#1F7A4D]">
                    <GuestIcon name="shield" className="h-3.5 w-3.5" /> Resident account
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FBF6EC] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#8A6A33]">
                    <GuestIcon name="eye" className="h-3.5 w-3.5" /> {account.isSample ? 'Sample preview profile' : 'Preview profile · this device'}
                  </span>
                )}
              </div>
              <h1 className="gp-display mt-1.5 truncate text-[28px] font-semibold leading-tight text-[#18222B] sm:text-[36px]">{portal.displayName}</h1>
              <p className="mt-1 text-[14px] text-[#6A6A6A]">{since ? `Guest since ${since}` : 'Rock View guest'}</p>
            </div>
          </div>
          <dl className="grid max-w-md grid-cols-3 gap-3">
            {[
              { label: 'Stays', value: activeStays.length },
              { label: 'Nights', value: nights },
              { label: 'Saved payments', value: account.payments.length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-[#F7F5F0] px-3 py-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A857B]">{stat.label}</dt>
                <dd className="mt-0.5 text-[20px] font-bold text-[#18222B]">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-4">
            <nav aria-label="Profile sections" className="rounded-[22px] border border-[#E8E2D6] bg-white p-2">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#gp-${section.id}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#4A4740] transition hover:bg-[#F7F5F0] hover:text-[#18222B]"
                >
                  <GuestIcon name={section.icon} className="h-[18px] w-[18px] text-[#9E7E46]" />
                  {section.label}
                </a>
              ))}
            </nav>
            <CompletenessCard percent={percent} checks={checks} />
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <nav aria-label="Profile sections" className="gp-scroll-x -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#gp-${section.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E2DCD0] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#4A4740]"
              >
                <GuestIcon name={section.icon} className="h-4 w-4 text-[#9E7E46]" />
                {section.label}
              </a>
            ))}
          </nav>
          <div className="lg:hidden">
            <CompletenessCard percent={percent} checks={checks} />
          </div>

          <PersonalSection />
          <AddressSection />
          <EmergencySection />
          <PaymentsSection />
          <PreferencesSection />
          <SecuritySection />
        </div>
      </div>
    </div>
  );
}

function CompletenessCard({ percent, checks }: { percent: number; checks: { section: string; label: string; done: boolean }[] }) {
  const missing = checks.filter((c) => !c.done);
  return (
    <div className="rounded-[22px] border border-[#E8E2D6] bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold text-[#18222B]">Profile {percent === 100 ? 'complete' : 'progress'}</p>
        <p className="text-[14px] font-bold text-[#18222B]">{percent}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F0ECE3]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
        <div className="h-full rounded-full bg-gradient-to-r from-[#B89658] to-[#9E7E46] transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      {missing.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {missing.map((item) => (
            <li key={item.label}>
              <a href={`#gp-${item.section}`} className="flex items-center gap-2 text-[13px] font-medium text-[#4A4740] hover:text-[#18222B]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-dashed border-[#B5AC9B]" />
                Add {item.label.toLowerCase()}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-[#6A6A6A]">You're ready for a quick check-in.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function StorageBadge({ synced }: { synced?: boolean }) {
  return synced ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6EF] px-2 py-0.5 text-[11px] font-semibold text-[#1F7A4D]">
      <GuestIcon name="check" className="h-3 w-3" strokeWidth={2.4} /> Synced to your account
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#F4EDE0] px-2 py-0.5 text-[11px] font-semibold text-[#7A5F30]">
      <GuestIcon name="lock" className="h-3 w-3" /> This device only
    </span>
  );
}

function SectionCard({
  id,
  icon,
  title,
  description,
  badge,
  action,
  children,
}: {
  id: string;
  icon: GuestIconName;
  title: string;
  description: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={`gp-${id}`} aria-labelledby={`gp-${id}-title`} className={`scroll-mt-28 rounded-[22px] border border-[#E8E2D6] bg-white p-5 sm:p-7 ${CARD_SHADOW}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4EDE0] text-[#9E7E46]">
            <GuestIcon name={icon} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`gp-${id}-title`} className="text-[18px] font-semibold text-[#18222B]">
                {title}
              </h2>
              {badge}
            </div>
            <p className="mt-0.5 text-[13.5px] text-[#6A6A6A]">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function EditButton({ onClick, label = 'Edit' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E2DCD0] px-3.5 py-1.5 text-[13px] font-semibold text-[#18222B] transition hover:border-[#BDB4A3] hover:bg-[#F7F5F0]"
    >
      <GuestIcon name={label === 'Edit' ? 'edit' : 'plus'} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  autoComplete?: string;
  maxLength?: number;
  readOnly?: boolean;
  className?: string;
}

function TextField({ label, value, onChange, type = 'text', placeholder, hint, error, inputMode, autoComplete, maxLength, readOnly, className = '' }: TextFieldProps) {
  const id = useId();
  const describedBy = error || hint ? `${id}-note` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[12.5px] font-semibold text-[#3D3A34]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 h-11 w-full rounded-xl border px-3.5 text-[15px] outline-none transition placeholder:text-[#A8A398] focus:border-[#18222B] focus:ring-4 focus:ring-[#18222B]/10 ${
          error ? 'border-[#D9485F]' : 'border-[#DCD5C8]'
        } ${readOnly ? 'cursor-not-allowed bg-[#F7F5F0] text-[#6A6A6A]' : 'bg-white text-[#222222]'}`}
      />
      {(error || hint) && (
        <p id={describedBy} className={`mt-1 text-[12px] ${error ? 'text-[#B4233C]' : 'text-[#8A857B]'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options, className = '' }: { label: string; value: string; onChange: (value: string) => void; options: string[]; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[12.5px] font-semibold text-[#3D3A34]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-[#DCD5C8] bg-white px-3 text-[15px] text-[#222222] outline-none transition focus:border-[#18222B] focus:ring-4 focus:ring-[#18222B]/10"
      >
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function FormActions({ onCancel, saving, label = 'Save changes' }: { onCancel: () => void; saving: boolean; label?: string }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 border-t border-[#EFEAE0] pt-5 sm:flex-row sm:justify-end">
      <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-[#D9D1C2] px-5 py-2.5 text-[14px] font-semibold text-[#18222B] transition hover:bg-[#F7F5F0]">
        Cancel
      </button>
      <button type="submit" disabled={saving} className="rounded-xl bg-[#18222B] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#273644] disabled:opacity-60">
        {saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

function InfoItem({ label, value, className = '' }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A857B]">{label}</dt>
      <dd className="mt-1 break-words text-[15px] font-medium text-[#18222B]">{value || <span className="font-normal text-[#A8A398]">Not added</span>}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function PersonalSection() {
  const portal = useGuestPortal();
  const p = portal.account.profile;
  const isAccount = portal.mode === 'account';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const start = () => {
    setForm({ firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone });
    setErrors({});
    setEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const phone = to11Digits(form.phone);
    const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'Enter your first name';
    if (!form.lastName.trim()) next.lastName = 'Enter your last name';
    if (!isAccount && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (!isValidPHMobile(phone)) next.phone = 'Use an 11-digit mobile number starting with 09';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await portal.saveProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone,
        ...(isAccount ? {} : { email: form.email.trim() }),
      });
      setEditing(false);
      toast('Personal details saved');
    } catch (err: any) {
      setErrors({ form: err?.message || 'We could not save your details. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      id="personal"
      icon="user"
      title="Personal info"
      description="The name and contact we use for your bookings and arrival SMS."
      badge={<StorageBadge synced={isAccount} />}
      action={!editing && <EditButton onClick={start} />}
    >
      {editing ? (
        <form onSubmit={save} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="First name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} autoComplete="given-name" error={errors.firstName} />
            <TextField label="Last name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} autoComplete="family-name" error={errors.lastName} />
            <TextField
              label="Email"
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              autoComplete="email"
              readOnly={isAccount}
              hint={isAccount ? 'Your sign-in email. Contact the front desk to change it.' : undefined}
              error={errors.email}
            />
            <TextField
              label="Mobile number"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              autoComplete="tel"
              placeholder="09XX XXX XXXX"
              hint="Philippine mobile. Your keypad PIN is sent here."
              error={errors.phone}
            />
          </div>
          {errors.form && <p className="mt-4 rounded-xl bg-[#FDF3F4] px-3 py-2 text-[13px] text-[#8C1D30]">{errors.form}</p>}
          <FormActions onCancel={() => setEditing(false)} saving={saving} />
        </form>
      ) : (
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <InfoItem label="Full name" value={`${p.firstName} ${p.lastName}`.trim()} />
          <InfoItem label="Email" value={p.email} />
          <InfoItem label="Mobile number" value={p.phone ? formatMobile(p.phone) : ''} />
          <InfoItem label="Guest since" value={memberSinceLabel(p.memberSince)} />
        </dl>
      )}
    </SectionCard>
  );
}

function AddressSection() {
  const portal = useGuestPortal();
  const p = portal.account.profile;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ street: '', city: '', province: '', zip: '', country: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasAddress = Boolean(p.street || p.city);

  const start = () => {
    setForm({ street: p.street, city: p.city, province: p.province, zip: p.zip, country: p.country || 'Philippines' });
    setErrors({});
    setEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.street.trim()) next.street = 'Enter your street address';
    if (!form.city.trim()) next.city = 'Enter your city or municipality';
    if (form.zip && !/^\d{4}$/.test(form.zip.trim()) && form.country.trim().toLowerCase() === 'philippines') next.zip = 'Philippine ZIP codes have 4 digits';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await portal.saveProfile({
        street: form.street.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        zip: form.zip.trim(),
        country: form.country.trim() || 'Philippines',
      });
      setEditing(false);
      toast('Home address saved on this device');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      id="address"
      icon="home"
      title="Home address"
      description="Speeds up registration at the front desk."
      badge={<StorageBadge />}
      action={!editing && <EditButton onClick={start} label={hasAddress ? 'Edit' : 'Add'} />}
    >
      {editing ? (
        <form onSubmit={save} noValidate>
          <div className="grid gap-4 sm:grid-cols-6">
            <TextField className="sm:col-span-6" label="Street address" value={form.street} onChange={(v) => setForm({ ...form, street: v })} autoComplete="street-address" placeholder="House no., street, barangay" error={errors.street} />
            <TextField className="sm:col-span-3" label="City / municipality" value={form.city} onChange={(v) => setForm({ ...form, city: v })} autoComplete="address-level2" error={errors.city} />
            <TextField className="sm:col-span-3" label="Province" value={form.province} onChange={(v) => setForm({ ...form, province: v })} autoComplete="address-level1" />
            <TextField className="sm:col-span-2" label="ZIP code" value={form.zip} onChange={(v) => setForm({ ...form, zip: v })} autoComplete="postal-code" inputMode="numeric" maxLength={10} error={errors.zip} />
            <TextField className="sm:col-span-4" label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} autoComplete="country-name" />
          </div>
          <FormActions onCancel={() => setEditing(false)} saving={saving} />
        </form>
      ) : hasAddress ? (
        <address className="not-italic text-[15px] leading-relaxed text-[#18222B]">
          {p.street && <span className="block font-medium">{p.street}</span>}
          <span className="block text-[#4A4740]">{[p.city, p.province, p.zip].filter(Boolean).join(', ')}</span>
          {p.country && <span className="block text-[#6A6A6A]">{p.country}</span>}
        </address>
      ) : (
        <p className="text-[14px] text-[#6A6A6A]">No address yet. Add one to skip the paperwork at check-in.</p>
      )}
    </SectionCard>
  );
}

const RELATIONS = ['Spouse', 'Partner', 'Parent', 'Child', 'Sibling', 'Relative', 'Friend', 'Other'];

function EmergencySection() {
  const portal = useGuestPortal();
  const p = portal.account.profile;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ emergencyName: '', emergencyRelation: '', emergencyPhone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasContact = Boolean(p.emergencyName || p.emergencyPhone);

  const start = () => {
    setForm({ emergencyName: p.emergencyName, emergencyRelation: p.emergencyRelation, emergencyPhone: p.emergencyPhone });
    setErrors({});
    setEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const phone = to11Digits(form.emergencyPhone);
    const next: Record<string, string> = {};
    if (!form.emergencyName.trim()) next.emergencyName = "Enter your contact's name";
    if (!isValidPHMobile(phone)) next.emergencyPhone = 'Use an 11-digit mobile number starting with 09';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await portal.saveProfile({ emergencyName: form.emergencyName.trim(), emergencyRelation: form.emergencyRelation, emergencyPhone: phone });
      setEditing(false);
      toast('Emergency contact saved on this device');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      id="emergency"
      icon="shield"
      title="Emergency contact"
      description="Someone we can reach if anything happens during your stay."
      badge={<StorageBadge />}
      action={!editing && <EditButton onClick={start} label={hasContact ? 'Edit' : 'Add'} />}
    >
      {editing ? (
        <form onSubmit={save} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField className="sm:col-span-2" label="Full name" value={form.emergencyName} onChange={(v) => setForm({ ...form, emergencyName: v })} autoComplete="off" error={errors.emergencyName} />
            <SelectField label="Relationship" value={form.emergencyRelation} onChange={(v) => setForm({ ...form, emergencyRelation: v })} options={RELATIONS} />
            <TextField label="Mobile number" type="tel" inputMode="tel" value={form.emergencyPhone} onChange={(v) => setForm({ ...form, emergencyPhone: v })} placeholder="09XX XXX XXXX" error={errors.emergencyPhone} />
          </div>
          <FormActions onCancel={() => setEditing(false)} saving={saving} />
        </form>
      ) : hasContact ? (
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
          <InfoItem label="Name" value={p.emergencyName} />
          <InfoItem label="Relationship" value={p.emergencyRelation} />
          <InfoItem label="Mobile" value={p.emergencyPhone ? formatMobile(p.emergencyPhone) : ''} />
        </dl>
      ) : (
        <p className="text-[14px] text-[#6A6A6A]">No emergency contact yet.</p>
      )}
    </SectionCard>
  );
}

function PaymentMark({ method }: { method: Pick<GuestPaymentMethod, 'type' | 'brand'> }) {
  const base = 'flex h-10 w-14 shrink-0 items-center justify-center rounded-lg';
  if (method.type === 'gcash') return <span className={`${base} bg-[#0A5FE8] text-[12px] font-extrabold tracking-tight text-white`}>GCash</span>;
  if (method.type === 'maya') return <span className={`${base} bg-[#111111] text-[13px] font-extrabold tracking-tight text-[#3EE08F]`}>maya</span>;
  if (method.brand === 'Visa') return <span className={`${base} bg-[#1A1F71] text-[13px] font-extrabold italic tracking-wide text-white`}>VISA</span>;
  if (method.brand === 'Mastercard') {
    return (
      <span className={`${base} bg-[#1F2937]`}>
        <span className="h-5 w-5 rounded-full bg-[#EB001B]" />
        <span className="-ml-2 h-5 w-5 rounded-full bg-[#F79E1B]/90" />
      </span>
    );
  }
  return (
    <span className={`${base} bg-[#334155] text-white`}>
      <GuestIcon name="card" className="h-5 w-5" />
    </span>
  );
}

function PaymentsSection() {
  const portal = useGuestPortal();
  const { payments } = portal.account;
  const [adding, setAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <SectionCard
      id="payments"
      icon="wallet"
      title="Payment methods"
      description="Choose how you'd like to settle at the resort. Nothing is charged online."
      badge={<StorageBadge />}
      action={<EditButton onClick={() => setAdding(true)} label="Add" />}
    >
      {payments.length === 0 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full flex-col items-center rounded-2xl border border-dashed border-[#D9D1C2] px-6 py-8 text-center transition hover:bg-[#FBFAF7]"
        >
          <GuestIcon name="card" className="h-7 w-7 text-[#9E7E46]" />
          <span className="mt-2 text-[15px] font-semibold text-[#18222B]">Add GCash, Maya, or a card</span>
          <span className="mt-1 text-[13px] text-[#6A6A6A]">We'll pre-select it next time you book.</span>
        </button>
      ) : (
        <ul className="space-y-3">
          {payments.map((method) => (
            <li key={method.id} className={`rounded-2xl border p-4 transition ${method.isDefault ? 'border-[#18222B] bg-[#FBFAF7]' : 'border-[#E8E2D6]'}`}>
              <div className="flex items-center gap-4">
                <PaymentMark method={method} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-semibold text-[#18222B]">{paymentDisplay(method)}</p>
                    {method.isDefault && <span className="rounded-full bg-[#18222B] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white">Default</span>}
                  </div>
                  <p className="truncate text-[13px] text-[#6A6A6A]">
                    {method.holder}
                    {method.expiry ? ` · Expires ${method.expiry}` : method.type !== 'card' ? ' · Mobile wallet' : ''}
                  </p>
                </div>
                {confirmingId !== method.id && (
                  <div className="hidden items-center gap-1 sm:flex">
                    {!method.isDefault && (
                      <button type="button" onClick={() => { portal.setDefaultPaymentMethod(method.id); toast(`${paymentDisplay(method)} is now your default`); }} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#18222B] hover:bg-[#F1EDE4]">
                        Make default
                      </button>
                    )}
                    <button type="button" onClick={() => setConfirmingId(method.id)} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[#B4233C] hover:bg-[#FDF3F4]">
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {confirmingId === method.id ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FDF3F4] px-3 py-2.5">
                  <p className="text-[13px] font-medium text-[#8C1D30]">Remove {paymentDisplay(method)}?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmingId(null)} className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-[#18222B]">
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        portal.removePaymentMethod(method.id);
                        setConfirmingId(null);
                        toast('Payment method removed');
                      }}
                      className="rounded-lg bg-[#B4233C] px-3 py-1.5 text-[13px] font-semibold text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2 sm:hidden">
                  {!method.isDefault && (
                    <button type="button" onClick={() => { portal.setDefaultPaymentMethod(method.id); toast(`${paymentDisplay(method)} is now your default`); }} className="flex-1 rounded-lg border border-[#E2DCD0] px-3 py-2 text-[13px] font-semibold text-[#18222B]">
                      Make default
                    </button>
                  )}
                  <button type="button" onClick={() => setConfirmingId(method.id)} className="flex-1 rounded-lg border border-[#F0C4CB] px-3 py-2 text-[13px] font-semibold text-[#B4233C]">
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 flex gap-2 text-[12.5px] leading-relaxed text-[#6A6A6A]">
        <GuestIcon name="lock" className="mt-0.5 h-4 w-4 text-[#9E7E46]" />
        Only the brand, the last 4 digits, and the expiry are kept, on this device. We never ask for your CVV, and nothing is charged until you settle at the resort.
      </p>
      {adding && <AddPaymentDialog onClose={() => setAdding(false)} />}
    </SectionCard>
  );
}

function AddPaymentDialog({ onClose }: { onClose: () => void }) {
  const portal = useGuestPortal();
  const [type, setType] = useState<GuestPaymentMethod['type']>('gcash');
  const [holder, setHolder] = useState(portal.displayName === 'Guest' ? '' : portal.displayName);
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [makeDefault, setMakeDefault] = useState(portal.account.payments.length === 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstFieldRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const digits = number.replace(/\D/g, '');
  const brand = detectCardBrand(digits);
  const walletName = type === 'gcash' ? 'GCash' : 'Maya';

  const switchType = (next: GuestPaymentMethod['type']) => {
    setType(next);
    setNumber('');
    setExpiry('');
    setErrors({});
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!holder.trim()) next.holder = type === 'card' ? 'Enter the name on the card' : 'Enter the account name';
    if (type === 'card') {
      if (digits.length > 19 || !passesLuhn(digits)) next.number = 'Check the card number';
      const match = expiry.match(/^(\d{2})\/(\d{2})$/);
      const month = match ? Number(match[1]) : 0;
      if (!match || month < 1 || month > 12) next.expiry = 'Use MM/YY';
      else if (new Date(2000 + Number(match[2]), month, 0, 23, 59) < new Date()) next.expiry = 'This card has expired';
    } else if (!isValidPHMobile(to11Digits(number))) {
      next.number = `Use the 11-digit mobile number linked to ${walletName}`;
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const last4 = type === 'card' ? digits.slice(-4) : to11Digits(number).slice(-4);
    const label = type === 'card' ? brand : walletName;
    portal.addPaymentMethod({ type, label, brand: type === 'card' ? brand : undefined, holder, last4, expiry: type === 'card' ? expiry : undefined, makeDefault });
    toast(`${label} •••• ${last4} saved on this device`);
    onClose();
  };

  const typeOptions: { id: GuestPaymentMethod['type']; label: string; icon: GuestIconName }[] = [
    { id: 'gcash', label: 'GCash', icon: 'wallet' },
    { id: 'maya', label: 'Maya', icon: 'wallet' },
    { id: 'card', label: 'Card', icon: 'card' },
  ];

  return createPortal(
    <div className="guest-portal fixed inset-0 z-[90] flex items-end justify-center bg-transparent md:items-center md:p-6">
      <button type="button" aria-label="Close" onClick={onClose} className="gp-backdrop absolute inset-0 cursor-default bg-[#0F1720]/45 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" aria-labelledby="add-payment-title" className="gp-dialog relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl md:max-w-[460px] md:rounded-[28px] md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-payment-title" className="text-[20px] font-semibold text-[#18222B]">
              Add a payment method
            </h2>
            <p className="mt-1 text-[13.5px] text-[#6A6A6A]">Saved on this device to speed up your next booking.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E8E2D6] text-[#4A4740] hover:bg-[#F7F5F0]">
            <GuestIcon name="close" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="mt-5">
          <div role="radiogroup" aria-label="Payment type" className="grid grid-cols-3 gap-2">
            {typeOptions.map((option, index) => {
              const active = type === option.id;
              return (
                <button
                  key={option.id}
                  ref={index === 0 ? firstFieldRef : undefined}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => switchType(option.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-[13.5px] font-semibold transition ${
                    active ? 'border-[#18222B] bg-[#FBFAF7] text-[#18222B] shadow-[inset_0_0_0_1px_#18222B]' : 'border-[#E2DCD0] text-[#4A4740] hover:border-[#BDB4A3]'
                  }`}
                >
                  <GuestIcon name={option.icon} className="h-5 w-5" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-4">
            <TextField
              label={type === 'card' ? 'Name on card' : 'Account name'}
              value={holder}
              onChange={setHolder}
              autoComplete={type === 'card' ? 'cc-name' : 'name'}
              error={errors.holder}
            />
            {type === 'card' ? (
              <>
                <TextField
                  label={`Card number${digits.length >= 2 && brand !== 'Card' ? ` · ${brand}` : ''}`}
                  value={number}
                  onChange={(v) => setNumber(v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim())}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 5678 9012 3456"
                  hint="Used to read the brand and last 4 digits. The full number is not stored."
                  error={errors.number}
                />
                <TextField
                  label="Expiry"
                  value={expiry}
                  onChange={(v) => {
                    const d = v.replace(/\D/g, '').slice(0, 4);
                    setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                  }}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  className="max-w-[160px]"
                  error={errors.expiry}
                />
              </>
            ) : (
              <TextField
                label={`${walletName} mobile number`}
                type="tel"
                value={number}
                onChange={setNumber}
                inputMode="tel"
                autoComplete="tel"
                placeholder="09XX XXX XXXX"
                hint="Only the last 4 digits are kept."
                error={errors.number}
              />
            )}
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-3 text-[14px] text-[#2F2C27]">
            <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-4 w-4 accent-[#18222B]" />
            Use as my default payment method
          </label>

          <button type="submit" className="mt-6 w-full rounded-xl bg-[#18222B] py-3 text-[15px] font-semibold text-white transition hover:bg-[#273644]">
            Save payment method
          </button>
          <p className="mt-3 text-center text-[12px] text-[#8A857B]">We never ask for your CVV or PIN.</p>
        </form>
      </div>
    </div>,
    document.body
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-[14.5px] font-semibold text-[#18222B]">
          {label}
        </p>
        <p className="text-[13px] text-[#6A6A6A]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${checked ? 'bg-[#18222B]' : 'bg-[#D6CFC2]'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function PreferencesSection() {
  const portal = useGuestPortal();
  const p = portal.account.profile;
  const [requests, setRequests] = useState(p.specialRequests);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRequests(p.specialRequests);
  }, [p.specialRequests]);

  const toggle = async (key: 'notifySms' | 'notifyEmail' | 'notifyOffers', value: boolean) => {
    await portal.saveProfile({ [key]: value });
    toast('Preferences saved');
  };

  const saveRequests = async () => {
    setSaving(true);
    try {
      await portal.saveProfile({ specialRequests: requests.trim() });
      toast('Special requests saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard id="preferences" icon="bell" title="Preferences" description="How we keep in touch, and what helps us prepare your room." badge={<StorageBadge />}>
      <div className="divide-y divide-[#EFEAE0]">
        <Toggle checked={p.notifySms} onChange={(v) => toggle('notifySms', v)} label="Booking updates by SMS" description="Confirmations, reminders, and your keypad PIN." />
        <Toggle checked={p.notifyEmail} onChange={(v) => toggle('notifyEmail', v)} label="Booking updates by email" description="Your digital voucher and receipts." />
        <Toggle checked={p.notifyOffers} onChange={(v) => toggle('notifyOffers', v)} label="Offers and seasonal rates" description="Occasional news from Rock View." />
      </div>
      <div className="mt-5">
        <label htmlFor="gp-special-requests" className="block text-[12.5px] font-semibold text-[#3D3A34]">
          Special requests
        </label>
        <textarea
          id="gp-special-requests"
          value={requests}
          onChange={(e) => setRequests(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder="Extra pillows, early check-in, celebrating a birthday…"
          className="mt-1.5 w-full resize-y rounded-xl border border-[#DCD5C8] bg-white px-3.5 py-3 text-[15px] text-[#222222] outline-none transition placeholder:text-[#A8A398] focus:border-[#18222B] focus:ring-4 focus:ring-[#18222B]/10"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[#8A857B]">Added to your next booking so the front desk can prepare.</p>
          <button
            type="button"
            onClick={saveRequests}
            disabled={saving || requests.trim() === p.specialRequests.trim()}
            className="rounded-xl bg-[#18222B] px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-[#273644] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save requests'}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function SecuritySection() {
  const portal = useGuestPortal();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!portal.changePassword) {
    return (
      <SectionCard id="security" icon="lock" title="Sign-in & security" description="Manage how you sign in to your resident account.">
        <div className="flex flex-col gap-4 rounded-2xl bg-[#F7F5F0] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed text-[#4A4740]">
            You're viewing a preview without signing in. Sign in to manage your password and see reservations linked to your account.
          </p>
          <Link to="/client/login" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#18222B] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#273644]">
            <GuestIcon name="login" className="h-4 w-4" />
            Sign in
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[#6A6A6A]">Preview bookings and details live only in this browser.</p>
          <button
            type="button"
            onClick={() => {
              portal.resetPreview();
              toast('Preview reset to sample data');
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E2DCD0] px-3.5 py-1.5 text-[13px] font-semibold text-[#18222B] transition hover:bg-[#F7F5F0]"
          >
            <GuestIcon name="refresh" className="h-3.5 w-3.5" />
            Reset preview data
          </button>
        </div>
      </SectionCard>
    );
  }

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) next.password = 'Use at least 8 characters with letters and numbers';
    if (confirm !== password) next.confirm = "Passwords don't match";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await portal.changePassword?.(password);
      setPassword('');
      setConfirm('');
      toast('Password updated');
    } catch (err: any) {
      setErrors({ form: err?.message || 'We could not update your password. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard id="security" icon="lock" title="Sign-in & security" description={`Signed in as ${portal.account.profile.email}.`} badge={<StorageBadge synced />}>
      <form onSubmit={save} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" error={errors.password} />
          <TextField label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={errors.confirm} />
        </div>
        {errors.form && <p className="mt-4 rounded-xl bg-[#FDF3F4] px-3 py-2 text-[13px] text-[#8C1D30]">{errors.form}</p>}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {portal.signOut && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await portal.signOut?.();
                  toast('You have been signed out');
                } catch {
                  toast('Could not sign out. Please try again.', true);
                }
              }}
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#B4233C] hover:underline"
            >
              <GuestIcon name="logout" className="h-4 w-4" />
              Sign out of this device
            </button>
          )}
          <button type="submit" disabled={saving || !password} className="rounded-xl bg-[#18222B] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#273644] disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
