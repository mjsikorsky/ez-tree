import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
let initialized;
export const initRapier=()=>initialized??=RAPIER.init();
export const defaults={stiffness:36,damping:12,contactMargin:.06};
const SCALE=.1,IDENTITY={x:0,y:0,z:0,w:1};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function nearestSegment(branches,p,limit=branches.length){let best=null;
 for(let b=0;b<limit;b++)for(let s=0;s<branches[b].rest.length-1;s++){
  const a=branches[b].rest[s],c=branches[b].rest[s+1],dx=c.x-a.x,dy=c.y-a.y,dz=c.z-a.z;
  const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1),d=(p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2+(p.z-a.z-dz*t)**2;
  if(!best||d<best.distance2)best={branch:b,segment:s,t,distance2:d};
 }return best;
}

// Integration adapter only: all joints, motors, contact normals, impulses and
// overlap queries below are Rapier. No angle/position projection is performed.
export class BranchSolver{
 constructor(skeleton,options={}){
  this.engine='@dimforge/rapier3d-compat@0.21.0';this.options={...defaults,...options};this.source=skeleton;
  this.frame={origin:new THREE.Vector3(),right:new THREE.Vector3(1,0,0),up:new THREE.Vector3(0,1,0)};
  this.build();
 }
 build(){
  this.time=0;this.window=null;this.releaseTransitions=0;this.contactCount=0;this.reentries=0;this.deepReentries=0;this.windowReady=false;this.parameterKey='';this.windowSizeKey=null;this.activationEvents=[];
  this.world=new RAPIER.World({x:0,y:0,z:0});const ip=this.world.integrationParameters;
  ip.dt=1/480;ip.numSolverIterations=64;ip.numInternalPgsIterations=2;ip.maxCcdSubsteps=4;ip.normalizedAllowedLinearError=.0001;ip.normalizedPredictionDistance=.002;
  this.branches=this.source.branches.map((source,id)=>{const rest=source.sections.map(s=>({x:s.origin.x,y:s.origin.y,z:s.origin.z??0,radius:s.radius}));return{id,rest,points:rest.map(p=>({...p})),parent:null,bodies:[],colliders:[],transforms:rest.map(()=>new THREE.Matrix4()),length:rest.slice(1).map((p,i)=>Math.hypot(p.x-rest[i].x,p.y-rest[i].y,p.z-rest[i].z))};});
  this.groups=[];this.joints=[];
  for(const b of this.branches){
   if(b.id){b.parent=nearestSegment(this.branches,b.rest[0],b.id);if(!b.parent||b.parent.distance2>1e-6)throw Error(`Cannot resolve branch ${b.id}`);}
   if(!b.parent)continue;
   const parentBranch=this.branches[b.parent.branch];
   b.group=parentBranch.parent?parentBranch.group:{id:b.id,root:b.rest[0],state:'ACTIVE',branches:[],colliders:[],reentries:0,anchorBody:this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed())};
   if(!parentBranch.parent)this.groups.push(b.group);b.group.branches.push(b);
   const last=b.rest.length-1;
   b.proxyIndices=[0,...(last>1?[Math.floor(last/2)]:[]),last];
   b.proxyForSection=b.rest.map((_,i)=>Math.min(b.proxyIndices.length-2,i<b.proxyIndices[1]?0:1));
   for(let pi=0;pi<b.proxyIndices.length-1;pi++){
    const i=b.proxyIndices[pi],end=b.proxyIndices[pi+1];
    const a=b.rest[i],c=b.rest[end],delta=new THREE.Vector3(c.x-a.x,c.y-a.y,c.z-a.z),len=delta.length();
    if(len<1e-7)throw Error('Zero-length branch segment');
    const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(a.x*SCALE,a.y*SCALE,a.z*SCALE).setAdditionalMassProperties(.03,{x:delta.x*SCALE/2,y:delta.y*SCALE/2,z:delta.z*SCALE/2},{x:.001,y:.001,z:.001},IDENTITY).setLinearDamping(1).setAngularDamping(2).setCanSleep(false).setCcdEnabled(false));
    const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
    const radius=Math.max(.035,Math.min(.14,(a.radius+c.radius)/2))*SCALE;
    const desc=RAPIER.ColliderDesc.capsule(Math.max(.0001,len*SCALE/2-radius),radius).setTranslation(delta.x*SCALE/2,delta.y*SCALE/2,delta.z*SCALE/2).setRotation(rotation).setDensity(0).setFriction(.15).setRestitution(0).setCollisionGroups(0x00010002);
    const collider=this.world.createCollider(desc,body);b.bodies.push(body);b.colliders.push(collider);b.group.colliders.push(collider);
    const parent=pi?b.bodies[pi-1]:(parentBranch.parent?parentBranch.bodies[parentBranch.proxyForSection[b.parent.segment]]:b.group.anchorBody);
    const parentRest=pi?b.rest[b.proxyIndices[pi-1]]:(parentBranch.parent?parentBranch.rest[parentBranch.proxyIndices[parentBranch.proxyForSection[b.parent.segment]]]:{x:0,y:0,z:0});
    const anchor={x:(a.x-parentRest.x)*SCALE,y:(a.y-parentRest.y)*SCALE,z:(a.z-parentRest.z)*SCALE};
    const created=this.world.createImpulseJoint(RAPIER.JointData.spherical(anchor,{x:0,y:0,z:0}),parent,body,true);
    const joint=new RAPIER.SphericalImpulseJoint(created.rawSet,created.bodySet,created.handle);
    joint.setContactsEnabled(false);
    for(const axis of [RAPIER.JointAxis.AngX,RAPIER.JointAxis.AngY,RAPIER.JointAxis.AngZ])joint.configureMotorModel(axis,RAPIER.MotorModel.ForceBased);
    this.joints.push({joint,branch:b.id,index:i,parent,body,anchor,stiffnessScale:1+Math.min(3,a.radius*2)});
   }
  }
  this.windowBody=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,-100,0));
  this.windowShape=new RAPIER.Cuboid(.1,.1,5);
  this.windowCollider=this.world.createCollider(new RAPIER.ColliderDesc(this.windowShape).setCollisionGroups(0x00020001).setEnabled(false).setFriction(.15).setRestitution(0),this.windowBody);
  this.updateMotors();this.readPose();
 }
 updateMotors(){
  const key=`${this.options.stiffness}/${this.options.damping}`;if(key===this.parameterKey)return;this.parameterKey=key;
  for(const {joint,stiffnessScale}of this.joints){for(const axis of [RAPIER.JointAxis.AngX,RAPIER.JointAxis.AngY,RAPIER.JointAxis.AngZ]){joint.configureMotorPosition(axis,0,this.options.stiffness*stiffnessScale,this.options.damping);joint.setMotorMaxForce(axis,2*stiffnessScale);}}
 }
 project(p){const v=new THREE.Vector3(p.x,p.y,p.z).sub(this.frame.origin);return{x:v.dot(this.frame.right),y:v.dot(this.frame.up)};}
 setFrame(frame){for(const key of ['origin','right','up'])this.frame[key].copy(frame[key]);}
 reset(){this.world.free();this.build();}
 dispose(){this.world.free();}
 poseWindow(w){
  const center=this.frame.origin.clone().addScaledVector(this.frame.right,w.x+w.width/2).addScaledVector(this.frame.up,w.y+w.height/2).multiplyScalar(SCALE);
  const forward=new THREE.Vector3().crossVectors(this.frame.right,this.frame.up).normalize();
  const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(this.frame.right,this.frame.up,forward));
  const padding=this.options.contactMargin*SCALE;
  const shape=new RAPIER.Cuboid(w.width*SCALE/2+padding,w.height*SCALE/2+padding,5);
  return{center,rotation,shape};
 }
 groupClear(group,pose){
  group.minClearance=Infinity;
  for(const collider of group.colliders){const contact=collider.contactShape(pose.shape,pose.center,pose.rotation,.003);if(contact)group.minClearance=Math.min(group.minClearance,contact.distance);}
  return group.minClearance>.003;
 }
 setState(group,state){
  if(group.state===state)return;
  this.releaseTransitions++;group.state=state;
  for(const collider of group.colliders)collider.setSolverGroups(state==='ACTIVE'?0xffffffff:0);
 }
 updatePolicy(window,pose,first,resized){
  // Release an entire limb, including its descendants. Rearm only when Rapier
  // confirms every capsule is separated; never enable a deeply-overlapped pair.
  for(const group of this.groups){
   if(!window){this.setState(group,'ACTIVE');continue;}
   const root=this.project(group.root),h=.5;
   // Stop contacts before the kinematic solid reaches an immovable attachment.
   const covered=root.x>window.x-h&&root.x<window.x+window.width+h&&root.y>window.y-h&&root.y<window.y+window.height+h;
   if(covered){this.setState(group,'OCCLUDED');continue;}
   if(group.state==='OCCLUDED')this.setState(group,'WAIT_CLEAR');
   if(first&&group.state==='ACTIVE'&&!this.groupClear(group,pose))this.setState(group,'WAIT_CLEAR');
   // Resizing changes shape geometry, not kinematic velocity. Do not create
   // a new solid overlap when an expanding window engulfs a branch.
   if(resized&&group.state==='ACTIVE'&&!this.groupClear(group,pose))this.setState(group,'WAIT_CLEAR');
   if(group.state==='WAIT_CLEAR'&&this.groupClear(group,pose)){
    this.activationEvents.push({time:this.time,group:group.id,minClearance:group.minClearance});
    if(group.minClearance<=0)this.deepReentries++;
    this.setState(group,'ACTIVE');group.reentries++;this.reentries++;
   }
  }
 }
 step(dt,window=null){
  if(!(dt>0&&dt<=1/30))throw Error('Use fixed substeps <= 1/30 second');this.updateMotors();
  const previous=this.window;
  const resized=window&&previous&&(Math.abs(window.width-previous.width)>1e-6||Math.abs(window.height-previous.height)>1e-6);
  this.window=window?{...window}:null;
  const pose=window?this.poseWindow(window):null,first=!!window&&!this.windowReady;
  if(window){
   const sizeKey=`${window.width}/${window.height}/${this.options.contactMargin}`;
   if(sizeKey!==this.windowSizeKey){this.windowCollider.setShape(pose.shape);this.windowSizeKey=sizeKey;}
   this.windowCollider.setEnabled(true);
   if(first){this.windowBody.setTranslation(pose.center,true);this.windowBody.setRotation(pose.rotation,true);}
   this.windowReady=true;
  }else{this.windowCollider.setEnabled(false);this.windowReady=false;}
  // Fixed small steps. Kinematic targets interpolate the input trajectory;
  // Rapier infers collider velocity and owns contact impulse resolution.
  const startPos=this.windowBody.translation(),startRot=this.windowBody.rotation();
  const travel=pose?Math.hypot(pose.center.x-startPos.x,pose.center.y-startPos.y,pose.center.z-startPos.z)/SCALE:0;
  const steps=Math.max(1,Math.round(dt*480),Math.min(64,Math.ceil(travel/.15)));
  const startScreen=this.project({x:startPos.x/SCALE,y:startPos.y/SCALE,z:startPos.z/SCALE});
  const q0=new THREE.Quaternion(startRot.x,startRot.y,startRot.z,startRot.w);
  this.world.timestep=dt/steps;
  for(let i=1;i<=steps;i++){
   if(pose){const p=new THREE.Vector3(startPos.x,startPos.y,startPos.z).lerp(pose.center,i/steps),q=q0.clone().slerp(pose.rotation,i/steps);const t=i/steps;
    const subWindow={...window,x:startScreen.x-window.width/2+(window.x+window.width/2-startScreen.x)*t,y:startScreen.y-window.height/2+(window.y+window.height/2-startScreen.y)*t};
    this.updatePolicy(subWindow,{...pose,center:p,rotation:q},first&&i===1,resized&&i===1);
    this.windowBody.setNextKinematicTranslation(p);this.windowBody.setNextKinematicRotation(q);
   }else this.updatePolicy(null,null,false,false);
   this.world.step();
  }
  this.time+=dt;this.contactCount=0;
  if(window){const pairs=[];this.world.contactPairsWith(this.windowCollider,c=>pairs.push(c));for(const c of pairs)this.world.contactPair(this.windowCollider,c,m=>{this.contactCount+=m.numSolverContacts();});}
  this.readPose();
 }
 readPose(){
  const q=new THREE.Quaternion(),p=new THREE.Vector3(),unit=new THREE.Vector3(1,1,1);
  for(const b of this.branches){
   if(!b.parent)continue;
   b.released=b.group.state!=='ACTIVE';
   for(let i=0;i<b.rest.length;i++){
    const pi=b.proxyForSection[i],body=b.bodies[pi],t=body.translation(),r=body.rotation(),rest=b.rest[b.proxyIndices[pi]];p.set(t.x/SCALE,t.y/SCALE,t.z/SCALE);q.set(r.x,r.y,r.z,r.w);
    b.transforms[i].compose(p,q,unit).multiply(new THREE.Matrix4().makeTranslation(-rest.x,-rest.y,-rest.z));
    const point=new THREE.Vector3(b.rest[i].x,b.rest[i].y,b.rest[i].z).applyMatrix4(b.transforms[i]);Object.assign(b.points[i],{x:point.x,y:point.y,z:point.z});
   }
  }
 }
 metrics(){let lengthError=0,maxDisplacement=0,jointError=0;
  for(const b of this.branches)for(let i=0;i<b.points.length;i++){
   const p=b.points[i],r=b.rest[i];maxDisplacement=Math.max(maxDisplacement,Math.hypot(p.x-r.x,p.y-r.y,p.z-r.z));
   if(i){const a=b.points[i-1];lengthError=Math.max(lengthError,Math.abs(Math.hypot(p.x-a.x,p.y-a.y,p.z-a.z)-b.length[i-1]));}
  }
  const q=new THREE.Quaternion();for(const j of this.joints){const t=j.parent.translation(),r=j.parent.rotation();q.set(r.x,r.y,r.z,r.w);const anchor=new THREE.Vector3(j.anchor.x,j.anchor.y,j.anchor.z).applyQuaternion(q).add(new THREE.Vector3(t.x,t.y,t.z)),p=j.body.translation();jointError=Math.max(jointError,Math.hypot(anchor.x-p.x,anchor.y-p.y,anchor.z-p.z)/SCALE);}
  return{lengthError,jointError,maxDisplacement,contacts:this.contactCount,releaseTransitions:this.releaseTransitions,reentries:this.reentries,deepReentries:this.deepReentries,branches:this.branches.length,joints:this.joints.length,groups:this.groups.map(g=>({id:g.id,state:g.state}))};
 }
 snapshot(){return{schema:'ez-tree-window-lab/v3',engine:this.engine,physicsScale:SCALE,coordinates:'3D world units; Rapier meters = world units * 0.1',time:this.time,options:{...this.options},window:this.window,frame:Object.fromEntries(Object.entries(this.frame).map(([k,v])=>[k,v.toArray()])),metrics:this.metrics(),activations:this.activationEvents,branches:this.branches.map(b=>({id:b.id,parent:b.parent,rest:b.rest,points:b.points,released:b.released,state:b.group?.state??'FIXED'}))};}
}
