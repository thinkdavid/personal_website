$(document).ready(function() {
	$('#main').add
});

$("#getStartedBtn").click(function() {
	$(this).fadeOut("slow", function() {
		$('#welcome').slideUp(function () {
			$('#main').slideDown(function () {
				$('main').toggleClass('.hidden');
			}); 
		});;
	});
});

