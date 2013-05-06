"use strict";

var randomNameGenerator = function() {
	var randAnimal	= animals[Math.floor(Math.random() * animals.length)],
		randAdj;
	if (randAnimal.indexOf(",") != -1) {
		var splitAnimal = randAnimal.split(",");
		randAnimal = splitAnimal[1].trim() + " " + splitAnimal[0];
	}
	randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
	if ( $("#aliteration").prop("checked") ) {
		while ( randAdj.charAt(0).toUpperCase() != randAnimal.charAt(0).toUpperCase() ) {
			randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
		}
	}
	randAdj = randAdj.charAt(0).toUpperCase() + randAdj.slice(1);
	return randAdj + " " + randAnimal;
}

$(document).ready(function() {
	$('.generate').on('click', function() {
		var buffer = '<div class="result">'
			+ '<div class="codeName">' + randomNameGenerator() + '</div>'
			+ '<div class="remove"><a href="#" class="removeName"><i class="icon-remove"></i></a></span>'
			+ '</div>';
		$('.results').prepend(buffer);
		$('.removeName').on('click', function() {
			$(this).parent().parent().remove();
			return false;
		});
	});
	$('.removeName').on('click', function() {
		$(this).parent().parent().remove();
		return false;
	});
});
