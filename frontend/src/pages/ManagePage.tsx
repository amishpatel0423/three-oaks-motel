import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft, Phone, Edit2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://three-oaks-motel-api.onrender.com';
const CATEGORIES = ['One King', 'Two Queen', '2 Double Bed'];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

interface BookingInfo {
  reference_number: string;
  guest_name: string;
  category: string;
  check_in_date: string;
  check_out_date: string;
  total_price: number | null;
  status: string;
  can_cancel: boolean;
}

export default function ManagePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading]   = useState(true);
  const [booking, setBooking]   = useState<BookingInfo | null>(null);
  const [error, setError]       = useState('');

  // Cancel flow
  const [cancelling, setCancelling]   = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelled, setCancelled]     = useState(false);

  // Change request flow
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeCategory, setChangeCategory] = useState('');
  const [changeCheckIn, setChangeCheckIn]   = useState('');
  const [changeCheckOut, setChangeCheckOut] = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [changeSubmitted, setChangeSubmitted] = useState(false);
  const [changeError, setChangeError]       = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!token) { setError('No token provided.'); setLoading(false); return; }
    fetch(`${API}/api/bookings/manage/${token}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Invalid link.'); }
        else {
          setBooking(data);
          setChangeCategory(data.category);
          setChangeCheckIn(data.check_in_date);
          setChangeCheckOut(data.check_out_date);
        }
      })
      .catch(() => setError('Unable to load your reservation. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`${API}/api/bookings/manage/${token}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Cancellation failed.'); }
      else { setCancelled(true); }
    } catch {
      setError('Unable to process cancellation. Please call (321) 267-6272.');
    } finally {
      setCancelling(false);
    }
  };

  const handleChangeSubmit = async () => {
    setChangeError('');
    if (!changeCheckIn || !changeCheckOut || changeCheckIn >= changeCheckOut) {
      setChangeError('Please enter valid check-in and check-out dates.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/bookings/manage/${token}/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: changeCategory,
          check_in_date: changeCheckIn,
          check_out_date: changeCheckOut,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setChangeError(data.error || 'Failed to submit request.'); }
      else { setChangeSubmitted(true); setShowChangeForm(false); }
    } catch {
      setChangeError('Unable to submit. Please try again or call (321) 267-6272.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-light/30 flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">Loading your reservation…</div>
      </div>
    );
  }

  // Cancelled
  if (cancelled) {
    return (
      <div className="min-h-screen bg-sky-light/30 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">Reservation Cancelled</h2>
          <p className="text-slate-500 mb-2">Your reservation has been cancelled successfully.</p>
          <p className="text-slate-500 text-sm mb-8">A confirmation email has been sent to you.</p>
          <Link to="/" className="btn-primary w-full flex items-center justify-center gap-2">
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Error
  if (error || !booking) {
    return (
      <div className="min-h-screen bg-sky-light/30 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={36} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">Link Unavailable</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <a href="tel:3212676272" className="btn-primary w-full flex items-center justify-center gap-2 mb-3">
            <Phone size={16} /> Call (321) 267-6272
          </a>
          <Link to="/" className="block text-sm text-slate-400 hover:text-slate-600 transition-colors">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-light/30 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full space-y-6">

        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Manage Reservation</h2>
          <p className="text-sm text-slate-400">Ref: <span className="font-mono font-bold text-ocean">{booking.reference_number}</span></p>
        </div>

        {/* Booking summary */}
        <div className="bg-slate-50 rounded-xl p-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Guest</span>
            <span className="font-semibold text-slate-800">{booking.guest_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Room</span>
            <span className="font-semibold text-slate-800">{booking.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Check-in</span>
            <span className="text-slate-800">{formatDate(booking.check_in_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Check-out</span>
            <span className="text-slate-800">{formatDate(booking.check_out_date)}</span>
          </div>
          {booking.total_price != null && (
            <div className="flex justify-between border-t border-slate-200 pt-3 mt-3">
              <span className="text-slate-500 font-medium">Total</span>
              <span className="font-bold text-slate-900">${booking.total_price.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-3">
            <span className="text-slate-500 font-medium">Status</span>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${booking.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {booking.status}
            </span>
          </div>
        </div>

        {/* Change submitted success */}
        {changeSubmitted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Change request sent!</p>
              <p className="text-xs text-green-600 mt-0.5">You'll receive an email once the team reviews your request.</p>
            </div>
          </div>
        )}

        {/* Request Changes */}
        {!changeSubmitted && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowChangeForm(v => !v)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-ocean/10 rounded-full flex items-center justify-center">
                  <Edit2 size={16} className="text-ocean" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Request Changes</p>
                  <p className="text-xs text-slate-400">Change your room type or dates — subject to availability</p>
                </div>
              </div>
              <span className="text-slate-400 text-lg">{showChangeForm ? '−' : '+'}</span>
            </button>

            {showChangeForm && (
              <div className="p-4 pt-0 border-t border-slate-100 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Room Type</label>
                  <select
                    value={changeCategory}
                    onChange={e => setChangeCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40 bg-white"
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Check-in</label>
                    <input
                      type="date"
                      min={today}
                      value={changeCheckIn}
                      onChange={e => setChangeCheckIn(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Check-out</label>
                    <input
                      type="date"
                      min={changeCheckIn || today}
                      value={changeCheckOut}
                      onChange={e => setChangeCheckOut(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
                    />
                  </div>
                </div>
                {changeError && <p className="text-red-500 text-sm">{changeError}</p>}
                <p className="text-xs text-slate-400">Your request will be reviewed by the motel team. You'll be notified by email.</p>
                <button
                  onClick={handleChangeSubmit}
                  disabled={submitting}
                  className="w-full bg-ocean hover:bg-ocean-dark text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
                >
                  {submitting ? 'Submitting…' : 'Submit Change Request'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cancel */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {!cancelConfirm ? (
            <button
              onClick={() => setCancelConfirm(true)}
              disabled={!booking.can_cancel}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <XCircle size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Cancel Reservation</p>
                <p className="text-xs text-slate-400">
                  {booking.can_cancel
                    ? 'Cancel your booking — this cannot be undone'
                    : 'Cancellation not available within 24 hours of check-in'}
                </p>
              </div>
            </button>
          ) : (
            <div className="p-4 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">Are you sure you want to cancel? <strong>This cannot be undone.</strong></p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 text-sm"
                >
                  {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  Keep Reservation
                </button>
              </div>
            </div>
          )}
        </div>

        {!booking.can_cancel && (
          <div className="text-center">
            <a href="tel:3212676272" className="inline-flex items-center gap-2 text-sm font-semibold text-ocean hover:text-ocean-dark transition-colors">
              <Phone size={14} /> Call (321) 267-6272 for same-day changes
            </a>
          </div>
        )}

        <Link to="/" className="block text-center text-sm text-slate-400 hover:text-slate-600 transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
