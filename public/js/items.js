import * as THREE from 'three';

class Item {
    constructor(scene, position, color, emissiveColor, size, amount) {
        this.scene = scene;
        this.position = position;
        this.amount = amount;
        this.radius = 1.0;
        this.isCollected = false;
        this.timeOffset = Math.random() * 100;

        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ color, emissive: emissiveColor });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.position.y = 0.5;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }

    update(deltaTime, player) {
        if (this.isCollected) return;
        this.mesh.rotation.y += 2 * deltaTime;
        this.mesh.rotation.x += deltaTime;
        this.mesh.position.y = 0.5 + Math.sin(this.timeOffset + performance.now() / 500) * 0.2;
        const distanceToPlayer = this.mesh.position.distanceTo(player.controls.getObject().position);
        if (distanceToPlayer < this.radius + 0.5) {
            this.collect(player);
        }
    }

    collect(_player) {
        this.isCollected = true;
        this.scene.remove(this.mesh);
    }
}

class HealthPack extends Item {
    constructor(scene, position) {
        super(scene, position, 0x00ff00, 0x003300, 0.5, 25);
    }

    collect(player) {
        if (player.health < player.maxHealth) {
            player.heal(this.amount);
            super.collect(player);
        }
    }
}

class AmmoPack extends Item {
    constructor(scene, position) {
        super(scene, position, 0xffaa00, 0x331100, 0.4, 20);
    }

    collect(player) {
        if (player.ammo < player.maxAmmo) {
            player.addAmmo(this.amount);
            super.collect(player);
        }
    }
}

export class ItemManager {
    constructor(scene) {
        this.scene = scene;
        this.items = [];
    }

    reset() {
        this.items.forEach(item => item.collect({}));
        this.items = [];
    }

    spawnHealthPack(position) {
        this.items.push(new HealthPack(this.scene, position));
    }

    spawnAmmoPack(position) {
        this.items.push(new AmmoPack(this.scene, position));
    }

    update(deltaTime, player) {
        this.items.forEach(item => item.update(deltaTime, player));
        this.items = this.items.filter(item => !item.isCollected);
    }
}