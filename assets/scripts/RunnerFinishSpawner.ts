import { _decorator, Collider2D, Component, instantiate, Node, Prefab } from 'cc';
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
    finishTag = 5;

    private elapsedAfterStart = 0;
    private hasSpawned = false;
    private activeFinish: Node | null = null;

    update(deltaTime: number) {
        if (!RunnerGameManager.isStarted || RunnerGameManager.isFinished) {
            return;
        }

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
        const container = this.spawnContainer ?? this.node.parent ?? this.node.scene;
        container.addChild(finish);
        this.placeBehindTarget(finish, container);
        this.raisePlayerAboveFinish(container);
        finish.setPosition(this.spawnX, this.spawnY, 0);
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
}
