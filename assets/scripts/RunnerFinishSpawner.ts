import { _decorator, BoxCollider2D, Collider2D, Component, instantiate, Node, Prefab, UITransform, Vec3, view } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerPlayerController } from './RunnerPlayerController';

const { ccclass, property } = _decorator;

@ccclass('RunnerFinishSpawner')
export class RunnerFinishSpawner extends Component {
    @property(Prefab)
    finishPrefab: Prefab | null = null;

    @property(Node)
    spawnContainer: Node | null = null;

    @property(Node)
    renderBeforeNode: Node | null = null;

    @property
    keepPlayerOnTop = true;

    @property
    spawnDelay = 25;

    @property
    spawnX = 0;

    @property
    spawnY = 0;

    @property
    scrollSpeed = 320;

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

    private elapsedAfterStart = 0;
    private hasSpawned = false;
    private activeFinish: Node | null = null;
    private cachedGroundNode: Node | null = null;
    private cachedPlayerNode: Node | null = null;
    private cachedFloorOffsetFromGround: number | null = null;

    onLoad() {
        this.syncSpawnBoundsToVisibleArea();
        this.captureFloorOffsetFromGround();
    }

    update(deltaTime: number) {
        if (!RunnerGameManager.isStarted || RunnerGameManager.isFinished) {
            return;
        }

        this.syncSpawnBoundsToVisibleArea();
        this.elapsedAfterStart += deltaTime;

        if (!this.hasSpawned && this.elapsedAfterStart >= this.spawnDelay) {
            this.spawnFinish();
        }

        this.moveFinish(deltaTime);
    }

    private spawnFinish() {
        this.hasSpawned = true;

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
        this.configureFinishColliders(finish);
        this.activeFinish = finish;
        RunnerGameManager.markFinishSpawned();
    }

    private moveFinish(deltaTime: number) {
        if (!this.activeFinish?.isValid) {
            return;
        }

        const position = this.activeFinish.position;
        const nextX = position.x - this.scrollSpeed * deltaTime;
        this.activeFinish.setPosition(nextX, position.y, position.z);

        if (nextX <= this.leftBound) {
            this.activeFinish.destroy();
            this.activeFinish = null;
        }
    }

    private configureFinishColliders(node: Node) {
        node.getComponents(Collider2D).forEach((collider) => {
            collider.tag = this.finishTag;
            collider.sensor = true;
        });

        node.children.forEach((child) => this.configureFinishColliders(child));
    }

    private placeBehindTarget(finish: Node, container: Node) {
        const target = this.resolveRenderBeforeNode(container);
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

        const player = this.resolveRenderBeforeNode(container);
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

        const visible = view.getVisibleSize();
        const halfWidth = visible.width * 0.5;
        const playerX = this.resolvePlayerX();

        this.spawnX = Math.max(
            halfWidth + this.spawnRightPadding,
            playerX + this.spawnDistanceFromPlayer,
        );
        this.leftBound = -halfWidth - this.leftBoundPadding;
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

        if (this.cachedFloorOffsetFromGround === null) {
            const player = this.resolvePlayerNode();
            const playerY = player ? this.resolveNodeYInContainer(player, container) : null;
            if (playerY === null) {
                return null;
            }

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

    private resolvePlayerX() {
        const player = this.resolvePlayerNode();
        if (!player) {
            return 0;
        }

        const controller = player.getComponent(RunnerPlayerController);
        return controller?.fixedX ?? player.position.x;
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
