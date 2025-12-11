import * as THREE from 'three';

export class World {
    constructor(scene, physics) {
        this.scene = scene;
        this.physics = physics;
        this.treePositions = [];
    }

    generate() {
        this.createFloor();
        this.createTrees();
        this.createRocks();
    }

    createFloor() {
        const floorGeometry = new THREE.PlaneGeometry(1000, 1000);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    createTrees() {
        const mapSize = 200;
        const minTreeDistance = 3.0;
        const targetTreeCount = 320;
        const maxAttempts = targetTreeCount * 10;

        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3a2a });
        const foliageGeometry = new THREE.ConeGeometry(1.5, 3, 8);
        const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x1a3a1a });

        const spawnPositions = [
            { x: 5, z: 5 }, { x: -5, z: 5 }, { x: 5, z: -5 }, { x: -5, z: -5 },
            { x: 0, z: 10 }, { x: 10, z: 0 }, { x: -10, z: 0 }, { x: 0, z: -10 }
        ];

        spawnPositions.forEach(position => {
            const tree = this.createTree(trunkGeometry, trunkMaterial, foliageGeometry, foliageMaterial, position.x, position.z);
            this.scene.add(tree);
            this.physics.addCollider(tree.children[0]);
            this.treePositions.push({ x: position.x, z: position.z });
        });

        for (let attempt = 0; attempt < maxAttempts && this.treePositions.length < targetTreeCount; attempt++) {
            const x = (Math.random() - 0.5) * mapSize;
            const z = (Math.random() - 0.5) * mapSize;
            
            const isTooClose = this.treePositions.some(treePosition => {
                const distance = Math.sqrt((x - treePosition.x) ** 2 + (z - treePosition.z) ** 2);
                return distance < minTreeDistance;
            });
            
            if (!isTooClose) {
                const tree = this.createTree(trunkGeometry, trunkMaterial, foliageGeometry, foliageMaterial, x, z);
                this.scene.add(tree);
                this.physics.addCollider(tree.children[0]);
                this.treePositions.push({ x, z });
            }
        }
    }

    createRocks() {
        const mapSize = 200;
        const rockGeometry = new THREE.SphereGeometry(1, 8, 8);
        const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });

        const rockConfigs = [
            { count: 75, scaleRange: { x: [0.6, 1.4], y: [0.4, 1.0], z: [0.6, 1.4] } },
            { count: 100, scaleRange: { x: [1.0, 1.5], y: [0.7, 1.1], z: [1.0, 1.5] } },
            { count: 25, scaleRange: { x: [1.5, 2.5], y: [1.0, 1.8], z: [1.5, 2.5] } }
        ];

        rockConfigs.forEach(config => {
            for (let index = 0; index < config.count; index++) {
                const x = (Math.random() - 0.5) * mapSize;
                const z = (Math.random() - 0.5) * mapSize;
                const scaleX = config.scaleRange.x[0] + Math.random() * (config.scaleRange.x[1] - config.scaleRange.x[0]);
                const scaleY = config.scaleRange.y[0] + Math.random() * (config.scaleRange.y[1] - config.scaleRange.y[0]);
                const scaleZ = config.scaleRange.z[0] + Math.random() * (config.scaleRange.z[1] - config.scaleRange.z[0]);

                const rock = new THREE.Mesh(rockGeometry, rockMaterial);
                rock.scale.set(scaleX, scaleY, scaleZ);
                rock.position.set(x, scaleY, z);
                rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                rock.castShadow = true;
                rock.receiveShadow = true;
                this.scene.add(rock);
                this.physics.addCollider(rock);
            }
        });
    }

    createTree(trunkGeometry, trunkMaterial, foliageGeometry, foliageMaterial, x, z) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);
        
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = 3.5;
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        tree.add(foliage);
        
        tree.position.set(x, 0, z);
        return tree;
    }
}