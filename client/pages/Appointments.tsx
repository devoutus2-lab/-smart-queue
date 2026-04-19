import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock3, ReceiptText } from "lucide-react";
import { CachedDataNote } from "@/components/CachedDataNote";
import UserWorkspaceFrame from "@/components/user/UserWorkspaceFrame";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

function getAppointmentStatusMessage(status: string) {
  switch (status) {
    case "pending":
      return "Waiting for the business to confirm your requested time.";
    case "approved":
      return "Confirmed and ready for you to plan around.";
    case "cancelled":
      return "This booking was cancelled and is kept for reference.";
    case "rejected":
      return "The business declined this requested time.";
    case "completed":
      return "This booking has already been completed.";
    default:
      return "Review the visit details and rebook if you still need this service.";
  }
}

export default function Appointments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const scope = getAccountScope(user);
  const appointmentsQuery = useQuery({ queryKey: accountQueryKeys.myAppointments(scope.userId), queryFn: api.getAppointments });
  const historyQuery = useQuery({ queryKey: accountQueryKeys.visitHistory(scope.userId), queryFn: api.getVisitHistory });
  const upcomingAppointments = (appointmentsQuery.data?.appointments ?? []).filter((appointment) => ["pending", "approved"].includes(appointment.status));
  const pastAppointments = (appointmentsQuery.data?.appointments ?? []).filter((appointment) => !["pending", "approved"].includes(appointment.status));

  async function cancelAppointment(id: number) {
    await api.cancelAppointment(id);
    await queryClient.invalidateQueries({ queryKey: accountQueryKeys.myAppointments(scope.userId) });
    await queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(scope.userId) });
  }

  return (
    <UserWorkspaceFrame
      title="Appointments"
      subtitle="Keep upcoming bookings and visit history in their own route, separate from queues and search."
      extraAside={
        <Button asChild className="site-primary-button w-full justify-start">
          <Link to="/schedule-queue">Book a new visit</Link>
        </Button>
      }
    >
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="section-shell panel-roomy">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Upcoming bookings</h2>
          </div>
          <div className="mt-2">
            <CachedDataNote queryKey={accountQueryKeys.myAppointments(scope.userId)} />
          </div>
          <div className="mt-6 grid gap-4">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{appointment.businessName}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {appointment.serviceName ?? "General service"} | {new Date(appointment.scheduledFor).toLocaleString()}
                    </div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{getAppointmentStatusMessage(appointment.status)}</div>
                    {appointment.notes ? <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{appointment.notes}</div> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                      {appointment.status}
                    </span>
                    <Button variant="outline" onClick={() => cancelAppointment(appointment.id)}>Cancel</Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/business/${appointment.businessId}`)}>Open business</Button>
                </div>
              </div>
            ))}
            {!upcomingAppointments.length ? <div className="empty-panel">You don&apos;t have any upcoming bookings yet.</div> : null}
          </div>
        </div>

        <div className="section-shell panel-roomy">
          <div className="flex items-center gap-3">
            <Clock3 className="h-5 w-5 text-amber-500" />
            <h2 className="section-heading text-slate-900 dark:text-slate-100">Visit history</h2>
          </div>
          <div className="mt-2">
            <CachedDataNote queryKey={accountQueryKeys.visitHistory(scope.userId)} />
          </div>
          <div className="mt-6 space-y-4">
            {(historyQuery.data?.visits ?? []).map((visit) => (
              <div key={`${visit.status}-${visit.id}`} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{visit.businessName}</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{visit.serviceName ?? "General service"} | {visit.status}</div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{new Date(visit.completedAt ?? visit.scheduledFor ?? Date.now()).toLocaleString()}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visit.canRebook ? (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/business/${visit.businessId}`)}>
                      Open business
                    </Button>
                  ) : null}
                  {visit.canViewReceipt && visit.receiptId ? (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/account/receipts?receipt=${visit.receiptId}`)}>
                      <ReceiptText className="mr-2 h-4 w-4" />
                      View receipt
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
            {!historyQuery.data?.visits?.length ? <div className="empty-panel">Your completed visits will appear here after you start using the service.</div> : null}
          </div>
          {pastAppointments.length ? (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Past appointment requests</h3>
              <div className="mt-4 space-y-3">
                {pastAppointments.slice(0, 5).map((appointment) => (
                  <div key={appointment.id} className="rounded-[1.2rem] border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{appointment.businessName}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{appointment.serviceName ?? "General service"} | {new Date(appointment.scheduledFor).toLocaleString()}</div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{getAppointmentStatusMessage(appointment.status)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </UserWorkspaceFrame>
  );
}
