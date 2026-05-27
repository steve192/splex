# Local EAS Android builder image.
# Usage: docker run -e EXPO_TOKEN=... \
#          -v "$(pwd)/frontend":/builder ghcr.io/steve192/splex-easbuilder:latest <eas-profile> [output-file]
#
# Two stages:
#   1. `base`       — all tooling (JDK, Node, Android SDK, NDKs, CMake).
#   2. `prewarm`    — runs a real Gradle build against the current frontend
#                     source to populate ~/.gradle and ~/.npm caches (Gradle
#                     wrapper distribution, Maven artifacts, Kotlin compiler,
#                     etc.). Source is discarded; only the caches are copied
#                     into the final stage.
#   3. `final`      — base tooling + populated caches + entrypoint script.
#
# Secret handling:
#   - .env* files are excluded via .dockerignore (only .env.example is allowed).
#   - GH_TOKEN / EXPO_TOKEN never enter the build — the workflow does not pass
#     them as --build-arg or --secret, and no RUN command needs them.
#     EXPO_TOKEN is supplied at `docker run` time only.
#   - google-services.json is committed to the public repo and the Firebase
#     "api key" is a public project identifier (security is enforced via
#     Security Rules + SHA-1 fingerprints), so it's included as-is.

# ============================================================================
# Stage 1: shared base tooling
# ============================================================================
FROM ubuntu:26.04 AS base

RUN echo '\
Acquire::Retries "100";\
Acquire::https::Timeout "240";\
Acquire::http::Timeout "240";\
APT::Get::Assume-Yes "true";\
APT::Install-Recommends "false";\
APT::Install-Suggests "false";\
Debug::Acquire::https "true";\
' > /etc/apt/apt.conf.d/99custom && \
    apt-get update && \
    apt-get install -y openjdk-17-jdk curl git unzip && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN mkdir -p $ANDROID_HOME/cmdline-tools && \
    curl -o /tmp/commandlinetools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip && \
    unzip /tmp/commandlinetools.zip -d $ANDROID_HOME/cmdline-tools && \
    mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest && \
    rm /tmp/commandlinetools.zip && \
    npm i --global eas-cli-local-build-plugin @expo/cli eas-cli && \
    yes | sdkmanager --licenses > /dev/null && \
    sdkmanager --install \
        "build-tools;35.0.0" \
        "build-tools;36.0.0" \
        "ndk;27.0.12077973" \
        "ndk;27.1.12297006" \
        "cmake;3.22.1" \
        "platforms;android-36" \
        "platform-tools" \
        "cmdline-tools;latest" && \
    git config --global --add safe.directory /builder && \
    git config --global --add safe.directory /builder/.git

# ============================================================================
# Stage 2: prewarm caches with a real Gradle build of the current frontend
# ============================================================================
FROM base AS prewarm

ENV GRADLE_USER_HOME=/root/.gradle

COPY frontend /tmp/frontend

# Install JS deps, generate native Android project, and run a release build to
# pull every Maven artifact / Kotlin compiler / NDK build that real EAS builds
# need. `|| true` so a failing late step (e.g. signing) still leaves caches
# populated.
RUN cd /tmp/frontend && \
    npm ci && \
    npx expo prebuild --platform android --no-install && \
    cd android && \
    ./gradlew assembleRelease --no-daemon || true && \
    cd / && rm -rf /tmp/frontend

# ============================================================================
# Stage 3: final image — base + caches only, no source
# ============================================================================
FROM base AS final

# Only the dependency caches and Gradle wrapper distribution. Excludes
# ~/.gradle/daemon and ~/.gradle/native (process state, not useful).
COPY --from=prewarm /root/.gradle/caches /root/.gradle/caches
COPY --from=prewarm /root/.gradle/wrapper /root/.gradle/wrapper
COPY --from=prewarm /root/.npm /root/.npm

RUN mkdir /builder

COPY scripts/build-android.sh /usr/local/bin/build-android
RUN chmod +x /usr/local/bin/build-android

WORKDIR /builder

ENV EXPO_TOKEN=""

ENTRYPOINT ["/usr/local/bin/build-android"]
