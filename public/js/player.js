import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(scene, camera, physics, ui) {
        this.scene = scene;
        this.camera = camera;
        this.physics = physics;
        this.ui = ui;
        this.controls = new PointerLockControls(camera, document.body);
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.movementFlags = { forward: false, backward: false, left: false, right: false };
        this.canJump = false;
        this.health = 100;
        this.maxHealth = 100;
        this.ammo = 100;
        this.maxAmmo = 100;
        this.pendingShot = false;
        this.radius = 0.5;
        this.camera.position.y = 1.6;
        this.onShoot = null;
        this.game = null;
        this.setupInput();
    }

    setupInput() {
        const movementKeys = {
            'ArrowUp': 'forward', 'KeyW': 'forward',
            'ArrowDown': 'backward', 'KeyS': 'backward',
            'ArrowLeft': 'left', 'KeyA': 'left',
            'ArrowRight': 'right', 'KeyD': 'right'
        };

        window.addEventListener('keydown', (event) => {
            const movementKey = movementKeys[event.code];
            if (movementKey) {
                if (this.controls.isLocked) event.preventDefault();
                this.movementFlags[movementKey] = true;
            } else if (event.code === 'Space' && this.controls.isLocked) {
                event.preventDefault();
                if (this.canJump) {
                    this.velocity.y += 30;
                    this.canJump = false;
                }
            }
        });

        window.addEventListener('keyup', (event) => {
            const movementKey = movementKeys[event.code];
            if (movementKey) this.movementFlags[movementKey] = false;
        });
        
        document.addEventListener('mousedown', (event) => {
            const isClickingUI = event.target.tagName === 'BUTTON' || 
                                 event.target.closest('#start-screen') || 
                                 event.target.closest('#game-over');
            if (!this.controls.isLocked) {
                if (!isClickingUI && this.game?.isPlaying) {
                    event.preventDefault();
                    this.pendingShot = true;
                    this.lockControls();
                }
                return;
            }
            if (this.ammo > 0 && this.onShoot && !isClickingUI) {
                event.preventDefault();
                this.shoot();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === document.body) {
                if (this.pendingShot && this.ammo > 0 && this.onShoot) {
                    this.pendingShot = false;
                    this.shoot();
                }
            } else {
                this.pendingShot = false;
            }
        });
    }

    lockControls() {
        this.controls.lock();
    }
    
    unlockControls() {
        this.controls.unlock();
        Object.keys(this.movementFlags).forEach(movementKey => this.movementFlags[movementKey] = false);
        this.pendingShot = false;
    }

    reset() {
        this.health = this.maxHealth;
        this.ammo = this.maxAmmo;
        this.ui.updateHealth(this.health);
        this.ui.updateAmmo(this.ammo);
        this.controls.getObject().position.set(0, 1.6, 0);
        this.velocity.set(0, 0, 0);
        Object.keys(this.movementFlags).forEach(movementKey => this.movementFlags[movementKey] = false);
    }
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.ui.updateHealth(this.health);
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        this.ui.updateHealth(this.health);
    }
    
    addAmmo(amount) {
        this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
        this.ui.updateAmmo(this.ammo);
    }

    update(deltaTime) {
        const movementSpeed = 120.0;
        const gravity = 80.0;
        const friction = 10.0;
        
        this.velocity.x -= this.velocity.x * friction * deltaTime;
        this.velocity.z -= this.velocity.z * friction * deltaTime;
        this.velocity.y -= gravity * deltaTime;

        this.direction.z = Number(this.movementFlags.forward) - Number(this.movementFlags.backward);
        this.direction.x = Number(this.movementFlags.right) - Number(this.movementFlags.left);
        this.direction.normalize();

        if (this.movementFlags.forward || this.movementFlags.backward) {
            this.velocity.z -= this.direction.z * movementSpeed * deltaTime;
        }
        if (this.movementFlags.left || this.movementFlags.right) {
            this.velocity.x -= this.direction.x * movementSpeed * deltaTime;
        }

        const previousPosition = this.controls.getObject().position.clone();
        this.controls.moveRight(-this.velocity.x * deltaTime);
        this.controls.moveForward(-this.velocity.z * deltaTime);
        
        if (this.physics.checkPlayerCollision(this.controls.getObject().position, this.radius)) {
            this.controls.getObject().position.x = previousPosition.x;
            this.controls.getObject().position.z = previousPosition.z;
            this.velocity.x = 0;
            this.velocity.z = 0;
        }

        this.controls.getObject().position.y += this.velocity.y * deltaTime;
        if (this.controls.getObject().position.y < 1.6) {
            this.velocity.y = 0;
            this.controls.getObject().position.y = 1.6;
            this.canJump = true;
        }
    }

    shoot() {
        if (this.ammo <= 0) return;
        this.ammo--;
        this.ui.updateAmmo(this.ammo);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        this.onShoot?.(raycaster);
    }
}