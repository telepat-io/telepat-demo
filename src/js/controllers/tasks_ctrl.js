var TasksController = {
	/**
	 * Renders the html fragment which contains the tasks pane
	 */
	render: function() {
		$('#tasks').load('tasks.html', null, TasksController.ready);
	},
	/**
	 * Subscribes to the tasks that the recipient has created for me
	 */
	subscribeMyTasks: function() {
		//when we click on another user, need to unsubscribe to this channel and resubscribe to another one
		if (TasksController.MyTasksChannel) {
			$('.task_container').empty();
			TasksController.MyTasksChannel.unsubscribe();
		}

		TasksController.MyTasksChannel = TelepatInstance.subscribe({
			channel: {
				model: 'tasks',
				context: TelepatConfig.contextId
			},
			filters: {
				and: [
					{
						is: {
							user_id: ChatController.recipient.id,
							recipient_id: TelepatInstance.user.id
						}
					}
				]
			}
		}, function() {
			for(var id in TasksController.MyTasksChannel.objects) {
				var task = TasksController.MyTasksChannel.objects[id];

				TasksController.insertTask(task, 'from');
			}

			TasksController.MyTasksChannel.on('update', function(opType, id, object, patch) {
				if (opType == 'replace') {
					//this happens when we click on the completed checkbox
					if (patch.path == 'completed') {
						$('.task[data-id="'+id+'"] > .checkbox')[0].src = 'assets/check_mark_filled_green.png';
						$('.task[data-id="'+id+'"] > span').addClass('completed');
					}
				} else if (opType == 'add') {
					TasksController.insertTask(object, 'from');
				//when tasks are deleted
				} else if (opType == 'delete') {
					$('.task[data-id="'+id+'"]').remove();
				}
			});
		});
	},
	/**
	 * Subscribe to tasks created by us for them
	 */
	subscribeTheirTasks: function() {
		//when we click on another user, need to unsubscribe to this channel and resubscribe to another one
		if (TasksController.TheirTasksChannel)
			TasksController.TheirTasksChannel.unsubscribe();

		TasksController.TheirTasksChannel = TelepatInstance.subscribe({
			channel: {
				model: 'tasks',
				context: TelepatConfig.contextId
			},
			filters: {
				and: [
					{
						is: {
							user_id: TelepatInstance.user.id,
							recipient_id: ChatController.recipient.id
						}
					}
				]
			}
		}, function() {
			for(var id in TasksController.TheirTasksChannel.objects) {
				var task = TasksController.TheirTasksChannel.objects[id];

				TasksController.insertTask(task, 'to');
			}

			TasksController.TheirTasksChannel.on('update', function(opType, id, object, patch) {
				if (opType == 'replace') {
					if (patch.path == 'completed') {
						$('.task[data-id="'+id+'"] > .checkbox')[0].src = 'assets/check_mark_filled_green.png';
						$('.task[data-id="'+id+'"] > span').addClass('completed');
					}
				} else if (opType == 'add') {
					TasksController.insertTask(object, 'to');
				} else if (opType == 'delete') {
					$('.task[data-id="'+id+'"]').remove();
				}
			});
		});
	},
	/**
	 * Inserts a task in the DOM
	 * @param {Object} task
	 * @param {string} task.id
	 * @param {string} task.user_id
	 * @param {Boolean} task.completed
	 * @param {string} where 'from' or 'to' Decides if the task is ours or theirs
	 */
	insertTask: function(task, where) {
		var container = $('#tasks_'+where+' > .task_container');

		var taskContainer = document.createElement('div');
		taskContainer.classList = 'task';
		taskContainer.dataset.id = task.id;

		var checkboxImg = document.createElement('img');
		checkboxImg.src = task.completed ? (task.user_id == TelepatInstance.user.id ?
			'assets/check_mark_filled_blue.png' : 'assets/check_mark_filled_green.png') : 'assets/check_mark_empty.png';
		checkboxImg.alt = 'checkbox';
		checkboxImg.classList = 'checkbox';

		if (task.user_id != TelepatInstance.user.id)
			$(checkboxImg).one('click', TasksController.completeTask);

		var textSpan = document.createElement('span');
		textSpan.innerHTML = task.text;

		if (task.completed)
			textSpan.classList = 'completed';

		var closeButton = document.createElement('button');
		closeButton.classList = 'close-task';
		closeButton.addEventListener('click', TasksController.removeTask);

		taskContainer.appendChild(checkboxImg);
		taskContainer.appendChild(textSpan);
		taskContainer.appendChild(closeButton);
		container.append(taskContainer);
	},
	/**
	 * Fired when we click on the remove button on the task
	 * @param {MouseEvent} event
	 */
	removeTask: function(event) {
		var id = $(event.target).parent()[0].dataset.id;

		//to send a delete request to telepat we just delete the property {object_id} from the objects
		if (TasksController.MyTasksChannel.objects[id])
			delete TasksController.MyTasksChannel.objects[id];
		else
			delete TasksController.TheirTasksChannel.objects[id];
	},
	/**
	 * Sends a create request to telepat with the new task
	 */
	createTask: function() {
		var taskText = $('#new_task_container > input')[0].value.trim();

		if (taskText) {
			TasksController.TheirTasksChannel.objects['new'] = {
				text: taskText,
				completed: false,
				recipient_id: ChatController.recipient.id
			};
		}

		$('#new_task_container > input')[0].value = '';
	},
	/**
	 * Fired when we click on the complete checkbox
	 * @param {MouseEvent} event
	 */
	completeTask: function(event) {
		var id = $(event.target).parent()[0].dataset.id;

		TasksController.MyTasksChannel.objects[id].completed = true;
	},
	/**
	 * Called after loading the html fragment
	 */
	ready: function() {
		$('#add_task_btn').on('click', TasksController.createTask);
		$('#new_task_container > input').on('keypress', function(event) {
			if (event.which == 13)
				TasksController.createTask();
		});
	}
};