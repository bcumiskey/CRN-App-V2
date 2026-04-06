"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Wallet, Lock, Calendar } from "lucide-react";

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  totalJobs: number;
  totalPay: number;
  closedAt?: string;
}

export default function PayPeriodsPage() {
  const [periods, setPeriods] = useState<PayPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const fetchData = () => {
    setLoading(true);
    api
      .get<{ periods: PayPeriod[] }>("/pay-periods")
      .then((data) => setPeriods(data.periods))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentPeriod = periods.find((p) => p.status === "OPEN");
  const pastPeriods = periods.filter((p) => p.status !== "OPEN");

  const handleClose = async () => {
    if (!currentPeriod) return;
    if (!confirm("Are you sure you want to close this pay period? This action cannot be undone.")) return;
    setClosing(true);
    try {
      await api.post(`/pay-periods/${currentPeriod.id}/close`);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pay Periods</h1>
        <p className="text-sm text-gray-500 mt-1">Manage worker pay cycles</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <>
          {/* Current Period Card */}
          {currentPeriod && (
            <div className="bg-white rounded-xl shadow-sm border-2 border-blue-200 p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={18} className="text-blue-500" />
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                      Current Period
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {currentPeriod.startDate} &mdash; {currentPeriod.endDate}
                  </h2>
                  <div className="flex items-center gap-6 mt-3">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{currentPeriod.totalJobs}</p>
                      <p className="text-xs text-gray-500">Jobs</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-700">${currentPeriod.totalPay.toFixed(2)}</p>
                      <p className="text-xs text-gray-500">Total Pay</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={closing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  <Lock size={14} />
                  {closing ? "Closing..." : "Close Period"}
                </button>
              </div>
            </div>
          )}

          {/* Past Periods */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Past Periods</h2>
            </div>
            {pastPeriods.length === 0 ? (
              <div className="p-12 text-center">
                <Wallet size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No closed pay periods</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Period</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Closed</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Jobs</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Total Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pastPeriods.map((period) => (
                    <tr key={period.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {period.startDate} &mdash; {period.endDate}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {period.closedAt ? new Date(period.closedAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{period.totalJobs}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">${period.totalPay.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
