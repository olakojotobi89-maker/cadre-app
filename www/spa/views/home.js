// SPA View Module: Home (migrated from home.html)
// Converts the legacy HTML page into an SPA view module.

import { getSupabaseClient } from '../../supabase-client.js';

let _container = null;

// Event handlers
let _onKeydown = null;
let _onMoreDockClick = null;
let _onMoreMenuCloseClick = null;
let _onMoreOverlayClick = null;
let _onLoadMoreClick = null;
let _onFileChange = null;
let _onComposerKeydown = null;
let _onPostBtnClick = null;
let _onSearchInput = null;
let _onSearchDocumentClick = null;
let _onContainerClick = null;

// Realtime
let _realtimeChannel = null;

// Timers
let _realtimeDebounceTimer = null;
let _safetyTimeouts = new Set();

// State (module-scoped)
let currentUser = null;
const likedSet = new Set();
const pfpCache = new Map();
const nameCache = new Map();
const postCache = new Map();
let base64ImageString = '';
const PAGE_SIZE = 10;
let currentPage = 0;
let allLoaded = false;

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='42' height='42' viewBox='0 0 24 24' fill='%23648299'><circle cx='12' cy='8' r='4'/><path d='M12 14c-4 0-7 2-7 5v3h14v-3c0-3-3-5-7-5z'/></svg>";

function tryParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function routerNavigate(hashOrPath) {
  // Router system (no full page reload)
  if (window.router?.navigate) {
    window.router.navigate(hashOrPath);
  } else if (hashOrPath.startsWith('#')) {
    window.location.hash = hashOrPath;
  } else {
    window.location.hash = '#' + hashOrPath;
  }
}

async function resolveSession(sbClient) {
  let uid = localStorage.getItem('cadre_uid');

  if (!uid) {
    for (const key of ['session_user', 'user', 'officer', 'currentUser']) {
      const p = tryParse(localStorage.getItem(key));
      if (p && p.id) {
        uid = p.id;
        break;
      }
    }
  }

  if (!uid) {
    const stored = tryParse(localStorage.getItem('supabase_session'));
    if (stored && stored.user && stored.user.id) uid = stored.user.id;
  }

  if (!uid) {
    try {
      const {
        data: { session },
      } = await sbClient.auth.getSession();
      if (session && session.user) uid = session.user.id;
    } catch (e) {}
  }

  if (uid) localStorage.setItem('cadre_uid', uid);
  return uid;
}

async function getUserInfo(sbClient, userId) {
  if (!userId) return null;
  if (nameCache.has(userId)) return nameCache.get(userId);

  const { data } = await sbClient
    .from('users')
    .select('id, name, rank, pfp, email')
    .eq('id', userId)
    .maybeSingle();

  const info = data || null;
  if (info) nameCache.set(userId, info);
  return info;
}

async function loadMyLikes(sbClient, userId) {
  const { data } = await sbClient
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId);

  if (data) data.forEach((row) => likedSet.add(String(row.post_id)));
}

function hasLiked(postId) {
  return likedSet.has(String(postId));
}

async function markLikedInDB(sbClient, postId) {
  await sbClient.from('post_likes').insert({
    post_id: String(postId),
    user_id: currentUser.id,
  });
  likedSet.add(String(postId));
}

function toggleMoreMenu(show) {
  const moreMenu = document.getElementById('more-menu');
  const overlay = document.getElementById('more-menu-overlay');
  if (!moreMenu || !overlay) return;

  if (show) {
    moreMenu.classList.add('active');
    overlay.classList.add('active');
    moreMenu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  } else {
    moreMenu.classList.remove('active');
    overlay.classList.remove('active');
    moreMenu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

function handleTypingSound() {
  if (window.SFX && typeof SFX.type === 'function') SFX.type();
}

function previewSelectedImage(input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    base64ImageString = e.target.result;
    const preview = document.getElementById('post-img-preview');
    preview.src = base64ImageString;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
}

function openProfile(userId) {
  if (!userId) return;
  routerNavigate('/profile?uid=' + encodeURIComponent(userId));
}

function checkAdminAccess(e) {
  e.preventDefault();
  const password = prompt('ENTER COMMANDER AUTHORIZATION CODE:');
  if (password === 'CDR123') {
    routerNavigate('/admin');
  } else if (password !== null) {
    alert('ACCESS DENIED');
  }
}

async function backfillMyPosts(sbClient, uid) {
  try {
    const { data: myPosts } = await sbClient
      .from('ig_feed_posts')
      .select('id, name')
      .is('user_id', null)
      .eq('name', currentUser.name);

    if (!myPosts || myPosts.length === 0) return;

    await sbClient
      .from('ig_feed_posts')
      .update({ user_id: uid, rank: currentUser.rank })
      .is('user_id', null)
      .eq('name', currentUser.name);
  } catch (e) {}
}

function showSkeletons(container, count) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    container.innerHTML +=
      '<div class="skeleton-card">' +
      '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;">' +
      '<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(90deg,#1e293b 25%,#2d3f55 50%,#1e293b 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>' +
      '<div style="flex:1;"><div class="skeleton-line narrow"></div><div class="skeleton-line" style="width:50%;"></div></div>' +
      '</div><div class="skeleton-block"></div><div class="skeleton-line narrow"></div></div>';
  }
}

async function renderCommentsList(sbClient, container, comments) {
  container.innerHTML = '';
  if (!comments || comments.length === 0) return;

  const frag = document.createDocumentFragment();
  for (const c of comments) {
    const item = document.createElement('div');
    item.className = 'comment-item';

    let authorName = '',
      authorId = '',
      commentText = c;

    if (typeof c === 'string' && c.includes('||')) {
      const parts = c.split('||');
      authorName = parts[0] || '';
      authorId = parts[1] || '';
      commentText = parts[2] || '';
    }

    let pfpSrc = DEFAULT_AVATAR;
    if (authorId) {
      const info = await getUserInfo(sbClient, authorId);
      if (info) {
        authorName = info.name || authorName;
        pfpSrc = info.pfp || DEFAULT_AVATAR;
      }
    }

    const avatarImg = document.createElement('img');
    avatarImg.className = 'comment-avatar';
    avatarImg.src = pfpSrc;
    avatarImg.alt = authorName || 'Operator';
    avatarImg.loading = 'lazy';
    item.appendChild(avatarImg);

    const bubble = document.createElement('div');
    bubble.className = 'comment-bubble';
    if (authorName) {
      const nameEl = document.createElement('div');
      nameEl.className = 'comment-author';
      nameEl.textContent = authorName;
      bubble.appendChild(nameEl);
    }

    const textEl = document.createElement('div');
    textEl.className = 'comment-text';
    textEl.textContent = commentText;
    bubble.appendChild(textEl);

    item.appendChild(bubble);
    frag.appendChild(item);
  }

  container.appendChild(frag);
}

async function buildPostCard(sbClient, post) {
  let posterInfo = null;

  if (post.user_id) posterInfo = await getUserInfo(sbClient, post.user_id);

  if (!posterInfo && post.name) {
    const { data } = await sbClient
      .from('users')
      .select('id, name, rank, pfp')
      .eq('name', post.name)
      .maybeSingle();

    if (data) {
      posterInfo = data;
      nameCache.set(data.id, data);
      sbClient
        .from('ig_feed_posts')
        .update({ user_id: data.id })
        .eq('id', post.id)
        .then(() => {});
    }
  }

  const posterName = (posterInfo && posterInfo.name) || post.name || 'UNKNOWN';
  const posterRank = (posterInfo && posterInfo.rank) || post.rank || 'UNIT';
  const posterPfp = (posterInfo && posterInfo.pfp) || null;
  const posterId = (posterInfo && posterInfo.id) || post.user_id || null;

  const canDelete = currentUser && post.user_id && currentUser.id === post.user_id;

  const likes = Number(post.likes ?? 0);
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const alreadyLiked = hasLiked(post.id);

  const article = document.createElement('article');
  article.className = 'feed-post-card';
  article.id = 'post-' + post.id;

  const header = document.createElement('div');
  header.className = 'feed-post-header';

  const userDiv = document.createElement('div');
  userDiv.className = 'feed-post-user';
  userDiv.onclick = function () {
    openProfile(posterId);
  };

  const avatar = document.createElement('img');
  avatar.className = 'post-avatar';
  avatar.src = posterPfp || DEFAULT_AVATAR;
  avatar.alt = posterName;
  avatar.loading = 'lazy';
  userDiv.appendChild(avatar);

  const userInfo = document.createElement('div');
  userInfo.className = 'feed-post-user-info';
  userInfo.innerHTML =
    '<span class="feed-post-rank">' + escHtml(posterRank) + '</span>' +
    '<span class="feed-post-name">' + escHtml(posterName) + '</span>';
  userDiv.appendChild(userInfo);
  header.appendChild(userDiv);

  if (canDelete) {
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-post-btn';
    delBtn.textContent = 'Delete';
    delBtn.onclick = function () {
      deletePost(sbClient, post.id);
    };
    header.appendChild(delBtn);
  }

  article.appendChild(header);

  if (post.caption) {
    const cap = document.createElement('div');
    cap.className = 'feed-post-caption';
    cap.textContent = post.caption;
    article.appendChild(cap);
  }

  if (post.image) {
    const img = document.createElement('img');
    img.className = 'feed-post-image';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = post.image;
    img.alt = 'Post media';
    article.appendChild(img);
  }

  const actions = document.createElement('div');
  actions.className = 'post-actions';

  const likeBtn = document.createElement('button');
  likeBtn.className = 'like-btn' + (alreadyLiked ? ' liked' : '');
  likeBtn.id = 'like-btn-' + post.id;
  likeBtn.innerHTML = alreadyLiked ? '👍 Liked' : '👍 Like';
  likeBtn.disabled = alreadyLiked;
  likeBtn.onclick = function () {
    likePost(sbClient, post.id);
  };
  actions.appendChild(likeBtn);
  article.appendChild(actions);

  const likesDiv = document.createElement('div');
  likesDiv.className = 'likes-count';
  likesDiv.id = 'likes-count-' + post.id;
  likesDiv.textContent = likes + ' ' + (likes === 1 ? 'Like' : 'Likes');
  article.appendChild(likesDiv);

  const commentBox = document.createElement('div');
  commentBox.className = 'comment-box';

  const myPfp = currentUser?.pfp || DEFAULT_AVATAR;
  const inputRow = document.createElement('div');
  inputRow.className = 'comment-input-row';

  const myAvatar = document.createElement('img');
  myAvatar.className = 'comment-input-avatar';
  myAvatar.src = myPfp;
  myAvatar.alt = 'You';
  myAvatar.loading = 'lazy';
  inputRow.appendChild(myAvatar);

  const commentInput = document.createElement('input');
  commentInput.type = 'text';
  commentInput.id = 'comment-' + post.id;
  commentInput.className = 'comment-input';
  commentInput.placeholder = 'Write a comment...';
  commentInput.addEventListener('keydown', function (e) {
    handleTypingSound();
    if (e.key === 'Enter') addComment(sbClient, post.id);
  });
  inputRow.appendChild(commentInput);

  const commentBtn = document.createElement('button');
  commentBtn.className = 'comment-btn';
  commentBtn.id = 'comment-btn-' + post.id;
  commentBtn.textContent = 'Post';
  commentBtn.onclick = function () {
    addComment(sbClient, post.id);
  };
  inputRow.appendChild(commentBtn);
  commentBox.appendChild(inputRow);

  const commentsContainer = document.createElement('div');
  commentsContainer.id = 'comments-list-' + post.id;
  await renderCommentsList(sbClient, commentsContainer, comments);
  commentBox.appendChild(commentsContainer);

  article.appendChild(commentBox);
  return article;
}

function patchPostCard(sbClient, post) {
  const likesEl = document.getElementById('likes-count-' + post.id);
  if (likesEl) {
    const n = Number(post.likes ?? 0);
    likesEl.textContent = n + ' ' + (n === 1 ? 'Like' : 'Likes');
  }

  const commentsEl = document.getElementById('comments-list-' + post.id);
  if (commentsEl) {
    const comments = Array.isArray(post.comments) ? post.comments : [];
    renderCommentsList(sbClient, commentsEl, comments);
  }
}

async function prependPostCard(sbClient, post) {
  const container = document.getElementById('instagram-stream');
  const card = await buildPostCard(sbClient, post);
  card.style.opacity = '0';
  card.style.transform = 'translateY(-12px)';
  card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  container.prepend(card);
  requestAnimationFrame(function () {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });
}

async function loadPostsPage(sbClient, page) {
  const container = document.getElementById('instagram-stream');
  if (page === 0) showSkeletons(container, 3);

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: posts, error } = await sbClient
    .from('ig_feed_posts')
    .select('*')
    .order('timestamp', { ascending: false })
    .range(from, to);

  if (page === 0) container.innerHTML = '';

  if (error) {
    container.innerHTML =
      '<div style="padding:20px;color:#ff6b6b;">FAILED TO LOAD POSTS: ' + error.message + '</div>';
    return;
  }

  if (!posts || posts.length === 0) {
    if (page === 0)
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#666;">NO ARCHIVED LOGS AVAILABLE.</div>';
    allLoaded = true;
    document.getElementById('load-more-btn').style.display = 'none';
    return;
  }

  const fragment = document.createDocumentFragment();
  const cards = await Promise.all(
    posts.map(async (post) => {
      postCache.set(post.id, post);
      return await buildPostCard(sbClient, post);
    })
  );

  cards.forEach((card) => fragment.appendChild(card));
  container.appendChild(fragment);

  allLoaded = posts.length < PAGE_SIZE;
  currentPage = page;

  const loadMoreBtn = document.getElementById('load-more-btn');
  loadMoreBtn.style.display = allLoaded ? 'none' : 'block';
  loadMoreBtn.disabled = false;
  loadMoreBtn.textContent = 'Load more posts';
}

async function loadMorePosts(sbClient) {
  if (allLoaded) return;
  const btn = document.getElementById('load-more-btn');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  await loadPostsPage(sbClient, currentPage + 1);
}

async function submitInstagramPost(sbClient) {
  const caption = document.getElementById('post-input').value.trim();
  const imageValue = base64ImageString || null;

  if (!caption && !imageValue) {
    alert('Write something or add image');
    return;
  }

  const postBtn = document.querySelector('.btn-post');
  postBtn.disabled = true;
  postBtn.textContent = 'Sending...';

  if (!currentUser || !currentUser.id) {
    alert('Session error — please log out and back in.');
    postBtn.disabled = false;
    postBtn.textContent = 'Broadcast';
    return;
  }

  const newPost = {
    user_id: currentUser.id,
    name: currentUser.name || 'UNKNOWN',
    rank: currentUser.rank || 'UNIT',
    caption,
    image: imageValue,
    likes: 0,
    comments: [],
    timestamp: Date.now(),
  };

  const { data: inserted, error } = await sbClient
    .from('ig_feed_posts')
    .insert(newPost)
    .select()
    .single();

  postBtn.disabled = false;
  postBtn.textContent = 'Broadcast';

  if (error) {
    console.error('POST ERROR:', error);
    alert('Post failed: ' + error.message);
    return;
  }

  document.getElementById('post-input').value = '';
  base64ImageString = '';
  const preview = document.getElementById('post-img-preview');
  preview.src = '';
  preview.style.display = 'none';

  if (window.SFX && typeof SFX.transmit === 'function') SFX.transmit();

  const postToShow = inserted || newPost;
  if (!postToShow.id) postToShow.id = 'temp-' + Date.now();
  postCache.set(postToShow.id, postToShow);
  await prependPostCard(sbClient, postToShow);
}

async function deletePost(sbClient, postId) {
  const confirmed = confirm('Delete this transmission? This cannot be undone.');
  if (!confirmed) return;

  const card = document.getElementById('post-' + postId);
  if (card) {
    card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.97)';
    setTimeout(function () {
      card.remove();
    }, 250);
  }

  const { error } = await sbClient.from('ig_feed_posts').delete().eq('id', postId);
  if (error) {
    console.error('DELETE ERROR:', error);
    if (card) {
      card.style.opacity = '1';
      card.style.transform = 'scale(1)';
    }
    alert('Delete failed: ' + error.message);
  } else {
    postCache.delete(postId);
  }
}

async function likePost(sbClient, postId) {
  if (hasLiked(postId)) return;

  const btn = document.getElementById('like-btn-' + postId);
  if (btn) btn.disabled = true;

  const { data: existingLike } = await sbClient
    .from('post_likes')
    .select('post_id')
    .eq('post_id', String(postId))
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (existingLike) {
    likedSet.add(String(postId));
    if (btn) {
      btn.classList.add('liked');
      btn.innerHTML = '👍 Liked';
      btn.disabled = true;
    }
    return;
  }

  const cached = postCache.get(postId);
  const oldLikes = Number((cached && cached.likes) ? cached.likes : 0);
  const newLikes = oldLikes + 1;

  const likesEl = document.getElementById('likes-count-' + postId);
  if (likesEl) likesEl.textContent = newLikes + ' ' + (newLikes === 1 ? 'Like' : 'Likes');

  const { error } = await sbClient
    .from('ig_feed_posts')
    .update({ likes: newLikes })
    .eq('id', postId);

  if (error) {
    console.error('LIKE ERROR:', error);
    if (likesEl) likesEl.textContent = oldLikes + ' ' + (oldLikes === 1 ? 'Like' : 'Likes');
    if (btn) btn.disabled = false;
    return;
  }

  await markLikedInDB(sbClient, postId);
  if (cached) cached.likes = newLikes;

  if (btn) {
    btn.classList.add('liked');
    btn.innerHTML = '👍 Liked';
    btn.disabled = true;
  }
}

async function addComment(sbClient, postId) {
  const input = document.getElementById('comment-' + postId);
  const text = input.value.trim();
  if (!text) return;

  const btn = document.getElementById('comment-btn-' + postId);
  if (btn) btn.disabled = true;

  const cached = postCache.get(postId);
  const comments = Array.isArray(cached && cached.comments ? cached.comments : [])
    ? [...(cached.comments || [])]
    : [];

  const commentEntry = currentUser.name + '||' + currentUser.id + '||' + text;
  comments.push(commentEntry);

  const { error } = await sbClient.from('ig_feed_posts').update({ comments }).eq('id', postId);

  if (btn) btn.disabled = false;
  if (error) {
    console.error('COMMENT ERROR:', error);
    return;
  }

  if (cached) cached.comments = comments;

  const commentsContainer = document.getElementById('comments-list-' + postId);
  if (commentsContainer) await renderCommentsList(sbClient, commentsContainer, comments);

  input.value = '';
}

function scheduleRealtimeRefresh(payload) {
  clearTimeout(_realtimeDebounceTimer);
  _realtimeDebounceTimer = setTimeout(function () {
    handleRealtimeEvent(payload);
  }, 300);
}

async function handleRealtimeEvent(sbClient, payload) {
  const { eventType, new: newRow, old: oldRow } = payload;

  if (eventType === 'DELETE') {
    const id = oldRow && oldRow.id;
    if (id) {
      postCache.delete(id);
      const el = document.getElementById('post-' + id);
      if (el) el.remove();
    }
    return;
  }

  if (eventType === 'INSERT') {
    if (currentPage === 0 || postCache.size < PAGE_SIZE) {
      postCache.set(newRow.id, newRow);
      await prependPostCard(sbClient, newRow);
    }
    return;
  }

  if (eventType === 'UPDATE') {
    postCache.set(newRow.id, newRow);
    patchPostCard(sbClient, newRow);
    return;
  }
}

function renderHTML() {
  // Preserve structure/styling from home.html (minus global head/body).
  return `
<div class="app-container">

<header class="app-header">
    <div class="brand-wrapper">
        <img src="Cadre logo png.jpg" class="brand-logo">
        <span class="brand-text">CADRE HUB</span>
    </div>
    <div id="officer-header-tag" class="header-badge">Loading...</div>
</header>

<section class="search-tray">
    <input type="text" id="officer-search" class="search-input" placeholder="SEARCH ACTIVE INDIVIDUALS BY NAME...">
</section>

<div id="search-dropdown" class="search-results-box"></div>

<main class="feed-content">
    <section class="composer-card">
        <div class="composer-row">
            <img id="composer-avatar" class="avatar-frame">
            <textarea id="post-input" class="composer-input" placeholder="Enter transmission notes..." onkeydown="handleTypingSound()"></textarea>
        </div>
        <div class="composer-footer">
            <label for="image-upload" class="file-upload-label">📷 Attach Media</label>
            <input type="file" id="image-upload" accept="image/*" style="display:none;" onchange="previewSelectedImage(this)">
            <img id="post-img-preview" class="preview-thumbnail">
            <button type="button" class="btn-post" onclick="submitInstagramPost()">Broadcast</button>
        </div>
    </section>

    <section id="instagram-stream"></section>
    <button id="load-more-btn" onclick="loadMorePosts()" style="display:none;">Load more posts</button>
</main>

<nav class="app-bottom-dock">
    <a href="home.html" class="dock-node active-node">
        <span class="dock-node-glyph">🏠</span><span>Home</span>
    </a>
    <a href="group-call.html" class="dock-node">
        <span class="dock-node-glyph">📞</span><span>Call</span>
    </a>
    <a href="profile.html" class="dock-node">
        <span class="dock-node-glyph">👤</span><span>Profile</span>
    </a>
    <a href="emergency.html" class="dock-node dock-node-emergency">
        <span class="dock-node-glyph">🚨</span><span>SOS</span>
    </a>
    <button type="button" id="more-dock-btn" class="dock-node dock-node-more" aria-label="Open more navigation">
        <span class="dock-node-glyph">☰</span><span>More</span>
    </button>
</nav>

<div id="more-menu-overlay" class="more-menu-overlay"></div>
<div id="more-menu" class="more-menu" aria-hidden="true">
    <div class="more-menu-header">
        <div class="more-menu-title">More tools</div>
        <button type="button" class="more-menu-close" id="more-menu-close" aria-label="Close more menu">✕</button>
    </div>
    <div class="more-menu-grid">
        <a href="plotter.html" class="more-menu-item">
            <span class="more-menu-icon">📍</span><span>Plotter</span>
        </a>
        <a href="compass.html" class="more-menu-item">
            <span class="more-menu-icon">🧭</span><span>Compass</span>
        </a>
        <a href="ebook.html" class="more-menu-item">
            <span class="more-menu-icon">📖</span><span>eBook</span>
        </a>
        <a href="channel.html" class="more-menu-item">
            <span class="more-menu-icon">📡</span><span>Channels</span>
        </a>
        <a href="map.html" class="more-menu-item">
            <span class="more-menu-icon">🗺️</span><span>Map</span>
        </a>
        <a href="admin.html" class="more-menu-item" data-more-admin-item>
            <span class="more-menu-icon">⚙️</span><span>Admin</span>
        </a>
    </div>
    <div class="more-menu-note">Tap outside to close. Additional tools can be added here later without changing bottom navigation.</div>
</div>

</div>
`;
}

export async function mount(container, params = {}) {
  _container = container;

  // Reset module state
  currentUser = null;
  likedSet.clear();
  pfpCache.clear();
  nameCache.clear();
  postCache.clear();
  base64ImageString = '';
  currentPage = 0;
  allLoaded = false;

  container.innerHTML = renderHTML();

  // Ensure global functions referenced by inline attributes exist.
  // The original page used inline handlers; we preserve behavior by binding these to module logic.
  window.handleTypingSound = handleTypingSound;
  window.previewSelectedImage = previewSelectedImage;
  // These are set after supabase client init.

  const sbClient = getSupabaseClient();
  window.submitInstagramPost = () => submitInstagramPost(sbClient);
  window.loadMorePosts = () => loadMorePosts(sbClient);
  
  // Attach SPA navigation for bottom dock + menu links (no window.location reload).
  _onContainerClick = (e) => {
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return;
    // Only intercept legacy page links.
    if (href.endsWith('.html')) {
      e.preventDefault();
      const map = {
        home: '/home',
        'home.html': '/home',
        'group-call.html': '/group-call',
        'profile.html': '/profile',
        'emergency.html': '/emergency',
        'plotter.html': '/plotter',
        'compass.html': '/compass',
        'ebook.html': '/ebook',
        'channel.html': '/channel',
        'map.html': '/map',
        'admin.html': '/admin',
      };
      const key = href;
      routerNavigate(map[key] || '/home');
    }
  };
  container.addEventListener('click', _onContainerClick);

  // More menu listeners
  const moreDockBtn = document.getElementById('more-dock-btn');
  const moreMenuClose = document.getElementById('more-menu-close');
  const moreMenuOverlay = document.getElementById('more-menu-overlay');

  _onMoreDockClick = () => toggleMoreMenu(true);
  _onMoreMenuCloseClick = () => toggleMoreMenu(false);
  _onMoreOverlayClick = () => toggleMoreMenu(false);

  if (moreDockBtn) moreDockBtn.addEventListener('click', _onMoreDockClick);
  if (moreMenuClose) moreMenuClose.addEventListener('click', _onMoreMenuCloseClick);
  if (moreMenuOverlay) moreMenuOverlay.addEventListener('click', _onMoreOverlayClick);

  // Escape handling
  const moreMenu = document.getElementById('more-menu');
  _onKeydown = function (event) {
    if (event.key === 'Escape' && moreMenu && moreMenu.classList.contains('active')) {
      event.preventDefault();
      toggleMoreMenu(false);
    }
  };
  document.addEventListener('keydown', _onKeydown);

  // Admin button (legacy uses #admin-btn which is not in home.html)
  // Keep behavior if present in other injected markup.
  const adminButton = document.getElementById('admin-btn');
  if (adminButton) adminButton.addEventListener('click', checkAdminAccess);

  const composerAvatar = document.getElementById('composer-avatar');
  // Lazy load not applicable here, but keep consistent.

  // File input + post button are already wired via inline handlers; we can additionally bind for cleanup.
  const imageUpload = document.getElementById('image-upload');
  const postInput = document.getElementById('post-input');
  const postBtn = document.querySelector('.btn-post');
  const loadMoreBtn = document.getElementById('load-more-btn');

  _onFileChange = (ev) => previewSelectedImage(ev.target);
  _onComposerKeydown = () => handleTypingSound();
  _onPostBtnClick = () => submitInstagramPost(sbClient);
  _onLoadMoreClick = () => loadMorePosts(sbClient);

  if (imageUpload) imageUpload.addEventListener('change', _onFileChange);
  if (postInput) postInput.addEventListener('keydown', _onComposerKeydown);
  if (postBtn) postBtn.addEventListener('click', _onPostBtnClick);
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', _onLoadMoreClick);

  // Mount boot logic
  const uid = await resolveSession(sbClient);
  if (!uid) {
    routerNavigate('/login');
    return;
  }

  const { data: profile, error: profileErr } = await sbClient
    .from('users')
    .select('*')
    .eq('id', uid)
    .single();

  if (profileErr || !profile) {
    console.error('Profile fetch failed:', profileErr);
    try {
      const {
        data: { user },
      } = await sbClient.auth.getUser();
      if (user) {
        const { error: createErr } = await sbClient.from('users').insert({
          id: user.id,
          name: user.user_metadata?.name || 'UNKNOWN',
          rank: user.user_metadata?.rank || 'UNIT',
          email: user.email,
        });
        if (!createErr) {
          // Keep legacy behavior: reload was used; in SPA do navigation refresh.
          routerNavigate('/home');
          return;
        }
      }
    } catch (e) {
      console.error('Recovery attempt failed:', e);
    }
    routerNavigate('/login');
    return;
  }

  currentUser = profile;
  nameCache.set(uid, profile);

  const officerTag = document.getElementById('officer-header-tag');
  if (officerTag) officerTag.textContent = profile.rank || 'UNIT';

  if (profile.pfp) {
    const avatarEl = document.getElementById('composer-avatar');
    if (avatarEl) avatarEl.src = profile.pfp;
    pfpCache.set(uid, profile.pfp);
  }

  // More menu Admin visibility
  const moreAdminItem = document.querySelector('[data-more-admin-item]');
  if (moreAdminItem) {
    const isAdmin = currentUser && (currentUser.admin || currentUser.is_admin || currentUser.role === 'admin');
    moreAdminItem.style.display = isAdmin ? 'flex' : 'none';
  }

  // Initial fetch
  await Promise.all([loadMyLikes(sbClient, uid), backfillMyPosts(sbClient, uid), loadPostsPage(sbClient, 0)]);

  if (window.CADRE && window.CADRE.ai) CADRE.ai.welcome(currentUser);

  // Realtime subscription
  _realtimeChannel = sbClient
    .channel('public:ig_feed_posts')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ig_feed_posts' },
      (payload) => {
        // scheduleRealtimeRefresh expects closure; keep same debounce semantics.
        clearTimeout(_realtimeDebounceTimer);
        _realtimeDebounceTimer = setTimeout(function () {
          handleRealtimeEvent(sbClient, payload);
        }, 300);
      }
    )
    .subscribe();
}

export async function unmount(container) {
  if (_container !== container) _container = container;
  if (!container) return;

  // Unsubscribe realtime
  if (_realtimeChannel) {
    try {
      await _realtimeChannel.unsubscribe();
    } catch (e) {}
    _realtimeChannel = null;
  }

  if (_realtimeDebounceTimer) {
    clearTimeout(_realtimeDebounceTimer);
    _realtimeDebounceTimer = null;
  }
  for (const t of _safetyTimeouts) clearTimeout(t);
  _safetyTimeouts.clear();

  // Remove listeners
  document.removeEventListener('keydown', _onKeydown);
  _onKeydown = null;

  const moreDockBtn = document.getElementById('more-dock-btn');
  const moreMenuClose = document.getElementById('more-menu-close');
  const moreOverlay = document.getElementById('more-menu-overlay');

  if (moreDockBtn && _onMoreDockClick) moreDockBtn.removeEventListener('click', _onMoreDockClick);
  if (moreMenuClose && _onMoreMenuCloseClick) moreMenuClose.removeEventListener('click', _onMoreMenuCloseClick);
  if (moreOverlay && _onMoreOverlayClick) moreOverlay.removeEventListener('click', _onMoreOverlayClick);

  _onMoreDockClick = null;
  _onMoreMenuCloseClick = null;
  _onMoreOverlayClick = null;

  if (_onFileChange) {
    const imageUpload = document.getElementById('image-upload');
    if (imageUpload) imageUpload.removeEventListener('change', _onFileChange);
  }
  if (_onComposerKeydown) {
    const postInput = document.getElementById('post-input');
    if (postInput) postInput.removeEventListener('keydown', _onComposerKeydown);
  }
  if (_onPostBtnClick) {
    const postBtn = document.querySelector('.btn-post');
    if (postBtn) postBtn.removeEventListener('click', _onPostBtnClick);
  }
  if (_onLoadMoreClick) {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) loadMoreBtn.removeEventListener('click', _onLoadMoreClick);
  }

  _onFileChange = null;
  _onComposerKeydown = null;
  _onPostBtnClick = null;
  _onLoadMoreClick = null;

  if (_onContainerClick) {
    container.removeEventListener('click', _onContainerClick);
    _onContainerClick = null;
  }

  // Remove module-local globals used by inline handlers
  try {
    delete window.handleTypingSound;
    delete window.previewSelectedImage;
    delete window.submitInstagramPost;
    delete window.loadMorePosts;
  } catch {}

  // Clear DOM
  container.innerHTML = '';

  // Clear state
  currentUser = null;
  likedSet.clear();
  pfpCache.clear();
  nameCache.clear();
  postCache.clear();
  base64ImageString = '';
  allLoaded = false;
  currentPage = 0;

  _container = null;
}

