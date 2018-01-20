$(document).ready(function() {
  console.log("page loaded");
});

/***** Angular *****/

// Define the main module
var mainApp = angular.module('mainApp', ['ngSanitize', 'ngRoute']);

mainApp.config(function($routeProvider) {
  $routeProvider
    .when('/', {
      controller:'MainController',
      templateUrl:'main.html'
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
    .otherwise({
      redirectTo:'/'
    });
});

mainApp.config(['$locationProvider', function($locationProvider) {
  $locationProvider.hashPrefix('');
}]);

mainApp.controller('MainController', function MainController($location, $scope) {
  //***//
});

// Define the `EssayListController` controller
mainApp.controller('EssayListController', function EssayListController($scope, $location) {

  $scope.header = 'Writing';
  
  // starting article number
  $scope.articleNum = 0;

  $scope.essays = [
    {
      date: 'January 20, 2018',
      title: 'Mirror Image',
      body: '<p>I just got out of the most intense relationship of my life. Like the one of the ones where you love the other person more than you love yourself. Where the things you want take a backseat to what they want. Not in a way where you feel like you’re sacrificing either — you just want them to be happy, and that makes you happy.</p> <p>It ended terribly.</p> <p>So I’m trying to figure out where it all went wrong. How could something that seemed so perfect to me (even when it wasn’t) devolve into a point where I find myself actively working to not hate the other person? How did it get to a point where I think I’d be better off if I didn’t see or hear from them ever again?</p> <p>Naturally, I think people try to blame themselves. Try to find out what we did wrong. And this can usually be unnecessarily harsh. I mean nobody is perfect.</p> <p>So I’ll start with things I could have done better, or things I did wrong. Firstly, my ex seemed to think that I cheated on her (I don’t know if she actually believes it or not but she said so, so here we are). So I started thinking, what could I have possibly done to make her think that I actually cheated on her. When I thought back, nothing jumped to mind. I had never been physical with any other girl, I was pretty transparent about her the whole time (everyone knew who my girl was and if they didn’t, I would tell them). Maybe it was just my personality. I wondered if maybe I flirted too much and didn’t realize it. It’s possible, I was used to being single, and I talk a LOT, and most of the time it can be seen as flirty. But I certainly didn’t mean to. And I’d never have chosen someone else over my ex. There is no doubt in my mind that I never considered that someone else was better for me. So if she thinks I cheated, I must’ve given someone the wrong impression. Which I guess is something to work on. Maybe I’ll just have to keep an active eye on the flirting, even though to me it means nothing, and I don’t even think I notice what I’m doing.</p> <p>When it turned into a distance relationship, I was definitely self-conscious about the whole thing, and I wonder if that had something to do with it too. I had varying levels of comfort with some of the things she did while she was away from me, and although I trusted her, maybe I turned it into a situation I shouldn’t have. But then again, I also have the right to express what makes me uncomfortable, and thinking back I’m not sure that I was wrong to be uncomfortable - but maybe I could’ve expressed it differently. I definitely made her feel bad about some of the things she did, and I’m not going to say that wasn’t my intention, but I guess I didn’t realize the affect of doing that. I just wanted her to understand that what she was doing was really difficult to me.</p> <p>But at the same time, when I realized that I was ruining her fun, and making her miserable by my being uncomfortable, I tried to find a middle ground. I didn’t mention everything that made me uncomfortable, and if I did I actively tried to not make her feel terrible about it. When I realized she didn’t really want to compromise and was still sad about not being able to do everything she wanted to do, I started coming to the conclusion that we couldn’t work apart. At least not in combination with the nature of our distance relationship.</p> <p> Everything was good when we were together, and it wasn’t always like this, but the distance definitely caused the break up. But with all that being said, I don’t think that’s how we got to where we are now. I always understood her, so even as I was super sad about the relationship ending, I knew how difficult (well I thought) it was for her as well, and I mean how can you hate someone for following their dreams?</p> <p>We got to where we are now because of everything that happened <em>after</em> we broke up. And I honestly think looking in the mirror, that although I’m not perfect, I know what I did, and I can live with it, because I know that I tried, and I know how much I cared.</p>'
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
}

  $scope.nextEssay = function() {
  	if ($scope.articleNum < $scope.essays.length-1) {
		$scope.articleNum += 1;
	  	// console.log($scope.articleNum);
  	}
  	$scope.articleChange();
  };

  $scope.prevEssay = function() {
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

});

mainApp.controller('PhotoController', function PhotoController($scope, $location) {

});





