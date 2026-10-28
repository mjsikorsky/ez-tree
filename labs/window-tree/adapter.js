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
    const bind=bindings[k],e=solver.branches[bind.branch].transforms[bind.segment].elements,i=k*3;
    const x=original[i],y=original[i+1],z=original[i+2],nx=normals[i],ny=normals[i+1],nz=normals[i+2];
    out[i]=e[0]*x+e[4]*y+e[8]*z+e[12];out[i+1]=e[1]*x+e[5]*y+e[9]*z+e[13];out[i+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
    normal[i]=e[0]*nx+e[4]*ny+e[8]*nz;normal[i+1]=e[1]*nx+e[5]*ny+e[9]*nz;normal[i+2]=e[2]*nx+e[6]*ny+e[10]*nz;
  }
  geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
  geometry.computeBoundingSphere();
}
