// Renderer-independent 2.5D reference solver. Coordinates are world units, Y up.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const defaults = { stiffness: 36, damping: 10, maxBend: 0.95, contactIterations: 10, contactMargin: 0.06 };

export function nearestSegment(branches, p, limit = branches.length) {
  let best = null;
  for (let b = 0; b < limit; b++) {
    const nodes = branches[b].rest;
    for (let s = 0; s < nodes.length - 1; s++) {
      const a = nodes[s], c = nodes[s + 1];
      const dx = c.x-a.x, dy = c.y-a.y, dz = (c.z??0)-(a.z??0);
      const t = clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+((p.z??0)-(a.z??0))*dz)/(dx*dx+dy*dy+dz*dz || 1),0,1);
      const d = (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2+((p.z??0)-(a.z??0)-t*dz)**2;
      if (!best || d < best.distance2) best = { branch:b, segment:s, t, distance2:d };
    }
  }
  return best;
}

export class BranchSolver {
  constructor(skeleton, options = {}) {
    this.options = {...defaults, ...options};
    this.time = 0; this.contacts = []; this.window = null;
    this.branches = skeleton.branches.map((source, id) => {
      const rest = source.sections.map(s => ({ x:s.origin.x, y:s.origin.y, z:s.origin.z, radius:s.radius }));
      const length = [], angle = [];
      for (let i=0;i<rest.length-1;i++) {
        length.push(Math.hypot(rest[i+1].x-rest[i].x,rest[i+1].y-rest[i].y));
        angle.push(Math.atan2(rest[i+1].y-rest[i].y,rest[i+1].x-rest[i].x));
      }
      return {id,rest,length,angle,points:rest.map(p=>({...p})),q:new Float64Array(length.length),v:new Float64Array(length.length),parent:null,side:0};
    });
    // EZ-Tree emits parents before children. Infer attachments from original 3D
    // centerlines, never from an already deformed pose or screen-space proximity.
    for(let i=1;i<this.branches.length;i++) {
      const parent=nearestSegment(this.branches,this.branches[i].rest[0],i);
      if (!parent || parent.distance2 > 1e-6) throw Error(`Cannot resolve branch ${i} attachment`);
      this.branches[i].parent=parent;
    }
    this.forward();
  }

  reset() {
    for(const b of this.branches) { b.q.fill(0); b.v.fill(0); b.side=0; }
    this.time=0;this.contacts=[];this.window=null;this.forward();
  }

  forward() {
    for(const b of this.branches) this.forwardBranch(b);
  }

  forwardBranch(b) {
    if(!b.parent){for(let i=0;i<b.rest.length;i++)Object.assign(b.points[i],b.rest[i]);return;}
    // Bound accumulated curvature, not just individual joint angles. A chain
    // cannot curl around repeatedly as more contact samples are solved.
    let total=0;
    for(let i=0;i<b.q.length;i++) {const next=clamp(total+b.q[i],-this.options.maxBend,this.options.maxBend);b.q[i]=next-total;total=next;}
    let inherited=0;
    if(b.parent) {
      const a=b.parent, parent=this.branches[a.branch], p=parent.points[a.segment], n=parent.points[a.segment+1];
      inherited=Math.atan2(n.y-p.y,n.x-p.x)-parent.angle[a.segment];
      const r=parent.rest[a.segment], rn=parent.rest[a.segment+1];
      const ox=b.rest[0].x-(r.x+(rn.x-r.x)*a.t), oy=b.rest[0].y-(r.y+(rn.y-r.y)*a.t);
      b.points[0].x=p.x+(n.x-p.x)*a.t+ox*Math.cos(inherited)-oy*Math.sin(inherited);
      b.points[0].y=p.y+(n.y-p.y)*a.t+ox*Math.sin(inherited)+oy*Math.cos(inherited);
    } else { b.points[0].x=b.rest[0].x;b.points[0].y=b.rest[0].y; }
    let rotation=inherited;
    for(let i=0;i<b.length.length;i++) {
      rotation+=b.q[i];
      const angle=b.angle[i]+rotation;
      b.points[i+1].x=b.points[i].x+Math.cos(angle)*b.length[i];
      b.points[i+1].y=b.points[i].y+Math.sin(angle)*b.length[i];
    }
  }

  step(dt, window = null) {
    if (!(dt>0 && dt<=1/30)) throw Error('Use fixed substeps <= 1/30 second');
    this.time+=dt; this.contacts=[];
    const o=this.options, previous=this.window;
    const travel=window&&previous?Math.max(Math.abs(window.x-previous.x),Math.abs(window.y-previous.y)):0;
    const sweeps=Math.min(64,Math.max(1,Math.ceil(travel/0.12)));
    for(const b of this.branches) {
      if(!b.parent) continue; // Entire primary trunk remains anchored.
      const radius=b.rest[0].radius;
      const stiffness=o.stiffness*(1+Math.min(4,radius*3));
      for(let i=0;i<b.q.length;i++) {
        b.v[i]=(b.v[i]-stiffness*b.q[i]*dt)*Math.exp(-o.damping*dt);
        b.q[i]=clamp(b.q[i]+b.v[i]*dt,-o.maxBend,o.maxBend);
      }
    }
    this.forward();
    if(window) for(let k=1;k<=sweeps;k++) {
      const t=k/sweeps;
      const w=previous?{...window,x:previous.x+(window.x-previous.x)*t,y:previous.y+(window.y-previous.y)*t}:window;
      this.collide(w);
    }
    else for(const b of this.branches)b.side=0;
    this.window=window?{...window}:null;
  }

  collide(w) {
    const o=this.options;
    for(const b of this.branches) {
      if(!b.parent)continue;
      this.forwardBranch(b);
      const root=b.points[0];
      // Side is selected from the rest tip, so front/back branches are stable.
      if(!b.side)b.side=Math.sign(b.rest.at(-1).x-b.rest[0].x)||1;
      // A foreground window releases this branch once it covers the attachment.
      // Its hidden rest pose may overlap the rectangle; this is intentional occlusion.
      const released = root.x>w.x && root.x<w.x+w.width;
      if(released)continue;
      for(let iteration=0;iteration<o.contactIterations;iteration++) {
        let changed=false;
        for(let s=b.length.length-1;s>=0;s--) {
          // Sample the entire segment to catch edges passing between its nodes.
          const samples=Math.max(2,Math.ceil(b.length[s]/0.12));
          for(let k=1;k<=samples;k++) {
            const t=k/samples, a=b.points[s], c=b.points[s+1];
            const x=a.x+(c.x-a.x)*t, y=a.y+(c.y-a.y)*t;
            const radius=Math.min(0.14,b.rest[s].radius)+o.contactMargin;
            if(x<w.x-radius||x>w.x+w.width+radius||y<w.y-radius||y>=w.y+w.height+radius)continue;
            // Lift toward the top; choose an upward rotational direction even
            // when contact is near a vertical segment (singular Jacobian).
            const target=w.y+w.height+radius, error=Math.min(0.22,target-y);
            let denom=0; const gradients=[];
            for(let j=0;j<=s;j++) {const g=x-b.points[j].x;gradients.push(g);denom+=g*g;}
            if(denom<1e-8)continue;
            for(let j=0;j<=s;j++) {
              b.q[j]=clamp(b.q[j]+clamp(error*gradients[j]/(denom+0.04),-0.065,0.065),-o.maxBend,o.maxBend);
              b.v[j]*=0.5;
            }
            this.forwardBranch(b); changed=true;
            if(iteration===o.contactIterations-1)this.contacts.push({branch:b.id,x,y,target});
          }
        }
        if(!changed)break;
      }
    }
    // Refresh descendants after their parent's final pose.
    this.forward();
  }

  metrics() {
    let lengthError=0,maxAngle=0,maxDisplacement=0;
    for(const b of this.branches){let accumulated=0;for(let i=0;i<b.length.length;i++) {
      const a=b.points[i],c=b.points[i+1];
      lengthError=Math.max(lengthError,Math.abs(Math.hypot(c.x-a.x,c.y-a.y)-b.length[i]));
      accumulated+=b.q[i];maxAngle=Math.max(maxAngle,Math.abs(accumulated));
      maxDisplacement=Math.max(maxDisplacement,Math.hypot(c.x-b.rest[i+1].x,c.y-b.rest[i+1].y));
    }}
    return {lengthError,maxAngle,maxDisplacement,contacts:this.contacts.length,branches:this.branches.length};
  }

  snapshot() {
    return {schema:'ez-tree-window-lab/v1',coordinates:'world units; X right, Y up; Z preserved',time:this.time,options:{...this.options},window:this.window,metrics:this.metrics(),branches:this.branches.map(b=>({id:b.id,parent:b.parent,rest:b.rest,points:b.points,angles:Array.from(b.q),angularVelocity:Array.from(b.v)}))};
  }
}
