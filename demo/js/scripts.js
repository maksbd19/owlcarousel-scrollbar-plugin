var owl = $(".owl-carousel");

owl.owlCarousel({
	loop: false,
	margin: 15,
	nav: false,
	dots: false,
	singleItem: true,
	autoplay: true,
	smartSpeed: 1000,
	autoplayTimeout: 5000,
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


