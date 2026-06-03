/**
 * Returns the base URL of the backend API.
 * The port is injected by Vite from VITE_BACKEND_PORT (written by run.bat).
 * Falls back to 8005 for local development when the env var is absent.
 */
export function getBackendURL() {
    const port = import.meta.env.VITE_BACKEND_PORT || '8005';
    return `http://${window.location.hostname}:${port}`;
}
