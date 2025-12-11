import * as THREE from 'three';

export class Physics {
    constructor() {
        this.colliders = [];
    }

    addCollider(mesh) {
        this.colliders.push(mesh);
    }

    removeCollider(mesh) {
        const index = this.colliders.indexOf(mesh);
        if (index > -1) this.colliders.splice(index, 1);
    }

    checkPlayerCollision(position, radius) {
        return this.checkSphereCollision(position, radius);
    }

    checkSphereCollision(position, radius) {
        for (const mesh of this.colliders) {
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            const boundingBox = new THREE.Box3();
            boundingBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
            if (boundingBox.intersectsSphere(new THREE.Sphere(position, radius))) {
                return true;
            }
        }
        return false;
    }

    checkPointCollision(point) {
        return this.checkSphereCollision(point, 0.5);
    }

    update(_deltaTime) {}
}