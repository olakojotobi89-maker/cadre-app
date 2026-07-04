/* ─────────────────────────────────────────────
   SUPABASE
   The publishable key is safe for the browser. We keep session
   persistence ON so auth.uid() is available to RLS policies,
   otherwise all RLS-protected tables will return HTTP 400.
───────────────────────────────────────────── */
const CADRE_SUPABASE_URL = 'https://ihroattnnnsckvvbosfz.supabase.co';
const CADRE_SUPABASE_KEY = 'sb_publishable_M0wwGKR9he08sEfHhZQQxA_vmnXS2eX';

function cadreBuildSupabaseAuthConfig() {
  return {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  };
}

function createCadreSupabaseClient() {
  try {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      console.error('[CADRE] Supabase SDK failed to load from CDN.');
      return null;
    }
    const client = supabase.createClient(CADRE_SUPABASE_URL, CADRE_SUPABASE_KEY, {
      auth: cadreBuildSupabaseAuthConfig(),
      global: {
        headers: { 'x-application-name': 'cadre-web' }
      }
    });
    if (!client) {
      console.error('[CADRE] Supabase client could not be created.');
    }
    return client;
  } catch (err) {
    console.error('[CADRE] Supabase init threw:', err);
    return null;
  }
}

const CADRE_SB = createCadreSupabaseClient();
window.CADRE_SB = CADRE_SB;
window.createCadreSupabaseClient = createCadreSupabaseClient;
window.cadreSafeSupabaseQuery = cadreSafeSupabaseQuery;
window.cadreResolveCurrentUser = cadreResolveCurrentUser;

async function cadreSafeSupabaseQuery(context, request, fallback = { data: null, error: null }, options = {}) {
  if (!request || typeof request.then !== 'function') {
    return { data: fallback?.data ?? null, error: fallback?.error ?? null };
  }

  const retries = Math.max(0, Number(options.retries ?? 2));
  const retryDelayMs = Math.max(100, Number(options.retryDelayMs ?? 250));
  const redirectPath = options.redirectPath || 'index.html';

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await request;
      if (response?.error) {
        const error = response.error;
        const isAuthFailure = error?.status === 401 || error?.status === 403 || error?.code === 'PGRST301' || error?.code === '42501';
        const isRetryable = !isAuthFailure && (error?.status >= 500 || error?.status === 0 || /network|timeout|fetch/i.test(String(error?.message || '')));

        if (isRetryable && attempt < retries) {
          attempt += 1;
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue;
        }

        if (error && typeof cadreLogError === 'function') {
          cadreLogError(context, error);
        }

        return {
          data: response?.data ?? fallback?.data ?? null,
          error
        };
      }

      return {
        data: response?.data ?? fallback?.data ?? null,
        error: null
      };
    } catch (err) {
      const isRetryable = /network|timeout|fetch|Failed to fetch/i.test(String(err?.message || err));
      if (isRetryable && attempt < retries) {
        attempt += 1;
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }

      if (typeof cadreLogError === 'function') {
        cadreLogError(context, err);
      }

      return {
        data: fallback?.data ?? null,
        error: err
      };
    }
  }

  return { data: fallback?.data ?? null, error: fallback?.error ?? null };
}

const CADRE_AGORA_APP_ID = '8f88034e0a9545868b55af604b268e1e';
const CADRE_ROLE_PERMISSIONS = {
  super_admin: {
    broadcast: true,
    manage_channels: true,
    manage_officers: true,
    assign_patrols: true,
    acknowledge: true,
    escalate: true,
    recordings: true
  },
  command_officer: {
    broadcast: true,
    manage_channels: true,
    manage_officers: true,
    assign_patrols: true,
    acknowledge: true,
    escalate: true,
    recordings: true
  },
  operations_officer: {
    broadcast: true,
    manage_channels: false,
    manage_officers: true,
    assign_patrols: true,
    acknowledge: true,
    escalate: false,
    recordings: true
  },
  patrol_officer: {
    broadcast: true,
    manage_channels: false,
    manage_officers: false,
    assign_patrols: false,
    acknowledge: false,
    escalate: false,
    recordings: false
  }
};

function cadreEscHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cadreFormatTime(value, opts = {}) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString('en-GB', { hour12: false, ...opts });
}

function cadreShowToast(message, type = 'success') {
  const existing = document.querySelector('.cadre-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `cadre-toast ${type}`;
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.padding = '12px 16px';
  toast.style.borderRadius = '12px';
  toast.style.background = type === 'error' ? 'rgba(204,26,26,0.96)' : type === 'warning' ? 'rgba(204,170,0,0.96)' : 'rgba(0,0,0,0.88)';
  toast.style.color = '#fff';
  toast.style.zIndex = '99999';
  toast.style.boxShadow = '0 12px 34px rgba(0,0,0,0.35)';
  toast.style.fontFamily = 'Courier New, Courier, monospace';
  toast.style.fontSize = '12px';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity 0.2s ease';

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function cadreGetSessionObject() {
  const uid = localStorage.getItem('cadre_uid');
  if (uid) return { id: uid };
  const keys = ['session_user', 'user', 'officer', 'currentUser'];
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.id || parsed.phone || parsed.email)) {
        return parsed;
      }
    } catch (e) {
      continue;
    }
  }
  const stored = localStorage.getItem('supabase_session');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.user) return parsed.user;
    } catch (err) {
      console.warn('[CADRE] supabase_session JSON parse failed:', err);
    }
  }
  return null;
}

async function cadreResolveCurrentUser() {
  const session = cadreGetSessionObject();
  if (!session && CADRE_SB?.auth?.getSession) {
    try {
      const result = await cadreSafeSupabaseQuery('cadreResolveCurrentUser.getSession', CADRE_SB.auth.getSession(), { data: null, error: null });
      const authSession = result?.data?.session || result?.data?.data?.session || null;
      if (authSession?.user) {
        localStorage.setItem('cadre_uid', authSession.user.id);
        return authSession.user;
      }
    } catch (error) {
      console.warn('cadreResolveCurrentUser auth error', error);
    }
    return null;
  }

  if (session?.id && CADRE_SB?.from) {
    const { data, error } = await cadreSafeSupabaseQuery('cadreResolveCurrentUser.profile', CADRE_SB.from('users').select('*').eq('id', session.id).maybeSingle(), { data: null, error: null });
    if (!error && data) return data;
  }

  return session;
}

function cadrePermissionsForRole(role) {
  if (!role) return CADRE_ROLE_PERMISSIONS.command_officer;
  return CADRE_ROLE_PERMISSIONS[role.toLowerCase().replace(/\s+/g, '_')] || CADRE_ROLE_PERMISSIONS.command_officer;
}

function cadreSubscribeTable(table, callback) {
  if (!CADRE_SB) {
    console.error(`[CADRE] cadreSubscribeTable: Supabase client unavailable for ${table}`);
    return null;
  }
  try {
    return CADRE_SB.channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        try {
          callback(payload);
        } catch (innerErr) {
          console.error(`[CADRE] ${table} realtime callback threw:`, innerErr);
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`[CADRE] Realtime ${table} status=${status}`, err || '');
        } else {
          console.log(`[CADRE] Realtime ${table} status=${status}`);
        }
      });
  } catch (error) {
    console.error('[CADRE] Realtime subscribe failed for', table, error);
    return null;
  }
}

function cadreNormalizeChannelKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/gi, '')
    .toUpperCase()
    .slice(0, 32);
}

function cadreFormatChannelCallsign(count) {
  return `CH-${String(count || 0).padStart(2, '0')}`;
}

/* ─────────────────────────────────────────────
   ROBUST ERROR LOGGING
   Captures HTTP status, response body, stack trace and
   the Supabase error object so failures are easy to
   diagnose from the browser console.
───────────────────────────────────────────── */
function cadreLogError(context, err) {
  try {
    const errObj = (err && typeof err === 'object') ? err : { message: String(err) };
    const status = errObj.status ?? errObj.statusCode ?? null;
    const body   = errObj.body   ?? errObj.response ?? null;
    const stack  = errObj.stack  || (new Error(context).stack);
    const detail = {
      context,
      message: errObj.message || errObj.msg || String(err),
      status,
      body: typeof body === 'string' ? body.slice(0, 800) : body,
      code: errObj.code ?? null,
      details: errObj.details ?? null,
      hint: errObj.hint ?? null,
      stack
    };
    console.error(`[CADRE][${context}]`, detail);
    if (errObj.message || errObj.msg) {
      console.error(`[CADRE][${context}] message:`, errObj.message || errObj.msg);
    }
    if (status !== null) {
      console.error(`[CADRE][${context}] http status:`, status);
    }
    if (body !== null && body !== undefined) {
      console.error(`[CADRE][${context}] response body:`, body);
    }
    return detail;
  } catch (logErr) {
    console.error('[CADRE] cadreLogError itself failed:', logErr, 'original:', context, err);
    return null;
  }
}
