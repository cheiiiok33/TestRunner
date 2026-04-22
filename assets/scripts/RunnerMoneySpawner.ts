import { _decorator, CCFloat, Component, instantiate, Node, Prefab, randomRange } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
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
    spawnImmediately = false;

    private distanceToNextSpawn = 0;
    private spawnIndex = 0;
    private activePatterns: Node[] = [];

    onLoad() {
        this.distanceToNextSpawn = this.spawnImmediately ? 0 : this.getNextDistance();
    }

    update(deltaTime: number) {
        if (!RunnerGameManager.isStarted || this.moneyPrefabs.length === 0) {
            return;
        }

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
        const spawnY = this.getSpawnY();

        container.addChild(pattern);
        pattern.setPosition(this.spawnX, spawnY, 0);
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

            if (nextX > this.leftBound) {
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

    private getNextDistance() {
        if (this.spawnDistances.length === 0) {
            return 900;
        }

        const distance = this.spawnDistances[this.spawnIndex % this.spawnDistances.length];
        return Math.max(1, distance);
    }

    private getSpawnY() {
        if (this.spawnYPositions.length === 0) {
            return 0;
        }

        const y = this.spawnYPositions[this.spawnIndex % this.spawnYPositions.length];
        return Number.isFinite(y) ? y : randomRange(-40, 150);
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
}
