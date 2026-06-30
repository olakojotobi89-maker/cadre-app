const supabaseUrl = 'https://ihroattnnnsckvvbosfz.supabase.co';
const supabaseKey = 'sb_publishable_M0wwGKR9he08sEfHhZQQxA_vmnXS2eX';
const sb = supabase.createClient(supabaseUrl, supabaseKey);

const uid = localStorage.getItem("cadre_uid");

let map;
let myMarker;
let officerMarkers = {};

async function init() {

    if (!uid) {
        alert("No session found");
        window.location.href = "index.html";
        return;
    }

    // Load user profile
    const { data: user } = await sb
        .from("users")
        .select("*")
        .eq("id", uid)
        .single();

    document.getElementById("userInfo").innerText =
        `${user.name} | ${user.rank}`;

    // Init map
    map = L.map('map').setView([6.5244, 3.3792], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'CADRE GRID'
    }).addTo(map);

    // Start GPS tracking
    startTracking(user);

    // Load all officers
    loadOfficers();

    // Realtime updates
    subscribeRealtime();
}

function startTracking(user) {

    navigator.geolocation.watchPosition(async (pos) => {

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // update DB
        await sb.from("officer_locations").upsert({
            user_id: uid,
            lat,
            lng,
            updated_at: new Date().toISOString()
        });

        // update self marker
        if (!myMarker) {
            myMarker = L.marker([lat, lng]).addTo(map)
                .bindPopup("YOU");
        } else {
            myMarker.setLatLng([lat, lng]);
        }

        map.setView([lat, lng]);

    }, (err) => {
        console.log(err);
    }, {
        enableHighAccuracy: true
    });
}

async function loadOfficers() {

    const { data } = await sb.from("officer_locations").select("*");

    data.forEach(o => {
        if (!officerMarkers[o.user_id]) {

            officerMarkers[o.user_id] = L.marker([o.lat, o.lng])
                .addTo(map)
                .bindPopup(o.user_id);

        } else {
            officerMarkers[o.user_id].setLatLng([o.lat, o.lng]);
        }
    });
}

function subscribeRealtime() {

    sb.channel('officer_locations')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'officer_locations'
        }, payload => {

            const o = payload.new;

            if (!o) return;

            if (!officerMarkers[o.user_id]) {
                officerMarkers[o.user_id] =
                    L.marker([o.lat, o.lng]).addTo(map);
            } else {
                officerMarkers[o.user_id].setLatLng([o.lat, o.lng]);
            }
        })
        .subscribe();
}

init();
