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
          incremental: true,
          external: ['jquery', 'moment']
        }
      }
    }
  });

  grunt.loadTasks('../../tasks');
  grunt.registerTask('default', ['browserify:dist']);

};
