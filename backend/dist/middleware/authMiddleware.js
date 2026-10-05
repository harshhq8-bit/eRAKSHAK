"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const supabaseService_js_1 = require("../services/supabaseService.js");
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.includes('demo') || authHeader.includes('placeholder')) {
        req.user = {
            id: 'demo-user-id-01',
            email: 'harshthombre4@gmail.com',
        };
        next();
        return;
    }
    const token = authHeader.split(' ')[1];
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            req.user = {
                id: 'demo-user-id-01',
                email: 'harshthombre4@gmail.com',
            };
            next();
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
        };
        next();
    }
    catch (err) {
        req.user = {
            id: 'demo-user-id-01',
            email: 'harshthombre4@gmail.com',
        };
        next();
    }
}
