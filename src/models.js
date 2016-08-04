$(function() {
  var BurnDownToDo = window.BurnDownToDo || (window.BurnDownToDo = {});
  var Globals = BurnDownToDo.globals || (BurnDownToDo.globals = {});
  var Models = BurnDownToDo.models || (BurnDownToDo.models = {});
  var Collections = BurnDownToDo.collections ||
                    (BurnDownToDo.collections = {});

  Models.UiState = Backbone.Model.extend({
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
  });

  Models.Task = Backbone.Model.extend({
    defaults: { done: false, text: '' },
  });

  Models.Snapshot = Backbone.Model.extend({
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
  });

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
  
  Collections.Tasks = LocalStorageCollection.extend({
    model: Models.Task,
    localStorage_key: 'bdtd:tasks',
  });

  Collections.Snapshots = LocalStorageCollection.extend({
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
  });
});
