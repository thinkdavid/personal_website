$(document).ready(function() {
  console.log("page loaded");
});

$(".card").click(function() {
  window.location = $(this).find("a").attr("href"); 
  console.log("card clicked");
  return false;
});

$('.lazy').Lazy({
        // your configuration goes here
        scrollDirection: 'vertical',
        effect: 'fadeIn',
        visibleOnly: true,
        onError: function(element) {
            console.log('error loading ' + element.data('src'));
        }
});

$(function() {
        $('.lazy').lazy();
});


/***** Angular *****/

// Define the main module
var mainApp = angular.module('mainApp', ['ngRoute']);

mainApp.config(function($routeProvider) {
  console.log($routeProvider)
  $routeProvider
    .when('/', {
      controller:'MainController',
      templateUrl:'main.html'
    })
    .when('/about', {
      controller:'MainController',
      templateUrl:'about.html'
    })
    .when('/writing', {
      controller:'EssayListController',
      templateUrl:'essays.html'
    })
    .when('/photos', {
      controller:'PhotoController',
      templateUrl:'photos.html'
    })
    .when('/music', {
      controller:'MusicController',
      templateUrl:'music.html'
    })
    .when('/travel', {
      controller:'TravelController',
      templateUrl:'travel.html'
    })
    .when('/thailand', {
      controller:'TravelController',
      templateUrl:'thailand.html'
    })
    .when('/peru', {
      controller:'TravelController',
      templateUrl:'peru.html'
    })
    .when('/colombia', {
      controller:'TravelController',
      templateUrl:'colombia.html'
    })
    .when('/store', {
      controller:'StoreController',
      templateUrl:'store.html'
    })
    .when('/store/halong_bay', {
      controller: 'StoreController',
      templateUrl: 'store_items/halong_bay.html'
    })
    .otherwise({
      redirectTo:'/'
    });
});

mainApp.config(['$locationProvider', function($locationProvider) {
  $locationProvider.hashPrefix('');
}]);

mainApp.controller('MainController', function MainController($location, $scope) {

  $scope.selectNewPage = function() {
    // console.log("new page");
    window.scrollTo(0, 0);
  };
  //***//
});

// Define the StoreController
mainApp.controller('StoreController', function StoreController($location, $scope) {

  $scope.selectNewPage = function() {
    // console.log("new page");
    window.scrollTo(0, 0);
  };
  //***//
});

// Define the `EssayListController` controller
mainApp.controller('EssayListController', function EssayListController($scope, $location) {

  $scope.header = 'Writing';
  
  // starting article number
  $scope.articleNum = 0;

  $scope.essays = [
    {
      date: 'October 3, 2018',
      title: 'It\'s gonna be alright *Kendrick Voice*',
      body: 'Never get too high, never stay too low. <br><br> After relatively breezing through life for years (shout out to my family and friends)\, "real life" hit me hard. I\'ve never been lacking for confidence, and that confidence has let me handle adverse situations relatively smoothly. <br><br> Example: <br> If rejected by a girl that I liked, it didn\'t mean there was anything wrong with me (nor her), we just were not compatible <br> If there was anything I wasn\'t particularly good at, it wasn\'t because I couldn\'t become good at it, it was just because I hadn\'t had a chance to practice yet. <br><br> So when real life hit (which in my sitaution meant graudating college), I was\'t prepared for thoughts like <em>"what am I supposed to do now,"</em> and <em>"shit, I\'m really out here doing this adult shit, I guess."</em> <br><br> The real world was scary. <br> But it\'s not. <br><br> At least not as much as I thought. It\'s definitely not as complicated. I don\'t need the answer to every question. I\'m not the only one feeling like this. Just continue doing right by other people and shit\'s gonna be okay. Until I find out what I find out what I\'m really supposed to be out here doing -- or better said, what I want to be out here doing, this uncertainty is normal. In the meantime, I just gotta stay true to myself, and the people around me. <br><br>'
    }
    ,{
      date: 'April 17, 2018',
      title: 'Transition',
      body: 'Transitions are weird. <br><br> It implies that there\’s some sort of gradual period in between two stages. Some time for you to prepare for what\’s coming. But that\’s not really how it works. <br><br> A big bang happens, and then next thing you know, you\’re in a whole new universe. <br><br> But the fossils of the old stage remain no matter how hard you try to bury them. <br><br> I mean, we know that dinosaurs exist, and they got hit by a fucking meteor. Even though it feels like, so did I. <br><br> But dinosaurs…  They got hit by a fucking meteor. <br><br> I just got hit by a transition. <br><br> A transition I wasn\’t prepared for.'
    }
    ,{
      date: 'January 17, 2018',
      title: 'Home 1.1',
      body: '<p>I’ve always loved when old friends have come to visit me in the variety of places I’ve lived. I haven’t moved that much in my life, just three times, and I’ve had time to build solid relationships in every place I’ve ever lived. It’s always great to see those old friends again and just reminisce over good times.</p> <p>When I say that I have friends visiting from “home,” I usually mean from my hometown of Norfolk, VA. But then when we hang out all together, no matter what location we’re in it always “feels like home.”</p> <p>And I’m sure after I live in another place for as long as I lived in Norfolk, I’ll start referring to that as “home” as well. And when I hang out from friends from there, it’ll “feel like home”. Except a different home. But at this point what’s the difference?</p> <p>Of course you get attached to a place, but what really makes a place is the people you meet there. The experiences you share with people in that place. And when you connect with those people in different places you always relive a sense of that “home.”</p> <p>When my friends from my hometown, Norfolk, VA, visited in Charlottesville, VA, it felt like I was home again. As in the Norfolk home. </p> <p>When my friends from Charlottesville visited me in Norfolk, it felt like I was home again. As in the Charlottesville home.</p> <p>When I studied abroad and my friends from Australia visited me in Charlottesville, it felt like I was home again. Back in Australia.</p> <p>Home is everywhere I’ve ever been. <br>And at the same time it’s nowhere at all.</p>'
    }
    ,{
      date: 'November 21, 2017',
      title: 'A Eulogy to Brandon\'s Fantasy Season',
      body: 'We are gathered here today to lay Brandon\'s fantasy season to rest. Good while it lasted, although it never made it above .500, its loss is a tragedy to the league. If it were not for Brandon\'s tireless vision for the league and lack of good drafting ability, I might have won two less games (that I beat him by a combined score of 272.3 - 198.8). In fact, many of us have Brandon to thank for multiple W\'s in our record. Thank you Brandon, for sacrificing your playoff contention in the very league that you built. <br><br> While Brandon never actually improved, we are here today to applaud his never-say-never attitude. He was one of the most active players in the league, completing three trades and constantly scouring the waiver wire (for players that were busts). Brandon showed that no matter how bad you are, no matter how hard you try to get better, it\'s worth trying, even if you don\'t actually get better (like Brandon).'
    }
  ];

  $scope.articleChange = function() {

	if ($scope.articleNum <= 0) {
		$('#next').show();
	  	$('#prev').hide();
	  } 
	else if ($scope.articleNum >= $scope.essays.length-1) {
		$('#next').hide();
		$('#prev').show();
	} else {
	  	$('#next').show();
	  	$('#prev').show();
	}
};

  $scope.nextEssay = function() {
    window.scrollTo(0, 0);
  	if ($scope.articleNum < $scope.essays.length-1) {
		$scope.articleNum += 1;
	  	// console.log($scope.articleNum);
  	}
  	$scope.articleChange();
  };

  $scope.prevEssay = function() {
    window.scrollTo(0, 0);
  	if ($scope.articleNum > 0) {
		$scope.articleNum -= 1;
	  	// console.log($scope.articleNum);
  	}
  	$scope.articleChange();
  }; 

  //initial population
  $scope.articleChange();

});

mainApp.controller('MusicController', function MusicController($scope, $location) {
  $scope.selectNewPage = function() {
    // console.log("new page");
    window.scrollTo(0, 0);
  };
});

mainApp.controller('PhotoController', function PhotoController($scope, $location) {
  $scope.selectNewPage = function() {
    // console.log("new page");
    window.scrollTo(0, 0);
  };
});

mainApp.controller('TravelController', function TravelController($scope, $location) {
  $scope.selectNewPage = function() {
    // console.log("new page");
    window.scrollTo(0, 0);
  };

  $scope.selectedTravelPost = function() {
    window.scrollTo(0, 0);
  };
  
});






