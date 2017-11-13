/**
 * Owl Carousel JSON load plugin
 * @author Mahbub Alam <makjoybd@gmail.com>
 * @since 2.0.0
 */

; (function ($, window, document, undefined) {

    "use strict";

    var Instance = undefined;

    var o = {};

    var namespace = "scrollbar";
    var handleClass = "owl-scroll-handle";
    var progressBarClass = "owl-scroll-progress";
    var scrollbarClass = "owl-scrollbar";
    var draggingClass = "owl-scroll-handle-dragging";
    var draggedClass = "owl-scroll-handle-dragged";

    var $handle = $("<div>").addClass(handleClass);
    var $progressBar = $("<div>").addClass(progressBarClass);
    var $scrollbar = $("<div>").addClass(scrollbarClass).append($handle);

    var sbStyles = new StyleRestorer($scrollbar[0]);
    var handleStyles = new StyleRestorer($handle[0]);
    var progressStyles = new StyleRestorer($progressBar[0]);

    var sbSize = 0;
    var progressSize = 0;

    var dragInitEvents = 'touchstart.' + namespace + ' mousedown.' + namespace;
    var dragMouseEvents = 'mousemove.' + namespace + ' mouseup.' + namespace;
    var dragTouchEvents = 'touchmove.' + namespace + ' touchend.' + namespace;
    var clickEvent = 'click.' + namespace;

    var interactiveElements = ['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'];

    // Save styles
    var holderProps = ['overflow', 'position'];
    var movableProps = ['position', 'webkitTransform', 'msTransform', 'transform', 'left', 'top', 'width', 'height'];

    var count = 0;
    var visible = 0;
    var ratio = 1;
    var animationSpeed = 0;

    var dragging = {
        released: 1,
        init: 0
    };

    var transform, gpuAcceleration;

    var hPos = {
        start: 0,
        end: 0,
        cur: 0,
        index: 0
    };

    // Math shorthands
    var abs = Math.abs;
    var sqrt = Math.sqrt;
    var pow = Math.pow;
    var round = Math.round;
    var max = Math.max;
    var min = Math.min;

    // Feature detects
    (function () {
        var prefixes = ['', 'Webkit', 'Moz', 'ms', 'O'];
        var el = document.createElement('div');

        function testProp(prop) {
            for (var p = 0, pl = prefixes.length; p < pl; p++) {
                var prefixedProp = prefixes[p] ? prefixes[p] + prop.charAt(0).toUpperCase() + prop.slice(1) : prop;
                if (el.style[prefixedProp] != null) {
                    return prefixedProp;
                }
            }
        }

        // Global support indicators
        transform = testProp('transform');
        gpuAcceleration = testProp('perspective') ? 'translateZ(0) ' : '';
    }());

    var Scrollbar = function (carousel) {

        this.initialized = false;

        this._core = carousel;

        this.options = {};

        this._handlers = {
            'initialized.owl.carousel refreshed.owl.carousel resized.owl.carousel': $.proxy(function (e) {
                if (e.namespace && this._core.settings.scrollbarType) {
                    initialize.call(this, e);
                }
            }, this),
            "translate.owl.carousel": $.proxy(function (e) {
                if (e.namespace && this._core.settings.scrollbarType) {
                    sync.call(this, e);
                }
            }, this),
            "drag.owl.carousel": $.proxy(function (e) {
                if (e.namespace && this._core.settings.scrollbarType) {
                    dragging.init = 1;
                    sync.call(this, e);
                }
            }, this),
            "dragged.owl.carousel": $.proxy(function (e) {
                if (e.namespace && this._core.settings.scrollbarType) {
                    dragging.init = 0;
                }
            }, this)
        }

        Instance = this._core = carousel;
        this.options = $.extend(Scrollbar.Defaults, this._core.options);
        this._core.$element.on(this._handlers);

        o = this.options;

    }

    Scrollbar.Defaults = {
        scrollbarType: 'scroll',
        scrollDragThreshold: 3,
        scrollbarHandleSize: 10
    }


    function dragInit(event) {
        var isTouch = event.type === 'touchstart';
        var source = event.data.source;

        if (dragging.init || !isTouch && isInteractive(event.target)) {
            return;
        }

        if (!isTouch) {
            stopDefault(event);
        }

        unsetTransitionAnimation();

        dragging.released = 0;
        dragging.init = 0;
        dragging.$source = $(event.target);
        dragging.touch = isTouch;
        dragging.pointer = isTouch ? event.originalEvent.touches[0] : event;
        dragging.initX = dragging.pointer.pageX;
        dragging.initY = dragging.pointer.pageY;
        dragging.path = 0;
        dragging.delta = 0;
        dragging.locked = 0;
        dragging.pathToLock = 0;

        $(document).on(isTouch ? dragTouchEvents : dragMouseEvents, dragHandler);

        $handle.addClass(draggedClass);

    }

    /**
     * Handler for dragging scrollbar handle
     *
     * @param  {Event} event
     *
     * @return {Void}
     */
    function dragHandler(event) {
        dragging.released = event.type === 'mouseup' || event.type === 'touchend';
        dragging.pointer = dragging.touch ? event.originalEvent[dragging.released ? 'changedTouches' : 'touches'][0] : event;
        dragging.pathX = dragging.pointer.pageX - dragging.initX;
        dragging.pathY = dragging.pointer.pageY - dragging.initY;
        dragging.path = sqrt(pow(dragging.pathX, 2) + pow(dragging.pathY, 2));
        dragging.delta = dragging.pathX + hPos.cur;

        var current = 0;

        if (!dragging.released && dragging.path < 1) return;

        // We haven't decided whether this is a drag or not...
        if (!dragging.init) {
            // If the drag path was very short, maybe it's not a drag?
            if (dragging.path < o.scrollDragThreshold) {
                // If the pointer was released, the path will not become longer and it's
                // definitely not a drag. If not released yet, decide on next iteration
                return dragging.released ? dragEnd() : undefined;
            }
            else {
                // If dragging path is sufficiently long we can confidently start a drag
                // if drag is in different direction than scroll, ignore it
                if (abs(dragging.pathX) > abs(dragging.pathY)) {
                    dragging.init = 1;
                } else {
                    return dragEnd();
                }
            }
        }

        stopDefault(event);

        if (!dragging.locked && dragging.path > dragging.pathToLock && dragging.slidee) {
            dragging.locked = 1;
            dragging.$source.on(clickEvent, disableOneEvent);
        }

        if (dragging.released) {
            dragEnd();
        }

        switch (o.scrollbarType) {

            case "scroll":

                current = within(dragging.delta, hPos.start, hPos.end);

                if (transform) {
                    $handle[0].style[transform] = gpuAcceleration + 'translateX' + '(' + current + 'px)';
                } else {
                    $handle[0].style['left'] = current + 'px';
                }

                break;
            case "progress":

                current = within(dragging.delta, hPos.start, hPos.end);
                $progressBar[0].style["width"] = current + "px";
                $handle[0].style['left'] = current + 'px';
                break;
        }

        dragging.current = current;

        var index = round(dragging.current / ratio);

        if (index != hPos.index) {

            hPos.index = index;
            Instance.$element.trigger("to.owl.carousel", [index, animationSpeed, true]);
        }



    }

    /**
     * Stops dragging and cleans up after it.
     *
     * @return {Void}
     */
    function dragEnd() {

        dragging.released = true;
        $(document).off(dragging.touch ? dragTouchEvents : dragMouseEvents, dragHandler);
        $handle.removeClass(draggedClass);

        setTimeout(function () {
            dragging.$source.off(clickEvent, disableOneEvent);
        });

        hPos.cur = dragging.current;

        dragging.init = 0;
    }

    /**
	 * Disables an event it was triggered on and unbinds itself.
	 *
	 * @param  {Event} event
	 *
	 * @return {Void}
	 */
    function disableOneEvent(event) {
        /*jshint validthis:true */
        stopDefault(event, 1);
        $(this).off(event.type, disableOneEvent);
    }

    /**
	 * Make sure that number is within the limits.
	 *
	 * @param {Number} number
	 * @param {Number} min
	 * @param {Number} max
	 *
	 * @return {Number}
	 */
    function within(number, min, max) {
        return number < min ? min : number > max ? max : number;
    }

    /**
	 * Saves element styles for later restoration.
	 *
	 * Example:
	 *   var styles = new StyleRestorer(frame);
	 *   styles.save('position');
	 *   element.style.position = 'absolute';
	 *   styles.restore(); // restores to state before the assignment above
	 *
	 * @param {Element} element
	 */
    function StyleRestorer(element) {
        var self = {};
        self.style = {};
        self.save = function () {
            if (!element || !element.nodeType) return;
            for (var i = 0; i < arguments.length; i++) {
                self.style[arguments[i]] = element.style[arguments[i]];
            }
            return self;
        };
        self.restore = function () {
            if (!element || !element.nodeType) return;
            for (var prop in self.style) {
                if (self.style.hasOwnProperty(prop)) element.style[prop] = self.style[prop];
            }
            return self;
        };
        return self;
    }

    /**
	 * Event preventDefault & stopPropagation helper.
	 *
	 * @param {Event} event     Event object.
	 * @param {Bool}  noBubbles Cancel event bubbling.
	 *
	 * @return {Void}
	 */
    function stopDefault(event, noBubbles) {
        event.preventDefault();
        if (noBubbles) {
            event.stopPropagation();
        }
    }

    /**
     * Check whether element is interactive.
     *
     * @return {Boolean}
     */
    function isInteractive(element) {
        return ~$.inArray(element.nodeName, interactiveElements);
    }

    /**
     * Calculate current position from item index
     * 
     * @param {int} index 
     */
    function calculateCurrentPosition() {

        var position = 0;
        var index = Instance.relative(Instance.current());

        if (index === 0) {
            position = 0;
        }
        else if (index < count - visible) {
            position = (ratio * index);
        }
        else {
            position = sbSize - progressSize;
        }

        return position;
    }

    /**
     * Calculate current size from item index
     * 
     * @param {int} index 
     */
    function calculateCurrentSize() {

        var size = 0;

        var index = Instance.relative(Instance.current());

        if (index < count - visible) {
            size = ratio * index;
        }
        else {
            size = sbSize;
        }

        return size;
    }

    function setTransitionAnimation() {
        $handle.css({
            "transition": "all " + (animationSpeed / 1000) + "s ease-in-out"
        });
        $progressBar.css({
            "transition": "all " + (animationSpeed / 1000) + "s ease-in-out"
        });
    }

    function unsetTransitionAnimation() {
        $handle.css({
            "transition": ""
        });
        $progressBar.css({
            "transition": ""
        });
    }

    /**
     * Initialize the plugin
     * 
     * injects the scrollbar and sets initial values 
     * and parameters for furture uses in synchronization
     * 
     * @param {Event} event 
     */

    function initialize(event) {

        if (this.initialized) {
            return;
        }

        var $element = this._core.$element;

        $element.append($scrollbar);

        $handle.css({
            cursor: "pointer",
        });

        sbStyles.save.apply(sbStyles, holderProps);

        $handle.on(dragInitEvents, { source: handleClass }, dragInit);

        sbSize = $scrollbar.width();

        count = event.item.count;
        visible = event.page.size;
        ratio = sbSize / (count - visible + 1);
        animationSpeed = this._core.options.smartSpeed;

        hPos.start = 0;
        hPos.cur = 0;

        if (o.scrollbarType === "progress") {

            $scrollbar.prepend($progressBar);

            progressSize = calculateCurrentSize(event.item.index);

            var handleSize = $handle.width();

            progressStyles.save.apply(handleStyles, movableProps);

            $progressBar.width(progressSize);
        }
        else {
            var handleSize = 100;
            handleStyles.save.apply(handleStyles, movableProps);
            $handle.width(handleSize);
        }

        hPos.end = sbSize - handleSize;

        this.initialized = true;
    }

    /**
     * Synchronize scrollbar on item drag
     * 
     * Dragging the items in the carousel frame, clicking 
     * on the nav buttons or dots fires this function to 
     * synchronize the scrollbar handle porision or size
     * 
     * @param {Event} event 
     */
    function sync(event) {
        if ($handle.length && dragging.init === 0) {

            setTransitionAnimation();

            switch (o.scrollbarType) {

                case "scroll":

                    var current = calculateCurrentPosition();

                    hPos.cur = current;

                    if (transform) {
                        $handle[0].style[transform] = gpuAcceleration + 'translateX' + '(' + current + 'px)';
                    } else {
                        $handle[0].style['left'] = current + 'px';
                    }

                    break;
                case "progress":

                    var current = calculateCurrentSize();

                    hPos.cur = current;

                    $progressBar[0].style["width"] = current + "px";
                    $handle[0].style['left'] = current + 'px';

                    break;
            }
        }

    }

    Scrollbar.prototype.destroy = function () {
        var handler, property;

        for (handler in this._handlers) {
            this._core.$element.off(handler, this._handlers[handler]);
        }
        for (property in Object.getOwnPropertyNames(this)) {
            typeof this[property] != 'function' && (this[property] = null);
        }
    };

    $.fn.owlCarousel.Constructor.Plugins['Scrollbar'] = Scrollbar;

})(window.Zepto || window.jQuery, window, document);
