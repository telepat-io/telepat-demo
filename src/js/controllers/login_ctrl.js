window.fbAsyncInit = function() {
	FB.init({
		appId   : '166264107105072',
		oauth   : true,
		status  : true, // check login status
		cookie  : true, // enable cookies to allow the server to access the session
		xfbml   : true, // parse XFBML
		version : 'v2.6'
	});
};
var LoginController = {
	render: function() {
		window.fbAsyncInit();
		setTimeout(function() {
			if (localStorage.hasLoggedOut == undefined || localStorage.hasLoggedOut == 'false') {
				FB.getLoginStatus(function(response) {
					console.log(response);
					if (response.status === 'connected') {
						localStorage.hasLoggedOut = false;
						window.TelepatInstance.user.loginWithFacebook(response.authResponse.accessToken);
						window.TelepatInstance.on('login', function() {
							ChatController.render();
						});
					} else {
						$('#everything').load('login.html', null, LoginController.ready);
					}
				});
			} else {
				$('#everything').load('login.html', null, LoginController.ready);
			}
		}, 500);
	},
	login_facebook: function() {
		FB.login(function(response) {
			if (response.authResponse) {
				localStorage.hasLoggedOut = false;
				window.TelepatInstance.user.loginWithFacebook(response.authResponse.accessToken);
				window.TelepatInstance.on('login', function() {
					ChatController.render();
				});
			}
		}, {
			scope: 'public_profile,email,user_about_me,user_friends'
		});
	},
	ready: function() {
		LoginController.login_button = $('#login_btn');
		LoginController.login_button.on('click', LoginController.login_facebook);
	}
};
