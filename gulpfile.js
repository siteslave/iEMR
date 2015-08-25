var gulp = require('gulp'),
    jade = require('gulp-jade'),
    jshint = require('gulp-jshint'),
    watch = require('gulp-watch'),
    csslint = require('gulp-csslint');

/** Jade **/
gulp.task('jade', function () {
    return gulp.src('./src/**/*.jade')
        .pipe(jade())
        .pipe(gulp.dest('./app'));
});

gulp.task('css', function() {
  gulp.src('src/**/*.css')
    .pipe(csslint())
    .pipe(csslint.reporter())
    .pipe(gulp.dest('./app'));
});
/** JSHint **/
gulp.task('jshint', function () {
    return gulp.src('./src/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'))
        .pipe(gulp.dest('./app'));
});
/** Watch **/
gulp.task('watch', function () {
    gulp.watch('./src/**/*.js', ['jshint']);
    gulp.watch('./src/**/*.jade', ['jade']);
    gulp.watch('./src/**/*.css', ['css']);
});

/** Default task **/
gulp.task('default', ['jshint', 'jade', 'css', 'watch']);
