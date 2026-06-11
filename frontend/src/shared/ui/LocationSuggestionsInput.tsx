import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Chip, Text, TextInput } from "react-native-paper";
import { useI18n } from "../i18n/I18nContext";
import { styles } from "./styles";

interface LocationSuggestionsInputProps {
  value: string;
  onChangeText: (text: string) => void;
  suggestions: string[];
  loading?: boolean;
  maxLength?: number;
  label?: string;
}

export function LocationSuggestionsInput({
  value,
  onChangeText,
  suggestions,
  loading = false,
  maxLength = 240,
  label = "Description"
}: Readonly<LocationSuggestionsInputProps>) {
  const { t } = useI18n();
  const [showSuggestions, setShowSuggestions] = useState(true);

  const handleSuggestionPress = (suggestion: string) => {
    onChangeText(suggestion);
    setShowSuggestions(false);
  };

  const shouldShowSuggestions = showSuggestions && suggestions.length > 0 && !value;

  return (
    <View style={styles.gap}>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setShowSuggestions(true)}
        maxLength={maxLength}
        multiline
      />
      {shouldShowSuggestions && (
        <View style={{ marginVertical: 8 }}>
          <Text variant="labelSmall" style={{ marginBottom: 8 }}>
            {t("expense.suggestedNearby")}
          </Text>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleSuggestionPress(item)}>
                <Chip
                  style={{ marginRight: 8, marginBottom: 8 }}
                  onPress={() => handleSuggestionPress(item)}
                >
                  {item}
                </Chip>
              </Pressable>
            )}
            scrollEnabled={false}
            numColumns={2}
          />
        </View>
      )}
    </View>
  );
}
