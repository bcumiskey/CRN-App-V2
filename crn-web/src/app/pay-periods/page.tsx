"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Wallet, Lock, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  const [showConfirm, setShowConfirm] = useState(false);

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

  const handleClose = useCallback(async () => {
    if (!currentPeriod) return;
    setClosing(true);
    try {
      await api.post(`/pay-periods/${currentPeriod.id}/close`);
      setShowConfirm(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setClosing(false);
    }
  }, [currentPeriod]);

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader title="Pay Periods" subtitle="Manage worker pay cycles" />

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <>
          {/* Current Period Card */}
          {currentPeriod && (
            <Card className="border-2 border-blue-200 mb-6">
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar size={18} className="text-blue-500" />
                      <Badge variant="info">Current Period</Badge>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {formatDate(currentPeriod.startDate)} &mdash; {formatDate(currentPeriod.endDate)}
                    </h2>
                    <div className="flex items-center gap-6 mt-3">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{currentPeriod.totalJobs}</p>
                        <p className="text-xs text-gray-500">Jobs</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-700">{formatCurrency(currentPeriod.totalPay)}</p>
                        <p className="text-xs text-gray-500">Total Pay</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowConfirm(true)}
                    disabled={closing}
                    variant="danger"
                  >
                    <Lock size={14} />
                    {closing ? "Closing..." : "Close Period"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Past Periods */}
          <Card>
            <CardHeader>
              <CardTitle>Past Periods</CardTitle>
            </CardHeader>
            {pastPeriods.length === 0 ? (
              <CardContent>
                <EmptyState
                  icon={<Wallet size={40} />}
                  title="No closed pay periods"
                />
              </CardContent>
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
                        {formatDate(period.startDate)} &mdash; {formatDate(period.endDate)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {period.closedAt ? new Date(period.closedAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{period.totalJobs}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">{formatCurrency(period.totalPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {/* Confirm Close Modal */}
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="Close Pay Period" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to close this pay period? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleClose} loading={closing}>
            Close Period
          </Button>
        </div>
      </Modal>
    </div>
  );
}
