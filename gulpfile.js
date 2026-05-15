var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var watchify = require('watchify');
var tsify = require('tsify');
var fancy_log = require('fancy-log');
var fs = require('fs');
var path = require('path');
var paths = {
    pages: ['src/*.html']
};

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    var env = {};
    var lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line.charAt(0) === '#') {
            continue;
        }

        var equalsIndex = line.indexOf('=');
        if (equalsIndex < 0) {
            continue;
        }

        var key = line.substring(0, equalsIndex).trim();
        var value = line.substring(equalsIndex + 1).trim();
        if ((value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
            (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")) {
            value = value.substring(1, value.length - 1);
        }
        env[key] = value;
    }

    return env;
}

function parseList(value) {
    if (!value) {
        return [];
    }

    return value.split(',').map(function(item) {
        return item.trim();
    }).filter(Boolean);
}

function createRuntimeConfig() {
    var defaultsPath = path.join(__dirname, 'src', 'runtime-config.default.json');
    var outputPath = path.join(__dirname, 'dist', 'runtime-config.json');
    var defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
    var env = Object.assign({}, parseEnvFile(path.join(__dirname, '.env')), parseEnvFile(path.join(__dirname, '.env.local')));

    defaults.network.stunUrls = parseList(env.MIRROR_MAGE_STUN_URLS);
    defaults.network.turnUrls = parseList(env.MIRROR_MAGE_TURN_URLS);
    defaults.network.turnUsername = env.MIRROR_MAGE_TURN_USERNAME || "";
    defaults.network.turnCredential = env.MIRROR_MAGE_TURN_CREDENTIAL || "";

    if (env.MIRROR_MAGE_TURN_MODE !== undefined) {
        defaults.network.turnMode = Number(env.MIRROR_MAGE_TURN_MODE) === 1 ? 1 : 0;
    }

    if (env.MIRROR_MAGE_P2P_CONNECT_TIMEOUT_MS !== undefined) {
        defaults.network.p2pConnectTimeoutMs = Math.max(1000, Number(env.MIRROR_MAGE_P2P_CONNECT_TIMEOUT_MS) || defaults.network.p2pConnectTimeoutMs);
    }

    if (env.MIRROR_MAGE_ROOM_META_POLL_MS !== undefined) {
        defaults.network.roomMetaPollMs = Math.max(250, Number(env.MIRROR_MAGE_ROOM_META_POLL_MS) || defaults.network.roomMetaPollMs);
    }

    if (env.MIRROR_MAGE_RELAY_RETRY_MS !== undefined) {
        defaults.network.relayRetryMs = Math.max(250, Number(env.MIRROR_MAGE_RELAY_RETRY_MS) || defaults.network.relayRetryMs);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(defaults, null, 2));
}

function createBundler(watch) {
    var bundler = browserify({
        basedir: '.',
        debug: true,
        entries: ['src/main.ts'],
        cache: {},
        packageCache: {}
    }).plugin(tsify);

    return watch ? watchify(bundler) : bundler;
}

gulp.task('copy-html', function () {
    return gulp.src(paths.pages)
        .pipe(gulp.dest('dist'));
});

gulp.task('copy-runtime-config', function (done) {
    createRuntimeConfig();
    done();
});

function bundleWith(bundler) {
    return bundler
        .bundle()
        .on('error', fancy_log)
        .pipe(source('bundle.js'))
        .pipe(gulp.dest('dist'));
}

function buildBundle() {
    return bundleWith(createBundler(false));
}

var watchedBrowserify = createBundler(true);

function watchBundle() {
    return bundleWith(watchedBrowserify);
}

gulp.task('build', gulp.series(gulp.parallel('copy-html', 'copy-runtime-config'), buildBundle));
gulp.task('default', gulp.series(gulp.parallel('copy-html', 'copy-runtime-config'), watchBundle));
watchedBrowserify.on('update', watchBundle);
watchedBrowserify.on('log', fancy_log);
