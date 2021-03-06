/*******************************************************************************
 *  Dependencies
 */
var gulp = require('gulp');
var log = require('gulp-util').log;
var rename = require('gulp-rename');
var jade = require('gulp-jade');
var stylus = require('gulp-stylus');
var plumber = require('gulp-plumber');
var webserver = require('gulp-webserver');
var opn = require('opn');

/*******************************************************************************
 *  Configurations
 */
var config = {
    watch: './src/**/*.*',
    server: {
        host: '0.0.0.0',
        port: '3130',
        path: './dist'
    },
    html: {
        src: ['./src/**.jade', './src/views/**.jade'],
        destination: './dist'
    },
    css: {
        src: './src/styles/style.styl',
        destination: './dist/css'
    },
    js: {
        src: ['./src/js/**', './bower_components/telepat-js/dist/*'],
        destination: './dist/js'
    },
    assets: {
        src: './src/assets/**',
        destination: './dist/assets'
    }
};

/*******************************************************************************
 *  Webserver up and running
 */
gulp.task('webserver', function() {
    gulp.src(config.server.path)
        .pipe(webserver({
            host: config.server.host,
            port: config.server.port,
            livereload: false,
            directoryListing: false
        }));
});

/*******************************************************************************
 *  Open the browser
 */
gulp.task('openbrowser', function() {
    setTimeout(function() {opn('http://'+ config.server.host +':'+ config.server.port);}, 500);
});

/*******************************************************************************
 *  Jade task (optional to change the name of the file)
 */
gulp.task('templates', function() {
    var locs = {};
    gulp.src(config.html.src)
        .pipe(plumber())
        .pipe(jade({ locals: locs }))
        //.pipe(rename('index.html'))
        .pipe(gulp.dest(config.html.destination));
});

/*******************************************************************************
 *  Stylus task (optional to change the name of the file)
 */
gulp.task('styles', function() {
           gulp.src(config.css.src)
               .pipe(plumber())
               .pipe(stylus())
               .pipe(rename('style.css'))
               .pipe(gulp.dest(config.css.destination));
});

/*******************************************************************************
 *  Javascript task
 */
gulp.task('scripts', function() {
    gulp.src(config.js.src)
        .pipe(plumber())
        .pipe(gulp.dest(config.js.destination));
});

/*******************************************************************************
 *  Assets task
 */
gulp.task('assets', function() {
    gulp.src(config.assets.src)
        .pipe(gulp.dest(config.assets.destination));
});

/*******************************************************************************
 *  Watch task
 */
gulp.task('watch', function() {
    log('Watching files');
    gulp.watch(config.watch, ['build']);
});

/*******************************************************************************
 *  Command line task commands
 */
gulp.task('build', ['templates', 'styles', 'scripts', 'assets']);
gulp.task('default', ['build', 'webserver', 'watch', 'openbrowser']);
