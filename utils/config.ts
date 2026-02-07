/**
 * Environment configuration for frontend
 * Reads VITE_BACKEND_URL to decide whether to use real backend or mock
 */

const RAW_API_BASE = import.meta.env.VITE_BACKEND_URL || '';
const API_BASE = RAW_API_BASE || (import.meta.env.PROD ? '/api' : '');
const USE_BACKEND = !!API_BASE;

export { API_BASE, USE_BACKEND };
