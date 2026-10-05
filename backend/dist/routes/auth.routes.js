"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabaseService_js_1 = require("../services/supabaseService.js");
const router = (0, express_1.Router)();
// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
        res.status(400).json({ error: 'Name, email, and password are required' });
        return;
    }
    const supabase = (0, supabaseService_js_1.getSupabase)();
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name },
            },
        });
        if (error) {
            res.status(400).json({ error: error.message });
            return;
        }
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: data.user,
            session: data.session,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
});
exports.default = router;
