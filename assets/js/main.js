$(document).ready(function() {

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

// angular data controllers
// Define the `essay` module
var writingApp = angular.module('writingApp', ['ngSanitize']);

// Define the `PhoneListController` controller on the `phonecatApp` module
writingApp.controller('EssayListController', function EssayListController($scope) {

  $scope.header = 'Writing';

  // starting article number
  $scope.articleNum = 0;

  $scope.essays = [
    {
      date: 'November 21, 2017',
      title: 'A Eulogy to Brandon\'s Fantasy Season',
      body: 'We are gathered here today to lay Brandon\'s fantasy season to rest. Good while it lasted, although it never made it above .500, its loss is a tragedy to the league. If it were not for Brandon\'s tireless vision for the league and lack of good drafting ability, I might have won two less games (that I beat him by a combined score of 272.3 - 198.8). In fact, many of us have Brandon to thank for multiple W\'s in our record. Thank you Brandon, for sacrificing your playoff contention in the very league that you built. <br><br> While Brandon never actually improved, we are here today to applaud his never-say-never attitude. He was one of the most active players in the league, completing three trades and constantly scouring the waiver wire (for players that were busts). Brandon showed that no matter how bad you are, no matter how hard you try to get better, it\'s worth trying, even if you don\'t actually get better (like Brandon).'
    },
    {
      date: 'January 5, 2018',
      title: 'This is a test article',
      body: 'This is a test body of article'
    },
    {
      date: 'January 9, 2018',
      title: 'This is the third article',
      body: 'This is a test body of article'
    },
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