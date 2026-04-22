import { _decorator, Camera, Component, game, Node, ResolutionPolicy, screen, UITransform, Vec3, view } from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerPlayerController } from './RunnerPlayerController';

const { ccclass, property } = _decorator;

@ccclass('PlayableResponsiveLayout')
export class PlayableResponsiveLayout extends Component {
    @property(Camera)
    camera: Camera | null = null;

    @property(Node)
    gameWorld: Node | null = null;

    @property(Node)
    hero: Node | null = null;

    @property(Node)
    tapHint: Node | null = null;

    @property(Node)
    hand: Node | null = null;

    @property(Node)
    cta: Node | null = null;

    @property
    designWidth = 1280;

    @property
    designHeight = 720;

    @property
    portraitHeroX = -190;

    @property
    portraitHeroY = -85;

    @property
    landscapeHeroX = -390;

    @property
    landscapeHeroY = -85;

    @property
    portraitHeroScale = 1;

    @property
    landscapeHeroScale = 1;

    @property
    ctaHeight = 120;

    @property
    edgePadding = 24;

    private lastWidth = 0;
    private lastHeight = 0;
    private lastPortrait = false;
    private readonly handBaseScale = new Vec3(1, 1, 1);
    private readonly onBrowserResize = () => {
        this.scheduleOnce(() => this.applyLayout(true), 0);
    };

    onLoad() {
        if (this.hand) {
            this.handBaseScale.set(this.hand.scale);
        }

        view.resizeWithBrowserSize(true);
        this.applyResolution(this.isPortraitFrame());
        screen.on('orientation-change', this.onOrientationChange, this);
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this.onBrowserResize);
        }
        this.applyLayout(true);
    }

    onDestroy() {
        screen.off('orientation-change', this.onOrientationChange, this);
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.onBrowserResize);
        }
    }

    update() {
        this.applyLayout(false);
    }

    private onOrientationChange() {
        this.scheduleOnce(() => this.applyLayout(true), 0.1);
    }

    private getViewportSize() {
        if (typeof window === 'undefined') {
            return view.getFrameSize();
        }

        const visualViewport = window.visualViewport;
        return {
            width: visualViewport?.width ?? window.innerWidth,
            height: visualViewport?.height ?? window.innerHeight,
        };
    }

    private isPortraitFrame() {
        if (typeof window !== 'undefined') {
            const viewportSize = this.getViewportSize();
            return viewportSize.height >= viewportSize.width;
        }

        const frame = view.getFrameSize();
        return frame.height >= frame.width;
    }

    private applyResolution(isPortrait = this.isPortraitFrame()) {
        const longSide = Math.max(this.designWidth, this.designHeight);
        const shortSide = Math.min(this.designWidth, this.designHeight);

        if (isPortrait) {
            view.setDesignResolutionSize(shortSide, longSide, ResolutionPolicy.FIXED_WIDTH);
        } else {
            view.setDesignResolutionSize(longSide, shortSide, ResolutionPolicy.FIXED_HEIGHT);
        }
    }

    private applyViewportStyles() {
        if (typeof document === 'undefined') {
            return;
        }

        const canvas = game.canvas;
        const container = game.container;
        const viewportSize = this.getViewportSize();
        const width = `${viewportSize.width}px`;
        const height = `${viewportSize.height}px`;

        if (document.body) {
            document.body.style.position = 'fixed';
            document.body.style.left = '0';
            document.body.style.top = '0';
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.overflow = 'hidden';
            document.body.style.width = width;
            document.body.style.height = height;
        }

        if (document.documentElement) {
            document.documentElement.style.margin = '0';
            document.documentElement.style.padding = '0';
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.style.width = width;
            document.documentElement.style.height = height;
        }

        const gameDiv = document.getElementById('GameDiv');
        const cocosContainer = document.getElementById('Cocos3dGameContainer');

        if (gameDiv) {
            gameDiv.style.width = width;
            gameDiv.style.height = height;
        }

        if (cocosContainer) {
            cocosContainer.style.width = width;
            cocosContainer.style.height = height;
        }

        if (container) {
            container.style.width = width;
            container.style.height = height;
        }

        if (canvas) {
            canvas.style.width = width;
            canvas.style.height = height;
        }
    }

    private applyLayout(force: boolean) {
        this.applyViewportStyles();

        const isPortrait = this.isPortraitFrame();
        this.applyResolution(isPortrait);
        const visible = view.getVisibleSize();

        if (
            !force &&
            Math.abs(visible.width - this.lastWidth) < 0.5 &&
            Math.abs(visible.height - this.lastHeight) < 0.5 &&
            isPortrait === this.lastPortrait
        ) {
            return;
        }

        this.lastWidth = visible.width;
        this.lastHeight = visible.height;
        this.lastPortrait = isPortrait;

        const resizedVisible = view.getVisibleSize();
        const halfWidth = resizedVisible.width * 0.5;
        const halfHeight = resizedVisible.height * 0.5;
        const left = -halfWidth;
        const right = halfWidth;
        const top = halfHeight;
        const bottom = -halfHeight;

        if (this.camera) {
            this.camera.orthoHeight = resizedVisible.height * 0.5;
            this.camera.node.setPosition(0, 0, this.camera.node.position.z);
        }

        if (this.cta) {
            const transform = this.cta.getComponent(UITransform);
            if (transform) {
                transform.setContentSize(resizedVisible.width, this.ctaHeight);
            }
            this.cta.setPosition(0, bottom + this.ctaHeight * 0.5, this.cta.position.z);
            this.layoutCtaChildren(left, right, isPortrait);
        }

        this.layoutHud(left, right, top, isPortrait);
        this.layoutBackgrounds(resizedVisible.width, resizedVisible.height);

        if (this.hero) {
            const x = isPortrait ? this.portraitHeroX : this.landscapeHeroX;
            const y = isPortrait ? this.portraitHeroY : this.landscapeHeroY;
            const scale = isPortrait ? this.portraitHeroScale : this.landscapeHeroScale;
            const playerController = this.hero.getComponent(RunnerPlayerController);
            if (playerController) {
                playerController.fixedX = x;
            }
            this.hero.setPosition(x, RunnerGameManager.isStarted ? this.hero.position.y : y, this.hero.position.z);
            this.hero.setScale(scale, scale, this.hero.scale.z);
        }

        if (this.tapHint) {
            this.tapHint.setPosition(0, isPortrait ? 120 : 80, this.tapHint.position.z);
            const scale = isPortrait ? 0.8 : 1;
            this.tapHint.setScale(scale, scale, this.tapHint.scale.z);
        }

        if (this.hand) {
            this.hand.setPosition(0, isPortrait ? -120 : -80, this.hand.position.z);
            const scale = isPortrait ? 0.65 : 1;
            this.hand.setScale(
                this.handBaseScale.x * scale,
                this.handBaseScale.y * scale,
                this.handBaseScale.z,
            );
        }

        if (this.gameWorld) {
            this.gameWorld.setScale(1, 1, this.gameWorld.scale.z);
        }
    }

    private layoutBackgrounds(visibleWidth: number, visibleHeight: number) {
        if (!this.gameWorld) {
            return;
        }

        const backgrounds = [
            this.gameWorld.getChildByName('Background'),
            this.gameWorld.getChildByName('Background1'),
        ].filter((node): node is Node => !!node);

        if (backgrounds.length === 0) {
            return;
        }

        const baseWidth = backgrounds[0].getComponent(UITransform)?.width ?? this.designWidth;
        const fillWidth = Math.max(baseWidth, visibleWidth);

        backgrounds.forEach((background, index) => {
            const transform = background.getComponent(UITransform);
            if (transform) {
                transform.setContentSize(fillWidth, visibleHeight);
            }

            background.setPosition(index * fillWidth, 0, background.position.z);

            for (const component of background.getComponents(Component)) {
                const scrollingComponent = component as Component & { loopWidth?: number };
                if (typeof scrollingComponent.loopWidth === 'number') {
                    scrollingComponent.loopWidth = fillWidth;
                }
            }
        });
    }

    private layoutHud(left: number, right: number, top: number, isPortrait: boolean) {
        const hud = this.node.getChildByName('HUD') ?? this.node;
        if (!hud) {
            return;
        }

        const padding = isPortrait ? this.edgePadding : this.edgePadding * 0.75;
        const topY = top - (isPortrait ? 58 : 36);
        const scale = 1;

        const hearts = hud.getChildByName('heart');
        if (hearts) {
            hearts.setPosition(left + padding + 30 * scale, topY, hearts.position.z);
            hearts.setScale(scale, scale, hearts.scale.z);
        }

        const counter = hud.getChildByName('Сounter') ?? hud.getChildByName('Counter');
        if (counter) {
            const width = counter.getComponent(UITransform)?.width ?? 200;
            counter.setPosition(right - padding - width * scale * 0.5, topY - 6 * scale, counter.position.z);
            counter.setScale(scale, scale, counter.scale.z);
        }
    }

    private layoutCtaChildren(left: number, right: number, isPortrait: boolean) {
        if (!this.cta) {
            return;
        }

        const padding = isPortrait ? this.edgePadding : this.edgePadding * 0.75;
        const scale = 1;
        const playOff = this.cta.getChildByName('PlayOff');
        const download = this.cta.getChildByName('Download');

        if (playOff) {
            const width = playOff.getComponent(UITransform)?.width ?? 300;
            playOff.setPosition(left + padding + width * scale * 0.5, 0, playOff.position.z);
            playOff.setScale(scale, scale, playOff.scale.z);
        }

        if (download) {
            const width = download.getComponent(UITransform)?.width ?? 200;
            download.setPosition(right - padding - width * scale * 0.5, 0, download.position.z);
            download.setScale(scale, scale, download.scale.z);
        }
    }
}
