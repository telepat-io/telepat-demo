var ChatController = {
	/**
	 * Renders the chat html fragment which includes the user list pane and the chat pane
	 */
	render: function() {
		$(document.body).addClass('chat');
		$('#everything').load('chat.html', null, ChatController.ready);
	},
	/**
	 * Subscribes to the "all users channel"
	 */
	getUsers: function() {
		//this object will contain all the users retrieved from the initial subscribe
		ChatController.usersChannel = TelepatInstance.subscribe({
			channel: {
				model: 'user'
			},
			sort: {
				name: 'asc'
			}
		}, function() {
			ChatController.updateUserList();

			//you will be notified for every user changes
			ChatController.usersChannel.on('update', function(opType, userId, object) {
				if(opType == 'add')
					ChatController.insertUser(object);
			});
		});

	},
	/**
	 * updates the view with the user list
	 */
	updateUserList: function() {
		if (Object.keys(ChatController.usersChannel.objects).length) {
			for(var userId in ChatController.usersChannel.objects) {
				if (userId !== TelepatInstance.user.data.id)
					ChatController.insertUser(ChatController.usersChannel.objects[userId]);
			}
		}
	},
	/**
	 * Inserts a user in the DOM
	 * @param {Object} user
	 * @param {string} user.id
	 * @param {string} user.name
	 * @param {string} user.picture
	 */
	insertUser: function(user) {
		$('#no_contacts_online').addClass('hideit');
		$('#user_list').removeClass('hideit');

		var listItem = document.createElement('li');
		listItem.className = 'user_element';
		listItem.dataset.id = user.id;
		listItem.dataset.name = user.name || (user.firstName + ' ' + user.lastName);
		listItem.dataset.picture = user.picture;

		$(listItem).on('click', function() { ChatController.initChat(listItem) });

		var userImage = document.createElement('img');
		userImage.src = user.picture;
		userImage.alt = 'User avatar';
		$(userImage).addClass('user_avatar');

		var userName = document.createElement('span');
		$(userName).addClass('user_name');
		userName.innerHTML = user.name ? (user.name.split(' ')[0]+' ') : (user.firstName+' ');

		var boldName = document.createElement('strong');
		boldName.innerHTML = user.name ? user.name.split(' ')[1] : user.lastName;
		userName.appendChild(boldName);

		listItem.appendChild(userImage);
		listItem.appendChild(userName);

		$('#user_list > ul').append(listItem);
	},
	/**
	 * Called each time we click on an user in the user list
	 * @param {MouseEvent} event
	 */
	initChat: function(element) {
		$('.selected').removeClass('selected');
		$(element).addClass('selected');

		//first click, no click on the user was registered before this
		if (!ChatController.recipient) {
			$('#no_chat').addClass('hideit');
			$('#chat_header').removeClass('hideit').html('<span>Chat with <strong>'+element.dataset.name.split(' ')[0]+'</strong></span>');
			$('#chat_messages').removeClass('hideit');
			$('#message_input_container').removeClass('hideit');
			$('#tasks_from > .tasks_header').html('<span>Tasks from <strong>'+element.dataset.name.split(' ')[0]+'</strong></span>').removeClass('hideit');
			$('#tasks_to > .tasks_header').html('<span>Tasks for <strong>'+element.dataset.name.split(' ')[0]+'</strong></span>').removeClass('hideit');
			$('.no_tasks').addClass('hideit');
			$('#new_task_container').removeClass('hideit');
			$('.task_container').removeClass('hideit');
		} else {
			$('#tasks_from > .tasks_header').html('<span>Tasks from <strong>'+element.dataset.name.split(' ')[0]+'</strong></span>');
			$('#tasks_to > .tasks_header').html('<span>Tasks for <strong>'+element.dataset.name.split(' ')[0]+'</strong></span>');
			$('#chat_header').html('<span>Chat with <strong>'+element.dataset.name.split(' ')[0]+'</strong></span>');
			$('#chat_messages').empty();
			$('#message_input_container > input')[0].value = '';

			/*when we change the discussion with another user we have to unsubscribe from the current Messages Channel
			 since we can't talk with multiple people at once so there's no need for multiple message channels
			 */
			ChatController.MessagesChannel.unsubscribe();
			delete ChatController.MessagesChannel;
		}

		//contains id,name,picture
		ChatController.recipient = element.dataset;

		TasksController.subscribeTasks('MyTasksChannel');
		TasksController.subscribeTasks('TheirTasksChannel');

		var chatroomId = null;

		/*find the chatroom for which we are either participant_1 or 2 and the recipient is either the 2nd or 1st who
		 who created the chatroom
		 */
		for(var objectId in ChatController.ChatroomChannel.objects) {
			var p1 = ChatController.ChatroomChannel.objects[objectId].participant_1;
			var p2 = ChatController.ChatroomChannel.objects[objectId].participant_2;

			if ((p1 == ChatController.recipient.id || p2 == ChatController.recipient.id) &&
					(p1 == TelepatInstance.user.data.id || p2 == TelepatInstance.user.data.id)) {
				chatroomId = ChatController.ChatroomChannel.objects[objectId].id;
			}
		}

		//if the chatroom exists we can continue subscribing to its messages
		if (chatroomId !== null) {
			ChatController.subscribeChatMessages(chatroomId);
			ChatController.currentChatroom = ChatController.ChatroomChannel.objects[chatroomId];
		} else {
			//there's no chatroom with these two people, we need to create the chatroom
			ChatController.ChatroomChannel.objects['new'] = {
				participant_1: TelepatInstance.user.data.id,
				participant_2: ChatController.recipient.id,
				context_id: TelepatConfig.collectionId
			};
		}
	},
	/**
	 * Subscribe to chatrooms so we know where the messare are contained when starting a conversation
	 */
	subscribeChatrooms: function() {
		ChatController.ChatroomChannel = TelepatInstance.subscribe({
			channel: {
				model: 'chatroom',
				context: TelepatConfig.collectionId
			},
			filters: {
				or: [
					{
						is: {
							participant_1: TelepatInstance.user.data.id,
						}
					},
					{
						is: {
							participant_2: TelepatInstance.user.data.id,
						}
					}
				]
			}
		});
		ChatController.ChatroomChannel.on('update', function(opType, id, object, patch) {
			//we're only interested in the chatrooms where I am a participant
			if (ChatController.recipient && (object.participant_1 == ChatController.recipient.id || object.participant_2 == ChatController.recipient.id))	{
				if (opType == 'add') {
					ChatController.subscribeChatMessages(id);
					ChatController.currentChatroom = ChatController.ChatroomChannel.objects[id];
				} else if (opType == 'replace') {
					//changes on this field name indicate when the other user is typing
					var isTypingField = ChatController.currentChatroom.user_id == TelepatInstance.user.data.id ? 'recipient_is_typing' : 'sender_is_typing';

					if (isTypingField == patch.path) {
						if (ChatController.ChatroomChannel.objects[id][patch.path] == true) {
							var container = $('#chat_messages');

							var indicatorDiv = document.createElement('div');
							indicatorDiv.id = 'is_typing_indicator';

							var indicatorImg = document.createElement('img');
							indicatorImg.src = 'assets/dot.png';
							indicatorImg.alt = 'is typing indicator dot';

							indicatorDiv.appendChild(indicatorImg);
							indicatorDiv.appendChild(indicatorImg.cloneNode(false));
							indicatorDiv.appendChild(indicatorImg.cloneNode(false));

							container.append(indicatorDiv);
							container[0].scrollTop = container[0].scrollHeight;
						}
						else if (ChatController.ChatroomChannel.objects[id][patch.path] == false) {
							$('#is_typing_indicator').remove();
						}
					}
				}
			}
		});
	},
	/**
	 * Subscribe to the chatroom's messages
	 * @param {string} chatroomId
	 */
	subscribeChatMessages: function(chatroomId) {
		chatroomId = chatroomId || null;

		if (!chatroomId)
			for(var objectId in ChatController.ChatroomChannel.objects) {
				if (ChatController.ChatroomChannel.objects[objectId].participant_1 == TelepatInstance.user.data.id ||
						ChatController.ChatroomChannel.objects[objectId].participant_2 == TelepatInstance.user.data.id) {
					chatroomId = ChatController.ChatroomChannel.objects[objectId].id;
				}
			}

		ChatController.MessagesChannel = TelepatInstance.subscribe({
			channel: {
				model: 'message',
				parent: {
					model: 'chatroom',
					id: chatroomId
				}
			},
			sort: {
				created: 'asc'
			}
		}, function() {
			//inserting messages into the DOM from the initial subscribe
			for(var msgId in ChatController.MessagesChannel.objects) {
				if (ChatController.MessagesChannel.objects[msgId].user_id == TelepatInstance.user.data.id)
					ChatController.insertFromMessage(ChatController.MessagesChannel.objects[msgId]);
				else
					ChatController.insertToMessage(ChatController.MessagesChannel.objects[msgId]);
			}
		});

		ChatController.MessagesChannel.on('update', function(opType, id, message, patch) {
			if (opType == 'add') {
				//if it's my message
				if (message.user_id == TelepatInstance.user.data.id)	{
					ChatController.insertFromMessage(message);
				} //otherwise it's his/hers message
				else {
					//this is how we send an update on the object, this tells the other participant the message has been
					//received by him
					ChatController.MessagesChannel.objects[id].received = true;
					ChatController.insertToMessage(message);

					//also if the input message element is in focus we set the message as seen
					if (document.activeElement.parentElement.id == 'message_input_container') {
						ChatController.MessagesChannel.objects[ChatController.lastHisMessageId].seen = true;
					}
				}
			} else if (opType == 'replace') {
				//this is how we capture the 'received' and 'seen' changes on each message
				if (patch.path == 'received' && ChatController.MessagesChannel.objects[id].user_id == TelepatInstance.user.data.id)
					ChatController.setMessageDelivered(id);
				else if (patch.path == 'seen' && ChatController.MessagesChannel.objects[id].user_id == TelepatInstance.user.data.id) {
					ChatController.setSeen();
				}
			}
		});
	},
	/**
	 * Sends a message to telepat containing the thext from the input element
	 */
	sendMessage: function() {
		var textMessage = $('#message_input_container > input')[0].value.trim();

		if (textMessage) {
			ChatController.MessagesChannel.objects['new'] = {
				text: textMessage,
				recipient_id: ChatController.recipient.id,
				context_id: TelepatConfig.collectionId,
				chatroom_id: ChatController.currentChatroom.id
			}
		}

		$('#message_input_container > input')[0].value = '';
	},
	/**
	 * Inserts a message received by the other participant
	 * @param {Object} message
	 * @param {string} message.id
	 * @param {string} message.text
	 * @param {string} message.user_id
	 * @param {string} message.recipient_id
	 * @param {boolean} message.seen
	 * @param {boolean} message.received
	 */
	insertToMessage: function(message) {
		//this is necessary in order to fix a bug with the order the DOM elements are appended in the chat pane
		if (ChatController.messagesToLock) {
			setTimeout(function() {
				ChatController.insertToMessage(message);
			}, 10);

			return;
		}

		ChatController.lastHisMessageId = message.id;

		ChatController.messagesToLock = true;
		var chatContainer = $('#chat_messages');

		var messageContainer = document.createElement('div');
		$(messageContainer).addClass('message_to');
		messageContainer.id = message.id;

		var chatBubble = document.createElement('div');
		$(chatBubble).addClass('chat_bubble_to');

		var textSpan = document.createElement('span');
		textSpan.innerHTML = message.text;
		chatBubble.appendChild(textSpan);

		var lastChild = $('#chat_messages > div.message_to').last();

		if (lastChild && lastChild.hasClass('message_to')) {
			lastChild.addClass('repeated_to');
			messageContainer.appendChild($('.message_user_avatar_to').remove()[0]);
			messageContainer.appendChild($('.chat_tail_to').remove()[0]);
		} else {
			var userImage = document.createElement('img');
			userImage.src = ChatController.recipient.picture;
			userImage.alt = 'user avatar';
			$(userImage).addClass('message_user_avatar_to');
			messageContainer.appendChild(userImage);

			var chatTailImg = document.createElement('img');
			chatTailImg.src = 'assets/chat_bg_green.png';
			chatTailImg.alt = 'chat bubble tail';
			$(chatTailImg).addClass('chat_tail_to');
			messageContainer.appendChild(chatTailImg);
		}

		messageContainer.appendChild(chatBubble);
		var isTypingElement = $('#is_typing_indicator');

		if (isTypingElement.length)
			$('#is_typing_indicator').before(messageContainer);
		else
			chatContainer.append(messageContainer);

		chatContainer[0].scrollTop = chatContainer[0].scrollHeight;
		ChatController.messagesToLock = false;
	},
	/**
	 * Inserts a message received by me
	 * @param {Object} message
	 * @param {string} message.id
	 * @param {string} message.text
	 * @param {string} message.user_id
	 * @param {string} message.recipient_id
	 * @param {boolean} message.seen
	 * @param {boolean} message.received
	 */
	insertFromMessage: function(message) {
		if (ChatController.messagesFromLock) {
			setTimeout(function() {
				ChatController.insertFromMessage(message);
			}, 25);

			return;
		}

		ChatController.lastOwnMessageId = message.id;

		ChatController.messagesFromLock = true;
		var chatContainer = $('#chat_messages');

		var messageContainer = document.createElement('div');
		$(messageContainer).addClass('message_from');
		messageContainer.id = message.id;

		var chatBubble = document.createElement('div');
		$(chatBubble).addClass('chat_bubble_from');

		var textSpan = document.createElement('span');
		textSpan.innerHTML = message.text;
		chatBubble.appendChild(textSpan);

		var lastChild = $('#chat_messages > div.message_from').last();

		if (lastChild && lastChild.hasClass('message_from')) {
			lastChild.addClass('repeated');
			messageContainer.appendChild($('.message_user_avatar_from').first().remove()[0]);
			messageContainer.appendChild($('.chat_tail_from').first().remove()[0]);
		} else {
			var userImage = document.createElement('img');
			userImage.src = TelepatInstance.user.data.picture;
			userImage.alt = 'user avatar';
			$(userImage).addClass('message_user_avatar_from');
			messageContainer.appendChild(userImage);

			var chatTailImg = document.createElement('img');
			chatTailImg.src = 'assets/chat_bg_blue.png';
			chatTailImg.alt = 'chat bubble tail';
			$(chatTailImg).addClass('chat_tail_from');
			messageContainer.appendChild(chatTailImg);
		}

		messageContainer.appendChild(chatBubble);
		chatContainer.append(messageContainer);
		chatContainer[0].scrollTop = chatContainer[0].scrollHeight;
		ChatController.messagesFromLock = false;
	},
	/**
	 * sends the is typing property on the chatroom that tells when the other participant has started typing
	 */
	sendIsTyping: function() {
		var isTypingField = ChatController.currentChatroom.user_id == TelepatInstance.user.data.id ? 'sender_is_typing' : 'recipient_is_typing';
		ChatController.ChatroomChannel.objects[ChatController.currentChatroom.id][isTypingField] = true;
	},
	/**
	 * clears this flag when at least 1 second has passed since the last key pressed
	 */
	clearIsTyping: function() {
		var isTypingField = ChatController.currentChatroom.user_id == TelepatInstance.user.data.id ? 'sender_is_typing' : 'recipient_is_typing';
		ChatController.ChatroomChannel.objects[ChatController.currentChatroom.id][isTypingField] = false;
		ChatController.isTypingTimeout = null;
	},
	/**
	 * inserts the 'Delivered' text under the message
	 * @param {string} msgId
	 */
	setMessageDelivered: function(msgId) {
		$('.message_delivered').remove();
		var deliveredContainer = document.createElement('div');
		$(deliveredContainer).addClass('message_delivered');

		var deliveredSpan = document.createElement('span');
		deliveredSpan.textContent = 'Delivered';

		deliveredContainer.appendChild(deliveredSpan);

		$('#'+msgId).append(deliveredContainer);

		var chatContainer = $('#chat_messages');
		chatContainer[0].scrollTop = chatContainer[0].scrollHeight;
	},
	/**
	 * Changes the 'Delivered' text into 'Seen' (we always have 'Delivered' first)
	 */
	setSeen: function() {
		$('.message_delivered > span').text('Seen');
	},
	/**
	 * Message lock in order to fix a bug with the order the elements are appended in the DOM
	 */
	messagesToLock: false,
	/**
	 * Message lock in order to fix a bug with the order the elements are appended in the DOM
	 */
	messagesFromLock: false,
	/**
	 * Timeout ID
	 */
	isTypingTimeout: null,
	/**
	 *	The object of the current Chatroom
	 */
	currentChatroom: null,
	/**
	 * ID of the last message send by me
	 */
	lastOwnMessageId: null,
	/**
	 * ID of the last message by th other participant
	 */
	lastHisMessageId: null,
	/**
	 * Function called after the html fragment has been loaded
	 */
	ready: function() {
		$('#send_msg_button').on('click', ChatController.sendMessage);
		$('#message_input_container > input').on('keypress', function(event) {
			if (event.which == 13) {
				ChatController.sendMessage();
			}
			//if the user is typing and the timeout has already been set, we need to refresh it
			if (ChatController.isTypingTimeout) {
				clearTimeout(ChatController.isTypingTimeout);
			} else {
				ChatController.sendIsTyping();
			}

			ChatController.isTypingTimeout = setTimeout(ChatController.clearIsTyping, 3000);
		}).on('focus', function() {
			//when putting the input in focus we send the seen flag unless the last message already has it
			var message = ChatController.MessagesChannel.objects[ChatController.lastHisMessageId];
			if (message && !message.seen)
				ChatController.MessagesChannel.objects[ChatController.lastHisMessageId].seen = true;
		});
		ChatController.getUsers();
		ChatController.subscribeChatrooms();
		TasksController.render();
		$('#logout_btn').on('click', function() {
			localStorage.hasLoggedOut = true;
			location.reload();
		});
	}
};