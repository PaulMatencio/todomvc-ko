/*global ko, Router */
(function () {
	'use strict';

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	// A factory function we can use to create binding handlers for specific
	// keycodes.
	function keyhandlerBindingFactory(keyCode) {
		return {
			init: function (element, valueAccessor, allBindingsAccessor, data, bindingContext) {
				var wrappedHandler, newValueAccessor;

				// wrap the handler with a check for the enter key
				wrappedHandler = function (data, event) {
					if (event.keyCode === keyCode) {
						valueAccessor().call(this, data, event);
					}
				};

				// create a valueAccessor with the options that we would want to pass to the event binding
				newValueAccessor = function () {
					return {
						keyup: wrappedHandler
					};
				};

				// call the real event binding's init function
				ko.bindingHandlers.event.init(element, newValueAccessor, allBindingsAccessor, data, bindingContext);
			}
		};
	}

	// a custom binding to handle the enter key
	ko.bindingHandlers.enterKey = keyhandlerBindingFactory(ENTER_KEY);

	// another custom binding, this time to handle the escape key
	ko.bindingHandlers.escapeKey = keyhandlerBindingFactory(ESCAPE_KEY);

	// wrapper to hasFocus that also selects text and applies focus async
	ko.bindingHandlers.selectAndFocus = {
		init: function (element, valueAccessor, allBindingsAccessor, bindingContext) {
			ko.bindingHandlers.hasFocus.init(element, valueAccessor, allBindingsAccessor, bindingContext);
			ko.utils.registerEventHandler(element, 'focus', function () {
				element.focus();
			});
		},
		update: function (element, valueAccessor) {
			ko.utils.unwrapObservable(valueAccessor()); // for dependency
			// ensure that element is visible before trying to focus
			setTimeout(function () {
				ko.bindingHandlers.hasFocus.update(element, valueAccessor);
			}, 0);
		}
	};

	// represent a single todo item
	var Todo = function (todo) {	
		this.title     = ko.observable(todo.title) ;
		this.completed = ko.observable(todo.completed);
		this.editing   = ko.observable(false);
		this.priority  = ko.observable(todo.priority);
	};

	
	// our main view model
	// the .bind() method create a new function 
    
	 
	function compare(a,b) { // descending order 
  		if (a.priority() < b.priority())
    		return 1;
 		if (a.priority() > b.priority())
   			return -1;
  		return 0;  
	};
	 

	var ViewModel = function (todos) {

		// map array of passed in todos to an observableArray of Todo objects
		this.todos = ko.observableArray(todos.map(function (todo) {
			return new Todo(todo);
		}));

		// store the new todo value being entered
		this.current = ko.observable();

		this.recycleBin = ko.observableArray();

		this.showMode = ko.observable('all');

		this.filteredTodos = ko.computed(function () {
			switch (this.showMode()) {
			case 'active':
				return this.todos().filter(function (todo) {
					return !todo.completed();
				});
			case 'completed':
				return this.todos().filter(function (todo) { 
					return todo.completed();
				});
			case 'priority':
			    return this.todos().filter(function(todo){
			    	return (todo.priority() && !todo.completed());
			    }).sort(compare);

			default:
				return this.todos();
			}
		}.bind(this));   //  the (this) value will become the this value of the function 

		// add a new todo, when enter key is pressed
		this.add = function () {
			var current = this.current().trim();
			if (current) {	
				var todo = {title:current, completed:false, priority:0};
				this.todos.push(new Todo(todo));
				this.current('');
			}
		}.bind(this); //  the (this) value will become the this value of the function 

		// remove a single todo
		this.remove = function (todo) {
			this.recycleBin.push(todo);
			this.todos.remove(todo);	
		}.bind(this); //  the (this) value will become the this value of the function 

		// undo a single todo
		// undo will undo the last remove operation. 
		this.undo = function () {
			var todo = this.recycleBin.pop();
			if (todo.title().length > 0) {
				this.todos.push(todo);
			};
		}.bind(this);

		// remove all completed todos
		//  keep the deleted todos for undo operations
		this.removeCompleted = function () {

			var self = this;	
			var completed = this.todos.remove(function (todo) {
				return todo.completed();
			});
			completed.forEach(function(todo){
				self.recycleBin.push(todo);
			});

		}.bind(this); //  the (this) value will become the this value of the function 

		// return the length of the recycle bin 
		this.removedCount = ko.computed(function() {
			return this.recycleBin().length;
		}.bind(this));

		// edit an item
		this.editItem = function (item) {
			 
			item.editing(true);
			item.previousTitle = item.title();
		}.bind(this); //  the (this) value will become the this value of the function 

		// raise the priority of an item
		this.setPriority = function (item) {
		 	var priority = item.priority();
		 	priority++ ;
		 	item.priority(priority % 3) ;
			
		}.bind(this); //  the (this) value will become the this value of the function 

		// stop editing an item.  Remove the item, if it is now empty
		this.saveEditing = function (item) {
			 
			item.editing(false);

			var title        = item.title();
			var trimmedTitle = title.trim();

			// Observable value changes are not triggered if they're consisting of whitespaces only
			// Therefore we've to compare untrimmed version with a trimmed one to chech whether anything changed
			// And if yes, we've to set the new value manually
			if (title !== trimmedTitle) {
				item.title(trimmedTitle);
			}

			if (!trimmedTitle) {
				this.remove(item);
			}
		}.bind(this);

		// cancel editing an item and revert to the previous content
		this.cancelEditing = function (item) {
			item.editing(false);
			item.title(item.previousTitle);
		}.bind(this); //  the (this) value will become the this value of the function 

		// count of all completed todos
		this.completedCount = ko.computed(function () {
			return this.todos().filter(function (todo) {
				return todo.completed();
			}).length;
		}.bind(this)); //  the (this) value will become the this value of the function 

		// count of todos that are not complete
		this.remainingCount = ko.computed(function () {
			return this.todos().length - this.completedCount();
		}.bind(this)); //  the (this) value will become the this value of the function   


		// writeable computed observable to handle marking all complete/incomplete
		this.allCompleted = ko.computed({
			//always return true/false based on the done flag of all todos
			read: function () {
				return !this.remainingCount();
			}.bind(this), //  the (this) value will become the this value of the function 
			// set all todos to the written value (true/false)
			write: function (newValue) {
				this.todos().forEach(function (todo) {
					// set even if value is the same, as subscribers are not notified in that case
					todo.completed(newValue);
				});
			}.bind(this) //  the (this) value will become the this value of the function 
		});

		// helper function to keep expressions out of markup
		this.getLabel = function (count) {
			return ko.utils.unwrapObservable(count) === 1 ? 'item' : 'items';
		}.bind(this); //  the (this) value will become the this value of the function f


		// internal computed observable that fires whenever anything changes in our todos
		ko.computed(function () {
			// store a clean copy to local storage, which also creates a dependency on
			// the observableArray and all observables in each item
			localStorage.setItem('todos-knockoutjs', ko.toJSON(this.todos));
		}.bind(this)).extend({
			rateLimit: { timeout: 500, method: 'notifyWhenChangesStop' }
		}); // save at most twice per second
	};

	// check local storage for todos
	var todos = ko.utils.parseJson(localStorage.getItem('todos-knockoutjs'));

	// bind a new instance of our view model to the page
	var viewModel = new ViewModel(todos || []);
	ko.applyBindings(viewModel);

	// set up filter routing
	/*jshint newcap:false */
	Router({ '/:filter': viewModel.showMode }).init();
}());
