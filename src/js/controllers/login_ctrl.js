window.fbAsyncInit = function() {
	FB.init({
		appId   : TelepatConfig.facebookAppId,
		oauth   : true,
		status  : true, // check login status
		cookie  : true, // enable cookies to allow the server to access the session
		xfbml   : true, // parse XFBML
		version : 'v2.6'
	});
};
var LoginController = {
	/**
	 * This function renders the login html fragment if the user isn't logged in with FB yet (or the session has
	 * expired)
	 */
	render: function() {
		window.fbAsyncInit();
		//after logging in, the chat interface is rendered
		window.TelepatInstance.on('login', function() {
			ChatController.render();
		});

		window.TelepatInstance.on('logout', function() {
			$('#everything').load('login.html', null, LoginController.ready);
		});
						
		if (localStorage.hasLoggedOut == undefined || localStorage.hasLoggedOut == 'false') {
			if (window.TelepatInstance.user.canReauth) {
				window.TelepatInstance.user.reauth();
			} else {
				FB.getLoginStatus(function(response) {
					if (response.status === 'connected') {
						localStorage.hasLoggedOut = false;
						//Logs the user into Telepat using FB credentials (access_token)
						window.TelepatInstance.user.loginWithFacebook(response.authResponse.accessToken);
					} else {
						$('#everything').load('login.html', null, LoginController.ready);
					}
				});
			}
		} else {
			$('#everything').load('login.html', null, LoginController.ready);
		}
	},
	/**
	 * Function attached to the click event on the main Login button
	 */
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
	/**
	 * Function called after the login html fragment has been loaded
	 */
	ready: function() {
		LoginController.login_button = $('#login_btn');
		LoginController.login_button.on('click', LoginController.login_facebook);
	}
};
