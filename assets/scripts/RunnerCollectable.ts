import {
    _decorator,
    BoxCollider2D,
    Collider2D,
    Component,
    Contact2DType,
    ERigidBody2DType,
    IPhysics2DContact,
    RigidBody2D,
    UITransform,
} from 'cc';
import { RunnerGameManager } from './RunnerGameManager';
import { RunnerPlayerController } from './RunnerPlayerController';

const { ccclass, property } = _decorator;

@ccclass('RunnerCollectable')
export class RunnerCollectable extends Component {
    @property
    value = 10;

    @property
    collectableTag = 4;

    @property
    configureCollider = true;

    private collider: Collider2D | null = null;
    private collected = false;

    onLoad() {
        this.collider = this.getComponent(Collider2D);

        if (this.configureCollider) {
            this.collider = this.ensureCollider();
            this.ensureRigidBody();
        }

        if (this.collider) {
            this.collider.tag = this.collectableTag;
            this.collider.sensor = true;
            this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    onDestroy() {
        this.collider?.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
    }

    collect() {
        if (this.collected) {
            return false;
        }

        this.collected = true;
        return RunnerGameManager.collectNode(this.node, this.value);
    }

    private onBeginContact(_self: Collider2D, other: Collider2D, _contact?: IPhysics2DContact | null) {
        if (!this.isPlayerCollider(other)) {
            return;
        }

        this.collect();
    }

    private isPlayerCollider(other: Collider2D) {
        return Boolean(other.node.getComponent(RunnerPlayerController));
    }

    private ensureCollider() {
        let collider = this.getComponent(BoxCollider2D);
        if (!collider) {
            collider = this.addComponent(BoxCollider2D);
        }

        const transform = this.getComponent(UITransform);
        if (transform) {
            collider.size = transform.contentSize;
        }

        return collider;
    }

    private ensureRigidBody() {
        let body = this.getComponent(RigidBody2D);
        if (!body) {
            body = this.addComponent(RigidBody2D);
        }

        body.type = ERigidBody2DType.Static;
        body.enabledContactListener = true;
    }
}
