/**
 * Environment configuration for frontend
 * Reads VITE_BACKEND_URL to decide whether to use real backend or mock
 */

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';
const USE_BACKEND = !!API_BASE;

export { API_BASE, USE_BACKEND };
