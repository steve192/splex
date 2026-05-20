# Local EAS Android builder image.
# Usage: docker run -e EXPO_TOKEN=... \
#          -v "$(pwd)/frontend":/builder ghcr.io/steve192/splex-easbuilder:latest <eas-profile> [output-file]

FROM ubuntu:26.04

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

# Android SDK
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN mkdir -p $ANDROID_HOME/cmdline-tools && \
    curl -o /tmp/commandlinetools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip && \
    unzip /tmp/commandlinetools.zip -d $ANDROID_HOME/cmdline-tools && \
    mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest && \
    rm /tmp/commandlinetools.zip && \
    npm i --global eas-cli-local-build-plugin @expo/cli eas-cli && \
    sdkmanager --install \
        "build-tools;34.0.0" \
        "ndk;27.0.12077973" \
        "platforms;android-34" \
        "platform-tools" \
        "cmdline-tools;latest" && \
    git config --global --add safe.directory /builder && \
    git config --global --add safe.directory /builder/.git && \
    mkdir /builder

COPY scripts/build-android.sh /usr/local/bin/build-android
RUN chmod +x /usr/local/bin/build-android

WORKDIR /builder

ENV EXPO_TOKEN=""
ENV JAVA_TOOL_OPTIONS="-Xmx4g -XX:MaxMetaspaceSize=1g"

ENTRYPOINT ["/usr/local/bin/build-android"]
