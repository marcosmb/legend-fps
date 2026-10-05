import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const root=document.getElementById('game');
const hpEl=document.getElementById('hp'),rupeeEl=document.getElementById('rupees'),keysEl=document.getElementById('keys'),weaponEl=document.getElementById('weapon'),ammoEl=document.getElementById('ammo'),objectiveEl=document.getElementById('objective-text'),promptEl=document.getElementById('prompt'),toastEl=document.getElementById('toast'),locEl=document.getElementById('location-name');
const hud=document.getElementById('hud'),intro=document.getElementById('intro'),dialogue=document.getElementById('dialogue'),pause=document.getElementById('pause'),inventory=document.getElementById('inventory'),mobile=document.getElementById('mobile');
const speakerEl=document.getElementById('dialogue-speaker'),dialogueTextEl=document.getElementById('dialogue-text');
const inventoryGrid=document.getElementById('inventory-grid');

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12; root.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8da7ae);
scene.fog=new THREE.FogExp2(0x8da7ae,0.0085);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,900);
camera.position.set(0,1.7,8);
const clock=new THREE.Clock();

const world=new THREE.Group(); scene.add(world);
const actors=new THREE.Group(); world.add(actors);
const props=new THREE.Group(); world.add(props);
const effects=new THREE.Group(); world.add(effects);

const hemi=new THREE.HemisphereLight(0xcfe1ed,0x46503e,2.15); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1d0,3.1); sun.position.set(-90,120,70); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-120;sun.shadow.camera.right=120;sun.shadow.camera.top=120;sun.shadow.camera.bottom=-120; scene.add(sun);
const fill=new THREE.DirectionalLight(0xa5c8e6,.45); fill.position.set(80,35,-90); scene.add(fill);

const state={
 zone:'village',started:false,paused:false,dialogueOpen:false,shopOpen:false,
 hp:6,maxHp:6,rupees:35,keys:0,bombs:3,weapon:'sword',inv:new Set(['sword']),quest:'intro',
 doorOpen:false,fortressOpen:false,hasMap:false,hasCompass:false,chestOpened:false,crystalSolved:false,bossDefeated:false,relic:false,
 npcs:[],enemies:[],items:[],colliders:[],interactive:[],projectiles:[],messages:[],dialogueLines:[],dialogueIndex:0,
 spawn:{village:new THREE.Vector3(0,1.7,18),field:new THREE.Vector3(-26,1.7,3),dungeon:new THREE.Vector3(-15,1.7,40)}
};
const held=new Set();
let yaw=0,pitch=-0.03,attackCooldown=0,toastTimer=0,shake=0;

const weapons={sword:['ESPADA','∞'],boomerang:['BOOMERANG','∞'],bow:['ARCO','FLECHAS'],bomb:['BOMBA','3'],candle:['VELA','∞'],rod:['VARITA','MAGIA']};

function texPattern(base,accent,type='ground'){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 x.fillStyle=base;x.fillRect(0,0,256,256);
 for(let i=0;i<900;i++){const px=Math.random()*256,py=Math.random()*256,r=.3+Math.random()*2; x.fillStyle=accent; x.globalAlpha=.1+Math.random()*.16; x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill()}
 x.globalAlpha=1;
 if(type==='stone'){x.strokeStyle='rgba(0,0,0,.15)';x.lineWidth=2;for(let y=0;y<256;y+=42){x.beginPath();x.moveTo(0,y);x.lineTo(256,y+6);x.stroke()}}
 const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(type==='ground'?7:2, type==='ground'?7:2);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const groundTex=texPattern('#687b51','#b2ad75');
const pathTex=texPattern('#8d805f','#c8b78a');
const wallTex=texPattern('#9b8c73','#e6d6ad','stone');
const dungeonFloorTex=texPattern('#4c4d4a','#6e6b62','stone');
const woodTex=texPattern('#684a31','#a87e51');
const grassMat=new THREE.MeshStandardMaterial({map:groundTex,roughness:1});
const pathMat=new THREE.MeshStandardMaterial({map:pathTex,roughness:1});
const stoneMat=new THREE.MeshStandardMaterial({map:wallTex,roughness:.92});
const darkStoneMat=new THREE.MeshStandardMaterial({map:dungeonFloorTex,roughness:1,metalness:.05});
const woodMat=new THREE.MeshStandardMaterial({map:woodTex,roughness:.9});

function cube(name,w,h,d,mat,pos,collide=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.copy(pos);m.castShadow=true;m.receiveShadow=true;props.add(m);if(collide)colliderFromMesh(m);return m}
function colliderFromMesh(m){const b=new THREE.Box3().setFromObject(m);state.colliders.push(b)}
function clearZone(){while(world.children.length){world.remove(world.children[0])};world.add(actors,props,effects);state.npcs=[];state.enemies=[];state.items=[];state.colliders=[];state.interactive=[]}
function ground(size,mat,y=0){const g=new THREE.Mesh(new THREE.PlaneGeometry(size,size),mat);g.rotation.x=-Math.PI/2;g.position.y=y;g.receiveShadow=true;props.add(g);return g}
function tree(x,z,scale=1){const trunk=cube('Trunk',.7*scale,3*scale,.7*scale,woodMat,new THREE.Vector3(x,1.5*scale,z),true);trunk.castShadow=true;const crown=new THREE.Mesh(new THREE.ConeGeometry(2.4*scale,5.7*scale,9),new THREE.MeshStandardMaterial({color:0x3d6b3c,roughness:1}));crown.position.set(x,5.2*scale,z);crown.castShadow=true;crown.receiveShadow=true;props.add(crown)}
function house(x,z,w=10,d=8,color=0xbca883){const body=cube('House',w,4.6,d,new THREE.MeshStandardMaterial({color,roughness:.93}),new THREE.Vector3(x,2.3,z),true);body.castShadow=true;const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.72,3.2,4),new THREE.MeshStandardMaterial({color:0x563a2c,roughness:.92}));roof.rotation.y=Math.PI/4;roof.scale.set(w/Math.max(w,d),1,d/Math.max(w,d));roof.position.set(x,6.2,z);roof.castShadow=true;props.add(roof);
const door=cube('Door',1.7,2.8,.18,new THREE.MeshStandardMaterial({color:0x3a271a}),new THREE.Vector3(x,1.4,z-d/2-.11),false);door.userData.interactive='door';state.interactive.push(door);
for(const side of [-1,1]){const win=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.2,.1),new THREE.MeshStandardMaterial({color:0x9bc3d2,metalness:.1,roughness:.3,emissive:0x19364c,emissiveIntensity:.2}));win.position.set(x+side*(w*.28),2.6,z-d/2-.12);props.add(win)}
}
function well(x,z){const ring=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,1,14),stoneMat);ring.position.set(x,.5,z);ring.castShadow=true;props.add(ring);const water=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,.08,32),new THREE.MeshStandardMaterial({color:0x376a7f,roughness:.2,metalness:.1}));water.position.set(x,1.02,z);props.add(water)}
function sign(text,x,z){const c=document.createElement('canvas');c.width=512;c.height=128;const xctx=c.getContext('2d');xctx.fillStyle='#4a3829';xctx.fillRect(0,0,512,128);xctx.fillStyle='#e4d49b';xctx.font='bold 34px serif';xctx.textAlign='center';xctx.fillText(text,256,78);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.BoxGeometry(4,.9,.12),new THREE.MeshStandardMaterial({map:t,roughness:.8}));m.position.set(x,2,z);m.rotation.y=Math.PI;props.add(m)}
function npc(name,x,z,kind,color=0x9f7658){const g=new THREE.Group();g.position.set(x,0,z);g.userData={type:'npc',name,kind};const body=new THREE.Mesh(new THREE.CapsuleGeometry(.58,1.25,6,10),new THREE.MeshStandardMaterial({color,roughness:.85}));body.position.y=1.18;body.castShadow=true;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.44,16,12),new THREE.MeshStandardMaterial({color:0xc49b78,roughness:.9}));head.position.y=2.45;head.castShadow=true;g.add(head);const tag=labelSprite(name);tag.position.y=3.4;g.add(tag);actors.add(g);state.npcs.push(g);return g}
function labelSprite(text){const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.fillStyle='rgba(7,10,7,.75)';x.roundRect?.(8,8,496,80,20);x.fill();x.fillStyle='#f0dd9a';x.font='bold 28px system-ui';x.textAlign='center';x.fillText(text,256,59);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}));s.scale.set(3.2,.6,1);return s}
function enemy(kind,x,z,hp=3){const g=new THREE.Group();g.position.set(x,0,z);g.userData={type:'enemy',kind,name:{slime:'Moco Verde',bat:'Murciélago Umbrío',wolf:'Lobo Ceniza',knight:'Caballero Hueco',boss:'Guardián del Eclipse'}[kind],hp,maxHp:hp,cool:0,phase:Math.random()*6};let mat=new THREE.MeshStandardMaterial({color:kind==='boss'?0x6d2935:kind==='knight'?0x687985:kind==='bat'?0x5b3f76:kind==='wolf'?0x725948:0x5d984d,roughness:.85});
let body;if(kind==='boss')body=new THREE.Mesh(new THREE.CapsuleGeometry(1.1,2.2,7,12),mat);else body=new THREE.Mesh(new THREE.IcosahedronGeometry(kind==='knight'?1.0:kind==='wolf'?1.15:kind==='slime'?.85:.75,2),mat);body.position.y=kind==='boss'?2.1:.95;body.castShadow=true;g.add(body);
if(kind==='knight'||kind==='boss'){const blade=cube('EnemyBlade',.18,2.2,.18,new THREE.MeshStandardMaterial({color:0xd2d4d3,metalness:.7,roughness:.3}),new THREE.Vector3(1.0,1.2,0),false);blade.rotation.z=-.3;g.add(blade)}
if(kind==='bat'){for(const s of [-1,1]){const wing=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.8),new THREE.MeshStandardMaterial({color:0x3b2b50,side:THREE.DoubleSide,transparent:true,opacity:.85}));wing.position.set(s*.8,1.3,0);wing.rotation.y=s*.4;g.add(wing)}}
actors.add(g);state.enemies.push(g);return g}
function itemMesh(kind,x,z){let geo,mat=new THREE.MeshStandardMaterial({color:kind==='heart'?0xe45858:kind==='rupee'?0x46c7a0:kind==='key'?0xe1c86d:kind==='relic'?0xf5dc77:kind==='map'?0xd9d0b1:0xb8c6cc,metalness:.15,roughness:.35});if(kind==='key')geo=new THREE.TorusGeometry(.35,.11,8,16);else if(kind==='heart')geo=new THREE.OctahedronGeometry(.42,1);else if(kind==='rupee')geo=new THREE.OctahedronGeometry(.42,0);else geo=new THREE.BoxGeometry(.7,.55,.15);const m=new THREE.Mesh(geo,mat);m.position.set(x,.75,z);m.castShadow=true;m.userData={type:'item',kind};props.add(m);state.items.push(m);return m}
function buildVillage(){
clearZone();scene.background.set(0x91a9ae);scene.fog.color.set(0x91a9ae);scene.fog.density=.0065;
ground(170,grassMat);
const road=new THREE.Mesh(new THREE.PlaneGeometry(24,135),pathMat);road.rotation.x=-Math.PI/2;road.position.set(0,.015,-10);road.receiveShadow=true;props.add(road);
house(-24,-18,14,11,0xb9a47d);house(24,-18,14,11,0xc2aa82);house(-24,16,13,10,0x9c987e);house(24,16,13,10,0xb2a286);house(0,-52,16,10,0x8c7863);
well(0,2);sign('VILLA ROBLE',0,11);
for(const t of [[-43,-42,1.15],[42,-39,1.25],[-46,6,1],[45,5,1.2],[-42,43,1.1],[42,43,1.1],[0,55,1.25],[-14,48,.9],[17,48,1]])tree(t[0],t[1],t[2]);
npc('Alma, la anciana',-2,-8,'elder',0xd6d0bf);npc('Bran, el herrero',-20,-13,'smith',0x72513c);npc('Nora, la mercader',20,-13,'merchant',0x4d6685);npc('Lio, el explorador',19,18,'child',0x638454);
itemMesh('key',-10,5);itemMesh('rupee',10,3);itemMesh('heart',27,27);
state.interactive.push(...state.npcs);
setObjective(state.quest==='intro'?'Habla con Alma, la anciana':'Regresa a Villa Roble');
locEl.textContent='VILLA ROBLE';camera.position.copy(state.spawn.village);yaw=Math.PI;
}
function buildField(){
clearZone();scene.background.set(0x7f9a9a);scene.fog.color.set(0x7f9a9a);scene.fog.density=.0075;ground(190,grassMat);
for(let i=0;i<34;i++){const x=(Math.random()*2-1)*78,z=(Math.random()*2-1)*78;if(Math.abs(x)<26&&Math.abs(z)<18)continue;tree(x,z,.7+Math.random()*.7)}
const path=new THREE.Mesh(new THREE.PlaneGeometry(15,160),pathMat);path.rotation.x=-Math.PI/2;path.position.y=.02;props.add(path);
house(-38,-32,12,9,0x8e7c64);house(37,24,13,9,0xb69e78);
npc('Eren, guardabosques',-27,-3,'ranger',0x607b5e);
enemy('slime',-6,-5,3);enemy('bat',18,-20,2);enemy('wolf',25,10,4);enemy('knight',30,29,6);
itemMesh('rupee',-13,-23);itemMesh('heart',23,-30);
const gate=cube('FortressGate',5,6,1.1,stoneMat,new THREE.Vector3(0,-71,0),true);gate.userData.interactive='fortressGate';state.interactive.push(gate);
sign('FORTALEZA DEL ECLIPSE',0,-64);locEl.textContent='CAMINO DEL ESTE';setObjective(state.doorOpen?'Abre la puerta de la fortaleza':'Busca la llave y abre el camino');
camera.position.copy(state.spawn.field);yaw=0;
}
function buildDungeon(){
clearZone();scene.background.set(0x11141a);scene.fog.color.set(0x11141a);scene.fog.density=.018;
ground(130,darkStoneMat);
const roomWall=(x,z,w,d,h=6)=>{cube('DungeonWall',w,h,d,stoneMat,new THREE.Vector3(x,h/2,z),true)};
for(let x=-55;x<=55;x+=14){roomWall(x,-58,12,2);roomWall(x,58,12,2)}
for(let z=-44;z<=44;z+=14){roomWall(-55,z,2,12);roomWall(55,z,2,12)}
// interior chamber walls
roomWall(-18,0,2,40);roomWall(18,0,2,40);roomWall(0,-20,36,2);roomWall(0,20,36,2);
roomWall(-37,-8,24,2);roomWall(-37,8,24,2);roomWall(37,-8,24,2);roomWall(37,8,24,2);
for(const x of [-42,42])for(const z of [-40,40])torch(x,z);
itemMesh('key',-42,-35);itemMesh('map',-36,0);itemMesh('compass',36,0);itemMesh('rupee',4,-36);
const chest=cube('AncientChest',2.1,1.3,1.4,new THREE.MeshStandardMaterial({color:0x59422a,metalness:.25,roughness:.55}),new THREE.Vector3(0,0.65,0),true);chest.userData.interactive='chest';state.interactive.push(chest);
const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.9,1),new THREE.MeshStandardMaterial({color:0x4a93bb,emissive:0x193d55,emissiveIntensity:1.8,metalness:.2,roughness:.18}));crystal.position.set(36,2,-36);crystal.userData.interactive='crystal';props.add(crystal);state.interactive.push(crystal);
enemy('slime',-36,25,4);enemy('bat',-9,33,3);enemy('knight',30,22,7);enemy('boss',0,42,24);
itemMesh('relic',0,47);
locEl.textContent='FORTALEZA DEL ECLIPSE';setObjective('Encuentra la llave y explora la fortaleza');camera.position.copy(state.spawn.dungeon);yaw=0;
}
function torch(x,z){const base=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,1.2,8),woodMat);base.position.set(x,1.1,z);base.castShadow=true;props.add(base);const flame=new THREE.Mesh(new THREE.SphereGeometry(.3,10,10),new THREE.MeshStandardMaterial({color:0xffb14a,emissive:0xff742b,emissiveIntensity:3}));flame.position.set(x,2.1,z);props.add(flame);const l=new THREE.PointLight(0xffa45b,12,12,2);l.position.set(x,2.2,z);l.castShadow=true;l.shadow.mapSize.set(256,256);props.add(l)}

function setObjective(t){objectiveEl.textContent=t}
function toast(t,ms=2200){toastEl.textContent=t;toastEl.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.style.opacity=0,ms)}
function hudUpdate(){hpEl.textContent='♥'.repeat(state.hp)+'♡'.repeat(state.maxHp-state.hp);rupeeEl.textContent=state.rupees;keysEl.textContent=state.keys;weaponEl.textContent=weapons[state.weapon][0];ammoEl.textContent=state.weapon==='bomb'?state.bombs:weapons[state.weapon][1]}
function cycleWeapon(){const order=['sword','boomerang','bow','bomb','candle','rod'];let i=order.indexOf(state.weapon);for(let k=1;k<=order.length;k++){const next=order[(i+k)%order.length];if(state.inv.has(next)){state.weapon=next;hudUpdate();toast('Equipado: '+weapons[next][0],800);return}}}
function nearestNpc(){let best=null,bd=3.0;for(const n of state.npcs){const d=n.position.distanceTo(camera.position);if(d<bd){bd=d;best=n}}return best}
function nearestItem(){let best=null,bd=2.2;for(const it of state.items){const d=it.position.distanceTo(camera.position);if(d<bd){bd=d;best=it}}return best}
function interact(){
if(state.paused||state.dialogueOpen)return;
const n=nearestNpc();if(n){talk(n);return}
const it=nearestItem();if(it){pickup(it);return}
const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const hits=ray.intersectObjects(props.children,true).filter(h=>h.distance<4);const obj=hits[0]?.object;
if(!obj)return;let target=obj;while(target.parent&&!target.userData.interactive)target=target.parent;
if(target.userData.interactive==='fortressGate'){if(state.keys>0&&!state.fortressOpen){state.keys--;state.fortressOpen=true;toast('La puerta de la Fortaleza se abre');setObjective('Entra en la Fortaleza del Eclipse');hudUpdate()}else if(state.fortressOpen){buildDungeon() }else toast('Necesitas una llave')}
else if(target.userData.interactive==='chest'){if(state.chestOpened){toast('El cofre está vacío')}else if(state.keys<1){toast('El cofre está cerrado: necesitas una llave')}else{state.keys--;state.chestOpened=true;state.inv.add('boomerang');state.weapon='boomerang';toast('Has conseguido el BOOMERANG');setObjective('Activa el cristal antiguo con el boomerang');hudUpdate();target.scale.y=.45}}
else if(target.userData.interactive==='crystal'){if(!state.inv.has('boomerang'))toast('El cristal responde a una fuerza que aún no posees');else if(!state.crystalSolved){state.crystalSolved=true;toast('El cristal se rompe y desbloquea la cámara final');setObjective('Derrota al Guardián del Eclipse');target.material.emissiveIntensity=4}}
}
function pickup(it){
state.items=state.items.filter(x=>x!==it);it.removeFromParent();const k=it.userData.kind;
if(k==='key'){state.keys++;toast('Llave obtenida');}
else if(k==='rupee'){state.rupees+=5;toast('+5 rupias');}
else if(k==='heart'){state.hp=Math.min(state.maxHp,state.hp+2);toast('Has recuperado vida');}
else if(k==='map'){state.hasMap=true;toast('Mapa de la Fortaleza obtenido');}
else if(k==='compass'){state.hasCompass=true;toast('Brújula obtenida');}
else if(k==='relic'){state.relic=true;state.quest='done';toast('✦ RELIQUIA DEL AMANECER OBTENIDA ✦',3200);setObjective('Regresa a Villa Roble con la Reliquia');}
hudUpdate()
}
function talk(n){
const k=n.userData.kind;
let lines=[];
if(k==='elder'){lines=state.quest==='intro'?['Has llegado justo cuando el reino más te necesita.','La Fortaleza del Eclipse ha despertado y seis reliquias antiguas han desaparecido.','Encuentra una llave en Villa Roble. Abre el camino del este y recupera la primera Reliquia.']:['La Fortaleza no se conquista con fuerza bruta. Observa sus salas, busca llaves y aprende a utilizar cada objeto.'];if(state.quest==='intro')state.quest='village';setObjective('Encuentra la llave de Villa Roble y abre el camino')}
if(k==='smith')lines=['La espada será tu compañera, pero no dependas siempre de ella.','El boomerang puede activar mecanismos y alcanzar enemigos a distancia.','Un arquero inteligente no deja que el enemigo se acerque.'];
if(k==='merchant')lines=['Tengo provisiones para quien se atreva a salir del pueblo.','Hoy no hay tienda completa, pero volveré a llenar mis estantes pronto.'];
if(k==='child')lines=['He visto una luz azul cerca de las ruinas del este.','Mi abuelo decía que las piedras antiguas escuchan a quien lleva el arma correcta.'];
if(k==='ranger')lines=['La fortaleza está al fondo del camino.','Los monstruos de fuera son sólo el aviso de lo que encontrarás dentro.','Una llave abre la puerta. El resto depende de ti.'];
openDialogue(n.userData.name,lines)
}
function openDialogue(name,lines){state.dialogueOpen=true;state.dialogueLines=lines;state.dialogueIndex=0;speakerEl.textContent=name;dialogueTextEl.textContent=lines[0]||'';dialogue.classList.remove('hidden')}
function nextDialogue(){if(!state.dialogueOpen)return;if(state.dialogueIndex<state.dialogueLines.length-1){state.dialogueIndex++;dialogueTextEl.textContent=state.dialogueLines[state.dialogueIndex]}else{state.dialogueOpen=false;dialogue.classList.add('hidden')}}
function damagePlayer(){if(state.hp<=0)return;state.hp--;shake=.16;hudUpdate();if(state.hp<=0){toast('Has caído en combate');pauseGame(true)}}
function attack(){
if(!state.started||state.paused||state.dialogueOpen||attackCooldown>0)return;attackCooldown=.32;
if(state.weapon==='bomb'){if(state.bombs<=0){toast('No quedan bombas');return}state.bombs--;hudUpdate();spawnProjectile('bomb');return}
if(state.weapon==='candle'){toast('La llama ilumina el camino',900);return}
spawnProjectile(state.weapon)
}
function spawnProjectile(type){
const dir=new THREE.Vector3();camera.getWorldDirection(dir);
const start=camera.position.clone().add(dir.clone().multiplyScalar(.8));const g=new THREE.Group();g.position.copy(start);g.userData={type,life:1.8,dir:dir.clone()};const mat=new THREE.MeshStandardMaterial({color:type==='boomerang'?0xd3ad5e:type==='bow'?0xd9dce1:type==='rod'?0x9b76d0:0x2d2f2a,emissive:type==='rod'?0x442070:0x000000,emissiveIntensity:2});const m=new THREE.Mesh(type==='bomb'?new THREE.SphereGeometry(.35,12,8):new THREE.IcosahedronGeometry(.18,1),mat);g.add(m);effects.add(g);state.projectiles.push(g)
}
function projectilesUpdate(dt){
for(let i=state.projectiles.length-1;i>=0;i--){const p=state.projectiles[i];p.userData.life-=dt;p.position.addScaledVector(p.userData.dir,24*dt);p.rotateY(10*dt);
if(p.userData.type==='bomb'&&p.userData.life<=0){explode(p.position);p.removeFromParent();state.projectiles.splice(i,1);continue}
let hit=false;for(const e of state.enemies){if(e.userData.hp>0&&e.position.distanceTo(p.position)<1.2){e.userData.hp-=p.userData.type==='rod'?4:p.userData.type==='bomb'?6:2;hit=true;if(e.userData.hp<=0)killEnemy(e);break}}
if(hit||p.userData.life<=0){if(p.userData.type==='bomb')explode(p.position);p.removeFromParent();state.projectiles.splice(i,1)}
}
}
function explode(pos){for(const e of state.enemies)if(e.userData.hp>0&&e.position.distanceTo(pos)<4){e.userData.hp-=6;if(e.userData.hp<=0)killEnemy(e)}}
function killEnemy(e){e.userData.hp=0;toast(e.userData.name+' derrotado');state.rupees+=e.userData.kind==='boss'?20:2;e.visible=false;if(e.userData.kind==='boss'){state.bossDefeated=true;state.crystalSolved=true;state.relic=true;state.items.forEach(it=>it.userData.kind==='relic'&&(it.visible=true));setObjective('Recoge la Reliquia del Amanecer')}hudUpdate()}
function enemiesUpdate(dt){
for(const e of state.enemies){if(e.userData.hp<=0)continue;e.userData.cool=Math.max(0,e.userData.cool-dt);const d=e.position.distanceTo(camera.position);if(d<28){const dir=camera.position.clone().sub(e.position);dir.y=0;dir.normalize();const speed=e.userData.kind==='boss'?1.5:e.userData.kind==='knight'?.85:1.1;e.position.addScaledVector(dir,speed*dt);e.position.y=Math.sin(clock.elapsedTime*3+e.userData.phase)*.08;if(d<2.1&&e.userData.cool<=0){e.userData.cool=e.userData.kind==='boss'?.55:1;damagePlayer()}}}
}
function collides(pos){const r=.42;const box=new THREE.Box3(new THREE.Vector3(pos.x-r,pos.y-.9,pos.z-r),new THREE.Vector3(pos.x+r,pos.y+.3,pos.z+r));return state.colliders.some(b=>b.intersectsBox(box))}
function movement(dt){
const forward=(held.has('w')?1:0)-(held.has('s')?1:0),strafe=(held.has('d')?1:0)-(held.has('a')?1:0);if(!forward&&!strafe)return;
const len=Math.hypot(forward,strafe)||1;const f=forward/len,s=strafe/len,speed=(held.has('shift')?7.2:4.8)*dt;const dir=new THREE.Vector3(Math.sin(yaw)*f+Math.cos(yaw)*s,0,Math.cos(yaw)*f-Math.sin(yaw)*s);
const np=camera.position.clone().addScaledVector(dir,speed);if(!collides(np))camera.position.copy(np);
}
function transitionCheck(){const z=camera.position.z;if(state.zone==='village'&&z<-57){buildField();return}if(state.zone==='field'&&z>68){buildVillage();return}if(state.zone==='field'&&z<-67&&state.fortressOpen){buildDungeon();return}if(state.zone==='dungeon'&&z>53&&state.relic){state.quest='done';buildField();state.zone='field';camera.position.set(-26,1.7,4);setObjective('Regresa a Villa Roble con la Reliquia');toast('Has salido de la fortaleza');}}
function cameraUpdate(){
camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;if(shake>0){shake*=.84;camera.position.y=1.7+Math.sin(clock.elapsedTime*55)*shake}}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2))}
function pauseGame(v){state.paused=v;pause.classList.toggle('hidden',!v);if(v)document.exitPointerLock?.();else canvasPointer()}
function canvasPointer(){if(state.started&&!state.paused&&!state.dialogueOpen)renderer.domElement.requestPointerLock?.()}
function updatePrompt(){if(!state.started||state.paused||state.dialogueOpen){promptEl.style.opacity=0;return}const n=nearestNpc(),it=nearestItem();let t='';if(n)t='E · Hablar con '+n.userData.name;else if(it)t='E · Recoger objeto';else{const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const h=ray.intersectObjects(props.children,true).filter(v=>v.distance<3.6)[0];let o=h?.object;while(o?.parent&&!o.userData.interactive)o=o.parent;if(o?.userData.interactive==='fortressGate')t=state.fortressOpen?'E · Entrar en la fortaleza':'E · Abrir puerta de la fortaleza';else if(o?.userData.interactive==='chest')t='E · Abrir cofre';else if(o?.userData.interactive==='crystal')t='E · Activar cristal'}promptEl.textContent=t;promptEl.style.opacity=t?1:0}
function updateInventory(){inventoryGrid.innerHTML='';for(const k of ['sword','boomerang','bow','bomb','candle','rod']){const d=document.createElement('div');d.className='inventory-item';d.innerHTML='<b>'+weapons[k][0]+'</b><small>'+ (state.inv.has(k)?'ENCONTRADO':'AÚN NO')+'</small>';inventoryGrid.appendChild(d)}}
function startGame(){state.started=true;state.paused=false;intro.classList.add('hidden');hud.classList.remove('hidden');buildVillage();hudUpdate();updateInventory();toast('Bienvenido a Villa Roble · habla con Alma');canvasPointer();if('ontouchstart' in window)mobile.classList.remove('hidden')}
document.getElementById('start').onclick=startGame;document.getElementById('resume').onclick=()=>pauseGame(false);document.getElementById('restart').onclick=()=>location.reload();document.getElementById('dialogue-next').onclick=nextDialogue;document.getElementById('close-inventory').onclick=()=>inventory.classList.add('hidden');
document.addEventListener('click',e=>{if(e.target===dialogue)nextDialogue()});
renderer.domElement.addEventListener('mousedown',e=>{if(e.button===0){attack();canvasPointer()}});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement&&!state.paused&&!state.dialogueOpen){yaw-=e.movementX*.0021;pitch-=e.movementY*.0021;pitch=Math.max(-1.35,Math.min(1.35,pitch))}});
document.addEventListener('keydown',e=>{
const k=e.key.toLowerCase();
if(k==='w'||k==='a'||k==='s'||k==='d'||k==='shift'){held.add(k);e.preventDefault();return}
if(k==='escape'){if(state.dialogueOpen){dialogue.classList.add('hidden');state.dialogueOpen=false;return}if(!inventory.classList.contains('hidden')){inventory.classList.add('hidden');return}if(state.started)pauseGame(!state.paused);return}
if(!state.started||state.paused)return;
if(k==='e'||k==='enter'){if(state.dialogueOpen)nextDialogue();else interact();return}
if(k==='tab'){e.preventDefault();inventory.classList.toggle('hidden');updateInventory();return}
if(k>='1'&&k<='6'){const order=['sword','boomerang','bow','bomb','candle','rod'];const wk=order[+k-1];if(state.inv.has(wk)){state.weapon=wk;hudUpdate()};return}
if(k==='q'){cycleWeapon();return}
});
document.addEventListener('keyup',e=>{const k=e.key.toLowerCase();held.delete(k)});
document.addEventListener('blur',()=>held.clear());

const joy=document.getElementById('joystick'),knob=document.getElementById('joystick-knob');let joyPointer=null;
function joyMove(e){if(joyPointer!==e.pointerId)return;const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const max=48,len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max}knob.style.transform='translate('+(-50+dx/max*50)+'%,'+(-50+dy/max*50)+'%)';held.delete('w');held.delete('s');held.delete('a');held.delete('d');if(dy<-12)held.add('w');if(dy>12)held.add('s');if(dx<-12)held.add('a');if(dx>12)held.add('d')}
joy?.addEventListener('pointerdown',e=>{joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e)});joy?.addEventListener('pointermove',joyMove);joy?.addEventListener('pointerup',()=>{joyPointer=null;['w','a','s','d'].forEach(k=>held.delete(k));knob.style.transform='translate(-50%,-50%)'});
document.querySelectorAll('#mobile-actions button').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();const a=b.dataset.act;if(a==='attack')attack();if(a==='interact')interact();if(a==='weapon')cycleWeapon()}));

function renderWeapon(){
 const old=document.getElementById('weapon-view');if(old)old.remove();
 const g=new THREE.Group();g.name='weapon-view';camera.add(g);
 const gripMat=new THREE.MeshStandardMaterial({color:0x613f2a,roughness:.9});const metal=new THREE.MeshStandardMaterial({color:0xd0d4d1,metalness:.75,roughness:.28});
 const grip=new THREE.Mesh(new THREE.CylinderGeometry(.11,.13,.75,10),gripMat);grip.rotation.x=Math.PI/2;grip.position.set(.22,-.42,-.66);g.add(grip);
 if(state.weapon==='sword'){const blade=new THREE.Mesh(new THREE.BoxGeometry(.14,.9,.05),metal);blade.position.set(.22,-.03,-.66);blade.rotation.x=.18;g.add(blade);const guard=new THREE.Mesh(new THREE.BoxGeometry(.48,.07,.08),new THREE.MeshStandardMaterial({color:0xb8934e,metalness:.6,roughness:.4}));guard.position.set(.22,-.45,-.66);g.add(guard)}
 else {const orb=new THREE.Mesh(new THREE.TorusGeometry(.28,.055,8,18),new THREE.MeshStandardMaterial({color:state.weapon==='boomerang'?0xd2aa5c:state.weapon==='bow'?0x9a6b40:state.weapon==='bomb'?0x242722:state.weapon==='candle'?0xe2d49c:0x8d6bb5,metalness:.25,roughness:.45}));orb.position.set(.22,-.22,-.67);orb.rotation.x=.8;g.add(orb)}
}
function weaponRefresh(){renderWeapon()}
const originalHud=hudUpdate;hudUpdate=function(){originalHud();updateInventory();};

function loop(){
 requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);
 if(state.started&&!state.paused&&!state.dialogueOpen&&!state.shopOpen&&!inventory.classList.contains('hidden')){
   movement(dt);enemiesUpdate(dt);projectilesUpdate(dt);transitionCheck();attackCooldown=Math.max(0,attackCooldown-dt);
 }
 if(state.started&&!state.paused){cameraUpdate();updatePrompt();renderer.render(scene,camera)}
}
addEventListener('resize',resize);resize();renderer.render(scene,camera);
