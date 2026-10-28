import {nearestSegment} from './solver.mjs';

// Skin the original meshes to centerline segments. Both leaves and bark share
// the same rigid segment transforms. No EZ-Tree source changes are required.
export function bindGeometry(geometry, solver, groupSize=1) {
  const original=geometry.attributes.position.array.slice();
  const normals=geometry.attributes.normal.array.slice();
  const bindings=[];
  for(let i=0;i<original.length;i+=3*groupSize){
    const p={x:0,y:0,z:0};for(let k=0;k<groupSize;k++){p.x+=original[i+k*3]/groupSize;p.y+=original[i+k*3+1]/groupSize;p.z+=original[i+k*3+2]/groupSize;}
    const bind=nearestSegment(solver.branches,p);for(let k=0;k<groupSize;k++)bindings.push(bind);
  }
  return { geometry,original,normals,bindings };
}

export function bindBarkGeometry(geometry, solver, skeleton) {
  const bindings=[];
  skeleton.branches.forEach((branch,id)=>{
    const count=Math.max(3,Math.round(branch.segmentCount))+1;
    for(let ring=0;ring<branch.sections.length;ring++){
      const segment=Math.min(ring,branch.sections.length-2),t=ring===branch.sections.length-1?1:0;
      for(let i=0;i<count;i++)bindings.push({branch:id,segment,t});
    }
  });
  if(bindings.length!==geometry.attributes.position.count)throw Error('Bark ring layout changed; update lab adapter');
  return {geometry,original:geometry.attributes.position.array.slice(),normals:geometry.attributes.normal.array.slice(),bindings};
}

export function deformGeometry(binding, solver) {
  const {geometry,original,normals,bindings}=binding, out=geometry.attributes.position.array, normal=geometry.attributes.normal.array;
  for(let k=0;k<bindings.length;k++) {
    const bind=bindings[k], b=solver.branches[bind.branch],s=bind.segment;
    const a=b.rest[s],r=b.rest[s+1], p=b.points[s], n=b.points[s+1];
    const angle=Math.atan2(n.y-p.y,n.x-p.x)-b.angle[s],cos=Math.cos(angle),sin=Math.sin(angle);
    const cx=a.x+(r.x-a.x)*bind.t,cy=a.y+(r.y-a.y)*bind.t;
    const x=p.x+(n.x-p.x)*bind.t,y=p.y+(n.y-p.y)*bind.t,i=k*3;
    const dx=original[i]-cx,dy=original[i+1]-cy;
    out[i]=x+cos*dx-sin*dy;out[i+1]=y+sin*dx+cos*dy;out[i+2]=original[i+2];
    normal[i]=cos*normals[i]-sin*normals[i+1];normal[i+1]=sin*normals[i]+cos*normals[i+1];normal[i+2]=normals[i+2];
  }
  geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
  geometry.computeBoundingSphere();
}
