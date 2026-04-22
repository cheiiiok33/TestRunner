import { _decorator, Component, instantiate, Node, Prefab, randomRange } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerObstacleScroller } from './RunnerObstacleScroller';

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

    onLoad() {
        this.firstSpawnTimer = this.spawnImmediately ? 0 : this.firstSpawnDelay;
        this.resetSpawnDistance(this.spawnImmediately ? 0 : undefined);
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
        obstacle.setPosition(this.spawnX, spawnConfig.spawnY, 0);

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
