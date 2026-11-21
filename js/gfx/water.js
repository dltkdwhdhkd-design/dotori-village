import * as THREE from 'three';

// World-space patterns stay anchored as the camera follows the player.
export const waterPatterns = `
  float currents(vec2 p,float t){
    return sin(p.y*1.68+p.x*.31+t*.63+.70*sin(p.x*.82-t*.28))
      + .48*sin(p.y*3.12-p.x*.63+t*.88+.55*sin(p.x*1.29+t*.17));
  }
  float caustics(vec2 p,float t){
    p+=.20*vec2(sin(p.y*2.0+t*.57),cos(p.x*1.6-t*.47));
    float v=sin(p.x*3.2+p.y*.5+t*.28)+.76*cos(p.y*3.9-p.x*.67-t*.41)+.38*sin((p.x+p.y)*4.1+t*.23);
    return 1.0-smoothstep(.045,.22,abs(v));
  }
  float glints(vec2 p,float t){
    float ridge=1.0-smoothstep(.026,.122,abs(currents(p,t)-1.02));
    float gate=sin(p.x*1.09+p.y*.78-t*.26)*.55+cos(p.x*2.21-p.y*.60+t*.15)*.45;
    return ridge*smoothstep(-.08,.49,gate);
  }`;

export function exhibitSurface(room,x,z,w,d,y,color) {
  const uniforms={uTime:room.waterClock ||= {value:0},uTint:{value:new THREE.Color(color)}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
    vertexShader:`varying vec2 vP;void main(){ vec4 p=modelMatrix*vec4(position,1.0);vP=p.xz;gl_Position=projectionMatrix*viewMatrix*p; }`,
    fragmentShader:`varying vec2 vP;uniform float uTime;uniform vec3 uTint;
      ${waterPatterns}
      void main(){ float light=glints(vP,uTime*.65);float lace=caustics(vP*.87,uTime);
        gl_FragColor=vec4(mix(uTint,vec3(.83,1.,.96),light*.65+lace*.18),.14+light*.27+lace*.05);
        #include <colorspace_fragment>
      }`});
  const surface=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);
  surface.rotation.x=-Math.PI/2;surface.position.set(x,y,z);surface.renderOrder=4;
  room.group.add(surface);
}

// Store distance from the nearest shore in the unused alpha channel of the water mask.
export function shoreDepth(pixels,w,h,pixelsPerTile) {
  const dist=new Float32Array(w*h),diag=Math.SQRT2;
  for(let i=0;i<dist.length;i++)dist[i]=pixels[i*4]<114?0:1e4;
  for(let z=0;z<h;z++)for(let x=0;x<w;x++){
    const i=z*w+x;
    if(x)dist[i]=Math.min(dist[i],dist[i-1]+1);
    if(z)dist[i]=Math.min(dist[i],dist[i-w]+1,x?dist[i-w-1]+diag:1e4,x+1<w?dist[i-w+1]+diag:1e4);
  }
  for(let z=h-1;z>=0;z--)for(let x=w-1;x>=0;x--){
    const i=z*w+x;
    if(x+1<w)dist[i]=Math.min(dist[i],dist[i+1]+1);
    if(z+1<h)dist[i]=Math.min(dist[i],dist[i+w]+1,x?dist[i+w-1]+diag:1e4,x+1<w?dist[i+w+1]+diag:1e4);
    pixels[i*4+3]=Math.max(1,Math.round(255*Math.min(1,dist[i]/(pixelsPerTile*8))));
  }
}
