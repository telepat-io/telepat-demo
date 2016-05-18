$(document).ready(function() {
	(function(d, s, id) {
		var js, fjs = d.getElementsByTagName(s)[0];
		if (d.getElementById(id)) return;
		js = d.createElement(s); js.id = id;
		js.src = "//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.6&appId=139957639697526";

		js.addEventListener('load', function() {
			window.TelepatInstance = new Telepat();
			window.TelepatInstance.setLogLevel('debug');
			window.TelepatInstance.connect(TelepatConfig);
			LoginController.render();
		});

		fjs.parentNode.insertBefore(js, fjs);
	}(document, 'script', 'facebook-jssdk'));
});