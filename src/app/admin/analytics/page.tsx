'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@nextui-org/react';
import {
  FaArrowLeft,
  FaSync,
  FaVideo,
  FaPhone,
  FaUserFriends,
  FaClock,
  FaSearch,
  FaHeart,
  FaComments,
  FaCheckCircle,
  FaGlobe,
} from 'react-icons/fa';
import { HiSparkles, HiChartBar } from 'react-icons/hi2';

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/analytics');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setActivities(data.recentActivities || []);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const formatDuration = (sec?: number) => {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      (act.userName && act.userName.toLowerCase().includes(search.toLowerCase())) ||
      (act.userEmail && act.userEmail.toLowerCase().includes(search.toLowerCase())) ||
      (act.action && act.action.toLowerCase().includes(search.toLowerCase())) ||
      (act.targetName && act.targetName.toLowerCase().includes(search.toLowerCase()));

    if (categoryFilter === 'virtual') return matchesSearch && act.category === 'virtual_dating';
    if (categoryFilter === 'real') return matchesSearch && act.category === 'real_dating';
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/virtual-companions"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-all"
          >
            <FaArrowLeft />
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-pink-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent flex items-center gap-2">
              <HiChartBar className="text-pink-400" />
              <span>User Activity &amp; Calling Analytics</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5">
              Live metrics across Virtual Companions, Real Dating, and Calling Durations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="bordered"
            color="secondary"
            startContent={<FaSync className={loading ? 'animate-spin' : ''} />}
            onClick={fetchAnalytics}
            className="font-bold text-xs border-purple-400/50 text-purple-300 bg-purple-950/40"
          >
            Refresh Data
          </Button>
          <Button
            size="sm"
            as={Link}
            href="/admin/virtual-companions"
            className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold text-xs"
          >
            Companion Studio
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border border-purple-500/30 rounded-2xl shadow-lg">
          <CardBody className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5 uppercase">
              <FaUserFriends className="text-pink-400" /> Total Users
            </span>
            <p className="text-2xl font-black text-white">{stats?.totalUsers || 0}</p>
            <p className="text-[10px] text-slate-400">{stats?.totalMembers || 0} Real Dating Profiles</p>
          </CardBody>
        </Card>

        <Card className="bg-slate-900 border border-pink-500/30 rounded-2xl shadow-lg">
          <CardBody className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-pink-300 flex items-center gap-1.5 uppercase">
              <FaVideo className="text-pink-400" /> Virtual Calling
            </span>
            <p className="text-2xl font-black text-pink-400">{stats?.totalVirtualCallMinutes || 0} min</p>
            <p className="text-[10px] text-slate-400">{stats?.totalVirtualCalls || 0} video sessions</p>
          </CardBody>
        </Card>

        <Card className="bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-lg">
          <CardBody className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 uppercase">
              <FaPhone className="text-emerald-400" /> Real Dating Calls
            </span>
            <p className="text-2xl font-black text-emerald-400">{stats?.totalRealCallMinutes || 0} min</p>
            <p className="text-[10px] text-slate-400">{stats?.totalRealCalls || 0} 1-on-1 calls</p>
          </CardBody>
        </Card>

        <Card className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-lg">
          <CardBody className="p-4 space-y-1">
            <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5 uppercase">
              <HiSparkles className="text-indigo-400" /> Total Activities
            </span>
            <p className="text-2xl font-black text-white">{stats?.totalActivities || 0}</p>
            <p className="text-[10px] text-slate-400">Tracked in database</p>
          </CardBody>
        </Card>
      </div>

      {/* Top Personas & Top Users Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Personas by Calling Time */}
        <Card className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <FaVideo className="text-pink-400" />
            <span>Top Virtual Companions (By Minutes Called)</span>
          </h2>
          {stats?.topPersonasByMinutes && stats.topPersonasByMinutes.length > 0 ? (
            <div className="space-y-2">
              {stats.topPersonasByMinutes.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <span className="font-bold text-white flex items-center gap-2">
                    <span className="text-pink-400 font-mono">#{idx + 1}</span> {p.name}
                  </span>
                  <Chip size="sm" color="secondary" variant="flat" className="font-bold text-xs">
                    {p.minutes} mins
                  </Chip>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No companion calling time recorded yet.</p>
          )}
        </Card>

        {/* Top Users by Calling Time */}
        <Card className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            <FaClock className="text-purple-400" />
            <span>Most Active Users (By Minutes)</span>
          </h2>
          {stats?.topUsersByMinutes && stats.topUsersByMinutes.length > 0 ? (
            <div className="space-y-2">
              {stats.topUsersByMinutes.map((u: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <span className="font-bold text-slate-200 truncate max-w-[200px]">
                    <span className="text-purple-400 font-mono mr-1">#{idx + 1}</span> {u.user}
                  </span>
                  <Chip size="sm" color="primary" variant="flat" className="font-bold text-xs">
                    {u.minutes} mins
                  </Chip>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No user calling time recorded yet.</p>
          )}
        </Card>
      </div>

      {/* Live User Activity Stream Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <HiSparkles className="text-amber-400" />
            <span>Live User Activity Stream</span>
          </h2>

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'virtual', label: '🤖 Virtual' },
                { id: 'real', label: '❤️ Real Dating' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setCategoryFilter(btn.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                    categoryFilter === btn.id
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <Input
              placeholder="Search activity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="sm"
              variant="bordered"
              classNames={{
                input: '!text-white text-xs',
                inputWrapper: '!bg-slate-900 !border-slate-800 h-8',
              }}
            />
          </div>
        </div>

        <Card className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Target</th>
                  <th className="p-3.5">Duration</th>
                  <th className="p-3.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No recent activity records found.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-800/40 transition-all">
                      <td className="p-3.5 font-bold text-white">
                        <div>{act.userName || 'Anonymous User'}</div>
                        {act.userEmail && <div className="text-[10px] text-slate-400 font-normal">{act.userEmail}</div>}
                      </td>
                      <td className="p-3.5">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={act.category === 'virtual_dating' ? 'secondary' : 'danger'}
                          className="text-[10px] font-bold uppercase"
                        >
                          {act.category === 'virtual_dating' ? '🤖 Virtual' : '❤️ Real Dating'}
                        </Chip>
                      </td>
                      <td className="p-3.5 font-mono text-purple-300 font-bold">
                        {act.action}
                      </td>
                      <td className="p-3.5 text-slate-300 font-medium">
                        {act.targetName || act.targetId || '—'}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-emerald-400">
                        {formatDuration(act.durationSec)}
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {new Date(act.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
