#!/usr/bin/env bash

set -e
set -o pipefail

SCRIPTDIR=$(cd $(dirname "$0") && pwd)

export PATH="$SCRIPTDIR"/../../madwizard-cli-core/bin:$PATH

# simplest way to avoid initial screen clear (for now)
export DEBUG=xxx

function test {
    TEST="$1"
    EXPECTED="$2"
    madwizard $TEST | grep -q "$EXPECTED" && printf "$TEST: \033[32mPASS\033[0m\n" || printf "$TEST: \033[31mFAIL\033[0m\n"
}

test version $(cd "$SCRIPTDIR"/../../.. && npm view madwizard version)
test demo/hello "Hello world"
# test demo/choice foo