import { useState, useEffect, useCallback } from 'react';
import { Home, Check, X, LayoutDashboard, Calendar, RefreshCw, DollarSign, BedDouble, CalendarDays, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Booking {
  id: number;
  reference_number: string | null;
  guest_name: string;
  email: string;
  phone: string;
  category: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  assigned_room_number: string | null;
  total_price: number | null;
  created_at: string | null;
  adults: number;
  kids: number;
  special_requests: string;
}

interface CalendarDay {
  date: string;
  rooms_to_sell: number;
  price: number;
  net_booked: number;
  net_available: number;
}

interface CalendarCategory {
  category: string;
  physical_rooms: number;
  days: CalendarDay[];
}

type Tab       = 'dashboard' | 'occupancy' | 'calendar';
type DayFilter = 'yesterday' | 'today' | 'tomorrow';
type SubTab    = 'arrivals' | 'departures' | 'stayovers' | 'new_bookings';

const CATEGORIES = ['One King', 'Two Queen', '2 Double Bed'];

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === 'admin' && pass === '1234') {
      sessionStorage.setItem('admin_auth', '1');
      onLogin();
    } else {
      setError('Incorrect username or password.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-ocean/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="text-ocean" size={26} />
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Admin Login</h1>
          <p className="text-slate-500 text-sm mt-1">Three Oaks Motel</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-ocean hover:bg-ocean-dark text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD in LOCAL time (avoids UTC midnight rollover bug). */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return localDateStr(new Date());
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cur = from;
  while (cur <= to) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

function fmtHeader(dateStr: string): { dow: string; day: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    dow: d.toLocaleDateString('en-US', { weekday: 'short' }),
    day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

function fmtDateRange(start: string, days = 14): string {
  const end = addDays(start, days - 1);
  const s = new Date(start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end   + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${s} – ${e}`;
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_auth') === '1');
  const [tab, setTab]             = useState<Tab>('dashboard');
  const [dayFilter, setDayFilter] = useState<DayFilter>('today');
  const [subTab, setSubTab]       = useState<SubTab>('arrivals');
  const [loading, setLoading]     = useState(true);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);

  // Reservations tab state
  const [resFrom, setResFrom]         = useState('');
  const [resTo, setResTo]             = useState('');
  const [resCat, setResCat]           = useState('All');
  const [resSearch, setResSearch]     = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Calendar state
  const [calendarData, setCalendarData]       = useState<CalendarCategory[]>([]);
  const [calendarStart, setCalendarStart]     = useState(() => todayStr());
  const [calendarLoading, setCalendarLoading] = useState(false);
  // key: "Category|date", value: pending cell edits
  const [pendingEdits, setPendingEdits] = useState<Record<string, { rooms_to_sell?: number; price?: number }>>({});
  // Bulk edit
  const [bulkCategory, setBulkCategory] = useState('One King');
  const [bulkFrom, setBulkFrom]         = useState('');
  const [bulkTo, setBulkTo]             = useState('');
  const [bulkRooms, setBulkRooms]       = useState('');
  const [bulkPrice, setBulkPrice]       = useState('');
  const [bulkSaving, setBulkSaving]     = useState(false);
  const [calSaveMsg, setCalSaveMsg]     = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/bookings`);
      setAllBookings(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendar = useCallback(async (start = calendarStart) => {
    setCalendarLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/calendar?start=${start}&days=14`);
      setCalendarData(await res.json());
      setPendingEdits({});
    } catch (e) {
      console.error(e);
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarStart]);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (tab === 'calendar') fetchCalendar(); }, [tab, fetchCalendar]);

  // ── Bookings actions ──────────────────────────────────────────────────────

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`${API}/api/bookings/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.ok) { fetchData(); if (tab === 'calendar') fetchCalendar(); }
      else { const err = await res.json(); alert(err.error || 'Approval failed.'); }
    } catch (e) { console.error(e); }
  };

  const handleReject = async (id: number) => {
    if (!window.confirm('Confirm rejection?')) return;
    try {
      const res = await fetch(`${API}/api/bookings/${id}/reject`, { method: 'PATCH' });
      if (res.ok) fetchData();
    } catch (e) { console.error(e); }
  };

  // ── Calendar actions ──────────────────────────────────────────────────────

  const setCellEdit = (category: string, date: string, field: 'rooms_to_sell' | 'price', value: number) => {
    const key = `${category}|${date}`;
    setPendingEdits(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSaveCalendar = async () => {
    if (Object.keys(pendingEdits).length === 0) return;
    setBulkSaving(true);
    try {
      // Group by category
      const byCat: Record<string, { dates: string[]; rooms_to_sell?: number; price?: number }[]> = {};
      for (const [key, vals] of Object.entries(pendingEdits)) {
        const pipeIdx = key.indexOf('|');
        const cat  = key.slice(0, pipeIdx);
        const date = key.slice(pipeIdx + 1);
        if (!byCat[cat]) byCat[cat] = [];
        byCat[cat].push({ dates: [date], ...vals });
      }
      // One bulk call per category
      await Promise.all(
        Object.entries(byCat).map(([category, entries]) =>
          fetch(`${API}/api/admin/calendar/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category,
              dates: entries.map(e => e.dates[0]),
              rooms_to_sell: entries.every(e => e.rooms_to_sell !== undefined)
                ? undefined  // mixed values — handle per-entry below
                : undefined,
              // Per-cell saves: one request per changed cell
            }),
          })
        )
      );
      // Actually send one request per cell (each may have different values)
      await Promise.all(
        Object.entries(pendingEdits).map(([key, vals]) => {
          const pipeIdx = key.indexOf('|');
          const category = key.slice(0, pipeIdx);
          const date     = key.slice(pipeIdx + 1);
          return fetch(`${API}/api/admin/calendar/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, dates: [date], ...vals }),
          });
        })
      );
      setCalSaveMsg('Changes saved.');
      setTimeout(() => setCalSaveMsg(''), 3000);
      fetchCalendar();
    } catch (e) {
      console.error(e);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkApply = async () => {
    if (!bulkFrom || !bulkTo) return;
    const dates = dateRange(bulkFrom, bulkTo);
    if (dates.length === 0) return;
    const payload: Record<string, unknown> = { category: bulkCategory, dates };
    if (bulkRooms !== '') payload.rooms_to_sell = parseInt(bulkRooms);
    if (bulkPrice !== '') payload.price = parseFloat(bulkPrice);
    setBulkSaving(true);
    try {
      await fetch(`${API}/api/admin/calendar/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setBulkFrom(''); setBulkTo(''); setBulkRooms(''); setBulkPrice('');
      setCalSaveMsg(`Updated ${dates.length} days for ${bulkCategory}.`);
      setTimeout(() => setCalSaveMsg(''), 3000);
      fetchCalendar();
    } catch (e) { console.error(e); }
    finally { setBulkSaving(false); }
  };

  // ── Computed values ───────────────────────────────────────────────────────

  const dayStr = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return localDateStr(d);
  };
  const offsets: Record<DayFilter, number> = { yesterday: -1, today: 0, tomorrow: 1 };
  const selectedDate = dayStr(offsets[dayFilter]);

  const arrivals   = allBookings.filter(b => b.check_in_date  === selectedDate && b.status === 'Approved');
  const departures = allBookings.filter(b => b.check_out_date === selectedDate && b.status === 'Approved');
  const stayovers  = allBookings.filter(b => b.check_in_date < selectedDate && b.check_out_date > selectedDate && b.status === 'Approved');
  const newBookings = allBookings;

  const bookingStatusBadge = (status: string) => {
    if (status === 'Approved') return 'bg-green-100 text-green-700';
    if (status === 'Rejected') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  };

  const nightCount = (ci: string, co: string) =>
    Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000);

  const pendingCount = Object.keys(pendingEdits).length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-sky-light/30 font-body text-slate-800">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-3 px-4 md:py-4 md:px-8 sticky top-0 z-50 flex justify-between items-center flex-wrap gap-y-2 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-ocean rounded-lg flex items-center justify-center text-white">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-slate-900">Property Manager</h1>
            <p className="hidden sm:block text-xs text-slate-500 font-medium uppercase tracking-wider">Three Oaks Motel Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={() => { fetchData(); if (tab === 'calendar') fetchCalendar(); }}
            disabled={loading}
            className="flex items-center gap-2 text-sm font-semibold text-ocean hover:text-ocean-dark transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Sync
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            <Home size={16} /> View Site
          </Link>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8">
        <div className="flex gap-1 max-w-7xl mx-auto overflow-x-auto">
          {([
            { key: 'dashboard', icon: <Calendar size={16}/>, label: 'Bookings' },
            { key: 'occupancy', icon: <BedDouble size={16}/>, label: 'Reservations' },
            { key: 'calendar',  icon: <CalendarDays size={16}/>, label: 'Calendar' },
          ] as { key: Tab; icon: React.ReactNode; label: string }[]).map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === key ? 'border-ocean text-ocean' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-4 md:p-8">

        {/* ── Bookings Tab ───────────────────────────────────────────────── */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {(['yesterday', 'today', 'tomorrow'] as DayFilter[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDayFilter(d)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors ${dayFilter === d ? 'bg-ocean text-white' : 'border border-slate-300 text-slate-600 hover:border-ocean hover:text-ocean'}`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-100 overflow-x-auto">
                {([
                  { key: 'arrivals',     label: 'Arrivals',     count: arrivals.length },
                  { key: 'departures',   label: 'Departures',   count: departures.length },
                  { key: 'stayovers',    label: 'Stay-overs',   count: stayovers.length },
                  { key: 'new_bookings', label: 'New Bookings', count: newBookings.length },
                ] as { key: SubTab; label: string; count: number }[]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setSubTab(key)}
                    className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${subTab === key ? 'border-ocean text-ocean' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                  >
                    {label}
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${subTab === key ? 'bg-ocean text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {(subTab === 'arrivals' || subTab === 'departures' || subTab === 'stayovers') && (() => {
                const rows = subTab === 'arrivals' ? arrivals : subTab === 'departures' ? departures : stayovers;
                const label = subTab === 'arrivals' ? 'arrivals' : subTab === 'departures' ? 'departures' : 'stay-overs';
                const dayLabel = dayFilter.charAt(0).toUpperCase() + dayFilter.slice(1);
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {['Room #', 'Guest', 'Category', 'Check-in', 'Check-out', 'Nights', 'Total'].map(h => (
                            <th key={h} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {rows.map(b => (
                          <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4"><span className="text-xl font-display font-black text-ocean">{b.assigned_room_number ?? '—'}</span></td>
                            <td className="p-4">
                              <div className="font-bold text-slate-900">{b.guest_name}</div>
                              <div className="text-xs text-slate-500">{b.email}</div>
                              <div className="text-xs text-slate-400">{b.phone}</div>
                            </td>
                            <td className="p-4"><span className="text-xs font-bold text-ocean bg-ocean/5 py-1 px-2 rounded border border-ocean/10">{b.category}</span></td>
                            <td className="p-4 text-sm font-medium text-slate-700">{b.check_in_date}</td>
                            <td className="p-4 text-sm font-medium text-slate-700">{b.check_out_date}</td>
                            <td className="p-4 text-sm font-bold text-slate-700">{nightCount(b.check_in_date, b.check_out_date)}</td>
                            <td className="p-4 text-sm font-bold text-slate-800">{b.total_price != null ? `$${b.total_price.toFixed(2)}` : '—'}</td>
                          </tr>
                        ))}
                        {rows.length === 0 && (
                          <tr><td colSpan={7} className="p-16 text-center text-slate-400 text-sm italic">No {label} for {dayLabel}.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {subTab === 'new_bookings' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[820px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Guest', 'Category', 'Dates', 'Guests', 'Special Requests', 'Total', 'Status', 'Actions'].map((h, i) => (
                          <th key={h} className={`p-4 text-xs font-bold text-slate-500 uppercase tracking-wider${i === 7 ? ' text-right' : ''}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {newBookings.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-slate-900">{b.guest_name}</div>
                            <div className="text-xs text-slate-500">{b.email}</div>
                            <div className="text-xs text-slate-400">{b.phone}</div>
                          </td>
                          <td className="p-4">
                            <span className="text-xs font-bold text-ocean bg-ocean/5 py-1 px-2 rounded border border-ocean/10">{b.category}</span>
                          </td>
                          <td className="p-4">
                            <div className="text-xs font-medium text-slate-700">In: {b.check_in_date}</div>
                            <div className="text-xs font-medium text-slate-700">Out: {b.check_out_date}</div>
                            <div className="text-xs text-slate-400">{nightCount(b.check_in_date, b.check_out_date)} nights</div>
                          </td>
                          <td className="p-4">
                            <div className="text-xs text-slate-700">{b.adults} adult{b.adults !== 1 ? 's' : ''}</div>
                            {b.kids > 0 && <div className="text-xs text-slate-500">{b.kids} child{b.kids !== 1 ? 'ren' : ''}</div>}
                          </td>
                          <td className="p-4 max-w-[180px]">
                            {b.special_requests
                              ? <span className="text-xs text-slate-600 italic">{b.special_requests}</span>
                              : <span className="text-xs text-slate-300">—</span>
                            }
                          </td>
                          <td className="p-4 text-sm font-bold text-slate-800 whitespace-nowrap">
                            {b.total_price != null ? `$${b.total_price.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-4">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${bookingStatusBadge(b.status)}`}>{b.status}</span>
                          </td>
                          <td className="p-4 text-right">
                            {b.status === 'Pending' && (
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleApprove(b.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100" title="Approve"><Check size={18} /></button>
                                <button onClick={() => handleReject(b.id)}  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"   title="Reject"><X size={18} /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {newBookings.length === 0 && (
                        <tr><td colSpan={8} className="p-16 text-center text-slate-400 text-sm italic">No bookings yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Reservations Tab ───────────────────────────────────────── */}
        {tab === 'occupancy' && (() => {
          const q = resSearch.toLowerCase().trim();
          const filtered = allBookings
            .filter(b => {
              if (resCat !== 'All' && b.category !== resCat) return false;
              if (resFrom && b.check_in_date < resFrom) return false;
              if (resTo   && b.check_in_date > resTo)   return false;
              if (q) {
                const haystack = [
                  b.guest_name, b.email, b.phone, b.category,
                  b.reference_number ?? '', b.status,
                  b.check_in_date, b.check_out_date,
                  b.special_requests,
                  b.assigned_room_number ?? '',
                  String(b.adults), String(b.kids),
                  b.total_price != null ? String(b.total_price) : '',
                ].join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
              }
              return true;
            })
            .sort((a, b) => b.check_in_date.localeCompare(a.check_in_date));

          const statusStyle = (s: string) =>
            s === 'Approved' ? 'bg-green-100 text-green-700' :
            s === 'Rejected' ? 'bg-red-100 text-red-600' :
            'bg-amber-100 text-amber-700';

          return (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-display font-bold text-slate-900">Reservations</h2>
                <span className="text-sm text-slate-400">{filtered.length} of {allBookings.length} reservation{allBookings.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Search bar */}
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  placeholder="Search by name, email, phone, reference, category, dates, special requests…"
                  value={resSearch}
                  onChange={e => setResSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40 shadow-sm"
                />
                {resSearch && (
                  <button onClick={() => setResSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                  <select value={resCat} onChange={e => setResCat(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40">
                    <option value="All">All categories</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Check-in From</label>
                  <input type="date" value={resFrom} onChange={e => setResFrom(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Until</label>
                  <input type="date" value={resTo} onChange={e => setResTo(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40" />
                </div>
                {(resFrom || resTo || resCat !== 'All') && (
                  <button onClick={() => { setResFrom(''); setResTo(''); setResCat('All'); }}
                    className="px-3 py-2.5 text-sm text-slate-500 hover:text-red-500 transition-colors">
                    Clear filters
                  </button>
                )}
              </div>

              {/* Reservations table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[1100px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Reference', 'Guest Name', 'Phone', 'Check-in', 'Check-out', 'Room', 'Adults', 'Kids', 'Special Requests', 'Booked on', 'Status', 'Price'].map(h => (
                          <th key={h} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.map(b => (
                        <>
                          <tr
                            key={b.id}
                            onClick={() => setExpandedRow(expandedRow === b.id ? null : b.id)}
                            className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                          >
                            {/* Reference */}
                            <td className="p-4">
                              <span className="text-xs font-black text-ocean tracking-wider font-mono">{b.reference_number ?? `#${b.id}`}</span>
                            </td>
                            {/* Guest */}
                            <td className="p-4">
                              <div className="font-bold text-slate-900">{b.guest_name}</div>
                              <div className="text-xs text-slate-500">{b.email}</div>
                            </td>
                            {/* Phone */}
                            <td className="p-4 text-sm text-slate-700 whitespace-nowrap">{b.phone || '—'}</td>
                            {/* Dates */}
                            <td className="p-4 text-sm font-medium text-slate-700 whitespace-nowrap">{b.check_in_date}</td>
                            <td className="p-4 text-sm font-medium text-slate-700 whitespace-nowrap">{b.check_out_date}</td>
                            {/* Room */}
                            <td className="p-4">
                              <span className="text-xs font-bold text-ocean bg-ocean/5 py-1 px-2 rounded border border-ocean/10 whitespace-nowrap">{b.category}</span>
                              {b.assigned_room_number && (
                                <div className="text-xs text-slate-400 mt-1">Rm {b.assigned_room_number}</div>
                              )}
                            </td>
                            {/* Adults */}
                            <td className="p-4 text-sm text-center text-slate-700">{b.adults}</td>
                            {/* Kids */}
                            <td className="p-4 text-sm text-center text-slate-700">
                              {b.kids > 0 ? b.kids : <span className="text-slate-300">—</span>}
                            </td>
                            {/* Special Requests */}
                            <td className="p-4 max-w-[200px]">
                              {b.special_requests
                                ? <span className="text-xs text-slate-600 italic line-clamp-2">{b.special_requests}</span>
                                : <span className="text-xs text-slate-300">—</span>
                              }
                            </td>
                            {/* Booked on */}
                            <td className="p-4 text-xs text-slate-500 whitespace-nowrap">
                              {b.created_at ? b.created_at.split('T')[0] : '—'}
                            </td>
                            {/* Status */}
                            <td className="p-4">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusStyle(b.status)}`}>{b.status}</span>
                            </td>
                            {/* Price */}
                            <td className="p-4 text-sm font-bold text-slate-800 whitespace-nowrap">
                              {b.total_price != null ? `$${b.total_price.toFixed(2)}` : '—'}
                            </td>
                          </tr>

                          {/* Expanded detail row — approve/reject for pending */}
                          {expandedRow === b.id && (
                            <tr key={`${b.id}-detail`} className="bg-slate-50/80">
                              <td colSpan={12} className="px-6 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Nights</p>
                                    <p className="text-slate-700">{nightCount(b.check_in_date, b.check_out_date)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Guests</p>
                                    <p className="text-slate-700">
                                      {b.adults} adult{b.adults !== 1 ? 's' : ''}
                                      {b.kids > 0 ? ` · ${b.kids} child${b.kids !== 1 ? 'ren' : ''}` : ''}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Special Requests</p>
                                    <p className="text-slate-700 italic">{b.special_requests || 'None'}</p>
                                  </div>
                                </div>
                                {b.status === 'Pending' && (
                                  <div className="flex gap-2 mt-4">
                                    <button onClick={e => { e.stopPropagation(); handleApprove(b.id); }}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
                                      <Check size={15} /> Approve
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); handleReject(b.id); }}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold rounded-lg transition-colors border border-red-100">
                                      <X size={15} /> Reject
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={12} className="p-16 text-center text-slate-400 text-sm italic">No reservations match the current filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Calendar Tab ───────────────────────────────────────────────── */}
        {tab === 'calendar' && (
          <div className="space-y-6">

            {/* Header row: nav + title + save */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { const s = addDays(calendarStart, -14); setCalendarStart(s); fetchCalendar(s); }}
                  className="p-2 rounded-lg border border-slate-200 hover:border-ocean hover:text-ocean transition-colors text-slate-600"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm font-semibold text-slate-700 min-w-[200px] text-center">
                  {fmtDateRange(calendarStart)}
                </span>
                <button
                  onClick={() => { const s = addDays(calendarStart, 14); setCalendarStart(s); fetchCalendar(s); }}
                  className="p-2 rounded-lg border border-slate-200 hover:border-ocean hover:text-ocean transition-colors text-slate-600"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => { const s = todayStr(); setCalendarStart(s); fetchCalendar(s); }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:border-ocean hover:text-ocean transition-colors text-slate-600"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center gap-3">
                {calSaveMsg && <span className="text-sm text-green-600 font-semibold">{calSaveMsg}</span>}
                {pendingCount > 0 && (
                  <button
                    onClick={handleSaveCalendar}
                    disabled={bulkSaving}
                    className="flex items-center gap-2 btn-primary py-2 px-5 text-sm disabled:opacity-50"
                  >
                    <Save size={15} />
                    Save Changes {pendingCount > 0 && <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
                  </button>
                )}
              </div>
            </div>

            {/* Bulk edit panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <DollarSign size={15} className="text-ocean" /> Bulk Update
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                  <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">From</label>
                  <input type="date" value={bulkFrom} onChange={e => setBulkFrom(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">To</label>
                  <input type="date" value={bulkTo} onChange={e => setBulkTo(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Rooms to Sell</label>
                  <input type="number" min="0" placeholder="—" value={bulkRooms} onChange={e => setBulkRooms(e.target.value)}
                    className="w-24 p-2.5 rounded-lg border border-slate-200 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-ocean/40" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Price ($)</label>
                  <input type="number" min="0" step="1" placeholder="—" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                    className="w-24 p-2.5 rounded-lg border border-slate-200 bg-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-ocean/40" />
                </div>
                <button
                  onClick={handleBulkApply}
                  disabled={bulkSaving || !bulkFrom || !bulkTo}
                  className="btn-primary py-2.5 px-5 text-sm disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Per-category calendar grids */}
            {calendarLoading ? (
              <div className="text-center py-16 text-slate-400 text-sm italic">Loading calendar…</div>
            ) : (
              calendarData.map(cat => (
                <div key={cat.category} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Category header */}
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                    <BedDouble size={18} className="text-ocean" />
                    <h3 className="font-display font-bold text-slate-900 text-lg">{cat.category}</h3>
                    <span className="text-xs text-slate-400 font-medium">{cat.physical_rooms} physical rooms</span>
                  </div>

                  {/* Calendar grid */}
                  <div className="overflow-x-auto">
                    <table className="text-left" style={{ minWidth: `${14 * 80 + 120}px` }}>
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider w-28 bg-slate-50"></th>
                          {cat.days.map(d => {
                            const { dow, day } = fmtHeader(d.date);
                            const isToday = d.date === todayStr();
                            return (
                              <th key={d.date} className={`px-2 py-2 text-center w-20 ${isToday ? 'bg-ocean/5' : 'bg-slate-50'}`}>
                                <div className={`text-xs font-bold uppercase ${isToday ? 'text-ocean' : 'text-slate-400'}`}>{dow}</div>
                                <div className={`text-sm font-black ${isToday ? 'text-ocean' : 'text-slate-700'}`}>{day}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Row 1: Rooms to Sell */}
                        <tr className="border-b border-slate-50">
                          <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 whitespace-nowrap">
                            Rooms to Sell
                          </td>
                          {cat.days.map(d => {
                            const key = `${cat.category}|${d.date}`;
                            const editVal = pendingEdits[key]?.rooms_to_sell;
                            const displayVal = editVal !== undefined ? editVal : d.rooms_to_sell;
                            const isBlocked = displayVal === 0;
                            const isPending = editVal !== undefined;
                            const isToday = d.date === todayStr();
                            return (
                              <td key={d.date} className={`px-2 py-2 text-center ${isBlocked ? 'bg-red-50' : isToday ? 'bg-ocean/5' : ''}`}>
                                <input
                                  type="number"
                                  min="0"
                                  max={cat.physical_rooms}
                                  value={displayVal}
                                  onChange={e => setCellEdit(cat.category, d.date, 'rooms_to_sell', parseInt(e.target.value) || 0)}
                                  className={`w-14 text-center text-sm font-bold rounded-lg border py-1.5 focus:outline-none focus:ring-2 focus:ring-ocean/40 ${
                                    isBlocked
                                      ? 'bg-red-100 border-red-200 text-red-700'
                                      : isPending
                                      ? 'bg-amber-50 border-amber-300 text-slate-800'
                                      : 'bg-white border-slate-200 text-slate-800'
                                  }`}
                                />
                              </td>
                            );
                          })}
                        </tr>

                        {/* Row 2: Net Available (read-only) */}
                        <tr className="border-b border-slate-50">
                          <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 whitespace-nowrap">
                            Available
                          </td>
                          {cat.days.map(d => {
                            const key = `${cat.category}|${d.date}`;
                            const pendingRts = pendingEdits[key]?.rooms_to_sell;
                            const rts = pendingRts !== undefined ? pendingRts : d.rooms_to_sell;
                            const netAvail = Math.max(0, rts - d.net_booked);
                            const isToday = d.date === todayStr();
                            return (
                              <td key={d.date} className={`px-2 py-3 text-center ${isToday ? 'bg-ocean/5' : ''}`}>
                                <span className={`text-sm font-black ${
                                  netAvail === 0 && rts === 0 ? 'text-red-500' :
                                  netAvail === 0 ? 'text-amber-500' : 'text-green-600'
                                }`}>{netAvail}</span>
                                {d.net_booked > 0 && (
                                  <div className="text-xs text-slate-400">{d.net_booked} booked</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Row 3: Price */}
                        <tr>
                          <td className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 whitespace-nowrap">
                            Price / Night
                          </td>
                          {cat.days.map(d => {
                            const key = `${cat.category}|${d.date}`;
                            const editVal = pendingEdits[key]?.price;
                            const displayVal = editVal !== undefined ? editVal : d.price;
                            const isPending = editVal !== undefined;
                            const isToday = d.date === todayStr();
                            return (
                              <td key={d.date} className={`px-2 py-2 text-center ${isToday ? 'bg-ocean/5' : ''}`}>
                                <div className="relative inline-block">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold pointer-events-none">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={displayVal}
                                    onChange={e => setCellEdit(cat.category, d.date, 'price', parseFloat(e.target.value) || 0)}
                                    className={`w-16 pl-4 pr-1 text-center text-sm font-bold rounded-lg border py-1.5 focus:outline-none focus:ring-2 focus:ring-ocean/40 ${
                                      isPending
                                        ? 'bg-amber-50 border-amber-300 text-slate-800'
                                        : 'bg-white border-slate-200 text-slate-800'
                                    }`}
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Legend */}
                  <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/50 flex items-center gap-6 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" /> Blocked (0 rooms)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-300 inline-block" /> Unsaved edit</span>
                    <span className="flex items-center gap-1.5"><span className="font-black text-amber-500">0</span>&nbsp;Fully booked</span>
                    <span className="flex items-center gap-1.5"><span className="font-black text-green-600">N</span>&nbsp;Available</span>
                  </div>
                </div>
              ))
            )}

            {pendingCount > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={handleSaveCalendar}
                  disabled={bulkSaving}
                  className="flex items-center gap-2 btn-primary py-2.5 px-6 text-sm disabled:opacity-50"
                >
                  <Save size={16} />
                  Save {pendingCount} Change{pendingCount !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
