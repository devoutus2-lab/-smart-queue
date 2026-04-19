import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BusinessCategory } from "@shared/api";
import { useSearchParams } from "react-router-dom";
import { useSession } from "@/context/SessionContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { accountQueryKeys, getAccountScope } from "@/lib/accountQueryKeys";
import { api } from "@/lib/api";

export const accountBusinessCategories: BusinessCategory[] = [
  "restaurant",
  "bank",
  "hospital",
  "government",
  "salon",
  "retail",
];

export function useAccountBusinessDirectory({
  includeMarkers = false,
}: {
  includeMarkers?: boolean;
} = {}) {
  const { user } = useSession();
  const scope = getAccountScope(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const geo = useGeolocation();

  const search = searchParams.get("q") ?? "";
  const category = (searchParams.get("category") as BusinessCategory | "") ?? "";
  const rawServiceId = searchParams.get("serviceId") ?? "";
  const serviceId = rawServiceId ? Number(rawServiceId) : "";
  const openNow = searchParams.get("openNow") === "true";
  const favoritesOnly = searchParams.get("favoritesOnly") === "true";
  const savedOnly = searchParams.get("savedOnly") === "true";
  const sort = (searchParams.get("sort") as "recommended" | "distance" | "rating" | "wait" | null) ?? "recommended";

  const updateSearchParams = (updates: Record<string, string | number | boolean | null | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      const empty = value == null || value === "" || value === false;
      if (empty) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setSearchParams(next, { replace: true });
  };

  const query = useMemo(
    () => ({
      q: search || undefined,
      category: category || undefined,
      serviceId: serviceId || undefined,
      openNow: openNow || undefined,
      favoritesOnly: favoritesOnly || undefined,
      savedOnly: savedOnly || undefined,
      sort,
      lat: geo.latitude,
      lng: geo.longitude,
    }),
    [category, favoritesOnly, geo.latitude, geo.longitude, openNow, savedOnly, search, serviceId, sort],
  );

  const businessesQuery = useQuery({
    queryKey: accountQueryKeys.accountBusinesses(scope.userId, query),
    queryFn: () => api.getBusinesses(query),
  });

  const markersQuery = useQuery({
    queryKey: accountQueryKeys.accountBusinessMarkers(scope.userId, query),
    queryFn: () => api.getBusinessMarkers(query),
    enabled: includeMarkers,
  });

  const serviceOptions = useMemo(() => {
    const businesses = businessesQuery.data?.businesses ?? [];
    const allServices = businesses.flatMap((business) =>
      business.serviceHighlights.map((service) => ({ id: service.id, name: service.name })),
    );
    return allServices.filter((service, index, list) => list.findIndex((item) => item.id === service.id) === index);
  }, [businessesQuery.data?.businesses]);

  return {
    geo,
    search,
    setSearch: (value: string) => updateSearchParams({ q: value, page: null }),
    category,
    setCategory: (value: BusinessCategory | "") => updateSearchParams({ category: value, page: null }),
    serviceId,
    setServiceId: (value: number | "") => updateSearchParams({ serviceId: value || null, page: null }),
    openNow,
    setOpenNow: (value: boolean | ((current: boolean) => boolean)) =>
      updateSearchParams({ openNow: typeof value === "function" ? value(openNow) : value, page: null }),
    favoritesOnly,
    setFavoritesOnly: (value: boolean | ((current: boolean) => boolean)) =>
      updateSearchParams({ favoritesOnly: typeof value === "function" ? value(favoritesOnly) : value, page: null }),
    savedOnly,
    setSavedOnly: (value: boolean | ((current: boolean) => boolean)) =>
      updateSearchParams({ savedOnly: typeof value === "function" ? value(savedOnly) : value, page: null }),
    sort,
    setSort: (value: "recommended" | "distance" | "rating" | "wait") => updateSearchParams({ sort: value, page: null }),
    businessesQuery,
    markersQuery,
    serviceOptions,
    categories: accountBusinessCategories,
    currentSearchParams: searchParams,
  };
}
