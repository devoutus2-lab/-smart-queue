import { useEffect, useState } from "react";

type GeolocationState = {
  latitude?: number;
  longitude?: number;
  error?: string;
};

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({});

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState({ error: "Geolocation is not available in this browser." });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setState({ error: "Location permission denied. Distance sorting is unavailable." });
      },
      { enableHighAccuracy: true, maximumAge: 60_000 },
    );
  }, []);

  return state;
}
