// Loads the Google Maps JavaScript API script once and shares the promise
// across every caller, so multiple map components on the same page don't
// each inject their own <script> tag.
let loadPromise: Promise<typeof google> | null = null;

// Advanced markers only draw on a map with a Map ID (Google Cloud console →
// Map Management). DEMO_MAP_ID is Google's stand-in until one is set.
export const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || "DEMO_MAP_ID";

export function loadGoogleMaps(): Promise<typeof google> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!apiKey) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.Geocoder) {
      resolve(window.google);
      return;
    }
    // Deliberately omit loading=async: with it, onload fires once the base
    // loader is ready but before the `libraries=geocoding,marker` chunks finish,
    // so google.maps.Geocoder isn't guaranteed to exist yet. The classic
    // synchronous mode blocks onload until every requested library is loaded.
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geocoding,marker`;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loadPromise;
}
