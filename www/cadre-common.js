const CADRE_SUPABASE_URL = 'https://ihroattnnnsckvvbosfz.supabase.co';
const CADRE_SUPABASE_KEY = 'sb_publishable_M0wwGKR9he08sEfHhZQQxA_vmnXS2eX';
const CADRE_SB = supabase.createClient(CADRE_SUPABASE_URL, CADRE_SUPABASE_KEY, {
  auth: { persistSession: false }
});
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
      if (parsed?.user) return parsed.user;
    } catch {};
  }

  return null;
}

async function cadreResolveCurrentUser() {
  const session = cadreGetSessionObject();
  if (!session) {
    try {
      const { data: { session: authSession } } = await CADRE_SB.auth.getSession();
      if (authSession?.user) {
        localStorage.setItem('cadre_uid', authSession.user.id);
        return authSession.user;
      }
    } catch (error) {
      console.warn('cadreResolveCurrentUser auth error', error);
    }
    return null;
  }

  if (session.id) {
    const { data, error } = await CADRE_SB.from('users').select('*').eq('id', session.id).maybeSingle();
    if (!error && data) return data;
  }

  return session;
}

function cadrePermissionsForRole(role) {
  if (!role) return CADRE_ROLE_PERMISSIONS.command_officer;
  return CADRE_ROLE_PERMISSIONS[role.toLowerCase().replace(/\s+/g, '_')] || CADRE_ROLE_PERMISSIONS.command_officer;
}

function cadreSubscribeTable(table, callback) {
  try {
    return CADRE_SB.channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
  } catch (error) {
    console.error('Realtime subscribe failed for', table, error);
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
