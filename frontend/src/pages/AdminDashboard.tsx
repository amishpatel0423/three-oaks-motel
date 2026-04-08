import { useState, useEffect } from 'react';
import { Home, Check, X, Shield, Activity, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Room {
  id: number;
  room_number: string;
  room_type: string;
  status: string;
}

interface Booking {
  id: number;
  guest_name: string;
  check_in_date: string;
  check_out_date: string;
  room_preference: string;
  status: string;
}

export default function AdminDashboard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [roomsRes, bookingsRes] = await Promise.all([
        fetch('http://localhost:8000/api/rooms'),
        fetch('http://localhost:8000/api/bookings')
      ]);
      const roomsData = await roomsRes.json();
      const bookingsData = await bookingsRes.json();
      
      setRooms(roomsData);
      setBookings(bookingsData.filter((b: Booking) => b.status === "Pending"));
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/bookings/${id}/approve`, { method: 'PATCH' });
      if (res.ok) {
        fetchData();
      } else {
        const error = await res.json();
        alert(error.detail || "Failed to approve booking. Check room availability.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: number) => {
    if (!window.confirm("Are you sure you want to REJECT this transmission?")) return;
    try {
      const res = await fetch(`http://localhost:8000/api/bookings/${id}/reject`, { method: 'PATCH' });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]';
      case 'Pending':
      case 'Maintenance': return 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.6)]';
      case 'Occupied': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono flex flex-col pt-4 pb-12 px-4 sm:px-8">
      {/* Top Bar */}
      <header className="flex justify-between items-center mb-8 bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-xl">
        <div className="flex items-center space-x-3 text-nasa-blue">
          <Shield size={32} />
          <div>
            <h1 className="text-xl md:text-2xl font-orbitron text-white">MISSION CONTROL</h1>
            <p className="text-xs uppercase tracking-widest text-slate-400">Secure Admin Access</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <button onClick={fetchData} className="flex items-center space-x-2 text-slate-400 hover:text-nasa-blue transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">REFRESH TELEMETRY</span>
          </button>
          <div className="h-6 w-px bg-slate-700"></div>
          <Link to="/" className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors">
            <Home size={16} />
            <span className="hidden sm:inline">RETURN TO SURFACE</span>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status Board (Left Col) */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 shadow-xl h-full">
            <div className="flex items-center space-x-2 mb-6 border-b border-slate-800 pb-4">
              <Activity className="text-nasa-orange" />
              <h2 className="text-xl font-orbitron text-white">FLEET STATUS</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {rooms.map(room => (
                <div key={room.id} className="bg-slate-800 border border-slate-700 rounded p-4 flex flex-col items-center justify-center relative overflow-hidden group">
                  <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getStatusColor(room.status)} animate-pulse`}></div>
                  <span className="text-3xl font-orbitron text-white mb-2">{room.room_number}</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 text-center">{room.room_type}</span>
                  <span className="text-xs font-bold mt-2 text-slate-300">{room.status}</span>
                </div>
              ))}
              {rooms.length === 0 && !loading && (
                <div className="col-span-2 text-slate-500 text-sm py-4 text-center">No fleet data found.</div>
              )}
            </div>
          </div>
        </div>

        {/* Incoming Transmissions (Right Col) */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 shadow-xl h-full">
            <div className="flex items-center space-x-2 mb-6 border-b border-slate-800 pb-4">
              <div className="h-2 w-2 bg-nasa-blue rounded-full animate-bounce"></div>
              <h2 className="text-xl font-orbitron text-white">INCOMING TRANSMISSIONS</h2>
              <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-xs ml-auto">
                {bookings.length} PENDING
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-xs uppercase tracking-widest text-slate-500 bg-slate-800/50">
                    <th className="p-3">Commander</th>
                    <th className="p-3">Module</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3 text-right">Action Directive</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(booking => (
                    <tr key={booking.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-200">{booking.guest_name}</div>
                        <div className="text-xs text-slate-500">ID: TX-{booking.id.toString().padStart(4, '0')}</div>
                      </td>
                      <td className="p-3">
                        <span className="bg-slate-800 px-2 py-1 rounded text-xs text-nasa-blue border border-slate-700">
                          {booking.room_preference}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-slate-300">
                        {booking.check_in_date} 
                        <br/><span className="text-slate-500 text-xs">TO</span><br/>
                        {booking.check_out_date}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => handleApprove(booking.id)} className="p-2 bg-green-900/30 text-green-400 hover:bg-green-600 hover:text-white border border-green-700 rounded transition-colors group" title="Approve">
                            <Check size={18} />
                          </button>
                          <button onClick={() => handleReject(booking.id)} className="p-2 bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white border border-red-700 rounded transition-colors group" title="Reject">
                            <X size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 border-none">
                        No pending transmissions in queue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
