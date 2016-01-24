var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var del = require('del');
var _less = require('gulp-less');
var childProcess = require('child_process');
var _ = require('lodash');
var path = require('path');
var fse = require('fs-extra');

var jsSources = ['client/js/vendor.js', 'client/js/lb-services.js', 'client/js/modules/**/*_module.js', 'client/js/bichar.js',
    'client/js/**/*.js', '!client/js/app.min.js'];
var lessSources = ['client/less/**/*.less'];
var jsBuildDirectory = 'client/js/build/';
var cssBuildDirectory = 'client/css/build/';
var appDirectory = 'client/js/';

gulp.task('clean-build', function (next) {
    del([jsBuildDirectory + 'app.min.js']).then(function(){
        console.log('js build cleaned!!');
        next();
    });
});

gulp.task('clean-build-css', function(next) {
    del([cssBuildDirectory + 'app.min.css']).then(function(){
        console.log('css build cleaned!!');
        next();
    });
});

gulp.task('clean-vendor', function (next) {
    del([appDirectory + 'vendor.js']).then(function(){
        console.log('vendor build cleaned!!');
        next();
    });
});

/**
 * Compile all less files and concat to app.min.css
 */
gulp.task('less', ['clean-build-css'], function(next) {
    gulp.src(lessSources)
        .pipe(_less())
        .pipe(concat('app.min.css'))
        .pipe(gulp.dest(cssBuildDirectory));
    next();
});

/**
 * Concatenate all script into app.min.js, but does not uglify
 */
gulp.task('concat', ['clean-build'], function (next) {
    gulp.src(jsSources)
        .pipe(concat('app.min.js'))
        .pipe(gulp.dest(jsBuildDirectory));
    next();
});

/**
 * Browserify all node modules defined in vendor/vendor.js  into client/js/vendor.js
 */
gulp.task('browserify', ['clean-vendor'], function () {
    var b = browserify();
    b.add('vendor/vendor.js');
    b.transform('browserify-css', {
        processRelativeUrl: function(relativeUrl) {
            var stripQueryStringAndHashFromPath = function(url) {
                return url.split('?')[0].split('#')[0];
            };
            var rootDir = process.cwd();
            var relativePath = stripQueryStringAndHashFromPath(relativeUrl);
            var queryStringAndHash = relativeUrl.substring(relativePath.length);

            // Copy files from node_modules/bootstrap/dist/fonts to client/js/fonts
            var prefix = 'node_modules/';
            if (_.startsWith(relativePath, prefix)) {
                //Only get the filename
                var parts = relativePath.split('/');
                var vendorPath = 'client/css/fonts/' + parts[parts.length - 1];
                var newPath =  'css/fonts/' + parts[parts.length - 1];
                var source = path.join(rootDir, relativePath);
                var target = path.join(rootDir, vendorPath);
                fse.copySync(source, target);

                // Returns a new path string with original query string and hash fragments
                return newPath + queryStringAndHash;
            }

            return relativeUrl;
        }
    });
    var stream = b.bundle()
        .pipe(source('vendor.js'))
        .pipe(gulp.dest(appDirectory));
    return stream;
});

/**
 * Create angular services from loopback models
 */
gulp.task('loopback-services', function (next) {
    var res = childProcess.execFile('lb-ng server/server.js client/js/lb-services.js');
    if(res) {
        console.log('Built angular services.');
    } else {
        console.log('Warning! Angular service build failed!');
    }
    next();
});

/**
 * Minify and uglify all javascript in client/js into client/js.app.min.js (for production)
 */
gulp.task('build', ['browserify', 'loopback-services', 'clean-build', 'less'], function () {
    gulp.src(jsSources)
        .pipe(concat('app.min.js'))
        .pipe(uglify({
            compress: {
                negate_iife: false
            }
        }))
        .pipe(gulp.dest(jsBuildDirectory));
});

/**
 * Build client code, but don't minify (for development).
 */
gulp.task('build-dev', ['browserify', 'loopback-services', 'clean-build', 'less'], function () {
    gulp.src(jsSources)
        .pipe(concat('app.min.js'))
        .pipe(gulp.dest(jsBuildDirectory));
    console.log('Dev bundle built!');
});

/**
 * Watch changes to files that need to be built for app
 */
gulp.task('watch', function () {
    gulp.watch(['vendor/vendor.js'], ['browserify']);
    gulp.watch(['client/js/**/*.js', 'client/js/**/*.html', '!'+jsBuildDirectory +'/*'], ['concat']);
    gulp.watch(['common/**/*.js', 'common/**/*.json'], ['loopback-services']);
    gulp.watch(['client/less/**/*.less'], ['less']);
});


gulp.task('default', ['build-dev', 'run-server','watch']);