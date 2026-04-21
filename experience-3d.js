import * as THREE from 'three';

function initExperience3D() {
  const container = document.querySelector('.ae-canvas');
  if (!container) return;
  if (window.matchMedia('(max-width: 768px)').matches) return;

  const W = container.offsetWidth;
  const H = container.offsetHeight;

  // Renderer — transparent background so section's #F7F2EA shows through
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);

  const cvs = renderer.domElement;
  cvs.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  container.insertBefore(cvs, container.firstChild);

  // Scene + camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 300);
  camera.position.set(0, 0, 16);
  camera.lookAt(0, 0, 0);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.1));

  const key = new THREE.DirectionalLight(0xffd090, 2);
  key.position.set(4, 8, 10);
  scene.add(key);

  const pl1 = new THREE.PointLight(0xc9956b, 10, 50);
  pl1.position.set(-6, 4, -10);
  scene.add(pl1);

  const pl2 = new THREE.PointLight(0xff9944, 6, 30);
  pl2.position.set(7, -4, 6);
  scene.add(pl2);

  const pl3 = new THREE.PointLight(0xffd580, 5, 20);
  pl3.position.set(0, 2, 14);
  scene.add(pl3);

  // S-curve: starts top-left far, inflects at center, exits bottom-right close
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8,  5,  -20),
    new THREE.Vector3(-5,  3,  -14),
    new THREE.Vector3(-1,  1,   -7),
    new THREE.Vector3( 2,  0,   -2),
    new THREE.Vector3( 0, -2,    3),
    new THREE.Vector3(-1, -3.5,  8),
    new THREE.Vector3( 3, -5,   14),
    new THREE.Vector3( 7, -6,   18),
  ]);

  const SEGS = 500, R = 24;

  // Layer 1: shadow base (thick, rough)
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, 0.14, R, false),
    new THREE.MeshStandardMaterial({ color: 0x2a1000, metalness: 0.3, roughness: 1 })
  ));

  // Layer 2: main gold metallic tube
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, 0.09, R, false),
    new THREE.MeshStandardMaterial({
      color: 0xc07840,
      metalness: 0.95,
      roughness: 0.10,
      emissive: 0x4a1c00,
      emissiveIntensity: 0.45,
    })
  ));

  // Layer 3: bright highlight strip
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, 0.022, 8, false),
    new THREE.MeshBasicMaterial({ color: 0xfff8e0, transparent: true, opacity: 0.9 })
  ));

  // Layer 4: outer glow shell (backside)
  scene.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, SEGS, 0.38, 16, false),
    new THREE.MeshBasicMaterial({ color: 0xc9956b, transparent: true, opacity: 0.025, side: THREE.BackSide })
  ));

  // Step markers: 5 glowing spheres, one per card
  [0.08, 0.25, 0.45, 0.65, 0.90].forEach(t => {
    const pt = curve.getPointAt(t);

    // Glowing sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffd060,
        metalness: 0.95,
        roughness: 0.08,
        emissive: 0xb05010,
        emissiveIntensity: 0.9,
      })
    );
    sphere.position.copy(pt);
    scene.add(sphere);

    // Halo ring (faces camera at init)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.014, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xc9956b, transparent: true, opacity: 0.45 })
    );
    ring.position.copy(pt);
    ring.lookAt(camera.position);
    scene.add(ring);

    // Dashed tick line extending upward from sphere
    const tickGeo = new THREE.BufferGeometry().setFromPoints([
      pt.clone(),
      pt.clone().add(new THREE.Vector3(0, 2, 0)),
    ]);
    const tickLine = new THREE.Line(
      tickGeo,
      new THREE.LineDashedMaterial({ color: 0xc9956b, dashSize: 0.2, gapSize: 0.15, opacity: 0.5, transparent: true })
    );
    tickLine.computeLineDistances();
    scene.add(tickLine);
  });

  // Particles scattered around the curve
  const N = 700;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt(Math.random());
    const a = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * 3;
    pos[i * 3]     = p.x + Math.cos(a) * r;
    pos[i * 3 + 1] = p.y + Math.sin(a) * r;
    pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 3;
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(
    partGeo,
    new THREE.PointsMaterial({ color: 0xc9956b, size: 0.055, transparent: true, opacity: 0.25 })
  ));

  // Ambient animation loop
  let raf, tick = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    tick += 0.0025;
    camera.position.x = Math.sin(tick * 0.5) * 0.4;
    camera.position.y = Math.cos(tick * 0.35) * 0.3;
    camera.lookAt(0, 0, 0);
    pl1.intensity = 9   + Math.sin(tick * 2)   * 2.5;
    pl2.intensity = 5   + Math.cos(tick * 1.7)  * 2;
    pl3.intensity = 4.5 + Math.sin(tick * 3)   * 1.5;
    renderer.render(scene, camera);
  }
  animate();

  // Resize with container
  const ro = new ResizeObserver(() => {
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(container);
}

document.addEventListener('DOMContentLoaded', initExperience3D);
