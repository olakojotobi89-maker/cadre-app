        -- CADRE Supabase schema for channel operations, officer assignments, incident feed and distress alerts

        create table if not exists channels (
        id uuid primary key default gen_random_uuid(),
        key text not null unique,
        name text not null,
        callsign text,
        frequency text,
        status text not null default 'quiet',
        is_disabled boolean not null default false,
        is_locked boolean not null default false,
        is_archived boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
        );

        create table if not exists users (
                id uuid primary key default gen_random_uuid(),
                phone text unique,
                email text unique,
                name text,
                rank text,
                role text,
                pfp text,
                status text,
                last_seen timestamptz,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now()
        );

        create table if not exists patrol_groups (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        lead_user_id uuid references users(id) on delete set null,
        created_at timestamptz not null default now()
        );

        create table if not exists officer_assignments (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references users(id) on delete cascade,
        channel_id uuid references channels(id) on delete set null,
        patrol_group_id uuid references patrol_groups(id) on delete set null,
        status text not null default 'online',
        last_seen timestamptz,
        updated_at timestamptz not null default now(),
        unique (user_id)
        );

        create table if not exists incident_feed (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz not null default now(),
        category text not null default 'system',
        message text not null,
        channel_id uuid references channels(id) on delete set null,
        officer_id uuid references users(id) on delete set null,
        metadata jsonb
        );

        create table if not exists distress_alerts (
        id uuid primary key default gen_random_uuid(),
        officer_id uuid references users(id) on delete set null,
        channel_id uuid references channels(id) on delete set null,
        latitude numeric,
        longitude numeric,
        status text not null default 'active',
        severity text not null default 'high',
        description text,
        acknowledged_by uuid references users(id) on delete set null,
        escalated_by uuid references users(id) on delete set null,
        resolved_by uuid references users(id) on delete set null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
        );

        create table if not exists voice_preferences (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references users(id) on delete cascade,
        channel_key text not null,
        listen_enabled boolean not null default false,
        muted boolean not null default false,
        updated_at timestamptz not null default now(),
        unique(user_id, channel_key)
        );

        -- Optional role support for users table if not already present
        alter table users
        add column if not exists role text,
        add column if not exists status text,
        add column if not exists last_seen timestamptz;

        -- Realtime-safe policies (adjust claim logic to your auth setup)
        alter table channels enable row level security;
        drop policy if exists "select channels" on channels;
        create policy "select channels" on channels
        for select using (auth.role() = 'authenticated');
                                drop policy if exists "manage channels" on channels;
                                create policy "manage_channels_insert" on channels
                                        for insert with check (auth.role() = 'authenticated');
                                create policy "manage_channels_update" on channels
                                        for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
                                create policy "manage_channels_delete" on channels
                                        for delete using (auth.role() = 'authenticated');

        alter table officer_assignments enable row level security;
        drop policy if exists "select assignments" on officer_assignments;
        create policy "select assignments" on officer_assignments
        for select using (auth.role() = 'authenticated');
                                drop policy if exists "manage assignments" on officer_assignments;
                                create policy "manage_assignments_insert" on officer_assignments
                                        for insert with check (auth.role() = 'authenticated');
                                create policy "manage_assignments_update" on officer_assignments
                                        for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
                                create policy "manage_assignments_delete" on officer_assignments
                                        for delete using (auth.role() = 'authenticated');

        alter table incident_feed enable row level security;
        drop policy if exists "public feed" on incident_feed;
        create policy "public feed" on incident_feed
        for select using (auth.role() = 'authenticated');
                                drop policy if exists "feed insert" on incident_feed;
                                create policy "feed_insert" on incident_feed
                                        for insert with check (auth.role() = 'authenticated');

        alter table distress_alerts enable row level security;
        drop policy if exists "public distress" on distress_alerts;
        create policy "public distress" on distress_alerts
        for select using (auth.role() = 'authenticated');
                                drop policy if exists "manage distress" on distress_alerts;
                                create policy "manage_distress_insert" on distress_alerts
                                        for insert with check (auth.role() = 'authenticated');
                                create policy "manage_distress_update" on distress_alerts
                                        for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
                                create policy "manage_distress_delete" on distress_alerts
                                        for delete using (auth.role() = 'authenticated');

        alter table voice_preferences enable row level security;
        drop policy if exists "select voice prefs" on voice_preferences;
        create policy "select voice prefs" on voice_preferences
        for select using (auth.role() = 'authenticated');
                                drop policy if exists "manage voice prefs" on voice_preferences;
                                create policy "manage_voice_prefs_insert" on voice_preferences
                                        for insert with check (auth.role() = 'authenticated');
                                create policy "manage_voice_prefs_update" on voice_preferences
                                        for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
                                create policy "manage_voice_prefs_delete" on voice_preferences
                                        for delete using (auth.role() = 'authenticated');

        -- Users table RLS policies
        alter table users enable row level security;
        drop policy if exists "select users" on users;
        create policy "select users" on users
        for select using (auth.role() = 'authenticated');
                                drop policy if exists "insert user profile" on users;
                                create policy "insert user profile" on users
                                        for insert with check (auth.role() = 'authenticated');
                                drop policy if exists "update own user" on users;
                                create policy "update own user" on users
                                        for update using (auth.uid() = id) with check (auth.uid() = id);
                                drop policy if exists "delete own user" on users;
                                create policy "delete own user" on users
                                        for delete using (auth.uid() = id);
