/**
 * Expo config plugin that overrides `org.gradle.jvmargs` in
 * `android/gradle.properties` during `expo prebuild`.
 *
 * Why: the Expo prebuild template ships a low default (~2 GiB heap, 512 MiB
 * metaspace). On SDK 55 / RN 0.83, KSP runs out of Metaspace during the
 * Android build and the daemon dies with OutOfMemoryError. Bumping
 * `JAVA_TOOL_OPTIONS` doesn't help because Gradle passes explicit `-Xmx` /
 * `-XX:MaxMetaspaceSize` on the daemon command line, and explicit JVM args
 * win over `JAVA_TOOL_OPTIONS`.
 *
 * What it does: writes (or replaces) the `org.gradle.jvmargs` line so the
 * Gradle daemon starts with the values we pass from app.json.
 */
const { withGradleProperties } = require("@expo/config-plugins");

const KEY = "org.gradle.jvmargs";

module.exports = function withGradleJvmArgs(config, jvmargs) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === "property" && item.key === KEY,
    );
    if (existing) {
      existing.value = jvmargs;
    } else {
      cfg.modResults.push({ type: "property", key: KEY, value: jvmargs });
    }
    return cfg;
  });
};
