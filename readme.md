## Owl Carousel Scrollbar Plugin

This is a simple plugin to setup scrollbar for owl carousel slider. Scrollbar can be of two types: 1) Progress bar and 2) Simple Scroll bar. Dragging the handle will move the slides accordingly.

## How to use?

Pass `scrollbarType` parameter with the Owl Carousel options as following:

`scrollbarType: 'scroll'` or `scrollbarType: 'progress'`

```
var owl = $(".owl-carousel");

owl.owlCarousel({
	loop: true,
	margin: 15,
	nav: false,
	dots: false,
	singleItem: true,
	autoplay: true,
	smartSpeed: 1000,
	autoplayTimeout: 1000,

    // the following  parameter is required for the scrollbar. The value can be one out of "scroll" or "progress"

	scrollbarType: "progress",

	responsive: {
		0: {
			items: 2
		},
		600: {
			items: 3
		},
		1000: {
			items: 4
		}
	}
});
```


## Known Issues

Scrollar have some quirks when used with looped slider.