$(function() {
  var BurnDownToDo = window.BurnDownToDo || (window.BurnDownToDo = {});
  var Globals = BurnDownToDo.globals || (BurnDownToDo.globals = {});
  var Models = BurnDownToDo.models || (BurnDownToDo.models = {});
  var Collections = BurnDownToDo.collections ||
                    (BurnDownToDo.collections = {});
  var Views = BurnDownToDo.views || (BurnDownToDo.views = {});

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

    // Focus
    Globals.task_form.ui.input.trigger('focus');
  };

  main();
});
