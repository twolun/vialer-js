#!/bin/bash
echo "Running build integrity check for brand $1..."
# Remove existing artifacts.
if [ -d build ]; then
    rm -rf build
fi

if [ -d dist ]; then
    rm -rf dist
fi

if [ -d node_modules ]; then
    rm -rf node_modules
fi

if [ -f package-lock.json ]; then
    rm -f package-lock.json
fi

# Do a clean install based on package.json.
echo "Node: $(node --version)"
echo "Npm: $(npm --version)"
npm install

PACKAGELOCK_STATUS=$(git status package-lock.json --porcelain | grep -c 'M package-lock.json')

# Build add-on.
NODE_ENV=production gulp build --target firefox --brand $1

# Build webextension.
web-ext build --source-dir build/$1/firefox --artifacts-dir ./dist/$1/firefox/

if [ $PACKAGELOCK_STATUS != 0 ]; then
    echo 'WARN: change detected in package-lock.json, commit this file:'
    echo '  git add package-lock.json && git commit -m "Update package-lock.json"'
    echo 'then run:'
    echo '  git archive --format=zip HEAD > sources.zip'
    # echo '  cd build/firefox && zip -r ../../sources.zip . && cd -'
    echo 'after this you can run build-test.sh'
else
    # Create zipped sources from git HEAD.
    git archive --format=zip HEAD > dist/sources.zip

    zipfile=$(ls -t dist/firefox/ | awk '{ print $0; exit }')

    # Remove tmp artifacts.
    if [ -d /tmp/vialerjs-unzipped ]; then
        rm -rf /tmp/vialerjs-unzipped
    fi

    if [ -d /tmp/vialerjs-unzipped-src ]; then
        rm -rf /tmp/vialerjs-unzipped-src
    fi

    unzip dist/$1/firefox/$zipfile -d /tmp/vialerjs-unzipped
    unzip dist/sources.zip -d /tmp/vialerjs-unzipped-src

    # Build from source.
    cd /tmp/vialerjs-unzipped-src
    cp .vialer-jsrc.example .vialer-jsrc
    npm install
    NODE_ENV=production gulp build --target firefox

    # The generated source build must be equal to the web-ext build.
    DIFF=$(diff -r /tmp/vialerjs-unzipped /tmp/vialerjs-unzipped-src/build/$1/firefox)
    if [ "$DIFF" != "" ]
    then
        echo "Sources and differ. Checkout the diff."
        echo "diff -r /tmp/vialerjs-unzipped /tmp/vialerjs-unzipped-src/build/firefox"
    else
        echo "Build integrity check passed..."
    fi
fi
