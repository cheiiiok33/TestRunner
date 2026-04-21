import { _decorator, Component, instantiate, Node, Prefab, randomRange } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerObstacleScroller } from './RunnerObstacleScroller';

const { ccclass, property } = _decorator;

@ccclass('RunnerEnemySpawner')
export class RunnerEnemySpawner extends Component {
    @property([Prefab])
    enemyPrefabs: Prefab[] = [];

    @property(Node)
    spawnContainer: Node | null = null;

    @property(Node)
    scrollTarget: Node | null = null;

    @property
    spawnX = 900;

    @property
    spawnY = -10;

    @property
    leftBound = -900;

    @property
    minSpawnDistance = 900;

    @property
    maxSpawnDistance = 1800;

    @property
    spawnChance = 0.75;

    @property
    scrollSpeed = 320;

    @property
    enemyExtraMoveSpeed = 80;

    @property
    maxSpawnCount = 4;

    @property
    enemyTag = 2;

    @property
    spawnImmediately = false;

    private distanceToNextSpawn = 0;
    private spawnedCount = 0;

    onLoad() {
        this.resetSpawnDistance(this.spawnImmediately ? 0 : undefined);
    }

    update(deltaTime: number) {
        if (!RunnerGameManager.isStarted || this.enemyPrefabs.length === 0 || this.spawnedCount >= this.maxSpawnCount) {
            return;
        }

        this.distanceToNextSpawn -= this.scrollSpeed * deltaTime;
        if (this.distanceToNextSpawn > 0) {
            return;
        }

        if (Math.random() <= this.spawnChance) {
            this.spawnEnemy();
            this.spawnedCount += 1;
        }

        this.resetSpawnDistance();
    }

    private spawnEnemy() {
        const prefab = this.enemyPrefabs[Math.floor(Math.random() * this.enemyPrefabs.length)];
        const enemy = instantiate(prefab);
        const container = this.spawnContainer ?? this.node.parent ?? this.node;

        container.addChild(enemy);
        enemy.setPosition(this.spawnX, this.spawnY, 0);

        let scroller = enemy.getComponent(RunnerObstacleScroller);
        if (!scroller) {
            scroller = enemy.addComponent(RunnerObstacleScroller);
        }

        scroller.scrollSpeed = this.scrollSpeed;
        scroller.extraMoveSpeed = this.enemyExtraMoveSpeed;
        scroller.leftBound = this.leftBound;
        scroller.destroyAtLeftBound = true;
        scroller.randomOffsetXMin = 0;
        scroller.randomOffsetXMax = 0;
        scroller.keepStartY = true;
        scroller.followTarget = this.scrollTarget;
        scroller.configureCollider = true;
        scroller.colliderTag = this.enemyTag;
        scroller.colliderSensor = true;
    }

    private resetSpawnDistance(distance = randomRange(this.minSpawnDistance, this.maxSpawnDistance)) {
        this.distanceToNextSpawn = distance;
    }
}
