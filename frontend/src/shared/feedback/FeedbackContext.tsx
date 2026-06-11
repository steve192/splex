import { MaterialCommunityIcons } from "@expo/vector-icons";
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import { Surface, useTheme } from "react-native-paper";

import { appImages } from "../assets/images";

type FeedbackIcon = keyof typeof MaterialCommunityIcons.glyphMap;

type FeedbackOptions = {
  icon?: FeedbackIcon;
  image?: ImageSourcePropType;
};

type FeedbackContextValue = {
  showSuccess(options?: FeedbackOptions): void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: Readonly<{ children: ReactNode }>) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [icon, setIcon] = useState<FeedbackIcon>("check");
  const [image, setImage] = useState<ImageSourcePropType>(appImages.successCheck);
  const opacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.4)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const runId = useRef(0);

  const showSuccess = useCallback((options?: FeedbackOptions) => {
    runId.current += 1;
    const currentRun = runId.current;
    setIcon(options?.icon ?? "check");
    setImage(options?.image ?? feedbackImageForIcon(options?.icon));
    setVisible(true);
    opacity.setValue(0);
    iconScale.setValue(0.4);
    iconRotate.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.delay(120),
          Animated.parallel([
            Animated.spring(iconScale, {
              toValue: 1,
              friction: 5,
              tension: 90,
              useNativeDriver: true
            }),
            Animated.timing(iconRotate, {
              toValue: 1,
              duration: 260,
              easing: Easing.out(Easing.back(1.6)),
              useNativeDriver: true
            })
          ])
        ])
      ]),
      Animated.delay(420),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      })
    ]).start(() => {
      if (runId.current === currentRun) {
        setVisible(false);
      }
    });
  }, [opacity, iconScale, iconRotate]);

  const contextValue = useMemo(() => ({ showSuccess }), [showSuccess]);

  const rotation = iconRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-35deg", "0deg"]
  });

  return (
    <FeedbackContext.Provider value={contextValue}>
      <View style={feedbackStyles.root}>
        {children}
        {visible ? (
          <Animated.View
            pointerEvents="none"
            style={[
              feedbackStyles.overlay,
              {
                opacity,
                backgroundColor: `${theme.colors.scrim}66`
              }
            ]}
          >
            <Surface mode="elevated" elevation={5} style={feedbackStyles.surface}>
              <View
                style={[
                  feedbackStyles.iconFrame,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primaryContainer
                  }
                ]}
              >
                <Animated.View
                  style={{
                    transform: [{ scale: iconScale }, { rotate: rotation }]
                  }}
                >
                  {image ? (
                    <Image source={image} style={feedbackStyles.image} resizeMode="contain" />
                  ) : (
                    <MaterialCommunityIcons name={icon} size={66} color={theme.colors.primary} />
                  )}
                </Animated.View>
              </View>
            </Surface>
          </Animated.View>
        ) : null}
      </View>
    </FeedbackContext.Provider>
  );
}

function feedbackImageForIcon(icon?: FeedbackIcon): ImageSourcePropType {
  if (icon === "cash-check") return appImages.settlementSuccess;
  if (icon === "cloud-check-outline") return appImages.offlineSync;
  return appImages.successCheck;
}

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext);
  if (!value) {
    throw new Error("useFeedback must be used inside FeedbackProvider.");
  }
  return value;
}

const feedbackStyles = StyleSheet.create({
  iconFrame: {
    alignItems: "center",
    borderRadius: 72,
    borderWidth: 4,
    height: 112,
    justifyContent: "center",
    width: 112
  },
  image: {
    height: 80,
    width: 80
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  },
  root: {
    flex: 1
  },
  surface: {
    borderRadius: 80,
    padding: 16
  }
});
