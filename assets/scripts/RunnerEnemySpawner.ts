import { _decorator, BoxCollider2D, Camera, Component, instantiate, Node, Prefab, randomRange, Rect, UITransform, Vec3, view } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerObstacleScroller } from './RunnerObstacleScroller';
import { RunnerPlayerController } from './RunnerPlayerController';

const { ccclass, property } = _decorator;

@ccclass('RunnerEnemySpawner')
export class RunnerEnemySpawner extends Component {
    @property([Prefab])
    enemyPrefabs: Prefab[] = [];

    @property([Prefab])
    letPrefabs: Prefab[] = [];

    @property(Node)
    spawnContainer: Node | null = null;

    @property(Node)
    scrollTarget: Node | null = null;

    @property
    spawnX = 900;

    @property
    spawnY = -10;

    @property
    letSpawnY = -80;

    @property
    leftBound = -900;

    @property
    fitSpawnToVisibleBounds = true;

    @property
    spawnRightPadding = 360;

    @property
    spawnDistanceFromPlayer = 1200;

    @property
    alignSpawnYToPlayer = true;

    @property
    enemyYOffsetFromPlayer = 0;

    @property
    letYOffsetFromPlayer = 0;

    @property
    leftBoundPadding = 260;

    @property(Node)
    firstEnemyHintTarget: Node | null = null;

    @property
    firstEnemyHintLeadDistance = 360;

    @property
    firstEnemyHintRightPadding = 48;

    @property
    minSpawnDistance = 900;

    @property
    maxSpawnDistance = 1800;

    @property
    spawnChance = 0.75;

    @property
    enemySpawnWeight = 1;

    @property
    letSpawnWeight = 1;

    @property
    scrollSpeed = 320;

    @property
    enemyExtraMoveSpeed = 80;

    @property
    letExtraMoveSpeed = 0;

    @property
    maxSpawnCount = 4;

    @property
    enemyTag = 2;

    @property
    letTag = 3;

    @property
    spawnImmediately = false;

    @property
    firstSpawnDelay = 2;

    private distanceToNextSpawn = 0;
    private firstSpawnTimer = 0;
    private spawnedCount = 0;
    private cachedFirstEnemyHintTarget: Node | null = null;
    private cachedGroundNode: Node | null = null;
    private cachedFloorOffsetFromGround: number | null = null;
    private cachedCamera: Camera | null = null;

    onLoad() {
        this.firstSpawnTimer = this.spawnImmediately ? 0 : this.firstSpawnDelay;
        this.resetSpawnDistance(this.spawnImmediately ? 0 : undefined);
        this.syncSpawnBoundsToVisibleArea();
        this.captureFloorOffsetFromGround();
    }

    update(deltaTime: number) {
        if (
            !RunnerGameManager.isStarted ||
            RunnerGameManager.isFinishSpawned ||
            !this.hasSpawnPrefabs() ||
            this.spawnedCount >= this.maxSpawnCount
        ) {
            return;
        }

        this.syncSpawnBoundsToVisibleArea();

        if (this.spawnedCount === 0) {
            this.firstSpawnTimer -= deltaTime;
            if (this.firstSpawnTimer > 0) {
                return;
            }

            this.spawnObstacle(true);
            this.spawnedCount += 1;
            this.resetSpawnDistance();
            return;
        }

        this.distanceToNextSpawn -= this.scrollSpeed * deltaTime;
        if (this.distanceToNextSpawn > 0) {
            return;
        }

        if (Math.random() <= this.spawnChance) {
            this.spawnObstacle();
            this.spawnedCount += 1;
        }

        this.resetSpawnDistance();
    }

    private spawnObstacle(forceEnemy = false) {
        const spawnConfig = this.pickSpawnConfig(forceEnemy);
        if (!spawnConfig) {
            return;
        }

        const obstacle = instantiate(spawnConfig.prefab);
        const container = this.resolveSpawnContainer();

        container.addChild(obstacle);
        obstacle.setPosition(
            this.spawnX,
            this.resolveSpawnY(obstacle, container, spawnConfig.isEnemy, spawnConfig.spawnY),
            0,
        );
        this.shiftNodeLeftEdgeTo(obstacle, container, this.spawnX);

        let scroller = obstacle.getComponent(RunnerObstacleScroller);
        if (!scroller) {
            scroller = obstacle.addComponent(RunnerObstacleScroller);
        }

        scroller.scrollSpeed = this.scrollSpeed;
        scroller.extraMoveSpeed = spawnConfig.extraMoveSpeed;
        scroller.leftBound = this.leftBound;
        scroller.destroyAtLeftBound = true;
        scroller.randomOffsetXMin = 0;
        scroller.randomOffsetXMax = 0;
        scroller.keepStartY = true;
        scroller.followTarget = this.scrollTarget;
        scroller.configureCollider = true;
        scroller.colliderTag = spawnConfig.tag;
        scroller.colliderSensor = true;
        scroller.triggerFirstEnemyHint = spawnConfig.triggerFirstEnemyHint;
        scroller.firstEnemyHintTarget = this.resolveFirstEnemyHintTarget();
        scroller.firstEnemyHintLeadDistance = this.firstEnemyHintLeadDistance;
        scroller.firstEnemyHintX = this.resolveFirstEnemyHintX();
    }

    private syncSpawnBoundsToVisibleArea() {
        if (!this.fitSpawnToVisibleBounds) {
            return;
        }

        const container = this.resolveSpawnContainer();
        const rightEdgeX = this.resolveVisibleEdgeX(container, true);
        const leftEdgeX = this.resolveVisibleEdgeX(container, false);
        const playerX = this.resolveTargetX(this.resolveFirstEnemyHintTarget(), container);

        this.spawnX = Math.max(
            rightEdgeX + this.spawnRightPadding,
            playerX + this.spawnDistanceFromPlayer,
        );
        this.leftBound = leftEdgeX - this.leftBoundPadding;
    }

    private resolveFirstEnemyHintX() {
        const target = this.resolveFirstEnemyHintTarget();
        const targetX = this.resolveTargetX(target, this.resolveSpawnContainer());
        void this.firstEnemyHintRightPadding;
        return targetX + this.firstEnemyHintLeadDistance;
    }

    private resolveTargetX(target: Node | null, container: Node) {
        if (!target) {
            return -390;
        }

        const playerController = target.getComponent(RunnerPlayerController);
        return this.resolveNodeXInContainer(target, container) ?? playerController?.fixedX ?? target.position.x;
    }

    private resolveFirstEnemyHintTarget() {
        if (this.firstEnemyHintTarget?.isValid) {
            return this.firstEnemyHintTarget;
        }

        if (this.cachedFirstEnemyHintTarget?.isValid) {
            return this.cachedFirstEnemyHintTarget;
        }

        this.cachedFirstEnemyHintTarget = this.findPlayerNode(this.node.scene ?? this.node);
        return this.cachedFirstEnemyHintTarget;
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

    private resetSpawnDistance(distance = randomRange(this.minSpawnDistance, this.maxSpawnDistance)) {
        this.distanceToNextSpawn = distance;
    }

    private hasSpawnPrefabs() {
        return this.enemyPrefabs.length > 0 || this.letPrefabs.length > 0;
    }

    private pickSpawnConfig(forceEnemy: boolean) {
        const shouldSpawnEnemy = this.shouldSpawnEnemy(forceEnemy);
        const prefabs = shouldSpawnEnemy ? this.enemyPrefabs : this.letPrefabs;

        if (prefabs.length === 0) {
            return null;
        }

        return {
            prefab: prefabs[Math.floor(Math.random() * prefabs.length)],
            isEnemy: shouldSpawnEnemy,
            spawnY: shouldSpawnEnemy ? this.spawnY : this.letSpawnY,
            extraMoveSpeed: shouldSpawnEnemy ? this.enemyExtraMoveSpeed : this.letExtraMoveSpeed,
            tag: shouldSpawnEnemy ? this.enemyTag : this.letTag,
            triggerFirstEnemyHint: shouldSpawnEnemy || this.enemyPrefabs.length === 0,
        };
    }

    private shouldSpawnEnemy(forceEnemy: boolean) {
        if (forceEnemy && this.enemyPrefabs.length > 0) {
            return true;
        }

        if (this.enemyPrefabs.length === 0) {
            return false;
        }

        if (this.letPrefabs.length === 0) {
            return true;
        }

        const enemyWeight = Math.max(0, this.enemySpawnWeight);
        const letWeight = Math.max(0, this.letSpawnWeight);
        const totalWeight = enemyWeight + letWeight;

        if (totalWeight <= 0) {
            return true;
        }

        return Math.random() * totalWeight < enemyWeight;
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

    private resolveSpawnY(node: Node, container: Node, isEnemy: boolean, fallbackY: number) {
        if (!this.alignSpawnYToPlayer) {
            return fallbackY;
        }

        const floorY = this.resolveGameplayFloorY(container);
        if (floorY === null) {
            return fallbackY;
        }

        const yOffset = isEnemy ? this.enemyYOffsetFromPlayer : this.letYOffsetFromPlayer;
        return floorY + this.resolveFootOffset(node) + yOffset;
    }

    private resolveGameplayFloorY(container: Node) {
        const ground = this.resolveGroundNode();
        if (!ground) {
            const target = this.resolveFirstEnemyHintTarget();
            return target ? this.resolveNodeYInContainer(target, container) : null;
        }

        const currentGroundY = this.resolveNodeYInContainer(ground, container);
        if (currentGroundY === null) {
            return null;
        }

        if (this.cachedFloorOffsetFromGround === null) {
            const target = this.resolveFirstEnemyHintTarget();
            const targetY = target ? this.resolveNodeYInContainer(target, container) : null;
            if (targetY === null) {
                return null;
            }

            this.cachedFloorOffsetFromGround = targetY - currentGroundY;
        }

        return currentGroundY + this.cachedFloorOffsetFromGround;
    }

    private captureFloorOffsetFromGround() {
        const container = this.resolveSpawnContainer();
        const ground = this.resolveGroundNode();
        const target = this.resolveFirstEnemyHintTarget();

        if (!ground || !target) {
            return;
        }

        const groundY = this.resolveNodeYInContainer(ground, container);
        const targetY = this.resolveNodeYInContainer(target, container);
        this.cachedFloorOffsetFromGround = targetY - groundY;
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

    private resolveNodeXInContainer(target: Node, container: Node) {
        const worldPosition = target.worldPosition;
        const containerTransform = container.getComponent(UITransform);
        if (containerTransform) {
            return containerTransform.convertToNodeSpaceAR(worldPosition).x;
        }

        const localPosition = new Vec3();
        container.inverseTransformPoint(localPosition, worldPosition);
        return localPosition.x;
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

    private resolveFootOffset(node: Node) {
        const transform = node.getComponent(UITransform);
        if (transform) {
            return transform.height * transform.anchorPoint.y * Math.abs(node.scale.y);
        }

        const collider = node.getComponent(BoxCollider2D);
        if (!collider) {
            return 0;
        }

        const bottom = collider.offset.y - collider.size.height * 0.5;
        return -bottom * Math.abs(node.scale.y);
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
}
