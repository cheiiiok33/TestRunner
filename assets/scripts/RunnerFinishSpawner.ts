import { _decorator, BoxCollider2D, Camera, Collider2D, Component, instantiate, Node, Prefab, Rect, Size, UITransform, Vec2, Vec3, view } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerPlayerController } from './RunnerPlayerController';
import { RunnerScrollLoop } from './RunnerScrollLoop';

const { ccclass, property } = _decorator;

@ccclass('RunnerFinishSpawner')
export class RunnerFinishSpawner extends Component {
    @property(Prefab)
    finishPrefab: Prefab | null = null;

    @property(Node)
    spawnContainer: Node | null = null;

    @property(Node)
    renderBeforeNode: Node | null = null;

    @property(Node)
    scrollTarget: Node | null = null;

    @property
    keepPlayerOnTop = true;

    @property
    spawnDelay = 25;

    @property
    spawnX = 0;

    @property
    spawnY = 0;

    @property
    scrollSpeed = 1040;

    @property
    leftBound = -1800;

    @property
    fitSpawnToVisibleBounds = true;

    @property
    spawnRightPadding = 420;

    @property
    spawnDistanceFromPlayer = 1600;

    @property
    alignSpawnYToPlayer = true;

    @property
    finishYOffsetFromPlayer = 0;

    @property
    leftBoundPadding = 420;

    @property
    finishTag = 5;

    @property
    useProximityFinishTrigger = true;

    @property
    finishTriggerLeadDistance = 40;

    @property
    finishDestroySafetyPadding = 120;

    @property
    finishTriggerNodeName = 'ribbon';

    private elapsedAfterStart = 0;
    private hasSpawned = false;
    private activeFinish: Node | null = null;
    private finishTriggerCommitted = false;
    private cachedGroundNode: Node | null = null;
    private cachedPlayerNode: Node | null = null;
    private cachedScrollTarget: Node | null = null;
    private cachedFloorOffsetFromGround: number | null = null;
    private cachedCamera: Camera | null = null;

    onLoad() {
        this.syncSpawnBoundsToVisibleArea();
        this.syncScrollSpeed();
        this.captureFloorOffsetFromGround();
    }

    update(deltaTime: number) {
        if (!RunnerGameManager.isStarted || RunnerGameManager.isFinished) {
            return;
        }

        this.syncSpawnBoundsToVisibleArea();
        this.syncScrollSpeed();
        this.elapsedAfterStart += deltaTime;

        if (!this.hasSpawned && this.elapsedAfterStart >= this.spawnDelay) {
            this.spawnFinish();
        }

        this.moveFinish(deltaTime);
        this.tryTriggerFinishByProximity();
    }

    private spawnFinish() {
        this.hasSpawned = true;
        this.finishTriggerCommitted = false;

        if (!this.finishPrefab) {
            console.warn('[RunnerFinishSpawner] Assign Finish.prefab in the Finish Prefab field.');
            return;
        }

        const finish = instantiate(this.finishPrefab);
        const container = this.resolveSpawnContainer();
        container.addChild(finish);
        this.placeBehindTarget(finish, container);
        this.raisePlayerAboveFinish(container);
        finish.setPosition(this.spawnX, this.resolveSpawnY(finish, container), 0);
        this.shiftNodeLeftEdgeTo(finish, container, this.spawnX);
        this.configureFinishColliders(finish);
        this.normalizeFinishTriggerCollider(finish);
        this.activeFinish = finish;
        RunnerGameManager.markFinishSpawned();
    }

    private moveFinish(deltaTime: number) {
        if (!this.activeFinish?.isValid) {
            return;
        }

        if (this.finishTriggerCommitted || RunnerGameManager.isFinishing || RunnerGameManager.isFinished) {
            return;
        }

        const position = this.activeFinish.position;
        const nextX = position.x - this.scrollSpeed * RunnerGameManager.getSpeedMultiplier() * deltaTime;
        this.activeFinish.setPosition(nextX, position.y, position.z);

        if (this.tryCommitFinishTrigger(this.activeFinish)) {
            return;
        }

        const container = this.resolveSpawnContainer();
        const finishVisualBounds = this.resolveFinishVisualBounds(container, this.activeFinish);
        const hasLeftVisibleArea = finishVisualBounds ? finishVisualBounds.xMax <= this.leftBound : nextX <= this.leftBound;

        if (hasLeftVisibleArea) {
            const finishTriggerXWorld = this.resolveFinishTriggerXWorld(this.activeFinish);
            const playerTriggerXWorld = this.resolvePlayerTriggerXWorld();
            const hasPassedPlayer =
                finishTriggerXWorld !== null &&
                playerTriggerXWorld !== null &&
                finishTriggerXWorld <= playerTriggerXWorld + this.finishDestroySafetyPadding;

            if (hasPassedPlayer && this.tryCommitFinishTrigger(this.activeFinish)) {
                return;
            }

            this.activeFinish.destroy();
            this.activeFinish = null;
        }
    }

    private tryTriggerFinishByProximity() {
        if (
            !this.useProximityFinishTrigger ||
            !this.activeFinish?.isValid ||
            this.finishTriggerCommitted ||
            RunnerGameManager.isFinishing
        ) {
            return;
        }

        if (this.tryCommitFinishTrigger(this.activeFinish)) {
            return;
        }

        const container = this.resolveSpawnContainer();
        const playerX = this.resolvePlayerX(container);
        const finishTriggerX = this.resolveFinishTriggerX(this.activeFinish, container);

        if (finishTriggerX === null) {
            return;
        }

        if (finishTriggerX <= playerX + this.finishTriggerLeadDistance) {
            this.commitFinishTrigger(this.activeFinish);
        }
    }

    private tryCommitFinishTrigger(finishNode: Node) {
        const playerTriggerXWorld = this.resolvePlayerTriggerXWorld();
        const finishTriggerXWorld = this.resolveFinishTriggerXWorld(finishNode);
        if (playerTriggerXWorld === null || finishTriggerXWorld === null) {
            return false;
        }

        if (finishTriggerXWorld > playerTriggerXWorld + this.finishTriggerLeadDistance) {
            return false;
        }

        this.commitFinishTrigger(finishNode);
        return true;
    }

    private commitFinishTrigger(finishNode: Node) {
        if (this.finishTriggerCommitted || RunnerGameManager.isFinishing || RunnerGameManager.isFinished) {
            return;
        }

        this.finishTriggerCommitted = true;
        RunnerGameManager.finishGame(this.resolveFinishDelay(), finishNode);
    }

    private configureFinishColliders(node: Node) {
        node.getComponents(Collider2D).forEach((collider) => {
            collider.tag = this.finishTag;
            collider.sensor = true;
        });

        node.children.forEach((child) => this.configureFinishColliders(child));
    }

    private normalizeFinishTriggerCollider(node: Node) {
        const triggerNode = this.findFinishTriggerNode(node);
        if (!triggerNode) {
            return;
        }

        const transform = triggerNode.getComponent(UITransform);
        const collider = triggerNode.getComponent(BoxCollider2D);
        if (!transform || !collider) {
            return;
        }

        collider.tag = this.finishTag;
        collider.sensor = true;
        collider.offset = new Vec2(0, 0);
        collider.size = new Size(transform.width, transform.height);
    }

    private placeBehindTarget(finish: Node, container: Node) {
        const target = this.resolveRenderableNode(container);
        if (!target || target.parent !== container) {
            return;
        }

        const targetIndex = target.getSiblingIndex();
        finish.setSiblingIndex(Math.max(0, targetIndex));
    }

    private raisePlayerAboveFinish(container: Node) {
        if (!this.keepPlayerOnTop) {
            return;
        }

        const player = this.resolveRenderableNode(container);
        if (player?.parent === container) {
            player.setSiblingIndex(container.children.length - 1);
        }
    }

    private resolveRenderBeforeNode(container: Node) {
        if (this.renderBeforeNode?.isValid) {
            return this.renderBeforeNode;
        }

        return this.findPlayerNode(container);
    }

    private resolveRenderableNode(container: Node) {
        const target = this.resolveRenderBeforeNode(container);
        if (!target) {
            return null;
        }

        return this.resolveTopLevelChildInContainer(target, container);
    }

    private resolveTopLevelChildInContainer(target: Node, container: Node) {
        let current: Node | null = target;

        while (current?.parent && current.parent !== container) {
            current = current.parent;
        }

        return current?.parent === container ? current : null;
    }

    private findPlayerNode(node: Node): Node | null {
        if (node.getComponent(RunnerPlayerController)) {
            return node;
        }

        for (const child of node.children) {
            const found = this.findPlayerNode(child);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private resolveSpawnContainer() {
        if (this.spawnContainer && this.node.parent && this.spawnContainer !== this.node.scene) {
            const sameBranch =
                this.spawnContainer === this.node.parent || this.isDescendantOf(this.spawnContainer, this.node.parent);

            if (sameBranch) {
                return this.spawnContainer;
            }
        }

        return this.node.parent ?? this.node.scene ?? this.node;
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

    private syncSpawnBoundsToVisibleArea() {
        if (!this.fitSpawnToVisibleBounds) {
            return;
        }

        const container = this.resolveSpawnContainer();
        const rightEdgeX = this.resolveVisibleEdgeX(container, true);
        const leftEdgeX = this.resolveVisibleEdgeX(container, false);
        const playerX = this.resolvePlayerX(container);

        this.spawnX = Math.max(
            rightEdgeX + this.spawnRightPadding,
            playerX + this.spawnDistanceFromPlayer,
        );
        this.leftBound = leftEdgeX - this.leftBoundPadding;
    }

    private resolveSpawnY(finish: Node, container: Node) {
        if (!this.alignSpawnYToPlayer) {
            return this.spawnY;
        }

        const floorY = this.resolveGameplayFloorY(container);
        if (floorY === null) {
            return this.spawnY;
        }

        return floorY + this.resolveFootOffset(finish) + this.finishYOffsetFromPlayer;
    }

    private resolveGameplayFloorY(container: Node) {
        const ground = this.resolveGroundNode();
        if (!ground) {
            const player = this.resolvePlayerNode();
            return player ? this.resolveNodeYInContainer(player, container) : null;
        }

        const currentGroundY = this.resolveNodeYInContainer(ground, container);
        if (currentGroundY === null) {
            return null;
        }

        const player = this.resolvePlayerNode();
        const playerY = player ? this.resolveNodeYInContainer(player, container) : null;
        if (playerY === null) {
            return null;
        }

        const playerController = player?.getComponent(RunnerPlayerController);
        if (this.cachedFloorOffsetFromGround === null || playerController?.isSpawnGrounded()) {
            this.cachedFloorOffsetFromGround = playerY - currentGroundY;
        }

        return currentGroundY + this.cachedFloorOffsetFromGround;
    }

    private captureFloorOffsetFromGround() {
        const container = this.resolveSpawnContainer();
        const ground = this.resolveGroundNode();
        const player = this.resolvePlayerNode();

        if (!ground || !player) {
            return;
        }

        const groundY = this.resolveNodeYInContainer(ground, container);
        const playerY = this.resolveNodeYInContainer(player, container);
        this.cachedFloorOffsetFromGround = playerY - groundY;
    }

    private resolveGroundNode() {
        if (this.cachedGroundNode?.isValid) {
            return this.cachedGroundNode;
        }

        const world = this.node.parent ?? this.node.scene ?? this.node;
        this.cachedGroundNode = world.getChildByName('Ground');
        return this.cachedGroundNode;
    }

    private resolvePlayerNode() {
        if (this.renderBeforeNode?.isValid) {
            return this.renderBeforeNode;
        }

        if (this.cachedPlayerNode?.isValid) {
            return this.cachedPlayerNode;
        }

        const container = this.resolveSpawnContainer();
        this.cachedPlayerNode = this.findPlayerNode(container);
        return this.cachedPlayerNode;
    }

    private resolvePlayerX(container: Node) {
        const player = this.resolvePlayerNode();
        if (!player) {
            return 0;
        }

        const controller = player.getComponent(RunnerPlayerController);
        return this.resolveNodeXInContainer(player, container) ?? controller?.fixedX ?? player.position.x;
    }

    private resolveFinishDelay() {
        const player = this.resolvePlayerNode();
        return player?.getComponent(RunnerPlayerController)?.finishStopDelay ?? 0;
    }

    private syncScrollSpeed() {
        const target = this.resolveScrollTarget();
        if (!target) {
            return;
        }

        this.scrollSpeed = target.getComponent(RunnerScrollLoop)?.scrollSpeed ?? this.scrollSpeed;
    }

    private resolveScrollTarget() {
        if (this.scrollTarget?.isValid) {
            return this.scrollTarget;
        }

        if (this.cachedScrollTarget?.isValid) {
            return this.cachedScrollTarget;
        }

        const container = this.node.parent ?? this.node.scene ?? this.node;
        this.cachedScrollTarget = container.children.find((child) => child.getComponent(RunnerScrollLoop)) ?? null;
        return this.cachedScrollTarget;
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

    private resolveFinishTriggerX(node: Node, container: Node) {
        const triggerBounds = this.resolveNamedNodeBoundsInContainer(node, container, this.finishTriggerNodeName);
        if (triggerBounds) {
            return triggerBounds.xMin;
        }

        const colliders = node.getComponentsInChildren(Collider2D);
        let minX: number | null = null;

        for (const collider of colliders) {
            if (collider.tag !== this.finishTag) {
                continue;
            }

            const bounds = this.convertWorldRectToContainerRect(collider.worldAABB, container);
            minX = minX === null ? bounds.xMin : Math.min(minX, bounds.xMin);
        }

        if (minX !== null) {
            return minX;
        }

        const transforms = node.getComponentsInChildren(UITransform);
        for (const transform of transforms) {
            const bounds = this.convertWorldRectToContainerRect(transform.getBoundingBoxToWorld(), container);
            minX = minX === null ? bounds.xMin : Math.min(minX, bounds.xMin);
        }

        return minX;
    }

    private resolvePlayerTriggerXWorld() {
        return this.resolvePlayerTriggerBoundsWorld()?.xMax ?? null;
    }

    private resolveFinishTriggerXWorld(node: Node) {
        return this.resolveFinishTriggerBoundsWorld(node)?.xMin ?? null;
    }

    private resolvePlayerTriggerBoundsWorld() {
        const player = this.resolvePlayerNode();
        if (!player) {
            return null;
        }

        const colliderBounds = this.getCombinedWorldBounds(player.getComponents(Collider2D).map((collider) => collider.worldAABB));
        if (colliderBounds) {
            return colliderBounds;
        }

        const transform = player.getComponent(UITransform);
        return transform ? transform.getBoundingBoxToWorld() : null;
    }

    private resolveFinishTriggerBoundsWorld(node: Node) {
        const explicitTriggerBounds = this.resolveNamedNodeBoundsWorld(node, this.finishTriggerNodeName);
        if (explicitTriggerBounds) {
            return explicitTriggerBounds;
        }

        const colliderBounds = this.getCombinedWorldBounds(
            node
                .getComponentsInChildren(Collider2D)
                .filter((collider) => collider.tag === this.finishTag)
                .map((collider) => collider.worldAABB),
        );

        if (colliderBounds) {
            return colliderBounds;
        }

        return this.getCombinedWorldBounds(
            node.getComponentsInChildren(UITransform).map((transform) => transform.getBoundingBoxToWorld()),
        );
    }

    private resolveFinishVisualBounds(container: Node, node: Node) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const transform of node.getComponentsInChildren(UITransform)) {
            const bounds = this.convertWorldRectToContainerRect(transform.getBoundingBoxToWorld(), container);
            if (!Number.isFinite(bounds.xMin) || !Number.isFinite(bounds.xMax) || !Number.isFinite(bounds.yMin) || !Number.isFinite(bounds.yMax)) {
                continue;
            }

            minX = Math.min(minX, bounds.xMin);
            minY = Math.min(minY, bounds.yMin);
            maxX = Math.max(maxX, bounds.xMax);
            maxY = Math.max(maxY, bounds.yMax);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return null;
        }

        return new Rect(minX, minY, maxX - minX, maxY - minY);
    }

    private resolveNamedNodeBoundsInContainer(root: Node, container: Node, nodeName: string) {
        const target = this.findNodeByName(root, nodeName);
        if (!target) {
            return null;
        }

        const transform = target.getComponent(UITransform);
        if (!transform) {
            return null;
        }

        return this.convertWorldRectToContainerRect(transform.getBoundingBoxToWorld(), container);
    }

    private resolveNamedNodeBoundsWorld(root: Node, nodeName: string) {
        const target = this.findNodeByName(root, nodeName);
        const transform = target?.getComponent(UITransform);
        return transform ? transform.getBoundingBoxToWorld() : null;
    }

    private findFinishTriggerNode(root: Node) {
        return this.findNodeByName(root, this.finishTriggerNodeName);
    }

    private findNodeByName(root: Node, nodeName: string): Node | null {
        if (root.name === nodeName) {
            return root;
        }

        for (const child of root.children) {
            const found = this.findNodeByName(child, nodeName);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private getCombinedWorldBounds(boundsList: Rect[]) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const bounds of boundsList) {
            if (!Number.isFinite(bounds.xMin) || !Number.isFinite(bounds.xMax) || !Number.isFinite(bounds.yMin) || !Number.isFinite(bounds.yMax)) {
                continue;
            }

            minX = Math.min(minX, bounds.xMin);
            minY = Math.min(minY, bounds.yMin);
            maxX = Math.max(maxX, bounds.xMax);
            maxY = Math.max(maxY, bounds.yMax);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return null;
        }

        return new Rect(minX, minY, maxX - minX, maxY - minY);
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
}
