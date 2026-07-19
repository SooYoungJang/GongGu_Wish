import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../types";

export function useAuthGate() {
  const { user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const requireAuth = useCallback(() => {
    if (user) return true;
    navigation.navigate("Login");
    return false;
  }, [navigation, user]);

  return {
    isAuthenticated: Boolean(user),
    requireAuth,
  };
}
