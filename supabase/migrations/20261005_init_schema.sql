-- ========================================================
-- eRAKSHAK: IoT Smart Security System
-- Supabase Schema Migration
-- ========================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. DEVICES TABLE
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_uid TEXT UNIQUE NOT NULL,
    api_key_hash TEXT NOT NULL,
    wifi_ssid TEXT DEFAULT 'ESP8266',
    local_ip TEXT,
    status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'CONNECTING')),
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. SENSOR READINGS TABLE
CREATE TABLE IF NOT EXISTS public.sensor_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    pir_detected BOOLEAN NOT NULL DEFAULT false,
    distance_cm NUMERIC(6, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. ACCESS EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.access_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    face_name TEXT,
    recognition_result TEXT NOT NULL CHECK (recognition_result IN ('AUTHORIZED', 'UNAUTHORIZED', 'UNKNOWN')),
    confidence NUMERIC(5, 4),
    distance_cm NUMERIC(6, 2),
    event_type TEXT NOT NULL DEFAULT 'FACE_VERIFICATION',
    notification_status TEXT DEFAULT 'NONE', -- e.g. 'SMS/EMAIL/CALL', 'SMS_SENT', 'FAILED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. LCD COMMANDS TABLE
CREATE TABLE IF NOT EXISTS public.lcd_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    line1 VARCHAR(16) NOT NULL,
    line2 VARCHAR(16) NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. LED COMMANDS TABLE
CREATE TABLE IF NOT EXISTS public.led_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    state TEXT NOT NULL CHECK (state IN ('ON', 'OFF')),
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. DEVICE COMMANDS TABLE
CREATE TABLE IF NOT EXISTS public.device_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    command_type TEXT NOT NULL CHECK (command_type IN ('LCD', 'LED', 'AUTHORIZED', 'UNAUTHORIZED', 'RESET')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. NOTIFICATION SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sms_enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    call_enabled BOOLEAN NOT NULL DEFAULT false,
    phone_number TEXT,
    email_address TEXT,
    cooldown_seconds INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. FACE PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.face_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. MOBILE DEVICES TABLE
CREATE TABLE IF NOT EXISTS public.mobile_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    pairing_code TEXT UNIQUE NOT NULL,
    online BOOLEAN NOT NULL DEFAULT false,
    camera_status TEXT NOT NULL DEFAULT 'NOT_READY' CHECK (camera_status IN ('READY', 'NOT_READY')),
    recognition_status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (recognition_status IN ('READY', 'BUSY', 'OFFLINE')),
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. SYSTEM LOGS TABLE
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ========================================================
-- INDEXES FOR PERFORMANCE
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_devices_owner ON public.devices(owner_id);
CREATE INDEX IF NOT EXISTS idx_devices_uid ON public.devices(device_uid);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_device ON public.sensor_readings(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_events_device ON public.access_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lcd_commands_pending ON public.lcd_commands(device_id, processed);
CREATE INDEX IF NOT EXISTS idx_led_commands_pending ON public.led_commands(device_id, processed);
CREATE INDEX IF NOT EXISTS idx_device_commands_pending ON public.device_commands(device_id, processed);
CREATE INDEX IF NOT EXISTS idx_mobile_pairing ON public.mobile_devices(pairing_code);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lcd_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.led_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users read & update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Devices: user owns the device
CREATE POLICY "Users can view own devices" ON public.devices
    FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own devices" ON public.devices
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own devices" ON public.devices
    FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own devices" ON public.devices
    FOR DELETE USING (auth.uid() = owner_id);

-- Sensor readings: owner of the device can view
CREATE POLICY "Users can view readings of their devices" ON public.sensor_readings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.devices 
            WHERE devices.id = sensor_readings.device_id AND devices.owner_id = auth.uid()
        )
    );

-- Access events: owner of device can view & delete
CREATE POLICY "Users can view events of their devices" ON public.access_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.devices 
            WHERE devices.id = access_events.device_id AND devices.owner_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete events of their devices" ON public.access_events
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.devices 
            WHERE devices.id = access_events.device_id AND devices.owner_id = auth.uid()
        )
    );

-- LCD commands: owner of device
CREATE POLICY "Users can manage LCD commands for their devices" ON public.lcd_commands
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.devices 
            WHERE devices.id = lcd_commands.device_id AND devices.owner_id = auth.uid()
        )
    );

-- LED commands: owner of device
CREATE POLICY "Users can manage LED commands for their devices" ON public.led_commands
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.devices 
            WHERE devices.id = led_commands.device_id AND devices.owner_id = auth.uid()
        )
    );

-- Device commands: owner of device
CREATE POLICY "Users can manage device commands for their devices" ON public.device_commands
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.devices 
            WHERE devices.id = device_commands.device_id AND devices.owner_id = auth.uid()
        )
    );

-- Notification settings: owner can view and update
CREATE POLICY "Users can view own notification settings" ON public.notification_settings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification settings" ON public.notification_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification settings" ON public.notification_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Face profiles: owner can view and manage
CREATE POLICY "Users can manage own face profiles" ON public.face_profiles
    FOR ALL USING (auth.uid() = owner_id);

-- Mobile devices: owner can view and manage
CREATE POLICY "Users can manage own mobile devices" ON public.mobile_devices
    FOR ALL USING (auth.uid() = owner_id);

-- System logs: owner can view logs related to them
CREATE POLICY "Users can view own system logs" ON public.system_logs
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.devices 
            WHERE devices.id = system_logs.device_id AND devices.owner_id = auth.uid()
        )
    );

-- ========================================================
-- AUTOMATIC USER PROFILE & NOTIFICATION SETTINGS CREATION
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        new.email
    );

    INSERT INTO public.notification_settings (user_id, email_address, sms_enabled, email_enabled, call_enabled, cooldown_seconds)
    VALUES (
        new.id,
        new.email,
        true,
        true,
        false,
        60
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================================
-- REALTIME SUBSCRIPTIONS
-- ========================================================
-- Enable Supabase Realtime on critical tables
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
    EXCEPTION WHEN duplicate_object THEN END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;
    EXCEPTION WHEN duplicate_object THEN END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.access_events;
    EXCEPTION WHEN duplicate_object THEN END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lcd_commands;
    EXCEPTION WHEN duplicate_object THEN END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.led_commands;
    EXCEPTION WHEN duplicate_object THEN END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_devices;
    EXCEPTION WHEN duplicate_object THEN END;
END $$;
