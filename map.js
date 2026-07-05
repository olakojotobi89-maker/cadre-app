/* ============================================
   CADRE TACTICAL COMMAND MAP
   map.js
============================================ */

const map = document.querySelector(".map-view");
const clock = document.getElementById("system-clock");
const network = document.getElementById("network-status");

let zoom = 1;

/* ============================================
   LIVE MILITARY CLOCK
============================================ */

function updateClock(){

const now = new Date();

clock.innerHTML = now.toLocaleTimeString("en-GB",{
hour12:false
});

}

setInterval(updateClock,1000);

updateClock();

/* ============================================
   NETWORK STATUS
============================================ */

function updateNetwork(){

if(navigator.onLine){

network.innerHTML="ONLINE";
network.style.color="#00ff84";

}else{

network.innerHTML="OFFLINE";
network.style.color="#ff3b3b";

}

}

window.addEventListener("online",updateNetwork);
window.addEventListener("offline",updateNetwork);

updateNetwork();

/* ============================================
   ZOOM CONTROLS
============================================ */

const buttons=document.querySelectorAll(".map-controls button");

buttons[0].onclick=()=>{

zoom+=0.15;

map.style.transform=`scale(${zoom})`;

}

buttons[1].onclick=()=>{

zoom=Math.max(0.6,zoom-0.15);

map.style.transform=`scale(${zoom})`;

}

/* ============================================
   COMPASS BUTTON
============================================ */

buttons[2].onclick=()=>{

alert("Compass Locked");

}

/* ============================================
   SATELLITE BUTTON
============================================ */

buttons[3].onclick=()=>{

alert("Satellite Link Active");

}

/* ============================================
   TARGET MODE
============================================ */

buttons[4].onclick=()=>{

alert("Target Acquisition Enabled");

}

/* ============================================
   SETTINGS
============================================ */

buttons[5].onclick=()=>{

alert("System Settings");

}

/* ============================================
   DRAG MAP
============================================ */

let drag=false;

let startX=0;
let startY=0;

let x=0;
let y=0;

map.addEventListener("mousedown",(e)=>{

drag=true;

startX=e.clientX-x;

startY=e.clientY-y;

});

document.addEventListener("mouseup",()=>{

drag=false;

});

document.addEventListener("mousemove",(e)=>{

if(!drag)return;

x=e.clientX-startX;

y=e.clientY-startY;

map.style.backgroundPosition=
`${x}px ${y}px`;

});

/* ============================================
   TOUCH DRAG
============================================ */

map.addEventListener("touchstart",(e)=>{

drag=true;

startX=e.touches[0].clientX-x;

startY=e.touches[0].clientY-y;

});

document.addEventListener("touchend",()=>{

drag=false;

});

document.addEventListener("touchmove",(e)=>{

if(!drag)return;

x=e.touches[0].clientX-startX;

y=e.touches[0].clientY-startY;

map.style.backgroundPosition=
`${x}px ${y}px`;

});

/* ============================================
   CLICKABLE MARKERS
============================================ */

const markers=document.querySelectorAll(".marker");

markers.forEach(marker=>{

marker.addEventListener("click",()=>{

if(marker.classList.contains("friendly")){

showIntel("Friendly Unit","Alpha Response Team");

}

if(marker.classList.contains("enemy")){

showIntel("Enemy Activity","Unknown hostile movement detected.");

}

if(marker.classList.contains("hq")){

showIntel("Headquarters","CADRE National Command.");

}

if(marker.classList.contains("drone")){

showIntel("Recon Drone","Drone transmitting live reconnaissance.");

}

if(marker.classList.contains("sos")){

showIntel("Emergency Signal","Distress beacon received.");

}

});

});

/* ============================================
   UPDATE INTEL PANEL
============================================ */

function showIntel(title,text){

const boxes=document.querySelectorAll(".intel-box");

boxes[0].innerHTML=`

<h2>${title}</h2>

<br>

${text}

`;

}

/* ============================================
   RANDOM DRONE MOVEMENT
============================================ */

const drone=document.querySelector(".drone");

let droneX=15;
let droneY=25;

setInterval(()=>{

droneX+=(Math.random()*8)-4;
droneY+=(Math.random()*8)-4;

droneX=Math.max(5,Math.min(95,droneX));
droneY=Math.max(5,Math.min(95,droneY));

drone.style.left=droneX+"%";
drone.style.top=droneY+"%";

},2500);

/* ============================================
   RANDOM ENEMY MOVEMENT
============================================ */

const enemy=document.querySelector(".enemy");

let enemyX=22;
let enemyY=65;

setInterval(()=>{

enemyX+=(Math.random()*5)-2.5;
enemyY+=(Math.random()*5)-2.5;

enemyX=Math.max(5,Math.min(95,enemyX));
enemyY=Math.max(5,Math.min(95,enemyY));

enemy.style.left=enemyX+"%";
enemy.style.top=enemyY+"%";

},5000);

/* ============================================
   GPS SIMULATION
============================================ */

const hud=document.querySelectorAll(".bottom-hud span");

setInterval(()=>{

hud[1].innerHTML=
(6.5244+(Math.random()/500)).toFixed(5);

hud[2].innerHTML=
(3.3792+(Math.random()/500)).toFixed(5);

},3000);

/* ============================================
   RANDOM ALERTS
============================================ */

const events=[

"Drone entered Sector A",

"Bravo Team checked in",

"Satellite updated",

"Unknown signal detected",

"Intel packet received",

"Mission completed",

"Recon aircraft online",

"GPS synchronized",

"Thermal scan complete",

"Patrol moving"

];

setInterval(()=>{

const boxes=document.querySelectorAll(".intel-box");

boxes[3].innerHTML=

events[Math.floor(Math.random()*events.length)];

},6000);

/* ============================================
   KEYBOARD SHORTCUTS
============================================ */

document.addEventListener("keydown",(e)=>{

if(e.key==="+")buttons[0].click();

if(e.key==="=")buttons[0].click();

if(e.key==="-")buttons[1].click();

if(e.key==="Escape"){

zoom=1;

map.style.transform="scale(1)";

}

});

/* ============================================
   STARTUP
============================================ */

console.log("CADRE Tactical Command Map Loaded");