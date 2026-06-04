// SPA View Module: login (migrated from index.html)
// IMPORTANT: This is the "Initialize Profile" page.
// It creates Supabase auth account + inserts into `users` table.

import { getSupabaseClient } from '../../supabase-client.js';

let _container = null;
let _onSubmit = null;
let _onConfirmDeploy = null;

function renderHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>CADRE - Initialize Profile</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<div class="app-container">
    <main class="gateway-wrapper">
        <div class="gateway-card">
            <div class="gateway-title-block">
                <img src="Cadre logo png.jpg" alt="CADRE Emblem" class="gateway-emblem">
                <h1 class="gateway-h1">Profile Setup</h1>
                <p class="gateway-p">Initialize Personnel Records</p>
            </div>

            <form id="profile-registration-form">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="reg-name" class="form-field" placeholder="e.g. Officer John Doe" required>
                </div>
                <div class="form-group">
                    <label>Assigned Rank</label>
                    <input type="text" id="reg-rank" class="form-field" placeholder="e.g. Inspector" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="reg-email" class="form-field" placeholder="operator@cadre.com" required>
                </div>
                <div class="form-group">
                    <label>Security Access Code</label>
                    <input type="password" id="reg-password" class="form-field" placeholder="••••••••" minlength="6" required>
                </div>
                <button type="submit" class="btn-auth-action">Generate System Preview</button>
            </form>

            <div id="preview-gate-shield" style="display:none; margin-top:20px; padding:15px; border:1px solid #ccc;">
                <h3>Preview: <span id="preview-target-name"></span></h3>
                <p>Rank: <span id="preview-target-rank"></span></p>
                <button id="confirm-deploy-btn" class="btn-auth-action" style="background:green;">Confirm & Initialize</button>
            </div>

            <div class="gateway-footer-link">
                <span style="color:var(--text-dim);">Already Registered?</span>
                <a href="#/login" data-nav="login">Access System</a>
            </div>
        </div>
    </main>
</div>

</body>
</html>
`;
}

export async function mount(container, params = {}) {
  _container = container;
  container.innerHTML = renderHTML();

  // Remove HTML head/body and scripts effects are not necessary because SPA already has them.
  // Our logic runs against the container DOM.

  const supabase = getSupabaseClient();

  let stagedData = null;

  const form = container.querySelector('#profile-registration-form');
  const previewShield = container.querySelector('#preview-gate-shield');
  const previewName = container.querySelector('#preview-target-name');
  const previewRank = container.querySelector('#preview-target-rank');
  const confirmBtn = container.querySelector('#confirm-deploy-btn');

  _onSubmit = (e) => {
    e.preventDefault();
    stagedData = {
      name: container.querySelector('#reg-name').value.trim(),
      rank: container.querySelector('#reg-rank').value.trim(),
      email: container.querySelector('#reg-email').value.toLowerCase().trim(),
      password: container.querySelector('#reg-password').value
    };

    previewName.textContent = stagedData.name;
    previewRank.textContent = stagedData.rank;
    previewShield.style.display = 'block';
  };

  _onConfirmDeploy = async () => {
    if (!stagedData) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Initializing...';

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: stagedData.email,
        password: stagedData.password,
        options: {
          data: { name: stagedData.name, rank: stagedData.rank }
        }
      });

      if (authError) {
        alert('DEPLOYMENT CRASH: ' + authError.message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm & Initialize';
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        alert('DEPLOYMENT CRASH: Could not retrieve user ID.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm & Initialize';
        return;
      }

      const { error: insertError } = await supabase.from('users').insert({
        id: userId,
        name: stagedData.name,
        rank: stagedData.rank,
        email: stagedData.email
      });

      if (insertError) {
        console.error('Insert error:', insertError);

        // Duplicate signup attempt -> update
        if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
          const { error: updateErr } = await supabase
            .from('users')
            .update({ name: stagedData.name, rank: stagedData.rank })
            .eq('id', userId);

          if (updateErr) {
            console.error('Update error:', updateErr);
            alert('PROFILE SAVE FAILED: ' + updateErr.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm & Initialize';
            return;
          }
        } else {
          console.error('DB insert error:', insertError);
          alert('PROFILE SAVE FAILED: ' + insertError.message);
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm & Initialize';
          return;
        }
      }

      alert('SUCCESS: Profile initialized. Please log in.');

      localStorage.setItem('cadre_uid', userId);
      localStorage.setItem('cadre_email', stagedData.email);

      // Navigation via router
      setTimeout(() => {
        if (window.router?.navigate) window.router.navigate('#/login');
        else window.location.hash = '#/login';
      }, 100);
    } catch (err) {
      console.error('Unexpected error during signup:', err);
      alert('UNEXPECTED ERROR: ' + err.message);
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm & Initialize';
    }
  };

  form.addEventListener('submit', _onSubmit);
  confirmBtn.addEventListener('click', _onConfirmDeploy);

  // Delegate internal navigation
  const _onContainerClick = (e) => {
    const a = e.target?.closest?.('a[data-nav]');
    if (!a) return;
    e.preventDefault();
    if (a.getAttribute('data-nav') === 'login') window.router?.navigate?.('#/login');
  };
  container.__loginClickHandler = _onContainerClick;
  container.addEventListener('click', _onContainerClick);
}

export async function unmount(container) {
  if (_container !== container) _container = container;

  if (_onSubmit) {
    const form = container.querySelector('#profile-registration-form');
    if (form) form.removeEventListener('submit', _onSubmit);
    _onSubmit = null;
  }

  if (_onConfirmDeploy) {
    const confirmBtn = container.querySelector('#confirm-deploy-btn');
    if (confirmBtn) confirmBtn.removeEventListener('click', _onConfirmDeploy);
    _onConfirmDeploy = null;
  }

  if (container.__loginClickHandler) {
    container.removeEventListener('click', container.__loginClickHandler);
    delete container.__loginClickHandler;
  }

  container.innerHTML = '';
  _container = null;
}

