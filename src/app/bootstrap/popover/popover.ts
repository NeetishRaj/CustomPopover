import {
    Component,
    Directive,
    Input,
    Output,
    EventEmitter,
    ChangeDetectionStrategy,
    OnInit,
    OnDestroy,
    OnChanges,
    Inject,
    Injector,
    Renderer2,
    ComponentRef,
    ElementRef,
    TemplateRef,
    ViewContainerRef,
    ComponentFactoryResolver,
    NgZone,
    SimpleChanges,
    ViewEncapsulation,
    ChangeDetectorRef,
    ApplicationRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { listenToTriggers } from '../util/triggers';
import { ngbAutoClose } from '../util/autoclose';
import { positionElements, PlacementArray } from '../util/positioning';
import { PopupService } from '../util/popup';

import { NgbPopoverConfig } from './popover-config';

let nextId = 0;

@Component({
    selector: 'ngb-popover-window',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: {
        '[class]': '"popover" + (popoverClass ? " " + popoverClass : "")',
        '[class.fade]': 'animation',
        role: 'tooltip',
        '[id]': 'id',
    },
    template: ` <div class="arrow"></div>
        <h3 class="popover-header" *ngIf="title">
            <ng-template #simpleTitle>{{ title }}</ng-template>
            <ng-template
                [ngTemplateOutlet]="
                    isTitleTemplate() ? $any(title) : simpleTitle
                "
                [ngTemplateOutletContext]="context"
            ></ng-template>
        </h3>
        <div class="popover-body"><ng-content></ng-content></div>`,
    styleUrls: ['./popover.scss'],
})
export class NgbPopoverWindow {
    @Input() animation: boolean;
    @Input() title: string | TemplateRef<any> | null | undefined;
    @Input() id: string;
    @Input() popoverClass: string;
    @Input() context: any;

    isTitleTemplate() {
        return this.title instanceof TemplateRef;
    }
    /**
     *
     */
    constructor() {
        this.animation = true;
        this.title = null;
        this.id = '';
        this.popoverClass = '';
    }
}

/**
 * A lightweight and extensible directive for fancy popover creation.
 */
@Directive({ selector: '[ngbPopover]', exportAs: 'ngbPopover' })
export class NgbPopover implements OnInit, OnDestroy, OnChanges {
    static ngAcceptInputType_autoClose: boolean | string;

    @Input() animation: boolean;

    @Input() autoClose: boolean | 'inside' | 'outside';

    @Input() ngbPopover: string | TemplateRef<any> | null | undefined;

    @Input() popoverTitle: string | TemplateRef<any> | null | undefined;

    @Input() placement: PlacementArray;

    @Input() triggers: string;

    @Input() container: string;

    @Input() disablePopover: boolean;

    @Input() popoverClass: string;

    @Input() openDelay: number;

    @Input() closeDelay: number;

    @Output() shown = new EventEmitter<void>();

    @Output() hidden = new EventEmitter<void>();

    private _ngbPopoverWindowId = `ngb-popover-${nextId++}`;
    private _popupService: PopupService<NgbPopoverWindow>;
    private _windowRef: ComponentRef<NgbPopoverWindow> | null = null;
    private _unregisterListenersFn: Function | null;
    private _zoneSubscription: any;
    private _isDisabled(): boolean {
        if (this.disablePopover) {
            return true;
        }
        if (!this.ngbPopover && !this.popoverTitle) {
            return true;
        }
        return false;
    }

    constructor(
        private _elementRef: ElementRef<HTMLElement>,
        private _renderer: Renderer2,
        injector: Injector,
        componentFactoryResolver: ComponentFactoryResolver,
        viewContainerRef: ViewContainerRef,
        config: NgbPopoverConfig,
        private _ngZone: NgZone,
        @Inject(DOCUMENT) private _document: any,
        private _changeDetector: ChangeDetectorRef,
        applicationRef: ApplicationRef
    ) {
        this.animation = config.animation;
        this.autoClose = config.autoClose;
        this.placement = config.placement;
        this.triggers = config.triggers;
        this.container = config.container;
        this.disablePopover = config.disablePopover;
        this.popoverClass = config.popoverClass;
        this.openDelay = config.openDelay;
        this.closeDelay = config.closeDelay;
        this._popupService = new PopupService<NgbPopoverWindow>(
            NgbPopoverWindow,
            injector,
            viewContainerRef,
            _renderer,
            this._ngZone,
            componentFactoryResolver,
            applicationRef
        );

        this._zoneSubscription = _ngZone.onStable.subscribe(() => {
            if (this._windowRef) {
                positionElements(
                    this._elementRef.nativeElement,
                    this._windowRef.location.nativeElement,
                    this.placement,
                    this.container === 'body',
                    'bs-popover'
                );
            }
        });
        this._unregisterListenersFn = null;
    }

    open(context?: any) {
        if (!this._windowRef && !this._isDisabled()) {
            // this type assertion is safe because otherwise _isDisabled would return true
            const { windowRef, transition$ } = this._popupService.open(
                this.ngbPopover as string | TemplateRef<any>,
                context,
                this.animation
            );
            this._windowRef = windowRef;
            this._windowRef.instance.animation = this.animation;
            this._windowRef.instance.title = this.popoverTitle;
            this._windowRef.instance.context = context;
            this._windowRef.instance.popoverClass = this.popoverClass;
            this._windowRef.instance.id = this._ngbPopoverWindowId;

            this._renderer.setAttribute(
                this._elementRef.nativeElement,
                'aria-describedby',
                this._ngbPopoverWindowId
            );

            if (this.container === 'body') {
                this._document
                    .querySelector(this.container)
                    .appendChild(this._windowRef.location.nativeElement);
            }

            this._windowRef.changeDetectorRef.detectChanges();

            this._windowRef.changeDetectorRef.markForCheck();

            ngbAutoClose(
                this._ngZone,
                this._document,
                this.autoClose,
                () => this.close(),
                this.hidden,
                [this._windowRef.location.nativeElement]
            );

            transition$.subscribe(() => this.shown.emit());
        }
    }

    close() {
        if (this._windowRef) {
            this._renderer.removeAttribute(
                this._elementRef.nativeElement,
                'aria-describedby'
            );
            this._popupService.close(this.animation).subscribe(() => {
                this._windowRef = null;
                this.hidden.emit();
                this._changeDetector.markForCheck();
            });
        }
    }

    toggle(): void {
        if (this._windowRef) {
            this.close();
        } else {
            this.open();
        }
    }

    isOpen(): boolean {
        return this._windowRef != null;
    }

    ngOnInit() {
        this._unregisterListenersFn = listenToTriggers(
            this._renderer,
            this._elementRef.nativeElement,
            this.triggers,
            this.isOpen.bind(this),
            this.open.bind(this),
            this.close.bind(this),
            +this.openDelay,
            +this.closeDelay
        );
    }

    ngOnChanges({
        ngbPopover,
        popoverTitle,
        disablePopover,
        popoverClass,
    }: SimpleChanges) {
        if (popoverClass && this.isOpen()) {
            this._windowRef!.instance.popoverClass = popoverClass.currentValue;
        }
        // close popover if title and content become empty, or disablePopover set to true
        if (
            (ngbPopover || popoverTitle || disablePopover) &&
            this._isDisabled()
        ) {
            this.close();
        }
    }

    ngOnDestroy() {
        this.close();
        // This check is needed as it might happen that ngOnDestroy is called before ngOnInit
        // under certain conditions, see: https://github.com/ng-bootstrap/ng-bootstrap/issues/2199
        if (this._unregisterListenersFn) {
            this._unregisterListenersFn();
        }
        this._zoneSubscription.unsubscribe();
    }
}
