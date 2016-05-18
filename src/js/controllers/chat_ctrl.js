var ChatController = {
	render: function() {
		$(document.body).addClass('chat');
		$('#everything').load('chat.html', null, ChatController.ready);
	},
	getUsers: function() {
		ChatController.usersChannel = TelepatInstance.subscribe({
			channel: {
				model: 'user'
			},
			sort: {
				name: 'asc'
			}
		}, function() {
			ChatController.updateUserList();

			ChatController.usersChannel.on('update', function(opType, userId, object) {
				ChatController.insertUser(object);
			});
		});

	},
	updateUserList: function() {
		if (Object.keys(ChatController.usersChannel.objects).length) {
			for(var userId in ChatController.usersChannel.objects) {
				if (userId !== TelepatInstance.user.id)
					ChatController.insertUser(ChatController.usersChannel.objects[userId]);
			}
		}
	},
	insertUser: function(user) {
		$('#no_contacts_online').addClass('hideit');
		$('#user_list').removeClass('hideit');

		var listItem = document.createElement('li');
		listItem.className = 'user_element';
		listItem.dataset.id = user.id;
		listItem.dataset.name = user.name;
		listItem.dataset.picture = user.picture;

		listItem.addEventListener('click', ChatController.initChat);

		var userImage = document.createElement('img');
		userImage.src = user.picture;
		userImage.alt = 'User avatar';
		userImage.classList = 'user_avatar';

		var userName = document.createElement('span');
		userName.classList = 'user_name';
		userName.innerHTML = user.name.split(' ')[0]+' ';

		var boldName = document.createElement('strong');
		boldName.innerHTML = user.name.split(' ')[1];
		userName.appendChild(boldName);

		listItem.appendChild(userImage);
		listItem.appendChild(userName);

		$('#user_list > ul').append(listItem);
	},
	initChat: function(event) {
		var element = null;

		for(var i = 0; i < event.path.length; i++) {
			if (event.path[i].constructor.name == 'HTMLLIElement') {
				element = event.path[i];
				break;
			}
		}

		$('.selected').removeClass('selected');
		element.classList += ' selected';

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

			ChatController.MessagesChannel.unsubscribe();
			delete ChatController.MessagesChannel;
		}

		ChatController.recipient = element.dataset;

		TasksController.subscribeMyTasks();
		TasksController.subscribeTheirTasks();

		var chatroomId = null;

		for(var objectId in ChatController.ChatroomChannel.objects) {
			var p1 = ChatController.ChatroomChannel.objects[objectId].participant_1;
			var p2 = ChatController.ChatroomChannel.objects[objectId].participant_2;

			if ((p1 == ChatController.recipient.id || p2 == ChatController.recipient.id) &&
				(p1 == TelepatInstance.user.id || p2 == TelepatInstance.user.id)) {
				chatroomId = ChatController.ChatroomChannel.objects[objectId].id;
			}
		}

		if (chatroomId !== null) {
			ChatController.subscribeChatMessages(chatroomId);
			ChatController.currentChatroom = ChatController.ChatroomChannel.objects[chatroomId];
		} else {
			ChatController.ChatroomChannel.objects['new'] = {
				participant_1: TelepatInstance.user.id,
				participant_2: ChatController.recipient.id,
				context_id: TelepatConfig.contextId
			};
		}
	},
	subscribeChatrooms: function() {
		ChatController.ChatroomChannel = TelepatInstance.subscribe({
			channel: {
				model: 'chatroom',
				context: TelepatConfig.contextId
			},
			filters: {
				or: [
					{
						is: {
							participant_1: TelepatInstance.user.id,
							participant_2: TelepatInstance.user.id
						}
					}
				]
			}
		});
		ChatController.ChatroomChannel.on('update', function(opType, id, object, patch) {
				if (ChatController.recipient && (object.participant_1 == ChatController.recipient.id || object.participant_2 == ChatController.recipient.id))	{
					if (opType == 'add') {
						ChatController.subscribeChatMessages(id);
						ChatController.currentChatroom = ChatController.ChatroomChannel.objects[id];
					} else if (opType == 'replace') {
						var isTypingField = ChatController.currentChatroom.user_id == TelepatInstance.user.id ? 'recipient_is_typing' : 'sender_is_typing';

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
	subscribeChatMessages: function(chatroomId) {
		chatroomId = chatroomId || null;

		if (!chatroomId)
			for(var objectId in ChatController.ChatroomChannel.objects) {
				if (ChatController.ChatroomChannel.objects[objectId].participant_1 == TelepatInstance.user.id ||
						ChatController.ChatroomChannel.objects[objectId].participant_2 == TelepatInstance.user.id) {
					chatroomId = ChatController.ChatroomChannel.objects[objectId].id;
				}
			}

		ChatController.MessagesChannel = TelepatInstance.subscribe({
			channel: {
				model: 'messages',
				parent: {
					model: 'chatroom',
					id: chatroomId
				}
			},
			sort: {
				created: 'asc'
			}
		}, function() {
			for(var msgId in ChatController.MessagesChannel.objects) {
				if (ChatController.MessagesChannel.objects[msgId].user_id == TelepatInstance.user.id)
					ChatController.insertFromMessage(ChatController.MessagesChannel.objects[msgId]);
				else
					ChatController.insertToMessage(ChatController.MessagesChannel.objects[msgId]);
			}
		});

		ChatController.MessagesChannel.on('update', function(opType, id, message, patch) {
			if (opType == 'add') {
				if (message.user_id == TelepatInstance.user.id)	{
					ChatController.insertFromMessage(message);
				}
				else {
					ChatController.MessagesChannel.objects[id].received = true;
					ChatController.insertToMessage(message);

					if (document.activeElement.parentElement.id == 'message_input_container') {
						ChatController.MessagesChannel.objects[ChatController.lastHisMessageId].seen = true;
					}
				}
			} else if (opType == 'replace') {
				if (patch.path == 'received' && ChatController.MessagesChannel.objects[id].user_id == TelepatInstance.user.id)
					ChatController.setMessageDelivered(id);
				else if (patch.path == 'seen' && ChatController.MessagesChannel.objects[id].user_id == TelepatInstance.user.id) {
					ChatController.setSeen();
				}
			}
		});
	},
	sendMessage: function() {
		var textMessage = $('#message_input_container > input')[0].value.trim();

		if (textMessage) {
			ChatController.MessagesChannel.objects['new'] = {
				text: textMessage,
				recipient_id: ChatController.recipient.id,
				context_id: TelepatConfig.contextId,
				chatroom_id: ChatController.currentChatroom.id
			}
		}

		$('#message_input_container > input')[0].value = '';
	},
	insertToMessage: function(message) {
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
		messageContainer.classList = 'message_to';
		messageContainer.id = message.id;

		var chatBubble = document.createElement('div');
		chatBubble.classList = 'chat_bubble_to';

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
			userImage.classList = 'message_user_avatar_to';
			messageContainer.appendChild(userImage);

			var chatTailImg = document.createElement('img');
			chatTailImg.src = 'assets/chat_bg_green.png';
			chatTailImg.alt = 'chat bubble tail';
			chatTailImg.classList = 'chat_tail_to';
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
		messageContainer.classList = 'message_from';
		messageContainer.id = message.id;

		var chatBubble = document.createElement('div');
		chatBubble.classList = 'chat_bubble_from';

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
			userImage.src = TelepatInstance.user.picture;
			userImage.alt = 'user avatar';
			userImage.classList = 'message_user_avatar_from';
			messageContainer.appendChild(userImage);

			var chatTailImg = document.createElement('img');
			chatTailImg.src = 'assets/chat_bg_blue.png';
			chatTailImg.alt = 'chat bubble tail';
			chatTailImg.classList = 'chat_tail_from';
			messageContainer.appendChild(chatTailImg);
		}

		messageContainer.appendChild(chatBubble);
		chatContainer.append(messageContainer);
		chatContainer[0].scrollTop = chatContainer[0].scrollHeight;
		ChatController.messagesFromLock = false;
	},
	sendIsTyping: function() {
		var isTypingField = ChatController.currentChatroom.user_id == TelepatInstance.user.id ? 'sender_is_typing' : 'recipient_is_typing';
		ChatController.ChatroomChannel.objects[ChatController.currentChatroom.id][isTypingField] = true;
	},
	clearIsTyping: function() {
		var isTypingField = ChatController.currentChatroom.user_id == TelepatInstance.user.id ? 'sender_is_typing' : 'recipient_is_typing';
		ChatController.ChatroomChannel.objects[ChatController.currentChatroom.id][isTypingField] = false;
		ChatController.isTypingTimeout = null;
	},
	setMessageDelivered: function(msgId) {
		$('.message_delivered').remove();
		var deliveredContainer = document.createElement('div');
		deliveredContainer.classList = 'message_delivered';

		var deliveredSpan = document.createElement('span');
		deliveredSpan.textContent = 'Delivered';

		deliveredContainer.appendChild(deliveredSpan);

		$('#'+msgId).append(deliveredContainer);

		var chatContainer = $('#chat_messages');
		chatContainer[0].scrollTop = chatContainer[0].scrollHeight;
	},
	setSeen: function() {
		$('.message_delivered > span').text('Seen');
	},
	messagesToLock: false,
	messagesFromLock: false,
	isTypingTimeout: null,
	currentChatroom: null,
	lastOwnMessageId: null,
	lastHisMessageId: null,
	ready: function() {
		$('#send_msg_button').on('click', ChatController.sendMessage);
		$('#message_input_container > input').on('keypress', function(event) {
			if (event.which == 13) {
				ChatController.sendMessage();
			}
			if (ChatController.isTypingTimeout) {
				clearTimeout(ChatController.isTypingTimeout);
			} else {
				ChatController.sendIsTyping();
			}

			ChatController.isTypingTimeout = setTimeout(ChatController.clearIsTyping, 1000);
		}).on('focus', function() {
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