import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabaseService.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const supabase = getSupabase();

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
  } catch (err: any) {
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

export default router;
