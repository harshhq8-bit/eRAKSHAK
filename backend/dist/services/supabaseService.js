"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabase = getSupabase;
const supabase_js_1 = require("@supabase/supabase-js");
const env_js_1 = require("../config/env.js");
let supabaseClient = null;
function getSupabase() {
    if (supabaseClient) {
        return supabaseClient;
    }
    if (!env_js_1.ENV.SUPABASE_URL || !env_js_1.ENV.SUPABASE_SERVICE_ROLE_KEY || env_js_1.ENV.SUPABASE_URL.includes('placeholder')) {
        console.warn('[Supabase] Warning: Valid SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not yet configured in .env');
    }
    // Create client (with dummy fallback if missing, to prevent crash on startup before user configures .env)
    supabaseClient = (0, supabase_js_1.createClient)(env_js_1.ENV.SUPABASE_URL || 'https://placeholder.supabase.co', env_js_1.ENV.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key', {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
    return supabaseClient;
}
