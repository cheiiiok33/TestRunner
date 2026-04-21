import { _decorator, Button, Component, Label, Node, tween } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('RunnerGameOverScreen')
export class RunnerGameOverScreen extends Component {
    @property(Label)
    titleLabel: Label | null = null;

    @property(Label)
    scoreLabel: Label | null = null;

    @property(Label)
    buttonLabel: Label | null = null;

    @property(Node)
    pulseButton: Node | null = null;

    @property(Node)
    rotatingNode: Node | null = null;

    @property
    titleText = "You didn't make it!\nTry again on the app!";

    @property
    buttonText = 'INSTALL AND EARN';

    @property
    scorePrefix = '$';

    @property
    pulseScale = 1.08;

    @property
    pulseDuration = 0.45;

    @property
    rotateNodeName = '1';

    @property
    rotateDegreesPerSecond = 90;

    private hasSetup = false;

    start() {
        if (this.hasSetup) {
            return;
        }

        this.resolveParts();
        this.applyText(0);
        this.startButtonPulse();
    }

    update(deltaTime: number) {
        if (!this.rotatingNode) {
            return;
        }

        this.rotatingNode.angle += this.rotateDegreesPerSecond * deltaTime;
    }

    setup(score: number) {
        this.hasSetup = true;
        this.resolveParts();
        this.applyText(score);
        this.startButtonPulse();
    }

    private applyText(score: number) {
        if (this.titleLabel) {
            this.titleLabel.string = this.titleText;
        }

        if (this.scoreLabel) {
            this.scoreLabel.string = `${this.scorePrefix}${score}`;
        }

        if (this.buttonLabel) {
            this.buttonLabel.string = this.buttonText;
        }
    }

    private startButtonPulse() {
        if (!this.pulseButton) {
            return;
        }

        tween(this.pulseButton).stop();

        const baseScale = this.pulseButton.scale.clone();
        const maxScale = baseScale.clone().multiplyScalar(this.pulseScale);

        tween(this.pulseButton)
            .repeatForever(
                tween()
                    .to(this.pulseDuration, { scale: maxScale }, { easing: 'sineInOut' })
                    .to(this.pulseDuration, { scale: baseScale }, { easing: 'sineInOut' }),
            )
            .start();
    }

    private resolveParts() {
        this.pulseButton = this.pulseButton ?? this.findButtonNode(this.node);
        this.rotatingNode = this.rotatingNode ?? this.findNodeByName(this.node, this.rotateNodeName);

        const labels = this.node.getComponentsInChildren(Label);
        this.buttonLabel = this.buttonLabel ?? labels.find((label) => this.pulseButton && this.isDescendantOf(label.node, this.pulseButton)) ?? null;

        const nonButtonLabels = labels.filter((label) => label !== this.buttonLabel);
        this.titleLabel = this.titleLabel ?? this.findTopLabel(nonButtonLabels);
        this.scoreLabel = this.scoreLabel ?? this.findScoreLabel(nonButtonLabels);
    }

    private findButtonNode(node: Node): Node | null {
        if (node.getComponent(Button) || /button/i.test(node.name)) {
            return node;
        }

        for (const child of node.children) {
            const found = this.findButtonNode(child);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private findNodeByName(node: Node, name: string): Node | null {
        if (node.name === name) {
            return node;
        }

        for (const child of node.children) {
            const found = this.findNodeByName(child, name);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private findTopLabel(labels: Label[]) {
        return labels
            .slice()
            .sort((left, right) => right.node.worldPosition.y - left.node.worldPosition.y)[0] ?? null;
    }

    private findScoreLabel(labels: Label[]) {
        const candidates = labels.filter((label) => label !== this.titleLabel);
        return candidates
            .slice()
            .sort((left, right) => Math.abs(left.node.worldPosition.y) - Math.abs(right.node.worldPosition.y))[0] ?? null;
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
