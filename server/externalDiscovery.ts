import type { BusinessCategory, ExternalBusinessDetail, ExternalBusinessSummary, QueueSettings } from "../shared/api";

type ExternalSeed = {
  placeId: string;
  name: string;
  category: BusinessCategory;
  description: string;
  address: string;
  phone: string;
  email: string | null;
  websiteUrl: string | null;
  latitude: number;
  longitude: number;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  tags: string[];
};

const EXTERNAL_QUEUE_SETTINGS: QueueSettings = {
  averageServiceMinutes: 15,
  maxSkips: 0,
  maxReschedules: 0,
  pauseLimitMinutes: 30,
  bookingHorizonDays: 14,
  isQueueOpen: false,
};

const EXTERNAL_DIRECTORY: ExternalSeed[] = [
  {
    placeId: "ext-sunset-bills-center",
    name: "Sunset Bills Center",
    category: "government",
    description: "A payment and inquiry center for utilities, permits, and billing support.",
    address: "29 Sunset Avenue, Manila",
    phone: "+63 2 8123 4500",
    email: "hello@sunsetbills.example",
    websiteUrl: "https://sunsetbills.example",
    latitude: 14.5995,
    longitude: 120.9842,
    rating: 4.2,
    reviewsCount: 143,
    imageUrl: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80",
    tags: ["bills", "payments", "inquiries"],
  },
  {
    placeId: "ext-harbor-grill",
    name: "Harbor Grill House",
    category: "restaurant",
    description: "A busy restaurant known for dinner rushes, walk-ins, and family seating.",
    address: "100 Harbor Road, Pasay",
    phone: "+63 2 8555 0100",
    email: null,
    websiteUrl: "https://harborgrill.example",
    latitude: 14.5378,
    longitude: 120.9994,
    rating: 4.6,
    reviewsCount: 382,
    imageUrl: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
    tags: ["restaurant", "dinner", "family"],
  },
  {
    placeId: "ext-northpoint-clinic",
    name: "Northpoint Family Clinic",
    category: "hospital",
    description: "A local clinic with consultations, diagnostics, and walk-in family care.",
    address: "48 Northpoint Street, Quezon City",
    phone: "+63 2 8731 2200",
    email: "care@northpoint.example",
    websiteUrl: "https://northpoint.example",
    latitude: 14.676,
    longitude: 121.0437,
    rating: 4.4,
    reviewsCount: 217,
    imageUrl: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=80",
    tags: ["clinic", "health", "consultation"],
  },
];

function guessCategoryFromTypes(types: string[] = []): BusinessCategory {
  const haystack = types.join(" ").toLowerCase();
  if (haystack.includes("restaurant") || haystack.includes("food")) return "restaurant";
  if (haystack.includes("bank") || haystack.includes("finance")) return "bank";
  if (haystack.includes("hospital") || haystack.includes("doctor") || haystack.includes("health")) return "hospital";
  if (haystack.includes("government") || haystack.includes("city_hall")) return "government";
  if (haystack.includes("beauty") || haystack.includes("salon")) return "salon";
  return "retail";
}

function createSummary(seed: ExternalSeed): ExternalBusinessSummary {
  return {
    id: 0,
    slug: seed.placeId,
    name: seed.name,
    category: seed.category,
    description: seed.description,
    address: seed.address,
    phone: seed.phone,
    email: seed.email,
    latitude: seed.latitude,
    longitude: seed.longitude,
    rating: seed.rating,
    reviewsCount: seed.reviewsCount,
    imageUrl: seed.imageUrl,
    websiteUrl: seed.websiteUrl,
    tags: seed.tags,
    source: "external",
    externalProvider: { provider: "google_places", placeId: seed.placeId },
    linkedBusinessId: null,
    capabilities: {
      supportsRemoteQueue: false,
      supportsAppointments: false,
      isClaimable: true,
    },
    isOpenNow: true,
    distanceKm: null,
    favoritesCount: 0,
    activeQueueCount: 0,
    estimatedWaitMinutes: 0,
    isFavorite: false,
    isSaved: false,
    queueSettings: EXTERNAL_QUEUE_SETTINGS,
    serviceHighlights: [],
    trustSummary: {
      averageRating: seed.rating,
      totalReviews: seed.reviewsCount,
      recentFeedback: [],
    },
  };
}

function createDetail(seed: ExternalSeed): ExternalBusinessDetail {
  return {
    ...createSummary(seed),
    hours: [],
    currentServingQueueEntryId: null,
    services: [],
    counters: [],
    notices: [],
    bestTimeWindows: [],
    recommendedDepartureMinutes: null,
    subscription: null,
  };
}

function searchFallback(query: string) {
  const needle = query.toLowerCase();
  return EXTERNAL_DIRECTORY.filter((item) =>
    [item.name, item.description, item.address, ...item.tags].join(" ").toLowerCase().includes(needle),
  ).map(createSummary);
}

function detailFallback(placeId: string) {
  const seed = EXTERNAL_DIRECTORY.find((item) => item.placeId === placeId);
  return seed ? createDetail(seed) : null;
}

async function googleTextSearch(query: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);
  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const json = (await response.json()) as { results?: Array<any> };
  return (json.results ?? []).slice(0, 8).map((item) => {
    const category = guessCategoryFromTypes(item.types);
    const placeId = item.place_id as string;
    const seed: ExternalSeed = {
      placeId,
      name: item.name ?? "Business",
      category,
      description: `${item.name ?? "This business"} is available on the map with location and contact details. Bring it to Smart Queue to unlock remote queueing and booking.`,
      address: item.formatted_address ?? "Address not available",
      phone: item.formatted_phone_number ?? item.international_phone_number ?? "Phone not available",
      email: null,
      websiteUrl: null,
      latitude: item.geometry?.location?.lat ?? 0,
      longitude: item.geometry?.location?.lng ?? 0,
      rating: item.rating ?? 0,
      reviewsCount: item.user_ratings_total ?? 0,
      imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
      tags: (item.types ?? []).slice(0, 4),
    };
    return createSummary(seed);
  });
}

async function googlePlaceDetail(placeId: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,geometry,rating,user_ratings_total,types",
  );
  url.searchParams.set("key", apiKey);
  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const json = (await response.json()) as { result?: any };
  const item = json.result;
  if (!item) return null;
  const seed: ExternalSeed = {
    placeId,
    name: item.name ?? "Business",
    category: guessCategoryFromTypes(item.types),
    description: `${item.name ?? "This business"} was found through Google Places. Claim or import it into Smart Queue to offer remote queueing, appointments, and business messaging.`,
    address: item.formatted_address ?? "Address not available",
    phone: item.formatted_phone_number ?? item.international_phone_number ?? "Phone not available",
    email: null,
    websiteUrl: item.website ?? null,
    latitude: item.geometry?.location?.lat ?? 0,
    longitude: item.geometry?.location?.lng ?? 0,
    rating: item.rating ?? 0,
    reviewsCount: item.user_ratings_total ?? 0,
    imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    tags: (item.types ?? []).slice(0, 4),
  };
  return createDetail(seed);
}

export async function searchExternalBusinesses(query: string) {
  const googleResults = await googleTextSearch(query);
  return googleResults ?? searchFallback(query);
}

export async function getExternalBusinessDetail(placeId: string) {
  const googleResult = await googlePlaceDetail(placeId);
  return googleResult ?? detailFallback(placeId);
}
