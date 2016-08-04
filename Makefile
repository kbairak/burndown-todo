bundle:
	uglifyjs plugins/js/jquery.js\
		       plugins/js/underscore.js\
		       plugins/js/backbone.js\
		       plugins/js/bootstrap.js\
		       plugins/js/raphael.js\
		       plugins/js/morris.js\
		       src/models.js\
		       src/views.js\
		       src/app.js\
		       -o bundle.js\
		       --source-map=bundle.js.map

runserver:
	python -m SimpleHTTPServer 8010
