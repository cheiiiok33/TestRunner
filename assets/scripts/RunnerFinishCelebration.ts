import {
    _decorator,
    Color,
    Component,
    instantiate,
    Node,
    Prefab,
    randomRange,
    Sprite,
    tween,
    UIOpacity,
    UITransform,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('RunnerFinishCelebration')
export class RunnerFinishCelebration extends Component {
    @property(Prefab)
    piecePrefab: Prefab | null = null;

    @property(Node)
    spawnContainer: Node | null = null;

    @property
    duration = 1.8;

    @property
    spawnInterval = 0.035;

    @property
    piecesPerSide = 3;

    @property
    winScreenDelay = 1.45;

    @property
    edgePadding = 40;

    @property
    startY = -300;

    @property
    minFlyTime = 0.75;

    @property
    maxFlyTime = 1.25;

    @property
    minScale = 0.35;

    @property
    maxScale = 0.85;

    private playing = false;
    private readonly colors = [
        new Color(255, 255, 255, 255),
        new Color(255, 245, 90, 255),
        new Color(255, 125, 170, 255),
        new Color(180, 255, 115, 255),
        new Color(190, 240, 255, 255),
        new Color(255, 190, 235, 255),
    ];

    play() {
        if (this.playing || !this.piecePrefab) {
            return;
        }

        this.playing = true;
        this.schedule(this.emit, this.spawnInterval);
        this.scheduleOnce(this.stop, this.duration);
        this.emit();
    }

    private stop = () => {
        this.playing = false;
        this.unschedule(this.emit);
    };

    private emit = () => {
        if (!this.playing) {
            return;
        }

        for (let index = 0; index < this.piecesPerSide; index += 1) {
            this.spawnPiece(-1);
            this.spawnPiece(1);
        }
    };

    private spawnPiece(side: -1 | 1) {
        if (!this.piecePrefab) {
            return;
        }

        const container = this.resolveContainer();
        const piece = instantiate(this.piecePrefab);
        container.addChild(piece);
        piece.setSiblingIndex(container.children.length - 1);

        const halfWidth = this.getHalfContainerWidth(container);
        const startX = side < 0 ? -halfWidth - this.edgePadding : halfWidth + this.edgePadding;
        const targetX = side < 0 ? randomRange(-halfWidth * 0.95, -halfWidth * 0.25) : randomRange(halfWidth * 0.25, halfWidth * 0.95);
        const startY = this.startY + randomRange(-60, 70);
        const targetY = this.startY + randomRange(320, 690);
        const flyTime = randomRange(this.minFlyTime, this.maxFlyTime);
        const scale = randomRange(this.minScale, this.maxScale);

        piece.setPosition(startX + randomRange(-30, 30), startY, 0);
        piece.setScale(scale, scale, 1);
        piece.angle = randomRange(0, 360);

        const sprite = piece.getComponent(Sprite);
        if (sprite) {
            sprite.color = this.pickColor();
        }

        let opacity = piece.getComponent(UIOpacity);
        if (!opacity) {
            opacity = piece.addComponent(UIOpacity);
        }
        opacity.opacity = 255;

        tween(piece)
            .to(
                flyTime,
                {
                    position: new Vec3(targetX, targetY, 0),
                    angle: piece.angle + randomRange(-420, 420),
                },
                { easing: 'sineOut' },
            )
            .start();

        tween(opacity)
            .delay(flyTime * 0.55)
            .to(flyTime * 0.45, { opacity: 0 })
            .call(() => piece.destroy())
            .start();
    }

    private resolveContainer() {
        return this.spawnContainer ?? this.node.parent ?? this.node.scene ?? this.node;
    }

    private getHalfContainerWidth(container: Node) {
        const transform = container.getComponent(UITransform);
        if (transform && transform.width > 0) {
            return transform.width * 0.5;
        }

        return 640;
    }

    private pickColor() {
        return this.colors[Math.floor(Math.random() * this.colors.length)];
    }
}
