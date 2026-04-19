import { MapPin, Route, TimerReset } from "lucide-react";
import type { BusinessMapMarker } from "@shared/api";

function buildMapLink(latitude: number, longitude: number) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}

function getMarkerLayout(markers: BusinessMapMarker[]) {
  if (markers.length === 0) return [];

  const latitudes = markers.map((marker) => marker.latitude);
  const longitudes = markers.map((marker) => marker.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.02);
  const lngRange = Math.max(maxLng - minLng, 0.02);

  return markers.map((marker) => {
    const x = 14 + ((marker.longitude - minLng) / lngRange) * 72;
    const y = 18 + (1 - (marker.latitude - minLat) / latRange) * 60;
    return {
      marker,
      x,
      y,
    };
  });
}

function MapCanvas({
  markers,
  userLocation,
  compact = false,
}: {
  markers: BusinessMapMarker[];
  userLocation?: { latitude?: number; longitude?: number };
  compact?: boolean;
}) {
  const positionedMarkers = getMarkerLayout(markers);

  return (
    <div
      className={`relative overflow-hidden rounded-[1.8rem] border border-blue-200/70 bg-[radial-gradient(circle_at_top,#3f6fd8_0%,#18325a_35%,#0f172a_100%)] shadow-[0_24px_70px_-34px_rgba(15,23,42,0.9)] dark:border-slate-700 ${
        compact ? "aspect-[1.15/1]" : "min-h-[24rem]"
      }`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_36%),radial-gradient(circle_at_80%_18%,rgba(250,204,21,0.14),transparent_28%),radial-gradient(circle_at_55%_82%,rgba(96,165,250,0.14),transparent_30%)]" />
      <div className="absolute left-[10%] top-[18%] h-[34%] w-[38%] rounded-full bg-emerald-400/12 blur-2xl" />
      <div className="absolute bottom-[10%] right-[8%] h-[28%] w-[30%] rounded-full bg-blue-300/12 blur-2xl" />

      {userLocation?.latitude != null && userLocation?.longitude != null ? (
        <div className="absolute bottom-5 left-5 rounded-full border border-white/20 bg-slate-950/40 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-blue-100">
          YOU ARE HERE
        </div>
      ) : null}

      {positionedMarkers.map(({ marker, x, y }) => (
        <a
          key={`${marker.id}-${marker.slug}`}
          className="group absolute"
          href={buildMapLink(marker.latitude, marker.longitude)}
          rel="noreferrer"
          style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
          target="_blank"
        >
          <div className="relative">
            <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/20 blur-md transition group-hover:bg-amber-200/30" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/15 text-white shadow-lg backdrop-blur-sm transition group-hover:-translate-y-1 group-hover:bg-white/25">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-3 hidden w-48 -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-950/85 p-3 text-white shadow-xl backdrop-blur-md group-hover:block">
              <div className="truncate text-sm font-semibold">{marker.name}</div>
              <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200">{marker.category}</div>
              <div className="mt-2 text-xs leading-5 text-slate-200">About {marker.estimatedWaitMinutes} min wait</div>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

export function BusinessMap({
  markers,
  userLocation,
  variant = "default",
}: {
  markers: BusinessMapMarker[];
  userLocation?: { latitude?: number; longitude?: number };
  variant?: "default" | "compact";
}) {
  const visibleMarkers = variant === "compact" ? markers.slice(0, 4) : markers;

  if (variant === "compact") {
    return (
      <div className="overflow-hidden rounded-[1.8rem] border border-blue-200 bg-white shadow-luxury dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-amber-50 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
                <MapPin className="h-4 w-4" />
                Nearby view
              </div>
              <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">Quick location snapshot</h3>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
              {markers.length} places
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Nearby view now lives in the map route, so you can scan the area and open directions without jumping between screens.
          </p>
        </div>

        <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <MapCanvas compact markers={visibleMarkers} userLocation={userLocation} />

          <div className="space-y-3">
            {visibleMarkers.map((marker) => (
              <a
                key={`${marker.id}-${marker.slug}`}
                className="block rounded-[1.35rem] border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800"
                href={buildMapLink(marker.latitude, marker.longitude)}
                rel="noreferrer"
                target="_blank"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900 dark:text-slate-100">{marker.name}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{marker.category}</div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${marker.isOpenNow ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                    {marker.isOpenNow ? "Open now" : "Closed"}
                  </div>
                </div>
                <div className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <TimerReset className="h-4 w-4 text-blue-500" />
                  About {marker.estimatedWaitMinutes} min
                </div>
              </a>
            ))}
            {!visibleMarkers.length ? (
              <div className="rounded-[1.35rem] border border-dashed border-slate-200 p-5 text-sm leading-6 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No places match the current search yet. Try a broader search or clear one filter.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-blue-200 bg-white shadow-luxury dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-amber-50 px-5 py-5 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
          <MapPin className="h-4 w-4" />
          Exact location and directions
        </div>
        <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">See the place on a visible map before you leave.</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Use the live map canvas to compare visible stops, open directions, and spot the place faster without guessing from a plain list.
        </p>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
        <MapCanvas markers={visibleMarkers} userLocation={userLocation} />

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">Your current spot</div>
            <div className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {userLocation?.latitude != null && userLocation?.longitude != null
                ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
                : "Turn on location if you want Smart Queue to compare travel time with the current queue estimate."}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50/80 p-5 dark:border-slate-800 dark:bg-slate-900/80">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600">Visible places</div>
            <div className="mt-3 text-4xl font-bold text-slate-900 dark:text-slate-100">{visibleMarkers.length}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Hover a pin for quick context, then open directions when you are ready to move.
            </div>
          </div>

          {visibleMarkers.map((marker) => (
            <a
              key={`${marker.id}-${marker.slug}`}
              className="block rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-slate-800"
              href={buildMapLink(marker.latitude, marker.longitude)}
              rel="noreferrer"
              target="_blank"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{marker.name}</div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{marker.category}</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${marker.isOpenNow ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                  {marker.isOpenNow ? "Open now" : "Closed"}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white px-4 py-3 text-sm dark:bg-slate-950">
                  <div className="inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <TimerReset className="h-4 w-4 text-blue-500" />
                    Wait signal
                  </div>
                  <div className="mt-2 text-slate-600 dark:text-slate-300">About {marker.estimatedWaitMinutes} min right now</div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm dark:bg-slate-950">
                  <div className="inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <Route className="h-4 w-4 text-blue-500" />
                    Next step
                  </div>
                  <div className="mt-2 text-slate-600 dark:text-slate-300">Open directions and compare this stop with your day.</div>
                </div>
              </div>
            </a>
          ))}

          {!visibleMarkers.length ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 p-6 text-sm leading-6 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No places match the current search yet. Try a broader search or clear one filter to bring more locations into view.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
