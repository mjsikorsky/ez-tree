import * as THREE from 'three';
import {VRMSpringBoneJoint,VRMSpringBoneManager,VRMSpringBoneCollider,VRMSpringBoneColliderShape} from './vendor/three-vrm-springbone.mjs';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const position=new THREE.Vector3();
export const defaults={stiffness:36,damping:.30,contactMargin:.06};
export function nearestSegment(branches,p,limit=branches.length){
 let best=null;
 for(let b=0;b<limit;b++)for(let s=0;s<branches[b].rest.length-1;s++){
  const a=branches[b].rest[s],c=branches[b].rest[s+1],dx=c.x-a.x,dy=c.y-a.y,dz=c.z-a.z;
  const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);
  const d=(p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2+(p.z-a.z-dz*t)**2;
  if(!best||d<best.distance2)best={branch:b,segment:s,t,distance2:d};
 }return best;
}

// Application collider primitive only. Pixiv owns integration, response, length
// preservation, previous/current-tail state and quaternion updates.
export class ScreenWindowShape extends VRMSpringBoneColliderShape{
 constructor(solver,branch){super();this.solver=solver;this.branch=branch;}
 get type(){return 'screen-window';}
 calculateCollision(_matrix,object,radius,target){
  const s=this.solver,w=s.window,b=this.branch;
  if(!w||b.released)return 1;
  const p=s.project(object),padding=s.options.contactMargin+radius;
  // Signed distance to a rectangle, extruded along the camera's depth axis.
  const cx=w.x+w.width/2,cy=w.y+w.height/2;
  const dx=p.x-cx,dy=p.y-cy,ex=Math.abs(dx)-w.width/2,ey=Math.abs(dy)-w.height/2;
  const ox=Math.max(ex,0),oy=Math.max(ey,0),outside=Math.hypot(ox,oy);
  const distance=outside+Math.min(Math.max(ex,ey),0)-padding;
  if(distance>=0)return distance;
  let nx,ny;
  if(outside>1e-10){nx=ox/outside*(dx<0?-1:1);ny=oy/outside*(dy<0?-1:1);}
  else if(ex>ey){nx=dx<0?-1:1;ny=0;}
  else{nx=0;ny=dy<0?-1:1;}
  target.copy(s.frame.right).multiplyScalar(nx).addScaledVector(s.frame.up,ny);
  s.contactCount++;return distance;
 }
}

export class BranchSolver{
 constructor(skeleton,options={}){
  this.engine='@pixiv/three-vrm-springbone@3.5.5';
  this.options={...defaults,...options};this.time=0;this.window=null;this.contactCount=0;this.releaseTransitions=0;
  this.frame={origin:new THREE.Vector3(),right:new THREE.Vector3(1,0,0),up:new THREE.Vector3(0,1,0)};
  this.rig=new THREE.Group();this.manager=new VRMSpringBoneManager();
  this.branches=skeleton.branches.map((source,id)=>{
   const rest=source.sections.map(s=>({x:s.origin.x,y:s.origin.y,z:s.origin.z??0,radius:s.radius}));
   return{id,rest,points:rest.map(p=>({...p})),nodes:rest.map(()=>new THREE.Object3D()),parent:null,joints:[],released:false,releaseInitialized:false,length:rest.slice(1).map((p,i)=>Math.hypot(p.x-rest[i].x,p.y-rest[i].y,p.z-rest[i].z))};
  });
  for(const b of this.branches){
   if(b.id){b.parent=nearestSegment(this.branches,b.rest[0],b.id);if(!b.parent||b.parent.distance2>1e-6)throw Error(`Cannot resolve branch ${b.id} attachment`);}
   const parent=b.parent?this.branches[b.parent.branch].nodes[b.parent.segment]:this.rig;
   parent.add(b.nodes[0]);
   const p=b.parent?this.branches[b.parent.branch].rest[b.parent.segment]:{x:0,y:0,z:0};
   b.nodes[0].position.set(b.rest[0].x-p.x,b.rest[0].y-p.y,b.rest[0].z-p.z);
   for(let i=1;i<b.nodes.length;i++){b.nodes[i-1].add(b.nodes[i]);b.nodes[i].position.set(b.rest[i].x-b.rest[i-1].x,b.rest[i].y-b.rest[i-1].y,b.rest[i].z-b.rest[i-1].z);}
  }
  this.rig.updateMatrixWorld(true);
  for(const b of this.branches){
   b.inverseRest=b.nodes.map(n=>n.matrixWorld.clone().invert());b.transforms=b.nodes.map(()=>new THREE.Matrix4());
   if(!b.parent)continue;
   b.collider=new VRMSpringBoneCollider(new ScreenWindowShape(this,b));
   const groups=[{colliders:[b.collider]}];
   for(let i=0;i<b.nodes.length-1;i++){
    if(b.length[i]<1e-7)continue;
    const joint=new VRMSpringBoneJoint(b.nodes[i],b.nodes[i+1],{stiffness:this.options.stiffness/12,dragForce:.08,gravityPower:0,gravityDir:new THREE.Vector3(0,-1,0),hitRadius:Math.min(.14,b.rest[i+1].radius)},groups);
    this.manager.addJoint(joint);b.joints.push(joint);
   }
  }
  this.manager.setInitState();this.readPose();
 }
 project(p){const x=p.x-this.frame.origin.x,y=p.y-this.frame.origin.y,z=p.z-this.frame.origin.z;return{x:x*this.frame.right.x+y*this.frame.right.y+z*this.frame.right.z,y:x*this.frame.up.x+y*this.frame.up.y+z*this.frame.up.z};}
 setFrame(frame){this.frame.origin.copy(frame.origin);this.frame.right.copy(frame.right);this.frame.up.copy(frame.up);}
 readPose(){
  this.rig.updateMatrixWorld(true);
  for(const b of this.branches)for(let i=0;i<b.nodes.length;i++){
   position.setFromMatrixPosition(b.nodes[i].matrixWorld);Object.assign(b.points[i],{x:position.x,y:position.y,z:position.z});
   b.transforms[i].multiplyMatrices(b.nodes[i].matrixWorld,b.inverseRest[i]);
  }
 }
 reset(){
  this.time=0;this.window=null;this.contactCount=0;this.releaseTransitions=0;
  for(const b of this.branches){b.released=false;b.releaseInitialized=false;}
  this.manager.reset();this.readPose();
 }
 step(dt,window=null){
  if(!(dt>0&&dt<=1/30))throw Error('Use fixed substeps <= 1/30 second');
  this.time+=dt;this.window=window?{...window}:null;this.contactCount=0;
  for(const b of this.branches){
   if(!b.parent)continue;
   if(!window){b.released=false;b.releaseInitialized=false;}
   else{
    // Rest attachment + hysteresis: deformation cannot switch its own contact.
    const root=this.project(b.rest[0]),h=.12;
    const inside=root.x>window.x+h&&root.x<window.x+window.width-h;
    const outside=root.x<window.x-h||root.x>window.x+window.width+h;
    const released=b.released? !outside:inside;
    if(b.releaseInitialized&&released!==b.released)this.releaseTransitions++;
    b.released=released;b.releaseInitialized=true;
   }
   b.collider.updateWorldMatrix(false,false);
   const k=this.options.stiffness/12*(1+Math.min(3,b.rest[0].radius*2));
   for(const joint of b.joints){joint.settings.stiffness=k;joint.settings.dragForce=clamp(this.options.damping,0,1);}
  }
  this.manager.update(dt);this.readPose();
 }
 metrics(){
  let lengthError=0,maxDisplacement=0;
  for(const b of this.branches)for(let i=0;i<b.points.length;i++){
   const p=b.points[i],r=b.rest[i];maxDisplacement=Math.max(maxDisplacement,Math.hypot(p.x-r.x,p.y-r.y,p.z-r.z));
   if(i){const a=b.points[i-1];lengthError=Math.max(lengthError,Math.abs(Math.hypot(p.x-a.x,p.y-a.y,p.z-a.z)-b.length[i-1]));}
  }
  return{lengthError,maxDisplacement,contacts:this.contactCount,releaseTransitions:this.releaseTransitions,branches:this.branches.length,joints:this.manager.joints.size};
 }
 snapshot(){return{schema:'ez-tree-window-lab/v2',engine:this.engine,coordinates:'3D world units; window in camera right/up coordinates',time:this.time,options:{...this.options},window:this.window,frame:{origin:this.frame.origin.toArray(),right:this.frame.right.toArray(),up:this.frame.up.toArray()},metrics:this.metrics(),branches:this.branches.map(b=>({id:b.id,parent:b.parent,rest:b.rest,points:b.points,released:b.released,quaternions:b.nodes.map(n=>n.quaternion.toArray())}))};}
}
