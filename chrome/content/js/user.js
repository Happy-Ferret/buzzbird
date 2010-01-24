/*
Copyright (c) 2009 Mike Desjardins

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

function onOk() {
	return true;
}

function userOnLoad() {
	// var scrollable=document.getElementById('user-browser').docShell.QueryInterface(Components.interfaces.nsIScrollable);
	// alert(scrollable.GetVisible);
	var params = window.arguments[0];
	var user_id = params.userId;
	var username = params.username;
	var password = params.password;
	browser = document.getElementById('user-browser');
	browser.contentDocument.getElementById('myUsername').value = username;
	browser.contentDocument.getElementById('myPassword').value = password;
	browser.contentDocument.getElementById('hisUserId').value = user_id;
	window.resizeTo(450,180);
	fetchProfile(user_id,username,password);
}

function fetchProfile(userid,username,password) {
	jsdump('Getting profile for user ' + userid);
	url = 'http://twitter.com/users/show/' + userid + '.json';
	new Ajax.Request(url,
		{
			method:'get',
			httpUserName: username,
			httpPassword: password,
			onSuccess: function(transport) { 
				var profile = eval('(' + transport.responseText + ')');
				document.getElementById('name').value = '(' + profile.name + ')';
				document.getElementById('username').value = profile.screen_name
				document.getElementById('avatar').src = profile.profile_image_url;
				document.getElementById('followstats').value = 'Following: ' + profile.friends_count + ', Followers: ' + profile.followers_count; 
				document.getElementById('location').value = profile.location;
				document.getElementById('homepage').value = profile.url;
				document.getElementById('bio').value = profile.description;
				if (profile.protected == true && typeof(profile.status) == "undefined") {
					browser = document.getElementById('user-browser');
					browser.contentDocument.getElementById('shy-user').style.display='inline';
					document.getElementById('friendship').disabled = true;
					//document.getElementById('fetch-throb').style.display='none';
					window.content.document.getElementById('fetch-throb').style.display='none';
				} else {
					fetchTweets(userid,username,password); 
				}
			},
			onFailure: function(transport) { 
					jsdump('Failed to get tweets for user.');
					jsdump('status=' + transport.status)
					var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					                        .getService(Components.interfaces.nsIPromptService);
					if (transport.status==404) {
						prompts.alert(window, "Hmph.", "That user doesn't seem to exist.");
					} else {
						prompts.alert(window, "Hmph.", "There was an error processing this request.");
					}
					getMainWindow().document.getElementById('user-dialog').acceptDialog();
			}
		});		
}

function fetchTweets(userid,username,password) {
	jsdump('Getting tweets for user ' + userid);
	url = 'http://twitter.com/statuses/user_timeline/' + userid + '.json';
	new Ajax.Request(url,
		{
			method:'get',
			httpUserName: username,
			httpPassword: password,
			onSuccess: function(transport) { fetchTweetsCallback(transport,username,password); },
			onFailure: function(transport) { 
					jsdump('Failed to get tweets for user.');
					jsdump('status=' + transport.status)
					var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					                        .getService(Components.interfaces.nsIPromptService);
					if (transport.status==404) {
						prompts.alert(window, "Hmph.", "That user doesn't seem to exist.");
					} else {
						prompts.alert(window, "Hmph.", "There was an error processing this request.");
					}
					getMainWindow().document.getElementById('user-dialog').acceptDialog();
			}
		});		
}

function fetchTweetsCallback(transport,username,password) {
	var newTweets = eval('(' + transport.responseText + ')');
	jsdump('renderNewTweets, length: ' +newTweets.length+ ', for ' + url);
	if (newTweets.length == 0) {
		jsdump('renderNewTweets: Nothing to do, skipping.');
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		                        .getService(Components.interfaces.nsIPromptService);
		jsdump('got prompts');
		prompts.alert(window, "Hmph.", "That user doesn't seem to exist, or hasn't tweeted yet.");
		getMainWindow().document.getElementById('user-dialog').acceptDialog();
	} else {
		var newText = '';
		for (var i=newTweets.length-1; i>=0; i--) {
			newText = formatTweet(newTweets[i],username,password) + newText;
			if (i==0) {
				browser = document.getElementById('user-browser');
				browser.contentDocument.getElementById('hisUsername').value = username;
			}
		}
		var parser = new DOMParser();
		var doc = parser.parseFromString('<div xmlns="http://www.w3.org/1999/xhtml"><div id="foo">' + newText + '</div></div>', 'application/xhtml+xml');
		if (doc.documentElement.nodeName != "parsererror" ) {
			var root = doc.documentElement;
			for (var j=0; j<root.childNodes.length; ++j) {
				window.content.document.body.insertBefore(document.importNode(root.childNodes[j], true),window.content.document.body.lastChild);
			}
		} else {
			jsdump("Couldn't render the tweet.");
		}
	}
	window.content.document.getElementById('fetch-throb').style.display='none';
	this.updateTimestamps();
}

function goToProfile() {
	var username = document.getElementById('username').value;
	linkTo('http://twitter.com/' + username);
}

function goToAvatar() {
	var username = document.getElementById('username').value;
	linkTo('http://twitter.com/account/profile_image/' + username);
}

function updateTimestamps() {
	var ONE_SECOND = 1000;
	var ONE_MINUTE = 60 * ONE_SECOND;
	var ONE_HOUR = 60 * ONE_MINUTE;
	var ONE_DAY = 24 * ONE_HOUR;
	
	var timestamps = window.content.document.getElementsByName('timestamp');
	var now = new Date();
	for (var i=0; i<timestamps.length; i++) {
		tweetid = timestamps[i].id;
		when = window.content.document.getElementById(tweetid).innerHTML;
		var then = new Date(parseFloat(when));
		var delta = now - then;
		var prettyWhen = "less than 1m ago";
		if (delta > ONE_MINUTE && delta < ONE_HOUR) {
			// between 1m and 59m, inclusive
			var prettyWhen = "about " + parseInt(delta/ONE_MINUTE) + "m ago"
		} else  if (delta >= ONE_HOUR && delta < ONE_DAY) {
			// less than 24h ago
			var prettyWhen = "about " + parseInt(delta/ONE_HOUR) + "h " + parseInt((delta%ONE_HOUR)/ONE_MINUTE) + "m ago"
		} else if (delta >= ONE_DAY) {
			var prettyWhen = "more than " + parseInt(delta/(ONE_DAY)) + "d ago";
		}
		var elid = 'prettytime-' + tweetid.substring(tweetid.indexOf('-')+1);
		el = window.content.document.getElementById(elid)
		if (el) {
		  el.innerHTML = prettyWhen;
		}
	}
}

function launchFriendship() {
	var features = "chrome,titlebar,toolbar,centerscreen,modal,scrollbars=yes";
	var browser = document.getElementById('user-browser');
	var username = browser.contentDocument.getElementById('myUsername').value;
	var password = browser.contentDocument.getElementById('myPassword').value;
	var hisUserId = browser.contentDocument.getElementById('hisUserId').value;
	var hisUsername = browser.contentDocument.getElementById('hisUsername').value;
	getMainWindow().arguments[0].out = {'action':'friend', 'hisUserId':hisUserId, 'hisUsername': hisUsername/*, 'username':'''', 'password':password*/}
	jsdump('arguments out =' + 	getMainWindow().arguments[0].out)
	jsdump('arguments out action =' + 	getMainWindow().arguments[0].out.action)
	jsdump('arguments out userId =' + 	getMainWindow().arguments[0].out.hisUserId)
	getMainWindow().document.getElementById('user-dialog').acceptDialog();
	//window.openDialog("chrome://buzzbird/content/friendship.xul", "", features, params);
}

function goToHomepage() {
	linkTo(document.getElementById('homepage').value);
}

function linkTo(href) {
	jsdump('Opening ' + href);
	var ioservice = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
	var uriToOpen = ioservice.newURI(href, null, null);
	var extps = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].getService(Components.interfaces.nsIExternalProtocolService);
	extps.loadURI(uriToOpen, null);	
}
