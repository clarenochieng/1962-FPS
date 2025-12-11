import * as THREE from 'three';

class BaseEnemy {
    constructor(scene, position, physics, config) {
        this.scene = scene;
        this.physics = physics;
        this.health = config.health;
        this.maxHealth = config.maxHealth || config.health;
        this.speed = config.speed;
        this.damage = config.damage;
        this.attackCooldown = 0;
        this.radius = config.radius;
        this.isDead = false;

        const geometry = new THREE.BoxGeometry(config.size.x, config.size.y, config.size.z);
        const material = new THREE.MeshStandardMaterial({ color: config.color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        if (config.yOffset) this.mesh.position.y = config.yOffset;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }

    tryMove(deltaTime, targetPosition) {
        const directionToTarget = new THREE.Vector3().subVectors(targetPosition, this.mesh.position).normalize();
        const testDirections = [
            directionToTarget,
            directionToTarget.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4),
            directionToTarget.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 4),
            directionToTarget.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
            directionToTarget.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2),
            new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
        ];

        for (const testDirection of testDirections) {
            const moveStep = testDirection.clone().multiplyScalar(this.speed * deltaTime);
            const newPosition = this.mesh.position.clone().add(moveStep);
            if (!this.physics.checkSphereCollision(newPosition, this.radius)) {
                this.mesh.position.add(moveStep);
                return true;
            }
        }
        return false;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        } else {
            this.mesh.material.emissive.setHex(0xffffff);
            setTimeout(() => {
                if (!this.isDead && this.mesh) this.mesh.material.emissive.setHex(0x000000);
            }, 100); // Damage flash duration
        }
    }

    die() {
        this.isDead = true;
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    }
}

class Zombie extends BaseEnemy {
    constructor(scene, position, physics, speedMultiplier = 1.0) {
        super(scene, position, physics, {
            health: 3,
            speed: 3.5 * speedMultiplier,
            damage: 10,
            radius: 0.5,
            size: { x: 1, y: 1, z: 1 },
            color: 0xff0000
        });
    }

    update(deltaTime, playerPosition, player) {
        if (this.isDead) return;
        this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z);
        const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);
        if (distanceToPlayer > 1.5) {
            this.tryMove(deltaTime, playerPosition);
        } else if (this.attackCooldown <= 0) {
            player.takeDamage(this.damage);
            this.attackCooldown = 1.0;
        }
        if (this.attackCooldown > 0) this.attackCooldown -= deltaTime;
    }
}

class Titan extends BaseEnemy {
    constructor(scene, position, physics, player, speedMultiplier = 1.0) {
        super(scene, position, physics, {
            health: 20,
            maxHealth: 20,
            speed: 1.0 * speedMultiplier,
            damage: 15,
            radius: 1.5,
            size: { x: 2, y: 3, z: 2 },
            color: 0x8b0000,
            yOffset: 1.5
        });
        this.player = player;
        this.shootCooldown = 0;
        this.shootRange = 30;
        this.projectiles = [];
    }

    update(deltaTime, playerPosition, player) {
        if (this.isDead) return;
        this.mesh.lookAt(playerPosition.x, this.mesh.position.y, playerPosition.z);
        const distanceToPlayer = this.mesh.position.distanceTo(playerPosition);

        if (distanceToPlayer <= this.shootRange && distanceToPlayer > 2.0 && this.shootCooldown <= 0) {
            this.shoot(playerPosition);
            this.shootCooldown = 2.0;
        }

        if (distanceToPlayer > 2.0) {
            this.tryMove(deltaTime, playerPosition);
        } else if (this.attackCooldown <= 0) {
            player.takeDamage(this.damage);
            this.attackCooldown = 1.5;
        }

        if (this.attackCooldown > 0) this.attackCooldown -= deltaTime;
        if (this.shootCooldown > 0) this.shootCooldown -= deltaTime;

        for (let index = this.projectiles.length - 1; index >= 0; index--) {
            const projectile = this.projectiles[index];
            projectile.position.add(projectile.velocity.clone().multiplyScalar(deltaTime));
            projectile.lifetime -= deltaTime;

            const projectileDistanceToPlayer = projectile.position.distanceTo(playerPosition);
            if (projectileDistanceToPlayer < 0.5) {
                player.takeDamage(this.damage);
                this.removeProjectile(index);
                continue;
            }

            if (projectile.lifetime <= 0 || projectile.position.y < 0) {
                this.removeProjectile(index);
            }
        }
    }

    shoot(targetPosition) {
        const direction = new THREE.Vector3().subVectors(targetPosition, this.mesh.position).normalize();
        const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const projectileMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0x440000 });
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        projectile.position.copy(this.mesh.position);
        projectile.position.y += 2;
        projectile.velocity = direction.clone().multiplyScalar(15);
        projectile.lifetime = 3.0;
        this.scene.add(projectile);
        this.projectiles.push(projectile);
    }

    removeProjectile(index) {
        const projectile = this.projectiles[index];
        if (projectile.parent) projectile.parent.remove(projectile);
        if (projectile.geometry) projectile.geometry.dispose();
        if (projectile.material) projectile.material.dispose();
        this.projectiles.splice(index, 1);
    }

    die() {
        super.die();
        for (let index = this.projectiles.length - 1; index >= 0; index--) {
            this.removeProjectile(index);
        }
    }
}

export class EnemyManager {
    constructor(scene, physics, player, ui, itemManager, difficulty = 'medium') {
        this.scene = scene;
        this.physics = physics;
        this.player = player;
        this.ui = ui;
        this.itemManager = itemManager;
        this.difficulty = difficulty;
        this.enemies = [];
        this.wave = 1;
        this.spawnTimer = 0;
        this.zombiesToSpawn = 0;
        this.titansToSpawn = 0;
        this.zombiesSpawned = 0;
        this.titansSpawned = 0;
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    getSpeedMultiplier() {
        return this.difficulty === 'easy' ? 0.3 : this.difficulty === 'hard' ? 2.0 : 1.0;
    }
    
    getWaveCounts(wave) {
        if (wave === 1) return { zombies: 20, titans: 0 };
        if (wave === 2) return { zombies: 40, titans: 0 };
        if (wave === 3) return { zombies: 60, titans: 1 };
        const extraWaves = wave - 3;
        return { zombies: 60 + extraWaves * 20, titans: 1 + extraWaves };
    }
    
    reset() {
        this.enemies.forEach(enemy => {
            if (enemy.mesh?.parent) enemy.mesh.parent.remove(enemy.mesh);
        });
        this.enemies = [];
        this.wave = 1;
        this.spawnTimer = 0;
        const counts = this.getWaveCounts(1);
        this.zombiesToSpawn = counts.zombies;
        this.titansToSpawn = counts.titans;
        this.zombiesSpawned = 0;
        this.titansSpawned = 0;
        this.ui?.updateWave(this.wave);
    }

    spawnEnemy(type) {
        const angle = Math.random() * Math.PI * 2;
        const distance = type === 'titan' ? 20 + Math.random() * 15 : 15 + Math.random() * 10;
        const spawnPosition = new THREE.Vector3(
            Math.cos(angle) * distance,
            type === 'titan' ? 0 : 0.5,
            Math.sin(angle) * distance
        );
        const speedMultiplier = this.getSpeedMultiplier();
        const enemy = type === 'titan' 
            ? new Titan(this.scene, spawnPosition, this.physics, this.player, speedMultiplier)
            : new Zombie(this.scene, spawnPosition, this.physics, speedMultiplier);
        this.enemies.push(enemy);
    }

    update(deltaTime) {
        const totalToSpawn = this.zombiesToSpawn + this.titansToSpawn;
        const totalSpawned = this.zombiesSpawned + this.titansSpawned;
        
        if (totalSpawned < totalToSpawn) {
            this.spawnTimer += deltaTime;
            if (this.spawnTimer >= 1.0) {
                if (this.titansSpawned < this.titansToSpawn) {
                    this.spawnEnemy('titan');
                    this.titansSpawned++;
                } else if (this.zombiesSpawned < this.zombiesToSpawn) {
                    this.spawnEnemy('zombie');
                    this.zombiesSpawned++;
                }
                this.spawnTimer = 0;
            }
        }

        const playerPosition = this.player.controls.getObject().position;
        this.enemies.forEach(enemy => {
            if (!enemy.isDead) enemy.update(deltaTime, playerPosition, this.player);
        });

        this.enemies = this.enemies.filter(enemy => !enemy.isDead);

        if (this.enemies.length === 0 && totalSpawned >= totalToSpawn) {
            this.wave++;
            const counts = this.getWaveCounts(this.wave);
            this.zombiesToSpawn = counts.zombies;
            this.titansToSpawn = counts.titans;
            this.zombiesSpawned = 0;
            this.titansSpawned = 0;
            this.spawnTimer = 0;
            this.ui?.updateWave(this.wave);
        }
    }

    getEnemyCounts() {
        let aliveZombies = 0;
        let aliveTitans = 0;
        this.enemies.forEach(enemy => {
            if (!enemy.isDead) {
                enemy.shootRange !== undefined ? aliveTitans++ : aliveZombies++;
            }
        });
        return {
            zombies: (this.zombiesToSpawn - this.zombiesSpawned) + aliveZombies,
            titans: (this.titansToSpawn - this.titansSpawned) + aliveTitans
        };
    }

    checkHit(raycaster) {
        const enemyMeshes = this.enemies.map(enemy => enemy.mesh);
        const intersections = raycaster.intersectObjects(enemyMeshes);
        
        if (intersections.length === 0) {
            return { hit: false, killed: false };
        }
        
        const hitMesh = intersections[0].object;
        const enemy = this.enemies.find(enemy => enemy.mesh === hitMesh);
        if (!enemy || enemy.isDead) {
            return { hit: false, killed: false };
        }
        
        const wasAlive = !enemy.isDead;
        const enemyPosition = enemy.mesh.position.clone();
        const enemyType = enemy.shootRange !== undefined ? 'titan' : 'zombie';
        enemy.takeDamage(1);
        
        if (wasAlive && enemy.isDead && this.itemManager) {
            Math.random() < 0.25 
                ? this.itemManager.spawnHealthPack(enemyPosition)
                : this.itemManager.spawnAmmoPack(enemyPosition);
        }
        
        return {
            hit: true,
            killed: wasAlive && enemy.isDead,
            type: enemyType
        };
    }
}