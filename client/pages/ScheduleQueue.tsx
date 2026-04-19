import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { CachedDataNote } from "@/components/CachedDataNote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { api } from "@/lib/api";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";

export default function ScheduleQueue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const scope = getAccountScope(user);
  const initialBusinessId = searchParams.get("business") ?? "";
  const businessesQuery = useQuery({ queryKey: accountQueryKeys.scheduleBusinesses(scope.userId), queryFn: () => api.getBusinesses({ sort: "recommended" }) });
  const appointmentsQuery = useQuery({ queryKey: accountQueryKeys.myAppointments(scope.userId), queryFn: api.getAppointments });
  const [businessId, setBusinessId] = useState(initialBusinessId);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  useRealtimeInvalidation();

  const selectedBusiness = useMemo(
    () => businessesQuery.data?.businesses.find((business) => business.id === Number(businessId)),
    [businessId, businessesQuery.data?.businesses],
  );
  const businessDetailQuery = useQuery({
    queryKey: ["business", Number(businessId), "schedule"],
    queryFn: () => api.getBusiness(Number(businessId)),
    enabled: Boolean(businessId),
  });
  const selectedService =
    businessDetailQuery.data?.business.services.find((service) => service.id === Number(serviceId)) ??
    selectedBusiness?.serviceHighlights.find((service) => service.id === Number(serviceId));

  const mutation = useMutation({
    mutationFn: () =>
      api.createAppointment({
        businessId: Number(businessId),
        serviceId: Number(serviceId),
        scheduledFor: new Date(`${date}T${time}`).toISOString(),
        notes,
      }),
    onSuccess: async () => {
      setServiceId("");
      setDate("");
      setTime("");
      setNotes("");
      setSuccessMessage("Appointment request sent. You can now track it from Appointments.");
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.myAppointments(scope.userId) });
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.userDashboard(scope.userId) });
    },
  });

  async function handleSubmit() {
    if (!businessId || !serviceId || !date || !time) {
      setError("Please choose a business, service, date, and time.");
      return;
    }

    const scheduledFor = new Date(`${date}T${time}`);
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
      setError("Choose a future date and time for this visit.");
      return;
    }

    const businessDetail = businessDetailQuery.data?.business;
    if (businessDetail) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + businessDetail.queueSettings.bookingHorizonDays);
      if (scheduledFor.getTime() > maxDate.getTime()) {
        setError(`This business only accepts bookings ${businessDetail.queueSettings.bookingHorizonDays} days ahead.`);
        return;
      }

      const scheduledDay = businessDetail.hours.find((hour) => hour.dayOfWeek === scheduledFor.getDay());
      if (!scheduledDay || scheduledDay.isClosed) {
        setError("That business is closed on the selected day.");
        return;
      }

      const scheduledMinutes = scheduledFor.getHours() * 60 + scheduledFor.getMinutes();
      const [openHour, openMinute] = scheduledDay.openTime.split(":").map(Number);
      const [closeHour, closeMinute] = scheduledDay.closeTime.split(":").map(Number);
      const openMinutes = openHour * 60 + openMinute;
      const closeMinutes = closeHour * 60 + closeMinute;
      if (scheduledMinutes < openMinutes || scheduledMinutes > closeMinutes) {
        setError(`Choose a time during posted hours for that day (${scheduledDay.openTime} - ${scheduledDay.closeTime}).`);
        return;
      }
    }

    setError("");
    setSuccessMessage("");
    try {
      await mutation.mutateAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't book that visit just yet.");
    }
  }

  return (
    <div className="min-h-screen bg-soft-gradient">
      <header className="workspace-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/account/appointments")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to account
          </Button>
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">Schedule queue</div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] bg-white p-6 text-slate-900 shadow-luxury dark:bg-slate-950 dark:text-slate-100">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Book a future visit</h1>
          </div>
          <div className="mt-6 space-y-4">
            <CachedDataNote queryKey={accountQueryKeys.scheduleBusinesses(scope.userId)} />
            <select className="w-full rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" value={businessId} onChange={(event) => { setBusinessId(event.target.value); setServiceId(""); setSuccessMessage(""); }}>
              <option value="">Choose a business</option>
              {(businessesQuery.data?.businesses ?? []).map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
            </select>
            <select className="w-full rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={!selectedBusiness}>
              <option value="">Choose a service</option>
              {(businessDetailQuery.data?.business.services ?? selectedBusiness?.serviceHighlights ?? []).filter((service) => service.supportsAppointments).map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </div>
            <textarea className="min-h-[120px] w-full rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" placeholder="Optional context for the business team..." value={notes} onChange={(event) => setNotes(event.target.value)} />
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}
            <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={handleSubmit}>{mutation.isPending ? "Scheduling..." : "Request appointment"}</Button>
            {successMessage ? (
              <Button className="w-full" variant="outline" onClick={() => navigate("/account/appointments")}>
                Open appointments
              </Button>
            ) : null}
          </div>
        </section>

        <section className="space-y-6">
          {selectedBusiness ? (
            <div className="rounded-[2rem] bg-white p-6 text-slate-900 shadow-luxury dark:bg-slate-950 dark:text-slate-100">
              <h2 className="text-xl font-bold text-slate-900">{selectedBusiness.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{selectedService?.description ?? selectedBusiness.description}</p>
              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <div>Booking horizon: {selectedBusiness.queueSettings.bookingHorizonDays} days</div>
                <div>Current estimated wait: {selectedService?.estimatedWaitMinutes ?? selectedBusiness.estimatedWaitMinutes} minutes</div>
                <div>Trust score: {selectedBusiness.trustSummary.averageRating.toFixed(1)} stars</div>
                <div>Only appointment-enabled services are available in this form.</div>
              </div>
            </div>
          ) : null}
          <div className="rounded-[2rem] bg-white p-6 text-slate-900 shadow-luxury dark:bg-slate-950 dark:text-slate-100">
            <h2 className="text-xl font-bold text-slate-900">Your appointment requests</h2>
            <div className="mt-2">
              <CachedDataNote queryKey={accountQueryKeys.myAppointments(scope.userId)} />
            </div>
            <div className="mt-4 space-y-3">
              {(appointmentsQuery.data?.appointments ?? []).map((appointment) => (
                <div key={appointment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="font-semibold text-slate-900">{appointment.businessName}</div>
                  <div className="mt-1 text-sm text-slate-600">{appointment.serviceName ?? "General service"} | {new Date(appointment.scheduledFor).toLocaleString()}</div>
                  <div className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">{appointment.status}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
