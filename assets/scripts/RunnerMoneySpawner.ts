import { _decorator, CCFloat, Camera, Component, instantiate, Node, Prefab, randomRange, Rect, UITransform, Vec3, view } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerPlayerController } from './RunnerPlayerController';
import { RunnerScrollLoop } from './RunnerScrollLoop';

const { ccclass, property } = _decorator;

@ccclass('RunnerMoneySpawner')
export class RunnerMoneySpawner extends Component {
    @property([Prefab])
    moneyPrefabs: Prefab[] = [];

    @property(Node)
    spawnContainer: Node | null = null;

    @property(Node)
    scrollTarget: Node | null = null;

    @property
    spawnX = 1000;

    @property([CCFloat])
    spawnYPositions: number[] = [-40, 70, 150];

    @property([CCFloat])
    spawnDistances: number[] = [650, 1050, 1450];

    @property
    scrollSpeed = 320;

    @property
    leftBound = -900;

    @property
    destroyAtLeftBound = true;

    @property
    fitSpawnToVisibleBounds = true;

    @property
    spawnRightPadding = 320;

    @property
    leftBoundPadding = 260;

    @property
    spawnImmediately = false;

    @property
    alignSpawnYToPlayer = true;

    @property
    moneyYOffsetFromPlayer = 0;

    private distanceToNextSpawn = 0;
    private spawnIndex = 0;
    private activePatterns: Node[] = [];
    private cachedCamera: Camera | null = null;
    private cachedPlayerNode: Node | null = null;
    private cachedGroundNode: Node | null = null;
    private cachedFloorOffsetFromGround: number | null = null;

    onLoad() {
        this.distanceToNextSpawn = this.spawnImmediately ? 0 : this.getNextDistance();
        this.syncSpawnBoundsToVisibleArea();
    }

    update(deltaTime: number) {
        if (!RunnerGameManager.isStarted || this.moneyPrefabs.length === 0) {
            return;
        }

        this.syncSpawnBoundsToVisibleArea();
        this.syncScrollSpeed();
        this.moveActivePatterns(deltaTime);

        if (RunnerGameManager.isFinishSpawned) {
            return;
        }

        this.distanceToNextSpawn -= this.scrollSpeed * deltaTime;
        if (this.distanceToNextSpawn > 0) {
            return;
        }

        this.spawnMoneyPattern();
        this.distanceToNextSpawn = this.getNextDistance();
    }

    private spawnMoneyPattern() {
        const prefab = this.moneyPrefabs[this.spawnIndex % this.moneyPrefabs.length];
        const pattern = instantiate(prefab);
        const container = this.resolveSpawnContainer();
        const spawnY = this.getSpawnY(container);

        container.addChild(pattern);
        pattern.setPosition(this.spawnX, spawnY, 0);
        this.shiftNodeLeftEdgeTo(pattern, container, this.spawnX);
        this.activePatterns.push(pattern);
        this.spawnIndex += 1;
    }

    private moveActivePatterns(deltaTime: number) {
        for (let index = this.activePatterns.length - 1; index >= 0; index -= 1) {
            const pattern = this.activePatterns[index];
            if (!pattern?.isValid) {
                this.activePatterns.splice(index, 1);
                continue;
            }

            const position = pattern.position;
            const nextX = position.x - this.scrollSpeed * deltaTime;
            pattern.setPosition(nextX, position.y, position.z);

            if (this.getNodeRightEdgeInParent(pattern) > this.leftBound) {
                continue;
            }

            if (this.destroyAtLeftBound) {
                pattern.destroy();
            }
            this.activePatterns.splice(index, 1);
        }
    }

    private syncScrollSpeed() {
        if (!this.scrollTarget) {
            return;
        }

        this.scrollSpeed = this.scrollTarget.getComponent(RunnerScrollLoop)?.scrollSpeed ?? this.scrollSpeed;
    }

    private syncSpawnBoundsToVisibleArea() {
        if (!this.fitSpawnToVisibleBounds) {
            return;
        }

        const container = this.resolveSpawnContainer();
        const rightEdgeX = this.resolveVisibleEdgeX(container, true);
        const leftEdgeX = this.resolveVisibleEdgeX(container, false);

        this.spawnX = rightEdgeX + this.spawnRightPadding;
        this.leftBound = leftEdgeX - this.leftBoundPadding;
    }

    private getNextDistance() {
        if (this.spawnDistances.length === 0) {
            return 900;
        }

        const distance = this.spawnDistances[this.spawnIndex % this.spawnDistances.length];
        return Math.max(1, distance);
    }

    private getSpawnY(container: Node) {
        if (this.spawnYPositions.length === 0) {
            return this.resolvePlayerAlignedY(container, 0) ?? 0;
        }

        const y = this.spawnYPositions[this.spawnIndex % this.spawnYPositions.length];
        const fallbackY = Number.isFinite(y) ? y : randomRange(-40, 150);
        return this.resolvePlayerAlignedY(container, fallbackY) ?? fallbackY;
    }

    private resolvePlayerAlignedY(container: Node, fallbackY: number) {
        if (!this.alignSpawnYToPlayer) {
            return fallbackY;
        }

        const player = this.resolvePlayerNode();
        if (!player) {
            return fallbackY;
        }

        const playerY = this.resolveNodeYInContainer(player, container);
        if (playerY === null) {
            return fallbackY;
        }

        const ground = this.resolveGroundNode();
        const groundY = ground ? this.resolveNodeYInContainer(ground, container) : null;
        if (groundY === null) {
            return fallbackY;
        }

        const playerController = player.getComponent(RunnerPlayerController);
        if (this.cachedFloorOffsetFromGround === null || playerController?.isSpawnGrounded()) {
            this.cachedFloorOffsetFromGround = playerY - groundY;
        }

        return groundY + this.cachedFloorOffsetFromGround + fallbackY + this.moneyYOffsetFromPlayer;
    }

    private resolveSpawnContainer() {
        if (this.spawnContainer && this.node.parent && this.spawnContainer !== this.node.scene) {
            const sameBranch =
                this.spawnContainer === this.node.parent || this.isDescendantOf(this.spawnContainer, this.node.parent);

            if (sameBranch) {
                return this.spawnContainer;
            }
        }

        return this.node.parent ?? this.node;
    }

    private isDescendantOf(node: Node, parent: Node) {
        let current: Node | null = node;

        while (current) {
            if (current === parent) {
                return true;
            }

            current = current.parent;
        }

        return false;
    }

    private resolveVisibleEdgeX(container: Node, isRightEdge: boolean) {
        const camera = this.resolveCamera();
        if (!camera) {
            const visible = view.getVisibleSize();
            return (isRightEdge ? 1 : -1) * visible.width * 0.5;
        }

        const frame = view.getFrameSize();
        const viewportWidth = Math.max(1, frame.width * camera.rect.width);
        const viewportHeight = Math.max(1, frame.height * camera.rect.height);
        const aspect = viewportWidth / viewportHeight;
        const halfWorldWidth = camera.orthoHeight * aspect;
        const edgeX = camera.node.worldPosition.x + (isRightEdge ? halfWorldWidth : -halfWorldWidth);
        const visibleEdgeWorld = new Vec3(edgeX, camera.node.worldPosition.y, 0);

        const containerTransform = container.getComponent(UITransform);
        if (containerTransform) {
            return containerTransform.convertToNodeSpaceAR(visibleEdgeWorld).x;
        }

        const localPosition = new Vec3();
        container.inverseTransformPoint(localPosition, visibleEdgeWorld);
        return localPosition.x;
    }

    private shiftNodeLeftEdgeTo(node: Node, container: Node, targetLeftX: number) {
        const bounds = this.getNodeBoundsInContainer(node, container);
        if (!bounds) {
            return;
        }

        const deltaX = targetLeftX - bounds.xMin;
        if (Math.abs(deltaX) <= 0.01) {
            return;
        }

        const position = node.position;
        node.setPosition(position.x + deltaX, position.y, position.z);
    }

    private resolveCamera() {
        if (this.cachedCamera?.isValid) {
            return this.cachedCamera;
        }

        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        this.cachedCamera = this.findCamera(scene);
        return this.cachedCamera;
    }

    private findCamera(root: Node): Camera | null {
        const camera = root.getComponent(Camera);
        if (camera) {
            return camera;
        }

        for (const child of root.children) {
            const camera = this.findCamera(child);
            if (camera) {
                return camera;
            }
        }

        return null;
    }

    private resolvePlayerNode() {
        if (this.cachedPlayerNode?.isValid) {
            return this.cachedPlayerNode;
        }

        this.cachedPlayerNode = this.findPlayerNode(this.node.scene ?? this.node);
        return this.cachedPlayerNode;
    }

    private findPlayerNode(root: Node): Node | null {
        if (root.getComponent(RunnerPlayerController)) {
            return root;
        }

        for (const child of root.children) {
            const player = this.findPlayerNode(child);
            if (player) {
                return player;
            }
        }

        return null;
    }

    private resolveGroundNode() {
        if (this.cachedGroundNode?.isValid) {
            return this.cachedGroundNode;
        }

        const world = this.node.parent ?? this.node.scene ?? this.node;
        this.cachedGroundNode = world.getChildByName('Ground');
        return this.cachedGroundNode;
    }

    private resolveNodeYInContainer(target: Node, container: Node) {
        const worldPosition = target.worldPosition;
        const containerTransform = container.getComponent(UITransform);
        if (containerTransform) {
            return containerTransform.convertToNodeSpaceAR(worldPosition).y;
        }

        const localPosition = new Vec3();
        container.inverseTransformPoint(localPosition, worldPosition);
        return localPosition.y;
    }

    private getNodeRightEdgeInParent(node: Node) {
        const parent = node.parent;
        if (!parent) {
            return node.position.x;
        }

        const bounds = this.getNodeBoundsInContainer(node, parent);
        return bounds?.xMax ?? node.position.x;
    }

    private getNodeBoundsInContainer(node: Node, container: Node) {
        const transform = node.getComponent(UITransform);
        if (!transform) {
            return null;
        }

        const worldBounds = transform.getBoundingBoxToWorld();
        return this.convertWorldRectToContainerRect(worldBounds, container);
    }

    private convertWorldRectToContainerRect(worldRect: Rect, container: Node) {
        const containerTransform = container.getComponent(UITransform);
        const minWorld = new Vec3(worldRect.xMin, worldRect.yMin, 0);
        const maxWorld = new Vec3(worldRect.xMax, worldRect.yMax, 0);

        const minLocal = new Vec3();
        const maxLocal = new Vec3();

        if (containerTransform) {
            containerTransform.convertToNodeSpaceAR(minWorld, minLocal);
            containerTransform.convertToNodeSpaceAR(maxWorld, maxLocal);
        } else {
            container.inverseTransformPoint(minLocal, minWorld);
            container.inverseTransformPoint(maxLocal, maxWorld);
        }

        return new Rect(
            Math.min(minLocal.x, maxLocal.x),
            Math.min(minLocal.y, maxLocal.y),
            Math.abs(maxLocal.x - minLocal.x),
            Math.abs(maxLocal.y - minLocal.y),
        );
    }
}
