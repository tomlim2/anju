import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 50;

class Boid {
    constructor(position, velocity) {
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.acceleration = new THREE.Vector3();
    }

    update() {
        // Update velocity based on acceleration
        this.velocity.add(this.acceleration);
        this.velocity.clampLength(0, 2); // Limit speed
        this.position.add(this.velocity);
        this.acceleration.set(0, 0, 0); // Reset acceleration
    }

    applyForce(force) {
        this.acceleration.add(force);
    }
}

function separation(boid, boids) {
    const desiredSeparation = 5;
    const steer = new THREE.Vector3();

    boids.forEach(other => {
        const distance = boid.position.distanceTo(other.position);
        if (distance > 0 && distance < desiredSeparation) {
            const diff = boid.position.clone().sub(other.position).normalize();
            diff.divideScalar(distance);
            steer.add(diff);
        }
    });

    return steer;
}

function alignment(boid, boids) {
    const neighborDist = 20;
    const steer = new THREE.Vector3();
    let total = 0;

    boids.forEach(other => {
        if (boid.position.distanceTo(other.position) < neighborDist) {
            steer.add(other.velocity);
            total++;
        }
    });

    if (total > 0) {
        steer.divideScalar(total);
        steer.normalize().multiplyScalar(2);
        steer.sub(boid.velocity).clampLength(0, 0.1);
    }

    return steer;
}

function cohesion(boid, boids) {
    const neighborDist = 20;
    const steer = new THREE.Vector3();
    let total = 0;

    boids.forEach(other => {
        if (boid.position.distanceTo(other.position) < neighborDist) {
            steer.add(other.position);
            total++;
        }
    });

    if (total > 0) {
        steer.divideScalar(total);
        steer.sub(boid.position);
        steer.normalize().multiplyScalar(0.1);
    }

    return steer;
}

const boids = [];
const boidMeshes = [];

for (let i = 0; i < 100; i++) {
    const position = new THREE.Vector3(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100
    );

    const velocity = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() - 0.5),
        (Math.random() - 0.5)
    );

    const boid = new Boid(position, velocity);
    boids.push(boid);

    const geometry = new THREE.ConeGeometry(1, 3, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(boid.position);
    scene.add(mesh);
    boidMeshes.push(mesh);
}

function animate() {
    requestAnimationFrame(animate);

    boids.forEach((boid, i) => {
        const sep = separation(boid, boids);
        const ali = alignment(boid, boids);
        const coh = cohesion(boid, boids);

        boid.applyForce(sep);
        boid.applyForce(ali);
        boid.applyForce(coh);

        boid.update();
        boidMeshes[i].position.copy(boid.position);
        boidMeshes[i].lookAt(boid.position.clone().add(boid.velocity)); // Orient the boid
    });

    renderer.render(scene, camera);
}

animate();
