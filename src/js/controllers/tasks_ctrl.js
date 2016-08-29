var TasksController = {
	/**
	 * Renders the html fragment which contains the tasks pane
	 */
	render: function() {
		$('#tasks').load('tasks.html', null, TasksController.ready);
	},
	/**
	 * Subscribes to the my tasks and his tasks
	 * @param {string} which Either MyTasksChannel or TheirTasksChannel
	 */
	subscribeTasks: function(which) {
		var where = which == 'MyTasksChannel' ? 'from' : 'to';

		//when we click on another user, need to unsubscribe to this channel and resubscribe to another one
		if (TasksController[which]) {
			$('.task_container').empty();
			TasksController[which].unsubscribe();
		}

		TasksController[which] = TelepatInstance.subscribe({
			channel: {
				model: 'task',
				context: TelepatConfig.collectionId
			},
			filters: {
				and: [
					{
						is: {
							user_id: where == 'from' ? ChatController.recipient.id : TelepatInstance.user.data.id,
						}
					},
					{
						is: {
							recipient_id: where == 'from' ? TelepatInstance.user.data.id : ChatController.recipient.id
						}
					}
				]
			}
		}, function() {
			for(var id in TasksController[which].objects) {
				var task = TasksController[which].objects[id];

				TasksController.insertTask(task, where);
			}

			TasksController[which].on('update', function(opType, id, object, patch) {
				if (opType == 'replace') {
					//this happens when we click on the completed checkbox
					if (patch.path == 'completed') {
						$('.task[data-id="'+id+'"] > .checkbox')[0].src = 'assets/check_mark_filled_green.png';
						$('.task[data-id="'+id+'"] > span').addClass('completed');
					}
				} else if (opType == 'add') {
					TasksController.insertTask(object, where);
				//when tasks are deleted
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
		$(taskContainer).addClass('task');
		taskContainer.dataset.id = task.id;

		var checkboxImg = document.createElement('img');
		checkboxImg.src = task.completed ? (task.user_id == TelepatInstance.user.data.id ?
			'assets/check_mark_filled_blue.png' : 'assets/check_mark_filled_green.png') : 'assets/check_mark_empty.png';
		checkboxImg.alt = 'checkbox';
		$(checkboxImg).addClass('checkbox');

		if (task.user_id != TelepatInstance.user.data.id) {
			$(checkboxImg).one('click', TasksController.completeTask);
		}

		var textSpan = document.createElement('span');
		textSpan.innerHTML = task.text;

		if (task.completed)
			$(textSpan).addClass('completed');

		var closeButton = document.createElement('button');
		$(closeButton).addClass('close-task');
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