import { useEffect, useState } from "react";
import { useAuth } from "../../features/auth/AuthContext";
import { getCurrentLocation, isLocationEnabled } from "./locationService";

interface LocationFormState {
  latitude: number | null;
  longitude: number | null;
  suggestions: string[];
  loadingSuggestions: boolean;
}

export function useLocationForm(locationTrackingEnabled: boolean) {
  const { api } = useAuth();
  const [state, setState] = useState<LocationFormState>({
    latitude: null,
    longitude: null,
    suggestions: [],
    loadingSuggestions: false
  });

  // Fetch location and suggestions on mount
  useEffect(() => {
    if (!locationTrackingEnabled) {
      return;
    }

    fetchLocationAndSuggestions();
  }, [locationTrackingEnabled]);

  async function fetchLocationAndSuggestions() {
    const enabled = await isLocationEnabled();
    if (!enabled) {
      return;
    }

    try {
      const location = await getCurrentLocation();
      if (!location) {
        return;
      }

      setState((prev) => ({
        ...prev,
        latitude: location.latitude,
        longitude: location.longitude
      }));

      // Fetch suggestions
      setState((prev) => ({ ...prev, loadingSuggestions: true }));
      try {
        const response = await api.get<{ suggestions: string[] }>(
          `/api/expenses/location-suggestions/?latitude=${location.latitude}&longitude=${location.longitude}&radius=100`
        );
        setState((prev) => ({
          ...prev,
          suggestions: response.suggestions || [],
          loadingSuggestions: false
        }));
      } catch {
        setState((prev) => ({ ...prev, loadingSuggestions: false }));
      }
    } catch {
      // Location access failed, continue without location
    }
  }

  return {
    ...state,
    refetchLocation: fetchLocationAndSuggestions
  };
}
