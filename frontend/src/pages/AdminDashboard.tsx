import { useState, useEffect, useCallback } from 'react';
import { Home, Check, X, LayoutDashboard, Calendar, RefreshCw, DollarSign, BedDouble, CalendarDays, ChevronLeft, ChevronRight, Save, BarChart2, FileText, Trash2, Plus, Image, Users, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'https://three-oaks-motel-api.onrender.com';

const EMAIL_TEMPLATE_DEFAULTS: Record<string, string> = {
  email_booking_subject:      'Booking Received — Three Oaks Motel | Ref: {{reference}}',
  email_booking_message:      "Thank you for choosing Three Oaks Motel. Your booking request has been received and is pending confirmation. We'll be in touch shortly.",
  email_approval_subject:     'Booking Confirmed — Three Oaks Motel | Ref: {{reference}}',
  email_approval_message:     'Great news — your reservation has been confirmed. We look forward to welcoming you!',
  email_rejection_subject:    'Booking Update — Three Oaks Motel | Ref: {{reference}}',
  email_rejection_message:    "Thank you for your interest in staying with us. Unfortunately, we were unable to accommodate your booking request at this time.",
  email_cancellation_subject: 'Reservation Cancelled — Three Oaks Motel | Ref: {{reference}}',
  email_cancellation_message: "Your reservation has been successfully cancelled. We're sorry to see you go and hope to welcome you in the future.",
};

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

interface Photo {
  id: number;
  url: string;
  caption?: string;
  category?: string;
  sort_order: number;
}

interface AnalyticsRow {
  month: string;
  bookings: number;
  revenue: number;
}

type Tab       = 'dashboard' | 'occupancy' | 'calendar' | 'content' | 'analytics' | 'users';
type Role      = 'associate' | 'manager' | 'owner';

const ROLE_TABS: Record<Role, Tab[]> = {
  associate: ['dashboard', 'occupancy'],
  manager:   ['dashboard', 'occupancy', 'calendar'],
  owner:     ['dashboard', 'occupancy', 'calendar', 'content', 'analytics', 'users'],
};
type DayFilter = 'yesterday' | 'today' | 'tomorrow';
type SubTab    = 'arrivals' | 'departures' | 'stayovers' | 'new_bookings';

const CATEGORIES = ['One King', 'Two Queen', '2 Double Bed'];

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed.'); return; }
      sessionStorage.setItem('admin_auth', '1');
      sessionStorage.setItem('admin_role', data.role);
      onLogin(data.role as Role);
    } catch {
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
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
            disabled={loading}
            className="w-full bg-ocean hover:bg-ocean-dark text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

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

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── Photo URL helper ──────────────────────────────────────────────────────────

function photoSrc(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`;
}

// ── Photo grid component ──────────────────────────────────────────────────────

function PhotoGrid({
  photos,
  onDelete,
  onAddUrl,
}: {
  photos: Photo[];
  onDelete: (id: number) => void;
  onAddUrl: (url: string, caption?: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [urlVal, setUrlVal] = useState('');
  const [captionVal, setCaptionVal] = useState('');

  const handleAdd = () => {
    if (!urlVal.trim()) return;
    onAddUrl(urlVal.trim(), captionVal.trim());
    setUrlVal(''); setCaptionVal(''); setAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map(p => (
          <div key={p.id} className="relative group rounded-xl overflow-hidden aspect-video bg-slate-100">
            <img src={photoSrc(p.url)} alt={p.caption || ''} className="w-full h-full object-cover" />
            <button
              onClick={() => onDelete(p.id)}
              className="absolute top-1.5 right-1.5 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
            {p.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 truncate">{p.caption}</div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="flex gap-2 items-end flex-wrap bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Photo URL</label>
            <input
              type="text"
              value={urlVal}
              onChange={e => setUrlVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="https://… or /images/gallery/photo.jpg"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Caption (optional)</label>
            <input
              type="text"
              value={captionVal}
              onChange={e => setCaptionVal(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary py-2 px-4 text-sm">Add</button>
            <button onClick={() => setAdding(false)} className="py-2 px-4 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm font-semibold text-ocean hover:text-ocean-dark transition-colors"
        >
          <Plus size={16} /> Add Photo by URL
        </button>
      )}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_auth') === '1');
  const [role, setRole]           = useState<Role>(() => (sessionStorage.getItem('admin_role') as Role) || 'associate');
  const allowedTabs               = ROLE_TABS[role] || ROLE_TABS.associate;
  const [tab, setTab]             = useState<Tab>(() => {
    const saved = sessionStorage.getItem('admin_role') as Role;
    return ROLE_TABS[saved]?.[0] || 'dashboard';
  });
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
  const [pendingEdits, setPendingEdits] = useState<Record<string, { rooms_to_sell?: number; price?: number }>>({});
  const [bulkCategory, setBulkCategory] = useState('One King');
  const [bulkFrom, setBulkFrom]         = useState('');
  const [bulkTo, setBulkTo]             = useState('');
  const [bulkRooms, setBulkRooms]       = useState('');
  const [bulkPrice, setBulkPrice]       = useState('');
  const [bulkSaving, setBulkSaving]     = useState(false);
  const [calSaveMsg, setCalSaveMsg]     = useState('');

  // Content tab state
  const [aboutText, setAboutText]         = useState('');
  const [amenities, setAmenities]         = useState<string[]>([]);
  const [newAmenity, setNewAmenity]       = useState('');
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([]);
  const [roomPhotos, setRoomPhotos]       = useState<Photo[]>([]);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentMsg, setContentMsg]       = useState('');

  // Analytics tab state
  const [analyticsData, setAnalyticsData]   = useState<AnalyticsRow[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [exporting, setExporting]           = useState(false);

  // Users tab state
  interface AdminUser { id: number; username: string; role: string; created_at: string | null; }
  const [adminUsers, setAdminUsers]       = useState<AdminUser[]>([]);
  const [newUsername, setNewUsername]     = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [newRole, setNewRole]             = useState<Role>('associate');
  const [userSaving, setUserSaving]       = useState(false);
  const [userMsg, setUserMsg]             = useState('');
  const [resetPwUserId, setResetPwUserId] = useState<number | null>(null);
  const [resetPwValue, setResetPwValue]   = useState('');

  // Email templates state
  const EMAIL_KEYS = [
    { key: 'booking',      label: 'Booking Received',    vars: '{{name}}, {{reference}}, {{room}}, {{check_in}}, {{check_out}}, {{total}}' },
    { key: 'approval',     label: 'Booking Confirmed',   vars: '{{name}}, {{reference}}, {{room}}, {{room_number}}, {{check_in}}, {{check_out}}, {{total}}' },
    { key: 'rejection',    label: 'Booking Declined',    vars: '{{name}}, {{reference}}, {{room}}, {{check_in}}, {{check_out}}' },
    { key: 'cancellation', label: 'Reservation Cancelled', vars: '{{name}}, {{reference}}, {{room}}, {{check_in}}, {{check_out}}' },
  ];
  const [emailTemplates, setEmailTemplates] = useState<Record<string, { subject: string; message: string }>>({});
  const [emailSaving, setEmailSaving]       = useState(false);
  const [emailMsg, setEmailMsg]             = useState('');

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

  const fetchContent = async () => {
    try {
      const [contentRes, galleryRes, roomRes] = await Promise.all([
        fetch(`${API}/api/content`),
        fetch(`${API}/api/admin/gallery`),
        fetch(`${API}/api/admin/room-photos`),
      ]);
      const content = await contentRes.json();
      setAboutText(content.about || '');
      setAmenities(content.amenities ? JSON.parse(content.amenities) : []);
      setGalleryPhotos(await galleryRes.json());
      setRoomPhotos(await roomRes.json());
      // Load email templates
      const tmpl: Record<string, { subject: string; message: string }> = {};
      for (const { key } of EMAIL_KEYS) {
        tmpl[key] = {
          subject: content[`email_${key}_subject`] || '',
          message: content[`email_${key}_message`] || '',
        };
      }
      setEmailTemplates(tmpl);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveEmailTemplates = async () => {
    setEmailSaving(true);
    const payload: Record<string, string> = {};
    for (const { key } of EMAIL_KEYS) {
      payload[`email_${key}_subject`] = emailTemplates[key]?.subject || '';
      payload[`email_${key}_message`] = emailTemplates[key]?.message || '';
    }
    try {
      await fetch(`${API}/api/admin/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setEmailMsg('Saved!');
      setTimeout(() => setEmailMsg(''), 3000);
    } catch (e) { console.error(e); }
    finally { setEmailSaving(false); }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/analytics`);
      setAnalyticsData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/api/admin/users`);
      setAdminUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (tab === 'calendar') fetchCalendar(); }, [tab, fetchCalendar]);
  useEffect(() => { if (tab === 'content') fetchContent(); }, [tab]);
  useEffect(() => { if (tab === 'analytics') fetchAnalytics(); }, [tab]);
  useEffect(() => { if (tab === 'users') fetchUsers(); }, [tab]);

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

  // ── Content actions ───────────────────────────────────────────────────────

  const handleSaveContent = async () => {
    setContentSaving(true);
    try {
      await fetch(`${API}/api/admin/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ about: aboutText, amenities: JSON.stringify(amenities) }),
      });
      setContentMsg('Saved!');
      setTimeout(() => setContentMsg(''), 3000);
    } catch (e) { console.error(e); }
    finally { setContentSaving(false); }
  };

  const handleAddGalleryPhoto = async (url: string, caption = '') => {
    const res = await fetch(`${API}/api/admin/gallery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, caption }),
    });
    const photo = await res.json();
    setGalleryPhotos(prev => [...prev, photo]);
  };

  const handleDeleteGalleryPhoto = async (id: number) => {
    if (!window.confirm('Delete this photo?')) return;
    await fetch(`${API}/api/admin/gallery/${id}`, { method: 'DELETE' });
    setGalleryPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleAddRoomPhoto = async (category: string, url: string) => {
    const res = await fetch(`${API}/api/admin/room-photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, url }),
    });
    const photo = await res.json();
    setRoomPhotos(prev => [...prev, photo]);
  };

  const handleDeleteRoomPhoto = async (id: number) => {
    if (!window.confirm('Delete this photo?')) return;
    await fetch(`${API}/api/admin/room-photos/${id}`, { method: 'DELETE' });
    setRoomPhotos(prev => prev.filter(p => p.id !== id));
  };

  // ── Analytics actions ─────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API}/api/admin/export`);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `reservations_${todayStr()}.xlsx`;
      link.click();
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
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

  if (!authed) return <LoginScreen onLogin={(r) => { setRole(r); setAuthed(true); setTab(ROLE_TABS[r][0]); }} />;

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
          <button
            onClick={async () => {
              await fetch(`${API}/api/admin/reviews/refresh`, { method: 'POST' });
              alert('Google reviews refreshed!');
            }}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-ocean transition-colors"
          >
            <RefreshCw size={16} />
            Refresh Reviews
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full capitalize ${
            role === 'owner' ? 'bg-ocean/10 text-ocean' :
            role === 'manager' ? 'bg-purple-100 text-purple-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            <ShieldCheck size={12} /> {role}
          </span>
          <div className="h-6 w-px bg-slate-200" />
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
            <Home size={16} /> View Site
          </Link>
          <div className="h-6 w-px bg-slate-200" />
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth');
              sessionStorage.removeItem('admin_role');
              setAuthed(false);
            }}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-600 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8">
        <div className="flex gap-1 max-w-7xl mx-auto overflow-x-auto">
          {([
            { key: 'dashboard', icon: <Calendar size={16}/>, label: 'Bookings' },
            { key: 'occupancy', icon: <BedDouble size={16}/>, label: 'Reservations' },
            { key: 'calendar',  icon: <CalendarDays size={16}/>, label: 'Calendar' },
            { key: 'content',   icon: <Image size={16}/>, label: 'Content' },
            { key: 'analytics', icon: <BarChart2 size={16}/>, label: 'Analytics' },
            { key: 'users',     icon: <Users size={16}/>, label: 'Users' },
          ] as { key: Tab; icon: React.ReactNode; label: string }[])
            .filter(({ key }) => allowedTabs.includes(key))
            .map(({ key, icon, label }) => (
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
                            <td className="p-4">
                              <span className="text-xs font-black text-ocean tracking-wider font-mono">{b.reference_number ?? `#${b.id}`}</span>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-slate-900">{b.guest_name}</div>
                              <div className="text-xs text-slate-500">{b.email}</div>
                            </td>
                            <td className="p-4 text-sm text-slate-700 whitespace-nowrap">{b.phone || '—'}</td>
                            <td className="p-4 text-sm font-medium text-slate-700 whitespace-nowrap">{b.check_in_date}</td>
                            <td className="p-4 text-sm font-medium text-slate-700 whitespace-nowrap">{b.check_out_date}</td>
                            <td className="p-4">
                              <span className="text-xs font-bold text-ocean bg-ocean/5 py-1 px-2 rounded border border-ocean/10 whitespace-nowrap">{b.category}</span>
                              {b.assigned_room_number && (
                                <div className="text-xs text-slate-400 mt-1">Rm {b.assigned_room_number}</div>
                              )}
                            </td>
                            <td className="p-4 text-sm text-center text-slate-700">{b.adults}</td>
                            <td className="p-4 text-sm text-center text-slate-700">
                              {b.kids > 0 ? b.kids : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="p-4 max-w-[200px]">
                              {b.special_requests
                                ? <span className="text-xs text-slate-600 italic line-clamp-2">{b.special_requests}</span>
                                : <span className="text-xs text-slate-300">—</span>
                              }
                            </td>
                            <td className="p-4 text-xs text-slate-500 whitespace-nowrap">
                              {b.created_at ? b.created_at.split('T')[0] : '—'}
                            </td>
                            <td className="p-4">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusStyle(b.status)}`}>{b.status}</span>
                            </td>
                            <td className="p-4 text-sm font-bold text-slate-800 whitespace-nowrap">
                              {b.total_price != null ? `$${b.total_price.toFixed(2)}` : '—'}
                            </td>
                          </tr>

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

            {calendarLoading ? (
              <div className="text-center py-16 text-slate-400 text-sm italic">Loading calendar…</div>
            ) : (
              calendarData.map(cat => (
                <div key={cat.category} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                    <BedDouble size={18} className="text-ocean" />
                    <h3 className="font-display font-bold text-slate-900 text-lg">{cat.category}</h3>
                    <span className="text-xs text-slate-400 font-medium">{cat.physical_rooms} physical rooms</span>
                  </div>

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

        {/* ── Content Tab ────────────────────────────────────────────────── */}
        {tab === 'content' && (
          <div className="space-y-8">

              {/* Save bar */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-bold text-slate-900">Site Content</h2>
              <div className="flex items-center gap-3">
                {contentMsg && <span className="text-sm text-green-600 font-semibold">{contentMsg}</span>}
                <button
                  onClick={handleSaveContent}
                  disabled={contentSaving}
                  className="flex items-center gap-2 btn-primary py-2 px-5 text-sm disabled:opacity-50"
                >
                  <Save size={15} />
                  {contentSaving ? 'Saving…' : 'Save Text & Amenities'}
                </button>
              </div>
            </div>

            {/* About section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileText size={17} className="text-ocean" /> About Section
              </h3>
              <p className="text-xs text-slate-400">This text appears in the "About" section on the homepage.</p>
              <textarea
                value={aboutText}
                onChange={e => setAboutText(e.target.value)}
                rows={5}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40 resize-y"
                placeholder="Write something about Three Oaks Motel…"
              />
            </div>

            {/* Amenities */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Plus size={17} className="text-ocean" /> Amenities
              </h3>
              <div className="flex flex-wrap gap-2">
                {amenities.map((a, i) => (
                  <span key={i} className="flex items-center gap-1.5 bg-ocean/5 border border-ocean/20 text-ocean text-sm px-3 py-1 rounded-full">
                    {a}
                    <button
                      onClick={() => setAmenities(prev => prev.filter((_, j) => j !== i))}
                      className="text-ocean/50 hover:text-red-500 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                {amenities.length === 0 && <p className="text-sm text-slate-400 italic">No amenities yet.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAmenity}
                  onChange={e => setNewAmenity(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newAmenity.trim()) { setAmenities(prev => [...prev, newAmenity.trim()]); setNewAmenity(''); } }}
                  placeholder="e.g. Free Wi-Fi"
                  className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
                />
                <button
                  onClick={() => { if (newAmenity.trim()) { setAmenities(prev => [...prev, newAmenity.trim()]); setNewAmenity(''); } }}
                  className="btn-primary py-2.5 px-4 text-sm"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Gallery photos */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Image size={17} className="text-ocean" /> Gallery Photos
              </h3>
              <PhotoGrid
                photos={galleryPhotos}
                onDelete={handleDeleteGalleryPhoto}
                onAddUrl={handleAddGalleryPhoto}
              />
            </div>

            {/* Room photos */}
            {CATEGORIES.map(cat => (
              <div key={cat} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <BedDouble size={17} className="text-ocean" /> {cat} — Room Photos
                </h3>
                <PhotoGrid
                  photos={roomPhotos.filter(p => p.category === cat)}
                  onDelete={handleDeleteRoomPhoto}
                  onAddUrl={(url) => handleAddRoomPhoto(cat, url)}
                />
              </div>
            ))}

            {/* Email templates */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <FileText size={17} className="text-ocean" /> Email Templates
                </h3>
                <div className="flex items-center gap-3">
                  {emailMsg && <span className="text-sm text-green-600 font-semibold">{emailMsg}</span>}
                  <button
                    onClick={handleSaveEmailTemplates}
                    disabled={emailSaving}
                    className="flex items-center gap-2 btn-primary py-2 px-4 text-sm disabled:opacity-50"
                  >
                    <Save size={14} />
                    {emailSaving ? 'Saving…' : 'Save Templates'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400">Customize the subject and message for each email. Leave blank to use the default text.</p>

              <div className="space-y-6">
                {EMAIL_KEYS.map(({ key, label, vars }) => (
                  <div key={key} className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">{label}</span>
                      <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded">{vars}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Subject</label>
                      <input
                        type="text"
                        value={emailTemplates[key]?.subject || ''}
                        onChange={e => setEmailTemplates(prev => ({ ...prev, [key]: { ...prev[key], subject: e.target.value } }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40"
                        placeholder={`Default: ${EMAIL_TEMPLATE_DEFAULTS[`email_${key}_subject`] || ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Message Body</label>
                      <textarea
                        value={emailTemplates[key]?.message || ''}
                        onChange={e => setEmailTemplates(prev => ({ ...prev, [key]: { ...prev[key], message: e.target.value } }))}
                        rows={3}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40 resize-y"
                        placeholder={`Default: ${EMAIL_TEMPLATE_DEFAULTS[`email_${key}_message`] || ''}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Analytics Tab ───────────────────────────────────────────────── */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-display font-bold text-slate-900">Analytics &amp; Reports</h2>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 btn-primary py-2 px-5 text-sm disabled:opacity-50"
              >
                <FileText size={15} />
                {exporting ? 'Preparing…' : 'Export All Reservations (.xlsx)'}
              </button>
            </div>

            {/* Summary cards */}
            {!analyticsLoading && analyticsData.length > 0 && (() => {
              const totalBookings = analyticsData.reduce((s, r) => s + Number(r.bookings), 0);
              const totalRevenue  = analyticsData.reduce((s, r) => s + Number(r.revenue), 0);
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Total Approved Bookings</p>
                    <p className="text-3xl font-display font-black text-ocean">{totalBookings}</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Total Revenue</p>
                    <p className="text-3xl font-display font-black text-ocean">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Avg Revenue / Booking</p>
                    <p className="text-3xl font-display font-black text-ocean">
                      ${totalBookings > 0 ? (totalRevenue / totalBookings).toFixed(2) : '0.00'}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Monthly table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <BarChart2 size={17} className="text-ocean" />
                <h3 className="font-bold text-slate-900">Monthly Breakdown (Approved Bookings)</h3>
              </div>

              {analyticsLoading ? (
                <div className="p-16 text-center text-slate-400 text-sm italic">Loading analytics…</div>
              ) : analyticsData.length === 0 ? (
                <div className="p-16 text-center text-slate-400 text-sm italic">No approved bookings yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Month', 'Rooms Booked', 'Total Revenue', 'Avg / Booking'].map(h => (
                          <th key={h} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {analyticsData.map(row => (
                        <tr key={row.month} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-semibold text-slate-800">{fmtMonth(row.month)}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-2 bg-ocean rounded-full"
                                  style={{ width: `${Math.min(100, (Number(row.bookings) / Math.max(...analyticsData.map(r => Number(r.bookings)))) * 100)}%` }}
                                />
                              </div>
                              <span className="font-bold text-slate-800">{row.bookings}</span>
                            </div>
                          </td>
                          <td className="p-4 font-bold text-slate-800">
                            ${Number(row.revenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-slate-600">
                            ${Number(row.bookings) > 0 ? (Number(row.revenue) / Number(row.bookings)).toFixed(2) : '0.00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Users Tab ──────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-6">
            <h2 className="text-lg font-display font-bold text-slate-900">User Management</h2>

            {/* Add user form */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Plus size={17} className="text-ocean" /> Add Staff Account
              </h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40 w-40"
                    placeholder="e.g. john"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40 w-40"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Role</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as Role)}
                    className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ocean/40 bg-white"
                  >
                    <option value="associate">Associate</option>
                    <option value="manager">Manager</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
                <button
                  disabled={userSaving || !newUsername || !newPassword}
                  onClick={async () => {
                    setUserSaving(true);
                    try {
                      const res = await fetch(`${API}/api/admin/users`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
                      });
                      const data = await res.json();
                      if (!res.ok) { setUserMsg(data.error || 'Failed.'); }
                      else { setNewUsername(''); setNewPassword(''); setNewRole('associate'); setUserMsg('User created!'); fetchUsers(); }
                    } catch { setUserMsg('Error creating user.'); }
                    finally { setUserSaving(false); setTimeout(() => setUserMsg(''), 3000); }
                  }}
                  className="btn-primary py-2.5 px-5 text-sm disabled:opacity-40"
                >
                  {userSaving ? 'Creating…' : 'Add User'}
                </button>
                {userMsg && <span className="text-sm font-semibold text-green-600">{userMsg}</span>}
              </div>
            </div>

            {/* Users list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Username', 'Role', 'Access', 'Created', 'Actions'].map(h => (
                      <th key={h} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {adminUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-semibold text-slate-800">{u.username}</td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          onChange={async e => {
                            await fetch(`${API}/api/admin/users/${u.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ role: e.target.value }),
                            });
                            fetchUsers();
                          }}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-ocean/40 capitalize"
                        >
                          <option value="associate">Associate</option>
                          <option value="manager">Manager</option>
                          <option value="owner">Owner</option>
                        </select>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        {u.role === 'associate' && 'Bookings, Reservations'}
                        {u.role === 'manager'   && 'Bookings, Reservations, Calendar'}
                        {u.role === 'owner'     && 'Full access'}
                      </td>
                      <td className="p-4 text-xs text-slate-400">{u.created_at?.split('T')[0] || '—'}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {resetPwUserId === u.id ? (
                            <>
                              <input
                                type="password"
                                value={resetPwValue}
                                onChange={e => setResetPwValue(e.target.value)}
                                placeholder="New password"
                                autoFocus
                                className="border border-slate-200 rounded-lg px-2 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-ocean/40"
                              />
                              <button
                                onClick={async () => {
                                  if (!resetPwValue) return;
                                  await fetch(`${API}/api/admin/users/${u.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ password: resetPwValue }),
                                  });
                                  setResetPwUserId(null); setResetPwValue('');
                                  setUserMsg('Password updated!');
                                  setTimeout(() => setUserMsg(''), 3000);
                                }}
                                className="text-xs font-semibold text-green-600 hover:text-green-700"
                              >Save</button>
                              <button
                                onClick={() => { setResetPwUserId(null); setResetPwValue(''); }}
                                className="text-xs text-slate-400 hover:text-slate-600"
                              >Cancel</button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setResetPwUserId(u.id); setResetPwValue(''); }}
                              className="text-xs font-semibold text-slate-500 hover:text-ocean transition-colors"
                            >
                              Reset Password
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Delete user "${u.username}"?`)) return;
                              await fetch(`${API}/api/admin/users/${u.id}`, { method: 'DELETE' });
                              fetchUsers();
                            }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {adminUsers.length === 0 && (
                    <tr><td colSpan={5} className="p-12 text-center text-slate-400 text-sm italic">No users yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
