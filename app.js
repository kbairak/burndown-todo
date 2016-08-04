$(function() {
  var BurnDownToDo = window.BurnDownToDo = {};
  var Globals = BurnDownToDo.globals = {};

  var Models = BurnDownToDo.models = {
    UiState: Backbone.Model.extend({
      localStorage_key: 'bdtd:ui_state',
      defaults: { status: 'setup', start: null, end: null },
      initialize: function() {
        this.listenTo(this, 'change', function() {
          localStorage[this.localStorage_key] = JSON.stringify(this.toJSON());
        });
      },
      restore: function(options) {
        this.set(JSON.parse(localStorage[this.localStorage_key]), options);
      }
    }),

    Task: Backbone.Model.extend({
      defaults: { done: false, text: '' },
    }),

    Snapshot: Backbone.Model.extend({
      defaults: function() {
        return { created: new Date(), total: 0, done: 0 };
      },
      get_tasks_left: function() {
        return this.get('total') - this.get('done');
      },
      get_velocity_left: function() {
        return this.get('total') * (
          (Globals.ui_state.get('end') - this.get('created')) /
          (Globals.ui_state.get('end') - Globals.ui_state.get('start'))
        );
      },
    }),
  };

  var LocalStorageCollection = (function() {
    function LocalStorageCollection() {
      Backbone.Collection.apply(this, arguments);
      this.listenTo(this, 'add remove reset change', function() {
        localStorage[this.localStorage_key] = JSON.stringify(this.toJSON());
      });
    }

    LocalStorageCollection.extend = Backbone.Collection.extend;

    LocalStorageCollection.prototype.restore = function(options) {
      this.reset(JSON.parse(localStorage[this.localStorage_key]), options);
    };

    _.extend(LocalStorageCollection.prototype, Backbone.Collection.prototype);

    return LocalStorageCollection;
  })();
  
  var Collections = BurnDownToDo.collections = {
    Tasks: LocalStorageCollection.extend({
      model: Models.Task,
      localStorage_key: 'bdtd:tasks',
    }),

    Snapshots: LocalStorageCollection.extend({
      model: Models.Snapshot,
      localStorage_key: 'bdtd:snapshots',
      comparator: 'created',
      initialize: function() {
        this.listenTo(Globals.ui_state, 'change:status', this.take_snapshot);
        this.listenTo(Globals.tasks, 'change:done add', this.take_snapshot);
      },
      take_snapshot: function() {
        if(Globals.ui_state.get('status') == 'setup') { return; }
        var done = 0, total = 0;
        Globals.tasks.each(function(task) {
          if(task.get('done')) { done += 1; }
          total += 1;
        });
        this.add({ done: done, total: total, created: new Date().getTime() });
      },
    }),
  };

  var Views = BurnDownToDo.views = {
    TaskForm: Backbone.View.extend({
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
    }),

    TaskList: Backbone.View.extend({
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
    }),

    Task: Backbone.View.extend({
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
    }),

    StartForm: Backbone.View.extend({
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
    }),

    ResetForm: Backbone.View.extend({
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
    }),

    Chart: Backbone.View.extend({
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
    }),
  };

  var main = function() {
    Globals.ui_state = new Models.UiState();
    Globals.tasks = new Collections.Tasks();
    Globals.snapshots = new Collections.Snapshots();
    Globals.task_form = new Views.TaskForm({ el: '#task-form' });
    Globals.task_list = new Views.TaskList({ el: '#task-list' });
    Globals.start_form = new Views.StartForm({ el: '#start-form' });
    Globals.reset_Form = new Views.ResetForm({ el: '#reset-form' });
    Globals.chart = new Views.Chart({ el: '#chart' });

    // Restore
    Globals.tasks.restore({ silent: true });
    Globals.ui_state.restore({ silent: true });
    Globals.snapshots.restore({ silent: true });

    // Triggers
    Globals.tasks.trigger('reset');
    Globals.snapshots.trigger('reset');
    Globals.ui_state.trigger('change:status');
  };

  main();
});
