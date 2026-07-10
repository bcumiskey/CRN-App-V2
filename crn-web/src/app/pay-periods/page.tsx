"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Wallet, Lock, Calendar, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Badge, { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PayPeriod {
  id: string;
  startDate: string;
  endDate: string;
  status: string; // open | closed | paid
  closedAt?: string | null;
  paidAt?: string | null;
  _count?: { payStatements: number };
}

interface WorkerEarnings {
  userId: string;
  userName: string;
  jobsWorked: number;
  totalShares: number;
  workerPoolPay: number;
  ownerPay: number;
  grossPay: number;
}

export default function PayPeriodsPage() {
  const [periods, setPeriods] = useState<PayPeriod[]>([]);
  const [currentPerWorker, setCurrentPerWorker] = useState<WorkerEarnings[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    api
      .get<{ periods: PayPeriod[] }>("/pay-periods")
      .then(async (data) => {
        setPeriods(data.periods);
        const open = data.periods.find((p) => p.status === "open");
        if (open) {
          try {
            const detail = await api.get<PayPeriod & { perWorker: WorkerEarnings[] }>(
              `/pay-periods/${open.id}`
            );
            setCurrentPerWorker(detail.perWorker ?? []);
          } catch (err) {
            console.error(err);
            setCurrentPerWorker([]);
          }
        } else {
          setCurrentPerWorker([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentPeriod = periods.find((p) => p.status === "open");
  const pastPeriods = periods.filter((p) => p.status !== "open");

  const currentTotalPay =
    Math.round(currentPerWorker.reduce((sum, w) => sum + w.grossPay, 0) * 100) / 100;

  const handleCreate = async () => {
    setCreating(true);
    setActionError(null);
    try {
      await api.post("/pay-periods", {});
      fetchData();
    } catch (err) {
      console.error(err);
      setActionError("Failed to start a new pay period.");
    } finally {
      setCreating(false);
    }
  };

  const handleClose = useCallback(async () => {
    if (!currentPeriod) return;
    setClosing(true);
    setActionError(null);
    try {
      await api.patch(`/pay-periods/${currentPeriod.id}/close`);
      setShowConfirm(false);
      fetchData();
    } catch (err) {
      console.error(err);
      setActionError("Failed to close the pay period.");
    } finally {
      setClosing(false);
    }
  }, [currentPeriod]);

  const handleMarkPaid = async (period: PayPeriod) => {
    setActingId(period.id);
    setActionError(null);
    try {
      await api.patch(`/pay-periods/${period.id}/mark-paid`);
      fetchData();
    } catch (err) {
      console.error(err);
      setActionError("Failed to mark the pay period as paid.");
    } finally {
      setActingId(null);
    }
  };

  const handleReopen = async (period: PayPeriod) => {
    setActingId(period.id);
    setActionError(null);
    try {
      await api.patch(`/pay-periods/${period.id}/reopen`);
      fetchData();
    } catch (err) {
      console.error(err);
      setActionError("Failed to reopen the pay period.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Pay Periods"
        subtitle="Manage worker pay cycles"
        actions={
          !loading && !currentPeriod ? (
            <Button variant="primary" onClick={handleCreate} disabled={creating} loading={creating}>
              <Plus size={16} />
              Start New Period
            </Button>
          ) : undefined
        }
      />

      {actionError && (
        <p className="text-sm text-red-600 mb-4">{actionError}</p>
      )}

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
                        <p className="text-2xl font-bold text-gray-900">{currentPerWorker.length}</p>
                        <p className="text-xs text-gray-500">Workers</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-700">{formatCurrency(currentTotalPay)}</p>
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
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Closed</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Statements</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pastPeriods.map((period) => (
                    <tr key={period.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {formatDate(period.startDate)} &mdash; {formatDate(period.endDate)}
                      </td>
                      <td className="px-6 py-4"><StatusBadge status={period.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {period.closedAt ? new Date(period.closedAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">
                        {period._count?.payStatements ?? 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {period.status === "closed" && (
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReopen(period)}
                              disabled={actingId === period.id}
                            >
                              Reopen
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleMarkPaid(period)}
                              disabled={actingId === period.id}
                            >
                              Mark Paid
                            </Button>
                          </div>
                        )}
                      </td>
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
          Are you sure you want to close this pay period? Pay statements will be
          generated for every worker with completed jobs in the period.
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
