/* {[The file is published on the basis of YetiForce Public License 3.0 that can be found in the following directory: licenses/LicenseEN.txt or yetiforce.com]} */
const gulp = require('gulp')
const stylus = require('gulp-stylus')
const browserSync = require('browser-sync').create()
const rename = require('gulp-rename')
const header = require('gulp-header')
const path = require('path')
const sassJson = require('gulp-sass-json')
require('dotenv').config()

const importAliases = require('./gulp/gulp-import-aliases')
const importMin = require('./gulp/gulp-import-min')
const terser = require('./gulp/gulp-terser')
const vueEsCompiler = require('./gulp/gulp-vue-es-compiler')
const logger = require('./gulp/gulp-log')
const ModuleLoader = require('./ModuleLoader.server')
const saveIcons = require('./gulp/gulp-save-mdi-icons')

const aliases = {
  '/?src/': '/src/',
  '/?store/': '/src/store/',
  '/?components/': '/src/components/',
  '/?layouts/': '/scr/layouts/',
  '/?modules/': '/src/modules/',
  '/?assets/': '/src/assets/',
  '/?statics/': '/src/statics/',
  '/?utilities/': '/src/utilities/',
  '/?services/': '/src/services/',
  '/?pages/': '/src/pages/',
  '/?Core/': '/src/modules/Core/',
  '/?Base/': '/src/modules/Base/',
  '/?Settings/': '/src/modules/Setting/'
}

const license =
  '/* {[The file is published on the basis of YetiForce Public License 3.0 that can be found in the following directory: licenses/LicenseEN.txt or yetiforce.com]} */\n'

const sourceDir = 'src'
const vueSrc = 'src/**/*.vue'
const stylusSrc = 'src/css/**/*.styl'
const modulesConfigSrc = 'src/statics/modules.js'
const generatedSrc = [modulesConfigSrc, 'src/store/mutations.js', 'src/store/getters.js', 'src/store/actions.js']
const minSrc = ['src/**/*.js', '!src/**/*.min.js', '!src/**/*.vue.js', ...generatedSrc.map(src => '!' + src)]
/**
 * Compile vue files into .min.js, replace directory aliases and internal imports to .min.js
 *
 * @param {string|array} src
 *
 * @returns {function} task function
 */
function getVueTask(src = vueSrc, dev = false) {
  return function vueTask() {
    let dest = `./${sourceDir}/`
    if (src !== vueSrc) {
      dest = src.slice(0, src.lastIndexOf('/') + 1)
    }
    const importMinOptions = { extension: 'vue.js' }
    return gulp
      .src(src, { sourcemaps: true })
      .pipe(vueEsCompiler())
      .pipe(importAliases({ map: aliases }))
      .pipe(importMin(importMinOptions))
      .pipe(
        terser({
          module: true,
          mangle: false
        })
      )
      .pipe(header(license))
      .pipe(
        rename({
          extname: '.vue.js'
        })
      )
      .pipe(gulp.dest(dest, { sourcemaps: true }))
  }
}
gulp.task('vue', getVueTask())

/**
 * Minify module.js config file and replace .js internal paths to .min.js
 */
function getModulesTask(src = generatedSrc, dev = false) {
  return function modulesTask(done) {
    const importMinConfig = {}
    if (dev) {
      if ((Array.isArray(src) && src !== generatedSrc) || !generatedSrc.includes(src)) {
        ModuleLoader.saveModuleConfig(ModuleLoader.loadModules(sourceDir))
        return gulp.series(['generate-modules'])(done)
      }
    } else {
      ModuleLoader.saveModuleConfig(ModuleLoader.loadModules(sourceDir))
    }
    return gulp
      .src(src, { sourcemaps: false })
      .pipe(
        terser({
          module: false,
          mangle: false,
          output: {
            keep_quoted_props: true
          },
          compress: {
            booleans_as_integers: false,
            booleans: false
          }
        })
      )
      .pipe(importMin(importMinConfig))
      .pipe(header(license))
      .pipe(
        rename({
          extname: '.min.js'
        })
      )
      .pipe(
        gulp.dest(
          function(file) {
            let dest = `${sourceDir}/statics/`
            if (file.path !== modulesConfigSrc) {
              dest = path.dirname(file.path).replace(/\\/g, '/')
            }
            return dest
          },
          { sourcemaps: false }
        )
      )
  }
}
gulp.task('generate-modules', getModulesTask())

/**
 * Minify .js files and replace directory aliases
 *
 * @param {string|array} src
 *
 * @returns {function} task
 */
function getMinTask(src = minSrc, dev = false) {
  return function minTask() {
    let dest = `${sourceDir}/`
    if (src !== minSrc) {
      dest = src.slice(0, src.lastIndexOf('/') + 1)
    }
    const importMinConfig = {}
    if (dev) {
      importMinConfig.postfix = '?dev=' + new Date().getTime()
    }
    return gulp
      .src(src, { sourcemaps: true })
      .pipe(
        terser({
          module: true,
          mangle: false
        })
      )
      .pipe(importAliases({ map: aliases }))
      .pipe(importMin(importMinConfig))
      .pipe(header(license))
      .pipe(
        rename({
          extname: '.min.js'
        })
      )
      .pipe(gulp.dest(dest, { sourcemaps: true }))
  }
}
gulp.task('min', getMinTask())

/**
 * Compile .css file
 *
 * @param {string|array} src
 *
 * @returns {function} task
 */
function getCompileCssTask(src = stylusSrc) {
  return function compileCssTask() {
    return gulp
      .src(src, { sourcemaps: true })
      .pipe(stylus())
      .pipe(
        gulp.dest('./src/css'),
        { sourcemaps: true }
      )
  }
}

/**
 * Compile css task
 */
gulp.task('compileCss', getCompileCssTask())

gulp.task('icons', () => {
  return gulp
    .src('./node_modules/@mdi/font/scss/_variables.scss')
    .pipe(sassJson())
    .pipe(saveIcons())
    .pipe(header(license))
    .pipe(
      rename({
        basename: 'Icons',
        extname: '.js'
      })
    )
    .pipe(gulp.dest('src/modules/Core/modules/Icons/assets'))
})

/**
 * Build task
 */
gulp.task('build', gulp.series(['vue', 'icons', 'min', 'generate-modules', 'compileCss']))

/**
 * Start dev environment with browser-sync
 */
gulp.task('dev', function() {
  ModuleLoader.log = true
  gulp.series(['build'])(() => {
    ModuleLoader.log = false
    browserSync.init({
      proxy: typeof process.env.LOCAL_URL !== 'undefined' ? process.env.LOCAL_URL : 'http://yeti',
      browser: 'chrome'
    })
    gulp.watch(vueSrc).on('all', (eventName, fileName) => {
      fileName = fileName.replace(/\\/gim, '/')
      console.log(eventName, fileName)
      gulp.series([getVueTask(fileName, true), getModulesTask(fileName, true)])(() => {
        console.log(eventName, fileName, 'done')
        browserSync.reload()
      })
    })
    gulp.watch(minSrc).on('all', (eventName, fileName) => {
      fileName = fileName.replace(/\\/gim, '/')
      console.log(eventName, fileName)
      gulp.series([getMinTask(fileName, true), getModulesTask(fileName, true)])(() => {
        console.log(eventName, fileName, 'done')
        browserSync.reload()
      })
    })
  })
  gulp.watch(stylusSrc).on('all', (eventName, fileName) => {
    fileName = fileName.replace('\\', '/')
    console.log(eventName, fileName)
    gulp.series([getCompileCssTask()])(() => {
      console.log(eventName, fileName, 'done')
      browserSync.reload(fileName)
    })
  })
})