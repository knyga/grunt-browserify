module.exports = function (grunt) {
  grunt.initConfig({
    browserify: {
      dist: {
        files: [{
          expand: true,     // Enable dynamic expansion
          src: ['./app/*.js'], // Actual pattern(s) to match
          dest: 'dist'
        }],
        options: {
          //incremental: true,
          //watch: true,
          //buildOnChange: true,
          underscoreFilter: true,
          filterEmpty: true,
          external: ['jquery', 'moment']
          //browserifyOptions: {
          //  cacheDir: './cache'
          //}
        }
      }
    }
  });

  grunt.loadTasks('../../tasks');
  grunt.registerTask('default', ['browserify:dist']);

};
