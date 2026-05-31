const CADRE_ADMIN_STATE = {
  currentUser: null,
  permissions: {},
  channels: [],
  officers: [],
  groups: [],
  feed: [],
  distress: [],
  preferences: {},
  selectedChannelId: null,
  selectedOfficerId: null,
  selectedGroupId: null,
  pttMode: 'all',
  agoraClient: null,
  localAudioTrack: null,
  currentChannelKey: null,
  listeningChannelKey: null,
  remoteAudioTracks: {},
  isJoining: false,
  isTransmitting: false
};

const CADRE_BROADCAST_CHANNELS = {
  all: 'CADRE_ALL',
  emergency: 'CADRE_EMERGENCY'
};

window.addEventListener('DOMContentLoaded', async () => {
  await initAdminDashboard();
});

async function initAdminDashboard() {
  const user = await cadreResolveCurrentUser();
  if (!user) {
    cadreShowToast('Authorization required to view admin dashboard.', 'error');
    window.location.href = 'login.html';
    return;
  }

  CADRE_ADMIN_STATE.currentUser = user;
  CADRE_ADMIN_STATE.permissions = cadrePermissionsForRole(user.role || user.rank || 'command_officer');

  document.querySelector('.admin-chip').textContent = `${(user.role || user.rank || 'Admin').toUpperCase()}`;
  document.querySelector('.admin-chip').classList.add(`perm-${(user.role || 'command_officer').toLowerCase().replace(/\s+/g, '_')}`);

  bindAdminControls();
  await Promise.all([
    loadChannels(),
    loadOfficers(),
    loadPatrolGroups(),
    loadFeed(),
    loadDistressAlerts(),
    loadAudioPreferences()
  ]);
  renderAllAdminPanels();
  setupAdminRealtime();
}

function bindAdminControls() {
  const createInput = document.getElementById('channel-create-name');
  const createButton = document.getElementById('channel-create-btn');
  const renameButton = document.getElementById('channel-rename-btn');
  const disableButton = document.getElementById('channel-disable-btn');
  const lockButton = document.getElementById('channel-lock-btn');
  const deleteButton = document.getElementById('channel-delete-btn');
  const archiveButton = document.getElementById('channel-archive-btn');
  const moveButton = document.getElementById('channel-move-btn');
  const assignButton = document.getElementById('assign-group-btn');
  const removeGroupButton = document.getElementById('remove-group-btn');

  if (createButton) createButton.addEventListener('click', createChannel);
  if (renameButton) renameButton.addEventListener('click', renameChannel);
  if (disableButton) disableButton.addEventListener('click', toggleChannelDisable);
  if (lockButton) lockButton.addEventListener('click', toggleChannelLock);
  if (deleteButton) deleteButton.addEventListener('click', deleteChannel);
  if (archiveButton) archiveButton.addEventListener('click', archiveChannel);
  if (moveButton) moveButton.addEventListener('click', assignOfficerToChannel);
  if (assignButton) assignButton.addEventListener('click', assignOfficerToPatrolGroup);
  if (removeGroupButton) removeGroupButton.addEventListener('click', removeOfficerFromPatrolGroup);
}

async function loadChannels() {
  const [channelsRes, assignmentsRes] = await Promise.all([
    CADRE_SB.from('channels').select('*').order('created_at', { ascending: true }),
    CADRE_SB.from('officer_assignments').select('user_id,channel_id,status,patrol_group_id')
  ]);

  CADRE_ADMIN_STATE.channels = channelsRes.data || [];
  const assignments = assignmentsRes.data || [];

  const channelMetrics = {};
  assignments.forEach(assign => {
    if (!assign.channel_id) return;
    const metric = channelMetrics[assign.channel_id] || { officers: 0, active: 0 };
    if (assign.status === 'online') metric.officers += 1;
    if (assign.status === 'online' || assign.status === 'away') metric.active += 1;
    channelMetrics[assign.channel_id] = metric;
  });

  CADRE_ADMIN_STATE.channels = CADRE_ADMIN_STATE.channels.map(channel => {
    const metrics = channelMetrics[channel.id] || { officers: 0, active: 0 };
    return {
      ...channel,
      officerCount: metrics.officers,
      activity: Math.min(100, Math.max(6, metrics.officers * 12 + Math.floor(Math.random() * 20))),
      status: channel.is_disabled ? 'quiet' : metrics.officers > 5 ? 'active' : metrics.officers > 1 ? 'busy' : 'quiet'
    };
  });
}

async function loadOfficers() {
  const [usersRes, assignmentsRes] = await Promise.all([
    CADRE_SB.from('users').select('id,name,rank,role,phone,last_seen,status').order('name', { ascending: true }),
    CADRE_SB.from('officer_assignments').select('user_id,channel_id,patrol_group_id,status')
  ]);

  const users = usersRes.data || [];
  const assignments = assignmentsRes.data || [];
  const assignmentMap = assignments.reduce((acc, assign) => {
    acc[assign.user_id] = assign;
    return acc;
  }, {});

  CADRE_ADMIN_STATE.officers = users.map(user => {
    const assignment = assignmentMap[user.id] || {};
    return {
      ...user,
      channelId: assignment.channel_id || null,
      patrolGroupId: assignment.patrol_group_id || null,
      status: assignment.status || user.status || 'offline',
      lastSeen: user.last_seen || 'Unknown'
    };
  });
}

async function loadPatrolGroups() {
  const { data } = await CADRE_SB.from('patrol_groups').select('*').order('created_at', { ascending: true });
  CADRE_ADMIN_STATE.groups = data || [];
}

async function loadFeed() {
  const { data } = await CADRE_SB.from('incident_feed').select('id,category,message,created_at,channel_id,officer_id').order('created_at', { ascending: false }).limit(50);
  CADRE_ADMIN_STATE.feed = data || [];
}

async function loadDistressAlerts() {
  const { data } = await CADRE_SB.from('distress_alerts').select('id,officer_id,channel_id,latitude,longitude,status,severity,description,acknowledged_by,escalated_by,resolved_by,created_at,updated_at').order('created_at', { ascending: false });
  CADRE_ADMIN_STATE.distress = data || [];
}

async function loadAudioPreferences() {
  if (!CADRE_ADMIN_STATE.currentUser?.id) return;
  const { data } = await CADRE_SB.from('voice_preferences').select('*').eq('user_id', CADRE_ADMIN_STATE.currentUser.id);
  CADRE_ADMIN_STATE.preferences = (data || []).reduce((map, row) => {
    map[row.channel_key] = { listen: row.listen_enabled, mute: row.muted };
    return map;
  }, {});
}

function renderAllAdminPanels() {
  renderChannels();
  renderBroadcastButtons();
  renderAudioControls();
  renderOfficers();
  renderFeed();
  renderDistressAlerts();
  renderChannelSelection();
  renderOfficerAssignmentControls();
  updateStatsPanel();
}

function renderChannels() {
  const container = document.getElementById('chGrid');
  if (!container) return;

  container.innerHTML = CADRE_ADMIN_STATE.channels.map(channel => {
    const statusClass = channel.status === 'active' ? ' active' : '';
    const dotClass = channel.status === 'active' ? '' : channel.status === 'idle' ? ' idle' : ' off';
    const statusLabel = channel.status === 'active' ? 'ACTIVE' : channel.status === 'busy' ? 'BUSY' : 'QUIET';
    const disabled = channel.is_disabled ? ' opacity:0.55;pointer-events:none;' : '';

    return `
      <div class="ch-row${statusClass}" style="${disabled}">
        <div class="ch-code">${cadreEscHtml(channel.callsign || 'CH-??')}</div>
        <div>
          <div class="ch-name">${cadreEscHtml(channel.name)}</div>
          <div class="ch-meta">
            <span class="ch-dot${dotClass}"></span>
            ${channel.officerCount || 0} officers &nbsp;·&nbsp; ${channel.activity || 0}% activity
          </div>
        </div>
        <div class="ch-btns">
          <button class="btn btn-gold" title="Listen" onclick="event.stopPropagation(); listenToChannel('${cadreEscHtml(channel.key)}')">👂</button>
          <button class="btn btn-amber" title="Mute" onclick="event.stopPropagation(); muteChannel('${cadreEscHtml(channel.key)}')">🔇</button>
          <button class="btn btn-ghost" title="Monitor" onclick="event.stopPropagation(); monitorChannel('${cadreEscHtml(channel.id)}')">📡</button>
        </div>
      </div>`;
  }).join('');
}

function renderBroadcastButtons() {
  const container = document.getElementById('bcGrid');
  if (!container) return;

  container.innerHTML = CADRE_ADMIN_STATE.channels.map(channel => {
    return `<button class="btn btn-red btn-full" onclick="broadcastToChannel('${cadreEscHtml(channel.key)}')">📢 ${cadreEscHtml(channel.name)}</button>`;
  }).join('') + `
    <button class="btn btn-gold btn-full" style="grid-column:1/-1;margin-top:4px;padding:10px;" onclick="broadcastToAllChannels()">⚡ BROADCAST ALL CHANNELS</button>`;
}

function renderAudioControls() {
  const listenGrid = document.getElementById('listenGrid');
  const muteGrid = document.getElementById('muteGrid');
  if (!listenGrid || !muteGrid) return;

  listenGrid.innerHTML = CADRE_ADMIN_STATE.channels.slice(0, 5).map(channel => {
    const pref = CADRE_ADMIN_STATE.preferences[channel.key] || {};
    const onClass = pref.listen ? ' on' : '';
    return `
      <div class="audio-row">
        <span class="audio-ch">${cadreEscHtml(channel.key)}</span>
        <div class="toggle${onClass}" onclick="toggleListen('${cadreEscHtml(channel.key)}')"></div>
      </div>`;
  }).join('');

  muteGrid.innerHTML = CADRE_ADMIN_STATE.channels.slice(0, 5).map(channel => {
    const pref = CADRE_ADMIN_STATE.preferences[channel.key] || {};
    const onClass = pref.mute ? ' on' : '';
    return `
      <div class="audio-row">
        <span class="audio-ch">${cadreEscHtml(channel.key)}</span>
        <div class="toggle${onClass}" onclick="toggleMute('${cadreEscHtml(channel.key)}')"></div>
      </div>`;
  }).join('');
}

function renderOfficers() {
  const container = document.getElementById('officerList');
  if (!container) return;

  container.innerHTML = CADRE_ADMIN_STATE.officers.map(officer => {
    const initials = officer.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
    const statusClass = officer.status === 'online' ? 'st-online' : officer.status === 'away' ? 'st-away' : 'st-offline';
    const statusLabel = officer.status === 'online' ? '🟢 Online' : officer.status === 'away' ? '🟡 Away' : '⚫ Offline';
    const channelName = officer.channelId ? getChannelNameById(officer.channelId) : 'Unassigned';
    return `
      <div class="officer-card">
        <div class="officer-av">${cadreEscHtml(initials)}</div>
        <div style="flex:1;min-width:0;">
          <div class="officer-name">${cadreEscHtml(officer.name)}</div>
          <div class="officer-rank">${cadreEscHtml(officer.rank || officer.role || 'Officer').toUpperCase()}</div>
          <div class="officer-ch">${cadreEscHtml(channelName)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
          <div class="${statusClass}">${statusLabel}</div>
          <div class="last-seen">${cadreEscHtml(officer.lastSeen || 'Unknown')}</div>
        </div>
      </div>`;
  }).join('');
}

function renderFeed() {
  const container = document.getElementById('feedList');
  if (!container) return;

  container.innerHTML = CADRE_ADMIN_STATE.feed.map(item => {
    const typeClass = item.category ? ` ${cadreEscHtml(item.category)}` : '';
    return `
      <div class="feed-item">
        <div class="feed-time">${cadreFormatTime(item.created_at)}</div>
        <div class="feed-dot${typeClass}"></div>
        <div class="feed-text">${cadreEscHtml(item.message)}</div>
      </div>`;
  }).join('');
}

function renderDistressAlerts() {
  const container = document.getElementById('distressContainer');
  if (!container) return;

  if (CADRE_ADMIN_STATE.distress.length === 0) {
    container.innerHTML = '<div style="padding:14px;color:#9a8878;font-size:12px;text-align:center;">No active distress alerts.</div>';
    return;
  }

  container.innerHTML = CADRE_ADMIN_STATE.distress.map(alert => {
    const officerName = getOfficerNameById(alert.officer_id) || 'Unknown';
    const channelName = getChannelNameById(alert.channel_id) || 'Unknown Channel';
    return `
      <div class="distress-card">
        <div class="distress-head">
          <span class="distress-name">⚠ ${cadreEscHtml(officerName)}</span>
          <span class="distress-time">${cadreFormatTime(alert.created_at)}</span>
        </div>
        <div class="distress-gps">GPS: ${alert.latitude || 'N/A'} · ${alert.longitude || 'N/A'} · ${cadreEscHtml(channelName)}</div>
        <div class="distress-gps">Status: ${cadreEscHtml(alert.status || 'active').toUpperCase()}</div>
        <div class="distress-gps">Severity: ${cadreEscHtml(alert.severity || 'high').toUpperCase()}</div>
        <div class="distress-gps">${cadreEscHtml(alert.description || 'No additional details')}</div>
        <div class="distress-acts">
          <button class="btn btn-gold" onclick="acknowledgeDistress('${alert.id}')">ACK</button>
          <button class="btn btn-amber" onclick="escalateDistress('${alert.id}')">ESCALATE</button>
          <button class="btn btn-red" onclick="resolveDistress('${alert.id}')">RESOLVE</button>
        </div>
      </div>`;
  }).join('');
}

function renderChannelSelection() {
  const select = document.getElementById('channel-select');
  if (!select) return;
  select.innerHTML = `<option value="">Select Channel...</option>` + CADRE_ADMIN_STATE.channels.map(channel => `
    <option value="${cadreEscHtml(channel.id)}">${cadreEscHtml(channel.name)}</option>
  `).join('');
}

function renderOfficerAssignmentControls() {
  const officerSelect = document.getElementById('officer-select');
  const channelAssignSelect = document.getElementById('channel-assign-select');
  const patrolOfficerSelect = document.getElementById('patrol-officer-select');
  
  if (officerSelect) {
    officerSelect.innerHTML = `<option value="">Select Officer...</option>` + CADRE_ADMIN_STATE.officers.map(officer => {
      const label = officer.name || `Officer ${officer.id || 'unknown'}`;
      return `
        <option value="${cadreEscHtml(officer.id)}">${cadreEscHtml(label)} — ${cadreEscHtml(getChannelNameById(officer.channelId) || 'Unassigned')}</option>
      `;
    }).join('');
  }
  
  if (channelAssignSelect) {
    const channelOptions = CADRE_ADMIN_STATE.channels.map(channel => {
      const label = channel.name || channel.key || `Channel ${channel.id || 'unknown'}`;
      const value = channel.id || channel.key || '';
      return `
        <option value="${cadreEscHtml(value)}">${cadreEscHtml(label)} (${channel.officerCount || 0} officers)</option>
      `;
    }).join('');

    channelAssignSelect.innerHTML = `<option value="">Assign to Channel...</option>` + (channelOptions || '<option value="">No channels available</option>');
  }
  
  if (patrolOfficerSelect) {
    patrolOfficerSelect.innerHTML = `<option value="">Select Officer...</option>` + CADRE_ADMIN_STATE.officers.map(officer => `
      <option value="${cadreEscHtml(officer.id)}">${cadreEscHtml(officer.name)}</option>
    `).join('');
  }
}

function updateStatsPanel() {
  const online = CADRE_ADMIN_STATE.officers.filter(off => off.status === 'online').length;
  const activeChannels = CADRE_ADMIN_STATE.channels.filter(ch => ch.status !== 'quiet').length;
  const inField = CADRE_ADMIN_STATE.officers.filter(off => off.channelId).length;
  const incidents = CADRE_ADMIN_STATE.feed.filter(item => item.category === 'alert').length;
  const alerts = CADRE_ADMIN_STATE.distress.filter(item => item.status === 'active').length;

  document.getElementById('s-online').textContent = online;
  document.getElementById('s-ch').textContent = activeChannels;
  document.getElementById('s-field').textContent = inField;
  document.getElementById('s-inc').textContent = incidents;
  document.getElementById('s-alerts').textContent = alerts;
}

function getChannelNameById(channelId) {
  const channel = CADRE_ADMIN_STATE.channels.find(ch => ch.id === channelId);
  return channel ? channel.name : null;
}

function getOfficerNameById(userId) {
  const officer = CADRE_ADMIN_STATE.officers.find(off => off.id === userId);
  return officer ? officer.name : null;
}

async function createChannel() {
  if (!CADRE_ADMIN_STATE.permissions.manage_channels) {
    cadreShowToast('Permission denied: manage channels.', 'error');
    return;
  }
  const nameInput = document.getElementById('channel-create-name');
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) {
    cadreShowToast('Channel name is required.', 'warning');
    return;
  }

  const key = cadreNormalizeChannelKey(name);
  if (!key) {
    cadreShowToast('Invalid channel name.', 'error');
    return;
  }

  const duplicate = CADRE_ADMIN_STATE.channels.find(ch => ch.key === key || ch.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    cadreShowToast('Channel already exists.', 'warning');
    return;
  }

  const callsign = cadreFormatChannelCallsign(CADRE_ADMIN_STATE.channels.length + 1);
  const { error } = await CADRE_SB.from('channels').insert([{ key, name, callsign, frequency: '', status: 'quiet', is_disabled: false, is_archived: false }]);
  if (error) {
    cadreShowToast('Failed to create channel.', 'error');
    console.error(error);
    return;
  }

  nameInput.value = '';
  cadreShowToast(`Channel ${name} created.`, 'success');
  await loadChannels();
  renderAllAdminPanels();
}

async function renameChannel() {
  if (!CADRE_ADMIN_STATE.permissions.manage_channels) {
    cadreShowToast('Permission denied: manage channels.', 'error');
    return;
  }
  const select = document.getElementById('channel-select');
  const nameInput = document.getElementById('channel-create-name');
  if (!select || !nameInput) return;
  const channelId = select.value;
  const newName = nameInput.value.trim();
  if (!channelId || !newName) {
    cadreShowToast('Select channel and enter new name.', 'warning');
    return;
  }

  const channel = CADRE_ADMIN_STATE.channels.find(ch => ch.id === channelId);
  if (!channel) return;

  const { error } = await CADRE_SB.from('channels').update({ name: newName }).eq('id', channelId);
  if (error) {
    cadreShowToast('Failed to rename channel.', 'error');
    return;
  }

  cadreShowToast(`Channel renamed to ${newName}.`, 'success');
  await loadChannels();
  renderAllAdminPanels();
}

async function toggleChannelDisable() {
  if (!CADRE_ADMIN_STATE.permissions.manage_channels) {
    cadreShowToast('Permission denied: manage channels.', 'error');
    return;
  }
  await updateSelectedChannelFlag('is_disabled');
}

async function toggleChannelLock() {
  if (!CADRE_ADMIN_STATE.permissions.manage_channels) {
    cadreShowToast('Permission denied: manage channels.', 'error');
    return;
  }
  await updateSelectedChannelFlag('is_locked');
}

async function archiveChannel() {
  if (!CADRE_ADMIN_STATE.permissions.manage_channels) {
    cadreShowToast('Permission denied: manage channels.', 'error');
    return;
  }
  await updateSelectedChannelFlag('is_archived');
}

async function deleteChannel() {
  if (!CADRE_ADMIN_STATE.permissions.manage_channels) {
    cadreShowToast('Permission denied: manage channels.', 'error');
    return;
  }
  const select = document.getElementById('channel-select');
  if (!select || !select.value) {
    cadreShowToast('Select a channel first.', 'warning');
    return;
  }
  const channelId = select.value;
  const channel = CADRE_ADMIN_STATE.channels.find(ch => ch.id === channelId);
  if (!channel) return;

  const confirmed = confirm(`Delete channel ${channel.name}? This cannot be undone.`);
  if (!confirmed) return;

  const { error } = await CADRE_SB.from('channels').delete().eq('id', channelId);
  if (error) {
    cadreShowToast('Failed to delete channel.', 'error');
    return;
  }

  cadreShowToast(`Channel ${channel.name} deleted.`, 'success');
  await loadChannels();
  renderAllAdminPanels();
}

async function updateSelectedChannelFlag(field) {
  const select = document.getElementById('channel-select');
  if (!select || !select.value) {
    cadreShowToast('Select a channel first.', 'warning');
    return;
  }
  const channelId = select.value;
  const channel = CADRE_ADMIN_STATE.channels.find(ch => ch.id === channelId);
  if (!channel) return;

  const updates = {};
  updates[field] = !channel[field];
  const { error } = await CADRE_SB.from('channels').update(updates).eq('id', channelId);
  if (error) {
    cadreShowToast('Failed to update channel.', 'error');
    return;
  }

  cadreShowToast(`${field.replace('is_', '').replace('_', ' ')} ${updates[field] ? 'enabled' : 'disabled'} for ${channel.name}.`, 'success');
  await loadChannels();
  renderAllAdminPanels();
}

async function assignOfficerToChannel() {
  if (!CADRE_ADMIN_STATE.permissions.manage_officers) {
    cadreShowToast('Permission denied: manage officers.', 'error');
    return;
  }
  const officerSelect = document.getElementById('officer-select');
  const channelSelect = document.getElementById('channel-assign-select');
  if (!officerSelect || !channelSelect || !officerSelect.value || !channelSelect.value) {
    cadreShowToast('Select officer and channel first.', 'warning');
    return;
  }
  const officerId = officerSelect.value;
  const channelId = channelSelect.value;

  const { data: existing } = await CADRE_SB.from('officer_assignments').select('*').eq('user_id', officerId).maybeSingle();
  if (existing) {
    await CADRE_SB.from('officer_assignments').update({ channel_id: channelId, status: 'online', updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await CADRE_SB.from('officer_assignments').insert([{ user_id: officerId, channel_id: channelId, status: 'online', updated_at: new Date().toISOString() }]);
  }

  cadreShowToast('Officer reassigned.', 'success');
  await Promise.all([loadOfficers(), loadChannels()]);
  renderAllAdminPanels();
}

async function assignOfficerToPatrolGroup() {
  if (!CADRE_ADMIN_STATE.permissions.assign_patrols) {
    cadreShowToast('Permission denied: assign patrols.', 'error');
    return;
  }
  const officerSelect = document.getElementById('patrol-officer-select');
  const groupNameInput = document.getElementById('group-name-input');
  if (!officerSelect || !groupNameInput || !officerSelect.value || !groupNameInput.value.trim()) {
    cadreShowToast('Select officer and enter a group name.', 'warning');
    return;
  }
  const officerId = officerSelect.value;
  const name = groupNameInput.value.trim();

  let group = CADRE_ADMIN_STATE.groups.find(g => g.name.toLowerCase() === name.toLowerCase());
  if (!group) {
    const { data, error } = await CADRE_SB.from('patrol_groups').insert([{ name }]).select().maybeSingle();
    if (error) {
      cadreShowToast('Failed to create patrol group.', 'error');
      return;
    }
    group = data;
  }

  const { data: existing } = await CADRE_SB.from('officer_assignments').select('*').eq('user_id', officerId).maybeSingle();
  if (existing) {
    await CADRE_SB.from('officer_assignments').update({ patrol_group_id: group.id, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await CADRE_SB.from('officer_assignments').insert([{ user_id: officerId, patrol_group_id: group.id, status: 'online', updated_at: new Date().toISOString() }]);
  }

  cadreShowToast('Officer added to patrol group.', 'success');
  groupNameInput.value = '';
  await Promise.all([loadOfficers(), loadPatrolGroups()]);
  renderAllAdminPanels();
}

async function removeOfficerFromPatrolGroup() {
  const officerSelect = document.getElementById('patrol-officer-select');
  if (!officerSelect || !officerSelect.value) {
    cadreShowToast('Select officer first.', 'warning');
    return;
  }
  const officerId = officerSelect.value;
  const { data: existing } = await CADRE_SB.from('officer_assignments').select('*').eq('user_id', officerId).maybeSingle();
  if (!existing) {
    cadreShowToast('Officer not assigned to a patrol group.', 'warning');
    return;
  }
  await CADRE_SB.from('officer_assignments').update({ patrol_group_id: null, updated_at: new Date().toISOString() }).eq('id', existing.id);
  cadreShowToast('Officer removed from patrol group.', 'success');
  await loadOfficers();
  renderAllAdminPanels();
}

async function broadcastToChannel(channelKey) {
  if (!CADRE_ADMIN_STATE.permissions.broadcast) {
    cadreShowToast('Permission denied: broadcast.', 'error');
    return;
  }
  const channel = CADRE_ADMIN_STATE.channels.find(ch => ch.key === channelKey);
  if (!channel) {
    cadreShowToast('Channel not found.', 'error');
    return;
  }
  await addFeedEntry(`Broadcast → ${channel.name}`, 'broadcast', channel.id, CADRE_ADMIN_STATE.currentUser.id);
  cadreShowToast(`Broadcast queued for ${channel.name}.`, 'success');
}

async function broadcastToAllChannels() {
  if (!CADRE_ADMIN_STATE.permissions.broadcast) {
    cadreShowToast('Permission denied: broadcast.', 'error');
    return;
  }
  await addFeedEntry('Broadcast → ALL CHANNELS', 'alert', null, CADRE_ADMIN_STATE.currentUser.id);
  cadreShowToast('Broadcast to all channels sent.', 'success');
}

async function addFeedEntry(message, category = 'system', channelId = null, officerId = null) {
  const payload = { message, category, channel_id: channelId, officer_id: officerId, created_at: new Date().toISOString() };
  const { error } = await CADRE_SB.from('incident_feed').insert([payload]);
  if (error) {
    console.error('Failed to save feed entry', error);
    return;
  }
  await loadFeed();
  renderFeed();
}

function monitorChannel(channelId) {
  const channel = CADRE_ADMIN_STATE.channels.find(ch => ch.id === channelId);
  if (!channel) return;
  CADRE_ADMIN_STATE.selectedChannelId = channelId;
  cadreShowToast(`Monitoring ${channel.name}`, 'success');
  addFeedEntry(`Monitoring ${channel.name}`, 'channel', channelId, CADRE_ADMIN_STATE.currentUser.id);
}

function listenToChannel(channelKey) {
  const pref = CADRE_ADMIN_STATE.preferences[channelKey] || { listen: false, mute: false };
  pref.listen = !pref.listen;
  CADRE_ADMIN_STATE.preferences[channelKey] = pref;
  saveVoicePreference(channelKey, pref);
  renderAudioControls();
  cadreShowToast(`${pref.listen ? 'Listening' : 'Stopped listening'} to ${channelKey}`, 'success');
}

function muteChannel(channelKey) {
  const pref = CADRE_ADMIN_STATE.preferences[channelKey] || { listen: false, mute: false };
  pref.mute = !pref.mute;
  CADRE_ADMIN_STATE.preferences[channelKey] = pref;
  saveVoicePreference(channelKey, pref);
  renderAudioControls();
  cadreShowToast(`${pref.mute ? 'Muted' : 'Unmuted'} ${channelKey} locally`, 'success');
}

async function saveVoicePreference(channelKey, pref) {
  if (!CADRE_ADMIN_STATE.currentUser?.id) return;
  const payload = {
    user_id: CADRE_ADMIN_STATE.currentUser.id,
    channel_key: channelKey,
    listen_enabled: !!pref.listen,
    muted: !!pref.mute,
    updated_at: new Date().toISOString()
  };
  const { data: existing } = await CADRE_SB.from('voice_preferences').select('*').eq('user_id', CADRE_ADMIN_STATE.currentUser.id).eq('channel_key', channelKey).maybeSingle();
  if (existing) {
    await CADRE_SB.from('voice_preferences').update(payload).eq('id', existing.id);
  } else {
    await CADRE_SB.from('voice_preferences').insert([payload]);
  }
}

async function acknowledgeDistress(alertId) {
  if (!CADRE_ADMIN_STATE.permissions.acknowledge) {
    cadreShowToast('Permission denied: acknowledge distress.', 'error');
    return;
  }
  const { error } = await CADRE_SB.from('distress_alerts').update({ status: 'acknowledged', acknowledged_by: CADRE_ADMIN_STATE.currentUser.id, updated_at: new Date().toISOString() }).eq('id', alertId);
  if (error) {
    cadreShowToast('Failed to acknowledge distress.', 'error');
    return;
  }
  await loadDistressAlerts();
  renderDistressAlerts();
  addFeedEntry('Distress acknowledged', 'officer', null, CADRE_ADMIN_STATE.currentUser.id);
}

async function escalateDistress(alertId) {
  if (!CADRE_ADMIN_STATE.permissions.escalate) {
    cadreShowToast('Permission denied: escalate distress.', 'error');
    return;
  }
  const { error } = await CADRE_SB.from('distress_alerts').update({ status: 'escalated', escalated_by: CADRE_ADMIN_STATE.currentUser.id, updated_at: new Date().toISOString() }).eq('id', alertId);
  if (error) {
    cadreShowToast('Failed to escalate distress.', 'error');
    return;
  }
  await loadDistressAlerts();
  renderDistressAlerts();
  addFeedEntry('Distress escalated', 'alert', null, CADRE_ADMIN_STATE.currentUser.id);
}

async function resolveDistress(alertId) {
  const { error } = await CADRE_SB.from('distress_alerts').update({ status: 'resolved', resolved_by: CADRE_ADMIN_STATE.currentUser.id, updated_at: new Date().toISOString() }).eq('id', alertId);
  if (error) {
    cadreShowToast('Failed to resolve distress.', 'error');
    return;
  }
  await loadDistressAlerts();
  renderDistressAlerts();
  addFeedEntry('Distress resolved', 'system', null, CADRE_ADMIN_STATE.currentUser.id);
}

function setupAdminRealtime() {
  cadreSubscribeTable('channels', async () => {
    await loadChannels();
    renderChannels();
    renderChannelSelection();
    updateStatsPanel();
  });

  cadreSubscribeTable('officer_assignments', async () => {
    await Promise.all([loadChannels(), loadOfficers()]);
    renderChannels();
    renderOfficers();
    renderChannelSelection();
    renderOfficerAssignmentControls();
    updateStatsPanel();
  });

  cadreSubscribeTable('incident_feed', async () => {
    await loadFeed();
    renderFeed();
    updateStatsPanel();
  });

  cadreSubscribeTable('distress_alerts', async () => {
    await loadDistressAlerts();
    renderDistressAlerts();
    updateStatsPanel();
  });

  cadreSubscribeTable('voice_preferences', async () => {
    await loadAudioPreferences();
    renderAudioControls();
  });

  cadreSubscribeTable('users', async () => {
    await loadOfficers();
    renderOfficers();
    updateStatsPanel();
  });
}

async function initAgoraClient() {
  if (CADRE_ADMIN_STATE.agoraClient) return;
  if (typeof AgoraRTC === 'undefined') {
    cadreShowToast('Agora SDK is not loaded.', 'error');
    throw new Error('AgoraRTC not available');
  }

  CADRE_ADMIN_STATE.agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

  CADRE_ADMIN_STATE.agoraClient.on('user-published', async (user, mediaType) => {
    try {
      await CADRE_ADMIN_STATE.agoraClient.subscribe(user, mediaType);
      if (mediaType === 'audio' && user.audioTrack) {
        CADRE_ADMIN_STATE.remoteAudioTracks[user.uid] = user.audioTrack;
        const pref = CADRE_ADMIN_STATE.listeningChannelKey ? CADRE_ADMIN_STATE.preferences[CADRE_ADMIN_STATE.listeningChannelKey] : null;
        if (!pref?.mute) {
          user.audioTrack.play();
        }
        console.log(`Agora admin subscribed to remote audio: ${user.uid}`);
      }
    } catch (err) {
      console.error('Agora admin subscribe failed:', err);
      cadreShowToast('Failed to receive remote audio.', 'error');
    }
  });

  CADRE_ADMIN_STATE.agoraClient.on('user-unpublished', user => {
    if (user.audioTrack) {
      user.audioTrack.stop();
    }
    delete CADRE_ADMIN_STATE.remoteAudioTracks[user.uid];
    console.log(`Agora admin remote user unpublished: ${user.uid}`);
  });

  CADRE_ADMIN_STATE.agoraClient.on('connection-state-change', (cur) => {
    if (cur === 'CONNECTED') {
      console.log('Agora connected');
    }
  });

  CADRE_ADMIN_STATE.agoraClient.on('exception', err => {
    console.error('Agora exception', err);
    cadreShowToast(`Agora error: ${err.msg || err}`, 'error');
  });
}

function getAdminAgoraUid() {
  const user = CADRE_ADMIN_STATE.currentUser;
  if (user?.phone) {
    const digits = String(user.phone).replace(/\D/g, '');
    if (digits.length) return parseInt(digits.slice(-8), 10);
  }
  return Math.floor(Date.now() % 1000000000);
}

async function joinAgoraChannel(channelName) {
  if (!channelName) return;
  if (CADRE_ADMIN_STATE.isJoining) return;
  if (CADRE_ADMIN_STATE.currentChannelKey === channelName) return;

  if (CADRE_ADMIN_STATE.currentChannelKey) {
    await leaveAgoraChannel();
  }

  CADRE_ADMIN_STATE.isJoining = true;

  try {
    await initAgoraClient();
    const uid = getAdminAgoraUid();
    await CADRE_ADMIN_STATE.agoraClient.join(CADRE_AGORA_APP_ID, channelName, null, uid);
    CADRE_ADMIN_STATE.currentChannelKey = channelName;
    CADRE_ADMIN_STATE.remoteAudioTracks = {};

    // Admin can publish audio when transmitting, but keep it muted while listening.
    CADRE_ADMIN_STATE.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({ encoderConfig: 'speech_standard' });
    await CADRE_ADMIN_STATE.agoraClient.publish([CADRE_ADMIN_STATE.localAudioTrack]);
    await CADRE_ADMIN_STATE.localAudioTrack.setEnabled(false);
  } catch (error) {
    console.error('Agora join failed', error);
    cadreShowToast('Agora join failed. Check microphone and network.', 'error');
    CADRE_ADMIN_STATE.currentChannelKey = null;
  } finally {
    CADRE_ADMIN_STATE.isJoining = false;
  }
}

async function leaveAgoraChannel() {
  if (!CADRE_ADMIN_STATE.agoraClient) return;
  try {
    if (CADRE_ADMIN_STATE.localAudioTrack) {
      await CADRE_ADMIN_STATE.localAudioTrack.setEnabled(false);
      CADRE_ADMIN_STATE.localAudioTrack.close();
      CADRE_ADMIN_STATE.localAudioTrack = null;
    }
    await CADRE_ADMIN_STATE.agoraClient.unpublish();
    await CADRE_ADMIN_STATE.agoraClient.leave();
  } catch (error) {
    console.warn('Agora leave failed', error);
  } finally {
    CADRE_ADMIN_STATE.currentChannelKey = null;
    CADRE_ADMIN_STATE.listeningChannelKey = null;
    CADRE_ADMIN_STATE.remoteAudioTracks = {};
  }
}

async function toggleListen(channelKey) {
  const pref = CADRE_ADMIN_STATE.preferences[channelKey] || { listen: false, mute: false };
  pref.listen = !pref.listen;

  if (pref.listen) {
    if (CADRE_ADMIN_STATE.listeningChannelKey && CADRE_ADMIN_STATE.listeningChannelKey !== channelKey) {
      const previousKey = CADRE_ADMIN_STATE.listeningChannelKey;
      const previousPref = CADRE_ADMIN_STATE.preferences[previousKey] || { listen: false, mute: false };
      previousPref.listen = false;
      CADRE_ADMIN_STATE.preferences[previousKey] = previousPref;
      await saveVoicePreference(previousKey, previousPref);
    }

    await joinAgoraChannel(channelKey);
    CADRE_ADMIN_STATE.listeningChannelKey = channelKey;
    cadreShowToast(`Listening to ${channelKey}`, 'success');
  } else {
    await leaveAgoraChannel();
    cadreShowToast(`Stopped listening to ${channelKey}`, 'warning');
  }

  CADRE_ADMIN_STATE.preferences[channelKey] = pref;
  await saveVoicePreference(channelKey, pref);
  renderAudioControls();
}

function toggleMute(channelKey) {
  const pref = CADRE_ADMIN_STATE.preferences[channelKey] || { listen: false, mute: false };
  pref.mute = !pref.mute;
  CADRE_ADMIN_STATE.preferences[channelKey] = pref;

  if (CADRE_ADMIN_STATE.listeningChannelKey === channelKey) {
    Object.values(CADRE_ADMIN_STATE.remoteAudioTracks).forEach(track => {
      try {
        if (pref.mute) {
          track.stop();
        } else {
          track.play();
        }
      } catch (err) {
        console.warn('Failed to update remote track mute state:', err);
      }
    });
  }

  saveVoicePreference(channelKey, pref);
  renderAudioControls();
  cadreShowToast(`${pref.mute ? 'Muted' : 'Unmuted'} ${channelKey} locally`, 'success');
}

function setPTT(mode) {
  CADRE_ADMIN_STATE.pttMode = mode;
  document.getElementById('pttAll').className = mode === 'all' ? 'btn btn-red' : 'btn btn-ghost';
  document.getElementById('pttSel').className = mode === 'selected' ? 'btn btn-gold' : 'btn btn-ghost';
  document.getElementById('pttEmg').className = mode === 'emergency' ? 'btn btn-red' : 'btn btn-ghost';
  const labels = {
    all: 'ALL CHANNELS',
    selected: 'SELECTED CHANNELS',
    emergency: '⚠ EMERGENCY PRIORITY'
  };
  document.getElementById('pttStat').textContent = `MODE: ${labels[mode]} — STANDBY`;
}

async function txStart() {
  if (!CADRE_ADMIN_STATE.permissions.broadcast) {
    cadreShowToast('Permission denied: broadcast.', 'error');
    return;
  }

  let channelName;
  if (CADRE_ADMIN_STATE.pttMode === 'all') {
    channelName = CADRE_BROADCAST_CHANNELS.all;
  } else if (CADRE_ADMIN_STATE.pttMode === 'emergency') {
    channelName = CADRE_BROADCAST_CHANNELS.emergency;
  } else {
    const selected = document.getElementById('channel-select');
    const channelId = selected?.value;
    const channel = CADRE_ADMIN_STATE.channels.find(c => c.id === channelId);
    channelName = channel?.key;
  }

  if (!channelName) {
    cadreShowToast('Select a channel first.', 'warning');
    return;
  }

  document.getElementById('pttBtn').classList.add('tx');
  document.getElementById('pttStat').textContent = '● TRANSMITTING...';
  CADRE_ADMIN_STATE.isTransmitting = true;

  if (!CADRE_ADMIN_STATE.localAudioTrack) {
    await joinAgoraChannel(channelName);
  }

  if (CADRE_ADMIN_STATE.localAudioTrack) {
    await CADRE_ADMIN_STATE.localAudioTrack.setEnabled(true);
    addFeedEntry(`Admin transmitting on ${channelName}`, 'broadcast', null, CADRE_ADMIN_STATE.currentUser.id);
  }
}

async function txStop() {
  if (!CADRE_ADMIN_STATE.isTransmitting) return;
  CADRE_ADMIN_STATE.isTransmitting = false;
  document.getElementById('pttBtn').classList.remove('tx');
  document.getElementById('pttStat').textContent = `MODE: ${CADRE_ADMIN_STATE.pttMode === 'all' ? 'ALL CHANNELS' : CADRE_ADMIN_STATE.pttMode === 'emergency' ? '⚠ EMERGENCY PRIORITY' : 'SELECTED CHANNELS'} — STANDBY`;
  if (CADRE_ADMIN_STATE.localAudioTrack) {
    await CADRE_ADMIN_STATE.localAudioTrack.setEnabled(false);
  }
}
