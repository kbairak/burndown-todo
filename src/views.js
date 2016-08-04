$(function() {
  var BurnDownToDo = window.BurnDownToDo || (window.BurnDownToDo = {});
  var Globals = BurnDownToDo.globals || (BurnDownToDo.globals = {});
  var Models = BurnDownToDo.models || (BurnDownToDo.models = {});
  var Views = BurnDownToDo.views || (BurnDownToDo.views = {});

  Views.TaskForm = Backbone.View.extend({
    events: { submit: "add_task" },
    initialize: function() {
      this.ui = { input: this.$('input[type="text"]'),
                  li: this.$el.parent() };
    },
    add_task: function(event) {
      if(event) { event.preventDefault(); }
      var text = this.ui.input.val().trim();
      if(text) {
        Globals.tasks.add(new Models.Task({ text: text }));
        this.ui.input.val('');
      }
    },
  });

  Views.TaskList = Backbone.View.extend({
    initialize: function() {
      this.listenTo(Globals.tasks, 'add', this.add_new);
      this.listenTo(Globals.tasks, 'reset', this.add_all);
    },
    add_new: function(new_task) {
      var new_task_view = new Views.Task({ model: new_task });
      new_task_view.render().$el.insertBefore(Globals.task_form.ui.li);
    },
    add_all: function() {
      var _this = this;
      Globals.tasks.each(function(task) { _this.add_new(task); });
    },
  });

  Views.Task = Backbone.View.extend({
    events: { 'click .js-remove': "click_remove",
              'click input[type="checkbox"]': "mark_done" },
    tagName: 'li',
    setup_template: _.template($('#task-setup-template').html()),
    running_template: _.template($('#task-running-template').html()),
    initialize: function() {
      this.listenTo(this.model, 'destroy', this.remove);
      this.listenTo(this.model, 'change:done', this.render);
      this.listenTo(Globals.ui_state, 'change:status', this.render);
    },
    _bind_ui: function() {
      this.ui = { text: this.$('input[type="text"]'),
                  done: this.$('input[type="checkbox"]') };
    },
    render: function() {
      var template;
      if(Globals.ui_state.get('status') == 'setup') {
        template = this.setup_template;
      } else if(Globals.ui_state.get('status') == 'running') {
        template = this.running_template;
      }
      this.$el.html(template({ task: this.model.toJSON() }));
      this.$el.addClass('list-group-item');
      this._bind_ui();
      return this;
    },
    click_remove: function(event) {
      if(event) { event.preventDefault(); }
      this.model.destroy();
    },
    mark_done: function(event) {
      this.model.set({ done: this.ui.done.prop('checked') });
    },
  });

  Views.StartForm = Backbone.View.extend({
    events: { submit: "submit" },
    initialize: function() {
      this.ui = { 'time': this.$('input[type="text"]') };
      this.listenTo(Globals.ui_state, 'change:status', this.show_hide);
    },
    submit: function(event) {
      if(event) { event.preventDefault(); }

      // Validate number of tasks
      if(Globals.tasks.length === 0) { return false; }

      // Validate time
      var minutes = this._validate_time();
      if(minutes === false) {
        this.ui.time.parent().addClass('has-error');
        return;
      } else {
        this.ui.time.parent().removeClass('has-error');
      }
      var now = new Date();
      Globals.ui_state.set({
        status: 'running',
        start: now.getTime(),
        end: new Date(now.getTime() + minutes * 60 * 1000).getTime(),
      });
    },
    _validate_time: function() {
      var text = this.ui.time.val();
      var splitted = text.split(':');
      if(splitted.length != 2) { return false; }
      var hours_str = splitted[0], minutes_str = splitted[1];
      if(minutes_str.length != 2) { return false; }
      var hours_num = parseInt(hours_str),
          minutes_num = parseInt(minutes_str);
      if(hours_num < 0 || minutes_num < 0 || minutes_num > 59) {
        return false;
      }
      return hours_num * 60 + minutes_num;
    },
    show_hide: function() {
      if(Globals.ui_state.get('status') == 'setup') {
        this.$el.removeClass('hidden');
      } else if(Globals.ui_state.get('status') == 'running') {
        this.$el.addClass('hidden');
      }
    },
  });

  Views.ResetForm = Backbone.View.extend({
    events: { submit: "submit" },
    initialize: function() {
      this.listenTo(Globals.ui_state, 'change:status', this.show_hide);
    },
    submit: function(event) {
      if(event) { event.preventDefault(); }
      Globals.ui_state.set({ status: 'setup', start: null, end: null });
      Globals.snapshots.reset();
      _.each(
        Globals.tasks.filter(function(task) { return task.get('done'); }),
        function(task) { task.destroy(); }
      );
    },
    show_hide: function() {
      if(Globals.ui_state.get('status') == 'setup') {
        this.$el.addClass('hidden');
      } else if(Globals.ui_state.get('status') == 'running') {
        this.$el.removeClass('hidden');
      }
    },
  });

  Views.Chart = Backbone.View.extend({
    initialize: function() {
      this.line = new Morris.Line({
        element: this.el,
        data: [],
        xkey: 'created',
        ykeys: ['tasks_left', 'velocity_left'],
        labels: ['Tasks left', 'Velocity left'],
        lineColors: ['blue', 'red'],
        smooth: false,
      });

      this.listenTo(Globals.ui_state, 'change:status', this.show_hide);
      this.listenTo(Globals.snapshots, 'add reset', this.draw);

      var _this = this;
      setInterval(function() { _this.draw(); }, 10 * 1000);
    },
    show_hide: function() {
      if(Globals.ui_state.get('status') == 'setup') {
        this.$el.addClass('hidden');
      } else if(Globals.ui_state.get('status') == 'running') {
        this.$el.removeClass('hidden');
      }
    },
    draw: function() {
      if(Globals.ui_state.get('status') == 'setup' ||
         Globals.snapshots.length === 0)
      {
        this.$el.addClass('hidden');
        return;
      }
      this.$el.removeClass('hidden');

      // Make data
      var first_snapshot = Globals.snapshots.at(0);
      var data = [{
        created: first_snapshot.get('created'),
        tasks_left: first_snapshot.get_tasks_left(),
        velocity_left: first_snapshot.get_tasks_left(),
      }];
      for(var i = 1; i < Globals.snapshots.length; i++) {
        var a = Globals.snapshots.at(i - 1), b = Globals.snapshots.at(i);
        data.push({ created: b.get('created') - 1,
                    tasks_left: a.get_tasks_left() });
        data.push({ created: b.get('created'),
                    tasks_left: b.get_tasks_left(),
                    velocity_left: b.get_velocity_left() });
      }
      var last_snapshot = Globals.snapshots.last();
      data.push({
        created: (new Date()).getTime(),
        velocity_left: (new Models.Snapshot({
          total: last_snapshot.get('total')
        })).get_velocity_left(),
        tasks_left: last_snapshot.get_tasks_left(),
      });
      data.push({ created: Globals.ui_state.get('end'),
                  velocity_left: 0 });

      this.line.setData(data);
    },
  });
});
