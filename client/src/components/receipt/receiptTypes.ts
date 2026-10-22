export interface VoucherData {
  id?: string;
  reference: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  roomName: string;
  roomCategory?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests?: number | string;
  totalAmount: number;
  downpaymentAmount: number;
  balanceAmount: number;
  paymentMethod?: string;
  status?: 'confirmed' | 'pending' | 'checked_in' | 'completed' | 'cancelled';
  createdAt?: string;
  notes?: string;
  rfidReady?: boolean;
}

export function normalizeVoucherData(raw: any): VoucherData {
  const idStr = String(raw?.id || '');
  const refCode = raw?.reference || (idStr ? `RV-RES-${idStr.slice(0, 8).toUpperCase()}` : 'RV-RES-GUARANTEED');
  
  const checkInDate = raw?.check_in || raw?.checkIn || new Date().toISOString().split('T')[0];
  const checkOutDate = raw?.check_out || raw?.checkOut || new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  let nights = Number(raw?.nights || 0);
  if (!nights || nights <= 0) {
    const tIn = new Date(checkInDate).getTime();
    const tOut = new Date(checkOutDate).getTime();
    nights = Math.max(1, Math.round((tOut - tIn) / (1000 * 60 * 60 * 24)));
  }

  const total = Number(raw?.total_price || raw?.total_amount || raw?.total_php || raw?.totalAmount || 0);
  const downpayment = Number(raw?.downpayment_php || raw?.downpaymentAmount || Math.round(total * 0.3));
  const balance = Math.max(0, total - downpayment);

  const roomTitle = raw?.roomName || raw?.rooms?.name || raw?.room_name || 'Beachfront Suite';
  const guest = raw?.guest_name || raw?.guestName || raw?.profiles?.full_name || 'Valued Resident';

  return {
    id: idStr,
    reference: refCode,
    guestName: guest,
    guestEmail: raw?.guestEmail || raw?.guest_email || raw?.profiles?.email,
    guestPhone: raw?.guestPhone || raw?.guest_phone || raw?.phone || raw?.profiles?.phone,
    roomName: roomTitle,
    roomCategory: raw?.roomCategory || raw?.rooms?.category || 'Villa / Suite',
    checkIn: checkInDate,
    checkOut: checkOutDate,
    nights,
    guests: raw?.guests || 2,
    totalAmount: total,
    downpaymentAmount: downpayment,
    balanceAmount: balance,
    paymentMethod: raw?.paymentMethod || raw?.payment_method || 'GCash / Bank Transfer',
    status: raw?.status || 'confirmed',
    createdAt: raw?.created_at || raw?.createdAt || new Date().toISOString(),
    notes: raw?.notes,
    rfidReady: true,
  };
}
