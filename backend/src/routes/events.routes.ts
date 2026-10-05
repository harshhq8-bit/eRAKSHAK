import { Router, Response } from 'express';
import { getSupabase } from '../services/supabaseService.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/events - Paginated access events (10 per page)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt((req.query.page as string) || '1', 10);
  const pageSize = parseInt((req.query.pageSize as string) || '10', 10);
  const deviceId = req.query.deviceId as string | undefined;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = getSupabase();

  try {
    let query = supabase
      .from('access_events')
      .select('*, devices!inner(owner_id, device_name)', { count: 'exact' })
      .eq('devices.owner_id', req.user!.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data: events, count, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      events: events || [],
      totalCount: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch access events: ' + err.message });
  }
});

// DELETE /api/events/:id - Delete an access event with ownership verification
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const supabase = getSupabase();

  try {
    // Check ownership
    const { data: event, error: findErr } = await supabase
      .from('access_events')
      .select('*, devices!inner(owner_id)')
      .eq('id', id)
      .maybeSingle();

    if (findErr || !event) {
      res.status(404).json({ error: 'Access event not found' });
      return;
    }

    if (event.devices.owner_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized to delete this event' });
      return;
    }

    const { error: delErr } = await supabase
      .from('access_events')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    // Log deletion
    await supabase.from('system_logs').insert({
      user_id: req.user!.id,
      device_id: event.device_id,
      event: 'ACCESS_EVENT_DELETED',
      metadata: { deletedEventId: id },
    });

    res.json({
      success: true,
      message: 'Access event deleted successfully',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete event: ' + err.message });
  }
});

export default router;
