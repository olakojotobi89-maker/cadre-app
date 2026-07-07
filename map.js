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
function createTrail(unit){

const trail=document.createElement("div");

trail.className="trail";

trail.style.left=unit.x+"%";

trail.style.top=unit.y+"%";

trail.style.background=unit.color;

trail.style.boxShadow=`0 0 10px ${unit.color}`;

document.querySelector(".map-grid").appendChild(trail);

setTimeout(()=>{

trail.remove();

},4000);

}
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
/*=========================================
TACTICAL GRID ENGINE
=========================================*/

const grid=document.getElementById("tactical-grid");

const letters="ABCDEFGHIJKLMNOPQRST";

for(let row=0;row<20;row++){

    for(let col=0;col<20;col++){

        const cell=document.createElement("div");

        cell.className="grid-cell";

        cell.dataset.grid=letters[row]+String(col+1).padStart(2,"0");

        cell.innerHTML=cell.dataset.grid;

        cell.onclick=()=>selectGrid(cell);

        grid.appendChild(cell);

    }

}

function selectGrid(cell){

document.querySelectorAll(".grid-cell.active")

.forEach(c=>c.classList.remove("active"));

cell.classList.add("active");

const gridRef=cell.dataset.grid;

const lat=(6.50+Math.random()/10).toFixed(5);

const lon=(3.30+Math.random()/10).toFixed(5);

const terrain=["Urban","Forest","River","High Ground","Open Field"];

const risk=["LOW","MEDIUM","HIGH"];

const intel=document.querySelectorAll(".intel-box");

intel[0].innerHTML=`

<h2>${gridRef}</h2>

<br>

Latitude : ${lat}

<br><br>

Longitude : ${lon}

<br><br>

Terrain : ${terrain[Math.floor(Math.random()*terrain.length)]}

<br><br>

Threat : ${risk[Math.floor(Math.random()*risk.length)]}

<br><br>

${new Date().toLocaleTimeString()}

`;

}
/*====================================
LIVE UNIT ENGINE
====================================*/

const units={



const: units=[
   {

id:"alpha-unit",

name:"ALPHA",

route:[

{x:15,y:20},

{x:30,y:25},

{x:45,y:40},

{x:60,y:35},

{x:80,y:50}

],

index:0,

color:"#00ff66"

},

{

id:"bravo-unit",

name:"BRAVO",

route:[

{x:70,y:15},

{x:60,y:30},

{x:55,y:50},

{x:72,y:70}

],

index:0,

color:"#00ccff"

},

{

id:"charlie-unit",

name:"CHARLIE",

route:[

{x:15,y:70},

{x:30,y:65},

{x:45,y:55},

{x:55,y:40}

],

index:0,

color:"#ffff00"

}

], 
}
units.forEach(unit=>{

const marker=document.getElementById(unit.id);

marker.dataset.name=unit.name;

const angle=Math.random()*360;

marker.style.left=unit.x+"%";

marker.style.top=unit.y+"%";

marker.style.transform=`rotate(${angle}deg)`;

});



units.forEach(unit=>{

createTrail(unit);

unit.x+=(Math.random()*6)-3;

unit.y+=(Math.random()*6)-3;

setInterval(patrolUnits,1200);
units.forEach(unit=>{

document.getElementById(unit.id)

.addEventListener("click",()=>{

const intel=document.querySelectorAll(".intel-box");

intel[0].innerHTML=`

<h2>${unit.name}</h2>

<br>

STATUS : ACTIVE

<br><br>

GRID :

${String.fromCharCode(65+Math.floor(unit.y/5))}${Math.floor(unit.x)}

<br><br>

SPEED :

${10+Math.floor(Math.random()*40)} km/h

<br><br>

HEADING :

${Math.floor(Math.random()*360)}°

<br><br>

BATTERY :

${70+Math.floor(Math.random()*30)}%

`;

});

});
/*=========================================
TACTICAL CROSSHAIR
=========================================*/

const crossX=document.getElementById("grid-crosshair-x");

const crossY=document.getElementById("grid-crosshair-y");

map.addEventListener("mousemove",(e)=>{

const rect=map.getBoundingClientRect();

crossX.style.top=(e.clientY-rect.top)+"px";

crossY.style.left=(e.clientX-rect.left)+"px";

});
})
function radarPing(){

units.forEach(unit=>{

const marker=document.getElementById(unit.id);

marker.animate(

[

{

boxShadow:`0 0 15px ${unit.color}`

},

{

boxShadow:`0 0 45px white`

},

{

boxShadow:`0 0 15px ${unit.color}`

}

],

{

duration:700

});

});

}

setInterval(radarPing,5000);
const radarAudio=new Audio("audio/radar.mp3");

radarAudio.volume=.2;

setInterval(()=>{

radarAudio.currentTime=0;

radarAudio.play().catch(()=>{});

},5000);
const missions=[

"PATROLLING",

"SEARCHING",

"ESCORT",

"SURVEILLANCE",

"RECON",

"RESPONDING"

];

function updateMission(){

units.forEach(unit=>{

unit.mission=

missions[Math.floor(Math.random()*missions.length)];

});

}

setInterval(updateMission,8000);